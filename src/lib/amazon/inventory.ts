// =============================================================================
// Thevasa ERP - Amazon FBA Inventory Sync
// =============================================================================

import {
  getAmazonClientForTeam,
  getAmazonPlatformId,
  withRateLimitRetry,
  AMAZON_IN_MARKETPLACE_ID,
} from './client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type {
  AmazonFbaInventorySummary,
  AmazonInventorySummariesResponse,
} from '@/types/amazon';
import type { SyncStatus, DiscrepancySeverity } from '@/types/index';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface InventorySyncSummary {
  sync_log_id: string;
  status: SyncStatus;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  discrepancies_found: number;
  error_message: string | null;
  started_at: string;
  completed_at: string;
}

// -----------------------------------------------------------------------------
// Main Sync Function
// -----------------------------------------------------------------------------

/**
 * Sync FBA inventory for a team. Fetches all FBA inventory summaries from
 * Amazon, maps them to internal variants via platform_mappings, upserts
 * warehouse_stock for the FBA virtual warehouse, detects discrepancies
 * against the main warehouse, and logs everything to sync_logs.
 */
export async function syncFbaInventory(
  teamId: string
): Promise<InventorySyncSummary> {
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
  let discrepanciesFound = 0;

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
        sync_type: 'fba_inventory',
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
    // 2. Get Amazon client and fetch FBA inventory
    // ------------------------------------------------------------------
    const amazonClient = await getAmazonClientForTeam(teamId);
    const allSummaries = await fetchAllInventorySummaries(amazonClient);

    // ------------------------------------------------------------------
    // 3. Load platform mappings (seller_sku -> variant_id)
    // ------------------------------------------------------------------
    const { data: mappings, error: mappingsError } = await supabase
      .from('platform_mappings')
      .select('variant_id, external_sku, asin')
      .eq('team_id', teamId)
      .eq('platform_id', platformId)
      .eq('is_active', true);

    if (mappingsError) {
      throw new Error(`Failed to load platform mappings: ${mappingsError.message}`);
    }

    // Build lookup maps
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
    // 4. Get the FBA virtual warehouse
    // ------------------------------------------------------------------
    const { data: fbaWarehouse, error: fbaWhError } = await supabase
      .from('warehouses')
      .select('id')
      .eq('team_id', teamId)
      .eq('is_fba', true)
      .eq('is_active', true)
      .single();

    if (fbaWhError || !fbaWarehouse) {
      throw new Error(
        `No active FBA warehouse found for team ${teamId}: ${fbaWhError?.message ?? 'not found'}`
      );
    }

    // ------------------------------------------------------------------
    // 5. Get the main (non-FBA) warehouse for discrepancy comparison
    // ------------------------------------------------------------------
    const { data: mainWarehouse } = await supabase
      .from('warehouses')
      .select('id')
      .eq('team_id', teamId)
      .eq('is_fba', false)
      .eq('is_active', true)
      .limit(1)
      .single();

    // ------------------------------------------------------------------
    // 6. Load current FBA warehouse stock for delta detection
    // ------------------------------------------------------------------
    const { data: currentFbaStock } = await supabase
      .from('warehouse_stock')
      .select('variant_id, qty_on_hand')
      .eq('team_id', teamId)
      .eq('warehouse_id', fbaWarehouse.id);

    const currentStockMap = new Map<string, number>(
      (currentFbaStock ?? []).map((s) => [s.variant_id, s.qty_on_hand])
    );

    // ------------------------------------------------------------------
    // 7. Process each inventory summary
    // ------------------------------------------------------------------
    for (const summary of allSummaries) {
      recordsProcessed++;

      try {
        // Resolve variant_id from seller_sku or ASIN
        const variantId =
          skuToVariant.get(summary.seller_sku) ??
          asinToVariant.get(summary.asin);

        if (!variantId) {
          console.warn(
            `[FBA Sync] No mapping found for SKU=${summary.seller_sku}, ASIN=${summary.asin}. Skipping.`
          );
          recordsFailed++;
          continue;
        }

        // Calculate quantities
        const fulfillableQty = summary.inventory_details.fulfillable_quantity;
        const reservedQty =
          summary.inventory_details.reserved_quantity.total_reserved_quantity;
        const totalQty = summary.total_quantity;
        const previousQty = currentStockMap.get(variantId) ?? 0;
        const qtyDelta = totalQty - previousQty;

        // Upsert warehouse_stock for FBA warehouse
        const { data: existingStock } = await supabase
          .from('warehouse_stock')
          .select('id')
          .eq('team_id', teamId)
          .eq('warehouse_id', fbaWarehouse.id)
          .eq('variant_id', variantId)
          .single();

        if (existingStock) {
          await supabase
            .from('warehouse_stock')
            .update({
              qty_on_hand: totalQty,
              qty_reserved: reservedQty,
              qty_available: fulfillableQty,
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', existingStock.id);

          recordsUpdated++;
        } else {
          await supabase.from('warehouse_stock').insert({
            team_id: teamId,
            warehouse_id: fbaWarehouse.id,
            variant_id: variantId,
            qty_on_hand: totalQty,
            qty_reserved: reservedQty,
            qty_available: fulfillableQty,
            last_synced_at: new Date().toISOString(),
          });

          recordsCreated++;
        }

        // Create stock_movement record if quantity changed
        if (qtyDelta !== 0) {
          await supabase.from('stock_movements').insert({
            team_id: teamId,
            warehouse_id: fbaWarehouse.id,
            variant_id: variantId,
            movement_type: 'fba_sync',
            quantity: qtyDelta,
            reference_type: 'sync_log',
            reference_id: syncLogId,
            notes: `FBA sync: ${previousQty} -> ${totalQty} (delta: ${qtyDelta > 0 ? '+' : ''}${qtyDelta})`,
          });
        }

        // Detect discrepancies against main warehouse
        if (mainWarehouse) {
          const { data: mainStock } = await supabase
            .from('warehouse_stock')
            .select('qty_on_hand')
            .eq('team_id', teamId)
            .eq('warehouse_id', mainWarehouse.id)
            .eq('variant_id', variantId)
            .single();

          if (mainStock) {
            const discrepancy = totalQty - mainStock.qty_on_hand;

            if (discrepancy !== 0) {
              const severity = calculateDiscrepancySeverity(
                discrepancy,
                mainStock.qty_on_hand
              );

              await supabase.from('inventory_discrepancies').insert({
                team_id: teamId,
                variant_id: variantId,
                warehouse_id: mainWarehouse.id,
                fba_warehouse_id: fbaWarehouse.id,
                system_qty: mainStock.qty_on_hand,
                physical_qty: totalQty,
                discrepancy,
                severity,
                status: 'open',
                detected_at: new Date().toISOString(),
              });

              discrepanciesFound++;
            }
          }
        }
      } catch (itemError) {
        console.error(
          `[FBA Sync] Error processing SKU=${summary.seller_sku}:`,
          itemError
        );
        recordsFailed++;
      }
    }

    // ------------------------------------------------------------------
    // 8. Update sync log with final status
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
      discrepancies_found: discrepanciesFound,
      error_message: null,
      started_at: startedAt,
      completed_at: completedAt,
    };
  } catch (error) {
    // ------------------------------------------------------------------
    // Error handling: update sync log with failure
    // ------------------------------------------------------------------
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const completedAt = new Date().toISOString();

    console.error(`[FBA Sync] Fatal error for team ${teamId}:`, errorMessage);

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
      discrepancies_found: discrepanciesFound,
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
 * Fetch all FBA inventory summaries, handling pagination via next_token.
 */
async function fetchAllInventorySummaries(
  client: any
): Promise<AmazonFbaInventorySummary[]> {
  const allSummaries: AmazonFbaInventorySummary[] = [];
  let nextToken: string | null = null;

  do {
    const response: AmazonInventorySummariesResponse =
      await withRateLimitRetry(() =>
        client.callAPI({
          operation: 'fbaInventory.getInventorySummaries',
          query: {
            details: true,
            granularityType: 'Marketplace',
            granularityId: AMAZON_IN_MARKETPLACE_ID,
            marketplaceIds: [AMAZON_IN_MARKETPLACE_ID],
            ...(nextToken ? { nextToken } : {}),
          },
        })
      );

    if (response.inventory_summaries) {
      allSummaries.push(...response.inventory_summaries);
    }

    nextToken = response.pagination?.next_token ?? null;
  } while (nextToken);

  return allSummaries;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Calculate discrepancy severity based on the absolute difference
 * and percentage relative to the system quantity.
 */
function calculateDiscrepancySeverity(
  discrepancy: number,
  systemQty: number
): DiscrepancySeverity {
  const absDiff = Math.abs(discrepancy);
  const percentage = systemQty > 0 ? (absDiff / systemQty) * 100 : 100;

  if (absDiff === 0) return 'none';
  if (absDiff <= 2 && percentage <= 10) return 'minor';
  if (absDiff <= 10 && percentage <= 25) return 'moderate';
  return 'major';
}
