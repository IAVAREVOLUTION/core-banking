/**
 * sublineasStore.ts — SubLíneas de Carta de Crédito NAFIN: datos de la carta,
 * lectura de la Línea Global padre y el servicio común `activarSublinea()`.
 *
 * MD SubLíneas 05/06/07/08. `lib/sublineasCartaCredito.ts` DECIDE (reglas,
 * Monto Garantizado, saldos) sin tocar la BD; este módulo EJECUTA: relee la
 * línea, vuelve a validar y aplica el efecto sobre la Línea Global y la
 * SubLínea. Automática y Selectiva llaman a la misma función (MD 08: "un único
 * servicio común"), así que no pueden aplicar criterios distintos.
 *
 * ── Transaccionalidad (MD 08 §Transacción / CA-14) ─────────────────────────
 * El backend no expone transacciones entre filas. Se aplican tres escrituras
 * en orden (línea → SubLínea → póliza) y, si una falla, se COMPENSAN las
 * anteriores restaurando lo que había: es el ROLLBACK que pide el MD, hecho del
 * lado del cliente. La escritura de la línea va primero porque es la que
 * protege el saldo: si dos activaciones compiten, la segunda relee el
 * disponible ya descontado.
 */
import { projectId, publicAnonKey } from '/utils/supabase/info';
import {
  validarSubLinea, calcularMontoGarantizado, ESTADO_ACTIVA, ESTADO_RECHAZADA, ESTADO_NO_ELEGIBLE,
  MODALIDAD_AUTOMATICA, modalidadDe, num,
  type ResultadoValidacion, type ParteRelacionadaMin,
} from '../../lib/sublineasCartaCredito';
import { lineaPadreDe } from './banca2oPisoStore';
import { GL_JOURNAL_URL, GL_HEADERS } from '../../hooks/usePolizasContablesDB';
import { leerGuiaContabilizadora } from '../../hooks/formalizacionCarteraGPO';
import { cargosDeMomento, montoCargo, resolverMontoCargo, MOMENTO_ACTIVACION_SUBLINEA } from '../../lib/cargosProductoGPO';
import { usuarioActual } from '../../lib/auditoria';

const API = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { Authorization: `Bearer ${publicAnonKey}` };

/** MD 11 — evento contable de la activación. Las cuentas salen del Motor Contable. */
export const EVENTO_ACTIVACION_SUBLINEA = 'ACTIVACION_SUBLINEA';

/** MD 08 §Estados (Selectiva). Automática pasa directo de BORRADOR a ACTIVA/RECHAZADA. */
export const ESTADO_BORRADOR = 'BORRADOR';
export const ESTADO_EN_ORIGINACION = 'EN_ORIGINACION';
export const ESTADO_AUTORIZADA = 'AUTORIZADA';

// ═══════════════════════════════════════════════════════════════════
// Datos de la carta (Términos y Condiciones — Bloques B y C del MD 05)
// ═══════════════════════════════════════════════════════════════════

/** Clave del subtab en sesión y nodo en `data.solicitud` (mismo nombre en ambos). */
export const SUBTAB_SUBLINEA = 'sublineaCarta';
export const NODO_SUBLINEA = 'sublinea_carta';

export interface ReglaIncumplida { etiqueta: string; detalle: string }

export interface SublineaCartaData {
  // Bloque B — Carta de Crédito
  tipoCarta: string;
  noCarta: string;
  moneda: string;
  fechaInicio: string;        // yyyy-mm-dd
  fechaVencimiento: string;   // yyyy-mm-dd
  objeto: string;
  // Bloque C — Garantía NAFIN
  montoElegible: string;
  porcentajeCobertura: string;
  porcentajeComision: string;
  // Resultado
  estatus: string;
  montoGarantizado?: number;
  montoContingente?: number;
  fechaActivacion?: string;
  polizaActivacion?: string;
  validacion?: { fecha: string; elegible: boolean; incumplidas: ReglaIncumplida[] };
  /** MD 09/10 — vida de la SubLínea después de activarse. */
  operacion?: OperacionSublinea;
}

export const EMPTY_SUBLINEA: SublineaCartaData = {
  tipoCarta: '', noCarta: '', moneda: 'MXN', fechaInicio: '', fechaVencimiento: '', objeto: '',
  montoElegible: '', porcentajeCobertura: '', porcentajeComision: '', estatus: ESTADO_BORRADOR,
};

export function normalizarSublinea(raw: any): SublineaCartaData {
  return { ...EMPTY_SUBLINEA, ...(raw && typeof raw === 'object' ? raw : {}) };
}

/** Plazo de la carta en días (lo que valida la regla de plazo del producto). */
export function plazoDiasCarta(c: Pick<SublineaCartaData, 'fechaInicio' | 'fechaVencimiento'>): number {
  const a = Date.parse(c.fechaInicio), b = Date.parse(c.fechaVencimiento);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Campos de captura que faltan (Fase 1 de la Selectiva / antes de activar). */
export function faltantesCarta(c: SublineaCartaData, montoCarta: number): string[] {
  const f: string[] = [];
  if (!c.tipoCarta) f.push('Tipo de Carta');
  if (!(montoCarta > 0)) f.push('Monto Carta');
  if (!c.moneda) f.push('Moneda');
  if (!c.fechaInicio) f.push('Fecha Inicio');
  if (!c.fechaVencimiento) f.push('Fecha Vencimiento');
  if (!(num(c.montoElegible) > 0)) f.push('Monto Elegible');
  if (!(num(c.porcentajeCobertura) > 0)) f.push('% Cobertura');
  return f;
}

// ═══════════════════════════════════════════════════════════════════
// Línea Global padre
// ═══════════════════════════════════════════════════════════════════

const dataDe = (r: any) => {
  let d = r?.data;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  return d || {};
};

async function fetchFilasSolicitudes(): Promise<any[]> {
  const res = await window.fetch(`${API}/solicitudes-credito`, { headers: HDR });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data || [];
}

export interface LineaPadre {
  lineaId: string;
  noLinea: string;
  productoLineaId: string;
  /** Nodo operativo escrito al liberar (MD NAFIN 09). */
  lineaGlobal: Record<string, any> | null;
  /** Nodo completo de Banca 2º Piso — se reescribe entero (los arreglos no se mezclan). */
  banca2oPiso: Record<string, any>;
  saldoActual: number;
}

/**
 * Última Línea Global leída por SubLínea. Sólo para PINTAR al instante al
 * reabrir Términos (la consulta trae todas las Solicitudes y tarda); las
 * operaciones que mueven saldos (activar, liberar…) siempre releen la BD.
 */
const cacheLineas = new Map<string, LineaPadre>();
export function lineaEnCache(sublineaId: string): LineaPadre | null {
  return cacheLineas.get(String(sublineaId)) || null;
}

/** Línea Global de la que cuelga la SubLínea, leída fresca de la BD. */
export async function fetchLineaDeSublinea(sublineaId: string): Promise<{ ok: boolean; linea?: LineaPadre; sublinea?: SublineaCartaData; error?: string }> {
  try {
    const filas = await fetchFilasSolicitudes();
    const sub = filas.find(r => String(r.id) === String(sublineaId));
    if (!sub) return { ok: false, error: 'No se encontró la SubLínea en la BD (guárdela primero).' };
    const lineaId = lineaPadreDe(sub.data);
    if (!lineaId) return { ok: false, error: 'La Solicitud no está ligada a una Línea Global (no se creó desde Disposiciones).' };
    const fila = filas.find(r => String(r.id) === String(lineaId));
    if (!fila) return { ok: false, error: `No se encontró la Línea Global ${lineaId}.` };
    const d = dataDe(fila);
    const b2p = d?.solicitud?.banca2oPiso || {};
    const resultado = {
      ok: true,
      linea: {
        lineaId: String(lineaId),
        noLinea: fila.no_sol || d?.solicitud?.header?.no_sol || '',
        productoLineaId: d?.solicitud?.header?.producto_id || fila.producto_id || '',
        lineaGlobal: b2p.lineaGlobal && typeof b2p.lineaGlobal === 'object' ? b2p.lineaGlobal : null,
        banca2oPiso: b2p,
        saldoActual: num(fila.saldo_actual),
      },
      sublinea: normalizarSublinea(dataDe(sub)?.solicitud?.[NODO_SUBLINEA]),
    };
    cacheLineas.set(String(sublineaId), resultado.linea!);
    return resultado;
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/** Producto del catálogo por UUID de BD o id local. */
export function productoPorId(productos: any[] | undefined, id: unknown): any {
  const buscado = String(id ?? '').trim();
  if (!buscado) return undefined;
  return (productos || []).find(p => String(p?.dbUuid ?? '') === buscado || String(p?.id ?? '') === buscado);
}

/** Productos Disposición de la Línea Global, en la forma que compara `esProductoDisposicionPermitido`. */
export function productosDisposicionComparables(productoLinea: any): { id?: unknown; dbUuid?: unknown; clave?: unknown }[] {
  const paquetes = Array.isArray(productoLinea?.paquetes) ? productoLinea.paquetes : [];
  return paquetes
    .filter((p: any) => String(p?.paqueteProductoNombre ?? '').trim() !== '')
    .map((p: any) => ({ id: p?.paqueteProductoId ?? p?.id, dbUuid: p?.paqueteProductoId, clave: p?.paqueteProductoClave ?? p?.clave }));
}

// ═══════════════════════════════════════════════════════════════════
// Validación (MD 06 / MD 05 §Validaciones comunes)
// ═══════════════════════════════════════════════════════════════════

export interface ContextoActivacion {
  productoHijo: any;
  productoLinea: any;
  linea: LineaPadre;
  carta: SublineaCartaData;
  montoCarta: number;
  partes: ParteRelacionadaMin[];
}

/**
 * Las 11 reglas del motor + la de vencimiento del MD 05 ("Fecha Vencimiento
 * SubLínea <= Fecha Vencimiento Línea Global"), que el motor recibe pero no
 * evalúa. Se agrega aquí y no en el motor para no cambiar su contrato.
 */
export function validarActivacion(ctx: ContextoActivacion): ResultadoValidacion {
  const lg = ctx.linea.lineaGlobal || {};
  const r = validarSubLinea({
    producto: ctx.productoHijo,
    productosDisposicionLineaGlobal: productosDisposicionComparables(ctx.productoLinea),
    lineaGlobal: { estatus: lg.estatus, montoAutorizado: lg.montoAutorizado, fechaVencimiento: lg.fechaVencimiento },
    sublineasActivas: Array.isArray(lg.sublineasActivas) ? lg.sublineasActivas : [],
    carta: {
      tipoCarta: ctx.carta.tipoCarta,
      montoCarta: ctx.montoCarta,
      montoElegible: ctx.carta.montoElegible,
      moneda: ctx.carta.moneda,
      porcentajeCobertura: ctx.carta.porcentajeCobertura,
      plazoDias: plazoDiasCarta(ctx.carta),
      fechaVencimiento: ctx.carta.fechaVencimiento,
    },
    partesRelacionadas: ctx.partes,
  });

  const vencLG = fechaISO(lg.fechaVencimiento);
  if (vencLG && ctx.carta.fechaVencimiento) {
    const cumple = ctx.carta.fechaVencimiento <= vencLG;
    const regla = {
      clave: 'plazo-permitido' as const,
      etiqueta: 'Vencimiento de la Carta dentro de la vigencia de la Línea Global',
      cumple,
      detalle: cumple ? '' : `La Carta vence el ${ctx.carta.fechaVencimiento} y la Línea Global el ${vencLG}.`,
    };
    r.reglas.push(regla);
    (cumple ? r.cumplidas : r.incumplidas).push(regla);
    if (!cumple) {
      r.elegible = false;
      r.estatusSugerido = modalidadDe(ctx.productoHijo) === MODALIDAD_AUTOMATICA ? ESTADO_NO_ELEGIBLE : ESTADO_RECHAZADA;
    }
  }
  return r;
}

/** dd/mm/aaaa o yyyy-mm-dd → yyyy-mm-dd ('' si no es fecha). */
function fechaISO(v: unknown): string {
  const s = String(v ?? '').trim();
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}

// ═══════════════════════════════════════════════════════════════════
// Escrituras
// ═══════════════════════════════════════════════════════════════════

async function put(id: string, body: Record<string, any>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await window.fetch(`${API}/solicitudes-credito/${id}`, {
      method: 'PUT',
      headers: { ...HDR, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, error: json.error || `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/** Escribe el nodo de la SubLínea en su Solicitud. */
export function guardarSublinea(sublineaId: string, datos: SublineaCartaData) {
  return put(sublineaId, { data: { solicitud: { [NODO_SUBLINEA]: datos } } });
}

/**
 * Sólo el estatus (MD 08 §Estados Selectiva: EN_ORIGINACION / AUTORIZADA). El
 * servidor mezcla el JSONB, así que no toca captura, montos ni operación.
 */
export function guardarEstatusSublinea(sublineaId: string, estatus: string) {
  return put(sublineaId, { data: { solicitud: { [NODO_SUBLINEA]: { estatus } } } });
}

const incumplidasDe = (r: ResultadoValidacion): ReglaIncumplida[] =>
  r.incumplidas.map(x => ({ etiqueta: x.etiqueta, detalle: x.detalle }));

/** MD 06 §Si no cumple — RECHAZADA / NO ELEGIBLE PARA AUTOMÁTICA. Nunca se convierte en Selectiva (CA-08). */
export async function rechazarSublinea(sublineaId: string, carta: SublineaCartaData, validacion: ResultadoValidacion) {
  const op = operacionDe(carta);
  const datos: SublineaCartaData = {
    ...carta,
    estatus: validacion.estatusSugerido,
    validacion: { fecha: new Date().toISOString(), elegible: false, incumplidas: incumplidasDe(validacion) },
    operacion: {
      ...op,
      bitacora: [...op.bitacora, {
        fecha: new Date().toISOString(), usuario: usuarioActual(), evento: 'VALIDACION_AUTOMATICA',
        estatusAnterior: carta.estatus || ESTADO_BORRADOR, estatusNuevo: validacion.estatusSugerido,
        detalle: 'No cumplió las reglas del producto; no se convierte a Selectiva (CA-08).',
        validaciones: validacion.incumplidas.map(x => `✗ ${x.etiqueta}${x.detalle ? ` — ${x.detalle}` : ''}`),
      }],
    },
  };
  const r = await guardarSublinea(sublineaId, datos);
  return { ...r, datos };
}

export interface CargoGenerado {
  id: number;
  tipoCargo: string;
  descripcion: string;
  monto: number;
  fechaCargo: string;
  estatus: string;
  notas: string;
}

export interface ResultadoActivacion {
  ok: boolean;
  /** false si no cumplió las reglas (no hubo escrituras). */
  elegible: boolean;
  validacion?: ResultadoValidacion;
  datos?: SublineaCartaData;
  disponibleAnterior?: number;
  disponibleNuevo?: number;
  cargos?: CargoGenerado[];
  error?: string;
  /** true si la SubLínea ya estaba activa: no se volvió a consumir el disponible. */
  yaActiva?: boolean;
}

/**
 * MD 08 — `ActivarSublinea()`. Pasos 1-10 del MD:
 *   1-5 revalidar (línea ACTIVA, producto permitido, Monto Garantizado,
 *       disponible actual, no sobregiro) con la línea RELEÍDA de la BD;
 *   6-8 contingente += garantizado, disponible -= garantizado, SubLínea ACTIVA;
 *   9   cargos del producto marcados para la activación;
 *   10  póliza ACTIVACION_SUBLINEA con la guía del Motor Contable.
 * Cualquier falla en 6-10 compensa lo ya escrito.
 */
export async function activarSublinea(params: {
  sublineaId: string;
  noSol: string;
  productoHijo: any;
  /** Catálogo de productos de Línea de Crédito: de aquí sale el producto de la Línea Global. */
  productos: any[];
  carta: SublineaCartaData;
  montoCarta: number;
  partes: ParteRelacionadaMin[];
}): Promise<ResultadoActivacion> {
  const { sublineaId, noSol, productoHijo, productos, carta, montoCarta, partes } = params;

  const lp = await fetchLineaDeSublinea(sublineaId);
  if (!lp.ok || !lp.linea) return { ok: false, elegible: false, error: lp.error };
  const linea = lp.linea;
  const productoLinea = productoPorId(productos, linea.productoLineaId);
  const lg = linea.lineaGlobal;
  if (!lg) return { ok: false, elegible: false, error: 'La Línea Global no ha sido liberada: no tiene saldos operativos.' };

  // Idempotencia — activar dos veces consumiría el disponible dos veces.
  const activas: any[] = Array.isArray(lg.sublineasActivas) ? lg.sublineasActivas : [];
  if (activas.some(a => String(a?.sublineaId) === String(sublineaId))) {
    return { ok: true, elegible: true, yaActiva: true };
  }

  // 1-5
  const validacion = validarActivacion({ productoHijo, productoLinea, linea, carta, montoCarta, partes });
  if (!validacion.elegible) return { ok: true, elegible: false, validacion };

  const mg = validacion.garantia.montoGarantizado;
  const disponibleAnterior = num(lg.montoDisponible);
  // MD 08 §Regla principal — el disponible del nodo es el registrado; si no
  // alcanza (otra activación lo consumió entre la validación y aquí), se para.
  if (mg > disponibleAnterior + 0.005) {
    return { ok: false, elegible: false, validacion, error: `El Monto Garantizado (${mg.toFixed(2)}) excede el Disponible actual (${disponibleAnterior.toFixed(2)}).` };
  }
  const disponibleNuevo = Math.round((disponibleAnterior - mg) * 100) / 100;
  const ahora = new Date().toISOString();

  // 6-7 — Línea Global
  const lgNuevo = {
    ...lg,
    montoContingente: Math.round((num(lg.montoContingente) + mg) * 100) / 100,
    montoDisponible: disponibleNuevo,
    sublineasActivas: [
      ...activas,
      { sublineaId, noSol, montoGarantizado: mg, porcentajeCobertura: num(carta.porcentajeCobertura), fechaActivacion: ahora },
    ],
  };
  const wLinea = await put(linea.lineaId, {
    saldo_actual: disponibleNuevo,
    data: { solicitud: { banca2oPiso: { ...linea.banca2oPiso, lineaGlobal: lgNuevo } } },
  });
  if (!wLinea.ok) return { ok: false, elegible: true, validacion, error: `No se actualizó la Línea Global: ${wLinea.error}` };

  const restaurarLinea = () => put(linea.lineaId, {
    saldo_actual: linea.saldoActual,
    data: { solicitud: { banca2oPiso: { ...linea.banca2oPiso, lineaGlobal: lg } } },
  });

  // 8 — SubLínea
  const datos: SublineaCartaData = {
    ...carta,
    estatus: ESTADO_ACTIVA,
    montoGarantizado: mg,
    montoContingente: mg, // MD 08 §Afectación
    fechaActivacion: ahora,
    validacion: { fecha: ahora, elegible: true, incumplidas: [] },
  };
  {
    const opA = operacionDe(carta);
    datos.operacion = {
      ...opA,
      saldoGarantizado: mg,
      bitacora: [...opA.bitacora, {
        fecha: ahora, usuario: usuarioActual(), evento: EVENTO_ACTIVACION_SUBLINEA,
        estatusAnterior: carta.estatus || ESTADO_BORRADOR, estatusNuevo: ESTADO_ACTIVA,
        detalle: `Garantizado ${mg.toFixed(2)}; Disponible ${disponibleAnterior.toFixed(2)} → ${disponibleNuevo.toFixed(2)}.`,
        validaciones: validacion.cumplidas.map(x => `✓ ${x.etiqueta}`),
        lineaGlobalId: linea.lineaId, producto: productoHijo?.nombre || '',
      }],
    };
  }
  const wSub = await guardarSublinea(sublineaId, datos);
  if (!wSub.ok) {
    await restaurarLinea();
    return { ok: false, elegible: true, validacion, error: `No se activó la SubLínea (se revirtió la Línea Global): ${wSub.error}` };
  }

  // 9 — cargos configurados para el evento (no hay fases en Automática)
  const pctComision = num(carta.porcentajeComision);
  const comision = Math.round(mg * (pctComision / 100) * 100) / 100;
  const hoy = ahora.slice(0, 10);
  const cargos: CargoGenerado[] = cargosDeMomento(productoHijo?.cargos, MOMENTO_ACTIVACION_SUBLINEA)
    .map((c: any, i: number) => ({
      id: Date.now() + i,
      tipoCargo: c.tipoCargo || '',
      descripcion: c.descripcion || '',
      // Campo a Mapear configurado en Taller (o Base/Valor de cargos anteriores);
      // sin él, la comisión pactada sobre lo garantizado y, si tampoco hay %,
      // el Monto Garantizado para que el analista lo ajuste.
      monto: resolverMontoCargo(c.campoMapeado, {
        solicitud: { montoSolicitado: montoCarta, montoAutorizado: montoCarta },
        terminos: { montoSolicitado: montoCarta, montoAutorizado: montoCarta },
        sublinea: { montoElegible: carta.montoElegible, montoGarantizado: mg, montoComision: comision },
      })
        ?? montoCargo(c, { solicitado: montoCarta, autorizado: montoCarta, garantizado: mg })
        ?? (comision > 0 ? comision : mg),
      fechaCargo: hoy,
      estatus: 'Pendiente',
      notas: 'Generado automáticamente al activar la SubLínea (momento ACTIVACION_SUBLINEA del producto).',
    }));

  // 10 — póliza de reconocimiento del contingente
  const poliza = await polizaEventoSublinea({
    evento: EVENTO_ACTIVACION_SUBLINEA, nombre: 'Activación de SubLínea — reconocimiento de contingente',
    productoHijo, sublineaId, noSol, importe: mg, cargos,
  });
  if (!poliza.ok) {
    await guardarSublinea(sublineaId, carta);
    await restaurarLinea();
    return { ok: false, elegible: true, validacion, error: `No se generó la póliza ${EVENTO_ACTIVACION_SUBLINEA} (se revirtió la activación): ${poliza.error}` };
  }
  datos.polizaActivacion = poliza.folio;
  {
    const b = datos.operacion?.bitacora;
    if (b && b.length) b[b.length - 1].poliza = poliza.folio;
  }
  await guardarSublinea(sublineaId, datos);

  return { ok: true, elegible: true, validacion, datos, disponibleAnterior, disponibleNuevo, cargos };
}

/**
 * MD 11 — póliza de un evento de SubLínea. Las cuentas salen SIEMPRE de la
 * guía del Motor Contable del producto hijo (MD 11 §Fuente de cuentas); cada
 * componente toma el importe de su Cargo si existe y, si no, el importe del
 * evento. Sin guía se registra el asiento global sin desglose, igual que la
 * formalización GPO (REQ-13), y se anota por qué.
 */
export async function polizaEventoSublinea(p: {
  evento: string;
  nombre: string;
  productoHijo: any;
  sublineaId: string;
  noSol: string;
  importe: number;
  cargos?: CargoGenerado[];
}): Promise<{ ok: boolean; folio?: string; error?: string }> {
  const n = (v: unknown) => String(v ?? '').trim().toLowerCase();
  const guia = leerGuiaContabilizadora(p.productoHijo?.motorContable, [p.evento, p.nombre]);
  const cargos = p.cargos || [];
  const importeDe = (comp: any) => {
    const c = cargos.find(x => n(x.tipoCargo) === n(comp?.nombre) || n(x.tipoCargo) === n(comp?.codigo));
    return c ? c.monto : p.importe;
  };
  const detalle: any[] = [];
  let total = 0;
  for (const fila of guia) {
    const comp = fila?.componente || {};
    const importe = importeDe(comp);
    if (!(importe > 0)) continue;
    const ident = { componente_id: String(comp.id || ''), componente_codigo: String(comp.codigo || ''), componente_nombre: String(comp.nombre || '') };
    detalle.push({ cuenta_contable_id: String(fila?.debito?.id || ''), cuenta_contable_gl: String(fila?.debito?.cuenta_gl || ''), cuenta_contable_nombre: String(fila?.debito?.nombre || ''), debito: importe.toFixed(2), credito: '', ...ident });
    detalle.push({ cuenta_contable_id: String(fila?.credito?.id || ''), cuenta_contable_gl: String(fila?.credito?.cuenta_gl || ''), cuenta_contable_nombre: String(fila?.credito?.nombre || ''), debito: '', credito: importe.toFixed(2), ...ident });
    total += importe;
  }
  if (detalle.length === 0) total = p.importe;
  if (!(total > 0)) return { ok: true, folio: '' }; // evento sin importe: nada que contabilizar

  const folio = `POL-CONT-${String(Math.floor(Math.random() * 90000) + 10000)}`;
  try {
    const res = await fetch(GL_JOURNAL_URL, {
      method: 'POST',
      headers: GL_HEADERS,
      body: JSON.stringify({
        journal_date: new Date().toISOString().split('T')[0],
        producto_id: p.productoHijo?.dbUuid || p.productoHijo?.id || '',
        event_code: p.evento,
        account_id: p.sublineaId,
        currency: 'MXN',
        total_debit: total,
        total_credit: total,
        status: 'Creada',
        data: {
          evento: p.nombre,
          solicitud_id: p.sublineaId,
          no_sol: p.noSol,
          folio_display: folio,
          nota: detalle.length === 0
            ? `El producto no tiene guía "${p.evento}" en su Motor Contable: asiento global sin desglose.`
            : undefined,
          Detalle: detalle,
        },
      }),
    });
    const json = await res.json().catch(() => ({}) as any);
    return res.ok ? { ok: true, folio } : { ok: false, error: json?.error || `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/** Monto Garantizado estimado para mostrar en pantalla (sin escrituras). */
export function montoGarantizadoEstimado(carta: SublineaCartaData, productoHijo: any, disponible: unknown) {
  return calcularMontoGarantizado({
    montoElegible: carta.montoElegible,
    porcentajeCobertura: carta.porcentajeCobertura,
    montoMaximoSublinea: productoHijo ? (productoHijo.montoMaximoSublinea ?? productoHijo.montoMaximo) : undefined,
    disponibleLineaGlobal: disponible,
  });
}

// ═══════════════════════════════════════════════════════════════════
// MD 09 / 10 — Vencimiento, Reclamación, Pago, Recuperación y Cierre
// ═══════════════════════════════════════════════════════════════════

export const ESTADO_LIBERADA = 'LIBERADA';
export const ESTADO_RECLAMADA = 'RECLAMADA';
export const ESTADO_EN_ANALISIS = 'EN_ANALISIS';
export const ESTADO_PROCEDENTE = 'PROCEDENTE';
export const ESTADO_PAGADA = 'PAGADA';
export const ESTADO_EN_RECUPERACION = 'EN_RECUPERACION';
export const ESTADO_CERRADA = 'CERRADA';
const ESTADO_RECLAMACION_RECHAZADA = 'RECHAZADA';

export const EVENTO_LIBERACION_SUBLINEA = 'LIBERACION_SUBLINEA';
export const EVENTO_RECLAMACION_GARANTIA = 'RECLAMACION_GARANTIA';
export const EVENTO_PAGO_GARANTIA = 'PAGO_GARANTIA';
export const EVENTO_RECUPERACION_GARANTIA = 'RECUPERACION_GARANTIA';
export const EVENTO_CASTIGO_GARANTIA = 'CASTIGO_GARANTIA';

export interface Reclamacion {
  id: string;
  noReclamacion: string;
  fecha: string;
  montoIncumplido: number;
  saldoElegible: number;
  porcentajeCobertura: number;
  montoMaximoReclamable: number;
  montoReclamado: number;
  /** RECLAMADA → EN_ANALISIS → RECHAZADA | PROCEDENTE → PAGADA */
  estatus: string;
  documentacion: string;
  montoProcedente?: number;
  montoPagado?: number;
  fechaPago?: string;
  cuentaBeneficiaria?: string;
  observaciones?: string;
}

export interface Recuperacion {
  id: string;
  fecha: string;
  montoRecuperado: number;
  origen: string;
  /** Regla de distribución parametrizable (MD 10: no asumir 50/50). */
  porcentajeNafin: number;
  montoNafin: number;
  montoIF: number;
}

/** MD 12 §7 — usuario, fecha/hora, evento, estatus anterior/nuevo, validaciones, observaciones. */
export interface EntradaBitacoraSublinea {
  fecha: string;
  usuario: string;
  evento: string;
  estatusAnterior: string;
  estatusNuevo: string;
  detalle: string;
  validaciones?: string[];
  lineaGlobalId?: string;
  producto?: string;
  poliza?: string;
}

export interface OperacionSublinea {
  reclamaciones: Reclamacion[];
  recuperaciones: Recuperacion[];
  montoCastigado: number;
  /** Garantía aún vigente: Monto Garantizado − liberado − pagado. */
  saldoGarantizado: number;
  fechaLiberacion?: string;
  fechaCierre?: string;
  /** MD 12 §7 — auditoría: evento, estatus anterior/nuevo, detalle, póliza. */
  bitacora: EntradaBitacoraSublinea[];
}

export function operacionDe(c: SublineaCartaData): OperacionSublinea {
  const o = c.operacion;
  return {
    reclamaciones: Array.isArray(o?.reclamaciones) ? o!.reclamaciones : [],
    recuperaciones: Array.isArray(o?.recuperaciones) ? o!.recuperaciones : [],
    montoCastigado: num(o?.montoCastigado),
    saldoGarantizado: o && o.saldoGarantizado !== undefined ? num(o.saldoGarantizado) : num(c.montoGarantizado),
    fechaLiberacion: o?.fechaLiberacion,
    fechaCierre: o?.fechaCierre,
    bitacora: Array.isArray(o?.bitacora) ? o!.bitacora : [],
  };
}

/** MD 09 §Fórmula — MIN(SaldoElegible × %Cobertura, SaldoGarantizado). */
export function montoMaximoReclamable(saldoElegible: unknown, porcentajeCobertura: unknown, saldoGarantizado: unknown): number {
  const v = Math.min(num(saldoElegible) * (num(porcentajeCobertura) / 100), num(saldoGarantizado));
  return Math.max(0, Math.round(v * 100) / 100);
}

/** MD 10 §Cierre — totales y saldo pendiente. */
export function resumenCierre(c: SublineaCartaData) {
  const op = operacionDe(c);
  const reclamado = op.reclamaciones.reduce((s, r) => s + (r.estatus !== ESTADO_RECLAMACION_RECHAZADA ? num(r.montoReclamado) : 0), 0);
  const pagado = op.reclamaciones.reduce((s, r) => s + num(r.montoPagado), 0);
  const recuperado = op.recuperaciones.reduce((s, r) => s + num(r.montoNafin), 0);
  const saldoPendiente = Math.max(0, Math.round((pagado - recuperado - op.montoCastigado) * 100) / 100);
  return {
    montoGarantizado: num(c.montoGarantizado), reclamado, pagado, recuperado,
    castigado: op.montoCastigado, saldoPendiente,
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const sinActiva = (lg: Record<string, any>, id: string) =>
  (Array.isArray(lg.sublineasActivas) ? lg.sublineasActivas : []).filter((a: any) => String(a?.sublineaId) !== String(id));

function conBitacora(c: SublineaCartaData, op: OperacionSublinea, evento: string, estatusNuevo: string, detalle: string): SublineaCartaData {
  return {
    ...c,
    estatus: estatusNuevo,
    operacion: {
      ...op,
      bitacora: [...op.bitacora, { fecha: new Date().toISOString(), usuario: usuarioActual(), evento, estatusAnterior: c.estatus, estatusNuevo, detalle }],
    },
  };
}

interface Operacion {
  /** Evento contable; vacío = la operación no genera póliza. */
  evento: string;
  nombreEvento: string;
  /** Importe de la póliza (se calcula en `mutarSublinea`). */
  importe: number;
  /** Devuelve la SubLínea nueva o un error de negocio. Puede fijar `importe`. */
  mutarSublinea: (c: SublineaCartaData, op: OperacionSublinea) => SublineaCartaData | { error: string };
  /** Devuelve la Línea Global nueva, o `null` si la operación no la toca. */
  mutarLinea: (lg: Record<string, any>) => Record<string, any> | null;
  /** Estatus de la Solicitud (columna) cuando la operación cierra la SubLínea. */
  estatusSolicitud?: string;
}

/**
 * Motor común de las operaciones posteriores a la activación: relee línea y
 * SubLínea de la BD, aplica el cambio de la línea, guarda la SubLínea y genera
 * la póliza; si un paso falla, compensa los anteriores (MD 12 §8 — integridad
 * de saldos con rollback).
 */
async function aplicarOperacion(sublineaId: string, productoHijo: any, o: Operacion): Promise<{ ok: boolean; datos?: SublineaCartaData; error?: string }> {
  const lp = await fetchLineaDeSublinea(sublineaId);
  if (!lp.ok || !lp.linea || !lp.sublinea) return { ok: false, error: lp.error };
  const { linea, sublinea } = lp;
  const lg = linea.lineaGlobal;
  if (!lg) return { ok: false, error: 'La Línea Global no tiene saldos operativos (no se ha liberado).' };

  const nueva = o.mutarSublinea(sublinea, operacionDe(sublinea));
  if ('error' in nueva) return { ok: false, error: nueva.error };
  {
    const opN = operacionDe(nueva);
    const ult = opN.bitacora[opN.bitacora.length - 1];
    if (ult) { ult.lineaGlobalId = linea.lineaId; ult.producto = productoHijo?.nombre || ''; }
    nueva.operacion = opN;
  }

  const lgNuevo = o.mutarLinea(lg);
  if (lgNuevo) {
    const w = await put(linea.lineaId, {
      saldo_actual: num(lgNuevo.montoDisponible),
      data: { solicitud: { banca2oPiso: { ...linea.banca2oPiso, lineaGlobal: lgNuevo } } },
    });
    if (!w.ok) return { ok: false, error: `No se actualizó la Línea Global: ${w.error}` };
  }
  const restaurarLinea = async () => {
    if (!lgNuevo) return;
    await put(linea.lineaId, {
      saldo_actual: linea.saldoActual,
      data: { solicitud: { banca2oPiso: { ...linea.banca2oPiso, lineaGlobal: lg } } },
    });
  };

  const ws = await guardarSublinea(sublineaId, nueva);
  if (!ws.ok) {
    await restaurarLinea();
    return { ok: false, error: `No se guardó la SubLínea (se revirtió la línea): ${ws.error}` };
  }

  if (o.evento) {
    const pol = await polizaEventoSublinea({
      evento: o.evento, nombre: o.nombreEvento, productoHijo, sublineaId, noSol: '', importe: o.importe,
    });
    if (!pol.ok) {
      await guardarSublinea(sublineaId, sublinea);
      await restaurarLinea();
      return { ok: false, error: `No se generó la póliza ${o.evento} (se revirtió la operación): ${pol.error}` };
    }
    if (pol.folio) {
      const op = operacionDe(nueva);
      const ult = op.bitacora[op.bitacora.length - 1];
      if (ult) ult.poliza = pol.folio;
      nueva.operacion = op;
      await guardarSublinea(sublineaId, nueva);
    }
  }
  // La Solicitud deja de verse "Activa" cuando la SubLínea ya no lo está.
  if (o.estatusSolicitud) await put(sublineaId, { estatus_sol: o.estatusSolicitud });
  return { ok: true, datos: nueva };
}

/** MD 09 §Vencimiento sin Reclamo — ACTIVA → LIBERADA; restituye disponible sin exceder el autorizado. */
/**
 * `motivoAnticipado`: liberación ANTES del vencimiento (Carta no utilizada /
 * cancelada). Mismo efecto sobre saldos; queda señalada en la bitácora.
 */
export function liberarSublinea(sublineaId: string, productoHijo: any, motivoAnticipado?: string) {
  const o: Operacion = {
    evento: EVENTO_LIBERACION_SUBLINEA,
    nombreEvento: 'Liberación de SubLínea — cancelación de contingente',
    importe: 0,
    estatusSolicitud: 'Liberada',
    mutarSublinea: (c, op) => {
      if (c.estatus !== ESTADO_ACTIVA) return { error: `Sólo se libera una SubLínea ACTIVA (está ${c.estatus}).` };
      if (op.reclamaciones.some(r => r.estatus !== ESTADO_RECLAMACION_RECHAZADA)) {
        return { error: 'La SubLínea tiene una reclamación en curso: no se puede liberar.' };
      }
      o.importe = op.saldoGarantizado;
      return conBitacora(c, { ...op, saldoGarantizado: 0, fechaLiberacion: new Date().toISOString() },
        EVENTO_LIBERACION_SUBLINEA, ESTADO_LIBERADA,
        `${motivoAnticipado ? `Liberación ANTICIPADA (${motivoAnticipado}). ` : ''}Se restituyen ${o.importe.toFixed(2)} al Disponible.`);
    },
    mutarLinea: lg => ({
      ...lg,
      montoContingente: r2(Math.max(0, num(lg.montoContingente) - o.importe)),
      montoDisponible: r2(Math.min(num(lg.montoAutorizado), num(lg.montoDisponible) + o.importe)),
      sublineasActivas: sinActiva(lg, sublineaId),
    }),
  };
  return aplicarOperacion(sublineaId, productoHijo, o);
}

/** MD 09 §Reclamación — sólo sobre una SubLínea ACTIVA y dentro de la vigencia de la Carta. */
export function registrarReclamacion(sublineaId: string, productoHijo: any, datos: {
  fecha: string; montoIncumplido: number; saldoElegible: number; montoReclamado: number; documentacion: string;
}) {
  const o: Operacion = {
    evento: EVENTO_RECLAMACION_GARANTIA,
    nombreEvento: 'Reclamación de Garantía',
    importe: 0,
    mutarSublinea: (c, op) => {
      if (c.estatus !== ESTADO_ACTIVA) return { error: `Sólo se reclama sobre una SubLínea ACTIVA (está ${c.estatus}).` };
      if (c.fechaVencimiento && datos.fecha > c.fechaVencimiento) return { error: 'La fecha de la reclamación es posterior al vencimiento de la Carta.' };
      const pct = num(c.porcentajeCobertura);
      const maximo = montoMaximoReclamable(datos.saldoElegible, pct, op.saldoGarantizado);
      if (!(datos.montoReclamado > 0)) return { error: 'Capture el Monto Reclamado.' };
      if (datos.montoReclamado > maximo + 0.005) return { error: `El Monto Reclamado excede el Máximo Reclamable (${maximo.toFixed(2)}).` };
      o.importe = datos.montoReclamado;
      const rec: Reclamacion = {
        id: `${Date.now()}`,
        noReclamacion: `REC-${String(op.reclamaciones.length + 1).padStart(3, '0')}`,
        fecha: datos.fecha,
        montoIncumplido: datos.montoIncumplido,
        saldoElegible: datos.saldoElegible,
        porcentajeCobertura: pct,
        montoMaximoReclamable: maximo,
        montoReclamado: datos.montoReclamado,
        estatus: ESTADO_RECLAMADA,
        documentacion: datos.documentacion,
      };
      return conBitacora(c, { ...op, reclamaciones: [...op.reclamaciones, rec] },
        EVENTO_RECLAMACION_GARANTIA, ESTADO_RECLAMADA, `${rec.noReclamacion} por ${o.importe.toFixed(2)}.`);
    },
    mutarLinea: lg => ({ ...lg, montoReclamado: r2(num(lg.montoReclamado) + o.importe) }),
  };
  return aplicarOperacion(sublineaId, productoHijo, o);
}

/** RECLAMADA → EN_ANALISIS → PROCEDENTE | RECHAZADA. No hay flujo de dinero: sin póliza. */
export function resolverReclamacion(sublineaId: string, productoHijo: any, reclamacionId: string,
  accion: 'analizar' | 'procedente' | 'rechazar', p?: { montoProcedente?: number; observaciones?: string }) {
  let liberarReclamado = 0;
  const o: Operacion = {
    evento: '',
    nombreEvento: '',
    importe: 0,
    mutarSublinea: (c, op) => {
      const r = op.reclamaciones.find(x => x.id === reclamacionId);
      if (!r) return { error: 'No se encontró la reclamación.' };
      let nuevoR: Reclamacion;
      let estatusSub: string;
      if (accion === 'analizar') {
        if (r.estatus !== ESTADO_RECLAMADA) return { error: `La reclamación está ${r.estatus}.` };
        nuevoR = { ...r, estatus: ESTADO_EN_ANALISIS };
        estatusSub = ESTADO_EN_ANALISIS;
      } else if (accion === 'procedente') {
        if (r.estatus !== ESTADO_EN_ANALISIS) return { error: 'Primero pase la reclamación a análisis.' };
        const proc = num(p?.montoProcedente);
        if (!(proc > 0) || proc > r.montoReclamado + 0.005) return { error: 'El Monto Procedente debe ser mayor a 0 y no mayor al Reclamado.' };
        nuevoR = { ...r, estatus: ESTADO_PROCEDENTE, montoProcedente: proc, observaciones: p?.observaciones };
        estatusSub = ESTADO_PROCEDENTE;
      } else {
        if (![ESTADO_RECLAMADA, ESTADO_EN_ANALISIS].includes(r.estatus)) return { error: `La reclamación está ${r.estatus}.` };
        nuevoR = { ...r, estatus: ESTADO_RECLAMACION_RECHAZADA, observaciones: p?.observaciones };
        // Rechazada: la garantía sigue vigente y la SubLínea vuelve a ACTIVA.
        estatusSub = ESTADO_ACTIVA;
        liberarReclamado = r.montoReclamado;
      }
      return conBitacora(c, { ...op, reclamaciones: op.reclamaciones.map(x => (x.id === r.id ? nuevoR : x)) },
        'RESOLUCION_RECLAMACION', estatusSub, `${r.noReclamacion}: ${nuevoR.estatus}.`);
    },
    mutarLinea: lg => (liberarReclamado > 0
      ? { ...lg, montoReclamado: r2(Math.max(0, num(lg.montoReclamado) - liberarReclamado)) }
      : null),
  };
  return aplicarOperacion(sublineaId, productoHijo, o);
}

/**
 * MD 10 §Pago de Garantía — sólo con reclamación PROCEDENTE. El dinero va de
 * NAFIN al Intermediario Financiero (nunca al beneficiario comercial) por una
 * de sus Cuentas Beneficiarias. Lo pagado deja de ser contingente.
 */
export function pagarGarantia(sublineaId: string, productoHijo: any, reclamacionId: string, datos: {
  montoPagado: number; fechaPago: string; cuentaBeneficiaria: string;
}) {
  const o: Operacion = {
    evento: EVENTO_PAGO_GARANTIA,
    nombreEvento: 'Pago de Garantía al Intermediario Financiero',
    importe: 0,
    mutarSublinea: (c, op) => {
      const r = op.reclamaciones.find(x => x.id === reclamacionId);
      if (!r || r.estatus !== ESTADO_PROCEDENTE) return { error: 'Sólo se paga una reclamación PROCEDENTE.' };
      if (!datos.cuentaBeneficiaria) return { error: 'Seleccione la Cuenta Beneficiaria del Intermediario.' };
      if (!(datos.montoPagado > 0) || datos.montoPagado > num(r.montoProcedente) + 0.005) {
        return { error: 'El Monto Pagado debe ser mayor a 0 y no mayor al Procedente.' };
      }
      o.importe = datos.montoPagado;
      const nuevoR: Reclamacion = {
        ...r, estatus: ESTADO_PAGADA, montoPagado: o.importe, fechaPago: datos.fechaPago, cuentaBeneficiaria: datos.cuentaBeneficiaria,
      };
      return conBitacora(c, {
        ...op,
        saldoGarantizado: r2(Math.max(0, op.saldoGarantizado - o.importe)),
        reclamaciones: op.reclamaciones.map(x => (x.id === r.id ? nuevoR : x)),
      }, EVENTO_PAGO_GARANTIA, ESTADO_PAGADA, `Pago de ${o.importe.toFixed(2)} a la cuenta ${datos.cuentaBeneficiaria}.`);
    },
    mutarLinea: lg => ({
      ...lg,
      montoPagado: r2(num(lg.montoPagado) + o.importe),
      montoContingente: r2(Math.max(0, num(lg.montoContingente) - o.importe)),
    }),
  };
  return aplicarOperacion(sublineaId, productoHijo, o);
}

/** MD 10 §Recuperación — PAGADA → EN_RECUPERACION. El % que corresponde a NAFIN es un parámetro. */
export function registrarRecuperacion(sublineaId: string, productoHijo: any, datos: {
  fecha: string; montoRecuperado: number; origen: string; porcentajeNafin: number;
}) {
  const o: Operacion = {
    evento: EVENTO_RECUPERACION_GARANTIA,
    nombreEvento: 'Recuperación de Garantía',
    importe: 0,
    mutarSublinea: (c, op) => {
      if (![ESTADO_PAGADA, ESTADO_EN_RECUPERACION].includes(c.estatus)) return { error: 'Sólo hay recuperación después de pagar la garantía.' };
      if (!(datos.montoRecuperado > 0)) return { error: 'Capture el Monto Recuperado.' };
      const pct = num(datos.porcentajeNafin);
      if (!(pct >= 0 && pct <= 100)) return { error: 'El % NAFIN debe estar entre 0 y 100.' };
      const montoNafin = r2(datos.montoRecuperado * pct / 100);
      const pendiente = resumenCierre(c).saldoPendiente;
      if (montoNafin > pendiente + 0.005) {
        return { error: `La parte NAFIN (${montoNafin.toFixed(2)}) excede el saldo pendiente (${pendiente.toFixed(2)}).` };
      }
      o.importe = montoNafin;
      const rec: Recuperacion = {
        id: `${Date.now()}`, fecha: datos.fecha, montoRecuperado: datos.montoRecuperado, origen: datos.origen,
        porcentajeNafin: pct, montoNafin, montoIF: r2(datos.montoRecuperado - montoNafin),
      };
      return conBitacora(c, { ...op, recuperaciones: [...op.recuperaciones, rec] },
        EVENTO_RECUPERACION_GARANTIA, ESTADO_EN_RECUPERACION,
        `Recuperado ${datos.montoRecuperado.toFixed(2)} (NAFIN ${montoNafin.toFixed(2)} · IF ${rec.montoIF.toFixed(2)}).`);
    },
    mutarLinea: () => null,
  };
  return aplicarOperacion(sublineaId, productoHijo, o);
}

/**
 * MD 10 §Cierre / §Pérdida — cierra cuando no queda saldo pendiente; con
 * `castigar`, registra el pendiente como castigo. NO crea una CxC contra el
 * Intermediario por una garantía legítimamente pagada y no recuperada.
 */
export function cerrarSublinea(sublineaId: string, productoHijo: any, castigar: boolean) {
  let contingenteRestante = 0;
  const o: Operacion = {
    evento: EVENTO_CASTIGO_GARANTIA,
    nombreEvento: 'Castigo de Garantía',
    importe: 0,
    estatusSolicitud: 'Cerrada',
    mutarSublinea: (c, op) => {
      if (![ESTADO_PAGADA, ESTADO_EN_RECUPERACION].includes(c.estatus)) return { error: 'Sólo se cierra una garantía pagada.' };
      const pendiente = resumenCierre(c).saldoPendiente;
      if (pendiente > 0.005 && !castigar) {
        return { error: `Queda saldo pendiente de ${pendiente.toFixed(2)}: castíguelo o registre recuperaciones.` };
      }
      o.importe = castigar ? pendiente : 0; // sin castigo, la póliza no se emite (importe 0)
      contingenteRestante = op.saldoGarantizado;
      return conBitacora(c, {
        ...op, montoCastigado: r2(op.montoCastigado + o.importe), saldoGarantizado: 0, fechaCierre: new Date().toISOString(),
      }, o.importe > 0 ? EVENTO_CASTIGO_GARANTIA : 'CIERRE_SUBLINEA', ESTADO_CERRADA,
        o.importe > 0 ? `Castigo de ${o.importe.toFixed(2)}.` : 'Sin saldo pendiente.');
    },
    // Lo que no se reclamó deja de ser contingente. No se restituye
    // disponible: la Carta ya se ejerció.
    mutarLinea: lg => ({
      ...lg,
      montoContingente: r2(Math.max(0, num(lg.montoContingente) - contingenteRestante)),
      sublineasActivas: sinActiva(lg, sublineaId),
    }),
  };
  return aplicarOperacion(sublineaId, productoHijo, o);
}
