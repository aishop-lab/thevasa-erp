// =============================================================================
// Thevasa ERP - Amazon Sync API Route
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncFbaInventory } from '@/lib/amazon/inventory';
import { syncAmazonOrders } from '@/lib/amazon/orders';
import { syncAmazonFinances } from '@/lib/amazon/finances';
import { syncReturnsAndDelivery } from '@/lib/amazon/returns';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type SyncType = 'inventory' | 'orders' | 'finances' | 'returns' | 'all';

interface SyncRequestBody {
  teamId?: string;
  syncType?: SyncType;
  options?: {
    daysBack?: number;
    orderId?: string;
  };
}

// -----------------------------------------------------------------------------
// POST /api/sync/amazon
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // ------------------------------------------------------------------
    // 1. Authenticate the request
    // ------------------------------------------------------------------
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ------------------------------------------------------------------
    // 2. Parse and validate request body
    // ------------------------------------------------------------------
    let body: SyncRequestBody = {};
    try {
      body = await request.json();
    } catch {
      // Body may be empty — that's fine, we'll use defaults
    }

    const syncType: SyncType = body.syncType && ['inventory', 'orders', 'finances', 'returns', 'all'].includes(body.syncType)
      ? body.syncType
      : 'all';

    // ------------------------------------------------------------------
    // 3. Resolve teamId from body or from user's membership
    // ------------------------------------------------------------------
    let teamId = body.teamId;

    if (!teamId) {
      const { data: membership, error: memberError } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id)
        .single();

      if (memberError || !membership) {
        return NextResponse.json(
          { error: 'No team found for this user' },
          { status: 403 }
        );
      }

      if (!['admin', 'manager'].includes(membership.role)) {
        return NextResponse.json(
          { error: 'Insufficient permissions. Admin or manager role required.' },
          { status: 403 }
        );
      }

      teamId = membership.team_id;
    } else {
      // Verify user has access to the specified team
      const { data: membership, error: memberError } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', teamId)
        .eq('user_id', user.id)
        .single();

      if (memberError || !membership) {
        return NextResponse.json(
          { error: 'You do not have access to this team' },
          { status: 403 }
        );
      }

      if (!['admin', 'manager'].includes(membership.role)) {
        return NextResponse.json(
          { error: 'Insufficient permissions. Admin or manager role required.' },
          { status: 403 }
        );
      }
    }

    // ------------------------------------------------------------------
    // 4. Run the requested sync
    // ------------------------------------------------------------------
    const results: Record<string, unknown> = {};

    if (syncType === 'inventory' || syncType === 'all') {
      results.inventory = await syncFbaInventory(teamId);
    }

    if (syncType === 'orders' || syncType === 'all') {
      results.orders = await syncAmazonOrders(
        teamId,
        body.options?.daysBack ?? 7
      );
    }

    if (syncType === 'finances' || syncType === 'all') {
      results.finances = await syncAmazonFinances(
        teamId,
        body.options?.orderId
      );
    }

    if (syncType === 'returns' || syncType === 'all') {
      results.returns = await syncReturnsAndDelivery(
        teamId,
        body.options?.daysBack ?? 90
      );
    }

    // ------------------------------------------------------------------
    // 5. Return results
    // ------------------------------------------------------------------
    return NextResponse.json({
      success: true,
      sync_type: syncType,
      results,
    });
  } catch (error) {
    console.error('[API /sync/amazon] Error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
