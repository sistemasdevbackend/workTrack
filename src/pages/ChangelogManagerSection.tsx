import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLogger';
import {
  Plus, X, Folder, FolderPlus, Clock, Tag, CheckCircle2, XCircle,
  RotateCcw, Pencil, Trash2, Filter, Search, Calendar, ChevronDown,
  ChevronUp, Users, GitCommitHorizontal, AlertCircle, Activity, GitBranch,
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
  backup_path: string;
  status: string;
  created_at: string;
  // joined
  member_name?: string;
  project_name?: string;
  project_color?: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

interface Props {
  teamId: string;
  pendingEntryId?: string | null;
  onPendingClear?: () => void;
}

const CHANGE_TYPES = ['DEPLOY', 'FEATURE', 'BUGFIX', 'HOTFIX', 'ROLLBACK', 'CONFIG', 'OTHER'];
const ENVIRONMENTS = ['PROD', 'QA', 'DEV', 'STAGING', 'UAT'];
const STATUSES = ['SUCCESS', 'FAILED', 'ROLLBACK', 'PENDING'];
const CATEGORIES = ['CODIGO', 'BASE_DE_DATOS', 'MIXTO', 'OTRO'];

const CATEGORY_META: Record<string, { label: string; color: string; bg: string }> = {
  CODIGO:        { label: 'Código',        color: 'text-blue-300',   bg: 'bg-blue-500/20 border-blue-500/40' },
  BASE_DE_DATOS: { label: 'Base de Datos', color: 'text-amber-300',  bg: 'bg-amber-500/20 border-amber-500/40' },
  MIXTO:         { label: 'Mixto',         color: 'text-teal-300',   bg: 'bg-teal-500/20 border-teal-500/40' },
  OTRO:          { label: 'Otro',          color: 'text-slate-300',  bg: 'bg-slate-500/20 border-slate-500/40' },
};

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  DEPLOY:   { label: 'Deploy',   color: 'text-blue-300',    bg: 'bg-blue-500/20 border-blue-500/40' },
  FEATURE:  { label: 'Feature',  color: 'text-emerald-300', bg: 'bg-emerald-500/20 border-emerald-500/40' },
  BUGFIX:   { label: 'Bugfix',   color: 'text-orange-300',  bg: 'bg-orange-500/20 border-orange-500/40' },
  HOTFIX:   { label: 'Hotfix',   color: 'text-red-300',     bg: 'bg-red-500/20 border-red-500/40' },
  ROLLBACK: { label: 'Rollback', color: 'text-rose-300',    bg: 'bg-rose-500/20 border-rose-500/40' },
  CONFIG:   { label: 'Config',   color: 'text-cyan-300',    bg: 'bg-cyan-500/20 border-cyan-500/40' },
  OTHER:    { label: 'Otro',     color: 'text-slate-300',   bg: 'bg-slate-500/20 border-slate-500/40' },
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
  backup_path: '',
  status: 'SUCCESS',
  team_member_id: '',
};

// ----------------------------------------------------------------
// Project Modal
// ----------------------------------------------------------------
function ProjectModal({
  teamId,
  onClose,
  onSaved,
  editing,
  onLog,
}: {
  teamId: string;
  onClose: () => void;
  onSaved: () => void;
  editing: ChangelogProject | null;
  onLog: (action: 'CREATE' | 'UPDATE' | 'DELETE', id: string, title: string) => void;
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
      onLog('UPDATE', editing.id, name.trim());
    } else {
      const { data } = await supabase.from('changelog_projects').insert({ team_id: teamId, name: name.trim(), description, color }).select('id').maybeSingle();
      onLog('CREATE', data?.id ?? '', name.trim());
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

// ----------------------------------------------------------------
// Entry Modal (manager version — can assign member)
// ----------------------------------------------------------------
function EntryModal({
  projectId,
  members,
  onClose,
  onSaved,
  editing,
  onLog,
}: {
  projectId: string;
  members: TeamMember[];
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
    backup_path: editing.backup_path ?? '',
    status: editing.status,
    team_member_id: editing.team_member_id ?? '',
  } : { ...EMPTY_ENTRY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const save = async () => {
    if (!form.title.trim()) { setError('El título es obligatorio'); return; }
    setSaving(true);
    const payload: any = { ...form, title: form.title.trim(), updated_at: new Date().toISOString() };
    if (!payload.team_member_id) payload.team_member_id = null;
    const meta = { environment: form.environment, status: form.status, change_type: form.change_type, version: form.version };
    if (editing) {
      await supabase.from('changelog_entries').update(payload).eq('id', editing.id);
      onLog('UPDATE', editing.id, form.title.trim(), meta);
    } else {
      const { data } = await supabase.from('changelog_entries').insert({ ...payload, project_id: projectId }).select('id').maybeSingle();
      onLog('CREATE', data?.id ?? '', form.title.trim(), meta);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const field = (label: string, key: string, type = 'text', placeholder = '') => (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">{label}</label>
      <input type={type} value={(form as any)[key]} onChange={e => { set(key, e.target.value); setError(''); }}
        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        placeholder={placeholder} />
    </div>
  );

  const textarea = (label: string, key: string, placeholder = '', rows = 2) => (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">{label}</label>
      <textarea value={(form as any)[key]} onChange={e => set(key, e.target.value)} rows={rows}
        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
        placeholder={placeholder} />
    </div>
  );

  const select = (label: string, key: string, options: string[], labelFn?: (v: string) => string) => (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">{label}</label>
      <select value={(form as any)[key]} onChange={e => set(key, e.target.value)}
        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
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

          <div className="grid grid-cols-3 gap-3">
            {field('Fecha *', 'release_date', 'date')}
            {field('Hora *', 'release_time', 'time')}
            {field('Versión', 'version', 'text', 'v1.0.0')}
          </div>
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

          {/* Asignar colaborador */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Colaborador responsable</label>
            <select value={form.team_member_id} onChange={e => set('team_member_id', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
              <option value="">— Sin asignar —</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {field('Título *', 'title', 'text', 'Breve descripción del cambio')}
          {textarea('¿Qué se liberó?', 'description', 'Detalla qué cambios, módulos o funcionalidades se liberaron', 3)}
          {textarea('¿Por qué se realizó?', 'reason', 'Motivo o justificación del cambio', 2)}
          {textarea('Impacto esperado / real', 'impact', 'Impacto en el sistema, usuarios o procesos', 2)}
          {textarea('Plan de Rollback', 'rollback_plan', 'Pasos para revertir el cambio si falla', 2)}

          {(form.release_category === 'CODIGO' || form.release_category === 'MIXTO') && (
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                Ruta de Backup
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={(form as any).backup_path}
                  onChange={e => set('backup_path', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 font-mono placeholder:font-sans"
                  placeholder="Ej. /backups/servicio/2026-05-19/"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </div>
              <p className="text-xs text-slate-500 mt-1">Directorio o archivo donde se guardó el respaldo del código</p>
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

// ----------------------------------------------------------------
// Entry Card
// ----------------------------------------------------------------
function EntryCard({
  entry,
  showProject,
  onEdit,
  onDelete,
}: {
  entry: ChangelogEntry;
  showProject: boolean;
  onEdit: (e: ChangelogEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const type = TYPE_META[entry.change_type] ?? TYPE_META.OTHER;
  const status = STATUS_META[entry.status] ?? STATUS_META.PENDING;
  const category = CATEGORY_META[entry.release_category] ?? CATEGORY_META.OTRO;
  const StatusIcon = status.icon;

  return (
    <div className={`rounded-lg border p-4 transition ${type.bg}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {showProject && entry.project_name && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: entry.project_color + '99' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                {entry.project_name}
              </span>
            )}
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${type.bg} ${type.color}`}>{type.label}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${category.bg} ${category.color}`}>{category.label}</span>
            <span className={`text-xs font-medium border px-2 py-0.5 rounded flex items-center gap-1 ${status.badge}`}>
              <StatusIcon size={11} />{status.label}
            </span>
            <span className="text-xs text-slate-400 bg-slate-700/60 px-2 py-0.5 rounded font-mono">{entry.environment}</span>
            {entry.version && (
              <span className="text-xs text-slate-400 bg-slate-700/60 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                <Tag size={10} />{entry.version}
              </span>
            )}
          </div>
          <h4 className="text-white font-semibold text-sm leading-snug">{entry.title}</h4>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {new Date(entry.release_date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1"><Clock size={11} />{entry.release_time.slice(0, 5)}</span>
            {entry.member_name && (
              <span className="flex items-center gap-1 text-blue-400">
                <Users size={11} />{entry.member_name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(entry)} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition"><Pencil size={14} /></button>
          <button onClick={() => onDelete(entry.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition"><Trash2 size={14} /></button>
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-600/50 space-y-3">
          {entry.description && (
            <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Qué se liberó</p>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{entry.description}</p></div>
          )}
          {entry.reason && (
            <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Por qué</p>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{entry.reason}</p></div>
          )}
          {entry.impact && (
            <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Impacto</p>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{entry.impact}</p></div>
          )}
          {entry.rollback_plan && (
            <div><p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Plan de Rollback</p>
              <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{entry.rollback_plan}</p></div>
          )}
          {entry.backup_path && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Ruta de Backup</p>
              <div className="flex items-center gap-2 bg-slate-800/70 border border-slate-600/50 rounded-lg px-3 py-2">
                <svg className="text-blue-400 shrink-0" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span className="text-sm text-blue-300 font-mono break-all">{entry.backup_path}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Service Group — groups entries with the same title as a timeline
// ----------------------------------------------------------------
function ServiceGroup({
  title,
  entries,
  showProject,
  onEdit,
  onDelete,
  highlightedEntryId,
  entryRefs,
}: {
  title: string;
  entries: ChangelogEntry[];
  showProject: boolean;
  onEdit: (e: ChangelogEntry) => void;
  onDelete: (id: string) => void;
  highlightedEntryId?: string | null;
  entryRefs?: MutableRefObject<Record<string, HTMLDivElement | null>>;
}) {
  const [expanded, setExpanded] = useState(true);
  const latest = entries[0]; // already sorted by date desc
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
            {showProject && latest.project_name && (
              <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ backgroundColor: latest.project_color + '99' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                {latest.project_name}
              </span>
            )}
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
          <button onClick={() => onEdit(latest)} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition" title="Editar última versión">
            <Pencil size={14} />
          </button>
        </div>
      </div>

      {/* Timeline of versions */}
      {expanded && (
        <div className="border-t border-slate-600/40 px-4 pb-4 pt-3 space-y-0">
          {entries.map((entry, idx) => {
            const t = TYPE_META[entry.change_type] ?? TYPE_META.OTHER;
            const s = STATUS_META[entry.status] ?? STATUS_META.PENDING;
            const cat = CATEGORY_META[entry.release_category] ?? CATEGORY_META.OTRO;
            const SIcon = s.icon;
            const isLast = idx === entries.length - 1;
            const [detailOpen, setDetailOpen] = useState(false);

            const isHighlighted = entry.id === highlightedEntryId;

            return (
              <div
                key={entry.id}
                ref={el => { entryRefs.current[entry.id] = el; }}
                className={`flex gap-3 relative rounded-xl transition-all duration-500 ${isHighlighted ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-slate-900 bg-blue-500/5' : ''}`}
              >
                {/* Timeline line */}
                <div className="flex flex-col items-center shrink-0 mt-1">
                  <div className={`w-3 h-3 rounded-full border-2 shrink-0 z-10 ${isHighlighted ? 'bg-blue-400 border-blue-400 scale-125' : idx === 0 ? 'bg-blue-400 border-blue-400' : 'bg-slate-600 border-slate-500'}`} />
                  {!isLast && <div className="w-px flex-1 bg-slate-600/60 my-1 min-h-4" />}
                </div>

                {/* Entry content */}
                <div className={`flex-1 pb-3 ${isLast ? '' : ''}`}>
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
                        {entry.member_name && idx > 0 && (
                          <span className="flex items-center gap-1 text-blue-400"><Users size={10} />{entry.member_name}</span>
                        )}
                      </div>
                      {/* Description preview */}
                      {entry.description && !detailOpen && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{entry.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={() => setDetailOpen(v => !v)}
                        className="p-1 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition">
                        {detailOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                      <button onClick={() => onEdit(entry)}
                        className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-700 rounded transition">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => onDelete(entry.id)}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded detail */}
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
                      {entry.backup_path && (
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Ruta de Backup</p>
                          <p className="text-xs text-blue-300 font-mono break-all">{entry.backup_path}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Helper: group filtered entries by title, preserving order of first appearance
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

// ----------------------------------------------------------------
// Main Manager Changelog Section
// ----------------------------------------------------------------
export default function ChangelogManagerSection({ teamId, pendingEntryId, onPendingClear }: Props) {
  const [projects, setProjects] = useState<ChangelogProject[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [allEntries, setAllEntries] = useState<ChangelogEntry[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<ChangelogProject | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ChangelogEntry | null>(null);
  const [managerName, setManagerName] = useState('');
  const [managerId, setManagerId] = useState('');
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | null>(null);
  const entryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setManagerId(data.user.id);
        setManagerName(data.user.email ?? 'Gestor');
      }
    });
  }, []);

  const auditLog = useCallback(async (
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    resourceType: 'changelog_entry' | 'changelog_project',
    resourceId: string,
    resourceTitle: string,
    metadata: Record<string, unknown> = {}
  ) => {
    await logAudit({
      teamId,
      actorId: managerId,
      actorName: managerName,
      actorType: 'manager',
      action,
      resourceType,
      resourceId,
      resourceTitle,
      metadata,
    });
  }, [teamId, managerId, managerName]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterEnv, setFilterEnv] = useState('ALL');
  const [filterMember, setFilterMember] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    const [pData, mData] = await Promise.all([
      supabase.from('changelog_projects').select('*').eq('team_id', teamId).order('created_at'),
      supabase.from('team_members').select('id, name, email').eq('team_id', teamId).order('name'),
    ]);

    const projs: ChangelogProject[] = pData.data || [];
    const mems: TeamMember[] = mData.data || [];
    setProjects(projs);
    setMembers(mems);

    if (projs.length === 0) { setAllEntries([]); setLoading(false); return; }

    const projectIds = projs.map(p => p.id);
    const { data: eData } = await supabase
      .from('changelog_entries')
      .select('*')
      .in('project_id', projectIds)
      .order('release_date', { ascending: false })
      .order('release_time', { ascending: false });

    const memberMap: Record<string, string> = {};
    mems.forEach(m => { memberMap[m.id] = m.name; });

    const projectMap: Record<string, { name: string; color: string }> = {};
    projs.forEach(p => { projectMap[p.id] = { name: p.name, color: p.color }; });

    const enriched: ChangelogEntry[] = (eData || []).map(e => ({
      ...e,
      member_name: e.team_member_id ? (memberMap[e.team_member_id] ?? 'Desconocido') : undefined,
      project_name: projectMap[e.project_id]?.name,
      project_color: projectMap[e.project_id]?.color,
    }));

    setAllEntries(enriched);
    setLoading(false);
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!pendingEntryId || allEntries.length === 0) return;
    const entry = allEntries.find(e => e.id === pendingEntryId);
    if (!entry) return;
    setSelectedProject(entry.project_id);
    setHighlightedEntryId(pendingEntryId);
    onPendingClear?.();
    setTimeout(() => {
      const el = entryRefs.current[pendingEntryId];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightedEntryId(null), 3000);
    }, 150);
  }, [pendingEntryId, allEntries]);

  const deleteEntry = async (id: string) => {
    if (!confirm('¿Eliminar esta entrada de la bitácora?')) return;
    const entry = allEntries.find(e => e.id === id);
    await supabase.from('changelog_entries').delete().eq('id', id);
    if (entry) auditLog('DELETE', 'changelog_entry', id, entry.title, { environment: entry.environment, status: entry.status });
    load();
  };

  const deleteProject = async (id: string) => {
    if (!confirm('¿Eliminar este proyecto y todas sus entradas? Esta acción no se puede deshacer.')) return;
    const proj = projects.find(p => p.id === id);
    await supabase.from('changelog_projects').delete().eq('id', id);
    if (proj) auditLog('DELETE', 'changelog_project', id, proj.name);
    if (selectedProject === id) setSelectedProject('ALL');
    load();
  };

  const currentProjectId = selectedProject === 'ALL' ? null : selectedProject;

  const filtered = allEntries.filter(e => {
    if (currentProjectId && e.project_id !== currentProjectId) return false;
    if (filterType !== 'ALL' && e.change_type !== filterType) return false;
    if (filterEnv !== 'ALL' && e.environment !== filterEnv) return false;
    if (filterStatus !== 'ALL' && e.status !== filterStatus) return false;
    if (filterMember !== 'ALL' && e.team_member_id !== filterMember) return false;
    if (filterCategory !== 'ALL' && e.release_category !== filterCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.title.toLowerCase().includes(q) && !e.description.toLowerCase().includes(q) && !(e.member_name ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const activeProject = projects.find(p => p.id === selectedProject) ?? null;

  // Stats use all entries for the current project (ignoring status filter) so counts reflect reality
  const allEntriesForStats = allEntries.filter(e => {
    if (currentProjectId && e.project_id !== currentProjectId) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <GitCommitHorizontal size={24} className="text-blue-400" />
            Control de Cambios
          </h2>
          <p className="text-slate-400 text-sm mt-1">Bitácora completa de releases y cambios por proyecto</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditingProject(null); setShowProjectModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition"
          >
            <FolderPlus size={15} />
            Nuevo proyecto
          </button>
          {projects.length > 0 && (
            <button
              onClick={() => { setEditingEntry(null); setShowEntryModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition"
            >
              <Plus size={15} />
              Nueva entrada
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">Cargando...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Folder size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-semibold text-slate-400">Sin proyectos de changelog</p>
          <p className="text-sm mt-1">Crea el primer proyecto para comenzar a registrar cambios</p>
          <button
            onClick={() => { setEditingProject(null); setShowProjectModal(true); }}
            className="mt-5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition"
          >
            Crear primer proyecto
          </button>
        </div>
      ) : (
        <>
          {/* Projects tabs */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedProject('ALL')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                selectedProject === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Activity size={14} />
              Todos los proyectos
            </button>
            {projects.map(p => (
              <div key={p.id} className="relative group">
                <button
                  onClick={() => setSelectedProject(p.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition pr-8 ${
                    selectedProject === p.id ? 'text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                  style={selectedProject === p.id ? { backgroundColor: p.color } : {}}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedProject === p.id ? 'white' : p.color }} />
                  {p.name}
                </button>
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={e => { e.stopPropagation(); setEditingProject(p); setShowProjectModal(true); }}
                    className="p-1 text-slate-300 hover:text-white bg-slate-800/80 rounded transition"
                  ><Pencil size={11} /></button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                    className="p-1 text-slate-300 hover:text-red-400 bg-slate-800/80 rounded transition"
                  ><Trash2 size={11} /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Project description if selected */}
          {activeProject?.description && (
            <p className="text-slate-400 text-sm -mt-2">{activeProject.description}</p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {([
              { label: 'Total',      value: allEntriesForStats.length,                                              color: 'text-white',      activeColor: 'border-blue-500   bg-blue-500/10',   status: 'ALL'      },
              { label: 'Exitosos',   value: allEntriesForStats.filter(e => e.status === 'SUCCESS').length,   color: 'text-green-400',  activeColor: 'border-green-500  bg-green-500/10',  status: 'SUCCESS'  },
              { label: 'Fallidos',   value: allEntriesForStats.filter(e => e.status === 'FAILED').length,    color: 'text-red-400',    activeColor: 'border-red-500    bg-red-500/10',    status: 'FAILED'   },
              { label: 'Rollbacks',  value: allEntriesForStats.filter(e => e.status === 'ROLLBACK').length,  color: 'text-rose-400',   activeColor: 'border-rose-500   bg-rose-500/10',   status: 'ROLLBACK' },
              { label: 'Pendientes', value: allEntriesForStats.filter(e => e.status === 'PENDING').length,   color: 'text-yellow-400', activeColor: 'border-yellow-500 bg-yellow-500/10', status: 'PENDING'  },
            ] as const).map(s => {
              const isActive = filterStatus === s.status;
              return (
                <button
                  key={s.label}
                  onClick={() => setFilterStatus(isActive && s.status !== 'ALL' ? 'ALL' : s.status)}
                  className={`bg-slate-800 border rounded-xl px-4 py-3 flex flex-col text-left transition hover:border-slate-500 ${
                    isActive ? s.activeColor : 'border-slate-700'
                  }`}
                >
                  <span className="text-xs text-slate-500 mb-1">{s.label}</span>
                  <span className={`text-2xl font-bold leading-none ${s.color}`}>{s.value}</span>
                </button>
              );
            })}
          </div>

          {/* Filters — all in one row including status */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-40">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <Filter size={13} className="text-slate-500 shrink-0" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className={`border rounded-lg px-3 py-2 text-sm font-medium focus:outline-none transition ${
                filterStatus !== 'ALL'
                  ? `${STATUS_META[filterStatus]?.badge ?? ''} border-current`
                  : 'bg-slate-700 border-slate-600 text-white focus:border-blue-500'
              }`}>
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
            <select value={filterMember} onChange={e => setFilterMember(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="ALL">Todos los colaboradores</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            {(filterStatus !== 'ALL' || filterEnv !== 'ALL' || filterType !== 'ALL' || filterCategory !== 'ALL' || filterMember !== 'ALL' || search) && (
              <button
                onClick={() => { setFilterStatus('ALL'); setFilterEnv('ALL'); setFilterType('ALL'); setFilterCategory('ALL'); setFilterMember('ALL'); setSearch(''); }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg px-2.5 py-2 transition"
              >
                <X size={12} />
                Limpiar
              </button>
            )}
          </div>

          {/* Entry list — grouped by service name */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <AlertCircle size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">{allEntries.length === 0 ? 'Sin entradas aún' : 'Sin resultados para los filtros aplicados'}</p>
              </div>
            ) : (
              groupEntriesByTitle(filtered).map(group => (
                <ServiceGroup
                  key={group.title}
                  title={group.title}
                  entries={group.entries}
                  showProject={selectedProject === 'ALL'}
                  onEdit={e => { setEditingEntry(e); setShowEntryModal(true); }}
                  onDelete={deleteEntry}
                  highlightedEntryId={highlightedEntryId}
                  entryRefs={entryRefs}
                />
              ))
            )}
          </div>
        </>
      )}

      {showProjectModal && (
        <ProjectModal
          teamId={teamId}
          onClose={() => setShowProjectModal(false)}
          onSaved={load}
          editing={editingProject}
          onLog={(action, id, title) => auditLog(action, 'changelog_project', id, title)}
        />
      )}

      {showEntryModal && (
        <EntryModal
          projectId={activeProject?.id ?? projects[0]?.id ?? ''}
          members={members}
          onClose={() => setShowEntryModal(false)}
          onSaved={load}
          editing={editingEntry}
          onLog={(action, id, title, meta) => auditLog(action, 'changelog_entry', id, title, meta)}
        />
      )}
    </div>
  );
}
