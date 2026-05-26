/*
  # Create team_projects table

  ## Purpose
  Centralizes project names per team so that activities, documentation,
  and changelog entries all share the same project name catalog.
  This prevents typos and inconsistencies across modules.

  ## New Tables
  - `team_projects`
    - `id` (uuid, primary key)
    - `team_id` (uuid, FK to teams)
    - `name` (text) — unique per team
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can read projects for their team
  - Authenticated users can insert new projects for their team
*/

CREATE TABLE IF NOT EXISTS team_projects (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (team_id, name)
);

ALTER TABLE team_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can read their team projects"
  ON team_projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_projects.team_id
        AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can insert team projects"
  ON team_projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_projects.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- Allow anon reads so collaborator view can also load projects
CREATE POLICY "Public can read team projects"
  ON team_projects FOR SELECT
  TO anon
  USING (true);

-- Allow anon insert so collaborator view can create activities with projects
CREATE POLICY "Public can insert team projects"
  ON team_projects FOR INSERT
  TO anon
  WITH CHECK (true);
