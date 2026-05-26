/*
  # Seed team_projects from existing activity data

  Populates team_projects with all distinct project names already used in activities,
  changelog_projects, and doc_entries so the Projects section shows real data immediately.
  Uses INSERT ... ON CONFLICT DO NOTHING so re-running is safe.
*/

INSERT INTO team_projects (team_id, name)
SELECT DISTINCT team_id, trim(project)
FROM activities
WHERE project IS NOT NULL AND trim(project) != ''
ON CONFLICT (team_id, name) DO NOTHING;

-- Also pull project names from changelog_projects (they already exist as named projects)
INSERT INTO team_projects (team_id, name)
SELECT DISTINCT cp.team_id, trim(cp.name)
FROM changelog_projects cp
ON CONFLICT (team_id, name) DO NOTHING;
