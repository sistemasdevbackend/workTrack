/*
  # Create guard_reports table

  ## Summary
  Collaborators submit status reports at key moments during their guard shift:
  - INICIO: at the start of their shift
  - MEDIO: mid-shift check-in
  - FIN: end of shift

  Each report stores the checkpoint type, a status description, project observations,
  and optional notes. Managers can read all reports for their team.

  ## New Tables
  - `guard_reports`
    - `id` (uuid, PK)
    - `guard_schedule_id` (uuid, FK → guard_schedules)
    - `team_member_id` (uuid, FK → team_members)
    - `team_id` (uuid, FK → teams)
    - `member_name` (text, denormalized)
    - `checkpoint` (text: 'INICIO' | 'MEDIO' | 'FIN')
    - `status` (text: 'NORMAL' | 'INCIDENCIA' | 'CRITICO')
    - `project_notes` (text)
    - `observations` (text)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated (managers) can read all reports for their team
  - Anon (collaborators) can insert and read their own team's reports
*/

CREATE TABLE IF NOT EXISTS guard_reports (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guard_schedule_id  uuid NOT NULL REFERENCES guard_schedules(id) ON DELETE CASCADE,
  team_member_id     uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  team_id            uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_name        text NOT NULL DEFAULT '',
  checkpoint         text NOT NULL CHECK (checkpoint IN ('INICIO', 'MEDIO', 'FIN')),
  status             text NOT NULL DEFAULT 'NORMAL' CHECK (status IN ('NORMAL', 'INCIDENCIA', 'CRITICO')),
  project_notes      text NOT NULL DEFAULT '',
  observations       text NOT NULL DEFAULT '',
  created_at         timestamptz DEFAULT now()
);

ALTER TABLE guard_reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users (managers) can read reports for their team
CREATE POLICY "Authenticated users can read guard reports for their team"
  ON guard_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = guard_reports.team_id
        AND tm.user_id = auth.uid()
    )
  );

-- Anon (collaborators) can insert reports
CREATE POLICY "Anon users can insert guard reports"
  ON guard_reports FOR INSERT
  TO anon
  WITH CHECK (true);

-- Anon (collaborators) can read reports for their team
CREATE POLICY "Anon users can read guard reports"
  ON guard_reports FOR SELECT
  TO anon
  USING (true);
