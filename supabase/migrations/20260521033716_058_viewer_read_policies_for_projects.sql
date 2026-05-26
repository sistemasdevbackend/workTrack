/*
  # Add RLS read policies for viewers

  Viewers need to read team_projects, project_status_logs, activities, and teams
  for the teams that belong to managers they have been granted access to.

  These are SELECT-only policies that check viewer_grants.
*/

-- team_projects: viewer can read if granted access to a manager of that team
CREATE POLICY "Viewer can read team_projects of granted managers"
  ON team_projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND ar.team_id = team_projects.team_id
    )
  );

-- project_status_logs: viewer can read if granted access to the manager of that team
CREATE POLICY "Viewer can read project_status_logs of granted managers"
  ON project_status_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND ar.team_id = project_status_logs.team_id
    )
  );

-- activities: viewer can read if granted access to a manager of that team
CREATE POLICY "Viewer can read activities of granted managers"
  ON activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND ar.team_id = activities.team_id
    )
  );

-- teams: viewer can read teams they have grants for
CREATE POLICY "Viewer can read teams of granted managers"
  ON teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND ar.team_id = teams.id
    )
  );

-- team_members: viewer can read members of teams they have grants for
CREATE POLICY "Viewer can read team_members of granted managers"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM viewer_grants vg
      JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
        AND ar.team_id = team_members.team_id
    )
  );
