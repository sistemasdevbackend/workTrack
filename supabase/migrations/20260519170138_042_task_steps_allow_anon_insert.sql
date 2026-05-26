/*
  # Allow anon collaborators to insert task steps

  ## Context
  Collaborators without a Supabase Auth account operate as the `anon` role.
  When they create an activity they also need to insert task steps.
  The existing INSERT policy only covers `authenticated` users.

  ## Changes
  - Add INSERT policy on `task_steps` for the `anon` role
  - Allow insert when the activity_id references an existing activity
*/

CREATE POLICY "Anon collaborators can insert task steps"
  ON task_steps
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activities WHERE activities.id = task_steps.activity_id
    )
  );
