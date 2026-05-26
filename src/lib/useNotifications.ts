import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';

export interface Notification {
  id: string;
  team_member_id: string;
  activity_id: string | null;
  type: 'ACTIVITY_CREATED' | 'ACTIVITY_UPDATED' | 'REVIEW_REQUESTED' | 'ACTIVITY_APPROVED' | 'ACTIVITY_REJECTED' | 'CHANGELOG_LINKED' | 'DOC_CREATED';
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export function useNotifications(memberId: string, onNew?: (n: Notification) => void) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [disabledTypes, setDisabledTypes] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const onNewRef = useRef(onNew);
  const latestIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  onNewRef.current = onNew;

  // disabledTypes: Set of notif types globally disabled for this member
  // blockedSources: Set of source_member_ids whose notifications are muted
  const [blockedSources, setBlockedSources] = useState<Set<string>>(new Set());

  const isFiltered = (n: Notification & { source_member_id?: string | null }): boolean => {
    if (disabledTypes.has(n.type)) return true;
    if (n.source_member_id && blockedSources.has(n.source_member_id)) return true;
    return false;
  };

  const loadPrefs = useCallback(async () => {
    if (!memberId) return { disabled: new Set<string>(), blocked: new Set<string>() };
    const { data } = await supabase
      .from('notification_preferences')
      .select('notif_type, source_member_id, enabled')
      .eq('team_member_id', memberId);

    const disabled = new Set<string>();
    const blocked = new Set<string>();

    (data ?? []).forEach((r: any) => {
      if (!r.source_member_id && !r.enabled) {
        disabled.add(r.notif_type);
      } else if (r.source_member_id && r.notif_type === 'ALL_TYPES' && !r.enabled) {
        blocked.add(r.source_member_id);
      }
    });

    setDisabledTypes(disabled);
    setBlockedSources(blocked);
    return { disabled, blocked };
  }, [memberId]);

  const load = useCallback(async () => {
    if (!memberId) return;
    const { disabled, blocked } = await loadPrefs() ?? { disabled: new Set<string>(), blocked: new Set<string>() };
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('team_member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!data) return;
    const filtered = (data as Array<Notification & { source_member_id?: string | null }>).filter(n => {
      if (disabled.has(n.type)) return false;
      if (n.source_member_id && blocked.has(n.source_member_id)) return false;
      return true;
    });
    setNotifications(filtered);
    if (filtered.length > 0) latestIdRef.current = filtered[0].id;
  }, [memberId, loadPrefs]);

  const markRead = useCallback(async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!memberId) return;
    await supabase.from('notifications').update({ read: true }).eq('team_member_id', memberId).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, [memberId]);

  const deleteNotification = useCallback(async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const deleteAll = useCallback(async () => {
    if (!memberId) return;
    await supabase.from('notifications').delete().eq('team_member_id', memberId);
    setNotifications([]);
  }, [memberId]);

  // Poll for new notifications — reliable fallback for anonymous users
  const poll = useCallback(async () => {
    if (!memberId) return;

    // Fetch only rows newer than the most recent known notification
    let sinceTimestamp: string | null = null;
    if (latestIdRef.current) {
      const { data: row } = await supabase
        .from('notifications')
        .select('created_at')
        .eq('id', latestIdRef.current)
        .maybeSingle();
      sinceTimestamp = row?.created_at ?? null;
    }

    let q = supabase
      .from('notifications')
      .select('*')
      .eq('team_member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (sinceTimestamp) q = q.gt('created_at', sinceTimestamp);

    const { data } = await q;
    if (!data || data.length === 0) return;

    setNotifications(prev => {
      const existingIds = new Set(prev.map(n => n.id));
      const fresh = (data as Array<Notification & { source_member_id?: string | null }>)
        .filter(n => !existingIds.has(n.id) && !isFiltered(n));
      if (fresh.length === 0) return prev;
      fresh.forEach(n => onNewRef.current?.(n as Notification));
      latestIdRef.current = fresh[0].id;
      return [...fresh as Notification[], ...prev].slice(0, 50);
    });
  }, [memberId]);

  useEffect(() => {
    if (!memberId) return;
    load();

    // Try realtime first (works when user has an active auth session)
    const channel = supabase
      .channel(`notifications-${memberId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `team_member_id=eq.${memberId}` },
        (payload) => {
          const n = payload.new as Notification & { source_member_id?: string | null };
          if (isFiltered(n)) return;
          setNotifications(prev => {
            if (prev.some(x => x.id === n.id)) return prev;
            onNewRef.current?.(n as Notification);
            latestIdRef.current = n.id;
            return [n as Notification, ...prev].slice(0, 50);
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Also poll every 5 seconds as a reliable fallback for anonymous users
    pollTimerRef.current = setInterval(poll, 5000);

    return () => {
      channel.unsubscribe();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [memberId, load, poll]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount, markRead, markAllRead, deleteNotification, deleteAll, reload: load };
}
