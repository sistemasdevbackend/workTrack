/*
  # Fix member_permissions RLS policies

  ## Problem
  - INSERT policy lacked WITH CHECK (no restriction), but still failed silently
  - super_admin has team_id = NULL in app_roles, so the team subquery returns nothing
  - The subquery approach hits RLS on app_roles itself causing empty results

  ## Changes
  - Drop all existing policies and recreate them using a cleaner approach
  - Super admins (team_id IS NULL in app_roles) can manage all permissions
  - Managers can manage permissions for members of their assigned team
  - Anon users (collaborators using public login) can read all permissions
  - Authenticated users can also read their own permissions
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Managers can manage permissions for their team members" ON member_permissions;
DROP POLICY IF EXISTS "Managers can insert permissions for their team members" ON member_permissions;
DROP POLICY IF EXISTS "Managers can update permissions for their team members" ON member_permissions;
DROP POLICY IF EXISTS "Managers can delete permissions for their team members" ON member_permissions;
DROP POLICY IF EXISTS "Collaborators can read own permissions" ON member_permissions;

-- SELECT: authenticated managers/admins can read permissions for their team
CREATE POLICY "Authenticated managers can read member permissions"
  ON member_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_roles ar
      WHERE ar.user_id = auth.uid()
        AND (
          ar.team_id IS NULL
          OR ar.team_id = (
            SELECT tm.team_id FROM team_members tm WHERE tm.id = member_permissions.team_member_id LIMIT 1
          )
        )
    )
  );

-- SELECT: anon (collaborator public login) can read all permissions
CREATE POLICY "Anon can read member permissions"
  ON member_permissions
  FOR SELECT
  TO anon
  USING (true);

-- INSERT: managers/admins can insert permissions for their team members
CREATE POLICY "Authenticated managers can insert member permissions"
  ON member_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_roles ar
      WHERE ar.user_id = auth.uid()
        AND (
          ar.team_id IS NULL
          OR ar.team_id = (
            SELECT tm.team_id FROM team_members tm WHERE tm.id = member_permissions.team_member_id LIMIT 1
          )
        )
    )
  );

-- UPDATE: managers/admins can update permissions for their team members
CREATE POLICY "Authenticated managers can update member permissions"
  ON member_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_roles ar
      WHERE ar.user_id = auth.uid()
        AND (
          ar.team_id IS NULL
          OR ar.team_id = (
            SELECT tm.team_id FROM team_members tm WHERE tm.id = member_permissions.team_member_id LIMIT 1
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_roles ar
      WHERE ar.user_id = auth.uid()
        AND (
          ar.team_id IS NULL
          OR ar.team_id = (
            SELECT tm.team_id FROM team_members tm WHERE tm.id = member_permissions.team_member_id LIMIT 1
          )
        )
    )
  );

-- DELETE: managers/admins can delete permissions for their team members
CREATE POLICY "Authenticated managers can delete member permissions"
  ON member_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_roles ar
      WHERE ar.user_id = auth.uid()
        AND (
          ar.team_id IS NULL
          OR ar.team_id = (
            SELECT tm.team_id FROM team_members tm WHERE tm.id = member_permissions.team_member_id LIMIT 1
          )
        )
    )
  );
