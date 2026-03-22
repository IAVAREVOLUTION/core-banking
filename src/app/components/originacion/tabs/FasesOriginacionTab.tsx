import { useState } from 'react';

interface FaseDisplay {
  id: string;
  label: string;
  area: string;
}

interface FasesOriginacionTabProps {
  mode: 'editar' | 'ver';
  productoId: string;
  faseIdActual: string;
  onFaseChange?: (faseId: string, descripcion: string, area: string, promptIA: string) => void;
}

const ORIGINACION_FASES: FaseDisplay[] = [
  { id: 'integracion', label: 'Integración del Expediente', area: 'INTEGRACIÓN' },
  { id: 'analisis_op', label: 'Análisis de Expediente Operativo', area: 'ANÁLISIS' },
  { id: 'analisis_jur', label: 'Análisis de Expediente Jurídico', area: 'ANÁLISIS' },
  { id: 'formalizacion', label: 'Formalización de Cuenta Financiera', area: 'LIBERACIÓN' },
  { id: 'contratos', label: 'Validación de Contratos y Pagarés Firmados', area: 'LIBERACIÓN' },
  { id: 'solic_activacion', label: 'Solicitud de Activación de Cuenta Financiera', area: 'LIBERACIÓN' },
  { id: 'activacion', label: 'Activación de Cuenta Financiera', area: 'LIBERACIÓN' },
];

function getFaseIdFromSubEstatus(subEstatus: string): string {
  const FASE_INDEX: Record<string, number> = {
    'Integración del Expediente': 1,
    'Análisis de Expediente Operativo': 2,
    'Análisis de Expediente Jurídico': 3,
    'Formalización de Cuenta Financiera': 4,
    'Validación de Contratos y Pagarés Firmados': 5,
    'Solicitud de Activación de Cuenta Financiera': 6,
    'Activación de Cuenta Financiera': 7,
  };
  if (FASE_INDEX[subEstatus] !== undefined) {
    return String(FASE_INDEX[subEstatus]);
  }
  const lower = subEstatus.toLowerCase();
  if (lower.includes('integraci')) return '1';
  if (lower.includes('operativo') || (lower.includes('análisis') && lower.includes('oper'))) return '2';
  if (lower.includes('jurídi')) return '3';
  if (lower.includes('formaliz')) return '4';
  if (lower.includes('contrato') || lower.includes('validaci')) return '5';
  if (lower.includes('solic') && lower.includes('activ')) return '6';
  if (lower.includes('activac')) return '7';
  return '1';
}

export function FasesOriginacionTab({ mode, productoId, faseIdActual, onFaseChange }: FasesOriginacionTabProps) {
  const [faseSeleccionada, setFaseSeleccionada] = useState<FaseDisplay | null>(null);

  const faseActualNum = parseInt(getFaseIdFromSubEstatus(faseIdActual)) || 1;

  const handleFaseClick = (fase: FaseDisplay, index: number) => {
    setFaseSeleccionada(fase);
    if (onFaseChange && mode !== 'ver') {
      onFaseChange(String(index + 1), fase.label, fase.area, '');
    }
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
            {ORIGINACION_FASES.map((fase, index) => {
              const numFase = index + 1;
              const isActive = numFase === faseActualNum;
              const isPast = numFase < faseActualNum;
              const isSelected = faseSeleccionada?.id === fase.id;

              return (
                <button
                  key={fase.id}
                  onClick={() => handleFaseClick(fase, index)}
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
                      {numFase}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 text-sm truncate">
                        {fase.label}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-1.5 py-0.5 bg-cyan-100 text-cyan-700 rounded">
                          {fase.area}
                        </span>
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
                  {faseSeleccionada.label}
                </h5>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full">
                    {faseSeleccionada.area}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">
                  Descripción:
                </label>
                <p className="text-xs text-gray-700">
                  Fase {ORIGINACION_FASES.findIndex(f => f.id === faseSeleccionada.id) + 1} del flujo de originación.
                </p>
              </div>
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
