/*
  # Fix app_roles RLS recursion

  The SELECT policy was doing a subquery to app_roles to check if the user
  is super_admin, causing infinite recursion. Fix: allow each user to always
  read their own row (no subquery needed for that check).
*/

DROP POLICY IF EXISTS "app_roles - super_admin full access" ON app_roles;

-- Each user can read their own row (no recursion)
CREATE POLICY "app_roles - user reads own row"
  ON app_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
