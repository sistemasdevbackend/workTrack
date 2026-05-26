import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Mail, Pencil, Check, X, Home } from 'lucide-react';

const POSITIONS = ['Developer', 'Diseñador', 'Becario', 'Admin', 'QA', 'PM', 'DevOps', 'Arquitecto'];

const POSITION_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Developer:   { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/50',   dot: 'bg-blue-400' },
  Diseñador:   { bg: 'bg-pink-500/20',   text: 'text-pink-300',   border: 'border-pink-500/50',   dot: 'bg-pink-400' },
  Becario:     { bg: 'bg-amber-500/20',  text: 'text-amber-300',  border: 'border-amber-500/50',  dot: 'bg-amber-400' },
  Admin:       { bg: 'bg-green-500/20',  text: 'text-green-300',  border: 'border-green-500/50',  dot: 'bg-green-400' },
  QA:          { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/50', dot: 'bg-orange-400' },
  PM:          { bg: 'bg-teal-500/20',   text: 'text-teal-300',   border: 'border-teal-500/50',   dot: 'bg-teal-400' },
  DevOps:      { bg: 'bg-cyan-500/20',   text: 'text-cyan-300',   border: 'border-cyan-500/50',   dot: 'bg-cyan-400' },
  Arquitecto:  { bg: 'bg-slate-400/20',  text: 'text-slate-200',  border: 'border-slate-400/50',  dot: 'bg-slate-300' },
};

function PositionBadge({ position }: { position: string }) {
  const style = POSITION_STYLES[position] ?? { bg: 'bg-slate-600/30', text: 'text-slate-300', border: 'border-slate-500/50', dot: 'bg-slate-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      {position || 'Sin rol'}
    </span>
  );
}

interface CollaboratorsSectionProps {
  teamId: string;
}

interface Collaborator {
  id: string;
  name: string;
  email: string;
  position: string;
}

interface HoEntry {
  id: string;
  date: string;
}

function formatDateLabel(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function HomeOfficePicker({ memberId }: { memberId: string }) {
  const [entries, setEntries] = useState<HoEntry[]>([]);
  const [adding, setAdding] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    supabase
      .from('home_office_days')
      .select('id, date')
      .eq('team_member_id', memberId)
      .gte('date', todayIso())
      .order('date', { ascending: true })
      .then(({ data }) => setEntries(data || []));
  };

  useEffect(() => { load(); }, [memberId]);

  const add = async () => {
    if (!newDate) return;
    setSaving(true);
    const { error } = await supabase
      .from('home_office_days')
      .insert({ team_member_id: memberId, date: newDate });
    setSaving(false);
    if (!error) { setNewDate(''); setAdding(false); load(); }
  };

  const remove = async (id: string) => {
    await supabase.from('home_office_days').delete().eq('id', id);
    load();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 items-center">
        {entries.length === 0 && !adding && (
          <span className="text-slate-500 text-xs">Sin días HO asignados</span>
        )}
        {entries.map((e) => (
          <span
            key={e.id}
            className="flex items-center gap-1 bg-teal-900/50 ring-1 ring-teal-700/60 text-teal-200 text-xs font-medium px-2 py-0.5 rounded-full"
          >
            {formatDateLabel(e.date)}
            <button
              onClick={() => remove(e.id)}
              className="text-teal-400 hover:text-red-400 transition ml-0.5"
            >
              <X size={11} />
            </button>
          </span>
        ))}

        {adding ? (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={newDate}
              min={todayIso()}
              onChange={(e) => setNewDate(e.target.value)}
              autoFocus
              className="bg-slate-700 border border-teal-600 text-white text-xs px-2 py-1 rounded focus:outline-none"
            />
            <button
              onClick={add}
              disabled={saving || !newDate}
              className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white p-1 rounded transition"
            >
              <Check size={12} />
            </button>
            <button
              onClick={() => { setAdding(false); setNewDate(''); }}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 transition"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 hover:bg-teal-900/30 px-2 py-0.5 rounded-full transition"
          >
            <Plus size={11} />
            Agregar fecha
          </button>
        )}
      </div>
    </div>
  );
}

export default function CollaboratorsSection({ teamId }: CollaboratorsSectionProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ email: '', name: '', position: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name: '', email: '', position: '' });
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => { loadCollaborators(); }, [teamId]);

  const loadCollaborators = async () => {
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });
    if (data) setCollaborators(data);
  };

  const handleAddCollaborator = async () => {
    if (!formData.email.trim() || !formData.name.trim()) {
      alert('Por favor completa email y nombre');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('team_members').insert({
        team_id: teamId,
        email: formData.email.trim(),
        name: formData.name.trim(),
        position: formData.position.trim() || 'Miembro',
        user_id: null,
      });
      if (error) {
        if (error.message.includes('duplicate')) alert('Este email ya es miembro del equipo.');
        else throw error;
      } else {
        setFormData({ email: '', name: '', position: '' });
        setShowAddForm(false);
        loadCollaborators();
      }
    } catch (err: any) {
      alert('Error al agregar colaborador: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (collab: Collaborator) => {
    setEditingId(collab.id);
    setEditData({ name: collab.name, email: collab.email, position: collab.position });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData({ name: '', email: '', position: '' });
  };

  const saveEdit = async (id: string) => {
    if (!editData.name.trim() || !editData.email.trim()) {
      alert('Nombre y email son obligatorios');
      return;
    }
    setSavingId(id);
    try {
      const { error } = await supabase
        .from('team_members')
        .update({
          name: editData.name.trim(),
          email: editData.email.trim(),
          position: editData.position.trim() || 'Miembro',
        })
        .eq('id', id);
      if (error) throw error;
      setEditingId(null);
      loadCollaborators();
    } catch (err: any) {
      alert('Error al guardar cambios: ' + err.message);
    } finally {
      setSavingId(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('¿Estás seguro de que quieres remover este colaborador?')) return;
    try {
      await supabase.from('team_members').delete().eq('id', memberId);
      loadCollaborators();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Gestionar Colaboradores</h2>
          <p className="text-slate-400 text-sm mt-1">Administra los miembros de tu equipo</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus size={18} />
          Agregar Colaborador
        </button>
      </div>

      {showAddForm && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <h3 className="text-base font-semibold text-white mb-4">Nuevo Colaborador</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Nombre *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nombre Completo"
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="correo@empresa.com"
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Puesto / Rol</label>
              <select
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">Seleccionar rol...</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddCollaborator}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-sm font-medium px-4 py-2 rounded transition"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setFormData({ email: '', name: '', position: '' }); }}
              className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2 rounded transition"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {collaborators.length === 0 ? (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-10 text-center">
            <p className="text-slate-400">No hay colaboradores agregados aún</p>
          </div>
        ) : (
          collaborators.map((collab) => (
            <div
              key={collab.id}
              className="bg-slate-800 rounded-lg border border-slate-700 p-4 hover:border-slate-600 transition"
            >
              {editingId === collab.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Nombre *</label>
                      <input
                        type="text"
                        value={editData.name}
                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                        className="w-full bg-slate-700 border border-blue-500 text-white px-3 py-1.5 rounded text-sm focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Email *</label>
                      <input
                        type="email"
                        value={editData.email}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        className="w-full bg-slate-700 border border-blue-500 text-white px-3 py-1.5 rounded text-sm focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Puesto / Rol</label>
                      <select
                        value={editData.position}
                        onChange={(e) => setEditData({ ...editData, position: e.target.value })}
                        className="w-full bg-slate-700 border border-blue-500 text-white px-3 py-1.5 rounded text-sm focus:outline-none"
                      >
                        <option value="">Seleccionar rol...</option>
                        {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(collab.id)}
                      disabled={savingId === collab.id}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white text-sm px-3 py-1.5 rounded transition"
                    >
                      <Check size={14} />
                      {savingId === collab.id ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-sm px-3 py-1.5 rounded transition"
                    >
                      <X size={14} />
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                        {collab.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-white text-sm">{collab.name}</p>
                          <PositionBadge position={collab.position} />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                          <Mail size={11} />
                          {collab.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEditing(collab)}
                        className="p-2 hover:bg-slate-700 rounded transition text-slate-400 hover:text-white"
                        title="Editar colaborador"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleRemove(collab.id)}
                        className="p-2 hover:bg-red-500/20 rounded transition text-red-400 hover:text-red-300"
                        title="Remover colaborador"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Home Office dates */}
                  <div className="flex items-start gap-2 pt-2 border-t border-slate-700/60">
                    <Home size={13} className="text-teal-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400 mb-1.5">Días Home Office asignados:</p>
                      <HomeOfficePicker memberId={collab.id} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
