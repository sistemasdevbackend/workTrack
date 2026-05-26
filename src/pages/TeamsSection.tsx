import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Users, Calendar } from 'lucide-react';

interface TeamsSectionProps {
  selectedTeam: string;
  onTeamSelect: (teamId: string) => void;
}

export default function TeamsSection({ selectedTeam, onTeamSelect }: TeamsSectionProps) {
  const [teams, setTeams] = useState<any[]>([]);
  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('teams')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      setTeams(data);
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({ name: newTeamName, created_by: user.id })
        .select()
        .single();

      if (teamError) throw teamError;

      if (team) {
        const { error: memberError } = await supabase.from('team_members').insert({
          team_id: team.id,
          user_id: user.id,
          email: user.email || '',
          name: user.email?.split('@')[0] || 'Admin',
          position: 'Admin',
          role: 'admin',
        });

        if (memberError) {
          console.error('Error agregando miembro:', memberError);
          alert('Equipo creado pero hubo un error al agregar el miembro: ' + memberError.message);
        }

        setTeams([...teams, team]);
        onTeamSelect(team.id);
        setNewTeamName('');
        setShowNewTeam(false);
      }
    } catch (err: any) {
      console.error('Error creando equipo:', err);
      alert('Error: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este equipo? Se eliminarán todas sus actividades.')) return;

    try {
      await supabase.from('teams').delete().eq('id', teamId);
      setTeams(teams.filter(t => t.id !== teamId));
      if (selectedTeam === teamId) {
        onTeamSelect('');
      }
    } catch (err) {
      console.error(err);
      alert('Error al eliminar equipo');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Gestionar Equipos</h2>
          <p className="text-slate-400 text-sm mt-1">Crea y administra tus equipos de trabajo</p>
        </div>
        <button
          onClick={() => setShowNewTeam(!showNewTeam)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus size={20} />
          Nuevo Equipo
        </button>
      </div>

      {showNewTeam && (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Crear Nuevo Equipo</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Nombre del Equipo *</label>
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Backend, Frontend, Design, etc."
                className="w-full bg-slate-700 border border-slate-600 text-white px-4 py-2 rounded focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreateTeam}
                disabled={loading || !newTeamName.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium py-2 rounded transition"
              >
                {loading ? 'Creando...' : 'Crear Equipo'}
              </button>
              <button
                onClick={() => setShowNewTeam(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {teams.length === 0 ? (
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
            <p className="text-slate-400">No hay equipos creados aún</p>
          </div>
        ) : (
          teams.map((team) => (
            <div
              key={team.id}
              onClick={() => onTeamSelect(team.id)}
              className={`rounded-lg border transition cursor-pointer p-4 ${
                selectedTeam === team.id
                  ? 'bg-blue-600 border-blue-500'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className={`font-semibold text-lg ${selectedTeam === team.id ? 'text-white' : 'text-white'}`}>
                    {team.name}
                  </p>
                  <div className="flex items-center gap-4 text-sm mt-2">
                    <div className={`flex items-center gap-1 ${selectedTeam === team.id ? 'text-blue-100' : 'text-slate-400'}`}>
                      <Calendar size={14} />
                      {new Date(team.created_at).toLocaleDateString('es-ES')}
                    </div>
                    <div className={`flex items-center gap-1 ${selectedTeam === team.id ? 'text-blue-100' : 'text-slate-400'}`}>
                      <Users size={14} />
                      {team.member_count || 0} miembros
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteTeam(team.id);
                  }}
                  className={`p-2 rounded transition ${selectedTeam === team.id ? 'hover:bg-blue-700' : 'hover:bg-red-500/20'} ${selectedTeam === team.id ? 'text-blue-100' : 'text-red-400 hover:text-red-300'}`}
                  title="Eliminar equipo"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
