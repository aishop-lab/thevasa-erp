'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { GstSummary, type GstHsnRow } from '@/components/finance/gst-summary'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DateRangePicker,
  useDateRangeState,
} from '@/components/finance/date-range-picker'
import { StatCard } from '@/components/finance/stat-card'
import { ComparisonChart } from '@/components/finance/comparison-chart'
import { useTaxOverview } from '@/hooks/use-finance'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { ArrowLeft, Download, FileSpreadsheet, ArrowRight, Receipt, Calculator, IndianRupee } from 'lucide-react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLATFORM_COLORS: Record<string, string> = {
  Shopify: '#3b82f6',
  Amazon: '#f97316',
  Other: '#8b5cf6',
}

function exportGstCsv(data: GstHsnRow[], label: string) {
  const header = 'HSN Code,Description,Taxable Amount,CGST,SGST,IGST,Total Tax\n'
  const rows = data
    .map(
      (r) =>
        `"${r.hsn_code}","${r.description}",${r.taxable_amount},${r.cgst},${r.sgst},${r.igst},${r.total_tax}`
    )
    .join('\n')

  const csv = header + rows
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `gst-report-${label}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('GST report exported')
}

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

function GstSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-4">
        <Skeleton className="h-10 w-[240px]" />
        <Skeleton className="ml-auto h-9 w-[130px]" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function GstPage() {
  const supabase = createClient()
  const [dateRange, setDateRange] = useDateRangeState('this_month')
  const [tab, setTab] = useState('derived')

  // Tax overview from sales_revenue
  const { data: taxOverview } = useTaxOverview(
    dateRange.from,
    dateRange.to,
    dateRange.granularity,
    dateRange.compareFrom,
    dateRange.compareTo
  )

  // Traditional GST from gst_transactions
  const { data: gstData, isLoading, isError, error } = useQuery({
    queryKey: ['finance', 'gst', dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gst_transactions')
        .select('hsn_code, taxable_amount, cgst_amount, sgst_amount, igst_amount, transaction_type')
        .gte('date', dateRange.from.toISOString())
        .lte('date', dateRange.to.toISOString())
        .eq('transaction_type', 'output')

      if (error) throw error

      if (!data || data.length === 0) return []

      const hsnMap = new Map<string, {
        hsn_code: string; taxable_amount: number; cgst: number; sgst: number; igst: number; total_tax: number
      }>()

      for (const txn of data) {
        const hsn = txn.hsn_code ?? 'UNCLASSIFIED'
        const existing = hsnMap.get(hsn) ?? {
          hsn_code: hsn, taxable_amount: 0, cgst: 0, sgst: 0, igst: 0, total_tax: 0,
        }
        existing.taxable_amount += Number(txn.taxable_amount)
        existing.cgst += Number(txn.cgst_amount)
        existing.sgst += Number(txn.sgst_amount)
        existing.igst += Number(txn.igst_amount)
        existing.total_tax += Number(txn.cgst_amount) + Number(txn.sgst_amount) + Number(txn.igst_amount)
        hsnMap.set(hsn, existing)
      }

      return Array.from(hsnMap.values()).map((row) => ({
        hsn_code: row.hsn_code,
        description: '',
        taxable_amount: row.taxable_amount,
        cgst: row.cgst,
        sgst: row.sgst,
        igst: row.igst,
        total_tax: row.total_tax,
      })) as GstHsnRow[]
    },
  })

  const gstSummary = useMemo(() => {
    if (!gstData || gstData.length === 0) return { outputTax: 0, inputTax: 0, netLiability: 0 }
    const outputTax = gstData.reduce((sum: number, r: GstHsnRow) => sum + r.total_tax, 0)
    return { outputTax, inputTax: 0, netLiability: outputTax }
  }, [gstData])

  // Trend chart data
  const trendData = useMemo(() => {
    if (!taxOverview?.trendData) return []
    return taxOverview.trendData.map((t) => ({
      label: t.label,
      value: t.tax,
    }))
  }, [taxOverview?.trendData])

  // Platform bar chart data
  const platformBarData = useMemo(() => {
    if (!taxOverview?.byPlatform) return []
    return taxOverview.byPlatform.map((p) => ({
      platform: p.platform,
      tax: p.tax,
      fill: PLATFORM_COLORS[p.platform] ?? '#6b7280',
    }))
  }, [taxOverview?.byPlatform])

  const hasGstData = gstData && gstData.length > 0

  if (isLoading) return <GstSkeleton />

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Finance
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">GST Reports</h1>
        </div>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">Failed to load GST data: {(error as Error).message}</p>
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
          <h1 className="text-2xl font-bold tracking-tight">GST Reports</h1>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          {hasGstData && (
            <Button variant="outline" onClick={() => gstData && exportGstCsv(gstData, 'period')}>
              <Download className="mr-2 size-4" /> Export
            </Button>
          )}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Tax Collected (Sales Revenue)"
          value={formatCompactCurrency(taxOverview?.totalTaxCollected ?? 0)}
          icon={Receipt}
          iconColor="text-red-600"
          iconBg="bg-red-50 dark:bg-red-950"
          changePercent={taxOverview?.taxChange}
        />
        <StatCard
          title="GST Output Tax"
          value={formatCurrency(gstSummary.outputTax)}
          icon={Calculator}
          iconColor="text-amber-600"
          iconBg="bg-amber-50 dark:bg-amber-950"
        />
        <StatCard
          title="Net GST Liability"
          value={formatCurrency(gstSummary.netLiability)}
          icon={IndianRupee}
          iconColor="text-purple-600"
          iconBg="bg-purple-50 dark:bg-purple-950"
        />
      </div>

      {/* Tabs: Derived Tax View vs GSTR-1 */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="derived">Sales Tax Overview</TabsTrigger>
          <TabsTrigger value="gstr1">GSTR-1 (HSN)</TabsTrigger>
        </TabsList>

        <TabsContent value="derived" className="space-y-6 mt-4">
          {/* Tax Trend + Platform Breakdown */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ComparisonChart
              title="Tax Collection Trend"
              description="Tax collected from sales revenue"
              data={trendData}
              type="area"
              color="#8b5cf6"
            />

            <Card>
              <CardHeader>
                <CardTitle>Tax by Platform</CardTitle>
                <CardDescription>Tax collected per platform</CardDescription>
              </CardHeader>
              <CardContent>
                {platformBarData.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                    No tax data
                  </div>
                ) : (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={platformBarData}
                        margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                        <XAxis
                          dataKey="platform"
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          axisLine={false}
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
                        <Bar dataKey="tax" name="Tax" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Output vs Input Comparison */}
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-8 py-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Tax Collected (Sales)</p>
                  <p className="text-xl font-bold tabular-nums text-red-600">
                    {formatCurrency(taxOverview?.totalTaxCollected ?? 0)}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <ArrowRight className="size-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">minus</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Input Tax Credit</p>
                  <p className="text-xl font-bold tabular-nums text-green-600">
                    {formatCurrency(0)}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl font-bold text-muted-foreground">=</span>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Net Liability</p>
                  <p className="text-xl font-bold tabular-nums text-red-600">
                    {formatCurrency(taxOverview?.totalTaxCollected ?? 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gstr1" className="space-y-6 mt-4">
          {!hasGstData ? (
            <Card className="py-16">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <FileSpreadsheet className="mb-4 size-12 text-muted-foreground/50" />
                <h3 className="mb-2 text-lg font-semibold">No GST transaction data for this period</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  GST transactions will appear here as orders are processed with HSN codes
                  and tax breakdowns. Check the &quot;Sales Tax Overview&quot; tab for tax data
                  derived from sales revenue.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Tax Summary Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="py-5">
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Output Tax (Sales)</p>
                      <p className="text-2xl font-bold tabular-nums text-red-600">
                        {formatCurrency(gstSummary.outputTax)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="py-5">
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Input Tax Credit</p>
                      <p className="text-2xl font-bold tabular-nums text-green-600">
                        {formatCurrency(gstSummary.inputTax)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="py-5">
                  <CardContent className="pt-0">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Net GST Liability</p>
                      <p className={cn('text-2xl font-bold tabular-nums', gstSummary.netLiability >= 0 ? 'text-red-600' : 'text-green-600')}>
                        {formatCurrency(gstSummary.netLiability)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <GstSummary data={gstData ?? []} title="GSTR-1 Summary - HSN Wise" />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
