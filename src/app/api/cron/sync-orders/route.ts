// =============================================================================
// Thevasa ERP - Cron: Sync Orders (Amazon + Shopify)
// =============================================================================
//
// Vercel Cron handler that syncs orders from Amazon (and Shopify when
// available) for all teams with active platform connections.
//
// Schedule: Add to vercel.json crons config, e.g., every 2 hours:
//   { "path": "/api/cron/sync-orders", "schedule": "0 */2 * * *" }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { syncAmazonOrders, type OrderSyncSummary } from '@/lib/amazon/orders';
import { syncShopifyOrders } from '@/lib/shopify/orders';

export const maxDuration = 300;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TeamSyncResult {
  team_id: string;
  platform_type: string;
  platform_id: string;
  summary: OrderSyncSummary;
}

// -----------------------------------------------------------------------------
// GET /api/cron/sync-orders
// -----------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    // ------------------------------------------------------------------
    // 1. Verify CRON_SECRET from Authorization header
    // ------------------------------------------------------------------
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ------------------------------------------------------------------
    // 2. Use service role client (cron has no user session)
    // ------------------------------------------------------------------
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ------------------------------------------------------------------
    // 3. Fetch all teams with connected platform accounts
    // ------------------------------------------------------------------
    const { data: platforms, error: platformsError } = await supabase
      .from('platforms')
      .select('id, team_id, name')
      .in('name', ['amazon', 'shopify'])
      .eq('is_active', true);

    if (platformsError) {
      throw new Error(
        `Failed to fetch platforms: ${platformsError.message}`
      );
    }

    if (!platforms || platforms.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active platforms found for order sync',
        teams_synced: 0,
        results: [],
      });
    }

    // ------------------------------------------------------------------
    // 4. Sync orders for each platform
    // ------------------------------------------------------------------
    const results: TeamSyncResult[] = [];

    for (const platform of platforms) {
      try {
        if (platform.name === 'amazon') {
          console.log(
            `[Cron Orders] Starting Amazon order sync for team ${platform.team_id}`
          );

          const summary = await syncAmazonOrders(platform.team_id, 30);

          results.push({
            team_id: platform.team_id,
            platform_type: 'amazon',
            platform_id: platform.id,
            summary,
          });

          console.log(
            `[Cron Orders] Amazon sync completed for team ${platform.team_id}: ` +
              `${summary.records_processed} processed, ` +
              `${summary.records_created} created, ` +
              `${summary.records_updated} updated`
          );
        } else if (platform.name === 'shopify') {
          console.log(
            `[Cron Orders] Starting Shopify order sync for team ${platform.team_id}`
          );

          const shopifyResult = await syncShopifyOrders(platform.team_id, 7);

          results.push({
            team_id: platform.team_id,
            platform_type: 'shopify',
            platform_id: platform.id,
            summary: {
              sync_log_id: '',
              status: shopifyResult.failed > 0 && shopifyResult.processed > shopifyResult.failed
                ? 'partial'
                : shopifyResult.failed === shopifyResult.processed && shopifyResult.processed > 0
                  ? 'failed'
                  : 'completed',
              records_processed: shopifyResult.processed,
              records_created: shopifyResult.created,
              records_updated: shopifyResult.updated,
              records_failed: shopifyResult.failed,
              error_message: shopifyResult.errors.length > 0
                ? shopifyResult.errors.join('; ')
                : null,
              started_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
            },
          });

          console.log(
            `[Cron Orders] Shopify sync completed for team ${platform.team_id}: ` +
              `${shopifyResult.processed} processed, ` +
              `${shopifyResult.created} created, ` +
              `${shopifyResult.updated} updated`
          );
        }
      } catch (platformError) {
        const errorMessage =
          platformError instanceof Error
            ? platformError.message
            : String(platformError);

        console.error(
          `[Cron Orders] Error syncing ${platform.name} for team ${platform.team_id}:`,
          errorMessage
        );

        results.push({
          team_id: platform.team_id,
          platform_type: platform.name,
          platform_id: platform.id,
          summary: {
            sync_log_id: '',
            status: 'failed',
            records_processed: 0,
            records_created: 0,
            records_updated: 0,
            records_failed: 0,
            error_message: errorMessage,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          },
        });
      }
    }

    // ------------------------------------------------------------------
    // 5. Return summary
    // ------------------------------------------------------------------
    const successCount = results.filter(
      (r) => r.summary.status === 'completed'
    ).length;
    const failedCount = results.filter(
      (r) => r.summary.status === 'failed'
    ).length;
    const partialCount = results.filter(
      (r) => r.summary.status === 'partial'
    ).length;

    const uniqueTeams = new Set(results.map((r) => r.team_id));

    return NextResponse.json({
      success: true,
      teams_synced: uniqueTeams.size,
      platforms_synced: platforms.length,
      successful: successCount,
      partial: partialCount,
      failed: failedCount,
      results,
    });
  } catch (error) {
    console.error('[Cron Orders] Fatal error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
