/*
  # Allow anon collaborators to create activities

  ## Context
  Collaborators without a Supabase Auth account (user_id IS NULL) log in via email lookup
  and operate as the `anon` role. The existing INSERT policy only covers `authenticated` users.
  This migration adds a policy so that anon collaborators can insert activities, provided
  the target team_id exists in the teams table (i.e., it's a real team).

  ## Changes
  - Add INSERT policy on `activities` for the `anon` role
  - Allow insert when the provided team_id references a valid team
*/

CREATE POLICY "Anon collaborators can create activities"
  ON activities
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams WHERE teams.id = activities.team_id
    )
  );
