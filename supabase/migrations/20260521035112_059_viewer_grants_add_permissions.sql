/*
  # Add permission columns to viewer_grants

  ## Changes
  - Adds `can_assign_activities` (boolean, default false) to viewer_grants
    Controls whether a supervisor can assign activities to the manager's team members
  - Adds `can_view_activities` (boolean, default true) to viewer_grants
    Controls whether the supervisor can see the activities section for this manager

  These columns allow super admins to fine-tune per-manager permissions for each supervisor.
*/

ALTER TABLE viewer_grants
  ADD COLUMN IF NOT EXISTS can_view_activities boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_assign_activities boolean NOT NULL DEFAULT false;
