"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RealtimeFilter {
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema?: string;
  filter?: string; // e.g. "warehouse_id=eq.abc-123"
}

type RealtimeCallback<T extends { [key: string]: any } = Record<string, unknown>> = (
  payload: RealtimePostgresChangesPayload<T>
) => void;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Generic Supabase Realtime subscription hook.
 *
 * Subscribes to Postgres changes on a given table and invokes the callback
 * whenever a matching change event is received.
 *
 * The subscription is automatically cleaned up when the component unmounts
 * or when the table/filter/callback dependencies change.
 *
 * @param table - The Postgres table name to listen on.
 * @param filter - Optional filter configuration (event type, schema, row filter).
 * @param callback - Function called with the realtime payload on each change.
 *
 * @example
 * ```tsx
 * useRealtimeSubscription(
 *   "warehouse_stock",
 *   { event: "UPDATE", filter: "warehouse_id=eq.abc-123" },
 *   (payload) => {
 *     console.log("Stock updated:", payload.new);
 *     queryClient.invalidateQueries({ queryKey: ["inventory"] });
 *   }
 * );
 * ```
 */
export function useRealtimeSubscription<T extends Record<string, unknown> = Record<string, unknown>>(
  table: string,
  filter?: RealtimeFilter,
  callback?: RealtimeCallback<T>
) {
  const supabase = createClient();
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Store the latest callback in a ref so we don't re-subscribe on every render
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!table) return;

    const event = filter?.event ?? "*";
    const schema = filter?.schema ?? "public";

    // Build the channel config
    const channelConfig: {
      event: "INSERT" | "UPDATE" | "DELETE" | "*";
      schema: string;
      table: string;
      filter?: string;
    } = {
      event,
      schema,
      table,
    };

    if (filter?.filter) {
      channelConfig.filter = filter.filter;
    }

    const channelName = `realtime:${schema}:${table}:${event}:${filter?.filter ?? "all"}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as never,
        channelConfig,
        (payload: RealtimePostgresChangesPayload<T>) => {
          callbackRef.current?.(payload);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // Re-subscribe when table or filter values change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, filter?.event, filter?.schema, filter?.filter]);
}
