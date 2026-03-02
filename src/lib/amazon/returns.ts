// =============================================================================
// Thevasa ERP - Amazon Returns & Delivery Status Sync
// =============================================================================
//
// Updates order statuses based on:
// 1. Delivery window: Shipped orders past their latest delivery date → "delivered"
// 2. Refund events from financial data → "returned" / "refunded"
// 3. FBA returns report (if available) → "returned"
// =============================================================================

import {
  getAmazonClientForTeam,
  getAmazonPlatformId,
  withRateLimitRetry,
  AMAZON_IN_MARKETPLACE_ID,
} from './client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ReturnsSyncSummary {
  orders_checked: number;
  marked_delivered: number;
  marked_returned: number;
  marked_refunded: number;
  errors: number;
  started_at: string;
  completed_at: string;
}

// -----------------------------------------------------------------------------
// Main Sync Function
// -----------------------------------------------------------------------------

export async function syncReturnsAndDelivery(
  teamId: string,
  daysBack: number = 90
): Promise<ReturnsSyncSummary> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const startedAt = new Date().toISOString();
  let ordersChecked = 0;
  let markedDelivered = 0;
  let markedReturned = 0;
  let markedRefunded = 0;
  let errors = 0;

  try {
    const platformId = await getAmazonPlatformId(teamId);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // ------------------------------------------------------------------
    // 1. Mark shipped orders as delivered if past delivery window
    // ------------------------------------------------------------------
    const { data: shippedOrders, error: shippedErr } = await supabase
      .from('orders')
      .select('id, order_number, external_order_id, platform_metadata, shipped_at, ordered_at')
      .eq('platform_id', platformId)
      .eq('status', 'shipped')
      .gte('ordered_at', cutoffDate.toISOString());

    if (shippedErr) {
      console.error('[Returns Sync] Error fetching shipped orders:', shippedErr.message);
    }

    const now = new Date();
    for (const order of shippedOrders ?? []) {
      ordersChecked++;
      try {
        // Use shipped_at + 7 days as delivery estimate for FBA
        const shippedAt = order.shipped_at
          ? new Date(order.shipped_at)
          : order.ordered_at
            ? new Date(order.ordered_at)
            : null;

        if (!shippedAt) continue;

        // FBA typically delivers within 3-7 days in India
        const estimatedDelivery = new Date(shippedAt);
        estimatedDelivery.setDate(estimatedDelivery.getDate() + 7);

        // Check platform_metadata for latest_delivery_date
        const metadata = order.platform_metadata as Record<string, unknown> | null;
        const latestDeliveryStr = metadata?.latest_delivery_date as string | undefined;
        const deliveryDeadline = latestDeliveryStr
          ? new Date(latestDeliveryStr)
          : estimatedDelivery;

        if (now > deliveryDeadline) {
          await supabase
            .from('orders')
            .update({
              status: 'delivered',
              fulfillment_status: 'fulfilled',
              delivered_at: deliveryDeadline.toISOString(),
              updated_at: now.toISOString(),
            })
            .eq('id', order.id);
          markedDelivered++;
        }
      } catch (err) {
        errors++;
        console.error(`[Returns Sync] Error updating order ${order.order_number}:`, err);
      }
    }

    // ------------------------------------------------------------------
    // 2. Check financial events for refunds to mark orders as returned
    // ------------------------------------------------------------------
    try {
      const amazonClient = await getAmazonClientForTeam(teamId);
      const financialStartDate = new Date();
      financialStartDate.setDate(financialStartDate.getDate() - Math.min(daysBack, 30));

      const refundOrders = await fetchRefundEvents(amazonClient, financialStartDate);

      for (const refundOrderId of refundOrders) {
        ordersChecked++;
        try {
          // Find this order in our DB
          const { data: order } = await supabase
            .from('orders')
            .select('id, status')
            .eq('external_order_id', refundOrderId)
            .eq('platform_id', platformId)
            .single();

          if (!order) continue;

          // Only update if not already marked as returned/refunded
          if (order.status !== 'returned' && order.status !== 'refunded') {
            await supabase
              .from('orders')
              .update({
                status: 'returned',
                fulfillment_status: 'returned',
                payment_status: 'refunded',
                updated_at: now.toISOString(),
              })
              .eq('id', order.id);
            markedReturned++;
          }
        } catch (err) {
          errors++;
          console.error(`[Returns Sync] Error processing refund for ${refundOrderId}:`, err);
        }
      }
    } catch (err) {
      console.error('[Returns Sync] Error fetching refund events:', err);
      errors++;
    }

    // ------------------------------------------------------------------
    // 3. Re-check Amazon order statuses for Canceled orders
    // ------------------------------------------------------------------
    try {
      const amazonClient = await getAmazonClientForTeam(teamId);
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 14);

      // Fetch recent cancelled orders from Amazon
      const cancelledResponse: any = await withRateLimitRetry(() =>
        amazonClient.callAPI({
          operation: 'orders.getOrders',
          query: {
            MarketplaceIds: [AMAZON_IN_MARKETPLACE_ID],
            CreatedAfter: recentDate.toISOString(),
            OrderStatuses: ['Canceled'],
          },
        })
      );

      const cancelledOrders = cancelledResponse?.Orders ?? cancelledResponse?.orders ?? [];
      for (const amazonOrder of cancelledOrders) {
        const orderId = amazonOrder.AmazonOrderId ?? amazonOrder.amazon_order_id;
        if (!orderId) continue;

        ordersChecked++;
        try {
          const { data: order } = await supabase
            .from('orders')
            .select('id, status, fulfillment_status')
            .eq('external_order_id', orderId)
            .eq('platform_id', platformId)
            .single();

          if (!order || order.status === 'cancelled') continue;

          // If the order was fulfilled but now cancelled = RTO
          const isRto = order.fulfillment_status === 'fulfilled';

          await supabase
            .from('orders')
            .update({
              status: 'cancelled',
              cancelled_at: now.toISOString(),
              updated_at: now.toISOString(),
              // Keep fulfillment_status to track RTO
              ...(isRto ? { fulfillment_status: 'returned' } : {}),
            })
            .eq('id', order.id);

          if (isRto) {
            // RTO is effectively a return
            markedReturned++;
          }
        } catch (err) {
          errors++;
        }
      }
    } catch (err) {
      console.error('[Returns Sync] Error checking cancelled orders:', err);
      errors++;
    }

    const completedAt = new Date().toISOString();

    // Log the sync
    await supabase.from('sync_logs').insert({
      team_id: teamId,
      platform_id: platformId,
      sync_type: 'amazon_returns',
      status: errors > 0 ? 'partial' : 'completed',
      records_processed: ordersChecked,
      records_created: 0,
      records_updated: markedDelivered + markedReturned + markedRefunded,
      records_failed: errors,
      started_at: startedAt,
      completed_at: completedAt,
    });

    return {
      orders_checked: ordersChecked,
      marked_delivered: markedDelivered,
      marked_returned: markedReturned,
      marked_refunded: markedRefunded,
      errors,
      started_at: startedAt,
      completed_at: completedAt,
    };
  } catch (error) {
    console.error('[Returns Sync] Fatal error:', error);
    return {
      orders_checked: ordersChecked,
      marked_delivered: markedDelivered,
      marked_returned: markedReturned,
      marked_refunded: markedRefunded,
      errors: errors + 1,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
    };
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Fetch refund events from the Finances API and return unique order IDs
 * that had refunds processed.
 */
async function fetchRefundEvents(
  amazonClient: any,
  startDate: Date
): Promise<string[]> {
  const refundOrderIds = new Set<string>();
  let nextToken: string | null = null;

  try {
    do {
      const response: any = await withRateLimitRetry(() =>
        amazonClient.callAPI({
          operation: 'finances.listFinancialEvents',
          query: {
            PostedAfter: startDate.toISOString(),
            ...(nextToken ? { NextToken: nextToken } : {}),
          },
        })
      );

      const events = response?.FinancialEvents ?? response?.financial_events ?? {};
      const refundEvents =
        events?.RefundEventList ?? events?.refund_event_list ?? [];

      for (const event of refundEvents) {
        const orderId =
          event.AmazonOrderId ?? event.amazon_order_id;
        if (orderId) {
          refundOrderIds.add(orderId);
        }
      }

      nextToken =
        response?.NextToken ?? response?.next_token ?? null;
    } while (nextToken);
  } catch (err) {
    console.error('[Returns Sync] Error in fetchRefundEvents:', err);
  }

  return Array.from(refundOrderIds);
}
