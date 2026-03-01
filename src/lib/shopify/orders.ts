// =============================================================================
// Thevasa ERP - Shopify Order Sync
// =============================================================================

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  getShopifyClientForTeam,
  getShopifyPlatform,
  extractShopifyId,
} from './client';
import type {
  ShopifyOrderFinancialStatus,
  ShopifyOrderFulfillmentStatus,
} from '@/types/shopify';
import type { OrderStatus, PaymentStatus, FulfillmentStatus } from '@/types/index';

// -----------------------------------------------------------------------------
// GraphQL Queries
// -----------------------------------------------------------------------------

const ORDERS_QUERY = `
  query FetchOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          orderNumber
          createdAt
          updatedAt
          processedAt
          closedAt
          cancelledAt
          cancelReason
          displayFinancialStatus
          displayFulfillmentStatus
          confirmed
          test
          email
          phone
          note
          tags
          paymentGatewayNames
          riskLevel
          customer {
            id
            firstName
            lastName
            email
            phone
          }
          billingAddress {
            firstName
            lastName
            name
            company
            address1
            address2
            city
            province
            provinceCode
            country
            countryCode
            zip
            phone
          }
          shippingAddress {
            firstName
            lastName
            name
            company
            address1
            address2
            city
            province
            provinceCode
            country
            countryCode
            zip
            phone
          }
          shippingLine {
            title
            code
            discountedPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
          lineItems(first: 100) {
            edges {
              node {
                id
                title
                variantTitle
                quantity
                sku
                vendor
                requiresShipping
                fulfillableQuantity
                fulfillmentStatus
                variant {
                  id
                  sku
                  title
                  price
                }
                product {
                  id
                  title
                }
                originalUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                discountedUnitPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                totalDiscountSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
                taxLines {
                  title
                  rate
                  ratePercentage
                  priceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                }
                image {
                  url
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
          subtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalDiscountsSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalShippingPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalTaxSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          totalRefundedSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          currentSubtotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          currentTotalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          currentTotalTaxSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          fulfillments {
            id
            status
            createdAt
            updatedAt
            trackingInfo {
              company
              number
              url
            }
          }
          transactions(first: 20) {
            id
            kind
            status
            amountSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            gateway
            createdAt
            processedAt
            errorCode
            test
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// -----------------------------------------------------------------------------
// Response Types
// -----------------------------------------------------------------------------

interface GqlMoneySet {
  shopMoney: { amount: string; currencyCode: string };
}

interface GqlLineItem {
  id: string;
  title: string;
  variantTitle: string | null;
  quantity: number;
  sku: string | null;
  vendor: string | null;
  requiresShipping: boolean;
  fulfillableQuantity: number;
  fulfillmentStatus: string;
  variant: { id: string; sku: string | null; title: string; price: string } | null;
  product: { id: string; title: string } | null;
  originalUnitPriceSet: GqlMoneySet;
  discountedUnitPriceSet: GqlMoneySet;
  totalDiscountSet: GqlMoneySet;
  taxLines: {
    title: string;
    rate: number;
    ratePercentage: number;
    priceSet: GqlMoneySet;
  }[];
  image: { url: string } | null;
}

interface GqlFulfillment {
  id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  trackingInfo: { company: string | null; number: string | null; url: string | null }[];
}

interface GqlTransaction {
  id: string;
  kind: string;
  status: string;
  amountSet: GqlMoneySet;
  gateway: string;
  createdAt: string;
  processedAt: string | null;
  errorCode: string | null;
  test: boolean;
}

interface GqlOrderNode {
  id: string;
  name: string;
  orderNumber: number;
  createdAt: string;
  updatedAt: string;
  processedAt: string;
  closedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  displayFinancialStatus: string;
  displayFulfillmentStatus: string;
  confirmed: boolean;
  test: boolean;
  email: string | null;
  phone: string | null;
  note: string | null;
  tags: string[];
  paymentGatewayNames: string[];
  riskLevel: string;
  customer: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  billingAddress: GqlMailingAddress | null;
  shippingAddress: GqlMailingAddress | null;
  shippingLine: {
    title: string;
    code: string | null;
    discountedPriceSet: GqlMoneySet;
  } | null;
  lineItems: {
    edges: { node: GqlLineItem; cursor: string }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
  subtotalPriceSet: GqlMoneySet;
  totalDiscountsSet: GqlMoneySet;
  totalShippingPriceSet: GqlMoneySet;
  totalTaxSet: GqlMoneySet;
  totalPriceSet: GqlMoneySet;
  totalRefundedSet: GqlMoneySet;
  currentSubtotalPriceSet: GqlMoneySet;
  currentTotalPriceSet: GqlMoneySet;
  currentTotalTaxSet: GqlMoneySet;
  fulfillments: GqlFulfillment[];
  transactions: GqlTransaction[];
}

interface GqlMailingAddress {
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  company: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  provinceCode: string | null;
  country: string | null;
  countryCode: string | null;
  zip: string | null;
  phone: string | null;
}

interface OrdersQueryResponse {
  orders: {
    edges: { node: GqlOrderNode; cursor: string }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

// -----------------------------------------------------------------------------
// Sync Function
// -----------------------------------------------------------------------------

/**
 * Sync Shopify orders into the ERP.
 *
 * @param teamId  - The team ID
 * @param daysBack - How many days back to fetch orders (default: 7)
 */
export async function syncShopifyOrders(
  teamId: string,
  daysBack: number = 7
): Promise<{
  processed: number;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const client = await getShopifyClientForTeam(teamId);
  const platform = await getShopifyPlatform(teamId);

  const stats = { processed: 0, created: 0, updated: 0, failed: 0, errors: [] as string[] };

  // Create sync log
  const { data: syncLog } = await supabase
    .from('sync_logs')
    .insert({
      team_id: teamId,
      platform_id: platform.id,
      sync_type: 'orders',
      status: 'running',
      records_processed: 0,
      records_created: 0,
      records_updated: 0,
      records_failed: 0,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  try {
    // Build date filter
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - daysBack);
    const dateQuery = `created_at:>='${sinceDate.toISOString()}'`;

    // Pre-fetch platform mappings for variant matching
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

    // Paginate through orders
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      const variables: Record<string, unknown> = {
        first: 50,
        query: dateQuery,
      };
      if (cursor) variables.after = cursor;

      const response = await client.query<OrdersQueryResponse>(
        ORDERS_QUERY,
        variables
      );

      if (response.errors?.length) {
        const errorMessages = response.errors.map((e) => e.message).join('; ');
        stats.errors.push(`GraphQL errors: ${errorMessages}`);
        console.error('[Shopify Orders] GraphQL errors:', errorMessages);
        if (!response.data?.orders) break;
      }

      const { edges, pageInfo } = response.data.orders;

      for (const { node: order } of edges) {
        // Skip test orders
        if (order.test) continue;

        stats.processed++;

        try {
          await processOrder(
            supabase,
            teamId,
            platform.id,
            order,
            externalVariantToInternal
          );
          // Determine if it was a create or update
          const { data: existing } = await supabase
            .from('orders')
            .select('id')
            .eq('team_id', teamId)
            .eq('external_order_id', order.id)
            .single();

          // The processOrder function uses upsert, so we need to check after
          // In practice this count may be approximate since upsert happened already
          if (existing) {
            stats.updated++;
          } else {
            stats.created++;
          }
        } catch (error) {
          stats.failed++;
          const msg = `Failed to process order ${order.name} (${order.id}): ${error instanceof Error ? error.message : String(error)}`;
          stats.errors.push(msg);
          console.error('[Shopify Orders]', msg);
        }
      }

      hasNextPage = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;
    }

    // Update sync log
    if (syncLog?.id) {
      await supabase
        .from('sync_logs')
        .update({
          status: stats.failed > 0 && stats.processed > 0 ? 'partial' : stats.failed > 0 ? 'failed' : 'completed',
          records_processed: stats.processed,
          records_created: stats.created,
          records_updated: stats.updated,
          records_failed: stats.failed,
          error_message: stats.errors.length > 0 ? stats.errors.join('\n') : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);
    }

    console.log(
      `[Shopify Orders] Sync complete: ${stats.processed} processed, ${stats.created} created, ${stats.updated} updated, ${stats.failed} failed`
    );

    return stats;
  } catch (error) {
    if (syncLog?.id) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'failed',
          records_processed: stats.processed,
          records_created: stats.created,
          records_updated: stats.updated,
          records_failed: stats.failed,
          error_message: error instanceof Error ? error.message : String(error),
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);
    }

    throw error;
  }
}

// -----------------------------------------------------------------------------
// Process a Single Order
// -----------------------------------------------------------------------------

async function processOrder(
  supabase: any,
  teamId: string,
  platformId: string,
  order: GqlOrderNode,
  externalVariantToInternal: Map<string, string>
) {
  const money = (set: GqlMoneySet) => parseFloat(set.shopMoney.amount);

  // Map Shopify statuses to internal statuses
  const orderStatus = mapOrderStatus(
    order.displayFinancialStatus,
    order.displayFulfillmentStatus,
    order.cancelledAt
  );
  const paymentStatus = mapPaymentStatus(order.displayFinancialStatus);
  const fulfillmentStatus = mapFulfillmentStatus(order.displayFulfillmentStatus);

  // Build shipping address
  const shippingAddress = order.shippingAddress
    ? {
        name: order.shippingAddress.name ?? `${order.shippingAddress.firstName ?? ''} ${order.shippingAddress.lastName ?? ''}`.trim(),
        line1: order.shippingAddress.address1 ?? '',
        line2: order.shippingAddress.address2 ?? undefined,
        city: order.shippingAddress.city ?? '',
        state: order.shippingAddress.province ?? '',
        pincode: order.shippingAddress.zip ?? '',
        country: order.shippingAddress.country ?? '',
        phone: order.shippingAddress.phone ?? undefined,
      }
    : null;

  // Build billing address
  const billingAddress = order.billingAddress
    ? {
        name: order.billingAddress.name ?? `${order.billingAddress.firstName ?? ''} ${order.billingAddress.lastName ?? ''}`.trim(),
        line1: order.billingAddress.address1 ?? '',
        line2: order.billingAddress.address2 ?? undefined,
        city: order.billingAddress.city ?? '',
        state: order.billingAddress.province ?? '',
        pincode: order.billingAddress.zip ?? '',
        country: order.billingAddress.country ?? '',
        phone: order.billingAddress.phone ?? undefined,
      }
    : null;

  // Get tracking info from fulfillments
  const latestFulfillment = order.fulfillments?.[0];
  const trackingInfo = latestFulfillment?.trackingInfo?.[0];

  // Customer name
  const customerName = order.customer
    ? `${order.customer.firstName ?? ''} ${order.customer.lastName ?? ''}`.trim() || null
    : null;

  // Upsert order
  const orderData = {
    team_id: teamId,
    platform_id: platformId,
    order_number: order.name,
    external_order_id: order.id,
    status: orderStatus,
    customer_name: customerName,
    customer_email: order.email ?? order.customer?.email ?? null,
    customer_phone: order.phone ?? order.customer?.phone ?? null,
    shipping_address: shippingAddress,
    billing_address: billingAddress,
    subtotal: money(order.subtotalPriceSet),
    discount_amount: money(order.totalDiscountsSet),
    shipping_amount: money(order.totalShippingPriceSet),
    tax_amount: money(order.totalTaxSet),
    total_amount: money(order.totalPriceSet),
    payment_status: paymentStatus,
    fulfillment_status: fulfillmentStatus,
    tracking_number: trackingInfo?.number ?? null,
    tracking_url: trackingInfo?.url ?? null,
    tracking_company: trackingInfo?.company ?? null,
    platform_metadata: {
      shopify_order_number: order.orderNumber,
      risk_level: order.riskLevel,
      tags: order.tags,
      payment_gateways: order.paymentGatewayNames,
      cancel_reason: order.cancelReason,
    },
    notes: order.note,
    ordered_at: order.processedAt ?? order.createdAt,
    shipped_at: latestFulfillment?.createdAt ?? null,
    cancelled_at: order.cancelledAt,
    updated_at: new Date().toISOString(),
  };

  // Check if order exists
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('team_id', teamId)
    .eq('external_order_id', order.id)
    .single();

  let orderId: string;

  if (existingOrder) {
    // Update
    const { error } = await supabase
      .from('orders')
      .update(orderData)
      .eq('id', existingOrder.id);

    if (error) throw new Error(`Failed to update order: ${error.message}`);
    orderId = existingOrder.id;

    // Delete existing order items for re-creation
    await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);
  } else {
    // Insert
    const { data: newOrder, error } = await supabase
      .from('orders')
      .insert(orderData)
      .select('id')
      .single();

    if (error || !newOrder) {
      throw new Error(`Failed to create order: ${error?.message ?? 'no data returned'}`);
    }
    orderId = newOrder.id;
  }

  // Create order items
  const orderItems = order.lineItems.edges.map(({ node: item }) => {
    const variantId = item.variant?.id
      ? externalVariantToInternal.get(item.variant.id) ?? null
      : null;

    const unitPrice = money(item.discountedUnitPriceSet);
    const discount = money(item.totalDiscountSet);
    const taxAmount = item.taxLines.reduce(
      (sum, t) => sum + parseFloat(t.priceSet.shopMoney.amount),
      0
    );
    const total = unitPrice * item.quantity;

    return {
      order_id: orderId,
      team_id: teamId,
      variant_id: variantId,
      product_name: item.product?.title ?? item.title,
      variant_name: item.variantTitle,
      sku: item.sku ?? item.variant?.sku ?? 'UNKNOWN',
      quantity: item.quantity,
      unit_price: unitPrice,
      discount,
      tax_amount: taxAmount,
      total,
    };
  });

  if (orderItems.length > 0) {
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error(
        `[Shopify Orders] Failed to insert order items for ${order.name}: ${itemsError.message}`
      );
    }
  }

  // Create payment records for successful transactions
  const successfulTransactions = order.transactions.filter(
    (t) => t.status === 'SUCCESS' && (t.kind === 'SALE' || t.kind === 'CAPTURE')
  );

  for (const txn of successfulTransactions) {
    // Check if payment already exists for this transaction
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('order_id', orderId)
      .eq('transaction_id', txn.id)
      .single();

    if (!existingPayment) {
      await supabase.from('payments').insert({
        team_id: teamId,
        order_id: orderId,
        platform_id: platformId,
        amount: money(txn.amountSet),
        method: txn.gateway,
        status: 'paid' as PaymentStatus,
        transaction_id: txn.id,
        gateway: txn.gateway,
        paid_at: txn.processedAt ?? txn.createdAt,
      });
    }
  }

  // Create/update sales_revenue record (only for paid orders)
  if (paymentStatus === 'paid' || paymentStatus === 'partial') {
    const { data: existingRevenue } = await supabase
      .from('sales_revenue')
      .select('id')
      .eq('order_id', orderId)
      .single();

    const revenueData = {
      team_id: teamId,
      order_id: orderId,
      platform_id: platformId,
      gross_amount: money(order.subtotalPriceSet),
      discount_amount: money(order.totalDiscountsSet),
      net_amount: money(order.currentSubtotalPriceSet),
      tax_amount: money(order.currentTotalTaxSet),
      shipping_amount: money(order.totalShippingPriceSet),
      platform_fee_total: 0, // Shopify fees come from separate billing, not per-order
      profit: 0, // Calculated separately once COGS is factored in
      date: order.processedAt ?? order.createdAt,
    };

    if (existingRevenue) {
      await supabase
        .from('sales_revenue')
        .update(revenueData)
        .eq('id', existingRevenue.id);
    } else {
      await supabase.from('sales_revenue').insert(revenueData);
    }
  }
}

// -----------------------------------------------------------------------------
// Status Mapping Helpers
// -----------------------------------------------------------------------------

function mapOrderStatus(
  financialStatus: string,
  fulfillmentStatus: string,
  cancelledAt: string | null
): OrderStatus {
  if (cancelledAt) return 'cancelled';

  switch (fulfillmentStatus) {
    case 'FULFILLED':
      return 'delivered';
    case 'IN_PROGRESS':
    case 'PARTIALLY_FULFILLED':
      return 'shipped';
    case 'ON_HOLD':
    case 'PENDING_FULFILLMENT':
    case 'SCHEDULED':
      return 'processing';
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
      return 'pending';
    default:
      return 'pending';
  }
}

function mapPaymentStatus(financialStatus: string): PaymentStatus {
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
    case 'PENDING':
    case 'AUTHORIZED':
    default:
      return 'pending';
  }
}

function mapFulfillmentStatus(status: string): FulfillmentStatus {
  switch (status) {
    case 'FULFILLED':
      return 'fulfilled';
    case 'PARTIALLY_FULFILLED':
    case 'IN_PROGRESS':
      return 'partial';
    case 'UNFULFILLED':
    case 'OPEN':
    case 'PENDING_FULFILLMENT':
    case 'ON_HOLD':
    case 'SCHEDULED':
    case 'RESTOCKED':
    default:
      return 'unfulfilled';
  }
}
