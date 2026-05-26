import {
  Users, CheckSquare, Settings, Building2, LogOut, Menu, X,
  CalendarDays, GitCommitHorizontal, BookOpen, ShieldCheck,
  ClipboardCheck, Shield, KeyRound, Layers, Eye, Wrench, BarChart2,
} from 'lucide-react';
import { useState } from 'react';
import NotificationBell, { NotifNavTarget } from './NotificationBell';

type Section = 'collaborators' | 'activities' | 'review' | 'teams' | 'settings' | 'calendar' | 'changelog' | 'documentation' | 'audit' | 'permissions' | 'projects' | 'utilities';

interface NavbarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  userEmail?: string;
  onLogout: () => void;
  pendingReviewCount?: number;
  managerMemberId?: string;
  teamName?: string;
  isSuperAdmin?: boolean;
  onNotifNavigate?: (target: NotifNavTarget) => void;
  onSwitchToSupervisor?: () => void;
}

const sections = [
  { id: 'collaborators'  as Section, label: 'Colaboradores',     icon: Users,               description: 'Gestionar colaboradores' },
  { id: 'activities'     as Section, label: 'Seguimiento',        icon: CheckSquare,         description: 'Tablero Kanban' },
  { id: 'review'         as Section, label: 'Revisión',           icon: ClipboardCheck,      description: 'Actividades completadas' },
  { id: 'projects'       as Section, label: 'Proyectos',          icon: Layers,              description: 'Estatus por proyecto' },
  { id: 'calendar'       as Section, label: 'Calendario',         icon: CalendarDays,        description: 'HO y vacaciones' },
  { id: 'changelog'      as Section, label: 'Control de Cambios', icon: GitCommitHorizontal, description: 'Bitácora de releases' },
  { id: 'documentation'  as Section, label: 'Documentación',      icon: BookOpen,            description: 'Docs técnicos' },
  { id: 'audit'          as Section, label: 'Auditoría',          icon: ShieldCheck,         description: 'Registro de cambios' },
  { id: 'utilities'      as Section, label: 'Utilerías',          icon: Wrench,              description: 'Queries, guías y más' },
  { id: 'permissions'    as Section, label: 'Permisos',           icon: KeyRound,            description: 'Acceso por colaborador' },
  { id: 'settings'       as Section, label: 'Configuración',      icon: Settings,            description: 'Ajustes y preferencias' },
];

export default function Navbar({
  activeSection, onSectionChange, userEmail, onLogout,
  pendingReviewCount = 0, managerMemberId = '', teamName,
  isSuperAdmin = false, onNotifNavigate, onSwitchToSupervisor,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Top header */}
      <header
        className="h-14 flex items-center justify-between px-4 shrink-0"
        style={{
          background: 'linear-gradient(90deg,#060a12 0%,#0b1120 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-1.5 text-slate-400 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', boxShadow: '0 2px 12px rgba(14,165,233,0.35)' }}>
              <BarChart2 size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-black text-white leading-none tracking-tight">WorkTrack</h1>
              <p className="text-slate-500 text-xs leading-none mt-0.5">
                {teamName ?? 'Panel de Gestión'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {teamName && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Building2 size={12} className="text-slate-400" />
              <span className="text-xs text-slate-300 font-medium">{teamName}</span>
            </div>
          )}
          {onSwitchToSupervisor && (
            <button
              onClick={onSwitchToSupervisor}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              style={{ color: '#38bdf8', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(56,189,248,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(56,189,248,0.08)'; }}
            >
              <Eye size={13} />Vista Supervisor
            </button>
          )}
          {managerMemberId && <NotificationBell memberId={managerMemberId} onNavigate={onNotifNavigate} />}
          <div className="text-right hidden sm:block">
            <p className="text-sm text-slate-200 leading-none font-medium">{userEmail}</p>
            <p className={`text-xs mt-0.5 font-semibold ${isSuperAdmin ? 'text-amber-400' : 'text-sky-400'}`}>
              {isSuperAdmin ? 'Super Admin' : 'Gestor'}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 text-slate-500 hover:text-white rounded-lg transition"
            style={{ background: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <LogOut size={17} />
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <div className={`fixed top-14 left-0 h-[calc(100vh-56px)] w-56 z-30 transition-transform duration-200 md:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: '#0b1120', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
        <SidebarContent
          activeSection={activeSection}
          onSectionChange={(s) => { onSectionChange(s); setMobileOpen(false); }}
          onLogout={onLogout}
          pendingReviewCount={pendingReviewCount}
          isSuperAdmin={isSuperAdmin}
        />
      </div>
    </>
  );
}

interface SidebarProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
  onLogout?: () => void;
  pendingReviewCount?: number;
  isSuperAdmin?: boolean;
}

export function Sidebar({ activeSection, onSectionChange, pendingReviewCount = 0, isSuperAdmin = false }: SidebarProps) {
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 overflow-y-auto"
      style={{ background: '#0a0f1c', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
      <SidebarContent activeSection={activeSection} onSectionChange={onSectionChange} pendingReviewCount={pendingReviewCount} isSuperAdmin={isSuperAdmin} />
    </aside>
  );
}

function SidebarContent({ activeSection, onSectionChange, onLogout, pendingReviewCount = 0, isSuperAdmin = false }: SidebarProps) {
  const adminSection = { id: 'admin' as Section, label: 'Administración', icon: Shield, description: 'Gestores y equipos' };

  return (
    <div className="flex flex-col h-full">
      <nav className="p-3 space-y-0.5 flex-1">
        {sections.map(({ id, label, icon: Icon, description }) => {
          const active = activeSection === id;
          const showBadge = id === 'review' && pendingReviewCount > 0;
          return (
            <button
              key={id}
              onClick={() => onSectionChange(id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group"
              style={{
                background: active ? 'rgba(14,165,233,0.15)' : 'transparent',
                borderLeft: active ? '2px solid #0ea5e9' : '2px solid transparent',
                color: active ? '#e2e8f0' : '#64748b',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <div className="relative shrink-0">
                <Icon size={17} style={{ color: active ? '#38bdf8' : undefined }} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {pendingReviewCount > 9 ? '9+' : pendingReviewCount}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-none" style={{ color: active ? '#e2e8f0' : '#94a3b8' }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: active ? 'rgba(56,189,248,0.7)' : '#475569' }}>{description}</p>
              </div>
            </button>
          );
        })}

        {isSuperAdmin && (
          <>
            <div className="my-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />
            <button
              onClick={() => onSectionChange(adminSection.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
              style={{
                background: activeSection === 'admin' ? 'rgba(245,158,11,0.15)' : 'transparent',
                borderLeft: activeSection === 'admin' ? '2px solid #f59e0b' : '2px solid transparent',
              }}
              onMouseEnter={e => { if (activeSection !== 'admin') e.currentTarget.style.background = 'rgba(245,158,11,0.06)'; }}
              onMouseLeave={e => { if (activeSection !== 'admin') e.currentTarget.style.background = 'transparent'; }}
            >
              <Shield size={17} style={{ color: activeSection === 'admin' ? '#fbbf24' : '#78716c' }} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-none" style={{ color: activeSection === 'admin' ? '#fde68a' : '#a78bfa' }}>{adminSection.label}</p>
                <p className="text-xs mt-0.5" style={{ color: activeSection === 'admin' ? 'rgba(251,191,36,0.6)' : '#57534e' }}>{adminSection.description}</p>
              </div>
            </button>
          </>
        )}

        {onLogout && (
          <button
            onClick={onLogout}
            className="md:hidden w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white transition"
          >
            <LogOut size={17} />
            <span className="text-sm font-medium">Cerrar sesión</span>
          </button>
        )}
      </nav>

      {/* Footer in sidebar */}
      <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)' }}>
            <BarChart2 size={11} className="text-white" />
          </div>
          <span className="text-white font-black text-xs tracking-tight">WorkTrack</span>
        </div>
        <p className="text-slate-600 text-xs">Gestión de Actividades</p>
        <p className="text-slate-700 text-xs mt-0.5">&copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
