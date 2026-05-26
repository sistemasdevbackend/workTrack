/*
  # Add assignee support to task steps and shared activity flag

  ## Changes
  1. task_steps
     - Add `assigned_member_id` (uuid, nullable) — references team_members(id)
       Allows each step to be assigned to a specific team member (e.g., Ulises handles DB step, Raul handles code step)
     - Add `assigned_member_name` (text, nullable) — denormalized name for fast display

  2. activities
     - Add `shared_with_member_id` (uuid, nullable) — references team_members(id)
       When an activity involves a second person, this stores their team_member_id.
       The activity still belongs to the main `team_member_id` (the creator/owner).
     - Add `shared_with_member_name` (text, nullable) — denormalized name for display
     - Add `created_by_member_id` (uuid, nullable) — when a collaborator creates the activity,
       stores their team_member_id (distinct from the manager created_by user_id)

  ## Notes
  - Steps remain optional-assignee; existing steps without assignee display normally
  - `shared_with_member_id` activities appear in both members' kanban views
  - RLS is not changed — existing policies cover the new columns automatically
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_steps' AND column_name = 'assigned_member_id'
  ) THEN
    ALTER TABLE task_steps ADD COLUMN assigned_member_id uuid REFERENCES team_members(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'task_steps' AND column_name = 'assigned_member_name'
  ) THEN
    ALTER TABLE task_steps ADD COLUMN assigned_member_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'shared_with_member_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN shared_with_member_id uuid REFERENCES team_members(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'shared_with_member_name'
  ) THEN
    ALTER TABLE activities ADD COLUMN shared_with_member_name text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activities' AND column_name = 'created_by_member_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN created_by_member_id uuid REFERENCES team_members(id) ON DELETE SET NULL;
  END IF;
END $$;
