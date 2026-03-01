'use client'

import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormDescription,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const productFormSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(255),
  sku: z
    .string()
    .min(1, 'SKU is required')
    .max(50)
    .transform((val) => val.toUpperCase().replace(/\s+/g, ''))
    .refine((val) => /^[A-Z0-9\-_]+$/.test(val), {
      message: 'SKU must contain only uppercase letters, numbers, hyphens, and underscores',
    }),
  description: z.string().max(2000).optional().or(z.literal('')),
  category: z.string().optional().or(z.literal('')),
  material: z.string().max(100).optional().or(z.literal('')),
  cost_price: z.number().min(0, 'Cost price must be 0 or more'),
  mrp: z.number().min(0, 'MRP must be 0 or more'),
  selling_price: z.number().min(0, 'Selling price must be 0 or more'),
  gst_rate: z.number(),
  hsn_code: z.string().max(20).optional().or(z.literal('')),
  low_stock_threshold: z.number().int().min(0).optional(),
})

type ProductFormValues = z.infer<typeof productFormSchema>

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'Shirts',
  'Kurtas',
  'Trousers',
  'Dresses',
  'Accessories',
  'Other',
]

const GST_RATES = [
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18%' },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProductFormProps {
  initialData?: {
    id: string
    name: string
    sku: string
    description?: string | null
    category?: string | null
    material?: string | null
    cost_price: number
    mrp: number
    selling_price: number
    gst_rate: number
    hsn_code?: string | null
    low_stock_threshold?: number | null
    images?: string[]
  }
  onSuccess?: (product: { id: string }) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProductForm({ initialData, onSuccess }: ProductFormProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const isEditing = !!initialData?.id

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      sku: initialData?.sku ?? '',
      description: initialData?.description ?? '',
      category: initialData?.category ?? '',
      material: initialData?.material ?? '',
      cost_price: initialData?.cost_price ?? 0,
      mrp: initialData?.mrp ?? 0,
      selling_price: initialData?.selling_price ?? 0,
      gst_rate: initialData?.gst_rate ?? 5,
      hsn_code: initialData?.hsn_code ?? '',
      low_stock_threshold: initialData?.low_stock_threshold ?? 10,
    },
  })

  const mutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const payload = {
        name: values.name,
        sku: values.sku,
        description: values.description || null,
        category: values.category || null,
        material: values.material || null,
        cost_price: values.cost_price,
        mrp: values.mrp,
        selling_price: values.selling_price,
        gst_rate: values.gst_rate,
        hsn_code: values.hsn_code || null,
        low_stock_threshold: values.low_stock_threshold,
      }

      if (isEditing) {
        const { data, error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', initialData.id)
          .select()
          .single()

        if (error) throw error
        return data
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert(payload)
          .select()
          .single()

        if (error) throw error
        return data
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(isEditing ? 'Product updated successfully' : 'Product created successfully')
      onSuccess?.({ id: data.id })
    },
    onError: (error: Error) => {
      toast.error(`Failed to ${isEditing ? 'update' : 'create'} product: ${error.message}`)
    },
  })

  function onSubmit(values: ProductFormValues) {
    mutation.mutate(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Core product details and identification
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Cotton Oxford Shirt" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. SHIRT-OXF-001"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value.toUpperCase().replace(/\s+/g, '')
                          )
                        }
                        className="font-mono"
                      />
                    </FormControl>
                    <FormDescription>
                      Uppercase, no spaces. Letters, numbers, hyphens, underscores only.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the product..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
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
                name="material"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Material</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 100% Cotton" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>
              Set the cost, MRP, and selling prices
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="cost_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Price *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                          {'\u20B9'}
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-7"
                          {...field}
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
                    <FormLabel>MRP *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                          {'\u20B9'}
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-7"
                          {...field}
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
                    <FormLabel>Selling Price *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                          {'\u20B9'}
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="pl-7"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tax & Inventory */}
        <Card>
          <CardHeader>
            <CardTitle>Tax & Inventory</CardTitle>
            <CardDescription>
              GST configuration and stock thresholds
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="gst_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GST Rate</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={String(field.value)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select GST rate" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {GST_RATES.map((rate) => (
                          <SelectItem
                            key={rate.value}
                            value={String(rate.value)}
                          >
                            {rate.label}
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
                name="hsn_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HSN Code</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 6205" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="low_stock_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Low Stock Threshold</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="1" {...field} />
                    </FormControl>
                    <FormDescription>
                      Alert when stock falls below this
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Images (Placeholder) */}
        <Card>
          <CardHeader>
            <CardTitle>Images</CardTitle>
            <CardDescription>
              Product photos for catalog display
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
              <Upload className="text-muted-foreground mb-4 size-10" />
              <p className="text-muted-foreground text-sm font-medium">
                Drag & drop images here, or click to browse
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                PNG, JPG up to 5MB. Maximum 8 images.
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-4" disabled>
                Upload Images
              </Button>
              <p className="text-muted-foreground mt-2 text-xs italic">
                Image upload coming soon
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            {isEditing ? 'Update Product' : 'Create Product'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
