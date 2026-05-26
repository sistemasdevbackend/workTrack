/*
  # Set REPLICA IDENTITY FULL on activities table

  Supabase Realtime filters (e.g. team_id=eq.X) only work reliably when the
  table has REPLICA IDENTITY FULL, which includes all column values in the
  WAL record for UPDATE and DELETE events.

  Without this, filtering by non-PK columns in .on('postgres_changes', { filter })
  may silently fail and the subscriber never receives the event.
*/
ALTER TABLE activities REPLICA IDENTITY FULL;
