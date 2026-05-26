/*
  # RLS policies for supervisors to assign activities

  ## Changes
  - Supervisors (viewers) can UPDATE activities to set assigned_to / team_member_id
    only when they have can_assign_activities = true in viewer_grants for that manager's team
  - Supervisors can INSERT new activities when can_assign_activities = true
*/

-- Allow supervisor to update activities (assign them) in teams they have assign permission for
CREATE POLICY "Supervisor can update activities for assigned managers"
  ON activities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND vg.can_assign_activities = true
        AND ar.team_id = activities.team_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND vg.can_assign_activities = true
        AND ar.team_id = activities.team_id
    )
  );

-- Allow supervisor to insert activities in teams they have assign permission for
CREATE POLICY "Supervisor can insert activities for assigned managers"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND vg.can_assign_activities = true
        AND ar.team_id = activities.team_id
    )
  );

-- Allow supervisor to read task_steps of teams they can see
CREATE POLICY "Supervisor can read task_steps of granted managers"
  ON task_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      JOIN activities a ON a.id = task_steps.activity_id
      WHERE vg.viewer_user_id = auth.uid()
        AND ar.team_id = a.team_id
    )
  );
