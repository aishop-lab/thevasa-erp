-- ============================================================
-- RPC: detect_inventory_discrepancies
-- ============================================================
-- Called from the Discrepancies page "Run Check" button.
-- Compares warehouse_stock between FBA and non-FBA warehouses
-- for the current user's team. Creates or updates discrepancy
-- records and auto-resolves ones where quantities now match.
-- ============================================================

CREATE OR REPLACE FUNCTION detect_inventory_discrepancies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_team_id UUID;
  v_fba_wh_id UUID;
  v_main_wh_id UUID;
  rec RECORD;
  v_diff INT;
  v_severity TEXT;
  v_existing_id UUID;
BEGIN
  -- Get the calling user's team
  v_team_id := get_user_team_id();
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'No team found for current user';
  END IF;

  -- Get the FBA warehouse
  SELECT id INTO v_fba_wh_id
  FROM warehouses
  WHERE team_id = v_team_id AND is_fba = true AND is_active = true
  LIMIT 1;

  IF v_fba_wh_id IS NULL THEN
    RAISE EXCEPTION 'No active FBA warehouse found';
  END IF;

  -- Get the main (non-FBA) warehouse
  SELECT id INTO v_main_wh_id
  FROM warehouses
  WHERE team_id = v_team_id AND is_fba = false AND is_active = true
  LIMIT 1;

  IF v_main_wh_id IS NULL THEN
    RAISE EXCEPTION 'No active main warehouse found';
  END IF;

  -- Compare stock between main warehouse and FBA for all variants
  -- that exist in either warehouse
  FOR rec IN
    SELECT
      COALESCE(main.variant_id, fba.variant_id) AS variant_id,
      COALESCE(main.qty_on_hand, 0) AS main_qty,
      COALESCE(fba.qty_on_hand, 0) AS fba_qty
    FROM
      (SELECT variant_id, qty_on_hand FROM warehouse_stock
       WHERE team_id = v_team_id AND warehouse_id = v_main_wh_id) main
    FULL OUTER JOIN
      (SELECT variant_id, qty_on_hand FROM warehouse_stock
       WHERE team_id = v_team_id AND warehouse_id = v_fba_wh_id) fba
    ON main.variant_id = fba.variant_id
  LOOP
    v_diff := rec.fba_qty - rec.main_qty;

    -- Calculate severity
    IF ABS(v_diff) = 0 THEN
      v_severity := 'none';
    ELSIF ABS(v_diff) <= 2 AND (rec.main_qty = 0 OR (ABS(v_diff)::FLOAT / rec.main_qty * 100) <= 10) THEN
      v_severity := 'minor';
    ELSIF ABS(v_diff) <= 10 AND (rec.main_qty = 0 OR (ABS(v_diff)::FLOAT / rec.main_qty * 100) <= 25) THEN
      v_severity := 'moderate';
    ELSE
      v_severity := 'major';
    END IF;

    -- Check for existing open/investigating discrepancy
    SELECT id INTO v_existing_id
    FROM inventory_discrepancies
    WHERE team_id = v_team_id
      AND variant_id = rec.variant_id
      AND warehouse_id = v_main_wh_id
      AND status IN ('open', 'investigating')
    LIMIT 1;

    IF v_diff != 0 THEN
      IF v_existing_id IS NOT NULL THEN
        -- Update existing discrepancy
        UPDATE inventory_discrepancies
        SET system_qty = rec.main_qty,
            physical_qty = rec.fba_qty,
            detected_at = NOW()
        WHERE id = v_existing_id;
      ELSE
        -- Create new discrepancy
        INSERT INTO inventory_discrepancies (
          team_id, variant_id, warehouse_id, fba_warehouse_id,
          system_qty, physical_qty, status, detected_at
        ) VALUES (
          v_team_id, rec.variant_id, v_main_wh_id, v_fba_wh_id,
          rec.main_qty, rec.fba_qty, 'open', NOW()
        );
      END IF;
    ELSIF v_existing_id IS NOT NULL THEN
      -- Quantities match — auto-resolve existing discrepancy
      UPDATE inventory_discrepancies
      SET status = 'resolved',
          resolution_notes = 'Auto-resolved: quantities now match after discrepancy check.',
          resolved_at = NOW()
      WHERE id = v_existing_id;
    END IF;
  END LOOP;
END;
$$;
