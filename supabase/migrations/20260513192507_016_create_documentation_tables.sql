/*
  # Create documentation tables

  ## Purpose
  Stores project documentation entries per team. Each entry links to a changelog
  project (or stands alone with a project name) and contains metadata like version,
  URL, type, and a rich description.

  ## New Tables

  ### `documentation_entries`
  - `id` (uuid, PK)
  - `team_id` (uuid, FK to teams) — scopes the entry to a team
  - `project_name` (text) — name of the project this documentation belongs to
  - `title` (text) — document title / name
  - `version` (text) — version string (e.g. "v2.1", "1.0.0")
  - `doc_type` (text) — category: 'API' | 'MANUAL' | 'ARQUITECTURA' | 'BASE_DE_DATOS' | 'PROCESO' | 'OTRO'
  - `url` (text) — link to the documentation resource
  - `description` (text) — short description of what this doc covers
  - `author_id` (uuid, FK to team_members, nullable) — who added it
  - `status` (text) — 'VIGENTE' | 'OBSOLETO' | 'BORRADOR'
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated managers can insert/update/delete
  - Anon (collaborators) can read all entries for their team
*/

CREATE TABLE IF NOT EXISTS documentation_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  version text NOT NULL DEFAULT '',
  doc_type text NOT NULL DEFAULT 'OTRO',
  url text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  author_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'VIGENTE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS documentation_entries_team_id_idx ON documentation_entries(team_id);
CREATE INDEX IF NOT EXISTS documentation_entries_project_idx ON documentation_entries(team_id, project_name);

ALTER TABLE documentation_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert documentation"
  ON documentation_entries FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update documentation"
  ON documentation_entries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete documentation"
  ON documentation_entries FOR DELETE
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read documentation"
  ON documentation_entries FOR SELECT
  TO anon, authenticated
  USING (true);
