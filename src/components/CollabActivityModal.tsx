import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Plus, Trash2, Users, CircleUser as UserCircle2 } from 'lucide-react';
import ProjectCombobox from './ProjectCombobox';

interface TeamMember { id: string; name: string; position: string; }

interface Step {
  type: 'DATABASE' | 'CODE' | 'TESTING' | 'DOCUMENTATION';
  title: string;
  description: string;
  assigned_member_id: string;
}

interface Props {
  teamId: string;
  creatorMemberId: string;
  creatorName: string;
  onClose: () => void;
  onCreated: () => void;
  /** If set, only members whose position matches one of these values (case-insensitive) can be assigned */
  filterPositions?: string[];
}

const STEP_TYPES: { value: Step['type']; label: string }[] = [
  { value: 'DATABASE',      label: 'Base de Datos' },
  { value: 'CODE',          label: 'Código' },
  { value: 'TESTING',       label: 'Testing' },
  { value: 'DOCUMENTATION', label: 'Documentación' },
];

export default function CollabActivityModal({ teamId, creatorMemberId, creatorName, onClose, onCreated, filterPositions }: Props) {
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);
  const [form, setForm] = useState({
    title: '',
    description: '',
    project: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    activity_type: 'CODE' as 'CODE' | 'DATABASE' | 'BOTH' | 'DOCUMENTATION' | 'TESTING',
    end_date: '',
    // primary owner of the activity (defaults to creator)
    team_member_id: creatorMemberId,
    // second collaborator (optional)
    shared_with_member_id: '',
  });
  const [steps, setSteps] = useState<Step[]>([
    { type: 'CODE', title: '', description: '', assigned_member_id: creatorMemberId },
  ]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('team_members')
      .select('id, name, position')
      .eq('team_id', teamId)
      .order('name', { ascending: true })
      .then(({ data }) => setAllMembers(data || []));
  }, [teamId]);

  // Members eligible for assignment based on permission filter
  const members = filterPositions && filterPositions.length > 0
    ? allMembers.filter(m => filterPositions.some(p => p.toLowerCase() === m.position.toLowerCase()))
    : allMembers;

  const setField = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const updateStep = (i: number, k: keyof Step, v: string) =>
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [k]: v } : s));

  const addStep = () =>
    setSteps(prev => [...prev, { type: 'CODE', title: '', description: '', assigned_member_id: creatorMemberId }]);

  const removeStep = (i: number) =>
    setSteps(prev => prev.filter((_, idx) => idx !== i));

  const involvedMembers = [
    members.find(m => m.id === form.team_member_id),
    form.shared_with_member_id ? members.find(m => m.id === form.shared_with_member_id) : null,
  ].filter(Boolean) as TeamMember[];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);

    try {
      const sharedMember = members.find(m => m.id === form.shared_with_member_id);
      const primaryMember = members.find(m => m.id === form.team_member_id);

      const activityPayload: Record<string, any> = {
        team_id: teamId,
        team_member_id: form.team_member_id,
        created_by_member_id: creatorMemberId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        project: form.project.trim() || null,
        priority: form.priority,
        activity_type: form.activity_type,
        status: 'PENDING',
        end_date: form.end_date || null,
      };

      if (form.shared_with_member_id) {
        activityPayload.shared_with_member_id = form.shared_with_member_id;
        activityPayload.shared_with_member_name = sharedMember?.name ?? null;
      }

      const { data: activity, error } = await supabase
        .from('activities')
        .insert(activityPayload)
        .select('id')
        .maybeSingle();

      if (error || !activity) throw error ?? new Error('No se creó la actividad');

      // Insert steps with assignee info
      const validSteps = steps.filter(s => s.title.trim());
      if (validSteps.length > 0) {
        const stepsPayload = validSteps.map((s, i) => {
          const assignedMember = members.find(m => m.id === s.assigned_member_id);
          return {
            activity_id: activity.id,
            step_type: s.type,
            title: s.title.trim(),
            description: s.description.trim() || null,
            order_index: i,
            assigned_member_id: s.assigned_member_id || null,
            assigned_member_name: assignedMember?.name ?? null,
          };
        });
        await supabase.from('task_steps').insert(stepsPayload);
      }

      // Notify the primary owner if it's not the creator
      if (form.team_member_id !== creatorMemberId) {
        await supabase.from('notifications').insert({
          team_member_id: form.team_member_id,
          activity_id: activity.id,
          type: 'ACTIVITY_CREATED',
          title: `Nueva actividad compartida: ${form.title.trim()}`,
          body: `Creada por ${creatorName}${form.project ? ` · ${form.project}` : ''}`,
        });
      }

      // Notify the second member
      if (form.shared_with_member_id && form.shared_with_member_id !== creatorMemberId) {
        await supabase.from('notifications').insert({
          team_member_id: form.shared_with_member_id,
          activity_id: activity.id,
          type: 'ACTIVITY_CREATED',
          title: `Actividad compartida contigo: ${form.title.trim()}`,
          body: `Creada por ${creatorName}${form.project ? ` · ${form.project}` : ''} · Tienes ${validSteps.filter(s => s.assigned_member_id === form.shared_with_member_id).length} paso(s) asignados`,
        });
      }

      // Notify managers
      const { data: managers } = await supabase
        .from('team_members').select('id').eq('team_id', teamId).not('user_id', 'is', null);
      if (managers?.length) {
        const memberLabel = involvedMembers.map(m => m.name).join(' & ');
        await supabase.from('notifications').insert(
          managers.map((m: any) => ({
            team_member_id: m.id,
            activity_id: activity.id,
            type: 'ACTIVITY_CREATED',
            title: `Nueva actividad creada: ${form.title.trim()}`,
            body: `Por ${creatorName} · Involucra a ${memberLabel}`,
          }))
        );
      }

      onCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || err?.details || err?.hint || JSON.stringify(err);
      alert(`Error: ${msg || 'Error desconocido'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full my-8 shadow-2xl flex flex-col">

        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold text-white">Nueva Actividad Compartida</h2>
            <p className="text-xs text-slate-400 mt-0.5">Asigna pasos a cada integrante del equipo</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">

          {/* General info */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Información General</h3>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">Título *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                placeholder="Título de la actividad"
                required
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">Descripción</label>
              <textarea
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder="Descripción detallada..."
                rows={3}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">Proyecto</label>
                <ProjectCombobox
                  teamId={teamId}
                  value={form.project}
                  onChange={val => setField('project', val)}
                  placeholder="Seleccionar o escribir proyecto..."
                  className="bg-slate-800 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">Prioridad</label>
                <select
                  value={form.priority}
                  onChange={e => setField('priority', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                </select>
              </div>
            </div>

            {/* Activity type */}
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">Tipo de actividad</label>
              <div className="grid grid-cols-5 gap-2">
                {([
                  { value: 'CODE',          label: 'Código',        color: 'border-blue-500 bg-blue-500/20 text-blue-200' },
                  { value: 'DATABASE',      label: 'BD',            color: 'border-emerald-500 bg-emerald-500/20 text-emerald-200' },
                  { value: 'BOTH',          label: 'Código + BD',   color: 'border-cyan-500 bg-cyan-500/20 text-cyan-200' },
                  { value: 'DOCUMENTATION', label: 'Documentación', color: 'border-amber-500 bg-amber-500/20 text-amber-200' },
                  { value: 'TESTING',       label: 'Testing',       color: 'border-rose-500 bg-rose-500/20 text-rose-200' },
                ] as const).map(({ value, label, color }) => {
                  const isSelected = form.activity_type === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setField('activity_type', value)}
                      className={`py-2 px-1 rounded-lg border text-[11px] font-bold tracking-wide transition ${isSelected ? color : 'border-slate-600 bg-slate-700/50 text-slate-400 hover:border-slate-500'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">Fecha límite</label>
              <input
                type="date"
                value={form.end_date}
                onChange={e => setField('end_date', e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </section>

          {/* Team members involved */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Users size={13} />
              Integrantes
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">Responsable principal</label>
                <select
                  value={form.team_member_id}
                  onChange={e => setField('team_member_id', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                >
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name} — {m.position}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">La actividad aparece en su kanban</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1.5">Segundo integrante (opcional)</label>
                <select
                  value={form.shared_with_member_id}
                  onChange={e => setField('shared_with_member_id', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="">— Sin segundo integrante —</option>
                  {members
                    .filter(m => m.id !== form.team_member_id)
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.name} — {m.position}</option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">También verá esta actividad</p>
              </div>
            </div>

            {involvedMembers.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                {involvedMembers.map(m => (
                  <span key={m.id} className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/25 text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                    <UserCircle2 size={12} />
                    {m.name}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Steps */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pasos de la actividad</h3>
              <button
                type="button"
                onClick={addStep}
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-lg transition"
              >
                <Plus size={13} />
                Agregar paso
              </button>
            </div>

            {steps.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-4 bg-slate-800/40 rounded-xl border border-slate-700/50 border-dashed">
                Sin pasos aún — agrega al menos uno
              </p>
            )}

            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="bg-slate-800/70 border border-slate-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 w-5 shrink-0">#{i + 1}</span>
                    <select
                      value={step.type}
                      onChange={e => updateStep(i, 'type', e.target.value)}
                      className="bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 transition"
                    >
                      {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>

                    {/* Assignee selector */}
                    <div className="flex-1 flex items-center gap-1.5 min-w-0">
                      <UserCircle2 size={13} className="text-slate-400 shrink-0" />
                      <select
                        value={step.assigned_member_id}
                        onChange={e => updateStep(i, 'assigned_member_id', e.target.value)}
                        className="flex-1 bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500 transition min-w-0"
                      >
                        <option value="">Sin asignar</option>
                        {involvedMembers.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    {steps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeStep(i)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={step.title}
                    onChange={e => updateStep(i, 'title', e.target.value)}
                    placeholder="Título del paso"
                    className="w-full bg-slate-700 border border-slate-600 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition placeholder-slate-500"
                  />

                  <textarea
                    value={step.description}
                    onChange={e => updateStep(i, 'description', e.target.value)}
                    placeholder="Descripción (opcional)"
                    rows={2}
                    className="w-full bg-slate-700 border border-slate-600 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition resize-none placeholder-slate-500"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-slate-700/60">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition"
            >
              {saving ? 'Creando...' : 'Crear actividad'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
