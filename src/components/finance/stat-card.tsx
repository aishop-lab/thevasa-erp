'use client'

import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string
  icon: React.ElementType
  iconColor?: string
  iconBg?: string
  previousValue?: string
  changePercent?: number
  /** If true, a decrease is good (e.g., expenses going down) */
  invertTrend?: boolean
  className?: string
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = 'text-primary',
  iconBg = 'bg-primary/10',
  previousValue,
  changePercent,
  invertTrend = false,
  className,
}: StatCardProps) {
  const hasComparison = changePercent !== undefined
  const isPositive = hasComparison && changePercent >= 0
  const isGood = invertTrend ? !isPositive : isPositive
  const TrendIcon = isPositive ? TrendingUp : TrendingDown

  return (
    <Card className={cn('py-5', className)}>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {hasComparison && (
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-xs font-medium',
                    isGood ? 'text-emerald-600' : 'text-red-600'
                  )}
                >
                  <TrendIcon className="h-3 w-3" />
                  {Math.abs(changePercent).toFixed(1)}%
                </span>
                {previousValue && (
                  <span className="text-xs text-muted-foreground">
                    from {previousValue}
                  </span>
                )}
                {!previousValue && (
                  <span className="text-xs text-muted-foreground">vs prev period</span>
                )}
              </div>
            )}
          </div>
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-lg',
              iconBg
            )}
          >
            <Icon className={cn('h-6 w-6', iconColor)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
