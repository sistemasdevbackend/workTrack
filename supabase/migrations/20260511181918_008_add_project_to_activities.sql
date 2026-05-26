/*
  # Add project field to activities

  1. Changes
    - `activities`: new optional `project` text column to categorize activities by project
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'project'
  ) THEN
    ALTER TABLE activities ADD COLUMN project text DEFAULT '' NOT NULL;
  END IF;
END $$;
