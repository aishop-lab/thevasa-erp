'use client'

import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { MovementLog, MOVEMENT_TYPES } from '@/components/inventory/movement-log'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils/date'
import { downloadCSV } from '@/lib/utils/export'
import { toast } from 'sonner'
import {
  ArrowLeftRight,
  CalendarIcon,
  Download,
  Search,
} from 'lucide-react'

type MovementType =
  | 'purchase'
  | 'sales'
  | 'adjustment'
  | 'damage'
  | 'return'
  | 'transfer_in'
  | 'transfer_out'
  | 'fba_sync'

export default function MovementsPage() {
  const supabase = createClient()

  // Date range defaults: last 30 days
  const defaultFrom = new Date()
  defaultFrom.setDate(defaultFrom.getDate() - 30)

  const [dateFrom, setDateFrom] = useState<Date | undefined>(defaultFrom)
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date())
  const [movementTypeFilter, setMovementTypeFilter] = useState<
    MovementType | 'all'
  >('all')
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      let query = supabase
        .from('stock_movements')
        .select('*, variant:product_variants(variant_sku, product:products(name), size:size_masters(name), color:color_masters(name)), warehouse:warehouses(name)')
        .order('created_at', { ascending: false })

      if (dateFrom) query = query.gte('created_at', dateFrom.toISOString())
      if (dateTo) {
        const endDate = new Date(dateTo)
        endDate.setDate(endDate.getDate() + 1)
        query = query.lt('created_at', endDate.toISOString())
      }
      if (movementTypeFilter !== 'all') query = query.eq('movement_type', movementTypeFilter)
      if (warehouseFilter && warehouseFilter !== 'all') query = query.eq('warehouse_id', warehouseFilter)

      const { data, error } = await query
      if (error) throw error

      let rows = (data ?? []) as any[]

      // Client-side product filter for export
      if (productFilter) {
        const lower = productFilter.toLowerCase()
        rows = rows.filter((r: any) =>
          r.variant?.product?.name?.toLowerCase().includes(lower) ||
          r.variant?.variant_sku?.toLowerCase().includes(lower)
        )
      }

      downloadCSV(rows, [
        { header: 'Date', accessor: (r: any) => r.created_at },
        { header: 'Product', accessor: (r: any) => r.variant?.product?.name ?? '' },
        { header: 'Variant SKU', accessor: (r: any) => r.variant?.variant_sku ?? '' },
        { header: 'Size', accessor: (r: any) => r.variant?.size?.name ?? '' },
        { header: 'Color', accessor: (r: any) => r.variant?.color?.name ?? '' },
        { header: 'Warehouse', accessor: (r: any) => r.warehouse?.name ?? '' },
        { header: 'Type', accessor: (r: any) => r.movement_type },
        { header: 'Quantity', accessor: (r: any) => r.quantity },
        { header: 'Notes', accessor: (r: any) => r.notes ?? '' },
      ], `movements-export-${new Date().toISOString().slice(0, 10)}`)

      toast.success(`Exported ${rows.length} movements`)
    } catch {
      toast.error('Failed to export movements')
    } finally {
      setIsExporting(false)
    }
  }, [supabase, dateFrom, dateTo, movementTypeFilter, warehouseFilter, productFilter])

  // Warehouses for the filter
  const { data: warehouses } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name')
        .order('name')

      if (error) throw error
      return data ?? []
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="size-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">
              Stock Movements
            </h1>
          </div>
          <p className="text-muted-foreground">
            Track stock movement history across warehouses
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={isExporting}>
          <Download className="size-4" />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-4 flex-wrap">
        {/* Date From */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">From</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[160px] justify-start text-left font-normal',
                  !dateFrom && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="size-4" />
                {dateFrom ? formatDate(dateFrom, 'dd MMM yyyy') : 'Start date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={setDateFrom}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Date To */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'w-[160px] justify-start text-left font-normal',
                  !dateTo && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="size-4" />
                {dateTo ? formatDate(dateTo, 'dd MMM yyyy') : 'End date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={setDateTo}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Movement Type */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select
            value={movementTypeFilter}
            onValueChange={(val) =>
              setMovementTypeFilter(val as MovementType | 'all')
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {MOVEMENT_TYPES.map((mt) => (
                <SelectItem key={mt.value} value={mt.value}>
                  {mt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Warehouse */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Warehouse</Label>
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses?.map((wh) => (
                <SelectItem key={wh.id} value={wh.id}>
                  {wh.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Product search */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Product</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search product or SKU..."
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
        </div>
      </div>

      {/* Movement Log */}
      <MovementLog
        dateFrom={dateFrom ? dateFrom.toISOString() : ''}
        dateTo={dateTo ? dateTo.toISOString() : ''}
        movementTypeFilter={movementTypeFilter}
        warehouseFilter={warehouseFilter}
        productFilter={productFilter}
      />
    </div>
  )
}
