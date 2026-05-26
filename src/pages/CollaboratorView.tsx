import { useState, useEffect, useCallback, Component, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { LogOut, Calendar, ChevronDown, ChevronUp, CheckCircle, CheckCircle2, X, RefreshCw, Home, ChevronLeft, ChevronRight, GitCommitHorizontal, BookOpen, Clock, CheckCheck, AlertCircle, Link2, Search, ImagePlus, Loader2, ZoomIn, Plus, Rocket, FileText, FileSpreadsheet, File, ExternalLink, Shield, Send, AlertTriangle, Wrench, Users } from 'lucide-react';
import { formatDate, getDaysUntilDue } from '../lib/utils';
import ChangelogSection from '../components/ChangelogSection';
import NotificationBell, { type NotifNavTarget } from '../components/NotificationBell';
import DocumentationSection from '../components/DocumentationSection';
import UtilitiesSection from './UtilitiesSection';
import StatusCheckModal, { type ActivityForCheck } from '../components/StatusCheckModal';
import RichTextEditor, { CommentContent, sanitizeHtml } from '../components/RichTextEditor';
import CollabActivityModal from '../components/CollabActivityModal';
import ActivityDetail from '../components/ActivityDetail';
import { useMemberPermissions } from '../lib/useMemberPermissions';
import ReleaseMonitoringModal, { type ActivityToMonitor } from '../components/ReleaseMonitoringModal';

class ModalErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { this.props.onError(); }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

interface CollaboratorViewProps {
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberPosition?: string;
  onLogout: () => void;
}

function RevisionModal({
  activity,
  memberId,
  memberName,
  memberPosition,
  teamId,
  onClose,
  onRefresh,
  onRequestEvidence,
}: {
  activity: any;
  memberId: string;
  memberName: string;
  memberPosition: string;
  teamId: string;
  onClose: () => void;
  onRefresh: () => void;
  onRequestEvidence: (activityId: string) => void;
}) {
  const { can } = useMemberPermissions(memberId, memberPosition);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [taskSteps, setTaskSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'comments' | 'revisions' | 'tasks'>('tasks');
  const [newComment, setNewComment] = useState('');
  const [sending, setSending] = useState(false);
  const [togglingStep, setTogglingStep] = useState<string | null>(null);
  const [sendingReview, setSendingReview] = useState(false);
  const [movingToTesting, setMovingToTesting] = useState(false);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingDocs, setPendingDocs] = useState<File[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [confirmingRelease, setConfirmingRelease] = useState(false);
  const [showConfirmRelease, setShowConfirmRelease] = useState(false);

  const isShared = !!(activity.shared_with_member_id);

  const loadData = async () => {
    setLoading(true);
    const [rData, tData] = await Promise.all([
      supabase.from('activity_revisions').select('*').eq('activity_id', activity.id).order('created_at', { ascending: false }),
      supabase.from('task_steps').select('*').eq('activity_id', activity.id).order('order_index'),
    ]);
    setRevisions(rData.data || []);
    setTaskSteps(tData.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [activity.id]);

  const uploadFiles = async (files: File[], folder: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'bin';
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

  const submitComment = async () => {
    const plainText = newComment.replace(/<[^>]+>/g, '').trim();
    if ((!plainText && pendingImages.length === 0 && pendingDocs.length === 0) || sending) return;
    setSending(true);
    setUploadingImages(pendingImages.length > 0 || pendingDocs.length > 0);

    const [imageUrls, docUrls] = await Promise.all([
      pendingImages.length > 0 ? uploadFiles(pendingImages, 'img') : Promise.resolve([]),
      pendingDocs.length > 0 ? uploadFiles(pendingDocs, 'docs') : Promise.resolve([]),
    ]);
    setUploadingImages(false);

    const { error } = await supabase.from('activity_revisions').insert({
      activity_id: activity.id,
      status: activity.status,
      comments: newComment ? sanitizeHtml(newComment) : null,
      author_name: memberName,
      image_urls: imageUrls.length > 0 ? imageUrls : [],
      doc_urls: docUrls.length > 0 ? docUrls : [],
    });

    if (!error) {
      setNewComment('');
      setPendingImages([]);
      setPendingDocs([]);
      await loadData();
    }
    setSending(false);
  };

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    setPendingImages(prev => [...prev, ...valid].slice(0, 5));
  };

  const removePendingImage = (idx: number) =>
    setPendingImages(prev => prev.filter((_, i) => i !== idx));

  const toggleStep = async (step: any) => {
    if (togglingStep) return;
    // Only allow toggling own steps
    if (step.assigned_member_id && step.assigned_member_id !== memberId) return;
    setTogglingStep(step.id);
    await supabase.from('task_steps').update({ completed: !step.completed }).eq('id', step.id);
    await loadData();
    setTogglingStep(null);
  };

  // My steps = steps assigned to me (or unassigned steps if not shared)
  const mySteps = taskSteps.filter(s =>
    isShared ? s.assigned_member_id === memberId : true
  );
  const myStepsDone = mySteps.length > 0 && mySteps.every(s => s.completed);
  const allStepsDone = taskSteps.length > 0 && taskSteps.every(s => s.completed);

  const canSendToReview = myStepsDone &&
    !['IN_REVIEW', 'APPROVED'].includes(activity.status) &&
    activity.status !== 'NEEDS_REVISION' &&
    can('send_to_review');

  const sendToReview = async () => {
    if (!canSendToReview || sendingReview) return;

    const shouldSendNow = allStepsDone || !isShared;

    if (shouldSendNow) {
      // Show evidence modal — actual send happens after evidence is submitted
      onClose();
      onRequestEvidence(activity.id);
    } else {
      // Partial completion — notify the other collaborator without evidence
      setSendingReview(true);
      const otherId = activity.team_member_id === memberId
        ? activity.shared_with_member_id
        : activity.team_member_id;

      if (otherId) {
        await supabase.from('notifications').insert({
          team_member_id: otherId,
          activity_id: activity.id,
          type: 'REVIEW_REQUESTED',
          title: 'Tu parte está lista',
          body: `${memberName} completó su parte en "${activity.title}". Completa la tuya para enviar a revisión.`,
        });
      }

      await supabase.from('activity_revisions').insert({
        activity_id: activity.id,
        status: activity.status,
        comments: `${memberName} completó sus pasos asignados y está listo para revisión.`,
        author_name: memberName,
      });

      setSendingReview(false);
      onRefresh();
      onClose();
    }
  };

  const canMoveToTesting = ['IN_PROGRESS', 'PENDING'].includes(activity.status) && can('move_to_testing');

  const moveToTesting = async () => {
    if (!canMoveToTesting || movingToTesting) return;
    setMovingToTesting(true);
    await supabase.from('activities').update({
      status: 'TESTING',
      updated_at: new Date().toISOString(),
    }).eq('id', activity.id);
    await supabase.from('activity_revisions').insert({
      activity_id: activity.id,
      status: 'TESTING',
      comments: `${memberName} movió la actividad a fase de pruebas.`,
      author_name: memberName,
    });
    setMovingToTesting(false);
    onRefresh();
  };

  const handleConfirmRelease = async () => {
    if (confirmingRelease) return;
    setConfirmingRelease(true);
    const now = new Date().toISOString();
    await supabase.from('activities').update({ released_to_production_at: now }).eq('id', activity.id);

    // Notify the manager — find manager's team_member_id via app_roles → team_members
    const { data: roleData } = await supabase
      .from('app_roles')
      .select('user_id')
      .eq('team_id', teamId)
      .in('role', ['manager', 'super_admin'])
      .maybeSingle();

    if (roleData?.user_id) {
      const { data: mgrMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', roleData.user_id)
        .maybeSingle();

      if (mgrMember?.id) {
        const formatted = new Date(now).toLocaleDateString('es-MX', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
        await supabase.from('notifications').insert({
          team_member_id: mgrMember.id,
          activity_id: activity.id,
          type: 'ACTIVITY_UPDATED',
          title: `Liberado a producción: ${activity.title}`,
          body: `${memberName} confirmó que "${activity.title}" ya está en producción el ${formatted}.`,
        });
      }
    }

    setConfirmingRelease(false);
    setShowConfirmRelease(false);
    onRefresh();
    onClose();
  };

  const statusLabel = (s: string) => ({ PENDING: 'Pendiente', IN_PROGRESS: 'En Proceso', TESTING: 'En Pruebas', COMPLETED: 'Completada', BLOCKED: 'Bloqueada', IN_REVIEW: 'En Revisión', NEEDS_REVISION: 'Corrección', APPROVED: 'Aprobada' }[s] ?? s);
  const statusColor = (s: string) => ({
    COMPLETED:      'bg-green-500/30 text-green-200',
    IN_PROGRESS:    'bg-yellow-500/30 text-yellow-200',
    TESTING:        'bg-cyan-500/30 text-cyan-200',
    BLOCKED:        'bg-red-500/30 text-red-200',
    PENDING:        'bg-slate-500/30 text-slate-300',
    IN_REVIEW:      'bg-amber-500/30 text-amber-200',
    NEEDS_REVISION: 'bg-red-500/30 text-red-200',
    APPROVED:       'bg-emerald-500/30 text-emerald-200',
  }[s] ?? 'bg-slate-500/30 text-slate-300');

  // Open on comments tab if there's a review note pending
  const hasReviewNote = activity.status === 'NEEDS_REVISION' && activity.review_note;

  const priorityBar = { HIGH: 'bg-red-500', MEDIUM: 'bg-yellow-500', LOW: 'bg-green-500' }[activity.priority as string] ?? 'bg-slate-500';
  const priorityTag = { HIGH: 'bg-red-500/20 text-red-300 border-red-500/30', MEDIUM: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', LOW: 'bg-green-500/20 text-green-300 border-green-500/30' }[activity.priority as string] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  const priorityLabel = { HIGH: 'ALTA', MEDIUM: 'MEDIA', LOW: 'BAJA' }[activity.priority as string] ?? activity.priority;

  return (
    <>
    {showConfirmRelease && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]">
        <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-red-900/50 to-slate-800 px-4 py-3 border-b border-slate-700 flex items-center gap-2.5">
            <div className="p-1.5 bg-red-500/20 rounded-lg shrink-0">
              <Rocket size={14} className="text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">Confirmar liberación a producción</p>
              <p className="text-slate-400 text-xs truncate mt-0.5">{activity.title}</p>
            </div>
            <button onClick={() => setShowConfirmRelease(false)} className="text-slate-400 hover:text-white transition p-1 shrink-0">
              <X size={16} />
            </button>
          </div>
          <div className="p-4 space-y-3">
            {activity.production_release_date && (
              <div className="bg-slate-700/40 rounded-lg px-3 py-2.5 flex items-center gap-2.5">
                <CheckCircle size={13} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Fecha programada</p>
                  <p className="text-xs font-semibold text-white">
                    {new Date(activity.production_release_date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                </div>
              </div>
            )}
            <p className="text-xs text-slate-400 leading-relaxed">
              Al confirmar, se notificará al gestor que el cambio ya está en producción y el ciclo quedará completo.
            </p>
          </div>
          <div className="flex gap-2 px-4 pb-4">
            <button onClick={() => setShowConfirmRelease(false)} className="flex-1 px-3 py-2 text-xs text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
              Cancelar
            </button>
            <button
              onClick={handleConfirmRelease}
              disabled={confirmingRelease}
              className="flex-1 px-3 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition flex items-center justify-center gap-1.5"
            >
              {confirmingRelease
                ? <><svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Confirmando...</>
                : <><Rocket size={13} />Ya está en producción</>
              }
            </button>
          </div>
        </div>
      </div>
    )}
    <div
      className="fixed inset-0 bg-black/70 flex items-start justify-center p-4 z-50 overflow-y-auto cursor-auto select-text"
      onDragStart={e => e.preventDefault()}
    >
      <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-2xl w-full my-8 shadow-2xl flex flex-col cursor-auto select-text" style={{ maxHeight: 'calc(100vh - 4rem)' }}>

        {/* Priority accent bar — fixed at top */}
        <div className={`${priorityBar} h-1 w-full rounded-t-2xl shrink-0`} />

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 flex flex-col min-h-0">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-700/60 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                {activity.project && (
                  <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">{activity.project}</span>
                )}
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${priorityTag}`}>{priorityLabel}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${statusColor(activity.status)}`}>{statusLabel(activity.status)}</span>
              </div>
              {activity.environment && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${{
                  DEV:     'bg-blue-500/20 text-blue-300',
                  QA:      'bg-yellow-500/20 text-yellow-300',
                  STAGING: 'bg-orange-500/20 text-orange-300',
                  PROD:    'bg-red-500/20 text-red-300',
                }[activity.environment as string] ?? 'bg-slate-500/20 text-slate-300'}`}>
                  {activity.environment}
                </span>
              )}
              <h2 className="text-lg font-bold text-white leading-snug break-words">{activity.title}</h2>
              <p className="text-xs text-slate-500 mt-1">
                {activity.created_at && `Creada ${new Date(activity.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                {activity.end_date && ` · Vence ${formatDate(activity.end_date)}`}
              </p>
              {activity.production_release_date && !activity.released_to_production_at && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
                    <Rocket size={13} className="text-emerald-400 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-emerald-300">Fecha de liberación programada</p>
                      <p className="text-xs text-emerald-400/80">
                        {new Date(activity.production_release_date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowConfirmRelease(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-xs font-semibold text-red-300 transition"
                  >
                    <Rocket size={12} />
                    Confirmar liberación a producción
                  </button>
                </div>
              )}
              {activity.released_to_production_at && (
                <div className="mt-2 flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-3 py-2">
                  <CheckCircle size={13} className="text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-300">Liberado a producción</p>
                    <p className="text-xs text-emerald-400/80">
                      {new Date(activity.released_to_production_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white hover:bg-slate-700 p-1.5 rounded-lg transition shrink-0 mt-0.5">
              <X size={18} />
            </button>
          </div>

          {/* Description — clamped with expand */}
          {activity.description && (
            <div className="mt-4 p-4 bg-slate-800/60 rounded-xl border border-slate-700/40">
              <p className="text-sm text-slate-300 leading-relaxed break-all whitespace-pre-wrap">{activity.description}</p>
            </div>
          )}

          {/* Review note alert */}
          {hasReviewNote && (
            <div className="mt-3 flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-xl p-4">
              <div className="p-1.5 bg-red-500/20 rounded-lg shrink-0">
                <AlertCircle size={14} className="text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-red-300 uppercase tracking-wide mb-1">Devuelta por el gestor</p>
                <p className="text-sm text-red-200/90 leading-relaxed break-words">{activity.review_note}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700/60 px-6 bg-slate-900 shrink-0">
          {([
            { id: 'tasks'     as const, label: 'Pasos', count: taskSteps.length },
            { id: 'comments'  as const, label: 'Comentarios', count: revisions.length },
            { id: 'revisions' as const, label: 'Historial', count: null },
          ]).map(({ id, label, count }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 py-3 mr-6 text-sm font-medium transition border-b-2 whitespace-nowrap ${
                activeTab === id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}>
              {label}
              {count !== null && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === id ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-700 text-slate-400'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
              <span className="text-sm">Cargando...</span>
            </div>
          ) : activeTab === 'comments' ? (
            <div className="space-y-5">
              {/* Comment input */}
              <div className="space-y-3">
                <RichTextEditor
                  value={newComment}
                  onChange={setNewComment}
                  placeholder="Escribe un comentario... Ctrl+V para pegar imagen como evidencia"
                  minRows={3}
                  pendingImages={pendingImages}
                  onImagesChange={setPendingImages}
                  onPasteImage={files => setPendingImages(prev => [...prev, ...files].slice(0, 5))}
                  pendingDocs={pendingDocs}
                  onDocsChange={setPendingDocs}
                />
                <div className="flex items-center justify-end">
                  <button
                    onClick={submitComment}
                    disabled={(!newComment.replace(/<[^>]+>/g, '').trim() && pendingImages.length === 0 && pendingDocs.length === 0) || sending}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition"
                  >
                    {sending
                      ? <><Loader2 size={13} className="animate-spin" />{uploadingImages ? 'Subiendo...' : 'Enviando...'}</>
                      : 'Agregar comentario'
                    }
                  </button>
                </div>
              </div>

              {/* Comment history */}
              {revisions.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-slate-700 rounded-xl">
                  <p className="text-slate-500 text-sm">Sin comentarios aún.</p>
                  <p className="text-slate-600 text-xs mt-1">Sé el primero en agregar un comentario</p>
                </div>
              ) : (
                <div className="space-y-3 pr-1">
                  {revisions.map((rev) => (
                    <div key={rev.id} className="bg-slate-800/70 border border-slate-700/50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {((rev.author_name || memberName || '?')[0] ?? '?').toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-200">{rev.author_name ?? memberName ?? 'Colaborador'}</p>
                            <p className="text-[10px] text-slate-500">
                              {rev.created_at ? new Date(rev.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                              {rev.created_at ? ' · ' + new Date(rev.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}
                            </p>
                          </div>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${statusColor(rev.status)}`}>
                          {statusLabel(rev.status)}
                        </span>
                      </div>
                      {rev.comments && (
                        /<[a-z][\s\S]*>/i.test(rev.comments)
                          ? <CommentContent html={rev.comments} />
                          : <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{rev.comments}</p>
                      )}
                      {/* Evidence images */}
                      {rev.image_urls && rev.image_urls.length > 0 && (
                        <div className={`flex gap-2 flex-wrap ${rev.comments ? 'mt-3' : ''}`}>
                          {rev.image_urls.map((url: string, i: number) => (
                            <button
                              key={i}
                              onClick={() => setLightboxUrl(url)}
                              className="relative group w-24 h-24 rounded-lg overflow-hidden border border-slate-600 bg-slate-900 shrink-0 hover:border-blue-500 transition"
                            >
                              <img src={url} alt={`Evidencia ${i + 1}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center">
                                <ZoomIn size={16} className="text-white opacity-0 group-hover:opacity-100 transition" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Attached documents */}
                      {rev.doc_urls && rev.doc_urls.length > 0 && (
                        <div className={`space-y-1.5 ${(rev.comments || (rev.image_urls?.length > 0)) ? 'mt-3' : ''}`}>
                          {rev.doc_urls.map((url: string, i: number) => {
                            const fileName = decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? `Documento ${i + 1}`).replace(/^\d+-/, '');
                            const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
                            const DocIco = ['xls','xlsx','csv'].includes(ext)
                              ? <FileSpreadsheet size={13} className="text-green-400 shrink-0" />
                              : ext === 'pdf'
                              ? <FileText size={13} className="text-red-400 shrink-0" />
                              : <File size={13} className="text-blue-400 shrink-0" />;
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
                                <ExternalLink size={11} className="text-slate-500 group-hover/doc:text-slate-300 transition shrink-0" />
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Lightbox */}
              {lightboxUrl && (
                <div
                  className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 cursor-zoom-out"
                  onClick={() => setLightboxUrl(null)}
                >
                  <button
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
            </div>
          ) : activeTab === 'tasks' ? (
            taskSteps.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-700 rounded-xl">
                <p className="text-slate-500 text-sm">Sin pasos definidos para esta actividad</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Progress summary */}
                <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                      <span>Progreso general</span>
                      <span className="font-semibold text-white">{taskSteps.filter(s => s.completed).length}/{taskSteps.length}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-1.5">
                      <div
                        className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${taskSteps.length > 0 ? (taskSteps.filter(s => s.completed).length / taskSteps.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                {isShared && (
                  <div className="text-xs text-slate-500 bg-slate-800/40 border border-slate-700/40 rounded-lg px-3 py-2">
                    Solo puedes marcar como completados tus pasos asignados. Los pasos de otros colaboradores son de solo lectura.
                  </div>
                )}

                <div className="space-y-2.5 pr-1">
                  {taskSteps.map((step, idx) => {
                    const typeLabel: Record<string, string> = { DATABASE: 'Base de Datos', CODE: 'Código', TESTING: 'Testing', DOCUMENTATION: 'Documentación' };
                    const isOwnStep = !step.assigned_member_id || step.assigned_member_id === memberId;
                    const isOtherStep = isShared && step.assigned_member_id && step.assigned_member_id !== memberId;
                    const isToggling = togglingStep === step.id;

                    return (
                      <div
                        key={step.id}
                        className={`flex items-start gap-3 border rounded-xl p-4 transition-all ${
                          step.completed
                            ? 'bg-green-500/5 border-green-500/20'
                            : isOtherStep
                            ? 'bg-slate-800/30 border-slate-700/30 opacity-70'
                            : 'bg-slate-800/60 border-slate-700/50'
                        }`}
                      >
                        {/* Toggle button — only for own steps */}
                        <button
                          onClick={() => isOwnStep && !['IN_REVIEW', 'APPROVED'].includes(activity.status) && toggleStep(step)}
                          disabled={!isOwnStep || isToggling || ['IN_REVIEW', 'APPROVED'].includes(activity.status)}
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold transition-all ${
                            step.completed
                              ? 'bg-green-500 text-white'
                              : isOwnStep && !['IN_REVIEW', 'APPROVED'].includes(activity.status)
                              ? 'bg-slate-700 text-slate-400 hover:bg-blue-600 hover:text-white cursor-pointer border border-slate-600 hover:border-blue-500'
                              : 'bg-slate-800 text-slate-600 cursor-default border border-slate-700'
                          }`}
                        >
                          {isToggling
                            ? <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                            : step.completed ? <CheckCircle size={13} /> : <span>{idx + 1}</span>
                          }
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <p className={`text-sm font-medium ${step.completed ? 'text-slate-400 line-through' : 'text-white'}`}>{step.title}</p>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {step.assigned_member_name && (
                                <span className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 border ${
                                  isOwnStep
                                    ? 'text-blue-300 bg-blue-500/10 border-blue-500/20'
                                    : 'text-slate-400 bg-slate-700/50 border-slate-600/50'
                                }`}>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                                  {step.assigned_member_name}
                                  {isOwnStep && <span className="text-blue-400/70 ml-0.5">(tú)</span>}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {step.step_type && (
                              <span className="text-xs text-slate-500">{typeLabel[step.step_type] ?? step.step_type}</span>
                            )}
                            {isOwnStep && !step.completed && !['IN_REVIEW', 'APPROVED'].includes(activity.status) && (
                              <span className="text-[10px] text-blue-400/60">Toca el círculo para completar</span>
                            )}
                          </div>
                          {step.description && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{step.description}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Move to Testing button */}
                {canMoveToTesting && (
                  <div className="pt-2 border-t border-slate-700/50">
                    <button
                      onClick={moveToTesting}
                      disabled={movingToTesting}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-700/40 hover:bg-cyan-600/50 disabled:opacity-50 text-cyan-200 text-sm font-semibold rounded-xl transition border border-cyan-600/40"
                    >
                      {movingToTesting
                        ? <><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Moviendo...</>
                        : <>Pasar a Pruebas (Testing)</>
                      }
                    </button>
                  </div>
                )}

                {/* Send to review button */}
                {canSendToReview && (
                  <div className="pt-2 border-t border-slate-700/50 space-y-2">
                    {isShared && !allStepsDone && (
                      <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                        <AlertCircle size={13} className="shrink-0 mt-0.5" />
                        <span>Tus pasos están listos. Se notificará al otro colaborador para que complete los suyos antes de enviar a revisión.</span>
                      </div>
                    )}
                    <button
                      onClick={sendToReview}
                      disabled={sendingReview}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition"
                    >
                      {sendingReview
                        ? <><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Enviando...</>
                        : <><CheckCheck size={16} />{isShared && !allStepsDone ? 'Marcar mi parte lista y notificar' : 'Enviar a revisión'}</>
                      }
                    </button>
                  </div>
                )}
              </div>
            )
          ) : (
            revisions.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-700 rounded-xl">
                <p className="text-slate-500 text-sm">Sin seguimientos registrados</p>
              </div>
            ) : (
              <div className="space-y-3 pr-1">
                {revisions.map((rev) => (
                  <div key={rev.id} className="bg-slate-800/70 border border-slate-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-slate-500">
                        {rev.created_at ? new Date(rev.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                        {rev.created_at ? ' · ' + new Date(rev.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${statusColor(rev.status)}`}>
                        {statusLabel(rev.status)}
                      </span>
                    </div>
                    {rev.comments && (
                      /<[a-z][\s\S]*>/i.test(rev.comments)
                        ? <CommentContent html={rev.comments} />
                        : <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{rev.comments}</p>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
        </div>{/* end scrollable body */}
      </div>
    </div>
    </>
  );
}

function LinkChangelogModal({
  activity,
  memberId,
  teamId,
  onClose,
  onLinked,
}: {
  activity: any;
  memberId: string;
  teamId: string;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Load existing link
      const { data: link } = await supabase
        .from('activity_changelog_links')
        .select('changelog_entry_id')
        .eq('activity_id', activity.id)
        .maybeSingle();

      if (link) {
        const { data: entry } = await supabase
          .from('changelog_entries')
          .select('id, title, release_date, environment, status')
          .eq('id', link.changelog_entry_id)
          .maybeSingle();
        setExisting(entry);
        setLoading(false);
        return;
      }

      // Fetch all changelog entry IDs already linked to any activity
      const { data: usedLinks } = await supabase
        .from('activity_changelog_links')
        .select('changelog_entry_id');
      const usedIds: string[] = (usedLinks || []).map((l: any) => l.changelog_entry_id);

      // Load collaborator's changelog entries excluding already-linked ones
      let query = supabase
        .from('changelog_entries')
        .select('id, title, release_date, environment, status, project_id')
        .eq('team_member_id', memberId)
        .order('created_at', { ascending: false });

      if (usedIds.length > 0) {
        query = query.not('id', 'in', `(${usedIds.join(',')})`);
      }

      const { data } = await query;
      setEntries(data || []);
      setLoading(false);
    };
    load();
  }, [activity.id, memberId]);

  const filtered = entries.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleLink = async () => {
    if (!selected || saving) return;
    setSaving(true);
    await supabase.from('activity_changelog_links').insert({
      activity_id: activity.id,
      changelog_entry_id: selected,
    });
    // Notify managers
    if (teamId) {
      const { data: managers } = await supabase
        .from('team_members').select('id').eq('team_id', teamId).not('user_id', 'is', null);
      if (managers && managers.length > 0) {
        const entry = entries.find(e => e.id === selected);
        await supabase.from('notifications').insert(
          managers.map((m: any) => ({
            team_member_id: m.id,
            activity_id: activity.id,
            type: 'CHANGELOG_LINKED',
            title: 'Control de Cambios vinculado',
            body: `Se vinculó "${entry?.title ?? 'una liberación'}" a la actividad "${activity.title}".`,
          }))
        );
      }
    }
    setSaving(false);
    onLinked();
    onClose();
  };

  const envColor = (env: string) => ({
    PROD: 'bg-red-500/20 text-red-300',
    QA:   'bg-yellow-500/20 text-yellow-300',
    DEV:  'bg-blue-500/20 text-blue-300',
  }[env] ?? 'bg-slate-500/20 text-slate-300');

  const statusColor = (s: string) => ({
    SUCCESS:  'text-green-400',
    FAILED:   'text-red-400',
    ROLLBACK: 'text-orange-400',
    PENDING:  'text-slate-400',
  }[s] ?? 'text-slate-400');

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-cyan-500/20 rounded-lg">
              <Link2 size={16} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm">Vincular Control de Cambios</h2>
              <p className="text-slate-400 text-xs mt-0.5 max-w-xs truncate">{activity.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X size={18} /></button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Cargando...</div>
          ) : existing ? (
            // Already linked
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-green-300 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                <CheckCheck size={13} className="shrink-0" />
                <span className="font-medium">Esta actividad ya tiene un Control de Cambios vinculado</span>
              </div>
              <div className="bg-slate-700/60 border border-slate-600 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <GitCommitHorizontal size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-snug">{existing.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${envColor(existing.environment)}`}>{existing.environment}</span>
                      <span className={`text-xs font-medium ${statusColor(existing.status)}`}>{existing.status}</span>
                      <span className="text-xs text-slate-500">{new Date(existing.release_date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="w-full px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                Cerrar
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <GitCommitHorizontal size={32} className="mx-auto text-slate-600" />
              <p className="text-slate-400 text-sm">No tienes entradas de Control de Cambios registradas</p>
              <p className="text-slate-500 text-xs">Ve a la pestaña "Control de Cambios" para crear una</p>
              <button onClick={onClose} className="mt-2 px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition">Cerrar</button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">Selecciona la entrada de Control de Cambios que corresponde a esta actividad:</p>
              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar liberación..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              {/* Entry list */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filtered.length === 0 ? (
                  <p className="text-center text-slate-500 py-4 text-sm">Sin resultados</p>
                ) : filtered.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => setSelected(entry.id)}
                    className={`w-full text-left rounded-xl border p-3.5 transition ${
                      selected === entry.id
                        ? 'bg-cyan-500/15 border-cyan-500/50 ring-1 ring-cyan-500/30'
                        : 'bg-slate-700/40 border-slate-600 hover:border-slate-500 hover:bg-slate-700/70'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition ${selected === entry.id ? 'border-cyan-400 bg-cyan-400' : 'border-slate-500'}`}>
                        {selected === entry.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white leading-snug truncate">{entry.title}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${envColor(entry.environment)}`}>{entry.environment}</span>
                          <span className={`text-xs font-medium ${statusColor(entry.status)}`}>{entry.status}</span>
                          <span className="text-xs text-slate-500">{new Date(entry.release_date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                  Cancelar
                </button>
                <button
                  onClick={handleLink}
                  disabled={!selected || saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
                >
                  {saving
                    ? <><svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Vinculando...</>
                    : <><Link2 size={14} />Vincular</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LinkDocModal({
  activity,
  teamId,
  onClose,
  onLinked,
}: {
  activity: any;
  teamId: string;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // Check if already linked
      if (activity.doc_entry_id) {
        const { data: entry } = await supabase
          .from('documentation_entries')
          .select('id, title, project_name, status')
          .eq('id', activity.doc_entry_id)
          .maybeSingle();
        setExisting(entry);
        setLoading(false);
        return;
      }
      // Load team doc entries (current versions)
      const { data } = await supabase
        .from('documentation_entries')
        .select('id, title, project_name, status')
        .eq('team_id', teamId)
        .is('parent_id', null)
        .order('created_at', { ascending: false });
      setEntries(data || []);
      setLoading(false);
    };
    load();
  }, [activity.id, activity.doc_entry_id, teamId]);

  const filtered = entries.filter(e =>
    `${e.title} ${e.project_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleLink = async () => {
    if (!selected || saving) return;
    setSaving(true);
    await supabase.from('activities').update({ doc_entry_id: selected }).eq('id', activity.id);
    setSaving(false);
    onLinked();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/20 rounded-lg">
              <BookOpen size={16} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm">Vincular Documentación</h2>
              <p className="text-slate-400 text-xs mt-0.5 max-w-xs truncate">{activity.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1"><X size={18} /></button>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">Cargando...</div>
          ) : existing ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-green-300 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                <CheckCheck size={13} className="shrink-0" />
                <span className="font-medium">Documentación ya vinculada a esta actividad</span>
              </div>
              <div className="bg-slate-700/60 border border-slate-600 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <BookOpen size={16} className="text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white leading-snug">{existing.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {existing.project_name && <span className="text-[10px] font-medium text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">{existing.project_name}</span>}
                      <span className="text-[10px] font-bold text-emerald-400">{existing.status}</span>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="w-full px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition">Cerrar</button>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <BookOpen size={32} className="mx-auto text-slate-600" />
              <p className="text-slate-400 text-sm">No hay entradas de documentación disponibles</p>
              <p className="text-slate-500 text-xs">Ve a la pestaña "Documentación" para crear una</p>
              <button onClick={onClose} className="mt-2 px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition">Cerrar</button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-300">Selecciona el documento asociado a esta actividad:</p>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar documento..."
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filtered.length === 0 ? (
                  <p className="text-center text-slate-500 py-4 text-sm">Sin resultados</p>
                ) : filtered.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => setSelected(entry.id)}
                    className={`w-full text-left rounded-xl border p-3.5 transition ${
                      selected === entry.id
                        ? 'bg-amber-500/15 border-amber-500/50 ring-1 ring-amber-500/30'
                        : 'bg-slate-700/40 border-slate-600 hover:border-slate-500 hover:bg-slate-700/70'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition ${selected === entry.id ? 'border-amber-400 bg-amber-400' : 'border-slate-500'}`}>
                        {selected === entry.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white leading-snug truncate">{entry.title}</p>
                        {entry.project_name && <p className="text-xs text-slate-400 mt-0.5">{entry.project_name}</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                  Cancelar
                </button>
                <button
                  onClick={handleLink}
                  disabled={!selected || saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
                >
                  {saving
                    ? <><svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Vinculando...</>
                    : <><BookOpen size={14} />Vincular</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityReadCard({ activity, memberId, memberName, memberPosition, teamId, onRefresh, onModalOpen, onModalClose, onRequestEvidence }: { activity: any; memberId: string; memberName: string; memberPosition: string; teamId: string; onRefresh: () => void; onModalOpen: () => void; onModalClose: () => void; onRequestEvidence: (activityId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showDocLinkModal, setShowDocLinkModal] = useState(false);
  const [hasLink, setHasLink] = useState<boolean | null>(null);
  const [showConfirmRelease, setShowConfirmRelease] = useState(false);
  const [confirmingRelease, setConfirmingRelease] = useState(false);
  const daysUntilDue = getDaysUntilDue(activity.end_date);

  const handleConfirmRelease = async () => {
    if (confirmingRelease) return;
    setConfirmingRelease(true);
    const now = new Date().toISOString();
    await supabase.from('activities').update({ released_to_production_at: now }).eq('id', activity.id);

    // Notify the manager
    const { data: roleData } = await supabase
      .from('app_roles')
      .select('user_id')
      .eq('team_id', teamId)
      .in('role', ['manager', 'super_admin'])
      .maybeSingle();

    if (roleData?.user_id) {
      const { data: mgrMember } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', teamId)
        .eq('user_id', roleData.user_id)
        .maybeSingle();

      if (mgrMember?.id) {
        const formatted = new Date(now).toLocaleDateString('es-MX', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
        await supabase.from('notifications').insert({
          team_member_id: mgrMember.id,
          activity_id: activity.id,
          type: 'ACTIVITY_UPDATED',
          title: `Liberado a producción: ${activity.title}`,
          body: `${memberName} confirmó que "${activity.title}" ya está en producción el ${formatted}.`,
        });
      }
    }

    setConfirmingRelease(false);
    setShowConfirmRelease(false);
    onRefresh();
  };

  // Check if CDC is already linked
  useEffect(() => {
    if (activity.status !== 'APPROVED' || !activity.changelog_requested) return;
    supabase.from('activity_changelog_links')
      .select('id', { count: 'exact', head: true })
      .eq('activity_id', activity.id)
      .then(({ count }) => setHasLink((count ?? 0) > 0));
  }, [activity.id, activity.status, activity.changelog_requested]);

  const priorityBg = { HIGH: 'bg-red-500/20 border-red-500/50', MEDIUM: 'bg-yellow-500/20 border-yellow-500/50', LOW: 'bg-green-500/20 border-green-500/50' }[activity.priority as string] ?? 'bg-slate-700 border-slate-600';
  const priorityBar = { HIGH: 'bg-red-500', MEDIUM: 'bg-yellow-500', LOW: 'bg-green-500' }[activity.priority as string] ?? 'bg-slate-500';
  const priorityTag = { HIGH: 'bg-red-500/30 text-red-200', MEDIUM: 'bg-yellow-500/30 text-yellow-200', LOW: 'bg-green-500/30 text-green-200' }[activity.priority as string] ?? '';
  const priorityLabel = { HIGH: 'ALTA', MEDIUM: 'MEDIA', LOW: 'BAJA' }[activity.priority as string] ?? activity.priority;

  const isInReview    = activity.status === 'IN_REVIEW';
  const isApproved    = activity.status === 'APPROVED';
  const needsRevision = activity.status === 'NEEDS_REVISION';

  return (
    <>
      <div
        onClick={() => { setShowModal(true); onModalOpen(); }}
        className={`rounded-xl border cursor-pointer group transition-all duration-150 overflow-hidden
          ${needsRevision
            ? 'bg-red-950/30 border-red-500/40 hover:border-red-400/60'
            : isInReview
            ? 'bg-slate-800 border-amber-500/30 hover:border-amber-400/50'
            : isApproved
            ? 'bg-slate-800 border-emerald-500/30 hover:border-emerald-400/50'
            : priorityBg + ' hover:border-opacity-80'
          }`}
      >
        {/* Top accent bar */}
        <div className={`${needsRevision ? 'bg-red-500' : isInReview ? 'bg-amber-500' : isApproved ? 'bg-emerald-500' : priorityBar} h-1 w-full`} />

        <div className="p-4">
          {/* Status banners */}
          {needsRevision && (
            <div className="flex items-start gap-2.5 mb-3 bg-red-500/10 border border-red-500/25 rounded-lg p-3">
              <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-red-300 mb-0.5">Devuelta para corrección</p>
                {activity.review_note && (
                  <p className="text-xs text-red-200/75 leading-snug line-clamp-2">{activity.review_note}</p>
                )}
                <p className="text-[10px] text-red-400/50 mt-1.5">Toca para ver los detalles</p>
              </div>
            </div>
          )}
          {isInReview && (
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <Clock size={12} className="text-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-amber-300">En revisión con el gestor</span>
              </div>
              {activity.activity_type === 'DOCUMENTATION' && (
                activity.doc_entry_id ? (
                  <div
                    onClick={e => { e.stopPropagation(); setShowDocLinkModal(true); onModalOpen(); }}
                    className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 cursor-pointer hover:bg-amber-500/15 transition"
                  >
                    <BookOpen size={12} className="text-amber-400 shrink-0" />
                    <span className="text-xs font-semibold text-amber-300 flex-1">Documentación vinculada</span>
                    <span className="text-[10px] text-amber-400/70 underline underline-offset-2">Ver</span>
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setShowDocLinkModal(true); onModalOpen(); }}
                    className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 hover:border-amber-400/40 rounded-lg px-3 py-2 transition animate-pulse hover:animate-none"
                  >
                    <BookOpen size={12} />
                    Vincular Documentación
                  </button>
                )
              )}
            </div>
          )}
          {isApproved && (
            <div className="mb-3 space-y-2">
              {activity.released_to_production_at ? (
                <div className="flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-3 py-2">
                  <Rocket size={12} className="text-emerald-400 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-300">
                    Liberado a producción · {new Date(activity.released_to_production_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  <CheckCheck size={12} className="text-emerald-400 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-300">Aprobada por el gestor</span>
                </div>
              )}
              {activity.changelog_requested && (
                hasLink === true ? (
                  <div
                    onClick={e => { e.stopPropagation(); setShowLinkModal(true); onModalOpen(); }}
                    className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg px-3 py-2 cursor-pointer hover:bg-cyan-500/15 transition"
                  >
                    <Link2 size={12} className="text-cyan-400 shrink-0" />
                    <span className="text-xs font-semibold text-cyan-300 flex-1">CDC vinculado</span>
                    <span className="text-[10px] text-cyan-400/70 underline underline-offset-2">Ver</span>
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setShowLinkModal(true); onModalOpen(); }}
                    className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 hover:border-cyan-400/40 rounded-lg px-3 py-2 transition"
                  >
                    <Link2 size={12} />
                    Vincular Control de Cambios
                  </button>
                )
              )}
              {activity.doc_link_requested && (
                activity.doc_entry_id ? (
                  <div
                    onClick={e => { e.stopPropagation(); setShowDocLinkModal(true); onModalOpen(); }}
                    className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 cursor-pointer hover:bg-amber-500/15 transition"
                  >
                    <BookOpen size={12} className="text-amber-400 shrink-0" />
                    <span className="text-xs font-semibold text-amber-300 flex-1">Documentación vinculada</span>
                    <span className="text-[10px] text-amber-400/70 underline underline-offset-2">Ver</span>
                  </div>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setShowDocLinkModal(true); onModalOpen(); }}
                    className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 hover:border-amber-400/40 rounded-lg px-3 py-2 transition animate-pulse hover:animate-none"
                  >
                    <BookOpen size={12} />
                    Vincular Documentación
                  </button>
                )
              )}
              {/* Production release CTA — only when date assigned and not yet confirmed */}
              {activity.production_release_date && !activity.released_to_production_at && (
                <button
                  onClick={e => { e.stopPropagation(); setShowConfirmRelease(true); }}
                  className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-red-300 bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 hover:border-red-400/70 rounded-lg px-3 py-2.5 transition animate-pulse hover:animate-none"
                >
                  <Rocket size={12} />
                  Confirmar liberación a producción
                </button>
              )}
            </div>
          )}

          {/* Title + meta */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Badges row — above title */}
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${priorityTag}`}>
                  {priorityLabel}
                </span>
                {activity.activity_type && (() => {
                  const typeStyles: Record<string, string> = {
                    CODE:          'bg-blue-500/15 text-blue-300',
                    DATABASE:      'bg-emerald-500/15 text-emerald-300',
                    BOTH:          'bg-cyan-500/15 text-cyan-300',
                    DOCUMENTATION: 'bg-amber-500/15 text-amber-300',
                    TESTING:       'bg-rose-500/15 text-rose-300',
                  };
                  const typeLabels: Record<string, string> = {
                    CODE: 'Código', DATABASE: 'BD', BOTH: 'Cód+BD', DOCUMENTATION: 'Docs', TESTING: 'Testing',
                  };
                  return (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${typeStyles[activity.activity_type] ?? 'bg-slate-700 text-slate-400'}`}>
                      {typeLabels[activity.activity_type] ?? activity.activity_type}
                    </span>
                  );
                })()}
                {activity.project && (
                  <span className="text-[10px] text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded truncate max-w-[100px]">{activity.project}</span>
                )}
                {!['APPROVED', 'IN_REVIEW', 'COMPLETED', 'NEEDS_REVISION'].includes(activity.status) && daysUntilDue !== null && daysUntilDue <= 2 && daysUntilDue >= 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-500/15 text-amber-400 border-amber-500/25 whitespace-nowrap">
                    <Clock size={9} />
                    {daysUntilDue === 0 ? 'Hoy' : `${daysUntilDue}d`}
                  </span>
                )}
                {!['APPROVED', 'IN_REVIEW', 'COMPLETED', 'NEEDS_REVISION'].includes(activity.status) && daysUntilDue !== null && daysUntilDue < 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border bg-red-500/20 text-red-300 border-red-500/30 whitespace-nowrap">
                    <AlertCircle size={9} />
                    Vencida
                  </span>
                )}
              </div>
              {/* Title — 2 lines max */}
              <h4 className="font-semibold text-white text-sm leading-snug line-clamp-2 group-hover:text-blue-300 transition">
                {activity.title}
              </h4>
              {activity.created_at && (
                <p className="text-[10px] text-slate-500 mt-1.5">
                  {new Date(activity.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="text-slate-500 hover:text-white hover:bg-slate-700 p-1 rounded-lg transition shrink-0 mt-0.5"
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-slate-600/40 space-y-2">
              {activity.description && (
                <p className="text-xs text-slate-400 leading-relaxed line-clamp-4">{activity.description}</p>
              )}
              {activity.end_date && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Calendar size={11} className="text-slate-500" />
                  <span className={daysUntilDue !== null && daysUntilDue < 0 ? 'text-red-400 font-semibold' : daysUntilDue !== null && daysUntilDue <= 3 ? 'text-yellow-400' : 'text-slate-400'}>
                    {formatDate(activity.end_date)}
                    {daysUntilDue !== null && daysUntilDue >= 0 && <span className="ml-1 text-slate-500">({daysUntilDue}d)</span>}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Drag hint */}
          {(activity.status === 'PENDING' || activity.status === 'IN_PROGRESS' || activity.status === 'NEEDS_REVISION') && (
            <p className="mt-3 pt-2.5 border-t border-slate-700/40 text-[10px] text-slate-600 text-center tracking-wide">
              {needsRevision
                ? 'Arrastra a En Proceso para retomar'
                : activity.shared_with_member_id
                ? 'Toca para ver pasos y completar tu parte'
                : 'Arrastra para mover de columna'
              }
            </p>
          )}
        </div>
      </div>

      {showModal && (
        <ModalErrorBoundary onError={() => { setShowModal(false); onModalClose(); }}>
          <RevisionModal
            activity={activity}
            memberId={memberId}
            memberName={memberName}
            memberPosition={memberPosition}
            teamId={teamId}
            onClose={() => { setShowModal(false); onModalClose(); }}
            onRefresh={onRefresh}
            onRequestEvidence={(actId) => { setShowModal(false); onModalClose(); onRequestEvidence(actId); }}
          />
        </ModalErrorBoundary>
      )}
      {showLinkModal && (
        <ModalErrorBoundary onError={() => setShowLinkModal(false)}>
        <LinkChangelogModal
          activity={activity}
          memberId={memberId}
          teamId={teamId}
          onClose={() => { setShowLinkModal(false); onModalClose(); }}
          onLinked={() => { setHasLink(true); onRefresh(); }}
        />
        </ModalErrorBoundary>
      )}
      {showDocLinkModal && (
        <ModalErrorBoundary onError={() => setShowDocLinkModal(false)}>
        <LinkDocModal
          activity={activity}
          teamId={teamId}
          onClose={() => { setShowDocLinkModal(false); onModalClose(); }}
          onLinked={() => { onRefresh(); }}
        />
        </ModalErrorBoundary>
      )}
      {showConfirmRelease && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60]">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-red-900/50 to-slate-800 px-4 py-3 border-b border-slate-700 flex items-center gap-2.5">
              <div className="p-1.5 bg-red-500/20 rounded-lg shrink-0">
                <Rocket size={14} className="text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">Confirmar liberación a producción</p>
                <p className="text-slate-400 text-xs truncate mt-0.5">{activity.title}</p>
              </div>
              <button onClick={() => setShowConfirmRelease(false)} className="text-slate-400 hover:text-white transition p-1 shrink-0">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {activity.production_release_date && (
                <div className="bg-slate-700/40 rounded-lg px-3 py-2.5 flex items-center gap-2.5">
                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">Fecha programada</p>
                    <p className="text-xs font-semibold text-white">
                      {new Date(activity.production_release_date + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-400 leading-relaxed">
                Al confirmar, se notificará al gestor que el cambio ya está en producción y el ciclo quedará completo.
              </p>
            </div>
            <div className="flex gap-2 px-4 pb-4">
              <button onClick={() => setShowConfirmRelease(false)} className="flex-1 px-3 py-2 text-xs text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition">
                Cancelar
              </button>
              <button
                onClick={handleConfirmRelease}
                disabled={confirmingRelease}
                className="flex-1 px-3 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition flex items-center justify-center gap-1.5"
              >
                {confirmingRelease
                  ? <><svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Confirmando...</>
                  : <><Rocket size={13} />Ya está en producción</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatHoDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}

const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const PALETTE = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-orange-500', 'bg-pink-500', 'bg-lime-500'];
const GUARD_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#f97316', '#ec4899', '#84cc16'];

function fmt12(time: string) {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr}${suffix}`;
}

interface GuardShift { id: string; team_member_id: string; member_name: string; date: string; start_time: string; end_time: string; }
interface GuardReport {
  id: string;
  guard_schedule_id: string;
  checkpoint: string;
  status: string;
  project_notes: string;
  observations: string;
  affected_systems: string;
  image_urls: string[];
  created_at: string;
}

const CHECKPOINT_LABELS: Record<string, string> = { INICIO: 'Inicio de turno', MEDIO: 'Mitad del turno', FIN: 'Fin de turno' };
const STATUS_CFG = {
  NORMAL:     { label: 'Normal',     cls: 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
  INCIDENCIA: { label: 'Incidencia', cls: 'border-amber-500/60 bg-amber-500/10 text-amber-300',       dot: 'bg-amber-400',   badge: 'bg-amber-500/20 text-amber-300' },
  CRITICO:    { label: 'Crítico',    cls: 'border-red-500/60 bg-red-500/10 text-red-300',             dot: 'bg-red-400',     badge: 'bg-red-500/20 text-red-300' },
};

// ─── Guard Report Modal ───────────────────────────────────────────────────────

function GuardReportModal({
  shift, memberId, memberName, teamId, existingReports, onClose, onSaved,
}: {
  shift: GuardShift; memberId: string; memberName: string; teamId: string;
  existingReports: GuardReport[]; onClose: () => void; onSaved: () => void;
}) {
  const doneCheckpoints = new Set(existingReports.map(r => r.checkpoint));
  const allDone = doneCheckpoints.has('INICIO') && doneCheckpoints.has('MEDIO') && doneCheckpoints.has('FIN');
  const nextCheckpoint = !doneCheckpoints.has('INICIO') ? 'INICIO'
    : !doneCheckpoints.has('MEDIO') ? 'MEDIO'
    : !doneCheckpoints.has('FIN') ? 'FIN' : null;

  const [checkpoint, setCheckpoint] = useState<'INICIO' | 'MEDIO' | 'FIN'>(nextCheckpoint as any ?? 'INICIO');
  const [status, setStatus] = useState<'NORMAL' | 'INCIDENCIA' | 'CRITICO'>('NORMAL');
  const [projectNotes, setProjectNotes] = useState('');
  const [observations, setObservations] = useState('');
  const [affectedSystems, setAffectedSystems] = useState('');
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  // Past guard history
  const [pastShifts, setPastShifts] = useState<{ shift: GuardShift; reports: GuardReport[] }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [expandedPast, setExpandedPast] = useState<string | null>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    const next = [...pendingImages, ...valid].slice(0, 5);
    setPendingImages(next);
    setPreviews(next.map(f => URL.createObjectURL(f)));
  };

  // Paste handler
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) imageFiles.push(f);
        }
      }
      if (imageFiles.length) addFiles({ length: imageFiles.length, item: (i: number) => imageFiles[i], [Symbol.iterator]: imageFiles[Symbol.iterator].bind(imageFiles) } as any);
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [pendingImages]);

  const uploadImages = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of pendingImages) {
      const path = `guard-reports/${teamId}/${shift.id}/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
      const { error } = await supabase.storage.from('comment-images').upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from('comment-images').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const submit = async () => {
    if (!projectNotes.trim() && !observations.trim() && pendingImages.length === 0) return;
    setSaving(true);
    const imageUrls = await uploadImages();
    await supabase.from('guard_reports').insert({
      guard_schedule_id: shift.id,
      team_member_id: memberId,
      team_id: teamId,
      member_name: memberName,
      checkpoint,
      status,
      project_notes: projectNotes.trim(),
      observations: observations.trim(),
      affected_systems: affectedSystems.trim(),
      image_urls: imageUrls,
    });
    setSaving(false);
    setSuccess(true);
    setTimeout(() => { onSaved(); onClose(); }, 1400);
  };

  const loadHistory = async () => {
    if (historyLoaded) { setShowHistory(h => !h); return; }
    const todayStr = shift.date;
    const { data: prevShifts } = await supabase
      .from('guard_schedules')
      .select('id, team_member_id, member_name, date, start_time, end_time')
      .eq('team_id', teamId)
      .eq('team_member_id', memberId)
      .lt('date', todayStr)
      .order('date', { ascending: false })
      .limit(8);
    if (!prevShifts || prevShifts.length === 0) { setHistoryLoaded(true); setShowHistory(true); return; }
    const ids = prevShifts.map((s: any) => s.id);
    const { data: rData } = await supabase.from('guard_reports').select('*').in('guard_schedule_id', ids);
    const allReports: GuardReport[] = rData || [];
    setPastShifts(prevShifts.map((s: any) => ({
      shift: s,
      reports: allReports.filter(r => r.guard_schedule_id === s.id).sort((a, b) => a.checkpoint.localeCompare(b.checkpoint)),
    })));
    setHistoryLoaded(true);
    setShowHistory(true);
  };

  const canSubmit = !saving && (projectNotes.trim().length > 0 || observations.trim().length > 0 || pendingImages.length > 0);

  const [y, m, d] = shift.date.split('-').map(Number);
  const shiftDateLabel = new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <>
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4 z-[60]" onClick={onClose}>
      <div
        className="bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-700 w-full sm:max-w-xl shadow-2xl flex flex-col"
        style={{ maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center shrink-0">
            <Shield size={20} className="text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base leading-none">Reporte de Guardia</p>
            <p className="text-slate-400 text-xs mt-1 capitalize">{shiftDateLabel} · {fmt12(shift.start_time)} – {fmt12(shift.end_time)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-700 transition shrink-0"><X size={18} /></button>
        </div>

        {success ? (
          <div className="p-10 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <CheckCheck size={28} className="text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg">Reporte enviado</p>
              <p className="text-slate-400 text-sm mt-1">El gestor y tu equipo pueden ver este seguimiento.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <div className="p-5 space-y-5">

              {/* Already submitted — compact timeline */}
              {existingReports.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Este turno — reportes enviados</p>
                  <div className="space-y-2">
                    {existingReports.map(r => {
                      const cfg = STATUS_CFG[r.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.NORMAL;
                      return (
                        <div key={r.id} className="bg-slate-800 rounded-xl border border-slate-700 p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-violet-300 bg-violet-500/15 px-2 py-0.5 rounded-full">{CHECKPOINT_LABELS[r.checkpoint]}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                            <span className="text-slate-600 text-[10px] ml-auto">{new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {r.project_notes && <p className="text-slate-300 text-xs leading-relaxed"><span className="text-slate-500 font-medium">Proyectos: </span>{r.project_notes}</p>}
                          {r.observations && <p className="text-slate-300 text-xs leading-relaxed"><span className="text-slate-500 font-medium">Obs: </span>{r.observations}</p>}
                          {r.affected_systems && <p className="text-slate-300 text-xs leading-relaxed"><span className="text-slate-500 font-medium">Sistemas: </span>{r.affected_systems}</p>}
                          {r.image_urls && r.image_urls.length > 0 && (
                            <div className="flex gap-1.5 flex-wrap pt-0.5">
                              {r.image_urls.map((url, i) => (
                                <button key={i} onClick={() => setLightbox(url)} className="relative group overflow-hidden rounded-lg border border-slate-600 hover:border-violet-500/60 transition">
                                  <img src={url} alt="" className="w-14 h-14 object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                    <ZoomIn size={14} className="text-white" />
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

              {/* New report form */}
              {!allDone && nextCheckpoint ? (
                <>
                  <div className="border-t border-slate-700/50 pt-4">
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Nuevo reporte</p>

                    {/* Checkpoint */}
                    <div className="mb-4">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Punto de reporte</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(['INICIO', 'MEDIO', 'FIN'] as const).map(cp => {
                          const done = doneCheckpoints.has(cp);
                          const active = checkpoint === cp;
                          return (
                            <button key={cp} onClick={() => !done && setCheckpoint(cp)} disabled={done}
                              className={`py-2.5 rounded-xl border text-xs font-bold transition ${
                                done ? 'border-slate-700 bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                : active ? 'border-violet-500/80 bg-violet-500/20 text-violet-200 ring-1 ring-violet-500/40'
                                : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500 hover:text-white'
                              }`}>
                              {done ? <span className="flex items-center justify-center gap-1"><CheckCheck size={11} className="text-emerald-400" />{CHECKPOINT_LABELS[cp].split(' ')[0]}</span> : CHECKPOINT_LABELS[cp]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="mb-4">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Estado del sistema</p>
                      <div className="flex gap-2">
                        {(Object.entries(STATUS_CFG) as [keyof typeof STATUS_CFG, any][]).map(([key, cfg]) => (
                          <button key={key} onClick={() => setStatus(key)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold transition ${status === key ? cfg.cls : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-white'}`}>
                            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />{cfg.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Project notes */}
                    <div className="mb-3">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Estado de proyectos</label>
                      <textarea value={projectNotes} onChange={e => setProjectNotes(e.target.value)}
                        placeholder="¿Cómo van los proyectos? Avances, bloqueos, pendientes..."
                        className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 resize-none h-20 transition" />
                    </div>

                    {/* Affected systems */}
                    <div className="mb-3">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Sistemas / Ambientes afectados</label>
                      <input value={affectedSystems} onChange={e => setAffectedSystems(e.target.value)}
                        placeholder="Ej: Producción, QA, Oracle, API pagos..."
                        className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 transition" />
                    </div>

                    {/* Observations */}
                    <div className="mb-4">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-1.5">Observaciones / Incidentes</label>
                      <textarea value={observations} onChange={e => setObservations(e.target.value)}
                        placeholder="Accesos fallidos, servicios caídos, alertas recibidas..."
                        className="w-full bg-slate-800 border border-slate-700 text-white px-3 py-2.5 rounded-xl text-sm placeholder-slate-600 focus:outline-none focus:border-violet-500 resize-none h-20 transition" />
                    </div>

                    {/* Evidence images */}
                    <div className="mb-4">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide block mb-2">
                        Evidencias <span className="normal-case font-normal text-slate-600">(hasta 5 imágenes · Ctrl+V para pegar)</span>
                      </label>
                      {previews.length > 0 && (
                        <div className="flex gap-2 flex-wrap mb-2">
                          {previews.map((src, i) => (
                            <div key={i} className="relative group">
                              <img src={src} alt="" className="w-16 h-16 object-cover rounded-xl border border-violet-700/50 cursor-pointer" onClick={() => setLightbox(src)} />
                              <button onClick={() => {
                                const next = pendingImages.filter((_, idx) => idx !== i);
                                setPendingImages(next);
                                setPreviews(next.map(f => URL.createObjectURL(f)));
                              }} className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {pendingImages.length < 5 && (
                        <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-slate-700 hover:border-violet-500/60 cursor-pointer transition group">
                          <ImagePlus size={15} className="text-slate-500 group-hover:text-violet-400 transition shrink-0" />
                          <span className="text-xs text-slate-500 group-hover:text-slate-300 transition">Adjuntar capturas o evidencias</span>
                          <input type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
                        </label>
                      )}
                    </div>
                  </div>

                  <button onClick={submit} disabled={!canSubmit}
                    className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm py-3.5 rounded-xl transition">
                    {saving ? <><Loader2 size={15} className="animate-spin" />Enviando reporte...</> : <><Send size={15} />Enviar reporte</>}
                  </button>
                </>
              ) : (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
                    <CheckCheck size={22} className="text-emerald-400" />
                  </div>
                  <p className="text-white font-bold">Turno completado</p>
                  <p className="text-slate-400 text-xs mt-1">Los 3 puntos de reporte fueron enviados.</p>
                </div>
              )}

              {/* Past guard history */}
              <div className="border-t border-slate-700/50 pt-4">
                <button onClick={loadHistory}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition w-full">
                  <Clock size={13} />
                  <span>Historial de guardias anteriores</span>
                  {showHistory ? <ChevronUp size={13} className="ml-auto" /> : <ChevronDown size={13} className="ml-auto" />}
                </button>

                {showHistory && (
                  <div className="mt-3 space-y-2">
                    {pastShifts.length === 0 ? (
                      <p className="text-slate-600 text-xs text-center py-3">Sin guardias anteriores registradas</p>
                    ) : (
                      pastShifts.map(({ shift: ps, reports: pr }) => {
                        const [py, pm, pd] = ps.date.split('-').map(Number);
                        const dateLabel = new Date(py, pm - 1, pd).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                        const isOpen = expandedPast === ps.id;
                        const hasIncident = pr.some(r => r.status !== 'NORMAL');
                        return (
                          <div key={ps.id} className="bg-slate-800/60 rounded-xl border border-slate-700/60 overflow-hidden">
                            <button onClick={() => setExpandedPast(isOpen ? null : ps.id)}
                              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left hover:bg-slate-700/30 transition">
                              <Shield size={12} className={hasIncident ? 'text-amber-400' : 'text-slate-500'} />
                              <span className="text-slate-300 text-xs font-medium flex-1 capitalize">{dateLabel}</span>
                              <span className="text-slate-500 text-[10px]">{fmt12(ps.start_time)} – {fmt12(ps.end_time)}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${pr.length > 0 ? 'bg-violet-500/20 text-violet-300' : 'bg-slate-700 text-slate-500'}`}>
                                {pr.length}/3
                              </span>
                              {isOpen ? <ChevronUp size={12} className="text-slate-500 shrink-0" /> : <ChevronDown size={12} className="text-slate-500 shrink-0" />}
                            </button>
                            {isOpen && (
                              <div className="border-t border-slate-700/40 px-3 pb-3 pt-2 space-y-2">
                                {pr.length === 0 ? (
                                  <p className="text-slate-600 text-xs">Sin reportes enviados en este turno</p>
                                ) : pr.map(r => {
                                  const cfg = STATUS_CFG[r.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.NORMAL;
                                  return (
                                    <div key={r.id} className="bg-slate-700/40 rounded-lg p-2.5 space-y-1.5">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] font-bold text-violet-300 bg-violet-500/15 px-2 py-0.5 rounded-full">{CHECKPOINT_LABELS[r.checkpoint]}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                                        <span className="text-slate-600 text-[10px] ml-auto">{new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                      </div>
                                      {r.project_notes && <p className="text-slate-300 text-xs leading-relaxed"><span className="text-slate-500">Proyectos: </span>{r.project_notes}</p>}
                                      {r.affected_systems && <p className="text-slate-300 text-xs leading-relaxed"><span className="text-slate-500">Sistemas: </span>{r.affected_systems}</p>}
                                      {r.observations && <p className="text-slate-300 text-xs leading-relaxed"><span className="text-slate-500">Obs: </span>{r.observations}</p>}
                                      {r.image_urls && r.image_urls.length > 0 && (
                                        <div className="flex gap-1.5 flex-wrap">
                                          {r.image_urls.map((url, i) => (
                                            <button key={i} onClick={() => setLightbox(url)} className="relative group overflow-hidden rounded-lg border border-slate-600 hover:border-violet-500/60 transition">
                                              <img src={url} alt="" className="w-12 h-12 object-cover" />
                                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
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
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>
    </div>

    {/* Lightbox */}
    {lightbox && (
      <div className="fixed inset-0 bg-black/92 flex items-center justify-center z-[70] p-4" onClick={() => setLightbox(null)}>
        <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition"><X size={22} /></button>
        <img src={lightbox} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
      </div>
    )}
    </>
  );
}

// ─── Team Calendar Read Only ──────────────────────────────────────────────────

interface TeamMemberEntry { id: string; name: string; }

function TeamCalendarReadOnly({
  teamId, memberId, memberName,
}: { teamId: string; memberId: string; memberName: string }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [members, setMembers] = useState<TeamMemberEntry[]>([]);
  const [hoEntries, setHoEntries] = useState<{ id: string; team_member_id: string; date: string }[]>([]);
  const [vacations, setVacations] = useState<{ id: string; team_member_id: string; date: string; note: string }[]>([]);
  const [guardShifts, setGuardShifts] = useState<GuardShift[]>([]);
  const [guardReports, setGuardReports] = useState<GuardReport[]>([]);
  const [reportingShift, setReportingShift] = useState<GuardShift | null>(null);
  const [activeView, setActiveView] = useState<'calendar' | 'reports'>('calendar');

  const colorMap: Record<string, number> = {};
  members.forEach((m, i) => { colorMap[m.id] = i; });

  const load = useCallback(async () => {
    const { data: mData } = await supabase
      .from('team_members').select('id, name').eq('team_id', teamId).order('created_at', { ascending: true });
    if (!mData || mData.length === 0) { setMembers([]); setHoEntries([]); setVacations([]); setGuardShifts([]); return; }

    const memberIds = mData.map(m => m.id);
    const firstDay = isoDate(year, month, 1);
    const lastDay  = isoDate(year, month, new Date(year, month + 1, 0).getDate());

    const [hoData, vacData, guardData] = await Promise.all([
      supabase.from('home_office_days').select('id, team_member_id, date').in('team_member_id', memberIds).gte('date', firstDay).lte('date', lastDay),
      supabase.from('vacation_days').select('id, team_member_id, date, note').in('team_member_id', memberIds).gte('date', firstDay).lte('date', lastDay),
      supabase.from('guard_schedules').select('id, team_member_id, member_name, date, start_time, end_time').eq('team_id', teamId).gte('date', firstDay).lte('date', lastDay),
    ]);

    setMembers(mData);
    setHoEntries(hoData.data || []);
    setVacations(vacData.data || []);
    setGuardShifts(guardData.data || []);

    // Load reports for ALL shifts in the month (so the reports panel can show full team context)
    const allShiftIds = (guardData.data || []).map((g: any) => g.id);
    if (allShiftIds.length > 0) {
      const { data: rData } = await supabase.from('guard_reports').select('*').in('guard_schedule_id', allShiftIds);
      setGuardReports(rData || []);
    } else {
      setGuardReports([]);
    }
  }, [teamId, memberId, year, month]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday   = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const isWeekend = (day: number) => { const d = new Date(year, month, day).getDay(); return d === 0 || d === 6; };

  // ── Guard Reports Panel ───────────────────────────────────────────────────
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const myShifts = guardShifts
    .filter(g => g.team_member_id === memberId)
    .sort((a, b) => {
      const aFuture = a.date >= todayIso;
      const bFuture = b.date >= todayIso;
      if (aFuture && bFuture) return a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time);
      if (!aFuture && !bFuture) return b.date.localeCompare(a.date) || a.start_time.localeCompare(b.start_time);
      return aFuture ? -1 : 1;
    });

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [expandedShiftReports, setExpandedShiftReports] = useState<string | null>(null);

  const guardReportsPanel = (
    <div className="space-y-4">
      {/* Month nav (shared) */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"><ChevronLeft size={18} /></button>
        <h3 className="text-white font-bold">{MONTH_NAMES[month]} {year}</h3>
        <button onClick={nextMonth} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"><ChevronRight size={18} /></button>
      </div>

      {myShifts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Shield size={36} className="text-slate-700 mb-3" />
          <p className="text-slate-400 font-semibold">Sin turnos de guardia este mes</p>
          <p className="text-slate-600 text-sm mt-1">No tienes guardias asignadas en {MONTH_NAMES[month]} {year}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {myShifts.map(shift => {
            const reports = guardReports
              .filter(r => r.guard_schedule_id === shift.id)
              .sort((a, b) => { const order: Record<string,number> = { INICIO: 0, MEDIO: 1, FIN: 2 }; return (order[a.checkpoint] ?? 3) - (order[b.checkpoint] ?? 3); });
            const doneSet = new Set(reports.map(r => r.checkpoint));
            const allDone = doneSet.has('INICIO') && doneSet.has('MEDIO') && doneSet.has('FIN');
            const hasIncident = reports.some(r => r.status !== 'NORMAL');
            const [sy, sm, sd] = shift.date.split('-').map(Number);
            const shiftDateLabel = new Date(sy, sm - 1, sd).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
            const shiftExpanded = expandedShiftReports === shift.id;

            return (
              <div key={shift.id} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
                {/* Shift header — always visible, click to expand/collapse reports */}
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/30 transition"
                  onClick={() => setExpandedShiftReports(shiftExpanded ? null : shift.id)}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${hasIncident ? 'bg-amber-500/15 border border-amber-500/30' : allDone ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-violet-500/15 border border-violet-500/30'}`}>
                    <Shield size={16} className={hasIncident ? 'text-amber-400' : allDone ? 'text-emerald-400' : 'text-violet-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm capitalize leading-none">{shiftDateLabel}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{fmt12(shift.start_time)} – {fmt12(shift.end_time)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Checkpoint progress pills */}
                    {(['INICIO','MEDIO','FIN'] as const).map(cp => (
                      <span key={cp} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${doneSet.has(cp) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-500'}`}>
                        {cp === 'INICIO' ? 'Inicio' : cp === 'MEDIO' ? 'Medio' : 'Fin'}
                      </span>
                    ))}
                    {reports.length > 0 && (
                      shiftExpanded ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Action row */}
                <div className="px-4 pb-3 flex items-center gap-2 border-b border-slate-700/60">
                  {reports.length === 0 && (
                    <p className="text-slate-600 text-xs flex-1">Sin reportes enviados aún</p>
                  )}
                  {reports.length > 0 && !shiftExpanded && (
                    <p className="text-slate-500 text-xs flex-1">
                      {reports.map(r => {
                        const cfg = STATUS_CFG[r.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.NORMAL;
                        return (
                          <span key={r.id} className="inline-flex items-center gap-1 mr-2">
                            <span className={`w-1.5 h-1.5 rounded-full inline-block ${cfg.dot}`} />
                            <span className="text-slate-400">{CHECKPOINT_LABELS[r.checkpoint]}</span>
                          </span>
                        );
                      })}
                    </p>
                  )}
                  {reports.length > 0 && shiftExpanded && <span className="flex-1" />}
                  <button
                    onClick={e => { e.stopPropagation(); setReportingShift(shift); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                      allDone
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-default'
                        : 'bg-violet-600 hover:bg-violet-500 text-white'
                    }`}
                  >
                    {allDone ? <><CheckCheck size={12} />Completo</> : <><Plus size={12} />Reportar</>}
                  </button>
                </div>

                {/* Collapsible reports */}
                {shiftExpanded && reports.length > 0 && (
                  <div className="divide-y divide-slate-700/50">
                    {reports.map(r => {
                      const statusCfg = STATUS_CFG[r.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.NORMAL;
                      const reportKey = `${shift.id}-${r.checkpoint}`;
                      const reportExpanded = expandedReportId === reportKey;
                      const preview = [r.project_notes, r.observations].filter(Boolean).join(' · ');
                      return (
                        <div key={r.id}>
                          {/* Report collapsed row */}
                          <button
                            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-700/20 transition"
                            onClick={() => setExpandedReportId(reportExpanded ? null : reportKey)}
                          >
                            <span className="text-[11px] font-bold text-violet-300 bg-violet-500/15 px-2 py-0.5 rounded-full shrink-0">
                              {CHECKPOINT_LABELS[r.checkpoint]}
                            </span>
                            <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusCfg.badge}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                              {statusCfg.label}
                            </span>
                            {!reportExpanded && preview && (
                              <span className="text-slate-500 text-xs truncate flex-1">{preview}</span>
                            )}
                            {!reportExpanded && !preview && <span className="flex-1" />}
                            <span className="text-slate-600 text-[10px] shrink-0 mr-1">
                              {new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {reportExpanded ? <ChevronUp size={13} className="text-slate-500 shrink-0" /> : <ChevronDown size={13} className="text-slate-500 shrink-0" />}
                          </button>

                          {/* Report expanded detail */}
                          {reportExpanded && (
                            <div className="px-4 pb-4 space-y-2">
                              <div className="grid gap-2">
                                {r.project_notes && (
                                  <div className="bg-slate-700/40 rounded-xl px-3 py-2.5">
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Estado de proyectos</p>
                                    <p className="text-slate-200 text-sm leading-relaxed">{r.project_notes}</p>
                                  </div>
                                )}
                                {r.affected_systems && (
                                  <div className="bg-slate-700/40 rounded-xl px-3 py-2.5">
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Sistemas / Ambientes afectados</p>
                                    <p className="text-slate-200 text-sm leading-relaxed">{r.affected_systems}</p>
                                  </div>
                                )}
                                {r.observations && (
                                  <div className={`rounded-xl px-3 py-2.5 ${r.status !== 'NORMAL' ? 'bg-amber-900/20 border border-amber-700/30' : 'bg-slate-700/40'}`}>
                                    <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${r.status !== 'NORMAL' ? 'text-amber-500' : 'text-slate-500'}`}>Observaciones / Incidentes</p>
                                    <p className={`text-sm leading-relaxed ${r.status !== 'NORMAL' ? 'text-amber-200' : 'text-slate-200'}`}>{r.observations}</p>
                                  </div>
                                )}
                              </div>
                              {r.image_urls && r.image_urls.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Evidencias</p>
                                  <div className="flex gap-2 flex-wrap">
                                    {r.image_urls.map((url, i) => (
                                      <button key={i} onClick={() => setLightboxUrl(url)} className="relative group overflow-hidden rounded-xl border border-slate-600 hover:border-violet-500/60 transition">
                                        <img src={url} alt="" className="w-20 h-20 object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                          <ZoomIn size={16} className="text-white" />
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[70] p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition"><X size={22} /></button>
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* View toggle */}
      <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveView('calendar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${activeView === 'calendar' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
          <Calendar size={14} />Calendario
        </button>
        <button onClick={() => setActiveView('reports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${activeView === 'reports' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
          <Shield size={14} />Reportes de Guardia
          {myShifts.length > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              myShifts.some(s => {
                const done = guardReports.filter(r => r.guard_schedule_id === s.id).length;
                const [sy, sm] = s.date.split('-').map(Number);
                return done < 3 && sm - 1 === month && sy === year;
              }) ? 'bg-amber-500 text-white' : 'bg-slate-600 text-slate-300'
            }`}>
              {myShifts.length}
            </span>
          )}
        </button>
      </div>

      {activeView === 'reports' ? guardReportsPanel : (
        <>
          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-3 h-3 rounded-sm bg-teal-600/60 ring-1 ring-teal-500/40 inline-block" /> Home Office
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-3 h-3 rounded-sm bg-amber-600/60 ring-1 ring-amber-500/40 inline-block" /> Vacaciones / Ausencia
            </span>
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="w-3 h-3 rounded-sm bg-violet-600/60 ring-1 ring-violet-500/40 inline-block" /> Turno de guardia
            </span>
            {members.slice(0, 6).map((m, i) => (
              <span key={m.id} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className={`w-2.5 h-2.5 rounded-full ${PALETTE[i % PALETTE.length]} inline-block`} />
                {m.name}
              </span>
            ))}
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            {/* Month nav */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <button onClick={prevMonth} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition"><ChevronLeft size={20} /></button>
              <h3 className="text-white font-bold text-lg">{MONTH_NAMES[month]} {year}</h3>
              <button onClick={nextMonth} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition"><ChevronRight size={20} /></button>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-700">
              {DOW_LABELS.map(d => <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">{d}</div>)}
            </div>

            <div className="grid grid-cols-7">
              {cells.map((day, idx) => {
                if (!day) return <div key={`e-${idx}`} className="min-h-[120px] border-r border-b border-slate-700/50 bg-slate-900/30" />;

                const dateStr  = isoDate(year, month, day);
                const ho       = hoEntries.filter(h => h.date === dateStr);
                const vac      = vacations.filter(v => v.date === dateStr);
                const guards   = guardShifts.filter(g => g.date === dateStr);
                const myGuards = guards.filter(g => g.team_member_id === memberId);
                const weekend  = isWeekend(day);
                const today_   = isToday(day);
                const hasMyGuard = myGuards.length > 0;

                return (
                  <div
                    key={day}
                    className={`min-h-[120px] p-1.5 border-r border-b border-slate-700/50 flex flex-col gap-0.5 ${weekend ? 'bg-slate-900/50' : ''} ${today_ ? 'ring-2 ring-inset ring-blue-500' : ''} ${hasMyGuard ? 'bg-violet-950/20' : ''}`}
                  >
                    <span className={`text-xs font-bold self-start leading-none rounded-full w-5 h-5 flex items-center justify-center mb-0.5 ${today_ ? 'bg-blue-500 text-white' : weekend ? 'text-slate-600' : 'text-slate-400'}`}>
                      {day}
                    </span>

                    {guards.slice(0, 3).map(g => {
                      const mi = members.findIndex(m => m.id === g.team_member_id);
                      const color = GUARD_COLORS[mi % GUARD_COLORS.length];
                      const isMine = g.team_member_id === memberId;
                      const reports = guardReports.filter(r => r.guard_schedule_id === g.id);
                      const reportsDone = reports.length;
                      return isMine ? (
                        <button key={g.id} onClick={() => setReportingShift(g)}
                          className="flex flex-col w-full px-1.5 py-1 rounded-md bg-violet-800/70 ring-1 ring-violet-500/80 hover:ring-violet-400 hover:bg-violet-800/90 transition text-left gap-0.5"
                          title="Reportar guardia">
                          <span className="flex items-center gap-1 leading-none">
                            <Shield size={8} className="text-violet-300 shrink-0" />
                            <span className="text-violet-100 text-[10px] font-bold truncate flex-1">Mi guardia</span>
                            {reportsDone > 0 && <span className="text-violet-300 text-[9px] font-semibold">{reportsDone}/3</span>}
                          </span>
                          <span className="text-violet-300 text-[9px] font-medium leading-none pl-0.5">{fmt12(g.start_time)}–{fmt12(g.end_time)}</span>
                        </button>
                      ) : (
                        <span key={g.id} className="flex flex-col w-full px-1.5 py-1 rounded-md bg-violet-900/40 ring-1 ring-violet-700/50 gap-0.5">
                          <span className="flex items-center gap-1 leading-none">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-violet-200 text-[10px] font-semibold truncate flex-1">{g.member_name.split(' ')[0]}</span>
                          </span>
                          <span className="text-violet-400 text-[9px] font-medium leading-none pl-0.5">{fmt12(g.start_time)}–{fmt12(g.end_time)}</span>
                        </span>
                      );
                    })}
                    {guards.length > 3 && (
                      <span className="flex items-center gap-1 text-violet-400 text-[10px] px-1">
                        <Shield size={8} />+{guards.length - 3} más
                      </span>
                    )}

                    {ho.slice(0, 2).map(h => {
                      const ci = colorMap[h.team_member_id] ?? 0;
                      const name = members.find(m => m.id === h.team_member_id)?.name ?? '';
                      return (
                        <span key={h.id} className="flex items-center gap-1 w-full px-1 py-0.5 rounded bg-teal-900/50 ring-1 ring-teal-700/60">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PALETTE[ci % PALETTE.length]}`} />
                          <span className="text-teal-200 text-[10px] font-medium truncate leading-none">{name}</span>
                        </span>
                      );
                    })}
                    {ho.length > 2 && <span className="text-teal-500 text-[10px] px-1">+{ho.length - 2} HO</span>}

                    {vac.slice(0, 2).map(v => {
                      const ci = colorMap[v.team_member_id] ?? 0;
                      const name = members.find(x => x.id === v.team_member_id)?.name ?? '';
                      return (
                        <span key={v.id} className="flex items-center gap-1 w-full px-1 py-0.5 rounded bg-amber-900/50 ring-1 ring-amber-700/60">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PALETTE[ci % PALETTE.length]}`} />
                          <span className="text-amber-200 text-[10px] font-medium truncate leading-none">{name}</span>
                        </span>
                      );
                    })}
                    {vac.length > 2 && <span className="text-amber-500 text-[10px] px-1">+{vac.length - 2} aus.</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {reportingShift && (
        <GuardReportModal
          shift={reportingShift}
          memberId={memberId}
          memberName={memberName}
          teamId={teamId}
          existingReports={guardReports.filter(r => r.guard_schedule_id === reportingShift.id)}
          onClose={() => setReportingShift(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ─── Evidence Modal ───────────────────────────────────────────────────────────

interface EvidenceModalProps {
  activityTitle: string;
  activityId: string;
  memberName: string;
  onConfirm: (comments: string, images: File[]) => Promise<void>;
  onCancel: () => void;
}

function EvidenceModal({ activityTitle, activityId, memberName, onConfirm, onCancel }: EvidenceModalProps) {
  const [comment, setComment] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const hasContent = comment.replace(/<[^>]+>/g, '').trim().length > 0 || images.length > 0;

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
    const next = [...images, ...valid].slice(0, 5);
    setImages(next);
    setPreviews(next.map(f => URL.createObjectURL(f)));
  };

  const removeImage = (idx: number) => {
    const next = images.filter((_, i) => i !== idx);
    setImages(next);
    setPreviews(next.map(f => URL.createObjectURL(f)));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = Array.from(e.clipboardData.items)
      .filter(i => i.type.startsWith('image/'))
      .map(i => i.getAsFile())
      .filter(Boolean) as File[];
    if (files.length > 0) { e.preventDefault(); addFiles(Object.assign(new DataTransfer(), { files: files as any }).files); }
  };

  const submit = async () => {
    if (!hasContent || submitting) return;
    setSubmitting(true);
    await onConfirm(sanitizeHtml(comment), images);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[60]">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg flex flex-col shadow-2xl" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg border border-emerald-500/30 shrink-0">
              <CheckCheck size={18} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-base leading-tight">Evidencia de pruebas</h3>
              <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{activityTitle}</p>
            </div>
            <button type="button" onClick={onCancel} className="text-slate-500 hover:text-white transition shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2.5">
            <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200 leading-relaxed">
              Antes de enviar a revisión, describe brevemente las pruebas realizadas y adjunta capturas o evidencias que lo demuestren.
            </p>
          </div>

          {/* Rich text editor */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">
              Descripción de las pruebas <span className="text-slate-600 normal-case font-normal">(requerido si no adjuntas imágenes)</span>
            </label>
            <div onPaste={handlePaste}>
              <RichTextEditor
                value={comment}
                onChange={setComment}
                placeholder="Describe qué probaste, qué escenarios cubriste, resultados obtenidos..."
              />
            </div>
          </div>

          {/* Image upload */}
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5 block">
              Capturas de pantalla / evidencias <span className="text-slate-600 normal-case font-normal">(hasta 5 imágenes)</span>
            </label>
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-600 hover:border-blue-500/60 rounded-xl p-4 cursor-pointer transition group">
              <ImagePlus size={20} className="text-slate-500 group-hover:text-blue-400 transition" />
              <span className="text-xs text-slate-500 group-hover:text-slate-300 transition">Haz clic para adjuntar · Ctrl+V para pegar</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
            </label>

            {previews.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative group">
                    <img src={src} alt="" className="w-20 h-20 object-cover rounded-lg border border-slate-600" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-700 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!hasContent || submitting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold py-2.5 rounded-lg transition flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>Enviando...</>
            ) : (
              <><CheckCheck size={15} />Enviar a revisión</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CollaboratorView({ memberId, memberName, memberEmail, memberPosition = '', onLogout }: CollaboratorViewProps) {
  const { can } = useMemberPermissions(memberId, memberPosition);
  const [activities, setActivities] = useState<any[]>([]);
  const [internActivities, setInternActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoDays, setHoDays] = useState<string[]>([]);
  const [vacDays, setVacDays] = useState<{ date: string; note: string }[]>([]);
  const [teamId, setTeamId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'activities' | 'calendar' | 'changelog' | 'documentation' | 'utilities'>('activities');
  const [statusCheckActivities, setStatusCheckActivities] = useState<ActivityForCheck[]>([]);
  const [showStatusCheck, setShowStatusCheck] = useState(false);
  const [monitoringActivities, setMonitoringActivities] = useState<ActivityToMonitor[]>([]);
  const [showMonitoring, setShowMonitoring] = useState(false);
  const [evidencePendingId, setEvidencePendingId] = useState<string | null>(null);
  const [showCreateActivity, setShowCreateActivity] = useState(false);
  const [autoOpenActivity, setAutoOpenActivity] = useState<any | null>(null);
  const [todayGuardShifts, setTodayGuardShifts] = useState<GuardShift[]>([]);
  const [guardReportsToday, setGuardReportsToday] = useState<GuardReport[]>([]);
  const [activeGuardShift, setActiveGuardShift] = useState<GuardShift | null>(null);

  const handleNotifNavigate = async (target: NotifNavTarget) => {
    if (target.section === 'documentation') {
      setActiveTab('documentation');
    } else if (target.section === 'changelog') {
      setActiveTab('changelog');
    } else if ((target.section === 'activities' || target.section === 'review') && target.activityId) {
      setActiveTab('activities');
      const { data } = await supabase
        .from('activities')
        .select('*')
        .eq('id', target.activityId)
        .maybeSingle();
      if (data) setAutoOpenActivity(data);
    }
  };

  const loadActivities = useCallback(async (email: string, fallbackId: string) => {
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    const { data: members, error: membersError } = await supabase
      .from('team_members')
      .select('id, team_id')
      .ilike('email', normalizedEmail);

    const memberIds = (!membersError && members && members.length > 0)
      ? members.map((m) => m.id)
      : [fallbackId];

    const resolvedTeamId = (!membersError && members && members.length > 0) ? members[0].team_id : null;
    if (resolvedTeamId) {
      setTeamId(resolvedTeamId);
    }

    // Load upcoming guard shifts (today + next 30 days) for this member
    if (resolvedTeamId && memberIds.length > 0) {
      const todayStr = todayIso();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const futureStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
      const { data: shiftsUpcoming } = await supabase
        .from('guard_schedules')
        .select('id, team_member_id, member_name, date, start_time, end_time')
        .eq('team_id', resolvedTeamId)
        .in('team_member_id', memberIds)
        .gte('date', todayStr)
        .lte('date', futureStr)
        .order('date', { ascending: true });
      const myShifts = shiftsUpcoming || [];
      setTodayGuardShifts(myShifts);
      if (myShifts.length > 0) {
        const shiftIds = myShifts.map((s: any) => s.id);
        const { data: rData } = await supabase.from('guard_reports').select('*').in('guard_schedule_id', shiftIds);
        setGuardReportsToday(rData || []);
      } else {
        setGuardReportsToday([]);
      }
    }

    // Load activities where member is primary assignee OR shared second member
    const [actPrimary, actShared, hoData, vacData] = await Promise.all([
      supabase
        .from('activities')
        .select('*')
        .in('team_member_id', memberIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('activities')
        .select('*')
        .in('shared_with_member_id', memberIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('home_office_days')
        .select('date')
        .in('team_member_id', memberIds)
        .gte('date', todayIso())
        .order('date', { ascending: true }),
      supabase
        .from('vacation_days')
        .select('date, note')
        .in('team_member_id', memberIds)
        .gte('date', todayIso())
        .order('date', { ascending: true }),
    ]);

    // Merge, deduplicating by id
    const primaryList = actPrimary.data || [];
    const sharedList = actShared.data || [];
    const seen = new Set(primaryList.map((a: any) => a.id));
    const merged = [...primaryList, ...sharedList.filter((a: any) => !seen.has(a.id))];
    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setActivities(merged);
    setHoDays((hoData.data || []).map((r: any) => r.date));
    setVacDays((vacData.data || []).map((r: any) => ({ date: r.date, note: r.note })));

    // Fetch intern activities if permitted
    if (resolvedTeamId) {
      const { data: internMembers } = await supabase
        .from('team_members')
        .select('id, name')
        .eq('team_id', resolvedTeamId)
        .ilike('position', 'becario')
        .not('id', 'in', `(${memberIds.join(',')})`);

      const internIds = (internMembers ?? []).map((m: any) => m.id);
      if (internIds.length > 0) {
        const { data: internActs } = await supabase
          .from('activities')
          .select('*')
          .in('team_member_id', internIds)
          .order('created_at', { ascending: false });
        // attach member name for display
        const nameMap: Record<string, string> = {};
        (internMembers ?? []).forEach((m: any) => { nameMap[m.id] = m.name; });
        const withNames = (internActs ?? []).map((a: any) => ({
          ...a,
          _intern_name: nameMap[a.team_member_id] ?? 'Becario',
        }));
        setInternActivities(withNames);
      } else {
        setInternActivities([]);
      }
    } else {
      setInternActivities([]);
    }
    setLoading(false);

    // Determine which activities need a status check
    // Skip activities already acknowledged today (stored in localStorage)
    const activeStatuses = new Set(['PENDING', 'IN_PROGRESS']);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = today.toISOString().split('T')[0];
    const nowMs = Date.now();

    const storageKey = `status_checked_${fallbackId}`;
    let checkedToday: Record<string, string> = {};
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Only keep entries from today
        Object.entries(parsed).forEach(([id, date]) => {
          if (date === todayKey) checkedToday[id] = date as string;
        });
      }
    } catch { /* ignore */ }

    const needsCheck = merged.filter((a: any) => {
      if (!activeStatuses.has(a.status)) return false;
      if (!a.end_date) return false;
      // Already acknowledged today — skip
      if (checkedToday[a.id]) return false;

      const due = new Date(a.end_date + 'T00:00:00');
      const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000);

      // Overdue
      if (diffDays < 0) return true;
      // Due today or in next 2 days
      if (diffDays <= 2) return true;

      // Intraday check: assigned today, more than 4 hours have passed since creation
      const createdAt = new Date(a.created_at).getTime();
      const hoursSinceCreation = (nowMs - createdAt) / 3600000;
      if (diffDays === 0 && hoursSinceCreation >= 4) return true;

      return false;
    });

    if (needsCheck.length > 0) {
      setStatusCheckActivities(needsCheck.map((a: any) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        end_date: a.end_date,
        priority: a.priority,
        project: a.project,
      })));
      setShowStatusCheck(true);
    }

    // Check for released activities needing post-release monitoring (days 1–5)
    const releasedActivities = merged.filter(
      (a: any) => a.released_to_production_at && memberIds.includes(a.team_member_id)
    );

    if (releasedActivities.length > 0) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const releasedIds = releasedActivities.map((a: any) => a.id);
      const { data: existingLogs } = await supabase
        .from('release_monitoring_logs')
        .select('activity_id, day_number')
        .in('activity_id', releasedIds)
        .in('team_member_id', memberIds);

      const submittedSet = new Set(
        (existingLogs || []).map((l: any) => `${l.activity_id}-${l.day_number}`)
      );

      const toMonitor: ActivityToMonitor[] = [];

      for (const a of releasedActivities) {
        const releaseDate = new Date(a.released_to_production_at);
        releaseDate.setHours(0, 0, 0, 0);
        const daysSinceRelease = Math.floor(
          (todayStart.getTime() - releaseDate.getTime()) / 86400000
        );
        // dayNumber = daysSinceRelease + 1 (day 1 is release day itself)
        const dayNumber = daysSinceRelease + 1;
        if (dayNumber < 1 || dayNumber > 5) continue;
        if (submittedSet.has(`${a.id}-${dayNumber}`)) continue;
        toMonitor.push({
          id: a.id,
          title: a.title,
          project: a.project,
          released_to_production_at: a.released_to_production_at,
          dayNumber,
        });
      }

      if (toMonitor.length > 0) {
        setMonitoringActivities(toMonitor);
        setShowMonitoring(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, memberEmail]);

  useEffect(() => {
    loadActivities(memberEmail, memberId);

    const sub = supabase
      .channel(`collab-view-${memberId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () => loadActivities(memberEmail, memberId))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'home_office_days' }, () => loadActivities(memberEmail, memberId))
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, [loadActivities, memberId, memberEmail]);

  useEffect(() => {
    if (!teamId) return;

    const internSub = supabase
      .channel(`collab-intern-${memberId}-${teamId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'activities', filter: `team_id=eq.${teamId}` },
        () => loadActivities(memberEmail, memberId)
      )
      .subscribe();

    return () => { internSub.unsubscribe(); };
  }, [loadActivities, teamId, memberId, memberEmail]);

  const [openModalActivityId, setOpenModalActivityId] = useState<string | null>(null);

  // Columns: NEEDS_REVISION first (alert), then normal flow, then read-only sinks
  const kanbanColumns = [
    { key: 'NEEDS_REVISION', label: 'CORRECCIÓN',   bar: 'bg-red-500',     droppable: false, alert: true },
    { key: 'PENDING',        label: 'PENDIENTES',   bar: 'bg-red-400',     droppable: true,  alert: false },
    { key: 'IN_PROGRESS',    label: 'EN PROCESO',   bar: 'bg-yellow-500',  droppable: true,  alert: false },
    { key: 'COMPLETED',      label: 'COMPLETADAS',  bar: 'bg-green-500',   droppable: true,  alert: false },
    { key: 'IN_REVIEW',      label: 'EN REVISIÓN',  bar: 'bg-amber-500',   droppable: false, alert: false },
    { key: 'APPROVED',       label: 'APROBADAS',    bar: 'bg-emerald-500', droppable: false, alert: false },
  ] as const;

  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const reload = () => loadActivities(memberEmail, memberId);

  // Upload images to Supabase storage and return public URLs
  const uploadEvidenceImages = async (activityId: string, files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${activityId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('comment-images').upload(path, file, { upsert: false });
      if (!error) {
        const { data: pub } = supabase.storage.from('comment-images').getPublicUrl(path);
        urls.push(pub.publicUrl);
      }
    }
    return urls;
  };

  // Shared logic: save evidence revision then send activity to IN_REVIEW
  const completeWithEvidence = async (activityId: string, comments: string, imageFiles: File[]) => {
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return;

    const imageUrls = imageFiles.length > 0 ? await uploadEvidenceImages(activityId, imageFiles) : [];

    // Save evidence as a revision entry
    await supabase.from('activity_revisions').insert({
      activity_id: activityId,
      status: 'COMPLETED',
      comments: comments || null,
      author_name: memberName,
      image_urls: imageUrls,
    });

    // Move to IN_REVIEW
    await supabase.from('activities').update({
      status: 'IN_REVIEW',
      review_requested_at: new Date().toISOString(),
      review_note: '',
      updated_at: new Date().toISOString(),
    }).eq('id', activityId);

    setActivities(prev => prev.map(a => a.id === activityId ? { ...a, status: 'IN_REVIEW', review_note: '' } : a));

    // Notify managers
    if (teamId) {
      const { data: managers } = await supabase
        .from('team_members').select('id').eq('team_id', teamId).not('user_id', 'is', null);
      if (managers && managers.length > 0) {
        await supabase.from('notifications').insert(
          managers.map((m: any) => ({
            team_member_id: m.id,
            activity_id: activityId,
            type: 'REVIEW_REQUESTED',
            title: 'Actividad lista para revisión',
            body: `${memberName} completó "${activity.title}" y la envió a revisión con evidencias.`,
          }))
        );
      }
    }

    setEvidencePendingId(null);
    reload();
  };

  const moveActivity = async (activityId: string, newStatus: string) => {
    const activity = activities.find(a => a.id === activityId);
    if (!activity || activity.status === newStatus) return;

    // Shared activities must use the steps modal to complete — block drag-to-complete
    if (newStatus === 'COMPLETED' && activity.shared_with_member_id) return;

    if (newStatus === 'COMPLETED') {
      // Instead of auto-sending, show the evidence modal
      setEvidencePendingId(activityId);
      return;
    }

    if (activity.status === 'NEEDS_REVISION' && newStatus === 'IN_PROGRESS') {
      setActivities(prev => prev.map(a => a.id === activityId ? { ...a, status: 'IN_PROGRESS' } : a));
      await supabase.from('activities').update({
        status: 'IN_PROGRESS',
        review_note: '',
        updated_at: new Date().toISOString(),
      }).eq('id', activityId);
      setActivities(prev => prev.map(a => a.id === activityId ? { ...a, status: 'IN_PROGRESS', review_note: '' } : a));
    } else {
      setActivities(prev => prev.map(a => a.id === activityId ? { ...a, status: newStatus } : a));
      await supabase.from('activities').update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', activityId);
    }
  };

  const handleDragStart = (e: React.DragEvent, activityId: string) => {
    setDraggingId(activityId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('activityId', activityId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, colKey: string, droppable: boolean) => {
    const draggingActivity = activities.find(a => a.id === draggingId);
    const fromNeedsRevision = draggingActivity?.status === 'NEEDS_REVISION';
    // NEEDS_REVISION cards can only drop to IN_PROGRESS
    if (fromNeedsRevision && colKey !== 'IN_PROGRESS') return;
    if (!droppable) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(colKey);
  };

  const handleDrop = (e: React.DragEvent, colKey: string, droppable: boolean) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('activityId');
    const draggingActivity = activities.find(a => a.id === id);
    const fromNeedsRevision = draggingActivity?.status === 'NEEDS_REVISION';
    if (fromNeedsRevision && colKey !== 'IN_PROGRESS') { setDragOverCol(null); setDraggingId(null); return; }
    if (!droppable && !fromNeedsRevision) { setDragOverCol(null); setDraggingId(null); return; }
    if (id) moveActivity(id, colKey);
    setDragOverCol(null);
    setDraggingId(null);
  };

  const total = activities.length;
  const completed = activities.filter((a) => ['COMPLETED', 'IN_REVIEW', 'APPROVED'].includes(a.status)).length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(160deg,#07090f 0%,#0b0e17 100%)' }}>
      {/* Header */}
      <header className="px-4 sm:px-6 py-3 flex items-center justify-between shrink-0"
        style={{ background: 'linear-gradient(90deg,#060a12 0%,#0b1120 100%)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: '0 2px 12px rgba(249,115,22,0.35)' }}>
            <Users size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-black text-white leading-none tracking-tight">WorkTrack</h1>
            <p className="text-xs text-slate-500 leading-none mt-0.5">Vista de colaborador</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <p className="text-sm text-slate-200 leading-none font-medium">{memberName}</p>
            <p className="text-xs mt-0.5 font-semibold text-orange-400">{memberEmail}</p>
          </div>
          <NotificationBell memberId={memberId} onNavigate={handleNotifNavigate} />
          <button
            onClick={() => loadActivities(memberEmail, memberId)}
            className="p-1.5 text-slate-500 hover:text-orange-400 rounded-lg transition"
            style={{ background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            title="Actualizar actividades"
          >
            <RefreshCw size={17} />
          </button>
          <button
            onClick={onLogout}
            className="p-1.5 text-slate-500 hover:text-white rounded-lg transition"
            style={{ background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            title="Cerrar sesión"
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* Home Office banner */}
      {hoDays.length > 0 && (
        <div className="bg-teal-900/40 border-b border-teal-700/50 px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-teal-300 shrink-0">
            <Home size={15} />
            <span className="text-xs font-semibold uppercase tracking-wide">Días Home Office</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {hoDays.map((dateStr) => {
              const isToday = dateStr === todayIso();
              return (
                <span
                  key={dateStr}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isToday
                      ? 'bg-teal-500 text-white ring-2 ring-teal-300'
                      : 'bg-teal-800/60 text-teal-200'
                  }`}
                >
                  {formatHoDate(dateStr)}
                  {isToday && <span className="ml-1 opacity-80">· hoy</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Vacaciones banner */}
      {vacDays.length > 0 && (
        <div className="bg-amber-900/30 border-b border-amber-700/50 px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-amber-300 shrink-0">
            <Calendar size={15} />
            <span className="text-xs font-semibold uppercase tracking-wide">Días de Ausencia</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {vacDays.map(({ date, note }) => {
              const isToday = date === todayIso();
              return (
                <span
                  key={date}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isToday
                      ? 'bg-amber-500 text-white ring-2 ring-amber-300'
                      : 'bg-amber-800/60 text-amber-200'
                  }`}
                >
                  {formatHoDate(date)}
                  <span className="ml-1 opacity-70">· {note}</span>
                  {isToday && <span className="ml-1 opacity-80">· hoy</span>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Guard shifts banner — today + upcoming */}
      {todayGuardShifts.length > 0 && (() => {
        const todayStr = todayIso();
        const shiftsToday    = todayGuardShifts.filter(s => s.date === todayStr);
        const shiftsUpcoming = todayGuardShifts.filter(s => s.date > todayStr);
        return (
          <div className={`border-b px-4 sm:px-6 py-3 ${shiftsToday.length > 0 ? 'bg-violet-950/70 border-violet-500/50' : 'bg-violet-950/30 border-violet-800/40'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Shield size={15} className={shiftsToday.length > 0 ? 'text-violet-300' : 'text-violet-500'} />
              <span className={`text-xs font-bold uppercase tracking-wider ${shiftsToday.length > 0 ? 'text-violet-200' : 'text-violet-400'}`}>
                {shiftsToday.length > 0 ? 'Tienes guardia hoy' : 'Guardias próximas'}
              </span>
            </div>

            {/* Today's shifts — prominent */}
            {shiftsToday.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {shiftsToday.map(shift => {
                  const reports  = guardReportsToday.filter(r => r.guard_schedule_id === shift.id);
                  const doneCount = reports.length;
                  const allDone  = doneCount >= 3;
                  return (
                    <button
                      key={shift.id}
                      onClick={() => setActiveGuardShift(shift)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ring-2 ${
                        allDone
                          ? 'bg-emerald-500/20 text-emerald-200 ring-emerald-500/50 hover:bg-emerald-500/30'
                          : 'bg-violet-500/30 text-white ring-violet-400/60 hover:bg-violet-500/45 hover:ring-violet-300/80'
                      }`}
                    >
                      <Clock size={14} />
                      <span>{fmt12(shift.start_time)} – {fmt12(shift.end_time)}</span>
                      <span className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                        allDone ? 'bg-emerald-500/30 text-emerald-300' : 'bg-violet-500/40 text-violet-200'
                      }`}>
                        {doneCount}/3 reportes
                      </span>
                      {!allDone && <span className="text-violet-300 text-xs">· Reportar</span>}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Upcoming shifts — compact */}
            {shiftsUpcoming.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {shiftsUpcoming.slice(0, 5).map(shift => {
                  const [y, m, d] = shift.date.split('-').map(Number);
                  const label = new Date(y, m - 1, d).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
                  return (
                    <span key={shift.id}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 ring-1 ring-violet-700/40">
                      <Shield size={10} />
                      {label} · {fmt12(shift.start_time)} – {fmt12(shift.end_time)}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Tab bar */}
      <div className="bg-slate-900 border-b border-slate-700 px-4 sm:px-6 flex gap-1">
        <button
          onClick={() => setActiveTab('activities')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'activities' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <CheckCircle size={15} />
          Mis Actividades
        </button>
        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'calendar' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <Calendar size={15} />
          Calendario del Equipo
        </button>
        {can('view_changelog') && (
          <button
            onClick={() => setActiveTab('changelog')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'changelog' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <GitCommitHorizontal size={15} />
            Control de Cambios
          </button>
        )}
        <button
          onClick={() => setActiveTab('documentation')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'documentation' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <BookOpen size={15} />
          Documentación
        </button>
        <button
          onClick={() => setActiveTab('utilities')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
            activeTab === 'utilities' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <Wrench size={15} />
          Utilerías
        </button>
      </div>

      <main className="flex-1 px-4 sm:px-6 py-4 sm:py-5 w-full flex flex-col overflow-hidden">
        {activeTab === 'documentation' ? (
          teamId ? (
            <DocumentationSection teamId={teamId} memberId={memberId} memberName={memberName} addOnly={!can('add_documentation')} canAddVersion={true} />
          ) : (
            <div className="text-center py-16 text-slate-400">Cargando...</div>
          )
        ) : activeTab === 'changelog' ? (
          teamId ? (
            <ChangelogSection teamId={teamId} memberId={memberId} memberName={memberName} canCreate={can('add_changelog')} />
          ) : (
            <div className="text-center py-16 text-slate-400">Cargando...</div>
          )
        ) : activeTab === 'calendar' ? (
          teamId ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Calendario del Equipo</h2>
                <p className="text-slate-400 text-sm mt-1">Visualiza HO, vacaciones y turnos de guardia del equipo</p>
              </div>
              <TeamCalendarReadOnly teamId={teamId} memberId={memberId} memberName={memberName} />
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">Cargando...</div>
          )
        ) : activeTab === 'utilities' ? (
          teamId ? (
            <UtilitiesSection teamId={teamId} authorName={memberName} canEdit={true} />
          ) : (
            <div className="text-center py-16 text-slate-400">Cargando...</div>
          )
        ) : (
        <div className="flex flex-col flex-1 min-h-0">
        {/* Stats header */}
        <div className="mb-4 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold text-white">Mis Actividades</h2>
            {(can('create_activity_becario') || can('create_activity_developer')) && teamId && (
              <button
                onClick={() => setShowCreateActivity(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
              >
                <Plus size={16} />
                Nueva Actividad
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: total, color: 'text-white', bar: 'bg-slate-600' },
              { label: 'Pendientes', value: activities.filter((a) => a.status === 'PENDING').length, color: 'text-red-400', bar: 'bg-red-500' },
              { label: 'En Proceso', value: activities.filter((a) => a.status === 'IN_PROGRESS').length, color: 'text-yellow-400', bar: 'bg-yellow-500' },
              { label: 'Completadas', value: `${pct}%`, color: 'text-emerald-400', bar: 'bg-emerald-500' },
            ].map(({ label, value, color, bar }) => (
              <div key={label} className="rounded-xl border p-4 relative overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                <div className={`${bar} absolute left-0 top-0 bottom-0 w-1 rounded-l-xl`} />
                <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{label}</p>
                <p className={`text-3xl font-bold mt-1.5 ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-400">Cargando actividades...</div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Drag hint */}
            <div className="flex items-center gap-2 mb-3 shrink-0 text-xs text-slate-500">
              <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />
                Arrastra las tarjetas entre columnas · Al mover a
                <span className="text-green-400 font-semibold ml-1">Completadas</span>
                <span className="ml-1">se envía a revisión automáticamente</span>
              </div>
            </div>

            {/* Kanban: responsive, fills height, horizontal scroll on small screens */}
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden -mx-4 sm:-mx-6 px-4 sm:px-6">
              <div className="flex gap-3 h-full" style={{ minWidth: 'min(100%, 800px)' }}>
                {kanbanColumns.map(({ key, label, bar, droppable, alert }) => {
                  const colActivities = activities.filter((a) => a.status === key);
                  if (key === 'NEEDS_REVISION' && colActivities.length === 0) return null;

                  const isOver = dragOverCol === key && droppable;
                  const isDraggableFromCol = droppable || key === 'NEEDS_REVISION';

                  return (
                    <div
                      key={key}
                      onDragOver={(e) => handleDragOver(e, key, droppable)}
                      onDragLeave={() => setDragOverCol(null)}
                      onDrop={(e) => handleDrop(e, key, droppable)}
                      style={{ flex: '1 1 0', minWidth: '220px' }}
                      className={`rounded-xl border flex flex-col transition-all duration-150 ${
                        alert
                          ? 'bg-red-950/25 border-red-500/35'
                          : isOver
                          ? 'border-blue-400 bg-blue-500/8 scale-[1.01]'
                          : droppable
                          ? 'bg-slate-800/80 border-slate-700'
                          : 'bg-slate-800/40 border-slate-700/50'
                      }`}
                    >
                      {/* Column header */}
                      <div className="px-4 pt-4 pb-3">
                        <div className={`${bar} w-full h-1 rounded-full mb-3`} />
                        <div className="flex items-center justify-between">
                          <h3 className={`font-bold text-xs tracking-widest uppercase ${alert ? 'text-red-300' : 'text-slate-300'}`}>{label}</h3>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center ${
                            alert               ? 'bg-red-500/25 text-red-300' :
                            key === 'IN_REVIEW' ? 'bg-amber-500/20 text-amber-400' :
                            key === 'APPROVED'  ? 'bg-emerald-500/20 text-emerald-400' :
                            'bg-slate-700 text-slate-400'
                          }`}>{colActivities.length}</span>
                        </div>
                        {alert && (
                          <p className="text-[10px] text-red-400/50 mt-1.5">Arrastra a En Proceso para retomar</p>
                        )}
                        {!droppable && !alert && (
                          <p className="text-[10px] text-slate-600 mt-1">Solo lectura</p>
                        )}
                      </div>

                      {/* Cards */}
                      <div className="px-3 pb-3 space-y-2.5 flex-1 overflow-y-auto" style={{ minHeight: '120px' }}>
                        {colActivities.map((activity) => {
                          const hasModalOpen = openModalActivityId === activity.id;
                          const canDrag = isDraggableFromCol && !hasModalOpen;
                          return (
                          <div
                            key={activity.id}
                            draggable={canDrag}
                            onDragStart={(e) => canDrag && handleDragStart(e, activity.id)}
                            onDragEnd={handleDragEnd}
                            className={`transition-all duration-150 ${
                              draggingId === activity.id ? 'opacity-35 scale-[0.97] rotate-1' : ''
                            } ${canDrag ? 'cursor-grab active:cursor-grabbing' : ''}`}
                          >
                            <ActivityReadCard
                              activity={activity}
                              memberId={memberId}
                              memberName={memberName}
                              memberPosition={memberPosition}
                              teamId={teamId}
                              onRefresh={reload}
                              onModalOpen={() => setOpenModalActivityId(activity.id)}
                              onModalClose={() => setOpenModalActivityId(null)}
                              onRequestEvidence={(id) => setEvidencePendingId(id)}
                            />
                          </div>
                        );
                        })}
                        {colActivities.length === 0 && (
                          <div className={`min-h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 transition-all duration-150 ${
                            isOver ? 'border-blue-400/50 bg-blue-500/5' : 'border-slate-700/30'
                          }`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isOver ? 'bg-blue-500/15' : 'bg-slate-700/30'}`}>
                              <span className={`text-lg font-bold leading-none ${isOver ? 'text-blue-400' : 'text-slate-600'}`}>+</span>
                            </div>
                            <p className={`text-xs ${isOver ? 'text-blue-400' : 'text-slate-600'}`}>
                              {isOver ? 'Soltar aquí' : 'Sin actividades'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Intern activities section — grouped by project — rendered below kanban with overflow scroll */}
            {can('view_intern_activities') && internActivities.length > 0 && (() => {
              // Build project groups
              const projectMap: Record<string, typeof internActivities> = {};
              internActivities.forEach(a => {
                const proj = a.project_name || 'Sin proyecto';
                if (!projectMap[proj]) projectMap[proj] = [];
                projectMap[proj].push(a);
              });
              const projectGroups = Object.entries(projectMap).sort(([a], [b]) => a.localeCompare(b));

              return (
                <div className="mt-8 space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-slate-700/60" />
                    <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/25 rounded-full">
                      <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                      <span className="text-xs font-semibold text-amber-300 uppercase tracking-widest">Actividades de Becarios</span>
                    </div>
                    <div className="h-px flex-1 bg-slate-700/60" />
                  </div>

                  {projectGroups.map(([project, projActs]) => (
                    <div key={project}>
                      {/* Project header */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <h3 className="text-sm font-bold text-amber-300/80 uppercase tracking-wide">{project}</h3>
                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{projActs.length}</span>
                      </div>

                      <div className="overflow-x-auto pb-2 -mx-4 sm:-mx-6 px-4 sm:px-6">
                        <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
                          {kanbanColumns
                            .filter(c => c.key !== 'NEEDS_REVISION' || projActs.some(a => a.status === 'NEEDS_REVISION'))
                            .map(({ key, label, bar }) => {
                              const colActs = projActs.filter(a => a.status === key);
                              if (key === 'NEEDS_REVISION' && colActs.length === 0) return null;
                              return (
                                <div key={key} style={{ width: '260px', minWidth: '260px' }}
                                  className="rounded-xl border bg-slate-800/50 border-slate-700/60 flex flex-col">
                                  <div className="px-4 pt-4 pb-3">
                                    <div className={`${bar} w-full h-1 rounded-full mb-3`} />
                                    <div className="flex items-center justify-between">
                                      <h4 className="font-bold text-xs tracking-widest uppercase text-slate-400">{label}</h4>
                                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 min-w-[24px] text-center">{colActs.length}</span>
                                    </div>
                                  </div>
                                  <div className="px-3 pb-3 space-y-2.5 flex-1 min-h-20">
                                    {colActs.length === 0 ? (
                                      <div className="min-h-14 rounded-xl border-2 border-dashed border-slate-700/30 flex items-center justify-center">
                                        <p className="text-xs text-slate-600">Sin actividades</p>
                                      </div>
                                    ) : colActs.map((activity) => (
                                      <div key={activity.id} className="bg-slate-700/40 rounded-xl border border-slate-600/50 p-3 space-y-1.5 opacity-80">
                                        <p className="text-xs font-semibold text-slate-200 leading-snug">{activity.title}</p>
                                        {activity.description && (
                                          <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{activity.description}</p>
                                        )}
                                        <div className="flex items-center gap-1.5 pt-0.5">
                                          <div className="w-4 h-4 rounded-full bg-amber-500/30 flex items-center justify-center text-[8px] font-bold text-amber-300">
                                            {activity._intern_name?.charAt(0).toUpperCase()}
                                          </div>
                                          <span className="text-[10px] text-amber-400/80 font-medium">{activity._intern_name}</span>
                                          {activity.end_date && (
                                            <span className="ml-auto text-[10px] text-slate-600">{activity.end_date}</span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}
        </div>
        )}
      </main>

      {showStatusCheck && statusCheckActivities.length > 0 && teamId && (
        <StatusCheckModal
          activities={statusCheckActivities}
          memberId={memberId}
          memberName={memberName}
          teamId={teamId}
          onClose={() => {
            // Mark all shown activities as acknowledged today so the modal
            // doesn't reappear on the next realtime refresh.
            const todayKey = new Date().toISOString().split('T')[0];
            const storageKey = `status_checked_${memberId}`;
            const existing: Record<string, string> = {};
            try {
              const raw = localStorage.getItem(storageKey);
              if (raw) Object.assign(existing, JSON.parse(raw));
            } catch { /* ignore */ }
            statusCheckActivities.forEach(a => { existing[a.id] = todayKey; });
            try { localStorage.setItem(storageKey, JSON.stringify(existing)); } catch { /* ignore */ }
            setShowStatusCheck(false);
          }}
          onActivityCompleted={reload}
        />
      )}

      {showMonitoring && monitoringActivities.length > 0 && (
        <ReleaseMonitoringModal
          activities={monitoringActivities}
          memberId={memberId}
          memberName={memberName}
          onClose={() => setShowMonitoring(false)}
          onSubmitted={() => { setShowMonitoring(false); }}
        />
      )}

      {activeGuardShift && teamId && (
        <GuardReportModal
          shift={activeGuardShift}
          memberId={memberId}
          memberName={memberName}
          teamId={teamId}
          existingReports={guardReportsToday.filter(r => r.guard_schedule_id === activeGuardShift.id)}
          onClose={() => setActiveGuardShift(null)}
          onSaved={async () => {
            setActiveGuardShift(null);
            const shiftIds = todayGuardShifts.map(s => s.id);
            if (shiftIds.length > 0) {
              const { data } = await supabase.from('guard_reports').select('*').in('guard_schedule_id', shiftIds);
              setGuardReportsToday(data || []);
            }
          }}
        />
      )}

      {showCreateActivity && teamId && (
        <CollabActivityModal
          teamId={teamId}
          creatorMemberId={memberId}
          creatorName={memberName}
          onClose={() => setShowCreateActivity(false)}
          onCreated={() => { setShowCreateActivity(false); reload(); }}
          filterPositions={
            can('create_activity_developer')
              ? undefined
              : can('create_activity_becario')
              ? ['becario', 'Becario']
              : undefined
          }
        />
      )}

      {evidencePendingId && (() => {
        const act = activities.find(a => a.id === evidencePendingId);
        if (!act) return null;
        return (
          <EvidenceModal
            activityId={evidencePendingId}
            activityTitle={act.title}
            memberName={memberName}
            onConfirm={(comments, images) => completeWithEvidence(evidencePendingId, comments, images)}
            onCancel={() => setEvidencePendingId(null)}
          />
        );
      })()}

      {autoOpenActivity && (
        <ModalErrorBoundary onError={() => setAutoOpenActivity(null)}>
          <RevisionModal
            activity={autoOpenActivity}
            memberId={memberId}
            memberName={memberName}
            memberPosition={memberPosition}
            teamId={teamId ?? ''}
            onClose={() => setAutoOpenActivity(null)}
            onRefresh={() => { setAutoOpenActivity(null); reload(); }}
            onRequestEvidence={(id) => { setAutoOpenActivity(null); setEvidencePendingId(id); }}
          />
        </ModalErrorBoundary>
      )}

      {/* Footer */}
      <footer className="shrink-0 px-4 sm:px-6 py-3 flex items-center justify-between"
        style={{ background: 'rgba(6,10,18,0.95)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)' }}>
            <Users size={11} className="text-white" />
          </div>
          <span className="text-white font-black text-xs tracking-tight">WorkTrack</span>
          <span className="text-slate-700 text-xs">&mdash; Portal Colaboradores</span>
        </div>
        <p className="text-slate-700 text-xs">&copy; {new Date().getFullYear()} WorkTrack</p>
      </footer>
    </div>
  );
}
