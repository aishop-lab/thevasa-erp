'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { usePermissions, type NavSection, type SettingsChild } from '@/hooks/use-permissions'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Warehouse,
  IndianRupee,
  Settings,
  ChevronLeft,
  Menu,
  BoxesIcon,
  ArrowLeftRight,
  AlertTriangle,
  TrendingUp,
  Receipt,
  FileText,
  Building2,
  Users,
  Plug,
  BarChart3,
} from 'lucide-react'

interface NavChild {
  label: string
  href: string
  icon: typeof LayoutDashboard
  /** For settings children, used for role-based visibility */
  settingsKey?: SettingsChild
}

interface NavItemDef {
  label: string
  href: string
  icon: typeof LayoutDashboard
  /** Maps to NavSection for role filtering */
  navSection: NavSection
  children?: NavChild[]
}

const navigation: NavItemDef[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    navSection: 'Dashboard',
  },
  {
    label: 'Products',
    href: '/products',
    icon: Package,
    navSection: 'Products',
  },
  {
    label: 'Inventory',
    href: '/inventory',
    icon: Warehouse,
    navSection: 'Inventory',
    children: [
      { label: 'Stock Overview', href: '/inventory', icon: BoxesIcon },
      { label: 'Discrepancies', href: '/inventory/discrepancies', icon: AlertTriangle },
      { label: 'Movements', href: '/inventory/movements', icon: ArrowLeftRight },
    ],
  },
  {
    label: 'Orders',
    href: '/orders',
    icon: ShoppingCart,
    navSection: 'Orders',
  },
  {
    label: 'Finance',
    href: '/finance',
    icon: IndianRupee,
    navSection: 'Finance',
    children: [
      { label: 'Overview', href: '/finance', icon: BarChart3 },
      { label: 'Revenue', href: '/finance/revenue', icon: TrendingUp },
      { label: 'Expenses', href: '/finance/expenses', icon: Receipt },
      { label: 'P&L Report', href: '/finance/pnl', icon: FileText },
      { label: 'GST', href: '/finance/gst', icon: FileText },
      { label: 'Settlements', href: '/finance/settlements', icon: IndianRupee },
    ],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    navSection: 'Settings',
    children: [
      { label: 'General', href: '/settings', icon: Settings, settingsKey: 'General' as SettingsChild },
      { label: 'Platforms', href: '/settings/platforms', icon: Plug, settingsKey: 'Platforms' as SettingsChild },
      { label: 'Team', href: '/settings/team', icon: Users, settingsKey: 'Team' as SettingsChild },
      { label: 'Warehouses', href: '/settings/warehouses', icon: Building2, settingsKey: 'Warehouses' as SettingsChild },
    ],
  },
]

function NavItem({
  item,
  collapsed,
  visibleChildren,
}: {
  item: NavItemDef
  collapsed: boolean
  visibleChildren?: NavChild[]
}) {
  const pathname = usePathname()
  const children = visibleChildren ?? item.children
  const isActive = pathname === item.href || (children && children.some((c) => pathname === c.href))
  const [expanded, setExpanded] = useState(isActive)

  if (children && children.length > 0 && !collapsed) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronLeft
            className={cn('h-4 w-4 transition-transform', expanded && '-rotate-90')}
          />
        </button>
        {expanded && (
          <div className="ml-4 mt-1 space-y-1 border-l pl-3">
            {children.map((child) => (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors',
                  pathname === child.href
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <child.icon className="h-3.5 w-3.5 shrink-0" />
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        collapsed && 'justify-center px-2'
      )}
      title={collapsed ? item.label : undefined}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )
}

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  const permissions = usePermissions()

  // While loading or if role is unknown, show all navigation items
  const shouldFilter = !permissions.isLoading && permissions.role !== null

  // Filter navigation items and their children based on role
  const filteredNav = navigation
    .filter((item) => !shouldFilter || permissions.canViewNav(item.navSection))
    .map((item) => {
      // For Settings, filter children by settingsKey
      if (shouldFilter && item.navSection === 'Settings' && item.children) {
        const visibleChildren = item.children.filter(
          (child) => !child.settingsKey || permissions.canViewSettingsChild(child.settingsKey)
        )
        return { ...item, filteredChildren: visibleChildren }
      }
      return { ...item, filteredChildren: item.children }
    })

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-14 items-center border-b px-4', collapsed && 'justify-center px-2')}>
        {!collapsed ? (
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <BoxesIcon className="h-6 w-6 text-primary" />
            Thevasa ERP
          </Link>
        ) : (
          <Link href="/">
            <BoxesIcon className="h-6 w-6 text-primary" />
          </Link>
        )}
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {filteredNav.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              collapsed={collapsed}
              visibleChildren={item.filteredChildren}
            />
          ))}
        </nav>
      </ScrollArea>
    </div>
  )
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r bg-background transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <SidebarContent collapsed={collapsed} />
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft
              className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')}
            />
            {!collapsed && <span className="ml-2">Collapse</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden fixed top-3 left-3 z-40">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent collapsed={false} />
        </SheetContent>
      </Sheet>
    </>
  )
}
