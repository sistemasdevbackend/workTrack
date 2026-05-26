/*
  # Add author_name to activity_revisions

  Collaborators don't have auth.users accounts so we store their display name
  directly in the revision row for comment attribution.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_revisions' AND column_name = 'author_name'
  ) THEN
    ALTER TABLE activity_revisions ADD COLUMN author_name text DEFAULT '';
  END IF;
END $$;
