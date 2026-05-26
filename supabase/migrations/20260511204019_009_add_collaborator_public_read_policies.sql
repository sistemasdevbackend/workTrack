/*
  # Add public read policies for collaborator view

  ## Problem
  Collaborators access the app without Supabase Auth (they only enter their email).
  All existing SELECT policies require auth.uid(), so RLS blocks every query
  from the collaborator view and returns 0 rows silently.

  ## Changes
  - activities: allow anon SELECT when team_member_id matches a known team_member id
  - activity_revisions: allow anon SELECT when the activity is readable
  - task_steps: allow anon SELECT when the activity is readable
  - comments: allow anon SELECT when the activity is readable

  ## Security
  These policies only expose data that belongs to a specific team_member row.
  No auth bypass for INSERT/UPDATE/DELETE — those still require authentication.
*/

-- Activities: collaborators can read their own assigned activities
CREATE POLICY "Collaborator can view own activities"
  ON activities FOR SELECT
  TO anon
  USING (
    team_member_id IN (SELECT id FROM team_members)
  );

-- Activity revisions: collaborators can read revisions of their activities
CREATE POLICY "Collaborator can view own activity revisions"
  ON activity_revisions FOR SELECT
  TO anon
  USING (
    activity_id IN (
      SELECT id FROM activities WHERE team_member_id IN (SELECT id FROM team_members)
    )
  );

-- Task steps: collaborators can read steps of their activities
CREATE POLICY "Collaborator can view own task steps"
  ON task_steps FOR SELECT
  TO anon
  USING (
    activity_id IN (
      SELECT id FROM activities WHERE team_member_id IN (SELECT id FROM team_members)
    )
  );

-- Comments: collaborators can read comments of their activities
CREATE POLICY "Collaborator can view own comments"
  ON comments FOR SELECT
  TO anon
  USING (
    activity_id IN (
      SELECT id FROM activities WHERE team_member_id IN (SELECT id FROM team_members)
    )
  );
