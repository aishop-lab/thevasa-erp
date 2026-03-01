'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/currency'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PnlLineItem {
  label: string
  shopify?: number
  amazon?: number
  total: number
  isHeader?: boolean
  isSubItem?: boolean
  isTotal?: boolean
  isBold?: boolean
  isPercentage?: boolean
}

export interface PnlData {
  period: string
  lines: PnlLineItem[]
}

interface PnlReportProps {
  data: PnlData
  showPlatformColumns?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PnlReport({ data, showPlatformColumns = true }: PnlReportProps) {
  const formatValue = (value: number | undefined, isPercentage?: boolean) => {
    if (value === undefined || value === null) return '-'
    if (isPercentage) {
      return `${value >= 0 ? '' : '-'}${Math.abs(value).toFixed(1)}%`
    }
    return formatCurrency(value)
  }

  const getValueColor = (value: number | undefined, isPercentage?: boolean) => {
    if (value === undefined || value === null) return ''
    if (isPercentage) {
      return value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
    }
    return ''
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profit & Loss Statement</CardTitle>
        <p className="text-sm text-muted-foreground">{data.period}</p>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Particulars</TableHead>
                {showPlatformColumns && (
                  <>
                    <TableHead className="text-right">Shopify</TableHead>
                    <TableHead className="text-right">Amazon</TableHead>
                  </>
                )}
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lines.map((line, idx) => {
                const isSection = line.isHeader
                const isSubItem = line.isSubItem
                const isTotalRow = line.isTotal || line.isBold
                const isPercentage = line.isPercentage

                return (
                  <TableRow
                    key={idx}
                    className={cn(
                      isSection && 'bg-muted/50',
                      isTotalRow && 'border-t-2 font-semibold'
                    )}
                  >
                    <TableCell
                      className={cn(
                        isSection && 'font-semibold text-foreground',
                        isSubItem && 'pl-8',
                        isTotalRow && 'font-semibold'
                      )}
                    >
                      {line.label}
                    </TableCell>
                    {showPlatformColumns && (
                      <>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums',
                            isTotalRow && 'font-semibold',
                            getValueColor(line.shopify, isPercentage)
                          )}
                        >
                          {isSection ? '' : formatValue(line.shopify, isPercentage)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums',
                            isTotalRow && 'font-semibold',
                            getValueColor(line.amazon, isPercentage)
                          )}
                        >
                          {isSection ? '' : formatValue(line.amazon, isPercentage)}
                        </TableCell>
                      </>
                    )}
                    <TableCell
                      className={cn(
                        'text-right tabular-nums',
                        isTotalRow && 'font-semibold',
                        getValueColor(line.total, isPercentage)
                      )}
                    >
                      {isSection ? '' : formatValue(line.total, isPercentage)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
