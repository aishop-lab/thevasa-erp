// =============================================================================
// Thevasa ERP - Shopify Sync API Endpoint
// =============================================================================
//
// POST /api/sync/shopify
//
// Trigger a Shopify sync on demand. Accepts:
//   { teamId: string, syncType: 'products' | 'inventory' | 'orders' | 'all' }

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { syncShopifyProducts } from '@/lib/shopify/products';
import { syncShopifyInventory } from '@/lib/shopify/inventory';
import { syncShopifyOrders } from '@/lib/shopify/orders';

export const runtime = 'nodejs';
export const maxDuration = 300; // Allow up to 5 minutes for large syncs

type SyncType = 'products' | 'inventory' | 'orders' | 'all';

interface SyncRequestBody {
  teamId: string;
  syncType: SyncType;
  options?: {
    /** Number of days back to fetch orders (default: 7) */
    daysBack?: number;
  };
}

interface SyncResult {
  type: string;
  processed: number;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: SyncRequestBody = await request.json();

    if (!body.teamId) {
      return NextResponse.json(
        { error: 'teamId is required' },
        { status: 400 }
      );
    }

    const validSyncTypes: SyncType[] = ['products', 'inventory', 'orders', 'all'];
    if (!body.syncType || !validSyncTypes.includes(body.syncType)) {
      return NextResponse.json(
        { error: `syncType must be one of: ${validSyncTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify the team has an active Shopify platform
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: platform, error: platformError } = await supabase
      .from('platforms')
      .select('id, is_active')
      .eq('team_id', body.teamId)
      .eq('name', 'shopify')
      .single();

    if (platformError || !platform) {
      return NextResponse.json(
        { error: 'No Shopify platform found for this team' },
        { status: 404 }
      );
    }

    if (!platform.is_active) {
      return NextResponse.json(
        { error: 'Shopify platform is not active for this team' },
        { status: 400 }
      );
    }

    // Determine which syncs to run
    const syncTypes: SyncType[] =
      body.syncType === 'all'
        ? ['products', 'inventory', 'orders']
        : [body.syncType];

    const results: SyncResult[] = [];
    const overallErrors: string[] = [];

    // Run syncs sequentially (products first since inventory/orders depend on mappings)
    for (const syncType of syncTypes) {
      try {
        let result: { processed: number; created: number; updated: number; failed: number; errors: string[] };

        switch (syncType) {
          case 'products':
            result = await syncShopifyProducts(body.teamId);
            break;
          case 'inventory':
            result = await syncShopifyInventory(body.teamId);
            break;
          case 'orders':
            result = await syncShopifyOrders(
              body.teamId,
              body.options?.daysBack ?? 7
            );
            break;
          default:
            continue;
        }

        results.push({
          type: syncType,
          ...result,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        overallErrors.push(`${syncType}: ${errorMessage}`);

        results.push({
          type: syncType,
          processed: 0,
          created: 0,
          updated: 0,
          failed: 0,
          errors: [errorMessage],
        });
      }
    }

    // Determine overall status
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
    const hasErrors = overallErrors.length > 0 || totalFailed > 0;

    const status = overallErrors.length === syncTypes.length
      ? 'failed'
      : hasErrors
        ? 'partial'
        : 'completed';

    return NextResponse.json({
      status,
      sync_type: body.syncType,
      results,
      summary: {
        total_processed: totalProcessed,
        total_created: results.reduce((sum, r) => sum + r.created, 0),
        total_updated: results.reduce((sum, r) => sum + r.updated, 0),
        total_failed: totalFailed,
      },
      errors: overallErrors.length > 0 ? overallErrors : undefined,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Shopify Sync API] Unhandled error:', errorMessage);

    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
