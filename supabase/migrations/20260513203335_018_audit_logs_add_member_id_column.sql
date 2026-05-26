/*
  # Add actor_member_id column to audit_logs

  The existing audit_logs table has actor_id as uuid (for authenticated managers).
  Collaborators are identified by team_member_id (uuid text). This migration adds
  actor_member_id (text) so collaborator entries can store their team_member_id
  without conflicting with the uuid type of actor_id.

  Also adds actor_type column to distinguish 'manager' vs 'collaborator'.

  ## Changes
  - `audit_logs.actor_type` (text) — 'manager' | 'collaborator', defaults 'manager'
  - `audit_logs.actor_member_id` (text) — team_member_id for collaborator entries
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'actor_type'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN actor_type text NOT NULL DEFAULT 'manager';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'actor_member_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN actor_member_id text;
  END IF;
END $$;
