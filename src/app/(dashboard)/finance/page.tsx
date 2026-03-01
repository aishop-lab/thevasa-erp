'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Receipt,
  PieChart as PieChartIcon,
  FileText,
  Calculator,
  Landmark,
  ArrowRight,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatCard {
  title: string
  value: string
  trend: number
  trendLabel: string
  icon: React.ElementType
  iconColor: string
  iconBg: string
}

// ---------------------------------------------------------------------------
// Expense category colors
// ---------------------------------------------------------------------------

const EXPENSE_COLORS: Record<string, string> = {
  shipping: '#3b82f6',
  marketing: '#f97316',
  packaging: '#10b981',
  platform_fees: '#8b5cf6',
  salaries: '#ef4444',
  rent: '#06b6d4',
  utilities: '#84cc16',
  raw_materials: '#ec4899',
  other: '#6b7280',
}

function getCategoryColor(category: string): string {
  return EXPENSE_COLORS[category.toLowerCase()] ?? EXPENSE_COLORS.other
}

function formatCategoryLabel(category: string): string {
  return category
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

// ---------------------------------------------------------------------------
// Quick Link Cards
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
// Chart Tooltip
// ---------------------------------------------------------------------------

function RevenueTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="mb-1 text-sm font-medium">{label}</p>
      <p className="text-sm font-semibold tabular-nums">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  )
}

function ExpenseTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; payload: { color: string } }>
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <div className="flex items-center gap-2 text-sm">
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: payload[0].payload.color }}
        />
        <span className="font-medium">{payload[0].name}</span>
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function FinanceOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
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
  const supabase = createClient()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  // Current month revenue
  const { data: revenueData, isLoading: revenueLoading } = useQuery({
    queryKey: ['finance', 'overview', 'revenue'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_revenue')
        .select('net_revenue, date')
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
      if (error) throw error
      return data
    },
  })

  // Last month revenue (for trend)
  const { data: lastMonthRevenue } = useQuery({
    queryKey: ['finance', 'overview', 'revenue-last-month'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_revenue')
        .select('net_revenue')
        .gte('date', startOfLastMonth)
        .lt('date', startOfMonth)
      if (error) throw error
      return data
    },
  })

  // Current month expenses
  const { data: expensesData, isLoading: expensesLoading } = useQuery({
    queryKey: ['finance', 'overview', 'expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount, gst_amount, category')
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
      if (error) throw error
      return data
    },
  })

  // Last month expenses (for trend)
  const { data: lastMonthExpenses } = useQuery({
    queryKey: ['finance', 'overview', 'expenses-last-month'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', startOfLastMonth)
        .lt('date', startOfMonth)
      if (error) throw error
      return data
    },
  })

  // Revenue trend chart: daily revenue from orders (last 30 days)
  const { data: revenueTrendData } = useQuery({
    queryKey: ['finance', 'overview', 'revenue-trend'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29)
      const { data, error } = await supabase
        .from('orders')
        .select('total_amount, ordered_at')
        .gte('ordered_at', thirtyDaysAgo.toISOString())
        .not('ordered_at', 'is', null)
      if (error) throw error
      return data
    },
  })

  // Expense breakdown chart: expenses by category (current month)
  const { data: expenseBreakdownData } = useQuery({
    queryKey: ['finance', 'overview', 'expense-breakdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('amount, category')
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
      if (error) throw error
      return data
    },
  })

  // Also pull platform_fees for expense breakdown
  const { data: platformFeesData } = useQuery({
    queryKey: ['finance', 'overview', 'platform-fees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_fees')
        .select('amount, fee_type, date')
        .gte('date', startOfMonth)
        .lte('date', endOfMonth)
      if (error) throw error
      return data
    },
  })

  const isLoading = revenueLoading || expensesLoading

  // Compute stats with real month-over-month trends
  const stats = useMemo(() => {
    const totalRevenue =
      revenueData?.reduce((sum, r) => sum + (r.net_revenue ?? 0), 0) ?? 0
    const totalExpenses =
      expensesData?.reduce((sum, e) => sum + (e.amount ?? 0), 0) ?? 0
    const netProfit = totalRevenue - totalExpenses
    const grossMargin =
      totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    const prevRevenue =
      lastMonthRevenue?.reduce((sum, r) => sum + (r.net_revenue ?? 0), 0) ?? 0
    const prevExpenses =
      lastMonthExpenses?.reduce((sum, e) => sum + (e.amount ?? 0), 0) ?? 0
    const prevProfit = prevRevenue - prevExpenses
    const prevMargin =
      prevRevenue > 0 ? (prevProfit / prevRevenue) * 100 : 0

    const pct = (curr: number, prev: number) =>
      prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0

    const statCards: StatCard[] = [
      {
        title: 'Revenue (This Month)',
        value: formatCompactCurrency(totalRevenue),
        trend: parseFloat(pct(totalRevenue, prevRevenue).toFixed(1)),
        trendLabel: 'vs last month',
        icon: IndianRupee,
        iconColor: 'text-emerald-600',
        iconBg: 'bg-emerald-50 dark:bg-emerald-950',
      },
      {
        title: 'Total Expenses',
        value: formatCompactCurrency(totalExpenses),
        trend: parseFloat(pct(totalExpenses, prevExpenses).toFixed(1)),
        trendLabel: 'vs last month',
        icon: Receipt,
        iconColor: 'text-red-600',
        iconBg: 'bg-red-50 dark:bg-red-950',
      },
      {
        title: 'Net Profit',
        value: formatCompactCurrency(netProfit),
        trend: parseFloat(pct(netProfit, prevProfit).toFixed(1)),
        trendLabel: 'vs last month',
        icon: TrendingUp,
        iconColor: 'text-blue-600',
        iconBg: 'bg-blue-50 dark:bg-blue-950',
      },
      {
        title: 'Gross Margin',
        value: `${grossMargin.toFixed(1)}%`,
        trend: parseFloat((grossMargin - prevMargin).toFixed(1)),
        trendLabel: 'vs last month',
        icon: PieChartIcon,
        iconColor: 'text-purple-600',
        iconBg: 'bg-purple-50 dark:bg-purple-950',
      },
    ]

    return statCards
  }, [revenueData, expensesData, lastMonthRevenue, lastMonthExpenses])

  // Revenue trend chart: aggregate orders by day
  const revenueTrend = useMemo(() => {
    const dailyMap = new Map<string, number>()
    // Pre-fill last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      dailyMap.set(d.toISOString().split('T')[0], 0)
    }
    for (const order of revenueTrendData ?? []) {
      if (!order.ordered_at) continue
      const dateKey = new Date(order.ordered_at).toISOString().split('T')[0]
      const prev = dailyMap.get(dateKey) ?? 0
      dailyMap.set(dateKey, prev + Number(order.total_amount ?? 0))
    }
    return Array.from(dailyMap.entries()).map(([dateStr, revenue]) => {
      const d = new Date(dateStr)
      return {
        date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        revenue,
      }
    })
  }, [revenueTrendData])

  // Expense breakdown chart: aggregate by category
  const expenseBreakdown = useMemo(() => {
    const categoryMap = new Map<string, number>()

    for (const e of expenseBreakdownData ?? []) {
      const cat = e.category || 'other'
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + Number(e.amount ?? 0))
    }

    // Add platform fees as a category
    const totalPlatformFees =
      platformFeesData?.reduce((sum, f) => sum + Number(f.amount ?? 0), 0) ?? 0
    if (totalPlatformFees > 0) {
      categoryMap.set(
        'platform_fees',
        (categoryMap.get('platform_fees') ?? 0) + totalPlatformFees
      )
    }

    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({
        name: formatCategoryLabel(name),
        value,
        color: getCategoryColor(name),
      }))
      .sort((a, b) => b.value - a.value)
  }, [expenseBreakdownData, platformFeesData])

  if (isLoading) {
    return <FinanceOverviewSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
        <p className="text-muted-foreground">
          Financial overview and reporting for your business
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          const isPositive = stat.trend >= 0
          const TrendIcon = isPositive ? TrendingUp : TrendingDown

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
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 text-xs font-medium',
                          isPositive ? 'text-emerald-600' : 'text-red-600'
                        )}
                      >
                        <TrendIcon className="h-3 w-3" />
                        {Math.abs(stat.trend)}%
                      </span>
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

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={revenueTrend}
                  margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                    interval="preserveStartEnd"
                    tickMargin={8}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-muted-foreground"
                    tickFormatter={(v) => formatCompactCurrency(v)}
                    width={60}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#revenueGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
            <CardDescription>Current month</CardDescription>
          </CardHeader>
          <CardContent>
            {expenseBreakdown.length === 0 ? (
              <p className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No expenses recorded this month
              </p>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {expenseBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ExpenseTooltip />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
                      <p className="text-sm text-muted-foreground">
                        {link.description}
                      </p>
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
