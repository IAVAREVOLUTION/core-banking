/**
 * FasesTab.tsx — v1.0
 * 
 * Tab para mostrar las fases del producto seleccionado en la solicitud.
 * Solo lectura - muestra información de fases del catálogo del producto.
 */
import { useMemo } from 'react';
import type { ProductoCatalogo } from '../../hooks/useProductosCatalogoDB';

interface FasesTabProps {
  productoId?: string;
  productoSeleccionado?: ProductoCatalogo | null;
  fasesDelProducto?: Array<{
    faseId: string;
    descripcion: string;
    [key: string]: any;
  }>;
}

export function FasesTab({ productoId, productoSeleccionado, fasesDelProducto }: FasesTabProps) {
  // Obtener fases del producto seleccionado
  const fases = useMemo(() => {
    // Si se pasan fases directamente, usarlas
    if (fasesDelProducto && fasesDelProducto.length > 0) {
      return fasesDelProducto;
    }
    
    // Buscar en rawData del producto
    const rd = productoSeleccionado?.rawData;
    const raw = rd?.fases ?? rd?.fasesRegistros ?? rd?.fase ?? rd?.phases;
    
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((f: any, idx: number) => ({
        faseId: String(f.phaseId ?? f.faseId ?? f.id ?? (idx + 1)),
        descripcion: f.phaseName ?? f.descripcion ?? f.nombre ?? f.name ?? `Fase ${idx + 1}`,
        orden: f.order ?? f.orden ?? f.sequence ?? idx + 1,
        activa: f.active ?? f.activa ?? f.estatus !== 'Inactiva',
        reglas: f.rules ?? f.reglas ?? f.conditions ?? f.condiciones ?? null,
        estado: f.estado ?? f.status ?? (f.active !== false ? 'Activa' : 'Inactiva'),
        duracion: f.duration ?? f.duracion ?? f.plazo ?? null,
        requisitos: f.requirements ?? f.requisitos ?? null,
      }));
    }
    
    return [];
  }, [productoSeleccionado, fasesDelProducto]);

  if (!productoId) {
    return (
      <div className="p-6 text-center text-gray-500 text-sm">
        <svg className="mx-auto mb-3 w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p>Seleccione un producto para ver sus fases</p>
      </div>
    );
  }

  if (fases.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 text-sm">
        <svg className="mx-auto mb-3 w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p>No se encontraron fases para este producto</p>
        <p className="text-xs text-gray-400 mt-1">El producto seleccionado no tiene fases configuradas</p>
      </div>
    );
  }

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#4A6FA5] to-[#607698] flex items-center justify-center shadow-sm">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="1.5">
              <path d="M4 4h12v12H4z" />
              <path d="M4 8h12M8 4v12" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-800">Fases del Producto</h4>
            <p className="text-[10px] text-gray-400">{fases.length} fase(s) configurada(s)</p>
          </div>
        </div>
      </div>

      {/* Lista de fases */}
      <div className="space-y-3">
        {fases.map((fase, idx) => (
          <div
            key={fase.faseId || idx}
            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                {/* Número de fase */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                  fase.estado === 'Activa' || fase.activa
                    ? 'bg-green-500'
                    : fase.estado === 'Inactiva'
                    ? 'bg-gray-400'
                    : 'bg-blue-500'
                }`}>
                  {fase.orden || idx + 1}
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-gray-800">{fase.descripcion}</h5>
                  <p className="text-[10px] text-gray-500">ID: {fase.faseId}</p>
                </div>
              </div>
              {/* Estado badge */}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                fase.estado === 'Activa' || fase.activa
                  ? 'bg-green-100 text-green-700'
                  : fase.estado === 'Inactiva'
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {fase.estado === 'Activa' || fase.activa ? 'Activa' : fase.estado === 'Inactiva' ? 'Inactiva' : 'Activa'}
              </span>
            </div>

            {/* Detalles adicionales */}
            <div className="ml-11 space-y-1.5 text-xs text-gray-600">
              {fase.duracion && (
                <div className="flex items-center gap-2">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="6" cy="6" r="5" />
                    <path d="M6 3v3l2 2" />
                  </svg>
                  <span>Duración: <strong>{fase.duracion}</strong></span>
                </div>
              )}
              
              {fase.reglas && (
                <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-100">
                  <p className="font-medium text-gray-700 mb-1">Reglas/Condiciones:</p>
                  <p className="text-gray-600">{String(fase.reglas)}</p>
                </div>
              )}

              {fase.requisitos && (
                <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                  <p className="font-medium text-blue-700 mb-1">Requisitos:</p>
                  <p className="text-gray-600">{String(fase.requisitos)}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div className="mt-4 flex items-center gap-4 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500" /> Fase activa
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-gray-400" /> Fase inactiva
        </span>
      </div>
    </div>
  );
}
