// =============================================================================
// Thevasa ERP - Shopify Webhook Endpoint
// =============================================================================
//
// POST /api/webhooks/shopify
//
// Receives webhook events from Shopify, verifies HMAC, logs the event,
// and routes to the appropriate handler.

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  verifyShopifyWebhook,
  processOrderCreate,
  processOrderUpdate,
  processInventoryUpdate,
} from '@/lib/shopify/webhooks';

// Disable body parsing -- we need the raw body for HMAC verification
export const runtime = 'nodejs';

// Map Shopify topic header values to handler functions
const TOPIC_HANDLERS: Record<
  string,
  ((teamId: string, payload: Record<string, unknown>) => Promise<void>) | undefined
> = {
  'orders/create': processOrderCreate,
  'orders/updated': processOrderUpdate,
  'orders/cancelled': processOrderUpdate, // Reuse update handler for cancellations
  'orders/fulfilled': processOrderUpdate,  // Reuse update handler for fulfillments
  'orders/paid': processOrderUpdate,       // Reuse update handler for payment status
  'inventory_levels/update': processInventoryUpdate,
};

export async function POST(request: NextRequest) {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Read raw body for HMAC verification
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { error: 'Failed to read request body' },
      { status: 400 }
    );
  }

  // Extract Shopify headers
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256') ?? '';
  const topic = request.headers.get('x-shopify-topic') ?? '';
  const shopDomain = request.headers.get('x-shopify-shop-domain') ?? '';
  const webhookId = request.headers.get('x-shopify-webhook-id') ?? '';

  // Verify HMAC signature
  if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
    console.error(`[Shopify Webhook] HMAC verification failed for topic=${topic} shop=${shopDomain}`);
    return NextResponse.json(
      { error: 'Invalid HMAC signature' },
      { status: 401 }
    );
  }

  // Parse the payload
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  // Look up team by Shopify store domain stored in credentials JSON
  const cleanDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  // Query platform_credentials where the JSON credentials contains the shop domain
  const { data: allCreds } = await supabase
    .from('platform_credentials' as any)
    .select('team_id, platform_id, credentials')
    .eq('is_connected', true);

  // Find matching credential by checking store_url in JSON
  const matchingCred = (allCreds as any[])?.find((c: any) => {
    const creds = c.credentials as Record<string, string> | null;
    const storeUrl = creds?.store_url ?? '';
    const cleanStoreUrl = storeUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    return cleanStoreUrl === cleanDomain || storeUrl === shopDomain;
  });

  let teamId: string | null = matchingCred?.team_id ?? null;
  let platformId: string | null = matchingCred?.platform_id ?? null;

  if (!teamId || !platformId) {
    console.error(
      `[Shopify Webhook] No team found for shop domain: ${shopDomain}`
    );
    // Return 200 to prevent Shopify from retrying for an unknown shop
    return NextResponse.json({ status: 'ignored', reason: 'unknown_shop' });
  }

  // Log the webhook event
  const { data: webhookEvent } = await supabase
    .from('webhook_events')
    .insert({
      team_id: teamId,
      platform_id: platformId,
      event_type: topic,
      payload,
      status: 'pending',
      received_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  // Process the webhook asynchronously
  // We respond with 200 immediately and process in the background
  const handler = TOPIC_HANDLERS[topic];

  if (handler) {
    // Process in the background to respond quickly
    processWebhookAsync(
      supabase,
      webhookEvent?.id ?? null,
      teamId,
      topic,
      payload,
      handler
    );
  } else {
    // Unknown topic -- log but don't process
    console.log(`[Shopify Webhook] Unhandled topic: ${topic}`);
    if (webhookEvent?.id) {
      await supabase
        .from('webhook_events')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', webhookEvent.id);
    }
  }

  // Always return 200 quickly to acknowledge receipt
  return NextResponse.json({ status: 'received', webhook_id: webhookId });
}

// -----------------------------------------------------------------------------
// Async Processing
// -----------------------------------------------------------------------------

async function processWebhookAsync(
  supabase: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  webhookEventId: string | null,
  teamId: string,
  topic: string,
  payload: Record<string, unknown>,
  handler: (teamId: string, payload: Record<string, unknown>) => Promise<void>
) {
  try {
    await handler(teamId, payload);

    if (webhookEventId) {
      await supabase
        .from('webhook_events')
        .update({
          status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', webhookEventId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[Shopify Webhook] Error processing ${topic} for team ${teamId}: ${errorMessage}`
    );

    if (webhookEventId) {
      await supabase
        .from('webhook_events')
        .update({
          status: 'failed',
          error_message: errorMessage,
          processed_at: new Date().toISOString(),
        })
        .eq('id', webhookEventId);
    }
  }
}
