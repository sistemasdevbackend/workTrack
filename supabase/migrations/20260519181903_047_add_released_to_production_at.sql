/*
  # Add released_to_production_at to activities

  ## Summary
  Adds a timestamp column to track when a manager confirms an activity
  was actually released to production (separate from the planned release date).

  ## Changes
  - `activities.released_to_production_at` (timestamptz, nullable) — set when the
    manager clicks "Confirmar liberación a producción".
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'released_to_production_at'
  ) THEN
    ALTER TABLE activities ADD COLUMN released_to_production_at timestamptz;
  END IF;
END $$;
