'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ShoppingBag,
  Store,
  Landmark,
} from 'lucide-react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettlementTransaction {
  id: string
  order_number: string
  type: 'sale' | 'refund' | 'adjustment'
  amount: number
  fee: number
  net_amount: number
  status: 'matched' | 'unmatched' | 'discrepant'
}

interface Settlement {
  id: string
  platform: 'amazon_fba' | 'shopify'
  cycle_start: string
  cycle_end: string
  total_sales: number
  total_fees: number
  total_refunds: number
  net_amount: number
  payout_amount: number | null
  payout_date: string | null
  expected_payout_date: string
  status: 'pending' | 'processing' | 'paid' | 'discrepancy'
  order_count: number
  transactions: SettlementTransaction[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusConfig = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  },
  processing: {
    label: 'Processing',
    icon: Clock,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  },
  paid: {
    label: 'Paid',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  },
  discrepancy: {
    label: 'Discrepancy',
    icon: AlertTriangle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  },
}

const txnStatusColors: Record<string, string> = {
  matched: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  unmatched: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  discrepant: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const platformConfig = {
  amazon_fba: { label: 'Amazon FBA', icon: ShoppingBag, color: 'text-orange-600' },
  amazon: { label: 'Amazon', icon: ShoppingBag, color: 'text-orange-600' },
  shopify: { label: 'Shopify', icon: Store, color: 'text-green-600' },
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  return `${s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${e.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function formatShortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function exportSettlementsCsv(data: Settlement[]) {
  const header =
    'ID,Platform,Period,Orders,Sales,Fees,Refunds,Net Amount,Payout,Status\n'
  const rows = data
    .map(
      (s) => {
        const pCfg = platformConfig[s.platform] ?? { label: s.platform }
        return `"${s.id}","${pCfg.label}","${formatDateRange(s.cycle_start, s.cycle_end)}",${s.order_count},${s.total_sales},${s.total_fees},${s.total_refunds},${s.net_amount},${s.payout_amount ?? ''},${s.status}`
      }
    )
    .join('\n')

  const csv = header + rows
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'settlements-report.csv'
  a.click()
  URL.revokeObjectURL(url)
  toast.success('Settlements exported')
}

// ---------------------------------------------------------------------------
// Transaction Sub-table
// ---------------------------------------------------------------------------

function TransactionDetails({ transactions }: { transactions: SettlementTransaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="bg-muted/30 p-4 text-center text-sm text-muted-foreground">
        No transactions for this cycle
      </div>
    )
  }

  return (
    <div className="bg-muted/30 p-4">
      <h4 className="mb-3 text-sm font-semibold">Settlement Transactions</h4>
      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((txn) => (
              <TableRow
                key={txn.id}
                className={cn(
                  txn.status === 'discrepant' && 'bg-red-50/60 dark:bg-red-950/20',
                  txn.status === 'unmatched' && 'bg-yellow-50/60 dark:bg-yellow-950/20'
                )}
              >
                <TableCell className="font-mono text-sm">{txn.order_number}</TableCell>
                <TableCell className="text-sm capitalize">{txn.type}</TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums text-sm',
                    txn.amount < 0 && 'text-red-600'
                  )}
                >
                  {formatCurrency(txn.amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {txn.fee > 0 ? formatCurrency(txn.fee) : '-'}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums text-sm font-medium',
                    txn.net_amount < 0 && 'text-red-600'
                  )}
                >
                  {formatCurrency(txn.net_amount)}
                </TableCell>
                <TableCell>
                  <Badge className={cn('border-0 capitalize', txnStatusColors[txn.status])}>
                    {txn.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SettlementsPage() {
  const supabase = createClient()
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  const { data: settlements, isLoading } = useQuery({
    queryKey: ['finance', 'settlements'],
    queryFn: async () => {
      // Fetch platforms for name mapping
      const { data: platforms } = await supabase
        .from('platforms')
        .select('id, name')

      const platformIdToName = new Map<string, string>(
        (platforms ?? []).map((p: any) => [p.id, (p.name as string).toLowerCase()])
      )

      // Fetch real settlement cycles
      const { data: cycles, error } = await supabase
        .from('settlement_cycles')
        .select('*')
        .order('period_end', { ascending: false })

      if (error) throw error
      if (!cycles || cycles.length === 0) return []

      // Fetch transactions for all cycles
      const cycleIds = cycles.map((c: any) => c.id)
      const { data: transactions } = await supabase
        .from('settlement_transactions')
        .select('*')
        .in('settlement_id', cycleIds)

      const txnsByCycle = new Map<string, SettlementTransaction[]>()
      for (const txn of transactions ?? []) {
        const settId = (txn as any).settlement_id as string
        if (!txnsByCycle.has(settId)) txnsByCycle.set(settId, [])
        txnsByCycle.get(settId)!.push({
          id: txn.id,
          order_number: txn.order_id ?? '-',
          type: (txn.transaction_type as 'sale' | 'refund' | 'adjustment') ?? 'sale',
          amount: Number(txn.amount),
          fee: 0,
          net_amount: Number(txn.amount),
          status: 'matched',
        })
      }

      return cycles.map((c: any): Settlement => {
        const platformName = platformIdToName.get(c.platform_id) ?? 'unknown'
        const platform = platformName === 'shopify' ? 'shopify' : 'amazon_fba'
        const totalAmount = Number(c.total_amount ?? 0)
        const cycleTxns = txnsByCycle.get(c.id) ?? []

        // Map DB status to UI status
        const statusMap: Record<string, Settlement['status']> = {
          pending: 'pending',
          processing: 'processing',
          completed: 'paid',
          disputed: 'discrepancy',
        }

        return {
          id: c.id.substring(0, 8),
          platform,
          cycle_start: c.period_start ?? c.created_at,
          cycle_end: c.period_end ?? c.created_at,
          total_sales: totalAmount,
          total_fees: 0,
          total_refunds: 0,
          net_amount: totalAmount,
          payout_amount: c.status === 'completed' ? totalAmount : null,
          payout_date: c.status === 'completed' ? c.updated_at : null,
          expected_payout_date: c.period_end ?? c.created_at,
          status: statusMap[c.status] ?? 'pending',
          order_count: cycleTxns.length,
          transactions: cycleTxns,
        }
      })
    },
  })

  const filtered = useMemo(() => {
    if (!settlements) return []
    if (platformFilter === 'all') return settlements
    return settlements.filter((s) => s.platform === platformFilter)
  }, [settlements, platformFilter])

  const totals = useMemo(() => {
    if (!filtered.length)
      return { sales: 0, fees: 0, refunds: 0, net: 0, paid: 0, pending: 0, discrepancies: 0 }
    return {
      sales: filtered.reduce((sum, s) => sum + s.total_sales, 0),
      fees: filtered.reduce((sum, s) => sum + s.total_fees, 0),
      refunds: filtered.reduce((sum, s) => sum + s.total_refunds, 0),
      net: filtered.reduce((sum, s) => sum + s.net_amount, 0),
      paid: filtered
        .filter((s) => s.status === 'paid' || s.status === 'discrepancy')
        .reduce((sum, s) => sum + (s.payout_amount ?? 0), 0),
      pending: filtered
        .filter((s) => s.status === 'pending' || s.status === 'processing')
        .reduce((sum, s) => sum + s.net_amount, 0),
      discrepancies: filtered.filter((s) => s.status === 'discrepancy').length,
    }
  }, [filtered])

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[400px] rounded-lg" />
      </div>
    )
  }

  const hasData = settlements && settlements.length > 0

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
          <h1 className="text-2xl font-bold tracking-tight">
            Settlement Reconciliation
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Platforms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="amazon_fba">Amazon FBA</SelectItem>
              <SelectItem value="shopify">Shopify</SelectItem>
            </SelectContent>
          </Select>
          {hasData && (
            <Button
              variant="outline"
              onClick={() => settlements && exportSettlementsCsv(filtered)}
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
            <Landmark className="mb-4 size-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-semibold">No settlement data yet</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Settlement cycles will appear here once platform payouts are imported.
              Amazon and Shopify settlement reports can be synced to track reconciliation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card className="py-5">
              <CardContent className="pt-0">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Total Net Amount</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {formatCurrency(totals.net)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sales {formatCurrency(totals.sales)} - Fees{' '}
                    {formatCurrency(totals.fees)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="py-5">
              <CardContent className="pt-0">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Paid Out</p>
                  <p className="text-2xl font-bold tabular-nums text-emerald-600">
                    {formatCurrency(totals.paid)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="py-5">
              <CardContent className="pt-0">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Pending Payout</p>
                  <p className="text-2xl font-bold tabular-nums text-amber-600">
                    {formatCurrency(totals.pending)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="py-5">
              <CardContent className="pt-0">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Discrepancies</p>
                  <p className="text-2xl font-bold tabular-nums text-red-600">
                    {totals.discrepancies}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Settlements Table */}
          <Card>
            <CardHeader>
              <CardTitle>Settlement Cycles</CardTitle>
              <CardDescription>
                Click a row to expand and see individual transactions. Discrepant items
                are highlighted in red.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>ID</TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Expected</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Variance</TableHead>
                      <TableHead>Payout Dates</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={9}
                          className="h-24 text-center text-muted-foreground"
                        >
                          No settlements found for this filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((s) => {
                        const pCfg = platformConfig[s.platform] ?? platformConfig.amazon_fba
                        const statusCfg = statusConfig[s.status] ?? statusConfig.pending
                        const PlatformIcon = pCfg.icon
                        const StatusIcon = statusCfg.icon
                        const isExpanded = expandedRows[s.id] ?? false
                        const variance =
                          s.payout_amount !== null ? s.payout_amount - s.net_amount : null
                        const hasVariance =
                          variance !== null && Math.abs(variance) > 1

                        return (
                          <>{/* eslint-disable-next-line react/jsx-key */}
                            <TableRow
                              key={s.id}
                              className={cn(
                                'cursor-pointer transition-colors',
                                isExpanded && 'bg-muted/30',
                                s.status === 'discrepancy' && 'border-l-2 border-l-red-500'
                              )}
                              onClick={() => toggleRow(s.id)}
                            >
                              <TableCell>
                                {isExpanded ? (
                                  <ChevronDown className="size-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="size-4 text-muted-foreground" />
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {s.id}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <PlatformIcon
                                    className={cn('size-4', pCfg.color)}
                                  />
                                  <span className="text-sm">{pCfg.label}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-sm">
                                {formatDateRange(s.cycle_start, s.cycle_end)}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {formatCurrency(s.net_amount)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {s.payout_amount !== null ? (
                                  <span
                                    className={cn(
                                      hasVariance && 'text-red-600 font-medium'
                                    )}
                                  >
                                    {formatCurrency(s.payout_amount)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">--</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={cn('gap-1 border-0', statusCfg.className)}
                                >
                                  <StatusIcon className="size-3" />
                                  {statusCfg.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {hasVariance ? (
                                  <span
                                    className={cn(
                                      'font-medium',
                                      variance! < 0
                                        ? 'text-red-600'
                                        : 'text-green-600'
                                    )}
                                  >
                                    {variance! > 0 ? '+' : ''}
                                    {formatCurrency(variance!)}
                                  </span>
                                ) : s.payout_amount !== null ? (
                                  <span className="text-green-600 text-sm">OK</span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-0.5 text-xs">
                                  <p className="text-muted-foreground">
                                    Expected: {formatShortDate(s.expected_payout_date)}
                                  </p>
                                  {s.payout_date ? (
                                    <p>Received: {formatShortDate(s.payout_date)}</p>
                                  ) : (
                                    <p className="text-yellow-600">Awaiting</p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow key={`${s.id}-details`}>
                                <TableCell colSpan={9} className="p-0">
                                  <TransactionDetails transactions={s.transactions} />
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
