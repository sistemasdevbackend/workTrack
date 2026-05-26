/*
  # Fix anon INSERT policy on activities

  ## Problem
  The previous policy used a subquery on `teams` to validate team_id,
  but anon has no SELECT policy on `teams`, so the subquery returns empty
  and the WITH CHECK always fails with an RLS violation.

  ## Fix
  Replace the WITH CHECK condition to validate via `team_members` instead,
  which anon CAN read (policy added in migration 044).
  This ensures the team_id is legitimate by checking that the provided
  team_member_id belongs to the provided team_id.
*/

DROP POLICY IF EXISTS "Anon collaborators can create activities" ON activities;

CREATE POLICY "Anon collaborators can create activities"
  ON activities
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.id = activities.team_member_id
        AND team_members.team_id = activities.team_id
    )
  );
