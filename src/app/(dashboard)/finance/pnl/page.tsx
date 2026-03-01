'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { PnlReport, type PnlData, type PnlLineItem } from '@/components/finance/pnl-report'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Download } from 'lucide-react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PeriodType = 'monthly' | 'quarterly'
type PlatformSplit = { shopify: number; amazon: number }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMonthOptions() {
  const months = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    })
  }
  return months
}

function getQuarterOptions() {
  const quarters = []
  const now = new Date()
  const currentQuarter = Math.floor(now.getMonth() / 3)
  for (let i = 0; i < 4; i++) {
    const q = currentQuarter - i
    const year = q < 0 ? now.getFullYear() - 1 : now.getFullYear()
    const adjustedQ = ((q % 4) + 4) % 4
    quarters.push({
      value: `${year}-Q${adjustedQ + 1}`,
      label: `Q${adjustedQ + 1} ${year} (${['Jan-Mar', 'Apr-Jun', 'Jul-Sep', 'Oct-Dec'][adjustedQ]})`,
    })
  }
  return quarters
}

function getPeriodDateRange(periodType: PeriodType, selectedPeriod: string) {
  if (periodType === 'monthly') {
    const [yearStr, monthStr] = selectedPeriod.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthStr) - 1
    return {
      startDate: new Date(year, month, 1),
      endDate: new Date(year, month + 1, 0, 23, 59, 59),
    }
  }
  // quarterly: "2026-Q1"
  const parts = selectedPeriod.split('-Q')
  const year = parseInt(parts[0])
  const qNum = parseInt(parts[1]) - 1
  return {
    startDate: new Date(year, qNum * 3, 1),
    endDate: new Date(year, qNum * 3 + 3, 0, 23, 59, 59),
  }
}

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
    expenses.platform_fees.shopify +
    expenses.shipping.shopify +
    expenses.packaging.shopify +
    expenses.marketing.shopify +
    expenses.other.shopify
  const totalOpexAmazon =
    expenses.platform_fees.amazon +
    expenses.shipping.amazon +
    expenses.packaging.amazon +
    expenses.marketing.amazon +
    expenses.other.amazon
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
    {
      label: 'Gross Revenue',
      isSubItem: true,
      shopify: revenue.shopify,
      amazon: revenue.amazon,
      total: revenue.shopify + revenue.amazon,
    },
    {
      label: 'Less: Discounts',
      isSubItem: true,
      shopify: -discounts.shopify,
      amazon: -discounts.amazon,
      total: -(discounts.shopify + discounts.amazon),
    },
    {
      label: 'Net Revenue',
      isBold: true,
      shopify: netRevShopify,
      amazon: netRevAmazon,
      total: netRevTotal,
    },
    { label: '', total: 0 },
    { label: 'Cost of Goods Sold', isHeader: true, total: 0 },
    {
      label: 'COGS',
      isSubItem: true,
      shopify: cogs.shopify,
      amazon: cogs.amazon,
      total: cogs.shopify + cogs.amazon,
    },
    { label: '', total: 0 },
    {
      label: 'Gross Profit',
      isTotal: true,
      shopify: grossProfitShopify,
      amazon: grossProfitAmazon,
      total: grossProfitTotal,
    },
    { label: '', total: 0 },
    { label: 'Operating Expenses', isHeader: true, total: 0 },
    {
      label: 'Platform Fees',
      isSubItem: true,
      shopify: expenses.platform_fees.shopify,
      amazon: expenses.platform_fees.amazon,
      total: expenses.platform_fees.shopify + expenses.platform_fees.amazon,
    },
    {
      label: 'Shipping',
      isSubItem: true,
      shopify: expenses.shipping.shopify,
      amazon: expenses.shipping.amazon,
      total: expenses.shipping.shopify + expenses.shipping.amazon,
    },
    {
      label: 'Packaging',
      isSubItem: true,
      shopify: expenses.packaging.shopify,
      amazon: expenses.packaging.amazon,
      total: expenses.packaging.shopify + expenses.packaging.amazon,
    },
    {
      label: 'Marketing',
      isSubItem: true,
      shopify: expenses.marketing.shopify,
      amazon: expenses.marketing.amazon,
      total: expenses.marketing.shopify + expenses.marketing.amazon,
    },
    {
      label: 'Other Expenses',
      isSubItem: true,
      shopify: expenses.other.shopify,
      amazon: expenses.other.amazon,
      total: expenses.other.shopify + expenses.other.amazon,
    },
    {
      label: 'Total Operating Expenses',
      isBold: true,
      shopify: totalOpexShopify,
      amazon: totalOpexAmazon,
      total: totalOpexTotal,
    },
    { label: '', total: 0 },
    {
      label: 'Net Profit',
      isTotal: true,
      shopify: netProfitShopify,
      amazon: netProfitAmazon,
      total: netProfitTotal,
    },
    { label: '', total: 0 },
    { label: 'Margins', isHeader: true, total: 0 },
    {
      label: 'Gross Margin %',
      isSubItem: true,
      isPercentage: true,
      shopify: grossMarginShopify,
      amazon: grossMarginAmazon,
      total: grossMarginTotal,
    },
    {
      label: 'Net Margin %',
      isSubItem: true,
      isPercentage: true,
      shopify: netMarginShopify,
      amazon: netMarginAmazon,
      total: netMarginTotal,
    },
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
        <Skeleton className="h-9 w-[160px]" />
        <Skeleton className="h-9 w-[200px]" />
        <Skeleton className="ml-auto h-9 w-[130px]" />
      </div>
      <Skeleton className="h-[600px] rounded-lg" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PnlPage() {
  const supabase = createClient()
  const [periodType, setPeriodType] = useState<PeriodType>('monthly')
  const monthOptions = useMemo(() => getMonthOptions(), [])
  const quarterOptions = useMemo(() => getQuarterOptions(), [])
  const [selectedPeriod, setSelectedPeriod] = useState(
    monthOptions[0]?.value ?? ''
  )

  const { data: rawData, isLoading, isError, error } = useQuery({
    queryKey: ['finance', 'pnl', periodType, selectedPeriod],
    queryFn: async () => {
      const { startDate, endDate } = getPeriodDateRange(periodType, selectedPeriod)
      const startIso = startDate.toISOString()
      const endIso = endDate.toISOString()

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

  const pnlData: PnlData = useMemo(() => {
    const periodLabel =
      periodType === 'monthly'
        ? monthOptions.find((m) => m.value === selectedPeriod)?.label ?? selectedPeriod
        : quarterOptions.find((q) => q.value === selectedPeriod)?.label ?? selectedPeriod

    const zero: PlatformSplit = { shopify: 0, amazon: 0 }

    if (!rawData?.platforms || rawData.platforms.length === 0) {
      return {
        period: periodLabel,
        lines: buildPnlLines(
          { ...zero }, { ...zero }, { ...zero },
          { platform_fees: { ...zero }, shipping: { ...zero }, packaging: { ...zero }, marketing: { ...zero }, other: { ...zero } }
        ),
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

    // Aggregate revenue by platform
    const rev: PlatformSplit = { shopify: 0, amazon: 0 }
    const disc: PlatformSplit = { shopify: 0, amazon: 0 }
    for (const r of rawData.revenue) {
      const p = toPlatform(r.platform_id)
      if (p) {
        rev[p] += Number(r.gross_revenue)
        disc[p] += Number(r.discount)
      }
    }

    // Aggregate COGS (no platform_id — split proportionally by revenue)
    const totalCogs = rawData.cogs.reduce((sum: number, c: any) => sum + Number(c.total_cost), 0)
    const totalRev = rev.shopify + rev.amazon
    const cogsRatio = totalRev > 0 ? rev.amazon / totalRev : 0.5
    const cogs: PlatformSplit = {
      shopify: Math.round(totalCogs * (1 - cogsRatio)),
      amazon: Math.round(totalCogs * cogsRatio),
    }

    // Aggregate platform fees
    const platformFees: PlatformSplit = { shopify: 0, amazon: 0 }
    for (const f of rawData.fees) {
      const p = toPlatform(f.platform_id)
      if (p) platformFees[p] += Number(f.amount)
    }

    // Aggregate expenses by category (no platform_id — split proportionally)
    const expByCat: Record<string, PlatformSplit> = {
      shipping: { shopify: 0, amazon: 0 },
      packaging: { shopify: 0, amazon: 0 },
      marketing: { shopify: 0, amazon: 0 },
      other: { shopify: 0, amazon: 0 },
    }
    for (const e of rawData.expenses) {
      const cat = ['shipping', 'packaging', 'marketing'].includes((e as any).category) ? (e as any).category : 'other'
      const amt = Number((e as any).amount)
      // Split proportionally by revenue
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
  }, [rawData, periodType, selectedPeriod, monthOptions, quarterOptions])

  if (isLoading) {
    return <PnlSkeleton />
  }

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
          <h1 className="text-2xl font-bold tracking-tight">Profit & Loss</h1>
        </div>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load P&L data: {(error as Error).message}
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
          <h1 className="text-2xl font-bold tracking-tight">Profit & Loss Report</h1>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={periodType}
            onValueChange={(v) => {
              setPeriodType(v as PeriodType)
              if (v === 'monthly') {
                setSelectedPeriod(monthOptions[0]?.value ?? '')
              } else {
                setSelectedPeriod(quarterOptions[0]?.value ?? '')
              }
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(periodType === 'monthly' ? monthOptions : quarterOptions).map(
                (opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => exportToCsv(pnlData)}
          >
            <Download className="mr-2 size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* P&L Report */}
      <PnlReport data={pnlData} showPlatformColumns />
    </div>
  )
}
