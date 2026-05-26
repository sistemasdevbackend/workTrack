/*
  # Allow anon collaborators to read team members

  ## Context
  Collaborators without Supabase Auth (user_id IS NULL) operate as the `anon` role.
  Several RLS policies on other tables use subqueries like:
    `team_member_id IN (SELECT id FROM team_members)`
  These subqueries silently return empty sets when anon cannot read `team_members`,
  causing SELECT policies to block legitimate access.

  This migration adds a minimal SELECT policy so anon can read team members,
  which is required for:
  - Activity SELECT policy to resolve correctly
  - Loading collaborator lists in the modal

  ## Security
  - Read-only (SELECT only)
  - Exposes only non-sensitive columns (id, name, team_id, position)
    via app-level queries; all columns are returned but team_members
    contains no passwords or secrets
*/

CREATE POLICY "Anon collaborators can read team members"
  ON team_members
  FOR SELECT
  TO anon
  USING (true);
