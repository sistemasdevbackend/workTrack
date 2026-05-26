import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Users, Building2, LogOut, UserCheck, Mail, Shield, ChevronDown, Eye, Link, Unlink, X, Activity } from 'lucide-react';

interface Team {
  id: string;
  name: string;
  created_at: string;
}

interface Manager {
  id: string;
  user_id: string;
  role: string;
  team_id: string | null;
  created_at: string;
  email?: string;
  name?: string;
  team_name?: string;
}

interface Viewer {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email?: string;
  name?: string;
}

interface ViewerGrant {
  id: string;
  viewer_user_id: string;
  manager_user_id: string;
  can_view_activities: boolean;
  can_assign_activities: boolean;
  resolved_team_id?: string | null;
}

interface SuperAdminDashboardProps {
  userEmail: string;
  onLogout: () => void;
  embedded?: boolean;
}

type Tab = 'managers' | 'teams' | 'viewers';

export default function SuperAdminDashboard({ userEmail, onLogout, embedded = false }: SuperAdminDashboardProps) {
  const [tab, setTab] = useState<Tab>('managers');
  const [teams, setTeams] = useState<Team[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [viewerGrants, setViewerGrants] = useState<ViewerGrant[]>([]);
  const [loading, setLoading] = useState(true);

  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [savingTeam, setSavingTeam] = useState(false);

  const [showNewManager, setShowNewManager] = useState(false);
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerTeamId, setManagerTeamId] = useState('');
  const [savingManager, setSavingManager] = useState(false);
  const [managerError, setManagerError] = useState('');

  const [showNewViewer, setShowNewViewer] = useState(false);
  const [viewerEmail, setViewerEmail] = useState('');
  const [viewerPassword, setViewerPassword] = useState('');
  const [viewerName, setViewerName] = useState('');
  const [savingViewer, setSavingViewer] = useState(false);
  const [viewerError, setViewerError] = useState('');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [teamsRes, rolesRes, grantsRes] = await Promise.all([
      supabase.from('teams').select('*').order('created_at', { ascending: false }),
      supabase.from('app_roles').select('*').order('created_at', { ascending: false }),
      supabase.from('viewer_grants').select('id, viewer_user_id, manager_user_id, can_view_activities, can_assign_activities, resolved_team_id'),
    ]);

    const teamsData: Team[] = teamsRes.data || [];
    setTeams(teamsData);
    setViewerGrants(grantsRes.data || []);

    const allRoles = rolesRes.data || [];
    // Managers = role 'manager' or 'super_admin' (super_admin can also be a grantable manager)
    const rawManagers: Manager[] = allRoles.filter((r: any) => r.role === 'manager' || r.role === 'super_admin');
    const rawViewers: Viewer[] = allRoles.filter((r: any) => r.role === 'viewer');

    const userIds = allRoles.map((r: any) => r.user_id);
    let membersByUserId: Record<string, { email: string; name: string; team_id: string }[]> = {};
    if (userIds.length > 0) {
      const { data: members } = await supabase
        .from('team_members')
        .select('user_id, email, name, team_id')
        .in('user_id', userIds);
      (members || []).forEach((m: any) => {
        if (!m.user_id) return;
        if (!membersByUserId[m.user_id]) membersByUserId[m.user_id] = [];
        membersByUserId[m.user_id].push({ email: m.email, name: m.name, team_id: m.team_id });
      });
    }

    const enrichedManagers = rawManagers.map((m: any) => {
      const memberList = membersByUserId[m.user_id] ?? [];
      // Prefer member record matching app_roles.team_id; fallback to first
      const member = memberList.find(mb => mb.team_id === m.team_id) ?? memberList[0];
      // For super_admin without team_id, use their team from team_members
      const effectiveTeamId = m.team_id ?? member?.team_id ?? null;
      const team = teamsData.find(t => t.id === effectiveTeamId);
      return {
        ...m,
        email: member?.email || '',
        name: member?.name || m.display_name || '',
        team_id: effectiveTeamId,
        team_name: team?.name || 'Sin equipo',
      };
    });
    setManagers(enrichedManagers);

    const enrichedViewers = rawViewers.map((v: any) => {
      const memberList = membersByUserId[v.user_id] ?? [];
      const member = memberList[0];
      return { ...v, email: member?.email || '', name: member?.name || v.display_name || 'Visor' };
    });
    setViewers(enrichedViewers);
    setLoading(false);
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setSavingTeam(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('teams')
        .insert({ name: newTeamName.trim(), created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      setTeams([data, ...teams]);
      setNewTeamName('');
      setShowNewTeam(false);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSavingTeam(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('¿Eliminar este equipo? Se eliminarán todas sus actividades y colaboradores.')) return;
    await supabase.from('teams').delete().eq('id', teamId);
    setTeams(teams.filter(t => t.id !== teamId));
    setManagers(managers.map(m => m.team_id === teamId ? { ...m, team_id: null, team_name: 'Sin equipo' } : m));
  };

  const handleCreateManager = async () => {
    if (!managerEmail.trim() || !managerPassword.trim() || !managerName.trim()) {
      setManagerError('Completa todos los campos');
      return;
    }
    setSavingManager(true);
    setManagerError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          email: managerEmail.trim(),
          password: managerPassword.trim(),
          name: managerName.trim(),
          teamId: managerTeamId || null,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al crear gestor');

      setManagerEmail('');
      setManagerPassword('');
      setManagerName('');
      setManagerTeamId('');
      setShowNewManager(false);
      await loadAll();
    } catch (err: any) {
      setManagerError(err.message || 'Error desconocido');
    } finally {
      setSavingManager(false);
    }
  };

  const handleCreateViewer = async () => {
    if (!viewerEmail.trim() || !viewerPassword.trim() || !viewerName.trim()) {
      setViewerError('Completa todos los campos');
      return;
    }
    setSavingViewer(true);
    setViewerError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          email: viewerEmail.trim(),
          password: viewerPassword.trim(),
          name: viewerName.trim(),
          role: 'viewer',
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Error al crear visor');
      setViewerEmail('');
      setViewerPassword('');
      setViewerName('');
      setShowNewViewer(false);
      await loadAll();
    } catch (err: any) {
      setViewerError(err.message || 'Error desconocido');
    } finally {
      setSavingViewer(false);
    }
  };

  const handleDeleteViewer = async (viewer: Viewer) => {
    if (!confirm(`¿Eliminar al visor ${viewer.email || viewer.user_id}? Perderá acceso al sistema.`)) return;
    await supabase.from('viewer_grants').delete().eq('viewer_user_id', viewer.user_id);
    await supabase.from('app_roles').delete().eq('id', viewer.id);
    setViewers(viewers.filter(v => v.id !== viewer.id));
    setViewerGrants(viewerGrants.filter(g => g.viewer_user_id !== viewer.user_id));
  };

  const toggleGrant = async (viewerUserId: string, managerUserId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const existing = viewerGrants.find(g => g.viewer_user_id === viewerUserId && g.manager_user_id === managerUserId);
    if (existing) {
      await supabase.from('viewer_grants').delete().eq('id', existing.id);
      setViewerGrants(prev => prev.filter(g => g.id !== existing.id));
    } else {
      // For managers without app_roles.team_id (super_admin), resolve team from their team_members record
      const mgr = managers.find(m => m.user_id === managerUserId);
      const resolvedTeamId = mgr?.team_id || null;
      const { data } = await supabase.from('viewer_grants')
        .insert({
          viewer_user_id: viewerUserId,
          manager_user_id: managerUserId,
          granted_by: user!.id,
          can_view_activities: true,
          can_assign_activities: false,
          resolved_team_id: resolvedTeamId,
        })
        .select()
        .single();
      if (data) setViewerGrants(prev => [...prev, data]);
    }
  };

  const toggleGrantPermission = async (grantId: string, field: 'can_view_activities' | 'can_assign_activities', current: boolean) => {
    await supabase.from('viewer_grants').update({ [field]: !current }).eq('id', grantId);
    setViewerGrants(prev => prev.map(g => g.id === grantId ? { ...g, [field]: !current } : g));
  };

  const handleDeleteManager = async (manager: Manager) => {
    if (!confirm(`¿Eliminar al gestor ${manager.email}? Perderá acceso al sistema.`)) return;
    await supabase.from('app_roles').delete().eq('id', manager.id);
    setManagers(managers.filter(m => m.id !== manager.id));
  };

  const handleChangeTeam = async (managerId: string, teamId: string) => {
    const teamIdVal = teamId || null;
    await supabase.from('app_roles').update({ team_id: teamIdVal }).eq('id', managerId);
    const team = teams.find(t => t.id === teamId);
    setManagers(managers.map(m =>
      m.id === managerId ? { ...m, team_id: teamIdVal, team_name: team?.name || 'Sin equipo' } : m
    ));
  };

  const content = (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
            <Building2 size={20} className="text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{teams.length}</p>
            <p className="text-slate-400 text-sm">Equipos</p>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-600/20 rounded-lg flex items-center justify-center">
            <UserCheck size={20} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{managers.length}</p>
            <p className="text-slate-400 text-sm">Gestores</p>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-teal-600/20 rounded-lg flex items-center justify-center">
            <Eye size={20} className="text-teal-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{viewers.length}</p>
            <p className="text-slate-400 text-sm">Visores</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('managers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'managers' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
          <Users size={15} />Gestores
        </button>
        <button onClick={() => setTab('teams')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'teams' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
          <Building2 size={15} />Equipos
        </button>
        <button onClick={() => setTab('viewers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition ${tab === 'viewers' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'}`}>
          <Eye size={15} />Visores
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : (
        <>
          {/* Managers tab */}
          {tab === 'managers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Gestores del sistema</h2>
                <button
                  onClick={() => { setShowNewManager(!showNewManager); setManagerError(''); }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition"
                >
                  <Plus size={16} />
                  Nuevo Gestor
                </button>
              </div>

              {showNewManager && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
                  <h3 className="font-semibold text-white">Crear cuenta de Gestor</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Nombre completo *</label>
                      <input
                        type="text"
                        value={managerName}
                        onChange={e => setManagerName(e.target.value)}
                        placeholder="Juan Pérez"
                        className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Correo electrónico *</label>
                      <input
                        type="email"
                        value={managerEmail}
                        onChange={e => setManagerEmail(e.target.value)}
                        placeholder="gestor@empresa.com"
                        className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Contraseña *</label>
                      <input
                        type="password"
                        value={managerPassword}
                        onChange={e => setManagerPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Equipo asignado</label>
                      <div className="relative">
                        <select
                          value={managerTeamId}
                          onChange={e => setManagerTeamId(e.target.value)}
                          className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500 appearance-none"
                        >
                          <option value="">Sin equipo por ahora</option>
                          {teams.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                  {managerError && <p className="text-red-400 text-sm">{managerError}</p>}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={handleCreateManager}
                      disabled={savingManager}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-sm font-medium py-2 rounded-lg transition"
                    >
                      {savingManager ? 'Creando...' : 'Crear Gestor'}
                    </button>
                    <button
                      onClick={() => setShowNewManager(false)}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium py-2 rounded-lg transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {managers.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center">
                  <Users size={32} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No hay gestores creados aún</p>
                  <p className="text-slate-500 text-sm mt-1">Crea un gestor para que administre su equipo</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {managers.map(manager => (
                    <div key={manager.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
                      <div className="w-9 h-9 bg-emerald-600/20 rounded-full flex items-center justify-center shrink-0">
                        <Mail size={16} className="text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{manager.name || manager.email}</p>
                        <p className="text-slate-400 text-xs truncate">{manager.email}</p>
                      </div>
                      <div className="shrink-0 relative">
                        <select
                          value={manager.team_id || ''}
                          onChange={e => handleChangeTeam(manager.id, e.target.value)}
                          className="bg-slate-700 border border-slate-600 text-white text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-blue-500 appearance-none pr-6 max-w-[140px]"
                        >
                          <option value="">Sin equipo</option>
                          {teams.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      <button
                        onClick={() => handleDeleteManager(manager)}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition shrink-0"
                        title="Eliminar gestor"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Viewers tab */}
          {tab === 'viewers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Visores de proyectos</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Los visores solo pueden ver la bitácora de proyectos de los gestores que les asignes.</p>
                </div>
                <button onClick={() => { setShowNewViewer(!showNewViewer); setViewerError(''); }}
                  className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-2 rounded-lg transition">
                  <Plus size={16} />Nuevo Visor
                </button>
              </div>

              {showNewViewer && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
                  <h3 className="font-semibold text-white flex items-center gap-2"><Eye size={15} className="text-teal-400" />Crear cuenta de Visor</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Nombre completo *</label>
                      <input type="text" value={viewerName} onChange={e => setViewerName(e.target.value)}
                        placeholder="Juan Pérez"
                        className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-teal-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Correo electrónico *</label>
                      <input type="email" value={viewerEmail} onChange={e => setViewerEmail(e.target.value)}
                        placeholder="visor@empresa.com"
                        className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-teal-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1.5">Contraseña *</label>
                      <input type="password" value={viewerPassword} onChange={e => setViewerPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-teal-500" />
                    </div>
                  </div>
                  {viewerError && <p className="text-red-400 text-sm">{viewerError}</p>}
                  <div className="flex gap-3 pt-1">
                    <button onClick={handleCreateViewer} disabled={savingViewer}
                      className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 text-white text-sm font-medium py-2 rounded-lg transition">
                      {savingViewer ? 'Creando...' : 'Crear Visor'}
                    </button>
                    <button onClick={() => setShowNewViewer(false)}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium py-2 rounded-lg transition">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {viewers.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center">
                  <Eye size={32} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No hay visores creados aún</p>
                  <p className="text-slate-500 text-sm mt-1">Los visores pueden ver proyectos de gestores específicos en modo lectura</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {viewers.map(viewer => {
                    const grants = viewerGrants.filter(g => g.viewer_user_id === viewer.user_id);
                    const grantedManagerIds = new Set(grants.map(g => g.manager_user_id));
                    return (
                      <div key={viewer.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                        {/* Viewer header */}
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/60">
                          <div className="w-9 h-9 bg-teal-600/20 rounded-full flex items-center justify-center shrink-0">
                            <Eye size={15} className="text-teal-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium text-sm">{viewer.name}</p>
                            <p className="text-slate-400 text-xs">{viewer.email}</p>
                          </div>
                          <span className="text-xs text-teal-400 bg-teal-500/10 border border-teal-500/30 px-2 py-0.5 rounded font-medium">
                            {grants.length} gestor{grants.length !== 1 ? 'es' : ''} asignado{grants.length !== 1 ? 's' : ''}
                          </span>
                          <button onClick={() => handleDeleteViewer(viewer)}
                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition shrink-0">
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {/* Manager grant toggles */}
                        <div className="px-4 py-3 space-y-3">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Acceso por gestor:</p>
                          {managers.length === 0 ? (
                            <p className="text-slate-600 text-xs italic">No hay gestores en el sistema.</p>
                          ) : (
                            <div className="space-y-2">
                              {managers.map(mgr => {
                                const grant = grants.find(g => g.manager_user_id === mgr.user_id);
                                const hasGrant = !!grant;
                                return (
                                  <div key={mgr.user_id} className="flex items-center gap-2 flex-wrap">
                                    {/* Toggle access on/off */}
                                    <button
                                      onClick={() => toggleGrant(viewer.user_id, mgr.user_id)}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition min-w-[120px] ${
                                        hasGrant
                                          ? 'bg-teal-500/15 border-teal-500/50 text-teal-300'
                                          : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white hover:border-slate-500'
                                      }`}
                                    >
                                      {hasGrant ? <Link size={11} /> : <Unlink size={11} />}
                                      {mgr.name || mgr.email}
                                      {mgr.team_name && mgr.team_name !== 'Sin equipo' && (
                                        <span className="opacity-60 font-normal">· {mgr.team_name}</span>
                                      )}
                                    </button>
                                    {/* Per-permission toggles (only when grant exists) */}
                                    {hasGrant && grant && (
                                      <>
                                        <button
                                          onClick={() => toggleGrantPermission(grant.id, 'can_view_activities', grant.can_view_activities)}
                                          title="Ver actividades"
                                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                                            grant.can_view_activities
                                              ? 'bg-blue-500/15 border-blue-500/50 text-blue-300'
                                              : 'bg-slate-700 border-slate-600 text-slate-500 hover:text-slate-300'
                                          }`}
                                        >
                                          <Activity size={10} />
                                          Actividades
                                        </button>
                                        <button
                                          onClick={() => toggleGrantPermission(grant.id, 'can_assign_activities', grant.can_assign_activities)}
                                          title="Asignar actividades"
                                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                                            grant.can_assign_activities
                                              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                                              : 'bg-slate-700 border-slate-600 text-slate-500 hover:text-slate-300'
                                          }`}
                                        >
                                          <UserCheck size={10} />
                                          Asignar
                                        </button>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cross-manager visibility section */}
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-px flex-1 bg-slate-700" />
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-2">Acceso cruzado entre gestores</p>
                  <div className="h-px flex-1 bg-slate-700" />
                </div>
                <p className="text-slate-500 text-xs mb-4">Permite que un gestor vea los proyectos de otro gestor.</p>
                {managers.length < 2 ? (
                  <p className="text-slate-600 text-xs italic">Se necesitan al menos 2 gestores para configurar acceso cruzado.</p>
                ) : (
                  <div className="space-y-3">
                    {managers.map(mgr => {
                      const crossGrants = viewerGrants.filter(g => g.viewer_user_id === mgr.user_id);
                      const grantedIds = new Set(crossGrants.map(g => g.manager_user_id));
                      const otherManagers = managers.filter(m => m.user_id !== mgr.user_id);
                      return (
                        <div key={mgr.id} className="bg-slate-800 border border-slate-700/80 rounded-xl px-4 py-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-6 h-6 bg-emerald-600/20 rounded-full flex items-center justify-center shrink-0">
                              <UserCheck size={11} className="text-emerald-400" />
                            </div>
                            <p className="text-white text-sm font-medium">{mgr.name || mgr.email}</p>
                            <span className="text-slate-500 text-xs">puede ver proyectos de:</span>
                          </div>
                          <div className="flex flex-wrap gap-2 pl-8">
                            {otherManagers.map(other => {
                              const hasAccess = grantedIds.has(other.user_id);
                              return (
                                <button key={other.user_id}
                                  onClick={() => toggleGrant(mgr.user_id, other.user_id)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                                    hasAccess
                                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                                      : 'bg-slate-700 border-slate-600 text-slate-400 hover:text-white hover:border-slate-500'
                                  }`}
                                >
                                  {hasAccess ? <Link size={11} /> : <Unlink size={11} />}
                                  {other.name || other.email}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Teams tab */}
          {tab === 'teams' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Equipos de trabajo</h2>
                <button
                  onClick={() => setShowNewTeam(!showNewTeam)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition"
                >
                  <Plus size={16} />
                  Nuevo Equipo
                </button>
              </div>

              {showNewTeam && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
                  <h3 className="font-semibold text-white">Crear Equipo</h3>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Nombre del equipo *</label>
                    <input
                      type="text"
                      value={newTeamName}
                      onChange={e => setNewTeamName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateTeam()}
                      placeholder="Backend, Frontend, Design..."
                      className="w-full bg-slate-700 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCreateTeam}
                      disabled={savingTeam || !newTeamName.trim()}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-sm font-medium py-2 rounded-lg transition"
                    >
                      {savingTeam ? 'Creando...' : 'Crear Equipo'}
                    </button>
                    <button
                      onClick={() => setShowNewTeam(false)}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium py-2 rounded-lg transition"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {teams.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-10 text-center">
                  <Building2 size={32} className="text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No hay equipos creados aún</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {teams.map(team => {
                    const assignedManagers = managers.filter(m => m.team_id === team.id);
                    return (
                      <div key={team.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-4">
                        <div className="w-9 h-9 bg-blue-600/20 rounded-lg flex items-center justify-center shrink-0">
                          <Building2 size={16} className="text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium">{team.name}</p>
                          <p className="text-slate-400 text-xs mt-0.5">
                            {assignedManagers.length > 0
                              ? `Gestor: ${assignedManagers.map(m => m.name || m.email).join(', ')}`
                              : 'Sin gestor asignado'}
                          </p>
                        </div>
                        <p className="text-slate-500 text-xs shrink-0">
                          {new Date(team.created_at).toLocaleDateString('es-ES')}
                        </p>
                        <button
                          onClick={() => handleDeleteTeam(team.id)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition shrink-0"
                          title="Eliminar equipo"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900">
      <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-none">Activity Manager</h1>
            <p className="text-slate-500 text-xs">Panel de Administración</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm text-slate-300 leading-none">{userEmail}</p>
            <p className="text-xs text-amber-400 mt-0.5 font-medium">Super Admin</p>
          </div>
          <button onClick={onLogout} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition">
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <div className="max-w-4xl mx-auto p-6">{content}</div>
    </div>
  );
}
