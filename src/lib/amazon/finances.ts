// =============================================================================
// Thevasa ERP - Amazon Financial Events & Settlement Sync
// =============================================================================

import {
  getAmazonClientForTeam,
  getAmazonPlatformId,
  withRateLimitRetry,
} from './client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type {
  AmazonFinancialEvent,
  AmazonShipmentItem,
  AmazonSettlementData,
  AmazonSettlementItem,
} from '@/types/amazon';
import type { SyncStatus } from '@/types/index';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface FinanceSyncSummary {
  sync_log_id: string;
  status: SyncStatus;
  fees_created: number;
  fees_updated: number;
  errors: number;
  error_message: string | null;
  started_at: string;
  completed_at: string;
}

export interface SettlementProcessResult {
  settlement_cycle_id: string;
  transactions_created: number;
  transactions_matched: number;
  errors: number;
  error_message: string | null;
}

// -----------------------------------------------------------------------------
// Financial Events Sync
// -----------------------------------------------------------------------------

/**
 * Sync Amazon financial events for a team. If an orderId is provided, fetches
 * financial events for that specific order. Otherwise, fetches events from
 * the last 30 days.
 *
 * Extracts platform fees (referral fees, FBA fulfillment fees, storage fees,
 * etc.) and creates platform_fees records.
 */
export async function syncAmazonFinances(
  teamId: string,
  orderId?: string
): Promise<FinanceSyncSummary> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const startedAt = new Date().toISOString();
  let syncLogId = '';
  let feesCreated = 0;
  let feesUpdated = 0;
  let errors = 0;

  try {
    // ------------------------------------------------------------------
    // 1. Create sync log
    // ------------------------------------------------------------------
    const platformId = await getAmazonPlatformId(teamId);

    const { data: syncLog, error: syncLogError } = await supabase
      .from('sync_logs')
      .insert({
        team_id: teamId,
        platform_id: platformId,
        sync_type: 'amazon_finances',
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
    // 2. Fetch financial events from Amazon
    // ------------------------------------------------------------------
    const amazonClient = await getAmazonClientForTeam(teamId);
    let financialEvents: AmazonFinancialEvent[];

    if (orderId) {
      // Fetch events for a specific order
      financialEvents = await withRateLimitRetry(() =>
        amazonClient.callAPI({
          operation: 'finances.listFinancialEventsByOrderId',
          path: { orderId },
        })
      );

      // Normalize: the API may return events nested under different keys
      financialEvents = extractShipmentEvents(financialEvents);
    } else {
      // Fetch events from the last 30 days
      const postedAfter = new Date();
      postedAfter.setDate(postedAfter.getDate() - 30);

      financialEvents = await fetchAllFinancialEvents(
        amazonClient,
        postedAfter
      );
    }

    // ------------------------------------------------------------------
    // 3. Process each financial event
    // ------------------------------------------------------------------
    for (const event of financialEvents) {
      try {
        // Find the internal order for this event
        let internalOrderId: string | null = null;

        if (event.amazon_order_id) {
          const { data: order } = await supabase
            .from('orders')
            .select('id')
            .eq('team_id', teamId)
            .eq('external_order_id', event.amazon_order_id)
            .single();

          internalOrderId = order?.id ?? null;
        }

        if (!internalOrderId) {
          // Skip if we cannot link to an internal order
          console.warn(
            `[Amazon Finances] No internal order found for Amazon order ${event.amazon_order_id}. Skipping fees.`
          );
          continue;
        }

        // Process fees from each shipment item
        for (const item of event.shipment_item_list ?? []) {
          const feesResult = await processItemFees(
            supabase,
            teamId,
            platformId,
            internalOrderId,
            item,
            event.posted_date
          );

          feesCreated += feesResult.created;
          feesUpdated += feesResult.updated;
        }

        // Update the sales_revenue.platform_fee_total for this order
        await updateOrderPlatformFees(supabase, teamId, internalOrderId);
      } catch (eventError) {
        console.error(
          `[Amazon Finances] Error processing event for order ${event.amazon_order_id}:`,
          eventError
        );
        errors++;
      }
    }

    // ------------------------------------------------------------------
    // 4. Update sync log
    // ------------------------------------------------------------------
    const completedAt = new Date().toISOString();
    const finalStatus: SyncStatus =
      errors > 0 && feesCreated + feesUpdated > 0
        ? 'partial'
        : errors > 0
          ? 'failed'
          : 'completed';

    await supabase
      .from('sync_logs')
      .update({
        status: finalStatus,
        records_processed: financialEvents.length,
        records_created: feesCreated,
        records_updated: feesUpdated,
        records_failed: errors,
        completed_at: completedAt,
      })
      .eq('id', syncLogId);

    return {
      sync_log_id: syncLogId,
      status: finalStatus,
      fees_created: feesCreated,
      fees_updated: feesUpdated,
      errors,
      error_message: null,
      started_at: startedAt,
      completed_at: completedAt,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const completedAt = new Date().toISOString();

    console.error(
      `[Amazon Finances] Fatal error for team ${teamId}:`,
      errorMessage
    );

    if (syncLogId) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'failed' as SyncStatus,
          error_message: errorMessage,
          completed_at: completedAt,
        })
        .eq('id', syncLogId);
    }

    return {
      sync_log_id: syncLogId,
      status: 'failed',
      fees_created: feesCreated,
      fees_updated: feesUpdated,
      errors,
      error_message: errorMessage,
      started_at: startedAt,
      completed_at: completedAt,
    };
  }
}

// -----------------------------------------------------------------------------
// Settlement Report Processing
// -----------------------------------------------------------------------------

/**
 * Process an Amazon settlement report. Creates a settlement_cycle record and
 * individual settlement_transaction records, matching items to internal orders
 * where possible.
 */
export async function processSettlementReport(
  teamId: string,
  reportData: {
    settlement: AmazonSettlementData;
    items: AmazonSettlementItem[];
  }
): Promise<SettlementProcessResult> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  let settlementCycleId = '';
  let transactionsCreated = 0;
  let transactionsMatched = 0;
  let errors = 0;

  try {
    const platformId = await getAmazonPlatformId(teamId);
    const { settlement, items } = reportData;

    // ------------------------------------------------------------------
    // 1. Create or update settlement_cycle
    // ------------------------------------------------------------------
    const { data: existingCycle } = await supabase
      .from('settlement_cycles')
      .select('id')
      .eq('team_id', teamId)
      .eq('settlement_id', settlement.settlement_id)
      .single();

    if (existingCycle) {
      settlementCycleId = existingCycle.id;

      await supabase
        .from('settlement_cycles')
        .update({
          period_start: settlement.settlement_start_date,
          period_end: settlement.settlement_end_date,
          total_amount: parseFloat(settlement.total_amount.amount),
          status: 'completed',
        })
        .eq('id', existingCycle.id);
    } else {
      const { data: newCycle, error: cycleError } = await supabase
        .from('settlement_cycles')
        .insert({
          team_id: teamId,
          platform_id: platformId,
          settlement_id: settlement.settlement_id,
          period_start: settlement.settlement_start_date,
          period_end: settlement.settlement_end_date,
          total_amount: parseFloat(settlement.total_amount.amount),
          status: 'completed',
        })
        .select('id')
        .single();

      if (cycleError || !newCycle) {
        throw new Error(
          `Failed to create settlement cycle: ${cycleError?.message}`
        );
      }

      settlementCycleId = newCycle.id;
    }

    // ------------------------------------------------------------------
    // 2. Process settlement items
    // ------------------------------------------------------------------
    for (const item of items) {
      try {
        // Try to match to an internal order
        let internalOrderId: string | null = null;

        if (item.order_id) {
          const { data: order } = await supabase
            .from('orders')
            .select('id')
            .eq('team_id', teamId)
            .eq('external_order_id', item.order_id)
            .single();

          internalOrderId = order?.id ?? null;

          if (internalOrderId) {
            transactionsMatched++;
          }
        }

        // Create settlement_transaction
        await supabase.from('settlement_transactions').insert({
          team_id: teamId,
          settlement_id: settlementCycleId,
          order_id: internalOrderId,
          transaction_type: item.transaction_type,
          amount: parseFloat(item.amount.amount),
          description: `${item.amount_type}: ${item.amount_description}`,
          date: item.posted_date_time || item.posted_date,
        });

        transactionsCreated++;
      } catch (itemError) {
        console.error(
          `[Settlement] Error processing item for order ${item.order_id}:`,
          itemError
        );
        errors++;
      }
    }

    return {
      settlement_cycle_id: settlementCycleId,
      transactions_created: transactionsCreated,
      transactions_matched: transactionsMatched,
      errors,
      error_message: null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.error(
      `[Settlement] Fatal error for team ${teamId}:`,
      errorMessage
    );

    return {
      settlement_cycle_id: settlementCycleId,
      transactions_created: transactionsCreated,
      transactions_matched: transactionsMatched,
      errors,
      error_message: errorMessage,
    };
  }
}

// -----------------------------------------------------------------------------
// SP-API Data Fetching Helpers
// -----------------------------------------------------------------------------

/**
 * Fetch all financial events since a given date, handling pagination.
 */
async function fetchAllFinancialEvents(
  client: any,
  postedAfter: Date
): Promise<AmazonFinancialEvent[]> {
  const allEvents: AmazonFinancialEvent[] = [];
  let nextToken: string | null = null;

  do {
    const response: any = await withRateLimitRetry(() =>
      client.callAPI({
        operation: 'finances.listFinancialEvents',
        query: {
          PostedAfter: postedAfter.toISOString(),
          ...(nextToken ? { NextToken: nextToken } : {}),
        },
      })
    );

    const events = extractShipmentEvents(response as any);
    allEvents.push(...events);

    nextToken =
      response?.NextToken ?? response?.pagination?.next_token ?? null;
  } while (nextToken);

  return allEvents;
}

/**
 * Extract shipment events from the API response. The finances API returns
 * events under FinancialEvents.ShipmentEventList (and RefundEventList, etc.).
 */
function extractShipmentEvents(
  response: Record<string, unknown> | AmazonFinancialEvent[]
): AmazonFinancialEvent[] {
  if (Array.isArray(response)) {
    return response;
  }

  const events: AmazonFinancialEvent[] = [];

  // The SP-API returns financial events grouped by type
  const financialEvents =
    (response?.FinancialEvents as Record<string, unknown>) ??
    (response?.financial_events as Record<string, unknown>) ??
    response;

  // Shipment events (sales)
  const shipmentEvents =
    (financialEvents?.ShipmentEventList as AmazonFinancialEvent[]) ??
    (financialEvents?.shipment_event_list as AmazonFinancialEvent[]) ??
    [];
  events.push(...shipmentEvents);

  // Refund events
  const refundEvents =
    (financialEvents?.RefundEventList as AmazonFinancialEvent[]) ??
    (financialEvents?.refund_event_list as AmazonFinancialEvent[]) ??
    [];
  events.push(...refundEvents);

  // Service fee events
  const serviceFeeEvents =
    (financialEvents?.ServiceFeeEventList as AmazonFinancialEvent[]) ??
    (financialEvents?.service_fee_event_list as AmazonFinancialEvent[]) ??
    [];
  events.push(...serviceFeeEvents);

  return events;
}

// -----------------------------------------------------------------------------
// Fee Processing
// -----------------------------------------------------------------------------

/**
 * Process fees from a single shipment item and create/update platform_fees records.
 */
async function processItemFees(
  supabase: any,
  teamId: string,
  platformId: string,
  orderId: string,
  item: AmazonShipmentItem,
  postedDate: string
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const fee of item.item_fee_list ?? []) {
    const feeAmount = parseFloat(fee.fee_amount.amount);

    // Skip zero fees
    if (feeAmount === 0) continue;

    const feeType = normalizeFeeType(fee.fee_type);

    // Check if fee already exists for this order + fee type
    const { data: existingFee } = await supabase
      .from('platform_fees')
      .select('id')
      .eq('team_id', teamId)
      .eq('order_id', orderId)
      .eq('fee_type', feeType)
      .single();

    if (existingFee) {
      await supabase
        .from('platform_fees')
        .update({
          amount: Math.abs(feeAmount),
          description: fee.fee_type,
          date: postedDate,
        })
        .eq('id', existingFee.id);

      updated++;
    } else {
      await supabase.from('platform_fees').insert({
        team_id: teamId,
        order_id: orderId,
        platform_id: platformId,
        fee_type: feeType,
        amount: Math.abs(feeAmount), // Fees are typically negative in SP-API
        description: fee.fee_type,
        date: postedDate,
      });

      created++;
    }
  }

  return { created, updated };
}

/**
 * After processing fees for an order, update the sales_revenue record
 * to reflect the total platform fees.
 */
async function updateOrderPlatformFees(
  supabase: any,
  teamId: string,
  orderId: string
): Promise<void> {
  // Sum all platform fees for this order
  const { data: fees } = await supabase
    .from('platform_fees')
    .select('amount')
    .eq('team_id', teamId)
    .eq('order_id', orderId);

  const totalFees = (fees ?? []).reduce((sum: number, f: any) => sum + (f.amount ?? 0), 0);

  // Update sales_revenue
  const { data: revenue } = await supabase
    .from('sales_revenue')
    .select('id, net_revenue')
    .eq('team_id', teamId)
    .eq('order_id', orderId)
    .single();

  if (revenue) {
    await supabase
      .from('sales_revenue' as any)
      .update({
        platform_fee_total: totalFees,
        profit: (revenue as any).net_revenue - totalFees,
      } as any)
      .eq('id', revenue.id);
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Normalize Amazon fee type strings to consistent internal labels.
 */
function normalizeFeeType(amazonFeeType: string): string {
  const feeTypeMap: Record<string, string> = {
    FBAPerUnitFulfillmentFee: 'fba_fulfillment',
    FBAPerOrderFulfillmentFee: 'fba_fulfillment_order',
    FBAWeightBasedFee: 'fba_weight',
    Commission: 'referral_fee',
    ReferralFee: 'referral_fee',
    VariableClosingFee: 'closing_fee',
    FixedClosingFee: 'fixed_closing_fee',
    ShippingChargeback: 'shipping_chargeback',
    GiftwrapChargeback: 'giftwrap_chargeback',
    ShippingHB: 'shipping_hb',
    FBAStorageFee: 'fba_storage',
    FBALongTermStorageFee: 'fba_long_term_storage',
    FBARemovalFee: 'fba_removal',
    FBADisposalFee: 'fba_disposal',
    FBAInboundTransportationFee: 'fba_inbound_transport',
    TCSFee: 'tcs_fee',
    TDSFee: 'tds_fee',
  };

  return feeTypeMap[amazonFeeType] ?? amazonFeeType.toLowerCase().replace(/\s+/g, '_');
}
