/*
  # Fix super_admin policies to avoid RLS recursion

  Use a SECURITY DEFINER function to check super_admin role without
  triggering RLS on app_roles (which would cause infinite recursion).
*/

-- Helper function: checks if current user is super_admin bypassing RLS
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
  );
$$;

-- Replace recursive policies with ones using the helper function
DROP POLICY IF EXISTS "app_roles - super_admin reads all" ON app_roles;
DROP POLICY IF EXISTS "app_roles - super_admin delete" ON app_roles;
DROP POLICY IF EXISTS "app_roles - super_admin insert" ON app_roles;
DROP POLICY IF EXISTS "app_roles - super_admin update" ON app_roles;

CREATE POLICY "app_roles - super_admin reads all"
  ON app_roles FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "app_roles - super_admin insert"
  ON app_roles FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "app_roles - super_admin update"
  ON app_roles FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "app_roles - super_admin delete"
  ON app_roles FOR DELETE
  TO authenticated
  USING (is_super_admin());

-- Also fix team_members super_admin policy
DROP POLICY IF EXISTS "team_members - super_admin reads all" ON team_members;

CREATE POLICY "team_members - super_admin reads all"
  ON team_members FOR SELECT
  TO authenticated
  USING (is_super_admin());
