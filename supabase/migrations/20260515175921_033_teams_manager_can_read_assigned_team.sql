/*
  # Allow managers to read their assigned team

  The teams table currently only allows SELECT to the team creator (created_by).
  A manager assigned to a team via app_roles needs to read that team's data.
  This policy allows any authenticated user to read a team they are assigned to
  in app_roles, and also allows super_admin to read all teams.
*/

CREATE POLICY "Teams - assigned manager can read team"
  ON teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_roles ar
      WHERE ar.user_id = auth.uid()
        AND ar.team_id = teams.id
    )
  );

CREATE POLICY "Teams - super_admin reads all"
  ON teams FOR SELECT
  TO authenticated
  USING (is_super_admin());
