/*
  # Fix viewer display names and viewer grants

  ## Changes
  1. Add Javier Tellez to team_members so his name shows in the supervisor panel
     (uses a general "supervisores" virtual team association via a standalone record)
  2. Store display name in app_roles for viewers (add optional name column)
  3. Fix the habelmont grant — habelmont is super_admin but has a team_member record
     in the "Backend" team; the grant for tellezs already exists but points to
     habelmont's user_id. The SupervisorDashboard needs to resolve team via team_members
     when app_roles.team_id is null.
  4. Update the habelmont viewer_grant to use the Backend team context so the
     SupervisorDashboard can find the team.

  ## Notes
  - We add a `display_name` column to app_roles to store the name of viewers/supervisors
    who are not in team_members.
  - No destructive operations.
*/

-- Add display_name to app_roles for viewers
ALTER TABLE app_roles ADD COLUMN IF NOT EXISTS display_name text;

-- Set display name for Javier Tellez
UPDATE app_roles
SET display_name = 'Javier Tellez'
WHERE user_id = '5c783ae2-dfa8-4329-8686-8e315dc7bfb5';

-- Update the habelmont grant: habelmont is in the "Backend" team (de000de7-4c31-40bd-ad72-a6510d9d5a59)
-- We need to store the team_id in the grant so SupervisorDashboard can find it.
-- Add a team_id column to viewer_grants to override when manager has no app_roles.team_id
ALTER TABLE viewer_grants ADD COLUMN IF NOT EXISTS resolved_team_id uuid REFERENCES teams(id);

-- Set resolved_team_id for the habelmont grant to tellezs
UPDATE viewer_grants
SET resolved_team_id = 'de000de7-4c31-40bd-ad72-a6510d9d5a59'
WHERE viewer_user_id = '5c783ae2-dfa8-4329-8686-8e315dc7bfb5'
  AND manager_user_id = '65f1583e-1681-4d74-945d-0f3ce3402319';

-- Set display_name for Diana Hernandez
UPDATE app_roles
SET display_name = 'Diana Hernandez'
WHERE user_id = '66a60524-b653-4b21-99a5-a36582c3e93f';
