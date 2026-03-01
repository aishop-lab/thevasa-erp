'use client'

import { useMemo } from 'react'
import Link from 'next/link'
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
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderRow {
  id: string
  order_number: string
  customer_name: string | null
  customer_email: string | null
  total_amount: number
  status: string
  payment_status: string
  ordered_at: string
  platform?: {
    name: string
    display_name: string
  } | null
  order_items?: { count: number }[]
}

interface OrderTableProps {
  orders: OrderRow[]
  isLoading: boolean
  globalFilter?: string
  platformFilter?: string
  statusFilter?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  processing: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  returned: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

const PAYMENT_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  partially_paid: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const PLATFORM_COLORS: Record<string, string> = {
  shopify: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  amazon: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const columns: ColumnDef<OrderRow>[] = [
  {
    accessorKey: 'order_number',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Order #
        <ArrowUpDown className="ml-2 size-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <Link
        href={`/orders/${row.original.id}`}
        className="flex items-center gap-1 font-mono text-sm font-medium hover:underline"
      >
        {row.getValue('order_number')}
        <ExternalLink className="size-3 text-muted-foreground" />
      </Link>
    ),
  },
  {
    id: 'platform',
    accessorFn: (row) => row.platform?.name ?? 'unknown',
    header: 'Platform',
    cell: ({ row }) => {
      const platformName = row.original.platform?.name ?? 'unknown'
      const displayName = row.original.platform?.display_name ?? platformName
      return (
        <Badge
          className={cn(
            'border-0 capitalize',
            PLATFORM_COLORS[platformName] ?? 'bg-gray-100 text-gray-800'
          )}
        >
          {displayName}
        </Badge>
      )
    },
    filterFn: 'equals',
  },
  {
    accessorKey: 'customer_name',
    header: 'Customer',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.getValue('customer_name') || 'N/A'}</p>
        {row.original.customer_email && (
          <p className="text-xs text-muted-foreground">
            {row.original.customer_email}
          </p>
        )}
      </div>
    ),
  },
  {
    id: 'items_count',
    header: 'Items',
    accessorFn: (row) => row.order_items?.[0]?.count ?? 0,
    cell: ({ getValue }) => (
      <span className="text-sm">{getValue<number>()} items</span>
    ),
  },
  {
    accessorKey: 'total_amount',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Total
        <ArrowUpDown className="ml-2 size-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">
        {formatCurrency(row.getValue('total_amount'))}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-3 h-8"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        Status
        <ArrowUpDown className="ml-2 size-4" />
      </Button>
    ),
    cell: ({ row }) => {
      const status = row.getValue<string>('status')
      return (
        <Badge
          className={cn(
            'border-0 capitalize',
            STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800'
          )}
        >
          {status}
        </Badge>
      )
    },
    filterFn: 'equals',
  },
  {
    accessorKey: 'payment_status',
    header: 'Payment',
    cell: ({ row }) => {
      const payment = row.getValue<string>('payment_status')
      return (
        <Badge
          className={cn(
            'border-0 capitalize',
            PAYMENT_COLORS[payment] ?? 'bg-gray-100 text-gray-800'
          )}
        >
          {payment?.replace('_', ' ')}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'ordered_at',
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
      <span className="text-sm">
        {formatDate(row.getValue('ordered_at'), 'dd MMM yyyy')}
      </span>
    ),
  },
]

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export function OrderTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 8 }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {Array.from({ length: 8 }).map((_, colIdx) => (
                  <TableCell key={colIdx}>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrderTable({
  orders,
  isLoading,
  globalFilter = '',
  platformFilter = 'all',
  statusFilter = 'all',
}: OrderTableProps) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'ordered_at', desc: true },
  ])
  const [pageSize, setPageSize] = useState(20)

  // Apply external filters to the data
  const filteredData = useMemo(() => {
    let data = orders

    if (platformFilter && platformFilter !== 'all') {
      data = data.filter(
        (o) => o.platform?.name?.toLowerCase() === platformFilter.toLowerCase()
      )
    }

    if (statusFilter && statusFilter !== 'all') {
      data = data.filter(
        (o) => o.status?.toLowerCase() === statusFilter.toLowerCase()
      )
    }

    if (globalFilter) {
      const search = globalFilter.toLowerCase()
      data = data.filter(
        (o) =>
          o.order_number?.toLowerCase().includes(search) ||
          o.customer_name?.toLowerCase().includes(search) ||
          o.customer_email?.toLowerCase().includes(search)
      )
    }

    return data
  }, [orders, platformFilter, statusFilter, globalFilter])

  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      pagination: {
        pageIndex: 0,
        pageSize,
      },
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  if (isLoading) {
    return <OrderTableSkeleton />
  }

  return (
    <div className="space-y-4">
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
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No orders found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <p className="text-muted-foreground text-sm">
            Showing{' '}
            {filteredData.length > 0
              ? table.getState().pagination.pageIndex * pageSize + 1
              : 0}
            -
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * pageSize,
              filteredData.length
            )}{' '}
            of {filteredData.length} orders
          </p>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => setPageSize(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
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
    </div>
  )
}
