// =============================================================================
// Thevasa ERP - Cron: Sync FBA Inventory
// =============================================================================
//
// Vercel Cron handler that syncs FBA inventory for all teams with active
// Amazon platform connections.
//
// Schedule: Add to vercel.json crons config, e.g., every 4 hours:
//   { "path": "/api/cron/sync-inventory", "schedule": "0 */4 * * *" }
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { syncFbaInventory, type InventorySyncSummary } from '@/lib/amazon/inventory';

export const maxDuration = 300;

// -----------------------------------------------------------------------------
// GET /api/cron/sync-inventory
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
    // 3. Fetch all teams with connected Amazon accounts
    // ------------------------------------------------------------------
    const { data: amazonPlatforms, error: platformsError } = await supabase
      .from('platforms')
      .select('id, team_id')
      .eq('name', 'amazon')
      .eq('is_active', true);

    if (platformsError) {
      throw new Error(
        `Failed to fetch Amazon platforms: ${platformsError.message}`
      );
    }

    if (!amazonPlatforms || amazonPlatforms.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active Amazon platforms found',
        teams_synced: 0,
        results: [],
      });
    }

    // ------------------------------------------------------------------
    // 4. Sync FBA inventory for each team
    // ------------------------------------------------------------------
    const results: Array<{
      team_id: string;
      platform_id: string;
      summary: InventorySyncSummary;
    }> = [];

    for (const platform of amazonPlatforms) {
      try {
        console.log(
          `[Cron Inventory] Starting FBA inventory sync for team ${platform.team_id}`
        );

        const summary = await syncFbaInventory(platform.team_id);

        results.push({
          team_id: platform.team_id,
          platform_id: platform.id,
          summary,
        });

        console.log(
          `[Cron Inventory] Completed for team ${platform.team_id}: ` +
            `${summary.records_processed} processed, ` +
            `${summary.discrepancies_found} discrepancies`
        );
      } catch (teamError) {
        const errorMessage =
          teamError instanceof Error ? teamError.message : String(teamError);

        console.error(
          `[Cron Inventory] Error syncing team ${platform.team_id}:`,
          errorMessage
        );

        results.push({
          team_id: platform.team_id,
          platform_id: platform.id,
          summary: {
            sync_log_id: '',
            status: 'failed',
            records_processed: 0,
            records_created: 0,
            records_updated: 0,
            records_failed: 0,
            discrepancies_found: 0,
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

    return NextResponse.json({
      success: true,
      teams_synced: amazonPlatforms.length,
      successful: successCount,
      failed: failedCount,
      results,
    });
  } catch (error) {
    console.error('[Cron Inventory] Fatal error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
