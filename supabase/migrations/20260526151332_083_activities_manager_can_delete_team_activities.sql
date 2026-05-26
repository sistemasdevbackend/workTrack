/*
  # Allow team managers to delete any activity in their team

  ## Problem
  Activities created before the `created_by` column existed (or created via
  collaborator flows) have created_by = NULL. The existing DELETE policy only
  allows deletion when created_by = auth.uid(), so those activities can never
  be deleted by anyone, including the manager.

  ## Fix
  Drop and recreate the DELETE policy to also allow deletion when the
  authenticated user is a manager of the activity's team (via app_roles).
*/

DROP POLICY IF EXISTS "Activities - creator can delete" ON activities;

CREATE POLICY "Activities - creator or team manager can delete"
  ON activities
  FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM app_roles
      WHERE app_roles.user_id = auth.uid()
        AND app_roles.team_id = activities.team_id
        AND app_roles.role IN ('manager', 'super_admin')
    )
  );
