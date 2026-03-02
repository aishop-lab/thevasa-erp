import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { syncReturnsAndDelivery } from '@/lib/amazon/returns';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: amazonPlatforms, error: platformsError } = await supabase
      .from('platforms')
      .select('id, team_id')
      .eq('name', 'amazon')
      .eq('is_active', true);

    if (platformsError) {
      throw new Error(`Failed to fetch Amazon platforms: ${platformsError.message}`);
    }

    if (!amazonPlatforms || amazonPlatforms.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active Amazon platforms found',
        teams_synced: 0,
      });
    }

    const results = [];

    for (const platform of amazonPlatforms) {
      try {
        console.log(`[Cron Returns] Starting returns sync for team ${platform.team_id}`);
        const summary = await syncReturnsAndDelivery(platform.team_id);
        results.push({ team_id: platform.team_id, summary });
        console.log(`[Cron Returns] Completed for team ${platform.team_id}:`, summary);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Cron Returns] Error for team ${platform.team_id}:`, msg);
        results.push({ team_id: platform.team_id, error: msg });
      }
    }

    return NextResponse.json({ success: true, teams_synced: amazonPlatforms.length, results });
  } catch (error) {
    console.error('[Cron Returns] Fatal error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
