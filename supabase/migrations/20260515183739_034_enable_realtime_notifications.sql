/*
  # Enable Realtime for notifications table

  Adds the notifications table to the supabase_realtime publication so that
  INSERT events are broadcast to clients subscribing via postgres_changes.
  Without this, the useNotifications hook never receives live updates.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
