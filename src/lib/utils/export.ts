/**
 * Utility for exporting table data as CSV.
 *
 * Usage:
 *   downloadCSV(rows, columns, 'orders-export')
 */

interface ExportColumn<T> {
  /** Header label in the CSV */
  header: string
  /** Extract the cell value from a row */
  accessor: (row: T) => string | number | null | undefined
}

/**
 * Convert an array of objects to CSV string.
 */
function toCSV<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const headers = columns.map((c) => escapeCSV(c.header))
  const lines = rows.map((row) =>
    columns.map((c) => escapeCSV(String(c.accessor(row) ?? ''))).join(',')
  )
  return [headers.join(','), ...lines].join('\n')
}

/**
 * Escape a CSV value: wrap in quotes if it contains commas, quotes, or newlines.
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Trigger a browser download of a CSV file.
 */
export function downloadCSV<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  const csv = toCSV(rows, columns)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
