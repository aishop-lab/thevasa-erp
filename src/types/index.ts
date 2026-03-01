// =============================================================================
// Thevasa ERP - Common Type Definitions
// =============================================================================

// -----------------------------------------------------------------------------
// Shared Enums & Union Types
// -----------------------------------------------------------------------------

export type TeamMemberRole = 'admin' | 'manager' | 'viewer' | 'accountant';

export type MovementType =
  | 'purchase'
  | 'sales'
  | 'transfer_in'
  | 'transfer_out'
  | 'adjustment'
  | 'return'
  | 'damage'
  | 'fba_sync';

export type DiscrepancySeverity = 'none' | 'minor' | 'moderate' | 'major';

export type DiscrepancyStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

export type PaymentStatus = 'pending' | 'paid' | 'partial' | 'refunded' | 'failed';

export type FulfillmentStatus = 'unfulfilled' | 'partial' | 'fulfilled' | 'cancelled';

export type SyncStatus = 'running' | 'completed' | 'failed' | 'partial';

export type GstTransactionType = 'output' | 'input';

export type PayoutStatus = 'expected' | 'received' | 'disputed';

export type SettlementStatus = 'open' | 'closed' | 'reconciled';

// -----------------------------------------------------------------------------
// Teams
// -----------------------------------------------------------------------------

export interface TeamSettings {
  default_currency?: string;
  fiscal_year_start?: string;
  low_stock_alert_enabled?: boolean;
  sync_interval_minutes?: number;
  [key: string]: unknown;
}

export interface Team {
  id: string;
  name: string;
  gst_number: string | null;
  pan_number: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  settings: TeamSettings | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  invited_by: string | null;
  joined_at: Date | string | null;
  created_at: Date | string;
}

// -----------------------------------------------------------------------------
// Products
// -----------------------------------------------------------------------------

export interface ProductMetadata {
  [key: string]: unknown;
}

export interface Product {
  id: string;
  team_id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null;
  material: string | null;
  cost_price: number;
  mrp: number;
  selling_price: number;
  gst_rate: number;
  hsn_code: string | null;
  low_stock_threshold: number | null;
  is_active: boolean;
  images: string[];
  metadata: ProductMetadata | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  team_id: string;
  variant_sku: string;
  size_id: string | null;
  color_id: string | null;
  barcode: string | null;
  weight_grams: number | null;
  cost_price: number;
  mrp: number;
  selling_price: number;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;

  // Joined fields (populated via queries with joins)
  size_name?: string;
  color_name?: string;
  product_name?: string;
  product_sku?: string;
}

export interface SizeMaster {
  id: string;
  team_id: string;
  name: string;
  display_order: number;
  created_at: Date | string;
}

export interface ColorMaster {
  id: string;
  team_id: string;
  name: string;
  hex_code: string | null;
  created_at: Date | string;
}

// -----------------------------------------------------------------------------
// Platforms
// -----------------------------------------------------------------------------

export type PlatformType = 'shopify' | 'amazon' | 'myntra' | 'manual';

export interface Platform {
  id: string;
  team_id: string;
  name: string;
  type: PlatformType;
  is_active: boolean;
  config: Record<string, unknown> | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface PlatformCredential {
  id: string;
  platform_id: string;
  team_id: string;
  credential_type: string;
  encrypted_value: string;
  expires_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface PlatformMapping {
  id: string;
  team_id: string;
  platform_id: string;
  variant_id: string;
  external_product_id: string | null;
  external_variant_id: string | null;
  external_sku: string | null;
  external_asin: string | null;
  external_fnsku: string | null;
  external_url: string | null;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

// -----------------------------------------------------------------------------
// Inventory
// -----------------------------------------------------------------------------

export interface Warehouse {
  id: string;
  team_id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  is_fba: boolean;
  platform_id: string | null;
  is_active: boolean;
}

export interface WarehouseStock {
  id: string;
  team_id: string;
  warehouse_id: string;
  variant_id: string;
  qty_on_hand: number;
  qty_reserved: number;
  qty_available: number;
  last_synced_at: Date | string | null;
}

export interface StockMovement {
  id: string;
  team_id: string;
  warehouse_id: string;
  variant_id: string;
  movement_type: MovementType;
  quantity: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: Date | string;
}

export interface InventoryDiscrepancy {
  id: string;
  team_id: string;
  variant_id: string;
  warehouse_id: string;
  fba_warehouse_id: string | null;
  system_qty: number;
  physical_qty: number;
  discrepancy: number;
  severity: DiscrepancySeverity;
  status: DiscrepancyStatus;
  reason: string | null;
  investigation_notes: string | null;
  resolution_notes: string | null;
  resolved_by: string | null;
  resolved_at: Date | string | null;
  detected_at: Date | string;
}

// -----------------------------------------------------------------------------
// Orders
// -----------------------------------------------------------------------------

export interface OrderAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  phone?: string;
}

export interface Order {
  id: string;
  team_id: string;
  platform_id: string;
  order_number: string;
  external_order_id: string | null;
  status: OrderStatus;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_address: OrderAddress | null;
  billing_address: OrderAddress | null;
  subtotal: number;
  discount_amount: number;
  shipping_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  tracking_number: string | null;
  tracking_url: string | null;
  tracking_company: string | null;
  platform_metadata: Record<string, unknown> | null;
  notes: string | null;
  ordered_at: Date | string;
  shipped_at: Date | string | null;
  delivered_at: Date | string | null;
  cancelled_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  team_id: string;
  variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_amount: number;
  total: number;
}

export interface Payment {
  id: string;
  team_id: string;
  order_id: string;
  platform_id: string;
  amount: number;
  method: string;
  status: PaymentStatus;
  transaction_id: string | null;
  gateway: string | null;
  paid_at: Date | string | null;
  created_at: Date | string;
}

// -----------------------------------------------------------------------------
// Finance
// -----------------------------------------------------------------------------

export interface SalesRevenue {
  id: string;
  team_id: string;
  order_id: string;
  platform_id: string;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  tax_amount: number;
  shipping_amount: number;
  platform_fee_total: number;
  profit: number;
  date: Date | string;
  created_at: Date | string;
}

export interface Expense {
  id: string;
  team_id: string;
  category: string;
  subcategory: string | null;
  description: string;
  amount: number;
  gst_amount: number;
  gst_rate: number;
  vendor: string | null;
  invoice_number: string | null;
  receipt_url: string | null;
  date: Date | string;
  is_recurring: boolean;
  created_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface PlatformFee {
  id: string;
  team_id: string;
  order_id: string;
  platform_id: string;
  fee_type: string;
  amount: number;
  description: string | null;
  date: Date | string;
  created_at: Date | string;
}

export interface GstTransaction {
  id: string;
  team_id: string;
  reference_type: string;
  reference_id: string;
  hsn_code: string;
  taxable_amount: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_tax: number;
  transaction_type: GstTransactionType;
  date: Date | string;
  created_at: Date | string;
}

// -----------------------------------------------------------------------------
// Sync & Webhooks
// -----------------------------------------------------------------------------

export interface SyncLog {
  id: string;
  team_id: string;
  platform_id: string;
  sync_type: string;
  status: SyncStatus;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  error_message: string | null;
  started_at: Date | string;
  completed_at: Date | string | null;
}

export interface WebhookEvent {
  id: string;
  team_id: string;
  platform_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processed' | 'failed';
  error_message: string | null;
  received_at: Date | string;
  processed_at: Date | string | null;
}

// -----------------------------------------------------------------------------
// Settlements & Payouts
// -----------------------------------------------------------------------------

export interface SettlementCycle {
  id: string;
  team_id: string;
  platform_id: string;
  settlement_id: string;
  period_start: Date | string;
  period_end: Date | string;
  total_amount: number;
  status: SettlementStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface SettlementTransaction {
  id: string;
  team_id: string;
  settlement_id: string;
  order_id: string | null;
  transaction_type: string;
  amount: number;
  description: string | null;
  date: Date | string;
  created_at: Date | string;
}

export interface Payout {
  id: string;
  team_id: string;
  settlement_id: string;
  platform_id: string;
  amount: number;
  bank_reference: string | null;
  payout_date: Date | string;
  status: PayoutStatus;
  created_at: Date | string;
  updated_at: Date | string;
}

// -----------------------------------------------------------------------------
// Utility Types
// -----------------------------------------------------------------------------

/** Make all properties of T optional except for those in K */
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/** Type for creating a new record (omits generated fields) */
export type CreateInput<T> = Omit<T, 'id' | 'created_at' | 'updated_at'>;

/** Type for updating a record (all fields optional except id) */
export type UpdateInput<T extends { id: string }> = Partial<Omit<T, 'id'>> & Pick<T, 'id'>;

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

/** API error response */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** Date range filter */
export interface DateRange {
  from: Date | string;
  to: Date | string;
}

/** Sort direction */
export type SortDirection = 'asc' | 'desc';

/** Generic sort config */
export interface SortConfig<T = string> {
  field: T;
  direction: SortDirection;
}

/** Filter operator for queries */
export type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like' | 'ilike';

/** Generic filter config */
export interface FilterConfig {
  field: string;
  operator: FilterOperator;
  value: unknown;
}
