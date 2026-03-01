// =============================================================================
// Thevasa ERP - Amazon SP-API Notifications
// =============================================================================

import {
  getAmazonClientForTeam,
  getAmazonPlatformId,
  withRateLimitRetry,
  AMAZON_IN_MARKETPLACE_ID,
} from './client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { syncFbaInventory } from './inventory';
import { syncAmazonOrders } from './orders';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type AmazonNotificationType =
  | 'FBA_INVENTORY_AVAILABILITY_CHANGES'
  | 'ORDER_CHANGE'
  | 'LISTINGS_ITEM_STATUS_CHANGE'
  | 'ANY_OFFER_CHANGED';

interface NotificationSubscription {
  notification_type: AmazonNotificationType;
  destination_id: string;
  subscription_id: string;
}

export interface AmazonNotificationPayload {
  NotificationType: AmazonNotificationType;
  PayloadVersion: string;
  EventTime: string;
  Payload: Record<string, unknown>;
  NotificationMetadata: {
    ApplicationId: string;
    SubscriptionId: string;
    PublishTime: string;
    NotificationId: string;
  };
}

export interface NotificationProcessResult {
  notification_type: AmazonNotificationType;
  processed: boolean;
  action_taken: string;
  error_message: string | null;
}

// -----------------------------------------------------------------------------
// Subscription Management
// -----------------------------------------------------------------------------

/**
 * Subscribe to Amazon SP-API notifications for a team. Creates subscriptions
 * for FBA_INVENTORY_AVAILABILITY_CHANGES and ORDER_CHANGE notification types.
 *
 * Requires a destination (SQS queue or EventBridge) to be configured first.
 * The webhook endpoint URL should be configured in the Amazon Seller Central
 * notification preferences or via the createDestination API.
 */
export async function subscribeToNotifications(
  teamId: string
): Promise<NotificationSubscription[]> {
  const amazonClient = await getAmazonClientForTeam(teamId);
  const subscriptions: NotificationSubscription[] = [];

  const notificationTypes: AmazonNotificationType[] = [
    'FBA_INVENTORY_AVAILABILITY_CHANGES',
    'ORDER_CHANGE',
  ];

  for (const notificationType of notificationTypes) {
    try {
      // Check if subscription already exists
      const existingSubscription: any = await withRateLimitRetry(() =>
        amazonClient.callAPI({
          operation: 'notifications.getSubscription',
          query: {
            notificationType,
          },
        })
      );

      if (existingSubscription?.payload?.subscriptionId) {
        subscriptions.push({
          notification_type: notificationType,
          destination_id:
            existingSubscription.payload.destinationId ?? '',
          subscription_id:
            existingSubscription.payload.subscriptionId,
        });

        console.log(
          `[Notifications] Subscription already exists for ${notificationType}: ${existingSubscription.payload.subscriptionId}`
        );
        continue;
      }

      // Create new subscription
      const response: any = await withRateLimitRetry(() =>
        amazonClient.callAPI({
          operation: 'notifications.createSubscription',
          body: {
            payloadVersion: '1.0',
            destinationId: process.env.AMAZON_SQS_DESTINATION_ID,
          },
          query: {
            notificationType,
          },
        })
      );

      if (response?.payload?.subscriptionId) {
        subscriptions.push({
          notification_type: notificationType,
          destination_id:
            response.payload.destinationId ?? '',
          subscription_id: response.payload.subscriptionId,
        });

        console.log(
          `[Notifications] Created subscription for ${notificationType}: ${response.payload.subscriptionId}`
        );
      }
    } catch (error) {
      console.error(
        `[Notifications] Failed to subscribe to ${notificationType}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  // Store subscription info in the platform config
  if (subscriptions.length > 0) {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const platformId = await getAmazonPlatformId(teamId);

    // Store subscription info in platform_credentials metadata
    const { data: credRow } = await supabase
      .from('platform_credentials')
      .select('id, credentials')
      .eq('platform_id', platformId)
      .single();

    if (credRow) {
      const currentCreds = (credRow.credentials as Record<string, unknown>) ?? {};
      await supabase
        .from('platform_credentials')
        .update({
          credentials: {
            ...currentCreds,
            notification_subscriptions: subscriptions,
            notifications_configured_at: new Date().toISOString(),
          },
        } as any)
        .eq('id', credRow.id);
    }
  }

  return subscriptions;
}

// -----------------------------------------------------------------------------
// Notification Processing
// -----------------------------------------------------------------------------

/**
 * Process an incoming Amazon notification. Determines the notification type
 * and triggers the appropriate sync or action.
 *
 * This is called from the webhook route handler after the notification
 * has been logged to the webhook_events table.
 */
export async function processNotification(
  payload: AmazonNotificationPayload,
  teamId: string
): Promise<NotificationProcessResult> {
  const notificationType = payload.NotificationType;

  try {
    switch (notificationType) {
      case 'FBA_INVENTORY_AVAILABILITY_CHANGES':
        return await handleInventoryChange(payload, teamId);

      case 'ORDER_CHANGE':
        return await handleOrderChange(payload, teamId);

      default:
        console.warn(
          `[Notifications] Unhandled notification type: ${notificationType}`
        );
        return {
          notification_type: notificationType,
          processed: false,
          action_taken: 'ignored_unknown_type',
          error_message: null,
        };
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    console.error(
      `[Notifications] Error processing ${notificationType}:`,
      errorMessage
    );

    return {
      notification_type: notificationType,
      processed: false,
      action_taken: 'error',
      error_message: errorMessage,
    };
  }
}

// -----------------------------------------------------------------------------
// Notification Handlers
// -----------------------------------------------------------------------------

/**
 * Handle FBA_INVENTORY_AVAILABILITY_CHANGES notification.
 * Triggers a full FBA inventory sync to get the latest data.
 */
async function handleInventoryChange(
  payload: AmazonNotificationPayload,
  teamId: string
): Promise<NotificationProcessResult> {
  console.log(
    `[Notifications] FBA inventory change detected. Triggering sync for team ${teamId}.`
  );

  // Trigger a full inventory sync to pick up the changes
  const syncResult = await syncFbaInventory(teamId);

  return {
    notification_type: 'FBA_INVENTORY_AVAILABILITY_CHANGES',
    processed: syncResult.status !== 'failed',
    action_taken: `inventory_sync_${syncResult.status}`,
    error_message: syncResult.error_message,
  };
}

/**
 * Handle ORDER_CHANGE notification.
 * Fetches recent orders to pick up the changed order.
 */
async function handleOrderChange(
  payload: AmazonNotificationPayload,
  teamId: string
): Promise<NotificationProcessResult> {
  console.log(
    `[Notifications] Order change detected. Syncing recent orders for team ${teamId}.`
  );

  // Sync last 1 day of orders to pick up the change quickly
  const syncResult = await syncAmazonOrders(teamId, 1);

  return {
    notification_type: 'ORDER_CHANGE',
    processed: syncResult.status !== 'failed',
    action_taken: `orders_sync_${syncResult.status}`,
    error_message: syncResult.error_message,
  };
}
