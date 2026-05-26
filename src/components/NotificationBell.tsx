import { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, Zap, RefreshCw, X, Trash2, ClipboardCheck, ThumbsUp, ThumbsDown, Link2, BookOpen, ArrowRight } from 'lucide-react';
import { useNotifications, Notification } from '../lib/useNotifications';

const TYPE_META: Record<string, { label: string; color: string; dot: string; bg: string; icon: React.ReactNode }> = {
  ACTIVITY_CREATED:  { label: 'Nueva actividad',           color: 'text-blue-400',    dot: 'bg-blue-500',    bg: 'border-blue-500/40',    icon: <Zap size={11} /> },
  ACTIVITY_UPDATED:  { label: 'Actividad modificada',      color: 'text-amber-400',   dot: 'bg-amber-500',   bg: 'border-amber-500/40',   icon: <RefreshCw size={11} /> },
  REVIEW_REQUESTED:  { label: 'Solicitud de revisión',     color: 'text-cyan-400',    dot: 'bg-cyan-500',    bg: 'border-cyan-500/40',    icon: <ClipboardCheck size={11} /> },
  ACTIVITY_APPROVED: { label: 'Actividad aprobada',        color: 'text-green-400',   dot: 'bg-green-500',   bg: 'border-green-500/40',   icon: <ThumbsUp size={11} /> },
  ACTIVITY_REJECTED: { label: 'Devuelta para corrección',  color: 'text-red-400',     dot: 'bg-red-500',     bg: 'border-red-500/40',     icon: <ThumbsDown size={11} /> },
  CHANGELOG_LINKED:  { label: 'CDC vinculado',             color: 'text-teal-400',    dot: 'bg-teal-500',    bg: 'border-teal-500/40',    icon: <Link2 size={11} /> },
  DOC_CREATED:       { label: 'Nueva documentación',       color: 'text-emerald-400', dot: 'bg-emerald-500', bg: 'border-emerald-500/40', icon: <BookOpen size={11} /> },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days}d`;
}

interface Toast {
  id: string;
  notification: Notification;
  visible: boolean;
}

export type NotifNavTarget =
  | { section: 'activities'; activityId: string }
  | { section: 'review'; activityId: string }
  | { section: 'changelog' }
  | { section: 'documentation' }
  | { section: 'tab'; tab: string; activityId?: string };

function resolveTarget(n: Notification): NotifNavTarget | null {
  switch (n.type) {
    case 'ACTIVITY_CREATED':
    case 'ACTIVITY_UPDATED':
    case 'ACTIVITY_APPROVED':
    case 'CHANGELOG_LINKED':
      if (n.activity_id) return { section: 'activities', activityId: n.activity_id };
      return { section: 'activities', activityId: '' };
    case 'ACTIVITY_REJECTED':
    case 'REVIEW_REQUESTED':
      if (n.activity_id) return { section: 'review', activityId: n.activity_id };
      return { section: 'review', activityId: '' };
    case 'DOC_CREATED':
      return { section: 'documentation' };
    default:
      return null;
  }
}

interface Props {
  memberId: string;
  onNavigate?: (target: NotifNavTarget) => void;
}

export default function NotificationBell({ memberId, onNavigate }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const handleNew = useCallback((n: Notification) => {
    const toast: Toast = { id: n.id, notification: n, visible: true };
    setToasts(prev => [...prev, toast]);

    // Auto-dismiss after 3.5s (300ms fade-out starts at 3s)
    const t = setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === n.id ? { ...t, visible: false } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== n.id));
      }, 400);
    }, 3000);

    toastTimers.current.set(n.id, t);
  }, []);

  const dismissToast = useCallback((id: string) => {
    const t = toastTimers.current.get(id);
    if (t) { clearTimeout(t); toastTimers.current.delete(id); }
    setToasts(prev => prev.map(t => t.id === id ? { ...t, visible: false } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 400);
  }, []);

  useEffect(() => {
    return () => { toastTimers.current.forEach(t => clearTimeout(t)); };
  }, []);

  const { notifications, unreadCount, markRead, markAllRead, deleteNotification, deleteAll } = useNotifications(memberId, handleNew);
  const [open, setOpen] = useState(false);
  const [animateBell, setAnimateBell] = useState(false);
  const prevUnread = useRef(unreadCount);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (unreadCount > prevUnread.current) {
      setAnimateBell(true);
      setTimeout(() => setAnimateBell(false), 600);
    }
    prevUnread.current = unreadCount;
  }, [unreadCount]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = async (n: Notification) => {
    if (!n.read) await markRead(n.id);
    const target = resolveTarget(n);
    if (target && onNavigate) {
      setOpen(false);
      onNavigate(target);
    }
  };

  return (
    <>
      {/* Toast stack — top right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '340px' }}>
        {toasts.map(toast => {
          const meta = TYPE_META[toast.notification.type] ?? TYPE_META.ACTIVITY_UPDATED;
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 bg-slate-900 border ${meta.bg} rounded-xl shadow-2xl px-4 py-3 transition-all duration-400 ${toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
              style={{ minWidth: '280px' }}
            >
              <div className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${meta.dot}`} />
              <div className="flex-1 min-w-0">
                <div className={`text-xs font-semibold flex items-center gap-1 mb-0.5 ${meta.color}`}>
                  {meta.icon}
                  {meta.label}
                </div>
                <p className="text-sm text-white font-medium leading-snug truncate">{toast.notification.title}</p>
                {toast.notification.body && (
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{toast.notification.body}</p>
                )}
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="shrink-0 text-slate-500 hover:text-white transition mt-0.5"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="relative" ref={panelRef}>
        {/* Bell button */}
        <button
          onClick={() => setOpen(o => !o)}
          className={`relative p-2 rounded-lg transition ${open ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'} ${animateBell ? 'animate-bell' : ''}`}
          aria-label="Notificaciones"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-0.5 leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Panel */}
        {open && (
          <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col max-h-[520px]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-slate-400" />
                <span className="text-sm font-semibold text-white">Notificaciones</span>
                {unreadCount > 0 && (
                  <span className="text-xs bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full leading-none">{unreadCount}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-700 transition"
                    title="Marcar todas como leídas"
                  >
                    <CheckCheck size={13} />
                    Leer todas
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={deleteAll}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded hover:bg-slate-700 transition"
                    title="Eliminar todas"
                  >
                    <Trash2 size={13} />
                    Limpiar
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-white rounded transition">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Bell size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin notificaciones</p>
                </div>
              ) : (
                notifications.map(n => {
                  const meta = TYPE_META[n.type] ?? TYPE_META.ACTIVITY_UPDATED;
                  const target = resolveTarget(n);
                  const isClickable = !!target && !!onNavigate;
                  return (
                    <div
                      key={n.id}
                      className={`group flex items-start gap-3 px-4 py-3 border-b border-slate-800 transition hover:bg-slate-800 ${!n.read ? 'bg-slate-800/60' : ''}`}
                    >
                      <div className="mt-1.5 shrink-0">
                        <span className={`w-2 h-2 rounded-full block ${!n.read ? meta.dot : 'bg-slate-600'}`} />
                      </div>
                      <button
                        onClick={() => handleClick(n)}
                        className={`flex-1 min-w-0 text-left ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className={`text-xs font-semibold flex items-center gap-1 ${meta.color}`}>
                            {meta.icon}
                            {meta.label}
                          </span>
                          {!n.read && <span className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide">Nuevo</span>}
                        </div>
                        <p className={`text-sm leading-snug break-words ${!n.read ? 'text-white font-medium' : 'text-slate-300'}`}>{n.title}</p>
                        {n.body && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>}
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-slate-500">{timeAgo(n.created_at)}</p>
                          {isClickable && (
                            <span className="text-[10px] text-blue-400 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                              Ver <ArrowRight size={10} />
                            </span>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => deleteNotification(n.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 rounded transition mt-0.5"
                        title="Eliminar"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        <style>{`
          @keyframes bell-shake {
            0%,100% { transform: rotate(0deg); }
            15% { transform: rotate(-15deg); }
            30% { transform: rotate(15deg); }
            45% { transform: rotate(-10deg); }
            60% { transform: rotate(10deg); }
            75% { transform: rotate(-5deg); }
            90% { transform: rotate(5deg); }
          }
          .animate-bell { animation: bell-shake 0.6s ease-in-out; }
          .duration-400 { transition-duration: 400ms; }
        `}</style>
      </div>
    </>
  );
}
