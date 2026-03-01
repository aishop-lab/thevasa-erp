// =============================================================================
// Thevasa ERP - Shopify GraphQL Admin API Client
// =============================================================================

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { ShopifyGraphQLResponse, ShopifyQueryCost } from '@/types/shopify';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ShopifyCredentials {
  store_url: string;
  access_token: string;
}

export interface ShopifyGraphQLClient {
  query: <T = unknown>(
    query: string,
    variables?: Record<string, unknown>
  ) => Promise<ShopifyGraphQLResponse<T>>;
  credentials: ShopifyCredentials;
}

interface ThrottleState {
  currently_available: number;
  restore_rate: number;
  maximum_available: number;
  last_updated: number;
}

// -----------------------------------------------------------------------------
// Rate Limiting (cost-based throttling)
// -----------------------------------------------------------------------------

const throttleStates = new Map<string, ThrottleState>();

/**
 * Wait if necessary based on Shopify's cost-based throttle.
 * Shopify GraphQL Admin API uses a "leaky bucket" model:
 * - Max bucket size: 1000 cost points
 * - Restore rate: 50 points/second
 * We track available points from the last response and wait if needed.
 */
async function waitForThrottle(
  storeKey: string,
  estimatedCost: number = 100
): Promise<void> {
  const state = throttleStates.get(storeKey);
  if (!state) return;

  // Calculate how many points have been restored since last request
  const elapsedMs = Date.now() - state.last_updated;
  const restoredPoints = (elapsedMs / 1000) * state.restore_rate;
  const estimatedAvailable = Math.min(
    state.maximum_available,
    state.currently_available + restoredPoints
  );

  if (estimatedAvailable < estimatedCost) {
    const pointsNeeded = estimatedCost - estimatedAvailable;
    const waitMs = Math.ceil((pointsNeeded / state.restore_rate) * 1000) + 100; // +100ms buffer
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

function updateThrottleState(
  storeKey: string,
  cost: ShopifyQueryCost
): void {
  throttleStates.set(storeKey, {
    currently_available: cost.throttle_status.currently_available,
    restore_rate: cost.throttle_status.restore_rate,
    maximum_available: cost.throttle_status.maximum_available,
    last_updated: Date.now(),
  });
}

// -----------------------------------------------------------------------------
// GraphQL Client
// -----------------------------------------------------------------------------

/**
 * Create a Shopify GraphQL Admin API client from raw credentials.
 *
 * @param credentials - The store URL (e.g. "my-store.myshopify.com") and access token.
 * @returns A client object with a `query` method.
 */
export function getShopifyClient(
  credentials: ShopifyCredentials
): ShopifyGraphQLClient {
  const { store_url, access_token } = credentials;

  // Normalise the store URL to ensure a clean hostname
  const hostname = store_url
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');

  const endpoint = `https://${hostname}/admin/api/2024-10/graphql.json`;
  const storeKey = hostname;

  const query = async <T = unknown>(
    gql: string,
    variables: Record<string, unknown> = {}
  ): Promise<ShopifyGraphQLResponse<T>> => {
    // Wait for rate limit headroom
    await waitForThrottle(storeKey);

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': access_token,
          },
          body: JSON.stringify({ query: gql, variables }),
        });

        // Handle 429 Too Many Requests with retry-after
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          const waitSeconds = retryAfter ? parseFloat(retryAfter) : 2 * (attempt + 1);
          console.warn(
            `[Shopify] Rate limited (429). Retrying in ${waitSeconds}s (attempt ${attempt + 1}/${maxRetries})`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, waitSeconds * 1000)
          );
          continue;
        }

        if (!response.ok) {
          const body = await response.text();
          throw new Error(
            `Shopify GraphQL request failed: ${response.status} ${response.statusText} - ${body}`
          );
        }

        const result: ShopifyGraphQLResponse<T> = await response.json();

        // Update throttle state from response extensions
        if (result.extensions?.cost) {
          updateThrottleState(storeKey, result.extensions.cost);
        }

        // Check for throttled errors in the GraphQL response
        const throttledError = result.errors?.find(
          (e) => e.extensions?.code === 'THROTTLED'
        );
        if (throttledError) {
          const cost = result.extensions?.cost;
          const waitMs = cost
            ? Math.ceil(
                ((cost.requested_query_cost - cost.throttle_status.currently_available) /
                  cost.throttle_status.restore_rate) *
                  1000
              ) + 500
            : 2000 * (attempt + 1);

          console.warn(
            `[Shopify] Query throttled. Retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry non-retryable errors
        if (
          lastError.message.includes('401') ||
          lastError.message.includes('403') ||
          lastError.message.includes('404')
        ) {
          throw lastError;
        }

        if (attempt < maxRetries - 1) {
          const backoffMs = 1000 * Math.pow(2, attempt);
          console.warn(
            `[Shopify] Request error, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries}): ${lastError.message}`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError ?? new Error('Shopify GraphQL request failed after retries');
  };

  return { query, credentials };
}

// -----------------------------------------------------------------------------
// Team-based Client
// -----------------------------------------------------------------------------

/**
 * Fetch Shopify credentials for a team from `platform_credentials` and create
 * a GraphQL client.
 *
 * Expects two credential rows per platform:
 *   - credential_type = 'store_url'   -> the myshopify.com hostname
 *   - credential_type = 'access_token' -> the Admin API access token
 */
export async function getShopifyClientForTeam(
  teamId: string
): Promise<ShopifyGraphQLClient> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find the Shopify platform for this team
  const { data: platform, error: platformError } = await supabase
    .from('platforms')
    .select('id')
    .eq('team_id', teamId)
    .eq('name', 'shopify')
    .eq('is_active', true)
    .single();

  if (platformError || !platform) {
    throw new Error(
      `No active Shopify platform found for team ${teamId}: ${platformError?.message ?? 'not found'}`
    );
  }

  // Fetch credentials (stored as JSON blob)
  const { data: credRow, error: credError } = await supabase
    .from('platform_credentials')
    .select('credentials')
    .eq('platform_id', platform.id)
    .eq('team_id', teamId)
    .single();

  if (credError || !credRow) {
    throw new Error(
      `No Shopify credentials found for team ${teamId}: ${credError?.message ?? 'none returned'}`
    );
  }

  const creds = credRow.credentials as Record<string, string> | null;
  const store_url = creds?.store_url;
  const access_token = creds?.access_token;

  if (!store_url || !access_token) {
    const missing = [
      !store_url && 'store_url',
      !access_token && 'access_token',
    ].filter(Boolean);
    throw new Error(
      `Missing Shopify credentials for team ${teamId}: ${missing.join(', ')}`
    );
  }

  return getShopifyClient({ store_url, access_token });
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Extract the numeric ID from a Shopify GID.
 * e.g. "gid://shopify/Product/12345" -> "12345"
 */
export function extractShopifyId(gid: string): string {
  const parts = gid.split('/');
  return parts[parts.length - 1];
}

/**
 * Get the Shopify platform record for a team.
 */
export async function getShopifyPlatform(teamId: string) {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('platforms')
    .select('*')
    .eq('team_id', teamId)
    .eq('name', 'shopify')
    .eq('is_active', true)
    .single();

  if (error || !data) {
    throw new Error(
      `No active Shopify platform for team ${teamId}: ${error?.message ?? 'not found'}`
    );
  }

  return data;
}
