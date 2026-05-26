import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLogger';
import {
  Plus, X, ChevronDown, ChevronUp, Folder, FolderPlus,
  Clock, Tag, AlertCircle, CheckCircle2, XCircle, RotateCcw,
  Pencil, Trash2, Filter, Search, Calendar, Users, Link2, GitBranch,
} from 'lucide-react';

interface ChangelogProject {
  id: string;
  team_id: string;
  name: string;
  description: string;
  color: string;
  created_by: string | null;
  created_at: string;
}

interface ChangelogEntry {
  id: string;
  project_id: string;
  team_member_id: string | null;
  release_date: string;
  release_time: string;
  version: string;
  environment: string;
  change_type: string;
  release_category: string;
  title: string;
  description: string;
  reason: string;
  impact: string;
  rollback_plan: string;
  status: string;
  created_at: string;
  member_name?: string;
}

interface Props {
  teamId: string;
  memberId: string;
  memberName: string;
  canCreate?: boolean;
}

const CHANGE_TYPES = ['DEPLOY', 'FEATURE', 'BUGFIX', 'HOTFIX', 'ROLLBACK', 'CONFIG', 'OTHER'];
const ENVIRONMENTS = ['PROD', 'QA', 'DEV', 'STAGING', 'UAT'];
const STATUSES = ['SUCCESS', 'FAILED', 'ROLLBACK', 'PENDING'];
const CATEGORIES = ['CODIGO', 'BASE_DE_DATOS', 'MIXTO', 'OTRO'];

const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  CODIGO:        { label: 'Código',       color: 'text-blue-300',   bg: 'bg-blue-500/20 border-blue-500/40' },
  BASE_DE_DATOS: { label: 'Base de Datos', color: 'text-amber-300', bg: 'bg-amber-500/20 border-amber-500/40' },
  MIXTO:         { label: 'Mixto',        color: 'text-teal-300',   bg: 'bg-teal-500/20 border-teal-500/40' },
  OTRO:          { label: 'Otro',         color: 'text-slate-300',  bg: 'bg-slate-500/20 border-slate-500/40' },
};

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  DEPLOY:   { label: 'Deploy',    color: 'text-blue-300',   bg: 'bg-blue-500/20 border-blue-500/40' },
  FEATURE:  { label: 'Feature',   color: 'text-emerald-300', bg: 'bg-emerald-500/20 border-emerald-500/40' },
  BUGFIX:   { label: 'Bugfix',    color: 'text-orange-300', bg: 'bg-orange-500/20 border-orange-500/40' },
  HOTFIX:   { label: 'Hotfix',    color: 'text-red-300',    bg: 'bg-red-500/20 border-red-500/40' },
  ROLLBACK: { label: 'Rollback',  color: 'text-rose-300',   bg: 'bg-rose-500/20 border-rose-500/40' },
  CONFIG:   { label: 'Config',    color: 'text-cyan-300',   bg: 'bg-cyan-500/20 border-cyan-500/40' },
  OTHER:    { label: 'Otro',      color: 'text-slate-300',  bg: 'bg-slate-500/20 border-slate-500/40' },
};

const STATUS_META: Record<string, { label: string; icon: any; color: string; badge: string }> = {
  SUCCESS:  { label: 'Exitoso',   icon: CheckCircle2, color: 'text-green-400',  badge: 'bg-green-500/20 text-green-300 border-green-500/40' },
  FAILED:   { label: 'Fallido',   icon: XCircle,      color: 'text-red-400',    badge: 'bg-red-500/20 text-red-300 border-red-500/40' },
  ROLLBACK: { label: 'Rollback',  icon: RotateCcw,    color: 'text-rose-400',   badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  PENDING:  { label: 'Pendiente', icon: Clock,        color: 'text-yellow-400', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
};

const PROJECT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#8b5cf6', '#ec4899', '#84cc16',
];

const EMPTY_ENTRY = {
  release_date: new Date().toISOString().split('T')[0],
  release_time: new Date().toTimeString().slice(0, 5),
  version: '',
  environment: 'PROD',
  change_type: 'DEPLOY',
  release_category: 'CODIGO',
  title: '',
  description: '',
  reason: '',
  impact: '',
  rollback_plan: '',
  status: 'SUCCESS',
};

function ProjectModal({
  teamId,
  memberId,
  onClose,
  onSaved,
  editing,
}: {
  teamId: string;
  memberId: string;
  onClose: () => void;
  onSaved: () => void;
  editing: ChangelogProject | null;
}) {
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [color, setColor] = useState(editing?.color ?? PROJECT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    if (editing) {
      await supabase.from('changelog_projects').update({ name: name.trim(), description, color, updated_at: new Date().toISOString() }).eq('id', editing.id);
    } else {
      await supabase.from('changelog_projects').insert({ team_id: teamId, name: name.trim(), description, color, created_by: memberId });
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-white font-bold text-lg">{editing ? 'Editar Proyecto' : 'Nuevo Proyecto'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Nombre *</label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              placeholder="Nombre del proyecto"
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Descripción</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Descripción opcional"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Color de etiqueta</label>
            <div className="flex gap-2 flex-wrap">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition ring-offset-2 ring-offset-slate-800 ${color === c ? 'ring-2 ring-white' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {saving && <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryModal({
  projectId,
  memberId,
  teamId,
  onClose,
  onSaved,
  editing,
  onLog,
}: {
  projectId: string;
  memberId: string;
  teamId: string;
  onClose: () => void;
  onSaved: () => void;
  editing: ChangelogEntry | null;
  onLog: (action: 'CREATE' | 'UPDATE', id: string, title: string, meta: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState(editing ? {
    release_date: editing.release_date,
    release_time: editing.release_time.slice(0, 5),
    version: editing.version,
    environment: editing.environment,
    change_type: editing.change_type,
    release_category: editing.release_category ?? 'CODIGO',
    title: editing.title,
    description: editing.description,
    reason: editing.reason,
    impact: editing.impact,
    rollback_plan: editing.rollback_plan,
    status: editing.status,
  } : { ...EMPTY_ENTRY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendingActivities, setPendingActivities] = useState<{ id: string; title: string }[]>([]);
  const [linkedActivityId, setLinkedActivityId] = useState('');

  useEffect(() => {
    if (editing) return;
    const loadPending = async () => {
      const { data: allActivities } = await supabase
        .from('activities')
        .select('id, title')
        .eq('status', 'APPROVED')
        .eq('changelog_requested', true)
        .eq('team_member_id', memberId);

      if (!allActivities || allActivities.length === 0) {
        setPendingActivities([]);
        return;
      }

      const activityIds = allActivities.map((a: any) => a.id);
      const { data: existingLinks } = await supabase
        .from('activity_changelog_links')
        .select('activity_id')
        .in('activity_id', activityIds);

      const linkedSet = new Set((existingLinks || []).map((l: any) => l.activity_id));
      setPendingActivities(allActivities.filter((a: any) => !linkedSet.has(a.id)));
    };
    loadPending();
  }, [memberId, editing]);

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const save = async () => {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    if (!form.release_date) { setError('La fecha es obligatoria'); return; }
    setSaving(true);
    const payload = {
      ...form,
      title: form.title.trim(),
      team_member_id: memberId || null,
      updated_at: new Date().toISOString(),
    };
    const meta = { environment: form.environment, status: form.status, change_type: form.change_type, version: form.version };
    if (editing) {
      await supabase.from('changelog_entries').update(payload).eq('id', editing.id);
      onLog('UPDATE', editing.id, form.title.trim(), meta);
    } else {
      const { data } = await supabase.from('changelog_entries').insert({ ...payload, project_id: projectId }).select('id').maybeSingle();
      const newEntryId = data?.id ?? '';
      onLog('CREATE', newEntryId, form.title.trim(), meta);
      // Link to activity if selected
      if (newEntryId && linkedActivityId) {
        await supabase.from('activity_changelog_links').insert({
          activity_id: linkedActivityId,
          changelog_entry_id: newEntryId,
        });
        // Notify manager that CDC was linked
        const { data: managers } = await supabase
          .from('team_members')
          .select('id')
          .eq('team_id', teamId)
          .not('user_id', 'is', null);
        if (managers && managers.length > 0) {
          await supabase.from('notifications').insert(
            managers.map((m: any) => ({
              team_member_id: m.id,
              activity_id: linkedActivityId,
              type: 'CHANGELOG_LINKED',
              title: 'Control de Cambios registrado',
              body: `Se vinculó la liberación "${form.title.trim()}" a una actividad aprobada.`,
            }))
          );
        }
      }
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const field = (label: string, key: string, type = 'text', placeholder = '') => (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">{label}</label>
      <input
        type={type}
        value={(form as any)[key]}
        onChange={e => { set(key, e.target.value); setError(''); }}
        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        placeholder={placeholder}
      />
    </div>
  );

  const textarea = (label: string, key: string, placeholder = '', rows = 2) => (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">{label}</label>
      <textarea
        value={(form as any)[key]}
        onChange={e => set(key, e.target.value)}
        rows={rows}
        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
        placeholder={placeholder}
      />
    </div>
  );

  const select = (label: string, key: string, options: string[], labelFn?: (v: string) => string) => (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">{label}</label>
      <select
        value={(form as any)[key]}
        onChange={e => set(key, e.target.value)}
        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
      >
        {options.map(o => <option key={o} value={o}>{labelFn ? labelFn(o) : o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-2xl my-8 shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-white font-bold text-lg">{editing ? 'Editar Entrada' : 'Nueva Entrada de Cambio'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="bg-red-500/20 border border-red-500/40 rounded-lg px-3 py-2 text-red-300 text-sm">{error}</div>}

          {/* Fecha / hora / versión */}
          <div className="grid grid-cols-3 gap-3">
            {field('Fecha *', 'release_date', 'date')}
            {field('Hora *', 'release_time', 'time')}
            {field('Versión', 'version', 'text', 'v1.0.0')}
          </div>

          {/* Tipo / ambiente / estado */}
          <div className="grid grid-cols-3 gap-3">
            {select('Tipo de Cambio', 'change_type', CHANGE_TYPES, v => TYPE_META[v]?.label ?? v)}
            {select('Ambiente', 'environment', ENVIRONMENTS)}
            {select('Estado', 'status', STATUSES, v => STATUS_META[v]?.label ?? v)}
          </div>

          {/* Categoría */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Categoría de la liberación</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map(cat => {
                const meta = CATEGORY_META[cat];
                const active = form.release_category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => set('release_category', cat)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold transition ${active ? `${meta.bg} ${meta.color} ring-1 ring-current` : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700'}`}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {field('Título *', 'title', 'text', 'Breve descripción del cambio')}
          {textarea('¿Qué se liberó?', 'description', 'Detalla qué cambios, módulos o funcionalidades se liberaron', 3)}
          {textarea('¿Por qué se realizó?', 'reason', 'Motivo o justificación del cambio', 2)}
          {textarea('Impacto esperado / real', 'impact', 'Impacto en el sistema, usuarios o procesos', 2)}
          {textarea('Plan de Rollback', 'rollback_plan', 'Pasos para revertir el cambio si falla', 2)}

          {/* Link to approved activity requesting changelog */}
          {!editing && pendingActivities.length > 0 && (
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                <Link2 size={12} />
                Vincular con actividad aprobada
              </p>
              <p className="text-xs text-slate-400">El gestor solicitó un Control de Cambios para estas actividades. Puedes vincular esta liberación a una de ellas.</p>
              <select
                value={linkedActivityId}
                onChange={e => setLinkedActivityId(e.target.value)}
                className="w-full bg-slate-700 border border-cyan-500/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">Sin vincular</option>
                {pendingActivities.map(a => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {saving && <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VersionRow({
  entry,
  currentMemberId,
  isFirst,
  isLast,
  onEdit,
  onDelete,
}: {
  entry: ChangelogEntry;
  currentMemberId: string;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (e: ChangelogEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const t = TYPE_META[entry.change_type] ?? TYPE_META.OTHER;
  const s = STATUS_META[entry.status] ?? STATUS_META.PENDING;
  const cat = CATEGORY_META[entry.release_category] ?? CATEGORY_META.OTRO;
  const SIcon = s.icon;
  const canEdit = entry.team_member_id === currentMemberId;

  return (
    <div className="flex gap-3 relative">
      {/* Timeline dot + line */}
      <div className="flex flex-col items-center shrink-0 mt-1">
        <div className={`w-3 h-3 rounded-full border-2 shrink-0 z-10 ${isFirst ? 'bg-blue-400 border-blue-400' : 'bg-slate-600 border-slate-500'}`} />
        {!isLast && <div className="w-px flex-1 bg-slate-600/60 my-1 min-h-4" />}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-3 ${isLast ? 'pb-0' : ''}`}>
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${t.bg} ${t.color}`}>{t.label}</span>
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${cat.bg} ${cat.color}`}>{cat.label}</span>
              <span className={`text-xs font-medium border px-1.5 py-0.5 rounded flex items-center gap-1 ${s.badge}`}>
                <SIcon size={10} />{s.label}
              </span>
              <span className="text-xs text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded font-mono">{entry.environment}</span>
              {entry.version && (
                <span className="text-xs text-slate-300 bg-slate-700/70 px-1.5 py-0.5 rounded font-mono flex items-center gap-1 font-semibold">
                  <Tag size={9} />{entry.version}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar size={10} />
                {new Date(entry.release_date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1"><Clock size={10} />{entry.release_time.slice(0, 5)}</span>
              {entry.member_name && !isFirst && (
                <span className="flex items-center gap-1 text-blue-400"><Users size={10} />{entry.member_name}</span>
              )}
            </div>
            {entry.description && !detailOpen && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-1">{entry.description}</p>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button onClick={() => setDetailOpen(v => !v)}
              className="p-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition">
              {detailOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {canEdit && (
              <>
                <button onClick={() => onEdit(entry)}
                  className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-700 rounded transition">
                  <Pencil size={12} />
                </button>
                <button onClick={() => onDelete(entry.id)}
                  className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition">
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </div>
        </div>

        {detailOpen && (
          <div className="mt-2 p-3 bg-slate-800/60 border border-slate-600/40 rounded-lg space-y-2">
            {entry.description && (
              <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Qué se liberó</p>
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{entry.description}</p></div>
            )}
            {entry.reason && (
              <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Por qué</p>
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{entry.reason}</p></div>
            )}
            {entry.impact && (
              <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Impacto</p>
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{entry.impact}</p></div>
            )}
            {entry.rollback_plan && (
              <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Rollback</p>
                <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{entry.rollback_plan}</p></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ServiceGroup({
  title,
  entries,
  currentMemberId,
  onEdit,
  onDelete,
}: {
  title: string;
  entries: ChangelogEntry[];
  currentMemberId: string;
  onEdit: (e: ChangelogEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const latest = entries[0];
  const type = TYPE_META[latest.change_type] ?? TYPE_META.OTHER;
  const latestStatus = STATUS_META[latest.status] ?? STATUS_META.PENDING;
  const LatestStatusIcon = latestStatus.icon;
  const hasMany = entries.length > 1;

  return (
    <div className={`rounded-xl border overflow-hidden ${type.bg}`}>
      {/* Service header */}
      <div className="flex items-start gap-3 p-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="flex items-center gap-1 text-xs font-medium text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">
              <GitBranch size={10} />
              {entries.length} {entries.length === 1 ? 'versión' : 'versiones'}
            </span>
            <span className={`text-xs font-medium border px-2 py-0.5 rounded flex items-center gap-1 ${latestStatus.badge}`}>
              <LatestStatusIcon size={11} />{latestStatus.label}
            </span>
            {latest.version && (
              <span className="text-xs text-slate-400 bg-slate-700/60 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                <Tag size={10} />última: {latest.version}
              </span>
            )}
          </div>
          <h4 className="text-white font-bold text-sm leading-snug">{title}</h4>
          {latest.member_name && (
            <p className="text-xs text-blue-400 mt-0.5 flex items-center gap-1">
              <Users size={10} />{latest.member_name}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasMany && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-slate-700/60 hover:bg-slate-700 px-2 py-1 rounded-lg transition"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expanded ? 'Colapsar' : 'Ver historial'}
            </button>
          )}
          {latest.team_member_id === currentMemberId && (
            <button onClick={() => onEdit(latest)}
              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition" title="Editar última versión">
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      {expanded && (
        <div className="border-t border-slate-600/40 px-4 pb-4 pt-3">
          {entries.map((entry, idx) => (
            <VersionRow
              key={entry.id}
              entry={entry}
              currentMemberId={currentMemberId}
              isFirst={idx === 0}
              isLast={idx === entries.length - 1}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function groupEntriesByTitle(entries: ChangelogEntry[]): { title: string; entries: ChangelogEntry[] }[] {
  const order: string[] = [];
  const map: Record<string, ChangelogEntry[]> = {};
  for (const e of entries) {
    const key = e.title.trim();
    if (!map[key]) { map[key] = []; order.push(key); }
    map[key].push(e);
  }
  return order.map(t => ({ title: t, entries: map[t] }));
}

export default function ChangelogSection({ teamId, memberId, memberName, canCreate = true }: Props) {
  const [projects, setProjects] = useState<ChangelogProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<ChangelogProject | null>(null);
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<ChangelogProject | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ChangelogEntry | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterEnv, setFilterEnv] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('changelog_projects')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });
    setProjects(data || []);
    setLoading(false);
  }, [teamId]);

  const loadEntries = useCallback(async (projectId: string) => {
    setLoadingEntries(true);
    const [{ data: eData }, { data: mData }] = await Promise.all([
      supabase.from('changelog_entries').select('*').eq('project_id', projectId)
        .order('release_date', { ascending: false }).order('release_time', { ascending: false }),
      supabase.from('team_members').select('id, name').eq('team_id', teamId),
    ]);
    const memberMap: Record<string, string> = {};
    (mData || []).forEach((m: any) => { memberMap[m.id] = m.name; });
    const enriched = (eData || []).map((e: any) => ({
      ...e,
      member_name: e.team_member_id ? (memberMap[e.team_member_id] ?? 'Desconocido') : undefined,
    }));
    setEntries(enriched);
    setLoadingEntries(false);
  }, [teamId]);

  useEffect(() => { loadProjects(); }, [loadProjects]);
  useEffect(() => { if (selectedProject) loadEntries(selectedProject.id); }, [selectedProject, loadEntries]);

  const auditLog = useCallback(async (
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    resourceId: string,
    resourceTitle: string,
    metadata: Record<string, unknown> = {}
  ) => {
    await logAudit({
      teamId,
      actorMemberId: memberId,
      actorName: memberName,
      actorType: 'collaborator',
      action,
      resourceType: 'changelog_entry',
      resourceId,
      resourceTitle,
      metadata,
    });
  }, [teamId, memberId, memberName]);

  const deleteEntry = async (id: string) => {
    if (!confirm('¿Eliminar esta entrada de la bitácora?')) return;
    const entry = entries.find(e => e.id === id);
    await supabase.from('changelog_entries').delete().eq('id', id);
    if (entry) auditLog('DELETE', id, entry.title, { environment: entry.environment, status: entry.status });
    if (selectedProject) loadEntries(selectedProject.id);
  };

  const filteredEntries = entries.filter(e => {
    const matchSearch = !search || e.title.toLowerCase().includes(search.toLowerCase()) || e.description.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'ALL' || e.change_type === filterType;
    const matchEnv = filterEnv === 'ALL' || e.environment === filterEnv;
    const matchStatus = filterStatus === 'ALL' || e.status === filterStatus;
    const matchCat = filterCategory === 'ALL' || e.release_category === filterCategory;
    return matchSearch && matchType && matchEnv && matchStatus && matchCat;
  });

  if (loading) return <div className="text-center py-16 text-slate-400">Cargando proyectos...</div>;

  return (
    <div className="flex gap-5 h-full min-h-0">
      {/* Sidebar — projects list */}
      <div className="w-64 shrink-0 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">Proyectos</h3>
          <button
            onClick={() => { setEditingProject(null); setShowProjectModal(true); }}
            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition"
            title="Nuevo proyecto"
          >
            <FolderPlus size={16} />
          </button>
        </div>

        <div className="space-y-1.5 flex-1 overflow-y-auto">
          {projects.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">
              <Folder size={32} className="mx-auto mb-2 opacity-40" />
              Sin proyectos aún
            </div>
          )}
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p)}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition flex items-center gap-2.5 group ${
                selectedProject?.id === p.id
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-sm font-medium truncate flex-1">{p.name}</span>
              <button
                onClick={e => { e.stopPropagation(); setEditingProject(p); setShowProjectModal(true); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-blue-400 transition"
              >
                <Pencil size={12} />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {!selectedProject ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-500">
              <Folder size={48} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Selecciona un proyecto para ver su bitácora</p>
              <p className="text-xs mt-1 opacity-60">o crea uno nuevo desde el panel izquierdo</p>
            </div>
          </div>
        ) : (
          <>
            {/* Project header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: selectedProject.color }} />
                <div>
                  <h2 className="text-xl font-bold text-white leading-none">{selectedProject.name}</h2>
                  {selectedProject.description && (
                    <p className="text-slate-400 text-sm mt-0.5">{selectedProject.description}</p>
                  )}
                </div>
              </div>
              {canCreate && (
                <button
                  onClick={() => { setEditingEntry(null); setShowEntryModal(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition shrink-0"
                >
                  <Plus size={15} />
                  Nueva entrada
                </button>
              )}
            </div>

            {/* Stats — clickable status filter */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {([
                { label: 'Total',      value: entries.length,                                             color: 'text-white',      activeColor: 'border-blue-500   bg-blue-500/10',   status: 'ALL'      },
                { label: 'Exitosos',   value: entries.filter(e => e.status === 'SUCCESS').length,   color: 'text-green-400',  activeColor: 'border-green-500  bg-green-500/10',  status: 'SUCCESS'  },
                { label: 'Fallidos',   value: entries.filter(e => e.status === 'FAILED').length,    color: 'text-red-400',    activeColor: 'border-red-500    bg-red-500/10',    status: 'FAILED'   },
                { label: 'Rollbacks',  value: entries.filter(e => e.status === 'ROLLBACK').length,  color: 'text-rose-400',   activeColor: 'border-rose-500   bg-rose-500/10',   status: 'ROLLBACK' },
                { label: 'Pendientes', value: entries.filter(e => e.status === 'PENDING').length,   color: 'text-yellow-400', activeColor: 'border-yellow-500 bg-yellow-500/10', status: 'PENDING'  },
              ] as const).map(s => {
                const isActive = filterStatus === s.status;
                return (
                  <button
                    key={s.label}
                    onClick={() => setFilterStatus(isActive && s.status !== 'ALL' ? 'ALL' : s.status)}
                    className={`bg-slate-800 border rounded-xl px-3 py-2.5 flex flex-col text-left transition hover:border-slate-500 ${isActive ? s.activeColor : 'border-slate-700'}`}
                  >
                    <span className="text-xs text-slate-500 mb-0.5">{s.label}</span>
                    <span className={`text-xl font-bold leading-none ${s.color}`}>{s.value}</span>
                  </button>
                );
              })}
            </div>

            {/* Filters — unified row */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex gap-2 flex-wrap items-center">
              <div className="relative flex-1 min-w-36">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <Filter size={13} className="text-slate-500 shrink-0" />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className={`border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none transition ${
                  filterStatus !== 'ALL'
                    ? `${STATUS_META[filterStatus]?.badge ?? ''} border-current`
                    : 'bg-slate-700 border-slate-600 text-white focus:border-blue-500'
                }`}
              >
                <option value="ALL">Todos los estados</option>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s]?.label ?? s}</option>)}
              </select>
              <select value={filterEnv} onChange={e => setFilterEnv(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="ALL">Todos los ambientes</option>
                {ENVIRONMENTS.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="ALL">Todos los tipos</option>
                {CHANGE_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t]?.label ?? t}</option>)}
              </select>
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                <option value="ALL">Toda categoría</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
              </select>
              {(filterStatus !== 'ALL' || filterEnv !== 'ALL' || filterType !== 'ALL' || filterCategory !== 'ALL' || search) && (
                <button
                  onClick={() => { setFilterStatus('ALL'); setFilterEnv('ALL'); setFilterType('ALL'); setFilterCategory('ALL'); setSearch(''); }}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg px-2.5 py-2 transition"
                >
                  <X size={12} />
                  Limpiar
                </button>
              )}
            </div>

            {/* Entries */}
            <div className="flex-1 overflow-y-auto space-y-3 pb-4">
              {loadingEntries ? (
                <div className="text-center py-12 text-slate-400">Cargando bitácora...</div>
              ) : filteredEntries.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <AlertCircle size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{entries.length === 0 ? 'Sin entradas aún' : 'Sin resultados para los filtros aplicados'}</p>
                  {entries.length === 0 && canCreate && (
                    <button
                      onClick={() => { setEditingEntry(null); setShowEntryModal(true); }}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition"
                    >
                      Agregar primer entrada
                    </button>
                  )}
                </div>
              ) : (
                groupEntriesByTitle(filteredEntries).map(group => (
                  <ServiceGroup
                    key={group.title}
                    title={group.title}
                    entries={group.entries}
                    currentMemberId={memberId}
                    onEdit={e => { setEditingEntry(e); setShowEntryModal(true); }}
                    onDelete={deleteEntry}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      {showProjectModal && (
        <ProjectModal
          teamId={teamId}
          memberId={memberId}
          onClose={() => setShowProjectModal(false)}
          onSaved={loadProjects}
          editing={editingProject}
        />
      )}

      {showEntryModal && selectedProject && (
        <EntryModal
          projectId={selectedProject.id}
          memberId={memberId}
          teamId={teamId}
          onClose={() => setShowEntryModal(false)}
          onSaved={() => loadEntries(selectedProject.id)}
          editing={editingEntry}
          onLog={(action, id, title, meta) => auditLog(action, id, title, meta)}
        />
      )}
    </div>
  );
}
