/*
  # Make assigned_to and created_by nullable in activities

  These columns were required for manager-created activities but collaborator-created
  shared activities don't have an auth user — they're created by team_members.
  Making them nullable allows both flows without breaking existing data.
*/

ALTER TABLE activities ALTER COLUMN assigned_to DROP NOT NULL;
ALTER TABLE activities ALTER COLUMN created_by DROP NOT NULL;
