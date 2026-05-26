/*
  # Insert Diana Hernandez as team_member for manager personal activities

  Inserts a team_members row for dehernandez@sears.com.mx so that the
  manager can have personal activities tracked in the kanban board.
  Uses ON CONFLICT DO NOTHING to be safe if already exists.
*/

INSERT INTO team_members (team_id, user_id, name, email, position)
VALUES (
  'fc252ce3-9e89-411a-92ba-c7fb6928427e',
  '66a60524-b653-4b21-99a5-a36582c3e93f',
  'Diana Hernandez',
  'dehernandez@sears.com.mx',
  'Gestor'
)
ON CONFLICT DO NOTHING;
