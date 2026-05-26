/*
  # Fix habelmont role: super_admin -> manager assigned to Backend team

  habelmont@sears.com.mx was previously super_admin with no team_id.
  This migration changes their role to manager and assigns them to the Backend team
  so they can access their Kanban board and team features properly.
*/

UPDATE app_roles
SET role = 'manager',
    team_id = 'de000de7-4c31-40bd-ad72-a6510d9d5a59'
WHERE user_id = '65f1583e-1681-4d74-945d-0f3ce3402319';
