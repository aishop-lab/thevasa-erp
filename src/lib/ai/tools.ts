import { SchemaType, type FunctionDeclarationSchema } from "@google/generative-ai";

function s(type: SchemaType, description: string): FunctionDeclarationSchema {
  return { type, description } as FunctionDeclarationSchema;
}

function obj(
  properties: Record<string, FunctionDeclarationSchema>,
  required?: string[]
): FunctionDeclarationSchema {
  return {
    type: SchemaType.OBJECT,
    properties,
    ...(required ? { required } : {}),
  } as FunctionDeclarationSchema;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const aiTools: any[] = [
  // ── Products ─────────────────────────────────────────────────────────
  {
    name: "search_products",
    description:
      "Search and filter the product catalog. Returns product name, SKU, category, status, variant count, and price info.",
    parameters: obj({
      search: s(SchemaType.STRING, "Search by product name or SKU (partial match)"),
      category: s(SchemaType.STRING, "Filter by category"),
      status: s(SchemaType.STRING, "Filter by status: active, draft, archived"),
      limit: s(SchemaType.INTEGER, "Max results to return (default 20)"),
    }),
  },
  {
    name: "get_product_details",
    description:
      "Get full details for a specific product including all variants, pricing, and stock levels across warehouses.",
    parameters: obj({
      product_id: s(SchemaType.STRING, "Product UUID"),
      sku: s(SchemaType.STRING, "Product SKU (alternative to product_id)"),
    }),
  },

  // ── Inventory ────────────────────────────────────────────────────────
  {
    name: "get_stock_levels",
    description:
      "Get current stock quantities across warehouses. Can filter by warehouse, product name, variant SKU, or show only low stock items.",
    parameters: obj({
      warehouse_name: s(SchemaType.STRING, "Filter by warehouse name (partial match)"),
      product_name: s(SchemaType.STRING, "Filter by product name (partial match)"),
      variant_sku: s(SchemaType.STRING, "Filter by variant SKU (exact match)"),
      low_stock_only: s(SchemaType.BOOLEAN, "Only return items below their low stock threshold"),
      limit: s(SchemaType.INTEGER, "Max results to return (default 50)"),
    }),
  },
  {
    name: "get_inventory_discrepancies",
    description:
      "Get inventory discrepancies — differences between system quantity and physical count. Used to detect FBA vs warehouse mismatches.",
    parameters: obj({
      status: s(SchemaType.STRING, "Filter by status: open, investigating, resolved"),
      severity: s(SchemaType.STRING, "Filter by severity: minor, moderate, major"),
    }),
  },
  {
    name: "get_stock_movements",
    description:
      "Get inventory movement history (purchases, sales, transfers, adjustments, returns, damage).",
    parameters: obj({
      variant_sku: s(SchemaType.STRING, "Filter by variant SKU"),
      movement_type: s(SchemaType.STRING, "Filter by type: purchase, sale, transfer, adjustment, return, damage"),
      start_date: s(SchemaType.STRING, "Start date (YYYY-MM-DD)"),
      end_date: s(SchemaType.STRING, "End date (YYYY-MM-DD)"),
      limit: s(SchemaType.INTEGER, "Max results (default 50)"),
    }),
  },

  // ── Orders ───────────────────────────────────────────────────────────
  {
    name: "search_orders",
    description:
      "Search and filter orders across all platforms. Returns order number, customer, platform, status, amount, and date.",
    parameters: obj({
      search: s(SchemaType.STRING, "Search by order number or customer name"),
      platform: s(SchemaType.STRING, "Filter by platform name: shopify, amazon"),
      status: s(SchemaType.STRING, "Filter by status: pending, confirmed, processing, shipped, delivered, returned, refunded, cancelled"),
      start_date: s(SchemaType.STRING, "Start date (YYYY-MM-DD)"),
      end_date: s(SchemaType.STRING, "End date (YYYY-MM-DD)"),
      limit: s(SchemaType.INTEGER, "Max results (default 20)"),
    }),
  },
  {
    name: "get_order_details",
    description:
      "Get full order details including line items, customer info, payment status, and shipping.",
    parameters: obj({
      order_id: s(SchemaType.STRING, "Order UUID"),
      order_number: s(SchemaType.STRING, "Order number (alternative to order_id)"),
    }),
  },

  // ── Finance ──────────────────────────────────────────────────────────
  {
    name: "get_revenue_overview",
    description:
      "Get revenue metrics: gross revenue, discounts, net revenue, tax collected. Optionally compare with a previous period.",
    parameters: obj(
      {
        start_date: s(SchemaType.STRING, "Period start date (YYYY-MM-DD)"),
        end_date: s(SchemaType.STRING, "Period end date (YYYY-MM-DD)"),
        compare_start_date: s(SchemaType.STRING, "Comparison period start (YYYY-MM-DD)"),
        compare_end_date: s(SchemaType.STRING, "Comparison period end (YYYY-MM-DD)"),
      },
      ["start_date", "end_date"]
    ),
  },
  {
    name: "get_expenses_summary",
    description:
      "Get expenses breakdown by category including platform fees and GST. Returns total expenses, by-category breakdown.",
    parameters: obj(
      {
        start_date: s(SchemaType.STRING, "Start date (YYYY-MM-DD)"),
        end_date: s(SchemaType.STRING, "End date (YYYY-MM-DD)"),
      },
      ["start_date", "end_date"]
    ),
  },
  {
    name: "get_pnl_report",
    description:
      "Get Profit & Loss report: gross revenue, discounts, net revenue, COGS, gross profit, operating expenses, platform fees, net profit, margins.",
    parameters: obj(
      {
        start_date: s(SchemaType.STRING, "Start date (YYYY-MM-DD)"),
        end_date: s(SchemaType.STRING, "End date (YYYY-MM-DD)"),
      },
      ["start_date", "end_date"]
    ),
  },
  {
    name: "get_top_products",
    description:
      "Get best-selling products by revenue for a date range. Returns product name, units sold, and revenue.",
    parameters: obj(
      {
        start_date: s(SchemaType.STRING, "Start date (YYYY-MM-DD)"),
        end_date: s(SchemaType.STRING, "End date (YYYY-MM-DD)"),
        limit: s(SchemaType.INTEGER, "Number of products (default 10)"),
      },
      ["start_date", "end_date"]
    ),
  },
  {
    name: "get_platform_comparison",
    description:
      "Compare Shopify vs Amazon metrics: orders count, revenue, returns, and average order value for the current month.",
    parameters: obj({
      start_date: s(SchemaType.STRING, "Start date (YYYY-MM-DD)"),
      end_date: s(SchemaType.STRING, "End date (YYYY-MM-DD)"),
    }),
  },
  {
    name: "get_dashboard_stats",
    description:
      "Get today's key dashboard metrics: today's orders, today's revenue, yesterday comparison, pending shipments, and low stock count.",
    parameters: obj({}),
  },

  // ── Returns & RTO ─────────────────────────────────────────────────────
  {
    name: "get_returns_analysis",
    description:
      "Get returns, refunds, and RTO (Return to Origin) analysis. Returns rates, revenue impact, breakdown by platform, top returned products, and order status distribution (delivered, returned, cancelled, etc.).",
    parameters: obj(
      {
        start_date: s(SchemaType.STRING, "Start date (YYYY-MM-DD)"),
        end_date: s(SchemaType.STRING, "End date (YYYY-MM-DD)"),
        group_by: s(SchemaType.STRING, "Group results by: summary, platform, product, status, trend. Default: summary"),
        limit: s(SchemaType.INTEGER, "Max products to return when group_by=product (default 20)"),
      },
      ["start_date", "end_date"]
    ),
  },

  // ── Actions ──────────────────────────────────────────────────────────
  {
    name: "add_expense",
    description:
      "Record a new business expense. Always confirm details with the user before calling this.",
    parameters: obj(
      {
        category: s(SchemaType.STRING, "Expense category: shipping, packaging, marketing, rent, salary, utilities, office, platform_fees, other"),
        description: s(SchemaType.STRING, "Description of the expense"),
        amount: s(SchemaType.NUMBER, "Amount in INR"),
        date: s(SchemaType.STRING, "Expense date (YYYY-MM-DD)"),
        gst_rate: s(SchemaType.NUMBER, "GST rate percentage (e.g. 18 for 18%). Default 0"),
      },
      ["category", "description", "amount", "date"]
    ),
  },
  {
    name: "adjust_stock",
    description:
      "Adjust inventory quantity for a variant in the default warehouse. Creates an audit trail. Always confirm with the user first.",
    parameters: obj(
      {
        variant_sku: s(SchemaType.STRING, "The variant SKU to adjust"),
        quantity: s(SchemaType.INTEGER, "New quantity to set"),
        reason: s(SchemaType.STRING, "Reason for the adjustment"),
      },
      ["variant_sku", "quantity", "reason"]
    ),
  },
];
