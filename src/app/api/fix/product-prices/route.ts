// One-time fix: Update product and variant prices from order_items data
// Strategy: exact SKU match first, then base-SKU match (same product, different size)
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get all products with mrp = 0
  const { data: products } = await supabase
    .from('products')
    .select('id, sku, mrp')
    .eq('mrp', 0);

  if (!products || products.length === 0) {
    return NextResponse.json({ message: 'No products with zero price found', updated: 0 });
  }

  // Get all order_items with their unit prices
  const { data: allItems } = await supabase
    .from('order_items')
    .select('sku, unit_price')
    .gt('unit_price', 0)
    .limit(10000);

  // Build exact SKU -> max price map
  const skuPriceMap = new Map<string, number>();
  // Build base-SKU -> max price map (SKU without last _SIZE segment)
  const baseSkuPriceMap = new Map<string, number>();

  for (const item of allItems ?? []) {
    const sku = item.sku;
    const price = Number(item.unit_price);
    if (sku && price > 0) {
      const existing = skuPriceMap.get(sku) ?? 0;
      if (price > existing) skuPriceMap.set(sku, price);

      // Base SKU: remove last underscore segment (usually size number)
      const parts = sku.split('_');
      if (parts.length >= 2) {
        const baseSku = parts.slice(0, -1).join('_');
        const baseExisting = baseSkuPriceMap.get(baseSku) ?? 0;
        if (price > baseExisting) baseSkuPriceMap.set(baseSku, price);
      }
    }
  }

  let productsUpdated = 0;
  let variantsUpdated = 0;
  let matchedByBase = 0;

  for (const product of products) {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, variant_sku')
      .eq('product_id', product.id);

    if (!variants || variants.length === 0) continue;

    let bestPrice = 0;
    for (const variant of variants) {
      // Try exact SKU match first
      let price = skuPriceMap.get(variant.variant_sku);

      // Fallback: base-SKU match (same product, different size)
      if (!price || price <= 0) {
        const parts = variant.variant_sku.split('_');
        if (parts.length >= 2) {
          const baseSku = parts.slice(0, -1).join('_');
          price = baseSkuPriceMap.get(baseSku);
          if (price && price > 0) matchedByBase++;
        }
      }

      if (price && price > 0) {
        await supabase
          .from('product_variants')
          .update({ mrp: price })
          .eq('id', variant.id);
        variantsUpdated++;
        if (price > bestPrice) bestPrice = price;
      }
    }

    if (bestPrice > 0) {
      await supabase
        .from('products')
        .update({ mrp: bestPrice })
        .eq('id', product.id);
      productsUpdated++;
    }
  }

  return NextResponse.json({
    message: 'Price backfill complete',
    products_with_zero_price: products.length,
    products_updated: productsUpdated,
    variants_updated: variantsUpdated,
    matched_by_base_sku: matchedByBase,
  });
}
