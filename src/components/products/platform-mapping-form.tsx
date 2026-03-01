'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Platform {
  id: string
  name: string
  type: 'shopify' | 'amazon' | 'myntra' | 'manual'
  is_active: boolean
}

interface Variant {
  id: string
  variant_sku: string
}

interface PlatformMapping {
  id: string
  platform_id: string
  variant_id: string
  external_product_id: string | null
  external_variant_id: string | null
  external_asin: string | null
  external_sku: string | null
}

interface MappingRow {
  variantId: string
  variantSku: string
  shopifyProductId: string
  shopifyVariantId: string
  amazonAsin: string
  amazonSku: string
  existingMappings: {
    shopify?: PlatformMapping
    amazon?: PlatformMapping
  }
}

interface PlatformMappingFormProps {
  productId: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlatformMappingForm({ productId }: PlatformMappingFormProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [rows, setRows] = useState<MappingRow[]>([])
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch connected platforms
  const { data: platforms, isLoading: platformsLoading } = useQuery({
    queryKey: ['platforms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platforms')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      return data as unknown as Platform[]
    },
  })

  // Fetch variants for this product
  const { data: variants, isLoading: variantsLoading } = useQuery({
    queryKey: ['product-variants', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, variant_sku')
        .eq('product_id', productId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Variant[]
    },
  })

  // Fetch existing platform mappings for all variants of this product
  const { data: mappings, isLoading: mappingsLoading } = useQuery({
    queryKey: ['platform-mappings', productId],
    enabled: !!variants && variants.length > 0,
    queryFn: async () => {
      const variantIds = variants!.map((v) => v.id)
      const { data, error } = await supabase
        .from('platform_mappings')
        .select('*')
        .in('variant_id', variantIds)

      if (error) throw error
      return data as unknown as PlatformMapping[]
    },
  })

  // Derive platform IDs
  const shopifyPlatform = platforms?.find((p) => p.type === 'shopify')
  const amazonPlatform = platforms?.find((p) => p.type === 'amazon')

  // Build rows from variants + existing mappings
  useEffect(() => {
    if (!variants) return

    const newRows: MappingRow[] = variants.map((variant) => {
      const shopifyMapping = mappings?.find(
        (m) =>
          m.variant_id === variant.id &&
          m.platform_id === shopifyPlatform?.id
      )
      const amazonMapping = mappings?.find(
        (m) =>
          m.variant_id === variant.id &&
          m.platform_id === amazonPlatform?.id
      )

      return {
        variantId: variant.id,
        variantSku: variant.variant_sku,
        shopifyProductId: shopifyMapping?.external_product_id ?? '',
        shopifyVariantId: shopifyMapping?.external_variant_id ?? '',
        amazonAsin: amazonMapping?.external_asin ?? '',
        amazonSku: amazonMapping?.external_sku ?? '',
        existingMappings: {
          shopify: shopifyMapping,
          amazon: amazonMapping,
        },
      }
    })

    setRows(newRows)
    setHasChanges(false)
  }, [variants, mappings, shopifyPlatform?.id, amazonPlatform?.id])

  // Update a field in a row
  function updateRow(
    index: number,
    field: keyof Omit<MappingRow, 'variantId' | 'variantSku' | 'existingMappings'>,
    value: string
  ) {
    setRows((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
    setHasChanges(true)
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const upserts: Array<{
        id?: string
        platform_id: string
        variant_id: string
        external_product_id: string | null
        external_variant_id: string | null
        external_asin: string | null
        external_sku: string | null
      }> = []

      for (const row of rows) {
        // Shopify mapping
        if (shopifyPlatform && (row.shopifyProductId || row.shopifyVariantId)) {
          upserts.push({
            ...(row.existingMappings.shopify?.id
              ? { id: row.existingMappings.shopify.id }
              : {}),
            platform_id: shopifyPlatform.id,
            variant_id: row.variantId,
            external_product_id: row.shopifyProductId || null,
            external_variant_id: row.shopifyVariantId || null,
            external_asin: null,
            external_sku: null,
          })
        }

        // Amazon mapping
        if (amazonPlatform && (row.amazonAsin || row.amazonSku)) {
          upserts.push({
            ...(row.existingMappings.amazon?.id
              ? { id: row.existingMappings.amazon.id }
              : {}),
            platform_id: amazonPlatform.id,
            variant_id: row.variantId,
            external_product_id: null,
            external_variant_id: null,
            external_asin: row.amazonAsin || null,
            external_sku: row.amazonSku || null,
          })
        }
      }

      if (upserts.length === 0) return

      const { error } = await supabase
        .from('platform_mappings')
        .upsert(upserts, { onConflict: 'id' })

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['platform-mappings', productId],
      })
      toast.success('Platform mappings saved successfully')
      setHasChanges(false)
    },
    onError: (error: Error) => {
      toast.error(`Failed to save mappings: ${error.message}`)
    },
  })

  const isLoading = platformsLoading || variantsLoading || mappingsLoading
  const hasShopify = !!shopifyPlatform
  const hasAmazon = !!amazonPlatform
  const hasAnyPlatform = hasShopify || hasAmazon

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-9 w-20" />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-24" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 3 }).map((_, rowIdx) => (
                <TableRow key={rowIdx}>
                  {Array.from({ length: 5 }).map((_, colIdx) => (
                    <TableCell key={colIdx}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  if (!hasAnyPlatform) {
    return (
      <div className="rounded-md border p-6 text-center">
        <p className="text-muted-foreground text-sm">
          No platforms connected yet. Connect Shopify or Amazon in Settings to
          map your products.
        </p>
      </div>
    )
  }

  if (!variants || variants.length === 0) {
    return (
      <div className="rounded-md border p-6 text-center">
        <p className="text-muted-foreground text-sm">
          Add variants to this product first before mapping to platforms.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          Map each variant to its corresponding IDs on each platform
        </p>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={!hasChanges || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <Save className="mr-2 size-4" />
          )}
          Save Mappings
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[140px]">Variant SKU</TableHead>
              {hasShopify && (
                <>
                  <TableHead className="min-w-[180px]">
                    Shopify Product ID
                  </TableHead>
                  <TableHead className="min-w-[180px]">
                    Shopify Variant ID
                  </TableHead>
                </>
              )}
              {hasAmazon && (
                <>
                  <TableHead className="min-w-[160px]">Amazon ASIN</TableHead>
                  <TableHead className="min-w-[160px]">Amazon SKU</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={row.variantId}>
                <TableCell className="font-mono text-sm">
                  {row.variantSku}
                </TableCell>
                {hasShopify && (
                  <>
                    <TableCell>
                      <Input
                        value={row.shopifyProductId}
                        onChange={(e) =>
                          updateRow(index, 'shopifyProductId', e.target.value)
                        }
                        placeholder="e.g. 7654321098765"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.shopifyVariantId}
                        onChange={(e) =>
                          updateRow(index, 'shopifyVariantId', e.target.value)
                        }
                        placeholder="e.g. 43210987654321"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                  </>
                )}
                {hasAmazon && (
                  <>
                    <TableCell>
                      <Input
                        value={row.amazonAsin}
                        onChange={(e) =>
                          updateRow(index, 'amazonAsin', e.target.value)
                        }
                        placeholder="e.g. B0ABCDEF12"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.amazonSku}
                        onChange={(e) =>
                          updateRow(index, 'amazonSku', e.target.value)
                        }
                        placeholder="e.g. SHIRT-OXF-001-L-BLU"
                        className="h-8 text-sm"
                      />
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
