-- =============================================================================
-- Migration 003: Fix platforms table to be team-scoped
-- =============================================================================
-- The code expects platforms to have a team_id column and name='amazon',
-- but the original schema has no team_id and seeds name='amazon_fba'.
-- This migration fixes the mismatch.

-- 1. Remove the globally seeded platform rows
DELETE FROM platforms;

-- 2. Add team_id column to platforms
ALTER TABLE platforms ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- 3. Drop the global UNIQUE constraint on name (each team can have its own platforms)
ALTER TABLE platforms DROP CONSTRAINT platforms_name_key;

-- 4. Add team-scoped unique constraint
ALTER TABLE platforms ADD CONSTRAINT platforms_team_name_unique UNIQUE (team_id, name);

-- 5. Update RLS policies
DROP POLICY IF EXISTS platforms_select ON platforms;

CREATE POLICY platforms_select ON platforms
  FOR SELECT USING (
    team_id IS NULL OR team_id = get_user_team_id()
  );

CREATE POLICY platforms_insert ON platforms
  FOR INSERT WITH CHECK (
    team_id = get_user_team_id()
  );

CREATE POLICY platforms_update ON platforms
  FOR UPDATE USING (
    team_id = get_user_team_id()
  );

CREATE POLICY platforms_delete ON platforms
  FOR DELETE USING (
    team_id = get_user_team_id() AND get_user_role() = 'admin'
  );

-- 6. Add auto-team trigger
CREATE TRIGGER tr_auto_team_platforms
  BEFORE INSERT ON platforms
  FOR EACH ROW EXECUTE FUNCTION auto_set_team_id();
