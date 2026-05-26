import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/auditLogger';
import ProjectCombobox from './ProjectCombobox';
import {
  BookOpen, Plus, X, ExternalLink, Search, Pencil, Trash2,
  Tag, Clock, Filter, Users, MessageSquare, Send, ChevronDown,
  ChevronUp, AlertCircle, History, GitBranch, CheckCircle2, FileText,
} from 'lucide-react';

interface DocEntry {
  id: string;
  team_id: string;
  project_name: string;
  title: string;
  version: string;
  doc_type: string;
  url: string;
  url_word: string;
  description: string;
  change_description: string;
  author_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  parent_id: string | null;
  author_name?: string;
}

interface DocComment {
  id: string;
  doc_entry_id: string;
  author_name: string;
  author_member_id: string | null;
  body: string;
  created_at: string;
}

/* A "document group" = root entry + all its child versions */
interface DocGroup {
  root: DocEntry;
  versions: DocEntry[]; // all entries with parent_id = root.id, ordered newest first
  current: DocEntry;    // the latest VIGENTE, or newest if none
}

const DOC_TYPES = ['API', 'MANUAL', 'ARQUITECTURA', 'BASE_DE_DATOS', 'PROCESO', 'OTRO'];
const STATUSES = ['VIGENTE', 'BORRADOR', 'OBSOLETO'];

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  API:           { label: 'API',           color: 'text-blue-300',   bg: 'bg-blue-500/20 border-blue-500/40' },
  MANUAL:        { label: 'Manual',        color: 'text-green-300',  bg: 'bg-green-500/20 border-green-500/40' },
  ARQUITECTURA:  { label: 'Arquitectura',  color: 'text-teal-300',   bg: 'bg-teal-500/20 border-teal-500/40' },
  BASE_DE_DATOS: { label: 'Base de Datos', color: 'text-amber-300',  bg: 'bg-amber-500/20 border-amber-500/40' },
  PROCESO:       { label: 'Proceso',       color: 'text-orange-300', bg: 'bg-orange-500/20 border-orange-500/40' },
  OTRO:          { label: 'Otro',          color: 'text-slate-300',  bg: 'bg-slate-500/20 border-slate-500/40' },
};

const STATUS_META: Record<string, { label: string; color: string; dot: string; ring: string }> = {
  VIGENTE:  { label: 'Vigente',  color: 'text-green-400',  dot: 'bg-green-500',  ring: 'ring-green-500/30' },
  BORRADOR: { label: 'Borrador', color: 'text-yellow-400', dot: 'bg-yellow-500', ring: 'ring-yellow-500/30' },
  OBSOLETO: { label: 'Obsoleto', color: 'text-red-400',    dot: 'bg-red-500',    ring: 'ring-red-500/30' },
};

const EMPTY_FORM = {
  project_name: '', title: '', version: '', doc_type: 'API',
  url: '', url_word: '', description: '', status: 'VIGENTE', change_description: '',
};

interface Props {
  teamId: string;
  memberId?: string;
  memberName?: string;
  readOnly?: boolean;
  addOnly?: boolean;
  isManager?: boolean;
  canAddVersion?: boolean;
}

/* ─── Doc Form Modal ─────────────────────────────────────────── */
function DocModal({
  teamId, memberId, onClose, onSaved, editing, newVersionOf, projects, onLog, onDocCreated,
}: {
  teamId: string;
  memberId?: string;
  onClose: () => void;
  onSaved: () => void;
  editing: DocEntry | null;
  newVersionOf: DocEntry | null; // when adding a new version to an existing doc
  projects: string[];
  onLog: (action: 'CREATE' | 'UPDATE', id: string, title: string, meta: Record<string, unknown>) => void;
  onDocCreated?: (title: string, project: string, docType: string) => void;
}) {
  const isNewVersion = !!newVersionOf;
  const [form, setForm] = useState(() => {
    if (editing) {
      return {
        project_name: editing.project_name, title: editing.title, version: editing.version,
        doc_type: editing.doc_type, url: editing.url, url_word: editing.url_word ?? '',
        description: editing.description, status: editing.status,
        change_description: editing.change_description ?? '',
      };
    }
    if (newVersionOf) {
      return {
        project_name: newVersionOf.project_name, title: newVersionOf.title, version: '',
        doc_type: newVersionOf.doc_type, url: '', url_word: '',
        description: newVersionOf.description, status: 'VIGENTE', change_description: '',
      };
    }
    return { ...EMPTY_FORM };
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.project_name.trim()) return;
    setSaving(true);

    const payload = {
      ...form,
      team_id: teamId,
      author_id: memberId || null,
      updated_at: new Date().toISOString(),
    };
    const meta = { doc_type: form.doc_type, status: form.status, project_name: form.project_name };

    if (editing) {
      await supabase.from('documentation_entries').update(payload).eq('id', editing.id);
      onLog('UPDATE', editing.id, form.title.trim(), meta);
    } else if (isNewVersion && newVersionOf) {
      // Mark the current active version (and all versions of this doc) as OBSOLETO
      const rootId = newVersionOf.parent_id ?? newVersionOf.id;
      await supabase
        .from('documentation_entries')
        .update({ status: 'OBSOLETO', updated_at: new Date().toISOString() })
        .or(`id.eq.${rootId},parent_id.eq.${rootId}`)
        .neq('status', 'OBSOLETO');

      // Insert the new version pointing to the root
      const { data } = await supabase
        .from('documentation_entries')
        .insert({ ...payload, parent_id: rootId })
        .select('id')
        .maybeSingle();
      onLog('CREATE', data?.id ?? '', form.title.trim(), { ...meta, new_version: true });
      onDocCreated?.(form.title.trim(), form.project_name, form.doc_type);
    } else {
      const { data } = await supabase
        .from('documentation_entries')
        .insert(payload)
        .select('id')
        .maybeSingle();
      onLog('CREATE', data?.id ?? '', form.title.trim(), meta);
      onDocCreated?.(form.title.trim(), form.project_name, form.doc_type);
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  const title = editing ? 'Editar documentación' : isNewVersion ? `Nueva versión · ${newVersionOf?.title}` : 'Nueva documentación';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2">
            {isNewVersion ? <GitBranch size={18} className="text-blue-400" /> : <BookOpen size={18} className="text-blue-400" />}
            <h2 className="text-base font-bold text-white">{title}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded transition"><X size={18} /></button>
        </div>

        <form id="doc-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Project (locked for new versions) */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Proyecto *</label>
            {isNewVersion ? (
              <div className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-300">{form.project_name}</div>
            ) : (
              <ProjectCombobox
                teamId={teamId}
                value={form.project_name}
                onChange={val => set('project_name', val)}
                required
                placeholder="Seleccionar o escribir proyecto..."
                className="rounded-lg"
              />
            )}
          </div>

          {/* Title (locked for new versions) */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Título *</label>
            {isNewVersion ? (
              <div className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-300">{form.title}</div>
            ) : (
              <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="Ej. Manual de integración API REST"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
            )}
          </div>

          {/* Version + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Versión</label>
              <input type="text" value={form.version} onChange={e => set('version', e.target.value)}
                placeholder="Ej. v2.1"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Estado</label>
              <select value={form.status} onChange={e => set('status', e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>
          </div>

          {/* Doc type */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">Tipo de documento</label>
            <div className="grid grid-cols-3 gap-2">
              {DOC_TYPES.map(t => {
                const meta = TYPE_META[t]; const active = form.doc_type === t;
                return (
                  <button key={t} type="button" onClick={() => set('doc_type', t)}
                    className={`px-2 py-2 rounded-lg border text-xs font-semibold transition ${active ? `${meta.bg} ${meta.color} ring-1 ring-current` : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:bg-slate-700'}`}>
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* URLs */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5 flex items-center gap-1.5">
                <ExternalLink size={11} />URL del PDF / Publicado
              </label>
              <input type="url" value={form.url} onChange={e => set('url', e.target.value)}
                placeholder="https://... (PDF o versión publicada)"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5 flex items-center gap-1.5">
                <FileText size={11} />URL del Word / Editable
              </label>
              <input type="url" value={form.url_word} onChange={e => set('url_word', e.target.value)}
                placeholder="https://... (Word o versión editable)"
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Descripción</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Breve descripción del contenido..." rows={3}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none transition" />
          </div>

          {/* Change description — shown when new version or editing existing version */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
              {isNewVersion ? 'Qué cambió en esta versión *' : 'Descripción del cambio'}
            </label>
            <textarea value={form.change_description} onChange={e => set('change_description', e.target.value)}
              placeholder={isNewVersion ? 'Ej. Se agrega el servicio Eliminar NIP, se corrige endpoint /login...' : 'Opcional: describe qué se modificó...'}
              rows={2}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none transition" />
          </div>

          {isNewVersion && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/80 leading-relaxed">
                La versión anterior quedará marcada como <strong>Obsoleta</strong>. Esta nueva versión será la vigente.
              </p>
            </div>
          )}

        </form>

        <div className="flex gap-3 px-5 py-4 border-t border-slate-700 shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            Cancelar
          </button>
          <button
            type="submit"
            form="doc-form"
            disabled={saving || !form.title.trim() || !form.project_name.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2">
            {saving && <svg className="animate-spin h-4 w-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
            {saving ? 'Guardando...' : isNewVersion ? 'Publicar nueva versión' : (editing ? 'Guardar cambios' : 'Agregar')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Doc Detail Modal ───────────────────────────────────────── */
function DocDetailModal({
  group, memberId, memberName, onClose, onEdit, onNewVersion, onDelete, canEdit, canAddVersion,
}: {
  group: DocGroup;
  memberId?: string;
  memberName?: string;
  onClose: () => void;
  onEdit: (e: DocEntry) => void;
  onNewVersion: (e: DocEntry) => void;
  onDelete: (id: string, rootId: string) => void;
  canEdit: boolean;
  canAddVersion?: boolean;
}) {
  const entry = group.current;
  const allVersions = [group.root, ...group.versions].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const [comments, setComments] = useState<DocComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentBody, setCommentBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const type = TYPE_META[entry.doc_type] ?? TYPE_META.OTRO;
  const status = STATUS_META[entry.status] ?? STATUS_META.VIGENTE;

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    // Load comments for all versions of this document (root + all children)
    const allIds = [group.root.id, ...group.versions.map(v => v.id)];
    const { data } = await supabase
      .from('doc_comments')
      .select('*')
      .in('doc_entry_id', allIds)
      .order('created_at', { ascending: true });
    setComments(data ?? []);
    setLoadingComments(false);
  }, [group.root.id, group.versions]);

  useEffect(() => { loadComments(); }, [loadComments]);

  useEffect(() => {
    if (!loadingComments) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments, loadingComments]);

  const sendComment = async () => {
    if (!commentBody.trim()) return;
    setSending(true);
    const displayName = memberName || 'Gestor';
    await supabase.from('doc_comments').insert({
      doc_entry_id: entry.id,
      team_id: entry.team_id,
      author_name: displayName,
      author_member_id: memberId ?? null,
      body: commentBody.trim(),
    });
    setCommentBody('');
    await loadComments();
    setSending(false);
  };

  const deleteComment = async (id: string) => {
    await supabase.from('doc_comments').delete().eq('id', id);
    setComments(c => c.filter(x => x.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-slate-700 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${type.bg} ${type.color}`}>{type.label}</span>
              <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ${status.color} ${status.ring} bg-slate-700/40`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />{status.label}
              </span>
              {entry.version && (
                <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                  <Tag size={10} />{entry.version}
                </span>
              )}
              {entry.project_name && (
                <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">{entry.project_name}</span>
              )}
              {allVersions.length > 1 && (
                <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded flex items-center gap-1">
                  <History size={10} />{allVersions.length} versiones
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-white leading-snug">{entry.title}</h2>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {new Date(entry.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              {entry.author_name && (
                <span className="flex items-center gap-1 text-blue-400/70">
                  <Users size={10} />{entry.author_name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {entry.url && (
              <a href={entry.url} target="_blank" rel="noopener noreferrer"
                className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition" title="Abrir PDF / Publicado">
                <ExternalLink size={15} />
              </a>
            )}
            {entry.url_word && (
              <a href={entry.url_word} target="_blank" rel="noopener noreferrer"
                className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded-lg transition" title="Abrir Word / Editable">
                <FileText size={15} />
              </a>
            )}
            {(canEdit || canAddVersion) && (
              <button onClick={() => onNewVersion(entry)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-blue-300 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 rounded-lg transition" title="Agregar nueva versión">
                <GitBranch size={12} />Nueva versión
              </button>
            )}
            {canEdit && (
              <button onClick={() => onEdit(entry)} className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition" title="Editar">
                <Pencil size={15} />
              </button>
            )}
            {(canEdit || canAddVersion) && (
              <button onClick={() => { onClose(); onDelete(entry.id, group.root.id); }} className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition" title="Eliminar">
                <Trash2 size={15} />
              </button>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 flex flex-col min-h-0">

          {/* Description */}
          {entry.description && (
            <div className="px-5 py-4 border-b border-slate-700/60">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <BookOpen size={11} />Descripción
              </p>
              <p className="text-sm text-slate-200 leading-relaxed bg-slate-700/30 rounded-xl p-3 whitespace-pre-wrap">{entry.description}</p>
            </div>
          )}

          {/* Change description for this version */}
          {entry.change_description && (
            <div className="px-5 py-3 border-b border-slate-700/60">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <GitBranch size={11} />Cambios en esta versión
              </p>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-700/20 rounded-xl px-3 py-2 whitespace-pre-wrap">{entry.change_description}</p>
            </div>
          )}

          {/* URLs */}
          {(entry.url || entry.url_word) && (
            <div className="px-5 py-3 border-b border-slate-700/60 space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Enlaces</p>
              {entry.url && (
                <a href={entry.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition group">
                  <span className="shrink-0 p-1 bg-blue-500/10 rounded group-hover:bg-blue-500/20 transition">
                    <ExternalLink size={11} />
                  </span>
                  <span className="underline underline-offset-2 truncate">PDF / Publicado</span>
                </a>
              )}
              {entry.url_word && (
                <a href={entry.url_word} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition group">
                  <span className="shrink-0 p-1 bg-cyan-500/10 rounded group-hover:bg-cyan-500/20 transition">
                    <FileText size={11} />
                  </span>
                  <span className="underline underline-offset-2 truncate">Word / Editable</span>
                </a>
              )}
            </div>
          )}

          {/* Version history */}
          {allVersions.length > 1 && (
            <div className="px-5 py-3 border-b border-slate-700/60">
              <button
                onClick={() => setShowHistory(v => !v)}
                className="flex items-center gap-2 w-full text-xs font-semibold text-slate-400 hover:text-slate-200 uppercase tracking-wide transition"
              >
                <History size={11} />Historial de versiones
                <span className="text-slate-600 normal-case font-normal">({allVersions.length})</span>
                <span className="ml-auto">{showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
              </button>

              {showHistory && (
                <div className="mt-3 space-y-0 relative">
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-slate-700" />
                  {allVersions.map((v, idx) => {
                    const vStatus = STATUS_META[v.status] ?? STATUS_META.VIGENTE;
                    const isLatest = idx === 0;
                    return (
                      <div key={v.id} className="flex items-start gap-4 pl-8 pb-4 relative">
                        <div className={`absolute left-1.5 top-1 w-3 h-3 rounded-full border-2 border-slate-800 ${isLatest && v.status === 'VIGENTE' ? 'bg-green-500' : v.status === 'OBSOLETO' ? 'bg-red-500/60' : 'bg-slate-600'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {v.version && (
                              <span className="text-xs font-mono text-slate-300 bg-slate-700/80 px-2 py-0.5 rounded">
                                {v.version}
                              </span>
                            )}
                            <span className={`text-xs font-medium ${vStatus.color}`}>{vStatus.label}</span>
                            {isLatest && <span className="text-[10px] text-green-400 font-bold uppercase tracking-wide">Actual</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <Clock size={9} />
                            {new Date(v.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {v.author_name && <><Users size={9} />{v.author_name}</>}
                          </div>
                          {v.change_description && (
                            <p className="mt-1 text-xs text-slate-400 leading-relaxed bg-slate-700/20 rounded-lg px-2 py-1">{v.change_description}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          <div className="px-5 pt-4 pb-2 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={13} className="text-slate-400" />
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Observaciones {comments.length > 0 && <span className="text-slate-500 normal-case font-normal">({comments.length})</span>}
              </p>
            </div>

            {loadingComments ? (
              <div className="text-center py-6 text-slate-500 text-xs">Cargando...</div>
            ) : comments.length === 0 ? (
              <div className="text-center py-6 bg-slate-700/20 rounded-xl border border-slate-700 border-dashed">
                <MessageSquare size={22} className="mx-auto mb-1.5 text-slate-600" />
                <p className="text-xs text-slate-500">Sin observaciones aún.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {comments.map(c => (
                  <div key={c.id} className="group flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-700/60 flex items-center justify-center text-white text-[11px] font-bold shrink-0 mt-0.5">
                      {(c.author_name ?? '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-slate-200">{c.author_name}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(c.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {(memberId === c.author_member_id || !memberId) && (
                          <button onClick={() => deleteComment(c.id)}
                            className="ml-auto opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition p-0.5 rounded">
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed bg-slate-700/30 rounded-xl px-3 py-2">{c.body}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

        </div>

        {/* Comment input — fixed at bottom outside scroll */}
        <div className="border-t border-slate-700 shrink-0 px-5 pt-3 pb-4 space-y-2">
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300/80 leading-relaxed">
              Las observaciones le avisan al autor qué debe corregir o actualizar.
            </p>
          </div>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <textarea
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendComment(); }}
                placeholder="Escribe una observación... (Ctrl+Enter para enviar)"
                rows={2}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none transition"
              />
            </div>
            <button onClick={sendComment} disabled={!commentBody.trim() || sending}
              className="p-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl transition shrink-0">
              {sending
                ? <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                : <Send size={15} />
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Doc Group Card ─────────────────────────────────────────── */
function DocGroupCard({
  group, onDetail, onEdit, onDelete, onNewVersion, readOnly, addOnly, currentMemberId, isManager, canAddVersion, commentCount,
}: {
  group: DocGroup;
  onDetail: (g: DocGroup) => void;
  onEdit: (e: DocEntry) => void;
  onDelete: (id: string, rootId: string) => void;
  onNewVersion: (e: DocEntry) => void;
  readOnly?: boolean;
  addOnly?: boolean;
  currentMemberId?: string;
  isManager?: boolean;
  canAddVersion?: boolean;
  commentCount?: number;
}) {
  const entry = group.current;
  const type = TYPE_META[entry.doc_type] ?? TYPE_META.OTRO;
  const status = STATUS_META[entry.status] ?? STATUS_META.VIGENTE;
  const versionCount = [group.root, ...group.versions].length;
  const canEdit = !readOnly && !addOnly && (isManager || entry.author_id === currentMemberId);
  const showNewVersionBtn = canEdit || (!readOnly && canAddVersion);
  const rootId = group.root.id;

  return (
    <div
      className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition cursor-pointer group/card"
      onClick={() => onDetail(group)}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${type.bg} ${type.color}`}>{type.label}</span>
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ring-1 ${status.color} ${status.ring} bg-slate-900/40`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />{status.label}
            </span>
            {entry.version && (
              <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                <Tag size={10} />{entry.version}
              </span>
            )}
            {versionCount > 1 && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <History size={10} />{versionCount} vers.
              </span>
            )}
          </div>

          <h3 className="text-sm font-semibold text-white leading-snug">{entry.title}</h3>

          {entry.change_description ? (
            <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-1 italic">"{entry.change_description}"</p>
          ) : entry.description ? (
            <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{entry.description}</p>
          ) : null}

          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {new Date(entry.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {entry.author_name && (
              <span className="flex items-center gap-1 text-blue-400/70">
                <Users size={10} />{entry.author_name}
              </span>
            )}
            {(commentCount ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-amber-400/70">
                <MessageSquare size={10} />{commentCount} obs.
              </span>
            )}
            {entry.url && (
              <span className="flex items-center gap-1 text-slate-600">
                <ExternalLink size={10} />PDF
              </span>
            )}
            {entry.url_word && (
              <span className="flex items-center gap-1 text-slate-600">
                <FileText size={10} />Word
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
          {entry.url && (
            <a href={entry.url} target="_blank" rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition" title="Abrir PDF / Publicado">
              <ExternalLink size={14} />
            </a>
          )}
          {entry.url_word && (
            <a href={entry.url_word} target="_blank" rel="noopener noreferrer"
              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 rounded transition" title="Abrir Word / Editable">
              <FileText size={14} />
            </a>
          )}
          {showNewVersionBtn && (
            <button onClick={() => onNewVersion(entry)}
              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition" title="Nueva versión">
              <GitBranch size={14} />
            </button>
          )}
          {canEdit && (
            <button onClick={() => onEdit(entry)}
              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded transition" title="Editar">
              <Pencil size={14} />
            </button>
          )}
          {(canEdit || showNewVersionBtn) && (
            <button onClick={() => onDelete(entry.id, rootId)}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition" title="Eliminar">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Obsolete versions summary strip */}
      {group.versions.some(v => v.status === 'OBSOLETO') && (
        <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center gap-2">
          <div className="flex -space-x-1">
            {[group.root, ...group.versions]
              .filter(v => v.status === 'OBSOLETO')
              .slice(0, 3)
              .map(v => (
                <span key={v.id} className="text-[10px] font-mono text-red-400/70 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                  {v.version || 'v?'}
                </span>
              ))}
          </div>
          <span className="text-[10px] text-slate-600">
            {[group.root, ...group.versions].filter(v => v.status === 'OBSOLETO').length} versión(es) obsoleta(s)
          </span>
          <CheckCircle2 size={10} className="text-green-500/50 ml-auto" />
        </div>
      )}
    </div>
  );
}

/* ─── Build Doc Groups from flat entries list ──────────────────
   Logic:
   - entries with parent_id = null are "roots"
   - entries with parent_id != null are "children" of their root
   - For backward compat: entries that have no parent but share title+project
     with others are treated individually (each is its own root)
*/
function buildGroups(entries: DocEntry[]): DocGroup[] {
  const roots = entries.filter(e => !e.parent_id);
  const childrenByParent: Record<string, DocEntry[]> = {};
  entries.filter(e => e.parent_id).forEach(e => {
    const pid = e.parent_id!;
    if (!childrenByParent[pid]) childrenByParent[pid] = [];
    childrenByParent[pid].push(e);
  });

  return roots.map(root => {
    const versions = (childrenByParent[root.id] ?? []).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    // current = most recent VIGENTE child, fallback to root
    const allByDate = [root, ...versions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const current = allByDate.find(v => v.status === 'VIGENTE') ?? allByDate[0];
    return { root, versions, current };
  });
}

/* ─── Main Section ───────────────────────────────────────────── */
export default function DocumentationSection({ teamId, memberId, memberName, readOnly = false, addOnly = false, isManager = false, canAddVersion = false }: Props) {
  const [entries, setEntries] = useState<DocEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DocEntry | null>(null);
  const [newVersionOf, setNewVersionOf] = useState<DocEntry | null>(null);
  const [detailGroup, setDetailGroup] = useState<DocGroup | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterProject, setFilterProject] = useState('ALL');
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [pendingDelete, setPendingDelete] = useState<{ id: string; rootId: string; title: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: eData }, { data: mData }] = await Promise.all([
      supabase.from('documentation_entries').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
      supabase.from('team_members').select('id, name').eq('team_id', teamId),
    ]);
    const memberMap: Record<string, string> = {};
    (mData || []).forEach((m: any) => { memberMap[m.id] = m.name; });
    const enriched: DocEntry[] = (eData || []).map((e: any) => ({
      ...e,
      author_name: e.author_id ? (memberMap[e.author_id] ?? undefined) : undefined,
      change_description: e.change_description ?? '',
      url_word: e.url_word ?? '',
    }));
    setEntries(enriched);
    setLoading(false);
  }, [teamId]);

  const loadCommentCounts = useCallback(async () => {
    const { data: commentData } = await supabase.from('doc_comments').select('doc_entry_id').eq('team_id', teamId);
    const { data: entryData } = await supabase.from('documentation_entries').select('id, parent_id').eq('team_id', teamId);
    if (!commentData || !entryData) return;
    // Build map: entryId -> rootId
    const rootOf: Record<string, string> = {};
    entryData.forEach((e: any) => { rootOf[e.id] = e.parent_id ?? e.id; });
    // Count per rootId
    const counts: Record<string, number> = {};
    commentData.forEach((r: any) => {
      const root = rootOf[r.doc_entry_id] ?? r.doc_entry_id;
      counts[root] = (counts[root] ?? 0) + 1;
    });
    setCommentCounts(counts);
  }, [teamId]);

  useEffect(() => { load(); loadCommentCounts(); }, [load, loadCommentCounts]);

  const auditLog = useCallback(async (
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    resourceId: string,
    resourceTitle: string,
    metadata: Record<string, unknown> = {}
  ) => {
    const mgr = !memberId;
    let actorId: string | undefined;
    if (mgr) { const { data } = await supabase.auth.getUser(); actorId = data.user?.id; }
    await logAudit({
      teamId, actorId: actorId ?? null, actorMemberId: memberId ?? null,
      actorName: memberName ?? 'Gestor', actorType: mgr ? 'manager' : 'collaborator',
      action, resourceType: 'doc_entry', resourceId, resourceTitle, metadata,
    });
  }, [teamId, memberId, memberName]);

  const notifyDocCreated = useCallback(async (title: string, project: string, docType: string) => {
    const { data: allMembers } = await supabase.from('team_members').select('id').eq('team_id', teamId);
    if (!allMembers?.length) return;
    const authorLabel = memberName ? ` por ${memberName}` : '';
    const typeLabel = TYPE_META[docType]?.label ?? docType;
    const targets = memberId ? allMembers.filter((m: any) => m.id !== memberId) : allMembers;
    if (!targets.length) return;
    await supabase.from('notifications').insert(
      targets.map((m: any) => ({
        team_member_id: m.id, type: 'DOC_CREATED',
        title: `Nueva documentación: ${title}`,
        body: `${typeLabel} · ${project}${authorLabel}`, read: false,
      }))
    );
  }, [teamId, memberId, memberName]);

  const handleDelete = (id: string, rootId: string) => {
    const entry = entries.find(e => e.id === id) ?? entries.find(e => e.id === rootId);
    setPendingDelete({ id, rootId, title: entry?.title ?? 'este documento' });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id, rootId } = pendingDelete;
    await supabase.from('documentation_entries').delete().eq('id', rootId);
    await supabase.from('documentation_entries').delete().eq('parent_id', rootId);
    const entry = entries.find(e => e.id === id);
    if (entry) auditLog('DELETE', id, entry.title, { doc_type: entry.doc_type, project_name: entry.project_name });
    setPendingDelete(null);
    load();
    loadCommentCounts();
  };

  const openDetail = (g: DocGroup) => setDetailGroup(g);

  const openEdit = (e: DocEntry) => {
    setDetailGroup(null);
    setNewVersionOf(null);
    setEditing(e);
    setShowModal(true);
  };

  const openNewVersion = (e: DocEntry) => {
    setDetailGroup(null);
    setEditing(null);
    setNewVersionOf(e);
    setShowModal(true);
  };

  const projects = [...new Set(entries.map(e => e.project_name).filter(Boolean))];

  const groups = buildGroups(entries);

  const filteredGroups = groups.filter(g => {
    const e = g.current;
    if (filterProject !== 'ALL' && e.project_name !== filterProject) return false;
    if (filterType !== 'ALL' && e.doc_type !== filterType) return false;
    if (filterStatus !== 'ALL' && e.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.title.toLowerCase().includes(q) &&
          !e.project_name.toLowerCase().includes(q) &&
          !(e.description ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const groupedByProject = filteredGroups.reduce((acc, g) => {
    const key = g.current.project_name || 'Sin proyecto';
    if (!acc[key]) acc[key] = [];
    acc[key].push(g);
    return acc;
  }, {} as Record<string, DocGroup[]>);

  // For stats — count only root entries + deduplicated groups
  const vigentes = groups.filter(g => g.current.status === 'VIGENTE').length;
  const borradores = groups.filter(g => g.current.status === 'BORRADOR').length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen size={20} className="text-blue-400" />Documentación
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">Repositorio centralizado de documentación técnica por proyecto</p>
        </div>
        {(!readOnly || addOnly) && (
          <button onClick={() => { setEditing(null); setNewVersionOf(null); setShowModal(true); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition shrink-0">
            <Plus size={16} />Nueva documentación
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar documentación..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
        </div>
        <Filter size={14} className="text-slate-500 shrink-0" />
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="ALL">Todos los proyectos</option>
          {projects.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="ALL">Todos los tipos</option>
          {DOC_TYPES.map(t => <option key={t} value={t}>{TYPE_META[t].label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="ALL">Todos los estados</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Documentos', value: groups.length, color: 'text-white' },
          { label: 'Vigentes', value: vigentes, color: 'text-green-400' },
          { label: 'Borradores', value: borradores, color: 'text-yellow-400' },
          { label: 'Proyectos', value: projects.length, color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-800 rounded-lg border border-slate-700 p-3">
            <p className="text-slate-400 text-xs">{label}</p>
            <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Cargando documentación...</div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{groups.length === 0 ? 'No hay documentación registrada aún.' : 'Sin resultados para los filtros aplicados.'}</p>
          {(!readOnly || addOnly) && groups.length === 0 && (
            <button onClick={() => { setEditing(null); setNewVersionOf(null); setShowModal(true); }}
              className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium transition">
              + Agregar primera documentación
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByProject).map(([project, docGroups]) => (
            <div key={project}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide">{project}</h3>
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{docGroups.length}</span>
              </div>
              <div className="space-y-2 pl-4 border-l border-slate-700/60">
                {docGroups.map(g => (
                  <DocGroupCard
                    key={g.root.id}
                    group={g}
                    onDetail={openDetail}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onNewVersion={openNewVersion}
                    readOnly={readOnly}
                    addOnly={addOnly}
                    currentMemberId={memberId}
                    isManager={isManager}
                    canAddVersion={canAddVersion || isManager || (!readOnly && !addOnly)}
                    commentCount={commentCounts[g.root.id]}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <DocModal
          teamId={teamId}
          memberId={memberId}
          onClose={() => { setShowModal(false); setEditing(null); setNewVersionOf(null); }}
          onSaved={() => { load(); loadCommentCounts(); }}
          editing={editing}
          newVersionOf={newVersionOf}
          projects={projects}
          onLog={(action, id, title, meta) => auditLog(action, id, title, meta)}
          onDocCreated={notifyDocCreated}
        />
      )}

      {detailGroup && (
        <DocDetailModal
          group={detailGroup}
          memberId={memberId}
          memberName={memberName}
          onClose={() => { setDetailGroup(null); loadCommentCounts(); }}
          onEdit={openEdit}
          onNewVersion={openNewVersion}
          onDelete={(id, rootId) => { setDetailGroup(null); handleDelete(id, rootId); }}
          canEdit={!readOnly && !addOnly && (isManager || detailGroup.current.author_id === memberId)}
          canAddVersion={canAddVersion || isManager || (!readOnly && !addOnly)}
        />
      )}

      {pendingDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Eliminar documentación</h3>
                <p className="text-slate-400 text-xs mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              ¿Eliminar <span className="font-semibold text-white">"{pendingDelete.title}"</span>?
              Se eliminará también todo el historial de versiones.
            </p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setPendingDelete(null)}
                className="flex-1 px-4 py-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition">
                Cancelar
              </button>
              <button onClick={confirmDelete}
                className="flex-1 px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
