'use client'

import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
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
import { formatDate } from '@/lib/utils/date'
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MovementType =
  | 'purchase'
  | 'sales'
  | 'adjustment'
  | 'damage'
  | 'return'
  | 'transfer_in'
  | 'transfer_out'
  | 'fba_sync'

interface MovementVariant {
  variant_sku: string
  product: { name: string } | null
  size: { name: string } | null
  color: { name: string } | null
}

interface MovementWarehouse {
  name: string
}

export interface MovementRow {
  id: string
  variant_id: string
  warehouse_id: string
  movement_type: MovementType
  quantity: number
  notes: string | null
  created_at: string
  created_by: string | null
  variant: MovementVariant | null
  warehouse: MovementWarehouse | null
}

interface MovementLogProps {
  dateFrom: string
  dateTo: string
  movementTypeFilter: MovementType | 'all'
  warehouseFilter: string
  productFilter: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOVEMENT_TYPE_STYLES: Record<MovementType, string> = {
  purchase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  sales: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  adjustment: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  damage: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  return: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  transfer_in: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  transfer_out: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
  fba_sync: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
}

const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  purchase: 'Purchase',
  sales: 'Sales',
  adjustment: 'Adjustment',
  damage: 'Damage',
  return: 'Return',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
  fba_sync: 'FBA Sync',
}

export const MOVEMENT_TYPES: { value: MovementType; label: string }[] = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'sales', label: 'Sales' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'damage', label: 'Damage' },
  { value: 'return', label: 'Return' },
  { value: 'transfer_in', label: 'Transfer In' },
  { value: 'transfer_out', label: 'Transfer Out' },
  { value: 'fba_sync', label: 'FBA Sync' },
]

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

interface MovementDataResult {
  data: MovementRow[]
  totalCount: number
}

function useMovements(
  dateFrom: string,
  dateTo: string,
  movementTypeFilter: MovementType | 'all',
  warehouseFilter: string,
  productFilter: string,
  page: number,
  pageSize: number
) {
  const supabase = createClient()

  return useQuery<MovementDataResult>({
    queryKey: [
      'stock_movements',
      dateFrom,
      dateTo,
      movementTypeFilter,
      warehouseFilter,
      productFilter,
      page,
      pageSize,
    ],
    queryFn: async () => {
      let query = supabase
        .from('stock_movements')
        .select(
          '*, variant:product_variants(variant_sku, product:products(name), size:size_masters(name), color:color_masters(name)), warehouse:warehouses(name)',
          { count: 'exact' }
        )
        .order('created_at', { ascending: false })

      if (dateFrom) {
        query = query.gte('created_at', dateFrom)
      }
      if (dateTo) {
        // Add one day to include the end date fully
        const endDate = new Date(dateTo)
        endDate.setDate(endDate.getDate() + 1)
        query = query.lt('created_at', endDate.toISOString())
      }
      if (movementTypeFilter !== 'all') {
        query = query.eq('movement_type', movementTypeFilter)
      }
      if (warehouseFilter && warehouseFilter !== 'all') {
        query = query.eq('warehouse_id', warehouseFilter)
      }

      // Product/SKU search: find matching variant IDs server-side
      if (productFilter) {
        const { data: skuMatches } = await supabase
          .from('product_variants')
          .select('id')
          .ilike('variant_sku', `%${productFilter}%`)

        const { data: productMatches } = await supabase
          .from('products')
          .select('id')
          .ilike('name', `%${productFilter}%`)

        let variantIds = (skuMatches ?? []).map((v) => v.id)

        if (productMatches?.length) {
          const { data: productVariants } = await supabase
            .from('product_variants')
            .select('id')
            .in('product_id', productMatches.map((p) => p.id))

          const extraIds = (productVariants ?? []).map((v) => v.id)
          variantIds = [...new Set([...variantIds, ...extraIds])]
        }

        if (variantIds.length === 0) {
          return { data: [], totalCount: 0 }
        }
        query = query.in('variant_id', variantIds)
      }

      // Server-side pagination
      const from = page * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error

      return {
        data: (data as unknown as MovementRow[]) ?? [],
        totalCount: count ?? 0,
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function MovementLogSkeleton() {
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
            {Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 8 }).map((_, j) => (
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

export function MovementLog({
  dateFrom,
  dateTo,
  movementTypeFilter,
  warehouseFilter,
  productFilter,
}: MovementLogProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  // Reset page when filters change
  const filterKey = `${dateFrom}-${dateTo}-${movementTypeFilter}-${warehouseFilter}-${productFilter}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setPage(0)
  }

  const { data: movementResult, isLoading, error } = useMovements(
    dateFrom,
    dateTo,
    movementTypeFilter,
    warehouseFilter,
    productFilter,
    page,
    pageSize
  )

  const movements = movementResult?.data
  const totalCount = movementResult?.totalCount ?? 0
  const totalPages = Math.ceil(totalCount / pageSize)

  const columns = useMemo<ColumnDef<MovementRow>[]>(
    () => [
      {
        accessorKey: 'created_at',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Date
            <ArrowUpDown className="ml-1 size-3" />
          </Button>
        ),
        cell: ({ getValue }) => (
          <span className="text-sm">
            {formatDate(getValue<string>(), 'dd MMM yyyy HH:mm')}
          </span>
        ),
      },
      {
        accessorKey: 'product_name',
        header: 'Product',
        accessorFn: (row) => row.variant?.product?.name ?? '—',
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'variant',
        header: 'Variant',
        accessorFn: (row) => {
          const parts: string[] = []
          const sku = row.variant?.variant_sku
          if (sku) parts.push(sku)
          const size = row.variant?.size?.name
          const color = row.variant?.color?.name
          if (size) parts.push(size)
          if (color) parts.push(color)
          return parts.join(' / ') || '—'
        },
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
        accessorKey: 'movement_type',
        header: 'Type',
        cell: ({ getValue }) => {
          const type = getValue<MovementType>()
          return (
            <Badge className={cn('capitalize', MOVEMENT_TYPE_STYLES[type])}>
              {MOVEMENT_TYPE_LABELS[type] ?? type}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'quantity',
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Quantity
            <ArrowUpDown className="ml-1 size-3" />
          </Button>
        ),
        cell: ({ getValue }) => {
          const qty = getValue<number>()
          const sign = qty > 0 ? '+' : ''
          return (
            <span
              className={cn(
                'tabular-nums font-semibold',
                qty > 0 && 'text-emerald-600',
                qty < 0 && 'text-red-600'
              )}
            >
              {sign}
              {qty}
            </span>
          )
        },
      },
      {
        accessorKey: 'notes',
        header: 'Notes',
        cell: ({ getValue }) => {
          const notes = getValue<string | null>()
          return notes ? (
            <span className="text-sm text-muted-foreground max-w-[200px] truncate block">
              {notes}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )
        },
      },
      {
        accessorKey: 'created_by',
        header: 'Created By',
        cell: ({ getValue }) => {
          const val = getValue<string | null>()
          return (
            <span className="text-sm text-muted-foreground">
              {val ?? 'System'}
            </span>
          )
        },
      },
    ],
    []
  )

  const table = useReactTable({
    data: movements ?? [],
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: totalPages,
  })

  if (isLoading) return <MovementLogSkeleton />

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load movement data. Please try again.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {totalCount} movements
      </p>

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
                  No movements found for the selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {totalCount > 0 ? page * pageSize + 1 : 0}-{Math.min((page + 1) * pageSize, totalCount)} of {totalCount} movements
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
              {[10, 25, 50, 100].map((size) => (
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
