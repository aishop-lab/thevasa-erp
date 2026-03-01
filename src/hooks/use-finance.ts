'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  type Granularity,
  bucketDates,
  dateToBucketKey,
  formatBucketLabel,
} from '@/lib/utils/date'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformRow {
  id: string
  name: string
}

interface RevenueRow {
  date: string
  gross_revenue: number
  discount: number
  net_revenue: number
  tax_collected: number
  platform_id: string
}

interface OrderRow {
  id: string
  platform_id: string
  total_amount: number
  status: string
  ordered_at: string
}

interface OrderItemRow {
  order_id: string
  product_name: string | null
  sku: string | null
  quantity: number
  total: number
}

interface PaymentRow {
  id: string
  amount: number
  method: string | null
  status: string
}

interface ExpenseRow {
  id: string
  amount: number
  category: string
  date: string
  gst_amount: number
}

interface PlatformFeeRow {
  amount: number
  fee_type: string
  platform_id: string
  date: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toIso(d: Date): string {
  return d.toISOString()
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / Math.abs(previous)) * 100
}

// ---------------------------------------------------------------------------
// usePlatforms
// ---------------------------------------------------------------------------

export function usePlatforms() {
  const supabase = createClient()

  const { data, ...rest } = useQuery({
    queryKey: ['finance', 'platforms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platforms')
        .select('id, name')
      if (error) throw error
      return data as PlatformRow[]
    },
    staleTime: 5 * 60 * 1000,
  })

  const platformMap = useMemo(() => {
    if (!data) return new Map<string, string>()
    return new Map(data.map((p) => [p.id, p.name.toLowerCase()]))
  }, [data])

  return { platforms: data ?? [], platformMap, ...rest }
}

// ---------------------------------------------------------------------------
// useRevenueOverview
// ---------------------------------------------------------------------------

export interface RevenueOverview {
  grossRevenue: number
  discounts: number
  netRevenue: number
  taxCollected: number
  prevGrossRevenue: number
  prevDiscounts: number
  prevNetRevenue: number
  prevTaxCollected: number
  grossRevenueChange: number
  netRevenueChange: number
  discountChange: number
  taxChange: number
}

export function useRevenueOverview(
  from: Date,
  to: Date,
  compareFrom?: Date,
  compareTo?: Date
) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['finance', 'revenue-overview', toIso(from), toIso(to), compareFrom?.toISOString(), compareTo?.toISOString()],
    queryFn: async (): Promise<RevenueOverview> => {
      const [currentRes, prevRes] = await Promise.all([
        supabase
          .from('sales_revenue')
          .select('gross_revenue, discount, net_revenue, tax_collected')
          .gte('date', toIso(from))
          .lte('date', toIso(to)),
        compareFrom && compareTo
          ? supabase
              .from('sales_revenue')
              .select('gross_revenue, discount, net_revenue, tax_collected')
              .gte('date', toIso(compareFrom))
              .lte('date', toIso(compareTo))
          : Promise.resolve({ data: [] as any[], error: null }),
      ])

      if (currentRes.error) throw currentRes.error

      const current = currentRes.data ?? []
      const prev = prevRes.data ?? []

      const sum = (arr: any[], key: string) =>
        arr.reduce((s, r) => s + Number(r[key] ?? 0), 0)

      const grossRevenue = sum(current, 'gross_revenue')
      const discounts = sum(current, 'discount')
      const netRevenue = sum(current, 'net_revenue')
      const taxCollected = sum(current, 'tax_collected')

      const prevGrossRevenue = sum(prev, 'gross_revenue')
      const prevDiscounts = sum(prev, 'discount')
      const prevNetRevenue = sum(prev, 'net_revenue')
      const prevTaxCollected = sum(prev, 'tax_collected')

      return {
        grossRevenue,
        discounts,
        netRevenue,
        taxCollected,
        prevGrossRevenue,
        prevDiscounts,
        prevNetRevenue,
        prevTaxCollected,
        grossRevenueChange: pctChange(grossRevenue, prevGrossRevenue),
        netRevenueChange: pctChange(netRevenue, prevNetRevenue),
        discountChange: pctChange(discounts, prevDiscounts),
        taxChange: pctChange(taxCollected, prevTaxCollected),
      }
    },
  })
}

// ---------------------------------------------------------------------------
// useOrderAnalytics
// ---------------------------------------------------------------------------

export interface OrderAnalytics {
  totalOrders: number
  totalAmount: number
  aov: number
  prevTotalOrders: number
  prevAov: number
  ordersChange: number
  aovChange: number
  byStatus: { status: string; count: number }[]
  byPlatform: { platform: string; count: number; amount: number }[]
}

export function useOrderAnalytics(
  from: Date,
  to: Date,
  compareFrom?: Date,
  compareTo?: Date
) {
  const supabase = createClient()
  const { platformMap } = usePlatforms()

  return useQuery({
    queryKey: ['finance', 'order-analytics', toIso(from), toIso(to), compareFrom?.toISOString(), compareTo?.toISOString()],
    queryFn: async (): Promise<OrderAnalytics> => {
      const [currentRes, prevRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, platform_id, total_amount, status')
          .gte('ordered_at', toIso(from))
          .lte('ordered_at', toIso(to)),
        compareFrom && compareTo
          ? supabase
              .from('orders')
              .select('id, total_amount')
              .gte('ordered_at', toIso(compareFrom))
              .lte('ordered_at', toIso(compareTo))
          : Promise.resolve({ data: [] as any[], error: null }),
      ])

      if (currentRes.error) throw currentRes.error

      const current = (currentRes.data ?? []) as OrderRow[]
      const prev = (prevRes.data ?? []) as any[]

      const totalOrders = current.length
      const totalAmount = current.reduce(
        (s, o) => s + Number(o.total_amount ?? 0),
        0
      )
      const aov = totalOrders > 0 ? totalAmount / totalOrders : 0

      const prevTotalOrders = prev.length
      const prevAmount = prev.reduce(
        (s: number, o: any) => s + Number(o.total_amount ?? 0),
        0
      )
      const prevAov = prevTotalOrders > 0 ? prevAmount / prevTotalOrders : 0

      // Status breakdown
      const statusMap = new Map<string, number>()
      for (const o of current) {
        const s = o.status || 'unknown'
        statusMap.set(s, (statusMap.get(s) ?? 0) + 1)
      }

      // Platform breakdown
      const platMap = new Map<
        string,
        { count: number; amount: number }
      >()
      for (const o of current) {
        const name = platformMap.get(o.platform_id) ?? 'other'
        const existing = platMap.get(name) ?? { count: 0, amount: 0 }
        existing.count++
        existing.amount += Number(o.total_amount ?? 0)
        platMap.set(name, existing)
      }

      return {
        totalOrders,
        totalAmount,
        aov,
        prevTotalOrders,
        prevAov,
        ordersChange: pctChange(totalOrders, prevTotalOrders),
        aovChange: pctChange(aov, prevAov),
        byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({
          status,
          count,
        })),
        byPlatform: Array.from(platMap.entries()).map(
          ([platform, { count, amount }]) => ({
            platform,
            count,
            amount,
          })
        ),
      }
    },
    enabled: platformMap.size > 0,
  })
}

// ---------------------------------------------------------------------------
// useTopProducts
// ---------------------------------------------------------------------------

export interface TopProduct {
  name: string
  unitsSold: number
  revenue: number
}

export function useTopProducts(from: Date, to: Date, limit: number = 10) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['finance', 'top-products', toIso(from), toIso(to), limit],
    queryFn: async (): Promise<TopProduct[]> => {
      // Get order IDs in the date range
      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('id')
        .gte('ordered_at', toIso(from))
        .lte('ordered_at', toIso(to))

      if (ordersErr) throw ordersErr
      if (!orders || orders.length === 0) return []

      const orderIds = orders.map((o) => o.id)

      // Fetch order items for those orders
      const { data: items, error: itemsErr } = await supabase
        .from('order_items')
        .select('product_name, sku, quantity, total')
        .in('order_id', orderIds)

      if (itemsErr) throw itemsErr
      if (!items) return []

      const productMap = new Map<
        string,
        { name: string; unitsSold: number; revenue: number }
      >()

      for (const item of items) {
        const name = item.product_name ?? item.sku ?? 'Unknown'
        const existing = productMap.get(name) ?? {
          name,
          unitsSold: 0,
          revenue: 0,
        }
        existing.unitsSold += Number(item.quantity)
        existing.revenue += Number(item.total)
        productMap.set(name, existing)
      }

      return Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit)
    },
  })
}

// ---------------------------------------------------------------------------
// useRevenueTimeSeries
// ---------------------------------------------------------------------------

export interface TimeSeriesPoint {
  date: string
  label: string
  revenue: number
  prevRevenue?: number
}

export function useRevenueTimeSeries(
  from: Date,
  to: Date,
  granularity: Granularity,
  compareFrom?: Date,
  compareTo?: Date
) {
  const supabase = createClient()

  return useQuery({
    queryKey: [
      'finance',
      'revenue-ts',
      toIso(from),
      toIso(to),
      granularity,
      compareFrom?.toISOString(),
      compareTo?.toISOString(),
    ],
    queryFn: async (): Promise<TimeSeriesPoint[]> => {
      const [currentRes, prevRes] = await Promise.all([
        supabase
          .from('sales_revenue')
          .select('date, net_revenue')
          .gte('date', toIso(from))
          .lte('date', toIso(to))
          .order('date', { ascending: true }),
        compareFrom && compareTo
          ? supabase
              .from('sales_revenue')
              .select('date, net_revenue')
              .gte('date', toIso(compareFrom))
              .lte('date', toIso(compareTo))
              .order('date', { ascending: true })
          : Promise.resolve({ data: [] as any[], error: null }),
      ])

      if (currentRes.error) throw currentRes.error

      const currentData = currentRes.data ?? []
      const prevData = prevRes.data ?? []

      // Generate buckets for current period
      const buckets = bucketDates(from, to, granularity)

      // Aggregate current into buckets
      const currentMap = new Map<string, number>()
      for (const row of currentData) {
        const key = dateToBucketKey(new Date(row.date), granularity)
        currentMap.set(key, (currentMap.get(key) ?? 0) + Number(row.net_revenue ?? 0))
      }

      // Aggregate previous into buckets (by index)
      const prevBuckets = compareFrom && compareTo
        ? bucketDates(compareFrom, compareTo, granularity)
        : []
      const prevMap = new Map<number, number>()
      if (prevData.length > 0) {
        const prevBucketMap = new Map<string, number>()
        for (const row of prevData) {
          const key = dateToBucketKey(new Date(row.date), granularity)
          prevBucketMap.set(key, (prevBucketMap.get(key) ?? 0) + Number(row.net_revenue ?? 0))
        }
        prevBuckets.forEach((b, i) => {
          const key = dateToBucketKey(b, granularity)
          prevMap.set(i, prevBucketMap.get(key) ?? 0)
        })
      }

      return buckets.map((bucket, i) => {
        const key = dateToBucketKey(bucket, granularity)
        return {
          date: key,
          label: formatBucketLabel(bucket, granularity),
          revenue: currentMap.get(key) ?? 0,
          prevRevenue: prevMap.has(i) ? prevMap.get(i) : undefined,
        }
      })
    },
  })
}

// ---------------------------------------------------------------------------
// useRevenuePlatformTimeSeries
// ---------------------------------------------------------------------------

export interface PlatformTimeSeriesPoint {
  label: string
  [platformName: string]: string | number
}

export function useRevenuePlatformTimeSeries(
  from: Date,
  to: Date,
  granularity: Granularity
) {
  const supabase = createClient()
  const { platformMap } = usePlatforms()

  return useQuery({
    queryKey: ['finance', 'revenue-platform-ts', toIso(from), toIso(to), granularity],
    queryFn: async (): Promise<{
      data: PlatformTimeSeriesPoint[]
      platforms: string[]
    }> => {
      const { data, error } = await supabase
        .from('sales_revenue')
        .select('date, net_revenue, platform_id')
        .gte('date', toIso(from))
        .lte('date', toIso(to))
        .order('date', { ascending: true })

      if (error) throw error

      const buckets = bucketDates(from, to, granularity)
      const platNames = new Set<string>()
      const bucketMap = new Map<string, Record<string, number>>()

      for (const row of data ?? []) {
        const key = dateToBucketKey(new Date(row.date), granularity)
        const platform = platformMap.get(row.platform_id) ?? 'other'
        platNames.add(platform)
        if (!bucketMap.has(key)) bucketMap.set(key, {})
        const entry = bucketMap.get(key)!
        entry[platform] = (entry[platform] ?? 0) + Number(row.net_revenue ?? 0)
      }

      const platforms = Array.from(platNames)
      const result = buckets.map((bucket) => {
        const key = dateToBucketKey(bucket, granularity)
        const entry = bucketMap.get(key) ?? {}
        const point: PlatformTimeSeriesPoint = {
          label: formatBucketLabel(bucket, granularity),
        }
        for (const p of platforms) {
          point[p] = entry[p] ?? 0
        }
        return point
      })

      return { data: result, platforms }
    },
    enabled: platformMap.size > 0,
  })
}

// ---------------------------------------------------------------------------
// usePaymentAnalytics
// ---------------------------------------------------------------------------

export interface PaymentAnalytics {
  byMethod: { method: string; count: number; amount: number }[]
  byStatus: { status: string; count: number; amount: number }[]
  totalCollected: number
}

export function usePaymentAnalytics(from: Date, to: Date) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['finance', 'payments', toIso(from), toIso(to)],
    queryFn: async (): Promise<PaymentAnalytics> => {
      const { data, error } = await supabase
        .from('payments')
        .select('id, amount, method, status')
        .gte('created_at', toIso(from))
        .lte('created_at', toIso(to))

      if (error) throw error

      const payments = (data ?? []) as PaymentRow[]
      const methodMap = new Map<string, { count: number; amount: number }>()
      const statusMap = new Map<string, { count: number; amount: number }>()

      for (const p of payments) {
        const method = p.method || 'unknown'
        const status = p.status || 'unknown'
        const amt = Number(p.amount ?? 0)

        const me = methodMap.get(method) ?? { count: 0, amount: 0 }
        me.count++
        me.amount += amt
        methodMap.set(method, me)

        const se = statusMap.get(status) ?? { count: 0, amount: 0 }
        se.count++
        se.amount += amt
        statusMap.set(status, se)
      }

      return {
        byMethod: Array.from(methodMap.entries()).map(([method, v]) => ({
          method,
          ...v,
        })),
        byStatus: Array.from(statusMap.entries()).map(([status, v]) => ({
          status,
          ...v,
        })),
        totalCollected: payments.reduce((s, p) => s + Number(p.amount ?? 0), 0),
      }
    },
  })
}

// ---------------------------------------------------------------------------
// useExpensesSummary
// ---------------------------------------------------------------------------

export interface ExpensesSummary {
  totalExpenses: number
  totalGst: number
  totalPlatformFees: number
  prevTotalExpenses: number
  expensesChange: number
  byCategory: { category: string; amount: number }[]
  trendData: { label: string; amount: number }[]
}

export function useExpensesSummary(
  from: Date,
  to: Date,
  granularity: Granularity,
  compareFrom?: Date,
  compareTo?: Date
) {
  const supabase = createClient()

  return useQuery({
    queryKey: [
      'finance',
      'expenses-summary',
      toIso(from),
      toIso(to),
      granularity,
      compareFrom?.toISOString(),
      compareTo?.toISOString(),
    ],
    queryFn: async (): Promise<ExpensesSummary> => {
      const [expRes, feesRes, prevRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('amount, category, date, gst_amount')
          .gte('date', toIso(from))
          .lte('date', toIso(to)),
        supabase
          .from('platform_fees')
          .select('amount, date')
          .gte('date', toIso(from))
          .lte('date', toIso(to)),
        compareFrom && compareTo
          ? supabase
              .from('expenses')
              .select('amount')
              .gte('date', toIso(compareFrom))
              .lte('date', toIso(compareTo))
          : Promise.resolve({ data: [] as any[], error: null }),
      ])

      if (expRes.error) throw expRes.error

      const expenses = (expRes.data ?? []) as ExpenseRow[]
      const fees = (feesRes.data ?? []) as PlatformFeeRow[]
      const prevExpenses = (prevRes.data ?? []) as any[]

      const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0)
      const totalGst = expenses.reduce((s, e) => s + Number(e.gst_amount ?? 0), 0)
      const totalPlatformFees = fees.reduce((s, f) => s + Number(f.amount ?? 0), 0)
      const prevTotalExpenses = prevExpenses.reduce(
        (s: number, e: any) => s + Number(e.amount ?? 0),
        0
      )

      // By category
      const catMap = new Map<string, number>()
      for (const e of expenses) {
        const cat = e.category || 'Other'
        catMap.set(cat, (catMap.get(cat) ?? 0) + Number(e.amount ?? 0))
      }
      if (totalPlatformFees > 0) {
        catMap.set(
          'Platform Fees',
          (catMap.get('Platform Fees') ?? 0) + totalPlatformFees
        )
      }

      // Trend data
      const buckets = bucketDates(from, to, granularity)
      const trendMap = new Map<string, number>()
      for (const e of expenses) {
        const key = dateToBucketKey(new Date(e.date), granularity)
        trendMap.set(key, (trendMap.get(key) ?? 0) + Number(e.amount ?? 0))
      }

      return {
        totalExpenses: totalExpenses + totalPlatformFees,
        totalGst,
        totalPlatformFees,
        prevTotalExpenses,
        expensesChange: pctChange(totalExpenses + totalPlatformFees, prevTotalExpenses),
        byCategory: Array.from(catMap.entries())
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount),
        trendData: buckets.map((b) => ({
          label: formatBucketLabel(b, granularity),
          amount: trendMap.get(dateToBucketKey(b, granularity)) ?? 0,
        })),
      }
    },
  })
}

// ---------------------------------------------------------------------------
// useDailyRevenue (for heatmap)
// ---------------------------------------------------------------------------

export interface DailyRevenuePoint {
  date: string // YYYY-MM-DD
  revenue: number
}

export function useDailyRevenue(from: Date, to: Date) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['finance', 'daily-revenue', toIso(from), toIso(to)],
    queryFn: async (): Promise<DailyRevenuePoint[]> => {
      const { data, error } = await supabase
        .from('sales_revenue')
        .select('date, net_revenue')
        .gte('date', toIso(from))
        .lte('date', toIso(to))

      if (error) throw error

      const dayMap = new Map<string, number>()
      for (const row of data ?? []) {
        const dateKey = new Date(row.date).toISOString().split('T')[0]
        dayMap.set(dateKey, (dayMap.get(dateKey) ?? 0) + Number(row.net_revenue ?? 0))
      }

      return Array.from(dayMap.entries())
        .map(([date, revenue]) => ({ date, revenue }))
        .sort((a, b) => a.date.localeCompare(b.date))
    },
  })
}

// ---------------------------------------------------------------------------
// usePnlData
// ---------------------------------------------------------------------------

export interface PnlSummary {
  grossRevenue: number
  discounts: number
  netRevenue: number
  cogs: number
  grossProfit: number
  operatingExpenses: number
  platformFees: number
  netProfit: number
  grossMargin: number
  netMargin: number
}

export function usePnlData(from: Date, to: Date) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['finance', 'pnl', toIso(from), toIso(to)],
    queryFn: async (): Promise<PnlSummary> => {
      const [revenueRes, expensesRes, feesRes, cogsRes] = await Promise.all([
        supabase
          .from('sales_revenue')
          .select('gross_revenue, discount, net_revenue')
          .gte('date', toIso(from))
          .lte('date', toIso(to)),
        supabase
          .from('expenses')
          .select('amount')
          .gte('date', toIso(from))
          .lte('date', toIso(to)),
        supabase
          .from('platform_fees')
          .select('amount')
          .gte('date', toIso(from))
          .lte('date', toIso(to)),
        supabase
          .from('cogs_records')
          .select('total_cost')
          .gte('date', toIso(from))
          .lte('date', toIso(to)),
      ])

      if (revenueRes.error) throw revenueRes.error

      const revenues = revenueRes.data ?? []
      const expenses = expensesRes.data ?? []
      const fees = feesRes.data ?? []
      const cogsRecs = cogsRes.data ?? []

      const grossRevenue = revenues.reduce(
        (s, r) => s + Number(r.gross_revenue ?? 0),
        0
      )
      const discounts = revenues.reduce(
        (s, r) => s + Number(r.discount ?? 0),
        0
      )
      const netRevenue = revenues.reduce(
        (s, r) => s + Number(r.net_revenue ?? 0),
        0
      )
      const cogs = cogsRecs.reduce(
        (s: number, c: any) => s + Number(c.total_cost ?? 0),
        0
      )
      const operatingExpenses = expenses.reduce(
        (s, e) => s + Number((e as any).amount ?? 0),
        0
      )
      const platformFees = fees.reduce(
        (s, f) => s + Number((f as any).amount ?? 0),
        0
      )

      const grossProfit = netRevenue - cogs
      const netProfit = grossProfit - operatingExpenses - platformFees

      return {
        grossRevenue,
        discounts,
        netRevenue,
        cogs,
        grossProfit,
        operatingExpenses,
        platformFees,
        netProfit,
        grossMargin: netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0,
        netMargin: netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0,
      }
    },
  })
}

// ---------------------------------------------------------------------------
// useRevenuePlatformSplit (for donut charts)
// ---------------------------------------------------------------------------

export function useRevenuePlatformSplit(from: Date, to: Date) {
  const supabase = createClient()
  const { platformMap } = usePlatforms()

  return useQuery({
    queryKey: ['finance', 'revenue-platform-split', toIso(from), toIso(to)],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_revenue')
        .select('net_revenue, platform_id')
        .gte('date', toIso(from))
        .lte('date', toIso(to))

      if (error) throw error

      const platMap = new Map<string, number>()
      for (const row of data ?? []) {
        const name = platformMap.get(row.platform_id) ?? 'other'
        platMap.set(name, (platMap.get(name) ?? 0) + Number(row.net_revenue ?? 0))
      }

      return Array.from(platMap.entries()).map(([platform, revenue]) => ({
        platform: platform.charAt(0).toUpperCase() + platform.slice(1),
        revenue,
      }))
    },
    enabled: platformMap.size > 0,
  })
}

// ---------------------------------------------------------------------------
// useTaxOverview (for GST page — derived from sales_revenue)
// ---------------------------------------------------------------------------

export interface TaxOverview {
  totalTaxCollected: number
  prevTaxCollected: number
  taxChange: number
  byPlatform: { platform: string; tax: number }[]
  trendData: { label: string; tax: number }[]
}

export function useTaxOverview(
  from: Date,
  to: Date,
  granularity: Granularity,
  compareFrom?: Date,
  compareTo?: Date
) {
  const supabase = createClient()
  const { platformMap } = usePlatforms()

  return useQuery({
    queryKey: [
      'finance',
      'tax-overview',
      toIso(from),
      toIso(to),
      granularity,
      compareFrom?.toISOString(),
      compareTo?.toISOString(),
    ],
    queryFn: async (): Promise<TaxOverview> => {
      const [currentRes, prevRes] = await Promise.all([
        supabase
          .from('sales_revenue')
          .select('date, tax_collected, platform_id')
          .gte('date', toIso(from))
          .lte('date', toIso(to)),
        compareFrom && compareTo
          ? supabase
              .from('sales_revenue')
              .select('tax_collected')
              .gte('date', toIso(compareFrom))
              .lte('date', toIso(compareTo))
          : Promise.resolve({ data: [] as any[], error: null }),
      ])

      if (currentRes.error) throw currentRes.error

      const current = currentRes.data ?? []
      const prev = prevRes.data ?? []

      const totalTaxCollected = current.reduce(
        (s, r) => s + Number(r.tax_collected ?? 0),
        0
      )
      const prevTaxCollected = prev.reduce(
        (s: number, r: any) => s + Number(r.tax_collected ?? 0),
        0
      )

      // By platform
      const platMap = new Map<string, number>()
      for (const row of current) {
        const name = platformMap.get(row.platform_id) ?? 'other'
        const displayName = name.charAt(0).toUpperCase() + name.slice(1)
        platMap.set(displayName, (platMap.get(displayName) ?? 0) + Number(row.tax_collected ?? 0))
      }

      // Trend
      const buckets = bucketDates(from, to, granularity)
      const trendMap = new Map<string, number>()
      for (const row of current) {
        const key = dateToBucketKey(new Date(row.date), granularity)
        trendMap.set(key, (trendMap.get(key) ?? 0) + Number(row.tax_collected ?? 0))
      }

      return {
        totalTaxCollected,
        prevTaxCollected,
        taxChange: pctChange(totalTaxCollected, prevTaxCollected),
        byPlatform: Array.from(platMap.entries()).map(([platform, tax]) => ({
          platform,
          tax,
        })),
        trendData: buckets.map((b) => ({
          label: formatBucketLabel(b, granularity),
          tax: trendMap.get(dateToBucketKey(b, granularity)) ?? 0,
        })),
      }
    },
    enabled: platformMap.size > 0,
  })
}
