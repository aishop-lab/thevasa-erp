'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { formatDate } from '@/lib/utils/date'
import { ArrowRight, ShoppingCart } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  processing: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  delivered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  returned: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
}

function useRecentOrders() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['dashboard-recent-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, total_amount, status, ordered_at, platform:platforms(name, display_name)')
        .order('ordered_at', { ascending: false })
        .limit(8)

      if (error) throw error
      return data ?? []
    },
    staleTime: 60_000,
  })
}

export function RecentOrders() {
  const { data: orders, isLoading } = useRecentOrders()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShoppingCart className="h-4 w-4" />
          Recent Orders
        </CardTitle>
        <Link href="/orders">
          <Button variant="ghost" size="sm" className="text-xs">
            View all
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="px-0">
        {isLoading ? (
          <div className="space-y-3 px-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : orders && orders.length > 0 ? (
          <div className="divide-y">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="flex items-center justify-between px-6 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium font-mono truncate">
                      {order.order_number}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {order.customer_name ?? 'N/A'} &middot; {order.ordered_at ? formatDate(order.ordered_at, 'dd MMM') : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge
                    className={cn(
                      'border-0 capitalize text-[10px]',
                      STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-800'
                    )}
                  >
                    {order.status}
                  </Badge>
                  <span className="text-sm font-medium tabular-nums w-20 text-right">
                    {formatCurrency(order.total_amount ?? 0)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-6 text-sm text-muted-foreground">No orders yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
