import { useState, useEffect } from 'react';

interface AuditoriaProps {
  onBack: () => void;
  mode: 'nuevo' | 'editar' | 'ver';
  clienteId?: string | number;
}

interface AuditoriaData {
  fechaRegistro: string;
  usuarioRegistro: string;
  puestoTrabajo: string;
  sucursal: string;
  autorizante: string;
  codigoCompania: string;
  codigoDepartamento: string;
  observaciones: string;
  fechaModificacion: string;
  usuarioModificacion: string;
}

export function Auditoria({ onBack, mode, clienteId }: AuditoriaProps) {
  const storageKey = `cliente_${clienteId || 'temp'}_auditoria`;

  // SIEMPRE inicia vacío. Datos se cargan solo desde sessionStorage vinculado al clienteId.
  const emptyAuditoria: AuditoriaData = {
    fechaRegistro: '',
    usuarioRegistro: '',
    puestoTrabajo: '',
    sucursal: '',
    autorizante: '',
    codigoCompania: '',
    codigoDepartamento: '',
    observaciones: '',
    fechaModificacion: '',
    usuarioModificacion: ''
  };

  const [auditoria] = useState<AuditoriaData>(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return emptyAuditoria;
  });

  // Persistir auditoría en sessionStorage
  useEffect(() => {
    sessionStorage.setItem(storageKey, JSON.stringify(auditoria));
  }, [auditoria, storageKey]);

  return (
    <div className="bg-white">
      {/* Encabezado institucional */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-4">
        <span className="text-sm font-medium text-gray-800">AUDITORÍA</span>
      </div>

      {/* Contenido con 3 columnas */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-8">
          {/* Columna Izquierda */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">
                Fecha y hora del registro
              </label>
              <div className="text-xs text-gray-900 bg-gray-100 px-3 py-2 rounded border border-gray-300">
                {auditoria.fechaRegistro}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1.5">
                Usuario que registró
              </label>
              <div className="text-xs text-gray-900 bg-gray-100 px-3 py-2 rounded border border-gray-300">
                {auditoria.usuarioRegistro}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1.5">
                Puesto de Trabajo
              </label>
              <div className="text-xs text-gray-900 bg-gray-100 px-3 py-2 rounded border border-gray-300">
                {auditoria.puestoTrabajo}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1.5">
                Sucursal
              </label>
              <div className="text-xs text-gray-900 bg-gray-100 px-3 py-2 rounded border border-gray-300">
                {auditoria.sucursal}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1.5">
                Autorizante
              </label>
              <div className="text-xs text-gray-900 bg-gray-100 px-3 py-2 rounded border border-gray-300">
                {auditoria.autorizante}
              </div>
            </div>
          </div>

          {/* Columna Centro */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">
                Código de la compañía
              </label>
              <div className="text-xs text-gray-900 bg-gray-100 px-3 py-2 rounded border border-gray-300">
                {auditoria.codigoCompania}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1.5">
                Código del departamento
              </label>
              <div className="text-xs text-gray-900 bg-gray-100 px-3 py-2 rounded border border-gray-300">
                {auditoria.codigoDepartamento}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1.5">
                Observaciones
              </label>
              <div className="text-xs text-gray-900 bg-gray-100 px-3 py-2 rounded border border-gray-300 h-32">
                {auditoria.observaciones}
              </div>
            </div>
          </div>

          {/* Columna Derecha */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1.5">
                Fecha y hora de última modificación
              </label>
              <div className="text-xs text-gray-900 bg-gray-100 px-3 py-2 rounded border border-gray-300">
                {auditoria.fechaModificacion}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-600 mb-1.5">
                Último Usuario que Modificó
              </label>
              <div className="text-xs text-gray-900 bg-gray-100 px-3 py-2 rounded border border-gray-300">
                {auditoria.usuarioModificacion}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}