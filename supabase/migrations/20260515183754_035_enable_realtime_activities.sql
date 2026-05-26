/*
  # Enable Realtime for activities table

  Adds the activities table to the supabase_realtime publication so that
  INSERT/UPDATE/DELETE events can be received by clients in real time,
  allowing the Kanban board and collaborator views to refresh automatically
  without a full page reload.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE activities;
