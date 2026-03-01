'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import {
  DateRangePicker,
  useDateRangeState,
} from '@/components/finance/date-range-picker'
import { StatCard } from '@/components/finance/stat-card'
import { ComparisonChart } from '@/components/finance/comparison-chart'
import {
  useRevenueOverview,
  useOrderAnalytics,
  useRevenueTimeSeries,
  useRevenuePlatformTimeSeries,
  usePnlData,
} from '@/hooks/use-finance'
import {
  IndianRupee,
  ShoppingCart,
  TrendingUp,
  Receipt,
  FileText,
  Calculator,
  Landmark,
  ArrowRight,
  PieChart as PieChartIcon,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Platform colors
// ---------------------------------------------------------------------------

const PLATFORM_COLORS: Record<string, string> = {
  shopify: '#3b82f6',
  amazon: '#f97316',
  other: '#8b5cf6',
}

const STATUS_COLORS: Record<string, string> = {
  delivered: '#10b981',
  shipped: '#3b82f6',
  processing: '#f59e0b',
  confirmed: '#8b5cf6',
  cancelled: '#ef4444',
  returned: '#f97316',
  pending: '#6b7280',
}

// ---------------------------------------------------------------------------
// Quick Links
// ---------------------------------------------------------------------------

const quickLinks = [
  {
    title: 'Revenue',
    description: 'Revenue analytics by platform and product',
    href: '/finance/revenue',
    icon: IndianRupee,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950',
  },
  {
    title: 'Expenses',
    description: 'Track and manage all expenses',
    href: '/finance/expenses',
    icon: Receipt,
    color: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-950',
  },
  {
    title: 'P&L Report',
    description: 'Profit & Loss statement by period',
    href: '/finance/pnl',
    icon: FileText,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950',
  },
  {
    title: 'GST Reports',
    description: 'GSTR-1 summary and tax liability',
    href: '/finance/gst',
    icon: Calculator,
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-950',
  },
  {
    title: 'Settlements',
    description: 'Platform payout reconciliation',
    href: '/finance/settlements',
    icon: Landmark,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950',
  },
]

// ---------------------------------------------------------------------------
// Tooltips
// ---------------------------------------------------------------------------

function PlatformBarTooltip({
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
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground capitalize">{entry.name}</span>
          </div>
          <span className="font-medium tabular-nums">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

function DonutTooltip({
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
        <span className="font-medium capitalize">{payload[0].name}</span>
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums">{payload[0].value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function FinanceOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FinancePage() {
  const [dateRange, setDateRange] = useDateRangeState('last_30_days')

  const { data: revenue, isLoading: revLoading } = useRevenueOverview(
    dateRange.from,
    dateRange.to,
    dateRange.compareFrom,
    dateRange.compareTo
  )

  const { data: orders, isLoading: ordersLoading } = useOrderAnalytics(
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

  const { data: pnl } = usePnlData(dateRange.from, dateRange.to)

  const isLoading = revLoading || ordersLoading

  // Order status chart data
  const statusData = useMemo(() => {
    if (!orders?.byStatus) return []
    return orders.byStatus.map((s) => ({
      name: s.status.charAt(0).toUpperCase() + s.status.slice(1),
      value: s.count,
      fill: STATUS_COLORS[s.status] ?? '#6b7280',
    }))
  }, [orders?.byStatus])

  // Platform bar chart
  const platformNames = useMemo(
    () => platformTs?.platforms ?? [],
    [platformTs?.platforms]
  )

  if (isLoading) {
    return <FinanceOverviewSkeleton />
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground">
            Financial overview and reporting for your business
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* Stats Cards */}
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
          title="Orders"
          value={String(orders?.totalOrders ?? 0)}
          icon={ShoppingCart}
          iconColor="text-blue-600"
          iconBg="bg-blue-50 dark:bg-blue-950"
          changePercent={orders?.ordersChange}
        />
        <StatCard
          title="Net Profit"
          value={formatCompactCurrency(pnl?.netProfit ?? 0)}
          icon={TrendingUp}
          iconColor="text-purple-600"
          iconBg="bg-purple-50 dark:bg-purple-950"
        />
        <StatCard
          title="Avg Order Value"
          value={formatCurrency(orders?.aov ?? 0)}
          icon={PieChartIcon}
          iconColor="text-amber-600"
          iconBg="bg-amber-50 dark:bg-amber-950"
          changePercent={orders?.aovChange}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Trend with Comparison */}
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

        {/* Platform Revenue Stacked Bar */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Platform</CardTitle>
            <CardDescription>Platform comparison over time</CardDescription>
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
                    <Tooltip content={<PlatformBarTooltip />} />
                    <Legend />
                    {platformNames.map((name) => (
                      <Bar
                        key={name}
                        dataKey={name}
                        name={name.charAt(0).toUpperCase() + name.slice(1)}
                        fill={PLATFORM_COLORS[name] ?? '#6b7280'}
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

      {/* Order Status Donut */}
      {statusData.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Order Status Breakdown</CardTitle>
              <CardDescription>Distribution of order statuses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<DonutTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Quick summary card */}
          <Card>
            <CardHeader>
              <CardTitle>Period Summary</CardTitle>
              <CardDescription>Key metrics at a glance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Gross Revenue', value: formatCurrency(revenue?.grossRevenue ?? 0) },
                { label: 'Discounts', value: formatCurrency(revenue?.discounts ?? 0) },
                { label: 'Net Revenue', value: formatCurrency(revenue?.netRevenue ?? 0) },
                { label: 'COGS', value: formatCurrency(pnl?.cogs ?? 0) },
                { label: 'Gross Profit', value: formatCurrency(pnl?.grossProfit ?? 0) },
                { label: 'Operating Expenses', value: formatCurrency(pnl?.operatingExpenses ?? 0) },
                { label: 'Platform Fees', value: formatCurrency(pnl?.platformFees ?? 0) },
                {
                  label: 'Net Profit',
                  value: formatCurrency(pnl?.netProfit ?? 0),
                  bold: true,
                },
                {
                  label: 'Net Margin',
                  value: `${(pnl?.netMargin ?? 0).toFixed(1)}%`,
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <span
                    className={cn(
                      'text-sm',
                      (row as any).bold ? 'font-semibold' : 'text-muted-foreground'
                    )}
                  >
                    {row.label}
                  </span>
                  <span
                    className={cn(
                      'tabular-nums text-sm',
                      (row as any).bold && 'font-semibold'
                    )}
                  >
                    {row.value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Links */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Financial Reports</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {quickLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link key={link.href} href={link.href}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-col gap-3 pt-5">
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg',
                        link.bg
                      )}
                    >
                      <Icon className={cn('h-5 w-5', link.color)} />
                    </div>
                    <div>
                      <h3 className="font-medium">{link.title}</h3>
                      <p className="text-sm text-muted-foreground">{link.description}</p>
                    </div>
                    <div className="mt-auto flex items-center gap-1 text-sm text-primary">
                      View
                      <ArrowRight className="size-3.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
