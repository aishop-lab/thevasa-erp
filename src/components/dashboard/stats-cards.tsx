'use client'

import {
  ShoppingCart,
  IndianRupee,
  Truck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useDashboardStats } from '@/hooks/use-dashboard'
import { formatCurrency } from '@/lib/utils/currency'

interface StatCard {
  title: string
  value: string
  trend: number
  trendLabel: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
}

function StatsCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="space-y-3 flex-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-12 w-12 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  )
}

export function StatsCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatsCardSkeleton key={i} />
      ))}
    </div>
  )
}

function calculateTrend(today: number, yesterday: number): number {
  if (yesterday === 0) return today > 0 ? 100 : 0
  return Math.round(((today - yesterday) / yesterday) * 1000) / 10
}

export function StatsCards() {
  const { data, isLoading } = useDashboardStats()

  if (isLoading) {
    return <StatsCardsSkeleton />
  }

  const stats: StatCard[] = [
    {
      title: "Today's Orders",
      value: String(data?.todayOrders ?? 0),
      trend: calculateTrend(data?.todayOrders ?? 0, data?.yesterdayOrders ?? 0),
      trendLabel: 'vs yesterday',
      icon: ShoppingCart,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      title: "Today's Revenue",
      value: formatCurrency(data?.todayRevenue ?? 0),
      trend: calculateTrend(data?.todayRevenue ?? 0, data?.yesterdayRevenue ?? 0),
      trendLabel: 'vs yesterday',
      icon: IndianRupee,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50 dark:bg-emerald-950',
    },
    {
      title: 'Pending Shipments',
      value: String(data?.pendingShipments ?? 0),
      trend: 0,
      trendLabel: 'awaiting dispatch',
      icon: Truck,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50 dark:bg-amber-950',
    },
    {
      title: 'Low Stock Alerts',
      value: String(data?.lowStockCount ?? 0),
      trend: 0,
      trendLabel: 'items below threshold',
      icon: AlertTriangle,
      iconColor: 'text-red-600',
      iconBg: 'bg-red-50 dark:bg-red-950',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        const isPositive = stat.trend >= 0
        const TrendIcon = isPositive ? TrendingUp : TrendingDown
        const showTrend = stat.trend !== 0

        return (
          <Card key={stat.title} className="py-5">
            <CardContent className="pt-0">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold tracking-tight">
                    {stat.value}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {showTrend ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 text-xs font-medium',
                          isPositive ? 'text-emerald-600' : 'text-red-600'
                        )}
                      >
                        <TrendIcon className="h-3 w-3" />
                        {Math.abs(stat.trend)}%
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {stat.trendLabel}
                    </span>
                  </div>
                </div>
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-lg',
                    stat.iconBg
                  )}
                >
                  <Icon className={cn('h-6 w-6', stat.iconColor)} />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
