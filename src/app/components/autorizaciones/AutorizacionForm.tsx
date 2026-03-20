import { useState } from 'react';
import { FormMode } from '@/types/product';
import { Autorizacion } from '@/types/autorizacion';

interface AutorizacionFormProps {
  mode: FormMode;
  autorizacion?: Autorizacion;
  onBack: () => void;
  onSave?: (data: any) => void;
  nextId?: number;
  solicitudId?: number;
}

export function AutorizacionForm({ mode, autorizacion, onBack, onSave, nextId, solicitudId }: AutorizacionFormProps) {
  const [formData, setFormData] = useState({
    fincorpAccountId: solicitudId?.toString() || autorizacion?.fincorpAccountId?.toString() || '',
    authUserId: autorizacion?.authUserId?.toString() || '',
    authUserName: autorizacion?.authUserName || '',
    authDate: autorizacion?.authDate || new Date().toISOString().slice(0, 16),
    authStatus: autorizacion?.authStatus || '',
    area: autorizacion?.area || '',
    description: autorizacion?.description || '',
    notes: autorizacion?.notes || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave) {
      onSave({
        ...formData,
        id: autorizacion?.id || nextId,
        authUserId: parseInt(formData.authUserId) || 1,
        fincorpAccountId: parseInt(formData.fincorpAccountId)
      });
    }
    onBack();
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isReadOnly = mode === 'view';
  const inputClass = mode === 'create' 
    ? 'w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#2E5C91]'
    : 'w-full px-3 py-1.5 border-0 border-b border-gray-300 bg-transparent text-sm focus:outline-none focus:border-[#2E5C91]';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header institucional */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#1a1a2e] rounded flex items-center justify-center">
              <span className="text-white font-bold text-xs">RN</span>
            </div>
            <span className="text-xs text-gray-600">Core Banking System</span>
          </div>
          <img 
            src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 30'%3E%3Ctext x='10' y='20' font-family='Arial' font-size='16' fill='%234A90E2' font-weight='bold'%3Eultrasist%3C/text%3E%3C/svg%3E"
            alt="Ultrasist"
            className="h-6"
          />
        </div>
        <div className="flex items-center gap-4">
          <button className="text-xs text-gray-600 hover:text-gray-800">Buscar</button>
          <button className="text-xs text-gray-600 hover:text-gray-800">Ayuda</button>
          <button className="text-xs text-gray-600 hover:text-gray-800">Comentarios</button>
          <button className="text-xs text-gray-600 hover:text-gray-800">Sesión de usuario</button>
        </div>
      </div>

      {/* Barra de navegación principal */}
      <div className="bg-[#2E5C91] px-6 py-0 flex items-center gap-6 text-white text-xs overflow-x-auto">
        <button className="px-3 py-2 hover:bg-[#1E4C81] whitespace-nowrap">Configuración</button>
        <button className="px-3 py-2 hover:bg-[#1E4C81] whitespace-nowrap">Productos</button>
        <button className="px-3 py-2 hover:bg-[#1E4C81] whitespace-nowrap">Garantías</button>
        <button className="px-3 py-2 hover:bg-[#1E4C81] whitespace-nowrap">Prospectos</button>
        <button className="px-3 py-2 hover:bg-[#1E4C81] whitespace-nowrap">Clientes</button>
        <button className="px-3 py-2 hover:bg-[#1E4C81] whitespace-nowrap">Cuentas ahorro</button>
        <button className="px-3 py-2 bg-[#1E4C81] border-b-2 border-white whitespace-nowrap">Solicitudes crédito</button>
        <button className="px-3 py-2 hover:bg-[#1E4C81] whitespace-nowrap">Créditos</button>
        <button className="px-3 py-2 hover:bg-[#1E4C81] whitespace-nowrap">Inversiones</button>
        <button className="px-3 py-2 hover:bg-[#1E4C81] whitespace-nowrap">Cartera crédito</button>
        <button className="px-3 py-2 hover:bg-[#1E4C81] whitespace-nowrap">Cartera inversión</button>
        <button className="px-3 py-2 hover:bg-[#1E4C81] whitespace-nowrap">Cartera ahorro</button>
        <button className="px-3 py-2 hover:bg-[#1E4C81] whitespace-nowrap">Avisos</button>
      </div>

      {/* Breadcrumb y título */}
      <div className="bg-white px-6 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-orange-500 text-lg">🏠</span>
          <button onClick={onBack} className="text-blue-600 hover:underline text-xs">
            Solicitud de Crédito
          </button>
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-normal text-gray-800">Autorización</h1>
          <div className="flex gap-2">
            {mode !== 'view' && (
              <>
                <button
                  onClick={handleSubmit}
                  className="px-4 py-1.5 bg-[#2E5C91] text-white text-xs font-medium rounded hover:bg-[#1E4C81]"
                >
                  Guardar
                </button>
                <button
                  onClick={onBack}
                  className="px-4 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </>
            )}
            {mode === 'view' && (
              <button
                onClick={onBack}
                className="px-4 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded hover:bg-gray-50"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div className="px-6 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            {/* FECHA DE AUTORIZACIÓN */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                FECHA Y HORA DE AUTORIZACIÓN <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={formData.authDate}
                onChange={(e) => handleChange('authDate', e.target.value)}
                disabled={isReadOnly}
                required
                className={inputClass}
              />
            </div>

            {/* USUARIO QUE AUTORIZA */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                USUARIO QUE AUTORIZA <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.authUserName}
                onChange={(e) => handleChange('authUserName', e.target.value)}
                disabled={isReadOnly}
                required
                className={inputClass}
              />
            </div>

            {/* ÁREA */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                ÁREA <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.area}
                onChange={(e) => handleChange('area', e.target.value)}
                disabled={isReadOnly}
                required
                className={inputClass}
                placeholder="Ej: Redes Comerciales"
              />
            </div>

            {/* DESCRIPCIÓN DE LA AUTORIZACIÓN */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                DESCRIPCIÓN DE LA AUTORIZACIÓN <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                disabled={isReadOnly}
                required
                className={inputClass}
                placeholder="Ej: Otorgado de crédito"
              />
            </div>

            {/* OBSERVACIONES */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                OBSERVACIONES
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                disabled={isReadOnly}
                rows={3}
                maxLength={255}
                className={mode === 'create' 
                  ? 'w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-[#2E5C91] resize-none'
                  : 'w-full px-3 py-2 border-0 border-b border-gray-300 bg-transparent text-sm focus:outline-none focus:border-[#2E5C91] resize-none'
                }
                placeholder={mode === 'create' ? 'Ej: Sin Observaciones' : ''}
              />
            </div>

            {/* ESTATUS */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                ESTATUS <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.authStatus}
                onChange={(e) => handleChange('authStatus', e.target.value)}
                disabled={isReadOnly}
                required
                className={inputClass}
              >
                <option value="">Seleccione...</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Autorizado">Autorizado</option>
                <option value="Rechazado">Rechazado</option>
              </select>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
