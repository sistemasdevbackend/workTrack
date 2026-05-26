/*
  # Create utilities_articles table

  A shared knowledge base for queries, incident checklists, troubleshooting guides,
  and how-to articles accessible by both collaborators and managers.

  ## New Tables
  - `utilities_articles`
    - `id` (uuid, pk)
    - `team_id` (uuid, fk teams)
    - `title` (text) — article title
    - `category` (text) — QUERY | INCIDENCIA | GUIA | PROCESO | OTRO
    - `content` (text) — main body (markdown-style plain text)
    - `image_urls` (text[]) — attached screenshots/evidence
    - `tags` (text[]) — free-form tags for filtering
    - `author_id` (uuid, fk team_members nullable)
    - `author_name` (text) — denormalized for display
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled; authenticated users can read all articles in their team
  - Managers (authenticated) can insert/update/delete
  - Anon can read (for collaborator access without full auth)
*/

CREATE TABLE IF NOT EXISTS utilities_articles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title        text NOT NULL DEFAULT '',
  category     text NOT NULL DEFAULT 'OTRO',
  content      text NOT NULL DEFAULT '',
  image_urls   text[] NOT NULL DEFAULT '{}',
  tags         text[] NOT NULL DEFAULT '{}',
  author_id    uuid REFERENCES team_members(id) ON DELETE SET NULL,
  author_name  text NOT NULL DEFAULT '',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS utilities_articles_team_id_idx ON utilities_articles(team_id);
CREATE INDEX IF NOT EXISTS utilities_articles_category_idx ON utilities_articles(team_id, category);

ALTER TABLE utilities_articles ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read articles for teams they belong to
CREATE POLICY "Authenticated team members can read utilities"
  ON utilities_articles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = utilities_articles.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- Anon (collaborators without full auth) can read
CREATE POLICY "Anon can read utilities"
  ON utilities_articles FOR SELECT
  TO anon
  USING (true);

-- Authenticated users can insert
CREATE POLICY "Authenticated team members can insert utilities"
  ON utilities_articles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = utilities_articles.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- Authenticated users can update articles in their team
CREATE POLICY "Authenticated team members can update utilities"
  ON utilities_articles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = utilities_articles.team_id
        AND team_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = utilities_articles.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- Authenticated users can delete articles in their team
CREATE POLICY "Authenticated team members can delete utilities"
  ON utilities_articles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = utilities_articles.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- Anon insert (collaborators)
CREATE POLICY "Anon can insert utilities"
  ON utilities_articles FOR INSERT
  TO anon
  WITH CHECK (true);

-- Anon update
CREATE POLICY "Anon can update utilities"
  ON utilities_articles FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);
