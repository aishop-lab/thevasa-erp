// =============================================================================
// Thevasa ERP - Shopify Inventory Sync
// =============================================================================

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  getShopifyClientForTeam,
  getShopifyPlatform,
  extractShopifyId,
} from './client';

// -----------------------------------------------------------------------------
// GraphQL Queries & Mutations
// -----------------------------------------------------------------------------

const LOCATIONS_QUERY = `
  query FetchLocations {
    locations(first: 50) {
      edges {
        node {
          id
          name
          isActive
          fulfillsOnlineOrders
          address {
            address1
            address2
            city
            province
            provinceCode
            country
            countryCode
            zip
            phone
          }
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const INVENTORY_LEVELS_QUERY = `
  query FetchInventoryLevels($locationId: ID!, $first: Int!, $after: String) {
    location(id: $locationId) {
      id
      name
      inventoryLevels(first: $first, after: $after) {
        edges {
          node {
            id
            quantities(names: ["available", "incoming", "committed", "on_hand"]) {
              name
              quantity
            }
            item {
              id
              sku
              tracked
              variant {
                id
                sku
                title
                product {
                  id
                  title
                }
              }
            }
            updatedAt
          }
          cursor
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const INVENTORY_SET_QUANTITIES_MUTATION = `
  mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
    inventorySetOnHandQuantities(input: $input) {
      inventoryAdjustmentGroup {
        createdAt
        reason
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// -----------------------------------------------------------------------------
// Response Types
// -----------------------------------------------------------------------------

interface GqlLocation {
  id: string;
  name: string;
  isActive: boolean;
  fulfillsOnlineOrders: boolean;
  address: {
    address1: string | null;
    address2: string | null;
    city: string | null;
    province: string | null;
    provinceCode: string | null;
    country: string | null;
    countryCode: string | null;
    zip: string | null;
    phone: string | null;
  };
}

interface GqlInventoryLevel {
  id: string;
  quantities: { name: string; quantity: number }[];
  item: {
    id: string;
    sku: string | null;
    tracked: boolean;
    variant: {
      id: string;
      sku: string | null;
      title: string;
      product: { id: string; title: string };
    } | null;
  };
  updatedAt: string;
}

interface LocationsQueryResponse {
  locations: {
    edges: { node: GqlLocation; cursor: string }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

interface InventoryLevelsQueryResponse {
  location: {
    id: string;
    name: string;
    inventoryLevels: {
      edges: { node: GqlInventoryLevel; cursor: string }[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
}

interface SetQuantitiesResponse {
  inventorySetOnHandQuantities: {
    inventoryAdjustmentGroup: { createdAt: string; reason: string } | null;
    userErrors: { field: string[]; message: string }[];
  };
}

// -----------------------------------------------------------------------------
// Sync Function
// -----------------------------------------------------------------------------

/**
 * Sync inventory levels from Shopify into the ERP.
 *
 * For each Shopify location:
 *   1. Find or create the matching warehouse (keyed by Shopify location GID)
 *   2. Fetch all inventory levels at that location
 *   3. Match inventory items to internal variants via platform_mappings
 *   4. Update warehouse_stock and create stock_movements for any changes
 */
export async function syncShopifyInventory(teamId: string): Promise<{
  processed: number;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
}> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const client = await getShopifyClientForTeam(teamId);
  const platform = await getShopifyPlatform(teamId);

  const stats = { processed: 0, created: 0, updated: 0, failed: 0, errors: [] as string[] };

  // Create sync log
  const { data: syncLog } = await supabase
    .from('sync_logs')
    .insert({
      team_id: teamId,
      platform_id: platform.id,
      sync_type: 'inventory',
      status: 'running',
      records_processed: 0,
      records_created: 0,
      records_updated: 0,
      records_failed: 0,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  try {
    // Fetch all Shopify locations
    const locationsResp = await client.query<LocationsQueryResponse>(LOCATIONS_QUERY);

    if (locationsResp.errors?.length) {
      throw new Error(
        `Failed to fetch locations: ${locationsResp.errors.map((e) => e.message).join('; ')}`
      );
    }

    const locations = locationsResp.data.locations.edges
      .map((e) => e.node)
      .filter((loc) => loc.isActive);

    // Pre-fetch platform mappings for variant matching
    const { data: mappings } = await supabase
      .from('platform_mappings')
      .select('variant_id, external_variant_id')
      .eq('team_id', teamId)
      .eq('platform_id', platform.id)
      .eq('is_active', true);

    const externalVariantToInternal = new Map(
      (mappings ?? [])
        .filter((m) => m.variant_id)
        .map((m) => [m.external_variant_id, m.variant_id])
    );

    // Process each location
    for (const location of locations) {
      try {
        await processLocation(
          supabase,
          client,
          teamId,
          platform.id,
          location,
          externalVariantToInternal,
          stats
        );
      } catch (error) {
        const msg = `Failed to process location ${location.name} (${location.id}): ${error instanceof Error ? error.message : String(error)}`;
        stats.errors.push(msg);
        console.error('[Shopify Inventory]', msg);
      }
    }

    // Update sync log
    if (syncLog?.id) {
      await supabase
        .from('sync_logs')
        .update({
          status: stats.failed > 0 && stats.processed > 0 ? 'partial' : stats.failed > 0 ? 'failed' : 'completed',
          records_processed: stats.processed,
          records_created: stats.created,
          records_updated: stats.updated,
          records_failed: stats.failed,
          error_message: stats.errors.length > 0 ? stats.errors.join('\n') : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);
    }

    console.log(
      `[Shopify Inventory] Sync complete: ${stats.processed} processed, ${stats.created} created, ${stats.updated} updated, ${stats.failed} failed`
    );

    return stats;
  } catch (error) {
    if (syncLog?.id) {
      await supabase
        .from('sync_logs')
        .update({
          status: 'failed',
          records_processed: stats.processed,
          records_created: stats.created,
          records_updated: stats.updated,
          records_failed: stats.failed,
          error_message: error instanceof Error ? error.message : String(error),
          completed_at: new Date().toISOString(),
        })
        .eq('id', syncLog.id);
    }

    throw error;
  }
}

// -----------------------------------------------------------------------------
// Process a Single Location
// -----------------------------------------------------------------------------

async function processLocation(
  supabase: any,
  client: Awaited<ReturnType<typeof getShopifyClientForTeam>>,
  teamId: string,
  platformId: string,
  location: GqlLocation,
  externalVariantToInternal: Map<string, string>,
  stats: { processed: number; created: number; updated: number; failed: number; errors: string[] }
) {
  // Find or create warehouse for this Shopify location
  const warehouseId = await ensureWarehouse(supabase, teamId, platformId, location);

  // Paginate through all inventory levels at this location
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const variables: Record<string, unknown> = {
      locationId: location.id,
      first: 100,
    };
    if (cursor) variables.after = cursor;

    const response = await client.query<InventoryLevelsQueryResponse>(
      INVENTORY_LEVELS_QUERY,
      variables
    );

    if (response.errors?.length) {
      const errorMessages = response.errors.map((e) => e.message).join('; ');
      stats.errors.push(`GraphQL errors for location ${location.name}: ${errorMessages}`);
      if (!response.data?.location) break;
    }

    const { edges, pageInfo } = response.data.location.inventoryLevels;

    for (const { node: level } of edges) {
      stats.processed++;

      // Find the internal variant
      const variantGid = level.item?.variant?.id;
      if (!variantGid) {
        continue; // Inventory item without a variant, skip
      }

      const internalVariantId = externalVariantToInternal.get(variantGid);
      if (!internalVariantId) {
        // No mapping -- skip but don't count as failure (unmapped items are expected before product sync)
        continue;
      }

      // Extract available quantity
      const availableQty = level.quantities.find((q) => q.name === 'available')?.quantity ?? 0;
      const onHandQty = level.quantities.find((q) => q.name === 'on_hand')?.quantity ?? 0;
      const committedQty = level.quantities.find((q) => q.name === 'committed')?.quantity ?? 0;

      try {
        // Check existing warehouse stock
        const { data: existingStock } = await supabase
          .from('warehouse_stock')
          .select('id, qty_on_hand, qty_reserved, qty_available')
          .eq('team_id', teamId)
          .eq('warehouse_id', warehouseId)
          .eq('variant_id', internalVariantId)
          .single();

        if (existingStock) {
          const oldQty = existingStock.qty_on_hand;
          const delta = onHandQty - oldQty;

          // Update stock
          const { error: updateError } = await supabase
            .from('warehouse_stock')
            .update({
              qty_on_hand: onHandQty,
              qty_reserved: committedQty,
              qty_available: availableQty,
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', existingStock.id);

          if (updateError) {
            stats.failed++;
            stats.errors.push(
              `Failed to update stock for variant ${internalVariantId}: ${updateError.message}`
            );
            continue;
          }

          // Create stock movement if quantity changed
          if (delta !== 0) {
            await supabase.from('stock_movements').insert({
              team_id: teamId,
              warehouse_id: warehouseId,
              variant_id: internalVariantId,
              movement_type: 'adjustment',
              quantity: delta,
              reference_type: 'shopify_sync',
              reference_id: level.id,
              notes: `Shopify inventory sync: ${oldQty} -> ${onHandQty} (location: ${location.name})`,
            });
          }

          stats.updated++;
        } else {
          // Create new stock record
          const { error: insertError } = await supabase
            .from('warehouse_stock')
            .insert({
              team_id: teamId,
              warehouse_id: warehouseId,
              variant_id: internalVariantId,
              qty_on_hand: onHandQty,
              qty_reserved: committedQty,
              qty_available: availableQty,
              last_synced_at: new Date().toISOString(),
            });

          if (insertError) {
            stats.failed++;
            stats.errors.push(
              `Failed to create stock for variant ${internalVariantId}: ${insertError.message}`
            );
            continue;
          }

          // Create initial stock movement
          if (onHandQty !== 0) {
            await supabase.from('stock_movements').insert({
              team_id: teamId,
              warehouse_id: warehouseId,
              variant_id: internalVariantId,
              movement_type: 'adjustment',
              quantity: onHandQty,
              reference_type: 'shopify_sync',
              reference_id: level.id,
              notes: `Initial Shopify inventory sync (location: ${location.name})`,
            });
          }

          stats.created++;
        }
      } catch (error) {
        stats.failed++;
        stats.errors.push(
          `Error processing inventory level ${level.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }
}

// -----------------------------------------------------------------------------
// Ensure Warehouse Exists
// -----------------------------------------------------------------------------

async function ensureWarehouse(
  supabase: any,
  teamId: string,
  platformId: string,
  location: GqlLocation
): Promise<string> {
  // Use the Shopify location GID as a unique code for the warehouse
  const warehouseCode = `shopify-${extractShopifyId(location.id)}`;

  const { data: existing } = await supabase
    .from('warehouses')
    .select('id')
    .eq('team_id', teamId)
    .eq('code', warehouseCode)
    .single();

  if (existing) return existing.id;

  // Create new warehouse
  const { data: created, error } = await supabase
    .from('warehouses')
    .insert({
      team_id: teamId,
      name: `Shopify - ${location.name}`,
      code: warehouseCode,
      address: location.address.address1,
      city: location.address.city,
      state: location.address.province,
      pincode: location.address.zip,
      is_fba: false,
      platform_id: platformId,
      is_active: true,
    })
    .select('id')
    .single();

  if (error || !created) {
    throw new Error(
      `Failed to create warehouse for Shopify location ${location.name}: ${error?.message ?? 'no data returned'}`
    );
  }

  return created.id;
}

// -----------------------------------------------------------------------------
// Push Inventory to Shopify (Bidirectional Sync)
// -----------------------------------------------------------------------------

/**
 * Push an inventory quantity update from the ERP to Shopify.
 *
 * This sets the on-hand quantity for a specific variant at a specific location.
 * Requires the Shopify inventory_item_id and location_id, which are resolved
 * from platform_mappings and warehouse records.
 *
 * @param teamId   - The team ID
 * @param variantId - Internal ERP variant ID
 * @param quantity  - The new on-hand quantity to set
 * @param warehouseId - Optional: specific warehouse to push to (defaults to first Shopify warehouse)
 */
export async function pushInventoryToShopify(
  teamId: string,
  variantId: string,
  quantity: number,
  warehouseId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const client = await getShopifyClientForTeam(teamId);
    const platform = await getShopifyPlatform(teamId);

    // Look up the Shopify variant via platform_mappings
    const { data: mapping, error: mappingError } = await supabase
      .from('platform_mappings')
      .select('external_variant_id, external_product_id')
      .eq('team_id', teamId)
      .eq('platform_id', platform.id)
      .eq('variant_id', variantId)
      .eq('is_active', true)
      .single();

    if (mappingError || !mapping?.external_variant_id) {
      return {
        success: false,
        error: `No Shopify mapping found for variant ${variantId}`,
      };
    }

    // We need the inventory_item_id for the Shopify variant.
    // Fetch it via a lightweight query.
    const variantResp = await client.query<{
      productVariant: {
        inventoryItem: { id: string };
      } | null;
    }>(
      `query GetVariantInventoryItem($id: ID!) {
        productVariant(id: $id) {
          inventoryItem {
            id
          }
        }
      }`,
      { id: mapping.external_variant_id }
    );

    const inventoryItemId = variantResp.data?.productVariant?.inventoryItem?.id;
    if (!inventoryItemId) {
      return {
        success: false,
        error: `Could not find inventory item for Shopify variant ${mapping.external_variant_id}`,
      };
    }

    // Resolve the Shopify location ID from the warehouse
    let locationGid: string | null = null;

    if (warehouseId) {
      const { data: warehouse } = await supabase
        .from('warehouses')
        .select('code')
        .eq('id', warehouseId)
        .single();

      if (warehouse?.code?.startsWith('shopify-')) {
        const locationNumericId = warehouse.code.replace('shopify-', '');
        locationGid = `gid://shopify/Location/${locationNumericId}`;
      }
    }

    if (!locationGid) {
      // Default: fetch primary location from Shopify
      const locResp = await client.query<LocationsQueryResponse>(LOCATIONS_QUERY);
      const primaryLocation = locResp.data?.locations.edges.find(
        (e) => e.node.isActive && e.node.fulfillsOnlineOrders
      );
      locationGid = primaryLocation?.node.id ?? locResp.data?.locations.edges[0]?.node.id;
    }

    if (!locationGid) {
      return { success: false, error: 'No Shopify location found' };
    }

    // Set the quantity
    const mutationResp = await client.query<SetQuantitiesResponse>(
      INVENTORY_SET_QUANTITIES_MUTATION,
      {
        input: {
          reason: 'correction',
          referenceDocumentUri: `thevasa-erp://variant/${variantId}`,
          setQuantities: [
            {
              inventoryItemId: inventoryItemId,
              locationId: locationGid,
              quantity: quantity,
            },
          ],
        },
      }
    );

    const userErrors = mutationResp.data?.inventorySetOnHandQuantities?.userErrors ?? [];
    if (userErrors.length > 0) {
      return {
        success: false,
        error: `Shopify user errors: ${userErrors.map((e) => e.message).join('; ')}`,
      };
    }

    if (mutationResp.errors?.length) {
      return {
        success: false,
        error: `GraphQL errors: ${mutationResp.errors.map((e) => e.message).join('; ')}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
