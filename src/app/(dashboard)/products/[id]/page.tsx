'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProductForm } from '@/components/products/product-form'
import { VariantManager } from '@/components/products/variant-manager'
import { PlatformMappingForm } from '@/components/products/platform-mapping-form'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductDetail {
  id: string
  name: string
  sku: string
  description: string | null
  category: string | null
  material: string | null
  cost_price: number
  mrp: number
  selling_price: number
  gst_rate: number
  hsn_code: string | null
  low_stock_threshold: number | null
  is_active: boolean
  images: string[]
  created_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function ProductDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-9" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-10 w-[400px]" />
      <div className="space-y-4">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const {
    data: product,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['products', 'detail', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data as ProductDetail
    },
  })

  if (isLoading) {
    return <ProductDetailSkeleton />
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/products">
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back to products</span>
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Product Not Found</h1>
        </div>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            {(error as Error).message}
          </p>
        </div>
      </div>
    )
  }

  if (!product) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/products">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to products</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <p className="text-muted-foreground font-mono text-sm">
            {product.sku}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="platform-mappings">Platform Mappings</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <div className="mx-auto max-w-3xl">
            <ProductForm
              initialData={product}
              onSuccess={() => {
                router.refresh()
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="variants" className="mt-6">
          <VariantManager
            productId={product.id}
            productSku={product.sku}
            productCostPrice={product.cost_price}
            productMrp={product.mrp}
            productSellingPrice={product.selling_price}
          />
        </TabsContent>

        <TabsContent value="platform-mappings" className="mt-6">
          <PlatformMappingForm productId={product.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
