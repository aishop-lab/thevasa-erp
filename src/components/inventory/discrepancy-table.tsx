'use client'

import { useMemo, useState, Fragment } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ExpandedState,
} from '@tanstack/react-table'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Search as SearchIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Severity = 'match' | 'minor' | 'moderate' | 'major'
type DiscrepancyStatus = 'open' | 'investigating' | 'resolved' | 'dismissed'
type ResolutionReason =
  | 'counting_error'
  | 'theft'
  | 'damage'
  | 'system_error'
  | 'transfer_in_transit'
  | 'other'

interface DiscrepancyVariant {
  variant_sku: string
  product: { name: string } | null
}

interface DiscrepancyWarehouse {
  name: string
}

export interface DiscrepancyRow {
  id: string
  variant_id: string
  warehouse_qty: number
  fba_qty: number
  discrepancy: number
  severity: Severity
  status: DiscrepancyStatus
  investigation_notes: string | null
  resolution_reason: string | null
  resolution_notes: string | null
  detected_at: string
  resolved_at: string | null
  variant: DiscrepancyVariant | null
  warehouse: DiscrepancyWarehouse | null
}

interface DiscrepancyTableProps {
  severityFilter: Severity | 'all'
  statusFilter: DiscrepancyStatus | 'all'
}

const RESOLUTION_REASONS: { value: ResolutionReason; label: string }[] = [
  { value: 'counting_error', label: 'Counting Error' },
  { value: 'theft', label: 'Theft / Pilferage' },
  { value: 'damage', label: 'Damage / Loss' },
  { value: 'system_error', label: 'System Error' },
  { value: 'transfer_in_transit', label: 'Transfer In Transit' },
  { value: 'other', label: 'Other' },
]

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

function useDiscrepancies(
  severityFilter: Severity | 'all',
  statusFilter: DiscrepancyStatus | 'all'
) {
  const supabase = createClient()

  return useQuery<DiscrepancyRow[]>({
    queryKey: ['inventory_discrepancies', severityFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('inventory_discrepancies')
        .select(
          '*, variant:product_variants(variant_sku, product:products(name)), warehouse:warehouses(name)'
        )
        .order('detected_at', { ascending: false })

      if (severityFilter !== 'all') {
        query = query.eq('severity', severityFilter as any) // eslint-disable-line @typescript-eslint/no-explicit-any
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return (data as unknown as DiscrepancyRow[]) ?? []
    },
  })
}

// ---------------------------------------------------------------------------
// Badge helpers
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<Severity, string> = {
  match: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  minor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  moderate: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  major: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
}

const STATUS_STYLES: Record<DiscrepancyStatus, string> = {
  open: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  investigating: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  dismissed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge className={cn('capitalize', SEVERITY_STYLES[severity])}>
      {severity}
    </Badge>
  )
}

function StatusBadge({ status }: { status: DiscrepancyStatus }) {
  return (
    <Badge className={cn('capitalize', STATUS_STYLES[status])}>
      {status}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function DiscrepancyTableSkeleton() {
  return (
    <div className="space-y-4">
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
            {Array.from({ length: 6 }).map((_, i) => (
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
// Resolution Dialog
// ---------------------------------------------------------------------------

function ResolveDialog({
  open,
  onOpenChange,
  discrepancyId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  discrepancyId: string | null
}) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState<ResolutionReason>('counting_error')
  const [notes, setNotes] = useState('')

  const mutation = useMutation({
    mutationFn: async () => {
      if (!discrepancyId) return

      const { error } = await supabase
        .from('inventory_discrepancies')
        .update({
          status: 'resolved' as DiscrepancyStatus,
          resolution_reason: reason,
          resolution_notes: notes || null,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', discrepancyId)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Discrepancy resolved')
      queryClient.invalidateQueries({ queryKey: ['inventory_discrepancies'] })
      onOpenChange(false)
      setReason('counting_error')
      setNotes('')
    },
    onError: () => {
      toast.error('Failed to resolve discrepancy')
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve Discrepancy</DialogTitle>
          <DialogDescription>
            Select a reason and add notes to resolve this discrepancy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resolve-reason">Resolution Reason</Label>
            <Select
              value={reason}
              onValueChange={(val) => setReason(val as ResolutionReason)}
            >
              <SelectTrigger id="resolve-reason" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTION_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resolve-notes">Notes</Label>
            <Textarea
              id="resolve-notes"
              placeholder="Describe the resolution..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            {mutation.isPending && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Mark as Resolved
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DiscrepancyTable({
  severityFilter,
  statusFilter,
}: DiscrepancyTableProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { data: discrepancies, isLoading, error } = useDiscrepancies(
    severityFilter,
    statusFilter
  )

  const [sorting, setSorting] = useState<SortingState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false)
  const [resolveId, setResolveId] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState<Record<string, string>>({})

  // Investigate mutation
  const investigateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory_discrepancies')
        .update({ status: 'investigating' as DiscrepancyStatus })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Status updated to investigating')
      queryClient.invalidateQueries({ queryKey: ['inventory_discrepancies'] })
    },
    onError: () => {
      toast.error('Failed to update status')
    },
  })

  // Dismiss mutation
  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('inventory_discrepancies')
        .update({ status: 'dismissed' as DiscrepancyStatus })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Discrepancy dismissed')
      queryClient.invalidateQueries({ queryKey: ['inventory_discrepancies'] })
    },
    onError: () => {
      toast.error('Failed to dismiss')
    },
  })

  // Save notes mutation
  const saveNotesMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from('inventory_discrepancies')
        .update({ investigation_notes: notes })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Notes saved')
      queryClient.invalidateQueries({ queryKey: ['inventory_discrepancies'] })
    },
    onError: () => {
      toast.error('Failed to save notes')
    },
  })

  const columns = useMemo<ColumnDef<DiscrepancyRow>[]>(
    () => [
      {
        id: 'expander',
        header: () => null,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => row.toggleExpanded()}
          >
            {row.getIsExpanded() ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
          </Button>
        ),
      },
      {
        accessorKey: 'product',
        header: 'Product',
        accessorFn: (row) => row.variant?.product?.name ?? '—',
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: 'variant_sku',
        header: 'Variant',
        accessorFn: (row) => row.variant?.variant_sku ?? '—',
        cell: ({ getValue }) => (
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            {getValue<string>()}
          </code>
        ),
      },
      {
        accessorKey: 'warehouse_qty',
        header: 'Warehouse Qty',
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: 'fba_qty',
        header: 'FBA Qty',
        cell: ({ getValue }) => (
          <span className="tabular-nums">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: 'discrepancy',
        header: 'Discrepancy',
        cell: ({ getValue }) => {
          const val = getValue<number>()
          const sign = val > 0 ? '+' : ''
          return (
            <span
              className={cn(
                'tabular-nums font-semibold',
                val > 0 && 'text-emerald-600',
                val < 0 && 'text-red-600',
                val === 0 && 'text-muted-foreground'
              )}
            >
              {sign}
              {val}
            </span>
          )
        },
      },
      {
        accessorKey: 'severity',
        header: 'Severity',
        cell: ({ getValue }) => (
          <SeverityBadge severity={getValue<Severity>()} />
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => (
          <StatusBadge status={getValue<DiscrepancyStatus>()} />
        ),
      },
      {
        accessorKey: 'detected_at',
        header: 'Detected',
        cell: ({ getValue }) => (
          <span className="text-muted-foreground text-xs">
            {formatRelative(getValue<string>())}
          </span>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const { id, status } = row.original
          if (status === 'resolved' || status === 'dismissed') return null

          return (
            <div className="flex items-center gap-1">
              {status === 'open' && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    investigateMutation.mutate(id)
                    row.toggleExpanded(true)
                  }}
                  disabled={investigateMutation.isPending}
                >
                  <SearchIcon className="size-3" />
                  Investigate
                </Button>
              )}
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setResolveId(id)
                  setResolveDialogOpen(true)
                }}
              >
                <CheckCircle2 className="size-3" />
                Resolve
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => dismissMutation.mutate(id)}
                disabled={dismissMutation.isPending}
              >
                <XCircle className="size-3" />
                Dismiss
              </Button>
            </div>
          )
        },
      },
    ],
    [investigateMutation, dismissMutation]
  )

  const table = useReactTable({
    data: discrepancies ?? [],
    columns,
    state: {
      sorting,
      expanded,
    },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getRowCanExpand: () => true,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
    },
  })

  if (isLoading) return <DiscrepancyTableSkeleton />

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load discrepancy data. Please try again.
      </div>
    )
  }

  return (
    <>
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        <span>{table.getFilteredRowModel().rows.length} discrepancies</span>
        {discrepancies && (
          <>
            <span className="text-red-600 font-medium">
              {discrepancies.filter((d) => d.severity === 'major').length} major
            </span>
            <span className="text-orange-600 font-medium">
              {discrepancies.filter((d) => d.severity === 'moderate').length}{' '}
              moderate
            </span>
          </>
        )}
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
                <Fragment key={row.id}>
                  <TableRow
                    className={cn(
                      'cursor-pointer',
                      row.getIsExpanded() && 'bg-muted/50'
                    )}
                    onClick={() => row.toggleExpanded()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>

                  {/* Expanded row: investigation notes */}
                  {row.getIsExpanded() && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={columns.length}>
                        <div className="p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="size-4 text-amber-500" />
                            <span className="text-sm font-medium">
                              Investigation Notes
                            </span>
                          </div>
                          <Textarea
                            placeholder="Add investigation notes..."
                            value={
                              editNotes[row.original.id] ??
                              row.original.investigation_notes ??
                              ''
                            }
                            onChange={(e) =>
                              setEditNotes((prev) => ({
                                ...prev,
                                [row.original.id]: e.target.value,
                              }))
                            }
                            rows={3}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              saveNotesMutation.mutate({
                                id: row.original.id,
                                notes:
                                  editNotes[row.original.id] ??
                                  row.original.investigation_notes ??
                                  '',
                              })
                            }}
                            disabled={saveNotesMutation.isPending}
                          >
                            {saveNotesMutation.isPending && (
                              <Loader2 className="size-3 animate-spin" />
                            )}
                            Save Notes
                          </Button>

                          {row.original.resolution_reason && (
                            <div className="mt-2 pt-2 border-t text-sm text-muted-foreground">
                              <p>
                                <strong>Resolution:</strong>{' '}
                                {row.original.resolution_reason
                                  .replace(/_/g, ' ')
                                  .replace(/\b\w/g, (c: string) =>
                                    c.toUpperCase()
                                  )}
                              </p>
                              {row.original.resolution_notes && (
                                <p className="mt-1">
                                  {row.original.resolution_notes}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No discrepancies found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Resolution Dialog */}
      <ResolveDialog
        open={resolveDialogOpen}
        onOpenChange={setResolveDialogOpen}
        discrepancyId={resolveId}
      />
    </>
  )
}
