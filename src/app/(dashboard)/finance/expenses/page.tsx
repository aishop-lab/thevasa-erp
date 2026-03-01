'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
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
import { Card, CardContent } from '@/components/ui/card'
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
  'Shipping',
  'Packaging',
  'Marketing',
  'Rent',
  'Salary',
  'Utilities',
  'Raw Materials',
  'Platform Fees',
  'Returns & Refunds',
  'Insurance',
  'Legal & Compliance',
  'Other',
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

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function ExpensesSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-9 w-[180px]" />
        <Skeleton className="ml-auto h-9 w-[130px]" />
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

  const [sorting, setSorting] = useState<SortingState>([
    { id: 'date', desc: true },
  ])
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Fetch expenses
  const { data: expenses, isLoading, isError, error } = useQuery({
    queryKey: ['finance', 'expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
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

  // Monthly summary
  const monthSummary = useMemo(() => {
    if (!expenses) return { total: 0, gst: 0, count: 0 }
    const now = new Date()
    const monthExpenses = expenses.filter((e) => {
      const d = new Date(e.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    return {
      total: monthExpenses.reduce((sum, e) => sum + e.amount, 0),
      gst: monthExpenses.reduce((sum, e) => sum + (e.gst_amount ?? 0), 0),
      count: monthExpenses.length,
    }
  }, [expenses])

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
            Date
            <ArrowUpDown className="ml-2 size-4" />
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
            <Badge
              className={cn(
                'border-0',
                CATEGORY_COLORS[cat] ?? 'bg-gray-100 text-gray-800'
              )}
            >
              {cat}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ row }) => (
          <span className="text-sm line-clamp-1 max-w-[250px]">
            {row.getValue('description')}
          </span>
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
            Amount
            <ArrowUpDown className="ml-2 size-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatCurrency(row.getValue('amount'))}
          </span>
        ),
      },
      {
        accessorKey: 'gst_amount',
        header: 'GST',
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {formatCurrency(row.original.gst_amount ?? 0)}
            <span className="ml-1 text-xs text-muted-foreground">
              ({row.original.gst_rate}%)
            </span>
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
        accessorKey: 'invoice_number',
        header: 'Receipt',
        cell: ({ row }) =>
          row.original.receipt_url ? (
            <a
              href={row.original.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              View
            </a>
          ) : row.getValue('invoice_number') ? (
            <span className="font-mono text-xs">{row.getValue('invoice_number')}</span>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
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
                onClick={() => {
                  setEditingExpense(row.original)
                  setFormOpen(true)
                }}
              >
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteId(row.original.id)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
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

  if (isLoading) {
    return <ExpensesSkeleton />
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
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
        </div>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            Failed to load expenses: {(error as Error).message}
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
          <h1 className="text-2xl font-bold tracking-tight">Expenses</h1>
        </div>
        <Button onClick={() => { setEditingExpense(null); setFormOpen(true) }}>
          <Plus className="mr-2 size-4" />
          Add Expense
        </Button>
      </div>

      {/* Monthly Summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="py-5">
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">This Month Total</p>
                <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(monthSummary.total)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950">
                <IndianRupee className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="py-5">
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">GST (Input Tax)</p>
                <p className="text-2xl font-bold tabular-nums">
                  {formatCurrency(monthSummary.gst)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950">
                <Receipt className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="py-5">
          <CardContent className="pt-0">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Entries This Month</p>
                <p className="text-2xl font-bold tabular-nums">
                  {monthSummary.count}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950">
                <TrendingDown className="h-5 w-5 text-blue-600" />
              </div>
            </div>
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
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
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
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
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
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="mr-1 size-4" />
            Previous
          </Button>
          <span className="text-sm">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight className="ml-1 size-4" />
          </Button>
        </div>
      </div>

      {/* Expense Form Dialog */}
      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditingExpense(null)
        }}
        onSubmit={async (values) => {
          await createMutation.mutateAsync(values)
        }}
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
              Are you sure you want to delete this expense? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
