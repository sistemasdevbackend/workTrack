import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Layers, LogOut, User, Building2, ChevronDown,
  Activity, CalendarDays, FolderKanban, Users, BarChart2,
} from 'lucide-react';
import ActivitiesSection from './ActivitiesSection';
import CalendarSection from './CalendarSection';
import ProjectsSection from './ProjectsSection';

interface SupervisorDashboardProps {
  userEmail: string;
  onLogout: () => void;
  onSwitchToManager?: () => void;
}

interface ManagerGrant {
  managerUserId: string;
  managerName: string;
  managerEmail: string;
  teamId: string;
  teamName: string;
  canViewActivities: boolean;
  canAssignActivities: boolean;
  managerMemberId: string;
}

type Section = 'projects' | 'activities' | 'calendar';

const SECTION_LABELS: Record<Section, string> = {
  projects: 'Proyectos',
  activities: 'Actividades',
  calendar: 'Calendario',
};

const SECTION_ICONS: Record<Section, React.FC<any>> = {
  projects: FolderKanban,
  activities: Activity,
  calendar: CalendarDays,
};

export default function SupervisorDashboard({ userEmail, onLogout, onSwitchToManager }: SupervisorDashboardProps) {
  const [grants, setGrants] = useState<ManagerGrant[]>([]);
  const [selectedGrant, setSelectedGrant] = useState<ManagerGrant | null>(null);
  const [activeSection, setActiveSection] = useState<Section>('projects');
  const [loading, setLoading] = useState(true);
  const [supervisorName, setSupervisorName] = useState('');
  const [supervisorUserId, setSupervisorUserId] = useState('');
  const [showManagerPicker, setShowManagerPicker] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSupervisorUserId(user.id);

    // Fetch all grants — include resolved_team_id for super_admins without team_id
    const { data: grantRows } = await supabase
      .from('viewer_grants')
      .select('manager_user_id, can_view_activities, can_assign_activities, resolved_team_id')
      .eq('viewer_user_id', user.id);

    if (!grantRows || grantRows.length === 0) {
      setGrants([]);
      setLoading(false);
      return;
    }

    const managerIds = grantRows.map((g: any) => g.manager_user_id);

    // Get manager roles (may have null team_id for super_admins)
    const { data: managerRoles } = await supabase
      .from('app_roles')
      .select('user_id, team_id, display_name')
      .in('user_id', managerIds);

    // Collect all relevant team IDs: from app_roles and from resolved_team_id in grants
    const roleTeamIds = (managerRoles ?? []).map((r: any) => r.team_id).filter(Boolean);
    const resolvedTeamIds = grantRows.map((g: any) => g.resolved_team_id).filter(Boolean);
    const allTeamIds = [...new Set([...roleTeamIds, ...resolvedTeamIds])];

    const [{ data: teamsData }, { data: membersData }] = await Promise.all([
      allTeamIds.length > 0
        ? supabase.from('teams').select('id, name').in('id', allTeamIds)
        : Promise.resolve({ data: [] }),
      supabase.from('team_members').select('id, user_id, name, email, team_id').in('user_id', managerIds),
    ]);

    const teamMap: Record<string, string> = {};
    (teamsData ?? []).forEach((t: any) => { teamMap[t.id] = t.name; });

    // Build member map — for managers in multiple teams, prefer matching team
    const membersByUserId: Record<string, Array<{ name: string; email: string; team_id: string; member_id: string }>> = {};
    (membersData ?? []).forEach((m: any) => {
      if (!m.user_id) return;
      if (!membersByUserId[m.user_id]) membersByUserId[m.user_id] = [];
      membersByUserId[m.user_id].push({ name: m.name, email: m.email, team_id: m.team_id, member_id: m.id });
    });

    const builtGrants: ManagerGrant[] = (managerRoles ?? []).map((mr: any) => {
      const grantRow = grantRows.find((g: any) => g.manager_user_id === mr.user_id);
      // Determine team: app_roles.team_id first, then resolved_team_id from grant
      const teamId: string = mr.team_id ?? grantRow?.resolved_team_id ?? '';

      // Find the member record that matches this team
      const memberList = membersByUserId[mr.user_id] ?? [];
      const memberInfo = memberList.find(m => m.team_id === teamId) ?? memberList[0];

      // Name: team_members.name > app_roles.display_name > fallback
      const managerName = memberInfo?.name ?? mr.display_name ?? 'Gestor';

      return {
        managerUserId: mr.user_id,
        managerName,
        managerEmail: memberInfo?.email ?? '',
        teamId,
        teamName: teamId ? (teamMap[teamId] ?? '') : '',
        canViewActivities: grantRow?.can_view_activities ?? true,
        canAssignActivities: grantRow?.can_assign_activities ?? false,
        managerMemberId: memberInfo?.member_id ?? '',
      };
    }).filter((g: ManagerGrant) => g.teamId);

    setGrants(builtGrants);
    if (builtGrants.length > 0) setSelectedGrant(prev => {
      // Keep current selection if still valid
      if (prev && builtGrants.find(g => g.managerUserId === prev.managerUserId)) {
        return builtGrants.find(g => g.managerUserId === prev.managerUserId)!;
      }
      return builtGrants[0];
    });

    // Supervisor display name: team_members > app_roles.display_name > email prefix
    const { data: myRoleRow } = await supabase
      .from('app_roles')
      .select('display_name')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: myMemberRow } = await supabase
      .from('team_members')
      .select('name')
      .eq('user_id', user.id)
      .maybeSingle();

    setSupervisorName(myMemberRow?.name ?? myRoleRow?.display_name ?? '');

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const availableSections: Section[] = ['projects'];
  if (selectedGrant?.canViewActivities) availableSections.push('activities');
  availableSections.push('calendar');

  // Auto-switch section if current not available
  useEffect(() => {
    if (!availableSections.includes(activeSection)) {
      setActiveSection('projects');
    }
  }, [selectedGrant]);

  if (loading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  const displayName = supervisorName || userEmail.split('@')[0];

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0b0e18' }}>
      {/* Top Navbar */}
      <header className="h-14 flex items-center justify-between px-5 shrink-0 gap-4"
        style={{ background: 'linear-gradient(90deg,#060a12 0%,#0b1120 100%)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-3 min-w-0">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', boxShadow: '0 2px 12px rgba(14,165,233,0.35)' }}>
              <BarChart2 size={16} className="text-white" />
            </div>
            <div className="hidden sm:block min-w-0">
              <h1 className="text-base font-black text-white leading-none tracking-tight">WorkTrack</h1>
              <p className="text-sky-400/70 text-xs font-semibold leading-none mt-0.5">Vista Supervisor</p>
            </div>
          </div>
        </div>

        {/* Manager selector */}
        {grants.length > 1 && (
          <div className="relative flex-1 max-w-xs">
            <button
              onClick={() => setShowManagerPicker(v => !v)}
              className="w-full flex items-center gap-2 bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white transition"
            >
              <Building2 size={13} className="text-slate-400 shrink-0" />
              <span className="flex-1 text-left truncate">
                {selectedGrant ? `${selectedGrant.managerName} · ${selectedGrant.teamName}` : 'Seleccionar gestor'}
              </span>
              <ChevronDown size={13} className="text-slate-400 shrink-0" />
            </button>
            {showManagerPicker && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                {grants.map(g => (
                  <button key={g.managerUserId}
                    onClick={() => { setSelectedGrant(g); setShowManagerPicker(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700 transition ${selectedGrant?.managerUserId === g.managerUserId ? 'bg-slate-700/60' : ''}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                      <User size={12} className="text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{g.managerName}</p>
                      <p className="text-slate-500 text-xs truncate">{g.teamName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Single manager pill when only one */}
        {grants.length === 1 && selectedGrant && (
          <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5">
            <Building2 size={13} className="text-slate-400" />
            <span className="text-sm text-white">{selectedGrant.managerName}</span>
            <span className="text-slate-500 text-xs">· {selectedGrant.teamName}</span>
          </div>
        )}

        <div className="flex items-center gap-2.5 shrink-0">
          {onSwitchToManager && (
            <button onClick={onSwitchToManager}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              style={{ color: '#38bdf8', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,189,248,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,189,248,0.08)'; }}
            >
              <Users size={13} />Mi equipo
            </button>
          )}
          <div className="text-right hidden sm:block">
            <p className="text-sm text-slate-200 leading-none font-medium">{displayName}</p>
            <p className="text-xs mt-0.5 text-sky-400 font-semibold">Supervisor</p>
          </div>
          <button onClick={onLogout}
            className="p-1.5 text-slate-500 hover:text-white rounded-lg transition"
            style={{ background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <nav className="w-14 flex flex-col items-center py-4 gap-1 shrink-0"
          style={{ background: '#0a0f1c', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
          {availableSections.map(section => {
            const Icon = SECTION_ICONS[section];
            const active = activeSection === section;
            return (
              <button key={section} onClick={() => setActiveSection(section)}
                title={SECTION_LABELS[section]}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative"
                style={{
                  background: active ? 'rgba(14,165,233,0.2)' : 'transparent',
                  color: active ? '#38bdf8' : '#475569',
                  boxShadow: active ? '0 0 12px rgba(14,165,233,0.2)' : 'none',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
              >
                <Icon size={18} />
                <span className="absolute left-12 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50"
                  style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {SECTION_LABELS[section]}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'linear-gradient(160deg,#0a0e19 0%,#080c15 100%)' }} onClick={() => setShowManagerPicker(false)}>
          {grants.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Users size={48} className="text-slate-600 mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Sin gestores asignados</h2>
              <p className="text-slate-400 text-sm">El administrador aún no te ha asignado acceso a ningún gestor.</p>
            </div>
          ) : !selectedGrant ? null : (
            <div className="p-6">
              {/* Section header */}
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                  <User size={11} />{selectedGrant.managerName}
                  <span className="mx-1">·</span>
                  <Building2 size={11} />{selectedGrant.teamName}
                </div>
                {selectedGrant.canAssignActivities && (
                  <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded font-medium">
                    Puede asignar actividades
                  </span>
                )}
              </div>

              {activeSection === 'projects' && (
                <ProjectsSection
                  teamId={selectedGrant.teamId}
                  userId={selectedGrant.managerUserId}
                  readOnly={true}
                />
              )}

              {activeSection === 'activities' && selectedGrant.canViewActivities && (
                <ActivitiesSection
                  teamId={selectedGrant.teamId}
                  managerMemberId={selectedGrant.canAssignActivities ? selectedGrant.managerMemberId : undefined}
                  managerName={selectedGrant.managerName}
                  readOnly={!selectedGrant.canAssignActivities}
                />
              )}

              {activeSection === 'calendar' && (
                <CalendarSection
                  teamId={selectedGrant.teamId}
                  managerMemberId={selectedGrant.managerMemberId}
                  readOnly={true}
                />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="shrink-0 h-9 flex items-center justify-between px-5"
        style={{ background: 'rgba(6,10,18,0.95)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}>
            <BarChart2 size={9} className="text-white" />
          </div>
          <span className="text-white font-black text-xs tracking-tight">WorkTrack</span>
          <span className="text-slate-700 text-xs">&mdash; Panel Supervisor</span>
        </div>
        <p className="text-slate-700 text-xs">&copy; {new Date().getFullYear()} WorkTrack</p>
      </footer>
    </div>
  );
}