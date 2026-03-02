'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StockTable, useWarehouses } from '@/components/inventory/stock-table'
import type { StockRow } from '@/components/inventory/stock-table'
import { StockAdjustmentDialog } from '@/components/inventory/stock-adjustment-dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { downloadCSV } from '@/lib/utils/export'
import { toast } from 'sonner'
import { Package, SlidersHorizontal, Download } from 'lucide-react'

export default function InventoryPage() {
  const supabase = createClient()
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<StockRow | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const { data: warehouses } = useWarehouses()
  const handleExport = useCallback(async () => {
    setIsExporting(true)
    try {
      let query = supabase
        .from('warehouse_stock')
        .select('*, product_variants(variant_sku, product:products(name, sku), size:size_masters(name), color:color_masters(name)), warehouse:warehouses(name)')
        .order('updated_at', { ascending: false })

      if (warehouseFilter && warehouseFilter !== 'all') {
        query = query.eq('warehouse_id', warehouseFilter)
      }

      const { data, error } = await query
      if (error) throw error

      const rows = data ?? []
      downloadCSV(rows, [
        { header: 'Product', accessor: (r: any) => r.product_variants?.product?.name ?? '' },
        { header: 'SKU', accessor: (r: any) => r.product_variants?.product?.sku ?? '' },
        { header: 'Variant SKU', accessor: (r: any) => r.product_variants?.variant_sku ?? '' },
        { header: 'Size', accessor: (r: any) => r.product_variants?.size?.name ?? '' },
        { header: 'Color', accessor: (r: any) => r.product_variants?.color?.name ?? '' },
        { header: 'Warehouse', accessor: (r: any) => r.warehouse?.name ?? '' },
        { header: 'On Hand', accessor: (r: any) => r.qty_on_hand },
        { header: 'Reserved', accessor: (r: any) => r.qty_reserved },
        { header: 'Available', accessor: (r: any) => r.qty_available },
        { header: 'Low Stock Threshold', accessor: (r: any) => r.low_stock_threshold },
      ], `inventory-export-${new Date().toISOString().slice(0, 10)}`)

      toast.success(`Exported ${rows.length} stock records`)
    } catch {
      toast.error('Failed to export inventory')
    } finally {
      setIsExporting(false)
    }
  }, [supabase, warehouseFilter])

  const handleAdjust = (row: StockRow) => {
    setSelectedRow(row)
    setAdjustDialogOpen(true)
  }

  const handleOpenAdjust = () => {
    setSelectedRow(null)
    setAdjustDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Package className="size-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          </div>
          <p className="text-muted-foreground">
            Manage warehouse stock across all locations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={isExporting}>
            <Download className="size-4" />
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </Button>
          <Button onClick={handleOpenAdjust}>
            <SlidersHorizontal className="size-4" />
            Adjust Stock
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Warehouse:
          </span>
          <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All warehouses" />
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
      </div>

      {/* Stock Table */}
      <StockTable warehouseFilter={warehouseFilter} onAdjust={handleAdjust} />

      {/* Adjustment Dialog */}
      <StockAdjustmentDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        preselected={selectedRow}
      />
    </div>
  )
}
