/*
  # Change home_office_days to use specific dates instead of day_of_week

  ## Summary
  Previously, Home Office was configured as a recurring day of the week (e.g., "every Tuesday").
  This migration changes HO to work like vacation days: each record represents a specific calendar date.
  This allows managers to assign HO on a per-date basis rather than recurring weekly.

  ## Changes
  - Drop the old `home_office_days` table (it only stored day_of_week integers, no real data to preserve)
  - Recreate `home_office_days` with a `date` column (specific calendar date) instead of `day_of_week`
  - Re-apply RLS policies matching the new structure

  ## New Table Structure
  - `home_office_days`
    - `id` (uuid, primary key)
    - `team_member_id` (uuid, FK → team_members.id, cascade delete)
    - `date` (date, specific calendar day)
    - `created_at` (timestamptz)
    - Unique constraint: one entry per (team_member_id, date)
*/

DROP TABLE IF EXISTS home_office_days;

CREATE TABLE home_office_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (team_member_id, date)
);

ALTER TABLE home_office_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view home office days"
  ON home_office_days FOR SELECT
  TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM team_members
      WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Managers can insert home office days"
  ON home_office_days FOR INSERT
  TO authenticated
  WITH CHECK (
    team_member_id IN (
      SELECT id FROM team_members
      WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Managers can delete home office days"
  ON home_office_days FOR DELETE
  TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM team_members
      WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Collaborators can view own home office days"
  ON home_office_days FOR SELECT
  TO anon
  USING (
    team_member_id IN (SELECT id FROM team_members)
  );
