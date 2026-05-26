import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, CheckCircle2, GitCommitHorizontal, Clock, ChevronDown, ChevronUp, ShieldAlert, UserCog, Layers, Rocket, RefreshCw } from 'lucide-react';

import ActivityCard from './ActivityCard';
import ActivityModal from './ActivityModal';
import ActivityDetail from './ActivityDetail';

interface IndividualKanbanTabsProps {
  teamId: string;
  pendingActivityId?: string | null;
  onPendingClear?: () => void;
  managerMemberId?: string;
  managerName?: string;
  readOnly?: boolean;
  onNavigateToChangelog?: (entryId: string) => void;
}

const PRIORITY_LABEL: Record<string, string> = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
const PRIORITY_TAG: Record<string, string> = {
  HIGH: 'bg-red-500/30 text-red-200',
  MEDIUM: 'bg-yellow-500/30 text-yellow-200',
  LOW: 'bg-green-500/30 text-green-200',
};

function ApprovedActivityCard({ activity, changelog, onNavigateToChangelog }: { activity: any; changelog: any | null; onNavigateToChangelog?: (entryId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const approvedDate = activity.reviewed_at
    ? new Date(activity.reviewed_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
    : null;

  const isReleasedToProd = !!activity.released_to_production_at;
  const releasedDate = isReleasedToProd
    ? new Date(activity.released_to_production_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <>
      <div className={`rounded-xl border bg-slate-800/60 overflow-hidden ${isReleasedToProd ? 'border-emerald-500/40' : 'border-slate-700'}`}>
        {/* Released to production banner */}
        {isReleasedToProd && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/25">
            <Rocket size={12} className="text-emerald-400 shrink-0" />
            <p className="text-xs font-semibold text-emerald-300">
              Liberado a producción · {releasedDate}
            </p>
          </div>
        )}

        <div
          className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-700/30 transition"
          onClick={() => setShowDetail(true)}
        >
          <CheckCircle2 size={16} className="text-green-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${PRIORITY_TAG[activity.priority] ?? 'bg-slate-600 text-slate-200'}`}>
                {PRIORITY_LABEL[activity.priority] ?? activity.priority}
              </span>
              {activity.project && (
                <span className="text-xs text-slate-400 font-medium truncate max-w-[160px]">{activity.project}</span>
              )}
            </div>
            <p className="text-sm font-semibold text-white leading-snug">{activity.title}</p>
            {approvedDate && (
              <p className="text-xs text-green-400/80 mt-1 flex items-center gap-1">
                <CheckCircle2 size={10} />
                Aprobada {approvedDate}
              </p>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
            className="shrink-0 text-slate-500 hover:text-white transition p-0.5"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        <div
          className={`border-t border-slate-700/60 px-4 py-2.5 flex items-center gap-2 ${changelog ? 'bg-teal-950/30 hover:bg-teal-900/40 transition' : 'bg-amber-950/20'} ${changelog && onNavigateToChangelog ? 'cursor-pointer' : ''}`}
          onClick={changelog && onNavigateToChangelog ? (e) => { e.stopPropagation(); onNavigateToChangelog(changelog.id); } : undefined}
        >
          {changelog ? (
            <>
              <GitCommitHorizontal size={13} className="text-teal-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-teal-300 truncate">{changelog.title}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {changelog.release_category ?? changelog.change_type}
                  {changelog.release_date && ` · ${new Date(changelog.release_date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </p>
              </div>
              {onNavigateToChangelog && (
                <span className="text-[10px] text-teal-500 hover:text-teal-300 font-medium shrink-0 transition">Ver →</span>
              )}
            </>
          ) : (
            <>
              <Clock size={13} className="text-amber-400 shrink-0" />
              <p className="text-xs text-amber-400/90">
                {activity.changelog_requested
                  ? 'Esperando que el colaborador vincule su Control de Cambios'
                  : 'Sin Control de Cambios vinculado'}
              </p>
            </>
          )}
        </div>

        {expanded && activity.description && (
          <div className="px-4 py-3 border-t border-slate-700/60 bg-slate-900/40">
            <p className="text-xs text-slate-400 leading-relaxed">{activity.description}</p>
          </div>
        )}
      </div>

      {showDetail && (
        <ActivityDetail
          activity={activity}
          onClose={() => setShowDetail(false)}
          onRefresh={() => {}}
          canDelete={true}
        />
      )}
    </>
  );
}

// ─── Manager Personal Kanban ──────────────────────────────────────────────────

const MANAGER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'PENDIENTES',
  IN_PROGRESS: 'EN PROCESO',
  COMPLETED: 'COMPLETADAS',
};

const MANAGER_STATUS_COLORS: Record<string, { bar: string; badge: string; text: string }> = {
  PENDING:    { bar: 'bg-red-500',    badge: 'bg-red-500/20 text-red-300',    text: 'text-red-400' },
  IN_PROGRESS:{ bar: 'bg-yellow-500', badge: 'bg-yellow-500/20 text-yellow-300', text: 'text-yellow-400' },
  COMPLETED:  { bar: 'bg-emerald-500',badge: 'bg-emerald-500/20 text-emerald-300', text: 'text-emerald-400' },
};

function ManagerActivityCard({ activity, onRefresh }: { activity: any; onRefresh: () => void }) {
  const [showDetail, setShowDetail] = useState(false);
  const [moving, setMoving] = useState(false);

  const priorityColors: Record<string, string> = {
    HIGH: 'bg-red-500/25 text-red-300 border-red-500/40',
    MEDIUM: 'bg-yellow-500/25 text-yellow-300 border-yellow-500/40',
    LOW: 'bg-green-500/25 text-green-300 border-green-500/40',
  };

  const handleMarkComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMoving(true);
    await supabase
      .from('activities')
      .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
      .eq('id', activity.id);
    setMoving(false);
    onRefresh();
  };

  const handleMoveToInProgress = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMoving(true);
    await supabase
      .from('activities')
      .update({ status: 'IN_PROGRESS', updated_at: new Date().toISOString() })
      .eq('id', activity.id);
    setMoving(false);
    onRefresh();
  };

  const handleMoveToPending = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setMoving(true);
    await supabase
      .from('activities')
      .update({ status: 'PENDING', updated_at: new Date().toISOString() })
      .eq('id', activity.id);
    setMoving(false);
    onRefresh();
  };

  const endDateStr = activity.end_date
    ? new Date(activity.end_date + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
    : null;

  const isOverdue = activity.end_date
    && !['COMPLETED', 'APPROVED', 'IN_REVIEW', 'NEEDS_REVISION'].includes(activity.status)
    && new Date(activity.end_date + 'T00:00:00') < new Date(new Date().toDateString());

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className="bg-slate-800 border border-slate-700 hover:border-slate-500 rounded-xl p-4 cursor-pointer transition group"
      >
        <div className="flex items-start gap-2 mb-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${priorityColors[activity.priority] ?? 'bg-slate-600 text-slate-300 border-slate-500'}`}>
            {PRIORITY_LABEL[activity.priority] ?? activity.priority}
          </span>
          {activity.project && (
            <span className="text-[10px] text-slate-400 font-medium truncate">{activity.project}</span>
          )}
        </div>

        <p className="text-sm font-semibold text-white leading-snug mb-2">{activity.title}</p>

        {activity.description && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-2">{activity.description}</p>
        )}

        {endDateStr && (
          <p className={`text-[11px] flex items-center gap-1 mb-3 ${isOverdue ? 'text-red-400' : 'text-slate-500'}`}>
            <Clock size={10} />
            {isOverdue ? 'Vencida: ' : 'Vence: '}{endDateStr}
          </p>
        )}

        {/* Action buttons */}
        {activity.status === 'PENDING' && (
          <div className="flex gap-2">
            <button
              onClick={handleMoveToInProgress}
              disabled={moving}
              className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg bg-yellow-500/15 text-yellow-300 hover:bg-yellow-500/25 border border-yellow-500/30 transition disabled:opacity-50"
            >
              Iniciar
            </button>
            <button
              onClick={handleMarkComplete}
              disabled={moving}
              className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 transition disabled:opacity-50"
            >
              Completar
            </button>
          </div>
        )}
        {activity.status === 'IN_PROGRESS' && (
          <div className="flex gap-2">
            <button
              onClick={handleMoveToPending}
              disabled={moving}
              className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg bg-slate-600/60 text-slate-300 hover:bg-slate-600 border border-slate-600 transition disabled:opacity-50"
            >
              Pausar
            </button>
            <button
              onClick={handleMarkComplete}
              disabled={moving}
              className="flex-1 text-[11px] font-semibold py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 transition disabled:opacity-50"
            >
              Completar
            </button>
          </div>
        )}
        {activity.status === 'COMPLETED' && (
          <button
            onClick={handleMoveToPending}
            disabled={moving}
            className="w-full text-[11px] font-semibold py-1.5 rounded-lg bg-slate-700/60 text-slate-400 hover:bg-slate-700 border border-slate-600/60 transition disabled:opacity-50"
          >
            Reabrir
          </button>
        )}
      </div>

      {showDetail && (
        <ActivityDetail
          activity={activity}
          onClose={() => setShowDetail(false)}
          onRefresh={onRefresh}
          canDelete={true}
        />
      )}
    </>
  );
}

function ManagerKanban({ teamId, managerMemberId, managerName, onShowModal, readOnly = false }: {
  teamId: string;
  managerMemberId: string;
  managerName: string;
  onShowModal: () => void;
  readOnly?: boolean;
}) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('team_id', teamId)
      .eq('team_member_id', managerMemberId)
      .order('created_at', { ascending: false });
    setActivities(data ?? []);
    setLoading(false);
  }, [teamId, managerMemberId]);

  useEffect(() => {
    load();
    const sub = supabase
      .channel(`mgr-activities-${managerMemberId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities', filter: `team_member_id=eq.${managerMemberId}` }, load)
      .subscribe();
    return () => { sub.unsubscribe(); };
  }, [load, managerMemberId]);

  const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
  const pending = activities.filter(a => a.status === 'PENDING').length;
  const inProgress = activities.filter(a => a.status === 'IN_PROGRESS').length;
  const completed = activities.filter(a => a.status === 'COMPLETED').length;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <UserCog size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Mis Actividades</h2>
              <p className="text-slate-400 text-sm mt-0.5">{managerName} · Gestor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
              title="Actualizar actividades"
            >
              <RefreshCw size={16} />
            </button>
            {!readOnly && (
              <button
                onClick={onShowModal}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition font-semibold"
              >
                <Plus size={18} />
                Nueva Actividad
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-slate-400 text-sm">Pendientes</p>
          <p className="text-3xl font-bold text-red-400 mt-1">{pending}</p>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-slate-400 text-sm">En Proceso</p>
          <p className="text-3xl font-bold text-yellow-400 mt-1">{inProgress}</p>
        </div>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
          <p className="text-slate-400 text-sm">Completadas</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{completed}</p>
        </div>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="text-slate-400 text-center py-12">Cargando actividades...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {statuses.map(status => {
            const col = MANAGER_STATUS_COLORS[status];
            const colActs = activities.filter(a => a.status === status);
            return (
              <div key={status} className="bg-slate-800 rounded-xl border border-slate-700 p-4 min-h-64">
                <div className={`${col.bar} w-full h-1.5 rounded-full mb-4`} />
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-xs tracking-widest uppercase text-white">
                    {MANAGER_STATUS_LABELS[status]}
                  </h3>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.badge}`}>
                    {colActs.length}
                  </span>
                </div>
                {colActs.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-700/50 rounded-xl py-10 flex flex-col items-center gap-2">
                    <p className="text-slate-600 text-sm">Sin actividades</p>
                  </div>
                ) : (() => {
                  const groups = groupByProject(colActs);
                  if (groups.length === 1) {
                    return (
                      <div className="space-y-3">
                        {colActs.map(activity => (
                          <ManagerActivityCard key={activity.id} activity={activity} onRefresh={load} />
                        ))}
                      </div>
                    );
                  }
                  return (
                    <div>
                      {groups.map(g => (
                        <ProjectGroup
                          key={g.project}
                          project={g.project}
                          items={g.items}
                          renderCard={(a) => (
                            <ManagerActivityCard key={a.id} activity={a} onRefresh={load} />
                          )}
                        />
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Project Grouping ─────────────────────────────────────────────────────────

function groupByProject(activities: any[]): { project: string; items: any[] }[] {
  const order: string[] = [];
  const map: Record<string, any[]> = {};
  for (const a of activities) {
    const key = a.project?.trim() || '— Sin proyecto';
    if (!map[key]) { map[key] = []; order.push(key); }
    map[key].push(a);
  }
  return order.map(p => ({ project: p, items: map[p] }));
}

function ProjectGroup({
  project,
  items,
  renderCard,
  defaultOpen = true,
}: {
  project: string;
  items: any[];
  renderCard: (a: any) => React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const noProject = project === '— Sin proyecto';
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-1 py-1.5 rounded-lg hover:bg-slate-700/40 transition group mb-1"
      >
        <Layers size={11} className={noProject ? 'text-slate-600' : 'text-blue-400'} />
        <span className={`text-[11px] font-bold uppercase tracking-wider truncate flex-1 text-left ${noProject ? 'text-slate-600' : 'text-blue-300'}`}>
          {project}
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-700 text-slate-400 shrink-0">
          {items.length}
        </span>
        {open ? <ChevronUp size={11} className="text-slate-500 shrink-0" /> : <ChevronDown size={11} className="text-slate-500 shrink-0" />}
      </button>
      {open && (
        <div className="space-y-2 pl-1">
          {items.map(a => renderCard(a))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IndividualKanbanTabs({ teamId, pendingActivityId, onPendingClear, managerMemberId, managerName, readOnly = false, onNavigateToChangelog }: IndividualKanbanTabsProps) {
  const [collaborators, setCollaborators] = useState<any[]>([]);
  // 'manager' is the special tab id for manager's own activities
  const [selectedCollaborator, setSelectedCollaborator] = useState<string>('');
  const [activities, setActivities] = useState<any[]>([]);
  const [approvedActivities, setApprovedActivities] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showApproved, setShowApproved] = useState(true);
  const [autoOpenActivity, setAutoOpenActivity] = useState<any | null>(null);
  const pendingHandled = useRef<string | null>(null);

  const isManagerTab = selectedCollaborator === '__manager__';

  useEffect(() => {
    loadCollaborators();
  }, [teamId]);

  const loadActivities = useCallback(async () => {
    if (!selectedCollaborator || isManagerTab) return;
    try {
      const { data: ownedData } = await supabase
        .from('activities')
        .select('*')
        .eq('team_id', teamId)
        .eq('team_member_id', selectedCollaborator)
        .order('created_at', { ascending: false });

      const { data: stepLinks } = await supabase
        .from('task_steps')
        .select('activity_id')
        .eq('assigned_member_id', selectedCollaborator);

      const sharedActivityIds = [...new Set((stepLinks || []).map((s: any) => s.activity_id))];
      const ownedIds = new Set((ownedData || []).map((a: any) => a.id));
      const foreignIds = sharedActivityIds.filter(id => !ownedIds.has(id));

      let sharedData: any[] = [];
      if (foreignIds.length > 0) {
        const { data } = await supabase
          .from('activities')
          .select('*')
          .in('id', foreignIds)
          .order('created_at', { ascending: false });
        sharedData = (data || []).map((a: any) => ({ ...a, _shared: true }));
      }

      const all = [...(ownedData || []), ...sharedData];
      const active = all.filter((a: any) => !['APPROVED'].includes(a.status));
      const approved = all.filter((a: any) => a.status === 'APPROVED');

      setActivities(active);

      if (approved.length === 0) {
        setApprovedActivities([]);
        return;
      }

      const approvedIds = approved.map((a: any) => a.id);
      const { data: links } = await supabase
        .from('activity_changelog_links')
        .select('activity_id, changelog_entry_id')
        .in('activity_id', approvedIds);

      const changelogIds = (links || []).map((l: any) => l.changelog_entry_id);
      let changelogMap: Record<string, any> = {};

      if (changelogIds.length > 0) {
        const { data: entries } = await supabase
          .from('changelog_entries')
          .select('id, title, change_type, release_category, release_date')
          .in('id', changelogIds);
        (entries || []).forEach((e: any) => { changelogMap[e.id] = e; });
      }

      const linkMap: Record<string, any> = {};
      (links || []).forEach((l: any) => { linkMap[l.activity_id] = changelogMap[l.changelog_entry_id] ?? null; });

      setApprovedActivities(approved.map((a: any) => ({ ...a, changelog: linkMap[a.id] ?? null })));
    } catch (err) {
      console.error(err);
    }
  }, [selectedCollaborator, teamId, isManagerTab]);

  useEffect(() => {
    if (!pendingActivityId || pendingHandled.current === pendingActivityId) return;
    pendingHandled.current = pendingActivityId;
    (async () => {
      const { data } = await supabase
        .from('activities')
        .select('*')
        .eq('id', pendingActivityId)
        .maybeSingle();
      if (data) {
        if (data.team_member_id && data.team_member_id !== selectedCollaborator) {
          setSelectedCollaborator(data.team_member_id);
        }
        setAutoOpenActivity(data);
      }
      onPendingClear?.();
    })();
  }, [pendingActivityId]);

  useEffect(() => {
    if (!selectedCollaborator || isManagerTab) return;
    loadActivities();
    const sub1 = supabase
      .channel(`activities-ind-${selectedCollaborator}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'activities',
        filter: `team_member_id=eq.${selectedCollaborator}`,
      }, () => loadActivities())
      .subscribe();
    const sub2 = supabase
      .channel(`activities-shared-${selectedCollaborator}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'activities',
        filter: `shared_with_member_id=eq.${selectedCollaborator}`,
      }, () => loadActivities())
      .subscribe();
    return () => { sub1.unsubscribe(); sub2.unsubscribe(); };
  }, [selectedCollaborator, loadActivities, isManagerTab]);

  const loadCollaborators = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('team_members')
        .select('id, email, name, position')
        .eq('team_id', teamId)
        .order('created_at', { ascending: true });

      if (data) {
        // Exclude the manager's own team_member row from collaborator tabs
        const filtered = managerMemberId ? data.filter((c: any) => c.id !== managerMemberId) : data;
        setCollaborators(filtered);
        // Default: manager tab if available, else first collaborator
        if (managerMemberId) {
          setSelectedCollaborator('__manager__');
        } else if (filtered.length > 0 && !selectedCollaborator) {
          setSelectedCollaborator(filtered[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => (
    { HIGH: 'bg-red-500', MEDIUM: 'bg-yellow-500', LOW: 'bg-green-500' }[priority] ?? 'bg-gray-500'
  );

  const getStatusColor = (status: string) => (
    { PENDING: 'bg-red-500', IN_PROGRESS: 'bg-yellow-500', COMPLETED: 'bg-green-500', IN_REVIEW: 'bg-cyan-500', NEEDS_REVISION: 'bg-orange-500', BLOCKED: 'bg-red-600' }[status] ?? 'bg-gray-500'
  );

  const statusLabel: Record<string, string> = {
    PENDING: 'PENDIENTES',
    IN_PROGRESS: 'EN PROCESO',
    COMPLETED: 'COMPLETADAS',
    IN_REVIEW: 'EN REVISIÓN',
    NEEDS_REVISION: 'CON CORRECCIONES',
    BLOCKED: 'BLOQUEADAS',
  };

  const blockedCount = activities.filter(a => a.status === 'BLOCKED').length;
  const baseStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];
  const extraStatuses = ['BLOCKED', 'IN_REVIEW', 'NEEDS_REVISION'].filter(s => activities.some(a => a.status === s));
  const displayStatuses = [...baseStatuses, ...extraStatuses];

  const collab = collaborators.find(c => c.id === selectedCollaborator);

  // The team_member_id to pre-assign in modal
  const modalDefaultAssignee = isManagerTab ? managerMemberId : selectedCollaborator;

  if (loading) {
    return <div className="text-white text-center py-8">Cargando...</div>;
  }

  if (!managerMemberId && collaborators.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 text-center">
        <p className="text-slate-400">No hay colaboradores. Agrega uno para comenzar.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {/* Manager tab */}
          {managerMemberId && (
            <button
              onClick={() => setSelectedCollaborator('__manager__')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition font-semibold text-sm ${
                isManagerTab
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <UserCog size={15} />
              {managerName || 'Mis Actividades'}
            </button>
          )}
          {/* Separator */}
          {managerMemberId && collaborators.length > 0 && (
            <div className="w-px bg-slate-600 mx-1 self-stretch rounded" />
          )}
          {/* Collaborator tabs */}
          {collaborators.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCollaborator(c.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition font-medium text-sm ${
                selectedCollaborator === c.id ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title={`${c.name} - ${c.position}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Manager kanban */}
      {isManagerTab && managerMemberId && (
        <>
          <ManagerKanban
            teamId={teamId}
            managerMemberId={managerMemberId}
            managerName={managerName || 'Gestor'}
            onShowModal={() => setShowModal(true)}
            readOnly={readOnly}
          />
          {showModal && (
            <ActivityModal
              teamId={teamId}
              onClose={() => setShowModal(false)}
              onActivityCreated={() => {}}
              defaultAssignedTo={managerMemberId}
              managerMemberId={managerMemberId}
              managerName={managerName}
            />
          )}
        </>
      )}

      {/* Collaborator kanban */}
      {!isManagerTab && selectedCollaborator && (
        <>
          {/* Header */}
          <div className="mb-6 bg-slate-800 rounded-lg border border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Actividades de {collab?.name}</h2>
                <p className="text-slate-400 text-sm mt-1">{collab?.email} • {collab?.position}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadActivities}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
                  title="Actualizar actividades"
                >
                  <RefreshCw size={16} />
                </button>
                {!readOnly && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
                  >
                    <Plus size={20} />
                    Nueva Actividad
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className={`mb-6 grid gap-4 ${blockedCount > 0 ? 'grid-cols-2 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <p className="text-slate-400 text-sm">Total activas</p>
              <p className="text-3xl font-bold text-white mt-1">{activities.length}</p>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <p className="text-slate-400 text-sm">Pendientes</p>
              <p className="text-3xl font-bold text-red-400 mt-1">{activities.filter(a => a.status === 'PENDING').length}</p>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <p className="text-slate-400 text-sm">En Proceso</p>
              <p className="text-3xl font-bold text-yellow-400 mt-1">{activities.filter(a => a.status === 'IN_PROGRESS').length}</p>
            </div>
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
              <p className="text-slate-400 text-sm">Aprobadas</p>
              <p className="text-3xl font-bold text-green-400 mt-1">{approvedActivities.length}</p>
            </div>
            {blockedCount > 0 && (
              <div className="bg-red-950/40 rounded-lg border border-red-600/50 p-4 flex items-center gap-3">
                <ShieldAlert size={24} className="text-red-400 shrink-0" />
                <div>
                  <p className="text-red-300 text-sm font-semibold">Bloqueadas</p>
                  <p className="text-3xl font-bold text-red-400 mt-0.5">{blockedCount}</p>
                </div>
              </div>
            )}
          </div>

          {/* Kanban */}
          <div className={`grid grid-cols-1 gap-6 ${
            displayStatuses.length <= 3 ? 'md:grid-cols-3' :
            displayStatuses.length === 4 ? 'md:grid-cols-4' :
            'md:grid-cols-3 lg:grid-cols-5'
          }`}>
            {displayStatuses.map(status => (
              <div key={status} className={`rounded-lg border p-4 min-h-64 ${
                status === 'BLOCKED'
                  ? 'bg-red-950/20 border-red-600/50'
                  : 'bg-slate-800 border-slate-700'
              }`}>
                <div className={`${getStatusColor(status)} w-full h-2 rounded mb-4`} />
                <h3 className={`font-bold mb-4 text-center text-sm flex items-center justify-center gap-2 ${
                  status === 'BLOCKED' ? 'text-red-300' : 'text-white'
                }`}>
                  {status === 'BLOCKED' && <ShieldAlert size={14} className="text-red-400" />}
                  {statusLabel[status] ?? status}
                </h3>
                {(() => {
                  const colActs = activities.filter(a => a.status === status);
                  if (colActs.length === 0) {
                    return <p className="text-slate-500 text-center py-8 text-sm">Sin actividades</p>;
                  }
                  const groups = groupByProject(colActs);
                  if (groups.length === 1) {
                    return (
                      <div className="space-y-2">
                        {colActs.map(activity => (
                          <ActivityCard
                            key={activity.id}
                            activity={activity}
                            onRefresh={loadActivities}
                            getPriorityColor={getPriorityColor}
                          />
                        ))}
                      </div>
                    );
                  }
                  return (
                    <div>
                      {groups.map(g => (
                        <ProjectGroup
                          key={g.project}
                          project={g.project}
                          items={g.items}
                          renderCard={(a) => (
                            <ActivityCard
                              key={a.id}
                              activity={a}
                              onRefresh={loadActivities}
                              getPriorityColor={getPriorityColor}
                            />
                          )}
                        />
                      ))}
                    </div>
                  );
                })()}

                {status === 'COMPLETED' && approvedActivities.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <button
                      onClick={() => setShowApproved(v => !v)}
                      className="w-full flex items-center justify-between mb-3 group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-400" />
                        <span className="text-xs font-semibold text-slate-300 tracking-wide group-hover:text-white transition">APROBADAS</span>
                        <span className="text-xs bg-green-500/20 text-green-300 border border-green-500/30 font-bold px-1.5 py-0.5 rounded-full">
                          {approvedActivities.length}
                        </span>
                      </div>
                      {showApproved ? <ChevronUp size={13} className="text-slate-500" /> : <ChevronDown size={13} className="text-slate-500" />}
                    </button>
                    {showApproved && (
                      <div className="space-y-3">
                        {approvedActivities.map(a => (
                          <ApprovedActivityCard key={a.id} activity={a} changelog={a.changelog} onNavigateToChangelog={onNavigateToChangelog} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {showModal && (
            <ActivityModal
              teamId={teamId}
              onClose={() => setShowModal(false)}
              onActivityCreated={loadActivities}
              defaultAssignedTo={selectedCollaborator}
              managerMemberId={managerMemberId}
              managerName={managerName}
            />
          )}
        </>
      )}

      {autoOpenActivity && (
        <ActivityDetail
          activity={autoOpenActivity}
          onClose={() => setAutoOpenActivity(null)}
          onRefresh={loadActivities}
          canDelete={true}
        />
      )}
    </div>
  );
}
