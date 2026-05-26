/*
  # Add DELETE policy to notifications table

  Allows any user to delete notifications by team_member_id (same pattern as SELECT/UPDATE).
  This enables both managers and collaborators to delete their own notifications.
*/

CREATE POLICY "Anyone can delete own notifications"
  ON notifications
  FOR DELETE
  USING (true);
