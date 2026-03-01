'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataPoint {
  label: string
  value: number
  prevValue?: number
}

interface ComparisonChartProps {
  title: string
  description?: string
  data: DataPoint[]
  type?: 'area' | 'line' | 'bar'
  color?: string
  prevColor?: string
  height?: number
  valueFormatter?: (v: number) => string
  className?: string
}

// ---------------------------------------------------------------------------
// Custom Tooltip
// ---------------------------------------------------------------------------

function ComparisonTooltip({
  active,
  payload,
  label,
  valueFormatter = formatCurrency,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string }>
  label?: string
  valueFormatter?: (v: number) => string
}) {
  if (!active || !payload || payload.length === 0) return null

  const current = payload.find((p) => p.dataKey === 'value')
  const prev = payload.find((p) => p.dataKey === 'prevValue')

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      {current && (
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-muted-foreground">Current:</span>
          <span className="font-medium tabular-nums">
            {valueFormatter(current.value)}
          </span>
        </div>
      )}
      {prev && prev.value !== undefined && (
        <div className="flex items-center gap-2 text-sm">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          <span className="text-muted-foreground">Previous:</span>
          <span className="font-medium tabular-nums">
            {valueFormatter(prev.value)}
          </span>
        </div>
      )}
      {current && prev && prev.value !== undefined && prev.value > 0 && (
        <div className="mt-1 border-t pt-1 text-xs text-muted-foreground">
          {((current.value - prev.value) / prev.value * 100).toFixed(1)}% change
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComparisonChart({
  title,
  description,
  data,
  type = 'area',
  color = '#10b981',
  prevColor = '#9ca3af',
  height = 300,
  valueFormatter = formatCurrency,
  className,
}: ComparisonChartProps) {
  const hasPrev = data.some((d) => d.prevValue !== undefined)

  const commonXAxis = (
    <XAxis
      dataKey="label"
      tick={{ fontSize: 11 }}
      tickLine={false}
      axisLine={false}
      interval="preserveStartEnd"
      tickMargin={8}
    />
  )

  const commonYAxis = (
    <YAxis
      tick={{ fontSize: 11 }}
      tickLine={false}
      axisLine={false}
      tickFormatter={(v) => formatCompactCurrency(v)}
      width={60}
    />
  )

  const commonGrid = (
    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
  )

  const tooltip = (
    <Tooltip content={<ComparisonTooltip valueFormatter={valueFormatter} />} />
  )

  const renderChart = () => {
    if (type === 'bar') {
      return (
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          {commonGrid}
          {commonXAxis}
          {commonYAxis}
          {tooltip}
          {hasPrev && (
            <Bar
              dataKey="prevValue"
              fill={prevColor}
              opacity={0.3}
              radius={[4, 4, 0, 0]}
            />
          )}
          <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      )
    }

    if (type === 'line') {
      return (
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          {commonGrid}
          {commonXAxis}
          {commonYAxis}
          {tooltip}
          {hasPrev && (
            <Line
              type="monotone"
              dataKey="prevValue"
              stroke={prevColor}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              opacity={0.5}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </LineChart>
      )
    }

    // area (default)
    return (
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="currentGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {commonGrid}
        {commonXAxis}
        {commonYAxis}
        {tooltip}
        {hasPrev && (
          <Area
            type="monotone"
            dataKey="prevValue"
            stroke={prevColor}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            fill="none"
            opacity={0.5}
          />
        )}
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          fill="url(#currentGrad)"
        />
      </AreaChart>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div
            className="flex items-center justify-center text-sm text-muted-foreground"
            style={{ height }}
          >
            No data for this period
          </div>
        ) : (
          <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
