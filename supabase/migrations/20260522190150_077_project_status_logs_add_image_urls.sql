/*
  # Add image_urls to project_status_logs

  Allows managers and collaborators to attach screenshots or evidence images
  when posting or editing project status updates / comments.

  ## Changes
  - `project_status_logs`: new column `image_urls` (text[], default empty array)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_status_logs' AND column_name = 'image_urls'
  ) THEN
    ALTER TABLE project_status_logs ADD COLUMN image_urls text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;
