import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Users } from 'lucide-react';

interface CollaboratorManagerProps {
  teamId: string;
}

export default function CollaboratorManager({ teamId }: CollaboratorManagerProps) {
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    position: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCollaborators();
  }, [teamId]);

  const loadCollaborators = async () => {
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });

    if (data) {
      setCollaborators(data);
    }
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
        if (error.message.includes('duplicate')) {
          alert('Este email ya es miembro del equipo.');
        } else {
          throw error;
        }
      } else {
        setFormData({ email: '', name: '', position: '' });
        setShowAddForm(false);
        loadCollaborators();
      }
    } catch (err: any) {
      console.error(err);
      alert('Error al agregar colaborador: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCollaborator = async (memberId: string) => {
    if (!confirm('¿Estás seguro de que quieres remover este colaborador?')) return;

    try {
      await supabase.from('team_members').delete().eq('id', memberId);
      loadCollaborators();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={24} className="text-blue-400" />
          <h2 className="text-xl font-bold text-white">Colaboradores</h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition"
        >
          <Plus size={18} />
          Agregar Colaborador
        </button>
      </div>

      {showAddForm && (
        <div className="mb-4 p-4 bg-slate-700/50 rounded-lg space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="colaborador@email.com"
              className="w-full bg-slate-600 border border-slate-500 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Nombre</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Juan Pérez"
              className="w-full bg-slate-600 border border-slate-500 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Puesto</label>
            <input
              type="text"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              placeholder="Developer, Designer, QA, etc."
              className="w-full bg-slate-600 border border-slate-500 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleAddCollaborator}
            disabled={loading || !formData.email.trim() || !formData.name.trim()}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded transition"
          >
            {loading ? 'Agregando...' : 'Agregar Colaborador'}
          </button>
        </div>
      )}

      {collaborators.length === 0 ? (
        <p className="text-slate-400 text-center py-4">
          No hay colaboradores. Agrega uno para comenzar.
        </p>
      ) : (
        <div className="space-y-2">
          {collaborators.map((collab) => (
            <div
              key={collab.id}
              className="flex items-center justify-between bg-slate-700 p-3 rounded-lg border border-slate-600 hover:border-blue-400 transition"
            >
              <div className="flex-1">
                <p className="font-medium text-white">{collab.name}</p>
                <p className="text-xs text-slate-300">{collab.email}</p>
                <p className="text-xs text-slate-400">{collab.position}</p>
              </div>
              <button
                onClick={() => handleRemoveCollaborator(collab.id)}
                className="text-red-400 hover:text-red-300 transition p-2"
                title="Remover colaborador"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
