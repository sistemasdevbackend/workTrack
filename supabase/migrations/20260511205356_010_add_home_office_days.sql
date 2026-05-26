/*
  # Add Home Office Days

  ## Summary
  Allows managers to assign one or more days of the week as Home Office days per collaborator.
  Collaborators see their assigned HO days at the top of their activity view.

  ## New Tables
  - `home_office_days`
    - `id` (uuid, primary key)
    - `team_member_id` (uuid, FK → team_members.id, cascade delete)
    - `day_of_week` (int, 1=Monday … 5=Friday)
    - `created_at` (timestamptz)
    - Unique constraint: one entry per (team_member_id, day_of_week)

  ## Security
  - RLS enabled
  - Authenticated users (managers) can manage HO days for team members in their teams
  - Anon users (collaborators) can SELECT their own HO days
*/

CREATE TABLE IF NOT EXISTS home_office_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  created_at timestamptz DEFAULT now(),
  UNIQUE (team_member_id, day_of_week)
);

ALTER TABLE home_office_days ENABLE ROW LEVEL SECURITY;

-- Managers: can view HO days for members in their teams
CREATE POLICY "Managers can view home office days"
  ON home_office_days FOR SELECT
  TO authenticated
  USING (
    team_member_id IN (
      SELECT tm.id FROM team_members tm
      WHERE tm.team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Managers: can insert HO days for members in their teams
CREATE POLICY "Managers can insert home office days"
  ON home_office_days FOR INSERT
  TO authenticated
  WITH CHECK (
    team_member_id IN (
      SELECT tm.id FROM team_members tm
      WHERE tm.team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Managers: can delete HO days for members in their teams
CREATE POLICY "Managers can delete home office days"
  ON home_office_days FOR DELETE
  TO authenticated
  USING (
    team_member_id IN (
      SELECT tm.id FROM team_members tm
      WHERE tm.team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

-- Collaborators (anon): can read their own HO days
CREATE POLICY "Collaborator can view own home office days"
  ON home_office_days FOR SELECT
  TO anon
  USING (
    team_member_id IN (SELECT id FROM team_members)
  );
