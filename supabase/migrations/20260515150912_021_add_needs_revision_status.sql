/*
  # Add NEEDS_REVISION status to activities

  ## Summary
  When a manager rejects a review, the activity returns to the collaborator
  with status NEEDS_REVISION so it appears as a distinct alert in their kanban,
  separate from normal PENDING/IN_PROGRESS activities.

  ## Changes
  - Extend activities.status CHECK constraint to include 'NEEDS_REVISION'
  - Also allow collaborator comments in activity_revisions (already public-insertable via existing policies)
*/

ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_status_check;
ALTER TABLE activities ADD CONSTRAINT activities_status_check
  CHECK (status IN ('PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'APPROVED', 'NEEDS_REVISION'));
