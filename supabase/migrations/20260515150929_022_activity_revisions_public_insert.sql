/*
  # Allow public insert on activity_revisions

  Collaborators are unauthenticated in Supabase terms.
  They need to be able to add comments/follow-ups to their own activities.
*/

CREATE POLICY "Public can insert activity revisions"
  ON activity_revisions FOR INSERT
  WITH CHECK (true);
