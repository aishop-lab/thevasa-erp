'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
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

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Resolve a UUID segment to a human-readable label
 * based on the parent segment (e.g., orders/uuid -> order number).
 */
function useDynamicLabel(parentSegment: string | undefined, id: string) {
  const supabase = createClient()
  const isUUID = UUID_REGEX.test(id)

  return useQuery({
    queryKey: ['breadcrumb', parentSegment, id],
    enabled: isUUID && !!parentSegment,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (parentSegment === 'orders') {
        const { data } = await supabase
          .from('orders')
          .select('order_number')
          .eq('id', id)
          .single()
        return data?.order_number ? `#${data.order_number}` : id.slice(0, 8)
      }
      if (parentSegment === 'products') {
        const { data } = await supabase
          .from('products')
          .select('name')
          .eq('id', id)
          .single()
        return data?.name ?? id.slice(0, 8)
      }
      return id.slice(0, 8)
    },
  })
}

function BreadcrumbItem({
  segment,
  parentSegment,
  href,
  isLast,
}: {
  segment: string
  parentSegment: string | undefined
  href: string
  isLast: boolean
}) {
  const isUUID = UUID_REGEX.test(segment)
  const { data: dynamicLabel } = useDynamicLabel(parentSegment, segment)

  const label = isUUID
    ? (dynamicLabel ?? segment.slice(0, 8) + '...')
    : (labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1))

  return (
    <>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      {isLast ? (
        <span className="font-medium truncate max-w-[160px]">{label}</span>
      ) : (
        <Link
          href={href}
          className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[160px]"
        >
          {label}
        </Link>
      )}
    </>
  )
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return <h1 className="text-lg font-semibold">Dashboard</h1>
  }

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
        Dashboard
      </Link>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          <BreadcrumbItem
            segment={segment}
            parentSegment={index > 0 ? segments[index - 1] : undefined}
            href={'/' + segments.slice(0, index + 1).join('/')}
            isLast={index === segments.length - 1}
          />
        </Fragment>
      ))}
    </nav>
  )
}
