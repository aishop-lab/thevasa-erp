'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ExpenseFormDialog,
  type ExpenseFormValues,
} from '@/components/finance/expense-form'
import {
  DateRangePicker,
  useDateRangeState,
} from '@/components/finance/date-range-picker'
import { StatCard } from '@/components/finance/stat-card'
import { ComparisonChart } from '@/components/finance/comparison-chart'
import { useExpensesSummary } from '@/hooks/use-finance'
import { formatCurrency, formatCompactCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  IndianRupee,
  TrendingDown,
} from 'lucide-react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExpenseRow {
  id: string
  date: string
  category: string
  subcategory: string | null
  description: string
  amount: number
  gst_rate: number
  gst_amount: number
  vendor: string | null
  invoice_number: string | null
  receipt_url: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EXPENSE_CATEGORIES = [
  'Shipping', 'Packaging', 'Marketing', 'Rent', 'Salary', 'Utilities',
  'Raw Materials', 'Platform Fees', 'Returns & Refunds', 'Insurance',
  'Legal & Compliance', 'Other',
]

const CATEGORY_COLORS: Record<string, string> = {
  Shipping: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  Packaging: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  Marketing: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  Rent: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  Salary: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  Utilities: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  'Raw Materials': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  'Platform Fees': 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200',
  'Returns & Refunds': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  Insurance: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  'Legal & Compliance': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  Other: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
}

const CATEGORY_BAR_COLORS: Record<string, string> = {
  Shipping: '#3b82f6',
  Packaging: '#10b981',
  Marketing: '#8b5cf6',
  Rent: '#f59e0b',
  Salary: '#6366f1',
  Utilities: '#06b6d4',
  'Raw Materials': '#f97316',
  'Platform Fees': '#f43f5e',
  'Returns & Refunds': '#ef4444',
  Insurance: '#14b8a6',
  'Legal & Compliance': '#6b7280',
  Other: '#64748b',
}

// ---------------------------------------------------------------------------
// Chart Tooltip
// ---------------------------------------------------------------------------

function CategoryTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload: { category: string; fill: string } }>
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
      <p className="text-sm font-medium">{payload[0].payload.category}</p>
      <p className="text-sm font-semibold tabular-nums">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ExpensesSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[300px] rounded-lg" />
        <Skeleton className="h-[300px] rounded-lg" />
      </div>
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExpensesPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const [dateRange, setDateRange] = useDateRangeState('this_month')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }])
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Analytics from hook
  const { data: summary } = useExpensesSummary(
    dateRange.from,
    dateRange.to,
    dateRange.granularity,
    dateRange.compareFrom,
    dateRange.compareTo
  )

  // Fetch expenses for the table (date filtered)
  const { data: expenses, isLoading, isError, error } = useQuery({
    queryKey: ['finance', 'expenses', dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', dateRange.from.toISOString())
        .lte('date', dateRange.to.toISOString())
        .order('date', { ascending: false })

      if (error) throw error
      return data as ExpenseRow[]
    },
  })

  // Create expense
  const createMutation = useMutation({
    mutationFn: async (values: ExpenseFormValues) => {
      const gstAmount = (values.amount * values.gst_rate) / 100
      const { error } = await supabase.from('expenses').insert({
        date: values.date,
        category: values.category,
        subcategory: values.subcategory || null,
        description: values.description,
        amount: values.amount,
        gst_rate: values.gst_rate,
        gst_amount: gstAmount,
        vendor: values.vendor || null,
        invoice_number: values.invoice_number || null,
        receipt_url: values.receipt_url || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'expenses'] })
      queryClient.invalidateQueries({ queryKey: ['finance', 'expenses-summary'] })
      setFormOpen(false)
      toast.success('Expense added successfully')
    },
    onError: (err: Error) => {
      toast.error(`Failed to add expense: ${err.message}`)
    },
  })

  // Delete expense
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'expenses'] })
      queryClient.invalidateQueries({ queryKey: ['finance', 'expenses-summary'] })
      setDeleteId(null)
      toast.success('Expense deleted')
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete expense: ${err.message}`)
    },
  })

  // Filtered data
  const filteredExpenses = useMemo(() => {
    if (!expenses) return []
    if (categoryFilter === 'all') return expenses
    return expenses.filter((e) => e.category === categoryFilter)
  }, [expenses, categoryFilter])

  // Category breakdown chart data
  const categoryChartData = useMemo(() => {
    if (!summary?.byCategory) return []
    return summary.byCategory.map((c) => ({
      category: c.category,
      amount: c.amount,
      fill: CATEGORY_BAR_COLORS[c.category] ?? '#6b7280',
    }))
  }, [summary?.byCategory])

  // Trend chart data
  const trendChartData = useMemo(() => {
    if (!summary?.trendData) return []
    return summary.trendData.map((t) => ({
      label: t.label,
      value: t.amount,
    }))
  }, [summary?.trendData])

  // Columns
  const columns: ColumnDef<ExpenseRow>[] = useMemo(
    () => [
      {
        accessorKey: 'date',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Date <ArrowUpDown className="ml-2 size-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-sm">{formatDate(row.getValue('date'), 'dd MMM yyyy')}</span>
        ),
      },
      {
        accessorKey: 'category',
        header: 'Category',
        cell: ({ row }) => {
          const cat = row.getValue<string>('category')
          return (
            <Badge className={cn('border-0', CATEGORY_COLORS[cat] ?? 'bg-gray-100 text-gray-800')}>
              {cat}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <span className="text-sm line-clamp-1 max-w-[250px]">{row.getValue('description')}</span>
        ),
      },
      {
        accessorKey: 'amount',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Amount <ArrowUpDown className="ml-2 size-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{formatCurrency(row.getValue('amount'))}</span>
        ),
      },
      {
        accessorKey: 'gst_amount',
        header: 'GST',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {formatCurrency(row.original.gst_amount ?? 0)}
            <span className="ml-1 text-xs text-muted-foreground">({row.original.gst_rate}%)</span>
          </span>
        ),
      },
      {
        accessorKey: 'vendor',
        header: 'Vendor',
        cell: ({ row }) => (
          <span className="text-sm">{row.getValue('vendor') || '-'}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="size-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => { setEditingExpense(row.original); setFormOpen(true) }}
              >
                <Pencil className="mr-2 size-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteId(row.original.id)}
              >
                <Trash2 className="mr-2 size-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data: filteredExpenses,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  })

  if (isLoading) return <ExpensesSkeleton />

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Finance
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
        </div>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">Failed to load expenses: {(error as Error).message}</p>
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
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Button onClick={() => { setEditingExpense(null); setFormOpen(true) }}>
            <Plus className="mr-2 size-4" /> Add Expense
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="Total Expenses"
          value={formatCompactCurrency(summary?.totalExpenses ?? 0)}
          icon={IndianRupee}
          iconColor="text-red-600"
          iconBg="bg-red-50 dark:bg-red-950"
          changePercent={summary?.expensesChange}
          invertTrend
        />
        <StatCard
          title="GST (Input Tax)"
          value={formatCurrency(summary?.totalGst ?? 0)}
          icon={Receipt}
          iconColor="text-amber-600"
          iconBg="bg-amber-50 dark:bg-amber-950"
        />
        <StatCard
          title="Entries"
          value={String(filteredExpenses.length)}
          icon={TrendingDown}
          iconColor="text-blue-600"
          iconBg="bg-blue-50 dark:bg-blue-950"
        />
      </div>

      {/* Expense Trend + Category Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ComparisonChart
          title="Expense Trend"
          description="Expenses over time"
          data={trendChartData}
          type="bar"
          color="#ef4444"
        />

        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
            <CardDescription>Expenses by category</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryChartData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                No expenses this period
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => formatCompactCurrency(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={100}
                    />
                    <Tooltip content={<CategoryTooltip />} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                      {categoryChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EXPENSE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No expenses found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {filteredExpenses.length} expense{filteredExpenses.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="mr-1 size-4" /> Previous
          </Button>
          <span className="text-sm">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </span>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>
      </div>

      {/* Expense Form Dialog */}
      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={(open) => { setFormOpen(open); if (!open) setEditingExpense(null) }}
        onSubmit={async (values) => { await createMutation.mutateAsync(values) }}
        isSubmitting={createMutation.isPending}
        defaultValues={
          editingExpense
            ? {
                date: editingExpense.date,
                category: editingExpense.category,
                subcategory: editingExpense.subcategory ?? '',
                description: editingExpense.description,
                amount: editingExpense.amount,
                gst_rate: editingExpense.gst_rate,
                vendor: editingExpense.vendor ?? '',
                invoice_number: editingExpense.invoice_number ?? '',
              }
            : undefined
        }
        mode={editingExpense ? 'edit' : 'create'}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Expense</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
