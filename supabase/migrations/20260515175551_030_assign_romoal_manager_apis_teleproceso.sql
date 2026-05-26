/*
  # Assign romoal@sanborns.com.mx as manager of Apis_Teleproceso

  - Inserts app_roles row with role=manager and team_id=Apis_Teleproceso
  - Inserts team_members row so the manager appears in the team roster
*/

INSERT INTO app_roles (user_id, role, team_id, created_by)
VALUES (
  '680c7da9-a2fa-42b2-8bcb-6723919e0ca6',
  'manager',
  '8ff7fd2c-9542-4129-b5e4-d9f8c0fdb5e0',
  '65f1583e-1681-4d74-945d-0f3ce3402319'
)
ON CONFLICT DO NOTHING;

INSERT INTO team_members (team_id, user_id, email, name, position, role)
VALUES (
  '8ff7fd2c-9542-4129-b5e4-d9f8c0fdb5e0',
  '680c7da9-a2fa-42b2-8bcb-6723919e0ca6',
  'romoal@sanborns.com.mx',
  'romoal',
  'Gestor',
  'admin'
)
ON CONFLICT DO NOTHING;
