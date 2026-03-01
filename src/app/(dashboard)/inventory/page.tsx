'use client'

import { useState } from 'react'
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
import { Package, SlidersHorizontal } from 'lucide-react'

export default function InventoryPage() {
  const [warehouseFilter, setWarehouseFilter] = useState('all')
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<StockRow | null>(null)

  const { data: warehouses } = useWarehouses()

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
        <Button onClick={handleOpenAdjust}>
          <SlidersHorizontal className="size-4" />
          Adjust Stock
        </Button>
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
