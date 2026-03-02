# Thevasa ERP - Project Context

> **Auto-updated**: This file is updated after every major change. It serves as the single source of truth for understanding the entire project.

## Quick Summary

Multi-channel ERP for Thevasa clothing brand (thevasa.in). Manages inventory, orders, and finances across Shopify + Amazon FBA. Core feature: inventory discrepancy detection between warehouse and FBA.

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + shadcn/ui + Tailwind CSS v4
- **Backend/DB**: Supabase (Postgres, Auth, Edge Functions, Realtime, Storage)
- **Amazon**: `amazon-sp-api` (SP-API REST)
- **Shopify**: `@shopify/shopify-api` (GraphQL Admin API)
- **State**: TanStack React Query + Supabase Realtime
- **Tables**: TanStack Table
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **AI**: Google Gemini 2.0 Flash (`@google/generative-ai`) with function calling
- **Deploy**: Vercel + Supabase Cloud

## Project Structure

```
├── plan.md                          # Full implementation plan
├── CLAUDE.md                        # This file - project context
├── src/
│   ├── app/
│   │   ├── (auth)/                  # Auth pages (login, signup, invite)
│   │   ├── (dashboard)/             # Protected dashboard routes
│   │   │   ├── layout.tsx           # Sidebar + header shell
│   │   │   ├── page.tsx             # Dashboard home
│   │   │   ├── inventory/           # Stock, discrepancies, movements
│   │   │   ├── orders/              # Unified order management
│   │   │   ├── products/            # Product catalog + variants
│   │   │   ├── finance/             # Revenue, expenses, P&L, GST
│   │   │   └── settings/            # Team, platforms, warehouses
│   │   └── api/                     # API routes (webhooks, sync, cron)
│   ├── components/
│   │   ├── ui/                      # shadcn/ui components
│   │   ├── layout/                  # Sidebar, header, breadcrumbs
│   │   ├── ai/                      # AI chat button + panel
│   │   ├── dashboard/               # Stats, charts, alerts
│   │   ├── inventory/               # Stock tables, adjustments
│   │   ├── orders/                  # Order tables, filters
│   │   ├── products/                # Product forms, variant manager
│   │   └── finance/                 # Revenue, expense, P&L, GST
│   ├── lib/
│   │   ├── supabase/                # Client, server, middleware, types
│   │   ├── ai/                      # Gemini client, tools, handlers, prompt
│   │   ├── amazon/                  # SP-API client + sync functions
│   │   ├── shopify/                 # GraphQL client + sync functions
│   │   └── utils/                   # Currency, date, SKU helpers
│   ├── hooks/                       # React hooks for data fetching
│   └── types/                       # TypeScript type definitions
```

## Database Schema (25+ tables)

### Teams & Auth
- `teams` — Organization (GST, PAN, address)
- `team_members` — User-team mapping with roles (admin/manager/viewer/accountant)

### Products
- `products` — Master catalog (SKU, name, cost_price, MRP, GST rate)
- `product_variants` — Size/color combos with variant_sku, barcode
- `size_masters`, `color_masters` — Lookup tables

### Platform Integration
- `platforms` — shopify, amazon_fba, myntra, direct
- `platform_mappings` — Maps variant_id to external_id (ASIN, Shopify ID)
- `platform_credentials` — Encrypted API keys/tokens

### Inventory
- `warehouses` — Physical locations + FBA virtual warehouse (is_fba=true)
- `warehouse_stock` — Quantities (on_hand, reserved, available)
- `stock_movements` — Audit trail (purchase/sales/transfer/adjustment/return/damage)
- `inventory_discrepancies` — System vs physical qty with investigation tracking

### Orders
- `orders` — Unified from all platforms
- `order_items` — Line items linked to product_variants
- `payments` — Payment records

### Finance
- `chart_of_accounts`, `general_ledger` — Double-entry accounting
- `sales_revenue` — Per-order revenue by platform
- `expenses` — Categorized with GST tracking
- `platform_fees` — Commission, FBA fees, payment processing
- `gst_transactions` — SGST/CGST/IGST breakdown
- `cogs_records` — Cost of goods sold
- `pl_summary` — Monthly P&L

### Settlements
- `settlement_cycles`, `settlement_transactions`, `payouts`

### Sync
- `sync_logs` — Job status/progress tracking
- `webhook_events` — Incoming webhook payload log

## Key Architecture Decisions

1. **Virtual FBA warehouse**: Amazon FBA modeled as warehouse (is_fba=true) for easy discrepancy comparison
2. **Unified SKU mapping**: Internal variant_sku is source of truth, `platform_mappings` translates to/from external IDs
3. **Vercel Cron over pg_cron**: Simpler, no Supabase Pro needed
4. **GraphQL for Shopify, REST for Amazon**: Following each platform's recommendations
5. **Team-based RLS**: All tables secured with Row Level Security
6. **TanStack React Query + Supabase Realtime**: Pull + push data strategy
7. **AI Analyst Bot**: Gemini 2.0 Flash with 15 function-calling tools for querying all business domains + 2 write actions (add expense, adjust stock). Floating chat panel on dashboard.

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AMAZON_SP_API_CLIENT_ID=
AMAZON_SP_API_CLIENT_SECRET=
AMAZON_SP_API_REFRESH_TOKEN=
AMAZON_SP_API_MARKETPLACE_ID=
SHOPIFY_STORE_URL=
SHOPIFY_ACCESS_TOKEN=
SHOPIFY_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=
CRON_SECRET=
GEMINI_API_KEY=
```

## Current Implementation Status

### Completed
- [x] Next.js 15 project initialized with App Router
- [x] All dependencies installed (Supabase, shadcn/ui, TanStack, Recharts, etc.)
- [x] shadcn/ui components installed (button, input, card, table, dialog, dropdown-menu, tabs, badge, sheet, form, select, separator, avatar, command, popover, calendar, label, textarea, checkbox, switch, tooltip, scroll-area, skeleton, alert, sonner)
- [x] AI Analyst Bot (Gemini 2.0 Flash, 15 tools, floating chat panel, SSE streaming)

### In Progress
- [ ] Database migration SQL
- [ ] Supabase client utilities
- [ ] Auth pages (login, signup, invite)
- [ ] Dashboard layout shell

### Pending
- [ ] Products module (CRUD, variants, CSV import)
- [ ] Inventory module (stock, movements, adjustments)
- [ ] Amazon SP-API integration
- [ ] Shopify integration
- [ ] Unified Orders module
- [ ] Finance module (revenue, expenses, P&L, GST, settlements)
- [ ] Dashboard home + Discrepancy Detection
- [ ] Settings + Team management

## Important Notes for Development

- **ALWAYS update this CLAUDE.md** after completing major features or making architectural changes
- Database migration is in `supabase/migrations/`
- All tables use RLS — policies enforce team-based access
- Financial tables restricted to admin/accountant roles
- Shopify uses GraphQL Admin API (not REST)
- Amazon SP-API is REST-only
- Cron jobs defined in `vercel.json`
