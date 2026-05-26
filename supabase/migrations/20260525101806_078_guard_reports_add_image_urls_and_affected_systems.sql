/*
  # Enhance guard_reports with images and affected systems

  Adds richer fields to guard_reports to support evidence images and
  a list of affected systems/environments per checkpoint report.

  ## Changes
  - `guard_reports`: new columns:
    - `image_urls` (text[], default {}) — evidence screenshots
    - `affected_systems` (text, default '') — list of affected systems/envs
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guard_reports' AND column_name = 'image_urls'
  ) THEN
    ALTER TABLE guard_reports ADD COLUMN image_urls text[] NOT NULL DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'guard_reports' AND column_name = 'affected_systems'
  ) THEN
    ALTER TABLE guard_reports ADD COLUMN affected_systems text NOT NULL DEFAULT '';
  END IF;
END $$;
