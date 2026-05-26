import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ChevronDown, Plus, Layers } from 'lucide-react';

interface ProjectComboboxProps {
  teamId: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function ProjectCombobox({
  teamId,
  value,
  onChange,
  required,
  placeholder = 'Seleccionar o escribir proyecto...',
  className = '',
  disabled = false,
}: ProjectComboboxProps) {
  const [projects, setProjects] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!teamId) return;
    supabase
      .from('team_projects')
      .select('name')
      .eq('team_id', teamId)
      .order('name', { ascending: true })
      .then(({ data }) => {
        setProjects((data ?? []).map((r: any) => r.name));
      });
  }, [teamId]);

  // Sync external value into the visible query when closed
  useEffect(() => {
    if (!open) setQuery(value);
  }, [value, open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        commitAndClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [query]);

  const filtered = projects.filter(p =>
    p.toLowerCase().includes((query || '').toLowerCase())
  );

  const exactMatch = projects.some(p => p.toLowerCase() === (query || '').toLowerCase().trim());
  const trimmed = (query || '').trim();

  const commitAndClose = () => {
    // If user typed something, commit it as value
    if (trimmed) onChange(trimmed);
    setOpen(false);
  };

  const select = async (name: string) => {
    onChange(name);
    setQuery(name);
    setOpen(false);
    // Ensure it exists in DB
    await ensureProject(name);
  };

  const createNew = async () => {
    if (!trimmed) return;
    await ensureProject(trimmed);
    setProjects(prev => [...prev.filter(p => p !== trimmed), trimmed].sort());
    onChange(trimmed);
    setQuery(trimmed);
    setOpen(false);
  };

  const ensureProject = async (name: string) => {
    if (!teamId || !name.trim()) return;
    await supabase
      .from('team_projects')
      .upsert({ team_id: teamId, name: name.trim() }, { onConflict: 'team_id,name', ignoreDuplicates: true });
  };

  const baseInput = `w-full bg-slate-700 border border-slate-600 text-white px-3 py-2 rounded focus:outline-none focus:border-blue-500 pr-8 text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={open ? query : value}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete="off"
          className={baseInput}
          onFocus={() => {
            setQuery(value);
            setOpen(true);
          }}
          onChange={e => {
            setQuery(e.target.value);
            onChange(e.target.value);
            setOpen(true);
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') { setOpen(false); setQuery(value); }
            if (e.key === 'Enter') { e.preventDefault(); if (trimmed) createNew(); }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => { setQuery(value); setOpen(v => !v); inputRef.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
        >
          <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
          {filtered.length === 0 && !trimmed && (
            <p className="text-slate-500 text-xs px-3 py-3 text-center">Sin proyectos aún</p>
          )}

          {filtered.map(p => (
            <button
              key={p}
              type="button"
              onMouseDown={e => { e.preventDefault(); select(p); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-700 transition ${
                p === value ? 'bg-slate-700/60 text-blue-300' : 'text-white'
              }`}
            >
              <Layers size={12} className="text-blue-400 shrink-0" />
              {p}
            </button>
          ))}

          {trimmed && !exactMatch && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); createNew(); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-emerald-300 hover:bg-emerald-900/30 border-t border-slate-700 transition"
            >
              <Plus size={13} className="shrink-0" />
              Crear proyecto "{trimmed}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
