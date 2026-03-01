'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { PnlReport, type PnlData, type PnlLineItem } from '@/components/finance/pnl-report'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DateRangePicker,
  useDateRangeState,
} from '@/components/finance/date-range-picker'
import { WaterfallChart } from '@/components/finance/waterfall-chart'
import { ComparisonChart } from '@/components/finance/comparison-chart'
import { usePnlData } from '@/hooks/use-finance'
import {
  bucketDates,
  dateToBucketKey,
  formatBucketLabel,
  formatDateRange,
} from '@/lib/utils/date'
import { ArrowLeft, Download } from 'lucide-react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlatformSplit = { shopify: number; amazon: number }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPnlLines(
  revenue: PlatformSplit,
  discounts: PlatformSplit,
  cogs: PlatformSplit,
  expenses: {
    platform_fees: PlatformSplit
    shipping: PlatformSplit
    packaging: PlatformSplit
    marketing: PlatformSplit
    other: PlatformSplit
  }
): PnlLineItem[] {
  const netRevShopify = revenue.shopify - discounts.shopify
  const netRevAmazon = revenue.amazon - discounts.amazon
  const netRevTotal = netRevShopify + netRevAmazon

  const grossProfitShopify = netRevShopify - cogs.shopify
  const grossProfitAmazon = netRevAmazon - cogs.amazon
  const grossProfitTotal = grossProfitShopify + grossProfitAmazon

  const totalOpexShopify =
    expenses.platform_fees.shopify + expenses.shipping.shopify +
    expenses.packaging.shopify + expenses.marketing.shopify + expenses.other.shopify
  const totalOpexAmazon =
    expenses.platform_fees.amazon + expenses.shipping.amazon +
    expenses.packaging.amazon + expenses.marketing.amazon + expenses.other.amazon
  const totalOpexTotal = totalOpexShopify + totalOpexAmazon

  const netProfitShopify = grossProfitShopify - totalOpexShopify
  const netProfitAmazon = grossProfitAmazon - totalOpexAmazon
  const netProfitTotal = grossProfitShopify + grossProfitAmazon - totalOpexTotal

  const grossMarginShopify = netRevShopify > 0 ? (grossProfitShopify / netRevShopify) * 100 : 0
  const grossMarginAmazon = netRevAmazon > 0 ? (grossProfitAmazon / netRevAmazon) * 100 : 0
  const grossMarginTotal = netRevTotal > 0 ? (grossProfitTotal / netRevTotal) * 100 : 0

  const netMarginShopify = netRevShopify > 0 ? (netProfitShopify / netRevShopify) * 100 : 0
  const netMarginAmazon = netRevAmazon > 0 ? (netProfitAmazon / netRevAmazon) * 100 : 0
  const netMarginTotal = netRevTotal > 0 ? (netProfitTotal / netRevTotal) * 100 : 0

  return [
    { label: 'Revenue', isHeader: true, total: 0 },
    { label: 'Gross Revenue', isSubItem: true, shopify: revenue.shopify, amazon: revenue.amazon, total: revenue.shopify + revenue.amazon },
    { label: 'Less: Discounts', isSubItem: true, shopify: -discounts.shopify, amazon: -discounts.amazon, total: -(discounts.shopify + discounts.amazon) },
    { label: 'Net Revenue', isBold: true, shopify: netRevShopify, amazon: netRevAmazon, total: netRevTotal },
    { label: '', total: 0 },
    { label: 'Cost of Goods Sold', isHeader: true, total: 0 },
    { label: 'COGS', isSubItem: true, shopify: cogs.shopify, amazon: cogs.amazon, total: cogs.shopify + cogs.amazon },
    { label: '', total: 0 },
    { label: 'Gross Profit', isTotal: true, shopify: grossProfitShopify, amazon: grossProfitAmazon, total: grossProfitTotal },
    { label: '', total: 0 },
    { label: 'Operating Expenses', isHeader: true, total: 0 },
    { label: 'Platform Fees', isSubItem: true, shopify: expenses.platform_fees.shopify, amazon: expenses.platform_fees.amazon, total: expenses.platform_fees.shopify + expenses.platform_fees.amazon },
    { label: 'Shipping', isSubItem: true, shopify: expenses.shipping.shopify, amazon: expenses.shipping.amazon, total: expenses.shipping.shopify + expenses.shipping.amazon },
    { label: 'Packaging', isSubItem: true, shopify: expenses.packaging.shopify, amazon: expenses.packaging.amazon, total: expenses.packaging.shopify + expenses.packaging.amazon },
    { label: 'Marketing', isSubItem: true, shopify: expenses.marketing.shopify, amazon: expenses.marketing.amazon, total: expenses.marketing.shopify + expenses.marketing.amazon },
    { label: 'Other Expenses', isSubItem: true, shopify: expenses.other.shopify, amazon: expenses.other.amazon, total: expenses.other.shopify + expenses.other.amazon },
    { label: 'Total Operating Expenses', isBold: true, shopify: totalOpexShopify, amazon: totalOpexAmazon, total: totalOpexTotal },
    { label: '', total: 0 },
    { label: 'Net Profit', isTotal: true, shopify: netProfitShopify, amazon: netProfitAmazon, total: netProfitTotal },
    { label: '', total: 0 },
    { label: 'Margins', isHeader: true, total: 0 },
    { label: 'Gross Margin %', isSubItem: true, isPercentage: true, shopify: grossMarginShopify, amazon: grossMarginAmazon, total: grossMarginTotal },
    { label: 'Net Margin %', isSubItem: true, isPercentage: true, shopify: netMarginShopify, amazon: netMarginAmazon, total: netMarginTotal },
  ]
}

function exportToCsv(data: PnlData) {
  const header = 'Particulars,Shopify,Amazon,Total\n'
  const rows = data.lines
    .filter((l) => l.label)
    .map((l) => {
      const shopify = l.isHeader ? '' : l.isPercentage ? `${l.shopify?.toFixed(1)}%` : (l.shopify ?? 0).toString()
      const amazon = l.isHeader ? '' : l.isPercentage ? `${l.amazon?.toFixed(1)}%` : (l.amazon ?? 0).toString()
      const total = l.isHeader ? '' : l.isPercentage ? `${l.total.toFixed(1)}%` : l.total.toString()
      return `"${l.label}",${shopify},${amazon},${total}`
    })
    .join('\n')

  const csv = header + rows
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pnl-report-${data.period}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('P&L report exported')
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function PnlSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-4">
        <Skeleton className="h-10 w-[240px]" />
        <Skeleton className="ml-auto h-9 w-[130px]" />
      </div>
      <Skeleton className="h-[350px] rounded-lg" />
      <Skeleton className="h-[600px] rounded-lg" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PnlPage() {
  const supabase = createClient()
  const [dateRange, setDateRange] = useDateRangeState('this_month')

  // Summary P&L data from hook
  const { data: pnlSummary } = usePnlData(dateRange.from, dateRange.to)

  // Full P&L data with platform breakdown for the table
  const { data: rawData, isLoading, isError, error } = useQuery({
    queryKey: ['finance', 'pnl-full', dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const startIso = dateRange.from.toISOString()
      const endIso = dateRange.to.toISOString()

      const [revenueRes, expensesRes, feesRes, cogsRes, platformsRes] = await Promise.all([
        supabase
          .from('sales_revenue')
          .select('gross_revenue, discount, net_revenue, platform_id')
          .gte('date', startIso)
          .lte('date', endIso),
        supabase
          .from('expenses')
          .select('amount, category')
          .gte('date', startIso)
          .lte('date', endIso),
        supabase
          .from('platform_fees')
          .select('amount, fee_type, platform_id')
          .gte('created_at', startIso)
          .lte('created_at', endIso),
        supabase
          .from('cogs_records')
          .select('total_cost')
          .gte('date', startIso)
          .lte('date', endIso),
        supabase.from('platforms').select('id, name'),
      ])

      return {
        revenue: revenueRes.data ?? [],
        expenses: expensesRes.data ?? [],
        fees: feesRes.data ?? [],
        cogs: cogsRes.data ?? [],
        platforms: platformsRes.data ?? [],
      }
    },
  })

  // Monthly margin trend
  const { data: marginTrend } = useQuery({
    queryKey: ['finance', 'pnl-margin-trend', dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const granularity = 'monthly' as const
      const buckets = bucketDates(dateRange.from, dateRange.to, granularity)

      const [revRes, expRes, feesRes] = await Promise.all([
        supabase
          .from('sales_revenue')
          .select('date, net_revenue')
          .gte('date', dateRange.from.toISOString())
          .lte('date', dateRange.to.toISOString()),
        supabase
          .from('expenses')
          .select('date, amount')
          .gte('date', dateRange.from.toISOString())
          .lte('date', dateRange.to.toISOString()),
        supabase
          .from('platform_fees')
          .select('date, amount')
          .gte('date', dateRange.from.toISOString())
          .lte('date', dateRange.to.toISOString()),
      ])

      const revMap = new Map<string, number>()
      for (const r of revRes.data ?? []) {
        const key = dateToBucketKey(new Date(r.date), granularity)
        revMap.set(key, (revMap.get(key) ?? 0) + Number(r.net_revenue ?? 0))
      }

      const expMap = new Map<string, number>()
      for (const e of expRes.data ?? []) {
        const key = dateToBucketKey(new Date((e as any).date), granularity)
        expMap.set(key, (expMap.get(key) ?? 0) + Number((e as any).amount ?? 0))
      }
      for (const f of feesRes.data ?? []) {
        const key = dateToBucketKey(new Date((f as any).date), granularity)
        expMap.set(key, (expMap.get(key) ?? 0) + Number((f as any).amount ?? 0))
      }

      return buckets.map((b) => {
        const key = dateToBucketKey(b, granularity)
        const rev = revMap.get(key) ?? 0
        const exp = expMap.get(key) ?? 0
        const profit = rev - exp
        return {
          label: formatBucketLabel(b, granularity),
          value: rev > 0 ? (profit / rev) * 100 : 0,
        }
      })
    },
  })

  const pnlData: PnlData = useMemo(() => {
    const periodLabel = formatDateRange(dateRange.from, dateRange.to)
    const zero: PlatformSplit = { shopify: 0, amazon: 0 }

    if (!rawData?.platforms || rawData.platforms.length === 0) {
      return {
        period: periodLabel,
        lines: buildPnlLines({ ...zero }, { ...zero }, { ...zero }, {
          platform_fees: { ...zero }, shipping: { ...zero }, packaging: { ...zero },
          marketing: { ...zero }, other: { ...zero },
        }),
      }
    }

    const platformIdToName = new Map<string, string>(
      rawData.platforms.map((p: any) => [p.id, (p.name as string).toLowerCase()])
    )

    function toPlatform(platformId: string | null): 'shopify' | 'amazon' | null {
      if (!platformId) return null
      const name = platformIdToName.get(platformId)
      if (name === 'shopify' || name === 'amazon') return name
      return null
    }

    const rev: PlatformSplit = { shopify: 0, amazon: 0 }
    const disc: PlatformSplit = { shopify: 0, amazon: 0 }
    for (const r of rawData.revenue) {
      const p = toPlatform(r.platform_id)
      if (p) {
        rev[p] += Number(r.gross_revenue)
        disc[p] += Number(r.discount)
      }
    }

    const totalCogs = rawData.cogs.reduce((sum: number, c: any) => sum + Number(c.total_cost), 0)
    const totalRev = rev.shopify + rev.amazon
    const cogsRatio = totalRev > 0 ? rev.amazon / totalRev : 0.5
    const cogs: PlatformSplit = {
      shopify: Math.round(totalCogs * (1 - cogsRatio)),
      amazon: Math.round(totalCogs * cogsRatio),
    }

    const platformFees: PlatformSplit = { shopify: 0, amazon: 0 }
    for (const f of rawData.fees) {
      const p = toPlatform(f.platform_id)
      if (p) platformFees[p] += Number(f.amount)
    }

    const expByCat: Record<string, PlatformSplit> = {
      shipping: { shopify: 0, amazon: 0 },
      packaging: { shopify: 0, amazon: 0 },
      marketing: { shopify: 0, amazon: 0 },
      other: { shopify: 0, amazon: 0 },
    }
    for (const e of rawData.expenses) {
      const cat = ['shipping', 'packaging', 'marketing'].includes((e as any).category) ? (e as any).category : 'other'
      const amt = Number((e as any).amount)
      expByCat[cat].shopify += Math.round(amt * (1 - cogsRatio))
      expByCat[cat].amazon += Math.round(amt * cogsRatio)
    }

    return {
      period: periodLabel,
      lines: buildPnlLines(rev, disc, cogs, {
        platform_fees: platformFees,
        shipping: expByCat.shipping,
        packaging: expByCat.packaging,
        marketing: expByCat.marketing,
        other: expByCat.other,
      }),
    }
  }, [rawData, dateRange.from, dateRange.to])

  // Waterfall items
  const waterfallItems = useMemo(() => {
    if (!pnlSummary) return []
    return [
      { label: 'Gross Rev', value: pnlSummary.grossRevenue, type: 'positive' as const },
      { label: 'Discounts', value: -pnlSummary.discounts, type: 'negative' as const },
      { label: 'COGS', value: -pnlSummary.cogs, type: 'negative' as const },
      { label: 'Platform Fees', value: -pnlSummary.platformFees, type: 'negative' as const },
      { label: 'OpEx', value: -pnlSummary.operatingExpenses, type: 'negative' as const },
      { label: 'Net Profit', value: pnlSummary.netProfit, type: 'total' as const },
    ]
  }, [pnlSummary])

  if (isLoading) return <PnlSkeleton />

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Finance
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Profit & Loss</h1>
        </div>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">Failed to load P&L data: {(error as Error).message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Finance
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Profit & Loss Report</h1>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button variant="outline" onClick={() => exportToCsv(pnlData)}>
            <Download className="mr-2 size-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Waterfall Chart */}
      <WaterfallChart items={waterfallItems} />

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Margin Trend */}
        <ComparisonChart
          title="Net Margin Trend"
          description="Net margin % over time"
          data={(marginTrend ?? []).map((p) => ({ label: p.label, value: p.value }))}
          type="line"
          color="#8b5cf6"
          valueFormatter={(v) => `${v.toFixed(1)}%`}
        />

        {/* P&L Summary Card */}
        <WaterfallChart
          items={[
            { label: 'Net Revenue', value: pnlSummary?.netRevenue ?? 0, type: 'positive' },
            { label: 'COGS', value: -(pnlSummary?.cogs ?? 0), type: 'negative' },
            { label: 'Gross Profit', value: pnlSummary?.grossProfit ?? 0, type: 'total' },
          ]}
          title="Gross Profit Breakdown"
          description="Revenue to gross profit"
          height={280}
        />
      </div>

      {/* P&L Report Table */}
      <PnlReport data={pnlData} showPlatformColumns />
    </div>
  )
}
