// =============================================================================
// Thevasa ERP - Amazon Orders Sync
// =============================================================================

import {
  getAmazonClientForTeam,
  getAmazonPlatformId,
  withRateLimitRetry,
  AMAZON_IN_MARKETPLACE_ID,
} from './client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type {
  AmazonOrder,
  AmazonOrderItem,
  AmazonOrderItemsResponse,
} from '@/types/amazon';
import type { SyncStatus, OrderStatus, PaymentStatus, FulfillmentStatus } from '@/types/index';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface OrderSyncSummary {
  sync_log_id: string;
  status: SyncStatus;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  error_message: string | null;
  started_at: string;
  completed_at: string;
}

// -----------------------------------------------------------------------------
// Main Sync Function
// -----------------------------------------------------------------------------

/**
 * Sync Amazon orders for a team. Fetches orders from the SP-API, maps order
 * items to internal product variants via platform_mappings, and creates/updates
 * orders, order_items, payments, and sales_revenue records.
 *
 * @param teamId - The team to sync orders for
 * @param daysBack - Number of days to look back (default: 7, max: 90 for backfill)
 */
export async function syncAmazonOrders(
  teamId: string,
  daysBack: number = 7
): Promise<OrderSyncSummary> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const startedAt = new Date().toISOString();
  let syncLogId = '';

  // Counters
  let recordsProcessed = 0;
  let recordsCreated = 0;
  let recordsUpdated = 0;
  let recordsFailed = 0;

  try {
    // ------------------------------------------------------------------
    // 1. Create sync log entry
    // ------------------------------------------------------------------
    const platformId = await getAmazonPlatformId(teamId);

    const { data: syncLog, error: syncLogError } = await supabase
      .from('sync_logs')
      .insert({
        team_id: teamId,
        platform_id: platformId,
        sync_type: 'amazon_orders',
        status: 'running' as SyncStatus,
        records_processed: 0,
        records_created: 0,
        records_updated: 0,
        records_failed: 0,
        started_at: startedAt,
      })
      .select('id')
      .single();

    if (syncLogError || !syncLog) {
      throw new Error(`Failed to create sync log: ${syncLogError?.message}`);
    }

    syncLogId = syncLog.id;

    // ------------------------------------------------------------------
    // 2. Fetch orders from Amazon
    // ------------------------------------------------------------------
    const amazonClient = await getAmazonClientForTeam(teamId);
    const createdAfter = new Date();
    createdAfter.setDate(createdAfter.getDate() - daysBack);

    const allOrders = await fetchAllOrders(amazonClient, createdAfter);

    // ------------------------------------------------------------------
    // 3. Load platform mappings (seller_sku -> variant info)
    // ------------------------------------------------------------------
    const { data: mappings } = await supabase
      .from('platform_mappings')
      .select('variant_id, external_sku, asin')
      .eq('team_id', teamId)
      .eq('platform_id', platformId)
      .eq('is_active', true);

    const skuToVariant = new Map<string, string>();
    const asinToVariant = new Map<string, string>();

    for (const mapping of mappings ?? []) {
      if (mapping.external_sku) {
        skuToVariant.set(mapping.external_sku, mapping.variant_id);
      }
      if (mapping.asin) {
        asinToVariant.set(mapping.asin, mapping.variant_id);
      }
    }

    // ------------------------------------------------------------------
    // 4. Process each order
    // ------------------------------------------------------------------
    for (const amazonOrder of allOrders) {
      recordsProcessed++;

      try {
        // Check if order already exists
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id, status')
          .eq('team_id', teamId)
          .eq('external_order_id', amazonOrder.amazon_order_id)
          .single();

        const orderStatus = mapAmazonOrderStatus(amazonOrder.order_status);
        const paymentStatus = mapPaymentStatus(amazonOrder);
        const fulfillmentStatus = mapFulfillmentStatus(amazonOrder);

        const orderTotal = amazonOrder.order_total
          ? parseFloat(amazonOrder.order_total.amount)
          : 0;

        const orderData = {
          team_id: teamId,
          platform_id: platformId,
          order_number: amazonOrder.amazon_order_id,
          external_order_id: amazonOrder.amazon_order_id,
          status: orderStatus,
          customer_name: amazonOrder.buyer_info?.buyer_name ?? null,
          customer_email: amazonOrder.buyer_info?.buyer_email ?? null,
          customer_phone: amazonOrder.shipping_address?.phone ?? null,
          shipping_address: amazonOrder.shipping_address
            ? {
                name: amazonOrder.shipping_address.name,
                line1: amazonOrder.shipping_address.address_line_1 ?? '',
                line2: amazonOrder.shipping_address.address_line_2 ?? undefined,
                city: amazonOrder.shipping_address.city ?? '',
                state: amazonOrder.shipping_address.state_or_region ?? '',
                pincode: amazonOrder.shipping_address.postal_code ?? '',
                country: amazonOrder.shipping_address.country_code ?? 'IN',
                phone: amazonOrder.shipping_address.phone ?? undefined,
              }
            : null,
          subtotal: orderTotal,
          discount: 0,
          shipping_charge: 0,
          tax_amount: 0,
          total_amount: orderTotal,
          payment_status: paymentStatus,
          fulfillment_status: fulfillmentStatus,
          platform_metadata: {
            fulfillment_channel: amazonOrder.fulfillment_channel,
            sales_channel: amazonOrder.sales_channel,
            is_prime: amazonOrder.is_prime,
            is_business_order: amazonOrder.is_business_order,
            marketplace_id: amazonOrder.marketplace_id,
          },
          ordered_at: amazonOrder.purchase_date,
          shipped_at:
            amazonOrder.order_status === 'Shipped'
              ? amazonOrder.last_update_date
              : null,
          delivered_at: null as string | null,
          cancelled_at:
            amazonOrder.order_status === 'Canceled'
              ? amazonOrder.last_update_date
              : null,
        };

        let orderId: string;

        if (existingOrder) {
          // Update existing order
          await supabase
            .from('orders')
            .update({
              status: orderData.status,
              payment_status: orderData.payment_status as any,
              fulfillment_status: orderData.fulfillment_status as any,
              total_amount: orderData.total_amount,
              shipped_at: orderData.shipped_at,
              cancelled_at: orderData.cancelled_at,
              platform_metadata: orderData.platform_metadata,
            })
            .eq('id', existingOrder.id);

          orderId = existingOrder.id;
          recordsUpdated++;
        } else {
          // Create new order
          const { data: newOrder, error: orderError } = await supabase
            .from('orders')
            .insert(orderData as any)
            .select('id')
            .single();

          if (orderError || !newOrder) {
            throw new Error(
              `Failed to create order ${amazonOrder.amazon_order_id}: ${orderError?.message}`
            );
          }

          orderId = newOrder.id;
          recordsCreated++;

          // Fetch and create order items (only for new orders)
          await processOrderItems(
            amazonClient,
            supabase,
            teamId,
            orderId,
            amazonOrder.amazon_order_id,
            skuToVariant,
            asinToVariant
          );

          // Create payment record
          if (orderTotal > 0) {
            await (supabase.from('payments') as any).insert({
              team_id: teamId,
              order_id: orderId,
              platform_id: platformId,
              amount: orderTotal,
              method: amazonOrder.payment_method ?? 'amazon',
              status: paymentStatus,
              transaction_id: amazonOrder.amazon_order_id,
              paid_at:
                paymentStatus === 'paid'
                  ? amazonOrder.purchase_date
                  : null,
            });
          }

          // Create sales_revenue record
          await supabase.from('sales_revenue').insert({
            team_id: teamId,
            order_id: orderId,
            platform_id: platformId,
            gross_revenue: orderTotal,
            discount: 0,
            net_revenue: orderTotal,
            tax_collected: 0,
            date: amazonOrder.purchase_date,
          });
        }
      } catch (orderError) {
        console.error(
          `[Amazon Orders] Error processing order ${amazonOrder.amazon_order_id}:`,
          orderError
        );
        recordsFailed++;
      }
    }

    // ------------------------------------------------------------------
    // 5. Update sync log
    // ------------------------------------------------------------------
    const completedAt = new Date().toISOString();
    const finalStatus: SyncStatus =
      recordsFailed > 0 && recordsProcessed > recordsFailed
        ? 'partial'
        : recordsFailed === recordsProcessed && recordsProcessed > 0
          ? 'failed'
          : 'completed';

    await supabase
      .from('sync_logs')
      .update({
        status: finalStatus,
        records_processed: recordsProcessed,
        records_created: recordsCreated,
        records_updated: recordsUpdated,
        records_failed: recordsFailed,
        completed_at: completedAt,
      })
      .eq('id', syncLogId);

    return {
      sync_log_id: syncLogId,
      status: finalStatus,
      records_processed: recordsProcessed,
      records_created: recordsCreated,
      records_updated: recordsUpdated,
      records_failed: recordsFailed,
      error_message: null,
      started_at: startedAt,
      completed_at: completedAt,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const completedAt = new Date().toISOString();

    console.error(
      `[Amazon Orders] Fatal error for team ${teamId}:`,
      errorMessage
    );

    if (syncLogId) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'failed' as SyncStatus,
          records_processed: recordsProcessed,
          records_created: recordsCreated,
          records_updated: recordsUpdated,
          records_failed: recordsFailed,
          error_message: errorMessage,
          completed_at: completedAt,
        })
        .eq('id', syncLogId);
    }

    return {
      sync_log_id: syncLogId,
      status: 'failed',
      records_processed: recordsProcessed,
      records_created: recordsCreated,
      records_updated: recordsUpdated,
      records_failed: recordsFailed,
      error_message: errorMessage,
      started_at: startedAt,
      completed_at: completedAt,
    };
  }
}

// -----------------------------------------------------------------------------
// SP-API Data Fetching
// -----------------------------------------------------------------------------

/**
 * Fetch all orders created after the given date, handling pagination.
 */
async function fetchAllOrders(
  client: any,
  createdAfter: Date
): Promise<AmazonOrder[]> {
  const allOrders: AmazonOrder[] = [];
  let nextToken: string | null = null;

  do {
    const response: any = await withRateLimitRetry(() =>
      client.callAPI({
        operation: 'orders.getOrders',
        query: {
          MarketplaceIds: [AMAZON_IN_MARKETPLACE_ID],
          CreatedAfter: createdAfter.toISOString(),
          ...(nextToken ? { NextToken: nextToken } : {}),
        },
      })
    );

    const orders = response?.Orders ?? response?.orders ?? [];
    allOrders.push(
      ...orders.map((o: Record<string, unknown>) => normalizeOrderKeys(o))
    );

    nextToken =
      response?.NextToken ?? response?.pagination?.next_token ?? null;
  } while (nextToken);

  return allOrders;
}

/**
 * Fetch order items for a specific order.
 */
async function fetchOrderItems(
  client: any,
  amazonOrderId: string
): Promise<AmazonOrderItem[]> {
  const allItems: AmazonOrderItem[] = [];
  let nextToken: string | null = null;

  do {
    const response: any = await withRateLimitRetry(() =>
      client.callAPI({
        operation: 'orders.getOrderItems',
        path: { orderId: amazonOrderId },
        ...(nextToken ? { query: { NextToken: nextToken } } : {}),
      })
    );

    // Handle both PascalCase (raw API) and snake_case response keys
    const items = response?.OrderItems ?? response?.order_items ?? [];
    allItems.push(
      ...items.map((item: Record<string, unknown>) => normalizeOrderItemKeys(item))
    );

    nextToken = response?.NextToken ?? response?.next_token ?? null;
  } while (nextToken);

  return allItems;
}

// -----------------------------------------------------------------------------
// Order Item Processing
// -----------------------------------------------------------------------------

/**
 * Fetch order items from Amazon and create order_items records in the database.
 */
async function processOrderItems(
  amazonClient: any,
  supabase: any,
  teamId: string,
  orderId: string,
  amazonOrderId: string,
  skuToVariant: Map<string, string>,
  asinToVariant: Map<string, string>
): Promise<void> {
  const items = await fetchOrderItems(amazonClient, amazonOrderId);

  for (const item of items) {
    const variantId =
      skuToVariant.get(item.seller_sku) ?? asinToVariant.get(item.asin) ?? null;

    const unitPrice = item.item_price
      ? parseFloat(item.item_price.amount) / (item.quantity_ordered || 1)
      : 0;

    const taxAmount = item.item_tax
      ? parseFloat(item.item_tax.amount)
      : 0;

    const discount = item.promotion_discount
      ? parseFloat(item.promotion_discount.amount)
      : 0;

    const total =
      (item.item_price ? parseFloat(item.item_price.amount) : 0) +
      taxAmount -
      Math.abs(discount);

    await supabase.from('order_items').insert({
      order_id: orderId,
      team_id: teamId,
      variant_id: variantId,
      product_name: item.title,
      variant_name: null,
      sku: item.seller_sku,
      quantity: item.quantity_ordered,
      unit_price: unitPrice,
      discount: Math.abs(discount),
      tax_amount: taxAmount,
      total,
    });
  }
}

// -----------------------------------------------------------------------------
// Status Mapping Helpers
// -----------------------------------------------------------------------------

function mapAmazonOrderStatus(
  amazonStatus: string
): OrderStatus {
  const statusMap: Record<string, OrderStatus> = {
    Pending: 'pending',
    Unshipped: 'confirmed',
    PartiallyShipped: 'processing',
    Shipped: 'shipped',
    Canceled: 'cancelled',
    Unfulfillable: 'cancelled',
    InvoiceUnconfirmed: 'pending',
    PendingAvailability: 'pending',
  };

  return statusMap[amazonStatus] ?? 'pending';
}

function mapPaymentStatus(order: AmazonOrder): PaymentStatus {
  if (order.order_status === 'Canceled') return 'failed';
  if (
    order.order_status === 'Shipped' ||
    order.order_status === 'PartiallyShipped'
  ) {
    return 'paid';
  }
  return 'pending';
}

function mapFulfillmentStatus(order: AmazonOrder): FulfillmentStatus {
  if (order.order_status === 'Shipped') return 'fulfilled';
  if (order.order_status === 'PartiallyShipped') return 'partial';
  if (order.order_status === 'Canceled') return 'cancelled';
  return 'unfulfilled';
}

// -----------------------------------------------------------------------------
// Key Normalization
// -----------------------------------------------------------------------------

/**
 * Normalize Amazon API response keys from PascalCase to snake_case
 * to match our TypeScript interfaces.
 */
function normalizeOrderKeys(raw: Record<string, unknown>): AmazonOrder {
  return {
    amazon_order_id: (raw.AmazonOrderId ?? raw.amazon_order_id) as string,
    seller_order_id: (raw.SellerOrderId ?? raw.seller_order_id ?? null) as string | null,
    purchase_date: (raw.PurchaseDate ?? raw.purchase_date) as string,
    last_update_date: (raw.LastUpdateDate ?? raw.last_update_date) as string,
    order_status: (raw.OrderStatus ?? raw.order_status) as AmazonOrder['order_status'],
    fulfillment_channel: (raw.FulfillmentChannel ?? raw.fulfillment_channel) as AmazonOrder['fulfillment_channel'],
    sales_channel: (raw.SalesChannel ?? raw.sales_channel ?? 'Amazon.in') as string,
    ship_service_level: (raw.ShipServiceLevel ?? raw.ship_service_level ?? null) as string | null,
    order_total: raw.OrderTotal
      ? {
          currency_code: (raw.OrderTotal as Record<string, string>).CurrencyCode ?? 'INR',
          amount: (raw.OrderTotal as Record<string, string>).Amount ?? '0',
        }
      : (raw.order_total as AmazonOrder['order_total']) ?? null,
    number_of_items_shipped: (raw.NumberOfItemsShipped ?? raw.number_of_items_shipped ?? 0) as number,
    number_of_items_unshipped: (raw.NumberOfItemsUnshipped ?? raw.number_of_items_unshipped ?? 0) as number,
    payment_method: (raw.PaymentMethod ?? raw.payment_method ?? null) as string | null,
    payment_method_details: (raw.PaymentMethodDetails ?? raw.payment_method_details ?? []) as string[],
    marketplace_id: (raw.MarketplaceId ?? raw.marketplace_id ?? AMAZON_IN_MARKETPLACE_ID) as string,
    buyer_info: (raw.BuyerInfo ?? raw.buyer_info ?? null) as AmazonOrder['buyer_info'],
    shipping_address: raw.ShippingAddress
      ? normalizeAddress(raw.ShippingAddress as Record<string, unknown>)
      : (raw.shipping_address as AmazonOrder['shipping_address']) ?? null,
    is_replacement_order: (raw.IsReplacementOrder ?? raw.is_replacement_order ?? false) as boolean,
    is_premium_order: (raw.IsPremiumOrder ?? raw.is_premium_order ?? false) as boolean,
    is_prime: (raw.IsPrime ?? raw.is_prime ?? false) as boolean,
    is_business_order: (raw.IsBusinessOrder ?? raw.is_business_order ?? false) as boolean,
    earliest_ship_date: (raw.EarliestShipDate ?? raw.earliest_ship_date ?? null) as string | null,
    latest_ship_date: (raw.LatestShipDate ?? raw.latest_ship_date ?? null) as string | null,
    earliest_delivery_date: (raw.EarliestDeliveryDate ?? raw.earliest_delivery_date ?? null) as string | null,
    latest_delivery_date: (raw.LatestDeliveryDate ?? raw.latest_delivery_date ?? null) as string | null,
  };
}

function normalizeAddress(
  raw: Record<string, unknown>
): AmazonOrder['shipping_address'] {
  return {
    name: (raw.Name ?? raw.name ?? '') as string,
    address_line_1: (raw.AddressLine1 ?? raw.address_line_1 ?? null) as string | null,
    address_line_2: (raw.AddressLine2 ?? raw.address_line_2 ?? null) as string | null,
    address_line_3: (raw.AddressLine3 ?? raw.address_line_3 ?? null) as string | null,
    city: (raw.City ?? raw.city ?? null) as string | null,
    county: (raw.County ?? raw.county ?? null) as string | null,
    district: (raw.District ?? raw.district ?? null) as string | null,
    state_or_region: (raw.StateOrRegion ?? raw.state_or_region ?? null) as string | null,
    municipality: (raw.Municipality ?? raw.municipality ?? null) as string | null,
    postal_code: (raw.PostalCode ?? raw.postal_code ?? null) as string | null,
    country_code: (raw.CountryCode ?? raw.country_code ?? 'IN') as string | null,
    phone: (raw.Phone ?? raw.phone ?? null) as string | null,
  };
}

function normalizeMoney(raw: unknown): { currency_code: string; amount: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, string>;
  return {
    currency_code: obj.CurrencyCode ?? obj.currency_code ?? 'INR',
    amount: obj.Amount ?? obj.amount ?? '0',
  };
}

export function normalizeOrderItemKeys(raw: Record<string, unknown>): AmazonOrderItem {
  return {
    asin: (raw.ASIN ?? raw.asin ?? '') as string,
    seller_sku: (raw.SellerSKU ?? raw.seller_sku ?? '') as string,
    order_item_id: (raw.OrderItemId ?? raw.order_item_id ?? '') as string,
    title: (raw.Title ?? raw.title ?? '') as string,
    quantity_ordered: (raw.QuantityOrdered ?? raw.quantity_ordered ?? 0) as number,
    quantity_shipped: (raw.QuantityShipped ?? raw.quantity_shipped ?? 0) as number,
    item_price: normalizeMoney(raw.ItemPrice ?? raw.item_price),
    item_tax: normalizeMoney(raw.ItemTax ?? raw.item_tax),
    shipping_price: normalizeMoney(raw.ShippingPrice ?? raw.shipping_price),
    shipping_tax: normalizeMoney(raw.ShippingTax ?? raw.shipping_tax),
    shipping_discount: normalizeMoney(raw.ShippingDiscount ?? raw.shipping_discount),
    promotion_discount: normalizeMoney(raw.PromotionDiscount ?? raw.promotion_discount),
    promotion_ids: (raw.PromotionIds ?? raw.promotion_ids ?? []) as string[],
    is_gift: (raw.IsGift ?? raw.is_gift ?? false) as boolean,
    condition_id: (raw.ConditionId ?? raw.condition_id ?? null) as string | null,
    condition_subtype_id: (raw.ConditionSubtypeId ?? raw.condition_subtype_id ?? null) as string | null,
    condition_note: (raw.ConditionNote ?? raw.condition_note ?? null) as string | null,
  };
}
