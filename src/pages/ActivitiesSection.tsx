import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import IndividualKanbanTabs from '../components/IndividualKanbanTabs';

interface ActivitiesSectionProps {
  teamId: string;
  pendingActivityId?: string | null;
  onPendingClear?: () => void;
  managerMemberId?: string;
  managerName?: string;
  readOnly?: boolean;
  onNavigateToChangelog?: (entryId: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  IN_PROGRESS: 'En Proceso',
  COMPLETED: 'Completada',
  APPROVED: 'Aprobada',
  IN_REVIEW: 'En Revisión',
  NEEDS_REVISION: 'Necesita Revisión',
};


function escapeCell(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function ActivitiesSection({ teamId, pendingActivityId, onPendingClear, managerMemberId, managerName, readOnly = false, onNavigateToChangelog }: ActivitiesSectionProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      // Load all team members
      const { data: members } = await supabase
        .from('team_members')
        .select('id, name, email, position')
        .eq('team_id', teamId);

      const memberMap: Record<string, { name: string; email: string; position: string }> = {};
      (members || []).forEach((m: any) => {
        memberMap[m.id] = { name: m.name, email: m.email, position: m.position };
      });

      // Load all activities for the team
      const { data: activities } = await supabase
        .from('activities')
        .select('id, title, description, status, priority, project, environment, start_date, end_date, released_to_production_at, created_at, updated_at, team_member_id')
        .eq('team_id', teamId)
        .order('team_member_id', { ascending: true })
        .order('status', { ascending: true })
        .order('end_date', { ascending: true, nullsFirst: false });

      if (!activities || activities.length === 0) {
        alert('No hay actividades para exportar.');
        setExporting(false);
        return;
      }

      const headers = [
        'Colaborador',
        'Actividad',
        'Estado',
        'Ambiente',
        'Fecha Inicio',
        'Fecha Entrega',
        'Lanzado a Producción',
        'Última Actualización',
      ];

      const rows = activities.map((a: any) => {
        const member = memberMap[a.team_member_id];
        const fmtDate = (d: string | null) => d ?? '';
        const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString('es-MX') : '';

        return [
          escapeCell(member?.name ?? 'Sin asignar'),
          escapeCell(a.title),
          escapeCell(STATUS_LABEL[a.status] ?? a.status),
          escapeCell(a.environment),
          escapeCell(fmtDate(a.start_date)),
          escapeCell(fmtDate(a.end_date)),
          escapeCell(fmtDate(a.released_to_production_at)),
          escapeCell(fmtDateTime(a.updated_at)),
        ].join(',');
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const today = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `actividades_equipo_${today}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Seguimiento de Actividades</h2>
          <p className="text-slate-400 text-sm mt-1">Tablero Kanban de actividades por colaborador</p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2 rounded-xl transition shrink-0"
        >
          {exporting ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <FileDown size={15} />
          )}
          {exporting ? 'Exportando...' : 'Exportar Excel'}
        </button>
      </div>
      <IndividualKanbanTabs
        teamId={teamId}
        pendingActivityId={pendingActivityId}
        onPendingClear={onPendingClear}
        managerMemberId={managerMemberId}
        managerName={managerName}
        readOnly={readOnly}
        onNavigateToChangelog={onNavigateToChangelog}
      />
    </div>
  );
}
