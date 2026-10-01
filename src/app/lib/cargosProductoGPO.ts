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
/** MD NAFIN SubLíneas 06/08 — cargos que genera la activación de una SubLínea. */
export const MOMENTO_ACTIVACION_SUBLINEA = 'ACTIVACION_SUBLINEA';

/**
 * MD NAFIN Línea Global 04 / 10 §4 y SubLíneas 07 / CA-11 — cargo que se
 * genera al AUTORIZAR una fase concreta del producto (`cargo.fase`). Es el
 * motor genérico "Producto + Fase → cargos configurados"; no depende del nombre
 * del producto ni de la fase, y un producto que no lo use no cambia.
 */
export const MOMENTO_AUTORIZAR_FASE = 'AUTORIZAR_FASE';

/** Momento canónico de la fase en posición `seq` del producto (`FASE_<seq>`). */
export function momentoDeFase(seq: number | string): string {
  return `FASE_${parseInt(String(seq), 10)}`;
}

/**
 * Posición (seq) que nombra un valor de Momento, o null si no nombra una fase.
 * Entiende el valor legado `FASE_4_PROVISION` como la fase 4.
 */
export function seqDeMomento(momento?: string | null): number | null {
  const m = String(momento ?? '').trim().toUpperCase();
  if (!m) return null;
  if (m === MOMENTO_FASE4) return 4;
  const match = m.match(/^FASE_(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

/** Una fase del producto, como la captura `FasesTab` en `producto.fases`. */
export interface FaseProducto {
  seq?: number | string;
  fase?: string;
  descripcion?: string;
  phaseName?: string;
  numero_consecutivo?: number | string;
  orden?: number | string;
  numeroFase?: number | string;
  [k: string]: any;
}

/** Normaliza la lista de fases desde cualquiera de los shapes en que se guarda. */
export function leerFasesProducto(productData: any): FaseProducto[] {
  const raw =
    (Array.isArray(productData?.fases) && productData.fases.length > 0 ? productData.fases : null) ??
    (Array.isArray(productData?.fasesRegistros) && productData.fasesRegistros.length > 0 ? productData.fasesRegistros : null) ??
    (Array.isArray(productData?.fase) ? productData.fase : null) ??
    (Array.isArray(productData) ? productData : null);
  return Array.isArray(raw) ? raw : [];
}

/** Posición 1..N de una fase, tomada del propio registro o de su índice. */
export function seqDeFase(f: FaseProducto, idx: number): number {
  return parseInt(String(f?.seq ?? f?.numero_consecutivo ?? f?.orden ?? f?.numeroFase ?? idx + 1), 10) || idx + 1;
}

export interface OpcionMomento {
  value: string;
  label: string;
}

/**
 * Opciones del picklist **Momento** del subtab Cargos: una por cada fase
 * configurada en el producto (valor `FASE_<seq>`, la posición y no el nombre,
 * para que renombrar una fase no invalide el cargo), más los eventos que no son
 * fase: Aviso de vencimiento y Activación de SubLínea.
 */
export function construirMomentosCargo(fases?: FaseProducto[] | any): OpcionMomento[] {
  const deFases = leerFasesProducto(fases).map((f, idx) => {
    const seq = seqDeFase(f, idx);
    const nombre = String(f?.fase || f?.phaseName || f?.descripcion || '').trim();
    return { value: momentoDeFase(seq), label: nombre ? `Fase ${seq} — ${nombre}` : `Fase ${seq}` };
  });
  return [
    { value: '', label: 'Sin especificar' },
    ...deFases,
    { value: MOMENTO_AVISO, label: 'Aviso de vencimiento — Comisión' },
    { value: MOMENTO_ACTIVACION_SUBLINEA, label: 'Activación de SubLínea (Carta de Crédito)' },
  ];
}

/** Etiqueta legible de un Momento ya guardado (incluye los valores legados). */
export function etiquetaMomento(momento: string | undefined, fases?: FaseProducto[] | any, faseNombre?: string): string {
  if (momento === MOMENTO_AUTORIZAR_FASE) return faseNombre ? `Al autorizar la fase — ${faseNombre}` : 'Al autorizar una fase';
  const opciones = construirMomentosCargo(fases);
  const exacta = opciones.find(o => o.value === (momento || ''));
  if (exacta) return exacta.label;
  // Legado FASE_4_PROVISION → la fase 4 del producto, si existe.
  const seq = seqDeMomento(momento);
  const porSeq = seq != null ? opciones.find(o => o.value === momentoDeFase(seq)) : undefined;
  if (porSeq) return porSeq.label;
  return seq != null ? `Fase ${seq} (no configurada en este producto)` : 'Sin especificar';
}

/** ¿El Momento del cargo es una fase (nueva o legada) y no un evento? */
export function esMomentoDeFase(momento?: string | null): boolean {
  return momento === MOMENTO_AUTORIZAR_FASE || seqDeMomento(momento) != null;
}

/** Sobre qué se calcula el importe de un cargo configurado por fase o evento. */
export const BASES_CALCULO_CARGO = [
  { value: 'FIJO', label: 'Monto fijo' },
  { value: 'PCT_SOLICITADO', label: '% del Monto Solicitado' },
  { value: 'PCT_AUTORIZADO', label: '% del Monto Autorizado' },
  { value: 'PCT_GARANTIZADO', label: '% del Monto Garantizado' },
];

/** Importe de un cargo según su base. `null` si el cargo no declara base (catálogos anteriores). */
export function montoCargo(
  cargo: CargoProducto,
  bases: { solicitado?: number; autorizado?: number; garantizado?: number },
): number | null {
  const base = String(cargo?.baseCalculo || '');
  const valor = parseFloat(String(cargo?.valor ?? '').replace(/[^0-9.-]/g, '')) || 0;
  if (!base) return null;
  const r = (n: number) => Math.round(n * 100) / 100;
  if (base === 'FIJO') return r(valor);
  const sobre = base === 'PCT_SOLICITADO' ? bases.solicitado
    : base === 'PCT_AUTORIZADO' ? bases.autorizado
    : bases.garantizado;
  return r((Number(sobre) || 0) * valor / 100);
}

// ═══════════════════════════════════════════════════════════════════
// CAMPO A MAPEAR — de qué campo monetario de la Solicitud sale el importe del
// cargo. Catálogo cerrado: sólo campos que el generador sabe leer.
// ═══════════════════════════════════════════════════════════════════

/** Dónde vive físicamente el dato dentro de la Solicitud. */
export type OrigenCampoMonto = 'solicitud' | 'terminos' | 'modeloViabilidad' | 'lineaGlobal' | 'sublinea';

export interface CampoMontoSolicitud {
  /** Valor guardado en el cargo del producto. */
  value: string;
  label: string;
  origen: OrigenCampoMonto;
  /** Nombre de la propiedad dentro de ese origen. */
  campo: string;
  /** Sólo informativo: en qué productos tiene sentido. */
  nota?: string;
}

export const CAMPOS_MONTO_SOLICITUD: CampoMontoSolicitud[] = [
  // ── Términos y Condiciones ──
  { value: 'terminos.montoAutorizado',        label: 'Monto Autorizado',              origen: 'terminos', campo: 'montoAutorizado' },
  { value: 'terminos.montoSolicitado',        label: 'Monto Solicitado',              origen: 'terminos', campo: 'montoSolicitado' },
  { value: 'terminos.montoGarantia',          label: 'Monto de la Garantía',          origen: 'terminos', campo: 'montoGarantia' },
  { value: 'terminos.montoCubrirGarantia',    label: 'Monto a Cubrir del Bien',       origen: 'terminos', campo: 'montoCubrirGarantia' },
  { value: 'terminos.montoSeguro',            label: 'Monto del Seguro',              origen: 'terminos', campo: 'montoSeguro' },
  { value: 'terminos.montoEnganche',          label: 'Monto de Enganche',             origen: 'terminos', campo: 'montoEnganche',  nota: 'Arrendamiento' },
  { value: 'terminos.montoResidual',          label: 'Monto Residual',                origen: 'terminos', campo: 'montoResidual',  nota: 'Arrendamiento' },
  { value: 'terminos.pagoMensual',            label: 'Pago del Período',              origen: 'terminos', campo: 'pagoMensual' },
  { value: 'terminos.pagoTotal',              label: 'Pago Total del Período',        origen: 'terminos', campo: 'pagoTotal' },
  // ── Garantía Financiera 2o Piso ──
  { value: 'terminos.montoGarantizadoGpo',    label: 'Monto Garantizado GPO',         origen: 'terminos', campo: 'montoGarantizadoGpo',    nota: 'GPO' },
  { value: 'terminos.montoEmisionProyectado', label: 'Monto de Emisión Proyectado',   origen: 'terminos', campo: 'montoEmisionProyectado', nota: 'GPO' },
  { value: 'modeloViabilidad.montoFondoReservaFideicomiso',
    label: 'Monto Fondo de Reserva del Fideicomiso', origen: 'modeloViabilidad', campo: 'montoFondoReservaFideicomiso', nota: 'GPO' },
  // ── NAFIN ──
  { value: 'lineaGlobal.montoAutorizado',     label: 'Monto Autorizado de la Línea Global', origen: 'lineaGlobal', campo: 'montoAutorizado', nota: 'NAFIN' },
  { value: 'sublinea.montoElegible',          label: 'Monto de la Carta (Elegible)',  origen: 'sublinea', campo: 'montoElegible',   nota: 'SubLínea' },
  { value: 'sublinea.montoGarantizado',       label: 'Monto Garantizado SubLínea',    origen: 'sublinea', campo: 'montoGarantizado', nota: 'SubLínea' },
  { value: 'sublinea.montoComision',          label: 'Comisión SubLínea (Garantizado × % Comisión)', origen: 'sublinea', campo: 'montoComision', nota: 'SubLínea' },
  // ── Encabezado de la Solicitud ──
  { value: 'solicitud.montoAutorizado',       label: 'Monto Autorizado (encabezado)', origen: 'solicitud', campo: 'montoAutorizado' },
  { value: 'solicitud.montoSolicitado',       label: 'Monto Solicitado (encabezado)', origen: 'solicitud', campo: 'montoSolicitado' },
];

/** Opciones del picklist "Campo a Mapear", con la opción vacía al frente. */
export function opcionesCampoMonto(): OpcionMomento[] {
  return [
    { value: '', label: 'Sin mapear' },
    ...CAMPOS_MONTO_SOLICITUD.map(c => ({ value: c.value, label: c.nota ? `${c.label} · ${c.nota}` : c.label })),
  ];
}

/** Etiqueta legible de un Campo a Mapear ya guardado. */
export function etiquetaCampoMonto(value?: string): string {
  if (!value) return 'Sin mapear';
  const c = CAMPOS_MONTO_SOLICITUD.find(x => x.value === value);
  return c ? c.label : `${value} (campo desconocido)`;
}

export type FuentesMonto = Partial<Record<OrigenCampoMonto, Record<string, any> | null>>;

/**
 * Importe de un cargo a partir de su Campo a Mapear. `null` si el cargo no
 * declara campo o el campo viene vacío/cero: el llamador decide qué hacer.
 */
export function resolverMontoCargo(campoMapeado: string | undefined | null, fuentes: FuentesMonto): number | null {
  const def = CAMPOS_MONTO_SOLICITUD.find(c => c.value === campoMapeado);
  const origen = def ? fuentes[def.origen] : null;
  if (!def || !origen) return null;
  const n = parseFloat(String(origen[def.campo] ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

/**
 * Cargos configurados para AUTORIZAR la fase indicada: por posición
 * (`FASE_<seq>`) o, en catálogos anteriores, `AUTORIZAR_FASE` + nombre de fase.
 * El legado `FASE_4_PROVISION` no se toma aquí: lo atiende `cargosDeFase4`.
 * Con `seqFase` null sólo se compara por nombre.
 */
export function cargosDeFase(
  cargosProducto: CargoProducto[] | undefined | null,
  nombreFase: string,
  seqFase?: number | null,
): CargoProducto[] {
  const fase = norm(nombreFase);
  return (Array.isArray(cargosProducto) ? cargosProducto : []).filter(c => {
    if (norm(c?.momento) === norm(MOMENTO_AUTORIZAR_FASE)) return !!fase && norm(c?.fase) === fase;
    if (seqFase == null || String(c?.momento ?? '').trim().toUpperCase() === MOMENTO_FASE4) return false;
    return seqDeMomento(c?.momento) === seqFase;
  });
}

/**
 * Cargos del producto marcados para un momento. A diferencia de
 * `cargosDeFase4`, aquí NO hay respaldo "copiar todos": ese respaldo existe por
 * compatibilidad con catálogos BANOBRAS viejos, y fue justo lo que produjo el
 * defecto de REQ-21. Un producto nuevo que no marca el momento no genera cargos.
 */
export function cargosDeMomento(
  cargosProducto: CargoProducto[] | undefined | null,
  momento: string,
): CargoProducto[] {
  const cargos = Array.isArray(cargosProducto) ? cargosProducto : [];
  return cargos.filter(c => norm(c?.momento) === norm(momento));
}

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
  /** Con momento AUTORIZAR_FASE: nombre de la fase del producto que lo genera. */
  fase?: string;
  /** Campo monetario de la Solicitud del que sale el importe (CAMPOS_MONTO_SOLICITUD). */
  campoMapeado?: string;
  /** Legado: base del importe (BASES_CALCULO_CARGO) y su valor. Ya no se captura. */
  baseCalculo?: string;
  valor?: string | number;
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
    return { cargos: cargos.filter(c => seqDeMomento(c?.momento) === 4), criterio: 'momento' };
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
