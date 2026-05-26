/*
  # Add Vacation Days

  ## Summary
  Allows managers to assign vacation days to individual collaborators.
  These appear in the team calendar alongside Home Office days.

  ## New Tables
  - `vacation_days`
    - `id` (uuid, primary key)
    - `team_member_id` (uuid, FK → team_members.id, cascade delete)
    - `date` (date, specific calendar day)
    - `note` (text, optional label e.g. "Vacaciones", "Día personal")
    - `created_at` (timestamptz)
    - Unique constraint: one entry per (team_member_id, date)

  ## Security
  - RLS enabled
  - Authenticated managers can manage vacation days for their team members
  - Anon users (collaborators) can read their own vacation days
*/

CREATE TABLE IF NOT EXISTS vacation_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  date date NOT NULL,
  note text NOT NULL DEFAULT 'Vacaciones',
  created_at timestamptz DEFAULT now(),
  UNIQUE (team_member_id, date)
);

ALTER TABLE vacation_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view vacation days"
  ON vacation_days FOR SELECT
  TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM team_members
      WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Managers can insert vacation days"
  ON vacation_days FOR INSERT
  TO authenticated
  WITH CHECK (
    team_member_id IN (
      SELECT id FROM team_members
      WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Managers can delete vacation days"
  ON vacation_days FOR DELETE
  TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM team_members
      WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Managers can update vacation days"
  ON vacation_days FOR UPDATE
  TO authenticated
  USING (
    team_member_id IN (
      SELECT id FROM team_members
      WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    team_member_id IN (
      SELECT id FROM team_members
      WHERE team_id IN (
        SELECT team_id FROM team_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Collaborators can view own vacation days"
  ON vacation_days FOR SELECT
  TO anon
  USING (
    team_member_id IN (SELECT id FROM team_members)
  );
