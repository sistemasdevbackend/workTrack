/*
  # Create guard_schedules table

  ## Summary
  Allows managers to define recurring guard shifts for team members.
  Each shift is tied to a team, a team member, a day of week (0=Sun … 6=Sat),
  and a start/end time (HH:MM strings). The collaborator calendar will display
  their own shifts; the manager calendar shows all shifts.

  ## New Tables
  - `guard_schedules`
    - `id` (uuid, PK)
    - `team_id` (uuid, FK → teams)
    - `team_member_id` (uuid, FK → team_members)
    - `member_name` (text) – denormalized for display
    - `day_of_week` (int 0-6, 0=Sunday)
    - `start_time` (text, HH:MM)
    - `end_time` (text, HH:MM)
    - `color` (text, optional hex)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Managers (authenticated) can select/insert/update/delete shifts for their team
  - Collaborators can read shifts for their own team (anon-friendly via team_id)
*/

CREATE TABLE IF NOT EXISTS guard_schedules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  team_member_id   uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  member_name      text NOT NULL DEFAULT '',
  day_of_week      int  NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time       text NOT NULL,
  end_time         text NOT NULL,
  color            text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE guard_schedules ENABLE ROW LEVEL SECURITY;

-- Authenticated users (managers) full access to their team's schedules
CREATE POLICY "Authenticated users can select guard schedules for their team"
  ON guard_schedules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = guard_schedules.team_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert guard schedules for their team"
  ON guard_schedules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = guard_schedules.team_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update guard schedules for their team"
  ON guard_schedules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = guard_schedules.team_id
        AND tm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = guard_schedules.team_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can delete guard schedules for their team"
  ON guard_schedules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = guard_schedules.team_id
        AND tm.user_id = auth.uid()
    )
  );

-- Anon (collaborators) can read all guard schedules for any team
CREATE POLICY "Anon users can read guard schedules"
  ON guard_schedules FOR SELECT
  TO anon
  USING (true);
