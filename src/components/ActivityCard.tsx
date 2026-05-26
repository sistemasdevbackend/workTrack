import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MessageSquare, ChevronDown, ChevronUp, Calendar, AlertTriangle, Clock, Users } from 'lucide-react';
import ActivityDetail from './ActivityDetail';
import { formatDate, getDaysUntilDue } from '../lib/utils';

interface ActivityCardProps {
  activity: any;
  onRefresh: () => void;
  getPriorityColor: (priority: string) => string;
}

export default function ActivityCard({ activity, onRefresh, getPriorityColor }: ActivityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const daysUntilDue = getDaysUntilDue(activity.end_date);
  const isFinished = ['APPROVED', 'IN_REVIEW', 'COMPLETED', 'NEEDS_REVISION'].includes(activity.status);

  const isOverdue  = !isFinished && daysUntilDue !== null && daysUntilDue < 0;
  const isUrgent   = !isFinished && daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 2;

  useEffect(() => {
    loadCommentCount();
  }, [activity.id]);

  const loadCommentCount = async () => {
    const { count } = await supabase
      .from('activity_revisions')
      .select('id', { count: 'exact', head: true })
      .eq('activity_id', activity.id);
    setCommentCount(count ?? 0);
  };

  const getPriorityLabel = (priority: string) => (
    { HIGH: 'ALTA', MEDIUM: 'MEDIA', LOW: 'BAJA' }[priority] ?? priority
  );

  const getPriorityBgColor = (priority: string) => (
    { HIGH: 'bg-red-500/20 border-red-500/50', MEDIUM: 'bg-yellow-500/20 border-yellow-500/50', LOW: 'bg-green-500/20 border-green-500/50' }[priority] ?? 'bg-slate-700 border-slate-600'
  );

  const getPriorityBarColor = (priority: string) => (
    { HIGH: 'bg-red-500', MEDIUM: 'bg-yellow-500', LOW: 'bg-green-500' }[priority] ?? 'bg-slate-500'
  );

  const cardBorder = isOverdue
    ? 'bg-red-950/25 border-red-500/50 hover:border-red-400/70'
    : isUrgent
    ? 'bg-amber-950/15 border-amber-500/40 hover:border-amber-400/60'
    : `${getPriorityBgColor(activity.priority)} hover:opacity-80`;

  const accentBar = isOverdue ? 'bg-red-500' : isUrgent ? 'bg-amber-500' : getPriorityBarColor(activity.priority);

  const dueDateBadge = isOverdue
    ? { label: `Venció hace ${Math.abs(daysUntilDue!)}d`, cls: 'bg-red-500/20 text-red-300 border-red-500/30', icon: <AlertTriangle size={10} /> }
    : isUrgent && daysUntilDue === 0
    ? { label: 'Vence hoy', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30', icon: <Clock size={10} /> }
    : isUrgent
    ? { label: `Vence en ${daysUntilDue}d`, cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25', icon: <Clock size={10} /> }
    : null;

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className={`rounded-lg p-3 cursor-pointer transition group border ${cardBorder}`}
      >
        <div className={`${accentBar} w-full h-1 rounded mb-2`} />

        {/* Overdue banner — visible even collapsed */}
        {isOverdue && (
          <div className="flex items-center gap-1.5 mb-2 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5">
            <AlertTriangle size={11} className="text-red-400 shrink-0" />
            <span className="text-[11px] font-bold text-red-300">
              Actividad vencida hace {Math.abs(daysUntilDue!)} día{Math.abs(daysUntilDue!) !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Priority + date badges row */}
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${
                activity.priority === 'HIGH'   ? 'bg-red-500/30 text-red-200'
                : activity.priority === 'MEDIUM' ? 'bg-yellow-500/30 text-yellow-200'
                : 'bg-green-500/30 text-green-200'
              }`}>
                {getPriorityLabel(activity.priority)}
              </span>
              {activity.activity_type && (() => {
                const s: Record<string, string> = {
                  CODE: 'bg-blue-500/15 text-blue-300', DATABASE: 'bg-emerald-500/15 text-emerald-300',
                  BOTH: 'bg-cyan-500/15 text-cyan-300', DOCUMENTATION: 'bg-amber-500/15 text-amber-300',
                  TESTING: 'bg-rose-500/15 text-rose-300',
                };
                const l: Record<string, string> = { CODE: 'Código', DATABASE: 'BD', BOTH: 'Cód+BD', DOCUMENTATION: 'Docs', TESTING: 'Testing' };
                return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${s[activity.activity_type] ?? 'bg-slate-700 text-slate-400'}`}>{l[activity.activity_type] ?? activity.activity_type}</span>;
              })()}
              {activity.project && (
                <span className="text-[10px] text-slate-500 bg-slate-700/60 px-1.5 py-0.5 rounded truncate max-w-[100px]">{activity.project}</span>
              )}
              {activity._shared && (
                <span className="flex items-center gap-0.5 text-[10px] font-semibold text-cyan-300 bg-cyan-500/15 border border-cyan-500/25 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  <Users size={9} />
                  Compartida
                </span>
              )}
              {dueDateBadge && !isOverdue && (
                <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${dueDateBadge.cls}`}>
                  {dueDateBadge.icon}
                  {dueDateBadge.label}
                </span>
              )}
            </div>

            {/* Title — 2 lines max */}
            <h4 className={`text-sm font-semibold leading-snug line-clamp-2 group-hover:text-blue-300 transition ${isOverdue ? 'text-red-100' : 'text-white'}`}>
              {activity.title}
            </h4>

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <p className="text-[10px] text-slate-500">
                {new Date(activity.created_at).toLocaleDateString('es-MX')}
              </p>
              {commentCount > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] text-slate-500">
                  <MessageSquare size={10} />
                  {commentCount}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-slate-400 hover:text-white transition flex-shrink-0 mt-0.5"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-600/50 space-y-2">
            {activity.description && (
              <p className="text-xs text-slate-300 line-clamp-3">{activity.description}</p>
            )}
            {activity.end_date && (
              <div className="flex items-center gap-1.5">
                <Calendar size={12} className="text-slate-400" />
                <span className={`text-xs ${isOverdue ? 'text-red-400 font-semibold' : isUrgent ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>
                  {formatDate(activity.end_date)}
                  {daysUntilDue !== null && daysUntilDue < 0
                    ? ` — venció hace ${Math.abs(daysUntilDue)}d`
                    : daysUntilDue !== null && ` (${daysUntilDue}d restantes)`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {showDetail && (
        <ActivityDetail
          activity={activity}
          onClose={() => setShowDetail(false)}
          onRefresh={onRefresh}
          canDelete={true}
        />
      )}
    </>
  );
}
