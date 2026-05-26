/*
  # Add activity_type column to activities table

  ## Summary
  Adds an `activity_type` field to classify each activity by its nature.

  ## New Column
  - `activity_type` (text, nullable): One of 'CODE', 'DATABASE', 'BOTH', 'DOCUMENTATION', 'TESTING'.
    NULL means unclassified (backwards-compatible with existing rows).

  ## Notes
  - No default is set intentionally so existing rows are NULL rather than masking an incorrect default.
  - A CHECK constraint ensures only valid values can be stored.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'activity_type'
  ) THEN
    ALTER TABLE activities
      ADD COLUMN activity_type text
      CHECK (activity_type IN ('CODE', 'DATABASE', 'BOTH', 'DOCUMENTATION', 'TESTING'));
  END IF;
END $$;
