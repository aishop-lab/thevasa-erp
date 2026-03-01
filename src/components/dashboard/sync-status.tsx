'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useSyncStatus } from '@/hooks/use-dashboard'

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

export function SyncStatusBanner() {
  const { data: syncStatuses } = useSyncStatus()
  const [isSyncing, setIsSyncing] = useState(false)
  const queryClient = useQueryClient()

  const handleSyncNow = async () => {
    setIsSyncing(true)
    try {
      // Run order/inventory sync
      const response = await fetch('/api/sync/amazon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType: 'all' }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Sync failed')
      }

      // Run catalog sync (products, order items, payments)
      const catalogResp = await fetch('/api/sync/amazon-catalog', {
        method: 'POST',
      })
      const catalogResult = catalogResp.ok
        ? await catalogResp.json()
        : null

      const itemsCreated = catalogResult?.summary?.order_items_created ?? 0
      const productsCreated = catalogResult?.summary?.products_created ?? 0

      toast.success('Amazon sync completed', {
        description: `Orders, inventory synced. ${productsCreated} products, ${itemsCreated} order items created.`,
      })

      // Refresh all dashboard data
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['warehouse_stock'] })
    } catch (error) {
      toast.error('Sync failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const amazonSync = syncStatuses?.find((s) => s.platform === 'amazon')

  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-4">
        {amazonSync ? (
          <div className="flex items-center gap-2 text-sm">
            {amazonSync.status === 'completed' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : amazonSync.status === 'failed' ? (
              <AlertCircle className="h-4 w-4 text-red-500" />
            ) : (
              <Clock className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-muted-foreground">
              Amazon last synced:{' '}
              <span className="font-medium text-foreground">
                {formatRelativeTime(amazonSync.lastSync)}
              </span>
            </span>
            {amazonSync.recordsProcessed > 0 && (
              <Badge variant="secondary" className="text-xs">
                {amazonSync.recordsProcessed} records
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            No sync history yet. Click Sync Now to pull Amazon data.
          </span>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={handleSyncNow}
        disabled={isSyncing}
      >
        {isSyncing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        Sync Now
      </Button>
    </div>
  )
}
