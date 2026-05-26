import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Plus, Trash2, CircleUser as UserCircle2 } from 'lucide-react';
import ProjectCombobox from './ProjectCombobox';

async function createNotification(teamMemberId: string, activityId: string, title: string, body: string, type: 'ACTIVITY_CREATED' | 'ACTIVITY_UPDATED') {
  await supabase.from('notifications').insert({ team_member_id: teamMemberId, activity_id: activityId, type, title, body });
}

interface ActivityModalProps {
  teamId: string;
  onClose: () => void;
  onActivityCreated: () => void;
  defaultAssignedTo?: string;
  managerMemberId?: string;
  managerName?: string;
}

export default function ActivityModal({ teamId, onClose, onActivityCreated, defaultAssignedTo, managerMemberId, managerName }: ActivityModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project: '',
    priority: 'MEDIUM',
    status: 'PENDING',
    environment: 'DEV',
    activity_type: 'CODE' as 'CODE' | 'DATABASE' | 'BOTH' | 'DOCUMENTATION' | 'TESTING',
    start_date: '',
    end_date: '',
    team_member_id: '',
    shared_with_member_id: '',
  });

  const [taskSteps, setTaskSteps] = useState<any[]>([
    { type: 'DATABASE', title: '', description: '', assigned_member_id: '' },
  ]);

  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCollaborators();
  }, [teamId, defaultAssignedTo]);

  const loadCollaborators = async () => {
    const { data } = await supabase
      .from('team_members')
      .select('id, name, email, position')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });

    if (data) {
      setCollaborators(data);
      if (data.length > 0) {
        const assignedId = defaultAssignedTo || data[0].id;
        setFormData((prev) => ({ ...prev, team_member_id: assignedId }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Por favor ingresa un título');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No hay usuario autenticado');

      if (!formData.team_member_id) {
        throw new Error('No hay colaborador seleccionado');
      }

      const sharedMember = collaborators.find((c: any) => c.id === formData.shared_with_member_id);
      const activityData: Record<string, any> = {
        team_id: teamId,
        created_by: user.id,
        team_member_id: formData.team_member_id,
        assigned_to: user.id,
        title: formData.title,
        description: formData.description,
        project: formData.project.trim(),
        priority: formData.priority,
        status: formData.status,
        environment: formData.environment,
        activity_type: formData.activity_type,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        shared_with_member_id: formData.shared_with_member_id || null,
        shared_with_member_name: sharedMember?.name ?? null,
      };

      // Register project name in central catalog
      if (formData.project.trim()) {
        await supabase
          .from('team_projects')
          .upsert({ team_id: teamId, name: formData.project.trim() }, { onConflict: 'team_id,name', ignoreDuplicates: true });
      }

      const { data: activity, error: activityError } = await supabase
        .from('activities')
        .insert(activityData)
        .select()
        .maybeSingle();

      if (activityError) {
        console.error('Error creando actividad:', activityError);
        throw new Error(`Error al crear actividad: ${activityError.message}`);
      }

      if (!activity) throw new Error('No se creó la actividad');

      // Notify primary collaborator
      await createNotification(
        formData.team_member_id,
        activity.id,
        `Nueva actividad: ${formData.title.trim()}`,
        [
          formData.project ? `Proyecto: ${formData.project.trim()}` : '',
          `Prioridad: ${{ HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' }[formData.priority] ?? formData.priority} · Ambiente: ${formData.environment}`,
          formData.description ? formData.description.substring(0, 100) : '',
        ].filter(Boolean).join(' · '),
        'ACTIVITY_CREATED'
      );

      // Notify second member if present
      if (formData.shared_with_member_id && formData.shared_with_member_id !== formData.team_member_id) {
        const validStepsForShared = taskSteps.filter(s => s.title.trim() && s.assigned_member_id === formData.shared_with_member_id);
        await createNotification(
          formData.shared_with_member_id,
          activity.id,
          `Actividad compartida contigo: ${formData.title.trim()}`,
          [
            formData.project ? `Proyecto: ${formData.project.trim()}` : '',
            `Tienes ${validStepsForShared.length} paso(s) asignados`,
          ].filter(Boolean).join(' · '),
          'ACTIVITY_CREATED'
        );
      }

      // Create task steps
      const validSteps = taskSteps.filter((step) => step.title.trim());
      if (validSteps.length > 0) {
        const stepsToInsert = validSteps.map((step, index) => {
          const assignedMember = collaborators.find((c: any) => c.id === step.assigned_member_id);
          return {
            activity_id: activity.id,
            step_type: step.type,
            title: step.title,
            description: step.description || null,
            order_index: index,
            assigned_member_id: step.assigned_member_id || null,
            assigned_member_name: assignedMember?.name ?? null,
          };
        });

        const { error: stepsError } = await supabase.from('task_steps').insert(stepsToInsert);
        if (stepsError) {
          console.error('Error creando pasos:', stepsError);
        }
      }

      onActivityCreated();
      onClose();
    } catch (err) {
      console.error('Error en handleSubmit:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStep = (index: number, field: string, value: string) => {
    setTaskSteps(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addTaskStep = () => {
    setTaskSteps([...taskSteps, { type: 'CODE', title: '', description: '', assigned_member_id: '' }]);
  };

  const removeTaskStep = (index: number) => {
    setTaskSteps(taskSteps.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800 rounded-xl border border-slate-700 max-w-2xl w-full flex flex-col" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        {/* Fixed header */}
        <div className="bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between shrink-0 rounded-t-xl">
          <h2 className="text-xl font-bold text-white">Nueva Actividad</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition p-1"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        <div className="overflow-y-auto flex-1 p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white">Información General</h3>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Título *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Título de la actividad"
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Descripción</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción detallada..."
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500 resize-none h-24"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Proyecto</label>
              <ProjectCombobox
                teamId={teamId}
                value={formData.project}
                onChange={val => setFormData(prev => ({ ...prev, project: val }))}
                placeholder="Seleccionar o escribir proyecto..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Prioridad</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded focus:outline-none"
                >
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Estado</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded focus:outline-none"
                >
                  <option value="PENDING">Pendiente</option>
                  <option value="IN_PROGRESS">En Proceso</option>
                  <option value="COMPLETED">Completada</option>
                </select>
              </div>
            </div>

            {/* Ambiente */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Ambiente</label>
              <div className="grid grid-cols-4 gap-2">
                {(['DEV', 'QA', 'STAGING', 'PROD'] as const).map(env => {
                  const colors: Record<string, string> = {
                    DEV:     'border-blue-500 bg-blue-500/20 text-blue-200',
                    QA:      'border-yellow-500 bg-yellow-500/20 text-yellow-200',
                    STAGING: 'border-orange-500 bg-orange-500/20 text-orange-200',
                    PROD:    'border-red-500 bg-red-500/20 text-red-200',
                  };
                  const inactive = 'border-slate-600 bg-slate-700 text-slate-400 hover:border-slate-500';
                  const isSelected = formData.environment === env;
                  return (
                    <button
                      key={env}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, environment: env }))}
                      className={`py-2 rounded-lg border text-xs font-bold tracking-wide transition ${isSelected ? colors[env] : inactive}`}
                    >
                      {env}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                {formData.environment === 'DEV' && 'Desarrollo local — solo afecta al entorno de desarrollo'}
                {formData.environment === 'QA' && 'Control de calidad — se probará en el entorno QA antes de pasar a producción'}
                {formData.environment === 'STAGING' && 'Pre-producción — entorno espejo de producción'}
                {formData.environment === 'PROD' && 'Producción — afecta directamente al sistema en vivo'}
              </p>
            </div>

            {/* Activity type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de actividad</label>
              <div className="grid grid-cols-5 gap-2">
                {([
                  { value: 'CODE',          label: 'Código',        color: 'border-blue-500 bg-blue-500/20 text-blue-200' },
                  { value: 'DATABASE',      label: 'BD',            color: 'border-emerald-500 bg-emerald-500/20 text-emerald-200' },
                  { value: 'BOTH',          label: 'Código + BD',   color: 'border-cyan-500 bg-cyan-500/20 text-cyan-200' },
                  { value: 'DOCUMENTATION', label: 'Documentación', color: 'border-amber-500 bg-amber-500/20 text-amber-200' },
                  { value: 'TESTING',       label: 'Testing',       color: 'border-rose-500 bg-rose-500/20 text-rose-200' },
                ] as const).map(({ value, label, color }) => {
                  const isSelected = formData.activity_type === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, activity_type: value }))}
                      className={`py-2 px-1 rounded-lg border text-[11px] font-bold tracking-wide transition ${isSelected ? color : 'border-slate-600 bg-slate-700 text-slate-400 hover:border-slate-500'}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Responsable principal</label>
                <select
                  value={formData.team_member_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, team_member_id: e.target.value, shared_with_member_id: e.target.value === prev.shared_with_member_id ? '' : prev.shared_with_member_id }))}
                  className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded focus:outline-none"
                >
                  {managerMemberId && (
                    <option value={managerMemberId}>
                      {managerName ? `${managerName} — Gestor (Yo)` : 'Yo (Gestor)'}
                    </option>
                  )}
                  {collaborators
                    .filter(c => c.id !== managerMemberId)
                    .map((collab) => (
                      <option key={collab.id} value={collab.id}>
                        {collab.name} — {collab.position}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Segundo integrante <span className="text-slate-500 font-normal">(opcional)</span></label>
                <select
                  value={formData.shared_with_member_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, shared_with_member_id: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded focus:outline-none"
                >
                  <option value="">— Sin segundo integrante —</option>
                  {collaborators
                    .filter(c => c.id !== formData.team_member_id)
                    .map((collab) => (
                      <option key={collab.id} value={collab.id}>
                        {collab.name} — {collab.position}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Fecha Inicio</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Fecha Termino</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Task Steps */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Pasos de la Actividad</h3>
              <button
                type="button"
                onClick={addTaskStep}
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition"
              >
                <Plus size={18} />
                Agregar Paso
              </button>
            </div>

            <div className="space-y-3">
              {taskSteps.map((step, index) => (
                <div
                  key={index}
                  className="bg-slate-700 p-4 rounded border border-slate-600 space-y-2"
                >
                  <div className="flex gap-2 flex-wrap">
                    <select
                      value={step.type}
                      onChange={(e) => updateTaskStep(index, 'type', e.target.value)}
                      className="bg-slate-600 border border-slate-500 text-white px-3 py-2 rounded text-sm"
                    >
                      <option value="DATABASE">Base de Datos</option>
                      <option value="CODE">Código</option>
                      <option value="TESTING">Testing</option>
                      <option value="DOCUMENTATION">Documentación</option>
                    </select>
                    <div className="flex items-center gap-1.5 flex-1 min-w-32">
                      <UserCircle2 size={14} className="text-slate-400 shrink-0" />
                      <select
                        value={step.assigned_member_id || ''}
                        onChange={(e) => updateTaskStep(index, 'assigned_member_id', e.target.value)}
                        className="flex-1 bg-slate-600 border border-slate-500 text-white px-2 py-2 rounded text-sm"
                      >
                        <option value="">Sin asignar</option>
                        {[
                          collaborators.find((c: any) => c.id === formData.team_member_id),
                          formData.shared_with_member_id ? collaborators.find((c: any) => c.id === formData.shared_with_member_id) : null,
                        ].filter(Boolean).map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    {taskSteps.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTaskStep(index)}
                        className="text-red-400 hover:text-red-300 transition p-2"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    value={step.title}
                    onChange={(e) => updateTaskStep(index, 'title', e.target.value)}
                    placeholder="Título del paso"
                    className="w-full bg-slate-600 border border-slate-500 text-white px-3 py-2 rounded text-sm focus:outline-none"
                  />

                  <textarea
                    value={step.description || ''}
                    onChange={(e) => updateTaskStep(index, 'description', e.target.value)}
                    placeholder="Descripción (opcional)"
                    className="w-full bg-slate-600 border border-slate-500 text-white px-3 py-2 rounded text-sm focus:outline-none resize-none h-16"
                  />
                </div>
              ))}
            </div>
          </div>

        </div>{/* end scrollable area */}

          {/* Fixed footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-slate-700 bg-slate-800 shrink-0 rounded-b-xl">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-lg transition font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2.5 rounded-lg transition font-semibold"
            >
              {loading ? 'Creando...' : 'Crear Actividad'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}