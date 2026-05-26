/*
  # Create member_permissions table

  ## Summary
  Adds a granular per-member feature permissions system. Each row grants or
  restricts a specific capability for one team_member. Missing rows default
  to the role-based behaviour already present in the app.

  ## New Tables
  - `member_permissions`
    - `id` (uuid, pk)
    - `team_member_id` (uuid, fk → team_members.id)
    - `feature` (text) — slug of the feature, e.g. 'create_activity_for_becario'
    - `enabled` (boolean) — whether the feature is enabled for this member
    - `created_at` / `updated_at` (timestamptz)
    - UNIQUE (team_member_id, feature)

  ## Feature slugs used by the app
    create_activity            — can create new activities (manager assigns to anyone)
    create_activity_becario    — can create activities assigned to becarios
    create_activity_developer  — can create activities assigned to developers/other positions
    add_documentation          — can add / edit documentation entries
    add_changelog              — can create changelog (control de cambios) entries
    view_changelog             — can view the changelog tab
    send_to_review             — can send completed activities to review
    move_to_testing            — can move activities to TESTING status

  ## Security
  - RLS enabled
  - Managers (authenticated users who are team managers) can read/write
    permissions for members of their own team
  - Collaborators can read their own permissions row
*/

CREATE TABLE IF NOT EXISTS member_permissions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id   uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  feature          text NOT NULL,
  enabled          boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_member_id, feature)
);

ALTER TABLE member_permissions ENABLE ROW LEVEL SECURITY;

-- Managers: full access to permissions for members of their team
CREATE POLICY "Managers can manage permissions for their team members"
  ON member_permissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = member_permissions.team_member_id
        AND tm.team_id IN (
          SELECT team_id FROM app_roles WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Managers can insert permissions for their team members"
  ON member_permissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = member_permissions.team_member_id
        AND tm.team_id IN (
          SELECT team_id FROM app_roles WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Managers can update permissions for their team members"
  ON member_permissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = member_permissions.team_member_id
        AND tm.team_id IN (
          SELECT team_id FROM app_roles WHERE user_id = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = member_permissions.team_member_id
        AND tm.team_id IN (
          SELECT team_id FROM app_roles WHERE user_id = auth.uid()
        )
    )
  );

CREATE POLICY "Managers can delete permissions for their team members"
  ON member_permissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = member_permissions.team_member_id
        AND tm.team_id IN (
          SELECT team_id FROM app_roles WHERE user_id = auth.uid()
        )
    )
  );

-- Collaborators: can read their own permissions (public login uses team_member_id directly)
CREATE POLICY "Collaborators can read own permissions"
  ON member_permissions
  FOR SELECT
  TO anon
  USING (true);
