// =============================================================================
// Thevasa ERP - Amazon SP-API Type Definitions
// =============================================================================

// -----------------------------------------------------------------------------
// FBA Inventory
// -----------------------------------------------------------------------------

/** Granularity level for inventory summaries */
export interface AmazonInventoryGranularity {
  granularity_type: 'Marketplace';
  granularity_id: string;
}

/** Single inventory summary from the FBA Inventory Summaries API */
export interface AmazonFbaInventorySummary {
  asin: string;
  fn_sku: string;
  seller_sku: string;
  product_name: string;
  condition: string;
  inventory_details: AmazonInventoryDetails;
  last_updated_time: string;
  total_quantity: number;
}

export interface AmazonInventoryDetails {
  fulfillable_quantity: number;
  inbound_working_quantity: number;
  inbound_shipped_quantity: number;
  inbound_receiving_quantity: number;
  reserved_quantity: AmazonReservedQuantity;
  researching_quantity: AmazonResearchingQuantity;
  unfulfillable_quantity: AmazonUnfulfillableQuantity;
}

export interface AmazonReservedQuantity {
  total_reserved_quantity: number;
  pending_customer_order_quantity: number;
  pending_transshipment_quantity: number;
  fc_processing_quantity: number;
}

export interface AmazonResearchingQuantity {
  total_researching_quantity: number;
  researching_quantity_breakdown: AmazonResearchingQuantityBreakdown[];
}

export interface AmazonResearchingQuantityBreakdown {
  name: 'researchingQuantityInShortTerm' | 'researchingQuantityInMidTerm' | 'researchingQuantityInLongTerm';
  quantity: number;
}

export interface AmazonUnfulfillableQuantity {
  total_unfulfillable_quantity: number;
  customer_damaged_quantity: number;
  warehouse_damaged_quantity: number;
  distributor_damaged_quantity: number;
  carrier_damaged_quantity: number;
  defective_quantity: number;
  expired_quantity: number;
}

/** Response from Get Inventory Summaries API */
export interface AmazonInventorySummariesResponse {
  pagination: {
    next_token: string | null;
  };
  granularity: AmazonInventoryGranularity;
  inventory_summaries: AmazonFbaInventorySummary[];
}

// -----------------------------------------------------------------------------
// Orders
// -----------------------------------------------------------------------------

export type AmazonOrderStatus =
  | 'Pending'
  | 'Unshipped'
  | 'PartiallyShipped'
  | 'Shipped'
  | 'Canceled'
  | 'Unfulfillable'
  | 'InvoiceUnconfirmed'
  | 'PendingAvailability';

export type AmazonFulfillmentChannel = 'AFN' | 'MFN';

export interface AmazonOrder {
  amazon_order_id: string;
  seller_order_id: string | null;
  purchase_date: string;
  last_update_date: string;
  order_status: AmazonOrderStatus;
  fulfillment_channel: AmazonFulfillmentChannel;
  sales_channel: string;
  ship_service_level: string | null;
  order_total: AmazonMoney | null;
  number_of_items_shipped: number;
  number_of_items_unshipped: number;
  payment_method: string | null;
  payment_method_details: string[];
  marketplace_id: string;
  buyer_info: AmazonBuyerInfo | null;
  shipping_address: AmazonAddress | null;
  is_replacement_order: boolean;
  is_premium_order: boolean;
  is_prime: boolean;
  is_business_order: boolean;
  earliest_ship_date: string | null;
  latest_ship_date: string | null;
  earliest_delivery_date: string | null;
  latest_delivery_date: string | null;
}

export interface AmazonMoney {
  currency_code: string;
  amount: string;
}

export interface AmazonBuyerInfo {
  buyer_email: string | null;
  buyer_name: string | null;
  buyer_county: string | null;
  buyer_tax_info: AmazonBuyerTaxInfo | null;
}

export interface AmazonBuyerTaxInfo {
  company_legal_name: string | null;
  taxing_region: string | null;
  tax_classifications: AmazonTaxClassification[];
}

export interface AmazonTaxClassification {
  name: string;
  value: string;
}

export interface AmazonAddress {
  name: string;
  address_line_1: string | null;
  address_line_2: string | null;
  address_line_3: string | null;
  city: string | null;
  county: string | null;
  district: string | null;
  state_or_region: string | null;
  municipality: string | null;
  postal_code: string | null;
  country_code: string | null;
  phone: string | null;
}

// -----------------------------------------------------------------------------
// Order Items
// -----------------------------------------------------------------------------

export interface AmazonOrderItem {
  asin: string;
  seller_sku: string;
  order_item_id: string;
  title: string;
  quantity_ordered: number;
  quantity_shipped: number;
  item_price: AmazonMoney | null;
  item_tax: AmazonMoney | null;
  shipping_price: AmazonMoney | null;
  shipping_tax: AmazonMoney | null;
  shipping_discount: AmazonMoney | null;
  promotion_discount: AmazonMoney | null;
  promotion_ids: string[];
  is_gift: boolean;
  condition_id: string | null;
  condition_subtype_id: string | null;
  condition_note: string | null;
}

export interface AmazonOrderItemsResponse {
  order_items: AmazonOrderItem[];
  next_token: string | null;
  amazon_order_id: string;
}

// -----------------------------------------------------------------------------
// Financial Events
// -----------------------------------------------------------------------------

export type AmazonFinancialEventType =
  | 'ShipmentEvent'
  | 'RefundEvent'
  | 'GuaranteeClaimEvent'
  | 'ChargebackEvent'
  | 'ServiceFeeEvent'
  | 'AdjustmentEvent'
  | 'RemovalShipmentEvent';

export interface AmazonFinancialEvent {
  amazon_order_id: string | null;
  seller_order_id: string | null;
  marketplace_name: string | null;
  posted_date: string;
  shipment_item_list: AmazonShipmentItem[];
}

export interface AmazonShipmentItem {
  seller_sku: string;
  order_item_id: string;
  quantity_shipped: number;
  item_charge_list: AmazonChargeComponent[];
  item_fee_list: AmazonFeeComponent[];
  item_tax_withheld_list: AmazonTaxWithheldComponent[];
  promotion_list: AmazonPromotion[];
  order_adjustment_item_list?: AmazonOrderAdjustmentItem[];
}

export interface AmazonChargeComponent {
  charge_type: string;
  charge_amount: AmazonMoney;
}

export interface AmazonFeeComponent {
  fee_type: string;
  fee_amount: AmazonMoney;
}

export interface AmazonTaxWithheldComponent {
  tax_collection_model: string;
  taxes_withheld: AmazonChargeComponent[];
}

export interface AmazonPromotion {
  promotion_type: string;
  promotion_id: string;
  promotion_amount: AmazonMoney;
}

export interface AmazonOrderAdjustmentItem {
  order_adjustment_item_id: string;
  per_unit_amount: AmazonMoney;
  total_amount: AmazonMoney;
  quantity_adjusted: number;
}

// -----------------------------------------------------------------------------
// Settlement Reports
// -----------------------------------------------------------------------------

export interface AmazonSettlementData {
  settlement_id: string;
  settlement_start_date: string;
  settlement_end_date: string;
  deposit_date: string;
  total_amount: AmazonMoney;
  currency: string;
}

export interface AmazonSettlementItem {
  settlement_id: string;
  transaction_type: string;
  order_id: string | null;
  merchant_order_id: string | null;
  adjustment_id: string | null;
  shipment_id: string | null;
  marketplace_name: string;
  amount_type: string;
  amount_description: string;
  amount: AmazonMoney;
  fulfillment_id: string | null;
  posted_date: string;
  posted_date_time: string;
  order_item_code: string | null;
  merchant_order_item_id: string | null;
  merchant_adjustment_item_id: string | null;
  sku: string | null;
  quantity_purchased: number | null;
  promotion_id: string | null;
}

// -----------------------------------------------------------------------------
// Catalog / Product
// -----------------------------------------------------------------------------

export interface AmazonCatalogItem {
  asin: string;
  attributes: Record<string, unknown>;
  identifiers: AmazonItemIdentifier[];
  images: AmazonItemImage[];
  product_types: AmazonProductType[];
  sales_rankings: AmazonSalesRanking[];
  summaries: AmazonItemSummary[];
}

export interface AmazonItemIdentifier {
  marketplace_id: string;
  identifiers: {
    identifier_type: string;
    identifier: string;
  }[];
}

export interface AmazonItemImage {
  marketplace_id: string;
  images: {
    variant: string;
    link: string;
    height: number;
    width: number;
  }[];
}

export interface AmazonProductType {
  marketplace_id: string;
  product_type: string;
}

export interface AmazonSalesRanking {
  marketplace_id: string;
  classification_id: string;
  title: string;
  link: string;
  rank: number;
}

export interface AmazonItemSummary {
  marketplace_id: string;
  brand: string | null;
  browse_classification: {
    display_name: string;
    classification_id: string;
  } | null;
  color: string | null;
  item_classification: string | null;
  item_name: string | null;
  manufacturer: string | null;
  model_number: string | null;
  package_quantity: number | null;
  part_number: string | null;
  size: string | null;
  style: string | null;
  website_display_group: string | null;
  website_display_group_name: string | null;
}

// -----------------------------------------------------------------------------
// SP-API Common
// -----------------------------------------------------------------------------

export interface AmazonApiPagination {
  next_token: string | null;
}

export interface AmazonApiError {
  code: string;
  message: string;
  details: string | null;
}

export interface AmazonApiResponse<T> {
  payload: T;
  errors: AmazonApiError[] | null;
}

/** Marketplace IDs for Amazon India */
export const AMAZON_IN_MARKETPLACE_ID = 'A21TJRUUN4KGV';

/** Amazon SP-API rate limit config */
export interface AmazonRateLimitConfig {
  requests_per_second: number;
  burst: number;
}
