/*
  # Add doc_entry_id to activities table

  ## Summary
  When an activity is of type DOCUMENTATION, the collaborator must link the
  corresponding documentation entry before the manager reviews it.
  This column stores that reference.

  ## New Column
  - `doc_entry_id` (uuid, nullable, FK → documentation_entries.id):
    The documentation entry associated with this activity.
    Only relevant when activity_type = 'DOCUMENTATION'.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'doc_entry_id'
  ) THEN
    ALTER TABLE activities
      ADD COLUMN doc_entry_id uuid REFERENCES documentation_entries(id) ON DELETE SET NULL;
  END IF;
END $$;
