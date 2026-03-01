// =============================================================================
// Thevasa ERP - Amazon Catalog Sync (Products, Variants, Order Items, Payments)
// =============================================================================

import {
  getAmazonClientForTeam,
  getAmazonPlatformId,
  withRateLimitRetry,
  AMAZON_IN_MARKETPLACE_ID,
} from './client';
import { normalizeOrderItemKeys } from './orders';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { AmazonOrderItem } from '@/types/amazon';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CatalogSyncSummary {
  products_created: number;
  variants_created: number;
  mappings_created: number;
  order_items_created: number;
  payments_created: number;
  orders_processed: number;
  orders_skipped: number;
  errors: number;
  error_message: string | null;
}

// -----------------------------------------------------------------------------
// Main Sync Function
// -----------------------------------------------------------------------------

/**
 * Sync Amazon catalog data by fetching order items for all orders,
 * auto-creating products, variants, platform mappings, order items,
 * and payment records.
 */
export async function syncAmazonCatalog(
  teamId: string,
  maxOrders: number = 100
): Promise<CatalogSyncSummary> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const summary: CatalogSyncSummary = {
    products_created: 0,
    variants_created: 0,
    mappings_created: 0,
    order_items_created: 0,
    payments_created: 0,
    orders_processed: 0,
    orders_skipped: 0,
    errors: 0,
    error_message: null,
  };

  try {
    const amazonClient = await getAmazonClientForTeam(teamId);
    const platformId = await getAmazonPlatformId(teamId);

    // ------------------------------------------------------------------
    // 1. Get orders that need processing
    // ------------------------------------------------------------------
    const { data: allOrders } = await supabase
      .from('orders')
      .select('id, external_order_id, total_amount, payment_status, ordered_at')
      .eq('team_id', teamId)
      .eq('platform_id', platformId)
      .order('ordered_at', { ascending: false });

    if (!allOrders || allOrders.length === 0) {
      return summary;
    }

    // Find orders with no order_items
    const { data: existingItemOrders } = await supabase
      .from('order_items')
      .select('order_id')
      .eq('team_id', teamId);

    const ordersWithItems = new Set(
      (existingItemOrders ?? []).map((i: any) => i.order_id)
    );

    const ordersToProcess = allOrders
      .filter((o) => !ordersWithItems.has(o.id))
      .slice(0, maxOrders);

    console.log(
      `[Catalog Sync] ${ordersToProcess.length} orders to process out of ${allOrders.length} total`
    );

    // ------------------------------------------------------------------
    // 2. Load existing products/variants/mappings for deduplication
    // ------------------------------------------------------------------
    const { data: existingMappings } = await supabase
      .from('platform_mappings')
      .select('variant_id, asin, external_sku')
      .eq('team_id', teamId)
      .eq('platform_id', platformId);

    const asinToVariantId = new Map<string, string>();
    const skuToVariantId = new Map<string, string>();

    for (const m of existingMappings ?? []) {
      if (m.asin) asinToVariantId.set(m.asin, m.variant_id);
      if (m.external_sku) skuToVariantId.set(m.external_sku, m.variant_id);
    }

    // Map from ASIN to product_id (for grouping variants under products)
    const asinToProductId = new Map<string, string>();

    const { data: existingProducts } = await supabase
      .from('products')
      .select('id, sku')
      .eq('team_id', teamId);

    for (const p of existingProducts ?? []) {
      // sku format: "ASIN-{asin}" for auto-created products
      if (p.sku?.startsWith('ASIN-')) {
        asinToProductId.set(p.sku.replace('ASIN-', ''), p.id);
      }
    }

    // ------------------------------------------------------------------
    // 3. Process orders in batches
    // ------------------------------------------------------------------
    for (const order of ordersToProcess) {
      try {
        // Fetch order items from Amazon API
        const items = await fetchOrderItemsSafe(
          amazonClient,
          order.external_order_id
        );

        if (!items || items.length === 0) {
          summary.orders_skipped++;
          continue;
        }

        for (const item of items) {
          try {
            let variantId = skuToVariantId.get(item.seller_sku);

            // Create product + variant + mapping if needed
            if (!variantId) {
              let productId = asinToProductId.get(item.asin);

              if (!productId) {
                // Create new product
                const { data: newProduct } = await supabase
                  .from('products')
                  .insert({
                    team_id: teamId,
                    name: cleanProductName(item.title),
                    sku: `ASIN-${item.asin}`,
                    cost_price: 0,
                    mrp: item.item_price
                      ? parseFloat(item.item_price.amount) /
                        (item.quantity_ordered || 1)
                      : 0,
                    gst_rate: 12, // Default GST rate for clothing
                    is_active: true,
                  })
                  .select('id')
                  .single();

                if (newProduct) {
                  productId = newProduct.id;
                  asinToProductId.set(item.asin, productId!);
                  summary.products_created++;
                }
              }

              if (productId) {
                // Create variant
                const { data: newVariant } = await supabase
                  .from('product_variants')
                  .insert({
                    product_id: productId,
                    team_id: teamId,
                    variant_sku: item.seller_sku,
                    cost_price: 0,
                    mrp: item.item_price
                      ? parseFloat(item.item_price.amount) /
                        (item.quantity_ordered || 1)
                      : 0,
                    is_active: true,
                  })
                  .select('id')
                  .single();

                if (newVariant) {
                  variantId = newVariant.id;
                  skuToVariantId.set(item.seller_sku, variantId!);
                  asinToVariantId.set(item.asin, variantId!);
                  summary.variants_created++;

                  // Create platform mapping
                  await supabase.from('platform_mappings').insert({
                    team_id: teamId,
                    platform_id: platformId,
                    variant_id: variantId,
                    external_product_id: item.asin,
                    asin: item.asin,
                    external_sku: item.seller_sku,
                    is_active: true,
                  });
                  summary.mappings_created++;
                }
              }
            }

            // Create order_item
            const unitPrice = item.item_price
              ? parseFloat(item.item_price.amount) /
                (item.quantity_ordered || 1)
              : 0;
            const taxAmount = item.item_tax
              ? parseFloat(item.item_tax.amount)
              : 0;
            const discount = item.promotion_discount
              ? Math.abs(parseFloat(item.promotion_discount.amount))
              : 0;
            const total =
              (item.item_price ? parseFloat(item.item_price.amount) : 0) +
              taxAmount -
              discount;

            await supabase.from('order_items').insert({
              order_id: order.id,
              team_id: teamId,
              variant_id: variantId ?? null,
              product_name: item.title,
              variant_name: null,
              sku: item.seller_sku,
              quantity: item.quantity_ordered,
              unit_price: unitPrice,
              discount,
              tax_amount: taxAmount,
              total,
            });
            summary.order_items_created++;
          } catch (itemErr) {
            console.error(
              `[Catalog Sync] Error processing item ${item.seller_sku}:`,
              itemErr instanceof Error ? itemErr.message : itemErr
            );
            summary.errors++;
          }
        }

        summary.orders_processed++;

        // Log progress every 50 orders
        if (summary.orders_processed % 50 === 0) {
          console.log(
            `[Catalog Sync] Progress: ${summary.orders_processed}/${ordersToProcess.length} orders, ` +
              `${summary.products_created} products, ${summary.order_items_created} items`
          );
        }
      } catch (orderErr) {
        console.error(
          `[Catalog Sync] Error processing order ${order.external_order_id}:`,
          orderErr instanceof Error ? orderErr.message : orderErr
        );
        summary.errors++;
      }
    }

    // ------------------------------------------------------------------
    // 4. Backfill payments for orders missing payment records
    // ------------------------------------------------------------------
    // Fetch ALL existing payment order_ids (handle Supabase default 1000 limit)
    let allPaymentOrderIds: string[] = [];
    let paymentOffset = 0;
    const paymentPageSize = 1000;
    while (true) {
      const { data: page } = await supabase
        .from('payments')
        .select('order_id')
        .eq('team_id', teamId)
        .range(paymentOffset, paymentOffset + paymentPageSize - 1);
      if (!page || page.length === 0) break;
      allPaymentOrderIds.push(...page.map((p: any) => p.order_id));
      if (page.length < paymentPageSize) break;
      paymentOffset += paymentPageSize;
    }
    const existingPaymentOrders = allPaymentOrderIds.map(id => ({ order_id: id }));

    const ordersWithPayments = new Set(
      (existingPaymentOrders ?? []).map((p: any) => p.order_id)
    );

    const ordersNeedingPayments = allOrders.filter(
      (o) => !ordersWithPayments.has(o.id) && Number(o.total_amount) > 0
    );

    if (ordersNeedingPayments.length > 0) {
      const paymentRows = ordersNeedingPayments.map((o) => ({
        team_id: teamId,
        order_id: o.id,
        amount: o.total_amount,
        method: 'amazon',
        status: o.payment_status === 'paid' ? 'completed' : 'pending',
        transaction_id: o.external_order_id,
        paid_at: o.payment_status === 'paid' ? o.ordered_at : null,
      }));

      // Insert in batches of 100
      for (let i = 0; i < paymentRows.length; i += 100) {
        const batch = paymentRows.slice(i, i + 100);
        await supabase.from('payments').insert(batch as any);
        summary.payments_created += batch.length;
      }
    }

    // ------------------------------------------------------------------
    // 5. Backfill product/variant prices from order_items where mrp = 0
    // ------------------------------------------------------------------
    const { data: zeroPriceProducts } = await supabase
      .from('products')
      .select('id, sku')
      .eq('team_id', teamId)
      .eq('mrp', 0);

    if (zeroPriceProducts && zeroPriceProducts.length > 0) {
      for (const prod of zeroPriceProducts) {
        // Find variants for this product
        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, variant_sku')
          .eq('product_id', prod.id);

        if (!variants || variants.length === 0) continue;

        // Find order_items with this SKU to get a price
        const variantSkus = variants.map((v: any) => v.variant_sku).filter(Boolean);
        if (variantSkus.length === 0) continue;

        const { data: items } = await supabase
          .from('order_items')
          .select('unit_price, sku')
          .in('sku', variantSkus)
          .gt('unit_price', 0)
          .limit(1);

        if (items && items.length > 0) {
          const price = Number(items[0].unit_price);
          await supabase
            .from('products')
            .update({ mrp: price })
            .eq('id', prod.id);

          // Update variant prices too
          for (const variant of variants) {
            const variantItem = items.find((i: any) => i.sku === variant.variant_sku);
            if (variantItem) {
              await supabase
                .from('product_variants')
                .update({ mrp: Number(variantItem.unit_price) })
                .eq('id', variant.id);
            }
          }
        }
      }
    }

    console.log(
      `[Catalog Sync] Complete: ${summary.products_created} products, ` +
        `${summary.variants_created} variants, ${summary.order_items_created} items, ` +
        `${summary.payments_created} payments, ${summary.errors} errors`
    );
  } catch (error) {
    summary.error_message =
      error instanceof Error ? error.message : String(error);
    console.error(`[Catalog Sync] Fatal error:`, summary.error_message);
  }

  return summary;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Fetch order items with rate-limit retry and error handling.
 * Returns empty array on failure instead of throwing.
 */
async function fetchOrderItemsSafe(
  client: any,
  amazonOrderId: string
): Promise<AmazonOrderItem[]> {
  try {
    const allItems: AmazonOrderItem[] = [];
    let nextToken: string | null = null;

    do {
      const response: any = await withRateLimitRetry(
        () =>
          client.callAPI({
            operation: 'orders.getOrderItems',
            path: { orderId: amazonOrderId },
            ...(nextToken ? { query: { NextToken: nextToken } } : {}),
          }),
        { maxRetries: 3, baseDelayMs: 2000 }
      );

      // Handle both PascalCase (raw API) and snake_case response keys
      const items = response?.OrderItems ?? response?.order_items ?? [];
      allItems.push(
        ...items.map((item: Record<string, unknown>) => normalizeOrderItemKeys(item))
      );

      nextToken = response?.NextToken ?? response?.next_token ?? null;
    } while (nextToken);

    return allItems;
  } catch (error) {
    console.warn(
      `[Catalog Sync] Failed to fetch items for order ${amazonOrderId}:`,
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

/**
 * Clean up Amazon product title by removing common suffixes like size/color info.
 * Returns a shorter, cleaner product name.
 */
function cleanProductName(title: string): string {
  // Limit to reasonable length
  if (title.length > 200) {
    return title.substring(0, 200);
  }
  return title;
}
