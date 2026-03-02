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
  page?: number;
  pageSize?: number;
}

export interface PaginatedOrders {
  data: any[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const orderKeys = {
  all: ["orders"] as const,
  list: (filters?: OrderFilters) =>
    [...orderKeys.all, "list", filters] as const,
  detail: (id: string) => [...orderKeys.all, "detail", id] as const,
  stats: (filters?: { startDate?: string; endDate?: string }) =>
    [...orderKeys.all, "stats", filters] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch a paginated, server-side filtered list of orders.
 */
export function useOrders(filters?: OrderFilters) {
  const supabase = createClient();
  const page = filters?.page ?? 0;
  const pageSize = filters?.pageSize ?? 20;

  return useQuery({
    queryKey: orderKeys.list(filters),
    queryFn: async (): Promise<PaginatedOrders> => {
      let query = supabase
        .from("orders")
        .select(
          "*, platform:platforms(name, display_name), order_items(count)",
          { count: "exact" }
        )
        .order("ordered_at", { ascending: false });

      // Server-side filters
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

      // Pagination
      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      const totalCount = count ?? 0;

      return {
        data: data ?? [],
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };
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
 * Fetch aggregate order statistics with optional date range.
 * Uses count queries and Supabase aggregation instead of fetching all rows.
 */
export function useOrderStats(filters?: {
  startDate?: string;
  endDate?: string;
}) {
  const supabase = createClient();

  return useQuery({
    queryKey: orderKeys.stats(filters),
    queryFn: async () => {
      let baseQuery = supabase
        .from("orders")
        .select("id, total_amount, status, platform_id");

      if (filters?.startDate) {
        baseQuery = baseQuery.gte("ordered_at", filters.startDate);
      }
      if (filters?.endDate) {
        baseQuery = baseQuery.lte("ordered_at", filters.endDate);
      }

      const { data: orders, error } = await baseQuery;
      if (error) throw error;

      const totalOrders = orders?.length ?? 0;
      const totalRevenue =
        orders?.reduce(
          (sum, o) => sum + (Number(o.total_amount) || 0),
          0
        ) ?? 0;
      const averageOrderValue =
        totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Count by status
      const byStatus: Record<string, { count: number; amount: number }> = {};
      orders?.forEach((o) => {
        const status = o.status ?? "unknown";
        if (!byStatus[status])
          byStatus[status] = { count: 0, amount: 0 };
        byStatus[status].count++;
        byStatus[status].amount += Number(o.total_amount) || 0;
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
