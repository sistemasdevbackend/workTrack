import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus } from 'lucide-react';
import ActivityCard from './ActivityCard';
import ActivityModal from './ActivityModal';
import StatsPanel from './StatsPanel';

interface KanbanBoardProps {
  teamId: string;
}

export default function KanbanBoard({ teamId }: KanbanBoardProps) {
  const [activities, setActivities] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();
    const subscription = supabase
      .channel(`activities-${teamId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities', filter: `team_id=eq.${teamId}` },
        () => loadActivities()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [teamId]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('activities')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      setActivities(data || []);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return 'bg-red-500';
      case 'MEDIUM':
        return 'bg-yellow-500';
      case 'LOW':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-red-500';
      case 'IN_PROGRESS':
        return 'bg-yellow-500';
      case 'COMPLETED':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const statuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

  if (loading) {
    return <div className="text-white text-center py-8">Cargando...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Tablero Kanban</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
        >
          <Plus size={20} />
          Nueva Actividad
        </button>
      </div>

      <StatsPanel teamId={teamId} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statuses.map((status) => (
          <div key={status} className="bg-slate-800 rounded-lg border border-slate-700 p-4 min-h-96">
            <div className={`${getStatusColor(status)} w-full h-2 rounded mb-4`}></div>
            <h3 className="font-bold text-white mb-4 text-center">
              {status === 'PENDING' ? 'PENDIENTES' : status === 'IN_PROGRESS' ? 'EN PROCESO' : 'COMPLETADAS'}
            </h3>

            <div className="space-y-3">
              {activities
                .filter((a) => a.status === status)
                .map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onRefresh={loadActivities}
                    getPriorityColor={getPriorityColor}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <ActivityModal
          teamId={teamId}
          onClose={() => setShowModal(false)}
          onActivityCreated={loadActivities}
        />
      )}
    </div>
  );
}
