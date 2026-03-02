'use client'

import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatRelative } from '@/lib/utils/date'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Pencil,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductVariant {
  variant_sku: string
  product: { name: string; sku: string } | null
  size: { name: string } | null
  color: { name: string } | null
}

interface Warehouse {
  name: string
}

export interface StockRow {
  id: string
  variant_id: string
  warehouse_id: string
  qty_on_hand: number
  qty_reserved: number
  qty_available: number
  low_stock_threshold: number
  last_synced_at: string | null
  product_variants: ProductVariant | null
  warehouse: Warehouse | null
}

interface StockTableProps {
  warehouseFilter: string
  onAdjust: (row: StockRow) => void
  /** Hide the Adjust action column (e.g. for viewer role) */
  hideActions?: boolean
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

interface StockDataResult {
  data: StockRow[]
  totalCount: number
}

function useStockData(warehouseFilter: string, page: number, pageSize: number, search: string) {
  const supabase = createClient()

  return useQuery<StockDataResult>({
    queryKey: ['warehouse_stock', warehouseFilter, page, pageSize, search],
    queryFn: async () => {
      let query = supabase
        .from('warehouse_stock')
        .select(
          '*, product_variants(variant_sku, product:products(name, sku), size:size_masters(name), color:color_masters(name)), warehouse:warehouses(name)',
          { count: 'exact' }
        )
        .order('updated_at', { ascending: false })

      if (warehouseFilter && warehouseFilter !== 'all') {
        query = query.eq('warehouse_id', warehouseFilter)
      }

      // Server-side pagination
      const from = page * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error
      return {
        data: (data as unknown as StockRow[]) ?? [],
        totalCount: count ?? 0,
      }
    },
  })
}

export function useWarehouses() {
  const supabase = createClient()

  return useQuery<{ id: string; name: string }[]>({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('id, name')
        .order('name')

      if (error) throw error
      return data ?? []
    },
  })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function availabilityColor(available: number, threshold: number): string {
  if (available <= 0) return 'text-red-600 font-semibold'
  if (available < threshold) return 'text-yellow-600 font-semibold'
  return 'text-emerald-600'
}

// ---------------------------------------------------------------------------
// Table skeleton
// ---------------------------------------------------------------------------

function StockTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: 9 }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 9 }).map((_, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
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

export function StockTable({ warehouseFilter, onAdjust, hideActions }: StockTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const { data: stockResult, isLoading, error } = useStockData(warehouseFilter, page, pageSize, globalFilter)
  const stock = stockResult?.data
  const totalCount = stockResult?.totalCount ?? 0
  const totalPages = Math.ceil(totalCount / pageSize)

  const columns = useMemo<ColumnDef<StockRow>[]>(
    () => [
      {
        accessorKey: 'product_name',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Product Name
            <ArrowUpDown className="ml-1 size-3" />
          </Button>
        ),
        accessorFn: (row) => row.product_variants?.product?.name ?? '—',
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'variant',
        header: 'Variant',
        accessorFn: (row) => {
          const parts: string[] = []
          if (row.product_variants?.size?.name) parts.push(row.product_variants.size.name)
          if (row.product_variants?.color?.name) parts.push(row.product_variants.color.name)
          return parts.length > 0 ? parts.join(' / ') : '—'
        },
      },
      {
        accessorKey: 'sku',
        header: 'SKU',
        accessorFn: (row) => row.product_variants?.variant_sku ?? '—',
        cell: ({ getValue }) => (
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            {getValue<string>()}
          </code>
        ),
      },
      {
        accessorKey: 'warehouse_name',
        header: 'Warehouse',
        accessorFn: (row) => row.warehouse?.name ?? '—',
        cell: ({ getValue }) => (
          <Badge variant="outline">{getValue<string>()}</Badge>
        ),
      },
      {
        accessorKey: 'qty_on_hand',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            On Hand
            <ArrowUpDown className="ml-1 size-3" />
          </Button>
        ),
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: 'qty_reserved',
        header: 'Reserved',
        cell: ({ getValue }) => (
          <span className="tabular-nums text-muted-foreground">
            {getValue<number>()}
          </span>
        ),
      },
      {
        accessorKey: 'qty_available',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Available
            <ArrowUpDown className="ml-1 size-3" />
          </Button>
        ),
        cell: ({ row }) => {
          const available = row.original.qty_available
          const threshold = row.original.low_stock_threshold
          return (
            <span
              className={cn(
                'tabular-nums',
                availabilityColor(available, threshold)
              )}
            >
              {available}
            </span>
          )
        },
      },
      {
        accessorKey: 'last_synced_at',
        header: 'Last Synced',
        cell: ({ getValue }) => {
          const val = getValue<string | null>()
          return val ? (
            <span className="text-muted-foreground text-xs">
              {formatRelative(val)}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">Never</span>
          )
        },
      },
      ...(!hideActions ? [{
        id: 'actions',
        header: 'Actions',
        cell: ({ row }: { row: { original: StockRow } }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAdjust(row.original)}
          >
            <Pencil className="size-3.5" />
            Adjust
          </Button>
        ),
      }] : []),
    ],
    [onAdjust, hideActions]
  )

  const table = useReactTable({
    data: stock ?? [],
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  })

  if (isLoading) return <StockTableSkeleton />

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load stock data. Please try again.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by product name or SKU..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          {totalCount} items
        </p>
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
            {table.getRowModel().rows.length ? (
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
                  className="h-24 text-center text-muted-foreground"
                >
                  No stock data found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {totalCount > 0 ? page * pageSize + 1 : 0}-{Math.min((page + 1) * pageSize, totalCount)} of {totalCount} items
        </p>
        <div className="flex items-center gap-2">
          <Select
            value={String(pageSize)}
            onValueChange={(val) => {
              setPageSize(Number(val))
              setPage(0)
            }}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} per page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page <= 0}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <span className="text-sm">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page + 1 >= totalPages}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
