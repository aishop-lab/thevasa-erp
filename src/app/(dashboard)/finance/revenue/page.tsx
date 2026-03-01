'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import {
  DateRangePicker,
  useDateRangeState,
} from '@/components/finance/date-range-picker'
import { StatCard } from '@/components/finance/stat-card'
import { ComparisonChart } from '@/components/finance/comparison-chart'
import { RevenueHeatmap } from '@/components/finance/revenue-heatmap'
import {
  useRevenueOverview,
  useRevenueTimeSeries,
  useRevenuePlatformTimeSeries,
  useRevenuePlatformSplit,
  useTopProducts,
  useDailyRevenue,
  useOrderAnalytics,
} from '@/hooks/use-finance'
import { ArrowLeft, IndianRupee, BarChart3, Tag, Receipt } from 'lucide-react'

// ---------------------------------------------------------------------------
// Platform colors
// ---------------------------------------------------------------------------

const PLATFORM_COLORS: Record<string, string> = {
  Shopify: '#3b82f6',
  Amazon: '#f97316',
  Other: '#8b5cf6',
}

// ---------------------------------------------------------------------------
// Chart Tooltips
// ---------------------------------------------------------------------------

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: { fill: string } }>
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <div className="flex items-center gap-2 text-sm">
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: payload[0].payload.fill }} />
        <span className="font-medium">{payload[0].name}</span>
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="mb-1 text-sm font-medium">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-4 text-sm">
          <span className="text-muted-foreground">{entry.name}</span>
          <span className="font-medium tabular-nums">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function RevenueSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-[240px]" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[400px] rounded-lg" />
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
      <Skeleton className="h-[200px] rounded-lg" />
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RevenuePage() {
  const [dateRange, setDateRange] = useDateRangeState('last_30_days')

  const { data: revenue, isLoading: revLoading, isError, error } = useRevenueOverview(
    dateRange.from,
    dateRange.to,
    dateRange.compareFrom,
    dateRange.compareTo
  )

  const { data: timeSeries } = useRevenueTimeSeries(
    dateRange.from,
    dateRange.to,
    dateRange.granularity,
    dateRange.compareFrom,
    dateRange.compareTo
  )

  const { data: platformTs } = useRevenuePlatformTimeSeries(
    dateRange.from,
    dateRange.to,
    dateRange.granularity
  )

  const { data: platformSplit } = useRevenuePlatformSplit(
    dateRange.from,
    dateRange.to
  )

  const { data: topProducts } = useTopProducts(dateRange.from, dateRange.to, 10)

  const { data: dailyRevenue } = useDailyRevenue(dateRange.from, dateRange.to)

  const { data: orders } = useOrderAnalytics(
    dateRange.from,
    dateRange.to,
    dateRange.compareFrom,
    dateRange.compareTo
  )

  // Platform donut data
  const donutData = useMemo(() => {
    if (!platformSplit) return []
    return platformSplit.map((p) => ({
      name: p.platform,
      value: p.revenue,
      fill: PLATFORM_COLORS[p.platform] ?? '#6b7280',
    }))
  }, [platformSplit])

  // AOV by platform
  const aovData = useMemo(() => {
    if (!orders?.byPlatform) return []
    return orders.byPlatform.map((p) => ({
      platform: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
      aov: p.count > 0 ? p.amount / p.count : 0,
      orders: p.count,
    }))
  }, [orders?.byPlatform])

  // Platform bar names
  const platformNames = useMemo(
    () => platformTs?.platforms ?? [],
    [platformTs?.platforms]
  )

  if (revLoading) return <RevenueSkeleton />

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/finance"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Finance
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Revenue</h1>
        </div>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load revenue data: {(error as Error).message}
          </p>
        </div>
      </div>
    )
  }

  const chartPoints = (timeSeries ?? []).map((p) => ({
    label: p.label,
    value: p.revenue,
    prevValue: p.prevRevenue,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/finance"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Finance
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Revenue Analytics</h1>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Net Revenue"
          value={formatCompactCurrency(revenue?.netRevenue ?? 0)}
          icon={IndianRupee}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50 dark:bg-emerald-950"
          changePercent={revenue?.netRevenueChange}
          previousValue={
            revenue?.prevNetRevenue
              ? formatCompactCurrency(revenue.prevNetRevenue)
              : undefined
          }
        />
        <StatCard
          title="Gross Revenue"
          value={formatCompactCurrency(revenue?.grossRevenue ?? 0)}
          icon={BarChart3}
          iconColor="text-blue-600"
          iconBg="bg-blue-50 dark:bg-blue-950"
          changePercent={revenue?.grossRevenueChange}
        />
        <StatCard
          title="Discounts"
          value={formatCompactCurrency(revenue?.discounts ?? 0)}
          icon={Tag}
          iconColor="text-orange-600"
          iconBg="bg-orange-50 dark:bg-orange-950"
          changePercent={revenue?.discountChange}
          invertTrend
        />
        <StatCard
          title="Tax Collected"
          value={formatCompactCurrency(revenue?.taxCollected ?? 0)}
          icon={Receipt}
          iconColor="text-purple-600"
          iconBg="bg-purple-50 dark:bg-purple-950"
          changePercent={revenue?.taxChange}
        />
      </div>

      {/* Revenue Trend + Stacked Platform Chart */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ComparisonChart
          title="Revenue Trend"
          description={
            dateRange.compareFrom
              ? 'Current vs previous period'
              : 'Net revenue over time'
          }
          data={chartPoints}
          type="area"
        />

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Platform</CardTitle>
            <CardDescription>Stacked by platform over time</CardDescription>
          </CardHeader>
          <CardContent>
            {(platformTs?.data ?? []).length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No revenue data for this period
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={platformTs?.data ?? []}
                    margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      tickMargin={8}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatCompactCurrency(v)}
                      width={60}
                    />
                    <Tooltip content={<BarTooltip />} />
                    <Legend />
                    {platformNames.map((name) => (
                      <Bar
                        key={name}
                        dataKey={name}
                        name={name.charAt(0).toUpperCase() + name.slice(1)}
                        fill={PLATFORM_COLORS[name.charAt(0).toUpperCase() + name.slice(1)] ?? '#6b7280'}
                        stackId="platforms"
                        radius={[2, 2, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Platform Donut + Heatmap */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Distribution</CardTitle>
            <CardDescription>Platform share of net revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {donutData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No data
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {donutData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <RevenueHeatmap data={dailyRevenue ?? []} />
      </div>

      {/* Top Products + AOV */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
            <CardDescription>By revenue in selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {(topProducts ?? []).length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No order items data for this period
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Units Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(topProducts ?? []).map((product, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {product.unitsSold}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatCurrency(product.revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Order Value</CardTitle>
            <CardDescription>By platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {aovData.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No orders for this period
              </div>
            ) : (
              aovData.map((item) => (
                <div key={item.platform} className="space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.platform}</span>
                    <span className="text-2xl font-bold tabular-nums">
                      {formatCurrency(item.aov)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {item.orders} orders
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
