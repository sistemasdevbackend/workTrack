import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronLeft, ChevronRight, Home, Palmtree, X, Plus, Check, CalendarClock, UserCog, Shield, Pencil, Trash2, Clock, ChevronDown, ChevronUp, ZoomIn, CheckCheck, AlertTriangle, Download } from 'lucide-react';

interface CalendarSectionProps {
  teamId: string;
  managerMemberId?: string;
  readOnly?: boolean;
}

interface Member {
  id: string;
  name: string;
  email: string;
  position: string;
}

interface HoEntry {
  id: string;
  team_member_id: string;
  date: string;
}

interface VacationDay {
  id: string;
  team_member_id: string;
  date: string;
  note: string;
}

interface ActivityDeadline {
  id: string;
  team_member_id: string;
  title: string;
  end_date: string;
  priority: string;
  status: string;
  project: string | null;
  is_manager?: boolean;
}

interface GuardSchedule {
  id: string;
  team_id: string;
  team_member_id: string;
  member_name: string;
  date: string;
  start_time: string;
  end_time: string;
  color: string | null;
}

interface GuardReport {
  id: string;
  guard_schedule_id: string;
  team_member_id: string;
  member_name: string;
  checkpoint: string;
  status: string;
  project_notes: string;
  observations: string;
  affected_systems: string;
  image_urls: string[];
  created_at: string;
}

const DOW_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const PALETTE = [
  'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  'bg-cyan-500', 'bg-orange-500', 'bg-pink-500', 'bg-lime-500',
];
const PALETTE_LIGHT = [
  'bg-blue-500/20 text-blue-300 ring-blue-500/30',
  'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30',
  'bg-amber-500/20 text-amber-300 ring-amber-500/30',
  'bg-rose-500/20 text-rose-300 ring-rose-500/30',
  'bg-cyan-500/20 text-cyan-300 ring-cyan-500/30',
  'bg-orange-500/20 text-orange-300 ring-orange-500/30',
  'bg-pink-500/20 text-pink-300 ring-pink-500/30',
  'bg-lime-500/20 text-lime-300 ring-lime-500/30',
];

const GUARD_COLORS: string[] = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#f97316', '#ec4899', '#84cc16',
];

const PRIORITY_CHIP: Record<string, string> = {
  HIGH:   'bg-red-500/25 text-red-200 ring-red-500/40',
  MEDIUM: 'bg-yellow-500/25 text-yellow-200 ring-yellow-500/40',
  LOW:    'bg-green-500/25 text-green-200 ring-green-500/40',
};

const CHECKPOINT_LABELS: Record<string, string> = { INICIO: 'Inicio de turno', MEDIO: 'Mitad del turno', FIN: 'Fin de turno' };
const STATUS_CFG = {
  NORMAL:     { label: 'Normal',     dot: 'bg-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
  INCIDENCIA: { label: 'Incidencia', dot: 'bg-amber-400',   badge: 'bg-amber-500/20 text-amber-300' },
  CRITICO:    { label: 'Crítico',    dot: 'bg-red-400',     badge: 'bg-red-500/20 text-red-300' },
};

function isoDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function fmt12(time: string) {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr}${suffix}`;
}

// ─── Day Modal ────────────────────────────────────────────────────────────────

interface DayModalProps {
  date: Date;
  teamId: string;
  members: Member[];
  hoEntries: HoEntry[];
  vacations: VacationDay[];
  deadlines: ActivityDeadline[];
  guardShifts: GuardSchedule[];
  colorMap: Record<string, number>;
  managerMemberId?: string;
  onClose: () => void;
  onChanged: () => void;
  readOnly?: boolean;
}

function DayModal({
  date, teamId, members, hoEntries, vacations, deadlines, guardShifts,
  colorMap, managerMemberId, onClose, onChanged, readOnly = false,
}: DayModalProps) {
  const [addingVacFor, setAddingVacFor] = useState<string | null>(null);
  const [note, setNote] = useState('Vacaciones');
  const [saving, setSaving] = useState(false);

  // Guard shift form state
  const [addingGuard, setAddingGuard] = useState(false);
  const [editGuardId, setEditGuardId] = useState<string | null>(null);
  const [guardForm, setGuardForm] = useState({ team_member_id: '', start_time: '08:00', end_time: '17:00' });

  // Guard reports
  const [guardReports, setGuardReports] = useState<GuardReport[]>([]);
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const dateStr = isoDate(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = date.getDay();
  const isWeekend = dow === 0 || dow === 6;

  const dayHo       = hoEntries.filter(h => h.date === dateStr);
  const dayVacations = vacations.filter(v => v.date === dateStr);
  const dayDeadlines = deadlines.filter(d => d.end_date === dateStr);
  const dayGuards    = guardShifts.filter(g => g.date === dateStr).sort((a, b) => a.start_time.localeCompare(b.start_time));

  useEffect(() => {
    if (dayGuards.length === 0) return;
    const ids = dayGuards.map(g => g.id);
    supabase.from('guard_reports').select('*').in('guard_schedule_id', ids).then(({ data }) => {
      setGuardReports(data || []);
    });
  }, [dateStr]);

  const hoMemberIds  = dayHo.map(h => h.team_member_id);
  const vacMemberIds = dayVacations.map(v => v.team_member_id);

  const addHo = async (memberId: string) => {
    setSaving(true);
    await supabase.from('home_office_days').insert({ team_member_id: memberId, date: dateStr });
    setSaving(false);
    onChanged();
  };

  const removeHo = async (id: string) => {
    await supabase.from('home_office_days').delete().eq('id', id);
    onChanged();
  };

  const addVacation = async (memberId: string) => {
    setSaving(true);
    const { error } = await supabase.from('vacation_days').insert({
      team_member_id: memberId, date: dateStr, note: note.trim() || 'Vacaciones',
    });
    setSaving(false);
    if (!error) { setAddingVacFor(null); setNote('Vacaciones'); onChanged(); }
  };

  const removeVacation = async (id: string) => {
    await supabase.from('vacation_days').delete().eq('id', id);
    onChanged();
  };

  const resetGuardForm = () => {
    setAddingGuard(false);
    setEditGuardId(null);
    setGuardForm({ team_member_id: '', start_time: '08:00', end_time: '17:00' });
  };

  const saveGuard = async () => {
    if (!guardForm.team_member_id) return;
    setSaving(true);
    const member = members.find(m => m.id === guardForm.team_member_id);
    const payload = {
      team_id: teamId,
      team_member_id: guardForm.team_member_id,
      member_name: member?.name ?? '',
      date: dateStr,
      start_time: guardForm.start_time,
      end_time: guardForm.end_time,
    };
    if (editGuardId) {
      await supabase.from('guard_schedules').update(payload).eq('id', editGuardId);
    } else {
      await supabase.from('guard_schedules').insert(payload);
    }
    setSaving(false);
    resetGuardForm();
    onChanged();
  };

  const removeGuard = async (id: string) => {
    await supabase.from('guard_schedules').delete().eq('id', id);
    onChanged();
  };

  const startEditGuard = (g: GuardSchedule) => {
    setEditGuardId(g.id);
    setGuardForm({ team_member_id: g.team_member_id, start_time: g.start_time, end_time: g.end_time });
    setAddingGuard(true);
  };

  return (
    <>
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <p className="text-white font-bold text-lg leading-none">
              {DOW_LABELS[dow]} {date.getDate()} de {MONTH_NAMES[date.getMonth()]}
            </p>
            {isWeekend && <p className="text-slate-500 text-xs mt-0.5">Fin de semana</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded transition">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* ── Guard shifts ─────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-400 mb-2 flex items-center gap-1.5">
              <Shield size={12} /> Turnos de Guardia
            </p>
            <div className="space-y-2">
              {dayGuards.map(g => {
                const mi = members.findIndex(m => m.id === g.team_member_id);
                const color = GUARD_COLORS[mi % GUARD_COLORS.length];
                const shiftReports = guardReports.filter(r => r.guard_schedule_id === g.id).sort((a, b) => a.checkpoint.localeCompare(b.checkpoint));
                const isExpanded = expandedShiftId === g.id;
                const CHECKPOINT_LABELS: Record<string, string> = { INICIO: 'Inicio', MEDIO: 'Mitad', FIN: 'Fin' };
                const STATUS_COLORS: Record<string, string> = { NORMAL: 'text-emerald-300 bg-emerald-500/15', INCIDENCIA: 'text-amber-300 bg-amber-500/15', CRITICO: 'text-red-300 bg-red-500/15' };
                return (
                  <div key={g.id} className="bg-violet-900/20 ring-1 ring-violet-700/40 rounded-lg overflow-hidden group">
                    <div className="flex items-center gap-2.5 px-3 py-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-white text-sm font-semibold flex-1">{g.member_name}</span>
                      <span className="flex items-center gap-1 text-xs font-medium text-violet-300 bg-violet-500/15 px-2 py-0.5 rounded-full">
                        <Clock size={10} />
                        {fmt12(g.start_time)} – {fmt12(g.end_time)}
                      </span>
                      {shiftReports.length > 0 && (
                        <button
                          onClick={() => setExpandedShiftId(isExpanded ? null : g.id)}
                          className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-200 transition px-1.5 py-0.5 rounded-full bg-violet-500/10 hover:bg-violet-500/20"
                        >
                          {shiftReports.length}/3 reportes
                          {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>
                      )}
                      {!readOnly && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <button onClick={() => startEditGuard(g)} className="text-slate-400 hover:text-violet-300 p-1 rounded transition"><Pencil size={12} /></button>
                          <button onClick={() => removeGuard(g.id)} className="text-slate-400 hover:text-red-400 p-1 rounded transition"><Trash2 size={12} /></button>
                        </div>
                      )}
                    </div>
                    {isExpanded && shiftReports.length > 0 && (
                      <div className="border-t border-violet-700/30 px-3 pb-2 pt-2 space-y-1.5">
                        {shiftReports.map(r => (
                          <div key={r.id} className="bg-slate-700/40 rounded-lg p-2.5 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold text-violet-300 bg-violet-500/15 px-1.5 py-0.5 rounded">{CHECKPOINT_LABELS[r.checkpoint] ?? r.checkpoint}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS_COLORS[r.status] ?? 'text-slate-300 bg-slate-600/30'}`}>{r.status}</span>
                              <span className="text-slate-500 text-[10px] ml-auto">{new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            {r.project_notes && <p className="text-slate-300 text-xs leading-relaxed"><span className="text-slate-500 font-medium">Proyectos: </span>{r.project_notes}</p>}
                            {r.affected_systems && <p className="text-slate-300 text-xs leading-relaxed"><span className="text-slate-500 font-medium">Sistemas: </span>{r.affected_systems}</p>}
                            {r.observations && <p className="text-slate-300 text-xs leading-relaxed"><span className="text-slate-500 font-medium">Obs: </span>{r.observations}</p>}
                            {r.image_urls && r.image_urls.length > 0 && (
                              <div className="flex gap-1.5 flex-wrap pt-0.5">
                                {r.image_urls.map((url, i) => (
                                  <button key={i} onClick={() => setLightbox(url)} className="relative group overflow-hidden rounded-lg border border-slate-600 hover:border-violet-500/60 transition">
                                    <img src={url} alt="" className="w-14 h-14 object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                      <ZoomIn size={13} className="text-white" />
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {shiftReports.length < 3 && (
                          <p className="text-slate-600 text-[10px] text-center pt-0.5">Faltan {3 - shiftReports.length} reporte(s) por enviar</p>
                        )}
                      </div>
                    )}
                    {shiftReports.length === 0 && (
                      <div className="px-3 pb-2">
                        <p className="text-slate-600 text-xs">Sin reportes enviados aún</p>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Add / Edit guard form */}
              {!readOnly && addingGuard ? (
                <div className="bg-slate-700/60 rounded-lg p-3 space-y-2.5 border border-violet-500/30">
                  <p className="text-xs font-semibold text-violet-300">{editGuardId ? 'Editar turno' : 'Agregar turno de guardia'}</p>
                  <select
                    value={guardForm.team_member_id}
                    onChange={e => setGuardForm(p => ({ ...p, team_member_id: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 text-white px-3 py-1.5 rounded text-sm focus:outline-none focus:border-violet-500"
                  >
                    <option value="">Seleccionar colaborador...</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Hora inicio</label>
                      <input
                        type="time"
                        value={guardForm.start_time}
                        onChange={e => setGuardForm(p => ({ ...p, start_time: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-600 text-white px-2 py-1.5 rounded text-sm focus:outline-none focus:border-violet-500"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Hora fin</label>
                      <input
                        type="time"
                        value={guardForm.end_time}
                        onChange={e => setGuardForm(p => ({ ...p, end_time: e.target.value }))}
                        className="w-full bg-slate-800 border border-slate-600 text-white px-2 py-1.5 rounded text-sm focus:outline-none focus:border-violet-500"
                        style={{ colorScheme: 'dark' }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={saveGuard}
                      disabled={saving || !guardForm.team_member_id}
                      className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded transition"
                    >
                      <Check size={12} />{saving ? 'Guardando...' : editGuardId ? 'Actualizar' : 'Guardar'}
                    </button>
                    <button onClick={resetGuardForm} className="text-slate-400 hover:text-white text-xs px-3 py-1.5 rounded hover:bg-slate-700 transition">Cancelar</button>
                  </div>
                </div>
              ) : (
                !readOnly && (
                  <button
                    onClick={() => setAddingGuard(true)}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-violet-600/40 text-violet-400 hover:border-violet-500/70 hover:text-violet-300 text-xs font-medium transition"
                  >
                    <Plus size={12} />Agregar turno de guardia
                  </button>
                )
              )}
            </div>
          </div>

          {/* ── Activity deadlines ────────────────────────────── */}
          {dayDeadlines.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-400 mb-2 flex items-center gap-1.5">
                <CalendarClock size={12} /> Entregas del día
              </p>
              <div className="space-y-2">
                {dayDeadlines.map(d => {
                  const m = members.find(x => x.id === d.team_member_id);
                  const ci = colorMap[d.team_member_id] ?? 0;
                  const isManager = d.team_member_id === managerMemberId;
                  return (
                    <div key={d.id} className="bg-blue-900/25 ring-1 ring-blue-700/40 rounded-lg px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${PALETTE[ci % PALETTE.length]}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold leading-snug truncate">{d.title}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              {isManager && <UserCog size={10} className="text-blue-400" />}
                              {m?.name ?? '—'}
                              {isManager && <span className="text-blue-400 font-semibold">(Gestor)</span>}
                            </span>
                            {d.project && <span className="text-xs text-slate-500">· {d.project}</span>}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-1 ${PRIORITY_CHIP[d.priority] ?? 'bg-slate-600/30 text-slate-300 ring-slate-600/40'}`}>
                              {{ HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' }[d.priority] ?? d.priority}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Home Office ───────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-400 mb-2 flex items-center gap-1.5">
              <Home size={12} /> Home Office
            </p>
            <div className="space-y-1.5">
              {dayHo.map(h => {
                const m = members.find(x => x.id === h.team_member_id);
                const ci = colorMap[h.team_member_id] ?? 0;
                return (
                  <div key={h.id} className="flex items-center justify-between bg-teal-900/30 ring-1 ring-teal-700/50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${PALETTE[ci % PALETTE.length]}`} />
                      <span className="text-white text-sm font-medium">{m?.name ?? '—'}</span>
                    </div>
                    {!readOnly && (
                      <button onClick={() => removeHo(h.id)} className="text-slate-500 hover:text-red-400 p-0.5 rounded transition"><X size={14} /></button>
                    )}
                  </div>
                );
              })}
              {!readOnly && members.filter(m => !hoMemberIds.includes(m.id) && !vacMemberIds.includes(m.id)).length > 0 && (
                <div className="pt-1">
                  <p className="text-xs text-slate-500 mb-1.5">Asignar HO a:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {members.filter(m => !hoMemberIds.includes(m.id) && !vacMemberIds.includes(m.id)).map(m => {
                      const ci = colorMap[m.id] ?? 0;
                      return (
                        <button key={m.id} onClick={() => addHo(m.id)} disabled={saving}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 hover:ring-2 transition disabled:opacity-50 ${PALETTE_LIGHT[ci % PALETTE_LIGHT.length]}`}>
                          <Plus size={10} />{m.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {dayHo.length === 0 && members.filter(m => !hoMemberIds.includes(m.id) && !vacMemberIds.includes(m.id)).length === 0 && (
                <p className="text-slate-500 text-sm">Todos los colaboradores ya tienen ausencia asignada</p>
              )}
            </div>
          </div>

          {/* ── Vacaciones ────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-400 mb-2 flex items-center gap-1.5">
              <Palmtree size={12} /> Vacaciones / Ausencias
            </p>
            <div className="space-y-1.5">
              {dayVacations.map(v => {
                const m = members.find(x => x.id === v.team_member_id);
                const ci = colorMap[v.team_member_id] ?? 0;
                return (
                  <div key={v.id} className="flex items-center justify-between bg-amber-900/30 ring-1 ring-amber-700/50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${PALETTE[ci % PALETTE.length]}`} />
                      <span className="text-white text-sm font-medium">{m?.name ?? '—'}</span>
                      <span className="text-slate-400 text-xs">· {v.note}</span>
                    </div>
                    {!readOnly && (
                      <button onClick={() => removeVacation(v.id)} className="text-slate-500 hover:text-red-400 p-0.5 rounded transition"><X size={14} /></button>
                    )}
                  </div>
                );
              })}
              {!readOnly && addingVacFor ? (
                <div className="bg-slate-700/60 rounded-lg p-3 space-y-2">
                  <p className="text-xs text-slate-400">
                    Ausencia para: <span className="text-white font-medium">{members.find(m => m.id === addingVacFor)?.name}</span>
                  </p>
                  <input type="text" value={note} onChange={e => setNote(e.target.value)}
                    placeholder="Vacaciones, Día personal..."
                    className="w-full bg-slate-800 border border-slate-600 text-white px-3 py-1.5 rounded text-sm focus:outline-none focus:border-amber-500"
                    autoFocus />
                  <div className="flex gap-2">
                    <button onClick={() => addVacation(addingVacFor)} disabled={saving}
                      className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 rounded transition">
                      <Check size={12} />Guardar
                    </button>
                    <button onClick={() => { setAddingVacFor(null); setNote('Vacaciones'); }}
                      className="text-slate-400 hover:text-white text-xs px-3 py-1.5 rounded hover:bg-slate-700 transition">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                !readOnly && members.filter(m => !vacMemberIds.includes(m.id) && !hoMemberIds.includes(m.id)).length > 0 && (
                  <div className="pt-1">
                    <p className="text-xs text-slate-500 mb-1.5">Agregar ausencia a:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {members.filter(m => !vacMemberIds.includes(m.id) && !hoMemberIds.includes(m.id)).map(m => {
                        const ci = colorMap[m.id] ?? 0;
                        return (
                          <button key={m.id} onClick={() => setAddingVacFor(m.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 hover:ring-2 transition ${PALETTE_LIGHT[ci % PALETTE_LIGHT.length]}`}>
                            <Plus size={10} />{m.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
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

// ─── Guard Reports Panel ──────────────────────────────────────────────────────

function GuardReportsPanel({
  sortedDates, shiftsByDate, guardReportsAll, members,
  filterMember, managerMemberId, month, year,
  onFilterMember, onPrevMonth, onNextMonth,
}: {
  sortedDates: string[];
  shiftsByDate: Record<string, GuardSchedule[]>;
  guardReportsAll: GuardReport[];
  members: Member[];
  filterMember: string;
  managerMemberId?: string;
  month: number;
  year: number;
  onFilterMember: (v: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  function exportToExcel() {
    const CHECKPOINT_ORDER: Record<string, number> = { INICIO: 0, MEDIO: 1, FIN: 2 };
    const CHECKPOINT_LABEL: Record<string, string> = { INICIO: 'Inicio de turno', MEDIO: 'Mitad del turno', FIN: 'Fin de turno' };
    const STATUS_LABEL: Record<string, string> = { NORMAL: 'Normal', INCIDENCIA: 'Incidencia', CRITICO: 'Crítico' };

    const rows: string[][] = [];

    const shifts = Object.values(shiftsByDate).flat().sort((a, b) => a.date.localeCompare(b.date));
    for (const shift of shifts) {
      if (filterMember !== 'all' && shift.team_member_id !== filterMember) continue;
      const reports = guardReportsAll
        .filter(r => r.guard_schedule_id === shift.id)
        .sort((a, b) => (CHECKPOINT_ORDER[a.checkpoint] ?? 3) - (CHECKPOINT_ORDER[b.checkpoint] ?? 3));

      if (reports.length === 0) {
        const [sy, sm, sd] = shift.date.split('-').map(Number);
        const dateLabel = new Date(sy, sm - 1, sd).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        rows.push([dateLabel, shift.member_name, `${fmt12(shift.start_time)} – ${fmt12(shift.end_time)}`, '—', '—', '—', '—', '—']);
      } else {
        for (const r of reports) {
          const [sy, sm, sd] = shift.date.split('-').map(Number);
          const dateLabel = new Date(sy, sm - 1, sd).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
          const reportTime = new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
          rows.push([
            dateLabel,
            shift.member_name,
            `${fmt12(shift.start_time)} – ${fmt12(shift.end_time)}`,
            CHECKPOINT_LABEL[r.checkpoint] ?? r.checkpoint,
            `${reportTime}`,
            STATUS_LABEL[r.status] ?? r.status,
            r.project_notes ?? '',
            r.affected_systems ?? '',
            r.observations ?? '',
          ]);
        }
      }
    }

    const headers = ['Fecha', 'Colaborador', 'Horario de guardia', 'Punto de reporte', 'Hora del reporte', 'Estatus', 'Proyectos', 'Sistemas afectados', 'Observaciones'];

    const headerStyle = 'background:#1e40af;color:#ffffff;font-weight:bold;border:1px solid #1d4ed8;padding:8px 10px;white-space:nowrap;';
    const cellStyle = (i: number) => `background:${i % 2 === 0 ? '#eff6ff' : '#dbeafe'};border:1px solid #bfdbfe;padding:7px 10px;vertical-align:top;font-size:13px;`;

    const headerRow = `<tr>${headers.map(h => `<th style="${headerStyle}">${h}</th>`).join('')}</tr>`;
    const dataRows = rows.map((row, i) => `<tr>${row.map(cell => `<td style="${cellStyle(i)}">${cell.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>`).join('')}</tr>`).join('');

    const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Reportes de Guardia</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body>
<table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;">
<thead>${headerRow}</thead>
<tbody>${dataRows}</tbody>
</table>
</body></html>`;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reportes-guardia-${MONTH_NAMES[month]}-${year}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Summary stats
  const totalShifts = Object.values(shiftsByDate).flat().length;
  const totalWithReports = Object.values(shiftsByDate).flat().filter(s => guardReportsAll.some(r => r.guard_schedule_id === s.id)).length;
  const totalIncidents = guardReportsAll.filter(r => r.status !== 'NORMAL').length;
  const totalComplete = Object.values(shiftsByDate).flat().filter(s => {
    const cp = new Set(guardReportsAll.filter(r => r.guard_schedule_id === s.id).map(r => r.checkpoint));
    return cp.has('INICIO') && cp.has('MEDIO') && cp.has('FIN');
  }).length;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onPrevMonth} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"><ChevronLeft size={18} /></button>
          <h3 className="text-white font-bold">{MONTH_NAMES[month]} {year}</h3>
          <button onClick={onNextMonth} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"><ChevronRight size={18} /></button>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterMember} onChange={e => onFilterMember(e.target.value)}
            className="bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500">
            <option value="all">Todos los colaboradores</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}{m.id === managerMemberId ? ' (Gestor)' : ''}</option>)}
          </select>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition shrink-0"
            title="Exportar a Excel"
          >
            <Download size={14} />
            Exportar
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {totalShifts > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Turnos totales',     value: totalShifts,        color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
            { label: 'Con reportes',        value: totalWithReports,   color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
            { label: 'Turnos completos',   value: totalComplete,      color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
            { label: 'Incidencias',        value: totalIncidents,     color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20' },
          ].map(stat => (
            <div key={stat.label} className={`rounded-xl border px-4 py-3 ${stat.bg}`}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-slate-400 text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {sortedDates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Shield size={40} className="text-slate-700 mb-4" />
          <p className="text-slate-400 font-semibold">Sin turnos de guardia en {MONTH_NAMES[month]} {year}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedDates.map(dateStr => {
            const shifts = shiftsByDate[dateStr];
            const [sy, sm, sd] = dateStr.split('-').map(Number);
            const dateLabel = new Date(sy, sm - 1, sd).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
            const dayHasIncident = shifts.some(s => guardReportsAll.some(r => r.guard_schedule_id === s.id && r.status !== 'NORMAL'));
            const dayComplete = shifts.every(s => {
              const cp = new Set(guardReportsAll.filter(r => r.guard_schedule_id === s.id).map(r => r.checkpoint));
              return cp.has('INICIO') && cp.has('MEDIO') && cp.has('FIN');
            });
            const dayHasAnyReports = shifts.some(s => guardReportsAll.some(r => r.guard_schedule_id === s.id));

            return (
              <div key={dateStr} className="bg-slate-800/60 border border-slate-700 rounded-2xl overflow-hidden">
                {/* Date header — always visible */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${dayHasIncident ? 'bg-amber-500/15 border border-amber-500/30' : dayComplete ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-violet-500/15 border border-violet-500/30'}`}>
                    <Shield size={14} className={dayHasIncident ? 'text-amber-400' : dayComplete ? 'text-emerald-400' : 'text-violet-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm capitalize">{dateLabel}</p>
                    <p className="text-slate-500 text-xs">{shifts.length} turno{shifts.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {dayHasIncident && <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400"><AlertTriangle size={9} />Incidencia</span>}
                    {dayComplete && !dayHasIncident && <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400"><CheckCheck size={9} />Completo</span>}
                    {!dayHasAnyReports && <span className="text-[10px] text-slate-600 px-2">Sin reportes</span>}
                  </div>
                </div>

                {/* Shift rows inside the date group */}
                <div className="border-t border-slate-700/50 divide-y divide-slate-700/40">
                  {shifts.map(shift => {
                    const reports = guardReportsAll
                      .filter(r => r.guard_schedule_id === shift.id)
                      .sort((a, b) => { const o: Record<string,number> = {INICIO:0,MEDIO:1,FIN:2}; return (o[a.checkpoint]??3)-(o[b.checkpoint]??3); });
                    const doneSet = new Set(reports.map(r => r.checkpoint));
                    const allDone = doneSet.has('INICIO') && doneSet.has('MEDIO') && doneSet.has('FIN');
                    const hasIncident = reports.some(r => r.status !== 'NORMAL');
                    const isExpanded = expandedShiftId === shift.id;
                    const mi = members.findIndex(m => m.id === shift.team_member_id);
                    const dotColor = GUARD_COLORS[mi % GUARD_COLORS.length];

                    return (
                      <div key={shift.id}>
                        {/* Shift row — clickable to expand */}
                        <button
                          onClick={() => setExpandedShiftId(isExpanded ? null : shift.id)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/40 transition text-left group"
                        >
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
                          <span className="text-white text-sm font-semibold flex-1">{shift.member_name}</span>
                          <span className="text-slate-400 text-xs">{fmt12(shift.start_time)} – {fmt12(shift.end_time)}</span>
                          {/* Checkpoint pills */}
                          <div className="flex items-center gap-1">
                            {(['INICIO','MEDIO','FIN'] as const).map(cp => (
                              <span key={cp} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${doneSet.has(cp) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-600'}`}>
                                {cp[0]}
                              </span>
                            ))}
                          </div>
                          {allDone && <CheckCheck size={12} className="text-emerald-400 shrink-0" />}
                          {hasIncident && <AlertTriangle size={12} className="text-amber-400 shrink-0" />}
                          {reports.length > 0 && (isExpanded ? <ChevronUp size={14} className="text-slate-500 shrink-0" /> : <ChevronDown size={14} className="text-slate-500 shrink-0" />)}
                          {reports.length === 0 && <span className="text-[10px] text-slate-600">Sin reportes</span>}
                        </button>

                        {/* Expanded report details */}
                        {isExpanded && reports.length > 0 && (
                          <div className="bg-slate-900/40 border-t border-slate-700/40 divide-y divide-slate-700/30">
                            {reports.map(r => {
                              const statusCfg = STATUS_CFG[r.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.NORMAL;
                              return (
                                <div key={r.id} className="px-5 py-3 space-y-2.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-bold text-violet-300 bg-violet-500/15 px-2 py-0.5 rounded-full">{CHECKPOINT_LABELS[r.checkpoint]}</span>
                                    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.badge}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />{statusCfg.label}
                                    </span>
                                    <span className="text-slate-600 text-[10px] ml-auto">{new Date(r.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <div className="grid gap-1.5">
                                    {r.project_notes && (
                                      <div className="bg-slate-800 rounded-lg px-3 py-2">
                                        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Proyectos</p>
                                        <p className="text-slate-200 text-xs leading-relaxed">{r.project_notes}</p>
                                      </div>
                                    )}
                                    {r.affected_systems && (
                                      <div className="bg-slate-800 rounded-lg px-3 py-2">
                                        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wide mb-0.5">Sistemas afectados</p>
                                        <p className="text-slate-200 text-xs leading-relaxed">{r.affected_systems}</p>
                                      </div>
                                    )}
                                    {r.observations && (
                                      <div className={`rounded-lg px-3 py-2 ${r.status !== 'NORMAL' ? 'bg-amber-900/20 border border-amber-700/30' : 'bg-slate-800'}`}>
                                        <p className={`text-[9px] font-semibold uppercase tracking-wide mb-0.5 ${r.status !== 'NORMAL' ? 'text-amber-500' : 'text-slate-500'}`}>Observaciones</p>
                                        <p className={`text-xs leading-relaxed ${r.status !== 'NORMAL' ? 'text-amber-200' : 'text-slate-200'}`}>{r.observations}</p>
                                      </div>
                                    )}
                                  </div>
                                  {r.image_urls && r.image_urls.length > 0 && (
                                    <div className="flex gap-1.5 flex-wrap">
                                      {r.image_urls.map((url: string, i: number) => (
                                        <button key={i} onClick={() => setLightboxUrl(url)} className="relative group overflow-hidden rounded-lg border border-slate-600 hover:border-violet-500/60 transition">
                                          <img src={url} alt="" className="w-16 h-16 object-cover" />
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
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/92 flex items-center justify-center z-[60] p-4" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full transition"><X size={22} /></button>
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CalendarSection({ teamId, managerMemberId, readOnly = false }: CalendarSectionProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [members, setMembers] = useState<Member[]>([]);
  const [hoEntries, setHoEntries] = useState<HoEntry[]>([]);
  const [vacations, setVacations] = useState<VacationDay[]>([]);
  const [deadlines, setDeadlines] = useState<ActivityDeadline[]>([]);
  const [guardSchedules, setGuardSchedules] = useState<GuardSchedule[]>([]);
  const [guardReportsAll, setGuardReportsAll] = useState<GuardReport[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [filterMember, setFilterMember] = useState<string>('all');
  const [activeView, setActiveView] = useState<'calendar' | 'reports'>('calendar');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const colorMap: Record<string, number> = {};
  members.forEach((m, i) => { colorMap[m.id] = i; });

  const loadData = useCallback(async () => {
    const { data: mData } = await supabase
      .from('team_members')
      .select('id, name, email, position')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });

    if (!mData || mData.length === 0) {
      setMembers([]); setHoEntries([]); setVacations([]); setDeadlines([]); setGuardSchedules([]);
      return;
    }

    const memberIds = mData.map(m => m.id);
    const firstDay  = isoDate(year, month, 1);
    const lastDay   = isoDate(year, month, new Date(year, month + 1, 0).getDate());

    const [hoData, vacData, deadlineData, guardsData] = await Promise.all([
      supabase.from('home_office_days').select('id, team_member_id, date')
        .in('team_member_id', memberIds).gte('date', firstDay).lte('date', lastDay),
      supabase.from('vacation_days').select('id, team_member_id, date, note')
        .in('team_member_id', memberIds).gte('date', firstDay).lte('date', lastDay),
      supabase.from('activities')
        .select('id, team_member_id, title, end_date, priority, status, project')
        .in('team_member_id', memberIds)
        .gte('end_date', firstDay).lte('end_date', lastDay)
        .not('end_date', 'is', null)
        .not('status', 'in', '("APPROVED","COMPLETED")'),
      supabase.from('guard_schedules').select('*')
        .eq('team_id', teamId).gte('date', firstDay).lte('date', lastDay),
    ]);

    setMembers(mData);
    setHoEntries(hoData.data || []);
    setVacations(vacData.data || []);
    setDeadlines(deadlineData.data || []);
    setGuardSchedules(guardsData.data || []);

    // Load all guard reports for the month
    const allShiftIds = (guardsData.data || []).map((g: any) => g.id);
    if (allShiftIds.length > 0) {
      const { data: rData } = await supabase.from('guard_reports').select('*').in('guard_schedule_id', allShiftIds);
      setGuardReportsAll(rData || []);
    } else {
      setGuardReportsAll([]);
    }
  }, [teamId, year, month]);

  useEffect(() => { loadData(); }, [loadData]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
  };

  const firstDow   = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const filteredMemberIds = filterMember === 'all' ? members.map(m => m.id) : [filterMember];

  const getDayEvents = (day: number) => {
    const dateStr = isoDate(year, month, day);
    const ho     = hoEntries.filter(h => h.date === dateStr && filteredMemberIds.includes(h.team_member_id));
    const vac    = vacations.filter(v => v.date === dateStr && filteredMemberIds.includes(v.team_member_id));
    const acts   = deadlines.filter(d => d.end_date === dateStr && filteredMemberIds.includes(d.team_member_id));
    const guards = guardSchedules.filter(g => g.date === dateStr && (filterMember === 'all' || g.team_member_id === filterMember));
    return { ho, vac, acts, guards };
  };

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const isWeekend = (day: number) => {
    const d = new Date(year, month, day).getDay();
    return d === 0 || d === 6;
  };

  // Guard report panel data — grouped by date, today first then future, then past
  const todayStr = isoDate(today.getFullYear(), today.getMonth(), today.getDate());
  const reportFilteredShifts = guardSchedules
    .filter(g => filterMember === 'all' || g.team_member_id === filterMember)
    .sort((a, b) => {
      const aFuture = a.date >= todayStr;
      const bFuture = b.date >= todayStr;
      if (aFuture && bFuture) return a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time);
      if (!aFuture && !bFuture) return b.date.localeCompare(a.date) || a.start_time.localeCompare(b.start_time);
      return aFuture ? -1 : 1;
    });

  // Group shifts by date, preserving the order from reportFilteredShifts
  const shiftsByDate = reportFilteredShifts.reduce<Record<string, GuardSchedule[]>>((acc, g) => {
    (acc[g.date] = acc[g.date] || []).push(g);
    return acc;
  }, {});
  const sortedDates = Array.from(new Set(reportFilteredShifts.map(g => g.date)));

  const reportsPanelEl = (
    <GuardReportsPanel
      sortedDates={sortedDates}
      shiftsByDate={shiftsByDate}
      guardReportsAll={guardReportsAll}
      members={members}
      filterMember={filterMember}
      managerMemberId={managerMemberId}
      month={month}
      year={year}
      onFilterMember={setFilterMember}
      onPrevMonth={prevMonth}
      onNextMonth={nextMonth}
    />
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Calendario del Equipo</h2>
          <p className="text-slate-400 text-sm mt-1">Visualiza HO, vacaciones y entregas de actividades por fecha</p>
        </div>
        <select
          value={filterMember}
          onChange={e => setFilterMember(e.target.value)}
          className="bg-slate-800 border border-slate-600 text-white text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500"
        >
          <option value="all">Todos los colaboradores</option>
          {members.map(m => (
            <option key={m.id} value={m.id}>{m.name}{m.id === managerMemberId ? ' (Gestor)' : ''}</option>
          ))}
        </select>
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 w-fit">
        <button onClick={() => setActiveView('calendar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${activeView === 'calendar' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
          <CalendarClock size={14} />Calendario
        </button>
        <button onClick={() => setActiveView('reports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${activeView === 'reports' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
          <Shield size={14} />Reportes de Guardia
          {guardSchedules.length > 0 && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              guardSchedules.some(s => guardReportsAll.filter(r => r.guard_schedule_id === s.id).length < 3)
                ? 'bg-amber-500 text-white'
                : 'bg-slate-600 text-slate-300'
            }`}>
              {guardSchedules.length}
            </span>
          )}
        </button>
      </div>

      {activeView === 'reports' ? reportsPanelEl : (<>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-3 rounded-sm bg-blue-600/60 ring-1 ring-blue-500/40 inline-block" />Entrega de actividad
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-3 rounded-sm bg-teal-600/60 ring-1 ring-teal-500/40 inline-block" />Home Office
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-3 rounded-sm bg-amber-600/60 ring-1 ring-amber-500/40 inline-block" />Vacaciones / Ausencia
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-3 rounded-sm bg-violet-600/60 ring-1 ring-violet-500/40 inline-block" />Turno de guardia
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-300 inline-block" />Hoy
        </span>
        {members.slice(0, 6).map((m, i) => (
          <span key={m.id} className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className={`w-2.5 h-2.5 rounded-full ${PALETTE[i % PALETTE.length]} inline-block`} />
            {m.name}{m.id === managerMemberId ? ' (Gestor)' : ''}
          </span>
        ))}
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
          <button onClick={prevMonth} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition">
            <ChevronLeft size={20} />
          </button>
          <h3 className="text-white font-bold text-lg">{MONTH_NAMES[month]} {year}</h3>
          <button onClick={nextMonth} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* DOW headers */}
        <div className="grid grid-cols-7 border-b border-slate-700">
          {DOW_LABELS.map(d => (
            <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} className="min-h-[120px] border-r border-b border-slate-700/50 bg-slate-900/30" />;

            const { ho, vac, acts, guards } = getDayEvents(day);
            const weekend  = isWeekend(day);
            const today_   = isToday(day);
            const hasDeadline = acts.length > 0;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(new Date(year, month, day))}
                className={`min-h-[120px] p-1.5 border-r border-b border-slate-700/50 text-left flex flex-col gap-0.5 transition group ${
                  weekend ? 'bg-slate-900/50 hover:bg-slate-700/30' : 'hover:bg-slate-700/40'
                } ${today_ ? 'ring-2 ring-inset ring-blue-500' : ''}${hasDeadline && !today_ ? ' bg-blue-950/20' : ''}`}
              >
                <span className={`text-xs font-bold self-start leading-none rounded-full w-5 h-5 flex items-center justify-center mb-0.5 ${
                  today_ ? 'bg-blue-500 text-white' : weekend ? 'text-slate-600' : 'text-slate-400 group-hover:text-slate-200'
                }`}>
                  {day}
                </span>

                {/* Guard shifts — show all, no truncation */}
                {guards.length > 0 && (
                  <div className="flex flex-col gap-0.5 w-full">
                    {guards.map(g => {
                      const mi = members.findIndex(m => m.id === g.team_member_id);
                      const color = GUARD_COLORS[mi % GUARD_COLORS.length];
                      return (
                        <span key={g.id} className="flex flex-col w-full px-1.5 py-1 rounded-md bg-violet-900/50 ring-1 ring-violet-700/60 gap-0.5">
                          <span className="flex items-center gap-1 leading-none">
                            <Shield size={8} className="text-violet-400 shrink-0" />
                            <span className="text-violet-100 text-[10px] font-semibold truncate flex-1">{g.member_name.split(' ')[0]}</span>
                          </span>
                          <span className="text-violet-400 text-[9px] font-medium leading-none pl-0.5">{fmt12(g.start_time)}–{fmt12(g.end_time)}</span>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Activity deadlines — show all */}
                {acts.length > 0 && (
                  <div className="flex flex-col gap-0.5 w-full">
                    {acts.map(a => {
                      const ci = colorMap[a.team_member_id] ?? 0;
                      const isManager = a.team_member_id === managerMemberId;
                      return (
                        <span key={a.id} className="flex items-center gap-1 w-full px-1 py-0.5 rounded bg-blue-900/50 ring-1 ring-blue-700/60">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PALETTE[ci % PALETTE.length]}`} />
                          {isManager && <UserCog size={8} className="text-blue-300 shrink-0" />}
                          <span className="text-blue-200 text-[10px] font-medium truncate leading-none">{a.title}</span>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* HO entries — show all */}
                {ho.length > 0 && (
                  <div className="flex flex-col gap-0.5 w-full">
                    {ho.map(h => {
                      const ci = colorMap[h.team_member_id] ?? 0;
                      const name = members.find(m => m.id === h.team_member_id)?.name ?? '';
                      return (
                        <span key={h.id} className="flex items-center gap-1 w-full px-1 py-0.5 rounded bg-teal-900/50 ring-1 ring-teal-700/60">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PALETTE[ci % PALETTE.length]}`} />
                          <span className="text-teal-200 text-[10px] font-medium truncate leading-none">{name}</span>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Vacation entries — show all */}
                {vac.length > 0 && (
                  <div className="flex flex-col gap-0.5 w-full">
                    {vac.map(v => {
                      const ci = colorMap[v.team_member_id] ?? 0;
                      const name = members.find(x => x.id === v.team_member_id)?.name ?? '';
                      return (
                        <span key={v.id} className="flex items-center gap-1 w-full px-1 py-0.5 rounded bg-amber-900/50 ring-1 ring-amber-700/60">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PALETTE[ci % PALETTE.length]}`} />
                          <span className="text-amber-200 text-[10px] font-medium truncate leading-none">{name}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <DayModal
          date={selectedDay}
          teamId={teamId}
          members={members}
          hoEntries={hoEntries}
          vacations={vacations}
          deadlines={deadlines}
          guardShifts={guardSchedules}
          colorMap={colorMap}
          managerMemberId={managerMemberId}
          onClose={() => setSelectedDay(null)}
          onChanged={loadData}
          readOnly={readOnly}
        />
      )}
      </>)}
    </div>
  );
}
