import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  Mail, Lock, ArrowRight, Users, BarChart2, TrendingUp,
  CheckCircle2, AlertCircle, Clock, Activity, Shield,
  GitMerge, Bell, FileText,
} from 'lucide-react';

interface AuthPageProps {
  onSwitchToCollaborator?: () => void;
}

/* ─────────────────────────────────────────────────────────────────────────
   Typing animation
───────────────────────────────────────────────────────────────────────── */
function useTyping(words: string[], speed = 70, pause = 2200) {
  const [text, setText] = useState('');
  const [wi, setWi] = useState(0);
  const [del, setDel] = useState(false);

  useEffect(() => {
    const word = words[wi];
    const id = setTimeout(() => {
      if (!del) {
        setText(word.slice(0, text.length + 1));
        if (text.length + 1 === word.length) setTimeout(() => setDel(true), pause);
      } else {
        setText(word.slice(0, text.length - 1));
        if (text.length - 1 === 0) { setDel(false); setWi(p => (p + 1) % words.length); }
      }
    }, del ? speed / 2 : speed);
    return () => clearTimeout(id);
  });

  return text;
}

/* ─────────────────────────────────────────────────────────────────────────
   Particles canvas
───────────────────────────────────────────────────────────────────────── */
function ParticlesCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    let id: number;
    const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight; };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(c);

    const pts = Array.from({ length: 50 }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.8 + 0.5,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      pts.forEach((a, i) => {
        pts.slice(i + 1).forEach(b => {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(56,189,248,${0.08 * (1 - d / 120)})`;
            ctx.lineWidth = 1; ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        });
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56,189,248,0.2)'; ctx.fill();
        a.x += a.vx; a.y += a.vy;
        if (a.x < 0 || a.x > c.width) a.vx *= -1;
        if (a.y < 0 || a.y > c.height) a.vy *= -1;
      });
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(id); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" />;
}

/* ─────────────────────────────────────────────────────────────────────────
   Bar chart illustration (animated)
───────────────────────────────────────────────────────────────────────── */
function BarChartIllustration() {
  const bars = [
    { label: 'L', h: 55, color: '#38bdf8' },
    { label: 'M', h: 80, color: '#38bdf8' },
    { label: 'X', h: 65, color: '#38bdf8' },
    { label: 'J', h: 90, color: '#0ea5e9' },
    { label: 'V', h: 70, color: '#38bdf8' },
    { label: 'S', h: 40, color: '#64748b' },
    { label: 'D', h: 30, color: '#64748b' },
  ];
  return (
    <div className="flex items-end gap-1.5 h-full pt-2">
      {bars.map((b, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t-md bar-grow"
            style={{
              height: `${b.h}%`, background: b.color,
              opacity: b.color === '#64748b' ? 0.4 : 0.85,
              animationDelay: `${0.6 + i * 0.07}s`,
            }} />
          <span className="text-white/30 text-xs">{b.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Manager dashboard illustration
───────────────────────────────────────────────────────────────────────── */
function DashboardIllustration() {
  const members = [
    { name: 'Ana S.',  role: 'Frontend', tasks: 4, done: 3, color: '#38bdf8' },
    { name: 'Luis G.', role: 'Backend',  tasks: 6, done: 4, color: '#34d399' },
    { name: 'Marta R.', role: 'UX/UI',  tasks: 3, done: 3, color: '#a78bfa' },
    { name: 'Jose P.', role: 'QA',      tasks: 5, done: 2, color: '#fbbf24' },
  ];

  const alerts = [
    { icon: AlertCircle, text: '2 tareas vencidas hoy',    color: '#f87171' },
    { icon: CheckCircle2, text: 'Sprint 22 al 78%',         color: '#34d399' },
    { icon: Clock,        text: 'Review pendiente — PR #47', color: '#fbbf24' },
  ];

  return (
    <div className="w-full h-full flex flex-col gap-3 py-2 select-none">

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2 kpi-row">
        {[
          { label: 'Actividades', value: '34', sub: '+8 esta semana',  icon: Activity, color: '#38bdf8' },
          { label: 'Completadas', value: '21', sub: '62% del total',   icon: CheckCircle2, color: '#34d399' },
          { label: 'En revisión', value: '5',  sub: '3 urgentes',      icon: FileText, color: '#fbbf24' },
        ].map((k, i) => (
          <div key={i} className="rounded-xl p-2.5 flex flex-col gap-1.5 kpi-card"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${k.color}20`,
              animationDelay: `${0.3 + i * 0.1}s`,
            }}>
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-xs">{k.label}</span>
              <k.icon size={12} style={{ color: k.color }} />
            </div>
            <p className="text-white font-black text-xl leading-none">{k.value}</p>
            <p className="text-white/30 text-xs">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Chart + alerts */}
      <div className="flex gap-2 flex-1 min-h-0">
        {/* Chart */}
        <div className="flex-1 rounded-xl p-3 flex flex-col chart-card"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(56,189,248,0.1)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/50 text-xs font-semibold">Actividades / semana</span>
            <TrendingUp size={12} className="text-sky-400" />
          </div>
          <div className="flex-1 min-h-0">
            <BarChartIllustration />
          </div>
        </div>

        {/* Alerts */}
        <div className="w-40 flex flex-col gap-1.5">
          {alerts.map((a, i) => (
            <div key={i} className="rounded-xl px-2.5 py-2 alert-card flex items-start gap-2"
              style={{
                background: `${a.color}10`,
                border: `1px solid ${a.color}25`,
                animationDelay: `${0.5 + i * 0.12}s`,
              }}>
              <a.icon size={11} style={{ color: a.color, marginTop: 1, shrink: 0 }} />
              <p className="text-white/60 text-xs leading-tight">{a.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Team members */}
      <div className="rounded-xl p-3 team-card"
        style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2 mb-2.5">
          <Users size={12} className="text-sky-400" />
          <span className="text-white/50 text-xs font-semibold">Equipo — Sprint 22</span>
          <span className="ml-auto text-sky-400 text-xs font-bold">{members.length} activos</span>
        </div>
        <div className="space-y-2">
          {members.map((m, i) => (
            <div key={i} className="flex items-center gap-2.5 member-row"
              style={{ animationDelay: `${0.7 + i * 0.08}s` }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                style={{ background: m.color + '25', color: m.color }}>{m.name[0]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-white/70 text-xs font-semibold truncate">{m.name}</span>
                  <span className="text-white/30 text-xs shrink-0">{m.done}/{m.tasks}</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div className="h-full rounded-full member-bar"
                    style={{
                      width: `${(m.done / m.tasks) * 100}%`,
                      background: m.color,
                      animationDelay: `${0.8 + i * 0.1}s`,
                    }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────────────────── */
export default function AuthPage({ onSwitchToCollaborator }: AuthPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const typed = useTyping(['tu equipo.', 'los sprints.', 'las entregas.', 'el rendimiento.']);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch {
      setError('Correo o contraseña incorrectos.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && email.trim().length > 0 && password.length > 0;

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: '#060a12' }}>

      <style>{`
        @keyframes slideUp    { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideRight { from{opacity:0;transform:translateX(-28px)} to{opacity:1;transform:translateX(0)} }
        @keyframes slideLeft  { from{opacity:0;transform:translateX(28px)} to{opacity:1;transform:translateX(0)} }
        @keyframes shimmer    { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes blink      { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes scanline   { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }
        @keyframes barGrow    { from{height:0} to{height:var(--h)} }
        @keyframes memberBar  { from{width:0} }
        @keyframes cardEntry  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        .slide-up     { animation: slideUp    0.6s cubic-bezier(.22,1,.36,1) both }
        .slide-right  { animation: slideRight 0.65s cubic-bezier(.22,1,.36,1) both }
        .slide-left   { animation: slideLeft  0.65s cubic-bezier(.22,1,.36,1) both }

        .brand-text {
          background: linear-gradient(90deg,#38bdf8 0%,#7dd3fc 30%,#38bdf8 55%,#0ea5e9 100%);
          background-size:200% auto;
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
          animation: shimmer 3.5s linear infinite;
        }
        .cursor { animation: blink 1s step-end infinite; color:#38bdf8; }

        .scan-line {
          position:absolute; left:0; right:0; height:1px;
          background:linear-gradient(90deg,transparent,rgba(56,189,248,0.3),transparent);
          animation: scanline 8s linear infinite;
          pointer-events:none; z-index:5;
        }

        .bar-grow   { animation: barGrow  1s cubic-bezier(.22,1,.36,1) both }
        .member-bar { animation: memberBar 1.2s cubic-bezier(.22,1,.36,1) both }
        .kpi-card   { animation: cardEntry 0.5s cubic-bezier(.22,1,.36,1) both }
        .chart-card { animation: cardEntry 0.5s cubic-bezier(.22,1,.36,1) 0.45s both }
        .alert-card { animation: cardEntry 0.5s cubic-bezier(.22,1,.36,1) both }
        .team-card  { animation: cardEntry 0.5s cubic-bezier(.22,1,.36,1) 0.65s both }
        .member-row { animation: cardEntry 0.4s cubic-bezier(.22,1,.36,1) both }

        .input-field {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.14);
          transition: border-color 0.25s, box-shadow 0.25s;
        }
        .input-field:focus {
          outline: none;
          border-color: rgba(56,189,248,0.7);
          box-shadow: 0 0 0 3px rgba(56,189,248,0.12), 0 0 20px rgba(56,189,248,0.06);
        }
      `}</style>

      {/* ── LEFT: Manager dashboard illustration ─────────────────────── */}
      <div className="hidden lg:flex flex-col relative w-[52%] overflow-hidden"
        style={{ background: 'linear-gradient(160deg,#070c16 0%,#090e1a 50%,#070c16 100%)' }}>

        {/* Grid */}
        <div className="absolute inset-0 opacity-25"
          style={{ backgroundImage: 'linear-gradient(rgba(56,189,248,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(56,189,248,0.05) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />

        {/* Particles */}
        <div className="absolute inset-0 opacity-55">
          <ParticlesCanvas />
        </div>

        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(56,189,248,0.055) 0%,transparent 65%)' }} />

        {/* Right blend */}
        <div className="absolute inset-y-0 right-0 w-24 pointer-events-none"
          style={{ background: 'linear-gradient(to right,transparent,#060a12)' }} />

        {/* Scan line */}
        <div className="scan-line" />

        <div className="relative z-10 flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 p-8 pb-0 slide-right" style={{ animationDelay: '0.05s' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', boxShadow: '0 4px 16px rgba(14,165,233,0.4)' }}>
              <BarChart2 size={18} className="text-white" />
            </div>
            <span className="text-white font-black text-lg tracking-tight">WorkTrack</span>
          </div>

          {/* Headline */}
          <div className="px-8 pt-7 pb-3">
            <div className="slide-right" style={{ animationDelay: '0.12s' }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
                style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.22)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                <span className="text-sky-300 text-xs font-semibold tracking-wider uppercase">Panel de Gestión</span>
              </div>
            </div>
            <div className="slide-right" style={{ animationDelay: '0.18s' }}>
              <h1 className="text-4xl font-black text-white leading-tight">Gestiona</h1>
              <h2 className="text-3xl font-black leading-tight brand-text min-h-[2.5rem]">
                {typed}<span className="cursor">|</span>
              </h2>
              <p className="text-white/35 text-sm mt-3 max-w-xs leading-relaxed">
                Control total de actividades, sprints y rendimiento del equipo desde un solo lugar.
              </p>
            </div>
          </div>

          {/* Dashboard illustration */}
          <div className="flex-1 px-6 pb-4 min-h-0 slide-right" style={{ animationDelay: '0.28s' }}>
            <DashboardIllustration />
          </div>

          {/* Bottom stats */}
          <div className="px-8 pb-8 grid grid-cols-3 gap-2 slide-right" style={{ animationDelay: '0.42s' }}>
            {[
              { icon: GitMerge, value: '12',   label: 'PRs abiertos' },
              { icon: Bell,     value: '3',     label: 'Alertas' },
              { icon: Users,    value: '8',     label: 'Miembros' },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.2)' }}>
                  <Icon size={13} className="text-sky-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-none">{value}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Form ────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative"
        style={{ background: 'linear-gradient(160deg,#0c0e16 0%,#060a12 55%,#0a0c10 100%)' }}>

        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(56,189,248,0.045) 0%,transparent 70%)' }} />

        <div className="relative z-10 w-full max-w-sm slide-left" style={{ animationDelay: '0.22s' }}>

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#0ea5e9,#0284c7)', boxShadow: '0 4px 20px rgba(14,165,233,0.4)' }}>
              <BarChart2 size={20} className="text-white" />
            </div>
            <span className="text-white font-black text-xl tracking-tight">WorkTrack</span>
          </div>

          {/* Welcome */}
          <div className="mb-8">
            <h2 className="text-3xl font-black text-white">
              Bienvenido<span className="text-sky-400">.</span>
            </h2>
            <p className="text-slate-300 text-sm mt-1.5">
              Accede a tu panel de gestión de equipo
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-2xl px-4 py-3.5 mb-5 slide-up"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', color: '#fca5a5' }}>
              <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300"
                  style={{ color: focused === 'email' ? '#38bdf8' : 'rgba(255,255,255,0.4)' }}>
                  <Mail size={15} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused('email')}
                  onBlur={() => setFocused(null)}
                  placeholder="tu@empresa.com"
                  required
                  autoFocus
                  className="input-field w-full pl-11 pr-4 py-4 rounded-2xl text-sm text-white placeholder-slate-500"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300"
                  style={{ color: focused === 'pass' ? '#38bdf8' : 'rgba(255,255,255,0.4)' }}>
                  <Lock size={15} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('pass')}
                  onBlur={() => setFocused(null)}
                  placeholder="••••••••"
                  required
                  className="input-field w-full pl-11 pr-4 py-4 rounded-2xl text-sm text-white placeholder-slate-500"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-black text-sm relative overflow-hidden group transition-all duration-300"
              style={{
                background: canSubmit ? 'linear-gradient(135deg,#0ea5e9 0%,#0284c7 100%)' : 'rgba(255,255,255,0.04)',
                color: canSubmit ? '#fff' : 'rgba(255,255,255,0.18)',
                boxShadow: canSubmit ? '0 8px 28px rgba(14,165,233,0.35), inset 0 1px 0 rgba(255,255,255,0.12)' : 'none',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {canSubmit && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: 'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.1) 50%,transparent 60%)' }} />
              )}
              {loading ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />Verificando acceso...</>
              ) : (
                <>Acceder al sistema<ArrowRight size={15} className={canSubmit ? 'group-hover:translate-x-1 transition-transform duration-200' : ''} /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-7">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right,transparent,rgba(255,255,255,0.12))' }} />
            <span className="text-slate-500 text-xs font-medium">o</span>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left,transparent,rgba(255,255,255,0.12))' }} />
          </div>

          {/* Switch to collaborator */}
          {onSwitchToCollaborator && (
            <button
              onClick={onSwitchToCollaborator}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(56,189,248,0.45)';
                e.currentTarget.style.color = '#38bdf8';
                e.currentTarget.style.background = 'rgba(56,189,248,0.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }}
            >
              <Shield size={14} /> Acceso como colaborador
            </button>
          )}

          {/* Feature chips */}
          <div className="mt-7 flex flex-wrap gap-2 justify-center">
            {[
              { icon: BarChart2, label: 'Métricas' },
              { icon: Users,     label: 'Equipos' },
              { icon: Bell,      label: 'Alertas' },
              { icon: GitMerge,  label: 'Revisiones' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Icon size={11} className="text-sky-400" />
                <span className="text-slate-300 text-xs font-medium">{label}</span>
              </div>
            ))}
          </div>

          <p className="text-center text-slate-600 text-xs mt-7">
            WorkTrack &copy; {new Date().getFullYear()} — Gestión de actividades y equipos
          </p>
        </div>
      </div>
    </div>
  );
}
