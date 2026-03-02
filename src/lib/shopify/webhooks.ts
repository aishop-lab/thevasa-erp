// =============================================================================
// Thevasa ERP - Shopify Webhook Handlers
// =============================================================================

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
import { getShopifyClientForTeam, getShopifyPlatform } from './client';
import type { ShopifyWebhookTopic } from '@/types/shopify';
import type { OrderStatus, PaymentStatus, FulfillmentStatus } from '@/types/index';

// -----------------------------------------------------------------------------
// HMAC Verification
// -----------------------------------------------------------------------------

/**
 * Verify a Shopify webhook's HMAC-SHA256 signature.
 *
 * @param rawBody    - The raw request body as a string
 * @param hmacHeader - The value of the X-Shopify-Hmac-Sha256 header
 * @returns true if the signature is valid
 */
export function verifyShopifyWebhook(
  rawBody: string,
  hmacHeader: string
): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Shopify Webhook] SHOPIFY_WEBHOOK_SECRET is not set');
    return false;
  }

  try {
    const computedHmac = createHmac('sha256', secret)
      .update(rawBody, 'utf8')
      .digest('base64');

    const computedBuffer = Buffer.from(computedHmac, 'base64');
    const headerBuffer = Buffer.from(hmacHeader, 'base64');

    if (computedBuffer.length !== headerBuffer.length) {
      return false;
    }

    return timingSafeEqual(computedBuffer, headerBuffer);
  } catch (error) {
    console.error('[Shopify Webhook] HMAC verification error:', error);
    return false;
  }
}

// -----------------------------------------------------------------------------
// Webhook: orders/create
// -----------------------------------------------------------------------------

/**
 * Handle the `orders/create` webhook from Shopify.
 *
 * Creates a new order in the ERP with all line items, payments, and revenue.
 */
export async function processOrderCreate(
  teamId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const platform = await getShopifyPlatform(teamId);

  const shopifyOrderId = payload.admin_graphql_api_id as string | undefined;
  const orderName = (payload.name as string) ?? `#${payload.order_number}`;

  // Check if this order already exists (idempotency)
  if (shopifyOrderId) {
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('team_id', teamId)
      .eq('external_order_id', shopifyOrderId)
      .single();

    if (existing) {
      console.log(`[Shopify Webhook] Order ${orderName} already exists, skipping create`);
      return;
    }
  }

  // Fetch platform mappings for variant resolution
  const { data: mappings } = await supabase
    .from('platform_mappings')
    .select('variant_id, external_variant_id')
    .eq('team_id', teamId)
    .eq('platform_id', platform.id)
    .eq('is_active', true);

  const externalVariantToInternal = new Map(
    (mappings ?? [])
      .filter((m) => m.variant_id)
      .map((m) => [m.external_variant_id, m.variant_id])
  );

  // Map order data
  const customer = payload.customer as Record<string, unknown> | null;
  const shippingAddr = payload.shipping_address as Record<string, unknown> | null;
  const billingAddr = payload.billing_address as Record<string, unknown> | null;

  const financialStatus = (payload.financial_status as string)?.toUpperCase() ?? 'PENDING';
  const fulfillmentStatus = (payload.fulfillment_status as string)?.toUpperCase() ?? 'UNFULFILLED';

  const orderData = {
    team_id: teamId,
    platform_id: platform.id,
    order_number: orderName,
    external_order_id: shopifyOrderId ?? String(payload.id),
    status: mapWebhookOrderStatus(financialStatus, fulfillmentStatus, payload.cancelled_at as string | null),
    customer_name: customer
      ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || null
      : null,
    customer_email: (payload.email as string) ?? (customer?.email as string) ?? null,
    customer_phone: (payload.phone as string) ?? (customer?.phone as string) ?? null,
    shipping_address: shippingAddr
      ? {
          name: `${shippingAddr.first_name ?? ''} ${shippingAddr.last_name ?? ''}`.trim(),
          line1: (shippingAddr.address1 as string) ?? '',
          line2: (shippingAddr.address2 as string) ?? undefined,
          city: (shippingAddr.city as string) ?? '',
          state: (shippingAddr.province as string) ?? '',
          pincode: (shippingAddr.zip as string) ?? '',
          country: (shippingAddr.country as string) ?? '',
          phone: (shippingAddr.phone as string) ?? undefined,
        }
      : null,
    billing_address: billingAddr
      ? {
          name: `${billingAddr.first_name ?? ''} ${billingAddr.last_name ?? ''}`.trim(),
          line1: (billingAddr.address1 as string) ?? '',
          line2: (billingAddr.address2 as string) ?? undefined,
          city: (billingAddr.city as string) ?? '',
          state: (billingAddr.province as string) ?? '',
          pincode: (billingAddr.zip as string) ?? '',
          country: (billingAddr.country as string) ?? '',
          phone: (billingAddr.phone as string) ?? undefined,
        }
      : null,
    subtotal: parseFloat((payload.subtotal_price as string) ?? '0'),
    discount_amount: parseFloat((payload.total_discounts as string) ?? '0'),
    shipping_amount: parseShippingTotal(payload.shipping_lines as unknown[]),
    tax_amount: parseFloat((payload.total_tax as string) ?? '0'),
    total_amount: parseFloat((payload.total_price as string) ?? '0'),
    payment_status: mapWebhookPaymentStatus(financialStatus),
    fulfillment_status: mapWebhookFulfillmentStatus(fulfillmentStatus),
    notes: (payload.note as string) ?? null,
    ordered_at: (payload.processed_at as string) ?? (payload.created_at as string),
    cancelled_at: (payload.cancelled_at as string) ?? null,
    platform_metadata: {
      shopify_order_number: payload.order_number,
      tags: (payload.tags as string)?.split(', ') ?? [],
      payment_gateways: payload.payment_gateway_names ?? [],
      cancel_reason: payload.cancel_reason ?? null,
    },
  };

  const { data: newOrder, error: orderError } = await supabase
    .from('orders')
    .insert(orderData)
    .select('id')
    .single();

  if (orderError || !newOrder) {
    throw new Error(`Failed to create order from webhook: ${orderError?.message ?? 'no data'}`);
  }

  // Create order items
  const lineItems = (payload.line_items as Record<string, unknown>[]) ?? [];
  const orderItems = lineItems.map((item) => {
    const variantGid = item.admin_graphql_api_id as string | undefined;
    const variantId = variantGid ? externalVariantToInternal.get(variantGid) ?? null : null;

    const unitPrice = parseFloat((item.price as string) ?? '0');
    const quantity = (item.quantity as number) ?? 1;
    const discount = parseFloat((item.total_discount as string) ?? '0');
    const taxLines = (item.tax_lines as { price: string }[]) ?? [];
    const taxAmount = taxLines.reduce((sum, t) => sum + parseFloat(t.price ?? '0'), 0);

    return {
      order_id: newOrder.id,
      team_id: teamId,
      variant_id: variantId,
      product_name: (item.title as string) ?? 'Unknown Product',
      variant_name: (item.variant_title as string) ?? null,
      sku: (item.sku as string) ?? 'UNKNOWN',
      quantity,
      unit_price: unitPrice,
      discount,
      tax_amount: taxAmount,
      total: unitPrice * quantity - discount,
    };
  });

  if (orderItems.length > 0) {
    await supabase.from('order_items').insert(orderItems);
  }

  // Create payment record if order is paid
  if (financialStatus === 'PAID') {
    await supabase.from('payments').insert({
      team_id: teamId,
      order_id: newOrder.id,
      platform_id: platform.id,
      amount: parseFloat((payload.total_price as string) ?? '0'),
      method: ((payload.payment_gateway_names as string[]) ?? [])[0] ?? 'unknown',
      status: 'paid' as PaymentStatus,
      transaction_id: null,
      gateway: ((payload.payment_gateway_names as string[]) ?? [])[0] ?? null,
      paid_at: (payload.processed_at as string) ?? new Date().toISOString(),
    });
  }

  // Create sales revenue record
  if (financialStatus === 'PAID' || financialStatus === 'PARTIALLY_PAID') {
    await supabase.from('sales_revenue').insert({
      team_id: teamId,
      order_id: newOrder.id,
      platform_id: platform.id,
      gross_amount: parseFloat((payload.subtotal_price as string) ?? '0'),
      discount_amount: parseFloat((payload.total_discounts as string) ?? '0'),
      net_amount: parseFloat((payload.total_price as string) ?? '0') - parseFloat((payload.total_tax as string) ?? '0'),
      tax_amount: parseFloat((payload.total_tax as string) ?? '0'),
      shipping_amount: parseShippingTotal(payload.shipping_lines as unknown[]),
      platform_fee_total: 0,
      profit: 0,
      date: (payload.processed_at as string) ?? (payload.created_at as string),
    });
  }

  console.log(`[Shopify Webhook] Order created: ${orderName} -> ${newOrder.id}`);
}

// -----------------------------------------------------------------------------
// Webhook: orders/updated
// -----------------------------------------------------------------------------

/**
 * Handle the `orders/updated` webhook from Shopify.
 *
 * Updates the existing order record with the latest status and financial info.
 */
export async function processOrderUpdate(
  teamId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const shopifyOrderId = payload.admin_graphql_api_id as string | undefined;
  const orderName = (payload.name as string) ?? `#${payload.order_number}`;

  if (!shopifyOrderId) {
    console.warn(`[Shopify Webhook] Order update missing admin_graphql_api_id: ${orderName}`);
    return;
  }

  // Find existing order
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('team_id', teamId)
    .eq('external_order_id', shopifyOrderId)
    .single();

  if (!existingOrder) {
    // Order doesn't exist yet -- trigger a create instead
    console.log(`[Shopify Webhook] Order ${orderName} not found, triggering create flow`);
    await processOrderCreate(teamId, payload);
    return;
  }

  const financialStatus = (payload.financial_status as string)?.toUpperCase() ?? 'PENDING';
  const fulfillmentStatus = (payload.fulfillment_status as string)?.toUpperCase() ?? 'UNFULFILLED';

  // Extract tracking info from fulfillments
  const fulfillments = (payload.fulfillments as Record<string, unknown>[]) ?? [];
  const latestFulfillment = fulfillments[fulfillments.length - 1];

  const updateData: Record<string, unknown> = {
    status: mapWebhookOrderStatus(financialStatus, fulfillmentStatus, payload.cancelled_at as string | null),
    payment_status: mapWebhookPaymentStatus(financialStatus),
    fulfillment_status: mapWebhookFulfillmentStatus(fulfillmentStatus),
    cancelled_at: (payload.cancelled_at as string) ?? null,
    updated_at: new Date().toISOString(),
  };

  if (latestFulfillment) {
    updateData.tracking_number = (latestFulfillment.tracking_number as string) ?? null;
    updateData.tracking_url = (latestFulfillment.tracking_url as string) ?? null;
    updateData.tracking_company = (latestFulfillment.tracking_company as string) ?? null;
    updateData.shipped_at = (latestFulfillment.created_at as string) ?? null;
  }

  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', existingOrder.id);

  if (error) {
    throw new Error(`Failed to update order ${orderName}: ${error.message}`);
  }

  console.log(`[Shopify Webhook] Order updated: ${orderName}`);
}

// -----------------------------------------------------------------------------
// Webhook: inventory_levels/update
// -----------------------------------------------------------------------------

/**
 * Handle the `inventory_levels/update` webhook from Shopify.
 *
 * Updates the warehouse_stock for the affected variant and creates a stock_movement.
 */
export async function processInventoryUpdate(
  teamId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const platform = await getShopifyPlatform(teamId);

  const inventoryItemId = payload.inventory_item_id as number | undefined;
  const locationId = payload.location_id as number | undefined;
  const available = payload.available as number | undefined;

  if (inventoryItemId === undefined || locationId === undefined || available === undefined) {
    console.warn('[Shopify Webhook] inventory_levels/update payload missing required fields');
    return;
  }

  // Build Shopify GIDs from numeric IDs
  const inventoryItemGid = `gid://shopify/InventoryItem/${inventoryItemId}`;
  const locationGid = `gid://shopify/Location/${locationId}`;

  // We need to look up which variant this inventory item belongs to.
  // Use the Shopify API to resolve inventory_item -> variant.
  const client = await getShopifyClientForTeam(teamId);

  const variantResp = await client.query<{
    inventoryItem: {
      id: string;
      variant: { id: string } | null;
    } | null;
  }>(
    `query GetInventoryItemVariant($id: ID!) {
      inventoryItem(id: $id) {
        id
        variant {
          id
        }
      }
    }`,
    { id: inventoryItemGid }
  );

  const shopifyVariantGid = variantResp.data?.inventoryItem?.variant?.id;
  if (!shopifyVariantGid) {
    console.warn(
      `[Shopify Webhook] Could not resolve variant for inventory item ${inventoryItemId}`
    );
    return;
  }

  // Find internal variant via platform mapping
  const { data: mapping } = await supabase
    .from('platform_mappings')
    .select('variant_id')
    .eq('team_id', teamId)
    .eq('platform_id', platform.id)
    .eq('external_variant_id', shopifyVariantGid)
    .eq('is_active', true)
    .single();

  if (!mapping?.variant_id) {
    console.log(
      `[Shopify Webhook] No mapping for Shopify variant ${shopifyVariantGid}, skipping inventory update`
    );
    return;
  }

  // Find warehouse by Shopify location
  const warehouseCode = `shopify-${locationId}`;
  const { data: warehouse } = await supabase
    .from('warehouses')
    .select('id')
    .eq('team_id', teamId)
    .eq('code', warehouseCode)
    .single();

  if (!warehouse) {
    console.warn(
      `[Shopify Webhook] No warehouse found for location ${locationId} (code: ${warehouseCode})`
    );
    return;
  }

  // Update warehouse stock
  const { data: existingStock } = await supabase
    .from('warehouse_stock')
    .select('id, qty_on_hand, qty_reserved')
    .eq('team_id', teamId)
    .eq('warehouse_id', warehouse.id)
    .eq('variant_id', mapping.variant_id)
    .single();

  if (existingStock) {
    const oldOnHand = existingStock.qty_on_hand;
    // Shopify webhook gives us the new available qty; update on_hand accordingly
    // Since qty_available = qty_on_hand - qty_reserved (generated), we compute new on_hand
    const delta = available - (oldOnHand - (existingStock.qty_reserved ?? 0));
    const newOnHand = oldOnHand + delta;

    // qty_available is a GENERATED column, not set directly
    await supabase
      .from('warehouse_stock')
      .update({
        qty_on_hand: newOnHand,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', existingStock.id);

    if (delta !== 0) {
      await supabase.from('stock_movements').insert({
        team_id: teamId,
        warehouse_id: warehouse.id,
        variant_id: mapping.variant_id,
        movement_type: 'adjustment',
        quantity: delta,
        reference_type: 'shopify_webhook',
        reference_id: `inv-item-${inventoryItemId}-loc-${locationId}`,
        notes: `Shopify inventory webhook: on_hand ${oldOnHand} -> ${newOnHand}`,
      });
    }
  } else {
    // Create new stock record (qty_available is GENERATED, not set directly)
    await supabase.from('warehouse_stock').insert({
      team_id: teamId,
      warehouse_id: warehouse.id,
      variant_id: mapping.variant_id,
      qty_on_hand: available,
      qty_reserved: 0,
      last_synced_at: new Date().toISOString(),
    });

    if (available !== 0) {
      await supabase.from('stock_movements').insert({
        team_id: teamId,
        warehouse_id: warehouse.id,
        variant_id: mapping.variant_id,
        movement_type: 'adjustment',
        quantity: available,
        reference_type: 'shopify_webhook',
        reference_id: `inv-item-${inventoryItemId}-loc-${locationId}`,
        notes: `Initial stock from Shopify webhook: available=${available}`,
      });
    }
  }

  console.log(
    `[Shopify Webhook] Inventory updated: variant=${mapping.variant_id}, available=${available}`
  );
}

// -----------------------------------------------------------------------------
// Register Webhooks
// -----------------------------------------------------------------------------

const WEBHOOK_SUBSCRIPTION_CREATE = `
  mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription {
        id
        topic
        endpoint {
          ... on WebhookHttpEndpoint {
            callbackUrl
          }
        }
        format
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const WEBHOOK_SUBSCRIPTIONS_QUERY = `
  query webhookSubscriptions($first: Int!) {
    webhookSubscriptions(first: $first) {
      edges {
        node {
          id
          topic
          endpoint {
            ... on WebhookHttpEndpoint {
              callbackUrl
            }
          }
          format
        }
        cursor
      }
    }
  }
`;

/**
 * Register all required webhook subscriptions with Shopify.
 *
 * This is idempotent -- it checks existing subscriptions and only creates
 * those that are missing.
 */
export async function registerWebhooks(teamId: string): Promise<{
  registered: string[];
  existing: string[];
  errors: string[];
}> {
  const client = await getShopifyClientForTeam(teamId);

  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/shopify`;

  const requiredTopics: ShopifyWebhookTopic[] = [
    'ORDERS_CREATE',
    'ORDERS_UPDATED',
    'ORDERS_CANCELLED',
    'ORDERS_FULFILLED',
    'ORDERS_PAID',
    'REFUNDS_CREATE',
    'PRODUCTS_UPDATE',
    'PRODUCTS_DELETE',
    'INVENTORY_LEVELS_UPDATE',
  ];

  const result = {
    registered: [] as string[],
    existing: [] as string[],
    errors: [] as string[],
  };

  // Fetch existing subscriptions
  const existingResp = await client.query<{
    webhookSubscriptions: {
      edges: {
        node: {
          id: string;
          topic: string;
          endpoint: { callbackUrl: string };
          format: string;
        };
        cursor: string;
      }[];
    };
  }>(WEBHOOK_SUBSCRIPTIONS_QUERY, { first: 50 });

  const existingTopics = new Set(
    (existingResp.data?.webhookSubscriptions?.edges ?? []).map(
      (e) => e.node.topic
    )
  );

  // Register missing topics
  for (const topic of requiredTopics) {
    if (existingTopics.has(topic)) {
      result.existing.push(topic);
      continue;
    }

    try {
      const resp = await client.query<{
        webhookSubscriptionCreate: {
          webhookSubscription: { id: string; topic: string } | null;
          userErrors: { field: string[]; message: string }[];
        };
      }>(WEBHOOK_SUBSCRIPTION_CREATE, {
        topic,
        webhookSubscription: {
          callbackUrl,
          format: 'JSON',
        },
      });

      const userErrors = resp.data?.webhookSubscriptionCreate?.userErrors ?? [];
      if (userErrors.length > 0) {
        result.errors.push(
          `${topic}: ${userErrors.map((e) => e.message).join('; ')}`
        );
      } else if (resp.data?.webhookSubscriptionCreate?.webhookSubscription) {
        result.registered.push(topic);
      } else if (resp.errors?.length) {
        result.errors.push(
          `${topic}: ${resp.errors.map((e) => e.message).join('; ')}`
        );
      }
    } catch (error) {
      result.errors.push(
        `${topic}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  console.log(
    `[Shopify Webhooks] Registration complete: ${result.registered.length} registered, ${result.existing.length} existing, ${result.errors.length} errors`
  );

  return result;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function parseShippingTotal(shippingLines: unknown[] | null): number {
  if (!shippingLines || !Array.isArray(shippingLines)) return 0;
  return shippingLines.reduce((sum: number, line: unknown) => {
    const sl = line as Record<string, unknown>;
    return sum + parseFloat((sl.price as string) ?? '0');
  }, 0);
}

function mapWebhookOrderStatus(
  financialStatus: string,
  fulfillmentStatus: string,
  cancelledAt: string | null
): OrderStatus {
  if (cancelledAt) return 'cancelled';

  switch (fulfillmentStatus) {
    case 'FULFILLED':
      return 'delivered';
    case 'PARTIAL':
    case 'IN_PROGRESS':
      return 'shipped';
    default:
      break;
  }

  switch (financialStatus) {
    case 'PAID':
    case 'PARTIALLY_PAID':
      return 'confirmed';
    case 'REFUNDED':
      return 'refunded';
    case 'PENDING':
    case 'AUTHORIZED':
    default:
      return 'pending';
  }
}

function mapWebhookPaymentStatus(financialStatus: string): PaymentStatus {
  switch (financialStatus) {
    case 'PAID':
      return 'paid';
    case 'PARTIALLY_PAID':
    case 'PARTIALLY_REFUNDED':
      return 'partial';
    case 'REFUNDED':
      return 'refunded';
    case 'VOIDED':
      return 'failed';
    default:
      return 'pending';
  }
}

function mapWebhookFulfillmentStatus(status: string): FulfillmentStatus {
  switch (status) {
    case 'FULFILLED':
      return 'fulfilled';
    case 'PARTIAL':
    case 'IN_PROGRESS':
      return 'partial';
    default:
      return 'unfulfilled';
  }
}
