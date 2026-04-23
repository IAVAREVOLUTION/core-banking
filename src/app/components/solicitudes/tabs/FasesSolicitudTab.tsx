import { useMemo, useState } from 'react';
import { useProductosCatalogoDB } from '../../../hooks/useProductosCatalogoDB';

interface FaseDisplay {
  faseId: string;
  seq: number;      // ADD: numero_consecutivo
  descripcion: string;
  promptIA?: string;
  notes?: string;
  area?: string;
}

interface FasesSolicitudTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
  productoId: string;
  faseIdActual: string;
  faseActualSeq?: number;
  estatusSolicitud?: string;
}

export function FasesSolicitudTab({ mode, productoId, faseIdActual, faseActualSeq, estatusSolicitud }: FasesSolicitudTabProps) {
  const { productos: productosDB } = useProductosCatalogoDB(true);
  const [faseSeleccionada, setFaseSeleccionada] = useState<FaseDisplay | null>(null);

  const fasesProducto = useMemo(() => {
    if (!productoId || productosDB.length === 0) return [];
    
    const producto = productosDB.find(p => p.id === productoId);
    if (!producto) {
      console.log('[FasesSolicitudTab] Producto no encontrado:', productoId);
      console.log('[FasesSolicitudTab] Productos disponibles:', productosDB.map(p => ({ id: p.id, nombre: p.nombreProducto })));
      return [];
    }

    const rawData = producto.rawData as Record<string, any>;
    console.log('[FasesSolicitudTab] rawData keys:', Object.keys(rawData));
    console.log('[FasesSolicitudTab] rawData.fases:', rawData?.fases);
    console.log('[FasesSolicitudTab] rawData.fasesRegistros:', rawData?.fasesRegistros);
    console.log('[FasesSolicitudTab] rawData.fase:', rawData?.fase);
    
    if (!rawData) return [];

    // Captación guarda fases en fasesRegistros; fases puede ser {} (objeto vacío) — usar Array.isArray para no bloquear el fallback
    const raw = (Array.isArray(rawData?.fases) && rawData.fases.length > 0 ? rawData.fases : null)
      ?? (Array.isArray(rawData?.fasesRegistros) && rawData.fasesRegistros.length > 0 ? rawData.fasesRegistros : null)
      ?? (Array.isArray(rawData?.fase) ? rawData.fase : null)
      ?? [];
    console.log('[FasesSolicitudTab] raw array length:', Array.isArray(raw) ? raw.length : 'NOT ARRAY');

    if (!Array.isArray(raw) || raw.length === 0) return [];

    return raw.map((f: any, idx: number): FaseDisplay & { seq: number } => ({
      faseId: String(f.id ?? f.fase_id ?? f.seq ?? idx + 1),
      seq: parseInt(String(f.seq ?? f.numero_consecutivo ?? f.orden ?? idx + 1)),
      descripcion: f.fase || f.descripcion || '',
      promptIA: f.promptIA || '',
      notes: f.notes || '',
      area: f.area || '',
    }));
  }, [productoId, productosDB]);

  if (!productoId) {
    return (
      <div className="p-6 text-center text-gray-500 text-xs">
        Seleccione un producto para ver sus fases configuradas.
      </div>
    );
  }

  if (fasesProducto.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500 text-xs">
        Este producto no tiene fases configuradas.
      </div>
    );
  }

  const getAreaLabel = (descripcion: string, area?: string) => {
    if (area) return area;
    const lower = descripcion.toLowerCase();
    if (lower.includes('integraci')) return 'INTEGRACIÓN';
    if (lower.includes('análisis') || lower.includes('operativo')) return 'ANÁLISIS';
    if (lower.includes('jurídi')) return 'JURÍDICO';
    if (lower.includes('formaliz') || lower.includes('liberac')) return 'LIBERACIÓN';
    return '';
  };

  const handleFaseClick = (fase: FaseDisplay) => {
    setFaseSeleccionada(fase);
  };

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Listado de Fases ── */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Fases del Producto
          </h4>
          <div className="space-y-2">
            {fasesProducto.map((fase, index) => {
              const flujoFinalizado = estatusSolicitud === 'Autorizada' || estatusSolicitud === 'Aprobado';
              const isCurrentFase = faseActualSeq !== undefined
                ? fase.seq === faseActualSeq
                : fase.faseId === faseIdActual || parseInt(fase.faseId) === parseInt(faseIdActual);
              // Fase completada: anterior a la actual, O es la actual y el flujo ya finalizó
              const isPast = (faseActualSeq !== undefined
                ? fase.seq < faseActualSeq
                : parseInt(fase.faseId) < parseInt(faseIdActual))
                || (isCurrentFase && flujoFinalizado);
              // Fase activa: es la actual pero el flujo NO está finalizado
              const isActive = isCurrentFase && !flujoFinalizado;
              const isSelected = faseSeleccionada?.faseId === fase.faseId;
              const areaLabel = getAreaLabel(fase.descripcion, fase.area);

              return (
                <button
                  key={fase.faseId}
                  onClick={() => handleFaseClick(fase)}
                  className={`
                    w-full text-left p-3 rounded-lg border transition-all
                    ${isSelected ? 'border-blue-400 bg-blue-50 shadow-sm' : ''}
                    ${!isSelected && isActive ? 'border-blue-200 bg-blue-50/50 hover:bg-blue-100' : ''}
                    ${!isSelected && isPast ? 'border-green-200 bg-green-50/30 hover:bg-green-100' : ''}
                    ${!isSelected && !isActive && !isPast ? 'border-gray-200 bg-gray-50 hover:bg-gray-100' : ''}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <span className={`
                      w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                      ${isActive ? 'bg-blue-500 text-white' : ''}
                      ${isPast ? 'bg-green-500 text-white' : ''}
                      ${!isActive && !isPast ? 'bg-gray-300 text-gray-600' : ''}
                    `}>
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 text-sm truncate">
                        {fase.descripcion || `Fase ${fase.faseId}`}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {areaLabel && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded">
                            {areaLabel}
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>
                            Actual
                          </span>
                        )}
                        {isPast && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                            Completada
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Leyenda */}
          <div className="mt-4 flex items-center gap-4 text-[10px] text-gray-500">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Completada</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Actual</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-gray-300"></div>
              <span>Pendiente</span>
            </div>
          </div>
        </div>

        {/* ── Detalle de Fase Seleccionada ── */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            Detalle de Fase
          </h4>
          {faseSeleccionada ? (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="mb-3">
                <h5 className="font-semibold text-gray-800">
                  {faseSeleccionada.descripcion || `Fase ${faseSeleccionada.faseId}`}
                </h5>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full">
                    {getAreaLabel(faseSeleccionada.descripcion, faseSeleccionada.area) || 'Sin área'}
                  </span>
                </div>
              </div>

              {faseSeleccionada.notes && (
                <div className="mb-3">
                  <label className="text-xs font-medium text-gray-600">Notas:</label>
                  <p className="text-xs text-gray-700 mt-1">{faseSeleccionada.notes}</p>
                </div>
              )}

              {faseSeleccionada.promptIA && (
                <div>
                  <label className="text-xs font-medium text-purple-700 flex items-center gap-1 mb-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                      <path d="M9 9h.01M15 9h.01M9.5 15a3.5 3.5 0 0 0 5 0"/>
                    </svg>
                    Prompt IA:
                  </label>
                  <div className="bg-purple-50 border border-purple-200 rounded p-2">
                    <p className="text-xs text-purple-800 whitespace-pre-wrap">
                      {faseSeleccionada.promptIA}
                    </p>
                  </div>
                </div>
              )}

              {!faseSeleccionada.promptIA && !faseSeleccionada.notes && (
                <p className="text-xs text-gray-400 italic">
                  Esta fase no tiene notas ni prompt IA configurados.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
              <svg className="w-10 h-10 mx-auto text-gray-300 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/>
              </svg>
              <p className="text-xs text-gray-500">
                Seleccione una fase para ver sus detalles
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
