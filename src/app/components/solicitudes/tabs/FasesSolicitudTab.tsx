import { useMemo } from 'react';
import { useProductosCatalogoDB } from '../../../hooks/useProductosCatalogoDB';

interface FaseDisplay {
  faseId: string;
  descripcion: string;
  promptIA?: string;
  notes?: string;
  assetBoolean?: boolean;
  area?: string;
}

interface FasesSolicitudTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
  productoId: string;
  faseIdActual: string;
}

export function FasesSolicitudTab({ mode, productoId, faseIdActual }: FasesSolicitudTabProps) {
  const { productos: productosDB } = useProductosCatalogoDB(true);

  const fasesProducto = useMemo(() => {
    if (!productoId || productosDB.length === 0) return [];
    
    const producto = productosDB.find(p => p.id === productoId);
    if (!producto) return [];

    const rawData = producto.rawData as Record<string, any>;
    if (!rawData) return [];

    const raw = rawData?.fases ?? rawData?.fasesRegistros ?? rawData?.fase ?? [];
    
    if (!Array.isArray(raw) || raw.length === 0) return [];

    return raw.map((f: any): FaseDisplay => ({
      faseId: String(f.phaseId ?? f.faseId ?? f.id ?? ''),
      descripcion: f.phaseName ?? f.descripcion ?? f.nombre ?? '',
      promptIA: f.promptIA || '',
      notes: f.notes || f.nota || '',
      assetBoolean: f.assetBoolean ?? true,
      area: f.area || '',
    }));
  }, [productoId, productosDB]);

  const faseActualNum = parseInt(faseIdActual) || 1;

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

  const getBadgeColor = (faseId: string) => {
    const num = parseInt(faseId) || 1;
    if (num < faseActualNum) return 'bg-green-100 text-green-700 border-green-200';
    if (num === faseActualNum) return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  const getBadgeIcon = (faseId: string) => {
    const num = parseInt(faseId) || 1;
    if (num < faseActualNum) {
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    if (num === faseActualNum) {
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
        </svg>
      );
    }
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
      </svg>
    );
  };

  return (
    <div className="p-4">
      <div className="text-xs text-gray-600 mb-4">
        Fases configuradas en el producto. Se muestran en orden de ejecución.
      </div>
      
      <div className="space-y-3">
        {fasesProducto.map((fase, index) => {
          const isActive = parseInt(fase.faseId) === faseActualNum;
          const isCompleted = parseInt(fase.faseId) < faseActualNum;
          const isPending = parseInt(fase.faseId) > faseActualNum;
          const hasPrompt = !!fase.promptIA;
          const hasArea = !!fase.area;

          return (
            <div
              key={fase.faseId}
              className={`
                border rounded-lg p-4 transition-all
                ${isActive ? 'border-blue-300 bg-blue-50/50 shadow-sm' : ''}
                ${isCompleted ? 'border-green-200 bg-green-50/30' : ''}
                ${isPending ? 'border-gray-200 bg-gray-50/30' : ''}
              `}
            >
              <div className="flex items-start gap-3">
                {/* Sequence number */}
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold
                  ${isActive ? 'bg-blue-500 text-white' : ''}
                  ${isCompleted ? 'bg-green-500 text-white' : ''}
                  ${isPending ? 'bg-gray-300 text-gray-600' : ''}
                `}>
                  {index + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-800">
                      {fase.descripcion || `Fase ${fase.faseId}`}
                    </span>
                    {hasArea && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full text-[10px] font-medium">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                          <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                        Área: {fase.area}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${getBadgeColor(fase.faseId)}`}>
                      {getBadgeIcon(fase.faseId)}
                      {isCompleted ? 'Completada' : isActive ? 'Actual' : 'Pendiente'}
                    </span>
                    {hasPrompt && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-medium">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                          <path d="M9 9h.01M15 9h.01M9.5 15a3.5 3.5 0 0 0 5 0"/>
                        </svg>
                        Prompt IA
                      </span>
                    )}
                  </div>

                  {fase.notes && (
                    <p className="text-xs text-gray-600 mb-2">{fase.notes}</p>
                  )}

                  {hasPrompt && fase.promptIA && (
                    <div className="mt-2 p-2 bg-purple-50 rounded border border-purple-100">
                      <div className="text-[10px] font-medium text-purple-700 mb-1">Prompt IA:</div>
                      <p className="text-xs text-purple-800 whitespace-pre-wrap">{fase.promptIA}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
  );
}
