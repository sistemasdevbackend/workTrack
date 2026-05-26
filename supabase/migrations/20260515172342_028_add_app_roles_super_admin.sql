/*
  # App Roles - Super Admin System

  1. New Tables
    - `app_roles`: System-wide roles per user (super_admin, manager)
      - `user_id` FK to auth.users
      - `role` text: 'super_admin' | 'manager'
      - `team_id` nullable FK to teams (managers are assigned to a team)
      - `created_by` FK to auth.users (who created this role)
      - `created_at` timestamp

  2. Changes
    - Insert habelmont@sears.com.mx as super_admin
    - RLS: only super_admin can manage app_roles
    - managers can only read their own row to know their team

  3. Notes
    - super_admin sees all teams, creates managers, assigns teams
    - manager sees only their assigned team
    - collaborators remain as team_members without auth
*/

CREATE TABLE IF NOT EXISTS app_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin', 'manager')),
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;

-- Super admin can do everything on app_roles
CREATE POLICY "app_roles - super_admin full access"
  ON app_roles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM app_roles ar
      WHERE ar.user_id = auth.uid() AND ar.role = 'super_admin'
    )
  );

CREATE POLICY "app_roles - super_admin insert"
  ON app_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_roles ar
      WHERE ar.user_id = auth.uid() AND ar.role = 'super_admin'
    )
  );

CREATE POLICY "app_roles - super_admin update"
  ON app_roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_roles ar
      WHERE ar.user_id = auth.uid() AND ar.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app_roles ar
      WHERE ar.user_id = auth.uid() AND ar.role = 'super_admin'
    )
  );

CREATE POLICY "app_roles - super_admin delete"
  ON app_roles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_roles ar
      WHERE ar.user_id = auth.uid() AND ar.role = 'super_admin'
    )
  );

-- Insert habelmont as super_admin
INSERT INTO app_roles (user_id, role)
VALUES ('65f1583e-1681-4d74-945d-0f3ce3402319', 'super_admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
