/*
  # Allow viewers to read app_roles of their granted managers

  Viewers (supervisors) need to read the app_roles of the managers assigned to them
  via viewer_grants in order to resolve team assignments in SupervisorDashboard.
  Without this policy, the app_roles query returns empty and the dashboard shows
  "Sin gestores asignados".
*/

CREATE POLICY "Viewer can read app_roles of granted managers"
  ON app_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      WHERE vg.viewer_user_id = auth.uid()
        AND vg.manager_user_id = app_roles.user_id
    )
  );
