/*
  # Viewer role and grant tables

  ## Overview
  Introduces a "viewer" role: authenticated users who can read project status logs
  from specific managers without being managers themselves.

  ## Changes

  ### 1. app_roles: allow 'viewer' as a valid role
  The existing CHECK constraint only allowed 'super_admin' | 'manager'.
  We drop and recreate it to include 'viewer'.

  ### 2. New table: viewer_grants
  Controls which managers' project data a viewer (or another manager) can see.

  Columns:
  - id (uuid PK)
  - viewer_user_id (uuid) — the user who is granted read access
  - manager_user_id (uuid) — the manager whose project data is shared
  - granted_by (uuid) — super_admin who created this grant
  - created_at (timestamptz)
  - UNIQUE(viewer_user_id, manager_user_id) — no duplicate grants

  ## Security
  - RLS enabled on viewer_grants
  - Super admins can manage all grants
  - Viewers/managers can only read their own grants
*/

-- 1. Update the role CHECK constraint to allow 'viewer'
ALTER TABLE app_roles DROP CONSTRAINT IF EXISTS app_roles_role_check;
ALTER TABLE app_roles ADD CONSTRAINT app_roles_role_check
  CHECK (role IN ('super_admin', 'manager', 'viewer'));

-- 2. Create viewer_grants table
CREATE TABLE IF NOT EXISTS viewer_grants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  UNIQUE (viewer_user_id, manager_user_id)
);

ALTER TABLE viewer_grants ENABLE ROW LEVEL SECURITY;

-- Super admin can do everything
CREATE POLICY "Super admin can manage viewer grants"
  ON viewer_grants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_roles
      WHERE app_roles.user_id = auth.uid()
        AND app_roles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admin can insert viewer grants"
  ON viewer_grants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_roles
      WHERE app_roles.user_id = auth.uid()
        AND app_roles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admin can delete viewer grants"
  ON viewer_grants FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_roles
      WHERE app_roles.user_id = auth.uid()
        AND app_roles.role = 'super_admin'
    )
  );

-- Viewers and cross-managers can read their own grants
CREATE POLICY "User can read own viewer grants"
  ON viewer_grants FOR SELECT
  TO authenticated
  USING (auth.uid() = viewer_user_id);
