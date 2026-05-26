/*
  # Add team_member_id to activities

  1. Changes
    - Add team_member_id column to activities
    - Keep assigned_to for backwards compatibility (pode ser usado para user_id si es necesario)
    - team_member_id references team_members table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'team_member_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN team_member_id uuid REFERENCES team_members(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_activities_team_member ON activities(team_member_id);
