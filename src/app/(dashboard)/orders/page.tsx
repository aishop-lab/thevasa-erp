'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useOrders, useOrderStats } from '@/hooks/use-orders'
import { OrderTable, type OrderRow } from '@/components/orders/order-table'
import { OrderFiltersBar, type OrderFilters } from '@/components/orders/order-filters'
import { OrderStatusCards } from '@/components/orders/order-status-cards'
import { OrderTableSkeleton } from '@/components/orders/order-table'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { downloadCSV } from '@/lib/utils/export'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OrdersPage() {
  const supabase = createClient()

  const [filters, setFilters] = useState<OrderFilters>({
    search: '',
    platform: 'all',
    status: 'all',
    dateFrom: undefined,
    dateTo: undefined,
  })

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  // Debounce search to avoid firing query on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const searchTimeoutRef = useState<ReturnType<typeof setTimeout> | null>(null)

  const handleFiltersChange = useCallback((newFilters: OrderFilters) => {
    setFilters(newFilters)
    setPage(0) // Reset to first page on any filter change

    // Debounce search
    if (newFilters.search !== filters.search) {
      if (searchTimeoutRef[0]) clearTimeout(searchTimeoutRef[0])
      searchTimeoutRef[0] = setTimeout(() => {
        setDebouncedSearch(newFilters.search)
      }, 300)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search])

  // Look up platform IDs from names
  const { data: platforms } = useQuery({
    queryKey: ['platforms-lookup'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platforms')
        .select('id, name')
      if (error) throw error
      return data ?? []
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  const platformIdMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of platforms ?? []) {
      map[p.name.toLowerCase()] = p.id
    }
    return map
  }, [platforms])

  // Build server-side filters
  const serverFilters = useMemo(() => ({
    platformId: filters.platform !== 'all' ? platformIdMap[filters.platform] : undefined,
    status: filters.status !== 'all' ? filters.status : undefined,
    startDate: filters.dateFrom?.toISOString(),
    endDate: filters.dateTo?.toISOString(),
    search: debouncedSearch || undefined,
    page,
    pageSize,
  }), [filters.platform, filters.status, filters.dateFrom, filters.dateTo, debouncedSearch, page, pageSize, platformIdMap])

  const { data: ordersResult, isLoading, isError, error } = useOrders(serverFilters)

  // Fetch stats for status cards (same date range, no pagination)
  const { data: stats } = useOrderStats({
    startDate: filters.dateFrom?.toISOString(),
    endDate: filters.dateTo?.toISOString(),
  })

  const [isExporting, setIsExporting] = useState(false)

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      // Fetch all matching orders (no pagination) for export
      let query = supabase
        .from('orders')
        .select('*, platform:platforms(name, display_name), order_items(count)')
        .order('ordered_at', { ascending: false })

      if (serverFilters.platformId) query = query.eq('platform_id', serverFilters.platformId)
      if (serverFilters.status) query = query.eq('status', serverFilters.status as any)
      if (serverFilters.startDate) query = query.gte('ordered_at', serverFilters.startDate)
      if (serverFilters.endDate) query = query.lte('ordered_at', serverFilters.endDate)
      if (serverFilters.search) {
        query = query.or(`order_number.ilike.%${serverFilters.search}%,customer_name.ilike.%${serverFilters.search}%`)
      }

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      const rows = data ?? []
      downloadCSV(rows, [
        { header: 'Order #', accessor: (r: any) => r.order_number },
        { header: 'Platform', accessor: (r: any) => r.platform?.display_name ?? r.platform?.name ?? '' },
        { header: 'Customer', accessor: (r: any) => r.customer_name },
        { header: 'Email', accessor: (r: any) => r.customer_email },
        { header: 'Items', accessor: (r: any) => r.order_items?.[0]?.count ?? 0 },
        { header: 'Total', accessor: (r: any) => r.total_amount },
        { header: 'Status', accessor: (r: any) => r.status },
        { header: 'Payment', accessor: (r: any) => r.payment_status },
        { header: 'Date', accessor: (r: any) => r.ordered_at },
      ], `orders-export-${new Date().toISOString().slice(0, 10)}`)

      toast.success(`Exported ${rows.length} orders`)
    } catch {
      toast.error('Failed to export orders')
    } finally {
      setIsExporting(false)
    }
  }, [supabase, serverFilters])

  const handleStatusCardClick = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      status: prev.status === status ? 'all' : status,
    }))
    setPage(0)
  }

  if (isLoading && !ordersResult) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Unified order management across all platforms
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px]" />
          ))}
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Skeleton className="h-9 w-[300px]" />
          <Skeleton className="h-9 w-[160px]" />
          <Skeleton className="h-9 w-[160px]" />
          <Skeleton className="h-9 w-[150px]" />
          <Skeleton className="h-9 w-[150px]" />
        </div>
        <OrderTableSkeleton />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Unified order management across all platforms
          </p>
        </div>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load orders: {(error as Error).message}
          </p>
        </div>
      </div>
    )
  }

  // Build a flat orders array for status cards from stats
  const statusCardOrders = stats
    ? Object.entries(stats.byStatus).flatMap(([status, { count, amount }]) =>
        Array.from({ length: count }, (_, i) => ({
          id: `${status}-${i}`,
          status,
          total_amount: count > 0 ? amount / count : 0,
        }))
      )
    : (ordersResult?.data ?? [])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Unified order management across all platforms
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={isExporting}>
          <Download className="size-4" />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {/* Status breakdown cards */}
      <OrderStatusCards
        orders={statusCardOrders as any}
        activeStatus={filters.status}
        onStatusClick={handleStatusCardClick}
      />

      {/* Filters */}
      <OrderFiltersBar filters={filters} onFiltersChange={handleFiltersChange} />

      {/* Table with server-side pagination */}
      <OrderTable
        orders={(ordersResult?.data ?? []) as OrderRow[]}
        isLoading={isLoading}
        totalCount={ordersResult?.totalCount}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  )
}
