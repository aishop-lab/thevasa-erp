'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, Package } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useInventoryAlerts, type InventoryAlert } from '@/hooks/use-dashboard'

type Severity = 'critical' | 'warning' | 'minor'

const severityConfig: Record<
  Severity,
  { label: string; className: string }
> = {
  critical: {
    label: 'Critical',
    className:
      'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900',
  },
  warning: {
    label: 'Warning',
    className:
      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900',
  },
  minor: {
    label: 'Minor',
    className:
      'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900',
  },
}

const typeLabels: Record<InventoryAlert['type'], string> = {
  low_stock: 'Low Stock',
  discrepancy: 'Discrepancy',
}

function InventoryAlertsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-52" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export function InventoryAlerts() {
  const { data: alerts, isLoading } = useInventoryAlerts()

  if (isLoading) {
    return <InventoryAlertsSkeleton />
  }

  const alertList = alerts ?? []
  const criticalCount = alertList.filter(
    (a) => a.severity === 'critical'
  ).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              Inventory Alerts
              {criticalCount > 0 && (
                <Badge
                  variant="destructive"
                  className="text-xs tabular-nums"
                >
                  {criticalCount} critical
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Items that need immediate attention
            </CardDescription>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {alertList.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No inventory alerts. All stock levels are healthy.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Details
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertList.map((alert) => {
                const severity = severityConfig[alert.severity]

                return (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {alert.productName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {alert.variantSku}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'text-sm font-semibold tabular-nums',
                          alert.currentStock === 0
                            ? 'text-red-600'
                            : alert.currentStock < 5
                              ? 'text-red-500'
                              : alert.currentStock < 10
                                ? 'text-amber-500'
                                : 'text-foreground'
                        )}
                      >
                        {alert.currentStock}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {typeLabels[alert.type]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn('text-xs', severity.className)}
                      >
                        {severity.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {alert.details}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button variant="ghost" size="sm" className="ml-auto" asChild>
          <Link href="/inventory/discrepancies">
            View all alerts
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
