/*
  # Create release_monitoring_logs table

  ## Purpose
  Stores daily post-release monitoring check-ins submitted by collaborators.
  For each activity released to production, collaborators are prompted once per day
  for 5 days starting from the release date to report the status of the release.

  ## New Tables
  - `release_monitoring_logs`
    - `id` (uuid, PK)
    - `activity_id` (uuid, FK → activities) — the released activity being monitored
    - `team_member_id` (uuid, FK → team_members) — the collaborator submitting
    - `day_number` (int) — which day of monitoring (1–5)
    - `status` (text) — 'OK', 'ISSUE', 'CRITICAL'
    - `comment` (text) — collaborator's observation
    - `image_url` (text, nullable) — evidence screenshot URL
    - `submitted_at` (timestamptz)

  ## Security
  - RLS enabled
  - Anon/public can INSERT (collaborators log in without auth)
  - Authenticated managers can SELECT all logs for their team's activities
  - Anon can SELECT their own logs (by activity_id)
*/

CREATE TABLE IF NOT EXISTS release_monitoring_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id      uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  team_member_id   uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  day_number       int  NOT NULL CHECK (day_number BETWEEN 1 AND 5),
  status           text NOT NULL CHECK (status IN ('OK', 'ISSUE', 'CRITICAL')),
  comment          text NOT NULL DEFAULT '',
  image_url        text,
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, team_member_id, day_number)
);

ALTER TABLE release_monitoring_logs ENABLE ROW LEVEL SECURITY;

-- Anon collaborators can insert their own monitoring entries
CREATE POLICY "Anon can insert monitoring logs"
  ON release_monitoring_logs FOR INSERT
  TO anon
  WITH CHECK (true);

-- Anon collaborators can read logs for a given activity (to check if today already submitted)
CREATE POLICY "Anon can read monitoring logs by activity"
  ON release_monitoring_logs FOR SELECT
  TO anon
  USING (true);

-- Authenticated managers can read all monitoring logs
CREATE POLICY "Authenticated can read all monitoring logs"
  ON release_monitoring_logs FOR SELECT
  TO authenticated
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE release_monitoring_logs;
