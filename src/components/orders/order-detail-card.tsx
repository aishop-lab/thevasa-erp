'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { cn } from '@/lib/utils'
import {
  ShoppingBag,
  User,
  Calendar,
  Hash,
  CreditCard,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderDetailCardProps {
  order: {
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
    customer_name: string | null
    customer_email: string | null
    platform?: {
      name: string
      display_name: string
    } | null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  processing: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  returned: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  partially_paid: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const PLATFORM_COLORS: Record<string, string> = {
  shopify: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  amazon: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrderDetailCard({ order }: OrderDetailCardProps) {
  const platformName = order.platform?.name ?? 'unknown'

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5" />
            Order Summary
          </CardTitle>
          <Badge
            className={cn(
              'border-0',
              PLATFORM_COLORS[platformName] ?? 'bg-gray-100 text-gray-800'
            )}
          >
            {order.platform?.display_name ?? platformName}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Order Number & Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Hash className="size-4" />
            <span>Order Number</span>
          </div>
          <span className="font-mono font-medium">{order.order_number}</span>
        </div>

        {order.external_order_id && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Platform ID</span>
            <span className="font-mono text-sm">{order.external_order_id}</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status</span>
          <Badge
            className={cn(
              'border-0 capitalize',
              STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-800'
            )}
          >
            {order.status}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="size-4" />
            <span>Payment</span>
          </div>
          <Badge
            className={cn(
              'border-0 capitalize',
              (order.payment_status ? PAYMENT_STATUS_COLORS[order.payment_status] : null) ?? 'bg-gray-100 text-gray-800'
            )}
          >
            {order.payment_status?.replace('_', ' ')}
          </Badge>
        </div>

        <Separator />

        {/* Dates */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="size-4" />
            <span>Ordered</span>
          </div>
          <span className="text-sm">{order.ordered_at ? formatDate(order.ordered_at, 'dd MMM yyyy, HH:mm') : 'N/A'}</span>
        </div>

        <Separator />

        {/* Customer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="size-4" />
            <span>Customer</span>
          </div>
          <span className="text-sm font-medium">
            {order.customer_name ?? 'N/A'}
          </span>
        </div>

        {order.customer_email && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm">{order.customer_email}</span>
          </div>
        )}

        <Separator />

        {/* Amount Breakdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(order.subtotal ?? 0)}</span>
          </div>
          {(order.discount ?? 0) > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Discount</span>
              <span className="text-red-600">-{formatCurrency(order.discount ?? 0)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span>{formatCurrency(order.tax_amount ?? 0)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Shipping</span>
            <span>{formatCurrency(order.shipping_charge ?? 0)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between font-semibold">
            <span>Total</span>
            <span className="text-lg">{formatCurrency(order.total_amount ?? 0)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export { STATUS_COLORS, PAYMENT_STATUS_COLORS, PLATFORM_COLORS }
