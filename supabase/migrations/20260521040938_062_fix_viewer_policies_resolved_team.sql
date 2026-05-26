/*
  # Fix viewer RLS policies to support resolved_team_id

  When a manager is a super_admin (app_roles.team_id IS NULL), viewer_grants.resolved_team_id
  stores the actual team they manage. The existing policies only check ar.team_id, missing
  these cases. We replace all 5 viewer policies to also check resolved_team_id as fallback.
*/

-- Drop and recreate policies to include resolved_team_id fallback

-- team_projects
DROP POLICY IF EXISTS "Viewer can read team_projects of granted managers" ON team_projects;
CREATE POLICY "Viewer can read team_projects of granted managers"
  ON team_projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      LEFT JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND COALESCE(ar.team_id, vg.resolved_team_id) = team_projects.team_id
    )
  );

-- project_status_logs
DROP POLICY IF EXISTS "Viewer can read project_status_logs of granted managers" ON project_status_logs;
CREATE POLICY "Viewer can read project_status_logs of granted managers"
  ON project_status_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      LEFT JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND COALESCE(ar.team_id, vg.resolved_team_id) = project_status_logs.team_id
    )
  );

-- activities read
DROP POLICY IF EXISTS "Viewer can read activities of granted managers" ON activities;
CREATE POLICY "Viewer can read activities of granted managers"
  ON activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      LEFT JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND COALESCE(ar.team_id, vg.resolved_team_id) = activities.team_id
    )
  );

-- teams
DROP POLICY IF EXISTS "Viewer can read teams of granted managers" ON teams;
CREATE POLICY "Viewer can read teams of granted managers"
  ON teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      LEFT JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND COALESCE(ar.team_id, vg.resolved_team_id) = teams.id
    )
  );

-- team_members
DROP POLICY IF EXISTS "Viewer can read team_members of granted managers" ON team_members;
CREATE POLICY "Viewer can read team_members of granted managers"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      LEFT JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND COALESCE(ar.team_id, vg.resolved_team_id) = team_members.team_id
    )
  );

-- activity update/insert (supervisor with can_assign_activities)
DROP POLICY IF EXISTS "Supervisor can update activities for assigned managers" ON activities;
CREATE POLICY "Supervisor can update activities for assigned managers"
  ON activities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      LEFT JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND vg.can_assign_activities = true
        AND COALESCE(ar.team_id, vg.resolved_team_id) = activities.team_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      LEFT JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND vg.can_assign_activities = true
        AND COALESCE(ar.team_id, vg.resolved_team_id) = activities.team_id
    )
  );

DROP POLICY IF EXISTS "Supervisor can insert activities for assigned managers" ON activities;
CREATE POLICY "Supervisor can insert activities for assigned managers"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      LEFT JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND vg.can_assign_activities = true
        AND COALESCE(ar.team_id, vg.resolved_team_id) = activities.team_id
    )
  );

-- task_steps read for supervisor
DROP POLICY IF EXISTS "Supervisor can read task_steps of granted managers" ON task_steps;
CREATE POLICY "Supervisor can read task_steps of granted managers"
  ON task_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      LEFT JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      JOIN activities a ON a.id = task_steps.activity_id
      WHERE vg.viewer_user_id = auth.uid()
        AND COALESCE(ar.team_id, vg.resolved_team_id) = a.team_id
    )
  );
