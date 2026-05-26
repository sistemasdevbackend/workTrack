import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  ShieldCheck, Search, Filter, X, CheckCircle2, XCircle,
  RotateCcw, Plus, Pencil, Trash2, Clock, Users, BookOpen,
  GitCommitHorizontal, ChevronDown, ChevronUp,
} from 'lucide-react';

interface AuditLog {
  id: string;
  team_id: string;
  actor_id: string | null;
  actor_member_id: string | null;
  actor_name: string;
  actor_role: string;
  actor_type: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string;
  meta: Record<string, unknown>;
  created_at: string;
}

interface Props {
  teamId: string;
}

const ACTION_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  CREATE: { label: 'Creó',    icon: Plus,         color: 'text-green-400',  bg: 'bg-green-500/15 border-green-500/30' },
  UPDATE: { label: 'Editó',   icon: Pencil,       color: 'text-blue-400',   bg: 'bg-blue-500/15 border-blue-500/30' },
  DELETE: { label: 'Eliminó', icon: Trash2,       color: 'text-red-400',    bg: 'bg-red-500/15 border-red-500/30' },
};

const RESOURCE_META: Record<string, { label: string; icon: any; color: string }> = {
  changelog_entry:   { label: 'Liberación',    icon: GitCommitHorizontal, color: 'text-cyan-400' },
  changelog_project: { label: 'Proyecto CdC',  icon: GitCommitHorizontal, color: 'text-blue-400' },
  doc_entry:         { label: 'Documentación', icon: BookOpen,            color: 'text-amber-400' },
};

const STATUS_COLOR: Record<string, string> = {
  SUCCESS:  'text-green-400',
  FAILED:   'text-red-400',
  ROLLBACK: 'text-rose-400',
  PENDING:  'text-yellow-400',
};

const STATUS_LABEL: Record<string, string> = {
  SUCCESS: 'Exitoso', FAILED: 'Fallido', ROLLBACK: 'Rollback', PENDING: 'Pendiente',
};

function MetaBadges({ meta }: { meta: Record<string, unknown> }) {
  const badges: { label: string; color: string }[] = [];
  if (meta.environment) badges.push({ label: String(meta.environment), color: 'text-slate-300 bg-slate-700' });
  if (meta.status) badges.push({ label: STATUS_LABEL[String(meta.status)] ?? String(meta.status), color: `${STATUS_COLOR[String(meta.status)] ?? 'text-slate-300'} bg-slate-700/50` });
  if (meta.change_type) badges.push({ label: String(meta.change_type), color: 'text-slate-400 bg-slate-700/40' });
  if (meta.doc_type) badges.push({ label: String(meta.doc_type), color: 'text-amber-400 bg-amber-500/10' });
  if (meta.project_name) badges.push({ label: String(meta.project_name), color: 'text-blue-400 bg-blue-500/10' });
  if (badges.length === 0) return null;
  return (
    <div className="flex gap-1.5 flex-wrap mt-1">
      {badges.map((b, i) => (
        <span key={i} className={`text-xs px-1.5 py-0.5 rounded font-mono ${b.color}`}>{b.label}</span>
      ))}
    </div>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const action = ACTION_META[log.action] ?? ACTION_META.UPDATE;
  const resource = RESOURCE_META[log.entity_type] ?? { label: log.entity_type, icon: ShieldCheck, color: 'text-slate-400' };
  const ActionIcon = action.icon;
  const ResourceIcon = resource.icon;
  const date = new Date(log.created_at);

  return (
    <div className={`border rounded-lg px-4 py-3 transition ${action.bg}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-1.5 rounded-lg bg-slate-900/50 ${action.color}`}>
          <ActionIcon size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold uppercase tracking-wide ${action.color}`}>{action.label}</span>
            <span className={`flex items-center gap-1 text-xs font-medium ${resource.color}`}>
              <ResourceIcon size={11} />{resource.label}
            </span>
            <span className="text-white text-sm font-semibold truncate max-w-xs">{log.entity_label || '—'}</span>
          </div>
          <MetaBadges meta={log.meta} />
          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
            <span className={`flex items-center gap-1 font-medium ${log.actor_type === 'manager' ? 'text-blue-400' : 'text-emerald-400'}`}>
              <Users size={11} />
              {log.actor_name || '—'}
              <span className="text-slate-600 font-normal">({log.actor_type === 'manager' ? 'Gestor' : 'Colaborador'})</span>
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' '}
              {date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        {Object.keys(log.meta).length > 0 && (
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded transition shrink-0">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-slate-700/50 pl-10">
          <pre className="text-xs text-slate-400 font-mono whitespace-pre-wrap">{JSON.stringify(log.meta, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 50;

export default function AuditLogSection({ teamId }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterResource, setFilterResource] = useState('ALL');
  const [filterActor, setFilterActor] = useState('ALL');

  const load = useCallback(async (pg: number) => {
    setLoading(true);
    let q = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .range(pg * PAGE_SIZE, (pg + 1) * PAGE_SIZE - 1);

    if (filterAction !== 'ALL') q = q.eq('action', filterAction);
    if (filterResource !== 'ALL') q = q.eq('entity_type', filterResource);
    if (filterActor !== 'ALL') q = q.eq('actor_type', filterActor);
    if (search.trim()) q = q.ilike('entity_label', `%${search.trim()}%`);

    const { data, count } = await q;
    setLogs(data || []);
    setTotal(count ?? 0);
    setLoading(false);
  }, [teamId, filterAction, filterResource, filterActor, search]);

  useEffect(() => { setPage(0); }, [filterAction, filterResource, filterActor, search]);
  useEffect(() => { load(page); }, [load, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const clearFilters = () => {
    setFilterAction('ALL');
    setFilterResource('ALL');
    setFilterActor('ALL');
    setSearch('');
  };

  const hasFilters = filterAction !== 'ALL' || filterResource !== 'ALL' || filterActor !== 'ALL' || search;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 rounded-lg">
            <ShieldCheck size={20} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white leading-none">Bitácora de Auditoría</h2>
            <p className="text-slate-400 text-sm mt-0.5">Registro de cambios realizados por gestores y colaboradores</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white leading-none">{total}</p>
          <p className="text-xs text-slate-500 mt-0.5">registros totales</p>
        </div>
      </div>

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Creaciones', action: 'CREATE', icon: Plus,   color: 'text-green-400', active: 'border-green-500 bg-green-500/10' },
          { label: 'Ediciones',  action: 'UPDATE', icon: Pencil, color: 'text-blue-400',  active: 'border-blue-500 bg-blue-500/10' },
          { label: 'Eliminaciones', action: 'DELETE', icon: Trash2, color: 'text-red-400', active: 'border-red-500 bg-red-500/10' },
        ].map(s => {
          const Icon = s.icon;
          const isActive = filterAction === s.action;
          return (
            <button
              key={s.action}
              onClick={() => setFilterAction(isActive ? 'ALL' : s.action)}
              className={`bg-slate-800 border rounded-xl px-4 py-3 flex items-center gap-3 text-left transition hover:border-slate-500 ${isActive ? s.active : 'border-slate-700'}`}
            >
              <Icon size={16} className={s.color} />
              <span className="text-slate-400 text-sm">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-40">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título..."
            className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
        <Filter size={13} className="text-slate-500 shrink-0" />
        <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="ALL">Todas las acciones</option>
          <option value="CREATE">Creaciones</option>
          <option value="UPDATE">Ediciones</option>
          <option value="DELETE">Eliminaciones</option>
        </select>
        <select value={filterResource} onChange={e => setFilterResource(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="ALL">Todos los recursos</option>
          <option value="changelog_entry">Liberaciones</option>
          <option value="changelog_project">Proyectos CdC</option>
          <option value="doc_entry">Documentación</option>
        </select>
        <select value={filterActor} onChange={e => setFilterActor(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
          <option value="ALL">Todos los actores</option>
          <option value="manager">Gestor</option>
          <option value="collaborator">Colaborador</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg px-2.5 py-2 transition">
            <X size={12} />
            Limpiar
          </button>
        )}
      </div>

      {/* Log list */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Cargando registros...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <ShieldCheck size={48} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">{hasFilters ? 'Sin resultados para los filtros aplicados' : 'Aún no hay registros de auditoría'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => <LogRow key={log.id} log={log} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">
            Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Anterior
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
