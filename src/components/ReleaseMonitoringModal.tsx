import { useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  Rocket, CheckCircle2, AlertTriangle, XCircle, X, Send,
  ImagePlus, Loader2, ZoomIn, Clock,
} from 'lucide-react';

export interface ActivityToMonitor {
  id: string;
  title: string;
  project?: string | null;
  released_to_production_at: string;
  dayNumber: number; // 1–5
}

interface Props {
  activities: ActivityToMonitor[];
  memberId: string;
  memberName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const STATUS_OPTIONS = [
  {
    value: 'OK',
    label: 'Funcionando correctamente',
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15 border-emerald-500/40',
    selectedBg: 'bg-emerald-500/25 border-emerald-400',
  },
  {
    value: 'ISSUE',
    label: 'Hay un problema menor',
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/15 border-amber-500/40',
    selectedBg: 'bg-amber-500/25 border-amber-400',
  },
  {
    value: 'CRITICAL',
    label: 'Problema crítico / Falló',
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/15 border-red-500/40',
    selectedBg: 'bg-red-500/25 border-red-400',
  },
] as const;

type StatusValue = 'OK' | 'ISSUE' | 'CRITICAL';

export default function ReleaseMonitoringModal({ activities, memberId, memberName, onClose, onSubmitted }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [status, setStatus] = useState<StatusValue | null>(null);
  const [comment, setComment] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const current = activities[currentIndex];
  const total = activities.length;

  const releaseDate = current
    ? new Date(current.released_to_production_at).toLocaleDateString('es-MX', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
    : '';

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!status) { setError('Selecciona el estado de la liberación.'); return; }
    setError(null);
    setSubmitting(true);

    let imageUrl: string | null = null;

    if (imageFile) {
      const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `monitoring/${current.id}/day${current.dayNumber}-${Date.now()}-${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from('comment-images')
        .upload(path, imageFile, { upsert: false });
      if (!uploadErr) {
        const { data: pub } = supabase.storage.from('comment-images').getPublicUrl(path);
        imageUrl = pub.publicUrl;
      }
    }

    const { error: insertErr } = await supabase
      .from('release_monitoring_logs')
      .insert({
        activity_id: current.id,
        team_member_id: memberId,
        day_number: current.dayNumber,
        status,
        comment,
        image_url: imageUrl,
      });

    setSubmitting(false);

    if (insertErr) {
      setError('Error al guardar. Intenta de nuevo.');
      return;
    }

    // Move to next activity or close
    if (currentIndex < total - 1) {
      setCurrentIndex(i => i + 1);
      setStatus(null);
      setComment('');
      setImageFile(null);
      setImagePreview(null);
    } else {
      onSubmitted();
      onClose();
    }
  };

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start gap-3 px-6 pt-6 pb-4 border-b border-slate-700/60">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 shrink-0">
            <Rocket size={20} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-white font-bold text-base leading-tight">Monitoreo Post-Liberación</h2>
              {total > 1 && (
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-700/60 px-2 py-0.5 rounded-full shrink-0">
                  {currentIndex + 1}/{total}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">Reporte diario de seguimiento de la liberación</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto max-h-[70vh] px-6 py-5 space-y-5">

          {/* Activity info */}
          <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full">
                <Rocket size={11} />
                Día {current.dayNumber} de 5
              </span>
              {current.project && (
                <span className="text-[11px] text-slate-400 bg-slate-700/60 px-2 py-0.5 rounded truncate max-w-[160px]">
                  {current.project}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white leading-snug">{current.title}</p>
            <p className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock size={10} />
              Liberado el {releaseDate}
            </p>
          </div>

          {/* Day progress dots */}
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map(day => (
              <div
                key={day}
                className={`h-2 rounded-full transition-all ${
                  day < current.dayNumber
                    ? 'w-6 bg-emerald-500'
                    : day === current.dayNumber
                    ? 'w-6 bg-blue-400 ring-2 ring-blue-400/30'
                    : 'w-2 bg-slate-700'
                }`}
              />
            ))}
          </div>

          {/* Status selection */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
              Estado de la liberacion hoy
            </p>
            <div className="space-y-2">
              {STATUS_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const selected = status === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                      selected ? opt.selectedBg : `${opt.bg} hover:opacity-80`
                    }`}
                  >
                    <Icon size={18} className={opt.color} />
                    <span className={`text-sm font-semibold ${opt.color}`}>{opt.label}</span>
                    {selected && (
                      <CheckCircle2 size={14} className={`ml-auto ${opt.color}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
              Observaciones del dia
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Describe el comportamiento observado, errores encontrados, acciones tomadas..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 resize-none transition"
            />
          </div>

          {/* Image upload */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Evidencia (opcional)</p>
            {imagePreview ? (
              <div className="relative group">
                <img
                  src={imagePreview}
                  alt="Evidencia"
                  className="w-full max-h-48 object-contain rounded-xl border border-slate-700 bg-slate-800/40 cursor-zoom-in"
                  onClick={() => setZoomImage(true)}
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition rounded-xl bg-black/40">
                  <ZoomIn size={24} className="text-white" />
                </div>
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-500 text-white rounded-full p-1 transition"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-xl py-6 cursor-pointer transition group">
                <ImagePlus size={22} className="text-slate-500 group-hover:text-slate-400 transition" />
                <span className="text-xs text-slate-500 group-hover:text-slate-400 transition">
                  Haz clic para subir una imagen de evidencia
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </label>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700/60 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="text-sm text-slate-400 hover:text-white transition px-4 py-2 rounded-xl hover:bg-slate-800"
          >
            Recordar despues
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !status}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {submitting ? 'Guardando...' : currentIndex < total - 1 ? 'Guardar y continuar' : 'Guardar reporte'}
          </button>
        </div>
      </div>

      {/* Zoom overlay */}
      {zoomImage && imagePreview && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomImage(false)}
        >
          <img src={imagePreview} alt="Evidencia" className="max-w-full max-h-full object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
}
