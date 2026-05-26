import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Users } from 'lucide-react';

interface TeamSelectorProps {
  onTeamSelect: (teamId: string) => void;
  selectedTeam: string;
}

export default function TeamSelector({ onTeamSelect, selectedTeam }: TeamSelectorProps) {
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
      .from('team_members')
      .select('teams(*)')
      .eq('user_id', user.id);

    if (data) {
      const teamList = data.map((tm: any) => tm.teams).filter(Boolean);
      setTeams(teamList);
      if (teamList.length > 0 && !selectedTeam) {
        onTeamSelect(teamList[0].id);
      }
    }
  };

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user');

      const { data: team } = await supabase
        .from('teams')
        .insert({ name: newTeamName })
        .select()
        .single();

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

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users size={24} className="text-blue-400" />
          <h2 className="text-xl font-bold text-white">Equipos</h2>
        </div>
        <button
          onClick={() => setShowNewTeam(!showNewTeam)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition"
        >
          <Plus size={18} />
          Nuevo Equipo
        </button>
      </div>

      {showNewTeam && (
        <div className="mb-4 p-4 bg-slate-700/50 rounded-lg space-y-3">
          <input
            type="text"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Nombre del equipo..."
            className="w-full bg-slate-600 border border-slate-500 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500"
            autoFocus
          />
          <button
            onClick={handleCreateTeam}
            disabled={loading || !newTeamName.trim()}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded transition"
          >
            {loading ? 'Creando...' : 'Crear Equipo'}
          </button>
        </div>
      )}

      {teams.length === 0 && !showNewTeam && (
        <p className="text-slate-400 text-center py-4">No tienes equipos aún. Crea uno para comenzar.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {teams.map((team) => (
          <button
            key={team.id}
            onClick={() => onTeamSelect(team.id)}
            className={`p-4 rounded-lg border-2 transition transform hover:scale-105 ${
              selectedTeam === team.id
                ? 'bg-blue-600 border-blue-400'
                : 'bg-slate-700 border-slate-600 hover:border-blue-400'
            }`}
          >
            <p className="font-semibold text-white">{team.name}</p>
            <p className="text-xs text-slate-300 mt-1">
              {new Date(team.created_at).toLocaleDateString()}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
