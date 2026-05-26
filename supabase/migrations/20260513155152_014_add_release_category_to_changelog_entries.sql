/*
  # Add release_category to changelog_entries

  ## Changes
  - Adds `release_category` column to `changelog_entries`
    - Values: 'CODIGO' | 'BASE_DE_DATOS' | 'MIXTO' | 'OTRO'
    - Default: 'CODIGO'
  - This allows filtering entries by whether the release was a code change,
    a database change, both, or other.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'changelog_entries' AND column_name = 'release_category'
  ) THEN
    ALTER TABLE changelog_entries ADD COLUMN release_category text NOT NULL DEFAULT 'CODIGO';
  END IF;
END $$;
