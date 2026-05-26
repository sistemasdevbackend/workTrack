/*
  # Restore habelmont as super_admin with Backend team assigned

  habelmont@sears.com.mx needs to function as BOTH super_admin (access to admin panel)
  AND manager (access to Backend team kanban). The app_roles row must have:
    - role = 'super_admin'
    - team_id = Backend team UUID

  When App.tsx detects super_admin, it shows SuperAdminDashboard which has an embedded
  manager dashboard. The team_id is used by Dashboard.tsx to load the correct kanban.

  Also ensure dehernandez and romoal keep their correct manager + team assignments.
*/

-- Restore habelmont to super_admin with Backend team
UPDATE app_roles
SET role = 'super_admin',
    team_id = 'de000de7-4c31-40bd-ad72-a6510d9d5a59'
WHERE user_id = '65f1583e-1681-4d74-945d-0f3ce3402319';

-- Ensure dehernandez stays as manager with Gerencia_Credito_Backend
UPDATE app_roles
SET role = 'manager',
    team_id = 'fc252ce3-9e89-411a-92ba-c7fb6928427e'
WHERE user_id = '66a60524-b653-4b21-99a5-a36582c3e93f';

-- Ensure romoal stays as manager with Apis_Teleproceso
UPDATE app_roles
SET role = 'manager',
    team_id = '8ff7fd2c-9542-4129-b5e4-d9f8c0fdb5e0'
WHERE user_id = '680c7da9-a2fa-42b2-8bcb-6723919e0ca6';
