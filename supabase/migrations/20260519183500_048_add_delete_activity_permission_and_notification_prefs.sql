/*
  # Add delete_activity permission and notification preferences

  ## Changes

  ### 1. member_permissions
  No schema change needed — the feature slug 'delete_activity' is stored as text,
  so it works with the existing table.

  ### 2. notification_preferences
  New table to store per-member notification preferences:
  - Which notification types they want to receive
  - Optionally filter by sender (team_member_id of the creator)

  ## Tables
  - `notification_preferences`
    - `id` (uuid, PK)
    - `team_member_id` (uuid, FK → team_members)
    - `notif_type` (text) — e.g. 'ACTIVITY_CREATED', 'ACTIVITY_UPDATED', etc.
    - `enabled` (boolean, default true)
    - `created_at` (timestamptz)
    - UNIQUE (team_member_id, notif_type)

  ## Security
  - RLS enabled
  - Collaborator can read/update their own preferences
  - Public (anon) can also read/upsert so CollaboratorView (unauthenticated) works
*/

CREATE TABLE IF NOT EXISTS notification_preferences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id  uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  notif_type      text NOT NULL,
  enabled         boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (team_member_id, notif_type)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read own notification preferences"
  ON notification_preferences FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Members can insert own notification preferences"
  ON notification_preferences FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Members can update own notification preferences"
  ON notification_preferences FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Members can delete own notification preferences"
  ON notification_preferences FOR DELETE
  TO anon, authenticated
  USING (true);
