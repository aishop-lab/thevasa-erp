'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { usePermissions } from '@/hooks/use-permissions'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  IndianRupee,
  Settings,
  AlertTriangle,
  ArrowLeftRight,
  SlidersHorizontal,
  Download,
  Search,
  FileText,
  Users,
  Plug,
  Building2,
  BarChart3,
  TrendingUp,
  Receipt,
  BoxesIcon,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Search hooks
// ---------------------------------------------------------------------------

function useRecentOrders(search: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['command-orders', search],
    enabled: search.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, status')
        .or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%`)
        .order('ordered_at', { ascending: false })
        .limit(5)

      if (error) throw error
      return data ?? []
    },
    staleTime: 10_000,
  })
}

function useProductSearch(search: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['command-products', search],
    enabled: search.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku')
        .or(`name.ilike.%${search}%,sku.ilike.%${search}%`)
        .order('name')
        .limit(5)

      if (error) throw error
      return data ?? []
    },
    staleTime: 10_000,
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const router = useRouter()
  const { canViewNav } = usePermissions()

  const { data: orders } = useRecentOrders(search)
  const { data: products } = useProductSearch(search)

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const navigate = useCallback(
    (href: string) => {
      setOpen(false)
      setSearch('')
      router.push(href)
    },
    [router]
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen} showCloseButton={false}>
      <CommandInput
        placeholder="Search orders, products, or navigate..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Search results: Orders */}
        {orders && orders.length > 0 && (
          <CommandGroup heading="Orders">
            {orders.map((order) => (
              <CommandItem
                key={order.id}
                value={`order-${order.order_number}`}
                onSelect={() => navigate(`/orders/${order.id}`)}
              >
                <ShoppingCart className="size-4 text-muted-foreground" />
                <span className="font-mono">{order.order_number}</span>
                {order.customer_name && (
                  <span className="text-muted-foreground ml-2">
                    {order.customer_name}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground capitalize">
                  {order.status}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Search results: Products */}
        {products && products.length > 0 && (
          <CommandGroup heading="Products">
            {products.map((product) => (
              <CommandItem
                key={product.id}
                value={`product-${product.name}-${product.sku}`}
                onSelect={() => navigate(`/products/${product.id}`)}
              >
                <Package className="size-4 text-muted-foreground" />
                <span>{product.name}</span>
                <span className="ml-auto text-xs font-mono text-muted-foreground">
                  {product.sku}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {(orders && orders.length > 0) || (products && products.length > 0) ? (
          <CommandSeparator />
        ) : null}

        {/* Navigation */}
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => navigate('/')}>
            <LayoutDashboard className="size-4 text-muted-foreground" />
            Dashboard
          </CommandItem>
          {canViewNav('Products') && (
            <CommandItem onSelect={() => navigate('/products')}>
              <Package className="size-4 text-muted-foreground" />
              Products
            </CommandItem>
          )}
          {canViewNav('Inventory') && (
            <>
              <CommandItem onSelect={() => navigate('/inventory')}>
                <BoxesIcon className="size-4 text-muted-foreground" />
                Stock Overview
              </CommandItem>
              <CommandItem onSelect={() => navigate('/inventory/discrepancies')}>
                <AlertTriangle className="size-4 text-muted-foreground" />
                Discrepancies
              </CommandItem>
              <CommandItem onSelect={() => navigate('/inventory/movements')}>
                <ArrowLeftRight className="size-4 text-muted-foreground" />
                Stock Movements
              </CommandItem>
            </>
          )}
          {canViewNav('Orders') && (
            <CommandItem onSelect={() => navigate('/orders')}>
              <ShoppingCart className="size-4 text-muted-foreground" />
              Orders
            </CommandItem>
          )}
          {canViewNav('Finance') && (
            <>
              <CommandItem onSelect={() => navigate('/finance')}>
                <BarChart3 className="size-4 text-muted-foreground" />
                Finance Overview
              </CommandItem>
              <CommandItem onSelect={() => navigate('/finance/revenue')}>
                <TrendingUp className="size-4 text-muted-foreground" />
                Revenue
              </CommandItem>
              <CommandItem onSelect={() => navigate('/finance/expenses')}>
                <Receipt className="size-4 text-muted-foreground" />
                Expenses
              </CommandItem>
              <CommandItem onSelect={() => navigate('/finance/pnl')}>
                <FileText className="size-4 text-muted-foreground" />
                P&L Report
              </CommandItem>
            </>
          )}
          {canViewNav('Settings') && (
            <>
              <CommandItem onSelect={() => navigate('/settings')}>
                <Settings className="size-4 text-muted-foreground" />
                Settings
              </CommandItem>
              <CommandItem onSelect={() => navigate('/settings/team')}>
                <Users className="size-4 text-muted-foreground" />
                Team
              </CommandItem>
              <CommandItem onSelect={() => navigate('/settings/platforms')}>
                <Plug className="size-4 text-muted-foreground" />
                Platforms
              </CommandItem>
              <CommandItem onSelect={() => navigate('/settings/warehouses')}>
                <Building2 className="size-4 text-muted-foreground" />
                Warehouses
              </CommandItem>
            </>
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
