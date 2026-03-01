'use client'

import { use } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate, formatRelative } from '@/lib/utils/date'
import { cn } from '@/lib/utils'
import { OrderDetailCard } from '@/components/orders/order-detail-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ArrowLeft,
  ChevronDown,
  MapPin,
  Phone,
  Mail,
  Truck,
  ExternalLink,
  Clock,
  Package,
  FileText,
  CircleDot,
  Ban,
  IndianRupee,
} from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderItem {
  id: string
  product_name: string
  variant_name: string | null
  sku: string | null
  quantity: number
  unit_price: number
  discount: number | null
  tax_amount: number | null
  total: number
}

interface OrderPayment {
  id: string
  method: string | null
  amount: number
  status: string | null
  transaction_id: string | null
  paid_at: string | null
}

interface PlatformFee {
  id: string
  fee_type: string
  amount: number
  description: string | null
}

interface OrderDetail {
  id: string
  order_number: string
  external_order_id: string | null
  status: string
  payment_status: string | null
  total_amount: number | null
  subtotal: number | null
  discount: number | null
  tax_amount: number | null
  shipping_charge: number | null
  currency: string | null
  ordered_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
  shipping_address: unknown
  billing_address: unknown
  tracking_number: string | null
  courier: string | null
  tracking_url: string | null
  notes: string | null
  platform?: {
    name: string
    display_name: string
  } | null
  order_items: OrderItem[]
  payments: OrderPayment[]
  platform_fees: PlatformFee[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'refunded',
]

const STATUS_TIMELINE_COLORS: Record<string, string> = {
  pending: 'text-yellow-600',
  confirmed: 'text-blue-600',
  processing: 'text-indigo-600',
  shipped: 'text-purple-600',
  delivered: 'text-green-600',
  cancelled: 'text-red-600',
  returned: 'text-orange-600',
  refunded: 'text-gray-600',
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function OrderDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-[400px] w-full rounded-lg" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
          <Skeleton className="h-[150px] w-full rounded-lg" />
        </div>
        <div className="space-y-6 lg:col-span-3">
          <Skeleton className="h-[300px] w-full rounded-lg" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
          <Skeleton className="h-[200px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [newNote, setNewNote] = useState('')

  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: ['orders', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          `*,
          platform:platforms(name, display_name),
          order_items(*),
          payments(*),
          platform_fees(*)`
        )
        .eq('id', id)
        .single()

      if (error) throw error
      return data as OrderDetail
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus as 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'refunded' })
        .eq('id', id)

      if (error) throw error

      // Status history could be tracked via a separate table in future
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'detail', id] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'list'] })
      toast.success('Order status updated')
    },
    onError: (err: Error) => {
      toast.error(`Failed to update status: ${err.message}`)
    },
  })

  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', id)

      if (error) throw error

      // Status history could be tracked via a separate table in future
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'detail', id] })
      queryClient.invalidateQueries({ queryKey: ['orders', 'list'] })
      toast.success('Order cancelled')
    },
    onError: (err: Error) => {
      toast.error(`Failed to cancel order: ${err.message}`)
    },
  })

  const saveNoteMutation = useMutation({
    mutationFn: async (note: string) => {
      const existingNotes = order?.notes ?? ''
      const timestamp = new Date().toLocaleString('en-IN')
      const updatedNotes = existingNotes
        ? `${existingNotes}\n\n[${timestamp}] ${note}`
        : `[${timestamp}] ${note}`

      const { error } = await supabase
        .from('orders')
        .update({ notes: updatedNotes })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', 'detail', id] })
      setNewNote('')
      toast.success('Note added')
    },
    onError: (err: Error) => {
      toast.error(`Failed to save note: ${err.message}`)
    },
  })

  if (isLoading) {
    return <OrderDetailSkeleton />
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Orders
        </Link>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load order: {(error as Error).message}
          </p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="space-y-6">
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Orders
        </Link>
        <p className="text-muted-foreground">Order not found.</p>
      </div>
    )
  }

  const totalFees = order.platform_fees?.reduce((sum, f) => sum + f.amount, 0) ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            Order {order.order_number}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Update Status */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={updateStatusMutation.isPending}>
                Update Status
                <ChevronDown className="ml-2 size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {STATUS_OPTIONS.filter((s) => s !== order.status).map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => updateStatusMutation.mutate(status)}
                  className="capitalize"
                >
                  {status}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Cancel Order */}
          {!['cancelled', 'delivered', 'refunded'].includes(order.status) && (
            <Button
              variant="destructive"
              onClick={() => cancelOrderMutation.mutate()}
              disabled={cancelOrderMutation.isPending}
            >
              <Ban className="mr-2 size-4" />
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Order Summary */}
          <OrderDetailCard order={order} />

          {/* Customer Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-4" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <p className="font-medium">{order.customer_name ?? 'N/A'}</p>
                {order.customer_email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="size-3.5" />
                    {order.customer_email}
                  </div>
                )}
                {order.customer_phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="size-3.5" />
                    {order.customer_phone}
                  </div>
                )}
              </div>

              {!!order.shipping_address && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1 text-sm font-medium text-muted-foreground">
                      Shipping Address
                    </p>
                    <p className="text-sm whitespace-pre-line">
                      {typeof order.shipping_address === 'string'
                        ? order.shipping_address
                        : JSON.stringify(order.shipping_address, null, 2)}
                    </p>
                  </div>
                </>
              )}

              {!!order.billing_address && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1 text-sm font-medium text-muted-foreground">
                      Billing Address
                    </p>
                    <p className="text-sm whitespace-pre-line">
                      {typeof order.billing_address === 'string'
                        ? order.billing_address
                        : JSON.stringify(order.billing_address, null, 2)}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Fulfillment */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Truck className="size-4" />
                Fulfillment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tracking Number</span>
                <span className="font-mono">
                  {order.tracking_number ?? 'Not available'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Courier</span>
                <span>{order.courier ?? 'Not assigned'}</span>
              </div>
              {order.tracking_url && (
                <a
                  href={order.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Track Shipment
                  <ExternalLink className="size-3" />
                </a>
              )}
              {order.shipped_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Shipped</span>
                  <span>{formatDate(order.shipped_at, 'dd MMM yyyy, HH:mm')}</span>
                </div>
              )}
              {order.delivered_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Delivered</span>
                  <span>{formatDate(order.delivered_at, 'dd MMM yyyy, HH:mm')}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="size-4" />
                Status Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-4">
                <div className="absolute left-[7px] top-2 h-[calc(100%-16px)] w-px bg-border" />
                <div className="relative flex gap-3 pl-6">
                  <CircleDot
                    className={cn(
                      'absolute left-0 top-0.5 size-4',
                      STATUS_TIMELINE_COLORS[order.status] ?? 'text-gray-400'
                    )}
                  />
                  <div className="flex-1 space-y-1">
                    <span className="text-sm font-medium capitalize">
                      {order.status}
                    </span>
                    {order.ordered_at && (
                      <p className="text-xs text-muted-foreground">
                        {formatDate(order.ordered_at, 'dd MMM yyyy, HH:mm')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6 lg:col-span-3">
          {/* Line Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="size-4" />
                Order Items ({order.order_items?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Discount</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {order.order_items && order.order_items.length > 0 ? (
                      order.order_items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.product_name}</p>
                              {item.variant_name && (
                                <p className="text-xs text-muted-foreground">
                                  {item.variant_name}
                                </p>
                              )}
                              {item.sku && (
                                <p className="font-mono text-xs text-muted-foreground">
                                  SKU: {item.sku}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(item.unit_price)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(item.discount ?? 0) > 0 ? (
                              <span className="text-red-600">
                                -{formatCurrency((item.discount ?? 0))}
                              </span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(item.tax_amount ?? 0)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(item.total ?? 0)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-16 text-center">
                          No items found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <IndianRupee className="size-4" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.payments && order.payments.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Method</TableHead>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="capitalize">
                            {payment.method?.replace('_', ' ')}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {payment.transaction_id ?? '-'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className="capitalize"
                            >
                              {payment.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {payment.paid_at
                              ? formatDate(payment.paid_at, 'dd MMM yyyy')
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No payment records found.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Platform Fees */}
          {order.platform_fees && order.platform_fees.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-4" />
                  Platform Fees
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fee Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.platform_fees.map((fee) => (
                        <TableRow key={fee.id}>
                          <TableCell className="capitalize font-medium">
                            {fee.fee_type?.replace('_', ' ')}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {fee.description ?? '-'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(fee.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell colSpan={2} className="font-semibold">
                          Total Fees
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatCurrency(totalFees)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.notes && (
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm whitespace-pre-line">{order.notes}</p>
                </div>
              )}
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a note..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  rows={3}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (newNote.trim()) {
                      saveNoteMutation.mutate(newNote.trim())
                    }
                  }}
                  disabled={!newNote.trim() || saveNoteMutation.isPending}
                >
                  Add Note
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
