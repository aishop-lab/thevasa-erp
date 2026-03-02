# Thevasa ERP - Fixes & Features Roadmap

> **Status tracking**: Mark items as [x] when completed

## Phase 1: Bugs & Broken Features (Fix First)

- [x] 1. **Invite system is broken** — Fixed: created server-side `/api/team/invite` route using `auth.admin.inviteUserByEmail`, hook now calls API
- [x] 2. **`useUpdateStock` wrong column names** — Fixed: uses `qty_on_hand`/`qty_reserved`/`qty_available`, takes `quantityDelta` with stock-aware calculation
- [x] 3. **AI `adjustStock` zeroes reserved qty** — Fixed: fetches current `qty_reserved` before upsert, calculates `qty_available = qty_on_hand - qty_reserved`
- [x] 4. **Duplicate discrepancies on every sync** — Fixed: updates existing open/investigating discrepancies, auto-resolves when quantities match
- [x] 5. **`detect_inventory_discrepancies` RPC missing** — Fixed: created `004_detect_discrepancies_rpc.sql` migration with full FULL OUTER JOIN comparison, dedup, and auto-resolve
- [x] 6. **Shopify cron not wired** — Fixed: imported `syncShopifyOrders` and wired to cron route with proper status mapping
- [x] 7. **Webhook async processing killed by Vercel** — Fixed: changed to synchronous processing (await handler before returning response)
- [x] 8. **Fake AI streaming** — Fixed: SSE stream starts immediately, tool progress events sent during execution, final text streamed word-by-word
- [x] **BONUS: `qty_available` GENERATED column writes** — Fixed across all files: removed `qty_available` from all INSERT/UPDATE/UPSERT operations (it's auto-computed by Postgres)

## Phase 2: Critical for Production

- [x] 9. **Server-side pagination** — Fixed: orders, stock table, movements, and discrepancies all use `.range()` + `{ count: 'exact' }` with `manualPagination` in TanStack Table
- [x] 10. **Role-based UI enforcement** — Fixed: created `usePermissions` hook with role matrix, `RoleGate` component, sidebar filters nav by role, finance layout enforces `view_finance`, inventory hides adjust actions for viewers
- [ ] 11. **Bulk operations** — CSV import products, bulk stock adjust, bulk order status, bulk variant gen
- [x] 12. **Data export** — Fixed: CSV export utility + download buttons on Orders, Inventory Stock, and Movements pages (exports all matching filtered data)
- [ ] 13. **Image upload** — wire up Supabase Storage for product images

## Phase 3: Significant Value Features

- [x] 14. **Command palette (`Cmd+K`)** — Fixed: global search across orders/products, role-aware navigation, search button in header with keyboard shortcut hint
- [ ] 15. **Notification system & activity feed** — sync failures, alerts, new orders
- [ ] 16. **Onboarding flow** — first-run wizard for new users
- [ ] 17. **Stock transfer between warehouses** — UI for transfer_in/transfer_out
- [ ] 18. **Purchase order / GRN flow** — receive stock from suppliers
- [ ] 19. **Invoice & packing slip generation** — print/PDF from order detail
- [ ] 20. **AI chat improvements** — persistence, stop button, copy, real streaming, more tools
- [x] 21. **Dark mode toggle** — Fixed: next-themes ThemeProvider in root layout, light/dark/system toggle in header dropdown menu
- [ ] 22. **Refund processing flow** — record what/how much/why was refunded

## Phase 4: Nice-to-Have

- [ ] 23. **Advanced analytics** — contribution margin, sales velocity, demand forecasting, dead stock
- [ ] 24. **GST compliance** — ITC tracking, GSTR format export, state-based split, e-invoice
- [ ] 25. **Settlement reconciliation** — bank statement import, reconciliation workflow
- [ ] 26. **Audit log** — who changed what, when, filterable
- [ ] 27. **Multi-location dashboard** — capacity tracking, bin/shelf management
- [ ] 28. **Shopify OAuth** — replace raw token entry with OAuth flow
- [ ] 29. **Financial year & budget support** — FY config, budget vs actual
- [ ] 30. **Order status timeline** — actual timestamps per status transition
- [ ] 31. **Realtime dashboard** — wire useRealtimeSubscription to pages
- [ ] 32. **Barcode scanner support** — scan to lookup/adjust/verify

## Phase 5: Quick Wins

- [x] 33. Add `maxDuration = 300` to inventory/orders cron routes
- [x] 34. Dynamic breadcrumbs — Fixed: detects UUID segments, resolves order numbers and product names via Supabase queries with caching
- [x] 35. Message timestamps in AI chat — Fixed: timestamps shown below each message bubble
- [x] 36. Copy-to-clipboard on AI responses — Fixed: copy button appears on hover for assistant messages
- [ ] 37. Clickable tracking URL on order detail
- [x] 38. Recent orders table on dashboard home — Fixed: RecentOrders card with 8 most recent orders, status badges, amounts, links
- [x] 39. `staleTime`/`gcTime` tuning — Fixed: 2min stale, 10min GC, disabled refetchOnWindowFocus
- [x] 40. Global error boundary — Fixed: ErrorBoundary component wrapping Providers with retry button
- [ ] 41. Size/color masters management UI in settings
