/*
  # Update team_members table with name and position fields

  1. Changes
    - Add name and position fields to team_members
    - team_members no longer requires auth.users relationship
    - Allows creating collaborators without registered users
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'name'
  ) THEN
    ALTER TABLE team_members ADD COLUMN name text NOT NULL DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'position'
  ) THEN
    ALTER TABLE team_members ADD COLUMN position text NOT NULL DEFAULT 'Miembro';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'team_members' AND column_name = 'email'
  ) THEN
    ALTER TABLE team_members ADD COLUMN email text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Update the structure so user_id can be nullable
ALTER TABLE team_members ALTER COLUMN user_id DROP NOT NULL;

-- Add unique constraint on email + team_id to prevent duplicates
ALTER TABLE team_members ADD CONSTRAINT unique_team_email UNIQUE(team_id, email);
