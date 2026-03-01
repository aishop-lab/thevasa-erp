'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { Check, ChevronsUpDown, Plus, Minus, Loader2 } from 'lucide-react'
import type { StockRow } from './stock-table'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VariantOption {
  id: string
  variant_sku: string
  product_name: string
  size_name: string | null
  color_name: string | null
}

interface StockAdjustmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-selected row when adjusting from the stock table */
  preselected?: StockRow | null
}

type AdjustmentType = 'add' | 'remove'
type AdjustmentReason = 'purchase' | 'damage' | 'adjustment' | 'return' | 'other'

const REASONS: { value: AdjustmentReason; label: string }[] = [
  { value: 'purchase', label: 'Purchase / Restock' },
  { value: 'damage', label: 'Damage / Loss' },
  { value: 'adjustment', label: 'Manual Adjustment' },
  { value: 'return', label: 'Customer Return' },
  { value: 'other', label: 'Other' },
]

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

function useVariantOptions() {
  const supabase = createClient()

  return useQuery<VariantOption[]>({
    queryKey: ['variant_options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select(
          'id, variant_sku, product:products(name), size:size_masters(name), color:color_masters(name)'
        )
        .eq('is_active', true)
        .order('variant_sku')

      if (error) throw error

      return (data ?? []).map((v: Record<string, unknown>) => ({
        id: v.id as string,
        variant_sku: v.variant_sku as string,
        product_name: (v.product as { name: string } | null)?.name ?? '—',
        size_name: (v.size as { name: string } | null)?.name ?? null,
        color_name: (v.color as { name: string } | null)?.name ?? null,
      }))
    },
  })
}

function useWarehouseOptions() {
  const supabase = createClient()

  return useQuery<{ id: string; name: string }[]>({
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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StockAdjustmentDialog({
  open,
  onOpenChange,
  preselected,
}: StockAdjustmentDialogProps) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  const { data: variants } = useVariantOptions()
  const { data: warehouses } = useWarehouseOptions()

  // Form state
  const [warehouseId, setWarehouseId] = useState(
    preselected?.warehouse_id ?? ''
  )
  const [variantId, setVariantId] = useState(
    preselected?.variant_id ?? ''
  )
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('add')
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState<AdjustmentReason>('adjustment')
  const [notes, setNotes] = useState('')
  const [variantOpen, setVariantOpen] = useState(false)

  // Sync preselected when dialog opens
  const resetForm = () => {
    setWarehouseId(preselected?.warehouse_id ?? '')
    setVariantId(preselected?.variant_id ?? '')
    setAdjustmentType('add')
    setQuantity('')
    setReason('adjustment')
    setNotes('')
  }

  // Mutation
  const mutation = useMutation({
    mutationFn: async () => {
      const qty = parseInt(quantity, 10)
      if (isNaN(qty) || qty <= 0) throw new Error('Invalid quantity')

      const signedQty = adjustmentType === 'add' ? qty : -qty

      // Update warehouse_stock qty_on_hand
      const { data: currentStock, error: fetchErr } = await supabase
        .from('warehouse_stock')
        .select('id, qty_on_hand, qty_reserved')
        .eq('warehouse_id', warehouseId)
        .eq('variant_id', variantId)
        .single()

      if (fetchErr) throw fetchErr

      const newOnHand = currentStock.qty_on_hand + signedQty
      if (newOnHand < 0) throw new Error('Stock cannot go below zero')

      const { error: updateErr } = await supabase
        .from('warehouse_stock')
        .update({
          qty_on_hand: newOnHand,
          qty_available: newOnHand - currentStock.qty_reserved,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentStock.id)

      if (updateErr) throw updateErr

      // Create stock_movement record
      const { error: movementErr } = await supabase
        .from('stock_movements')
        .insert({
          warehouse_id: warehouseId,
          variant_id: variantId,
          movement_type: reason === 'purchase' ? 'purchase' : reason === 'damage' ? 'damage' : reason === 'return' ? 'return' : 'adjustment',
          quantity: signedQty,
          notes: notes || null,
        })

      if (movementErr) throw movementErr
    },
    onSuccess: () => {
      toast.success('Stock adjusted successfully')
      queryClient.invalidateQueries({ queryKey: ['warehouse_stock'] })
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] })
      resetForm()
      onOpenChange(false)
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to adjust stock')
    },
  })

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  const canSubmit =
    warehouseId && variantId && quantity && parseInt(quantity, 10) > 0

  // Find selected variant label
  const selectedVariant = variants?.find((v) => v.id === variantId)
  const selectedVariantLabel = selectedVariant
    ? `${selectedVariant.product_name} - ${selectedVariant.variant_sku}${selectedVariant.size_name ? ` (${selectedVariant.size_name})` : ''}${selectedVariant.color_name ? ` / ${selectedVariant.color_name}` : ''}`
    : ''

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust Stock</DialogTitle>
          <DialogDescription>
            Add or remove stock from a warehouse location.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warehouse */}
          <div className="space-y-2">
            <Label htmlFor="warehouse">Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger id="warehouse" className="w-full">
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {warehouses?.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Product Variant (searchable combobox) */}
          <div className="space-y-2">
            <Label>Product Variant</Label>
            <Popover open={variantOpen} onOpenChange={setVariantOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={variantOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedVariantLabel || 'Select variant...'}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search by SKU or product name..." />
                  <CommandList>
                    <CommandEmpty>No variant found.</CommandEmpty>
                    <CommandGroup>
                      {variants?.map((v) => {
                        const label = `${v.product_name} - ${v.variant_sku}${v.size_name ? ` (${v.size_name})` : ''}${v.color_name ? ` / ${v.color_name}` : ''}`
                        return (
                          <CommandItem
                            key={v.id}
                            value={label}
                            onSelect={() => {
                              setVariantId(v.id)
                              setVariantOpen(false)
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 size-4',
                                variantId === v.id
                                  ? 'opacity-100'
                                  : 'opacity-0'
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="text-sm">{v.product_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {v.variant_sku}
                                {v.size_name && ` - ${v.size_name}`}
                                {v.color_name && ` / ${v.color_name}`}
                              </span>
                            </div>
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={adjustmentType === 'add' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setAdjustmentType('add')}
              >
                <Plus className="size-4" />
                Add (+)
              </Button>
              <Button
                type="button"
                variant={adjustmentType === 'remove' ? 'destructive' : 'outline'}
                className="flex-1"
                onClick={() => setAdjustmentType('remove')}
              >
                <Minus className="size-4" />
                Remove (-)
              </Button>
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              placeholder="Enter quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Select
              value={reason}
              onValueChange={(val) => setReason(val as AdjustmentReason)}
            >
              <SelectTrigger id="reason" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSubmit || mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {adjustmentType === 'add' ? 'Add Stock' : 'Remove Stock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
