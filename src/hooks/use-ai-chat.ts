"use client";

import { useState, useCallback, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  /** Tool names currently being executed (shown as progress indicators) */
  activeTools?: string[];
}

/** Human-readable labels for AI tool names */
const TOOL_LABELS: Record<string, string> = {
  search_products: "Searching products",
  get_product_details: "Loading product details",
  get_stock_levels: "Checking stock levels",
  get_inventory_discrepancies: "Analyzing discrepancies",
  get_stock_movements: "Reviewing stock movements",
  search_orders: "Searching orders",
  get_order_details: "Loading order details",
  get_revenue_overview: "Analyzing revenue",
  get_expenses_summary: "Reviewing expenses",
  get_pnl_report: "Generating P&L report",
  get_top_products: "Finding top products",
  get_platform_comparison: "Comparing platforms",
  get_dashboard_stats: "Loading dashboard stats",
  get_returns_analysis: "Analyzing returns",
  add_expense: "Adding expense",
  adjust_stock: "Adjusting stock",
};

export function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? toolName.replace(/_/g, " ");
}

export function useAiChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };

      const assistantId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
        activeTools: [],
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);

      // Build history for the API (all previous messages + new user message)
      const history = [
        ...messages.map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("model" as const),
          content: m.content,
        })),
        { role: "user" as const, content: text },
      ];

      try {
        abortRef.current = new AbortController();

        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);

                if (parsed.content) {
                  // Text content chunk
                  accumulated += parsed.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: accumulated, activeTools: [] }
                        : m
                    )
                  );
                } else if (parsed.type === "tool_start") {
                  // Tool execution started
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            activeTools: [
                              ...(m.activeTools ?? []),
                              parsed.name,
                            ],
                          }
                        : m
                    )
                  );
                } else if (parsed.type === "tool_end") {
                  // Tool execution completed
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? {
                            ...m,
                            activeTools: (m.activeTools ?? []).filter(
                              (t) => t !== parsed.name
                            ),
                          }
                        : m
                    )
                  );
                } else if (parsed.error) {
                  throw new Error(parsed.error);
                }
              } catch (e) {
                // Re-throw actual errors, skip parse failures
                if (e instanceof Error && e.message !== data) throw e;
              }
            }
          }
        }

        // Mark streaming as complete
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, isStreaming: false, activeTools: [] }
              : m
          )
        );
      } catch (error) {
        if ((error as Error).name === "AbortError") return;

        const errorMessage =
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.";

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: `Sorry, I encountered an error: ${errorMessage}`,
                  isStreaming: false,
                  activeTools: [],
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [messages]
  );

  const clearHistory = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsLoading(false);
  }, []);

  return { messages, isLoading, sendMessage, clearHistory };
}
