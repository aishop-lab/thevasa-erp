"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProductFilters {
  category?: string;
  status?: string;
  search?: string;
}

export interface CreateProductInput {
  name: string;
  sku: string;
  description?: string;
  category?: string;
  brand?: string;
  status?: string;
  images?: string[];
  team_id: string;
}

export interface UpdateProductInput {
  id: string;
  name?: string;
  sku?: string;
  description?: string;
  category?: string;
  brand?: string;
  status?: string;
  images?: string[];
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const productKeys = {
  all: ["products"] as const,
  list: (filters?: ProductFilters) =>
    [...productKeys.all, "list", filters] as const,
  detail: (id: string) => [...productKeys.all, "detail", id] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch a filtered list of products.
 */
export function useProducts(filters?: ProductFilters) {
  const supabase = createClient();

  return useQuery({
    queryKey: productKeys.list(filters),
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(
          `
          *,
          variants:product_variants (*)
        `
        )
        .order("created_at", { ascending: false });

      if (filters?.category) {
        query = query.eq("category", filters.category);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Fetch a single product by ID, including all its variants and platform mappings.
 */
export function useProduct(id: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: productKeys.detail(id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          `
          *,
          variants:product_variants (*),
          platform_mappings (*)
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
 * Mutation to create a new product.
 */
export function useCreateProduct() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductInput) => {
      const { data, error } = await supabase
        .from("products")
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}

/**
 * Mutation to update an existing product.
 */
export function useUpdateProduct() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateProductInput) => {
      const { data, error } = await supabase
        .from("products")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.invalidateQueries({
        queryKey: productKeys.detail(variables.id),
      });
    },
  });
}

/**
 * Mutation to delete a product by ID.
 */
export function useDeleteProduct() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
}
