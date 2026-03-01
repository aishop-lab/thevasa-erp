// =============================================================================
// Thevasa ERP - Amazon Webhook Handler
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  processNotification,
  type AmazonNotificationPayload,
} from '@/lib/amazon/notifications';

// Use service role client for webhook processing (no user session)
function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// -----------------------------------------------------------------------------
// POST /api/webhooks/amazon
// -----------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const supabase = getServiceClient();
  let webhookEventId: string | null = null;

  try {
    // ------------------------------------------------------------------
    // 1. Parse the notification payload
    // ------------------------------------------------------------------
    const payload: AmazonNotificationPayload = await request.json();

    if (!payload.NotificationType) {
      return NextResponse.json(
        { error: 'Invalid notification payload: missing NotificationType' },
        { status: 400 }
      );
    }

    // ------------------------------------------------------------------
    // 2. Determine the team from notification metadata
    // ------------------------------------------------------------------
    // Look up team by matching the subscription ID or application ID
    // to our stored notification subscriptions in the platform config
    // Look up team by matching subscription ID in platform_credentials
    const { data: allCreds } = await supabase
      .from('platform_credentials' as any)
      .select('team_id, platform_id, credentials');

    let teamId: string | null = null;
    let platformId: string | null = null;

    if (allCreds) {
      for (const cred of allCreds as any[]) {
        const credentials = cred.credentials as Record<string, unknown> | null;
        const subscriptions = credentials?.notification_subscriptions as
          | Array<{ subscription_id: string }>
          | undefined;

        if (subscriptions) {
          const match = subscriptions.find(
            (s) =>
              s.subscription_id ===
              payload.NotificationMetadata?.SubscriptionId
          );

          if (match) {
            teamId = cred.team_id;
            platformId = cred.platform_id;
            break;
          }
        }
      }
    }

    // If we cannot determine the team, still log the webhook but skip processing
    if (!teamId || !platformId) {
      console.warn(
        `[Webhook Amazon] Could not determine team for subscription ${payload.NotificationMetadata?.SubscriptionId}. ` +
          'Logging event but skipping processing.'
      );

      // Log as unmatched event (use first credential if available)
      if (allCreds && (allCreds as any[]).length > 0) {
        const firstCred = (allCreds as any[])[0];
        await (supabase.from('webhook_events') as any).insert({
          team_id: firstCred.team_id,
          platform_id: firstCred.platform_id,
          event_type: payload.NotificationType,
          payload: payload as unknown as Record<string, unknown>,
          status: 'failed',
          error_message: 'Could not match notification to a team',
          received_at: new Date().toISOString(),
        });
      }

      // Still return 200 to prevent Amazon from retrying
      return NextResponse.json({ status: 'unmatched' }, { status: 200 });
    }

    // ------------------------------------------------------------------
    // 3. Log the webhook event
    // ------------------------------------------------------------------
    const { data: webhookEvent, error: webhookError } = await supabase
      .from('webhook_events')
      .insert({
        team_id: teamId,
        platform_id: platformId,
        event_type: payload.NotificationType,
        payload: payload as unknown as Record<string, unknown>,
        status: 'pending',
        received_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (webhookError) {
      console.error(
        '[Webhook Amazon] Failed to log webhook event:',
        webhookError.message
      );
    } else {
      webhookEventId = webhookEvent?.id ?? null;
    }

    // ------------------------------------------------------------------
    // 4. Process the notification
    // ------------------------------------------------------------------
    const result = await processNotification(payload, teamId);

    // ------------------------------------------------------------------
    // 5. Update webhook event status
    // ------------------------------------------------------------------
    if (webhookEventId) {
      await supabase
        .from('webhook_events')
        .update({
          status: result.processed ? 'processed' : 'failed',
          error_message: result.error_message,
          processed_at: new Date().toISOString(),
        })
        .eq('id', webhookEventId);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json(
      {
        status: 'ok',
        notification_type: result.notification_type,
        action_taken: result.action_taken,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    console.error('[Webhook Amazon] Error:', errorMessage);

    // Update webhook event if we have one
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

    // Return 200 to prevent retries for errors we cannot recover from
    return NextResponse.json(
      { status: 'error', message: errorMessage },
      { status: 200 }
    );
  }
}
