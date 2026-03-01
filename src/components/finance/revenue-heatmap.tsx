'use client'

import { useMemo } from 'react'
import { format, parseISO, startOfWeek, addDays, differenceInWeeks } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DayData {
  date: string // YYYY-MM-DD
  revenue: number
}

interface RevenueHeatmapProps {
  data: DayData[]
  className?: string
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const HEAT_LEVELS = [
  'bg-emerald-100 dark:bg-emerald-950',
  'bg-emerald-200 dark:bg-emerald-900',
  'bg-emerald-300 dark:bg-emerald-800',
  'bg-emerald-400 dark:bg-emerald-700',
  'bg-emerald-500 dark:bg-emerald-600',
]

function getHeatLevel(value: number, max: number): number {
  if (value === 0 || max === 0) return -1
  const ratio = value / max
  if (ratio <= 0.2) return 0
  if (ratio <= 0.4) return 1
  if (ratio <= 0.6) return 2
  if (ratio <= 0.8) return 3
  return 4
}

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RevenueHeatmap({ data, className }: RevenueHeatmapProps) {
  const { grid, months, maxRevenue } = useMemo(() => {
    if (data.length === 0) return { grid: [], months: [], maxRevenue: 0 }

    const dataMap = new Map<string, number>()
    let max = 0
    for (const d of data) {
      dataMap.set(d.date, d.revenue)
      if (d.revenue > max) max = d.revenue
    }

    // Find date range
    const dates = data.map((d) => d.date).sort()
    const startDate = parseISO(dates[0])
    const endDate = parseISO(dates[dates.length - 1])

    // Start from the Monday of the first week
    const gridStart = startOfWeek(startDate, { weekStartsOn: 1 })
    const totalWeeks = differenceInWeeks(endDate, gridStart) + 1

    // Build week columns
    const weeks: { date: string; revenue: number; dayOfWeek: number }[][] = []
    const monthLabels: { label: string; weekIndex: number }[] = []
    let lastMonth = -1

    for (let w = 0; w < totalWeeks; w++) {
      const week: { date: string; revenue: number; dayOfWeek: number }[] = []
      for (let d = 0; d < 7; d++) {
        const date = addDays(gridStart, w * 7 + d)
        const dateStr = format(date, 'yyyy-MM-dd')
        const month = date.getMonth()

        if (month !== lastMonth && d === 0) {
          monthLabels.push({
            label: format(date, 'MMM'),
            weekIndex: w,
          })
          lastMonth = month
        }

        week.push({
          date: dateStr,
          revenue: dataMap.get(dateStr) ?? 0,
          dayOfWeek: d,
        })
      }
      weeks.push(week)
    }

    return { grid: weeks, months: monthLabels, maxRevenue: max }
  }, [data])

  if (data.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Daily Revenue Heatmap</CardTitle>
          <CardDescription>Revenue intensity by day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
            No daily revenue data
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Daily Revenue Heatmap</CardTitle>
        <CardDescription>Revenue intensity by day</CardDescription>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={100}>
          <div className="overflow-x-auto">
            {/* Month labels */}
            <div className="flex ml-8 mb-1">
              {months.map((m, i) => (
                <div
                  key={i}
                  className="text-xs text-muted-foreground"
                  style={{
                    position: 'relative',
                    left: m.weekIndex * 14,
                  }}
                >
                  {m.label}
                </div>
              ))}
            </div>

            <div className="flex gap-0.5">
              {/* Day labels */}
              <div className="flex flex-col gap-0.5 mr-1 shrink-0">
                {DAY_LABELS.map((label, i) => (
                  <div
                    key={i}
                    className="h-[12px] text-[10px] text-muted-foreground leading-[12px]"
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Grid */}
              {grid.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {week.map((day) => {
                    const level = getHeatLevel(day.revenue, maxRevenue)
                    return (
                      <Tooltip key={day.date}>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'h-[12px] w-[12px] rounded-[2px] transition-colors',
                              level === -1
                                ? 'bg-muted'
                                : HEAT_LEVELS[level]
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-medium">
                            {format(parseISO(day.date), 'EEE, dd MMM yyyy')}
                          </p>
                          <p className="tabular-nums">
                            {day.revenue > 0
                              ? formatCurrency(day.revenue)
                              : 'No revenue'}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="h-[12px] w-[12px] rounded-[2px] bg-muted" />
              {HEAT_LEVELS.map((cls, i) => (
                <div key={i} className={cn('h-[12px] w-[12px] rounded-[2px]', cls)} />
              ))}
              <span>More</span>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  )
}
