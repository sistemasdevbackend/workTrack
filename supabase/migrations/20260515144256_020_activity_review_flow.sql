/*
  # Activity Review Flow

  ## Summary
  Adds support for a full review cycle between collaborators and managers:
  - Collaborators submit activities for review (IN_REVIEW status)
  - Managers approve or reject, with feedback
  - Approved activities can request a changelog entry linked to the activity

  ## Changes

  ### 1. activities table
  - Extend status CHECK to include 'IN_REVIEW' and 'APPROVED'
  - Add `review_note` (text) — manager's feedback when reviewing
  - Add `review_requested_at` (timestamptz) — when collaborator sent to review
  - Add `reviewed_at` (timestamptz) — when manager reviewed
  - Add `changelog_requested` (boolean) — whether manager requested a changelog entry

  ### 2. New table: activity_changelog_links
  - Links an activity to a changelog_entry once the collaborator creates it
  - `id` (uuid, pk)
  - `activity_id` (uuid, FK activities)
  - `changelog_entry_id` (uuid, FK changelog_entries)
  - `created_at` (timestamptz)

  ### 3. notifications table
  - Add `type` values: REVIEW_REQUESTED, ACTIVITY_APPROVED, ACTIVITY_REJECTED, CHANGELOG_REQUESTED
  - No schema change needed — type is free text

  ## Security
  - RLS on activity_changelog_links: authenticated + public read/insert
*/

-- 1. Drop the old CHECK constraint on activities.status and recreate with new values
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_status_check;
ALTER TABLE activities ADD CONSTRAINT activities_status_check
  CHECK (status IN ('PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'APPROVED'));

-- 2. Add review columns to activities
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='review_note') THEN
    ALTER TABLE activities ADD COLUMN review_note text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='review_requested_at') THEN
    ALTER TABLE activities ADD COLUMN review_requested_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='reviewed_at') THEN
    ALTER TABLE activities ADD COLUMN reviewed_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='activities' AND column_name='changelog_requested') THEN
    ALTER TABLE activities ADD COLUMN changelog_requested boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- 3. Create activity_changelog_links table
CREATE TABLE IF NOT EXISTS activity_changelog_links (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id         uuid        NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  changelog_entry_id  uuid        NOT NULL REFERENCES changelog_entries(id) ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, changelog_entry_id)
);

CREATE INDEX IF NOT EXISTS acl_activity_idx ON activity_changelog_links (activity_id);
CREATE INDEX IF NOT EXISTS acl_entry_idx    ON activity_changelog_links (changelog_entry_id);

ALTER TABLE activity_changelog_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read activity changelog links"
  ON activity_changelog_links FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert activity changelog links"
  ON activity_changelog_links FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete activity changelog links"
  ON activity_changelog_links FOR DELETE
  TO authenticated
  USING (true);

-- 4. Allow public UPDATE on activities so collaborators can set IN_REVIEW
--    (collaborators are unauthenticated in Supabase terms)
CREATE POLICY "Public can update activity status for review"
  ON activities FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 5. Allow public INSERT on notifications so collaborators can create them
CREATE POLICY "Public can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);
