/*
  # Fix RLS for comments, revisions, and task_steps

  1. Problem
    - All three tables check team_members.user_id = auth.uid()
    - Manual collaborators have user_id = null
    - Team creator might not have user_id in team_members

  2. Solution
    - Simplify policies to check via activities.created_by
    - If user created the activity, they can see/manage everything related
    - Also allow if user is in team_members with matching user_id
*/

-- COMMENTS
DROP POLICY IF EXISTS "Comments - users can view comments" ON comments;
DROP POLICY IF EXISTS "Comments - users can add comments" ON comments;

CREATE POLICY "Comments - authenticated can view"
  ON comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM activities WHERE activities.id = comments.activity_id AND activities.created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM activities a
      JOIN team_members tm ON tm.team_id = a.team_id
      WHERE a.id = comments.activity_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Comments - authenticated can add"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM activities WHERE activities.id = comments.activity_id AND activities.created_by = auth.uid())
      OR EXISTS (
        SELECT 1 FROM activities a
        JOIN team_members tm ON tm.team_id = a.team_id
        WHERE a.id = comments.activity_id AND tm.user_id = auth.uid()
      )
    )
  );

-- ACTIVITY_REVISIONS
DROP POLICY IF EXISTS "ActivityRevisions - users can view revisions" ON activity_revisions;
DROP POLICY IF EXISTS "ActivityRevisions - users can create revisions" ON activity_revisions;

CREATE POLICY "Revisions - authenticated can view"
  ON activity_revisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM activities WHERE activities.id = activity_revisions.activity_id AND activities.created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM activities a
      JOIN team_members tm ON tm.team_id = a.team_id
      WHERE a.id = activity_revisions.activity_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Revisions - authenticated can create"
  ON activity_revisions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM activities WHERE activities.id = activity_revisions.activity_id AND activities.created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM activities a
      JOIN team_members tm ON tm.team_id = a.team_id
      WHERE a.id = activity_revisions.activity_id AND tm.user_id = auth.uid()
    )
  );

-- TASK_STEPS
DROP POLICY IF EXISTS "TaskSteps - users can view steps" ON task_steps;
DROP POLICY IF EXISTS "TaskSteps - users can manage steps" ON task_steps;

CREATE POLICY "TaskSteps - authenticated can view"
  ON task_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM activities WHERE activities.id = task_steps.activity_id AND activities.created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM activities a
      JOIN team_members tm ON tm.team_id = a.team_id
      WHERE a.id = task_steps.activity_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "TaskSteps - authenticated can manage"
  ON task_steps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM activities WHERE activities.id = task_steps.activity_id AND activities.created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM activities a
      JOIN team_members tm ON tm.team_id = a.team_id
      WHERE a.id = task_steps.activity_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "TaskSteps - authenticated can update"
  ON task_steps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM activities WHERE activities.id = task_steps.activity_id AND activities.created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM activities a
      JOIN team_members tm ON tm.team_id = a.team_id
      WHERE a.id = task_steps.activity_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "TaskSteps - authenticated can delete"
  ON task_steps FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM activities WHERE activities.id = task_steps.activity_id AND activities.created_by = auth.uid())
    OR EXISTS (
      SELECT 1 FROM activities a
      JOIN team_members tm ON tm.team_id = a.team_id
      WHERE a.id = task_steps.activity_id AND tm.user_id = auth.uid()
    )
  );
