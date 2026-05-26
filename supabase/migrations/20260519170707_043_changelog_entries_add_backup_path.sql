/*
  # Add backup_path to changelog_entries

  ## Changes
  - Adds `backup_path` (text) column to `changelog_entries`
  - Stores the file/directory path of the backup when release_category is CODIGO
  - Nullable — only relevant for code releases
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'changelog_entries' AND column_name = 'backup_path'
  ) THEN
    ALTER TABLE changelog_entries ADD COLUMN backup_path text DEFAULT '' NOT NULL;
  END IF;
END $$;
