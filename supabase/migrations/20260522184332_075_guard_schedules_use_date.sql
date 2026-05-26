/*
  # Change guard_schedules from day_of_week to specific date

  Previously shifts were weekly-recurring (day_of_week 0-6).
  Now each shift is for a specific calendar date (YYYY-MM-DD),
  so the manager assigns "Ulises on Monday May 26" not every Monday.

  Changes:
  - Add `date` column (text YYYY-MM-DD)
  - Drop `day_of_week` column
  - Existing rows (if any) are deleted first to avoid migration conflicts
*/

-- Clear any existing data since the schema is incompatible
DELETE FROM guard_schedules;

-- Add date column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guard_schedules' AND column_name = 'date'
  ) THEN
    ALTER TABLE guard_schedules ADD COLUMN date text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Drop day_of_week column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guard_schedules' AND column_name = 'day_of_week'
  ) THEN
    ALTER TABLE guard_schedules DROP COLUMN day_of_week;
  END IF;
END $$;
