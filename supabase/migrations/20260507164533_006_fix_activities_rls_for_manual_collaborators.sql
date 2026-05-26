/*
  # Fix activities RLS to work with manual collaborators

  1. Problem
    - Activities policies check team_members.user_id = auth.uid()
    - Manual collaborators have user_id = null
    - This means the team creator can't see activities for their team

  2. Solution
    - Drop existing policies
    - Create simple policies:
      - SELECT: user is authenticated AND created the activity OR is in team_members with matching user_id
      - INSERT: user is authenticated AND created_by = auth.uid()
      - UPDATE: user is authenticated AND created_by = auth.uid()
    - Since team_members RLS is disabled, the subquery won't recurse
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Activities - users can view team activities" ON activities;
DROP POLICY IF EXISTS "Activities - users can create activities" ON activities;
DROP POLICY IF EXISTS "Activities - users can update activities in their team" ON activities;

-- SELECT: can view if authenticated and (created the activity OR is a team member with user_id)
CREATE POLICY "Activities - authenticated users can view"
  ON activities FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = activities.team_id
      AND team_members.user_id = auth.uid()
    )
  );

-- INSERT: can create if authenticated and is the creator
CREATE POLICY "Activities - authenticated users can create"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
  );

-- UPDATE: can update if authenticated and created the activity
CREATE POLICY "Activities - creator can update"
  ON activities FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- DELETE: can delete if authenticated and created the activity
CREATE POLICY "Activities - creator can delete"
  ON activities FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());
