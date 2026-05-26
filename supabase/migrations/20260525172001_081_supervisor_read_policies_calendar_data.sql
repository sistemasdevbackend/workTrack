/*
  # Supervisor read access for calendar data

  ## Purpose
  Supervisors (viewer role) are not team_members of the teams they supervise,
  so the existing manager/team_member RLS policies block them from reading
  home_office_days, vacation_days, guard_schedules, and guard_reports.

  This migration adds SELECT policies to allow authenticated users who have
  a viewer_grant for the relevant manager's team to read these tables.

  ## New Policies

  ### home_office_days
  - "Supervisors can view home office days of granted teams"

  ### vacation_days
  - "Supervisors can view vacation days of granted teams"

  ### guard_schedules
  - "Supervisors can view guard schedules of granted teams"

  ### guard_reports (already has USING(true) anon policy, but adding explicit one for clarity)
  - Already readable by anon; guard_reports.team_id join covered via guard_schedules

  ## Security
  - Only authenticated users with a matching viewer_grant row can access data
  - Access is scoped to the specific team(s) they are granted
  - No INSERT/UPDATE/DELETE permissions granted — read-only
*/

-- home_office_days: supervisors with a viewer_grant for the manager of this team
CREATE POLICY "Supervisors can view home office days of granted teams"
  ON home_office_days
  FOR SELECT
  TO authenticated
  USING (
    team_member_id IN (
      SELECT tm.id FROM team_members tm
      WHERE tm.team_id IN (
        SELECT COALESCE(ar.team_id, vg.resolved_team_id)
        FROM viewer_grants vg
        LEFT JOIN app_roles ar ON ar.user_id = vg.manager_user_id
        WHERE vg.viewer_user_id = auth.uid()
      )
    )
  );

-- vacation_days: supervisors with a viewer_grant for the manager of this team
CREATE POLICY "Supervisors can view vacation days of granted teams"
  ON vacation_days
  FOR SELECT
  TO authenticated
  USING (
    team_member_id IN (
      SELECT tm.id FROM team_members tm
      WHERE tm.team_id IN (
        SELECT COALESCE(ar.team_id, vg.resolved_team_id)
        FROM viewer_grants vg
        LEFT JOIN app_roles ar ON ar.user_id = vg.manager_user_id
        WHERE vg.viewer_user_id = auth.uid()
      )
    )
  );

-- guard_schedules: supervisors with a viewer_grant for the team
CREATE POLICY "Supervisors can view guard schedules of granted teams"
  ON guard_schedules
  FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT COALESCE(ar.team_id, vg.resolved_team_id)
      FROM viewer_grants vg
      LEFT JOIN app_roles ar ON ar.user_id = vg.manager_user_id
      WHERE vg.viewer_user_id = auth.uid()
    )
  );
