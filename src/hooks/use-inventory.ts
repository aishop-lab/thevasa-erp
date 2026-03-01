"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StockMovementFilters {
  warehouseId?: string;
  variantId?: string;
  movementType?: string;
  startDate?: string;
  endDate?: string;
}

export interface DiscrepancyFilters {
  warehouseId?: string;
  status?: string;
  severity?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateStockInput {
  warehouseId: string;
  variantId: string;
  quantity: number;
  movementType: "adjustment" | "inbound" | "outbound" | "return" | "transfer";
  reason?: string;
  referenceId?: string;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const inventoryKeys = {
  all: ["inventory"] as const,
  warehouseStock: (warehouseId?: string) =>
    [...inventoryKeys.all, "warehouse-stock", warehouseId] as const,
  stockMovements: (filters?: StockMovementFilters) =>
    [...inventoryKeys.all, "stock-movements", filters] as const,
  discrepancies: (filters?: DiscrepancyFilters) =>
    [...inventoryKeys.all, "discrepancies", filters] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch warehouse stock levels with variant and product joins.
 *
 * @param warehouseId - Optional warehouse ID to filter by. If omitted, returns
 *   stock across all warehouses.
 */
export function useWarehouseStock(warehouseId?: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: inventoryKeys.warehouseStock(warehouseId),
    queryFn: async () => {
      let query = supabase
        .from("warehouse_stock")
        .select(
          `
          *,
          variant:product_variants (
            *,
            product:products (*)
          ),
          warehouse:warehouses (*)
        `
        )
        .order("updated_at", { ascending: false });

      if (warehouseId) {
        query = query.eq("warehouse_id", warehouseId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Fetch stock movements with optional filters.
 */
export function useStockMovements(filters?: StockMovementFilters) {
  const supabase = createClient();

  return useQuery({
    queryKey: inventoryKeys.stockMovements(filters),
    queryFn: async () => {
      let query = supabase
        .from("stock_movements")
        .select(
          `
          *,
          variant:product_variants (
            *,
            product:products (*)
          ),
          warehouse:warehouses (*)
        `
        )
        .order("created_at", { ascending: false });

      if (filters?.warehouseId) {
        query = query.eq("warehouse_id", filters.warehouseId);
      }
      if (filters?.variantId) {
        query = query.eq("variant_id", filters.variantId);
      }
      if (filters?.movementType) {
        query = query.eq("movement_type", filters.movementType as any);
      }
      if (filters?.startDate) {
        query = query.gte("created_at", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("created_at", filters.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Fetch inventory discrepancies (warehouse vs FBA, etc.) with optional filters.
 */
export function useDiscrepancies(filters?: DiscrepancyFilters) {
  const supabase = createClient();

  return useQuery({
    queryKey: inventoryKeys.discrepancies(filters),
    queryFn: async () => {
      let query = supabase
        .from("inventory_discrepancies")
        .select(
          `
          *,
          variant:product_variants (
            *,
            product:products (*)
          ),
          warehouse:warehouses (*)
        `
        )
        .order("detected_at", { ascending: false });

      if (filters?.warehouseId) {
        query = query.eq("warehouse_id", filters.warehouseId);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status as any);
      }
      if (filters?.severity) {
        query = query.eq("severity", filters.severity as any);
      }
      if (filters?.startDate) {
        query = query.gte("detected_at", filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte("detected_at", filters.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Mutation to update warehouse stock and create a stock movement record.
 *
 * Performs two inserts/updates in sequence:
 *   1. Upserts the `warehouse_stock` row.
 *   2. Inserts a `stock_movements` record for audit.
 */
export function useUpdateStock() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateStockInput) => {
      // 1. Upsert warehouse stock
      const { data: stockData, error: stockError } = await supabase
        .from("warehouse_stock")
        .upsert(
          {
            warehouse_id: input.warehouseId,
            variant_id: input.variantId,
            quantity: input.quantity,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "warehouse_id,variant_id" }
        )
        .select()
        .single();

      if (stockError) throw stockError;

      // 2. Create stock movement record
      const { data: movementData, error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          warehouse_id: input.warehouseId,
          variant_id: input.variantId,
          quantity: input.quantity,
          movement_type: input.movementType as any,
          reason: input.reason ?? null,
          reference_id: input.referenceId ?? null,
        })
        .select()
        .single();

      if (movementError) throw movementError;

      return { stock: stockData, movement: movementData };
    },
    onSuccess: () => {
      // Invalidate all inventory queries so they refetch
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
    },
  });
}
