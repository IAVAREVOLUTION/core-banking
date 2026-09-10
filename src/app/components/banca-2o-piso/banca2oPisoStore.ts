/**
 * banca2oPisoStore.ts — REQ-17.
 *
 * Tipos, filtro y hook de datos del módulo Banca 2º Piso. Vive aparte de los
 * componentes para que `CarteraList` pueda importar el filtro sin arrastrar el
 * módulo entero (y sus gráficas) a su bundle.
 */
import { useState, useEffect, useCallback } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { fechasCobroComision } from '../../lib/fechasComisionGPO';
import type { CarteraCredito } from '../cartera/CarteraForm';
import { loadFromSession, loadFromSavedStore } from '../solicitudes/solicitudCreditoStore';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { Authorization: `Bearer ${publicAnonKey}` };

export const parseMon = (v: unknown): number =>
  parseFloat(String(v || '0').replace(/[$,\s]/g, '')) || 0;

export const fmtMoney = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 });

export const fmtMoneyExacto = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const norm = (v: unknown) =>
  String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** §Decisión #3 de la HU — qué se considera una línea "activa". */
export const ESTATUS_ACTIVOS_2O_PISO = ['activa', 'autorizada', 'en administracion'];

/**
 * Fila que administra este módulo: Línea de Crédito **y** estatus activo.
 *
 * Se exporta para que `CarteraList` excluya exactamente las mismas filas (§Decisión #2).
 * El criterio incluye el estatus a propósito: así una Línea de Crédito que todavía no
 * está activa sigue siendo visible en Cartera Crédito y ninguna cuenta desaparece de
 * los dos módulos a la vez.
 */
export function esLineaCredito2oPisoRow(lineaProducto: string, estatus: string): boolean {
  const linea = norm(lineaProducto);
  const esLineaCredito = linea.includes('linea') && linea.includes('credito');
  return esLineaCredito && ESTATUS_ACTIVOS_2O_PISO.includes(norm(estatus));
}

/** Cargo tal como viaja en `data.solicitud.cargos` (snake_case del Core). */
export interface CargoLinea {
  tipoCargo: string;
  descripcion: string;
  monto: number;
  fechaCargo: string;
  estatus: string;
  notas: string;
}

// ═══════════════════════════════════════════════════════════════════
// REQ-18 — Comisiones, Avisos y Prelación
// ═══════════════════════════════════════════════════════════════════

/** REQ-18 CA-14 — modo de operación de la línea. Vive en la línea, no en el producto (RN-06). */
export type SubEstatus2oPiso = 'Operación Normal' | 'Botón de Pánico';
export const SUB_ESTATUS_2O_PISO: SubEstatus2oPiso[] = ['Operación Normal', 'Botón de Pánico'];
/** CA-15 — toda línea arranca en Operación Normal. */
export const SUB_ESTATUS_DEFAULT: SubEstatus2oPiso = 'Operación Normal';

/** Periodos de cobro por año — misma tabla que usa el Cierre Comercial (RN-02). */
export const PERIODOS_POR_ANIO_2O_PISO: Record<string, number> = {
  Mensual: 12, Trimestral: 4, Semestral: 2, Anual: 1,
};

/** Un renglón del Calendario de Comisiones (HU-18.1). */
export interface ComisionProgramada {
  noPago: number;
  fechaPago: string;      // YYYY-MM-DD
  comision: number;       // Monto Garantizado × tasa ÷ periodos
  iva: number;
  total: number;
  /** 'Pendiente' | 'Avisada' | 'Pagada' | 'Cancelada' */
  estatus: string;
  /** Folio del Aviso de Vencimiento que la consumió (CA-12). */
  avisoId?: string;
}

/** Un renglón de una prelación ya generada (HU-18.3). */
export interface RenglonPrelacionGenerada {
  seq: number | string;
  concepto: string;
  valor: string;
  /** true en el renglón cuyo importe se calculó (CA-19), no se tomó del producto. */
  calculado?: boolean;
}

/** Una emisión de prelación. Se acumulan como histórico inmutable (§Decisión 4). */
export interface PrelacionGenerada {
  id: string;
  fecha: string;
  usuario: string;
  escenario: SubEstatus2oPiso;
  /** Importe que alimentó el renglón calculado. */
  montoBase: number;
  renglones: RenglonPrelacionGenerada[];
}

/** REQ-24 CA-16/RN-02 — disposición ya aplicada al saldo de la línea. */
export interface DisposicionAplicada {
  /** Id de la Solicitud de disposición (crédito simple). */
  disposicionId: string;
  noSol?: string;
  monto: number;
  fecha: string;
  /** Saldo de la línea después de aplicar esta disposición. */
  saldoResultante: number;
}

/** Nodo propio de REQ-18 dentro de `data.solicitud.banca2oPiso`. */
export interface Banca2oPisoData {
  subEstatus?: SubEstatus2oPiso;
  calendarioComisiones?: ComisionProgramada[];
  prelacionGenerada?: PrelacionGenerada[];
  /**
   * REQ-24 — disposiciones ya descontadas del saldo. Es el registro que hace
   * idempotente el descuento (RN-02: restar dos veces le quita crédito real al
   * cliente) y, de paso, el que permite distinguir un saldo en 0 "agotado" de
   * uno "nunca sembrado".
   */
  disposicionesAplicadas?: DisposicionAplicada[];
  /** REQ-24 §Decisión 2 — por qué esta línea está en pánico. */
  panicoDesde?: string;
  panicoPorDisposicion?: string;
}

export interface LineaCreditoRow extends CarteraCredito {
  /** `data.solicitud.terminos_condiciones._raw` — alimenta la pestaña de Términos. */
  terminosRaw: Record<string, any>;
  /**
   * `data.solicitud.cargos` — alimenta la pestaña de Cargos.
   * Se leen de la BD y NO de sessionStorage: este módulo puede abrirse sin haber
   * pasado nunca por el formulario de la Solicitud, que es quien llena la sesión.
   */
  cargos: CargoLinea[];
  productoId?: string;
  faseId?: number;
  descripcionFase?: string;
  tipoPersona?: string;
  curp?: string;
  rfc?: string;
  sucursal?: string;
  idGarantiaCartera?: string;
  polizaContableApertura?: string;
  /** REQ-18 — `data.solicitud.banca2oPiso`, ya normalizado. */
  banca2oPiso: Banca2oPisoData;
  /**
   * REQ-20 CA-02 — saldo vigente de la garantía.
   *
   * Sale de la columna `saldo_actual` cuando la autorización ya la sembró; si no,
   * cae al **Monto Garantizado GPO** de los términos de la propia línea.
   *
   * Ese respaldo existe porque la siembra (HU-20.3) sólo corre en autorizaciones
   * nuevas: las líneas autorizadas antes quedaron en 0 y se verían sin garantía
   * teniendo cientos de millones capturados.
   *
   * REQ-24 CA-22 — ese respaldo ya **no** se aplica cuando la línea tiene
   * disposiciones aplicadas: ahí un 0 es garantía agotada y se muestra como tal
   * (RN-06). Sólo sobrevive para líneas que nunca se sembraron y que nadie ha
   * consumido, donde un 0 sigue significando "falta el dato", no "sin crédito".
   */
  saldoGarantia?: number;
  /** true si el saldo salió de `saldo_actual`; false si es el respaldo de términos. */
  saldoGarantiaSembrado: boolean;
}

/** Discrimina los Avisos de comisión GPO del resto de la cartera en Cobranza. */
export const SUB_TIPO_COMISION_GPO = 'ComisionGPO';

/**
 * CA-19 — suma de los Avisos de Vencimiento en estatus `Pendiente` de esta línea.
 *
 * Se lee de Cobranza y NO del calendario local a propósito: el pago se aplica
 * desde Cobranza (`PATCH /cartera/facturas/:id/pagar`) y ese cambio no regresa
 * solo a la Solicitud — mismo motivo por el que la Fase 6 usa
 * `fetchEstatusFacturaCobranza` en vez de la copia guardada. Si sumáramos el
 * calendario, un aviso ya pagado seguiría inflando la prelación.
 */
export async function sumarAvisosPendientes(
  solicitudId: string,
): Promise<{ ok: boolean; monto: number; cuantos: number; error?: string }> {
  try {
    const res = await window.fetch(
      `${API_BASE}/cartera/cobranza?sub_tipo=${SUB_TIPO_COMISION_GPO}`,
      { headers: HDR },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, monto: 0, cuantos: 0, error: json.error || `HTTP ${res.status}` };

    const propias = (json.data || []).filter((r: any) =>
      String(r.solicitud_id) === String(solicitudId) && norm(r.estatus) === 'pendiente',
    );
    const monto = propias.reduce((s: number, r: any) => s + parseMon(r.monto_transaccion ?? r.monto), 0);
    return { ok: true, monto, cuantos: propias.length };
  } catch (e: any) {
    return { ok: false, monto: 0, cuantos: 0, error: e?.message || String(e) };
  }
}

/** Normaliza una fila de simulación / cotización a ComisionProgramada. */
function normalizarFilaComision(r: any, fallbackIndex: number): ComisionProgramada {
  const comision = parseMon(r.comision ?? r.pago_interes ?? r.pagoInteres ?? r.pago_periodo ?? r.pagoPeriodo ?? r.monto ?? 0);
  const iva = parseMon(r.iva ?? r.iva_interes ?? r.ivaInteres ?? 0);
  const total = parseMon(r.total ?? r.pago_total ?? r.pagoTotal ?? (comision + iva));

  return {
    noPago: Number(r.noPago ?? r.no_pago ?? r.noAportacion ?? r.no_aportacion ?? fallbackIndex),
    fechaPago: String(r.fechaPago ?? r.fecha_pago ?? r.fecha ?? ''),
    comision,
    iva,
    total,
    estatus: String(r.estatus || 'Pendiente'),
    avisoId: r.avisoId ?? r.aviso_id ?? undefined,
  };
}

/** Extrae la cotización / calendario de comisiones generado en Solicitud/Originación o guardado en BD. */
export function extraerCalendarioComisiones(
  rawBanca2oPiso?: any,
  rawSolicitud?: any,
  dataObj?: any,
  rowId?: string | number,
  noSol?: string,
): ComisionProgramada[] {
  // 1. Si ya existe en banca2oPiso.calendarioComisiones con elementos
  if (Array.isArray(rawBanca2oPiso?.calendarioComisiones) && rawBanca2oPiso.calendarioComisiones.length > 0) {
    return rawBanca2oPiso.calendarioComisiones.map((r: any, idx: number) => normalizarFilaComision(r, idx + 1));
  }

  // 2. Revisar sesión activa (sessionStorage / savedStore)
  const sessionSim = (typeof window !== 'undefined')
    ? (
        (rowId ? (loadFromSession<any[]>(rowId, 'simulacion') || loadFromSavedStore<any[]>(rowId, 'simulacion') || loadFromSession<any[]>(rowId, 'calendarioComisiones') || loadFromSavedStore<any[]>(rowId, 'calendarioComisiones')) : null) ||
        (noSol ? (loadFromSession<any[]>(noSol, 'simulacion') || loadFromSavedStore<any[]>(noSol, 'simulacion') || loadFromSession<any[]>(noSol, 'calendarioComisiones') || loadFromSavedStore<any[]>(noSol, 'calendarioComisiones')) : null)
      )
    : null;

  if (Array.isArray(sessionSim) && sessionSim.length > 0) {
    return sessionSim.map((r: any, idx: number) => normalizarFilaComision(r, idx + 1));
  }

  // 3. Buscar en el JSONB de la solicitud (data.solicitud.simulacion o data.simulacion o data.cotizacion)
  const simObj = rawSolicitud?.simulacion || dataObj?.simulacion || {};
  const rawSimRows = Array.isArray(simObj?.resultado_simulacion) && simObj.resultado_simulacion.length > 0
    ? simObj.resultado_simulacion
    : Array.isArray(simObj) && simObj.length > 0
      ? simObj
      : Array.isArray(rawSolicitud?.resultado_simulacion) && rawSolicitud.resultado_simulacion.length > 0
        ? rawSolicitud.resultado_simulacion
        : Array.isArray(simObj?.calendario_aportaciones) && simObj.calendario_aportaciones.length > 0
          ? simObj.calendario_aportaciones
          : Array.isArray(simObj?.calendario_arrendamiento) && simObj.calendario_arrendamiento.length > 0
            ? simObj.calendario_arrendamiento
            : Array.isArray(rawSolicitud?.cotizacion?.simulacion) && rawSolicitud.cotizacion.simulacion.length > 0
              ? rawSolicitud.cotizacion.simulacion
              : [];

  if (rawSimRows.length > 0) {
    return rawSimRows.map((r: any, idx: number) => normalizarFilaComision(r, idx + 1));
  }

  return [];
}

/** Lee el nodo de REQ-18 con valores por defecto e hidrata el calendario con la cotización previa (CA-15). */
function normalizarBanca2oPiso(
  raw: any,
  rawSolicitud?: any,
  dataObj?: any,
  rowId?: string | number,
  noSol?: string,
): Banca2oPisoData {
  const n = (raw || {}) as Record<string, any>;
  const calendario = extraerCalendarioComisiones(n, rawSolicitud, dataObj, rowId, noSol);
  return {
    subEstatus: SUB_ESTATUS_2O_PISO.includes(n.subEstatus) ? n.subEstatus : SUB_ESTATUS_DEFAULT,
    calendarioComisiones: calendario,
    prelacionGenerada: Array.isArray(n.prelacionGenerada) ? n.prelacionGenerada : [],
    // REQ-24 — sin esto el nodo se reescribiria sin las disposiciones aplicadas
    // y el descuento dejaria de ser idempotente al recargar.
    disposicionesAplicadas: Array.isArray(n.disposicionesAplicadas) ? n.disposicionesAplicadas : [],
    panicoDesde: n.panicoDesde || undefined,
    panicoPorDisposicion: n.panicoPorDisposicion || undefined,
  };
}

/**
 * Parámetros de comisión de la línea, leídos de `terminos_condiciones._raw`
 * (los siembra el Cierre Comercial de la Oportunidad — ver REQ-8).
 */
export function parametrosComisionGPO(row: LineaCreditoRow) {
  const t = row.terminosRaw || {};
  const montoGarantizado = parseMon(t.montoGarantizadoGpo);
  const tasaAnual = parseFloat(String(t.tasaComisionAnualPactada || '0')) || 0;
  const periodicidad = String(t.periodicidadCobroGpo || '');
  const periodosPorAnio = PERIODOS_POR_ANIO_2O_PISO[periodicidad] || 0;
  // El plazo de una línea de 2o Piso se captura en AÑOS (ver DefaultTab).
  //
  // Respaldo a `plazoBonosAnios`: el Cierre Comercial manda ese campo (plazo de
  // la emisión bursátil) pero NO manda `plazo`, así que hay líneas reales con
  // `plazo` vacío donde el calendario salía en 0 renglones. Para la GPO el
  // plazo relevante es justamente el de la emisión: la comisión se cobra
  // mientras viva el bono garantizado.
  const plazoAnios =
    parseInt(String(row.plazo || '0'), 10) ||
    parseInt(String(t.plazoBonosAnios || '0'), 10) ||
    0;
  return { montoGarantizado, tasaAnual, periodicidad, periodosPorAnio, plazoAnios };
}

/** CA-06 — qué le falta a la línea para poder calcular comisiones. */
export function faltantesComisionGPO(row: LineaCreditoRow): string[] {
  const p = parametrosComisionGPO(row);
  const f: string[] = [];
  if (p.montoGarantizado <= 0) f.push('Monto Garantizado GPO');
  if (p.tasaAnual <= 0) f.push('Tasa Comisión Anual Pactada');
  if (!p.periodosPorAnio) f.push('Periodicidad de Cobro');
  if (p.plazoAnios <= 0) f.push('Plazo de la línea');
  return f;
}

/**
 * CA-04 / RN-01 / RN-02 — genera el calendario de comisiones de TODO el plazo.
 *
 * §Decisión 1 de la HU (opción a): no es un año como la cotización del Cierre
 * Comercial, sino `plazo × periodicidad` renglones — es lo que de verdad se
 * cobra durante la vida de la línea. La garantía no amortiza capital: cada
 * periodo sólo devenga comisión + IVA sobre el Monto Garantizado constante.
 */
export function generarCalendarioComisiones(
  row: LineaCreditoRow,
  ivaPorcentaje = 16,
  fechaInicio?: string,
): ComisionProgramada[] {
  const { montoGarantizado, tasaAnual, periodosPorAnio, plazoAnios } = parametrosComisionGPO(row);
  const total = Math.round(plazoAnios * periodosPorAnio);
  if (total <= 0 || montoGarantizado <= 0 || tasaAnual <= 0) return [];

  const comisionPorPeriodo = (montoGarantizado * (tasaAnual / 100)) / periodosPorAnio;
  const ivaPorPeriodo = comisionPorPeriodo * (ivaPorcentaje / 100);

  // Ancla: inicio real de la línea. Sin esto las fechas dependían del día en
  // que se picara el botón y recotizar las recorría todas.
  const t = row.terminosRaw || {};
  const ancla = fechaInicio || t.fechaInicio || t.fechaPrimerPago || row.fechaSol || '';
  const fechas = fechasCobroComision(total, periodosPorAnio, ancla);

  return fechas.map((fechaPago, i) => ({
    noPago: i + 1,
    fechaPago,
    comision: comisionPorPeriodo,
    iva: ivaPorPeriodo,
    total: comisionPorPeriodo + ivaPorPeriodo,
    estatus: 'Pendiente',
  }));
}

/**
 * Persiste el nodo `data.solicitud.banca2oPiso` de la línea.
 *
 * Se manda SOLO el parche: el PUT del edge function hace deep-merge del jsonb
 * (`deepMergeData`, index.ts:416) conservando todo lo demás, y reemplaza los
 * arrays de forma atómica — que es justo lo que se quiere al regenerar el
 * calendario. NO se usa `saveSolicitud` porque ese camino reconstruye el
 * payload completo del formulario y aquí no hay formulario abierto.
 */
export async function guardarBanca2oPiso(
  solicitudId: string,
  patch: Partial<Banca2oPisoData>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await window.fetch(`${API_BASE}/solicitudes-credito/${solicitudId}`, {
      method: 'PUT',
      headers: { ...HDR, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { solicitud: { banca2oPiso: patch } } }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// REQ-20 — Disposiciones y Saldo Monto Garantía
// ═══════════════════════════════════════════════════════════════════

/**
 * CA-02 / CA-03 — de dónde sale el Saldo Monto Garantía de una línea.
 *
 * Orden: la columna `saldo_actual` si ya fue sembrada; si no, el Monto
 * Garantizado GPO de los términos. Ver la nota de `LineaCreditoRow.saldoGarantia`
 * sobre por qué ese respaldo caduca cuando exista la revolvencia.
 *
 * Sin ninguno de los dos devuelve `undefined` y no 0: la pantalla muestra '—',
 * porque una línea sin monto capturado no es lo mismo que una agotada.
 */
export function resolverSaldoGarantia(
  saldoActualCol: unknown,
  montoGarantizadoTerminos: unknown,
  /**
   * REQ-24 CA-22 — disposiciones ya descontadas de esta línea.
   *
   * REQ-20 dejó un respaldo que deducía el saldo del Monto Garantizado cuando la
   * columna venía en 0, con su caducidad anotada: valía "sólo mientras nada
   * consuma el saldo". Esta HU es ese momento.
   *
   * En vez de retirarlo a ciegas —lo que dejaría las líneas nunca sembradas
   * mostrando $0.00, es decir, "garantía agotada" sin haberse ejercido— se usa
   * el discriminador que faltaba: **si ya se aplicó alguna disposición, un 0 es
   * agotamiento real y se respeta**. Sin disposiciones aplicadas, un 0 sólo
   * puede significar que nadie sembró el saldo, y ahí el respaldo sigue siendo
   * la lectura correcta. El efecto que pedía CA-22 se cumple —nunca se muestra
   * crédito disponible donde ya se consumió— sin romper los datos vigentes.
   */
  disposicionesAplicadas?: unknown[],
): { saldoGarantia?: number; saldoGarantiaSembrado: boolean } {
  const sembrado = parseMon(saldoActualCol);
  if (sembrado > 0) return { saldoGarantia: sembrado, saldoGarantiaSembrado: true };

  const yaConsumida = Array.isArray(disposicionesAplicadas) && disposicionesAplicadas.length > 0;
  if (yaConsumida) {
    // Garantía agotada: 0 es el dato, no una ausencia (RN-06).
    return { saldoGarantia: 0, saldoGarantiaSembrado: true };
  }

  const respaldo = parseMon(montoGarantizadoTerminos);
  if (respaldo > 0) return { saldoGarantia: respaldo, saldoGarantiaSembrado: false };

  return { saldoGarantia: undefined, saldoGarantiaSembrado: false };
}

/**
 * Producto de disposición, tal como lo captura el subtab "Productos Disposición"
 * del producto (se guarda en `producto.paquetes` vía `PaquetesTab`).
 */
export interface ProductoDisposicion {
  id: string;
  nombre: string;
  lineaProducto: string;
  sublineaProducto: string;
  tipo: string;
}

/**
 * CA-09 / RN-04 — catálogo de productos con los que se puede disponer de esta
 * línea. Sale del producto de la línea, no del catálogo general: es el control
 * que impide disponer con un producto no autorizado.
 *
 * §Decisión 1(a): manda la casilla "Sel" (`selectBoolean`). Si el usuario
 * capturó renglones pero no marcó ninguno, se devuelven todos en vez de un
 * combo vacío — un catálogo capturado y no marcado es mucho más probable que
 * sea un descuido de captura que una lista deliberadamente vacía.
 */
export function productosDisposicionDe(paquetes: any[] | undefined | null): ProductoDisposicion[] {
  if (!Array.isArray(paquetes) || paquetes.length === 0) return [];
  const mapear = (p: any): ProductoDisposicion => ({
    id: String(p?.paqueteProductoId ?? p?.id ?? ''),
    nombre: String(p?.paqueteProductoNombre ?? '').trim(),
    lineaProducto: String(p?.lineaProducto ?? ''),
    sublineaProducto: String(p?.sublineaProducto ?? ''),
    tipo: String(p?.tipo ?? ''),
  });
  const conNombre = paquetes.filter(p => String(p?.paqueteProductoNombre ?? '').trim() !== '');
  const marcados = conNombre.filter(p => p?.selectBoolean === true);
  return (marcados.length > 0 ? marcados : conNombre).map(mapear);
}

/**
 * CA-18 / §Decisión 2(a) — sella el vínculo de la disposición con su línea
 * padre en `data.solicitud.disposicionDe`.
 *
 * Va como PUT aparte porque `formToDBPayload` tiene lista blanca de claves: un
 * campo nuevo pasado por `allSubtabs` se descarta en silencio. Este endpoint
 * hace deep-merge del JSONB, que es el mismo camino que usa REQ-18 para
 * `banca2oPiso`.
 */
export async function vincularDisposicion(
  disposicionId: string,
  lineaId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!disposicionId || !lineaId) return { ok: false, error: 'Falta el id de la disposición o el de la línea' };
  try {
    const res = await window.fetch(`${API_BASE}/solicitudes-credito/${disposicionId}`, {
      method: 'PUT',
      headers: { ...HDR, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { solicitud: { disposicionDe: lineaId } } }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * REQ-24 — persiste las Cuenta(s) Beneficiaria(s) en el JSONB de la Solicitud.
 *
 * Necesita PUT propio porque `formToDBPayload` sólo deja pasar claves conocidas:
 * guardarlas únicamente en sessionStorage las perdía al recargar, y entonces la
 * liberación no encontraba a dónde dispersar. Mismo camino que `disposicionDe`.
 */
export async function guardarCuentasBeneficiarias(
  solicitudId: string | number,
  items: any[],
): Promise<{ ok: boolean; error?: string }> {
  if (!solicitudId) return { ok: false, error: 'Falta el id de la solicitud' };
  try {
    const res = await window.fetch(`${API_BASE}/solicitudes-credito/${solicitudId}`, {
      method: 'PUT',
      headers: { ...HDR, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { solicitud: { cuentasBeneficiarias: items } } }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/** Lee las Cuenta(s) Beneficiaria(s) guardadas en la BD. */
export async function fetchCuentasBeneficiarias(solicitudId: string | number): Promise<any[]> {
  if (!solicitudId) return [];
  try {
    const res = await window.fetch(`${API_BASE}/solicitudes-credito`, { headers: HDR });
    const json = await res.json();
    if (!res.ok) return [];
    const fila = (json.data || []).find((r: any) => String(r.id) === String(solicitudId));
    let d = fila?.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
    const arr = d?.solicitud?.cuentasBeneficiarias;
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

/**
 * Línea padre de una disposición, consultada a la BD.
 *
 * `lineaPadreDe()` sirve cuando ya se tiene el JSONB en la mano; esta versión es
 * para cuando sólo se tiene el id. Leerlo de sesión no es fiable: el vínculo se
 * sella con un PUT directo (no pasa por `formToDBPayload`), así que puede no
 * estar en la copia local de la Solicitud que tenga abierta el formulario.
 *
 * Devuelve '' si la solicitud no es una disposición.
 */
export async function fetchLineaPadre(solicitudId: string): Promise<string> {
  if (!solicitudId) return '';
  try {
    const res = await window.fetch(`${API_BASE}/solicitudes-credito`, { headers: HDR });
    const json = await res.json();
    if (!res.ok) return '';
    const fila = (json.data || []).find((r: any) => String(r.id) === String(solicitudId));
    return fila ? lineaPadreDe(fila.data) : '';
  } catch {
    return '';
  }
}

/** CA-17 — lee el vínculo al padre del JSONB de una solicitud, venga como venga. */
export function lineaPadreDe(dataObj: any): string {
  const d = typeof dataObj === 'string' ? (() => { try { return JSON.parse(dataObj); } catch { return {}; } })() : (dataObj || {});
  return String(d?.solicitud?.disposicionDe || d?.disposicionDe || '');
}

/**
 * CA-20…CA-26 — siembra el Monto Garantizado en la columna `saldo_actual`.
 *
 * No se agrega endpoint: `PUT /solicitudes-credito/:id` ya acepta `saldo_actual`
 * y lo escribe con `COALESCE`, así que un `null` no borra el valor existente.
 *
 * CA-26: con monto 0 o ausente NO se escribe. Un cero aquí no significa
 * "garantía agotada", significa "no capturaron el monto", y escribirlo dejaría
 * la línea indistinguible de una consumida.
 */
export async function sembrarSaldoGarantia(
  solicitudId: string,
  montoGarantizado: number,
): Promise<{ ok: boolean; escrito: boolean; error?: string }> {
  if (!solicitudId) return { ok: false, escrito: false, error: 'Falta el id de la solicitud' };
  if (!(montoGarantizado > 0)) return { ok: true, escrito: false };
  try {
    const res = await window.fetch(`${API_BASE}/solicitudes-credito/${solicitudId}`, {
      method: 'PUT',
      headers: { ...HDR, 'Content-Type': 'application/json' },
      body: JSON.stringify({ saldo_actual: montoGarantizado }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, escrito: false, error: json.error || `HTTP ${res.status}` };
    return { ok: true, escrito: true };
  } catch (e: any) {
    return { ok: false, escrito: false, error: e?.message || String(e) };
  }
}

// ═══════════════════════════════════════════════════════════════════
// REQ-24 — Activación de una disposición: pánico + consumo del saldo
// ═══════════════════════════════════════════════════════════════════

export interface ResultadoAplicarDisposicion {
  ok: boolean;
  /** true si esta llamada aplicó el efecto; false si ya estaba aplicado. */
  aplicada: boolean;
  saldoAnterior?: number;
  saldoNuevo?: number;
  error?: string;
}

/**
 * CA-11…CA-21 — efecto de activar una disposición sobre su línea padre:
 * enciende el **Botón de Pánico** y **resta** el monto del saldo de la garantía.
 *
 * Las dos cosas van juntas y en una sola función a propósito: son un mismo hecho
 * de negocio (la garantía se está ejerciendo) y separarlas abriría la puerta a
 * que una ocurra sin la otra.
 *
 * **Idempotencia (RN-02).** Antes de tocar nada se revisa si esta disposición ya
 * está en `disposicionesAplicadas`. Restar dos veces no es un error cosmético:
 * le quita crédito real al cliente y nadie lo notaría hasta que la línea se
 * agote antes de tiempo.
 */
export async function aplicarDisposicionALinea(params: {
  lineaId: string;
  disposicionId: string;
  noSol?: string;
  monto: number;
}): Promise<ResultadoAplicarDisposicion> {
  const { lineaId, disposicionId, noSol, monto } = params;
  if (!lineaId) return { ok: false, aplicada: false, error: 'La disposición no tiene línea de crédito padre' };
  if (!disposicionId) return { ok: false, aplicada: false, error: 'Falta el id de la disposición' };
  if (!(monto > 0)) return { ok: false, aplicada: false, error: 'El monto de la disposición debe ser mayor a 0' };

  // Se relee la línea de BD en vez de confiar en lo que traiga la pantalla: el
  // saldo pudo cambiar por otra disposición aplicada desde otra sesión.
  let linea: any;
  try {
    const res = await window.fetch(`${API_BASE}/solicitudes-credito`, { headers: HDR });
    const json = await res.json();
    if (!res.ok) return { ok: false, aplicada: false, error: json.error || `HTTP ${res.status}` };
    linea = (json.data || []).find((r: any) => String(r.id) === String(lineaId));
  } catch (e: any) {
    return { ok: false, aplicada: false, error: e?.message || String(e) };
  }
  if (!linea) return { ok: false, aplicada: false, error: `No se encontró la línea ${lineaId}` };

  let dataObj = linea.data;
  if (typeof dataObj === 'string') { try { dataObj = JSON.parse(dataObj); } catch { dataObj = {}; } }
  const rawSol = dataObj?.solicitud || {};
  const nodo = (rawSol.banca2oPiso || {}) as Banca2oPisoData;
  const aplicadas: DisposicionAplicada[] = Array.isArray(nodo.disposicionesAplicadas)
    ? nodo.disposicionesAplicadas : [];

  // CA-20 — ya aplicada: no se vuelve a restar ni a re-encender el pánico.
  if (aplicadas.some(a => String(a.disposicionId) === String(disposicionId))) {
    return { ok: true, aplicada: false };
  }

  const t = rawSol.terminos_condiciones?._raw || {};
  const { saldoGarantia } = resolverSaldoGarantia(linea.saldo_actual, t.montoGarantizadoGpo, aplicadas);
  const saldoAnterior = Number(saldoGarantia ?? 0);

  // CA-21 — no se deja el saldo en negativo: se detiene y se explica.
  if (monto > saldoAnterior + 0.005) {
    return {
      ok: false,
      aplicada: false,
      error: `La disposición (${fmtMoneyExacto(monto)}) excede el saldo de la garantía `
        + `(${fmtMoneyExacto(saldoAnterior)}). No se aplicó.`,
    };
  }

  const saldoNuevo = Math.max(0, saldoAnterior - monto);
  const ahora = new Date().toISOString();

  const nuevoNodo: Banca2oPisoData = {
    ...nodo,
    subEstatus: 'Botón de Pánico',
    panicoDesde: nodo.panicoDesde || ahora,
    panicoPorDisposicion: nodo.panicoPorDisposicion || disposicionId,
    disposicionesAplicadas: [
      ...aplicadas,
      { disposicionId, noSol, monto, fecha: ahora, saldoResultante: saldoNuevo },
    ],
  };

  // Un solo PUT: saldo y nodo viajan juntos, para que no quede el pánico
  // encendido con el saldo intacto (o al revés) si algo falla a medio camino.
  try {
    const res = await window.fetch(`${API_BASE}/solicitudes-credito/${lineaId}`, {
      method: 'PUT',
      headers: { ...HDR, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        saldo_actual: saldoNuevo,
        data: { solicitud: { banca2oPiso: nuevoNodo } },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, aplicada: false, error: json.error || `HTTP ${res.status}` };
    return { ok: true, aplicada: true, saldoAnterior, saldoNuevo };
  } catch (e: any) {
    return { ok: false, aplicada: false, error: e?.message || String(e) };
  }
}

/**
 * REQ-18 CA-24 (desbloqueado por REQ-24 §Decisión 3a) — importe del escenario
 * **Botón de Pánico**: suma de los Créditos Simples activos de la línea.
 *
 * ⚠️ Hoy el "Saldo" de una disposición **es** su monto dispuesto, porque todavía
 * no existe amortización sobre las disposiciones: nada las ha reducido. Cuando
 * se implementen sus pagos, esta función debe leer el saldo insoluto real en vez
 * del monto original.
 */
/**
 * CA-11/CA-17 — punto de entrada desde el módulo Sol. Activación.
 *
 * Recibe sólo el id de la disposición y resuelve el resto contra la BD: cuál es
 * su línea padre (`disposicionDe`) y cuál su **Monto Autorizado**, que es lo que
 * se descuenta (§Decisión 4) — no el monto de esta activación en particular, que
 * puede ser una parte cuando la dispersión se reparte entre varias cuentas.
 *
 * Si la solicitud no es una disposición (no tiene línea padre) devuelve
 * `aplicada: false` sin error: activar una solicitud normal no debe fallar por
 * esto (CA-14).
 */
export async function aplicarActivacionDisposicion(
  disposicionId: string,
): Promise<ResultadoAplicarDisposicion & { esDisposicion: boolean }> {
  if (!disposicionId) return { ok: false, aplicada: false, esDisposicion: false, error: 'Falta el id' };

  let fila: any;
  try {
    const res = await window.fetch(`${API_BASE}/solicitudes-credito`, { headers: HDR });
    const json = await res.json();
    if (!res.ok) return { ok: false, aplicada: false, esDisposicion: false, error: json.error || `HTTP ${res.status}` };
    fila = (json.data || []).find((r: any) => String(r.id) === String(disposicionId));
  } catch (e: any) {
    return { ok: false, aplicada: false, esDisposicion: false, error: e?.message || String(e) };
  }
  if (!fila) return { ok: false, aplicada: false, esDisposicion: false, error: 'No se encontró la disposición' };

  const lineaId = lineaPadreDe(fila.data);
  if (!lineaId) return { ok: true, aplicada: false, esDisposicion: false };

  // Lo que consume la garantia es el CAPITAL dispuesto (Monto Autorizado del
  // credito simple), no el total del aviso: los intereses no ocupan cupo de la
  // garantia. Es la contrapartida del escenario de panico, donde el Credito de
  // Recuperacion si toma el total del aviso (capital + intereses), porque ahi
  // se trata de cubrir la obligacion completa y no de consumir cupo.
  const monto = parseMon(fila.monto_aut) || parseMon(fila.monto_sol);
  const r = await aplicarDisposicionALinea({
    lineaId,
    disposicionId: String(disposicionId),
    noSol: fila.no_sol || undefined,
    monto,
  });
  return { ...r, esDisposicion: true };
}

/**
 * REQ-18 CA-24 — importe del escenario **Boton de Panico**.
 *
 * Es el total de los **Avisos de Vencimiento** de los creditos simples
 * dispuestos sobre la linea, NO el monto dispuesto original: lo que hay que
 * cubrir con el Credito de Recuperacion es lo que el aviso exige cobrar
 * (capital + intereses), que es mayor al principal.
 *
 * Se leen de Cobranza y no de una copia local, por el mismo motivo que
 * `sumarAvisosPendientes`: el pago se aplica alla y ese cambio no regresa solo.
 * Solo cuentan los `Pendiente`: un aviso pagado ya no se debe.
 */
export async function sumarAvisosDisposiciones(
  nodo?: Banca2oPisoData,
): Promise<{ ok: boolean; monto: number; cuantos: number; sinAvisos: number; error?: string }> {
  const aplicadas = Array.isArray(nodo?.disposicionesAplicadas) ? nodo!.disposicionesAplicadas! : [];
  if (aplicadas.length === 0) return { ok: true, monto: 0, cuantos: 0, sinAvisos: 0 };

  let monto = 0;
  let cuantos = 0;
  let sinAvisos = 0;

  for (const d of aplicadas) {
    try {
      const res = await window.fetch(`${API_BASE}/cartera/avisos/${d.disposicionId}`, { headers: HDR });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, monto: 0, cuantos: 0, sinAvisos: 0, error: json.error || `HTTP ${res.status}` };
      const pendientes = (json.data || []).filter((f: any) => norm(f.estatus) === 'pendiente');
      if (pendientes.length === 0) { sinAvisos++; continue; }
      for (const f of pendientes) {
        monto += parseMon(f.monto_transaccion ?? f.monto);
        cuantos++;
      }
    } catch (e: any) {
      return { ok: false, monto: 0, cuantos: 0, sinAvisos: 0, error: e?.message || String(e) };
    }
  }
  return { ok: true, monto, cuantos, sinAvisos };
}

export function sumarDisposicionesActivas(nodo?: Banca2oPisoData): { monto: number; cuantas: number } {
  const aplicadas = Array.isArray(nodo?.disposicionesAplicadas) ? nodo!.disposicionesAplicadas! : [];
  return {
    monto: aplicadas.reduce((s, a) => s + (Number(a.monto) || 0), 0),
    cuantas: aplicadas.length,
  };
}

export function useLineasCreditoActivas() {
  const [rows, setRows] = useState<LineaCreditoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await window.fetch(`${API_BASE}/solicitudes-credito`, { headers: HDR });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      const mapped: LineaCreditoRow[] = (json.data || [])
        .filter((r: any) => {
          let dataObj = r.data;
          if (typeof dataObj === 'string') {
            try { dataObj = JSON.parse(dataObj); } catch { dataObj = {}; }
          }
          const h = dataObj?.solicitud?.header || {};
          return esLineaCredito2oPisoRow(
            r.linea_produc || h.linea_producto || '',
            r.estatus_sol || h.estatus || '',
          );
        })
        .map((r: any) => {
          let dataObj = r.data;
          if (typeof dataObj === 'string') {
            try { dataObj = JSON.parse(dataObj); } catch { dataObj = {}; }
          }
          const rawSolicitud = dataObj?.solicitud || {};
          const h = rawSolicitud.header || {};
          const t = rawSolicitud.terminos_condiciones?._raw || {};

          // Buscar cargos en sesión activa (sessionStorage / savedStore) por UUID o No. Solicitud
          const sessionCargos = (typeof window !== 'undefined')
            ? (loadFromSession<any[]>(r.id, 'cargos') ||
               loadFromSavedStore<any[]>(r.id, 'cargos') ||
               (r.no_sol ? (loadFromSession<any[]>(r.no_sol, 'cargos') || loadFromSavedStore<any[]>(r.no_sol, 'cargos')) : null) ||
               (h.no_sol ? (loadFromSession<any[]>(h.no_sol, 'cargos') || loadFromSavedStore<any[]>(h.no_sol, 'cargos')) : null))
            : null;

          const cargosRaw = (Array.isArray(sessionCargos) && sessionCargos.length > 0)
            ? sessionCargos
            : Array.isArray(rawSolicitud.cargos) && rawSolicitud.cargos.length > 0
              ? rawSolicitud.cargos
              : Array.isArray(rawSolicitud.cargo) && rawSolicitud.cargo.length > 0
                ? rawSolicitud.cargo
                : Array.isArray(rawSolicitud.cargoRegistros) && rawSolicitud.cargoRegistros.length > 0
                  ? rawSolicitud.cargoRegistros
                  : Array.isArray(dataObj?.cargos) && dataObj.cargos.length > 0
                    ? dataObj.cargos
                    : Array.isArray(r.cargos) && r.cargos.length > 0
                      ? r.cargos
                      : Array.isArray(rawSolicitud.comisiones) && rawSolicitud.comisiones.length > 0
                        ? rawSolicitud.comisiones
                        : [];

          return {
            id: r.id,
            noSol: r.no_sol || h.no_sol || '',
            cliente: [r.cliente_nombre, r.cliente_ap_paterno, r.cliente_ap_materno].filter(Boolean).join(' ') || h.nombre_persona || '—',
            clienteId: r.cliente_id || '',
            productoNombre: r.producto_nombre || h.nombre_producto || '—',
            lineaProducto: r.linea_produc || h.linea_producto || 'Línea de Crédito',
            tipoProducto: r.tipo_produc || h.tipo_producto || '',
            montoAut: parseMon(r.monto_aut),
            montoSol: parseMon(r.monto_sol),
            tasa: t.tasa || h.tasa_autorizada || '',
            plazo: t.plazo || h.plazo_autorizado || '',
            frecuencia: t.frecuencia || '',
            estatus: r.estatus_sol || h.estatus || '',
            noCuenta: r.no_cuenta || '',
            moneda: t.moneda || 'MXN',
            usuario: h.responsable || '',
            gobierno: r.institucion_gobierno || undefined,
            fechaSol: r.fecha_sol || r.fecha_autori || '',
            terminosRaw: t,
            cargos: cargosRaw.map((c: any) => ({
              tipoCargo: String(c?.tipo_cargo ?? c?.tipoCargo ?? c?.tipo_comision ?? c?.tipoComision ?? ''),
              descripcion: String(c?.descripcion ?? c?.tipo_comision ?? c?.tipoComision ?? ''),
              monto: parseMon(c?.monto ?? c?.montoCalculado ?? 0),
              fechaCargo: String(c?.fecha_cargo ?? c?.fechaCargo ?? c?.fecha ?? ''),
              estatus: String(c?.estatus ?? 'Pendiente'),
              notas: String(c?.notas ?? ''),
            })),
            productoId: h.producto_id || r.producto_id || '',
            faseId: Number(h.fase_id) || 0,
            descripcionFase: h.descripcion_fase || '',
            tipoPersona: h.tipo_persona || '',
            curp: h.curp || '',
            rfc: h.rfc || '',
            sucursal: h.sucursal || '',
            idGarantiaCartera: h.id_garantia_cartera || '',
            polizaContableApertura: h.poliza_contable_apertura || '',
            // REQ-20 CA-02 — la columna ya viajaba en la respuesta (`SELECT s.*`);
            // sólo faltaba mapearla. Ver la nota del tipo sobre el respaldo.
            ...resolverSaldoGarantia(
              r.saldo_actual,
              t.montoGarantizadoGpo,
              (rawSolicitud.banca2oPiso || dataObj?.banca2oPiso)?.disposicionesAplicadas,
            ),
            banca2oPiso: normalizarBanca2oPiso(
              rawSolicitud.banca2oPiso || dataObj?.banca2oPiso,
              rawSolicitud,
              dataObj,
              r.id,
              r.no_sol || h.no_sol,
            ),
          };
        });
      setRows(mapped);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  return { rows, loading, error, refetch: cargar };
}
