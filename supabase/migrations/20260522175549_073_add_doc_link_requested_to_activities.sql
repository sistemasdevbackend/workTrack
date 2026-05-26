/*
  # Add doc_link_requested column to activities

  ## Summary
  When a manager approves a DOCUMENTATION-type activity, they can request
  the collaborator to link the associated documentation entry.
  This column tracks that request (parallel to changelog_requested for code activities).

  ## New Column
  - `doc_link_requested` (boolean, default false): Manager requested the collaborator
    to associate a documentation entry with this activity.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'doc_link_requested'
  ) THEN
    ALTER TABLE activities ADD COLUMN doc_link_requested boolean DEFAULT false;
  END IF;
END $$;
