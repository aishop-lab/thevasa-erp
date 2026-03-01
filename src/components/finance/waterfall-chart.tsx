'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WaterfallItem {
  label: string
  value: number
  type: 'positive' | 'negative' | 'total'
}

interface WaterfallChartProps {
  items: WaterfallItem[]
  title?: string
  description?: string
  height?: number
  className?: string
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const COLORS = {
  positive: '#10b981',
  negative: '#ef4444',
  total: '#3b82f6',
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function WaterfallTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: { label: string; displayValue: number; type: string } }>
}) {
  if (!active || !payload || payload.length === 0) return null
  const data = payload[0].payload

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-medium">{data.label}</p>
      <p className="text-sm font-semibold tabular-nums">
        {formatCurrency(Math.abs(data.displayValue))}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WaterfallChart({
  items,
  title = 'P&L Waterfall',
  description = 'Revenue to net profit flow',
  height = 350,
  className,
}: WaterfallChartProps) {
  const chartData = useMemo(() => {
    let runningTotal = 0
    return items.map((item) => {
      if (item.type === 'total') {
        const base = 0
        const visibleValue = item.value
        return {
          label: item.label,
          base: Math.min(base, base + visibleValue),
          visible: Math.abs(visibleValue),
          displayValue: item.value,
          type: item.type,
        }
      }

      const start = runningTotal
      runningTotal += item.value

      const base = item.value >= 0 ? start : start + item.value
      const visible = Math.abs(item.value)

      return {
        label: item.label,
        base,
        visible,
        displayValue: item.value,
        type: item.type,
      }
    })
  }, [items])

  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div
            className="flex items-center justify-center text-sm text-muted-foreground"
            style={{ height }}
          >
            No data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div style={{ height }} className="w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-muted"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCompactCurrency(v)}
                width={65}
              />
              <Tooltip content={<WaterfallTooltip />} />
              <ReferenceLine y={0} className="stroke-muted-foreground" strokeWidth={1} />
              {/* Invisible base bar */}
              <Bar dataKey="base" stackId="waterfall" fill="transparent" />
              {/* Visible value bar */}
              <Bar dataKey="visible" stackId="waterfall" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[entry.type as keyof typeof COLORS]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
