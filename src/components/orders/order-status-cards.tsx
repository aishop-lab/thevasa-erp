'use client'

import { useMemo } from 'react'
import {
  Package,
  CheckCircle2,
  Truck,
  PackageCheck,
  XCircle,
  RotateCcw,
  CreditCard,
  Clock,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import type { OrderRow } from './order-table'

interface OrderStatusCardsProps {
  orders: OrderRow[]
  activeStatus: string
  onStatusClick: (status: string) => void
}

interface StatusConfig {
  key: string
  label: string
  icon: React.ElementType
  color: string
  bgColor: string
}

const STATUS_CONFIG: StatusConfig[] = [
  {
    key: 'all',
    label: 'Total',
    icon: Package,
    color: 'text-slate-700 dark:text-slate-300',
    bgColor: 'bg-slate-100 dark:bg-slate-800',
  },
  {
    key: 'pending',
    label: 'Pending',
    icon: Clock,
    color: 'text-yellow-700 dark:text-yellow-300',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    icon: CheckCircle2,
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
  },
  {
    key: 'processing',
    label: 'Processing',
    icon: Package,
    color: 'text-indigo-700 dark:text-indigo-300',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/30',
  },
  {
    key: 'shipped',
    label: 'Shipped',
    icon: Truck,
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-50 dark:bg-purple-900/30',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    icon: PackageCheck,
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-50 dark:bg-green-900/30',
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    icon: XCircle,
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-50 dark:bg-red-900/30',
  },
  {
    key: 'returned',
    label: 'Returned',
    icon: RotateCcw,
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-50 dark:bg-orange-900/30',
  },
  {
    key: 'refunded',
    label: 'Refunded',
    icon: CreditCard,
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-50 dark:bg-gray-800/50',
  },
]

export function OrderStatusCards({
  orders,
  activeStatus,
  onStatusClick,
}: OrderStatusCardsProps) {
  const statusCounts = useMemo(() => {
    const counts = new Map<string, { count: number; amount: number }>()
    counts.set('all', { count: orders.length, amount: 0 })

    for (const order of orders) {
      const status = order.status || 'unknown'
      const amount = Number(order.total_amount ?? 0)

      // Add to total
      const all = counts.get('all')!
      all.amount += amount

      // Add to specific status
      const existing = counts.get(status) ?? { count: 0, amount: 0 }
      existing.count++
      existing.amount += amount
      counts.set(status, existing)
    }

    return counts
  }, [orders])

  const totalOrders = statusCounts.get('all')?.count ?? 0

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
      {STATUS_CONFIG.map((config) => {
        const data = statusCounts.get(config.key) ?? { count: 0, amount: 0 }
        const isActive = activeStatus === config.key
        const percentage =
          config.key !== 'all' && totalOrders > 0
            ? ((data.count / totalOrders) * 100).toFixed(1)
            : null
        const Icon = config.icon

        return (
          <Card
            key={config.key}
            className={cn(
              'cursor-pointer transition-all hover:shadow-md',
              isActive && 'ring-2 ring-primary shadow-md'
            )}
            onClick={() => onStatusClick(config.key)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                    config.bgColor
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5', config.color)} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">
                    {config.label}
                  </p>
                  <p className="text-lg font-bold leading-none tabular-nums">
                    {data.count}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <p className="truncate text-xs text-muted-foreground tabular-nums">
                  {formatCurrency(data.amount)}
                </p>
                {percentage && (
                  <p className="text-xs font-medium tabular-nums text-muted-foreground">
                    {percentage}%
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
