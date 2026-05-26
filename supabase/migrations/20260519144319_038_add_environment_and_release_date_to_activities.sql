/*
  # Add environment and release date fields to activities

  ## Summary
  Adds two new columns to the `activities` table:

  1. New Columns
    - `environment` (text) — The environment where the activity applies: DEV, QA, STAGING, PROD
    - `production_release_date` (date) — Date scheduled for production deployment, set by the manager after approving
    - `production_release_notified` (boolean) — Whether the collaborator was already notified of the release date

  2. Status Extension
    - Adds TESTING as a valid intermediate status between IN_PROGRESS and COMPLETED
    - No schema change needed (status is plain text), just documenting the new value
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'environment'
  ) THEN
    ALTER TABLE activities ADD COLUMN environment text NOT NULL DEFAULT 'DEV';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'production_release_date'
  ) THEN
    ALTER TABLE activities ADD COLUMN production_release_date date DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'production_release_notified'
  ) THEN
    ALTER TABLE activities ADD COLUMN production_release_notified boolean NOT NULL DEFAULT false;
  END IF;
END $$;
