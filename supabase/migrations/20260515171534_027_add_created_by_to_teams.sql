/*
  # Add created_by to teams for manager isolation

  1. Changes
    - Add `created_by` column to `teams` referencing auth.users
    - Backfill existing teams with the only existing user
    - Enable RLS on teams
    - Add policies: owners can see/create/delete their own teams

  2. Security
    - Each manager only sees their own teams
    - No cross-manager data leakage
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'teams' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE teams ADD COLUMN created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Backfill existing teams with the current only user
UPDATE teams SET created_by = '65f1583e-1681-4d74-945d-0f3ce3402319' WHERE created_by IS NULL;

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams - owner can select own teams"
  ON teams FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Teams - owner can insert teams"
  ON teams FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Teams - owner can update own teams"
  ON teams FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Teams - owner can delete own teams"
  ON teams FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
