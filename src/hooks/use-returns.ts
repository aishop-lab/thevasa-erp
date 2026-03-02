'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReturnsSummary {
  totalReturns: number
  totalRefunds: number
  totalRtoOrders: number
  totalOrders: number
  returnRate: number
  refundRate: number
  rtoRate: number
  returnAmount: number
  refundAmount: number
  totalRevenue: number
  revenueImpact: number
}

export interface ReturnsByPlatform {
  platform: string
  returns: number
  refunds: number
  totalOrders: number
  returnRate: number
  returnAmount: number
}

export interface ReturnsByProduct {
  productName: string
  sku: string
  returns: number
  unitsSold: number
  returnRate: number
  returnAmount: number
}

export interface ReturnsTrend {
  label: string
  date: string
  returns: number
  refunds: number
  orders: number
  returnRate: number
}

export interface ReturnsByReason {
  reason: string
  count: number
  percentage: number
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const returnKeys = {
  all: ['returns'] as const,
  summary: (from: string, to: string) =>
    [...returnKeys.all, 'summary', from, to] as const,
  byPlatform: (from: string, to: string) =>
    [...returnKeys.all, 'by-platform', from, to] as const,
  byProduct: (from: string, to: string, limit: number) =>
    [...returnKeys.all, 'by-product', from, to, limit] as const,
  trend: (from: string, to: string) =>
    [...returnKeys.all, 'trend', from, to] as const,
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useReturnsSummary(from: Date, to: Date) {
  const supabase = createClient()
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  return useQuery({
    queryKey: returnKeys.summary(fromIso, toIso),
    queryFn: async (): Promise<ReturnsSummary> => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, status, total_amount, platform_id, fulfillment_status')
        .gte('ordered_at', fromIso)
        .lte('ordered_at', toIso)

      if (error) throw error

      const allOrders = orders ?? []
      const totalOrders = allOrders.length
      const totalRevenue = allOrders.reduce(
        (s, o) => s + Number(o.total_amount ?? 0),
        0
      )

      const returned = allOrders.filter((o) => o.status === 'returned')
      const refunded = allOrders.filter((o) => o.status === 'refunded')
      // RTO = orders that were cancelled after being shipped (fulfillment_status = fulfilled but status = cancelled)
      const rto = allOrders.filter(
        (o) =>
          o.status === 'cancelled' &&
          (o.fulfillment_status === 'fulfilled' || o.fulfillment_status === 'returned')
      )

      const totalReturns = returned.length
      const totalRefunds = refunded.length
      const totalRtoOrders = rto.length

      const returnAmount = returned.reduce(
        (s, o) => s + Number(o.total_amount ?? 0),
        0
      )
      const refundAmount = refunded.reduce(
        (s, o) => s + Number(o.total_amount ?? 0),
        0
      )

      return {
        totalReturns,
        totalRefunds,
        totalRtoOrders,
        totalOrders,
        returnRate: totalOrders > 0 ? (totalReturns / totalOrders) * 100 : 0,
        refundRate: totalOrders > 0 ? (totalRefunds / totalOrders) * 100 : 0,
        rtoRate: totalOrders > 0 ? (totalRtoOrders / totalOrders) * 100 : 0,
        returnAmount,
        refundAmount,
        totalRevenue,
        revenueImpact: returnAmount + refundAmount,
      }
    },
  })
}

export function useReturnsByPlatform(from: Date, to: Date) {
  const supabase = createClient()
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  return useQuery({
    queryKey: returnKeys.byPlatform(fromIso, toIso),
    queryFn: async (): Promise<ReturnsByPlatform[]> => {
      const [ordersRes, platformsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, status, total_amount, platform_id')
          .gte('ordered_at', fromIso)
          .lte('ordered_at', toIso),
        supabase.from('platforms').select('id, name'),
      ])

      if (ordersRes.error) throw ordersRes.error

      const platformMap = new Map(
        (platformsRes.data ?? []).map((p) => [p.id, p.name])
      )

      const groups = new Map<
        string,
        { returns: number; refunds: number; total: number; amount: number }
      >()

      for (const order of ordersRes.data ?? []) {
        const name = platformMap.get(order.platform_id) ?? 'other'
        const g = groups.get(name) ?? { returns: 0, refunds: 0, total: 0, amount: 0 }
        g.total++
        if (order.status === 'returned') {
          g.returns++
          g.amount += Number(order.total_amount ?? 0)
        }
        if (order.status === 'refunded') {
          g.refunds++
          g.amount += Number(order.total_amount ?? 0)
        }
        groups.set(name, g)
      }

      return Array.from(groups.entries())
        .map(([platform, g]) => ({
          platform: platform.charAt(0).toUpperCase() + platform.slice(1),
          returns: g.returns,
          refunds: g.refunds,
          totalOrders: g.total,
          returnRate: g.total > 0 ? ((g.returns + g.refunds) / g.total) * 100 : 0,
          returnAmount: g.amount,
        }))
        .sort((a, b) => b.returnRate - a.returnRate)
    },
  })
}

export function useReturnsByProduct(from: Date, to: Date, limit: number = 20) {
  const supabase = createClient()
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  return useQuery({
    queryKey: returnKeys.byProduct(fromIso, toIso, limit),
    queryFn: async (): Promise<ReturnsByProduct[]> => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select(
          'id, status, order_items(product_name, sku, quantity, total)'
        )
        .gte('ordered_at', fromIso)
        .lte('ordered_at', toIso)

      if (error) throw error

      const productMap = new Map<
        string,
        { name: string; sku: string; returns: number; sold: number; amount: number }
      >()

      for (const order of orders ?? []) {
        const isReturn = order.status === 'returned' || order.status === 'refunded'
        const items = (order.order_items ?? []) as any[]
        for (const item of items) {
          const name = item.product_name ?? item.sku ?? 'Unknown'
          const existing = productMap.get(name) ?? {
            name,
            sku: item.sku ?? '',
            returns: 0,
            sold: 0,
            amount: 0,
          }
          existing.sold += Number(item.quantity ?? 0)
          if (isReturn) {
            existing.returns += Number(item.quantity ?? 0)
            existing.amount += Number(item.total ?? 0)
          }
          productMap.set(name, existing)
        }
      }

      return Array.from(productMap.values())
        .filter((p) => p.returns > 0)
        .map((p) => ({
          productName: p.name,
          sku: p.sku,
          returns: p.returns,
          unitsSold: p.sold,
          returnRate: p.sold > 0 ? (p.returns / p.sold) * 100 : 0,
          returnAmount: p.amount,
        }))
        .sort((a, b) => b.returns - a.returns)
        .slice(0, limit)
    },
  })
}

export function useReturnsTrend(from: Date, to: Date) {
  const supabase = createClient()
  const fromIso = from.toISOString()
  const toIso = to.toISOString()

  return useQuery({
    queryKey: returnKeys.trend(fromIso, toIso),
    queryFn: async (): Promise<ReturnsTrend[]> => {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, status, ordered_at')
        .gte('ordered_at', fromIso)
        .lte('ordered_at', toIso)
        .order('ordered_at', { ascending: true })

      if (error) throw error

      // Group by week
      const weekMap = new Map<
        string,
        { returns: number; refunds: number; orders: number; start: Date }
      >()

      for (const order of orders ?? []) {
        if (!order.ordered_at) continue
        const d = new Date(order.ordered_at)
        // Get week start (Monday)
        const day = d.getDay()
        const diff = d.getDate() - day + (day === 0 ? -6 : 1)
        const weekStart = new Date(d.getFullYear(), d.getMonth(), diff)
        const key = weekStart.toISOString().split('T')[0]

        const g = weekMap.get(key) ?? { returns: 0, refunds: 0, orders: 0, start: weekStart }
        g.orders++
        if (order.status === 'returned') g.returns++
        if (order.status === 'refunded') g.refunds++
        weekMap.set(key, g)
      }

      return Array.from(weekMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, g]) => ({
          date,
          label: `Week of ${g.start.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`,
          returns: g.returns,
          refunds: g.refunds,
          orders: g.orders,
          returnRate: g.orders > 0 ? ((g.returns + g.refunds) / g.orders) * 100 : 0,
        }))
    },
  })
}
