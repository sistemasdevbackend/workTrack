import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

interface StatsPanelProps {
  teamId: string;
}

export default function StatsPanel({ teamId }: StatsPanelProps) {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
  });

  useEffect(() => {
    loadStats();
  }, [teamId]);

  const loadStats = async () => {
    const { data } = await supabase
      .from('activities')
      .select('status')
      .eq('team_id', teamId);

    if (data) {
      const counts = {
        total: data.length,
        pending: data.filter((a) => a.status === 'PENDING').length,
        inProgress: data.filter((a) => a.status === 'IN_PROGRESS').length,
        completed: data.filter((a) => a.status === 'COMPLETED').length,
      };
      setStats(counts);
    }
  };

  const getCompletionPercentage = () => {
    if (stats.total === 0) return 0;
    return Math.round((stats.completed / stats.total) * 100);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Total</p>
            <p className="text-3xl font-bold text-white mt-1">{stats.total}</p>
          </div>
          <div className="bg-blue-500/20 p-3 rounded-lg">
            <AlertCircle size={24} className="text-blue-400" />
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Pendientes</p>
            <p className="text-3xl font-bold text-red-400 mt-1">{stats.pending}</p>
          </div>
          <div className="bg-red-500/20 p-3 rounded-lg">
            <AlertCircle size={24} className="text-red-400" />
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">En Proceso</p>
            <p className="text-3xl font-bold text-yellow-400 mt-1">{stats.inProgress}</p>
          </div>
          <div className="bg-yellow-500/20 p-3 rounded-lg">
            <Clock size={24} className="text-yellow-400" />
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-sm">Completadas</p>
            <p className="text-3xl font-bold text-green-400 mt-1">{stats.completed}</p>
            <p className="text-xs text-slate-400 mt-1">{getCompletionPercentage()}%</p>
          </div>
          <div className="bg-green-500/20 p-3 rounded-lg">
            <CheckCircle size={24} className="text-green-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
