/*
  # Allow public (unauthenticated) mutations on documentation_entries

  Collaborators access the app without Supabase Auth (they use sessionStorage).
  The existing policies only allow authenticated users to INSERT/UPDATE/DELETE.
  This migration adds public policies so collaborators can manage documentation.

  ## Changes
  - Add public INSERT policy on documentation_entries
  - Add public UPDATE policy on documentation_entries
  - Add public DELETE policy on documentation_entries
*/

CREATE POLICY "Public can insert documentation"
  ON documentation_entries FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public can update documentation"
  ON documentation_entries FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete documentation"
  ON documentation_entries FOR DELETE
  USING (true);
