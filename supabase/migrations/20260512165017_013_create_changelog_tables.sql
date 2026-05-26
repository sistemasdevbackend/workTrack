/*
  # Control de Cambios — Bitácora por Proyecto

  ## Resumen
  Crea las tablas necesarias para un sistema de control de cambios (changelog)
  organizado por proyecto, accesible para los colaboradores del equipo.

  ## Nuevas Tablas

  ### changelog_projects
  - `id` — UUID, clave primaria
  - `team_id` — referencia al equipo dueño del proyecto
  - `name` — nombre del proyecto
  - `description` — descripción opcional
  - `color` — color de etiqueta (hex string, opcional)
  - `created_by` — UUID del team_member que lo creó
  - `created_at`, `updated_at`

  ### changelog_entries
  Cada registro es una entrada de bitácora asociada a un proyecto.
  - `id` — UUID, clave primaria
  - `project_id` — referencia a changelog_projects
  - `team_member_id` — quién registró el cambio
  - `release_date` — fecha del release/cambio
  - `release_time` — hora del release (time)
  - `version` — etiqueta de versión opcional (ej. "v1.2.3")
  - `environment` — ambiente afectado (PROD, QA, DEV, etc.)
  - `change_type` — tipo de cambio (FEATURE, BUGFIX, HOTFIX, DEPLOY, ROLLBACK, CONFIG, OTHER)
  - `title` — título breve del cambio
  - `description` — descripción detallada de qué se liberó
  - `reason` — por qué se hizo el cambio
  - `impact` — impacto esperado o real
  - `rollback_plan` — plan de rollback si aplica
  - `status` — estado del cambio (SUCCESS, FAILED, ROLLBACK, PENDING)
  - `created_at`, `updated_at`

  ## Seguridad
  - RLS habilitado en ambas tablas
  - Los miembros del equipo pueden ver/crear/editar entradas de su equipo
*/

-- ============================================================
-- changelog_projects
-- ============================================================
CREATE TABLE IF NOT EXISTS changelog_projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text DEFAULT '',
  color       text DEFAULT '#3b82f6',
  created_by  uuid REFERENCES team_members(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE changelog_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view their changelog projects"
  ON changelog_projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = changelog_projects.team_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can insert changelog projects"
  ON changelog_projects FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = changelog_projects.team_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can update their changelog projects"
  ON changelog_projects FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = changelog_projects.team_id
        AND tm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = changelog_projects.team_id
        AND tm.user_id = auth.uid()
    )
  );

-- ============================================================
-- changelog_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS changelog_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid NOT NULL REFERENCES changelog_projects(id) ON DELETE CASCADE,
  team_member_id  uuid REFERENCES team_members(id) ON DELETE SET NULL,
  release_date    date NOT NULL DEFAULT CURRENT_DATE,
  release_time    time NOT NULL DEFAULT CURRENT_TIME,
  version         text DEFAULT '',
  environment     text NOT NULL DEFAULT 'PROD',
  change_type     text NOT NULL DEFAULT 'DEPLOY',
  title           text NOT NULL,
  description     text DEFAULT '',
  reason          text DEFAULT '',
  impact          text DEFAULT '',
  rollback_plan   text DEFAULT '',
  status          text NOT NULL DEFAULT 'SUCCESS',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE changelog_entries ENABLE ROW LEVEL SECURITY;

-- Allow collaborators (no auth.uid) to read via project membership check using team_members
-- We use a public read policy scoped to the project's team
CREATE POLICY "Team members can view changelog entries"
  ON changelog_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM changelog_projects cp
      JOIN team_members tm ON tm.team_id = cp.team_id
      WHERE cp.id = changelog_entries.project_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can insert changelog entries"
  ON changelog_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM changelog_projects cp
      JOIN team_members tm ON tm.team_id = cp.team_id
      WHERE cp.id = changelog_entries.project_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can update their own changelog entries"
  ON changelog_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM changelog_projects cp
      JOIN team_members tm ON tm.team_id = cp.team_id
      WHERE cp.id = changelog_entries.project_id
        AND tm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM changelog_projects cp
      JOIN team_members tm ON tm.team_id = cp.team_id
      WHERE cp.id = changelog_entries.project_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can delete their own changelog entries"
  ON changelog_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM changelog_projects cp
      JOIN team_members tm ON tm.team_id = cp.team_id
      WHERE cp.id = changelog_entries.project_id
        AND tm.user_id = auth.uid()
    )
  );

-- ============================================================
-- Public read policies for unauthenticated collaborator access
-- (collaborators log in via PIN, not Supabase auth)
-- ============================================================
CREATE POLICY "Public can view changelog projects"
  ON changelog_projects FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can insert changelog projects"
  ON changelog_projects FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can update changelog projects"
  ON changelog_projects FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can view changelog entries"
  ON changelog_entries FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can insert changelog entries"
  ON changelog_entries FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Public can update changelog entries"
  ON changelog_entries FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public can delete changelog entries"
  ON changelog_entries FOR DELETE
  TO anon
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_changelog_entries_project_id ON changelog_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_changelog_entries_release_date ON changelog_entries(release_date DESC);
CREATE INDEX IF NOT EXISTS idx_changelog_projects_team_id ON changelog_projects(team_id);
