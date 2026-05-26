/*
  # Add doc_urls column to activity_revisions

  Allows collaborators and managers to attach documents (PDF, Word, Excel, etc.)
  to activity comments/revisions, stored as an array of public URLs.

  ## Changes
  - `activity_revisions`: new column `doc_urls` (text array, default empty)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_revisions' AND column_name = 'doc_urls'
  ) THEN
    ALTER TABLE activity_revisions ADD COLUMN doc_urls text[] DEFAULT '{}';
  END IF;
END $$;
