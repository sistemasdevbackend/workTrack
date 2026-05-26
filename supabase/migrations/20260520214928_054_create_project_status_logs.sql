/*
  # Create project_status_logs table

  ## Purpose
  Allows managers to log a weekly (or periodic) status update per project.
  Each log entry records the overall project health, a comment, and when it was written.
  This creates a running commentary / bitácora visible only to the manager.

  ## New Tables
  - `project_status_logs`
    - `id` (uuid, primary key)
    - `team_id` (uuid, FK to teams)
    - `project_name` (text) — matches team_projects.name
    - `overall_status` (text) — one of: DEVELOPING, ON_HOLD, COMPLETED, AT_RISK, CANCELLED
    - `comment` (text) — manager's status update text
    - `logged_by` (uuid) — auth.uid() of manager
    - `logged_at` (timestamptz) — when it was logged

  ## Security
  - RLS enabled
  - Only authenticated users who are managers of the team can read/insert/update/delete
*/

CREATE TABLE IF NOT EXISTS project_status_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id        uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_name   text NOT NULL,
  overall_status text NOT NULL DEFAULT 'DEVELOPING',
  comment        text NOT NULL DEFAULT '',
  logged_by      uuid NOT NULL,
  logged_at      timestamptz DEFAULT now()
);

ALTER TABLE project_status_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager can read project status logs for their team"
  ON project_status_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = project_status_logs.team_id
        AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Manager can insert project status logs"
  ON project_status_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = logged_by
    AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = project_status_logs.team_id
        AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Manager can update own project status logs"
  ON project_status_logs FOR UPDATE
  TO authenticated
  USING (auth.uid() = logged_by)
  WITH CHECK (auth.uid() = logged_by);

CREATE POLICY "Manager can delete own project status logs"
  ON project_status_logs FOR DELETE
  TO authenticated
  USING (auth.uid() = logged_by);

CREATE INDEX IF NOT EXISTS project_status_logs_team_project_idx
  ON project_status_logs (team_id, project_name, logged_at DESC);
