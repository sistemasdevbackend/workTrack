import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Layers, LogOut, ChevronDown, ChevronUp, Clock,
  CheckCircle2, PauseCircle, XCircle, TrendingUp, AlertCircle,
  MessageSquare, Calendar, User, Building2,
} from 'lucide-react';

interface ViewerDashboardProps {
  userEmail: string;
  onLogout: () => void;
}

interface ProjectStatusLog {
  id: string;
  team_id: string;
  project_name: string;
  overall_status: string;
  comment: string;
  logged_by: string;
  logged_at: string;
}

interface ProjectSummary {
  name: string;
  latestLog: ProjectStatusLog | null;
  logs: ProjectStatusLog[];
  activityCount: number;
}

interface ManagerView {
  userId: string;
  name: string;
  email: string;
  teamName: string;
  teamId: string;
  projects: ProjectSummary[];
}

const STATUS_OPTIONS = [
  { value: 'DEVELOPING', label: 'En Desarrollo', icon: TrendingUp,   color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/40' },
  { value: 'AT_RISK',    label: 'En Riesgo',     icon: AlertCircle,  color: 'text-amber-400',  bg: 'bg-amber-500/15 border-amber-500/40' },
  { value: 'ON_HOLD',    label: 'En Pausa',      icon: PauseCircle,  color: 'text-slate-400',  bg: 'bg-slate-500/15 border-slate-500/40' },
  { value: 'COMPLETED',  label: 'Completado',    icon: CheckCircle2, color: 'text-emerald-400',bg: 'bg-emerald-500/15 border-emerald-500/40' },
  { value: 'CANCELLED',  label: 'Cancelado',     icon: XCircle,      color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/40' },
];

function statusMeta(value: string) {
  return STATUS_OPTIONS.find(s => s.value === value) ?? STATUS_OPTIONS[0];
}

// ─── Read-only Project Card ────────────────────────────────────────
function ProjectCard({ project }: { project: ProjectSummary }) {
  const [showLogs, setShowLogs] = useState(false);
  const latest = project.latestLog;
  const sm = latest ? statusMeta(latest.overall_status) : null;
  const StatusIcon = sm?.icon ?? Layers;

  return (
    <div className="bg-slate-800/70 border border-slate-700 rounded-xl overflow-hidden">
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
              <span className="text-xs text-slate-500">
                {project.activityCount} actividad{project.activityCount !== 1 ? 'es' : ''}
              </span>
              {project.logs.length > 0 && (
                <span className="text-xs text-slate-500 flex items-center gap-0.5">
                  <MessageSquare size={10} />{project.logs.length} actualización{project.logs.length !== 1 ? 'es' : ''}
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
          {project.logs.length > 0 && (
            <button onClick={() => setShowLogs(v => !v)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition shrink-0">
              {showLogs ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
        </div>
      </div>

      {showLogs && (
        <div className="border-t border-slate-700/60 divide-y divide-slate-700/40">
          {project.logs.map((log, idx) => {
            const s = statusMeta(log.overall_status);
            const SIcon = s.icon;
            return (
              <div key={log.id} className={`px-4 py-3 ${idx === 0 ? 'bg-slate-800/40' : ''}`}>
                <div className="flex items-center gap-2 flex-wrap mb-1">
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
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{log.comment}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Manager Section ───────────────────────────────────────────────
function ManagerSection({ manager }: { manager: ManagerView }) {
  const [collapsed, setCollapsed] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');

  const filtered = filterStatus === 'ALL'
    ? manager.projects
    : filterStatus === 'NO_STATUS'
    ? manager.projects.filter(p => !p.latestLog)
    : manager.projects.filter(p => p.latestLog?.overall_status === filterStatus);

  const counts = {
    ALL: manager.projects.length,
    NO_STATUS: manager.projects.filter(p => !p.latestLog).length,
    ...Object.fromEntries(STATUS_OPTIONS.map(s => [s.value, manager.projects.filter(p => p.latestLog?.overall_status === s.value).length])),
  };

  return (
    <div className="bg-slate-900/60 border border-slate-700/80 rounded-2xl overflow-hidden">
      {/* Manager header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/40 transition text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <User size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">{manager.name}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-slate-500 text-xs">{manager.email}</span>
              {manager.teamName && (
                <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-700/60 px-2 py-0.5 rounded">
                  <Building2 size={10} />{manager.teamName}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{manager.projects.length} proyecto{manager.projects.length !== 1 ? 's' : ''}</span>
          {collapsed ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronUp size={16} className="text-slate-400" />}
        </div>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-700/60 pt-4">
          {manager.projects.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">Este gestor no tiene proyectos registrados aún.</p>
          ) : (
            <>
              {/* Filter bar */}
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setFilterStatus('ALL')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterStatus === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'}`}>
                  Todos <span className="bg-white/20 rounded px-1">{counts.ALL}</span>
                </button>
                {STATUS_OPTIONS.map(s => {
                  const count = (counts as any)[s.value];
                  if (count === 0) return null;
                  const Icon = s.icon;
                  return (
                    <button key={s.value} onClick={() => setFilterStatus(s.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${filterStatus === s.value ? `${s.bg} ${s.color} border-current` : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                      <Icon size={12} />{s.label} <span className="bg-current/20 rounded px-1">{count}</span>
                    </button>
                  );
                })}
                {counts.NO_STATUS > 0 && (
                  <button onClick={() => setFilterStatus('NO_STATUS')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition border ${filterStatus === 'NO_STATUS' ? 'bg-slate-600 text-white border-slate-500' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}>
                    Sin estatus <span className="bg-white/20 rounded px-1">{counts.NO_STATUS}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map(p => <ProjectCard key={p.name} project={p} />)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────
export default function ViewerDashboard({ userEmail, onLogout }: ViewerDashboardProps) {
  const [managers, setManagers] = useState<ManagerView[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerName, setViewerName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get viewer's name from app_roles joined with team_members or metadata
    const { data: grants } = await supabase
      .from('viewer_grants')
      .select('manager_user_id')
      .eq('viewer_user_id', user.id);

    if (!grants || grants.length === 0) {
      setManagers([]);
      setLoading(false);
      return;
    }

    const managerIds = grants.map(g => g.manager_user_id);

    // Get manager roles + team assignments
    const { data: managerRoles } = await supabase
      .from('app_roles')
      .select('user_id, team_id')
      .in('user_id', managerIds);

    if (!managerRoles || managerRoles.length === 0) {
      setManagers([]);
      setLoading(false);
      return;
    }

    const teamIds = [...new Set(managerRoles.map(r => r.team_id).filter(Boolean))];

    // Get team names and manager info from team_members
    const [{ data: teamsData }, { data: membersData }] = await Promise.all([
      supabase.from('teams').select('id, name').in('id', teamIds),
      supabase.from('team_members').select('user_id, name, email, team_id').in('user_id', managerIds),
    ]);

    const teamMap: Record<string, string> = {};
    (teamsData ?? []).forEach((t: any) => { teamMap[t.id] = t.name; });

    const memberMap: Record<string, { name: string; email: string; team_id: string }> = {};
    (membersData ?? []).forEach((m: any) => { if (m.user_id) memberMap[m.user_id] = m; });

    // For each manager, load their team_projects + status logs + activity counts
    const managerViews: ManagerView[] = await Promise.all(
      managerRoles.map(async (mr) => {
        const memberInfo = memberMap[mr.user_id];
        const teamId = mr.team_id ?? memberInfo?.team_id ?? '';
        const teamName = teamId ? (teamMap[teamId] ?? '') : '';

        const [{ data: projectRows }, { data: logs }, { data: activities }] = await Promise.all([
          supabase.from('team_projects').select('name').eq('team_id', teamId).order('name'),
          supabase.from('project_status_logs').select('*').eq('team_id', teamId).order('logged_at', { ascending: false }),
          supabase.from('activities').select('project').eq('team_id', teamId).neq('status', 'CANCELLED'),
        ]);

        const allLogs = (logs ?? []) as ProjectStatusLog[];
        const activityList = (activities ?? []) as { project: string }[];

        const projects: ProjectSummary[] = (projectRows ?? []).map((p: any) => {
          const pLogs = allLogs.filter(l => l.project_name === p.name);
          return {
            name: p.name,
            latestLog: pLogs[0] ?? null,
            logs: pLogs,
            activityCount: activityList.filter(a => a.project === p.name).length,
          };
        });

        return {
          userId: mr.user_id,
          name: memberInfo?.name ?? 'Gestor',
          email: memberInfo?.email ?? '',
          teamName,
          teamId,
          projects,
        };
      })
    );

    setManagers(managerViews);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalProjects = managers.reduce((s, m) => s + m.projects.length, 0);

  return (
    <div className="h-screen flex flex-col bg-slate-800 overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold text-white leading-none">Activity Manager</h1>
            <p className="text-slate-500 text-xs">Vista de Proyectos</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {viewerName && (
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded border border-slate-700">
              <User size={13} className="text-slate-400" />
              <span className="text-sm text-slate-300">{viewerName}</span>
            </div>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-sm text-slate-300 leading-none">{userEmail}</p>
            <p className="text-xs mt-0.5 text-teal-400 font-medium">Visor</p>
          </div>
          <button onClick={onLogout} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="p-6 max-w-6xl mx-auto space-y-6">
          {/* Page header */}
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Layers size={24} className="text-blue-400" />
              Proyectos
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Estatus general y bitácora de actualizaciones — {managers.length} gestor{managers.length !== 1 ? 'es' : ''}, {totalProjects} proyecto{totalProjects !== 1 ? 's' : ''}
            </p>
          </div>

          {loading ? (
            <div className="text-center py-20 text-slate-400">Cargando proyectos...</div>
          ) : managers.length === 0 ? (
            <div className="text-center py-24 text-slate-500">
              <Layers size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-lg font-semibold text-slate-400">Sin acceso asignado</p>
              <p className="text-sm mt-1">El administrador aún no te ha asignado acceso a ningún gestor.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {managers.map(m => <ManagerSection key={m.userId} manager={m} />)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
