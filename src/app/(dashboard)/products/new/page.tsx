'use client'

import { useRouter } from 'next/navigation'
import { ProductForm } from '@/components/products/product-form'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewProductPage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/products">
            <ArrowLeft className="size-4" />
            <span className="sr-only">Back to products</span>
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add New Product</h1>
          <p className="text-muted-foreground">
            Create a new product in your catalog
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl">
        <ProductForm
          onSuccess={(product) => {
            router.push(`/products/${product.id}`)
          }}
        />
      </div>
    </div>
  )
}
