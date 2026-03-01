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
} from 'recharts'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlatformComparison } from '@/hooks/use-dashboard'

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) {
    return null
  }

  const isRevenue = label === 'Revenue'
  const isAOV = label === 'Avg Order Value'

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
            <span className="text-muted-foreground capitalize">
              {entry.name}
            </span>
          </div>
          <span className="font-medium tabular-nums">
            {isRevenue || isAOV
              ? `\u20B9${entry.value.toLocaleString('en-IN')}`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function CustomLegend({
  payload,
}: {
  payload?: Array<{ value: string; color: string }>
}) {
  if (!payload) return null

  return (
    <div className="flex items-center justify-center gap-6 pt-2">
      {payload.map((entry) => (
        <div key={entry.value} className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm capitalize text-muted-foreground">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function PlatformComparisonSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[350px] w-full" />
      </CardContent>
    </Card>
  )
}

export function PlatformComparison() {
  const { data: comparisonData, isLoading } = usePlatformComparison()

  if (isLoading) {
    return <PlatformComparisonSkeleton />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Comparison</CardTitle>
        <CardDescription>Shopify vs Amazon this month</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={comparisonData ?? []}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              barCategoryGap="20%"
              barGap={4}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-muted"
                vertical={false}
              />
              <XAxis
                dataKey="metric"
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
                width={45}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
              />
              <Legend content={<CustomLegend />} />
              <Bar
                dataKey="shopify"
                name="shopify"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
              <Bar
                dataKey="amazon"
                name="amazon"
                fill="#f97316"
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
