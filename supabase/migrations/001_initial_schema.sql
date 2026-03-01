-- Thevasa ERP - Complete Database Schema
-- Run this in Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TEAMS & AUTH
-- ============================================================

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  gst_number TEXT,
  pan_number TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'viewer', 'accountant')),
  invited_by UUID REFERENCES auth.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_members_team ON team_members(team_id);

-- ============================================================
-- PRODUCTS
-- ============================================================

CREATE TABLE size_masters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, name)
);

CREATE TABLE color_masters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  hex_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, name)
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  material TEXT,
  cost_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  mrp DECIMAL(10,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  gst_rate DECIMAL(5,2) NOT NULL DEFAULT 5,
  hsn_code TEXT,
  low_stock_threshold INT DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  images TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, sku)
);

CREATE INDEX idx_products_team ON products(team_id);
CREATE INDEX idx_products_sku ON products(team_id, sku);
CREATE INDEX idx_products_category ON products(team_id, category);

CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  variant_sku TEXT NOT NULL,
  size_id UUID REFERENCES size_masters(id),
  color_id UUID REFERENCES color_masters(id),
  barcode TEXT,
  weight_grams INT,
  cost_price DECIMAL(10,2),
  mrp DECIMAL(10,2),
  selling_price DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, variant_sku)
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(team_id, variant_sku);

-- ============================================================
-- PLATFORM INTEGRATION
-- ============================================================

CREATE TABLE platforms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default platforms
INSERT INTO platforms (name, display_name) VALUES
  ('shopify', 'Shopify'),
  ('amazon_fba', 'Amazon FBA'),
  ('myntra', 'Myntra'),
  ('direct', 'Direct / Offline');

CREATE TABLE platform_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES platforms(id),
  credentials JSONB NOT NULL DEFAULT '{}',
  is_connected BOOLEAN DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, platform_id)
);

CREATE TABLE platform_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES platforms(id),
  external_product_id TEXT,
  external_variant_id TEXT,
  external_sku TEXT,
  asin TEXT,
  listing_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, variant_id, platform_id)
);

CREATE INDEX idx_mappings_variant ON platform_mappings(variant_id);
CREATE INDEX idx_mappings_external ON platform_mappings(platform_id, external_variant_id);
CREATE INDEX idx_mappings_asin ON platform_mappings(asin);

-- ============================================================
-- INVENTORY
-- ============================================================

CREATE TABLE warehouses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  is_fba BOOLEAN DEFAULT FALSE,
  platform_id UUID REFERENCES platforms(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_warehouses_team ON warehouses(team_id);

CREATE TABLE warehouse_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  qty_on_hand INT NOT NULL DEFAULT 0,
  qty_reserved INT NOT NULL DEFAULT 0,
  qty_available INT GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(warehouse_id, variant_id)
);

CREATE INDEX idx_stock_warehouse ON warehouse_stock(warehouse_id);
CREATE INDEX idx_stock_variant ON warehouse_stock(variant_id);
CREATE INDEX idx_stock_team ON warehouse_stock(team_id);

CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase', 'sales', 'transfer_in', 'transfer_out', 'adjustment', 'return', 'damage', 'fba_sync')),
  quantity INT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_movements_warehouse ON stock_movements(warehouse_id);
CREATE INDEX idx_movements_variant ON stock_movements(variant_id);
CREATE INDEX idx_movements_date ON stock_movements(created_at);
CREATE INDEX idx_movements_type ON stock_movements(movement_type);

CREATE TABLE inventory_discrepancies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  fba_warehouse_id UUID REFERENCES warehouses(id),
  system_qty INT NOT NULL,
  physical_qty INT NOT NULL,
  discrepancy INT GENERATED ALWAYS AS (physical_qty - system_qty) STORED,
  severity TEXT GENERATED ALWAYS AS (
    CASE
      WHEN ABS(physical_qty - system_qty) = 0 THEN 'none'
      WHEN ABS(physical_qty - system_qty) <= 2 THEN 'minor'
      WHEN ABS(physical_qty - system_qty) <= 5 THEN 'moderate'
      ELSE 'major'
    END
  ) STORED,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
  reason TEXT,
  investigation_notes TEXT,
  resolution_notes TEXT,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_discrepancies_team ON inventory_discrepancies(team_id);
CREATE INDEX idx_discrepancies_status ON inventory_discrepancies(status);
CREATE INDEX idx_discrepancies_variant ON inventory_discrepancies(variant_id);

-- ============================================================
-- ORDERS
-- ============================================================

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES platforms(id),
  order_number TEXT NOT NULL,
  external_order_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded')),
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  shipping_address JSONB,
  billing_address JSONB,
  subtotal DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  shipping_charge DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partially_paid', 'refunded', 'failed')),
  fulfillment_status TEXT DEFAULT 'unfulfilled' CHECK (fulfillment_status IN ('unfulfilled', 'partially_fulfilled', 'fulfilled', 'returned')),
  tracking_number TEXT,
  tracking_url TEXT,
  courier TEXT,
  platform_metadata JSONB DEFAULT '{}',
  notes TEXT,
  ordered_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_team ON orders(team_id);
CREATE INDEX idx_orders_platform ON orders(platform_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_date ON orders(ordered_at);
CREATE INDEX idx_orders_external ON orders(external_order_id);
CREATE UNIQUE INDEX idx_orders_team_number ON orders(team_id, order_number);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id),
  product_name TEXT NOT NULL,
  variant_name TEXT,
  sku TEXT,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_variant ON order_items(variant_id);

CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  method TEXT,
  transaction_id TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FINANCE
-- ============================================================

CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_id UUID REFERENCES chart_of_accounts(id),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, code)
);

CREATE TABLE general_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  date DATE NOT NULL,
  description TEXT,
  debit DECIMAL(12,2) DEFAULT 0,
  credit DECIMAL(12,2) DEFAULT 0,
  reference_type TEXT,
  reference_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ledger_account ON general_ledger(account_id);
CREATE INDEX idx_ledger_date ON general_ledger(date);

CREATE TABLE sales_revenue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id),
  platform_id UUID NOT NULL REFERENCES platforms(id),
  gross_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  net_revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_collected DECIMAL(10,2) DEFAULT 0,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revenue_team ON sales_revenue(team_id);
CREATE INDEX idx_revenue_date ON sales_revenue(date);
CREATE INDEX idx_revenue_platform ON sales_revenue(platform_id);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  subcategory TEXT,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  gst_rate DECIMAL(5,2) DEFAULT 0,
  vendor TEXT,
  invoice_number TEXT,
  receipt_url TEXT,
  date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_team ON expenses(team_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);

CREATE TABLE platform_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  platform_id UUID NOT NULL REFERENCES platforms(id),
  fee_type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_platform_fees_team ON platform_fees(team_id);
CREATE INDEX idx_platform_fees_order ON platform_fees(order_id);
CREATE INDEX idx_platform_fees_date ON platform_fees(date);

CREATE TABLE gst_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  hsn_code TEXT,
  taxable_amount DECIMAL(10,2) NOT NULL,
  cgst_rate DECIMAL(5,2) DEFAULT 0,
  cgst_amount DECIMAL(10,2) DEFAULT 0,
  sgst_rate DECIMAL(5,2) DEFAULT 0,
  sgst_amount DECIMAL(10,2) DEFAULT 0,
  igst_rate DECIMAL(5,2) DEFAULT 0,
  igst_amount DECIMAL(10,2) DEFAULT 0,
  total_tax DECIMAL(10,2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('output', 'input')),
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gst_team ON gst_transactions(team_id);
CREATE INDEX idx_gst_date ON gst_transactions(date);
CREATE INDEX idx_gst_type ON gst_transactions(transaction_type);

CREATE TABLE cogs_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id),
  variant_id UUID REFERENCES product_variants(id),
  quantity INT NOT NULL,
  unit_cost DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE pl_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  gross_revenue DECIMAL(12,2) DEFAULT 0,
  net_revenue DECIMAL(12,2) DEFAULT 0,
  cogs DECIMAL(12,2) DEFAULT 0,
  gross_profit DECIMAL(12,2) DEFAULT 0,
  platform_fees DECIMAL(12,2) DEFAULT 0,
  shipping_costs DECIMAL(12,2) DEFAULT 0,
  other_expenses DECIMAL(12,2) DEFAULT 0,
  total_expenses DECIMAL(12,2) DEFAULT 0,
  net_profit DECIMAL(12,2) DEFAULT 0,
  margin_percentage DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, period_start, period_end)
);

-- ============================================================
-- SETTLEMENTS
-- ============================================================

CREATE TABLE settlement_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES platforms(id),
  settlement_id TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  total_amount DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'disputed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE settlement_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  settlement_id UUID NOT NULL REFERENCES settlement_cycles(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  transaction_type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  settlement_id UUID REFERENCES settlement_cycles(id),
  platform_id UUID NOT NULL REFERENCES platforms(id),
  amount DECIMAL(12,2) NOT NULL,
  bank_reference TEXT,
  payout_date DATE,
  status TEXT DEFAULT 'expected' CHECK (status IN ('expected', 'received', 'disputed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SYNC
-- ============================================================

CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  platform_id UUID NOT NULL REFERENCES platforms(id),
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  records_processed INT DEFAULT 0,
  records_created INT DEFAULT 0,
  records_updated INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_team ON sync_logs(team_id);
CREATE INDEX idx_sync_platform ON sync_logs(platform_id);
CREATE INDEX idx_sync_status ON sync_logs(status);

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id),
  platform_id UUID REFERENCES platforms(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  error TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_webhook_processed ON webhook_events(processed);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER tr_teams_updated BEFORE UPDATE ON teams FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_variants_updated BEFORE UPDATE ON product_variants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_stock_updated BEFORE UPDATE ON warehouse_stock FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_expenses_updated BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_warehouses_updated BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_credentials_updated BEFORE UPDATE ON platform_credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_mappings_updated BEFORE UPDATE ON platform_mappings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_discrepancies_updated BEFORE UPDATE ON inventory_discrepancies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_settlements_updated BEFORE UPDATE ON settlement_cycles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_payouts_updated BEFORE UPDATE ON payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_pl_summary_updated BEFORE UPDATE ON pl_summary FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Helper function to get user's team_id
CREATE OR REPLACE FUNCTION get_user_team_id()
RETURNS UUID AS $$
  SELECT team_id FROM team_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function to check user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM team_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS on all tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE size_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE color_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE general_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE gst_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cogs_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE pl_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Team-based RLS policies (all team members can read their team's data)
-- Teams
CREATE POLICY teams_select ON teams FOR SELECT USING (id = get_user_team_id());
CREATE POLICY teams_update ON teams FOR UPDATE USING (id = get_user_team_id() AND get_user_role() = 'admin');
CREATE POLICY teams_insert ON teams FOR INSERT WITH CHECK (TRUE);

-- Team Members
CREATE POLICY tm_select ON team_members FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY tm_insert ON team_members FOR INSERT WITH CHECK (team_id = get_user_team_id() AND get_user_role() = 'admin');
CREATE POLICY tm_update ON team_members FOR UPDATE USING (team_id = get_user_team_id() AND get_user_role() = 'admin');
CREATE POLICY tm_delete ON team_members FOR DELETE USING (team_id = get_user_team_id() AND get_user_role() = 'admin');
-- Allow newly signed-up users to insert their own team_member record
CREATE POLICY tm_self_insert ON team_members FOR INSERT WITH CHECK (user_id = auth.uid());

-- Generic team-based policies macro (applied to most tables)
-- Products
CREATE POLICY products_select ON products FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY products_insert ON products FOR INSERT WITH CHECK (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'manager'));
CREATE POLICY products_update ON products FOR UPDATE USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'manager'));
CREATE POLICY products_delete ON products FOR DELETE USING (team_id = get_user_team_id() AND get_user_role() = 'admin');

-- Product Variants
CREATE POLICY pv_select ON product_variants FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY pv_insert ON product_variants FOR INSERT WITH CHECK (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'manager'));
CREATE POLICY pv_update ON product_variants FOR UPDATE USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'manager'));
CREATE POLICY pv_delete ON product_variants FOR DELETE USING (team_id = get_user_team_id() AND get_user_role() = 'admin');

-- Size Masters
CREATE POLICY sm_select ON size_masters FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY sm_all ON size_masters FOR ALL USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'manager'));

-- Color Masters
CREATE POLICY cm_select ON color_masters FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY cm_all ON color_masters FOR ALL USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'manager'));

-- Platform Credentials (admin only)
CREATE POLICY pc_select ON platform_credentials FOR SELECT USING (team_id = get_user_team_id() AND get_user_role() = 'admin');
CREATE POLICY pc_all ON platform_credentials FOR ALL USING (team_id = get_user_team_id() AND get_user_role() = 'admin');

-- Platform Mappings
CREATE POLICY pm_select ON platform_mappings FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY pm_all ON platform_mappings FOR ALL USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'manager'));

-- Warehouses
CREATE POLICY wh_select ON warehouses FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY wh_all ON warehouses FOR ALL USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'manager'));

-- Warehouse Stock
CREATE POLICY ws_select ON warehouse_stock FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY ws_all ON warehouse_stock FOR ALL USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'manager'));

-- Stock Movements
CREATE POLICY smov_select ON stock_movements FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY smov_insert ON stock_movements FOR INSERT WITH CHECK (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'manager'));

-- Inventory Discrepancies
CREATE POLICY disc_select ON inventory_discrepancies FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY disc_all ON inventory_discrepancies FOR ALL USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'manager'));

-- Orders
CREATE POLICY orders_select ON orders FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY orders_insert ON orders FOR INSERT WITH CHECK (team_id = get_user_team_id());
CREATE POLICY orders_update ON orders FOR UPDATE USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'manager'));

-- Order Items
CREATE POLICY oi_select ON order_items FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY oi_insert ON order_items FOR INSERT WITH CHECK (team_id = get_user_team_id());

-- Payments
CREATE POLICY pay_select ON payments FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY pay_insert ON payments FOR INSERT WITH CHECK (team_id = get_user_team_id());

-- Finance tables (admin + accountant only for writes)
CREATE POLICY coa_select ON chart_of_accounts FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY coa_all ON chart_of_accounts FOR ALL USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'accountant'));

CREATE POLICY gl_select ON general_ledger FOR SELECT USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'accountant', 'manager'));
CREATE POLICY gl_insert ON general_ledger FOR INSERT WITH CHECK (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'accountant'));

CREATE POLICY sr_select ON sales_revenue FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY sr_insert ON sales_revenue FOR INSERT WITH CHECK (team_id = get_user_team_id());

CREATE POLICY exp_select ON expenses FOR SELECT USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'accountant', 'manager'));
CREATE POLICY exp_all ON expenses FOR ALL USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'accountant'));

CREATE POLICY pf_select ON platform_fees FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY pf_insert ON platform_fees FOR INSERT WITH CHECK (team_id = get_user_team_id());

CREATE POLICY gst_select ON gst_transactions FOR SELECT USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'accountant', 'manager'));
CREATE POLICY gst_insert ON gst_transactions FOR INSERT WITH CHECK (team_id = get_user_team_id());

CREATE POLICY cogs_select ON cogs_records FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY cogs_insert ON cogs_records FOR INSERT WITH CHECK (team_id = get_user_team_id());

CREATE POLICY pls_select ON pl_summary FOR SELECT USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'accountant', 'manager'));
CREATE POLICY pls_all ON pl_summary FOR ALL USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'accountant'));

-- Settlements
CREATE POLICY sc_select ON settlement_cycles FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY sc_all ON settlement_cycles FOR ALL USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'accountant'));

CREATE POLICY st_select ON settlement_transactions FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY st_insert ON settlement_transactions FOR INSERT WITH CHECK (team_id = get_user_team_id());

CREATE POLICY po_select ON payouts FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY po_all ON payouts FOR ALL USING (team_id = get_user_team_id() AND get_user_role() IN ('admin', 'accountant'));

-- Sync logs
CREATE POLICY sl_select ON sync_logs FOR SELECT USING (team_id = get_user_team_id());
CREATE POLICY sl_insert ON sync_logs FOR INSERT WITH CHECK (team_id = get_user_team_id());
CREATE POLICY sl_update ON sync_logs FOR UPDATE USING (team_id = get_user_team_id());

-- Webhook events
CREATE POLICY we_select ON webhook_events FOR SELECT USING (team_id = get_user_team_id() OR team_id IS NULL);
CREATE POLICY we_insert ON webhook_events FOR INSERT WITH CHECK (TRUE);
CREATE POLICY we_update ON webhook_events FOR UPDATE USING (TRUE);

-- Platforms table is public (read-only)
ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY platforms_select ON platforms FOR SELECT USING (TRUE);

-- ============================================================
-- REALTIME
-- ============================================================

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE warehouse_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_discrepancies;
ALTER PUBLICATION supabase_realtime ADD TABLE sync_logs;
