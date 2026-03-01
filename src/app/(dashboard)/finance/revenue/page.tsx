'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DatePreset = 'this_week' | 'this_month' | 'this_quarter' | 'custom'
type Granularity = 'daily' | 'weekly' | 'monthly'

const PLATFORM_COLORS: Record<string, string> = {
  shopify: '#3b82f6',
  amazon: '#f97316',
  other: '#8b5cf6',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDateRange(preset: DatePreset) {
  const now = new Date()
  let startDate: Date
  switch (preset) {
    case 'this_week': {
      const day = now.getDay()
      startDate = new Date(now)
      startDate.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
      startDate.setHours(0, 0, 0, 0)
      break
    }
    case 'this_month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'this_quarter': {
      const quarter = Math.floor(now.getMonth() / 3)
      startDate = new Date(now.getFullYear(), quarter * 3, 1)
      break
    }
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  }
  return { startDate, endDate: now }
}

function getGranularityKey(d: Date, granularity: Granularity): string {
  if (granularity === 'monthly') {
    return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
  } else if (granularity === 'weekly') {
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    return weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function RevenueSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-4">
        <Skeleton className="h-9 w-[160px]" />
        <Skeleton className="h-9 w-[160px]" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[400px] rounded-lg" />
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function RevenuePage() {
  const supabase = createClient()
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month')
  const [granularity, setGranularity] = useState<Granularity>('daily')

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['finance', 'revenue', datePreset],
    queryFn: async () => {
      const { startDate, endDate } = getDateRange(datePreset)
      const startIso = startDate.toISOString()
      const endIso = endDate.toISOString()

      const [revenueRes, platformsRes, ordersRes, orderItemsRes] = await Promise.all([
        supabase
          .from('sales_revenue')
          .select('date, gross_revenue, discount, net_revenue, tax_collected, platform_id')
          .gte('date', startIso)
          .lte('date', endIso)
          .order('date', { ascending: true }),
        supabase.from('platforms').select('id, name'),
        supabase
          .from('orders')
          .select('id, platform_id, total_amount')
          .gte('ordered_at', startIso)
          .lte('ordered_at', endIso),
        supabase
          .from('order_items')
          .select('product_name, sku, quantity, total')
          .limit(5000),
      ])

      if (revenueRes.error) throw revenueRes.error

      return {
        revenue: revenueRes.data ?? [],
        platforms: platformsRes.data ?? [],
        orders: ordersRes.data ?? [],
        orderItems: orderItemsRes.data ?? [],
      }
    },
  })

  // Map platform IDs to names
  const platformMap = useMemo(() => {
    if (!data?.platforms) return new Map<string, string>()
    return new Map(data.platforms.map((p: any) => [p.id, (p.name as string).toLowerCase()]))
  }, [data?.platforms])

  // Platform revenue bar chart data
  const platformRevenue = useMemo(() => {
    if (!data?.revenue) return []
    const grouped = new Map<string, Record<string, any>>()

    for (const r of data.revenue) {
      const key = getGranularityKey(new Date(r.date), granularity)
      if (!grouped.has(key)) grouped.set(key, { name: key })
      const entry = grouped.get(key)!
      const platform = platformMap.get(r.platform_id) ?? 'other'
      entry[platform] = (entry[platform] ?? 0) + Number(r.net_revenue)
    }

    return Array.from(grouped.values())
  }, [data?.revenue, platformMap, granularity])

  // Revenue trend line chart data
  const revenueTrend = useMemo(() => {
    if (!data?.revenue) return []
    const grouped = new Map<string, number>()

    for (const r of data.revenue) {
      const key = getGranularityKey(new Date(r.date), granularity)
      grouped.set(key, (grouped.get(key) ?? 0) + Number(r.net_revenue))
    }

    return Array.from(grouped.entries()).map(([date, revenue]) => ({ date, revenue }))
  }, [data?.revenue, granularity])

  // Top selling products from order_items
  const topProducts = useMemo(() => {
    if (!data?.orderItems || data.orderItems.length === 0) return []
    const productMap = new Map<string, { name: string; units_sold: number; revenue: number }>()

    for (const item of data.orderItems) {
      const name = item.product_name ?? item.sku ?? 'Unknown'
      const existing = productMap.get(name) ?? { name, units_sold: 0, revenue: 0 }
      existing.units_sold += Number(item.quantity)
      existing.revenue += Number(item.total)
      productMap.set(name, existing)
    }

    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map((p, i) => ({ ...p, rank: i + 1 }))
  }, [data?.orderItems])

  // Average order value by platform
  const aovData = useMemo(() => {
    if (!data?.orders || data.orders.length === 0) return []
    const agg = new Map<string, { orders: number; total_revenue: number }>()

    for (const order of data.orders) {
      const rawName = platformMap.get(order.platform_id) ?? 'other'
      const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1)
      const existing = agg.get(displayName) ?? { orders: 0, total_revenue: 0 }
      existing.orders++
      existing.total_revenue += Number(order.total_amount)
      agg.set(displayName, existing)
    }

    return Array.from(agg.entries()).map(([platform, v]) => ({
      platform,
      orders: v.orders,
      total_revenue: v.total_revenue,
      aov: v.orders > 0 ? v.total_revenue / v.orders : 0,
    }))
  }, [data?.orders, platformMap])

  // Detect platform keys for dynamic bar chart
  const platformNames = useMemo(() => {
    const names = new Set<string>()
    for (const entry of platformRevenue) {
      Object.keys(entry).forEach((k) => {
        if (k !== 'name') names.add(k)
      })
    }
    return Array.from(names)
  }, [platformRevenue])

  if (isLoading) return <RevenueSkeleton />

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
        <div className="flex items-center gap-3">
          <Select
            value={datePreset}
            onValueChange={(v) => setDatePreset(v as DatePreset)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">This Week</SelectItem>
              <SelectItem value="this_month">This Month</SelectItem>
              <SelectItem value="this_quarter">This Quarter</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={granularity}
            onValueChange={(v) => setGranularity(v as Granularity)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by Platform */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Platform</CardTitle>
            <CardDescription>Platform comparison</CardDescription>
          </CardHeader>
          <CardContent>
            {platformRevenue.length === 0 ? (
              <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
                No revenue data for this period
              </div>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={platformRevenue}
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
                      tickMargin={8}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatCompactCurrency(v)}
                      width={65}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    {platformNames.map((name) => (
                      <Bar
                        key={name}
                        dataKey={name}
                        name={name.charAt(0).toUpperCase() + name.slice(1)}
                        fill={PLATFORM_COLORS[name] ?? '#6b7280'}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription className="capitalize">{granularity} view</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueTrend.length === 0 ? (
              <div className="flex h-[350px] items-center justify-center text-sm text-muted-foreground">
                No revenue data for this period
              </div>
            ) : (
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={revenueTrend}
                    margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                  >
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
                      interval="preserveStartEnd"
                      tickMargin={8}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatCompactCurrency(v)}
                      width={65}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Top Selling Products */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
            <CardDescription>By revenue in selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No order items data yet. Run a catalog sync to populate.
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
                    {topProducts.map((product) => (
                      <TableRow key={product.rank}>
                        <TableCell className="font-medium text-muted-foreground">
                          {product.rank}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate font-medium">
                          {product.name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {product.units_sold}
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

        {/* Average Order Value */}
        <Card>
          <CardHeader>
            <CardTitle>Average Order Value</CardTitle>
            <CardDescription>By platform</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {aovData.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                No orders for this period
              </div>
            ) : (
              aovData.map((item) => (
                <div
                  key={item.platform}
                  className="space-y-2 rounded-lg border p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.platform}</span>
                    <span className="text-2xl font-bold tabular-nums">
                      {formatCurrency(item.aov)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{item.orders} orders</span>
                    <span>{formatCurrency(item.total_revenue)} total</span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
