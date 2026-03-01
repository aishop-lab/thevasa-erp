'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
  revenueChart: (days: number) =>
    [...dashboardKeys.all, 'revenue-chart', days] as const,
  platformComparison: () =>
    [...dashboardKeys.all, 'platform-comparison'] as const,
  inventoryAlerts: () => [...dashboardKeys.all, 'inventory-alerts'] as const,
  syncStatus: () => [...dashboardKeys.all, 'sync-status'] as const,
}

// ---------------------------------------------------------------------------
// useDashboardStats
// ---------------------------------------------------------------------------

export interface DashboardStats {
  todayOrders: number
  yesterdayOrders: number
  todayRevenue: number
  yesterdayRevenue: number
  pendingShipments: number
  lowStockCount: number
}

export function useDashboardStats() {
  const supabase = createClient()

  return useQuery({
    queryKey: dashboardKeys.stats(),
    queryFn: async (): Promise<DashboardStats> => {
      const now = new Date()
      const todayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      ).toISOString()
      const yesterdayStart = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1
      ).toISOString()

      // Today's orders
      const { count: todayOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('ordered_at', todayStart)

      // Yesterday's orders
      const { count: yesterdayOrders } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('ordered_at', yesterdayStart)
        .lt('ordered_at', todayStart)

      // Today's revenue
      const { data: todayRevenueData } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('ordered_at', todayStart)

      const todayRevenue =
        todayRevenueData?.reduce(
          (sum, o) => sum + Number(o.total_amount ?? 0),
          0
        ) ?? 0

      // Yesterday's revenue
      const { data: yesterdayRevenueData } = await supabase
        .from('orders')
        .select('total_amount')
        .gte('ordered_at', yesterdayStart)
        .lt('ordered_at', todayStart)

      const yesterdayRevenue =
        yesterdayRevenueData?.reduce(
          (sum, o) => sum + Number(o.total_amount ?? 0),
          0
        ) ?? 0

      // Pending shipments
      const { count: pendingShipments } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .in('status', ['confirmed', 'processing'])

      // Low stock count
      const { data: stockData } = await supabase
        .from('warehouse_stock')
        .select(
          'qty_available, variant:product_variants(product:products(low_stock_threshold))'
        )

      const lowStockCount =
        stockData?.filter((s) => {
          const threshold =
            (
              s.variant as unknown as {
                product: { low_stock_threshold: number }
              }
            )?.product?.low_stock_threshold ?? 10
          return Number(s.qty_available) <= threshold
        }).length ?? 0

      return {
        todayOrders: todayOrders ?? 0,
        yesterdayOrders: yesterdayOrders ?? 0,
        todayRevenue,
        yesterdayRevenue,
        pendingShipments: pendingShipments ?? 0,
        lowStockCount,
      }
    },
    refetchInterval: 60000,
  })
}

// ---------------------------------------------------------------------------
// useRevenueChart
// ---------------------------------------------------------------------------

export interface RevenueChartPoint {
  date: string
  amazon: number
  shopify: number
  total: number
}

export function useRevenueChart(days: number = 30) {
  const supabase = createClient()

  return useQuery({
    queryKey: dashboardKeys.revenueChart(days),
    queryFn: async (): Promise<RevenueChartPoint[]> => {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const { data: orders } = await supabase
        .from('orders')
        .select(
          'total_amount, ordered_at, platform:platforms(name)'
        )
        .gte('ordered_at', startDate.toISOString())
        .not('ordered_at', 'is', null)
        .order('ordered_at', { ascending: true })

      // Group by date and platform
      const dailyMap = new Map<
        string,
        { amazon: number; shopify: number; total: number }
      >()

      // Pre-fill all dates
      for (let i = 0; i < days; i++) {
        const d = new Date()
        d.setDate(d.getDate() - (days - 1 - i))
        const key = d.toISOString().split('T')[0]
        dailyMap.set(key, { amazon: 0, shopify: 0, total: 0 })
      }

      for (const order of orders ?? []) {
        if (!order.ordered_at) continue
        const dateKey = new Date(order.ordered_at)
          .toISOString()
          .split('T')[0]
        const amount = Number(order.total_amount ?? 0)
        const platformName =
          (order.platform as unknown as { name: string })?.name ?? ''

        const entry = dailyMap.get(dateKey) ?? {
          amazon: 0,
          shopify: 0,
          total: 0,
        }

        if (platformName === 'amazon') {
          entry.amazon += amount
        } else if (platformName === 'shopify') {
          entry.shopify += amount
        }
        entry.total += amount

        dailyMap.set(dateKey, entry)
      }

      return Array.from(dailyMap.entries()).map(([date, values]) => ({
        date,
        ...values,
      }))
    },
  })
}

// ---------------------------------------------------------------------------
// usePlatformComparison
// ---------------------------------------------------------------------------

export interface PlatformComparisonData {
  metric: string
  amazon: number
  shopify: number
}

export function usePlatformComparison() {
  const supabase = createClient()

  return useQuery({
    queryKey: dashboardKeys.platformComparison(),
    queryFn: async (): Promise<PlatformComparisonData[]> => {
      const monthStart = new Date()
      monthStart.setDate(1)
      monthStart.setHours(0, 0, 0, 0)

      const { data: orders } = await supabase
        .from('orders')
        .select(
          'total_amount, status, platform:platforms(name)'
        )
        .gte('ordered_at', monthStart.toISOString())

      let amazonOrders = 0,
        shopifyOrders = 0,
        amazonRevenue = 0,
        shopifyRevenue = 0,
        amazonReturns = 0,
        shopifyReturns = 0

      for (const order of orders ?? []) {
        const platformName =
          (order.platform as unknown as { name: string })?.name ?? ''
        const amount = Number(order.total_amount ?? 0)
        const isReturn = order.status === 'returned' || order.status === 'refunded'

        if (platformName === 'amazon') {
          amazonOrders++
          amazonRevenue += amount
          if (isReturn) amazonReturns++
        } else if (platformName === 'shopify') {
          shopifyOrders++
          shopifyRevenue += amount
          if (isReturn) shopifyReturns++
        }
      }

      const amazonAOV = amazonOrders > 0 ? amazonRevenue / amazonOrders : 0
      const shopifyAOV = shopifyOrders > 0 ? shopifyRevenue / shopifyOrders : 0

      return [
        { metric: 'Orders', amazon: amazonOrders, shopify: shopifyOrders },
        { metric: 'Revenue', amazon: amazonRevenue, shopify: shopifyRevenue },
        { metric: 'Returns', amazon: amazonReturns, shopify: shopifyReturns },
        {
          metric: 'Avg Order Value',
          amazon: Math.round(amazonAOV),
          shopify: Math.round(shopifyAOV),
        },
      ]
    },
  })
}

// ---------------------------------------------------------------------------
// useInventoryAlerts
// ---------------------------------------------------------------------------

export interface InventoryAlert {
  id: string
  type: 'low_stock' | 'discrepancy'
  productName: string
  variantSku: string
  severity: 'critical' | 'warning' | 'minor'
  details: string
  warehouseName: string
  currentStock: number
}

export function useInventoryAlerts() {
  const supabase = createClient()

  return useQuery({
    queryKey: dashboardKeys.inventoryAlerts(),
    queryFn: async (): Promise<InventoryAlert[]> => {
      const alerts: InventoryAlert[] = []

      // Low stock items
      const { data: stockData } = await supabase
        .from('warehouse_stock')
        .select(
          '*, variant:product_variants(variant_sku, product:products(name, low_stock_threshold)), warehouse:warehouses(name)'
        )
        .order('qty_available', { ascending: true })
        .limit(50)

      for (const stock of stockData ?? []) {
        const variant = stock.variant as unknown as {
          variant_sku: string
          product: { name: string; low_stock_threshold: number }
        }
        const warehouse = stock.warehouse as unknown as { name: string }
        const threshold = variant?.product?.low_stock_threshold ?? 10
        const qty = Number(stock.qty_available ?? 0)

        if (qty <= threshold) {
          const severity: 'critical' | 'warning' | 'minor' =
            qty <= 0 ? 'critical' : qty <= threshold / 2 ? 'warning' : 'minor'

          alerts.push({
            id: stock.id,
            type: 'low_stock',
            productName: variant?.product?.name ?? 'Unknown',
            variantSku: variant?.variant_sku ?? '',
            severity,
            details: `${qty} in stock (threshold: ${threshold})`,
            warehouseName: warehouse?.name ?? '',
            currentStock: qty,
          })
        }
      }

      // Open discrepancies
      const { data: discrepancies } = await supabase
        .from('inventory_discrepancies')
        .select(
          '*, variant:product_variants(variant_sku, product:products(name)), warehouse:warehouses(name)'
        )
        .eq('status', 'open')
        .order('detected_at', { ascending: false })
        .limit(10)

      for (const disc of discrepancies ?? []) {
        const variant = disc.variant as unknown as {
          variant_sku: string
          product: { name: string }
        }
        const warehouse = disc.warehouse as unknown as { name: string }
        const diff = Number(disc.system_qty ?? 0) - Number(disc.physical_qty ?? 0)

        alerts.push({
          id: disc.id,
          type: 'discrepancy',
          productName: variant?.product?.name ?? 'Unknown',
          variantSku: variant?.variant_sku ?? '',
          severity:
            disc.severity === 'major'
              ? 'critical'
              : disc.severity === 'moderate'
                ? 'warning'
                : 'minor',
          details: `Difference of ${Math.abs(diff)} units (system: ${disc.system_qty}, physical: ${disc.physical_qty})`,
          warehouseName: warehouse?.name ?? '',
          currentStock: Number(disc.physical_qty ?? 0),
        })
      }

      // Sort by severity
      const severityOrder = { critical: 0, warning: 1, minor: 2 }
      alerts.sort(
        (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
      )

      return alerts.slice(0, 10)
    },
  })
}

// ---------------------------------------------------------------------------
// useSyncStatus
// ---------------------------------------------------------------------------

export interface SyncStatusInfo {
  platform: string
  lastSync: string | null
  status: string
  recordsProcessed: number
}

export function useSyncStatus() {
  const supabase = createClient()

  return useQuery({
    queryKey: dashboardKeys.syncStatus(),
    queryFn: async (): Promise<SyncStatusInfo[]> => {
      const { data } = await supabase
        .from('sync_logs')
        .select('*, platform_ref:platforms(name)')
        .order('started_at', { ascending: false })
        .limit(20)

      // Get latest sync per platform
      const platformMap = new Map<string, SyncStatusInfo>()

      for (const log of data ?? []) {
        const platformName =
          (log.platform_ref as unknown as { name: string })?.name ?? ''
        if (!platformName || platformMap.has(platformName)) continue

        platformMap.set(platformName, {
          platform: platformName,
          lastSync: log.completed_at ?? log.started_at,
          status: log.status,
          recordsProcessed: log.records_processed ?? 0,
        })
      }

      return Array.from(platformMap.values())
    },
    refetchInterval: 30000,
  })
}
