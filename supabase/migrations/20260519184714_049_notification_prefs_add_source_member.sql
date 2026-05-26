/*
  # Add source_member_id to notification_preferences

  ## Summary
  Extends the notification preferences system so the manager can control
  not just WHICH types of notifications a member receives, but also
  FROM WHICH collaborators they receive them.

  ## Changes

  ### notification_preferences
  - Add `source_member_id` (uuid, nullable, FK → team_members)
    - NULL means "this preference applies to all senders for this type"
    - Non-null means "this preference only applies when the notification
      originates from that specific member"
  - Drop and recreate the UNIQUE constraint to include source_member_id

  ### notifications
  - Add `source_member_id` (uuid, nullable) — the team_member that
    triggered the notification (e.g., who created the activity, who
    sent to review, etc.). NULL means system/manager.

  ## Notes
  - Existing rows are unaffected (source_member_id will be NULL by default)
  - The filtering logic in useNotifications will check:
      1. Is there a type-level pref with source_member_id=NULL and enabled=false? → hide
      2. Is there a source-level pref for this sender and enabled=false? → hide
*/

-- Drop old unique constraint before adding new column
ALTER TABLE notification_preferences
  DROP CONSTRAINT IF EXISTS notification_preferences_team_member_id_notif_type_key;

-- Add source_member_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notification_preferences' AND column_name = 'source_member_id'
  ) THEN
    ALTER TABLE notification_preferences
      ADD COLUMN source_member_id uuid REFERENCES team_members(id) ON DELETE CASCADE;
  END IF;
END $$;

-- New unique constraint includes source_member_id (NULL-safe via coalesce in app layer)
CREATE UNIQUE INDEX IF NOT EXISTS notification_preferences_unique_idx
  ON notification_preferences (team_member_id, notif_type, (coalesce(source_member_id::text, '')));

-- Add source_member_id to notifications table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'source_member_id'
  ) THEN
    ALTER TABLE notifications
      ADD COLUMN source_member_id uuid REFERENCES team_members(id) ON DELETE SET NULL;
  END IF;
END $$;
