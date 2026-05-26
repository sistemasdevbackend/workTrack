/*
  # Fix collaborator RLS policy to include shared activities

  ## Problem
  The "Collaborator can view own activities" policy only allows reading activities
  where team_member_id matches the member. Activities where the collaborator is the
  second member (shared_with_member_id) are not visible to them.

  ## Fix
  Drop the existing policy and recreate it to also allow SELECT when the
  team_members row matches shared_with_member_id.
*/

DROP POLICY IF EXISTS "Collaborator can view own activities" ON activities;

CREATE POLICY "Collaborator can view own or shared activities"
  ON activities
  FOR SELECT
  USING (
    team_member_id IN (SELECT id FROM team_members)
    OR
    shared_with_member_id IN (SELECT id FROM team_members)
  );
