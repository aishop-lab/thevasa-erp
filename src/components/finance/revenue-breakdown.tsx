'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RevenueBarData {
  name: string
  shopify: number
  amazon: number
}

interface RevenuePieData {
  name: string
  value: number
  color: string
}

type ChartType = 'bar' | 'pie'

interface RevenueBreakdownProps {
  data: RevenueBarData[] | RevenuePieData[]
  period: string
  type?: ChartType
  title?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORM_COLORS = {
  shopify: '#3b82f6',
  amazon: '#f97316',
}

const PIE_COLORS = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#f59e0b']

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function BarTooltipContent({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  const total = payload.reduce((sum, entry) => sum + entry.value, 0)

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          className="flex items-center justify-between gap-4 text-sm"
        >
          <div className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground capitalize">{entry.name}</span>
          </div>
          <span className="font-medium tabular-nums">
            {formatCurrency(entry.value)}
          </span>
        </div>
      ))}
      <div className="mt-1.5 flex items-center justify-between gap-4 border-t pt-1.5 text-sm">
        <span className="text-muted-foreground">Total</span>
        <span className="font-semibold tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  )
}

function PieTooltipContent({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: RevenuePieData }>
}) {
  if (!active || !payload || payload.length === 0) return null

  const entry = payload[0]

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <div className="flex items-center gap-2 text-sm">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: entry.payload.color }}
        />
        <span className="font-medium">{entry.name}</span>
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums">
        {formatCurrency(entry.value)}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RevenueBreakdown({
  data,
  period,
  type = 'bar',
  title = 'Revenue Breakdown',
}: RevenueBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground capitalize">{period}</p>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {type === 'bar' ? (
              <BarChart
                data={data as RevenueBarData[]}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  tickMargin={8}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                  tickFormatter={(value) => formatCompactCurrency(value)}
                  width={65}
                />
                <Tooltip content={<BarTooltipContent />} />
                <Legend />
                <Bar
                  dataKey="shopify"
                  name="Shopify"
                  fill={PLATFORM_COLORS.shopify}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="amazon"
                  name="Amazon"
                  fill={PLATFORM_COLORS.amazon}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            ) : (
              <PieChart>
                <Pie
                  data={data as RevenuePieData[]}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={130}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                >
                  {(data as RevenuePieData[]).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltipContent />} />
                <Legend />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
