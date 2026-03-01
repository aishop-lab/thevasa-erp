'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { Fragment } from 'react'

const labelMap: Record<string, string> = {
  '': 'Dashboard',
  inventory: 'Inventory',
  discrepancies: 'Discrepancies',
  movements: 'Movements',
  orders: 'Orders',
  products: 'Products',
  new: 'New',
  finance: 'Finance',
  revenue: 'Revenue',
  expenses: 'Expenses',
  pnl: 'P&L Report',
  gst: 'GST',
  settlements: 'Settlements',
  settings: 'Settings',
  platforms: 'Platforms',
  team: 'Team',
  warehouses: 'Warehouses',
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return <h1 className="text-lg font-semibold">Dashboard</h1>
  }

  const crumbs = segments.map((segment, index) => {
    const href = '/' + segments.slice(0, index + 1).join('/')
    const label = labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
    const isLast = index === segments.length - 1

    return { href, label, isLast }
  })

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
        Dashboard
      </Link>
      {crumbs.map((crumb) => (
        <Fragment key={crumb.href}>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          {crumb.isLast ? (
            <span className="font-medium">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
