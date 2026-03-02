'use client'

import { StatsCards } from '@/components/dashboard/stats-cards'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { PlatformComparison } from '@/components/dashboard/platform-comparison'
import { InventoryAlerts } from '@/components/dashboard/inventory-alerts'
import { SyncStatusBanner } from '@/components/dashboard/sync-status'
import { RecentOrders } from '@/components/dashboard/recent-orders'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your business across all channels</p>
      </div>
      <SyncStatusBanner />
      <StatsCards />
      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChart />
        <PlatformComparison />
      </div>
      <RecentOrders />
      <InventoryAlerts />
    </div>
  )
}
