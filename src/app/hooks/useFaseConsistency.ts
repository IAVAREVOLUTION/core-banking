/**
 * useFaseConsistency — valida que todos los indicadores de fase estén en sincronía.
 *
 * REGLA: la fuente de verdad son siempre solicitud.producto.fases[] y solicitud.faseActual.
 *
 * Retorna:
 *  - faseActualReal    → objeto de fase encontrado en fases[] por faseActualId
 *  - seqActual         → numero_consecutivo de la fase actual
 *  - faseSiguiente     → siguiente fase por numero_consecutivo
 *  - faseAnterior      → fase anterior por numero_consecutivo
 *  - isConsistent      → true si header, timeline y subtab están sincronizados
 *  - inconsistencias   → lista de mensajes de error si hay desinc
 */

export interface FaseProductoItem {
  /** Identificador único de la fase (guardado en BD como fases/faseActual) */
  faseId: string;
  /** Posición secuencial (numero_consecutivo): 1, 2, 3 … */
  seq: number;
  /** Nombre descriptivo de la fase */
  fase: string;
  area: string;
  notes?: string;
  promptIA?: string;
}

interface FaseConsistencyInput {
  /** Lista de fases del producto (fuente de verdad) */
  fases: FaseProductoItem[];
  /** Valor actual de formData.faseId (ID guardado en BD) */
  faseActualId: string;
  /** Descripción que muestra el header */
  headerDescripcionFase?: string;
  /** Seq que muestra el timeline */
  timelineSeq?: number;
  /** faseId que marca el subtab de fases como actual */
  subtabFaseId?: string;
}

export interface FaseConsistencyResult {
  faseActualReal: FaseProductoItem | null;
  seqActual: number;
  faseSiguiente: FaseProductoItem | null;
  faseAnterior: FaseProductoItem | null;
  isConsistent: boolean;
  inconsistencias: string[];
}

export function useFaseConsistency({
  fases,
  faseActualId,
  headerDescripcionFase,
  timelineSeq,
  subtabFaseId,
}: FaseConsistencyInput): FaseConsistencyResult {
  const faseActualReal =
    fases.find((f) => String(f.faseId) === String(faseActualId)) ?? null;

  const seqActual = faseActualReal?.seq ?? 0;

  const faseSiguiente =
    fases.find((f) => f.seq === seqActual + 1) ?? null;

  const faseAnterior =
    fases.find((f) => f.seq === seqActual - 1) ?? null;

  const inconsistencias: string[] = [];

  if (!faseActualReal) {
    inconsistencias.push(
      `faseActualId "${faseActualId}" no encontrado en fases del producto`
    );
  }

  if (
    faseActualReal &&
    headerDescripcionFase &&
    headerDescripcionFase !== faseActualReal.fase
  ) {
    inconsistencias.push(
      `Header muestra "${headerDescripcionFase}" pero debería ser "${faseActualReal.fase}"`
    );
  }

  if (
    faseActualReal &&
    timelineSeq !== undefined &&
    timelineSeq !== faseActualReal.seq
  ) {
    inconsistencias.push(
      `Timeline resalta seq=${timelineSeq} pero la fase actual tiene seq=${faseActualReal.seq}`
    );
  }

  if (
    faseActualReal &&
    subtabFaseId !== undefined &&
    String(subtabFaseId) !== String(faseActualReal.faseId)
  ) {
    inconsistencias.push(
      `Subtab marca faseId="${subtabFaseId}" pero la fase actual es "${faseActualReal.faseId}"`
    );
  }

  return {
    faseActualReal,
    seqActual,
    faseSiguiente,
    faseAnterior,
    isConsistent: inconsistencias.length === 0,
    inconsistencias,
  };
}
