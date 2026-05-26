/*
  # Add versioning support to documentation_entries

  ## Summary
  Adds a parent_id column to documentation_entries so that multiple versions of
  the same document can be linked together. The "root" document (original entry)
  has parent_id = NULL. All subsequent versions point to the root via parent_id.

  Also adds a change_description column to record what changed in each version.

  ## Changes
  - `documentation_entries`: Add `parent_id` (uuid, nullable, FK to self)
  - `documentation_entries`: Add `change_description` (text, default '')

  ## Notes
  - parent_id = NULL means this is the canonical/root document
  - All child versions share the same parent_id (pointing to root)
  - The UI groups entries by parent_id and shows version history as a timeline
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documentation_entries' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE documentation_entries
      ADD COLUMN parent_id uuid REFERENCES documentation_entries(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documentation_entries' AND column_name = 'change_description'
  ) THEN
    ALTER TABLE documentation_entries
      ADD COLUMN change_description text NOT NULL DEFAULT '';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS documentation_entries_parent_id_idx ON documentation_entries(parent_id);
