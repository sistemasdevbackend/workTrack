/*
  # Fix infinite recursion between viewer_grants and app_roles policies

  ## Problem
  - viewer_grants SELECT/INSERT/DELETE policies used: EXISTS (SELECT 1 FROM app_roles WHERE role = 'super_admin')
  - app_roles SELECT policy "Viewer can read app_roles of granted managers" queried viewer_grants
  - This created mutual recursion: app_roles → viewer_grants → app_roles → ...
  - Result: 500 errors on ALL queries for authenticated users

  ## Fix
  - Replace direct app_roles subqueries in viewer_grants policies with is_super_admin()
  - is_super_admin() is SECURITY DEFINER so it bypasses RLS and breaks the recursion
*/

DROP POLICY IF EXISTS "Super admin can manage viewer grants" ON viewer_grants;
DROP POLICY IF EXISTS "Super admin can insert viewer grants" ON viewer_grants;
DROP POLICY IF EXISTS "Super admin can delete viewer grants" ON viewer_grants;

CREATE POLICY "Super admin can read viewer grants"
  ON viewer_grants FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admin can insert viewer grants"
  ON viewer_grants FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admin can delete viewer grants"
  ON viewer_grants FOR DELETE
  TO authenticated
  USING (is_super_admin());
