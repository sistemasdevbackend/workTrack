import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  ClipboardCheck, CheckCircle2, XCircle, GitCommitHorizontal,
  Clock, ChevronDown, ChevronUp, Users, Calendar,
  X, Search, RefreshCw, Rocket, Server, ListChecks,
  MessageSquare, Image as ImageIcon, ChevronLeft, ChevronRight,
  Database, Code2, TestTube2, FileText, ZoomIn,
} from 'lucide-react';

interface Activity {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  project: string;
  environment: string;
  review_note: string;
  review_requested_at: string | null;
  reviewed_at: string | null;
  changelog_requested: boolean;
  doc_link_requested?: boolean;
  activity_type?: string;
  production_release_date: string | null;
  released_to_production_at: string | null;
  end_date: string | null;
  team_member_id: string | null;
  member_name?: string;
}

interface Props {
  teamId: string;
  pendingActivityId?: string | null;
  onPendingClear?: () => void;
}

const PRIORITY_TAG: Record<string, string> = {
  HIGH:   'bg-red-500/30 text-red-200',
  MEDIUM: 'bg-yellow-500/30 text-yellow-200',
  LOW:    'bg-green-500/30 text-green-200',
};
const PRIORITY_LABEL: Record<string, string> = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };

const ENV_COLOR: Record<string, string> = {
  DEV:     'bg-blue-500/20 text-blue-300',
  QA:      'bg-yellow-500/20 text-yellow-300',
  STAGING: 'bg-orange-500/20 text-orange-300',
  PROD:    'bg-red-500/20 text-red-300',
};

/* ─── Release Date Modal ─────────────────────────────────── */
function ReleaseDateModal({
  activity,
  onClose,
  onSaved,
}: {
  activity: Activity;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(activity.production_release_date ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!date) return;
    setSaving(true);

    await supabase.from('activities').update({
      production_release_date: date,
      production_release_notified: true,
    }).eq('id', activity.id);

    // Notify collaborator
    if (activity.team_member_id) {
      const formatted = new Date(date + 'T00:00:00').toLocaleDateString('es-MX', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
      await supabase.from('notifications').insert({
        team_member_id: activity.team_member_id,
        activity_id: activity.id,
        type: 'ACTIVITY_UPDATED',
        title: `Fecha de liberación a ${activity.environment ?? 'PROD'}: ${activity.title}`,
        body: `Tu actividad "${activity.title}" está programada para liberarse el ${formatted}. Asegúrate de tener todo listo.`,
      });
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-900/60 to-slate-800 px-5 py-4 border-b border-slate-700 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg shrink-0">
            <Rocket size={16} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">Fecha de liberación a producción</p>
            <p className="text-slate-400 text-xs truncate mt-0.5">{activity.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1 shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-slate-700/40 border border-slate-700 rounded-xl p-3 flex items-center gap-3">
            <Server size={14} className={`shrink-0 ${activity.environment === 'PROD' ? 'text-red-400' : 'text-blue-400'}`} />
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide font-semibold">Ambiente destino</p>
              <p className="text-sm font-bold text-white mt-0.5">{activity.environment ?? 'PROD'}</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              Fecha programada *
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full bg-slate-700 border border-slate-600 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-emerald-500 transition"
            />
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Se notificará al colaborador con la fecha de liberación programada para que esté preparado.
          </p>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-xl transition">
            Ahora no
          </button>
          <button
            onClick={save}
            disabled={!date || saving}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition flex items-center justify-center gap-2"
          >
            {saving
              ? <><svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Guardando...</>
              : <><Rocket size={13} />Notificar colaborador</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Step type meta ─────────────────────────────────────── */
const STEP_TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  DATABASE:      { label: 'BD',    icon: Database,   color: 'text-amber-400' },
  CODE:          { label: 'Código', icon: Code2,      color: 'text-blue-400' },
  TESTING:       { label: 'QA',    icon: TestTube2,  color: 'text-emerald-400' },
  DOCUMENTATION: { label: 'Docs',  icon: FileText,   color: 'text-slate-400' },
};

const REVISION_STATUS_BADGE: Record<string, string> = {
  PENDING:     'bg-slate-500/20 text-slate-300 border-slate-500/40',
  IN_PROGRESS: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  TESTING:     'bg-amber-500/20 text-amber-300 border-amber-500/40',
  COMPLETED:   'bg-green-500/20 text-green-300 border-green-500/40',
  BLOCKED:     'bg-red-500/20 text-red-300 border-red-500/40',
};
const REVISION_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', TESTING: 'En pruebas',
  COMPLETED: 'Completado', BLOCKED: 'Bloqueado',
};

/* ─── Review Modal ───────────────────────────────────────── */
function ReviewModal({
  activity,
  onClose,
  onDone,
}: {
  activity: Activity;
  onClose: () => void;
  onDone: (approved: boolean, activityId: string) => void;
}) {
  const [tab, setTab] = useState<'detail' | 'decide'>('detail');
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [note, setNote] = useState('');
  const [requestChangelog, setRequestChangelog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [steps, setSteps] = useState<any[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number } | null>(null);

  useEffect(() => {
    if (!activity.id) return;
    setLoadingDetail(true);
    Promise.all([
      supabase.from('task_steps').select('*').eq('activity_id', activity.id).order('order_index'),
      supabase.from('activity_revisions').select('*').eq('activity_id', activity.id).order('created_at', { ascending: false }),
    ]).then(([stepsRes, revisionsRes]) => {
      setSteps(stepsRes.data ?? []);
      setRevisions(revisionsRes.data ?? []);
      setLoadingDetail(false);
    }).catch(() => {
      setSteps([]);
      setRevisions([]);
      setLoadingDetail(false);
    });
  }, [activity.id]);

  const submit = async () => {
    if (!action) return;
    setSaving(true);
    const isApprove = action === 'approve';
    const isDoc = activity.activity_type === 'DOCUMENTATION';
    await supabase.from('activities').update({
      status: isApprove ? 'APPROVED' : 'NEEDS_REVISION',
      review_note: note.trim(),
      reviewed_at: new Date().toISOString(),
      changelog_requested: isApprove && !isDoc ? requestChangelog : false,
      doc_link_requested: isApprove && isDoc ? requestChangelog : false,
    }).eq('id', activity.id);
    if (activity.team_member_id) {
      const docNote = ' Se solicita que asocies la documentación correspondiente.';
      const changelogNote = ' Se solicita que registres un Control de Cambios.';
      await supabase.from('notifications').insert({
        team_member_id: activity.team_member_id,
        activity_id: activity.id,
        type: isApprove ? 'ACTIVITY_APPROVED' : 'ACTIVITY_REJECTED',
        title: isApprove ? 'Actividad aprobada' : 'Actividad devuelta para correcciones',
        body: isApprove
          ? `Tu actividad "${activity.title}" fue aprobada.${requestChangelog ? (isDoc ? docNote : changelogNote) : ''}`
          : `Tu actividad "${activity.title}" fue devuelta: ${note.trim() || 'Revisa los comentarios del gestor.'}`,
      });
    }
    setSaving(false);
    onDone(isApprove, activity.id);
    onClose();
  };

  const totalImages = revisions.reduce((acc, r) => acc + (r.image_urls?.length ?? 0), 0);

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>

        {/* Header compacto */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PRIORITY_TAG[activity.priority] ?? 'bg-slate-500/30 text-slate-300'}`}>
                {PRIORITY_LABEL[activity.priority] ?? activity.priority}
              </span>
              {activity.environment && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${ENV_COLOR[activity.environment] ?? 'bg-slate-500/20 text-slate-300'}`}>
                  {activity.environment}
                </span>
              )}
              {activity.project && (
                <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">{activity.project}</span>
              )}
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <Users size={9} />{activity.member_name ?? 'Colaborador'}
              </span>
              {activity.review_requested_at && (
                <span className="text-[10px] text-slate-500">
                  {new Date(activity.review_requested_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <h2 className="text-sm font-bold text-white leading-snug truncate">{activity.title}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition p-1 shrink-0 ml-1"><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 shrink-0">
          <button
            onClick={() => setTab('detail')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold uppercase tracking-wide transition border-b-2 ${tab === 'detail' ? 'text-blue-400 border-blue-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
          >
            <ListChecks size={12} />Actividad
            {totalImages > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] bg-blue-500/20 text-blue-300 px-1 py-0.5 rounded-full">
                <ImageIcon size={9} />{totalImages}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('decide')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold uppercase tracking-wide transition border-b-2 ${tab === 'decide' ? 'text-amber-400 border-amber-500' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
          >
            <ClipboardCheck size={12} />Decisión
            {action && <span className={`w-1.5 h-1.5 rounded-full ${action === 'approve' ? 'bg-green-400' : 'bg-red-400'}`} />}
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="overflow-y-auto flex-1 min-h-0">

          {/* Tab: Actividad */}
          {tab === 'detail' && (
            <div className="p-4 space-y-3">
              {loadingDetail ? (
                <div className="text-center py-8 text-slate-400 text-sm">Cargando...</div>
              ) : (
                <>
                  {activity.description && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Descripción</p>
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-700/40 rounded-lg px-3 py-2">{activity.description}</p>
                    </div>
                  )}

                  {steps.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <ListChecks size={11} />Pasos ({steps.length})
                      </p>
                      <div className="space-y-1.5">
                        {steps.map((s, i) => {
                          const meta = STEP_TYPE_META[s.step_type] ?? STEP_TYPE_META.DOCUMENTATION;
                          const Icon = meta.icon;
                          return (
                            <div key={s.id} className="flex items-center gap-2 bg-slate-700/30 rounded-lg px-2.5 py-2">
                              <div className={`p-0.5 rounded shrink-0 ${s.completed ? 'bg-green-500/20' : 'bg-slate-600/50'}`}>
                                {s.completed
                                  ? <CheckCircle2 size={12} className="text-green-400" />
                                  : <Icon size={12} className={meta.color} />
                                }
                              </div>
                              <p className={`text-xs flex-1 min-w-0 truncate ${s.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>{s.title}</p>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[10px] font-bold px-1 py-0.5 rounded bg-slate-700 border border-slate-600 ${meta.color}`}>{meta.label}</span>
                                <span className="text-[10px] text-slate-500">#{i + 1}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {revisions.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <MessageSquare size={11} />Seguimiento ({revisions.length})
                      </p>
                      <div className="space-y-2">
                        {revisions.map(r => {
                          const imgs: string[] = r.image_urls ?? [];
                          const statusBadge = REVISION_STATUS_BADGE[r.status] ?? REVISION_STATUS_BADGE.PENDING;
                          const statusLabel = REVISION_STATUS_LABEL[r.status] ?? r.status;
                          return (
                            <div key={r.id} className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-2.5 space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                                  {(r.author_name || '?')[0].toUpperCase()}
                                </div>
                                <span className="text-xs font-medium text-white">{r.author_name || 'Colaborador'}</span>
                                <span className={`text-[10px] font-semibold px-1 py-0.5 rounded border ${statusBadge}`}>{statusLabel}</span>
                                <span className="text-[10px] text-slate-500 ml-auto">
                                  {new Date(r.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {r.comments && (
                                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap border-l-2 border-slate-600 pl-2">
                                  {r.comments.replace(/<[^>]*>/g, '')}
                                </p>
                              )}
                              {imgs.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {imgs.map((url, idx) => (
                                    <button
                                      key={idx}
                                      onClick={() => setLightbox({ urls: imgs, idx })}
                                      className="relative group w-16 h-12 rounded-md overflow-hidden border border-slate-600 hover:border-blue-400 transition"
                                    >
                                      <img src={url} alt="" className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                        <ZoomIn size={12} className="text-white" />
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {steps.length === 0 && revisions.length === 0 && !activity.description && (
                    <div className="text-center py-6 text-slate-500 text-xs">
                      <ClipboardCheck size={24} className="mx-auto mb-1.5 opacity-20" />
                      Sin pasos ni seguimiento registrado
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Tab: Decisión */}
          {tab === 'decide' && (
            <div className="p-4 space-y-3">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Decisión *</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAction('approve')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition ${action === 'approve' ? 'bg-green-600 border-green-500 text-white' : 'border-slate-600 text-slate-300 hover:border-green-500 hover:text-green-300'}`}
                  >
                    <CheckCircle2 size={13} />Aprobar
                  </button>
                  <button
                    onClick={() => setAction('reject')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-semibold transition ${action === 'reject' ? 'bg-red-700 border-red-600 text-white' : 'border-slate-600 text-slate-300 hover:border-red-500 hover:text-red-300'}`}
                  >
                    <XCircle size={13} />Devolver
                  </button>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  {action === 'reject' ? 'Motivo *' : 'Comentario (opcional)'}
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder={action === 'reject' ? 'Describe qué debe corregirse...' : 'Observaciones opcionales...'}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {action === 'approve' && (() => {
                const isDoc = activity.activity_type === 'DOCUMENTATION';
                const accentOn  = isDoc ? 'bg-amber-500 border-amber-500' : 'bg-cyan-500 border-cyan-500';
                const accentOff = isDoc ? 'border-slate-500 group-hover:border-amber-400' : 'border-slate-500 group-hover:border-cyan-400';
                return (
                  <label className="flex items-start gap-2.5 cursor-pointer group bg-slate-700/30 rounded-lg p-2.5 border border-slate-600/50">
                    <div className="relative mt-0.5 shrink-0">
                      <input type="checkbox" checked={requestChangelog} onChange={e => setRequestChangelog(e.target.checked)} className="sr-only" />
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition ${requestChangelog ? accentOn : accentOff}`}>
                        {requestChangelog && <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12"><path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
                      </div>
                    </div>
                    {isDoc ? (
                      <div>
                        <p className="text-xs text-slate-200 font-medium flex items-center gap-1">
                          <FileText size={12} className="text-amber-400" />
                          Solicitar vinculación de Documentación
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">El colaborador deberá asociar el documento correspondiente a esta actividad.</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-slate-200 font-medium flex items-center gap-1">
                          <GitCommitHorizontal size={12} className="text-cyan-400" />
                          Solicitar Control de Cambios
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">El colaborador recibirá una alerta para registrar la liberación.</p>
                      </div>
                    )}
                  </label>
                );
              })()}
            </div>
          )}
        </div>

        {/* Footer fijo */}
        <div className="flex gap-2 px-4 py-3 border-t border-slate-700 shrink-0">
          {tab === 'detail' ? (
            <button
              onClick={() => setTab('decide')}
              className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition flex items-center justify-center gap-1.5"
            >
              <ClipboardCheck size={13} />Ir a decisión
            </button>
          ) : (
            <>
              <button onClick={() => setTab('detail')} className="px-3 py-2 text-xs text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition flex items-center gap-1">
                <ChevronLeft size={13} />Actividad
              </button>
              <button
                onClick={submit}
                disabled={!action || (action === 'reject' && !note.trim()) || saving}
                className="flex-1 px-3 py-2 text-xs font-semibold text-white rounded-lg transition flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-500"
              >
                {saving && <svg className="animate-spin h-3.5 w-3.5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
                {saving ? 'Guardando...' : 'Confirmar revisión'}
              </button>
            </>
          )}
        </div>

      </div>

      {lightbox && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4" onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white/60 hover:text-white transition p-2"><X size={20} /></button>
          {lightbox.urls.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition p-2 bg-slate-800/60 rounded-full"
                onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, idx: (l.idx - 1 + l.urls.length) % l.urls.length } : null); }}
              ><ChevronLeft size={20} /></button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition p-2 bg-slate-800/60 rounded-full"
                onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, idx: (l.idx + 1) % l.urls.length } : null); }}
              ><ChevronRight size={20} /></button>
            </>
          )}
          <img src={lightbox.urls[lightbox.idx]} alt="" className="max-h-[85vh] max-w-full rounded-xl shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
          {lightbox.urls.length > 1 && (
            <div className="absolute bottom-4 flex gap-1.5">
              {lightbox.urls.map((_, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setLightbox(l => l ? { ...l, idx: i } : null); }}
                  className={`w-2 h-2 rounded-full transition ${i === lightbox.idx ? 'bg-white' : 'bg-white/30'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Approved Card ──────────────────────────────────────── */
function ActivityApprovedCard({
  activity,
  onSetReleaseDate,
}: {
  activity: Activity;
  onSetReleaseDate: (a: Activity) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [linkedEntry, setLinkedEntry] = useState<any | null | undefined>(undefined);
  const tag = PRIORITY_TAG[activity.priority] ?? 'bg-slate-500/30 text-slate-300';
  const label = PRIORITY_LABEL[activity.priority] ?? activity.priority;

  useEffect(() => {
    if (!activity.changelog_requested) return;
    supabase
      .from('activity_changelog_links')
      .select('changelog_entry_id')
      .eq('activity_id', activity.id)
      .maybeSingle()
      .then(async ({ data: link }) => {
        if (!link) { setLinkedEntry(null); return; }
        const { data: entry } = await supabase
          .from('changelog_entries')
          .select('id, title, release_date, environment, status')
          .eq('id', link.changelog_entry_id)
          .maybeSingle();
        setLinkedEntry(entry ?? null);
      });
  }, [activity.id, activity.changelog_requested]);

  const envColor = (env: string) => ({
    PROD:    'bg-red-500/20 text-red-300',
    QA:      'bg-yellow-500/20 text-yellow-300',
    DEV:     'bg-blue-500/20 text-blue-300',
    STAGING: 'bg-orange-500/20 text-orange-300',
  }[env] ?? 'bg-slate-500/20 text-slate-300');

  const hasCdc = linkedEntry && linkedEntry !== null;
  const needsReleaseDate = hasCdc && !activity.production_release_date;
  const hasReleaseDate = !!activity.production_release_date;
  const isReleasedToProd = !!activity.released_to_production_at;
  const canConfirmRelease = hasReleaseDate && !isReleasedToProd;

  const borderClass = isReleasedToProd
    ? 'border-slate-600'
    : canConfirmRelease
      ? 'border-red-500/50'
      : needsReleaseDate
        ? 'border-emerald-500/40'
        : 'border-slate-700';

  return (
    <div className={`bg-slate-800/60 border rounded-xl p-4 hover:border-slate-600 transition ${borderClass}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${tag}`}>{label}</span>
            {activity.environment && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${envColor(activity.environment)}`}>{activity.environment}</span>
            )}
            {activity.project && (
              <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{activity.project}</span>
            )}
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Users size={10} />{activity.member_name ?? '—'}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white leading-snug">{activity.title}</h3>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
            {activity.reviewed_at && (
              <span className="flex items-center gap-1 text-green-400/70">
                <CheckCircle2 size={10} />
                Aprobada {new Date(activity.reviewed_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
              </span>
            )}
            {isReleasedToProd ? (
              <span className="flex items-center gap-1 text-red-400/80 font-semibold">
                <Rocket size={10} />
                En produccion {new Date(activity.released_to_production_at!).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
              </span>
            ) : hasReleaseDate && (
              <span className="flex items-center gap-1 text-emerald-400/80">
                <Rocket size={10} />
                Liberacion: {new Date(activity.production_release_date! + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
          {activity.review_note && expanded && (
            <p className="mt-2 text-xs text-slate-400 italic">"{activity.review_note}"</p>
          )}

          {/* CDC link status */}
          {activity.changelog_requested && (
            <div className="mt-2.5 space-y-2">
              {linkedEntry === undefined ? null : linkedEntry === null ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-400/70 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                  <Clock size={11} className="shrink-0" />
                  <span>Esperando que el colaborador vincule su Control de Cambios</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-2.5 py-2">
                  <GitCommitHorizontal size={13} className="text-cyan-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-cyan-200 leading-snug truncate">{linkedEntry.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${envColor(linkedEntry.environment)}`}>{linkedEntry.environment}</span>
                      <span className="text-[10px] text-slate-400">{new Date(linkedEntry.release_date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* CTA to set release date once CDC is linked */}
              {needsReleaseDate && (
                <button
                  onClick={() => onSetReleaseDate(activity)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-xs font-semibold text-emerald-300 transition"
                >
                  <Rocket size={12} />
                  Asignar fecha de liberación a producción
                </button>
              )}
            </div>
          )}

          {/* If no CDC but approved, still allow setting release date */}
          {!activity.changelog_requested && !hasReleaseDate && (
            <button
              onClick={() => onSetReleaseDate(activity)}
              className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-300 transition"
            >
              <Rocket size={11} />
              Asignar fecha de liberación
            </button>
          )}

          {/* Waiting for collaborator to confirm production release */}
          {canConfirmRelease && (
            <div className="mt-2.5 w-full flex items-center gap-2 py-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
              <Clock size={12} className="shrink-0" />
              Esperando que el colaborador confirme la liberación a producción
            </div>
          )}

          {isReleasedToProd && (
            <div className="mt-2.5 w-full flex items-center gap-2 py-2 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-300">
              <CheckCircle2 size={12} className="shrink-0" />
              Liberado a producción · confirmado por el colaborador{activity.released_to_production_at && ` el ${new Date(activity.released_to_production_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            </div>
          )}
        </div>
        {activity.review_note && (
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition shrink-0">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Pending Review Card ───────────────────────────────── */
function ActivityReviewCard({
  activity,
  onReview,
}: {
  activity: Activity;
  onReview: (a: Activity) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tag = PRIORITY_TAG[activity.priority] ?? 'bg-slate-500/30 text-slate-300';
  const label = PRIORITY_LABEL[activity.priority] ?? activity.priority;

  return (
    <div className="bg-slate-800 border border-amber-500/30 rounded-xl p-4 hover:border-amber-400/50 transition">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${tag}`}>{label}</span>
            {activity.environment && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ENV_COLOR[activity.environment] ?? 'bg-slate-500/20 text-slate-300'}`}>
                {activity.environment}
              </span>
            )}
            {activity.project && (
              <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{activity.project}</span>
            )}
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Users size={10} />{activity.member_name ?? '—'}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white leading-snug">{activity.title}</h3>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
            {activity.review_requested_at && (
              <span className="flex items-center gap-1 text-amber-400/80">
                <Clock size={10} />
                Enviada {new Date(activity.review_requested_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {activity.end_date && (
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {new Date(activity.end_date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {activity.description && (
            <button onClick={() => setExpanded(e => !e)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <button
            onClick={() => onReview(activity)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition"
          >
            <ClipboardCheck size={13} />
            Revisar
          </button>
        </div>
      </div>
      {expanded && activity.description && (
        <p className="mt-2 pt-2 border-t border-slate-700 text-xs text-slate-300 leading-relaxed">{activity.description}</p>
      )}
    </div>
  );
}

/* ─── Project-Grouped List ───────────────────────────────── */
function ProjectGroupedList({
  label,
  dotColor,
  countColor,
  activities,
  emptyIcon,
  emptyText,
  renderCard,
}: {
  label: string;
  dotColor: string;
  countColor: string;
  activities: Activity[];
  emptyIcon?: React.ReactNode;
  emptyText?: string;
  renderCard: (a: Activity) => React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups: { project: string; items: Activity[] }[] = [];
  const seen = new Set<string>();
  for (const a of activities) {
    const key = a.project || 'Sin proyecto';
    if (!seen.has(key)) { seen.add(key); groups.push({ project: key, items: [] }); }
    groups.find(g => g.project === key)!.items.push(a);
  }

  const toggle = (project: string) =>
    setCollapsed(c => ({ ...c, [project]: !c[project] }));

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">{label}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${countColor}`}>{activities.length}</span>
      </div>

      {activities.length === 0 && emptyText ? (
        <div className="text-center py-10 text-slate-500 bg-slate-800/40 rounded-xl border border-slate-700 border-dashed">
          {emptyIcon}
          <p className="text-sm">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(({ project, items }) => {
            const isCollapsed = collapsed[project] ?? false;
            return (
              <div key={project} className="rounded-xl border border-slate-700/60 overflow-hidden">
                {/* Project header */}
                <button
                  onClick={() => toggle(project)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700/60 transition text-left"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-bold text-blue-300 bg-blue-500/15 px-2.5 py-1 rounded-md truncate max-w-[240px]">
                      {project}
                    </span>
                    <span className="text-xs text-slate-500 font-medium shrink-0">
                      {items.length} {items.length === 1 ? 'actividad' : 'actividades'}
                    </span>
                  </div>
                  {isCollapsed
                    ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
                    : <ChevronUp size={14} className="text-slate-400 shrink-0" />
                  }
                </button>

                {/* Activities */}
                {!isCollapsed && (
                  <div className="p-3 space-y-2.5 bg-slate-900/30">
                    {items.map(a => renderCard(a))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Main Section ───────────────────────────────────────── */
export default function ReviewSection({ teamId, pendingActivityId, onPendingClear }: Props) {
  const [pending, setPending] = useState<Activity[]>([]);
  const [approved, setApproved] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingActivity, setReviewingActivity] = useState<Activity | null>(null);
  const pendingHandled = useRef<string | null>(null);
  const [releaseDateActivity, setReleaseDateActivity] = useState<Activity | null>(null);
  const [search, setSearch] = useState('');
  const [filterMember, setFilterMember] = useState('ALL');
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: mData }, { data: aData }] = await Promise.all([
      supabase.from('team_members').select('id, name').eq('team_id', teamId).order('name'),
      supabase.from('activities')
        .select('*')
        .eq('team_id', teamId)
        .in('status', ['IN_REVIEW', 'APPROVED'])
        .order('review_requested_at', { ascending: false }),
    ]);

    const mems = mData || [];
    setMembers(mems);
    const memberMap: Record<string, string> = {};
    mems.forEach((m: any) => { memberMap[m.id] = m.name; });

    const all: Activity[] = (aData || []).map((a: any) => ({
      ...a,
      member_name: a.team_member_id ? (memberMap[a.team_member_id] ?? 'Desconocido') : undefined,
    }));

    setPending(all.filter(a => a.status === 'IN_REVIEW'));
    setApproved(all.filter(a => a.status === 'APPROVED'));
    setLoading(false);
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!pendingActivityId || pendingHandled.current === pendingActivityId) return;
    pendingHandled.current = pendingActivityId;
    (async () => {
      const { data } = await supabase
        .from('activities')
        .select('*')
        .eq('id', pendingActivityId)
        .maybeSingle();
      if (data) setReviewingActivity(data as Activity);
      onPendingClear?.();
    })();
  }, [pendingActivityId]);

  useEffect(() => {
    const sub = supabase
      .channel(`review-section-${teamId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, load)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [teamId, load]);

  const filterFn = (list: Activity[]) => list.filter(a => {
    if (filterMember !== 'ALL' && a.team_member_id !== filterMember) return false;
    if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredPending  = filterFn(pending);
  const filteredApproved = filterFn(approved);

  // After review approval, prompt for release date
  const handleReviewDone = (approved: boolean, _activityId: string) => {
    if (approved) {
      // Reload and then check if we need release date
      load();
    } else {
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg">
            <ClipboardCheck size={20} className="text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-none">Revisión de Actividades</h2>
            <p className="text-slate-400 text-sm mt-0.5">Actividades completadas por tus colaboradores que esperan revisión</p>
          </div>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition" title="Recargar">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800 border border-amber-500/30 rounded-xl p-4">
          <p className="text-xs text-slate-400">Esperando revisión</p>
          <p className="text-3xl font-bold text-amber-400 mt-1">{pending.length}</p>
        </div>
        <div className="bg-slate-800 border border-green-500/30 rounded-xl p-4">
          <p className="text-xs text-slate-400">Aprobadas</p>
          <p className="text-3xl font-bold text-green-400 mt-1">{approved.length}</p>
        </div>
        <div className="bg-slate-800 border border-cyan-500/30 rounded-xl p-4">
          <p className="text-xs text-slate-400">CDC solicitados</p>
          <p className="text-3xl font-bold text-cyan-400 mt-1">{approved.filter(a => a.changelog_requested).length}</p>
        </div>
        <div className="bg-slate-800 border border-emerald-500/30 rounded-xl p-4">
          <p className="text-xs text-slate-400">Con fecha de release</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{approved.filter(a => a.production_release_date).length}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-40">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar actividad..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <select value={filterMember} onChange={e => setFilterMember(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="ALL">Todos los colaboradores</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Cargando...</div>
      ) : (
        <div className="space-y-8">
          {/* ── Esperando revisión agrupado por proyecto ── */}
          <ProjectGroupedList
            label="Esperando revisión"
            dotColor="bg-amber-500"
            countColor="text-amber-400 bg-amber-500/10"
            activities={filteredPending}
            emptyIcon={<ClipboardCheck size={32} className="mx-auto mb-2 opacity-20" />}
            emptyText="No hay actividades pendientes de revisión"
            renderCard={(a) => (
              <ActivityReviewCard key={a.id} activity={a} onReview={setReviewingActivity} />
            )}
          />

          {/* ── Aprobadas recientes agrupado por proyecto ── */}
          {filteredApproved.length > 0 && (
            <ProjectGroupedList
              label="Aprobadas recientes"
              dotColor="bg-green-500"
              countColor="text-green-400 bg-green-500/10"
              activities={filteredApproved}
              renderCard={(a) => (
                <ActivityApprovedCard key={a.id} activity={a} onSetReleaseDate={setReleaseDateActivity} />
              )}
            />
          )}
        </div>
      )}

      {reviewingActivity && (
        <ReviewModal
          activity={reviewingActivity}
          onClose={() => setReviewingActivity(null)}
          onDone={handleReviewDone}
        />
      )}

      {releaseDateActivity && (
        <ReleaseDateModal
          activity={releaseDateActivity}
          onClose={() => setReleaseDateActivity(null)}
          onSaved={load}
        />
      )}

    </div>
  );
}
