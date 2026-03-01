// =============================================================================
// Thevasa ERP - Shopify GraphQL Admin API Type Definitions
// =============================================================================

// -----------------------------------------------------------------------------
// Shared / Common
// -----------------------------------------------------------------------------

/** Shopify uses globally unique IDs in the format "gid://shopify/Resource/123" */
export type ShopifyGid = string;

export interface ShopifyMoney {
  amount: string;
  currency_code: string;
}

export interface ShopifyImage {
  id: ShopifyGid;
  url: string;
  alt_text: string | null;
  width: number;
  height: number;
}

export interface ShopifyPageInfo {
  has_next_page: boolean;
  has_previous_page: boolean;
  start_cursor: string | null;
  end_cursor: string | null;
}

export interface ShopifyConnection<T> {
  edges: ShopifyEdge<T>[];
  page_info: ShopifyPageInfo;
}

export interface ShopifyEdge<T> {
  node: T;
  cursor: string;
}

export interface ShopifyUserError {
  field: string[];
  message: string;
}

// -----------------------------------------------------------------------------
// Products
// -----------------------------------------------------------------------------

export type ShopifyProductStatus = 'ACTIVE' | 'ARCHIVED' | 'DRAFT';

export interface ShopifyProduct {
  id: ShopifyGid;
  title: string;
  handle: string;
  description_html: string;
  vendor: string;
  product_type: string;
  status: ShopifyProductStatus;
  tags: string[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
  options: ShopifyProductOption[];
  variants: ShopifyConnection<ShopifyProductVariant>;
  images: ShopifyConnection<ShopifyImage>;
  total_inventory: number;
  online_store_url: string | null;
  seo: ShopifySeo;
  template_suffix: string | null;
}

export interface ShopifyProductOption {
  id: ShopifyGid;
  name: string;
  position: number;
  values: string[];
}

export interface ShopifySeo {
  title: string | null;
  description: string | null;
}

// -----------------------------------------------------------------------------
// Variants
// -----------------------------------------------------------------------------

export interface ShopifyProductVariant {
  id: ShopifyGid;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  compare_at_price: string | null;
  position: number;
  inventory_quantity: number;
  inventory_item: ShopifyInventoryItem;
  selected_options: ShopifySelectedOption[];
  weight: number | null;
  weight_unit: 'GRAMS' | 'KILOGRAMS' | 'OUNCES' | 'POUNDS';
  requires_shipping: boolean;
  taxable: boolean;
  tax_code: string | null;
  image: ShopifyImage | null;
  created_at: string;
  updated_at: string;
  available_for_sale: boolean;
}

export interface ShopifySelectedOption {
  name: string;
  value: string;
}

export interface ShopifyInventoryItem {
  id: ShopifyGid;
  sku: string | null;
  tracked: boolean;
  requires_shipping: boolean;
  harmonized_system_code: string | null;
  country_code_of_origin: string | null;
  unit_cost: ShopifyMoney | null;
  inventory_levels: ShopifyConnection<ShopifyInventoryLevel>;
}

// -----------------------------------------------------------------------------
// Inventory
// -----------------------------------------------------------------------------

export interface ShopifyInventoryLevel {
  id: ShopifyGid;
  available: number;
  incoming: number;
  location: ShopifyLocation;
  updated_at: string;
}

export interface ShopifyLocation {
  id: ShopifyGid;
  name: string;
  address: ShopifyLocationAddress;
  is_active: boolean;
  fulfills_online_orders: boolean;
}

export interface ShopifyLocationAddress {
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  province_code: string | null;
  country: string | null;
  country_code: string | null;
  zip: string | null;
  phone: string | null;
}

/** Input for adjusting inventory quantities via GraphQL mutation */
export interface ShopifyInventoryAdjustInput {
  inventory_item_id: ShopifyGid;
  location_id: ShopifyGid;
  delta: number;
}

/** Input for setting inventory quantities via GraphQL mutation */
export interface ShopifyInventorySetInput {
  inventory_item_id: ShopifyGid;
  location_id: ShopifyGid;
  quantity: number;
}

// -----------------------------------------------------------------------------
// Orders
// -----------------------------------------------------------------------------

export type ShopifyOrderFinancialStatus =
  | 'AUTHORIZED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'PARTIALLY_REFUNDED'
  | 'PENDING'
  | 'REFUNDED'
  | 'VOIDED';

export type ShopifyOrderFulfillmentStatus =
  | 'FULFILLED'
  | 'IN_PROGRESS'
  | 'ON_HOLD'
  | 'OPEN'
  | 'PARTIALLY_FULFILLED'
  | 'PENDING_FULFILLMENT'
  | 'RESTOCKED'
  | 'SCHEDULED'
  | 'UNFULFILLED';

export type ShopifyOrderCancelReason =
  | 'CUSTOMER'
  | 'DECLINED'
  | 'FRAUD'
  | 'INVENTORY'
  | 'OTHER'
  | 'STAFF';

export interface ShopifyOrder {
  id: ShopifyGid;
  name: string;
  order_number: number;
  created_at: string;
  updated_at: string;
  processed_at: string;
  closed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: ShopifyOrderCancelReason | null;
  display_financial_status: ShopifyOrderFinancialStatus;
  display_fulfillment_status: ShopifyOrderFulfillmentStatus;
  confirmed: boolean;
  test: boolean;
  email: string | null;
  phone: string | null;
  customer: ShopifyCustomer | null;
  billing_address: ShopifyMailingAddress | null;
  shipping_address: ShopifyMailingAddress | null;
  shipping_line: ShopifyShippingLine | null;
  line_items: ShopifyConnection<ShopifyLineItem>;
  subtotal_price_set: ShopifyMoneyBag;
  total_discounts_set: ShopifyMoneyBag;
  total_shipping_price_set: ShopifyMoneyBag;
  total_tax_set: ShopifyMoneyBag;
  total_price_set: ShopifyMoneyBag;
  total_refunded_set: ShopifyMoneyBag;
  current_subtotal_price_set: ShopifyMoneyBag;
  current_total_price_set: ShopifyMoneyBag;
  current_total_tax_set: ShopifyMoneyBag;
  refundable: boolean;
  fulfillments: ShopifyFulfillment[];
  transactions: ShopifyTransaction[];
  tags: string[];
  note: string | null;
  payment_gateway_names: string[];
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ShopifyMoneyBag {
  shop_money: ShopifyMoney;
  presentment_money: ShopifyMoney;
}

// -----------------------------------------------------------------------------
// Line Items
// -----------------------------------------------------------------------------

export interface ShopifyLineItem {
  id: ShopifyGid;
  title: string;
  variant_title: string | null;
  quantity: number;
  sku: string | null;
  variant: ShopifyProductVariant | null;
  product: { id: ShopifyGid; title: string } | null;
  original_unit_price_set: ShopifyMoneyBag;
  discounted_unit_price_set: ShopifyMoneyBag;
  total_discount_set: ShopifyMoneyBag;
  tax_lines: ShopifyTaxLine[];
  requires_shipping: boolean;
  fulfillable_quantity: number;
  fulfillment_status: string;
  vendor: string | null;
  image: ShopifyImage | null;
}

export interface ShopifyTaxLine {
  title: string;
  rate: number;
  rate_percentage: number;
  price_set: ShopifyMoneyBag;
}

// -----------------------------------------------------------------------------
// Customer
// -----------------------------------------------------------------------------

export interface ShopifyCustomer {
  id: ShopifyGid;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  orders_count: string;
  total_spent: string;
  tags: string[];
  verified_email: boolean;
  tax_exempt: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShopifyMailingAddress {
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  company: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  province_code: string | null;
  country: string | null;
  country_code: string | null;
  zip: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
}

// -----------------------------------------------------------------------------
// Fulfillment & Shipping
// -----------------------------------------------------------------------------

export type ShopifyFulfillmentStatus = 'CANCELLED' | 'ERROR' | 'FAILURE' | 'OPEN' | 'PENDING' | 'SUCCESS';

export interface ShopifyFulfillment {
  id: ShopifyGid;
  status: ShopifyFulfillmentStatus;
  created_at: string;
  updated_at: string;
  tracking_info: ShopifyTrackingInfo[];
  fulfillment_line_items: ShopifyConnection<ShopifyFulfillmentLineItem>;
  location: ShopifyLocation | null;
}

export interface ShopifyTrackingInfo {
  company: string | null;
  number: string | null;
  url: string | null;
}

export interface ShopifyFulfillmentLineItem {
  id: ShopifyGid;
  line_item: ShopifyLineItem;
  quantity: number;
}

export interface ShopifyShippingLine {
  title: string;
  code: string | null;
  price_set: ShopifyMoneyBag;
  discounted_price_set: ShopifyMoneyBag;
  carrier_identifier: string | null;
  delivery_category: string | null;
}

// -----------------------------------------------------------------------------
// Transactions
// -----------------------------------------------------------------------------

export type ShopifyTransactionKind =
  | 'AUTHORIZATION'
  | 'CAPTURE'
  | 'CHANGE'
  | 'EMV_AUTHORIZATION'
  | 'REFUND'
  | 'SALE'
  | 'SUGGESTED_REFUND'
  | 'VOID';

export type ShopifyTransactionStatus = 'AWAITING_RESPONSE' | 'ERROR' | 'FAILURE' | 'PENDING' | 'SUCCESS' | 'UNKNOWN';

export interface ShopifyTransaction {
  id: ShopifyGid;
  kind: ShopifyTransactionKind;
  status: ShopifyTransactionStatus;
  amount_set: ShopifyMoneyBag;
  gateway: string;
  authorization_code: string | null;
  created_at: string;
  processed_at: string | null;
  error_code: string | null;
  test: boolean;
  payment_id: string | null;
}

// -----------------------------------------------------------------------------
// Refunds
// -----------------------------------------------------------------------------

export interface ShopifyRefund {
  id: ShopifyGid;
  created_at: string;
  note: string | null;
  refund_line_items: ShopifyConnection<ShopifyRefundLineItem>;
  transactions: ShopifyTransaction[];
  total_refunded_set: ShopifyMoneyBag;
}

export interface ShopifyRefundLineItem {
  line_item: ShopifyLineItem;
  quantity: number;
  restock_type: 'CANCEL' | 'LEGACY_RESTOCK' | 'NO_RESTOCK' | 'RETURN';
  subtotal_set: ShopifyMoneyBag;
  total_tax_set: ShopifyMoneyBag;
}

// -----------------------------------------------------------------------------
// Webhooks
// -----------------------------------------------------------------------------

export type ShopifyWebhookTopic =
  | 'ORDERS_CREATE'
  | 'ORDERS_UPDATED'
  | 'ORDERS_CANCELLED'
  | 'ORDERS_FULFILLED'
  | 'ORDERS_PAID'
  | 'REFUNDS_CREATE'
  | 'PRODUCTS_CREATE'
  | 'PRODUCTS_UPDATE'
  | 'PRODUCTS_DELETE'
  | 'INVENTORY_LEVELS_UPDATE'
  | 'INVENTORY_LEVELS_CONNECT'
  | 'INVENTORY_LEVELS_DISCONNECT'
  | 'APP_UNINSTALLED';

export interface ShopifyWebhookSubscription {
  id: ShopifyGid;
  topic: ShopifyWebhookTopic;
  endpoint: {
    callback_url: string;
  };
  format: 'JSON' | 'XML';
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// GraphQL Helpers
// -----------------------------------------------------------------------------

/** Generic GraphQL response wrapper */
export interface ShopifyGraphQLResponse<T> {
  data: T;
  errors?: ShopifyGraphQLError[];
  extensions?: {
    cost: ShopifyQueryCost;
  };
}

export interface ShopifyGraphQLError {
  message: string;
  locations?: { line: number; column: number }[];
  path?: string[];
  extensions?: Record<string, unknown>;
}

export interface ShopifyQueryCost {
  requested_query_cost: number;
  actual_query_cost: number;
  throttle_status: {
    maximum_available: number;
    currently_available: number;
    restore_rate: number;
  };
}

/** Bulk operation status for large data exports */
export type ShopifyBulkOperationStatus =
  | 'CANCELED'
  | 'CANCELING'
  | 'COMPLETED'
  | 'CREATED'
  | 'EXPIRED'
  | 'FAILED'
  | 'RUNNING';

export interface ShopifyBulkOperation {
  id: ShopifyGid;
  status: ShopifyBulkOperationStatus;
  error_code: string | null;
  object_count: string;
  file_size: string | null;
  url: string | null;
  partial_data_url: string | null;
  created_at: string;
  completed_at: string | null;
}
