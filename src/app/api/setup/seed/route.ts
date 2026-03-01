// =============================================================================
// Thevasa ERP - Initial Setup / Seed Route
// =============================================================================
//
// One-time setup endpoint that creates the Amazon platform record, FBA
// warehouse, main warehouse, and stores Amazon credentials. Called after
// the user signs up and the team is created.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's team
    const { data: membership, error: memberError } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', user.id)
      .single();

    if (memberError || !membership) {
      return NextResponse.json(
        { error: 'No team found. Please sign up first.' },
        { status: 400 }
      );
    }

    if (membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can run setup.' },
        { status: 403 }
      );
    }

    const teamId = membership.team_id;
    const results: Record<string, unknown> = {};

    // 1. Create Amazon platform (if not exists)
    const { data: existingAmazon } = await supabase
      .from('platforms')
      .select('id')
      .eq('team_id', teamId)
      .eq('name', 'amazon')
      .single();

    let amazonPlatformId: string;

    if (existingAmazon) {
      amazonPlatformId = existingAmazon.id;
      results.amazon_platform = 'already exists';
    } else {
      const { data: newPlatform, error: platformError } = await supabase
        .from('platforms')
        .insert({
          team_id: teamId,
          name: 'amazon',
          display_name: 'Amazon FBA',
          is_active: true,
        })
        .select('id')
        .single();

      if (platformError) throw platformError;
      amazonPlatformId = newPlatform.id;
      results.amazon_platform = 'created';
    }

    // 2. Create Shopify platform (if not exists)
    const { data: existingShopify } = await supabase
      .from('platforms')
      .select('id')
      .eq('team_id', teamId)
      .eq('name', 'shopify')
      .single();

    if (!existingShopify) {
      await supabase.from('platforms').insert({
        team_id: teamId,
        name: 'shopify',
        display_name: 'Shopify',
        is_active: true,
      });
      results.shopify_platform = 'created';
    } else {
      results.shopify_platform = 'already exists';
    }

    // 3. Create FBA virtual warehouse (if not exists)
    const { data: existingFba } = await supabase
      .from('warehouses')
      .select('id')
      .eq('team_id', teamId)
      .eq('is_fba', true)
      .single();

    if (!existingFba) {
      await supabase.from('warehouses').insert({
        team_id: teamId,
        name: 'Amazon FBA Warehouse',
        code: 'FBA',
        is_fba: true,
        platform_id: amazonPlatformId,
        is_active: true,
      });
      results.fba_warehouse = 'created';
    } else {
      results.fba_warehouse = 'already exists';
    }

    // 4. Create main warehouse (if not exists)
    const { data: existingMain } = await supabase
      .from('warehouses')
      .select('id')
      .eq('team_id', teamId)
      .eq('is_fba', false)
      .limit(1)
      .single();

    if (!existingMain) {
      await supabase.from('warehouses').insert({
        team_id: teamId,
        name: 'Main Warehouse',
        code: 'MAIN',
        is_fba: false,
        is_active: true,
      });
      results.main_warehouse = 'created';
    } else {
      results.main_warehouse = 'already exists';
    }

    // 5. Store Amazon credentials from env vars (if not already stored)
    const { data: existingCreds } = await supabase
      .from('platform_credentials')
      .select('id')
      .eq('team_id', teamId)
      .eq('platform_id', amazonPlatformId)
      .single();

    if (!existingCreds) {
      const clientId = process.env.AMAZON_SP_API_CLIENT_ID;
      const clientSecret = process.env.AMAZON_SP_API_CLIENT_SECRET;
      const refreshToken = process.env.AMAZON_SP_API_REFRESH_TOKEN;

      if (clientId && clientSecret && refreshToken) {
        await supabase.from('platform_credentials').insert({
          team_id: teamId,
          platform_id: amazonPlatformId,
          credentials: {
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            marketplace_id:
              process.env.AMAZON_SP_API_MARKETPLACE_ID ?? 'A21TJRUUN4KGV',
          },
          is_connected: true,
        });
        results.amazon_credentials = 'stored from env vars';
      } else {
        results.amazon_credentials = 'skipped (env vars not set)';
      }
    } else {
      results.amazon_credentials = 'already exists';
    }

    return NextResponse.json({
      success: true,
      team_id: teamId,
      results,
    });
  } catch (error) {
    console.error('[API /setup/seed] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Setup failed' },
      { status: 500 }
    );
  }
}
