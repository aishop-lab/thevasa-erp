'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Warehouse,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  MapPin,
  Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WarehouseRow {
  id: string
  team_id: string
  name: string
  code: string
  address: string | null
  city: string | null
  state: string | null
  pincode: string | null
  is_fba: boolean
  platform: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  stock_count?: number
}

// ---------------------------------------------------------------------------
// Validation Schema
// ---------------------------------------------------------------------------

const warehouseSchema = z.object({
  name: z.string().min(1, 'Warehouse name is required').max(100),
  code: z
    .string()
    .min(1, 'Warehouse code is required')
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, 'Code must be uppercase alphanumeric (A-Z, 0-9, _, -)'),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z
    .string()
    .regex(/^[0-9]{6}$/, 'Pincode must be 6 digits')
    .or(z.literal(''))
    .optional(),
  is_fba: z.boolean().optional(),
  platform: z.string().optional(),
  is_active: z.boolean().optional(),
})

type WarehouseFormValues = z.infer<typeof warehouseSchema>

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function WarehousesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {Array.from({ length: 7 }).map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-20" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 4 }).map((_, rowIdx) => (
                <TableRow key={rowIdx}>
                  {Array.from({ length: 7 }).map((_, colIdx) => (
                    <TableCell key={colIdx}>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Warehouse Form Dialog
// ---------------------------------------------------------------------------

function WarehouseFormDialog({
  open,
  onOpenChange,
  warehouse,
  onSubmit,
  isSubmitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouse: WarehouseRow | null
  onSubmit: (values: WarehouseFormValues) => void
  isSubmitting: boolean
}) {
  const isEditing = !!warehouse

  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseSchema),
    defaultValues: {
      name: '',
      code: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      is_fba: false,
      platform: '',
      is_active: true,
    },
  })

  const watchIsFba = form.watch('is_fba')

  // Reset form when dialog opens/closes or warehouse changes
  useEffect(() => {
    if (open) {
      if (warehouse) {
        form.reset({
          name: warehouse.name,
          code: warehouse.code,
          address: warehouse.address ?? '',
          city: warehouse.city ?? '',
          state: warehouse.state ?? '',
          pincode: warehouse.pincode ?? '',
          is_fba: warehouse.is_fba,
          platform: warehouse.platform ?? '',
          is_active: warehouse.is_active,
        })
      } else {
        form.reset({
          name: '',
          code: '',
          address: '',
          city: '',
          state: '',
          pincode: '',
          is_fba: false,
          platform: '',
          is_active: true,
        })
      }
    }
  }, [open, warehouse, form])

  const handleSubmit = (values: WarehouseFormValues) => {
    onSubmit(values)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Warehouse' : 'Add Warehouse'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update warehouse details and configuration.'
              : 'Add a new warehouse or FBA location to track inventory.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Warehouse Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Main Warehouse" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="WH-MAIN"
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormDescription>Unique identifier</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input placeholder="Warehouse address" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input placeholder="Mumbai" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input placeholder="Maharashtra" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pincode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pincode</FormLabel>
                    <FormControl>
                      <Input placeholder="400001" maxLength={6} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex items-center gap-6">
              <FormField
                control={form.control}
                name="is_fba"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      FBA / Virtual Warehouse
                    </FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">Active</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            {watchIsFba && (
              <FormField
                control={form.control}
                name="platform"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Platform</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select platform" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="amazon">Amazon FBA</SelectItem>
                        <SelectItem value="shopify">Shopify</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The platform this virtual warehouse belongs to
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                )}
                {isEditing ? 'Update Warehouse' : 'Add Warehouse'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function WarehousesPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRow | null>(
    null
  )

  // Fetch warehouses with stock counts
  const {
    data: warehouses,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*, warehouse_stock(count)')
        .order('created_at', { ascending: true })

      if (error) throw error

      return (data ?? []).map((wh: Record<string, unknown>) => ({
        ...wh,
        stock_count:
          (wh.warehouse_stock as { count: number }[])?.[0]?.count ?? 0,
      })) as WarehouseRow[]
    },
  })

  // Create warehouse
  const createMutation = useMutation({
    mutationFn: async (values: WarehouseFormValues) => {
      const { error } = await supabase.from('warehouses').insert({
        name: values.name,
        code: values.code,
        address: values.address || null,
        city: values.city || null,
        state: values.state || null,
        pincode: values.pincode || null,
        is_fba: values.is_fba,
        platform: values.is_fba ? values.platform || null : null,
        is_active: values.is_active,
      })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Warehouse created successfully')
      setShowFormDialog(false)
    },
    onError: (err: Error) => {
      toast.error(`Failed to create warehouse: ${err.message}`)
    },
  })

  // Update warehouse
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string
      values: WarehouseFormValues
    }) => {
      const { error } = await supabase
        .from('warehouses')
        .update({
          name: values.name,
          code: values.code,
          address: values.address || null,
          city: values.city || null,
          state: values.state || null,
          pincode: values.pincode || null,
          is_fba: values.is_fba,
          platform: values.is_fba ? values.platform || null : null,
          is_active: values.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Warehouse updated successfully')
      setShowFormDialog(false)
      setEditingWarehouse(null)
    },
    onError: (err: Error) => {
      toast.error(`Failed to update warehouse: ${err.message}`)
    },
  })

  // Delete warehouse
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('warehouses')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Warehouse deleted')
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete warehouse: ${err.message}`)
    },
  })

  const handleOpenCreate = () => {
    setEditingWarehouse(null)
    setShowFormDialog(true)
  }

  const handleOpenEdit = (warehouse: WarehouseRow) => {
    setEditingWarehouse(warehouse)
    setShowFormDialog(true)
  }

  const handleFormSubmit = (values: WarehouseFormValues) => {
    if (editingWarehouse) {
      updateMutation.mutate({ id: editingWarehouse.id, values })
    } else {
      createMutation.mutate(values)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
          <p className="text-muted-foreground">
            Configure physical warehouses and FBA locations
          </p>
        </div>
        <WarehousesSkeleton />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
          <p className="text-muted-foreground">
            Configure physical warehouses and FBA locations
          </p>
        </div>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load warehouses: {(error as Error).message}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
        <p className="text-muted-foreground">
          Configure physical warehouses and FBA locations
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="size-5" />
                Warehouse Locations
              </CardTitle>
              <CardDescription>
                {warehouses?.length ?? 0} warehouse{(warehouses?.length ?? 0) !== 1 ? 's' : ''} configured
              </CardDescription>
            </div>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 size-4" />
              Add Warehouse
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Stock Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses && warehouses.length > 0 ? (
                  warehouses.map((wh) => (
                    <TableRow key={wh.id}>
                      <TableCell className="font-medium">{wh.name}</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{wh.code}</span>
                      </TableCell>
                      <TableCell>
                        {wh.city || wh.state ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="size-3" />
                            {[wh.city, wh.state].filter(Boolean).join(', ')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {wh.is_fba ? (
                          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                            FBA
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Physical</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {wh.platform ? (
                          <span className="text-sm capitalize">
                            {wh.platform}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Package className="size-3 text-muted-foreground" />
                          {wh.stock_count ?? 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={wh.is_active ? 'default' : 'secondary'}
                        >
                          {wh.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                            >
                              <MoreHorizontal className="size-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleOpenEdit(wh)}
                            >
                              <Pencil className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => deleteMutation.mutate(wh.id)}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Warehouse className="size-8 text-muted-foreground/50" />
                        <p className="text-muted-foreground">
                          No warehouses configured yet.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleOpenCreate}
                        >
                          <Plus className="mr-2 size-4" />
                          Add your first warehouse
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <WarehouseFormDialog
        open={showFormDialog}
        onOpenChange={(open) => {
          setShowFormDialog(open)
          if (!open) setEditingWarehouse(null)
        }}
        warehouse={editingWarehouse}
        onSubmit={handleFormSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  )
}
