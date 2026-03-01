"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderFilters {
  platformId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const orderKeys = {
  all: ["orders"] as const,
  list: (filters?: OrderFilters) =>
    [...orderKeys.all, "list", filters] as const,
  detail: (id: string) => [...orderKeys.all, "detail", id] as const,
  stats: () => [...orderKeys.all, "stats"] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch a paginated/filtered list of orders with platform information.
 */
export function useOrders(filters?: OrderFilters) {
  const supabase = createClient();

  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(
          `
          *,
          platform:platforms (*)
        `
        )
        .order("ordered_at", { ascending: false });

      if (filters?.platformId) {
        query = query.eq("platform_id", filters.platformId);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status as any);
      }
      if (filters?.startDate) {
        query = query.gte("ordered_at", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("ordered_at", filters.endDate);
      }
      if (filters?.search) {
        query = query.or(
          `order_number.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Fetch a single order by ID, including its line items with variant/product info.
 */
export function useOrder(id: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: orderKeys.detail(id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          platform:platforms (*),
          order_items (
            *,
            variant:product_variants (
              *,
              product:products (*)
            )
          )
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Fetch aggregate order statistics (total orders, revenue, average order value,
 * and breakdowns by status and platform).
 *
 * This performs multiple queries in parallel and returns combined stats.
 */
export function useOrderStats() {
  const supabase = createClient();

  return useQuery({
    queryKey: orderKeys.stats(),
    queryFn: async () => {
      // Fetch all orders for aggregation
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, total_amount, status, platform_id, ordered_at");

      if (error) throw error;

      const totalOrders = orders?.length ?? 0;
      const totalRevenue =
        orders?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) ?? 0;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Count by status
      const byStatus: Record<string, number> = {};
      orders?.forEach((o) => {
        const status = o.status ?? "unknown";
        byStatus[status] = (byStatus[status] || 0) + 1;
      });

      // Count by platform
      const byPlatform: Record<string, number> = {};
      orders?.forEach((o) => {
        const platform = o.platform_id ?? "unknown";
        byPlatform[platform] = (byPlatform[platform] || 0) + 1;
      });

      return {
        totalOrders,
        totalRevenue,
        averageOrderValue,
        byStatus,
        byPlatform,
      };
    },
  });
}
