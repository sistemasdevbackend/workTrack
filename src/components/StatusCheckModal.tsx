import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, AlertTriangle, CheckCircle2, ChevronRight, X, Send, ShieldAlert } from 'lucide-react';

export interface ActivityForCheck {
  id: string;
  title: string;
  status: string;
  end_date: string | null;
  priority: string;
  project?: string | null;
}

interface Props {
  activities: ActivityForCheck[];
  memberId: string;
  memberName: string;
  teamId: string;
  onClose: () => void;
  onActivityCompleted: () => void;
}

type CheckMode = 'overdue' | 'due_today' | 'due_soon';

function getModeForActivity(a: ActivityForCheck): CheckMode {
  if (!a.end_date) return 'due_soon';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(a.end_date + 'T00:00:00');
  const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'due_today';
  return 'due_soon';
}

function dueDateLabel(end_date: string | null): string {
  if (!end_date) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(end_date + 'T00:00:00');
  const diff = Math.floor((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `Venció hace ${Math.abs(diff)} día${Math.abs(diff) !== 1 ? 's' : ''}`;
  if (diff === 0) return 'Vence hoy';
  if (diff === 1) return 'Vence mañana';
  return `Vence en ${diff} días`;
}

const PRIORITY_TAG: Record<string, string> = {
  HIGH:   'bg-red-500/20 text-red-300 border-red-500/30',
  MEDIUM: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  LOW:    'bg-green-500/20 text-green-300 border-green-500/30',
};
const PRIORITY_LABEL: Record<string, string> = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };

export default function StatusCheckModal({ activities, memberId, memberName, teamId, onClose, onActivityCompleted }: Props) {
  const [current, setCurrent] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());

  const pending = activities.filter(a => !done.has(a.id));
  const activity = pending[current] ?? pending[0];

  if (!activity) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Todo al día</h2>
          <p className="text-slate-400 text-sm mb-6">Tus actualizaciones fueron enviadas al gestor.</p>
          <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition w-full">
            Continuar
          </button>
        </div>
      </div>
    );
  }

  const mode = getModeForActivity(activity);
  const isOverdue = mode === 'overdue';
  const isToday = mode === 'due_today';

  const submitBlocked = async () => {
    if (!comment.trim()) return;
    setSending(true);
    try {
      await supabase.from('activity_revisions').insert({
        activity_id: activity.id,
        status: 'BLOCKED',
        comments: `[BLOQUEADA] ${comment.trim()}`,
        author_name: memberName,
      });

      await supabase.from('activities').update({
        status: 'BLOCKED',
        updated_at: new Date().toISOString(),
      }).eq('id', activity.id);

      const { data: managers } = await supabase
        .from('team_members').select('id').eq('team_id', teamId).not('user_id', 'is', null);
      if (managers?.length) {
        await supabase.from('notifications').insert(
          managers.map((m: any) => ({
            team_member_id: m.id,
            activity_id: activity.id,
            type: 'ACTIVITY_BLOCKED',
            title: `Actividad bloqueada: ${activity.title}`,
            body: `${memberName} no puede continuar: "${comment.trim()}"`,
          }))
        );
      }

      setComment('');
      setDone(prev => new Set([...prev, activity.id]));
      if (pending.length > 1) {
        const nextIdx = pending.findIndex(a => a.id === activity.id) + 1;
        setCurrent(Math.min(nextIdx, pending.length - 2));
      }
    } finally {
      setSending(false);
    }
  };

  const submitUpdate = async (markComplete: boolean) => {
    if (!comment.trim() && !markComplete) return;
    setSending(true);

    try {
      const newStatus = markComplete ? 'IN_REVIEW' : activity.status;

      // Insert revision/comment
      await supabase.from('activity_revisions').insert({
        activity_id: activity.id,
        status: newStatus,
        comments: markComplete
          ? `[Marcada como completada] ${comment.trim() || 'Actividad completada.'}`
          : isOverdue
          ? `[Actividad vencida] ${comment.trim()}`
          : `[Actualización de seguimiento] ${comment.trim()}`,
        author_name: memberName,
      });

      // If marking complete, update activity status to IN_REVIEW
      if (markComplete) {
        await supabase.from('activities').update({
          status: 'IN_REVIEW',
          review_requested_at: new Date().toISOString(),
          review_note: '',
          updated_at: new Date().toISOString(),
        }).eq('id', activity.id);

        // Notify managers
        const { data: managers } = await supabase
          .from('team_members').select('id').eq('team_id', teamId).not('user_id', 'is', null);
        if (managers?.length) {
          await supabase.from('notifications').insert(
            managers.map((m: any) => ({
              team_member_id: m.id,
              activity_id: activity.id,
              type: 'REVIEW_REQUESTED',
              title: 'Actividad lista para revisión',
              body: `${memberName} completó "${activity.title}" y la envió a revisión.`,
            }))
          );
        }
        onActivityCompleted();
      } else {
        // Notify managers of status update
        const { data: managers } = await supabase
          .from('team_members').select('id').eq('team_id', teamId).not('user_id', 'is', null);
        if (managers?.length) {
          await supabase.from('notifications').insert(
            managers.map((m: any) => ({
              team_member_id: m.id,
              activity_id: activity.id,
              type: 'ACTIVITY_UPDATED',
              title: isOverdue
                ? `Actividad vencida: ${activity.title}`
                : `Seguimiento: ${activity.title}`,
              body: `${memberName}: "${comment.trim()}"`,
            }))
          );
        }
      }

      setComment('');
      setDone(prev => new Set([...prev, activity.id]));

      // Advance to next
      if (pending.length > 1) {
        const nextIdx = pending.findIndex(a => a.id === activity.id) + 1;
        setCurrent(Math.min(nextIdx, pending.length - 2));
      }
    } finally {
      setSending(false);
    }
  };

  const skip = () => {
    setDone(prev => new Set([...prev, activity.id]));
    if (pending.length <= 1) onClose();
  };

  const idx = activities.findIndex(a => a.id === activity.id);
  const progress = Math.round((done.size / activities.length) * 100);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full my-8 shadow-2xl flex flex-col">

        {/* Header */}
        <div className={`px-6 py-5 rounded-t-2xl border-b border-slate-700 ${
          isOverdue ? 'bg-red-950/40' : isToday ? 'bg-amber-950/30' : 'bg-slate-800/50'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isOverdue
                ? <AlertTriangle size={18} className="text-red-400" />
                : isToday
                ? <Clock size={18} className="text-amber-400" />
                : <Clock size={18} className="text-blue-400" />
              }
              <span className={`text-sm font-bold ${isOverdue ? 'text-red-300' : isToday ? 'text-amber-300' : 'text-blue-300'}`}>
                {isOverdue ? 'Actividad vencida' : isToday ? 'Vence hoy — actualiza tu avance' : 'Próxima a vencer'}
              </span>
            </div>
            <button onClick={onClose} className="p-1 text-slate-500 hover:text-slate-300 rounded transition">
              <X size={16} />
            </button>
          </div>

          {/* Progress bar when multiple activities */}
          {activities.length > 1 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">{done.size} de {activities.length} actualizadas</span>
                <span className="text-xs text-slate-500">{progress}%</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* Activity info */}
          <div className="bg-slate-800/70 border border-slate-700/50 rounded-xl p-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                <p className="text-white font-semibold text-sm leading-snug">{activity.title}</p>
                {activity.project && <p className="text-xs text-slate-400 mt-0.5">{activity.project}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${PRIORITY_TAG[activity.priority] ?? ''}`}>
                  {PRIORITY_LABEL[activity.priority] ?? activity.priority}
                </span>
                <span className={`text-[11px] font-semibold ${isOverdue ? 'text-red-400' : isToday ? 'text-amber-400' : 'text-slate-400'}`}>
                  {dueDateLabel(activity.end_date)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
              {isOverdue
                ? '¿Por qué no se completó? ¿Cuál es el bloqueo?'
                : isToday
                ? '¿Cómo va la actividad? ¿La terminarás hoy?'
                : '¿Cómo va el avance hasta ahora?'}
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={
                isOverdue
                  ? 'Ej: Estoy esperando respuesta del cliente, encontré un bloqueo en...'
                  : 'Ej: Ya terminé el 80%, solo falta la prueba final...'
              }
              rows={4}
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
              autoFocus
            />
          </div>

          {/* Actions */}
          <div className="space-y-2">
            {/* Mark complete button — only for active activities */}
            {(activity.status === 'PENDING' || activity.status === 'IN_PROGRESS') && (
              <button
                onClick={() => submitUpdate(true)}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-semibold text-sm px-4 py-3 rounded-xl transition"
              >
                <CheckCircle2 size={16} />
                {sending ? 'Enviando...' : 'Marcar como completada y enviar a revisión'}
              </button>
            )}

            <button
              onClick={() => submitUpdate(false)}
              disabled={sending || !comment.trim()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm px-4 py-3 rounded-xl transition"
            >
              <Send size={15} />
              {sending ? 'Enviando...' : 'Enviar actualización al gestor'}
            </button>

            {/* Blocked — only for active activities */}
            {(activity.status === 'PENDING' || activity.status === 'IN_PROGRESS') && (
              <button
                onClick={submitBlocked}
                disabled={sending || !comment.trim()}
                className="w-full flex items-center justify-center gap-2 bg-red-900/60 hover:bg-red-800/80 border border-red-700/60 hover:border-red-600 disabled:opacity-40 text-red-300 hover:text-red-200 font-semibold text-sm px-4 py-3 rounded-xl transition"
              >
                <ShieldAlert size={15} />
                {sending ? 'Enviando...' : 'No puedo continuar — necesito ayuda del gestor'}
              </button>
            )}

            <button
              onClick={skip}
              disabled={sending}
              className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 rounded-xl transition"
            >
              {pending.length > 1 ? 'Omitir por ahora' : 'Cerrar'}
            </button>
          </div>

          {/* Queue indicator */}
          {pending.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-1">
              {pending.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setCurrent(i)}
                  className={`w-2 h-2 rounded-full transition ${a.id === activity.id ? 'bg-blue-400 w-4' : 'bg-slate-600 hover:bg-slate-500'}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {pending.length > 1 && (
          <div className="px-6 pb-4 flex items-center justify-between text-xs text-slate-500">
            <span>Actividad {(idx + 1)} de {activities.length}</span>
            {pending.length > 1 && (
              <button
                onClick={() => { const next = (current + 1) % pending.length; setCurrent(next); }}
                className="flex items-center gap-1 hover:text-slate-300 transition"
              >
                Siguiente <ChevronRight size={13} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
