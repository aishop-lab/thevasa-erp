-- Auto-populate team_id on insert using the authenticated user's team
-- This allows client code to omit team_id in inserts; the trigger fills it from auth context

CREATE OR REPLACE FUNCTION auto_set_team_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.team_id IS NULL THEN
    NEW.team_id := get_user_team_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to all tables with team_id (except teams itself and platforms)
CREATE TRIGGER tr_auto_team_team_members BEFORE INSERT ON team_members FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_size_masters BEFORE INSERT ON size_masters FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_color_masters BEFORE INSERT ON color_masters FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_products BEFORE INSERT ON products FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_product_variants BEFORE INSERT ON product_variants FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_platform_credentials BEFORE INSERT ON platform_credentials FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_platform_mappings BEFORE INSERT ON platform_mappings FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_warehouses BEFORE INSERT ON warehouses FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_warehouse_stock BEFORE INSERT ON warehouse_stock FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_stock_movements BEFORE INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_inventory_discrepancies BEFORE INSERT ON inventory_discrepancies FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_orders BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_order_items BEFORE INSERT ON order_items FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_payments BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_chart_of_accounts BEFORE INSERT ON chart_of_accounts FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_general_ledger BEFORE INSERT ON general_ledger FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_sales_revenue BEFORE INSERT ON sales_revenue FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_expenses BEFORE INSERT ON expenses FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_platform_fees BEFORE INSERT ON platform_fees FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_gst_transactions BEFORE INSERT ON gst_transactions FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_cogs_records BEFORE INSERT ON cogs_records FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_pl_summary BEFORE INSERT ON pl_summary FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_settlement_cycles BEFORE INSERT ON settlement_cycles FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_settlement_transactions BEFORE INSERT ON settlement_transactions FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_payouts BEFORE INSERT ON payouts FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
CREATE TRIGGER tr_auto_team_sync_logs BEFORE INSERT ON sync_logs FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
