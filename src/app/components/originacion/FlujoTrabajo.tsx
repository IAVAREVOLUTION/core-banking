/**
 * FlujoTrabajo.tsx — v1.0
 * 
 * Componente para visualizar el flujo de trabajo de Originación
 * Muestra las fases: Integración, Análisis, Jurídico, Liberación
 */
import { useMemo } from 'react';

interface FlujoTrabajoProps {
  faseActual?: string;
  subEstatus?: string;
  className?: string;
}

// Fases del flujo de trabajo
const PHASES = [
  { id: 'integracion', label: 'Integración', fase: 1 },
  { id: 'analisis', label: 'Análisis', fase: 2 },
  { id: 'juridico', label: 'Jurídico', fase: 3 },
  { id: 'liberacion', label: 'Liberación', fase: 4 },
];

export function FlujoTrabajo({ faseActual, subEstatus, className = '' }: FlujoTrabajoProps) {
  const currentPhaseIndex = useMemo(() => {
    if (!subEstatus && !faseActual) return 0;
    
    const faseLower = (subEstatus || faseActual || '').toLowerCase();
    
    if (faseLower.includes('integración') || faseLower.includes('integracion')) return 0;
    if (faseLower.includes('análisis') || faseLower.includes('analisis')) return 1;
    if (faseLower.includes('jurídico') || faseLower.includes('juridico')) return 2;
    if (faseLower.includes('liberación') || faseLower.includes('liberacion')) return 3;
    
    return 0;
  }, [faseActual, subEstatus]);

  return (
    <div className={`${className}`}>
      {/* Visualización del flujo */}
      <div className="flex items-center justify-center gap-0 py-4">
        {/* Inicio */}
        <div className="flex flex-col items-center">
          <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center text-white text-[10px] font-medium">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 5v3l2 2" />
            </svg>
          </div>
          <span className="text-[10px] text-gray-500 mt-1">Inicio</span>
        </div>
        <div className="w-6 h-0.5 bg-gray-300" />

        {PHASES.map((phase, idx) => (
          <div key={phase.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-24 h-12 rounded-lg flex items-center justify-center text-[11px] border-2 transition-all ${
                idx === currentPhaseIndex
                  ? 'bg-[#4A6FA5] text-white border-[#4A6FA5] shadow-lg scale-105'
                  : idx < currentPhaseIndex
                  ? 'bg-green-50 text-green-700 border-green-400'
                  : 'bg-gray-50 text-gray-400 border-gray-200'
              }`}>
                <div className="text-center">
                  <div className="text-[9px] opacity-70">Fase {phase.fase}</div>
                  <div className="font-medium">{phase.label}</div>
                </div>
              </div>
              {idx === currentPhaseIndex && (
                <div className="mt-1 text-[9px] text-[#4A6FA5] font-medium">Actual</div>
              )}
            </div>
            {idx < PHASES.length - 1 && (
              <div className={`w-6 h-0.5 ${idx < currentPhaseIndex ? 'bg-green-400' : 'bg-gray-300'}`} />
            )}
          </div>
        ))}

        <div className="w-6 h-0.5 bg-gray-300" />
        {/* Fin */}
        <div className="flex flex-col items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-[10px] font-medium ${
            currentPhaseIndex >= 3 ? 'bg-green-500' : 'bg-gray-400'
          }`}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 8l3 3 7-7" />
            </svg>
          </div>
          <span className="text-[10px] text-gray-500 mt-1">Fin</span>
        </div>
      </div>

      {/* Leyenda de fases */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        {PHASES.map((phase, idx) => (
          <div
            key={phase.id}
            className={`border rounded p-2 text-center ${
              idx === currentPhaseIndex
                ? 'border-[#4A6FA5] bg-[#D9E2F3]/30'
                : idx < currentPhaseIndex
                ? 'border-green-200 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-600">{phase.label}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                idx < currentPhaseIndex
                  ? 'bg-green-100 text-green-700'
                  : idx === currentPhaseIndex
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {idx < currentPhaseIndex ? 'Completada' : idx === currentPhaseIndex ? 'En curso' : 'Pendiente'}
              </span>
            </div>
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-1 rounded-full transition-all ${
                  idx < currentPhaseIndex
                    ? 'bg-green-500 w-full'
                    : idx === currentPhaseIndex
                    ? 'bg-[#4A6FA5] w-1/2'
                    : 'w-0'
                }`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { PHASES };
