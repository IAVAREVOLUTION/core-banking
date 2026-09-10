/**
 * cargosProductoGPO.ts — REQ-21.
 *
 * El subtab **Cargos** del producto es un catálogo de conceptos que sirve a tres
 * momentos distintos del ciclo de una Garantía de Pago Oportuno:
 *
 *   - Fase 4 (Validación de Cláusulas Fiduciarias) → *Provisionamiento de Garantía*
 *   - Aviso de vencimiento de cada periodo        → *Comisión GPO* + *IVA Comisión GPO*
 *
 * Hasta REQ-21 nada distinguía unos de otros: REQ-15 copiaba **todos** los cargos
 * del producto en Fase 4 con el Monto Garantizado, así que un catálogo con los
 * tres conceptos producía dos cargos de comisión por cientos de millones (ver
 * §Defecto activo de la HU). Este módulo es el que separa los momentos.
 *
 * Los nombres NO son cosméticos (RN-01): son la llave con la que REQ-16 cruza
 * cargo × componente contable para armar el detalle de la póliza. Por eso el
 * respaldo de la §Decisión 1(b) deduce el momento del propio Motor Contable: si
 * el componente del cargo está en la guía de formalización, el cargo es de Fase 4;
 * si está en las guías de comisión, es del aviso.
 */
import { leerGuiaContabilizadora, ALIAS_GUIA_FORMALIZACION_GPO } from '../hooks/formalizacionCarteraGPO';

/** Momento del ciclo en el que aplica un cargo del producto (§Decisión 1a). */
export const MOMENTO_FASE4 = 'FASE_4_PROVISION';
export const MOMENTO_AVISO = 'AVISO_COMISION';

export const MOMENTOS_CARGO = [
  { value: '', label: 'Sin especificar' },
  { value: MOMENTO_FASE4, label: 'Fase 4 — Provisión de garantía' },
  { value: MOMENTO_AVISO, label: 'Aviso de vencimiento — Comisión' },
];

/**
 * Eventos del Motor Contable que contabilizan la comisión del periodo. Están
 * capturados en el producto GPO y hoy se disparan a mano desde la subpestaña
 * Generación Contable (§Decisión 5: automatizarlos es otra HU). Aquí se usan
 * sólo para deducir qué cargos pertenecen al aviso.
 */
export const EVENTOS_COMISION_GPO = ['DEVENGO_COMISION_GPO', 'COBRO_COMISION_GPO'];

const norm = (v: unknown) =>
  String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Cargo tal como lo captura `CargoTab` en `producto.cargo`. */
export interface CargoProducto {
  tipoCargo?: string;
  descripcion?: string;
  lineaProducto?: string;
  sublinea?: string;
  moneda?: string;
  /** REQ-21 §Decisión 1(a) — momento del ciclo. Vacío en catálogos anteriores. */
  momento?: string;
  [k: string]: any;
}

/** Nombres de los componentes contables que aparecen en una guía del motor. */
function componentesDeGuia(motorContable: any[] | undefined | null, eventos: string | string[]): Set<string> {
  const filas = leerGuiaContabilizadora(motorContable, eventos);
  const set = new Set<string>();
  for (const f of filas) {
    const c = f?.componente || {};
    if (c.nombre) set.add(norm(c.nombre));
    if (c.codigo) set.add(norm(c.codigo));
  }
  return set;
}

/** ¿El cargo corresponde a alguno de los componentes de esa guía? */
function cargoEnGuia(cargo: CargoProducto, componentes: Set<string>): boolean {
  return componentes.has(norm(cargo?.tipoCargo)) || componentes.has(norm(cargo?.descripcion));
}

export interface SeleccionCargos {
  cargos: CargoProducto[];
  /** Cómo se decidió: útil para explicarle al usuario por qué salió lo que salió. */
  criterio: 'momento' | 'motor-contable' | 'sin-criterio';
}

/**
 * CA-10…CA-13 — cargos que deben generarse al autorizar la Fase 4.
 *
 * Orden de criterios:
 *   1. `momento` capturado en el producto — la configuración explícita manda.
 *   2. Componente presente en la guía de formalización (`GPO-FORMAL-001`).
 *   3. Ninguno de los dos: se devuelven **todos**, que es el comportamiento
 *      histórico de REQ-15. Se conserva a propósito para no romper productos que
 *      nunca configuraron nada; el llamador avisa que no pudo distinguir.
 */
export function cargosDeFase4(
  cargosProducto: CargoProducto[] | undefined | null,
  motorContable?: any[] | null,
): SeleccionCargos {
  const cargos = Array.isArray(cargosProducto) ? cargosProducto : [];
  if (cargos.length === 0) return { cargos: [], criterio: 'sin-criterio' };

  // 1 — configuración explícita
  if (cargos.some(c => norm(c?.momento) !== '')) {
    return { cargos: cargos.filter(c => norm(c?.momento) === norm(MOMENTO_FASE4)), criterio: 'momento' };
  }

  // 2 — respaldo por Motor Contable
  const compFormalizacion = componentesDeGuia(motorContable, ALIAS_GUIA_FORMALIZACION_GPO);
  if (compFormalizacion.size > 0) {
    const deFormalizacion = cargos.filter(c => cargoEnGuia(c, compFormalizacion));
    if (deFormalizacion.length > 0) return { cargos: deFormalizacion, criterio: 'motor-contable' };
  }

  // 3 — sin forma de distinguir: comportamiento histórico
  return { cargos, criterio: 'sin-criterio' };
}

/** Un renglón del detalle del Aviso, en el shape que ya acepta el backend. */
export interface ConceptoAviso {
  cve: string;
  desc: string;
  monto: number;
}

export interface ConceptosAvisoResueltos {
  comision: { cve: string; desc: string };
  iva: { cve: string; desc: string } | null;
}

/**
 * CA-02…CA-04, CA-09 — de dónde salen los nombres de los dos renglones del Aviso.
 *
 * Se leen del catálogo de Cargos del producto para que coincidan carácter por
 * carácter con los componentes contables (RN-01). Si no se pueden identificar
 * devuelve `null` y el llamador **avisa en vez de inventar** (§Decisión 2): un
 * aviso con nombres genéricos se cobra pero no se puede contabilizar, que es peor
 * que no emitirlo.
 *
 * Entre los cargos del aviso, el del IVA se reconoce porque su concepto empieza
 * por "iva" — es la convención del catálogo ("IVA Comisión GPO", "IVA de la
 * Comisión") y evita depender del orden de captura.
 */
export function conceptosAvisoComision(
  cargosProducto: CargoProducto[] | undefined | null,
  motorContable?: any[] | null,
): ConceptosAvisoResueltos | null {
  const cargos = Array.isArray(cargosProducto) ? cargosProducto : [];
  if (cargos.length === 0) return null;

  // 1 — configuración explícita
  let delAviso = cargos.filter(c => norm(c?.momento) === norm(MOMENTO_AVISO));

  // 2 — respaldo por Motor Contable (guías de devengo y cobro de la comisión)
  if (delAviso.length === 0) {
    const compComision = componentesDeGuia(motorContable, EVENTOS_COMISION_GPO);
    if (compComision.size > 0) delAviso = cargos.filter(c => cargoEnGuia(c, compComision));
  }

  if (delAviso.length === 0) return null;

  const esIva = (c: CargoProducto) => norm(c?.tipoCargo).startsWith('iva');
  const cargoComision = delAviso.find(c => !esIva(c));
  const cargoIva = delAviso.find(esIva) || null;

  if (!cargoComision) return null;

  const aConcepto = (c: CargoProducto) => ({
    // `cve_subproducto` es corto en la tabla: el nombre del concepto va completo
    // en la descripción, que es lo que se ve en el documento.
    cve: String(c.tipoCargo || '').trim().slice(0, 30),
    desc: String(c.descripcion || c.tipoCargo || '').trim(),
  });

  return {
    comision: aConcepto(cargoComision),
    iva: cargoIva ? aConcepto(cargoIva) : null,
  };
}

/**
 * CA-01, CA-05, CA-08 — arma el detalle del Aviso de un periodo.
 *
 * Exactamente dos renglones (comisión + IVA) y ninguno más: nada de Capital,
 * Seguro ni IVA de Seguro, que son del desglose de crédito y no de una comisión
 * de garantía. Un importe en 0 no genera renglón (RN-05).
 */
export function construirConceptosAviso(
  resueltos: ConceptosAvisoResueltos,
  comision: number,
  iva: number,
): ConceptoAviso[] {
  const out: ConceptoAviso[] = [];
  if (comision > 0) out.push({ ...resueltos.comision, monto: comision });
  if (iva > 0 && resueltos.iva) out.push({ ...resueltos.iva, monto: iva });
  return out;
}
