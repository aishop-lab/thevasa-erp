'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils/currency'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GstHsnRow {
  hsn_code: string
  description: string
  taxable_amount: number
  cgst: number
  sgst: number
  igst: number
  total_tax: number
}

interface GstSummaryProps {
  data: GstHsnRow[]
  title?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GstSummary({ data, title = 'GST Summary - HSN Wise' }: GstSummaryProps) {
  const totals = data.reduce(
    (acc, row) => ({
      taxable_amount: acc.taxable_amount + row.taxable_amount,
      cgst: acc.cgst + row.cgst,
      sgst: acc.sgst + row.sgst,
      igst: acc.igst + row.igst,
      total_tax: acc.total_tax + row.total_tax,
    }),
    { taxable_amount: 0, cgst: 0, sgst: 0, igst: 0, total_tax: 0 }
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>HSN Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Taxable Amount</TableHead>
                <TableHead className="text-right">CGST</TableHead>
                <TableHead className="text-right">SGST</TableHead>
                <TableHead className="text-right">IGST</TableHead>
                <TableHead className="text-right">Total Tax</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length > 0 ? (
                data.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-sm">
                      {row.hsn_code}
                    </TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.taxable_amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.cgst)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.sgst)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.igst)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatCurrency(row.total_tax)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-16 text-center">
                    No GST data available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            {data.length > 0 && (
              <TableFooter>
                <TableRow className="font-semibold">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(totals.taxable_amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(totals.cgst)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(totals.sgst)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(totals.igst)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(totals.total_tax)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
