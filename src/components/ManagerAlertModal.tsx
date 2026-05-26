import { useState } from 'react';
import { AlertTriangle, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp, X, ArrowRight } from 'lucide-react';

export interface AlertActivity {
  id: string;
  title: string;
  status: string;
  priority: string;
  end_date: string | null;
  project: string | null;
  member_name: string;
  days_overdue?: number;
  last_comment?: string;
  last_comment_date?: string;
}

interface Props {
  overdue: AlertActivity[];
  dueSoon: AlertActivity[];   // vencen en 1-2 días
  stalled: AlertActivity[];   // IN_PROGRESS sin actualización >3 días
  onClose: () => void;
  onGoToCollaborator: (memberId: string) => void;
}

type Tab = 'overdue' | 'due_soon' | 'stalled';

const PRIORITY_TAG: Record<string, string> = {
  HIGH:   'bg-red-500/20 text-red-300 border border-red-500/30',
  MEDIUM: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  LOW:    'bg-green-500/20 text-green-300 border border-green-500/30',
};
const PRIORITY_LABEL: Record<string, string> = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };

function ActivityRow({ a, accent }: { a: AlertActivity; accent: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border bg-slate-800/60 overflow-hidden transition ${accent}`}>
      <div className="flex items-start gap-3 p-3.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white leading-snug">{a.title}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PRIORITY_TAG[a.priority] ?? ''}`}>
              {PRIORITY_LABEL[a.priority] ?? a.priority}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-slate-400">{a.member_name}</span>
            {a.project && <span className="text-xs text-slate-500">· {a.project}</span>}
            {a.end_date && (
              <span className={`text-xs font-semibold ${
                (a.days_overdue ?? 0) < 0 ? 'text-red-400' : 'text-amber-400'
              }`}>
                · {(a.days_overdue ?? 0) < 0
                  ? `Venció hace ${Math.abs(a.days_overdue ?? 0)} día${Math.abs(a.days_overdue ?? 0) !== 1 ? 's' : ''}`
                  : (a.days_overdue ?? 0) === 0 ? 'Vence hoy'
                  : `Vence en ${a.days_overdue} día${a.days_overdue !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>
        </div>
        {a.last_comment && (
          <button onClick={() => setOpen(o => !o)} className="text-slate-500 hover:text-slate-300 p-1 shrink-0 transition">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>
      {open && a.last_comment && (
        <div className="px-3.5 pb-3 border-t border-slate-700/50 pt-2.5">
          <p className="text-xs text-slate-400 leading-relaxed italic">"{a.last_comment}"</p>
          {a.last_comment_date && (
            <p className="text-[10px] text-slate-600 mt-1">
              {new Date(a.last_comment_date).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ManagerAlertModal({ overdue, dueSoon, stalled, onClose, onGoToCollaborator }: Props) {
  const [tab, setTab] = useState<Tab>(
    overdue.length > 0 ? 'overdue' : dueSoon.length > 0 ? 'due_soon' : 'stalled'
  );

  const total = overdue.length + dueSoon.length + stalled.length;

  const tabs: { key: Tab; label: string; count: number; color: string; icon: React.ReactNode }[] = [
    { key: 'overdue',  label: 'Vencidas',       count: overdue.length,  color: 'text-red-400',    icon: <XCircle size={14} /> },
    { key: 'due_soon', label: 'Próx. a vencer', count: dueSoon.length,  color: 'text-amber-400',  icon: <Clock size={14} /> },
    { key: 'stalled',  label: 'Sin avance',     count: stalled.length,  color: 'text-slate-400',  icon: <AlertTriangle size={14} /> },
  ].filter(t => t.count > 0);

  const currentList = tab === 'overdue' ? overdue : tab === 'due_soon' ? dueSoon : stalled;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full my-8 shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-700 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-none">Alertas del equipo</h2>
                <p className="text-xs text-slate-400 mt-1">
                  {total} actividad{total !== 1 ? 'es' : ''} requieren atención
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded-lg transition">
              <X size={16} />
            </button>
          </div>

          {/* Summary chips */}
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {overdue.length > 0 && (
              <span className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/25 text-red-300 text-xs font-bold px-3 py-1.5 rounded-full">
                <XCircle size={12} /> {overdue.length} vencida{overdue.length !== 1 ? 's' : ''}
              </span>
            )}
            {dueSoon.length > 0 && (
              <span className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-full">
                <Clock size={12} /> {dueSoon.length} próxima{dueSoon.length !== 1 ? 's' : ''} a vencer
              </span>
            )}
            {stalled.length > 0 && (
              <span className="flex items-center gap-1.5 bg-slate-600/30 border border-slate-600/50 text-slate-400 text-xs font-bold px-3 py-1.5 rounded-full">
                <AlertTriangle size={12} /> {stalled.length} sin avance reciente
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        {tabs.length > 1 && (
          <div className="flex border-b border-slate-700 px-6 shrink-0">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition ${
                  tab === t.key
                    ? `border-blue-500 ${t.color}`
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {t.icon}
                {t.label}
                <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab === t.key ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-400'
                }`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {currentList.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Sin actividades en esta categoría</p>
            </div>
          ) : (
            currentList.map(a => (
              <ActivityRow
                key={a.id}
                a={a}
                accent={
                  tab === 'overdue'
                    ? 'border-red-500/20 hover:border-red-500/40'
                    : tab === 'due_soon'
                    ? 'border-amber-500/20 hover:border-amber-500/40'
                    : 'border-slate-700/60 hover:border-slate-600'
                }
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-500">Ir al colaborador para gestionar la actividad</p>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
          >
            Entendido <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
