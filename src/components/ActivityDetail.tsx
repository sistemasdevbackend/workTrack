import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Send, CheckCircle, Pencil, Loader2, ZoomIn, ShieldAlert, Play, Check, MoreHorizontal, ChevronDown, ChevronUp, Trash2, AlertTriangle, FileText, FileSpreadsheet, File, ExternalLink, Rocket, CheckCircle2, XCircle, Activity } from 'lucide-react';
import RichTextEditor, { CommentContent, sanitizeHtml } from './RichTextEditor';
import ProjectCombobox from './ProjectCombobox';

async function notifyActivity(memberId: string, activityId: string, title: string, body: string) {
  await supabase.from('notifications').insert({ team_member_id: memberId, activity_id: activityId, type: 'ACTIVITY_UPDATED', title, body });
}

interface ActivityDetailProps {
  activity: any;
  onClose: () => void;
  onRefresh: () => void;
  canDelete?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente', IN_PROGRESS: 'En Progreso', TESTING: 'En Pruebas', COMPLETED: 'Completada',
  BLOCKED: 'Bloqueada', IN_REVIEW: 'En Revisión', NEEDS_REVISION: 'Corrección', APPROVED: 'Aprobada',
};

const STATUS_CHIP: Record<string, string> = {
  PENDING:        'bg-slate-600/60 text-slate-300',
  IN_PROGRESS:    'bg-yellow-500/20 text-yellow-300',
  TESTING:        'bg-cyan-500/20 text-cyan-300',
  COMPLETED:      'bg-green-500/20 text-green-300',
  BLOCKED:        'bg-red-500/20 text-red-300',
  IN_REVIEW:      'bg-cyan-500/20 text-cyan-300',
  NEEDS_REVISION: 'bg-orange-500/20 text-orange-300',
  APPROVED:       'bg-emerald-500/20 text-emerald-300',
};

function CommentBubble({
  revision,
  onSave,
}: {
  revision: any;
  onSave: (id: string, text: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(revision.comments ?? '');
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Detect if the comment is plain text (legacy) or HTML
  const isHtml = /<[a-z][\s\S]*>/i.test(revision.comments ?? '');
  // For length estimation strip tags
  const textLen = (revision.comments ?? '').replace(/<[^>]+>/g, '').length;
  const isLong = textLen > 200;

  const save = async () => {
    const clean = sanitizeHtml(draft);
    if (!clean.replace(/<[^>]+>/g, '').trim()) return;
    setSaving(true);
    await onSave(revision.id, clean);
    setSaving(false);
    setEditing(false);
    setMenuOpen(false);
  };

  const dateStr = new Date(revision.created_at).toLocaleDateString('es-MX', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
  const timeStr = new Date(revision.created_at).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit',
  });

  const isBlocked = revision.status === 'BLOCKED'
    || (revision.comments ?? '').startsWith('[BLOQUEADA]');

  return (
    <>
      <div className={`relative group rounded-xl border transition ${
        isBlocked
          ? 'bg-red-950/25 border-red-600/30'
          : 'bg-slate-800/60 border-slate-700/50 hover:border-slate-600/60'
      }`}>
        {/* Header row */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
              isBlocked ? 'bg-red-500/30 text-red-300' : 'bg-slate-600 text-slate-200'
            }`}>
              {(revision.author_name ?? 'G').charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-semibold text-slate-300 truncate">
              {revision.author_name ?? 'Gestor'}
            </span>
            <span className="text-slate-600 text-xs">·</span>
            <span className="text-[11px] text-slate-500 whitespace-nowrap">{dateStr} {timeStr}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CHIP[revision.status] ?? STATUS_CHIP.PENDING}`}>
              {STATUS_LABEL[revision.status] ?? revision.status}
            </span>
            {/* Edit menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="p-1 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-700 transition opacity-0 group-hover:opacity-100"
              >
                <MoreHorizontal size={14} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-10 py-1 min-w-[120px]">
                  <button
                    onClick={() => { setEditing(true); setMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition"
                  >
                    <Pencil size={12} />
                    Editar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 pb-3">
          {editing ? (
            <div className="space-y-2">
              <RichTextEditor
                value={draft}
                onChange={setDraft}
                placeholder="Edita el comentario..."
                minRows={3}
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => { setEditing(false); setDraft(revision.comments ?? ''); setMenuOpen(false); }}
                  className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg transition"
                >
                  {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            revision.comments && (
              <div>
                {isHtml ? (
                  <div className={!expanded && isLong ? 'line-clamp-4 overflow-hidden' : ''}>
                    <CommentContent html={revision.comments} className={isBlocked ? '[&_*]:text-red-200' : ''} />
                  </div>
                ) : (
                  <p className={`text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    isBlocked ? 'text-red-200' : 'text-slate-200'
                  } ${!expanded && isLong ? 'line-clamp-3' : ''}`}>
                    {revision.comments}
                  </p>
                )}
                {isLong && (
                  <button
                    onClick={() => setExpanded(v => !v)}
                    className="mt-1 flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-slate-300 transition"
                  >
                    {expanded ? <><ChevronUp size={11} />Ver menos</> : <><ChevronDown size={11} />Ver más</>}
                  </button>
                )}
              </div>
            )
          )}

          {/* Images */}
          {revision.image_urls && revision.image_urls.length > 0 && (
            <div className={`flex gap-2 flex-wrap ${revision.comments && !editing ? 'mt-3' : editing ? '' : ''}`}>
              {revision.image_urls.map((url: string, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightbox(url)}
                  className="relative group/img w-20 h-20 rounded-lg overflow-hidden border border-slate-600 bg-slate-900 shrink-0 hover:border-blue-500 transition"
                >
                  <img src={url} alt={`Evidencia ${i + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition flex items-center justify-center">
                    <ZoomIn size={14} className="text-white opacity-0 group-hover/img:opacity-100 transition" />
                  </div>
                </button>
              ))}
            </div>
          )}
          {/* Documents */}
          {revision.doc_urls && revision.doc_urls.length > 0 && (
            <div className={`space-y-1.5 ${(revision.comments || revision.image_urls?.length > 0) ? 'mt-3' : ''}`}>
              {revision.doc_urls.map((url: string, i: number) => {
                const fileName = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? `Documento ${i + 1}`).replace(/^\d+-/, '');
                const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
                const DocIco = ['xls','xlsx','csv'].includes(ext)
                  ? <FileSpreadsheet size={12} className="text-green-400 shrink-0" />
                  : ext === 'pdf'
                  ? <FileText size={12} className="text-red-400 shrink-0" />
                  : <File size={12} className="text-blue-400 shrink-0" />;
                return (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-slate-700/40 hover:bg-slate-700/70 border border-slate-600/40 hover:border-slate-500 rounded-lg px-3 py-2 transition group/doc"
                  >
                    {DocIco}
                    <span className="text-xs text-slate-300 flex-1 truncate">{fileName}</span>
                    <ExternalLink size={10} className="text-slate-500 group-hover/doc:text-slate-300 transition shrink-0" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition"
            onClick={() => setLightbox(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightbox}
            alt="Evidencia"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

const STEP_TYPE_LABELS: Record<string, string> = {
  DATABASE: 'Base de Datos', CODE: 'Código', TESTING: 'Testing', DOCUMENTATION: 'Documentación',
};

function TasksPanel({ taskSteps, activityId, collaborators, onRefresh }: {
  taskSteps: any[];
  activityId: string;
  collaborators: any[];
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [newStep, setNewStep] = useState({ title: '', type: 'CODE', description: '', assigned_member_id: '' });
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStep.title.trim()) return;
    setSaving(true);
    const assignedMember = collaborators.find((c: any) => c.id === newStep.assigned_member_id);
    await supabase.from('task_steps').insert({
      activity_id: activityId,
      step_type: newStep.type,
      title: newStep.title.trim(),
      description: newStep.description.trim() || null,
      order_index: taskSteps.length,
      assigned_member_id: newStep.assigned_member_id || null,
      assigned_member_name: assignedMember?.name ?? null,
    });
    setNewStep({ title: '', type: 'CODE', description: '', assigned_member_id: '' });
    setShowForm(false);
    setSaving(false);
    onRefresh();
  };

  return (
    <div className="space-y-3">
      {taskSteps.length === 0 && !showForm && (
        <div className="text-center py-8 text-slate-500 text-sm">Sin pasos definidos</div>
      )}

      {taskSteps.map(step => (
        <div key={step.id} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 border-l-4 border-l-blue-500">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm">{step.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] text-slate-500 uppercase">{STEP_TYPE_LABELS[step.step_type] ?? step.step_type}</span>
                {step.assigned_member_name && (
                  <span className="text-[11px] text-blue-300 bg-blue-500/15 border border-blue-500/25 px-2 py-0.5 rounded-full">
                    {step.assigned_member_name}
                  </span>
                )}
              </div>
              {step.description && (
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">{step.description}</p>
              )}
            </div>
            {step.completed && <CheckCircle size={16} className="text-green-400 shrink-0" />}
          </div>
        </div>
      ))}

      {showForm ? (
        <form onSubmit={handleAdd} className="bg-slate-800/60 border border-blue-500/30 rounded-xl p-4 space-y-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nuevo paso</p>
          <input
            type="text"
            placeholder="Título del paso *"
            value={newStep.title}
            onChange={e => setNewStep(p => ({ ...p, title: e.target.value }))}
            className="w-full bg-slate-700/80 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Tipo</label>
              <select
                value={newStep.type}
                onChange={e => setNewStep(p => ({ ...p, type: e.target.value }))}
                style={{ colorScheme: 'dark' }}
                className="w-full bg-slate-800 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition"
              >
                <option value="CODE">Código</option>
                <option value="DATABASE">Base de Datos</option>
                <option value="TESTING">Testing</option>
                <option value="DOCUMENTATION">Documentación</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Asignado a</label>
              <select
                value={newStep.assigned_member_id}
                onChange={e => setNewStep(p => ({ ...p, assigned_member_id: e.target.value }))}
                style={{ colorScheme: 'dark' }}
                className="w-full bg-slate-800 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition"
              >
                <option value="">Sin asignar</option>
                {collaborators.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name} — {c.position}</option>
                ))}
              </select>
            </div>
          </div>
          <textarea
            placeholder="Descripción (opcional)"
            value={newStep.description}
            onChange={e => setNewStep(p => ({ ...p, description: e.target.value }))}
            rows={2}
            className="w-full bg-slate-700/80 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition resize-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 px-3 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !newStep.title.trim()}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition"
            >
              {saving ? <><Loader2 size={13} className="animate-spin" />Guardando...</> : <>Agregar paso</>}
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-slate-400 hover:text-blue-400 border border-dashed border-slate-700 hover:border-blue-500/50 rounded-xl transition"
        >
          <Play size={13} />
          Agregar paso
        </button>
      )}
    </div>
  );
}

export default function ActivityDetail({ activity, onClose, onRefresh, canDelete = false }: ActivityDetailProps) {
  const [taskSteps, setTaskSteps] = useState<any[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [newRevision, setNewRevision] = useState({
    revisionDate: new Date().toISOString().split('T')[0],
    revisionTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
    status: 'IN_PROGRESS',
    comments: '',
  });
  const [activityStatus, setActivityStatus] = useState(activity.status);
  const [priority, setPriority] = useState(activity.priority);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'revisions' | 'edit' | 'monitoring'>('overview');
  const [monitoringLogs, setMonitoringLogs] = useState<any[]>([]);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingDocs, setPendingDocs] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    title: activity.title || '',
    description: activity.description || '',
    project: activity.project || '',
    priority: activity.priority || 'MEDIUM',
    status: activity.status || 'PENDING',
    environment: activity.environment || 'DEV',
    activity_type: (activity.activity_type || 'CODE') as 'CODE' | 'DATABASE' | 'BOTH' | 'DOCUMENTATION' | 'TESTING',
    start_date: activity.start_date || '',
    end_date: activity.end_date || '',
    team_member_id: activity.team_member_id || '',
    shared_with_member_id: activity.shared_with_member_id || '',
  });
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Re-sync editForm when the activity prop is refreshed externally
  useEffect(() => {
    setEditForm({
      title: activity.title || '',
      description: activity.description || '',
      project: activity.project || '',
      priority: activity.priority || 'MEDIUM',
      status: activity.status || 'PENDING',
      environment: activity.environment || 'DEV',
      activity_type: (activity.activity_type || 'CODE') as 'CODE' | 'DATABASE' | 'BOTH' | 'DOCUMENTATION' | 'TESTING',
      start_date: activity.start_date || '',
      end_date: activity.end_date || '',
      team_member_id: activity.team_member_id || '',
      shared_with_member_id: activity.shared_with_member_id || '',
    });
  }, [activity.id, activity.activity_type, activity.title, activity.status, activity.priority]);

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from('activities').delete().eq('id', activity.id);
    setDeleting(false);
    if (error) {
      alert('No se pudo eliminar la actividad. Verifica tus permisos.');
      return;
    }
    onRefresh();
    onClose();
  };

  useEffect(() => {
    loadData();
    loadCollaborators();
    if (activity.released_to_production_at) loadMonitoringLogs();
  }, [activity.id]);

  const loadMonitoringLogs = async () => {
    const { data } = await supabase
      .from('release_monitoring_logs')
      .select('*, team_members(name)')
      .eq('activity_id', activity.id)
      .order('day_number', { ascending: true });
    setMonitoringLogs(data || []);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [taskData, revisionData] = await Promise.all([
        supabase.from('task_steps').select('*').eq('activity_id', activity.id).order('order_index'),
        supabase
          .from('activity_revisions')
          .select('*')
          .eq('activity_id', activity.id)
          .order('created_at', { ascending: false }),
      ]);
      setTaskSteps(taskData.data || []);
      setRevisions(revisionData.data || []);
    } finally {
      setLoading(false);
    }
  };

  const loadCollaborators = async () => {
    const { data } = await supabase
      .from('team_members')
      .select('id, name, email, position')
      .eq('team_id', activity.team_id)
      .order('name');
    setCollaborators(data || []);
  };

  const uploadFiles = async (files: File[], folder: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${activity.id}/${folder}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from('comment-images').upload(path, file, { upsert: false });
      if (!error) {
        const { data: pub } = supabase.storage.from('comment-images').getPublicUrl(path);
        urls.push(pub.publicUrl);
      }
    }
    return urls;
  };

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    setPendingImages(prev => [...prev, ...valid].slice(0, 5));
  };

  const removePendingImage = (idx: number) =>
    setPendingImages(prev => prev.filter((_, i) => i !== idx));

  const handleEditComment = async (revisionId: string, text: string) => {
    await supabase
      .from('activity_revisions')
      .update({ comments: text })
      .eq('id', revisionId);
    setRevisions(prev =>
      prev.map(r => r.id === revisionId ? { ...r, comments: text } : r)
    );
  };

  const handleAddRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRevision.comments.replace(/<[^>]+>/g, '').trim() && pendingImages.length === 0 && pendingDocs.length === 0) {
      alert('Por favor agrega un comentario, imagen o documento');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setUploadingImages(pendingImages.length > 0 || pendingDocs.length > 0);
    const [imageUrls, docUrls] = await Promise.all([
      pendingImages.length > 0 ? uploadFiles(pendingImages, 'img') : Promise.resolve([]),
      pendingDocs.length > 0 ? uploadFiles(pendingDocs, 'docs') : Promise.resolve([]),
    ]);
    setUploadingImages(false);

    const revisionDateTime = new Date(`${newRevision.revisionDate}T${newRevision.revisionTime}:00`);
    const nextRevisionNumber = (revisions.length || 0) + 1;

    const { error } = await supabase.from('activity_revisions').insert({
      activity_id: activity.id,
      revision_number: nextRevisionNumber,
      status: newRevision.status,
      comments: newRevision.comments ? sanitizeHtml(newRevision.comments) : null,
      reviewed_by: user.id,
      created_at: revisionDateTime.toISOString(),
      image_urls: imageUrls.length > 0 ? imageUrls : [],
      doc_urls: docUrls.length > 0 ? docUrls : [],
    });

    if (!error) {
      setNewRevision({
        revisionDate: new Date().toISOString().split('T')[0],
        revisionTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
        status: 'IN_PROGRESS',
        comments: '',
      });
      setPendingImages([]);
      setPendingDocs([]);
      loadData();
    } else {
      alert('Error al agregar seguimiento: ' + error.message);
    }
  };

  const handleReactivate = async () => {
    await supabase.from('activities').update({
      status: 'IN_PROGRESS',
      updated_at: new Date().toISOString(),
    }).eq('id', activity.id);

    await supabase.from('activity_revisions').insert({
      activity_id: activity.id,
      status: 'IN_PROGRESS',
      comments: '[Reactivada por gestor] La actividad fue reactivada y puede continuar.',
      reviewed_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });

    if (activity.team_member_id) {
      await supabase.from('notifications').insert({
        team_member_id: activity.team_member_id,
        activity_id: activity.id,
        type: 'ACTIVITY_UPDATED',
        title: `Actividad reactivada: ${activity.title}`,
        body: 'El gestor resolvió el bloqueo. Ya puedes continuar trabajando.',
      });
    }

    setActivityStatus('IN_PROGRESS');
    onRefresh();
  };

  const handleStatusChange = async (newStatus: string) => {
    setActivityStatus(newStatus);
    await supabase.from('activities').update({ status: newStatus }).eq('id', activity.id);
    if (activity.team_member_id) {
      await notifyActivity(activity.team_member_id, activity.id, `Estado actualizado: ${activity.title}`, `Nuevo estado: ${STATUS_LABEL[newStatus] ?? newStatus}`);
    }
    onRefresh();
  };

  const handlePriorityChange = async (newPriority: string) => {
    setPriority(newPriority);
    await supabase.from('activities').update({ priority: newPriority }).eq('id', activity.id);
    const priorityLabel: Record<string, string> = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
    if (activity.team_member_id) {
      await notifyActivity(activity.team_member_id, activity.id, `Prioridad actualizada: ${activity.title}`, `Nueva prioridad: ${priorityLabel[newPriority] ?? newPriority}`);
    }
    onRefresh();
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.title.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('activities')
        .update({
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          project: editForm.project.trim(),
          priority: editForm.priority,
          status: editForm.status,
          environment: editForm.environment,
          activity_type: editForm.activity_type,
          start_date: editForm.start_date || null,
          end_date: editForm.end_date || null,
          team_member_id: editForm.team_member_id || activity.team_member_id,
          shared_with_member_id: editForm.shared_with_member_id || null,
          shared_with_member_name: collaborators.find(c => c.id === editForm.shared_with_member_id)?.name ?? null,
        })
        .eq('id', activity.id);

      if (error) throw error;

      setActivityStatus(editForm.status);
      setPriority(editForm.priority);

      const memberId = editForm.team_member_id || activity.team_member_id;
      if (memberId) {
        const changes: string[] = [];
        if (editForm.title.trim() !== activity.title) changes.push('Título cambiado');
        if (editForm.description.trim() !== (activity.description ?? '')) changes.push('Descripción actualizada');
        if (editForm.project.trim() !== (activity.project ?? '')) changes.push(`Proyecto: ${editForm.project.trim()}`);
        if (editForm.status !== activity.status) changes.push(`Estado: ${STATUS_LABEL[editForm.status] ?? editForm.status}`);
        if (editForm.priority !== activity.priority) changes.push(`Prioridad: ${{ HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' }[editForm.priority] ?? editForm.priority}`);
        if (editForm.start_date !== (activity.start_date ?? '')) changes.push(`Inicio: ${editForm.start_date || 'sin fecha'}`);
        if (editForm.end_date !== (activity.end_date ?? '')) changes.push(`Término: ${editForm.end_date || 'sin fecha'}`);
        if (changes.length > 0) {
          await notifyActivity(memberId, activity.id, `Actividad modificada: ${editForm.title.trim()}`, changes.join(' · '));
        }
      }

      onRefresh();
      setActiveTab('overview');
    } catch (err: any) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const priorityAccent = { HIGH: 'bg-red-500', MEDIUM: 'bg-yellow-500', LOW: 'bg-green-500' }[priority] ?? 'bg-slate-500';
  const getStatusSelectColor = (s: string) => ({
    PENDING:        'border-slate-500 bg-slate-700 text-slate-200',
    IN_PROGRESS:    'border-yellow-500 bg-[#2a2310] text-yellow-200',
    TESTING:        'border-cyan-500 bg-[#0a1f24] text-cyan-200',
    COMPLETED:      'border-green-500 bg-[#0a1f12] text-green-200',
    BLOCKED:        'border-red-600 bg-[#2a0a0a] text-red-200',
    IN_REVIEW:      'border-amber-500 bg-[#231a06] text-amber-200',
    NEEDS_REVISION: 'border-red-500 bg-[#1f0a0a] text-red-300',
    APPROVED:       'border-emerald-500 bg-[#071f12] text-emerald-200',
  }[s] ?? 'border-slate-600 bg-slate-700 text-slate-200');

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  const tabs = [
    { id: 'overview' as const, label: 'Visión General' },
    { id: 'tasks'    as const, label: `Pasos${taskSteps.length ? ` (${taskSteps.length})` : ''}` },
    { id: 'revisions' as const, label: `Seguimiento${revisions.length ? ` (${revisions.length})` : ''}` },
    ...(activity.released_to_production_at ? [{ id: 'monitoring' as const, label: `Monitoreo${monitoringLogs.length ? ` (${monitoringLogs.length})` : ''}`, icon: <Rocket size={12} className="text-emerald-400" /> }] : []),
    { id: 'edit'     as const, label: 'Editar', icon: <Pencil size={12} /> },
  ];

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-5xl w-full flex flex-col h-[88vh] shadow-2xl overflow-hidden">

        {/* Priority accent bar */}
        <div className={`${priorityAccent} h-1 w-full shrink-0`} />

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {activity.project && (
                <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md mb-2 inline-block">
                  {activity.project}
                </span>
              )}
              <h2 className="text-lg font-bold text-white leading-snug line-clamp-2">{activity.title}</h2>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {canDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg transition"
                  title="Eliminar actividad"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                onClick={onClose}
                className="text-slate-500 hover:text-white hover:bg-slate-800 p-1.5 rounded-lg transition"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Quick status + priority controls */}
          <div className="flex items-center gap-3 mt-4">
            <select
              value={activityStatus}
              onChange={e => handleStatusChange(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg border focus:outline-none transition ${getStatusSelectColor(activityStatus)}`}
            >
              <option value="PENDING"        className="bg-slate-800 text-slate-200">Pendiente</option>
              <option value="IN_PROGRESS"    className="bg-slate-800 text-yellow-200">En Proceso</option>
              <option value="TESTING"        className="bg-slate-800 text-cyan-200">En Pruebas</option>
              <option value="COMPLETED"      className="bg-slate-800 text-green-200">Completada</option>
              <option value="BLOCKED"        className="bg-slate-800 text-red-200">Bloqueada</option>
            </select>
            <select
              value={priority}
              onChange={e => handlePriorityChange(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg border focus:outline-none transition ${
                priority === 'HIGH'   ? 'border-red-500 bg-[#2a0a0a] text-red-200'
                : priority === 'MEDIUM' ? 'border-yellow-500 bg-[#2a2310] text-yellow-200'
                : 'border-green-500 bg-[#0a1f12] text-green-200'
              }`}
            >
              <option value="LOW"    className="bg-slate-800 text-green-200">Prioridad: Baja</option>
              <option value="MEDIUM" className="bg-slate-800 text-yellow-200">Prioridad: Media</option>
              <option value="HIGH"   className="bg-slate-800 text-red-200">Prioridad: Alta</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-900/80 shrink-0 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 py-3 mr-5 text-xs font-semibold transition border-b-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1">

          {/* Blocked banner — inside content, only on revisions/overview */}
          {activityStatus === 'BLOCKED' && activeTab !== 'edit' && (
            <div className="mx-6 mt-5 bg-red-950/50 border border-red-600/50 rounded-xl p-4 flex items-start gap-3">
              <ShieldAlert size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-red-300 font-bold text-sm mb-0.5">Actividad bloqueada</p>
                <p className="text-red-400/80 text-xs leading-relaxed">
                  El colaborador no puede continuar. Revisa el seguimiento para ver el motivo.
                </p>
              </div>
              <button
                onClick={handleReactivate}
                className="shrink-0 flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition whitespace-nowrap"
              >
                <Play size={11} />
                Reactivar
              </button>
            </div>
          )}

          <div className="p-6 space-y-5">

            {activeTab === 'overview' && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Descripción</p>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                    {activity.description || <span className="text-slate-600 italic">Sin descripción</span>}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  {[
                    { label: 'Inicio', value: activity.start_date ? new Date(activity.start_date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                    { label: 'Vencimiento', value: activity.end_date ? new Date(activity.end_date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' },
                    { label: 'Creada', value: new Date(activity.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
                      <p className="text-slate-200 text-xs font-semibold">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Ambiente + Release date */}
                <div className="flex items-center gap-3 flex-wrap">
                  {activity.environment && (
                    <span className={`text-xs font-bold px-3 py-1 rounded-lg ${
                      { DEV: 'bg-blue-500/20 text-blue-300', QA: 'bg-yellow-500/20 text-yellow-300', STAGING: 'bg-orange-500/20 text-orange-300', PROD: 'bg-red-500/20 text-red-300' }[activity.environment as string] ?? 'bg-slate-500/20 text-slate-300'
                    }`}>
                      Ambiente: {activity.environment}
                    </span>
                  )}
                  {activity.production_release_date && (
                    <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 rounded-lg flex items-center gap-1.5">
                      <span>🚀</span>
                      Liberación: {new Date(activity.production_release_date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'tasks' && (
              <TasksPanel
                taskSteps={taskSteps}
                activityId={activity.id}
                collaborators={collaborators}
                onRefresh={loadData}
              />
            )}

            {activeTab === 'revisions' && (
              <div className="flex gap-5 items-start">
                {/* Left: Add form — fixed width, sticky */}
                <div className="w-72 shrink-0">
                  <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 space-y-3 sticky top-0">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nuevo seguimiento</p>

                    <form onSubmit={handleAddRevision} className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Fecha</label>
                        <input
                          type="date"
                          value={newRevision.revisionDate}
                          onChange={e => setNewRevision({ ...newRevision, revisionDate: e.target.value })}
                          className="w-full bg-slate-700/80 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Hora</label>
                        <input
                          type="time"
                          value={newRevision.revisionTime}
                          onChange={e => setNewRevision({ ...newRevision, revisionTime: e.target.value })}
                          className="w-full bg-slate-700/80 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Estado</label>
                        <select
                          value={newRevision.status}
                          onChange={e => setNewRevision({ ...newRevision, status: e.target.value })}
                          style={{ colorScheme: 'dark' }}
                          className="w-full bg-slate-800 border border-slate-600 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition"
                        >
                          <option value="PENDING"     className="bg-slate-800 text-slate-200">Pendiente</option>
                          <option value="IN_PROGRESS" className="bg-slate-800 text-yellow-200">En Progreso</option>
                          <option value="TESTING"     className="bg-slate-800 text-cyan-200">En Pruebas</option>
                          <option value="COMPLETED"   className="bg-slate-800 text-green-200">Completada</option>
                          <option value="BLOCKED"     className="bg-slate-800 text-red-200">Bloqueada</option>
                        </select>
                      </div>

                      <RichTextEditor
                        value={newRevision.comments}
                        onChange={v => setNewRevision({ ...newRevision, comments: v })}
                        placeholder="Describe el progreso..."
                        minRows={4}
                        pendingImages={pendingImages}
                        onImagesChange={setPendingImages}
                        onPasteImage={files => setPendingImages(prev => [...prev, ...files].slice(0, 5))}
                        pendingDocs={pendingDocs}
                        onDocsChange={setPendingDocs}
                      />

                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          disabled={(!newRevision.comments.replace(/<[^>]+>/g, '').trim() && pendingImages.length === 0 && pendingDocs.length === 0) || uploadingImages}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm"
                        >
                          {uploadingImages
                            ? <><Loader2 size={13} className="animate-spin" />Subiendo...</>
                            : <><Send size={13} />Guardar</>
                          }
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Right: Comment feed */}
                <div className="flex-1 min-w-0">
                  {revisions.length === 0 ? (
                    <div className="text-center py-16 text-slate-500 text-sm">Sin seguimientos registrados</div>
                  ) : (
                    <div className="space-y-2.5">
                      {revisions.map(revision => (
                        <CommentBubble
                          key={revision.id}
                          revision={revision}
                          onSave={handleEditComment}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'monitoring' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Post-Liberación · 5 días</p>
                    <p className="text-slate-400 text-xs">
                      Monitoreo diario desde el{' '}
                      <span className="text-emerald-300 font-semibold">
                        {new Date(activity.released_to_production_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </p>
                  </div>
                  <button
                    onClick={loadMonitoringLogs}
                    className="text-xs text-slate-500 hover:text-white transition flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-slate-800"
                  >
                    <Activity size={12} />
                    Actualizar
                  </button>
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map(day => {
                    const log = monitoringLogs.find((l: any) => l.day_number === day);
                    const releaseDate = new Date(activity.released_to_production_at);
                    releaseDate.setHours(0, 0, 0, 0);
                    const dayDate = new Date(releaseDate.getTime() + (day - 1) * 86400000);
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const isPast = dayDate < today;
                    const isToday = dayDate.getTime() === today.getTime();
                    const isFuture = dayDate > today;
                    const dateLabel = dayDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });

                    const statusMeta: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
                      OK:       { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/40', label: 'OK' },
                      ISSUE:    { icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/40',   label: 'Problema' },
                      CRITICAL: { icon: XCircle,      color: 'text-red-400',     bg: 'bg-red-500/15 border-red-500/40',       label: 'Crítico' },
                    };

                    const meta = log ? statusMeta[log.status] : null;
                    const Icon = meta?.icon;

                    return (
                      <div
                        key={day}
                        className={`rounded-xl border p-3 text-center transition ${
                          log
                            ? meta!.bg
                            : isPast
                            ? 'bg-red-500/10 border-red-500/30'
                            : isToday
                            ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/30'
                            : 'bg-slate-800/40 border-slate-700/50'
                        }`}
                      >
                        <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Día {day}</p>
                        <p className="text-[10px] text-slate-600 mb-2">{dateLabel}</p>
                        {log && Icon ? (
                          <>
                            <Icon size={18} className={`mx-auto mb-1 ${meta!.color}`} />
                            <p className={`text-[10px] font-bold ${meta!.color}`}>{meta!.label}</p>
                          </>
                        ) : isPast ? (
                          <>
                            <XCircle size={16} className="mx-auto mb-1 text-red-500/60" />
                            <p className="text-[10px] text-red-500/60">Sin reporte</p>
                          </>
                        ) : isToday ? (
                          <>
                            <div className="w-2 h-2 rounded-full bg-blue-400 mx-auto mb-1 animate-pulse" />
                            <p className="text-[10px] text-blue-400">Hoy</p>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 rounded-full bg-slate-700 mx-auto mb-1" />
                            <p className="text-[10px] text-slate-600">Pendiente</p>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Log detail cards */}
                {monitoringLogs.length === 0 ? (
                  <div className="text-center py-10 text-slate-500">
                    <Rocket size={32} className="mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Sin reportes de monitoreo aún</p>
                    <p className="text-xs text-slate-600 mt-1">El colaborador recibirá el aviso día a día</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {monitoringLogs.map((log: any) => {
                      const statusMeta: Record<string, { color: string; bg: string; label: string }> = {
                        OK:       { color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/25', label: 'Funcionando correctamente' },
                        ISSUE:    { color: 'text-amber-300',   bg: 'bg-amber-500/10 border-amber-500/25',    label: 'Problema menor detectado' },
                        CRITICAL: { color: 'text-red-300',     bg: 'bg-red-500/10 border-red-500/25',        label: 'Problema crítico' },
                      };
                      const sm = statusMeta[log.status] ?? statusMeta.OK;
                      const memberName = log.team_members?.name ?? 'Colaborador';
                      const submittedAt = new Date(log.submitted_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                      return (
                        <div key={log.id} className={`rounded-xl border p-4 ${sm.bg} space-y-3`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400">Día {log.day_number}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${sm.bg} ${sm.color}`}>{sm.label}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-[11px] text-slate-400 font-medium">{memberName}</p>
                              <p className="text-[10px] text-slate-600">{submittedAt}</p>
                            </div>
                          </div>
                          {log.comment && (
                            <p className="text-xs text-slate-300 leading-relaxed border-t border-slate-700/40 pt-3">{log.comment}</p>
                          )}
                          {log.image_url && (
                            <div className="relative group cursor-zoom-in" onClick={() => setLightboxUrl(log.image_url)}>
                              <img
                                src={log.image_url}
                                alt={`Evidencia día ${log.day_number}`}
                                className="w-full max-h-48 object-contain rounded-lg border border-slate-700 bg-slate-900/40"
                              />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-lg bg-black/40">
                                <ZoomIn size={20} className="text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'edit' && (
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Título *</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    required
                    className="w-full bg-slate-800/80 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Descripción</label>
                  <textarea
                    value={editForm.description}
                    onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full bg-slate-800/80 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Proyecto</label>
                  <ProjectCombobox
                    teamId={activity.team_id}
                    value={editForm.project}
                    onChange={val => setEditForm(prev => ({ ...prev, project: val }))}
                    placeholder="Seleccionar o escribir proyecto..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ambiente</label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['DEV', 'QA', 'STAGING', 'PROD'] as const).map(env => {
                      const active: Record<string, string> = {
                        DEV:     'border-blue-500 bg-blue-500/20 text-blue-200',
                        QA:      'border-yellow-500 bg-yellow-500/20 text-yellow-200',
                        STAGING: 'border-orange-500 bg-orange-500/20 text-orange-200',
                        PROD:    'border-red-500 bg-red-500/20 text-red-200',
                      };
                      return (
                        <button
                          key={env}
                          type="button"
                          onClick={() => setEditForm(prev => ({ ...prev, environment: env }))}
                          className={`py-2 rounded-lg border text-xs font-bold tracking-wide transition ${editForm.environment === env ? active[env] : 'border-slate-700 bg-slate-800/80 text-slate-500 hover:border-slate-600'}`}
                        >
                          {env}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Activity type */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tipo de actividad</label>
                  <div className="grid grid-cols-5 gap-2">
                    {([
                      { value: 'CODE',          label: 'Código',        color: 'border-blue-500 bg-blue-500/20 text-blue-200' },
                      { value: 'DATABASE',      label: 'BD',            color: 'border-emerald-500 bg-emerald-500/20 text-emerald-200' },
                      { value: 'BOTH',          label: 'Código + BD',   color: 'border-cyan-500 bg-cyan-500/20 text-cyan-200' },
                      { value: 'DOCUMENTATION', label: 'Documentación', color: 'border-amber-500 bg-amber-500/20 text-amber-200' },
                      { value: 'TESTING',       label: 'Testing',       color: 'border-rose-500 bg-rose-500/20 text-rose-200' },
                    ] as const).map(({ value, label, color }) => {
                      const isSelected = editForm.activity_type === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setEditForm(prev => ({ ...prev, activity_type: value }))}
                          className={`py-2 px-1 rounded-lg border text-[11px] font-bold tracking-wide transition ${isSelected ? color : 'border-slate-700 bg-slate-800/80 text-slate-500 hover:border-slate-600'}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Prioridad</label>
                    <select
                      value={editForm.priority}
                      onChange={e => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                      style={{ colorScheme: 'dark' }}
                      className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                    >
                      <option value="LOW"    className="bg-slate-800 text-green-200">Baja</option>
                      <option value="MEDIUM" className="bg-slate-800 text-yellow-200">Media</option>
                      <option value="HIGH"   className="bg-slate-800 text-red-200">Alta</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Estado</label>
                    <select
                      value={editForm.status}
                      onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                      style={{ colorScheme: 'dark' }}
                      className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                    >
                      <option value="PENDING"     className="bg-slate-800 text-slate-200">Pendiente</option>
                      <option value="IN_PROGRESS" className="bg-slate-800 text-yellow-200">En Proceso</option>
                      <option value="TESTING"     className="bg-slate-800 text-cyan-200">En Pruebas</option>
                      <option value="COMPLETED"   className="bg-slate-800 text-green-200">Completada</option>
                      <option value="BLOCKED"     className="bg-slate-800 text-red-200">Bloqueada</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Fecha Inicio</label>
                    <input
                      type="date"
                      value={editForm.start_date}
                      onChange={e => setEditForm(prev => ({ ...prev, start_date: e.target.value }))}
                      className="w-full bg-slate-800/80 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Fecha Término</label>
                    <input
                      type="date"
                      value={editForm.end_date}
                      onChange={e => setEditForm(prev => ({ ...prev, end_date: e.target.value }))}
                      className="w-full bg-slate-800/80 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                    />
                  </div>
                </div>

                {collaborators.length > 0 && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Responsable principal</label>
                      <select
                        value={editForm.team_member_id}
                        onChange={e => setEditForm(prev => ({ ...prev, team_member_id: e.target.value, shared_with_member_id: e.target.value === prev.shared_with_member_id ? '' : prev.shared_with_member_id }))}
                        style={{ colorScheme: 'dark' }}
                        className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                      >
                        {collaborators.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}{c.position ? ` — ${c.position}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Segundo integrante <span className="normal-case font-normal text-slate-500">(opcional)</span></label>
                      <select
                        value={editForm.shared_with_member_id}
                        onChange={e => setEditForm(prev => ({ ...prev, shared_with_member_id: e.target.value }))}
                        style={{ colorScheme: 'dark' }}
                        className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                      >
                        <option value="">— Sin segundo integrante —</option>
                        {collaborators.filter(c => c.id !== editForm.team_member_id).map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}{c.position ? ` — ${c.position}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('overview')}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-4 py-2.5 rounded-xl transition text-sm font-medium border border-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !editForm.title.trim()}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl transition text-sm font-semibold flex items-center justify-center gap-2"
                  >
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    {saving ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      </div>

      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxUrl}
            alt="Evidencia"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-red-500/40 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-700">
              <div className="p-2 bg-red-500/20 rounded-lg shrink-0">
                <AlertTriangle size={16} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Eliminar actividad</p>
                <p className="text-xs text-slate-400 mt-0.5">Esta accion no se puede deshacer</p>
              </div>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Se eliminara permanentemente <span className="font-semibold text-white">"{activity.title}"</span> junto con todos sus pasos, seguimientos e imagenes.
              </p>
            </div>
            <div className="flex gap-2 px-4 pb-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-3 py-2 text-xs text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-3 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition flex items-center justify-center gap-1.5"
              >
                {deleting ? <><Loader2 size={12} className="animate-spin" />Eliminando...</> : <><Trash2 size={12} />Eliminar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
