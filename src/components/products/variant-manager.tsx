'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SizeMaster {
  id: string
  name: string
  display_order: number
}

interface ColorMaster {
  id: string
  name: string
  hex_code: string | null
}

interface Variant {
  id: string
  product_id: string
  variant_sku: string
  size_id: string | null
  color_id: string | null
  barcode: string | null
  weight_grams: number | null
  cost_price: number
  mrp: number
  selling_price: number
  is_active: boolean
  size_master?: SizeMaster | null
  color_master?: ColorMaster | null
}

interface VariantManagerProps {
  productId: string
  productSku: string
  productCostPrice: number
  productMrp: number
  productSellingPrice: number
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const variantFormSchema = z.object({
  size_id: z.string().min(1, 'Size is required'),
  color_id: z.string().min(1, 'Color is required'),
  barcode: z.string().max(50).optional().or(z.literal('')),
  weight_grams: z.number().int().min(0).optional().or(z.literal(0)),
  cost_price: z.number().min(0).optional(),
  mrp: z.number().min(0).optional(),
  selling_price: z.number().min(0).optional(),
})

type VariantFormValues = z.infer<typeof variantFormSchema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(value: number): string {
  return `\u20B9${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VariantManager({
  productId,
  productSku,
  productCostPrice,
  productMrp,
  productSellingPrice,
}: VariantManagerProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null)

  // Fetch variants
  const { data: variants, isLoading: variantsLoading } = useQuery({
    queryKey: ['product-variants', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*, size_master:size_masters(*), color_master:color_masters(*)')
        .eq('product_id', productId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Variant[]
    },
  })

  // Fetch sizes
  const { data: sizes } = useQuery({
    queryKey: ['size-masters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('size_masters')
        .select('*')
        .order('display_order', { ascending: true })

      if (error) throw error
      return data as SizeMaster[]
    },
  })

  // Fetch colors
  const { data: colors } = useQuery({
    queryKey: ['color-masters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('color_masters')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      return data as ColorMaster[]
    },
  })

  const form = useForm<VariantFormValues>({
    resolver: zodResolver(variantFormSchema),
    defaultValues: {
      size_id: '',
      color_id: '',
      barcode: '',
      weight_grams: 0,
      cost_price: undefined,
      mrp: undefined,
      selling_price: undefined,
    },
  })

  // Generate variant SKU from product SKU + size + color
  function generateVariantSku(sizeId: string, colorId: string): string {
    const size = sizes?.find((s) => s.id === sizeId)
    const color = colors?.find((c) => c.id === colorId)
    const sizePart = size?.name?.substring(0, 3).toUpperCase() ?? ''
    const colorPart = color?.name?.substring(0, 3).toUpperCase() ?? ''
    return `${productSku}-${sizePart}-${colorPart}`
  }

  // Create variant mutation
  const createMutation = useMutation({
    mutationFn: async (values: VariantFormValues) => {
      const variantSku = generateVariantSku(values.size_id, values.color_id)
      const payload = {
        product_id: productId,
        variant_sku: variantSku,
        size_id: values.size_id,
        color_id: values.color_id,
        barcode: values.barcode || null,
        weight_grams: values.weight_grams || null,
        cost_price: values.cost_price ?? productCostPrice,
        mrp: values.mrp ?? productMrp,
        selling_price: values.selling_price ?? productSellingPrice,
        is_active: true,
      }

      const { data, error } = await supabase
        .from('product_variants')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Variant created successfully')
      setDialogOpen(false)
      form.reset()
    },
    onError: (error: Error) => {
      toast.error(`Failed to create variant: ${error.message}`)
    },
  })

  // Update variant mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string
      values: VariantFormValues
    }) => {
      const variantSku = generateVariantSku(values.size_id, values.color_id)
      const payload = {
        variant_sku: variantSku,
        size_id: values.size_id,
        color_id: values.color_id,
        barcode: values.barcode || null,
        weight_grams: values.weight_grams || null,
        cost_price: values.cost_price ?? productCostPrice,
        mrp: values.mrp ?? productMrp,
        selling_price: values.selling_price ?? productSellingPrice,
      }

      const { data, error } = await supabase
        .from('product_variants')
        .update(payload)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Variant updated successfully')
      setDialogOpen(false)
      setEditingVariant(null)
      form.reset()
    },
    onError: (error: Error) => {
      toast.error(`Failed to update variant: ${error.message}`)
    },
  })

  // Delete variant mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_variants')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', productId] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success('Variant deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete variant: ${error.message}`)
    },
  })

  function openCreateDialog() {
    setEditingVariant(null)
    form.reset({
      size_id: '',
      color_id: '',
      barcode: '',
      weight_grams: 0,
      cost_price: undefined,
      mrp: undefined,
      selling_price: undefined,
    })
    setDialogOpen(true)
  }

  function openEditDialog(variant: Variant) {
    setEditingVariant(variant)
    form.reset({
      size_id: variant.size_id ?? '',
      color_id: variant.color_id ?? '',
      barcode: variant.barcode ?? '',
      weight_grams: variant.weight_grams ?? 0,
      cost_price: variant.cost_price,
      mrp: variant.mrp,
      selling_price: variant.selling_price,
    })
    setDialogOpen(true)
  }

  function onSubmit(values: VariantFormValues) {
    if (editingVariant) {
      updateMutation.mutate({ id: editingVariant.id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  if (variantsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {Array.from({ length: 9 }).map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-16" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, rowIdx) => (
                <TableRow key={rowIdx}>
                  {Array.from({ length: 9 }).map((_, colIdx) => (
                    <TableCell key={colIdx}>
                      <Skeleton className="h-4 w-14" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {variants?.length ?? 0} variant{(variants?.length ?? 0) !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="mr-2 size-4" />
          Add Variant
        </Button>
      </div>

      {/* Variants Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Variant SKU</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>Weight (g)</TableHead>
              <TableHead>Cost Price</TableHead>
              <TableHead>MRP</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants && variants.length > 0 ? (
              variants.map((variant) => (
                <TableRow key={variant.id}>
                  <TableCell className="font-mono text-sm">
                    {variant.variant_sku}
                  </TableCell>
                  <TableCell>
                    {variant.size_master?.name ?? '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {variant.color_master?.hex_code && (
                        <div
                          className="size-4 rounded-full border"
                          style={{ backgroundColor: variant.color_master.hex_code }}
                        />
                      )}
                      {variant.color_master?.name ?? '-'}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {variant.barcode ?? '-'}
                  </TableCell>
                  <TableCell>
                    {variant.weight_grams ? `${variant.weight_grams}g` : '-'}
                  </TableCell>
                  <TableCell>{formatPrice(variant.cost_price)}</TableCell>
                  <TableCell>{formatPrice(variant.mrp)}</TableCell>
                  <TableCell>
                    <Badge variant={variant.is_active ? 'default' : 'secondary'}>
                      {variant.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => openEditDialog(variant)}
                      >
                        <Pencil className="size-3" />
                        <span className="sr-only">Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this variant?')) {
                            deleteMutation.mutate(variant.id)
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="size-3 text-destructive" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  No variants yet. Click &quot;Add Variant&quot; to create one.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingVariant ? 'Edit Variant' : 'Add Variant'}
            </DialogTitle>
            <DialogDescription>
              {editingVariant
                ? 'Update the variant details below.'
                : 'Create a new size/color variant for this product.'}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="size_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Size *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sizes?.map((size) => (
                            <SelectItem key={size.id} value={size.id}>
                              {size.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="color_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color *</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select color" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {colors?.map((color) => (
                            <SelectItem key={color.id} value={color.id}>
                              <div className="flex items-center gap-2">
                                {color.hex_code && (
                                  <div
                                    className="size-3 rounded-full border"
                                    style={{ backgroundColor: color.hex_code }}
                                  />
                                )}
                                {color.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Auto-generated SKU preview */}
              {form.watch('size_id') && form.watch('color_id') && (
                <div className="bg-muted rounded-md p-3">
                  <p className="text-muted-foreground text-xs">
                    Generated Variant SKU
                  </p>
                  <p className="font-mono text-sm font-medium">
                    {generateVariantSku(
                      form.watch('size_id'),
                      form.watch('color_id')
                    )}
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 8901234567890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="weight_grams"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (grams)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="e.g. 250"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="cost_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost Price</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                            {'\u20B9'}
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={String(productCostPrice)}
                            className="pl-7"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="mrp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MRP</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                            {'\u20B9'}
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={String(productMrp)}
                            className="pl-7"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="selling_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selling Price</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                            {'\u20B9'}
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={String(productSellingPrice)}
                            className="pl-7"
                            {...field}
                            value={field.value ?? ''}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  {editingVariant ? 'Update Variant' : 'Create Variant'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
