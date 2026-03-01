// =============================================================================
// Thevasa ERP - Shopify Product Sync
// =============================================================================

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  getShopifyClientForTeam,
  getShopifyPlatform,
  extractShopifyId,
} from './client';
import type { ShopifyProduct, ShopifyProductVariant } from '@/types/shopify';

// -----------------------------------------------------------------------------
// GraphQL Queries
// -----------------------------------------------------------------------------

const PRODUCTS_QUERY = `
  query FetchProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          title
          handle
          descriptionHtml
          vendor
          productType
          status
          tags
          createdAt
          updatedAt
          publishedAt
          totalInventory
          onlineStoreUrl
          options {
            id
            name
            position
            values
          }
          seo {
            title
            description
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                barcode
                price
                compareAtPrice
                position
                inventoryQuantity
                selectedOptions {
                  name
                  value
                }
                weight
                weightUnit
                requiresShipping
                taxable
                taxCode
                createdAt
                updatedAt
                inventoryItem {
                  id
                  sku
                  tracked
                  requiresShipping
                }
                image {
                  id
                  url
                  altText
                  width
                  height
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
          images(first: 10) {
            edges {
              node {
                id
                url
                altText
                width
                height
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
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

// -----------------------------------------------------------------------------
// Response Types (GraphQL camelCase)
// -----------------------------------------------------------------------------

interface GqlProductNode {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  totalInventory: number;
  onlineStoreUrl: string | null;
  options: {
    id: string;
    name: string;
    position: number;
    values: string[];
  }[];
  seo: { title: string | null; description: string | null };
  variants: {
    edges: {
      node: GqlVariantNode;
      cursor: string;
    }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
  images: {
    edges: {
      node: { id: string; url: string; altText: string | null; width: number; height: number };
      cursor: string;
    }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

interface GqlVariantNode {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  compareAtPrice: string | null;
  position: number;
  inventoryQuantity: number;
  selectedOptions: { name: string; value: string }[];
  weight: number | null;
  weightUnit: string;
  requiresShipping: boolean;
  taxable: boolean;
  taxCode: string | null;
  createdAt: string;
  updatedAt: string;
  inventoryItem: {
    id: string;
    sku: string | null;
    tracked: boolean;
    requiresShipping: boolean;
  };
  image: { id: string; url: string; altText: string | null; width: number; height: number } | null;
}

interface ProductsQueryResponse {
  products: {
    edges: { node: GqlProductNode; cursor: string }[];
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
}

// -----------------------------------------------------------------------------
// Sync Function
// -----------------------------------------------------------------------------

/**
 * Sync all Shopify products and their variants into the ERP.
 *
 * For each Shopify variant:
 *   1. Try to auto-match by SKU to an existing product_variant
 *   2. Create/update platform_mappings linking Shopify GID <-> internal variant
 *   3. Log sync results to sync_logs
 */
export async function syncShopifyProducts(teamId: string): Promise<{
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

  // Create sync log entry
  const { data: syncLog, error: syncLogError } = await supabase
    .from('sync_logs')
    .insert({
      team_id: teamId,
      platform_id: platform.id,
      sync_type: 'products',
      status: 'running',
      records_processed: 0,
      records_created: 0,
      records_updated: 0,
      records_failed: 0,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (syncLogError) {
    console.error('[Shopify Products] Failed to create sync log:', syncLogError.message);
  }

  try {
    // Pre-fetch all existing internal variants (by SKU) for auto-matching
    const { data: internalVariants } = await supabase
      .from('product_variants')
      .select('id, variant_sku, product_id')
      .eq('team_id', teamId)
      .eq('is_active', true);

    const skuToVariant = new Map(
      (internalVariants ?? []).map((v) => [v.variant_sku, v])
    );

    // Pre-fetch existing platform mappings
    const { data: existingMappings } = await supabase
      .from('platform_mappings')
      .select('id, external_variant_id, variant_id, external_product_id')
      .eq('team_id', teamId)
      .eq('platform_id', platform.id);

    const mappingByExternalVariant = new Map(
      (existingMappings ?? []).map((m) => [m.external_variant_id, m])
    );

    // Paginate through all products
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      const variables: Record<string, unknown> = { first: 50 };
      if (cursor) variables.after = cursor;

      const response = await client.query<ProductsQueryResponse>(
        PRODUCTS_QUERY,
        variables
      );

      if (response.errors?.length) {
        const errorMessages = response.errors.map((e) => e.message).join('; ');
        stats.errors.push(`GraphQL errors: ${errorMessages}`);
        console.error('[Shopify Products] GraphQL errors:', errorMessages);
        // Continue if there is partial data, otherwise break
        if (!response.data?.products) break;
      }

      const { edges, pageInfo } = response.data.products;

      for (const { node: product } of edges) {
        try {
          await processProduct(
            supabase,
            teamId,
            platform.id,
            product,
            skuToVariant,
            mappingByExternalVariant,
            stats
          );
        } catch (error) {
          stats.failed++;
          const msg = `Failed to process product ${product.id} (${product.title}): ${error instanceof Error ? error.message : String(error)}`;
          stats.errors.push(msg);
          console.error('[Shopify Products]', msg);
        }
      }

      hasNextPage = pageInfo.hasNextPage;
      cursor = pageInfo.endCursor;
    }

    // Update sync log with results
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
      `[Shopify Products] Sync complete: ${stats.processed} processed, ${stats.created} created, ${stats.updated} updated, ${stats.failed} failed`
    );

    return stats;
  } catch (error) {
    // Mark sync as failed
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
// Internal Helpers
// -----------------------------------------------------------------------------

async function processProduct(
  supabase: any,
  teamId: string,
  platformId: string,
  product: GqlProductNode,
  skuToVariant: Map<string, { id: string; variant_sku: string; product_id: string }>,
  mappingByExternalVariant: Map<string, { id: string; external_variant_id: string | null; variant_id: string; external_product_id: string | null }>,
  stats: { processed: number; created: number; updated: number; failed: number; errors: string[] }
) {
  for (const { node: variant } of product.variants.edges) {
    stats.processed++;

    const existingMapping = mappingByExternalVariant.get(variant.id);

    // Try to auto-match by SKU if no existing mapping
    let internalVariantId: string | null = existingMapping?.variant_id ?? null;

    if (!internalVariantId && variant.sku) {
      const matched = skuToVariant.get(variant.sku);
      if (matched) {
        internalVariantId = matched.id;
      }
    }

    const mappingData = {
      team_id: teamId,
      platform_id: platformId,
      variant_id: internalVariantId,
      external_product_id: product.id,
      external_variant_id: variant.id,
      external_sku: variant.sku ?? variant.inventoryItem?.sku ?? null,
      is_active: product.status === 'ACTIVE',
    };

    if (existingMapping) {
      // Update existing mapping
      const { error } = await supabase
        .from('platform_mappings')
        .update({
          ...mappingData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingMapping.id);

      if (error) {
        stats.failed++;
        stats.errors.push(
          `Failed to update mapping for variant ${variant.id}: ${error.message}`
        );
      } else {
        stats.updated++;
      }
    } else {
      // Create new mapping
      const { error } = await supabase
        .from('platform_mappings')
        .insert(mappingData);

      if (error) {
        stats.failed++;
        stats.errors.push(
          `Failed to create mapping for variant ${variant.id}: ${error.message}`
        );
      } else {
        stats.created++;
        // Add to local map so we don't duplicate within the same run
        mappingByExternalVariant.set(variant.id, {
          id: '', // We don't need the actual ID for dedup
          external_variant_id: variant.id,
          variant_id: internalVariantId ?? '',
          external_product_id: product.id,
        });
      }
    }
  }
}
