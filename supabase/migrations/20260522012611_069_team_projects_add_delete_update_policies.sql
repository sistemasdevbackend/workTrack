/*
  # Add DELETE and UPDATE policies to team_projects

  ## Problem
  Managers could not delete or rename projects because no DELETE or UPDATE
  RLS policies existed on the team_projects table.

  ## Changes
  - Add DELETE policy: authenticated team members can delete projects belonging to their team
  - Add UPDATE policy: authenticated team members can update projects belonging to their team
*/

CREATE POLICY "Team members can delete their team projects"
  ON team_projects FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_projects.team_id
        AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can update their team projects"
  ON team_projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_projects.team_id
        AND team_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_projects.team_id
        AND team_members.user_id = auth.uid()
    )
  );
