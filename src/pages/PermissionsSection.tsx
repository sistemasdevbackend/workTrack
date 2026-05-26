import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldCheck, ChevronDown, ChevronUp, RefreshCw, Check, X, Info, Bell, BellOff, Users } from 'lucide-react';
import type { FeatureSlug } from '../lib/useMemberPermissions';

interface Props {
  teamId: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  position: string;
}

interface PermRow {
  feature: FeatureSlug;
  enabled: boolean;
}

// ─── Feature definitions ─────────────────────────────────────────────────────

interface FeatureDef {
  slug: FeatureSlug;
  label: string;
  description: string;
  category: string;
  defaultFor: (position: string) => boolean;
}

const FEATURES: FeatureDef[] = [
  {
    slug: 'create_activity_becario',
    label: 'Crear actividades para becarios',
    description: 'Puede crear nuevas actividades y asignarlas a miembros con posición Becario.',
    category: 'Actividades',
    defaultFor: p => p.toLowerCase() !== 'becario',
  },
  {
    slug: 'create_activity_developer',
    label: 'Crear actividades para colaboradores',
    description: 'Puede crear nuevas actividades y asignarlas a Developers, Diseñadores y otros roles.',
    category: 'Actividades',
    defaultFor: p => p.toLowerCase() !== 'becario',
  },
  {
    slug: 'move_to_testing',
    label: 'Mover actividades a Pruebas',
    description: 'Puede cambiar el estado de una actividad a "En Pruebas" (Testing).',
    category: 'Actividades',
    defaultFor: () => true,
  },
  {
    slug: 'send_to_review',
    label: 'Enviar actividades a revisión',
    description: 'Puede marcar una actividad como completada y enviarla al gestor para revisión.',
    category: 'Actividades',
    defaultFor: () => true,
  },
  {
    slug: 'view_changelog',
    label: 'Ver Control de Cambios',
    description: 'Puede acceder a la pestaña de Control de Cambios en su vista.',
    category: 'Control de Cambios',
    defaultFor: p => p.toLowerCase() !== 'becario',
  },
  {
    slug: 'add_changelog',
    label: 'Crear entradas de Control de Cambios',
    description: 'Puede registrar nuevas entradas de liberación (releases) en el Control de Cambios.',
    category: 'Control de Cambios',
    defaultFor: p => p.toLowerCase() !== 'becario',
  },
  {
    slug: 'add_documentation',
    label: 'Agregar / editar documentación',
    description: 'Puede crear y modificar entradas en la sección de Documentación técnica.',
    category: 'Documentación',
    defaultFor: p => p.toLowerCase() !== 'becario',
  },
  {
    slug: 'delete_activity',
    label: 'Eliminar actividades',
    description: 'Puede borrar permanentemente sus propias actividades. Por defecto desactivado para todos los roles.',
    category: 'Actividades',
    defaultFor: () => false,
  },
  {
    slug: 'view_intern_activities',
    label: 'Ver actividades de becarios',
    description: 'Puede ver las actividades asignadas a miembros con posición Becario en su vista de equipo. Por defecto desactivado para becarios.',
    category: 'Actividades',
    defaultFor: p => p.toLowerCase() !== 'becario',
  },
];

const CATEGORIES = [...new Set(FEATURES.map(f => f.category))];

const POSITION_STYLES: Record<string, string> = {
  Developer:  'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Diseñador:  'bg-pink-500/20 text-pink-300 border-pink-500/30',
  Becario:    'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Admin:      'bg-green-500/20 text-green-300 border-green-500/30',
  QA:         'bg-orange-500/20 text-orange-300 border-orange-500/30',
  PM:         'bg-teal-500/20 text-teal-300 border-teal-500/30',
  DevOps:     'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Arquitecto: 'bg-slate-400/20 text-slate-200 border-slate-400/30',
};

// ─── Notification type definitions ───────────────────────────────────────────

const NOTIF_TYPES = [
  { type: 'ACTIVITY_CREATED',  label: 'Nueva actividad asignada' },
  { type: 'ACTIVITY_UPDATED',  label: 'Actividad actualizada' },
  { type: 'ACTIVITY_APPROVED', label: 'Actividad aprobada' },
  { type: 'ACTIVITY_REJECTED', label: 'Actividad devuelta' },
  { type: 'REVIEW_REQUESTED',  label: 'Solicitud de revision' },
  { type: 'CHANGELOG_LINKED',  label: 'Control de cambios vinculado' },
  { type: 'DOC_CREATED',       label: 'Nueva documentacion' },
] as const;

type NotifType = typeof NOTIF_TYPES[number]['type'];

// ─── Notification Preferences Panel ──────────────────────────────────────────

function NotifPrefsPanel({ member, teamMembers }: { member: Member; teamMembers: Member[] }) {
  // typePrefs: notif_type -> enabled (source_member_id IS NULL rows)
  const [typePrefs, setTypePrefs] = useState<Record<NotifType, boolean>>({} as any);
  // sourcePrefs: source_member_id -> enabled (for rows where notif_type IS NULL equivalent – we use a special key)
  const [sourcePrefs, setSourcePrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const otherMembers = teamMembers.filter(m => m.id !== member.id);

  const loadPrefs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('notification_preferences')
      .select('notif_type, source_member_id, enabled')
      .eq('team_member_id', member.id);

    const tPrefs = {} as Record<NotifType, boolean>;
    NOTIF_TYPES.forEach(({ type }) => { tPrefs[type] = true; });

    const sPrefs: Record<string, boolean> = {};

    (data ?? []).forEach((r: any) => {
      if (!r.source_member_id) {
        // type-level pref
        tPrefs[r.notif_type as NotifType] = r.enabled;
      } else if (!r.notif_type) {
        // source-level pref (all types from this source)
        sPrefs[r.source_member_id] = r.enabled;
      }
    });

    setTypePrefs(tPrefs);
    setSourcePrefs(sPrefs);
    setLoading(false);
  }, [member.id]);

  useEffect(() => { loadPrefs(); }, [loadPrefs]);

  const toggleType = async (type: NotifType) => {
    const newVal = !typePrefs[type];
    setTypePrefs(p => ({ ...p, [type]: newVal }));
    setSaving(type);
    await supabase
      .from('notification_preferences')
      .upsert(
        { team_member_id: member.id, notif_type: type, source_member_id: null, enabled: newVal },
        { onConflict: 'team_member_id,notif_type,source_member_id' }
      );
    setSaving(null);
  };

  const toggleSource = async (sourceMemberId: string) => {
    const current = sourcePrefs[sourceMemberId] !== false; // default true
    const newVal = !current;
    setSourcePrefs(p => ({ ...p, [sourceMemberId]: newVal }));
    setSaving('src_' + sourceMemberId);

    // Use notif_type = 'ALL_TYPES' as a sentinel for source-level prefs
    await supabase
      .from('notification_preferences')
      .upsert(
        { team_member_id: member.id, notif_type: 'ALL_TYPES', source_member_id: sourceMemberId, enabled: newVal },
        { onConflict: 'team_member_id,notif_type,source_member_id' }
      );
    setSaving(null);
  };

  if (loading) {
    return <div className="py-4 text-center text-xs text-slate-400">Cargando...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Type-level prefs */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <Bell size={11} />Tipos de notificacion
        </p>
        <div className="bg-slate-900/60 rounded-xl border border-slate-700/60 overflow-hidden">
          {NOTIF_TYPES.map(({ type, label }, idx) => {
            const enabled = typePrefs[type] ?? true;
            const isSaving = saving === type;
            return (
              <div
                key={type}
                className={`flex items-center gap-3 px-3 py-2.5 ${idx !== NOTIF_TYPES.length - 1 ? 'border-b border-slate-700/40' : ''}`}
              >
                <div className={`shrink-0 ${enabled ? 'text-emerald-400' : 'text-slate-600'}`}>
                  {enabled ? <Bell size={12} /> : <BellOff size={12} />}
                </div>
                <p className={`flex-1 text-xs ${enabled ? 'text-slate-200' : 'text-slate-500'}`}>{label}</p>
                {isSaving && <svg className="animate-spin h-3 w-3 text-slate-400 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
                <Toggle enabled={enabled} onChange={() => toggleType(type)} disabled={!!saving} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Source-level prefs */}
      {otherMembers.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Users size={11} />Notificaciones de colaboradores
          </p>
          <p className="text-[11px] text-slate-500 mb-2 leading-snug">
            Controla si este miembro recibe notificaciones generadas por las acciones de otros colaboradores.
          </p>
          <div className="bg-slate-900/60 rounded-xl border border-slate-700/60 overflow-hidden">
            {otherMembers.map((src, idx) => {
              const enabled = sourcePrefs[src.id] !== false;
              const isSaving = saving === 'src_' + src.id;
              return (
                <div
                  key={src.id}
                  className={`flex items-center gap-3 px-3 py-2.5 ${idx !== otherMembers.length - 1 ? 'border-b border-slate-700/40' : ''}`}
                >
                  <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {src.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${enabled ? 'text-slate-200' : 'text-slate-500'}`}>{src.name}</p>
                    <p className="text-[10px] text-slate-600">{src.position}</p>
                  </div>
                  {isSaving && <svg className="animate-spin h-3 w-3 text-slate-400 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
                  <Toggle enabled={enabled} onChange={() => toggleSource(src.id)} disabled={!!saving} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Toggle component ─────────────────────────────────────────────────────────

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${enabled ? 'bg-emerald-500' : 'bg-slate-600'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── Member Permission Card ───────────────────────────────────────────────────

function MemberPermCard({ member, teamId, teamMembers }: { member: Member; teamId: string; teamMembers: Member[] }) {
  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel] = useState<'perms' | 'notifs'>('perms');
  const [perms, setPerms] = useState<Record<FeatureSlug, boolean>>({} as any);
  const [saving, setSaving] = useState<FeatureSlug | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadPerms = useCallback(async () => {
    const { data } = await supabase
      .from('member_permissions')
      .select('feature, enabled')
      .eq('team_member_id', member.id);

    const posKey = member.position.toLowerCase();
    const map: Record<FeatureSlug, boolean> = {} as any;

    FEATURES.forEach(f => {
      map[f.slug] = f.defaultFor(posKey);
    });

    (data ?? []).forEach((row: PermRow) => {
      if (row.feature in map) map[row.feature as FeatureSlug] = row.enabled;
    });

    setPerms(map);
    setLoaded(true);
  }, [member.id, member.position]);

  useEffect(() => {
    if (expanded && !loaded) loadPerms();
  }, [expanded, loaded, loadPerms]);

  const handleToggle = async (slug: FeatureSlug, value: boolean) => {
    setSaving(slug);
    setPerms(prev => ({ ...prev, [slug]: value }));

    await supabase.from('member_permissions').upsert(
      { team_member_id: member.id, feature: slug, enabled: value, updated_at: new Date().toISOString() },
      { onConflict: 'team_member_id,feature' }
    );

    setSaving(null);
  };

  const resetToDefaults = async () => {
    setSaving('move_to_testing'); // any slug just to show loading
    const posKey = member.position.toLowerCase();
    const defaults = FEATURES.map(f => ({
      team_member_id: member.id,
      feature: f.slug,
      enabled: f.defaultFor(posKey),
      updated_at: new Date().toISOString(),
    }));

    await supabase.from('member_permissions').upsert(defaults, { onConflict: 'team_member_id,feature' });
    await loadPerms();
    setSaving(null);
  };

  const posStyle = POSITION_STYLES[member.position] ?? 'bg-slate-600/20 text-slate-300 border-slate-500/30';

  // Count enabled vs total
  const enabledCount = loaded ? Object.values(perms).filter(Boolean).length : null;

  return (
    <div className={`bg-slate-800 border rounded-xl overflow-hidden transition ${expanded ? 'border-blue-500/40' : 'border-slate-700 hover:border-slate-600'}`}>
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center shrink-0 text-sm font-bold text-white">
          {member.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm">{member.name}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${posStyle}`}>{member.position || 'Sin posición'}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 truncate">{member.email}</p>
        </div>

        {loaded && (
          <div className="text-right shrink-0 mr-2">
            <p className="text-xs text-slate-400">{enabledCount} / {FEATURES.length}</p>
            <p className="text-[10px] text-slate-600 mt-0.5">permisos activos</p>
          </div>
        )}

        <div className="text-slate-500 shrink-0">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-slate-700">
          {/* Sub-tabs */}
          <div className="flex border-b border-slate-700/60 px-5">
            <button
              type="button"
              onClick={() => setPanel('perms')}
              className={`flex items-center gap-1.5 py-2.5 px-1 text-xs font-semibold border-b-2 mr-4 transition ${
                panel === 'perms' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <ShieldCheck size={12} />Permisos
            </button>
            <button
              type="button"
              onClick={() => setPanel('notifs')}
              className={`flex items-center gap-1.5 py-2.5 px-1 text-xs font-semibold border-b-2 transition ${
                panel === 'notifs' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <Bell size={12} />Notificaciones
            </button>
          </div>

          <div className="px-5 pb-5 pt-4">
            {panel === 'notifs' ? (
              <NotifPrefsPanel member={member} teamMembers={teamMembers} />
            ) : (
              <div className="space-y-5">
                {/* Reset defaults btn */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Info size={11} />
                    Configura qué funcionalidades puede usar este miembro
                  </p>
                  <button
                    type="button"
                    onClick={resetToDefaults}
                    disabled={!!saving}
                    className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw size={11} />
                    Restaurar predeterminados
                  </button>
                </div>

                {CATEGORIES.map(cat => {
                  const catFeatures = FEATURES.filter(f => f.category === cat);
                  return (
                    <div key={cat}>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">{cat}</p>
                      <div className="space-y-2.5">
                        {catFeatures.map(feat => {
                          const isEnabled = perms[feat.slug] ?? feat.defaultFor(member.position.toLowerCase());
                          const isSavingThis = saving === feat.slug;
                          return (
                            <div
                              key={feat.slug}
                              className={`flex items-start gap-4 p-3 rounded-xl border transition ${
                                isEnabled ? 'bg-slate-700/40 border-slate-700' : 'bg-slate-800/60 border-slate-700/50 opacity-70'
                              }`}
                            >
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold leading-snug ${isEnabled ? 'text-white' : 'text-slate-400'}`}>
                                  {feat.label}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{feat.description}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                                {isSavingThis && (
                                  <svg className="animate-spin h-3.5 w-3.5 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                                  </svg>
                                )}
                                <Toggle
                                  enabled={isEnabled}
                                  onChange={v => handleToggle(feat.slug, v)}
                                  disabled={!!saving}
                                />
                              </div>
                            </div>
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
    </div>
  );
}

// ─── Main Section ─────────────────────────────────────────────────────────────

export default function PermissionsSection({ teamId }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPos, setFilterPos] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('team_members')
      .select('id, name, email, position')
      .eq('team_id', teamId)
      .order('name');
    setMembers(data ?? []);
    setLoading(false);
  }, [teamId]);

  useEffect(() => { load(); }, [load]);

  const positions = [...new Set(members.map(m => m.position).filter(Boolean))].sort();

  const filtered = members.filter(m => {
    if (filterPos !== 'ALL' && m.position !== filterPos) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-500/20 rounded-xl border border-blue-500/30">
            <ShieldCheck size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-none">Permisos de Colaboradores</h2>
            <p className="text-slate-400 text-sm mt-0.5">Gestiona qué funcionalidades puede usar cada miembro del equipo</p>
          </div>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition" title="Recargar">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 flex items-start gap-3">
        <Info size={15} className="text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-300 space-y-1">
          <p>Los permisos se aplican individualmente por colaborador y anulan el comportamiento predeterminado basado en posición.</p>
          <p className="text-slate-500 text-xs">Al restaurar predeterminados: Becarios tienen acceso limitado; otros roles tienen acceso completo.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {positions.slice(0, 4).map(pos => {
          const count = members.filter(m => m.position === pos).length;
          const style = POSITION_STYLES[pos] ?? 'bg-slate-600/20 text-slate-300 border-slate-500/30';
          return (
            <div key={pos} className={`rounded-xl p-3 border ${style}`}>
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{pos}</p>
              <p className="text-2xl font-bold mt-1">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o email..."
          className="flex-1 min-w-40 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={filterPos}
          onChange={e => setFilterPos(e.target.value)}
          style={{ colorScheme: 'dark' }}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="ALL" className="bg-slate-800">Todas las posiciones</option>
          {positions.map(p => <option key={p} value={p} className="bg-slate-800">{p}</option>)}
        </select>
      </div>

      {/* Member list */}
      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-slate-800/40 rounded-xl border border-slate-700 border-dashed">
          <ShieldCheck size={36} className="mx-auto mb-2 opacity-20" />
          <p className="text-sm">No se encontraron colaboradores</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Quick summary legend */}
          <div className="flex items-center gap-4 text-xs text-slate-500 pb-1">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Permiso activo</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-600 inline-block" /> Permiso inactivo</span>
            <span className="text-slate-600">· Haz clic en un miembro para gestionar sus permisos</span>
          </div>
          {filtered.map(m => (
            <MemberPermCard key={m.id} member={m} teamId={teamId} teamMembers={members} />
          ))}
        </div>
      )}

      {/* Quick actions section */}
      {!loading && filtered.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Acciones rápidas por posición</p>
          <div className="flex flex-wrap gap-2">
            {positions.map(pos => (
              <button
                key={pos}
                type="button"
                onClick={async () => {
                  const posMembers = members.filter(m => m.position === pos);
                  for (const m of posMembers) {
                    const posKey = pos.toLowerCase();
                    const defaults = FEATURES.map(f => ({
                      team_member_id: m.id,
                      feature: f.slug,
                      enabled: f.defaultFor(posKey),
                      updated_at: new Date().toISOString(),
                    }));
                    await supabase.from('member_permissions').upsert(defaults, { onConflict: 'team_member_id,feature' });
                  }
                  load();
                }}
                className={`text-xs px-3 py-1.5 rounded-lg border transition hover:opacity-80 ${POSITION_STYLES[pos] ?? 'bg-slate-600/20 text-slate-300 border-slate-500/30'}`}
              >
                Restaurar defaults — {pos} ({members.filter(m => m.position === pos).length})
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-600 mt-2">Restaura los permisos predeterminados para todos los miembros de esa posición a la vez.</p>
        </div>
      )}
    </div>
  );
}
