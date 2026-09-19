/**
 * motorContableTDC — ESPECIFICACIÓN 5, decisión pura.
 *
 * UN SOLO motor para los cuatro eventos (§8): ACTIVACIÓN_LINEA, CORTE_PERIODO,
 * APLICACIÓN_PAGOS y RECLASIFICACIÓN_SALDO. Lo único que cambia entre ellos es
 * de dónde salen los componentes y sus importes; el asiento se arma igual.
 *
 * ── Ninguna cuenta contable vive en este archivo (§3) ────────────────────
 * Las cuentas salen de la Guía Contabilizadora del producto —
 * `data.motorContable`, filas `{ evento, componente, debito, credito }` que el
 * usuario captura en Taller de Producto → Motor Contable. Si falta la
 * configuración, esto ABORTA (§61, §62); no inventa una cuenta ni omite el
 * renglón en silencio.
 *
 * ── Por qué no reutilicé `construirDetallePoliza` de formalizacionCarteraGPO ─
 * Aquella omite los componentes sin importe y sigue adelante, que es correcto
 * para la formalización GPO. §61/§62 exigen lo contrario: configuración
 * faltante es motivo de rollback. Sí se reutiliza `leerGuiaContabilizadora`,
 * que ya resuelve el evento por código o nombre sin el `includes()` que mezcla
 * guías con prefijo común.
 */
import { leerGuiaContabilizadora } from '../hooks/formalizacionCarteraGPO';

export const money = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/** Claves de evento de §4. El texto exacto lo define el catálogo del sistema. */
export const EVENTOS = {
  ACTIVACION_LINEA: 'ACTIVACION_LINEA',
  CORTE_PERIODO: 'CORTE_PERIODO',
  APLICACION_PAGOS: 'APLICACION_PAGOS',
  RECLASIFICACION_SALDO: 'RECLASIFICACION_SALDO',
} as const;

export type ClaveEvento = (typeof EVENTOS)[keyof typeof EVENTOS];

/**
 * Alias aceptados por evento. El catálogo lo captura una persona, así que el
 * mismo evento puede estar como "ACTIVACIÓN_LINEA", "ACTIVACION_LINEA" o
 * "Activación de Línea". `leerGuiaContabilizadora` normaliza y compara por
 * igualdad contra código y nombre.
 */
export const ALIAS_EVENTO: Record<ClaveEvento, string[]> = {
  ACTIVACION_LINEA: ['ACTIVACION_LINEA', 'ACTIVACIÓN_LINEA', 'ACTIVACION DE LINEA', 'Activación de Línea', 'ACTIVACION'],
  CORTE_PERIODO: ['CORTE_PERIODO', 'CORTE DE PERIODO', 'Corte de Periodo', 'CORTE'],
  APLICACION_PAGOS: ['APLICACION_PAGOS', 'APLICACIÓN_PAGOS', 'APLICACION DE PAGOS', 'Aplicación de Pagos'],
  RECLASIFICACION_SALDO: ['RECLASIFICACION_SALDO', 'RECLASIFICACIÓN_SALDO', 'RECLASIFICACION DE SALDO', 'Reclasificación de Saldo'],
};

/** Un concepto a contabilizar, con su importe ya determinado. */
export interface ComponenteContable {
  /** Clave del componente en el catálogo — lo que se busca en la guía. */
  clave: string;
  nombre?: string;
  /** Importe del evento para este componente. Debe ser > 0. */
  monto: number;
  /** §56 — la línea de origen (CxCDetail, AplicacionPagoDetail, etc.). */
  idDetalleOrigen?: string;
  referencia?: string;
}

/** §56 — un renglón contable. */
export interface PartidaContable {
  orden: number;
  cuentaContableId: string;
  cuentaContableGl: string;
  cuentaContableNombre: string;
  debe: number;
  haber: number;
  claveComponente: string;
  componenteId: string;
  concepto: string;
  idDocumentoOrigen?: string;
  idDetalleOrigen?: string;
  referencia?: string;
  /** §64 — qué regla generó este asiento. */
  idGuia?: string;
}

/** §9 — el resultado del motor. */
export interface PolizaArmada {
  ok: boolean;
  error?: string;
  pasoFallido?: string;

  claveEvento: string;
  fechaContable: string;
  idDocumentoOrigen?: string;
  partidas: PartidaContable[];
  totalDebe: number;
  totalHaber: number;
  /** §10 — sólo true cuando Debe == Haber con la precisión configurada. */
  cuadrada: boolean;
  montoContabilizado: number;
}

const norm = (s?: unknown) =>
  String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const aTiempo = (f?: string): number => {
  const t = new Date(`${String(f || '').slice(0, 10)}T00:00:00`).getTime();
  return isNaN(t) ? NaN : t;
};

/**
 * §63 — filas de la guía vigentes a la fecha contable.
 *
 * Si la fila no declara vigencias, se considera vigente: el modelo actual del
 * Motor Contable no las captura, y descartar por un campo inexistente dejaría
 * todos los eventos sin configuración.
 */
export function filasVigentes(filas: any[], fechaContable: string): any[] {
  const f = aTiempo(fechaContable);
  if (isNaN(f)) return filas;
  return (filas || []).filter(fila => {
    if (fila?.activo === false) return false;
    const ini = aTiempo(fila?.fechaInicioVigencia ?? fila?.fecha_inicio_vigencia);
    const fin = aTiempo(fila?.fechaFinVigencia ?? fila?.fecha_fin_vigencia);
    if (!isNaN(ini) && f < ini) return false;
    if (!isNaN(fin) && f > fin) return false;
    return true;
  });
}

/** Filas de la guía que corresponden a un componente, por código o por nombre. */
function filasDelComponente(guia: any[], clave: string): any[] {
  const c = norm(clave);
  if (!c) return [];
  return guia.filter(fila => {
    const comp = fila?.componente || {};
    return norm(comp.codigo) === c || norm(comp.nombre) === c;
  });
}

/**
 * §8 — motor genérico. Los cuatro eventos pasan por aquí.
 *
 * @param guia  `data.motorContable` del producto, sin filtrar.
 * @param nombreProducto sólo para los mensajes de §61.
 */
export function contabilizarEvento(params: {
  guia: any[] | null | undefined;
  claveEvento: ClaveEvento;
  componentes: ComponenteContable[];
  fechaContable: string;
  idDocumentoOrigen?: string;
  claveProducto?: string;
  nombreProducto?: string;
}): PolizaArmada {
  const { claveEvento, componentes, fechaContable, idDocumentoOrigen } = params;
  const producto = `${params.claveProducto || ''} ${params.nombreProducto || ''}`.trim() || 'el producto';

  const base: PolizaArmada = {
    ok: false,
    claveEvento,
    fechaContable,
    idDocumentoOrigen,
    partidas: [],
    totalDebe: 0,
    totalHaber: 0,
    cuadrada: false,
    montoContabilizado: 0,
  };

  const conImporte = (componentes || []).filter(c => money(c.monto) > 0);
  if (conImporte.length === 0) {
    return {
      ...base,
      error: `El evento "${claveEvento}" no tiene componentes con importe que contabilizar.`,
      pasoFallido: '§9 — sin componentes',
    };
  }

  // ── §2 — la guía del evento, vigente a la fecha contable (§63) ──
  const guiaEvento = filasVigentes(
    leerGuiaContabilizadora(params.guia, ALIAS_EVENTO[claveEvento] || [claveEvento]),
    fechaContable,
  );

  if (guiaEvento.length === 0) {
    return {
      ...base,
      error:
        `No existe una Guía Contabilizadora válida para:\n` +
        `Producto: ${producto}\nEvento: ${claveEvento}.`,
      pasoFallido: '§61 — configuración inexistente',
    };
  }

  const partidas: PartidaContable[] = [];
  let totalDebe = 0;
  let totalHaber = 0;
  let orden = 0;

  for (const comp of conImporte) {
    const importe = money(comp.monto);
    const filas = filasDelComponente(guiaEvento, comp.clave);

    // §61 — un componente sin configuración cancela TODO. No se omite.
    if (filas.length === 0) {
      return {
        ...base,
        error:
          `No existe una Guía Contabilizadora válida para:\n` +
          `Producto: ${producto}\nEvento: ${claveEvento}\n` +
          `Componente: ${comp.clave}${comp.nombre ? ` — ${comp.nombre}` : ''}.`,
        pasoFallido: '§61 — componente sin configuración',
      };
    }

    // §7 — un componente puede producir N renglones: uno por fila de la guía.
    for (const fila of filas) {
      const ctaD = fila?.debito || {};
      const ctaH = fila?.credito || {};

      // §62 — falta una cuenta obligatoria: no se genera una póliza incompleta.
      if (!ctaD.cuenta_gl && !ctaD.id) {
        return {
          ...base,
          error:
            `El componente "${comp.clave}" del evento "${claveEvento}" no tiene ` +
            `Cuenta de Débito configurada en la Guía Contabilizadora de ${producto}.`,
          pasoFallido: '§62 — componente sin cuenta',
        };
      }
      if (!ctaH.cuenta_gl && !ctaH.id) {
        return {
          ...base,
          error:
            `El componente "${comp.clave}" del evento "${claveEvento}" no tiene ` +
            `Cuenta de Crédito configurada en la Guía Contabilizadora de ${producto}.`,
          pasoFallido: '§62 — componente sin cuenta',
        };
      }

      const compId = String(fila?.componente?.id || '');
      const idGuia = String(fila?.id || fila?.guia_id || '');
      const concepto = comp.nombre || fila?.componente?.nombre || comp.clave;
      const comun = {
        claveComponente: comp.clave,
        componenteId: compId,
        concepto,
        idDocumentoOrigen,
        idDetalleOrigen: comp.idDetalleOrigen,
        referencia: comp.referencia,
        idGuia,
      };

      partidas.push({
        orden: ++orden,
        cuentaContableId: String(ctaD.id || ''),
        cuentaContableGl: String(ctaD.cuenta_gl || ''),
        cuentaContableNombre: String(ctaD.nombre || ''),
        debe: importe,
        haber: 0,
        ...comun,
      });
      partidas.push({
        orden: ++orden,
        cuentaContableId: String(ctaH.id || ''),
        cuentaContableGl: String(ctaH.cuenta_gl || ''),
        cuentaContableNombre: String(ctaH.nombre || ''),
        debe: 0,
        haber: importe,
        ...comun,
      });

      totalDebe = money(totalDebe + importe);
      totalHaber = money(totalHaber + importe);
    }
  }

  const cuadrada = totalDebe === totalHaber;

  // ── §10 — sin cuadre no se guarda nada ──
  if (!cuadrada) {
    return {
      ...base,
      partidas,
      totalDebe,
      totalHaber,
      error:
        `La póliza correspondiente al evento "${claveEvento}" no se encuentra cuadrada.\n` +
        `Total Debe: ${totalDebe.toFixed(2)}\nTotal Haber: ${totalHaber.toFixed(2)}\n` +
        `La operación contable fue cancelada.`,
      pasoFallido: '§10 — descuadre',
    };
  }

  return {
    ok: true,
    claveEvento,
    fechaContable,
    idDocumentoOrigen,
    partidas,
    totalDebe,
    totalHaber,
    cuadrada: true,
    montoContabilizado: money(conImporte.reduce((a, c) => a + money(c.monto), 0)),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// De dónde salen los componentes de cada evento
// ─────────────────────────────────────────────────────────────────────────

/** §12/§14 — ACTIVACIÓN_LINEA: un componente por el límite autorizado. */
export function componentesDeActivacion(
  montoAprobado: number,
  claveComponente = 'LINEA_AUTORIZADA',
): ComponenteContable[] {
  return [{ clave: claveComponente, nombre: 'Línea autorizada', monto: money(montoAprobado) }];
}

export interface RenglonCxC {
  id: string;
  claveConcepto: string;
  nombreConcepto?: string;
  monto: number;
  pagoTotal?: number;
}

/**
 * §20/§22 — CORTE_PERIODO: los componentes salen del Detalle de la CxC.
 * NO se recalculan desde Movimientos de Línea.
 *
 * §24 — si la suma del detalle no es el total del documento, el documento
 * operativo es inconsistente y no se contabiliza.
 */
export function componentesDeCorte(
  detalle: RenglonCxC[],
  montoTotalPagar: number,
): { componentes: ComponenteContable[]; error?: string } {
  const suma = money((detalle || []).reduce((a, d) => a + money(d.monto), 0));
  if (suma !== money(montoTotalPagar)) {
    return {
      componentes: [],
      error:
        `La suma del detalle de la CxC (${suma.toFixed(2)}) no coincide con su ` +
        `Monto Total a Pagar (${money(montoTotalPagar).toFixed(2)}). ` +
        `No se contabiliza un documento inconsistente.`,
    };
  }
  return {
    componentes: (detalle || [])
      .filter(d => money(d.monto) > 0)
      .map(d => ({
        clave: d.claveConcepto,
        nombre: d.nombreConcepto,
        monto: money(d.monto),
        idDetalleOrigen: d.id,
      })),
  };
}

export interface RenglonAplicacion {
  id: string;
  idCxC?: string;
  claveConcepto: string;
  nombreConcepto?: string;
  montoAplicado: number;
}

/**
 * §28/§29/§30 — APLICACIÓN_PAGOS: sólo lo REALMENTE aplicado.
 *
 * Nunca el monto del Pago Referenciado (§93.12): lo que quedó en la Cuenta EJE
 * no se contabiliza como pago de un concepto. Y cada aplicación parcial se
 * contabiliza sólo por su propio importe (§31).
 */
export function componentesDeAplicacionPagos(
  aplicaciones: RenglonAplicacion[],
): ComponenteContable[] {
  return (aplicaciones || [])
    .filter(a => money(a.montoAplicado) > 0)
    .map(a => ({
      clave: a.claveConcepto,
      nombre: a.nombreConcepto,
      monto: money(a.montoAplicado),
      idDetalleOrigen: a.id,
      referencia: a.idCxC,
    }));
}

/** §40/§41 — la composición del saldo que se traslada. */
export interface ComposicionSaldo {
  idCxCDetalleOrigen: string;
  claveConceptoOrigen: string;
  nombreConceptoOrigen?: string;
  montoOriginal: number;
  montoPagado: number;
  saldoReclasificado: number;
  ordenPrelacionOrigen: number;
}

/**
 * §39/§40/§72 — RECLASIFICACIÓN_SALDO.
 *
 * Devuelve los componentes a contabilizar Y la composición que debe guardarse
 * con el nuevo Cargo. §40 prohíbe quedarse sólo con el total: hay que poder
 * saber después cuánto del "Saldo Anterior" era capital, interés o IVA.
 */
export function componentesDeReclasificacion(
  detalle: RenglonCxC[],
  saldoPendienteCxC: number,
  ordenPrelacion?: Record<string, number>,
): { componentes: ComponenteContable[]; composicion: ComposicionSaldo[]; saldoTotal: number; error?: string } {
  const composicion: ComposicionSaldo[] = [];

  for (const d of detalle || []) {
    const pagado = money(d.pagoTotal || 0);
    const saldo = money(d.monto - pagado);
    if (saldo <= 0) continue;
    composicion.push({
      idCxCDetalleOrigen: d.id,
      claveConceptoOrigen: d.claveConcepto,
      nombreConceptoOrigen: d.nombreConcepto,
      montoOriginal: money(d.monto),
      montoPagado: pagado,
      saldoReclasificado: saldo,
      ordenPrelacionOrigen: ordenPrelacion?.[d.claveConcepto] ?? 0,
    });
  }

  const saldoTotal = money(composicion.reduce((a, c) => a + c.saldoReclasificado, 0));

  // §39/§72 — la suma del detalle debe ser exactamente el saldo del documento.
  if (saldoTotal !== money(saldoPendienteCxC)) {
    return {
      componentes: [], composicion: [], saldoTotal,
      error:
        `El saldo a reclasificar calculado del detalle (${saldoTotal.toFixed(2)}) no coincide ` +
        `con el Saldo Pendiente de la CxC (${money(saldoPendienteCxC).toFixed(2)}). ` +
        `La reclasificación fue cancelada.`,
    };
  }
  if (saldoTotal <= 0) {
    return {
      componentes: [], composicion: [], saldoTotal,
      error: 'La CxC no tiene saldo pendiente: no hay nada que reclasificar.',
    };
  }

  // §45 — se reclasifica concepto por concepto, para que la guía pueda mandar
  // cada uno a su cuenta puente propia. El total sale igual, pero el asiento
  // conserva de qué estaba hecho el saldo.
  return {
    saldoTotal,
    composicion,
    componentes: composicion.map(c => ({
      clave: c.claveConceptoOrigen,
      nombre: c.nombreConceptoOrigen,
      monto: c.saldoReclasificado,
      idDetalleOrigen: c.idCxCDetalleOrigen,
    })),
  };
}

/**
 * §53 — clave lógica de idempotencia por evento.
 * Una misma clave no debe producir dos pólizas vigentes.
 */
export function claveIdempotencia(
  claveEvento: ClaveEvento,
  idDocumentoOrigen: string,
  idDetalleOrigen?: string,
): string {
  return [claveEvento, idDocumentoOrigen, idDetalleOrigen || ''].join('|');
}
