/**
 * FlujoTrabajo.tsx — v2.0
 *
 * Flujo de trabajo completo de Originación — 7 fases reales
 */
import { useMemo } from 'react';

interface FlujoTrabajoProps {
  faseActual?: string;
  subEstatus?: string;
  className?: string;
}

// Las 7 fases reales del proceso de Originación
const PHASES = [
  { id: 'integracion',    label: 'Integración',    labelShort: 'Integración',   fase: 1 },
  { id: 'analisis_op',   label: 'Análisis Op.',   labelShort: 'Anál. Op.',     fase: 2 },
  { id: 'juridico',      label: 'Jurídico',        labelShort: 'Jurídico',      fase: 3 },
  { id: 'formalizacion', label: 'Formalización',   labelShort: 'Formaliz.',     fase: 4 },
  { id: 'contratos',     label: 'Contratos',       labelShort: 'Contratos',     fase: 5 },
  { id: 'activacion_sol', label: 'Solic. Activac.', labelShort: 'Solic. Act.',  fase: 6 },
  { id: 'activacion',    label: 'Activación',      labelShort: 'Activación',    fase: 7 },
];

// Mapeo de FaseOriginacion → índice
const FASE_INDEX: Record<string, number> = {
  'Integración del Expediente':                   0,
  'Análisis de Expediente Operativo':             1,
  'Análisis de Expediente Jurídico':              2,
  'Formalización de Cuenta Financiera':           3,
  'Validación de Contratos y Pagarés Firmados':   4,
  'Solicitud de Activación de Cuenta Financiera': 5,
  'Activación de Cuenta Financiera':              6,
};

export function FlujoTrabajo({ faseActual, subEstatus, className = '' }: FlujoTrabajoProps) {
  const currentPhaseIndex = useMemo(() => {
    const key = subEstatus || faseActual || '';
    if (FASE_INDEX[key] !== undefined) return FASE_INDEX[key];

    // Fallback fuzzy match
    const kl = key.toLowerCase();
    if (kl.includes('integraci')) return 0;
    if (kl.includes('operativo'))  return 1;
    if (kl.includes('jur'))        return 2;
    if (kl.includes('formaliz'))   return 3;
    if (kl.includes('contrato'))   return 4;
    if (kl.includes('solic') && kl.includes('activ')) return 5;
    if (kl.includes('activ'))      return 6;
    return 0;
  }, [faseActual, subEstatus]);

  return (
    <div className={`${className}`}>
      {/* ── Barra de fases ── */}
      <div className="overflow-x-auto pb-1">
        <div className="flex items-center justify-start gap-0 py-3 min-w-max px-2">
          {/* Inicio */}
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="8" cy="8" r="6" />
                <path d="M8 5v3l2 2" />
              </svg>
            </div>
            <span className="text-[9px] text-gray-500 mt-1">Inicio</span>
          </div>
          <div className="w-4 h-0.5 bg-gray-300" />

          {PHASES.map((phase, idx) => (
            <div key={phase.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-20 h-10 rounded-lg flex items-center justify-center border-2 transition-all ${
                  idx === currentPhaseIndex
                    ? 'bg-[#4A6FA5] text-white border-[#4A6FA5] shadow-md scale-105'
                    : idx < currentPhaseIndex
                    ? 'bg-green-50 text-green-700 border-green-400'
                    : 'bg-gray-50 text-gray-400 border-gray-200'
                }`}>
                  <div className="text-center px-1">
                    <div className="text-[8px] opacity-60">F{phase.fase}</div>
                    <div className="text-[9px] font-medium leading-tight">{phase.labelShort}</div>
                  </div>
                </div>
                {idx === currentPhaseIndex && (
                  <div className="mt-0.5 text-[8px] text-[#4A6FA5] font-semibold">▲ Actual</div>
                )}
                {idx < currentPhaseIndex && (
                  <div className="mt-0.5 text-[8px] text-green-600">✓</div>
                )}
              </div>
              {idx < PHASES.length - 1 && (
                <div className={`w-4 h-0.5 ${idx < currentPhaseIndex ? 'bg-green-400' : 'bg-gray-300'}`} />
              )}
            </div>
          ))}

          <div className="w-4 h-0.5 bg-gray-300" />
          {/* Fin */}
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
              currentPhaseIndex >= PHASES.length - 1 ? 'bg-green-500' : 'bg-gray-300'
            }`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8l3 3 7-7" />
              </svg>
            </div>
            <span className="text-[9px] text-gray-500 mt-1">Fin</span>
          </div>
        </div>
      </div>

      {/* ── Leyenda — grid 7 columnas ── */}
      <div className="grid grid-cols-7 gap-1 mt-2">
        {PHASES.map((phase, idx) => (
          <div
            key={phase.id}
            className={`border rounded p-1.5 ${
              idx === currentPhaseIndex
                ? 'border-[#4A6FA5] bg-[#D9E2F3]/30'
                : idx < currentPhaseIndex
                ? 'border-green-200 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-1 gap-1">
              <span className="text-[9px] text-gray-600 truncate">{phase.labelShort}</span>
              <span className={`text-[8px] px-1 py-0.5 rounded shrink-0 ${
                idx < currentPhaseIndex
                  ? 'bg-green-100 text-green-700'
                  : idx === currentPhaseIndex
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {idx < currentPhaseIndex ? '✓' : idx === currentPhaseIndex ? '●' : '○'}
              </span>
            </div>
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-1 rounded-full transition-all ${
                idx < currentPhaseIndex
                  ? 'bg-green-500 w-full'
                  : idx === currentPhaseIndex
                  ? 'bg-[#4A6FA5] w-1/2'
                  : 'w-0'
              }`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { PHASES };
