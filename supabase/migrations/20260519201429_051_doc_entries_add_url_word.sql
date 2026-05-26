/*
  # Add url_word column to documentation_entries

  Adds a second URL field for the editable Word document, alongside the existing
  url field which stores the PDF/published version.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documentation_entries' AND column_name = 'url_word'
  ) THEN
    ALTER TABLE documentation_entries ADD COLUMN url_word text NOT NULL DEFAULT '';
  END IF;
END $$;
