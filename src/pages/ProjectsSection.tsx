import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  Layers, Plus, X, ChevronDown, ChevronUp, Clock,
  CheckCircle2, PauseCircle, XCircle, TrendingUp, MessageSquare, AlertCircle,
  Calendar, Pencil, Trash2, BarChart3, FolderPlus, MoreVertical,
  ListTodo, CircleDot, ImagePlus, ZoomIn, Download, FileSpreadsheet, Check as CheckIcon,
} from 'lucide-react';

interface ProjectStatusLog {
  id: string;
  team_id: string;
  project_name: string;
  overall_status: string;
  comment: string;
  logged_by: string;
  logged_at: string;
  image_urls?: string[];
}

interface ActivitySummary {
  id: string;
  title: string;
  status: string;
}

interface ProjectSummary {
  name: string;
  latestLog: ProjectStatusLog | null;
  logs: ProjectStatusLog[];
  activityCount: number;
  activities: ActivitySummary[];
}

interface WeeklyCheckProject {
  name: string;
  latestStatus: string;
}

const STATUS_OPTIONS = [
  { value: 'DEVELOPING', label: 'En Desarrollo', icon: TrendingUp,   color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/40',   dot: 'bg-blue-400' },
  { value: 'AT_RISK',    label: 'En Riesgo',     icon: AlertCircle,  color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/40', dot: 'bg-amber-400' },
  { value: 'ON_HOLD',    label: 'En Pausa',      icon: PauseCircle,  color: 'text-slate-400',  bg: 'bg-slate-500/15 border-slate-500/40', dot: 'bg-slate-400' },
  { value: 'COMPLETED',  label: 'Completado',    icon: CheckCircle2, color: 'text-emerald-400',bg: 'bg-emerald-500/15 border-emerald-500/40', dot: 'bg-emerald-400' },
  { value: 'CANCELLED',  label: 'Cancelado',     icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/40',     dot: 'bg-red-400' },
];

function statusMeta(value: string) {
  return STATUS_OPTIONS.find(s => s.value === value) ?? STATUS_OPTIONS[0];
}

function isThisWeek(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return d >= mon && d <= sun;
}

// ─── New / Rename Project Modal ───────────────────────────────────
function ProjectFormModal({
  teamId,
  editing,
  existingNames,
  onClose,
  onSaved,
}: {
  teamId: string;
  editing: string | null; // null = new, string = current name to rename
  existingNames: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(editing ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('El nombre es obligatorio'); return; }
    const duplicate = existingNames.find(n => n.toLowerCase() === trimmed.toLowerCase() && n !== editing);
    if (duplicate) { setError('Ya existe un proyecto con ese nombre'); return; }
    setSaving(true);
    if (editing) {
      // Rename: insert new + update references + delete old
      await supabase.from('team_projects').upsert({ team_id: teamId, name: trimmed }, { onConflict: 'team_id,name', ignoreDuplicates: true });
      // Update all references in activities, changelog, status logs
      await Promise.all([
        supabase.from('activities').update({ project: trimmed }).eq('team_id', teamId).eq('project', editing),
        supabase.from('project_status_logs').update({ project_name: trimmed }).eq('team_id', teamId).eq('project_name', editing),
        supabase.from('changelog_projects').update({ name: trimmed }).eq('team_id', teamId).eq('name', editing),
      ]);
      await supabase.from('team_projects').delete().eq('team_id', teamId).eq('name', editing);
    } else {
      await supabase.from('team_projects').upsert({ team_id: teamId, name: trimmed }, { onConflict: 'team_id,name', ignoreDuplicates: true });
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-white font-bold text-sm flex items-center gap-2">
            <FolderPlus size={16} className="text-blue-400" />
            {editing ? 'Renombrar proyecto' : 'Nuevo proyecto'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded transition"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Nombre del proyecto *</label>
            <input
              ref={inputRef}
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && save()}
              placeholder="Ej. Sitio de Crédito"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 placeholder-slate-500"
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
          </div>
          {editing && (
            <p className="text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              El nombre se actualizara en actividades, control de cambios y bitacora de estatus.
            </p>
          )}
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition">Cancelar</button>
          <button onClick={save} disabled={saving || !name.trim()}
            className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
            {editing ? 'Renombrar' : 'Crear proyecto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Weekly Check Modal ───────────────────────────────────────────
function WeeklyCheckModal({
  projects,
  userId,
  teamId,
  onClose,
  onSaved,
}: {
  projects: WeeklyCheckProject[];
  userId: string;
  teamId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [entries, setEntries] = useState<{ name: string; status: string; comment: string; files: File[]; previews: string[] }[]>(
    projects.map(p => ({ name: p.name, status: p.latestStatus, comment: '', files: [], previews: [] }))
  );
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const current = entries[step];
  const setField = (key: 'status' | 'comment', val: string) => {
    setEntries(prev => prev.map((e, i) => i === step ? { ...e, [key]: val } : e));
  };
  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    setEntries(prev => prev.map((e, i) => {
      if (i !== step) return e;
      const next = [...e.files, ...valid].slice(0, 5);
      return { ...e, files: next, previews: next.map(f => URL.createObjectURL(f)) };
    }));
  };
  const removePending = (fi: number) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== step) return e;
      const next = e.files.filter((_, idx) => idx !== fi);
      return { ...e, files: next, previews: next.map(f => URL.createObjectURL(f)) };
    }));
  };

  const uploadImages = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const path = `project-logs/${teamId}/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
      const { error } = await supabase.storage.from('comment-images').upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from('comment-images').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const saveAll = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const rows = await Promise.all(entries.map(async e => ({
      team_id: teamId,
      project_name: e.name,
      overall_status: e.status,
      comment: e.comment.trim(),
      image_urls: await uploadImages(e.files),
      logged_by: userId,
      logged_at: now,
    })));
    await supabase.from('project_status_logs').insert(rows);
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <>
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-white font-bold text-base flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-400" />
              Actualización semanal de proyectos
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">
              Proyecto {step + 1} de {entries.length}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded transition"><X size={18} /></button>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5 px-6 pt-4">
          {entries.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? 'bg-blue-500' : i === step ? 'bg-blue-400' : 'bg-slate-700'}`} />
          ))}
        </div>

        {/* Current project */}
        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Proyecto</p>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
              <Layers size={14} className="text-blue-400 shrink-0" />
              <span className="text-white font-semibold text-sm">{current.name}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Estado general</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {STATUS_OPTIONS.map(s => {
                const Icon = s.icon;
                const active = current.status === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setField('status', s.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition ${
                      active ? `${s.bg} ${s.color} ring-1 ring-current` : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    <Icon size={13} />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Comentario de estatus</p>
            <textarea
              value={current.comment}
              onChange={e => setField('comment', e.target.value)}
              rows={3}
              placeholder="¿Cómo va el proyecto esta semana? Avances, bloqueos, próximos pasos..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Images */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Imágenes <span className="normal-case font-normal text-slate-600">(opcional)</span>
            </p>
            {current.previews.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {current.previews.map((src, i) => (
                  <div key={i} className="relative group">
                    <img src={src} alt="" className="w-14 h-14 object-cover rounded-lg border border-blue-600/50 cursor-pointer" onClick={() => setLightbox(src)} />
                    <button onClick={() => removePending(i)}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {current.files.length < 5 && (
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-600 hover:border-blue-500/60 cursor-pointer transition group">
                <ImagePlus size={14} className="text-slate-500 group-hover:text-blue-400 transition shrink-0" />
                <span className="text-xs text-slate-500 group-hover:text-slate-300 transition">Adjuntar imágenes</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition">
            Omitir
          </button>
          <div className="flex-1" />
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="px-4 py-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition">
              Anterior
            </button>
          )}
          {step < entries.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="px-5 py-2 text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition font-medium">
              Siguiente
            </button>
          ) : (
            <button onClick={saveAll} disabled={saving}
              className="px-5 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition font-medium disabled:opacity-60 flex items-center gap-2">
              {saving && <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
              Guardar todo
            </button>
          )}
        </div>
      </div>
    </div>
    {lightbox && (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4" onClick={() => setLightbox(null)}>
        <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition"><X size={22} /></button>
        <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
      </div>
    )}
    </>
  );
}

// ─── Add/Edit Status Log Modal ─────────────────────────────────────
function StatusLogModal({
  projectName, teamId, userId, editing, onClose, onSaved,
}: {
  projectName: string; teamId: string; userId: string;
  editing: ProjectStatusLog | null; onClose: () => void; onSaved: () => void;
}) {
  const [status, setStatus] = useState(editing?.overall_status ?? 'DEVELOPING');
  const [comment, setComment] = useState(editing?.comment ?? '');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [existingUrls, setExistingUrls] = useState<string[]>(editing?.image_urls ?? []);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 5 - pendingFiles.length);
    const next = [...pendingFiles, ...valid].slice(0, 5);
    setPendingFiles(next);
    setPreviews(next.map(f => URL.createObjectURL(f)));
  };

  const removeExisting = (url: string) => setExistingUrls(u => u.filter(x => x !== url));
  const removePending  = (i: number) => {
    const next = pendingFiles.filter((_, idx) => idx !== i);
    setPendingFiles(next);
    setPreviews(next.map(f => URL.createObjectURL(f)));
  };

  const uploadImages = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of pendingFiles) {
      const path = `project-logs/${teamId}/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
      const { error } = await supabase.storage.from('comment-images').upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from('comment-images').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const save = async () => {
    if (!comment.trim() && existingUrls.length === 0 && pendingFiles.length === 0) return;
    setSaving(true);
    const newUrls = await uploadImages();
    const allUrls = [...existingUrls, ...newUrls];
    if (editing) {
      await supabase.from('project_status_logs')
        .update({ overall_status: status, comment: comment.trim(), image_urls: allUrls, logged_at: new Date().toISOString() })
        .eq('id', editing.id);
    } else {
      await supabase.from('project_status_logs').insert({
        team_id: teamId, project_name: projectName, overall_status: status,
        comment: comment.trim(), image_urls: allUrls, logged_by: userId, logged_at: new Date().toISOString(),
      });
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  const canSave = !saving && (comment.trim().length > 0 || existingUrls.length > 0 || pendingFiles.length > 0);

  return (
    <>
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <div>
            <h2 className="text-white font-bold text-sm">{editing ? 'Editar actualización' : 'Nueva actualización'}</h2>
            <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1"><Layers size={11} />{projectName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded transition"><X size={18} /></button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Estado general</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {STATUS_OPTIONS.map(s => {
                const Icon = s.icon;
                const active = status === s.value;
                return (
                  <button key={s.value} type="button" onClick={() => setStatus(s.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition ${
                      active ? `${s.bg} ${s.color} ring-1 ring-current` : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                    }`}>
                    <Icon size={13} />{s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Comentario</p>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={4}
              placeholder="¿Cómo va el proyecto? Avances, bloqueos, próximos pasos..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none" />
          </div>

          {/* Images */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
              Imágenes <span className="normal-case font-normal text-slate-600">(hasta 5)</span>
            </p>

            {/* Existing images when editing */}
            {existingUrls.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {existingUrls.map(url => (
                  <div key={url} className="relative group">
                    <img src={url} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-600 cursor-pointer" onClick={() => setLightbox(url)} />
                    <button onClick={() => removeExisting(url)}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <X size={10} />
                    </button>
                    <button onClick={() => setLightbox(url)}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-lg">
                      <ZoomIn size={14} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Pending previews */}
            {previews.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative group">
                    <img src={src} alt="" className="w-16 h-16 object-cover rounded-lg border border-blue-600/50" />
                    <button onClick={() => removePending(i)}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {(existingUrls.length + pendingFiles.length) < 5 && (
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-600 hover:border-blue-500/60 cursor-pointer transition group">
                <ImagePlus size={15} className="text-slate-500 group-hover:text-blue-400 transition shrink-0" />
                <span className="text-xs text-slate-500 group-hover:text-slate-300 transition">Adjuntar imágenes · Ctrl+V para pegar</span>
                <input type="file" accept="image/*" multiple className="hidden"
                  onChange={e => addFiles(e.target.files)} />
              </label>
            )}
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5 shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition">Cancelar</button>
          <button onClick={save} disabled={!canSave}
            className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
            Guardar
          </button>
        </div>
      </div>
    </div>

    {/* Lightbox */}
    {lightbox && (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4" onClick={() => setLightbox(null)}>
        <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition"><X size={22} /></button>
        <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
      </div>
    )}
    </>
  );
}

// ─── Project Card ──────────────────────────────────────────────────
const ACTIVITY_STATUS_META: Record<string, { dot: string; label: string }> = {
  PENDING:        { dot: 'bg-red-400',     label: 'Pendiente' },
  IN_PROGRESS:    { dot: 'bg-yellow-400',  label: 'En proceso' },
  NEEDS_REVISION: { dot: 'bg-orange-400',  label: 'Corrección' },
  APPROVED:       { dot: 'bg-emerald-400', label: 'Aprobada' },
  DONE:           { dot: 'bg-slate-400',   label: 'Terminada' },
};

function ProjectCard({
  project,
  userId,
  teamId,
  allProjectNames,
  onLogUpdated,
  readOnly = false,
}: {
  project: ProjectSummary;
  userId: string;
  teamId: string;
  allProjectNames: string[];
  onLogUpdated: () => void;
  readOnly?: boolean;
}) {
  const [showLogs, setShowLogs] = useState(false);
  const [showActivities, setShowActivities] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingLog, setEditingLog] = useState<ProjectStatusLog | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const deleteProject = async () => {
    setDeleting(true);
    await supabase.from('team_projects').delete().eq('team_id', teamId).eq('name', project.name);
    setDeleting(false);
    setConfirmDelete(false);
    setShowMenu(false);
    onLogUpdated();
  };

  const latest = project.latestLog;
  const sm = latest ? statusMeta(latest.overall_status) : null;
  const StatusIcon = sm?.icon ?? Layers;

  const deleteLog = async (id: string) => {
    setDeletingLogId(null);
    await supabase.from('project_status_logs').delete().eq('id', id);
    onLogUpdated();
  };

  return (
    <div className="bg-slate-800/70 border border-slate-700 rounded-xl hover:border-slate-600 transition">
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Layers size={16} className="text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-sm leading-snug truncate">{project.name}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {sm ? (
                <span className={`flex items-center gap-1 text-xs font-medium border px-2 py-0.5 rounded-full ${sm.bg} ${sm.color}`}>
                  <StatusIcon size={11} />{sm.label}
                </span>
              ) : (
                <span className="text-xs text-slate-500 italic">Sin estatus</span>
              )}
              <span className="text-xs text-slate-500">{project.activityCount} actividad{project.activityCount !== 1 ? 'es' : ''}</span>
              {project.logs.length > 0 && (
                <span className="text-xs text-slate-500 flex items-center gap-0.5">
                  <MessageSquare size={10} />{project.logs.length} actualizacion{project.logs.length !== 1 ? 'es' : ''}
                </span>
              )}
            </div>
            {latest?.comment && (
              <p className="text-xs text-slate-400 mt-2 line-clamp-2 leading-relaxed">{latest.comment}</p>
            )}
            {latest && (
              <p className="text-xs text-slate-600 mt-1 flex items-center gap-1">
                <Calendar size={10} />
                {new Date(latest.logged_at).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!readOnly && (
              <button onClick={() => { setEditingLog(null); setShowModal(true); }}
                className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded-lg transition" title="Nueva actualización">
                <Plus size={15} />
              </button>
            )}
            {project.activities.length > 0 && (
              <button onClick={() => setShowActivities(v => !v)}
                className={`p-1.5 rounded-lg transition ${showActivities ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-700'}`}
                title="Ver actividades">
                <ListTodo size={15} />
              </button>
            )}
            {project.logs.length > 0 && (
              <button onClick={() => setShowLogs(v => !v)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition">
                {showLogs ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
            )}
            {!readOnly && (
              <div ref={menuRef} className="relative">
                <button onClick={() => setShowMenu(v => !v)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition">
                  <MoreVertical size={15} />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden">
                    <button onClick={() => { setShowRename(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition">
                      <Pencil size={12} />Renombrar
                    </button>
                    <button onClick={() => { setConfirmDelete(true); setShowMenu(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-900/30 transition border-t border-slate-700">
                      <Trash2 size={12} />Eliminar del catálogo
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activities list */}
      {showActivities && project.activities.length > 0 && (
        <div className="border-t border-slate-700/60 rounded-b-xl overflow-hidden">
          <div className="px-4 py-2 flex items-center gap-2 bg-slate-800/30">
            <ListTodo size={12} className="text-emerald-400" />
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
              Actividades asignadas ({project.activities.length})
            </span>
          </div>
          <div className="divide-y divide-slate-700/30">
            {project.activities.map(act => {
              const sm = ACTIVITY_STATUS_META[act.status] ?? { dot: 'bg-slate-500', label: act.status };
              return (
                <div key={act.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-800/30 transition">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${sm.dot}`} />
                  <p className="text-xs text-slate-300 flex-1 leading-snug">{act.title}</p>
                  <span className="text-[10px] text-slate-500 shrink-0">{sm.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Log history */}
      {showLogs && project.logs.length > 0 && (
        <div className="border-t border-slate-700/60 divide-y divide-slate-700/40 rounded-b-xl overflow-hidden">
          {project.logs.map((log, idx) => {
            const s = statusMeta(log.overall_status);
            const SIcon = s.icon;
            return (
              <div key={log.id} className={`px-4 py-3 ${idx === 0 ? 'bg-slate-800/40' : ''}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`flex items-center gap-1 text-xs font-medium border px-1.5 py-0.5 rounded ${s.bg} ${s.color}`}>
                        <SIcon size={10} />{s.label}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(log.logged_at).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {idx === 0 && <span className="text-xs text-blue-400 font-medium">Más reciente</span>}
                    </div>
                    {log.comment && (
                      <p className="text-xs text-slate-300 mt-1.5 leading-relaxed whitespace-pre-wrap">{log.comment}</p>
                    )}
                    {log.image_urls && log.image_urls.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mt-2">
                        {log.image_urls.map((url, ii) => (
                          <button key={ii} onClick={() => setLightboxUrl(url)}
                            className="relative group overflow-hidden rounded-lg border border-slate-600 hover:border-blue-500/60 transition">
                            <img src={url} alt="" className="w-14 h-14 object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                              <ZoomIn size={14} className="text-white" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {!readOnly && (
                    <div className="flex gap-0.5 shrink-0">
                      <button onClick={() => { setEditingLog(log); setShowModal(true); }}
                        className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-700 rounded transition">
                        <Pencil size={12} />
                      </button>
                      <button onClick={() => setDeletingLogId(log.id)}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <StatusLogModal
          projectName={project.name}
          teamId={teamId}
          userId={userId}
          editing={editingLog}
          onClose={() => setShowModal(false)}
          onSaved={onLogUpdated}
        />
      )}

      {showRename && (
        <ProjectFormModal
          teamId={teamId}
          editing={project.name}
          existingNames={allProjectNames}
          onClose={() => setShowRename(false)}
          onSaved={onLogUpdated}
        />
      )}

      {/* Confirm delete project modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Eliminar proyecto</h3>
                <p className="text-slate-400 text-xs mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">
              ¿Eliminar <span className="font-semibold text-white">"{project.name}"</span> del catálogo?
              Las actividades existentes conservarán el nombre del proyecto.
            </p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setConfirmDelete(false)}
                className="flex-1 px-4 py-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition">
                Cancelar
              </button>
              <button onClick={deleteProject} disabled={deleting}
                className="flex-1 px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting && <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete log modal */}
      {deletingLogId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">Eliminar actualización</h3>
                <p className="text-slate-400 text-xs mt-0.5">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm text-slate-300">¿Seguro que deseas eliminar esta entrada de la bitácora?</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setDeletingLogId(null)}
                className="flex-1 px-4 py-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition">
                Cancelar
              </button>
              <button onClick={() => deleteLog(deletingLogId)}
                className="flex-1 px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition flex items-center justify-center gap-2">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition"><X size={22} /></button>
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// ─── Export Modal ──────────────────────────────────────────────────
const STATUS_COLOR_HEX: Record<string, string> = {
  DEVELOPING: '#1e40af',
  AT_RISK:    '#b45309',
  ON_HOLD:    '#475569',
  COMPLETED:  '#065f46',
  CANCELLED:  '#991b1b',
};
const STATUS_BG_HEX: Record<string, string> = {
  DEVELOPING: '#dbeafe',
  AT_RISK:    '#fef3c7',
  ON_HOLD:    '#f1f5f9',
  COMPLETED:  '#d1fae5',
  CANCELLED:  '#fee2e2',
};

function ExportModal({
  projects,
  onClose,
}: {
  projects: ProjectSummary[];
  onClose: () => void;
}) {
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set(projects.map(p => p.name)));
  const [includeAllLogs, setIncludeAllLogs] = useState(false);
  const [includeActivities, setIncludeActivities] = useState(true);

  const toggleProject = (name: string) => {
    setSelectedProjects(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedProjects.size === projects.length) setSelectedProjects(new Set());
    else setSelectedProjects(new Set(projects.map(p => p.name)));
  };

  const doExport = () => {
    const chosen = projects.filter(p => selectedProjects.has(p.name));

    const headerStyle = 'background:#1e3a5f;color:#ffffff;font-weight:bold;border:1px solid #1e40af;padding:9px 12px;white-space:nowrap;font-size:13px;';
    const sectionStyle = 'background:#1e3a5f;color:#93c5fd;font-weight:bold;border:1px solid #1e40af;padding:8px 12px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;';

    const cellBase = 'border:1px solid #bfdbfe;padding:7px 11px;vertical-align:top;font-size:13px;';
    const cell = (val: string, bg = '#eff6ff') => `<td style="${cellBase}background:${bg};">${val.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>')}</td>`;
    const statusCell = (status: string) => {
      const meta = statusMeta(status);
      const bg = STATUS_BG_HEX[status] ?? '#f1f5f9';
      const fg = STATUS_COLOR_HEX[status] ?? '#334155';
      return `<td style="${cellBase}background:${bg};"><span style="color:${fg};font-weight:600;">${meta.label}</span></td>`;
    };

    let rows = '';

    // Summary section header
    rows += `<tr><td colspan="6" style="${sectionStyle}">Resumen de proyectos</td></tr>`;
    rows += `<tr>
      ${['Proyecto','Estatus actual','Actividades','Última actualización','Comentario más reciente','Registros de bitácora'].map(h => `<th style="${headerStyle}">${h}</th>`).join('')}
    </tr>`;

    chosen.forEach((p, i) => {
      const bg = i % 2 === 0 ? '#eff6ff' : '#dbeafe';
      const status = p.latestLog?.overall_status ?? '—';
      const lastDate = p.latestLog ? new Date(p.latestLog.logged_at).toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' }) : '—';
      const comment = p.latestLog?.comment ?? '—';
      rows += `<tr>
        ${cell(p.name, bg)}
        ${p.latestLog ? statusCell(status) : cell('Sin estatus', bg)}
        ${cell(String(p.activityCount), bg)}
        ${cell(lastDate, bg)}
        ${cell(comment, bg)}
        ${cell(String(p.logs.length), bg)}
      </tr>`;
    });

    // Bitácora detail section
    rows += `<tr><td colspan="6" style="padding:8px;"></td></tr>`;
    rows += `<tr><td colspan="6" style="${sectionStyle}">Bitácora de actualizaciones</td></tr>`;
    rows += `<tr>
      ${['Proyecto','Estatus','Fecha y hora','Comentario'].map(h => `<th style="${headerStyle}">${h}</th>`).join('')}
      <td style="${headerStyle}" colspan="2"></td>
    </tr>`;

    chosen.forEach(p => {
      const logs = includeAllLogs ? p.logs : (p.latestLog ? [p.latestLog] : []);
      if (logs.length === 0) {
        rows += `<tr>
          ${cell(p.name,'#f8fafc')}
          ${cell('Sin registros','#f8fafc')}
          ${cell('—','#f8fafc')}
          ${cell('—','#f8fafc')}
          <td colspan="2" style="${cellBase}background:#f8fafc;"></td>
        </tr>`;
        return;
      }
      logs.forEach((log, i) => {
        const bg = i % 2 === 0 ? '#eff6ff' : '#dbeafe';
        const dt = new Date(log.logged_at).toLocaleString('es-MX', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
        rows += `<tr>
          ${cell(i === 0 ? p.name : '', bg)}
          ${statusCell(log.overall_status)}
          ${cell(dt, bg)}
          ${cell(log.comment, bg)}
          <td colspan="2" style="${cellBase}background:${bg};"></td>
        </tr>`;
      });
    });

    // Activities section
    if (includeActivities) {
      rows += `<tr><td colspan="6" style="padding:8px;"></td></tr>`;
      rows += `<tr><td colspan="6" style="${sectionStyle}">Actividades por proyecto</td></tr>`;
      rows += `<tr>
        ${['Proyecto','Actividad','Estatus'].map(h => `<th style="${headerStyle}">${h}</th>`).join('')}
        <td colspan="3" style="${headerStyle}"></td>
      </tr>`;
      const ACT_STATUS: Record<string,string> = { PENDING:'Pendiente', IN_PROGRESS:'En progreso', APPROVED:'Aprobado', COMPLETED:'Completado', NEEDS_REVISION:'Necesita revisión', CANCELLED:'Cancelado' };
      chosen.forEach(p => {
        if (p.activities.length === 0) return;
        p.activities.forEach((a, i) => {
          const bg = i % 2 === 0 ? '#eff6ff' : '#dbeafe';
          rows += `<tr>
            ${cell(i === 0 ? p.name : '', bg)}
            ${cell(a.title, bg)}
            ${cell(ACT_STATUS[a.status] ?? a.status, bg)}
            <td colspan="3" style="${cellBase}background:${bg};"></td>
          </tr>`;
        });
      });
    }

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Proyectos</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body><table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;">${rows}</table></body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `proyectos-${new Date().toLocaleDateString('es-MX',{month:'short',year:'numeric'}).replace(' ','-')}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  const allSelected = selectedProjects.size === projects.length;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Exportar proyectos</h3>
              <p className="text-slate-400 text-xs">Genera un archivo Excel con la información seleccionada</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        {/* Options */}
        <div className="px-6 py-4 space-y-5 overflow-y-auto flex-1">
          {/* What to include */}
          <div className="space-y-2">
            <p className="text-slate-300 text-sm font-semibold">Contenido a exportar</p>
            <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer hover:border-blue-500/50 transition">
              <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition ${includeAllLogs ? 'bg-blue-600 border-blue-600' : 'border-slate-600 bg-slate-700'}`}
                onClick={() => setIncludeAllLogs(v => !v)}>
                {includeAllLogs && <CheckIcon size={12} className="text-white" />}
              </div>
              <div>
                <p className="text-white text-sm font-medium">Historial completo de bitácora</p>
                <p className="text-slate-400 text-xs">Incluye todos los registros de cada proyecto. Si está desactivado, solo se exporta el más reciente.</p>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 border border-slate-700 cursor-pointer hover:border-blue-500/50 transition">
              <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition ${includeActivities ? 'bg-blue-600 border-blue-600' : 'border-slate-600 bg-slate-700'}`}
                onClick={() => setIncludeActivities(v => !v)}>
                {includeActivities && <CheckIcon size={12} className="text-white" />}
              </div>
              <div>
                <p className="text-white text-sm font-medium">Actividades por proyecto</p>
                <p className="text-slate-400 text-xs">Agrega una sección con el listado de actividades y su estatus.</p>
              </div>
            </label>
          </div>

          {/* Project selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-slate-300 text-sm font-semibold">Proyectos a incluir</p>
              <button onClick={toggleAll} className="text-xs text-blue-400 hover:text-blue-300 transition">
                {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {projects.map(p => {
                const checked = selectedProjects.has(p.name);
                const meta = p.latestLog ? statusMeta(p.latestLog.overall_status) : null;
                return (
                  <button key={p.name} onClick={() => toggleProject(p.name)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition ${checked ? 'bg-blue-600/10 border-blue-500/40' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}>
                    <div className={`w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 transition ${checked ? 'bg-blue-600 border-blue-600' : 'border-slate-600'}`}>
                      {checked && <CheckIcon size={12} className="text-white" />}
                    </div>
                    <span className="text-white text-sm flex-1 truncate">{p.name}</span>
                    {meta && (
                      <span className={`text-xs font-medium shrink-0 ${meta.color}`}>{meta.label}</span>
                    )}
                    {!meta && <span className="text-xs text-slate-500 shrink-0">Sin estatus</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-between gap-3">
          <p className="text-slate-400 text-xs">{selectedProjects.size} de {projects.length} proyectos seleccionados</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition">
              Cancelar
            </button>
            <button
              onClick={doExport}
              disabled={selectedProjects.size === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition font-semibold"
            >
              <Download size={14} />
              Descargar Excel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Section ──────────────────────────────────────────────────
export default function ProjectsSection({ teamId, userId, readOnly = false }: { teamId: string; userId: string; readOnly?: boolean }) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWeeklyCheck, setShowWeeklyCheck] = useState(false);
  const [weeklyProjects, setWeeklyProjects] = useState<WeeklyCheckProject[]>([]);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showNewProject, setShowNewProject] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const [{ data: projectRows }, { data: logs }, { data: activities }] = await Promise.all([
      supabase.from('team_projects').select('name').eq('team_id', teamId).order('name'),
      supabase.from('project_status_logs').select('*').eq('team_id', teamId).order('logged_at', { ascending: false }),
      supabase.from('activities').select('id, title, status, project').eq('team_id', teamId).neq('status', 'CANCELLED'),
    ]);

    const allLogs: ProjectStatusLog[] = logs ?? [];
    const activityList: { id: string; title: string; status: string; project: string }[] = activities ?? [];

    const summaries: ProjectSummary[] = (projectRows ?? []).map(p => {
      const pLogs = allLogs.filter(l => l.project_name === p.name);
      const pActivities = activityList.filter(a => a.project === p.name);
      return {
        name: p.name,
        latestLog: pLogs[0] ?? null,
        logs: pLogs,
        activityCount: pActivities.length,
        activities: pActivities.map(a => ({ id: a.id, title: a.title, status: a.status })),
      };
    });

    setProjects(summaries);
    setLoading(false);

    // Check if weekly prompt is needed: Monday + any DEVELOPING projects without update this week
    const today = new Date();
    const isMonday = today.getDay() === 1;
    const developingWithoutUpdate = summaries.filter(p => {
      const latest = p.latestLog;
      if (!latest) return p.activityCount > 0; // has activities but no status ever
      if (latest.overall_status !== 'DEVELOPING') return false;
      return !isThisWeek(latest.logged_at);
    });

    if (!readOnly && isMonday && developingWithoutUpdate.length > 0) {
      setWeeklyProjects(developingWithoutUpdate.map(p => ({
        name: p.name,
        latestStatus: p.latestLog?.overall_status ?? 'DEVELOPING',
      })));
      setShowWeeklyCheck(true);
    }
  }, [teamId, readOnly]);

  useEffect(() => { load(); }, [load]);

  const filtered = filterStatus === 'ALL'
    ? projects
    : filterStatus === 'NO_STATUS'
    ? projects.filter(p => !p.latestLog)
    : projects.filter(p => p.latestLog?.overall_status === filterStatus);

  const counts = {
    ALL: projects.length,
    NO_STATUS: projects.filter(p => !p.latestLog).length,
    ...Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, projects.filter(p => p.latestLog?.overall_status === s.value).length])),
  };

  // Manually trigger weekly check for developing projects
  const triggerWeeklyCheck = () => {
    const developingProjects = projects.filter(p => {
      const latest = p.latestLog;
      return !latest || latest.overall_status === 'DEVELOPING';
    });
    if (developingProjects.length === 0) return;
    setWeeklyProjects(developingProjects.map(p => ({
      name: p.name,
      latestStatus: p.latestLog?.overall_status ?? 'DEVELOPING',
    })));
    setShowWeeklyCheck(true);
  };

  if (loading) return <div className="text-center py-20 text-slate-400">Cargando proyectos...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers size={24} className="text-blue-400" />
            Proyectos
          </h2>
          <p className="text-slate-400 text-sm mt-1">Estatus general y bitácora de actualizaciones por proyecto</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {projects.length > 0 && (
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition border border-emerald-600"
            >
              <Download size={15} />
              Exportar Excel
            </button>
          )}
          {!readOnly && (
            <>
              <button
                onClick={() => setShowNewProject(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition border border-slate-600"
              >
                <FolderPlus size={15} />
                Nuevo proyecto
              </button>
              <button
                onClick={triggerWeeklyCheck}
                disabled={projects.filter(p => !p.latestLog || p.latestLog.overall_status === 'DEVELOPING').length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition"
              >
                <BarChart3 size={15} />
                Actualización semanal
              </button>
            </>
          )}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Layers size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-semibold text-slate-400">Sin proyectos aún</p>
          <p className="text-sm mt-1 mb-5">Crea el primer proyecto o agrégalo al crear una actividad.</p>
          {!readOnly && (
            <button onClick={() => setShowNewProject(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition flex items-center gap-2 mx-auto">
              <FolderPlus size={15} />Nuevo proyecto
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Status filter bar */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterStatus('ALL')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterStatus === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'}`}>
              Todos <span className="bg-white/20 rounded px-1">{counts.ALL}</span>
            </button>
            {STATUS_OPTIONS.map(s => {
              const Icon = s.icon;
              return (
                <button key={s.value} onClick={() => setFilterStatus(s.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${filterStatus === s.value ? `${s.bg} ${s.color} border-current` : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'}`}>
                  <Icon size={12} />{s.label}
                  {(counts as any)[s.value] > 0 && <span className="bg-current/20 rounded px-1">{(counts as any)[s.value]}</span>}
                </button>
              );
            })}
            {counts.NO_STATUS > 0 && (
              <button onClick={() => setFilterStatus('NO_STATUS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${filterStatus === 'NO_STATUS' ? 'bg-slate-600 text-white border-slate-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'}`}>
                Sin estatus <span className="bg-white/20 rounded px-1">{counts.NO_STATUS}</span>
              </button>
            )}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(p => (
              <ProjectCard
                key={p.name}
                project={p}
                userId={userId}
                teamId={teamId}
                allProjectNames={projects.map(pr => pr.name)}
                onLogUpdated={load}
                readOnly={readOnly}
              />
            ))}
          </div>
        </>
      )}

      {!readOnly && showWeeklyCheck && weeklyProjects.length > 0 && (
        <WeeklyCheckModal
          projects={weeklyProjects}
          userId={userId}
          teamId={teamId}
          onClose={() => setShowWeeklyCheck(false)}
          onSaved={load}
        />
      )}

      {showNewProject && (
        <ProjectFormModal
          teamId={teamId}
          editing={null}
          existingNames={projects.map(p => p.name)}
          onClose={() => setShowNewProject(false)}
          onSaved={load}
        />
      )}

      {showExport && (
        <ExportModal
          projects={projects}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
