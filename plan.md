# Thevasa ERP - Multi-Channel Inventory Management Platform

## Context

Thevasa is an online clothing brand (thevasa.in) selling on Shopify, Amazon FBA, and Myntra. Currently there is no unified system to track inventory, orders, or finances across platforms. The core pain point is **inventory discrepancies** between actual warehouse stock and Amazon FBA inventory, plus lack of consolidated financial visibility. This ERP will be the single source of truth.

**Scope for v1**: Shopify + Amazon integration. Myntra deferred to v2.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + shadcn/ui + Tailwind CSS |
| Backend/DB | Supabase (Postgres, Auth, Edge Functions, Realtime, Storage) |
| Amazon API | `amazon-sp-api` npm package (SP-API with LWA OAuth) |
| Shopify API | `@shopify/shopify-api` (GraphQL Admin API) |
| State/Fetching | TanStack React Query + Supabase Realtime |
| Charts | Recharts |
| Tables | TanStack Table |
| Forms | React Hook Form + Zod |
| Deployment | Vercel (frontend) + Supabase Cloud (backend) |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── invite/[token]/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                 # Sidebar + header shell
│   │   ├── page.tsx                   # Dashboard home
│   │   ├── inventory/
│   │   │   ├── page.tsx               # Warehouse stock overview
│   │   │   ├── discrepancies/page.tsx # FBA vs warehouse comparison
│   │   │   └── movements/page.tsx     # Stock movement history
│   │   ├── orders/
│   │   │   ├── page.tsx               # Unified order list
│   │   │   └── [id]/page.tsx          # Order detail
│   │   ├── products/
│   │   │   ├── page.tsx               # Product catalog
│   │   │   ├── new/page.tsx           # Add product
│   │   │   └── [id]/page.tsx          # Product detail + variants + mappings
│   │   ├── finance/
│   │   │   ├── page.tsx               # Finance overview
│   │   │   ├── revenue/page.tsx       # Revenue analytics
│   │   │   ├── expenses/page.tsx      # Expense tracking
│   │   │   ├── pnl/page.tsx           # P&L reports
│   │   │   ├── gst/page.tsx           # GST reports
│   │   │   └── settlements/page.tsx   # Settlement reconciliation
│   │   └── settings/
│   │       ├── page.tsx               # General settings
│   │       ├── platforms/page.tsx     # Connect Amazon/Shopify
│   │       ├── team/page.tsx          # Team members & roles
│   │       └── warehouses/page.tsx    # Warehouse config
│   └── api/
│       ├── webhooks/
│       │   ├── shopify/route.ts       # Shopify webhook receiver
│       │   └── amazon/route.ts        # Amazon notification receiver
│       ├── sync/
│       │   ├── amazon/route.ts        # Amazon sync trigger
│       │   └── shopify/route.ts       # Shopify sync trigger
│       └── cron/
│           ├── sync-inventory/route.ts
│           └── sync-orders/route.ts
├── components/
│   ├── ui/                            # shadcn/ui components
│   ├── layout/
│   │   ├── sidebar.tsx
│   │   ├── header.tsx
│   │   └── breadcrumbs.tsx
│   ├── dashboard/
│   │   ├── stats-cards.tsx
│   │   ├── revenue-chart.tsx
│   │   ├── platform-comparison.tsx
│   │   └── inventory-alerts.tsx
│   ├── inventory/
│   │   ├── stock-table.tsx
│   │   ├── discrepancy-table.tsx
│   │   ├── stock-adjustment-dialog.tsx
│   │   └── movement-log.tsx
│   ├── orders/
│   │   ├── order-table.tsx
│   │   ├── order-filters.tsx
│   │   └── order-detail-card.tsx
│   ├── products/
│   │   ├── product-form.tsx
│   │   ├── variant-manager.tsx
│   │   └── platform-mapping-form.tsx
│   └── finance/
│       ├── revenue-breakdown.tsx
│       ├── expense-form.tsx
│       ├── pnl-report.tsx
│       └── gst-summary.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  # Browser client
│   │   ├── server.ts                  # Server component client
│   │   ├── middleware.ts              # Auth middleware
│   │   └── types.ts                   # Generated DB types
│   ├── amazon/
│   │   ├── client.ts                  # SP-API client setup
│   │   ├── inventory.ts              # FBA inventory sync
│   │   ├── orders.ts                 # Orders sync
│   │   ├── finances.ts              # Finances/settlements sync
│   │   └── notifications.ts         # Notification subscriptions
│   ├── shopify/
│   │   ├── client.ts                  # Shopify API client
│   │   ├── products.ts               # Product sync
│   │   ├── orders.ts                 # Order sync
│   │   ├── inventory.ts             # Inventory sync
│   │   └── webhooks.ts              # Webhook verification
│   └── utils/
│       ├── currency.ts
│       ├── date.ts
│       └── sku.ts
├── hooks/
│   ├── use-inventory.ts
│   ├── use-orders.ts
│   ├── use-products.ts
│   ├── use-team.ts
│   └── use-realtime.ts
└── types/
    ├── database.ts                    # Supabase generated types
    ├── amazon.ts
    ├── shopify.ts
    └── index.ts
```

---

## Database Schema

### Core Tables (Supabase Postgres)

**Teams & Auth**
- `teams` — org with GST number, PAN, warehouse address
- `team_members` — user-team mapping with role (admin/manager/viewer/accountant)

**Products**
- `products` — master catalog (SKU, name, cost_price, MRP, GST rate, material)
- `product_variants` — size/color combos with variant_sku, barcode, weight
- `size_masters`, `color_masters` — lookup tables

**Platform Integration**
- `platforms` — shopify, amazon_fba, myntra, direct
- `platform_mappings` — maps variant_id to external_id (ASIN, Shopify product ID)
- `platform_credentials` — encrypted API keys/tokens per platform

**Inventory**
- `warehouses` — physical locations + FBA virtual warehouse
- `warehouse_stock` — qty on_hand, reserved, available (generated column)
- `stock_movements` — audit trail (purchase/sales/transfer/adjustment/return/damage)
- `inventory_discrepancies` — system_qty vs physical_qty with investigation tracking

**Orders**
- `orders` — unified from all platforms with status, amounts, shipping info
- `order_items` — line items linked to product_variants
- `payments` — payment records per order

**Finance**
- `chart_of_accounts` — flexible account structure
- `general_ledger` — double-entry transactions
- `sales_revenue` — per-order revenue by platform
- `expenses` — categorized expenses with GST tracking
- `platform_fees` — commission, FBA fees, payment processing
- `gst_transactions` — SGST/CGST/IGST breakdown
- `cogs_records` — cost of goods sold per order item
- `pl_summary` — monthly P&L materialized data

**Settlements**
- `settlement_cycles` — platform payout periods
- `settlement_transactions` — individual items in a settlement
- `payouts` — actual bank deposits

**Sync**
- `sync_logs` — track sync job status/progress
- `webhook_events` — incoming webhook payload log

**Security**: RLS enabled on all tables, policies enforce team-based access. Financial tables restricted to admin/accountant roles.

---

## Implementation Phases

### Phase 1: Foundation (Days 1-5)

**Goal**: Project scaffold, auth, database, layout shell

1. **Initialize Next.js project**
   ```
   npx create-next-app@latest thevasa-erp --typescript --tailwind --eslint --app --src-dir
   ```
2. **Install dependencies**
   - `@supabase/supabase-js`, `@supabase/ssr`
   - `shadcn/ui` (init + install: button, input, card, table, dialog, dropdown-menu, tabs, badge, toast, sheet, form, select, separator, avatar, command, popover, calendar)
   - `@tanstack/react-query`, `@tanstack/react-table`
   - `react-hook-form`, `@hookform/resolvers`, `zod`
   - `recharts`, `lucide-react`, `date-fns`

3. **Supabase setup**
   - Create new Supabase project
   - Run full database migration SQL (all tables + indexes + RLS policies)
   - Generate TypeScript types: `npx supabase gen types typescript`
   - Configure `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server components), `lib/supabase/middleware.ts` (auth middleware)

4. **Auth pages**
   - Login page (email/password)
   - Signup page (creates team + first admin user)
   - Auth middleware protecting `(dashboard)` routes

5. **Dashboard layout**
   - Sidebar with navigation (Dashboard, Inventory, Orders, Products, Finance, Settings)
   - Header with team name, user avatar, logout
   - Breadcrumbs component
   - Responsive: collapsible sidebar on mobile

**Deliverable**: Working app with auth, empty dashboard shell, all database tables created.

---

### Phase 2: Products & Warehouse (Days 6-12)

**Goal**: Master product catalog, variant management, warehouse stock tracking

1. **Products module**
   - Product list page with search, filter, pagination (TanStack Table)
   - Add/edit product form (name, SKU, cost price, MRP, GST rate, category, material, images)
   - Variant manager: add size/color combinations, set variant SKUs, barcodes
   - Bulk import via CSV upload (Supabase Storage for file upload)

2. **Size & Color masters**
   - Settings page to manage size chart (XS, S, M, L, XL, XXL, etc.)
   - Settings page to manage color palette

3. **Warehouse setup**
   - Create/edit warehouses in settings
   - Create a virtual "Amazon FBA" warehouse (is_fba=true)
   - Assign platform to warehouse

4. **Inventory management**
   - Stock table: view all variants with quantities per warehouse
   - Stock adjustment dialog: add/remove stock with reason (purchase/damage/adjustment)
   - Stock movements log with filters (date, type, warehouse, product)
   - Low stock alerts (configurable threshold per product)

**Deliverable**: Full product catalog with variants, manual warehouse stock management working.

---

### Phase 3: Amazon SP-API Integration (Days 13-22)

**Goal**: Connect Amazon account, sync FBA inventory, orders, and finances

1. **Amazon client setup** (`lib/amazon/client.ts`)
   - Install `amazon-sp-api` package
   - Configure with SP-API credentials (client ID, secret, refresh token)
   - Token refresh handling
   - Rate limiting with exponential backoff

2. **Platform connection UI** (`settings/platforms/page.tsx`)
   - Form to enter Amazon SP-API credentials
   - Store encrypted in `platform_credentials` table
   - Connection test button (calls a simple API endpoint to verify)
   - Connection status indicator

3. **FBA Inventory sync** (`lib/amazon/inventory.ts`)
   - Fetch FBA inventory summaries via `GET /fba/inventory/v1/summaries`
   - Map ASINs to internal variants via `platform_mappings`
   - Update `warehouse_stock` for the FBA virtual warehouse
   - Log sync in `sync_logs`

4. **Amazon Orders sync** (`lib/amazon/orders.ts`)
   - Fetch orders via `GET /orders/v0/orders`
   - Map to unified `orders` table with platform_metadata
   - Create `order_items` linked to product variants
   - Initial backfill of last 90 days, then incremental sync

5. **Amazon Finances sync** (`lib/amazon/finances.ts`)
   - Fetch financial events for orders
   - Extract platform fees (FBA fees, commission, etc.)
   - Create `platform_fees` records
   - Process settlement reports via Reports API

6. **Scheduled sync** (`api/cron/sync-inventory/route.ts`)
   - Vercel Cron job: sync FBA inventory every 30 minutes
   - Vercel Cron job: sync orders every 15 minutes
   - Vercel Cron job: sync settlements daily

7. **Amazon Notifications** (optional, stretch goal)
   - Subscribe to `FBA_INVENTORY_AVAILABILITY_CHANGES` and `ORDER_CHANGE`
   - Webhook receiver at `api/webhooks/amazon/route.ts`

**Deliverable**: Amazon account connected, FBA inventory syncing automatically, orders flowing in.

---

### Phase 4: Shopify Integration (Days 23-30)

**Goal**: Connect Shopify store, sync products/orders/inventory, set up webhooks

1. **Shopify client setup** (`lib/shopify/client.ts`)
   - Install `@shopify/shopify-api`
   - Configure with custom app access token
   - Use GraphQL Admin API (not REST — Shopify recommends GraphQL)

2. **Platform connection UI**
   - Form to enter Shopify store URL + Admin API access token
   - Connection test
   - Store in `platform_credentials`

3. **Product sync** (`lib/shopify/products.ts`)
   - Fetch all products + variants via GraphQL
   - Create `platform_mappings` linking Shopify product/variant IDs to internal variants
   - Auto-match by SKU where possible, manual mapping UI for mismatches

4. **Inventory sync** (`lib/shopify/inventory.ts`)
   - Fetch inventory levels by location via GraphQL
   - Update `warehouse_stock` for Shopify warehouse location
   - Bidirectional: push warehouse changes back to Shopify (optional)

5. **Order sync** (`lib/shopify/orders.ts`)
   - Fetch orders via GraphQL
   - Map to unified `orders` table
   - Backfill last 90 days + incremental

6. **Webhooks** (`api/webhooks/shopify/route.ts`)
   - Verify HMAC signature
   - Handle `orders/create` — insert new order into DB
   - Handle `orders/updated` — update order status
   - Handle `inventory_levels/update` — update stock levels in real-time
   - Log all events in `webhook_events` table

**Deliverable**: Shopify fully connected with real-time webhook updates.

---

### Phase 5: Unified Orders Management (Days 31-36)

**Goal**: Consolidated order view across all platforms

1. **Orders list page**
   - TanStack Table with columns: order#, platform (badge), customer, items, total, status, date
   - Filters: platform, status, date range, search by order# or customer
   - Sort by date, amount, status
   - Pagination (cursor-based for large datasets)

2. **Order detail page**
   - Order summary card (customer, addresses, amounts)
   - Line items with product images, variant details
   - Payment info
   - Platform-specific metadata (Amazon order ID, Shopify order ID)
   - Fulfillment/shipping status timeline
   - Platform fees breakdown for this order

3. **Order status tracking**
   - Realtime status updates via Supabase Realtime
   - Status badges: pending, confirmed, shipped, delivered, cancelled, returned

4. **Returns & cancellations**
   - Track returns from Amazon/Shopify
   - Auto-adjust inventory on return processing
   - Create reverse stock movements

**Deliverable**: Single view to see and manage all orders from every platform.

---

### Phase 6: Finance Module (Days 37-46)

**Goal**: Full financial tracking with GST compliance

1. **Revenue analytics** (`finance/revenue/page.tsx`)
   - Revenue by platform (bar chart comparison)
   - Revenue by product/category (top sellers)
   - Revenue by time period (daily/weekly/monthly trends)
   - Average order value by platform

2. **Expense tracking** (`finance/expenses/page.tsx`)
   - Add expenses with categories (shipping, packaging, marketing, etc.)
   - Upload receipts (Supabase Storage)
   - GST input credit tracking on expenses
   - Monthly expense summary

3. **Platform fees dashboard**
   - Amazon FBA fees breakdown (referral, FBA fulfillment, storage)
   - Shopify transaction fees
   - Fee comparison across platforms

4. **P&L Report** (`finance/pnl/page.tsx`)
   - Monthly/quarterly P&L statement
   - Revenue - COGS = Gross Profit
   - Gross Profit - (Platform Fees + Shipping + Other Expenses) = Net Profit
   - Margin percentages
   - Platform-wise P&L comparison
   - Export to CSV/PDF

5. **GST Reports** (`finance/gst/page.tsx`)
   - GSTR-1 summary (outward supplies)
   - SGST/CGST/IGST breakdown
   - HSN-wise summary
   - Monthly GST liability calculation
   - Export for CA/tax filing

6. **Settlement Reconciliation** (`finance/settlements/page.tsx`)
   - Amazon settlement reports import
   - Match settlements to orders
   - Highlight unmatched/discrepant transactions
   - Payout tracking (expected vs received)

**Deliverable**: Complete financial visibility with GST-compliant reporting.

---

### Phase 7: Dashboard & Discrepancy Detection (Days 47-52)

**Goal**: Executive dashboard with inventory discrepancy alerts

1. **Dashboard home page**
   - **Stats cards**: Today's orders, revenue, pending shipments, low stock alerts
   - **Revenue chart**: Last 30 days trend, platform-wise breakdown (Recharts area chart)
   - **Platform comparison**: Side-by-side metrics (orders, revenue, returns) per platform
   - **Inventory alerts**: Low stock items, discrepancy warnings
   - **Recent orders**: Last 10 orders with status
   - **Top selling products**: This week/month

2. **Inventory Discrepancy Detection** (`inventory/discrepancies/page.tsx`)
   - **Core feature**: Compare warehouse stock vs Amazon FBA inventory
   - Table: Product | Variant | Warehouse Qty | FBA Qty | Discrepancy | Status
   - Color-coded: green (match), yellow (minor), red (major discrepancy)
   - Filters: only show discrepancies, by product, by severity
   - Discrepancy investigation workflow:
     - Click discrepancy → add investigation notes
     - Assign reason (counting error, theft, damage, system error, transfer in transit)
     - Mark as resolved with resolution notes
   - Automated discrepancy detection on every FBA sync
   - Email/notification alerts for new discrepancies above threshold

3. **Realtime updates**
   - Subscribe to `warehouse_stock` changes for live inventory updates
   - Subscribe to `orders` for live order feed
   - Dashboard auto-refreshes without page reload

**Deliverable**: Executive dashboard with real-time data and automated discrepancy detection.

---

### Phase 8: Polish & Deploy (Days 53-58)

**Goal**: Production-ready deployment

1. **Team management**
   - Invite members via email (Supabase Auth invite)
   - Role assignment (admin, manager, viewer, accountant)
   - Role-based UI: hide finance from viewers, hide settings from non-admins

2. **Error handling & loading states**
   - Skeleton loaders for all data tables
   - Error boundaries with retry
   - Toast notifications for actions
   - Optimistic updates where appropriate

3. **Responsive design**
   - Mobile-friendly sidebar (sheet on mobile)
   - Responsive tables (card view on mobile)
   - Touch-friendly interactions

4. **Environment & deployment**
   - Environment variables: Supabase URL/keys, Amazon SP-API creds, Shopify token
   - Vercel deployment with environment config
   - Vercel Cron jobs for sync schedules
   - Domain setup (erp.thevasa.in or similar)

5. **Testing**
   - Manual testing of all sync flows
   - Verify webhook handling
   - Test RLS policies (login as different roles)
   - Load test with 500+ products

---

## Key Architecture Decisions

1. **GraphQL for Shopify, REST for Amazon**: Shopify recommends GraphQL (REST is legacy). Amazon SP-API is REST-only.

2. **Vercel Cron over pg_cron**: Vercel Cron is simpler to manage and doesn't require Supabase Pro plan. API routes at `/api/cron/*` triggered on schedule via `vercel.json`.

3. **TanStack React Query for client data**: Handles caching, background refetching, and optimistic updates. Supabase Realtime for push updates, React Query for pull.

4. **Credentials in Supabase**: Platform API credentials stored in `platform_credentials` table with RLS (admin-only access). For production, consider Supabase Vault for encryption.

5. **Unified SKU mapping**: Internal variant_sku is the source of truth. `platform_mappings` table translates to/from Amazon ASINs and Shopify IDs. Products page includes a mapping UI.

6. **Virtual FBA warehouse**: Amazon FBA is modeled as a warehouse (`is_fba=true`). This makes the discrepancy comparison a simple query: compare stock in "Main Warehouse" vs "Amazon FBA" warehouse for the same variant.

---

## Verification Plan

1. **Auth**: Sign up, create team, invite member, verify role-based access
2. **Products**: Create product with variants, verify SKU uniqueness, test CSV import
3. **Warehouse**: Add stock, verify movement logged, check available qty calculation
4. **Amazon sync**: Connect credentials, trigger sync, verify FBA inventory appears in DB, verify orders sync
5. **Shopify sync**: Connect credentials, trigger sync, verify products/orders appear, test webhooks with Shopify test events
6. **Discrepancies**: Manually set different quantities in warehouse vs FBA, verify discrepancy detected and displayed
7. **Finance**: Create orders, verify revenue calculated, add expenses, generate P&L, check GST breakdown
8. **Realtime**: Open dashboard in two browsers, make changes, verify both update
9. **Roles**: Login as viewer — verify cannot access finance; login as accountant — verify finance access

---

## Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Amazon SP-API
AMAZON_SP_API_CLIENT_ID=
AMAZON_SP_API_CLIENT_SECRET=
AMAZON_SP_API_REFRESH_TOKEN=
AMAZON_SP_API_MARKETPLACE_ID=A21TJRUUN4KGV  # India

# Shopify
SHOPIFY_STORE_URL=thevasa.myshopify.com
SHOPIFY_ACCESS_TOKEN=
SHOPIFY_WEBHOOK_SECRET=

# App
NEXT_PUBLIC_APP_URL=
CRON_SECRET=  # Verify cron requests
```
