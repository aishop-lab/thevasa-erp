'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  ShoppingBag,
  Package,
  ShoppingCart,
  Loader2,
  CheckCircle2,
  Circle,
  RefreshCw,
  Unplug,
  Plug,
  Clock,
  Webhook,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformCredential {
  id: string
  team_id: string
  platform_id: string
  platform: string
  credentials: Record<string, string>
  is_connected: boolean
  last_verified_at: string | null
  created_at: string
  updated_at: string
}

interface SyncLog {
  id: string
  platform_id: string
  platform: string
  sync_type: string
  status: 'running' | 'completed' | 'failed' | 'partial'
  started_at: string
  completed_at: string | null
  error_message: string | null
  records_processed: number | null
}

// ---------------------------------------------------------------------------
// Validation Schemas
// ---------------------------------------------------------------------------

const amazonCredentialsSchema = z.object({
  client_id: z.string().min(1, 'Client ID is required'),
  client_secret: z.string().min(1, 'Client Secret is required'),
  refresh_token: z.string().min(1, 'Refresh Token is required'),
  marketplace_id: z.string().min(1, 'Marketplace ID is required'),
})

const shopifyCredentialsSchema = z.object({
  store_url: z
    .string()
    .min(1, 'Store URL is required')
    .regex(
      /^[a-zA-Z0-9-]+\.myshopify\.com$/,
      'Must be a valid Shopify store URL (e.g., thevasa.myshopify.com)'
    ),
  access_token: z.string().min(1, 'Admin API Access Token is required'),
})

type AmazonCredentials = z.infer<typeof amazonCredentialsSchema>
type ShopifyCredentials = z.infer<typeof shopifyCredentialsSchema>

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function PlatformsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-32" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helper: format relative time
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  return `${diffDays}d ago`
}

// ---------------------------------------------------------------------------
// Amazon Card Component
// ---------------------------------------------------------------------------

function AmazonPlatformCard({
  credential,
  lastSync,
  onConnect,
  onDisconnect,
  onSync,
  onTestConnection,
  isConnecting,
  isDisconnecting,
  isSyncing,
  isTesting,
}: {
  credential: PlatformCredential | null
  lastSync: SyncLog | null
  onConnect: (data: AmazonCredentials) => void
  onDisconnect: () => void
  onSync: () => void
  onTestConnection: () => void
  isConnecting: boolean
  isDisconnecting: boolean
  isSyncing: boolean
  isTesting: boolean
}) {
  const [showConnectDialog, setShowConnectDialog] = useState(false)
  const isConnected = credential?.is_connected ?? false

  const form = useForm<AmazonCredentials>({
    resolver: zodResolver(amazonCredentialsSchema),
    defaultValues: {
      client_id: '',
      client_secret: '',
      refresh_token: '',
      marketplace_id: 'A21TJRUUN4KGV',
    },
  })

  const handleConnect = (values: AmazonCredentials) => {
    onConnect(values)
    setShowConnectDialog(false)
    form.reset()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <Package className="size-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <CardTitle className="text-base">Amazon FBA</CardTitle>
              <CardDescription>
                Selling Partner API integration
              </CardDescription>
            </div>
          </div>
          {isConnected ? (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <CheckCircle2 className="mr-1 size-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary">
              <Circle className="mr-1 size-3" />
              Not Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            {/* Last Sync Info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" />
              <span>
                Last synced: {formatRelativeTime(credential?.last_verified_at ?? null)}
              </span>
              {lastSync && (
                <Badge
                  variant={lastSync.status === 'completed' ? 'default' : 'destructive'}
                  className="ml-auto text-xs"
                >
                  {lastSync.status === 'completed'
                    ? `${lastSync.records_processed ?? 0} records`
                    : 'Failed'}
                </Badge>
              )}
            </div>

            {lastSync?.status === 'failed' && lastSync.error_message && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 text-destructive" />
                  <p className="text-xs text-destructive">{lastSync.error_message}</p>
                </div>
              </div>
            )}

            <Separator />

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onTestConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Plug className="mr-2 size-4" />
                )}
                Test Connection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 size-4" />
                )}
                Sync Now
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDisconnect}
                disabled={isDisconnecting}
                className="text-destructive hover:text-destructive"
              >
                {isDisconnecting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Unplug className="mr-2 size-4" />
                )}
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plug className="mr-2 size-4" />
                Connect Amazon FBA
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Connect Amazon SP-API</DialogTitle>
                <DialogDescription>
                  Enter your Amazon Selling Partner API credentials to connect your
                  FBA account.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleConnect)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="client_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SP-API Client ID</FormLabel>
                        <FormControl>
                          <Input placeholder="amzn1.application-oa2-client...." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="client_secret"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client Secret</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Enter client secret" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="refresh_token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Refresh Token</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Atzr|..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="marketplace_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marketplace ID</FormLabel>
                        <FormControl>
                          <Input placeholder="A21TJRUUN4KGV" {...field} />
                        </FormControl>
                        <FormDescription>
                          Default: A21TJRUUN4KGV (Amazon.in)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowConnectDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isConnecting}>
                      {isConnecting && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      )}
                      Connect
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Shopify Card Component
// ---------------------------------------------------------------------------

function ShopifyPlatformCard({
  credential,
  lastSync,
  onConnect,
  onDisconnect,
  onSync,
  onTestConnection,
  isConnecting,
  isDisconnecting,
  isSyncing,
  isTesting,
}: {
  credential: PlatformCredential | null
  lastSync: SyncLog | null
  onConnect: (data: ShopifyCredentials) => void
  onDisconnect: () => void
  onSync: () => void
  onTestConnection: () => void
  isConnecting: boolean
  isDisconnecting: boolean
  isSyncing: boolean
  isTesting: boolean
}) {
  const [showConnectDialog, setShowConnectDialog] = useState(false)
  const isConnected = credential?.is_connected ?? false

  const form = useForm<ShopifyCredentials>({
    resolver: zodResolver(shopifyCredentialsSchema),
    defaultValues: {
      store_url: '',
      access_token: '',
    },
  })

  const handleConnect = (values: ShopifyCredentials) => {
    onConnect(values)
    setShowConnectDialog(false)
    form.reset()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <ShoppingBag className="size-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-base">Shopify</CardTitle>
              <CardDescription>
                GraphQL Admin API integration
              </CardDescription>
            </div>
          </div>
          {isConnected ? (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <CheckCircle2 className="mr-1 size-3" />
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary">
              <Circle className="mr-1 size-3" />
              Not Connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            {/* Last Sync Info */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" />
              <span>
                Last synced: {formatRelativeTime(credential?.last_verified_at ?? null)}
              </span>
              {lastSync && (
                <Badge
                  variant={lastSync.status === 'completed' ? 'default' : 'destructive'}
                  className="ml-auto text-xs"
                >
                  {lastSync.status === 'completed'
                    ? `${lastSync.records_processed ?? 0} records`
                    : 'Failed'}
                </Badge>
              )}
            </div>

            {/* Webhook Status */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Webhook className="size-4" />
              <span>Webhooks: Active</span>
              <Badge variant="outline" className="ml-auto text-xs">
                Configured
              </Badge>
            </div>

            {lastSync?.status === 'failed' && lastSync.error_message && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 text-destructive" />
                  <p className="text-xs text-destructive">{lastSync.error_message}</p>
                </div>
              </div>
            )}

            <Separator />

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onTestConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Plug className="mr-2 size-4" />
                )}
                Test Connection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onSync}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 size-4" />
                )}
                Sync Now
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDisconnect}
                disabled={isDisconnecting}
                className="text-destructive hover:text-destructive"
              >
                {isDisconnecting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Unplug className="mr-2 size-4" />
                )}
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <Plug className="mr-2 size-4" />
                Connect Shopify
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Connect Shopify Store</DialogTitle>
                <DialogDescription>
                  Enter your Shopify store details and Admin API access token.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleConnect)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="store_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Store URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="thevasa.myshopify.com"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Your Shopify store domain (e.g., thevasa.myshopify.com)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="access_token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Admin API Access Token</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="shpat_..."
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Custom app Admin API access token
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowConnectDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isConnecting}>
                      {isConnecting && (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      )}
                      Connect
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Myntra Coming Soon Card
// ---------------------------------------------------------------------------

function MyntraPlatformCard() {
  return (
    <Card className="opacity-60">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-900/30">
              <ShoppingCart className="size-5 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <CardTitle className="text-base">Myntra</CardTitle>
              <CardDescription>
                Marketplace integration
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline">Coming Soon</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Myntra integration will be available in v2. Stay tuned for updates.
        </p>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function PlatformsPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  // Fetch platforms lookup
  const { data: platforms } = useQuery({
    queryKey: ['platforms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platforms')
        .select('id, name, display_name')

      if (error) throw error
      return data
    },
  })

  // Helper to get platform UUID by name
  const getPlatformId = (name: string) =>
    platforms?.find((p) => p.name === name)?.id

  // Fetch platform credentials with platform name
  const {
    data: credentials,
    isLoading: isLoadingCredentials,
  } = useQuery({
    queryKey: ['platform_credentials', platforms],
    enabled: !!platforms,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_credentials')
        .select('*, platform_ref:platforms(name)')

      if (error) throw error
      return (data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        platform: (row.platform_ref as { name: string } | null)?.name ?? '',
      })) as unknown as PlatformCredential[]
    },
  })

  // Fetch latest sync logs with platform name
  const { data: syncLogs } = useQuery({
    queryKey: ['sync_logs', 'latest', platforms],
    enabled: !!platforms,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*, platform_ref:platforms(name)')
        .order('started_at', { ascending: false })
        .limit(10)

      if (error) throw error
      return (data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        platform: (row.platform_ref as { name: string } | null)?.name ?? '',
      })) as unknown as SyncLog[]
    },
  })

  const amazonCredential = credentials?.find((c) => c.platform === 'amazon') ?? null
  const shopifyCredential = credentials?.find((c) => c.platform === 'shopify') ?? null
  const amazonLastSync = syncLogs?.find((l) => l.platform === 'amazon') ?? null
  const shopifyLastSync = syncLogs?.find((l) => l.platform === 'shopify') ?? null

  // Connect Amazon
  const connectAmazon = useMutation({
    mutationFn: async (data: AmazonCredentials) => {
      let platformId = getPlatformId('amazon')

      // Create platform record if it doesn't exist
      if (!platformId) {
        const { data: newPlatform, error: createError } = await supabase
          .from('platforms')
          .insert({ name: 'amazon', display_name: 'Amazon FBA', is_active: true })
          .select('id')
          .single()

        if (createError) throw createError
        platformId = newPlatform.id
      }

      const { error } = await (supabase.from('platform_credentials') as any).upsert(
        {
          platform_id: platformId,
          credentials: data,
          is_connected: true,
        },
        { onConflict: 'team_id,platform_id' }
      )
      if (error) throw error

      // Also create FBA warehouse if it doesn't exist
      const { data: existingFba } = await supabase
        .from('warehouses')
        .select('id')
        .eq('is_fba', true)
        .single()

      if (!existingFba) {
        await supabase.from('warehouses').insert({
          name: 'Amazon FBA Warehouse',
          code: 'FBA',
          is_fba: true,
          platform_id: platformId,
          is_active: true,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform_credentials'] })
      queryClient.invalidateQueries({ queryKey: ['platforms'] })
      toast.success('Amazon FBA connected successfully')
    },
    onError: (err: Error) => {
      toast.error(`Failed to connect Amazon: ${err.message}`)
    },
  })

  // Connect Shopify
  const connectShopify = useMutation({
    mutationFn: async (data: ShopifyCredentials) => {
      let platformId = getPlatformId('shopify')

      if (!platformId) {
        const { data: newPlatform, error: createError } = await supabase
          .from('platforms')
          .insert({ name: 'shopify', display_name: 'Shopify', is_active: true })
          .select('id')
          .single()

        if (createError) throw createError
        platformId = newPlatform.id
      }

      const { error } = await (supabase.from('platform_credentials') as any).upsert(
        {
          platform_id: platformId,
          credentials: data,
          is_connected: true,
        },
        { onConflict: 'team_id,platform_id' }
      )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform_credentials'] })
      queryClient.invalidateQueries({ queryKey: ['platforms'] })
      toast.success('Shopify store connected successfully')
    },
    onError: (err: Error) => {
      toast.error(`Failed to connect Shopify: ${err.message}`)
    },
  })

  // Disconnect platform
  const disconnectPlatform = useMutation({
    mutationFn: async (platform: 'amazon' | 'shopify') => {
      const platformId = getPlatformId(platform)
      if (!platformId) throw new Error('Platform not found')

      const { error } = await supabase
        .from('platform_credentials')
        .update({ is_connected: false })
        .eq('platform_id', platformId)

      if (error) throw error
    },
    onSuccess: (_, platform) => {
      queryClient.invalidateQueries({ queryKey: ['platform_credentials'] })
      toast.success(
        `${platform === 'amazon' ? 'Amazon FBA' : 'Shopify'} disconnected`
      )
    },
    onError: (err: Error) => {
      toast.error(`Failed to disconnect: ${err.message}`)
    },
  })

  // Sync platform
  const syncPlatform = useMutation({
    mutationFn: async (platform: 'amazon' | 'shopify') => {
      const response = await fetch(`/api/sync/${platform}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType: 'all' }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || `Sync failed with status ${response.status}`)
      }
      return response.json()
    },
    onSuccess: (_, platform) => {
      queryClient.invalidateQueries({ queryKey: ['sync_logs'] })
      queryClient.invalidateQueries({ queryKey: ['platform_credentials'] })
      toast.success(
        `${platform === 'amazon' ? 'Amazon FBA' : 'Shopify'} sync started`
      )
    },
    onError: (err: Error) => {
      toast.error(`Sync failed: ${err.message}`)
    },
  })

  // Test connection
  const testConnection = useMutation({
    mutationFn: async (platform: 'amazon' | 'shopify') => {
      const response = await fetch(`/api/sync/${platform}/test`, {
        method: 'POST',
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Connection test failed')
      }
      return response.json()
    },
    onSuccess: (_, platform) => {
      toast.success(
        `${platform === 'amazon' ? 'Amazon FBA' : 'Shopify'} connection is healthy`
      )
    },
    onError: (err: Error) => {
      toast.error(`Connection test failed: ${err.message}`)
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Platform Connections
        </h1>
        <p className="text-muted-foreground">
          Connect and manage your sales channels
        </p>
      </div>

      {isLoadingCredentials ? (
        <PlatformsSkeleton />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <AmazonPlatformCard
            credential={amazonCredential}
            lastSync={amazonLastSync}
            onConnect={(data) => connectAmazon.mutate(data)}
            onDisconnect={() => disconnectPlatform.mutate('amazon')}
            onSync={() => syncPlatform.mutate('amazon')}
            onTestConnection={() => testConnection.mutate('amazon')}
            isConnecting={connectAmazon.isPending}
            isDisconnecting={disconnectPlatform.isPending}
            isSyncing={syncPlatform.isPending}
            isTesting={testConnection.isPending}
          />

          <ShopifyPlatformCard
            credential={shopifyCredential}
            lastSync={shopifyLastSync}
            onConnect={(data) => connectShopify.mutate(data)}
            onDisconnect={() => disconnectPlatform.mutate('shopify')}
            onSync={() => syncPlatform.mutate('shopify')}
            onTestConnection={() => testConnection.mutate('shopify')}
            isConnecting={connectShopify.isPending}
            isDisconnecting={disconnectPlatform.isPending}
            isSyncing={syncPlatform.isPending}
            isTesting={testConnection.isPending}
          />

          <MyntraPlatformCard />
        </div>
      )}
    </div>
  )
}
