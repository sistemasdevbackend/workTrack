import { Bell, User, Shield, Database } from 'lucide-react';

interface SettingsSectionProps {
  userEmail?: string;
}

export default function SettingsSection({ userEmail }: SettingsSectionProps) {
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Configuración</h2>
        <p className="text-slate-400 text-sm mt-1">Personaliza tu experiencia en Activity Manager</p>
      </div>

      {/* Perfil */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <User size={24} className="text-blue-400" />
          <h3 className="text-xl font-semibold text-white">Mi Perfil</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Email</label>
            <input
              type="email"
              value={userEmail || ''}
              disabled
              className="w-full bg-slate-700 border border-slate-600 text-slate-300 px-4 py-2 rounded cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Notificaciones */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Bell size={24} className="text-yellow-400" />
          <h3 className="text-xl font-semibold text-white">Notificaciones</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Actividades Pendientes</p>
              <p className="text-sm text-slate-400">Recibe alertas de actividades vencidas</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Comentarios Nuevos</p>
              <p className="text-sm text-slate-400">Notificaciones de nuevos seguimientos</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Cambios de Estado</p>
              <p className="text-sm text-slate-400">Alertas cuando cambia el estado de actividades</p>
            </div>
            <input type="checkbox" defaultChecked className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Privacidad y Seguridad */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={24} className="text-green-400" />
          <h3 className="text-xl font-semibold text-white">Privacidad y Seguridad</h3>
        </div>
        <div className="space-y-4">
          <button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded transition">
            Cambiar Contraseña
          </button>
          <button className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded transition">
            Habilitar Autenticación de Dos Factores
          </button>
        </div>
      </div>

      {/* Datos */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database size={24} className="text-purple-400" />
          <h3 className="text-xl font-semibold text-white">Datos y Almacenamiento</h3>
        </div>
        <div className="space-y-4 text-sm text-slate-300">
          <p>Activity Manager almacena todos tus datos de forma segura en Supabase.</p>
          <button className="text-blue-400 hover:text-blue-300 font-medium">
            Descargar mis datos
          </button>
        </div>
      </div>

      {/* Información */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-xl font-semibold text-white mb-4">Acerca de</h3>
        <div className="space-y-2 text-sm text-slate-400">
          <p>Activity Manager v1.0</p>
          <p>Sistema de gestión individual de actividades con seguimiento por colaborador.</p>
        </div>
      </div>
    </div>
  );
}
