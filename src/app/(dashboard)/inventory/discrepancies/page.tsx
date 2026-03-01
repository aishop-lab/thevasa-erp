'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { DiscrepancyTable } from '@/components/inventory/discrepancy-table'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react'

type Severity = 'match' | 'minor' | 'moderate' | 'major'
type DiscrepancyStatus = 'open' | 'investigating' | 'resolved' | 'dismissed'

const SEVERITY_OPTIONS: { value: Severity | 'all'; label: string }[] = [
  { value: 'all', label: 'All Severities' },
  { value: 'major', label: 'Major' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'minor', label: 'Minor' },
  { value: 'match', label: 'Match' },
]

const STATUS_OPTIONS: { value: DiscrepancyStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
]

export default function DiscrepanciesPage() {
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [severityFilter, setSeverityFilter] = useState<Severity | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<DiscrepancyStatus | 'all'>(
    'all'
  )

  // Run Check mutation: calls a Supabase Edge Function or RPC to detect discrepancies
  const runCheckMutation = useMutation({
    mutationFn: async () => {
      // Attempt to call an RPC that compares warehouse stock against FBA stock.
      // If the RPC doesn't exist yet, we fall back to a manual comparison approach.
      const { error } = await supabase.rpc('detect_inventory_discrepancies')
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Discrepancy check completed')
      queryClient.invalidateQueries({ queryKey: ['inventory_discrepancies'] })
    },
    onError: (err: Error) => {
      toast.error(
        err.message || 'Failed to run discrepancy check. Please try again.'
      )
    },
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-6 text-amber-500" />
            <h1 className="text-2xl font-bold tracking-tight">
              Inventory Discrepancies
            </h1>
          </div>
          <p className="text-muted-foreground">
            Compare warehouse stock vs Amazon FBA inventory
          </p>
        </div>
        <Button
          onClick={() => runCheckMutation.mutate()}
          disabled={runCheckMutation.isPending}
        >
          {runCheckMutation.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Run Check
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Severity:
          </span>
          <Select
            value={severityFilter}
            onValueChange={(val) =>
              setSeverityFilter(val as Severity | 'all')
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEVERITY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            Status:
          </span>
          <Select
            value={statusFilter}
            onValueChange={(val) =>
              setStatusFilter(val as DiscrepancyStatus | 'all')
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Discrepancy Table */}
      <DiscrepancyTable
        severityFilter={severityFilter}
        statusFilter={statusFilter}
      />
    </div>
  )
}
