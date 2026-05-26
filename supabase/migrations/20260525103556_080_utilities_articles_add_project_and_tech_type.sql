/*
  # Add project_name and tech_type to utilities_articles

  Adds two new fields so each utility article can be associated with a specific
  project and classified by technology type.

  ## Changes
  - `utilities_articles`:
    - `project_name` (text, default '') — linked project name from team_projects
    - `tech_type` (text, default '') — technology: CODIGO | BASE_DE_DATOS | INFRAESTRUCTURA | OTRO
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'utilities_articles' AND column_name = 'project_name'
  ) THEN
    ALTER TABLE utilities_articles ADD COLUMN project_name text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'utilities_articles' AND column_name = 'tech_type'
  ) THEN
    ALTER TABLE utilities_articles ADD COLUMN tech_type text NOT NULL DEFAULT '';
  END IF;
END $$;
