/*
  # Super admin read access for app_roles and team_members

  1. app_roles SELECT: add policy so super_admin can read ALL rows
     (existing policy only allows each user to read their own row)
  2. team_members SELECT: add policy so super_admin can read all members
     across all teams (needed to display manager emails in the admin panel)
*/

-- Allow super_admin to read all app_roles rows
CREATE POLICY "app_roles - super_admin reads all"
  ON app_roles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_roles ar
      WHERE ar.user_id = auth.uid()
        AND ar.role = 'super_admin'
    )
  );

-- Allow team members to read members of their own team (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'team_members'
      AND policyname = 'team_members - members read own team'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "team_members - members read own team"
        ON team_members FOR SELECT
        TO authenticated
        USING (
          team_id IN (
            SELECT tm.team_id FROM team_members tm WHERE tm.user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END $$;

-- Allow super_admin to read ALL team_members
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'team_members'
      AND policyname = 'team_members - super_admin reads all'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "team_members - super_admin reads all"
        ON team_members FOR SELECT
        TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM app_roles ar
            WHERE ar.user_id = auth.uid()
              AND ar.role = 'super_admin'
          )
        )
    $policy$;
  END IF;
END $$;
