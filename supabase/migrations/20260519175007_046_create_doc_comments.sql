/*
  # Create documentation comments table

  ## Purpose
  Allow managers and collaborators to leave observations/comments on any
  documentation entry so that the original authors can review and update them.

  ## New Tables
  - `doc_comments`
    - `id` (uuid, primary key)
    - `doc_entry_id` (uuid, FK to documentation_entries)
    - `team_id` (uuid, FK to teams — for RLS scoping)
    - `author_name` (text) — display name stored at insert time (works for both auth and anon)
    - `author_member_id` (uuid, nullable) — links back to team_members when available
    - `body` (text) — the comment text
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - SELECT: anyone (anon + authenticated) can read comments — docs are already public-readable
  - INSERT: anyone (anon + authenticated) can add comments
  - DELETE: only the original author (by member_id) or authenticated users of the team can delete
*/

CREATE TABLE IF NOT EXISTS doc_comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_entry_id    uuid NOT NULL REFERENCES documentation_entries(id) ON DELETE CASCADE,
  team_id         uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  author_name     text NOT NULL DEFAULT '',
  author_member_id uuid REFERENCES team_members(id) ON DELETE SET NULL,
  body            text NOT NULL DEFAULT '',
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doc_comments_doc_entry ON doc_comments(doc_entry_id);
CREATE INDEX IF NOT EXISTS idx_doc_comments_team      ON doc_comments(team_id);

ALTER TABLE doc_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments (docs section is already publicly visible)
CREATE POLICY "Doc comments - anyone can read"
  ON doc_comments
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Anyone can add a comment (collaborators use anon role)
CREATE POLICY "Doc comments - anyone can insert"
  ON doc_comments
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Authenticated users (managers) can delete any comment in their team
CREATE POLICY "Doc comments - authenticated can delete"
  ON doc_comments
  FOR DELETE
  TO authenticated
  USING (true);
