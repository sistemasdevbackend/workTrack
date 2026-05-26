import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
  Mail, ArrowRight, CheckCircle2, Clock, GitBranch, Zap,
  Users, Shield, Kanban, ListTodo, Bell, User,
} from 'lucide-react';

interface CollaboratorLoginPageProps {
  onCollaboratorFound: (member: { id: string; name: string; email: string; position: string }) => void;
  onSwitchToManager: () => void;
}

/* ─────────────────────────────────────────────────────────────────────────
   Typing animation
───────────────────────────────────────────────────────────────────────── */
function useTyping(words: string[], speed = 75, pause = 2000) {
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
   Floating particles canvas
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

    const pts = Array.from({ length: 55 }, () => ({
      x: Math.random() * c.width, y: Math.random() * c.height,
      vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 2 + 0.5,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      pts.forEach((a, i) => {
        pts.slice(i + 1).forEach(b => {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(249,115,22,${0.09 * (1 - d / 130)})`;
            ctx.lineWidth = 1;
            ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        });
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(249,115,22,0.25)'; ctx.fill();
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
   Mock Kanban board illustration (SVG + animated CSS)
───────────────────────────────────────────────────────────────────────── */
function KanbanIllustration() {
  const cols = [
    {
      label: 'Pendiente', color: '#94a3b8', accent: 'rgba(148,163,184,0.15)',
      cards: [
        { title: 'Diseño wireframes', user: 'AS', tag: 'UX', tagColor: '#818cf8' },
        { title: 'Revisión de API', user: 'MR', tag: 'Backend', tagColor: '#34d399' },
      ],
    },
    {
      label: 'En progreso', color: '#f97316', accent: 'rgba(249,115,22,0.18)',
      cards: [
        { title: 'Módulo de pagos', user: 'LG', tag: 'Dev', tagColor: '#f97316' },
        { title: 'Tests unitarios', user: 'JP', tag: 'QA', tagColor: '#fbbf24' },
        { title: 'Dashboard v2', user: 'AS', tag: 'UX', tagColor: '#818cf8' },
      ],
    },
    {
      label: 'Completado', color: '#22c55e', accent: 'rgba(34,197,94,0.15)',
      cards: [
        { title: 'Auth con Supabase', user: 'MR', tag: 'Backend', tagColor: '#34d399' },
        { title: 'Deploy staging', user: 'JP', tag: 'DevOps', tagColor: '#38bdf8' },
      ],
    },
  ];

  return (
    <div className="w-full h-full flex flex-col justify-center px-8 py-10 select-none">
      {/* Top bar */}
      <div className="flex items-center gap-2 mb-5">
        <Kanban size={16} className="text-orange-400" />
        <span className="text-white/60 text-sm font-semibold">Sprint 22 — Semana actual</span>
        <div className="ml-auto flex items-center gap-1.5">
          {['#f87171','#fbbf24','#34d399'].map(c => (
            <div key={c} className="w-2 h-2 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
          ))}
        </div>
      </div>

      {/* Columns */}
      <div className="flex gap-3 flex-1 min-h-0">
        {cols.map((col, ci) => (
          <div key={ci} className="flex-1 flex flex-col rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-2.5"
              style={{ borderBottom: `1px solid ${col.color}25`, background: col.accent }}>
              <div className="w-2 h-2 rounded-full" style={{ background: col.color, boxShadow: `0 0 6px ${col.color}` }} />
              <span className="text-xs font-bold" style={{ color: col.color }}>{col.label}</span>
              <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: col.accent, color: col.color }}>{col.cards.length}</span>
            </div>

            {/* Cards */}
            <div className="flex-1 p-2 space-y-2 overflow-hidden">
              {col.cards.map((card, ki) => (
                <div key={ki}
                  className="kanban-card rounded-xl p-2.5"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    animationDelay: `${ci * 0.15 + ki * 0.1}s`,
                  }}>
                  <p className="text-white/80 text-xs font-medium leading-tight mb-2">{card.title}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                      style={{ background: card.tagColor + '20', color: card.tagColor }}>
                      {card.tag}
                    </span>
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black"
                      style={{ background: col.color + '25', color: col.color }}>
                      {card.user[0]}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-white/30 mb-1.5">
          <span>Progreso del sprint</span>
          <span className="text-orange-400 font-bold">64%</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className="h-full rounded-full sprint-bar"
            style={{ background: 'linear-gradient(90deg,#f97316,#fbbf24)', width: '64%' }} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Stat card
───────────────────────────────────────────────────────────────────────── */
function StatCard({ icon: Icon, value, label, delay }: { icon: React.ElementType; value: string; label: string; delay: string }) {
  return (
    <div className="slide-up flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{
        animationDelay: delay,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.25)' }}>
        <Icon size={14} className="text-orange-400" />
      </div>
      <div>
        <p className="text-white font-bold text-sm leading-none">{value}</p>
        <p className="text-white/35 text-xs mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────────────────── */
export default function CollaboratorLoginPage({ onCollaboratorFound, onSwitchToManager }: CollaboratorLoginPageProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  const typed = useTyping(['tu rendimiento.', 'tus tareas hoy.', 'tu sprint.', 'tus metas.']);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { data, error: dbError } = await supabase
        .from('team_members')
        .select('id, name, email, position')
        .ilike('email', email.trim())
        .limit(1)
        .maybeSingle();

      if (dbError) throw dbError;
      if (!data) { setError('No se encontró ningún colaborador con ese correo. Verifica con tu gestor.'); return; }
      onCollaboratorFound({ ...data, position: data.position ?? '' });
    } catch {
      setError('Error al verificar el correo. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !loading && email.trim().length > 0;

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: '#08080c' }}>

      <style>{`
        @keyframes slideUp    { from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)} }
        @keyframes slideRight { from{opacity:0;transform:translateX(-28px)}to{opacity:1;transform:translateX(0)} }
        @keyframes slideLeft  { from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)} }
        @keyframes shimmer    { 0%{background-position:-200% center}100%{background-position:200% center} }
        @keyframes blink      { 0%,100%{opacity:1}50%{opacity:0} }
        @keyframes scanline   { 0%{transform:translateY(-100%)}100%{transform:translateY(100vh)} }
        @keyframes cardEntry  { from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)} }
        @keyframes barGrow    { from{width:0}to{width:64%} }
        @keyframes pulseGlow  { 0%,100%{box-shadow:0 0 0 0 rgba(249,115,22,0.4)}50%{box-shadow:0 0 0 8px rgba(249,115,22,0)} }

        .slide-up     { animation: slideUp    0.6s cubic-bezier(.22,1,.36,1) both }
        .slide-right  { animation: slideRight 0.65s cubic-bezier(.22,1,.36,1) both }
        .slide-left   { animation: slideLeft  0.65s cubic-bezier(.22,1,.36,1) both }

        .brand-text {
          background: linear-gradient(90deg,#f97316 0%,#fb923c 30%,#fbbf24 55%,#fb923c 75%,#f97316 100%);
          background-size:200% auto;
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
          animation: shimmer 3.5s linear infinite;
        }
        .cursor { animation: blink 1s step-end infinite; color:#f97316; }
        .scan-line {
          position:absolute;left:0;right:0;height:1px;
          background:linear-gradient(90deg,transparent,rgba(249,115,22,0.35),transparent);
          animation: scanline 8s linear infinite;
          pointer-events:none; z-index:5;
        }
        .kanban-card { animation: cardEntry 0.5s cubic-bezier(.22,1,.36,1) both }
        .sprint-bar  { animation: barGrow 1.2s cubic-bezier(.22,1,.36,1) 0.8s both }
        .btn-active:not(:disabled):hover { animation: pulseGlow 0.8s ease }

        .input-field {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.14);
          transition: border-color 0.25s, box-shadow 0.25s;
        }
        .input-field:focus {
          outline: none;
          border-color: rgba(249,115,22,0.7);
          box-shadow: 0 0 0 3px rgba(249,115,22,0.12), 0 0 20px rgba(249,115,22,0.06);
        }
      `}</style>

      {/* ── LEFT: Kanban illustration ──────────────────────────────────── */}
      <div className="hidden lg:flex flex-col relative w-[52%] overflow-hidden"
        style={{ background: 'linear-gradient(160deg,#0e0a06 0%,#130d07 50%,#0e0a06 100%)' }}>

        {/* Grid texture */}
        <div className="absolute inset-0 opacity-30"
          style={{ backgroundImage: 'linear-gradient(rgba(249,115,22,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(249,115,22,0.06) 1px,transparent 1px)', backgroundSize: '32px 32px' }} />

        {/* Particles */}
        <div className="absolute inset-0 opacity-50">
          <ParticlesCanvas />
        </div>

        {/* Radial glow center */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(249,115,22,0.07) 0%,transparent 65%)' }} />

        {/* Right fade to blend with form panel */}
        <div className="absolute inset-y-0 right-0 w-24 pointer-events-none"
          style={{ background: 'linear-gradient(to right,transparent,#08080c)' }} />

        {/* Scan line */}
        <div className="scan-line" />

        <div className="relative z-10 flex flex-col h-full">
          {/* Top logo */}
          <div className="flex items-center gap-3 p-8 pb-0 slide-right" style={{ animationDelay: '0.05s' }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: '0 4px 16px rgba(249,115,22,0.4)' }}>
              <Users size={18} className="text-white" />
            </div>
            <span className="text-white font-black text-lg tracking-tight">WorkTrack</span>
          </div>

          {/* Headline */}
          <div className="px-8 pt-8 pb-4">
            <div className="slide-right" style={{ animationDelay: '0.15s' }}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-4"
                style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                <span className="text-orange-300 text-xs font-semibold tracking-wider uppercase">Portal de Colaboradores</span>
              </div>
            </div>
            <div className="slide-right" style={{ animationDelay: '0.2s' }}>
              <h1 className="text-4xl font-black text-white leading-tight mb-1">Revisa</h1>
              <h2 className="text-3xl font-black leading-tight brand-text min-h-[2.5rem]">
                {typed}<span className="cursor">|</span>
              </h2>
              <p className="text-white/40 text-sm mt-3 max-w-xs leading-relaxed">
                Tu tablero personal en tiempo real. Tareas, sprints y equipo sincronizados.
              </p>
            </div>
          </div>

          {/* Kanban board illustration */}
          <div className="flex-1 px-6 min-h-0 slide-right" style={{ animationDelay: '0.3s' }}>
            <KanbanIllustration />
          </div>

          {/* Stats row */}
          <div className="px-8 pb-8 grid grid-cols-2 gap-2.5 slide-right" style={{ animationDelay: '0.45s' }}>
            <StatCard icon={CheckCircle2} value="98%" label="Completadas" delay="0.5s" />
            <StatCard icon={Clock}       value="<2h" label="Respuesta"    delay="0.55s" />
            <StatCard icon={GitBranch}   value="12"  label="Sprints"      delay="0.6s" />
            <StatCard icon={Zap}         value="Live" label="Notificaciones" delay="0.65s" />
          </div>
        </div>
      </div>

      {/* ── RIGHT: Form ────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10 relative"
        style={{ background: 'linear-gradient(160deg,#0d0b10 0%,#08080c 55%,#0a0907 100%)' }}>

        {/* Subtle glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle,rgba(249,115,22,0.05) 0%,transparent 70%)' }} />

        <div className="relative z-10 w-full max-w-sm slide-left" style={{ animationDelay: '0.25s' }}>

          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-3 mb-10 justify-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', boxShadow: '0 4px 20px rgba(249,115,22,0.4)' }}>
              <Users size={20} className="text-white" />
            </div>
            <span className="text-white font-black text-xl tracking-tight">WorkTrack</span>
          </div>

          {/* Welcome text */}
          <div className="mb-8">
            <h2 className="text-3xl font-black text-white">
              Bienvenido<span className="text-orange-400">.</span>
            </h2>
            <p className="text-slate-300 text-sm mt-1.5">
              Ingresa tu correo para acceder a tus actividades
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                Correo electrónico
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300"
                  style={{ color: focused ? '#f97316' : 'rgba(255,255,255,0.4)' }}>
                  <Mail size={16} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="tu@empresa.com"
                  required
                  autoFocus
                  className="input-field w-full pl-11 pr-4 py-4 rounded-2xl text-sm text-white placeholder-slate-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-active w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-black text-sm relative overflow-hidden group transition-all duration-300"
              style={{
                background: canSubmit ? 'linear-gradient(135deg,#f97316 0%,#ea580c 100%)' : 'rgba(255,255,255,0.04)',
                color: canSubmit ? '#fff' : 'rgba(255,255,255,0.18)',
                boxShadow: canSubmit ? '0 8px 28px rgba(249,115,22,0.38), inset 0 1px 0 rgba(255,255,255,0.12)' : 'none',
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
                <>Ver mis actividades<ArrowRight size={15} className={canSubmit ? 'group-hover:translate-x-1 transition-transform duration-200' : ''} /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-4 my-7">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right,transparent,rgba(255,255,255,0.12))' }} />
            <span className="text-slate-500 text-xs font-medium">o</span>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left,transparent,rgba(255,255,255,0.12))' }} />
          </div>

          {/* Manager switch */}
          <button
            onClick={onSwitchToManager}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(249,115,22,0.45)';
              e.currentTarget.style.color = '#f97316';
              e.currentTarget.style.background = 'rgba(249,115,22,0.08)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
          >
            <Shield size={14} /> Acceso como gestor
          </button>

          {/* Feature chips */}
          <div className="mt-7 flex flex-wrap gap-2 justify-center">
            {[
              { icon: ListTodo, label: 'Mis tareas' },
              { icon: Bell,     label: 'Alertas' },
              { icon: User,     label: 'Mi perfil' },
              { icon: GitBranch, label: 'Sprints' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Icon size={11} className="text-orange-400" />
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
