/*
  # Activity Management System - Complete Schema

  1. New Tables
    - `teams`: Equipos de trabajo
    - `activities`: Actividades con prioridad y estado
    - `task_steps`: Pasos de la actividad (BD, código, testeo, etc)
    - `comments`: Comentarios en actividades
    - `activity_revisions`: Revisiones R1, R2, etc
    - `team_members`: Relación usuario-equipo

  2. Security
    - RLS habilitado en todas las tablas
    - Políticas de acceso por equipo
    
  3. Changes
    - Colores por prioridad: HIGH=rojo, MEDIUM=amarillo, LOW=verde
    - Colores por estado: PENDING=rojo, IN_PROGRESS=amarillo, COMPLETED=verde
*/

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now(),
  UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority text DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  status text DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  start_date date,
  end_date date,
  created_by uuid NOT NULL REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS task_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  step_type text NOT NULL CHECK (step_type IN ('DATABASE', 'CODE', 'TESTING')),
  title text NOT NULL,
  description text,
  completed boolean DEFAULT false,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  revision_number integer NOT NULL,
  status text NOT NULL,
  reviewed_by uuid REFERENCES auth.users(id),
  comments text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(activity_id, revision_number)
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams - users can view own teams"
  ON teams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "TeamMembers - users can view team members"
  ON team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Activities - users can view team activities"
  ON activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = activities.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Activities - users can create activities"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = activities.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Activities - users can update activities in their team"
  ON activities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = activities.team_id
      AND team_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = activities.team_id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "TaskSteps - users can view steps"
  ON task_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN team_members tm ON tm.team_id = a.team_id
      WHERE a.id = task_steps.activity_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "TaskSteps - users can manage steps"
  ON task_steps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN team_members tm ON tm.team_id = a.team_id
      WHERE a.id = task_steps.activity_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Comments - users can view comments"
  ON comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN team_members tm ON tm.team_id = a.team_id
      WHERE a.id = comments.activity_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Comments - users can add comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM activities a
      JOIN team_members tm ON tm.team_id = a.team_id
      WHERE a.id = comments.activity_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "ActivityRevisions - users can view revisions"
  ON activity_revisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN team_members tm ON tm.team_id = a.team_id
      WHERE a.id = activity_revisions.activity_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "ActivityRevisions - users can create revisions"
  ON activity_revisions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM activities a
      JOIN team_members tm ON tm.team_id = a.team_id
      WHERE a.id = activity_revisions.activity_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE INDEX idx_activities_team_status ON activities(team_id, status);
CREATE INDEX idx_activities_assigned_to ON activities(assigned_to);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_task_steps_activity ON task_steps(activity_id);
CREATE INDEX idx_comments_activity ON comments(activity_id);
CREATE INDEX idx_revisions_activity ON activity_revisions(activity_id);
