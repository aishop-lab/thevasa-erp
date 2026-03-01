'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { GstSummary, type GstHsnRow } from '@/components/finance/gst-summary'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import { ArrowLeft, Download, ArrowRight, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'

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

function exportGstCsv(data: GstHsnRow[], month: string) {
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
  a.download = `gst-report-${month}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success('GST report exported')
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function GstSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-4">
        <Skeleton className="h-9 w-[220px]" />
        <Skeleton className="ml-auto h-9 w-[130px]" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
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
  const monthOptions = useMemo(() => getMonthOptions(), [])
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value ?? '')

  const { data: gstData, isLoading, isError, error } = useQuery({
    queryKey: ['finance', 'gst', selectedMonth],
    queryFn: async () => {
      // Parse selected month for date range
      const [yearStr, monthStr] = selectedMonth.split('-')
      const year = parseInt(yearStr)
      const month = parseInt(monthStr) - 1
      const startDate = new Date(year, month, 1)
      const endDate = new Date(year, month + 1, 0, 23, 59, 59)

      // Query real GST transactions
      const { data, error } = await supabase
        .from('gst_transactions')
        .select('hsn_code, taxable_amount, cgst_amount, sgst_amount, igst_amount, transaction_type')
        .gte('date', startDate.toISOString())
        .lte('date', endDate.toISOString())
        .eq('transaction_type', 'output')

      if (error) throw error

      if (!data || data.length === 0) return []

      // Aggregate by HSN code
      const hsnMap = new Map<string, {
        hsn_code: string
        taxable_amount: number
        cgst: number
        sgst: number
        igst: number
        total_tax: number
      }>()

      for (const txn of data) {
        const hsn = txn.hsn_code ?? 'UNCLASSIFIED'
        const existing = hsnMap.get(hsn) ?? {
          hsn_code: hsn,
          taxable_amount: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          total_tax: 0,
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

  // Compute summary totals
  const summary = useMemo(() => {
    if (!gstData || gstData.length === 0) return { outputTax: 0, inputTax: 0, netLiability: 0 }

    const outputTax = gstData.reduce((sum: number, r: GstHsnRow) => sum + r.total_tax, 0)
    // Input tax would come from purchase GST transactions - query separately if needed
    const inputTax = 0
    const netLiability = outputTax - inputTax

    return { outputTax, inputTax, netLiability }
  }, [gstData])

  if (isLoading) {
    return <GstSkeleton />
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
          <h1 className="text-2xl font-bold tracking-tight">GST Reports</h1>
        </div>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load GST data: {(error as Error).message}
          </p>
        </div>
      </div>
    )
  }

  const hasData = gstData && gstData.length > 0

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
          <h1 className="text-2xl font-bold tracking-tight">GST Reports</h1>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasData && (
            <Button
              variant="outline"
              onClick={() => gstData && exportGstCsv(gstData, selectedMonth)}
            >
              <Download className="mr-2 size-4" />
              Export
            </Button>
          )}
        </div>
      </div>

      {!hasData ? (
        /* Empty State */
        <Card className="py-16">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <FileSpreadsheet className="mb-4 size-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-semibold">No GST data for this period</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              GST transactions will appear here as orders are processed with HSN codes
              and tax breakdowns. Run a sync and ensure products have GST rates configured.
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
                    {formatCurrency(summary.outputTax)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="py-5">
              <CardContent className="pt-0">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Input Tax Credit</p>
                  <p className="text-2xl font-bold tabular-nums text-green-600">
                    {formatCurrency(summary.inputTax)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="py-5">
              <CardContent className="pt-0">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Net GST Liability</p>
                  <p
                    className={cn(
                      'text-2xl font-bold tabular-nums',
                      summary.netLiability >= 0 ? 'text-red-600' : 'text-green-600'
                    )}
                  >
                    {formatCurrency(summary.netLiability)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Output vs Input Comparison */}
          <Card>
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-8 py-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Output Tax</p>
                  <p className="text-xl font-bold tabular-nums text-red-600">
                    {formatCurrency(summary.outputTax)}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <ArrowRight className="size-6 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">minus</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Input Tax Credit</p>
                  <p className="text-xl font-bold tabular-nums text-green-600">
                    {formatCurrency(summary.inputTax)}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xl font-bold text-muted-foreground">=</span>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Net Liability</p>
                  <p
                    className={cn(
                      'text-xl font-bold tabular-nums',
                      summary.netLiability >= 0 ? 'text-red-600' : 'text-green-600'
                    )}
                  >
                    {formatCurrency(summary.netLiability)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* GSTR-1 HSN Summary */}
          <GstSummary data={gstData ?? []} title="GSTR-1 Summary - HSN Wise" />
        </>
      )}
    </div>
  )
}
