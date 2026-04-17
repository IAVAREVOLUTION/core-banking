/**
 * FlujoTrabajo.tsx — v3.0
 *
 * Flujo de trabajo de Originación — lee las fases configuradas en el producto.
 * Si no se pasan fases dinámicas, cae en el fallback de 7 fases genéricas.
 */
import { useMemo } from 'react';

export interface FaseFlujo {
  seq: number;
  fase: string;
  area?: string;
}

interface FlujoTrabajoProps {
  faseActual?: string;
  faseActualSeq?: number;   // numero_consecutivo (1-N) — takes priority
  subEstatus?: string;
  fases?: FaseFlujo[];      // Fases dinámicas del producto seleccionado
  /** Si true, la fase actual se pinta en verde (completada/aprobada) */
  completada?: boolean;
  className?: string;
}

// Fallback: 7 fases genéricas (solo si no se pasan fases dinámicas)
const PHASES_FALLBACK: FaseFlujo[] = [
  { seq: 1, fase: 'Integración',    area: 'INTEGRACIÓN' },
  { seq: 2, fase: 'Análisis Op.',   area: 'ANÁLISIS' },
  { seq: 3, fase: 'Jurídico',       area: 'JURÍDICO' },
  { seq: 4, fase: 'Formalización',  area: 'LIBERACIÓN' },
  { seq: 5, fase: 'Contratos',      area: 'OPERACIONES' },
  { seq: 6, fase: 'Solic. Activ.',  area: 'ADMINISTRACIÓN' },
  { seq: 7, fase: 'Activación',     area: 'OPERACIONES' },
];

/** Etiqueta corta para mostrar en la barra (máx ~10 chars) */
function shortLabel(fase: string): string {
  if (fase.length <= 11) return fase;
  return fase.substring(0, 9) + '…';
}

export function FlujoTrabajo({ faseActual, faseActualSeq, subEstatus, fases, completada = false, className = '' }: FlujoTrabajoProps) {
  const phases = (fases && fases.length > 0) ? fases : PHASES_FALLBACK;

  const currentPhaseIndex = useMemo(() => {
    // Prioridad 1: seq explícito
    if (faseActualSeq !== undefined && faseActualSeq >= 1) {
      const idx = phases.findIndex(p => p.seq === faseActualSeq);
      return idx >= 0 ? idx : faseActualSeq - 1;
    }
    // Prioridad 2: match por nombre exacto
    const key = subEstatus || faseActual || '';
    if (key) {
      const byName = phases.findIndex(p => p.fase === key);
      if (byName >= 0) return byName;
      // Prioridad 3: match parcial insensible
      const kl = key.toLowerCase();
      const partial = phases.findIndex(p => p.fase.toLowerCase().includes(kl) || kl.includes(p.fase.toLowerCase()));
      if (partial >= 0) return partial;
    }
    return 0;
  }, [faseActual, faseActualSeq, subEstatus, phases]);

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

          {phases.map((phase, idx) => (
            <div key={`${phase.seq}-${idx}`} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-20 h-10 rounded-lg flex items-center justify-center border-2 transition-all ${
                  idx === currentPhaseIndex && !completada
                    ? 'bg-[#4A6FA5] text-white border-[#4A6FA5] shadow-md scale-105'
                    : idx < currentPhaseIndex || (idx === currentPhaseIndex && completada)
                    ? 'bg-green-50 text-green-700 border-green-400'
                    : 'bg-gray-50 text-gray-400 border-gray-200'
                }`}>
                  <div className="text-center px-1">
                    <div className="text-[8px] opacity-60">F{phase.seq}</div>
                    <div className="text-[9px] font-medium leading-tight">{shortLabel(phase.fase)}</div>
                  </div>
                </div>
                {idx === currentPhaseIndex && !completada && (
                  <div className="mt-0.5 text-[8px] text-[#4A6FA5] font-semibold">▲ Actual</div>
                )}
                {(idx < currentPhaseIndex || (idx === currentPhaseIndex && completada)) && (
                  <div className="mt-0.5 text-[8px] text-green-600">✓</div>
                )}
              </div>
              {idx < phases.length - 1 && (
                <div className={`w-4 h-0.5 ${idx < currentPhaseIndex || (idx === currentPhaseIndex && completada) ? 'bg-green-400' : 'bg-gray-300'}`} />
              )}
            </div>
          ))}

          <div className={`w-4 h-0.5 ${completada && currentPhaseIndex >= phases.length - 1 ? 'bg-green-400' : 'bg-gray-300'}`} />
          {/* Fin */}
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
              currentPhaseIndex >= phases.length - 1 && completada ? 'bg-green-500' : currentPhaseIndex >= phases.length - 1 ? 'bg-[#4A6FA5]' : 'bg-gray-300'
            }`}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8l3 3 7-7" />
              </svg>
            </div>
            <span className="text-[9px] text-gray-500 mt-1">Fin</span>
          </div>
        </div>
      </div>

      {/* ── Leyenda — grid dinámico según cantidad de fases ── */}
      <div
        className="gap-1 mt-2"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}
      >
        {phases.map((phase, idx) => (
          <div
            key={`leg-${phase.seq}-${idx}`}
            className={`border rounded p-1.5 ${
              idx === currentPhaseIndex && !completada
                ? 'border-[#4A6FA5] bg-[#D9E2F3]/30'
                : idx < currentPhaseIndex || (idx === currentPhaseIndex && completada)
                ? 'border-green-200 bg-green-50'
                : 'border-gray-200 bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-1 gap-1">
              <span className="text-[9px] text-gray-600 truncate" title={phase.fase}>{shortLabel(phase.fase)}</span>
              <span className={`text-[8px] px-1 py-0.5 rounded shrink-0 ${
                idx < currentPhaseIndex || (idx === currentPhaseIndex && completada)
                  ? 'bg-green-100 text-green-700'
                  : idx === currentPhaseIndex
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {idx < currentPhaseIndex || (idx === currentPhaseIndex && completada) ? '✓' : idx === currentPhaseIndex ? '●' : '○'}
              </span>
            </div>
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-1 rounded-full transition-all ${
                idx < currentPhaseIndex || (idx === currentPhaseIndex && completada)
                  ? 'bg-green-500 w-full'
                  : idx === currentPhaseIndex
                  ? 'bg-[#4A6FA5] w-1/2'
                  : 'w-0'
              }`} />
            </div>
            {phase.area && (
              <div className="text-[8px] text-gray-400 mt-0.5 truncate">{phase.area}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Re-export para compatibilidad con código existente
export { PHASES_FALLBACK as PHASES };
