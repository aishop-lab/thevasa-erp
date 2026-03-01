// =============================================================================
// API Route: POST /api/sync/amazon-catalog
// Syncs Amazon product catalog, order items, and payments
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { syncAmazonCatalog } from '@/lib/amazon/catalog';

export const maxDuration = 300; // 5 min timeout for Vercel

export async function POST(request: NextRequest) {
  try {
    let teamId: string | null = null;

    // Check for cron secret (server-to-server / CLI calls)
    const authHeader = request.headers.get('authorization');
    if (authHeader === `Bearer ${process.env.CRON_SECRET}`) {
      // Cron-style auth: look up team from team_members
      const adminSupabase = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: teams, error: teamErr } = await adminSupabase
        .from('team_members')
        .select('team_id')
        .limit(1);
      if (teamErr) {
        console.error('[Catalog Sync] Team lookup error:', teamErr);
      }
      teamId = teams?.[0]?.team_id ?? null;
    } else {
      // User session auth
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data: membership } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)
        .single();

      teamId = membership?.team_id ?? null;
    }

    if (!teamId) {
      return NextResponse.json(
        { error: 'No team found' },
        { status: 400 }
      );
    }

    // Parse batch size from request body
    let maxOrders = 100;
    try {
      const body = await request.json();
      if (body?.maxOrders && typeof body.maxOrders === 'number') {
        maxOrders = Math.min(body.maxOrders, 500);
      }
    } catch {
      // No body or invalid JSON — use default
    }

    // Run the catalog sync
    const summary = await syncAmazonCatalog(teamId, maxOrders);

    return NextResponse.json({
      success: !summary.error_message,
      summary,
    });
  } catch (error) {
    console.error('[API /sync/amazon-catalog] Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Catalog sync failed',
      },
      { status: 500 }
    );
  }
}
