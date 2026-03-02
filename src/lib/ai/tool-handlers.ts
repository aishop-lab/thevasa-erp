import { SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = Record<string, any>;

export async function executeToolCall(
  supabase: SupabaseClient,
  toolName: string,
  args: Args
): Promise<unknown> {
  switch (toolName) {
    case "search_products":
      return searchProducts(supabase, args);
    case "get_product_details":
      return getProductDetails(supabase, args);
    case "get_stock_levels":
      return getStockLevels(supabase, args);
    case "get_inventory_discrepancies":
      return getInventoryDiscrepancies(supabase, args);
    case "get_stock_movements":
      return getStockMovements(supabase, args);
    case "search_orders":
      return searchOrders(supabase, args);
    case "get_order_details":
      return getOrderDetails(supabase, args);
    case "get_revenue_overview":
      return getRevenueOverview(supabase, args);
    case "get_expenses_summary":
      return getExpensesSummary(supabase, args);
    case "get_pnl_report":
      return getPnlReport(supabase, args);
    case "get_top_products":
      return getTopProducts(supabase, args);
    case "get_platform_comparison":
      return getPlatformComparison(supabase, args);
    case "get_dashboard_stats":
      return getDashboardStats(supabase);
    case "get_returns_analysis":
      return getReturnsAnalysis(supabase, args);
    case "add_expense":
      return addExpense(supabase, args);
    case "adjust_stock":
      return adjustStock(supabase, args);
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function getPlatformMap(
  supabase: SupabaseClient
): Promise<Map<string, string>> {
  const { data } = await supabase.from("platforms").select("id, name");
  return new Map((data ?? []).map((p) => [p.id, p.name.toLowerCase()]));
}

function toStartIso(dateStr: string): string {
  // Start of day: YYYY-MM-DDT00:00:00.000Z
  const d = new Date(dateStr);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function toEndIso(dateStr: string): string {
  // End of day: YYYY-MM-DDT23:59:59.999Z
  const d = new Date(dateStr);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}


// ── Products ─────────────────────────────────────────────────────────────

async function searchProducts(supabase: SupabaseClient, args: Args) {
  let query = supabase
    .from("products")
    .select(
      "id, name, sku, category, status, cost_price, mrp, gst_rate, variants:product_variants(id, variant_sku, size, color)"
    )
    .order("created_at", { ascending: false });

  if (args.category) query = query.eq("category", args.category);
  if (args.status) query = query.eq("status", args.status);
  if (args.search) {
    query = query.or(
      `name.ilike.%${args.search}%,sku.ilike.%${args.search}%`
    );
  }

  const limit = args.limit ?? 20;
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    count: data?.length ?? 0,
    products: (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      status: p.status,
      cost_price: p.cost_price,
      mrp: p.mrp,
      gst_rate: p.gst_rate,
      variant_count: (p.variants as unknown[])?.length ?? 0,
    })),
  };
}

async function getProductDetails(supabase: SupabaseClient, args: Args) {
  let query = supabase
    .from("products")
    .select(
      "*, variants:product_variants(*, stock:warehouse_stock(*, warehouse:warehouses(name))), platform_mappings(*)"
    );

  if (args.product_id) {
    query = query.eq("id", args.product_id);
  } else if (args.sku) {
    query = query.eq("sku", args.sku);
  } else {
    return { error: "Provide product_id or sku" };
  }

  const { data, error } = await query.single();
  if (error) return { error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const product = data as any;
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: product.category,
    status: product.status,
    cost_price: product.cost_price,
    mrp: product.mrp,
    gst_rate: product.gst_rate,
    description: product.description,
    variants: (product.variants ?? []).map((v: any) => ({
      variant_sku: v.variant_sku,
      size: v.size,
      color: v.color,
      stock: (v.stock ?? []).map((s: any) => ({
        warehouse: s.warehouse?.name,
        on_hand: s.qty_on_hand,
        reserved: s.qty_reserved,
        available: s.qty_available,
      })),
    })),
    platform_mappings: (product.platform_mappings ?? []).map((m: any) => ({
      platform_id: m.platform_id,
      external_id: m.external_id,
    })),
  };
}

// ── Inventory ────────────────────────────────────────────────────────────

async function getStockLevels(supabase: SupabaseClient, args: Args) {
  let query = supabase
    .from("warehouse_stock")
    .select(
      "id, qty_on_hand, qty_reserved, qty_available, variant:product_variants(variant_sku, size, color, product:products(name, low_stock_threshold)), warehouse:warehouses(name, is_fba)"
    )
    .order("updated_at", { ascending: false });

  const limit = args.limit ?? 50;
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) return { error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let results = (data ?? []).map((s: any) => ({
    variant_sku: s.variant?.variant_sku,
    product_name: s.variant?.product?.name,
    size: s.variant?.size,
    color: s.variant?.color,
    warehouse: s.warehouse?.name,
    is_fba: s.warehouse?.is_fba,
    on_hand: s.qty_on_hand,
    reserved: s.qty_reserved,
    available: s.qty_available,
    low_stock_threshold: s.variant?.product?.low_stock_threshold ?? 10,
  }));

  if (args.warehouse_name) {
    results = results.filter((r: any) =>
      r.warehouse?.toLowerCase().includes(args.warehouse_name.toLowerCase())
    );
  }
  if (args.product_name) {
    results = results.filter((r: any) =>
      r.product_name
        ?.toLowerCase()
        .includes(args.product_name.toLowerCase())
    );
  }
  if (args.variant_sku) {
    results = results.filter(
      (r: any) => r.variant_sku === args.variant_sku
    );
  }
  if (args.low_stock_only) {
    results = results.filter(
      (r: any) => r.available <= r.low_stock_threshold
    );
  }

  return { count: results.length, stock: results };
}

async function getInventoryDiscrepancies(
  supabase: SupabaseClient,
  args: Args
) {
  let query = supabase
    .from("inventory_discrepancies")
    .select(
      "id, system_qty, physical_qty, difference, severity, status, detected_at, notes, variant:product_variants(variant_sku, product:products(name)), warehouse:warehouses(name)"
    )
    .order("detected_at", { ascending: false })
    .limit(50);

  if (args.status) query = query.eq("status", args.status as any);
  if (args.severity) query = query.eq("severity", args.severity as any);

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    count: data?.length ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    discrepancies: (data ?? []).map((d: any) => ({
      id: d.id,
      product_name: d.variant?.product?.name,
      variant_sku: d.variant?.variant_sku,
      warehouse: d.warehouse?.name,
      system_qty: d.system_qty,
      physical_qty: d.physical_qty,
      difference: d.difference ?? d.system_qty - d.physical_qty,
      severity: d.severity,
      status: d.status,
      detected_at: d.detected_at,
      notes: d.notes,
    })),
  };
}

async function getStockMovements(supabase: SupabaseClient, args: Args) {
  let query = supabase
    .from("stock_movements")
    .select(
      "id, quantity, movement_type, reason, created_at, variant:product_variants(variant_sku, product:products(name)), warehouse:warehouses(name)"
    )
    .order("created_at", { ascending: false });

  if (args.movement_type)
    query = query.eq("movement_type", args.movement_type as any);
  if (args.start_date)
    query = query.gte("created_at", toStartIso(args.start_date));
  if (args.end_date)
    query = query.lte("created_at", toEndIso(args.end_date));

  const limit = args.limit ?? 50;
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) return { error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let results = (data ?? []).map((m: any) => ({
    id: m.id,
    product_name: m.variant?.product?.name,
    variant_sku: m.variant?.variant_sku,
    warehouse: m.warehouse?.name,
    quantity: m.quantity,
    movement_type: m.movement_type,
    reason: m.reason,
    date: m.created_at,
  }));

  if (args.variant_sku) {
    results = results.filter(
      (r: any) => r.variant_sku === args.variant_sku
    );
  }

  return { count: results.length, movements: results };
}

// ── Orders ───────────────────────────────────────────────────────────────

async function searchOrders(supabase: SupabaseClient, args: Args) {
  const platformMap = await getPlatformMap(supabase);

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_email, total_amount, status, ordered_at, platform_id"
    )
    .order("ordered_at", { ascending: false });

  if (args.status) query = query.eq("status", args.status as any);
  if (args.start_date)
    query = query.gte("ordered_at", toStartIso(args.start_date));
  if (args.end_date)
    query = query.lte("ordered_at", toEndIso(args.end_date));
  if (args.search) {
    query = query.or(
      `order_number.ilike.%${args.search}%,customer_name.ilike.%${args.search}%`
    );
  }

  // Platform filter: find matching platform_id
  if (args.platform) {
    const platformEntry = Array.from(platformMap.entries()).find(
      ([, name]) => name === args.platform.toLowerCase()
    );
    if (platformEntry) {
      query = query.eq("platform_id", platformEntry[0]);
    }
  }

  const limit = args.limit ?? 20;
  query = query.limit(limit);

  const { data, error } = await query;
  if (error) return { error: error.message };

  return {
    count: data?.length ?? 0,
    orders: (data ?? []).map((o) => ({
      id: o.id,
      order_number: o.order_number,
      customer: o.customer_name,
      email: o.customer_email,
      amount: o.total_amount,
      status: o.status,
      platform: platformMap.get(o.platform_id) ?? "unknown",
      date: o.ordered_at,
    })),
  };
}

async function getOrderDetails(supabase: SupabaseClient, args: Args) {
  const platformMap = await getPlatformMap(supabase);

  let query = supabase
    .from("orders")
    .select(
      "*, order_items(*, variant:product_variants(variant_sku, size, color, product:products(name)))"
    );

  if (args.order_id) {
    query = query.eq("id", args.order_id);
  } else if (args.order_number) {
    query = query.eq("order_number", args.order_number);
  } else {
    return { error: "Provide order_id or order_number" };
  }

  const { data, error } = await query.single();
  if (error) return { error: error.message };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = data as any;
  return {
    id: order.id,
    order_number: order.order_number,
    customer: order.customer_name,
    email: order.customer_email,
    phone: order.customer_phone,
    platform: platformMap.get(order.platform_id) ?? "unknown",
    status: order.status,
    total_amount: order.total_amount,
    subtotal: order.subtotal,
    tax: order.tax_amount,
    shipping_cost: order.shipping_cost,
    discount: order.discount_amount,
    shipping_address: order.shipping_address,
    ordered_at: order.ordered_at,
    items: (order.order_items ?? []).map((item: any) => ({
      product: item.variant?.product?.name ?? item.product_name,
      variant_sku: item.variant?.variant_sku ?? item.sku,
      size: item.variant?.size,
      color: item.variant?.color,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
    })),
  };
}

// ── Finance ──────────────────────────────────────────────────────────────

async function getRevenueOverview(supabase: SupabaseClient, args: Args) {
  const startIso = toStartIso(args.start_date);
  const endIso = toEndIso(args.end_date);

  const [currentRes, prevRes] = await Promise.all([
    supabase
      .from("sales_revenue")
      .select("gross_revenue, discount, net_revenue, tax_collected")
      .gte("date", startIso)
      .lte("date", endIso),
    args.compare_start_date && args.compare_end_date
      ? supabase
          .from("sales_revenue")
          .select("gross_revenue, discount, net_revenue, tax_collected")
          .gte("date", toStartIso(args.compare_start_date))
          .lte("date", toEndIso(args.compare_end_date))
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  if (currentRes.error) return { error: currentRes.error.message };

  const sum = (arr: any[], key: string) =>
    arr.reduce((s, r) => s + Number(r[key] ?? 0), 0);

  const current = currentRes.data ?? [];
  const prev = prevRes.data ?? [];

  const grossRevenue = sum(current, "gross_revenue");
  const netRevenue = sum(current, "net_revenue");

  return {
    gross_revenue: grossRevenue,
    discounts: sum(current, "discount"),
    net_revenue: netRevenue,
    tax_collected: sum(current, "tax_collected"),
    ...(prev.length > 0
      ? {
          previous_gross_revenue: sum(prev, "gross_revenue"),
          previous_net_revenue: sum(prev, "net_revenue"),
        }
      : {}),
  };
}

async function getExpensesSummary(supabase: SupabaseClient, args: Args) {
  const startIso = toStartIso(args.start_date);
  const endIso = toEndIso(args.end_date);

  const [expRes, feesRes] = await Promise.all([
    supabase
      .from("expenses")
      .select("amount, category, gst_amount")
      .gte("date", startIso)
      .lte("date", endIso),
    supabase
      .from("platform_fees")
      .select("amount")
      .gte("date", startIso)
      .lte("date", endIso),
  ]);

  if (expRes.error) return { error: expRes.error.message };

  const expenses = expRes.data ?? [];
  const fees = feesRes.data ?? [];

  const totalExpenses = expenses.reduce(
    (s, e) => s + Number(e.amount ?? 0),
    0
  );
  const totalGst = expenses.reduce(
    (s, e) => s + Number(e.gst_amount ?? 0),
    0
  );
  const totalPlatformFees = fees.reduce(
    (s, f) => s + Number(f.amount ?? 0),
    0
  );

  const catMap = new Map<string, number>();
  for (const e of expenses) {
    const cat = e.category || "Other";
    catMap.set(cat, (catMap.get(cat) ?? 0) + Number(e.amount ?? 0));
  }
  if (totalPlatformFees > 0) {
    catMap.set(
      "Platform Fees",
      (catMap.get("Platform Fees") ?? 0) + totalPlatformFees
    );
  }

  return {
    total_expenses: totalExpenses + totalPlatformFees,
    total_gst: totalGst,
    platform_fees: totalPlatformFees,
    by_category: Array.from(catMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  };
}

async function getPnlReport(supabase: SupabaseClient, args: Args) {
  const startIso = toStartIso(args.start_date);
  const endIso = toEndIso(args.end_date);

  const [revenueRes, expensesRes, feesRes, cogsRes] = await Promise.all([
    supabase
      .from("sales_revenue")
      .select("gross_revenue, discount, net_revenue")
      .gte("date", startIso)
      .lte("date", endIso),
    supabase
      .from("expenses")
      .select("amount")
      .gte("date", startIso)
      .lte("date", endIso),
    supabase
      .from("platform_fees")
      .select("amount")
      .gte("date", startIso)
      .lte("date", endIso),
    supabase
      .from("cogs_records")
      .select("total_cost")
      .gte("date", startIso)
      .lte("date", endIso),
  ]);

  if (revenueRes.error) return { error: revenueRes.error.message };

  const revenues = revenueRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const fees = feesRes.data ?? [];
  const cogsRecs = cogsRes.data ?? [];

  const grossRevenue = revenues.reduce(
    (s, r) => s + Number(r.gross_revenue ?? 0),
    0
  );
  const discounts = revenues.reduce(
    (s, r) => s + Number(r.discount ?? 0),
    0
  );
  const netRevenue = revenues.reduce(
    (s, r) => s + Number(r.net_revenue ?? 0),
    0
  );
  const cogs = cogsRecs.reduce(
    (s: number, c: any) => s + Number(c.total_cost ?? 0),
    0
  );
  const operatingExpenses = expenses.reduce(
    (s, e) => s + Number((e as any).amount ?? 0),
    0
  );
  const platformFees = fees.reduce(
    (s, f) => s + Number((f as any).amount ?? 0),
    0
  );

  const grossProfit = netRevenue - cogs;
  const netProfit = grossProfit - operatingExpenses - platformFees;

  return {
    gross_revenue: grossRevenue,
    discounts,
    net_revenue: netRevenue,
    cogs,
    gross_profit: grossProfit,
    operating_expenses: operatingExpenses,
    platform_fees: platformFees,
    net_profit: netProfit,
    gross_margin:
      netRevenue > 0
        ? Math.round((grossProfit / netRevenue) * 100 * 100) / 100
        : 0,
    net_margin:
      netRevenue > 0
        ? Math.round((netProfit / netRevenue) * 100 * 100) / 100
        : 0,
  };
}

async function getTopProducts(supabase: SupabaseClient, args: Args) {
  const startIso = toStartIso(args.start_date);
  const endIso = toEndIso(args.end_date);
  const limit = args.limit ?? 10;

  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select("id")
    .gte("ordered_at", startIso)
    .lte("ordered_at", endIso);

  if (ordersErr) return { error: ordersErr.message };
  if (!orders || orders.length === 0)
    return { count: 0, products: [] };

  const orderIds = orders.map((o) => o.id);

  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("product_name, sku, quantity, total")
    .in("order_id", orderIds);

  if (itemsErr) return { error: itemsErr.message };

  const productMap = new Map<
    string,
    { name: string; units_sold: number; revenue: number }
  >();

  for (const item of items ?? []) {
    const name = item.product_name ?? item.sku ?? "Unknown";
    const existing = productMap.get(name) ?? {
      name,
      units_sold: 0,
      revenue: 0,
    };
    existing.units_sold += Number(item.quantity);
    existing.revenue += Number(item.total);
    productMap.set(name, existing);
  }

  const sorted = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);

  return { count: sorted.length, products: sorted };
}

async function getPlatformComparison(
  supabase: SupabaseClient,
  args: Args
) {
  const startDate = args.start_date
    ? toStartIso(args.start_date)
    : (() => {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d.toISOString();
      })();
  const endDate = args.end_date
    ? toEndIso(args.end_date)
    : new Date().toISOString();

  const { data: orders } = await supabase
    .from("orders")
    .select("total_amount, status, platform:platforms(name)")
    .gte("ordered_at", startDate)
    .lte("ordered_at", endDate);

  let amazonOrders = 0,
    shopifyOrders = 0,
    amazonRevenue = 0,
    shopifyRevenue = 0,
    amazonReturns = 0,
    shopifyReturns = 0;

  for (const order of orders ?? []) {
    const platformName =
      (order.platform as unknown as { name: string })?.name ?? "";
    const amount = Number(order.total_amount ?? 0);
    const isReturn =
      order.status === "returned" || order.status === "refunded";

    if (platformName.toLowerCase() === "amazon") {
      amazonOrders++;
      amazonRevenue += amount;
      if (isReturn) amazonReturns++;
    } else if (platformName.toLowerCase() === "shopify") {
      shopifyOrders++;
      shopifyRevenue += amount;
      if (isReturn) shopifyReturns++;
    }
  }

  return {
    amazon: {
      orders: amazonOrders,
      revenue: amazonRevenue,
      returns: amazonReturns,
      avg_order_value:
        amazonOrders > 0 ? Math.round(amazonRevenue / amazonOrders) : 0,
    },
    shopify: {
      orders: shopifyOrders,
      revenue: shopifyRevenue,
      returns: shopifyReturns,
      avg_order_value:
        shopifyOrders > 0 ? Math.round(shopifyRevenue / shopifyOrders) : 0,
    },
  };
}

async function getDashboardStats(supabase: SupabaseClient) {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).toISOString();
  const yesterdayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1
  ).toISOString();

  const { count: todayOrders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("ordered_at", todayStart);

  const { count: yesterdayOrders } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .gte("ordered_at", yesterdayStart)
    .lt("ordered_at", todayStart);

  const { data: todayRevenueData } = await supabase
    .from("orders")
    .select("total_amount")
    .gte("ordered_at", todayStart);

  const todayRevenue =
    todayRevenueData?.reduce(
      (sum, o) => sum + Number(o.total_amount ?? 0),
      0
    ) ?? 0;

  const { data: yesterdayRevenueData } = await supabase
    .from("orders")
    .select("total_amount")
    .gte("ordered_at", yesterdayStart)
    .lt("ordered_at", todayStart);

  const yesterdayRevenue =
    yesterdayRevenueData?.reduce(
      (sum, o) => sum + Number(o.total_amount ?? 0),
      0
    ) ?? 0;

  const { count: pendingShipments } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .in("status", ["confirmed", "processing"]);

  const { data: stockData } = await supabase
    .from("warehouse_stock")
    .select(
      "qty_available, variant:product_variants(product:products(low_stock_threshold))"
    );

  const lowStockCount =
    stockData?.filter((s) => {
      const threshold =
        (
          s.variant as unknown as {
            product: { low_stock_threshold: number };
          }
        )?.product?.low_stock_threshold ?? 10;
      return Number(s.qty_available) <= threshold;
    }).length ?? 0;

  return {
    today_orders: todayOrders ?? 0,
    yesterday_orders: yesterdayOrders ?? 0,
    today_revenue: todayRevenue,
    yesterday_revenue: yesterdayRevenue,
    pending_shipments: pendingShipments ?? 0,
    low_stock_count: lowStockCount,
  };
}

// ── Returns & RTO ────────────────────────────────────────────────────────

async function getReturnsAnalysis(supabase: SupabaseClient, args: Args) {
  const startIso = toStartIso(args.start_date);
  const endIso = toEndIso(args.end_date);
  const groupBy = args.group_by ?? "summary";

  const platformMap = await getPlatformMap(supabase);

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, status, total_amount, platform_id, fulfillment_status, ordered_at, order_items(product_name, sku, quantity, total)"
    )
    .gte("ordered_at", startIso)
    .lte("ordered_at", endIso);

  if (error) return { error: error.message };

  const allOrders = orders ?? [];
  const totalOrders = allOrders.length;

  if (groupBy === "status") {
    // Full order status distribution
    const statusCounts = new Map<string, { count: number; amount: number }>();
    for (const o of allOrders) {
      const st = o.status || "unknown";
      const existing = statusCounts.get(st) ?? { count: 0, amount: 0 };
      existing.count++;
      existing.amount += Number(o.total_amount ?? 0);
      statusCounts.set(st, existing);
    }

    return {
      total_orders: totalOrders,
      by_status: Array.from(statusCounts.entries())
        .map(([status, { count, amount }]) => ({
          status,
          count,
          percentage: totalOrders > 0 ? Math.round((count / totalOrders) * 10000) / 100 : 0,
          amount,
        }))
        .sort((a, b) => b.count - a.count),
    };
  }

  // Classify orders
  const returned = allOrders.filter((o) => o.status === "returned");
  const refunded = allOrders.filter((o) => o.status === "refunded");
  const rto = allOrders.filter(
    (o) =>
      o.status === "cancelled" &&
      (o.fulfillment_status === "fulfilled" || o.fulfillment_status === "returned")
  );

  if (groupBy === "platform") {
    const groups = new Map<
      string,
      { returns: number; refunds: number; rto: number; total: number; amount: number }
    >();

    for (const o of allOrders) {
      const name = platformMap.get(o.platform_id) ?? "other";
      const g = groups.get(name) ?? { returns: 0, refunds: 0, rto: 0, total: 0, amount: 0 };
      g.total++;
      if (o.status === "returned") {
        g.returns++;
        g.amount += Number(o.total_amount ?? 0);
      }
      if (o.status === "refunded") {
        g.refunds++;
        g.amount += Number(o.total_amount ?? 0);
      }
      if (o.status === "cancelled" && (o.fulfillment_status === "fulfilled" || o.fulfillment_status === "returned")) {
        g.rto++;
      }
      groups.set(name, g);
    }

    return {
      by_platform: Array.from(groups.entries()).map(([platform, g]) => ({
        platform,
        returns: g.returns,
        refunds: g.refunds,
        rto: g.rto,
        total_orders: g.total,
        return_rate: g.total > 0 ? Math.round(((g.returns + g.refunds) / g.total) * 10000) / 100 : 0,
        rto_rate: g.total > 0 ? Math.round((g.rto / g.total) * 10000) / 100 : 0,
        revenue_impact: g.amount,
      })),
    };
  }

  if (groupBy === "product") {
    const limit = args.limit ?? 20;
    const productMap = new Map<
      string,
      { name: string; sku: string; returns: number; sold: number; amount: number }
    >();

    for (const order of allOrders) {
      const isReturn = order.status === "returned" || order.status === "refunded";
      const items = (order.order_items ?? []) as any[];
      for (const item of items) {
        const name = item.product_name ?? item.sku ?? "Unknown";
        const existing = productMap.get(name) ?? { name, sku: item.sku ?? "", returns: 0, sold: 0, amount: 0 };
        existing.sold += Number(item.quantity ?? 0);
        if (isReturn) {
          existing.returns += Number(item.quantity ?? 0);
          existing.amount += Number(item.total ?? 0);
        }
        productMap.set(name, existing);
      }
    }

    return {
      top_returned_products: Array.from(productMap.values())
        .filter((p) => p.returns > 0)
        .map((p) => ({
          product_name: p.name,
          sku: p.sku,
          returns: p.returns,
          units_sold: p.sold,
          return_rate: p.sold > 0 ? Math.round((p.returns / p.sold) * 10000) / 100 : 0,
          revenue_impact: p.amount,
        }))
        .sort((a, b) => b.returns - a.returns)
        .slice(0, limit),
    };
  }

  if (groupBy === "trend") {
    const weekMap = new Map<
      string,
      { returns: number; refunds: number; orders: number; weekLabel: string }
    >();

    for (const order of allOrders) {
      if (!order.ordered_at) continue;
      const d = new Date(order.ordered_at);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(d.getFullYear(), d.getMonth(), diff);
      const key = weekStart.toISOString().split("T")[0];

      const g = weekMap.get(key) ?? {
        returns: 0,
        refunds: 0,
        orders: 0,
        weekLabel: `Week of ${weekStart.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`,
      };
      g.orders++;
      if (order.status === "returned") g.returns++;
      if (order.status === "refunded") g.refunds++;
      weekMap.set(key, g);
    }

    return {
      weekly_trend: Array.from(weekMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, g]) => ({
          week: g.weekLabel,
          date,
          returns: g.returns,
          refunds: g.refunds,
          total_orders: g.orders,
          return_rate: g.orders > 0 ? Math.round(((g.returns + g.refunds) / g.orders) * 10000) / 100 : 0,
        })),
    };
  }

  // Default: summary
  const returnAmount = returned.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const refundAmount = refunded.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);

  return {
    total_orders: totalOrders,
    total_returns: returned.length,
    total_refunds: refunded.length,
    total_rto: rto.length,
    return_rate: totalOrders > 0 ? Math.round((returned.length / totalOrders) * 10000) / 100 : 0,
    refund_rate: totalOrders > 0 ? Math.round((refunded.length / totalOrders) * 10000) / 100 : 0,
    rto_rate: totalOrders > 0 ? Math.round((rto.length / totalOrders) * 10000) / 100 : 0,
    return_amount: returnAmount,
    refund_amount: refundAmount,
    total_revenue_impact: returnAmount + refundAmount,
  };
}

// ── Actions ──────────────────────────────────────────────────────────────

async function addExpense(supabase: SupabaseClient, args: Args) {
  const gstRate = args.gst_rate ?? 0;
  const amount = Number(args.amount);
  const gstAmount = (amount * gstRate) / (100 + gstRate);

  // Get team_id from user's team membership
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: membership } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return { error: "No team found" };

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      team_id: membership.team_id,
      category: args.category,
      description: args.description,
      amount,
      date: args.date,
      gst_rate: gstRate,
      gst_amount: Math.round(gstAmount * 100) / 100,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  return {
    success: true,
    expense: {
      id: data.id,
      category: data.category,
      description: data.description,
      amount: data.amount,
      date: data.date,
      gst_amount: data.gst_amount,
    },
  };
}

async function adjustStock(supabase: SupabaseClient, args: Args) {
  // Find the variant by SKU
  const { data: variant, error: variantErr } = await supabase
    .from("product_variants")
    .select("id, variant_sku, product:products(name)")
    .eq("variant_sku", args.variant_sku)
    .single();

  if (variantErr || !variant)
    return { error: `Variant not found: ${args.variant_sku}` };

  // Find the default (non-FBA) warehouse
  const { data: warehouse } = await supabase
    .from("warehouses")
    .select("id, name")
    .eq("is_fba", false)
    .limit(1)
    .single();

  if (!warehouse) return { error: "No warehouse found" };

  // Fetch current stock to preserve reserved quantity
  const { data: currentStock } = await supabase
    .from("warehouse_stock")
    .select("qty_reserved")
    .eq("warehouse_id", warehouse.id)
    .eq("variant_id", variant.id)
    .single();

  const currentReserved = currentStock?.qty_reserved ?? 0;
  const newOnHand = args.quantity;
  const newAvailable = newOnHand - currentReserved;

  // Upsert stock preserving reserved quantity
  // Note: qty_available is a GENERATED column (qty_on_hand - qty_reserved), not set directly
  const { error: stockErr } = await supabase
    .from("warehouse_stock")
    .upsert(
      {
        warehouse_id: warehouse.id,
        variant_id: variant.id,
        qty_on_hand: newOnHand,
        qty_reserved: currentReserved,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "warehouse_id,variant_id" }
    );

  if (stockErr) return { error: stockErr.message };

  // Record stock movement
  const { error: movementErr } = await supabase
    .from("stock_movements")
    .insert({
      warehouse_id: warehouse.id,
      variant_id: variant.id,
      quantity: args.quantity,
      movement_type: "adjustment",
      reason: args.reason,
    });

  if (movementErr) return { error: movementErr.message };

  return {
    success: true,
    adjustment: {
      variant_sku: args.variant_sku,
      product_name: (variant.product as any)?.name,
      warehouse: warehouse.name,
      new_quantity: newOnHand,
      available: newAvailable,
      reserved: currentReserved,
      reason: args.reason,
    },
  };
}
