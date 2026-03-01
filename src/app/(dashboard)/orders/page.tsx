'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { OrderTable, type OrderRow } from '@/components/orders/order-table'
import { OrderFiltersBar, type OrderFilters } from '@/components/orders/order-filters'
import { OrderTableSkeleton } from '@/components/orders/order-table'
import { Skeleton } from '@/components/ui/skeleton'

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

  const { data: orders, isLoading, isError, error } = useQuery({
    queryKey: ['orders', 'list', filters.dateFrom?.toISOString(), filters.dateTo?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('*, platform:platforms(name, display_name), order_items(count)')
        .order('ordered_at', { ascending: false })

      // Apply date filters at the query level for efficiency
      if (filters.dateFrom) {
        query = query.gte('ordered_at', filters.dateFrom.toISOString())
      }
      if (filters.dateTo) {
        query = query.lte('ordered_at', filters.dateTo.toISOString())
      }

      const { data, error } = await query

      if (error) throw error
      return data as OrderRow[]
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Unified order management across all platforms
          </p>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">
          Unified order management across all platforms
        </p>
      </div>

      {/* Filters */}
      <OrderFiltersBar filters={filters} onFiltersChange={setFilters} />

      {/* Table */}
      <OrderTable
        orders={orders ?? []}
        isLoading={false}
        globalFilter={filters.search}
        platformFilter={filters.platform}
        statusFilter={filters.status}
      />
    </div>
  )
}
