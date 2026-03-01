// =============================================================================
// Thevasa ERP - Amazon SP-API Client
// =============================================================================

import { SellingPartner } from 'amazon-sp-api';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { AMAZON_IN_MARKETPLACE_ID } from '@/types/amazon';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AmazonCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

interface RateLimitOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

// -----------------------------------------------------------------------------
// Internal: Service-role Supabase client (bypasses RLS)
// -----------------------------------------------------------------------------

function getServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// -----------------------------------------------------------------------------
// Client Factory
// -----------------------------------------------------------------------------

/**
 * Initialize an Amazon SP-API SellingPartner client with the given credentials.
 * Configured for the India marketplace (A21TJRUUN4KGV).
 */
export function getAmazonClient(credentials: AmazonCredentials): any {
  const client = new SellingPartner({
    region: 'eu', // India is under the EU region in SP-API
    refresh_token: credentials.refresh_token,
    credentials: {
      SELLING_PARTNER_APP_CLIENT_ID: credentials.client_id,
      SELLING_PARTNER_APP_CLIENT_SECRET: credentials.client_secret,
    },
    options: {
      auto_request_tokens: true,
      auto_request_throttled: true,
      use_sandbox: false,
    },
  });

  return client;
}

/**
 * Fetch Amazon SP-API credentials for a team from the platform_credentials table,
 * then create and return an initialized SellingPartner client.
 * Uses service-role client to bypass RLS (needed for cron jobs).
 */
export async function getAmazonClientForTeam(
  teamId: string
): Promise<any> {
  const supabase = getServiceClient();

  // Find the Amazon platform for this team
  const { data: platform, error: platformError } = await supabase
    .from('platforms')
    .select('id')
    .eq('team_id', teamId)
    .eq('name', 'amazon')
    .eq('is_active', true)
    .single();

  if (platformError || !platform) {
    throw new Error(
      `No active Amazon platform found for team ${teamId}: ${platformError?.message ?? 'not found'}`
    );
  }

  // Fetch credentials for this platform (stored as JSON blob)
  const { data: credRow, error: credError } = await supabase
    .from('platform_credentials')
    .select('credentials')
    .eq('platform_id', platform.id)
    .eq('team_id', teamId)
    .single();

  if (credError || !credRow) {
    throw new Error(
      `No credentials found for Amazon platform ${platform.id}: ${credError?.message ?? 'empty'}`
    );
  }

  // Extract credentials from JSON blob
  const creds = credRow.credentials as Record<string, string> | null;
  const clientId = creds?.client_id;
  const clientSecret = creds?.client_secret;
  const refreshToken = creds?.refresh_token;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      `Incomplete Amazon credentials for team ${teamId}. ` +
        `Missing: ${[
          !clientId && 'client_id',
          !clientSecret && 'client_secret',
          !refreshToken && 'refresh_token',
        ]
          .filter(Boolean)
          .join(', ')}`
    );
  }

  return getAmazonClient({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
}

// -----------------------------------------------------------------------------
// Rate Limiting Helper with Exponential Backoff
// -----------------------------------------------------------------------------

/**
 * Execute an async operation with automatic retry and exponential backoff.
 * Handles Amazon SP-API throttling (HTTP 429) and transient errors.
 */
export async function withRateLimitRetry<T>(
  operation: () => Promise<T>,
  options: RateLimitOptions = {}
): Promise<T> {
  const {
    maxRetries = 5,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isThrottled =
        lastError.message?.includes('429') ||
        lastError.message?.includes('QuotaExceeded') ||
        lastError.message?.includes('Throttl');

      const isTransient =
        lastError.message?.includes('500') ||
        lastError.message?.includes('503') ||
        lastError.message?.includes('ECONNRESET') ||
        lastError.message?.includes('ETIMEDOUT');

      // Only retry on throttle or transient errors
      if (!isThrottled && !isTransient) {
        throw lastError;
      }

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff with jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * baseDelayMs;
      const delay = Math.min(exponentialDelay + jitter, maxDelayMs);

      console.warn(
        `[Amazon SP-API] Rate limited or transient error (attempt ${attempt + 1}/${maxRetries + 1}). ` +
          `Retrying in ${Math.round(delay)}ms...`,
        lastError.message
      );

      await sleep(delay);
    }
  }

  throw new Error(
    `[Amazon SP-API] Max retries (${maxRetries}) exceeded. Last error: ${lastError?.message}`
  );
}

/**
 * Get the Amazon platform ID for a team. Used by sync functions to reference
 * the platform in logs and records.
 * Uses service-role client to bypass RLS.
 */
export async function getAmazonPlatformId(teamId: string): Promise<string> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('platforms')
    .select('id')
    .eq('team_id', teamId)
    .eq('name', 'amazon')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new Error(
      `No active Amazon platform found for team ${teamId}: ${error?.message ?? 'not found'}`
    );
  }

  return data.id;
}

/** Marketplace ID constant re-export for convenience */
export { AMAZON_IN_MARKETPLACE_ID };

// -----------------------------------------------------------------------------
// Internal Helpers
// -----------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
