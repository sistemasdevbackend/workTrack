import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  Wrench, Plus, X, Search, Tag,
  Pencil, Trash2, ImagePlus, ZoomIn, Database, AlertTriangle,
  BookOpen, Workflow, HelpCircle, FileText, Clock, User,
  Layers, Code2, ServerCrash, Box,
} from 'lucide-react';

interface Article {
  id: string;
  team_id: string;
  title: string;
  category: string;
  content: string;
  image_urls: string[];
  tags: string[];
  author_name: string;
  project_name: string;
  tech_type: string;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'QUERY',      label: 'Query / SQL',      icon: Database,      color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    ring: 'ring-cyan-500/40',    badge: 'bg-cyan-500/15 text-cyan-300' },
  { value: 'INCIDENCIA', label: 'Incidencia',        icon: AlertTriangle, color: 'text-amber-400',   bg: 'bg-amber-500/10',   ring: 'ring-amber-500/40',   badge: 'bg-amber-500/15 text-amber-300' },
  { value: 'GUIA',       label: 'Guía / Tutorial',   icon: BookOpen,      color: 'text-emerald-400', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500/40', badge: 'bg-emerald-500/15 text-emerald-300' },
  { value: 'PROCESO',    label: 'Proceso',            icon: Workflow,      color: 'text-blue-400',    bg: 'bg-blue-500/10',    ring: 'ring-blue-500/40',    badge: 'bg-blue-500/15 text-blue-300' },
  { value: 'OTRO',       label: 'Otro',               icon: HelpCircle,   color: 'text-slate-400',   bg: 'bg-slate-500/10',   ring: 'ring-slate-500/40',   badge: 'bg-slate-500/15 text-slate-400' },
];

const TECH_TYPES = [
  { value: '',               label: 'Sin especificar',  icon: Box,          color: 'text-slate-500',   badge: 'bg-slate-700 text-slate-400' },
  { value: 'CODIGO',         label: 'Código',           icon: Code2,        color: 'text-violet-400',  badge: 'bg-violet-500/15 text-violet-300' },
  { value: 'BASE_DE_DATOS',  label: 'Base de datos',    icon: Database,     color: 'text-cyan-400',    badge: 'bg-cyan-500/15 text-cyan-300' },
  { value: 'INFRAESTRUCTURA',label: 'Infraestructura',  icon: ServerCrash,  color: 'text-orange-400',  badge: 'bg-orange-500/15 text-orange-300' },
  { value: 'OTRO',           label: 'Otro',             icon: Box,          color: 'text-slate-400',   badge: 'bg-slate-500/15 text-slate-400' },
];

const catMeta  = (v: string) => CATEGORIES.find(c => c.value === v)  ?? CATEGORIES[4];
const techMeta = (v: string) => TECH_TYPES.find(t => t.value === v)  ?? TECH_TYPES[0];

// ─── Article Form Modal ────────────────────────────────────────────────────────

function ArticleModal({
  teamId, authorName, editing, projects, onClose, onSaved,
}: {
  teamId: string; authorName: string; editing: Article | null;
  projects: string[]; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle]           = useState(editing?.title ?? '');
  const [category, setCategory]     = useState(editing?.category ?? 'OTRO');
  const [content, setContent]       = useState(editing?.content ?? '');
  const [tagInput, setTagInput]     = useState(editing?.tags.join(', ') ?? '');
  const [projectName, setProjectName] = useState(editing?.project_name ?? '');
  const [techType, setTechType]     = useState(editing?.tech_type ?? '');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previews, setPreviews]     = useState<string[]>([]);
  const [existingUrls, setExistingUrls] = useState<string[]>(editing?.image_urls ?? []);
  const [lightbox, setLightbox]     = useState<string | null>(null);
  const [saving, setSaving]         = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imgs: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) { const f = item.getAsFile(); if (f) imgs.push(f); }
      }
      if (imgs.length) addFiles(imgs);
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [pendingFiles]);

  const addFiles = (files: File[] | FileList | null) => {
    if (!files) return;
    const arr = Array.isArray(files) ? files : Array.from(files as FileList);
    const valid = arr.filter(f => f.type.startsWith('image/'));
    const next = [...pendingFiles, ...valid].slice(0, 8);
    setPendingFiles(next);
    setPreviews(next.map(f => URL.createObjectURL(f)));
  };

  const removePending = (i: number) => {
    const next = pendingFiles.filter((_, idx) => idx !== i);
    setPendingFiles(next);
    setPreviews(next.map(f => URL.createObjectURL(f)));
  };

  const uploadImages = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of pendingFiles) {
      const path = `utilities/${teamId}/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
      const { error } = await supabase.storage.from('comment-images').upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from('comment-images').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    const newUrls = await uploadImages();
    const allUrls = [...existingUrls, ...newUrls];
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
    const payload = {
      team_id: teamId,
      title: title.trim(),
      category,
      content: content.trim(),
      image_urls: allUrls,
      tags,
      author_name: authorName,
      project_name: projectName,
      tech_type: techType,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await supabase.from('utilities_articles').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('utilities_articles').insert(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <>
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-white font-bold text-base">{editing ? 'Editar artículo' : 'Nuevo artículo de utilería'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Title */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Título</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Query para verificar saldo de cliente..."
              className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition" />
          </div>

          {/* Project + Tech type row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Project */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                Proyecto
              </label>
              {projects.length > 0 ? (
                <select value={projectName} onChange={e => setProjectName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition">
                  <option value="">Sin proyecto específico</option>
                  {projects.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <input value={projectName} onChange={e => setProjectName(e.target.value)}
                  placeholder="Nombre del proyecto..."
                  className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition" />
              )}
            </div>

            {/* Tech type */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
                Tipo de tecnología
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TECH_TYPES.filter(t => t.value !== '').map(t => {
                  const TIcon = t.icon;
                  const active = techType === t.value;
                  return (
                    <button key={t.value} type="button" onClick={() => setTechType(active ? '' : t.value)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${
                        active ? `${t.badge} border-transparent ring-1 ring-current/30` : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                      }`}>
                      <TIcon size={11} />{t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-2">Categoría</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const active = category === cat.value;
                return (
                  <button key={cat.value} type="button" onClick={() => setCategory(cat.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                      active ? `${cat.bg} ${cat.color} ring-1 ${cat.ring} border-transparent` : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'
                    }`}>
                    <Icon size={13} />{cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Contenido / Descripción</label>
            <textarea ref={textareaRef} value={content} onChange={e => setContent(e.target.value)} rows={8}
              placeholder={category === 'QUERY'
                ? 'SELECT * FROM tabla WHERE condicion = valor;\n-- Descripción de qué hace esta query y cuándo usarla...'
                : 'Descripción detallada, pasos a seguir, notas importantes...'}
              className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none font-mono leading-relaxed transition" />
          </div>

          {/* Tags */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">
              Etiquetas <span className="normal-case font-normal text-slate-600">(separadas por coma)</span>
            </label>
            <input value={tagInput} onChange={e => setTagInput(e.target.value)}
              placeholder="oracle, produccion, pagos, cliente..."
              className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition" />
          </div>

          {/* Images */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-2">
              Imágenes / Evidencias <span className="normal-case font-normal text-slate-600">(Ctrl+V para pegar)</span>
            </label>

            {existingUrls.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {existingUrls.map(url => (
                  <div key={url} className="relative group">
                    <img src={url} alt="" className="w-16 h-16 object-cover rounded-xl border border-slate-600 cursor-pointer" onClick={() => setLightbox(url)} />
                    <button onClick={() => setExistingUrls(u => u.filter(x => x !== url))}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <X size={10} />
                    </button>
                    <div onClick={() => setLightbox(url)} className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-xl cursor-pointer">
                      <ZoomIn size={14} className="text-white" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {previews.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative group">
                    <img src={src} alt="" className="w-16 h-16 object-cover rounded-xl border border-blue-600/50" />
                    <button onClick={() => removePending(i)}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {(existingUrls.length + pendingFiles.length) < 8 && (
              <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-slate-700 hover:border-blue-500/60 cursor-pointer transition group">
                <ImagePlus size={14} className="text-slate-500 group-hover:text-blue-400 transition shrink-0" />
                <span className="text-xs text-slate-500 group-hover:text-slate-300 transition">Adjuntar imágenes o capturas de pantalla</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6 shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition">Cancelar</button>
          <button onClick={save} disabled={saving || !title.trim()}
            className="flex-1 px-4 py-2.5 text-sm text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition disabled:opacity-40 flex items-center justify-center gap-2 font-semibold">
            {saving && <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
            {editing ? 'Guardar cambios' : 'Publicar artículo'}
          </button>
        </div>
      </div>
    </div>

    {lightbox && (
      <div className="fixed inset-0 bg-black/92 flex items-center justify-center z-[60] p-4" onClick={() => setLightbox(null)}>
        <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition"><X size={22} /></button>
        <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
      </div>
    )}
    </>
  );
}

// ─── Article Detail Modal ──────────────────────────────────────────────────────

function ArticleDetail({
  article, canEdit, onClose, onEdit, onDelete,
}: {
  article: Article; canEdit: boolean;
  onClose: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const meta = catMeta(article.category);
  const tech = techMeta(article.tech_type);
  const Icon = meta.icon;
  const TechIcon = tech.icon;

  const [y, m, d] = article.updated_at.split('T')[0].split('-').map(Number);
  const dateLabel = new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-slate-700 shrink-0">
          <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center shrink-0 ${meta.color}`}>
            <Icon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
              {article.tech_type && (
                <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${tech.badge}`}>
                  <TechIcon size={9} />{tech.label}
                </span>
              )}
              {article.project_name && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300">
                  <Layers size={9} />{article.project_name}
                </span>
              )}
              {article.tags.map(tag => (
                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">{tag}</span>
              ))}
            </div>
            <h2 className="text-white font-bold text-base leading-snug">{article.title}</h2>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><User size={10} />{article.author_name || 'Sistema'}</span>
              <span className="flex items-center gap-1"><Clock size={10} />Actualizado {dateLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && (
              <>
                <button onClick={onEdit} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"><Pencil size={15} /></button>
                <button onClick={() => setConfirmDel(true)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition"><Trash2 size={15} /></button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"><X size={18} /></button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {article.content && (
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Contenido</p>
              <pre className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-mono bg-slate-800/60 border border-slate-700 rounded-xl p-4 overflow-x-auto">
                {article.content}
              </pre>
            </div>
          )}

          {article.image_urls.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Imágenes / Evidencias</p>
              <div className="flex gap-2 flex-wrap">
                {article.image_urls.map((url, i) => (
                  <button key={i} onClick={() => setLightbox(url)} className="relative group overflow-hidden rounded-xl border border-slate-600 hover:border-blue-500/60 transition">
                    <img src={url} alt="" className="w-24 h-24 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                      <ZoomIn size={18} className="text-white" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {confirmDel && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]" onClick={() => setConfirmDel(false)}>
        <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
              <Trash2 size={18} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Eliminar artículo</h3>
              <p className="text-slate-400 text-xs mt-0.5">Esta acción no se puede deshacer</p>
            </div>
          </div>
          <p className="text-sm text-slate-300">¿Eliminar <span className="text-white font-semibold">"{article.title}"</span>?</p>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDel(false)} className="flex-1 px-4 py-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition">Cancelar</button>
            <button onClick={onDelete} className="flex-1 px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition">Eliminar</button>
          </div>
        </div>
      </div>
    )}

    {lightbox && (
      <div className="fixed inset-0 bg-black/92 flex items-center justify-center z-[60] p-4" onClick={() => setLightbox(null)}>
        <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition"><X size={22} /></button>
        <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
      </div>
    )}
    </>
  );
}

// ─── Article Card ──────────────────────────────────────────────────────────────

function ArticleCard({ article, onClick }: { article: Article; onClick: () => void }) {
  const meta = catMeta(article.category);
  const tech = techMeta(article.tech_type);
  const Icon = meta.icon;
  const TechIcon = tech.icon;
  const preview = article.content.slice(0, 130);

  return (
    <button onClick={onClick}
      className="w-full text-left bg-slate-800/70 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-2xl p-4 transition group">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center shrink-0 ${meta.color} mt-0.5`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${meta.badge}`}>{meta.label}</span>
            {article.tech_type && (
              <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tech.badge}`}>
                <TechIcon size={9} />{tech.label}
              </span>
            )}
            {article.project_name && (
              <span className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/12 text-blue-400 border border-blue-500/20">
                <Layers size={9} />{article.project_name}
              </span>
            )}
            {article.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-500">{tag}</span>
            ))}
          </div>
          <p className="text-white font-semibold text-sm leading-snug group-hover:text-blue-300 transition line-clamp-2">{article.title}</p>
          {preview && (
            <p className="text-slate-500 text-xs mt-1 leading-relaxed line-clamp-2 font-mono">{preview}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[11px] text-slate-600 flex items-center gap-1">
              <User size={10} />{article.author_name || 'Sistema'}
            </span>
            {article.image_urls.length > 0 && (
              <span className="text-[11px] text-slate-600 flex items-center gap-1">
                <FileText size={10} />{article.image_urls.length} imagen{article.image_urls.length !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Main Section ──────────────────────────────────────────────────────────────

export default function UtilitiesSection({
  teamId, authorName = '', canEdit = false,
}: {
  teamId: string; authorName?: string; canEdit?: boolean;
}) {
  const [articles, setArticles]   = useState<Article[]>([]);
  const [projects, setProjects]   = useState<string[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterCat, setFilterCat] = useState('ALL');
  const [filterProject, setFilterProject] = useState('');
  const [filterTech, setFilterTech]       = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState<Article | null>(null);
  const [detail, setDetail]       = useState<Article | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: arts }, { data: projs }] = await Promise.all([
      supabase.from('utilities_articles').select('*').eq('team_id', teamId).order('updated_at', { ascending: false }),
      supabase.from('team_projects').select('name').eq('team_id', teamId).order('name'),
    ]);
    setArticles(arts || []);
    setProjects((projs || []).map((p: any) => p.name));
    setLoading(false);
  };

  useEffect(() => { if (teamId) load(); }, [teamId]);

  const deleteArticle = async (id: string) => {
    await supabase.from('utilities_articles').delete().eq('id', id);
    setDetail(null);
    load();
  };

  const allTags = Array.from(new Set(articles.flatMap(a => a.tags))).sort();
  const usedProjects = Array.from(new Set(articles.map(a => a.project_name).filter(Boolean))).sort();

  const filtered = articles.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q) || a.tags.some(t => t.toLowerCase().includes(q)) || a.project_name.toLowerCase().includes(q);
    const matchCat    = filterCat === 'ALL' || a.category === filterCat;
    const matchProj   = !filterProject || a.project_name === filterProject;
    const matchTech   = !filterTech || a.tech_type === filterTech;
    return matchSearch && matchCat && matchProj && matchTech;
  });

  const grouped = CATEGORIES.reduce<Record<string, Article[]>>((acc, cat) => {
    const items = filtered.filter(a => a.category === cat.value);
    if (items.length > 0) acc[cat.value] = items;
    return acc;
  }, {});

  const activeFilters = filterCat !== 'ALL' || filterProject || filterTech;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Wrench size={22} className="text-blue-400" />
            Utilerías
          </h1>
          <p className="text-slate-400 text-sm mt-1">Base de conocimiento: queries, guías de incidencias y procedimientos del equipo</p>
        </div>
        {canEdit && (
          <button onClick={() => { setEditing(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition shrink-0">
            <Plus size={16} />Nuevo artículo
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por título, contenido, etiqueta o proyecto..."
          className="w-full bg-slate-800 border border-slate-700 text-white pl-9 pr-3 py-2.5 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Category chips */}
        <button onClick={() => setFilterCat('ALL')}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition border ${filterCat === 'ALL' && !filterProject && !filterTech ? 'bg-blue-600 text-white border-transparent' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'}`}>
          <Tag size={11} />Todas
        </button>

        {CATEGORIES.map(cat => {
          const CIcon = cat.icon;
          const count = articles.filter(a => a.category === cat.value).length;
          if (count === 0) return null;
          return (
            <button key={cat.value} onClick={() => setFilterCat(cat.value === filterCat ? 'ALL' : cat.value)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition border ${
                filterCat === cat.value ? `${cat.bg} ${cat.color} border-transparent ring-1 ${cat.ring}` : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
              }`}>
              <CIcon size={11} />{cat.label}<span className="opacity-70">{count}</span>
            </button>
          );
        })}

        {/* Divider */}
        {(usedProjects.length > 0 || articles.some(a => a.tech_type)) && (
          <span className="w-px bg-slate-700 self-stretch mx-1" />
        )}

        {/* Tech type chips */}
        {TECH_TYPES.filter(t => t.value !== '').map(t => {
          const TIcon = t.icon;
          const count = articles.filter(a => a.tech_type === t.value).length;
          if (count === 0) return null;
          return (
            <button key={t.value} onClick={() => setFilterTech(filterTech === t.value ? '' : t.value)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition border ${
                filterTech === t.value ? `${t.badge} border-transparent ring-1 ring-current/30` : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
              }`}>
              <TIcon size={11} />{t.label}<span className="opacity-70">{count}</span>
            </button>
          );
        })}

        {/* Project chips */}
        {usedProjects.map(p => (
          <button key={p} onClick={() => setFilterProject(filterProject === p ? '' : p)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition border ${
              filterProject === p ? 'bg-blue-500/15 text-blue-300 border-transparent ring-1 ring-blue-500/40' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
            }`}>
            <Layers size={11} />{p}
          </button>
        ))}

        {activeFilters && (
          <button onClick={() => { setFilterCat('ALL'); setFilterProject(''); setFilterTech(''); }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-slate-500 hover:text-red-400 transition border border-slate-700 hover:border-red-500/40">
            <X size={10} />Limpiar
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-6 w-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Wrench size={40} className="text-slate-700 mb-4" />
          <p className="text-slate-400 font-semibold">
            {articles.length === 0 ? 'Sin artículos todavía' : 'Sin resultados para tu búsqueda'}
          </p>
          <p className="text-slate-600 text-sm mt-1">
            {articles.length === 0 && canEdit ? 'Crea el primer artículo de utilería para el equipo.' : 'Intenta con otros términos o filtros.'}
          </p>
          {articles.length === 0 && canEdit && (
            <button onClick={() => { setEditing(null); setShowModal(true); }}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition">
              <Plus size={15} />Crear primer artículo
            </button>
          )}
        </div>
      ) : filterCat === 'ALL' && !filterProject && !filterTech ? (
        <div className="space-y-8">
          {Object.entries(grouped).map(([catValue, items]) => {
            const cat = catMeta(catValue);
            const CatIcon = cat.icon;
            return (
              <div key={catValue}>
                <div className="flex items-center gap-2 mb-3">
                  <CatIcon size={15} className={cat.color} />
                  <h2 className={`text-sm font-bold ${cat.color}`}>{cat.label}</h2>
                  <span className="text-xs text-slate-600">{items.length}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {items.map(a => <ArticleCard key={a.id} article={a} onClick={() => setDetail(a)} />)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map(a => <ArticleCard key={a.id} article={a} onClick={() => setDetail(a)} />)}
        </div>
      )}

      {/* Article detail */}
      {detail && (
        <ArticleDetail
          article={detail}
          canEdit={canEdit}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditing(detail); setDetail(null); setShowModal(true); }}
          onDelete={() => deleteArticle(detail.id)}
        />
      )}

      {/* Create / edit modal */}
      {showModal && (
        <ArticleModal
          teamId={teamId}
          authorName={authorName}
          editing={editing}
          projects={projects}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={load}
        />
      )}
    </div>
  );
}
