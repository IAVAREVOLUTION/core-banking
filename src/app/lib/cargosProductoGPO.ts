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
export const MOMENTO_AVISO = 'AVISO_COMISION';

/**
 * Valor legado: cuando el picklist de Momento tenía una sola opción de fase,
 * fija, llamada "Fase 4 — Provisión de garantía". Equivale a `FASE_4`.
 * Se sigue leyendo para no invalidar los cargos ya capturados; ya no se ofrece
 * al capturar.
 */
export const MOMENTO_FASE4 = 'FASE_4_PROVISION';

/** Momento canónico de la fase en posición `seq` del producto. */
export function momentoDeFase(seq: number | string): string {
  return `FASE_${parseInt(String(seq), 10)}`;
}

/**
 * Posición (seq) que nombra un valor de Momento, o null si no nombra una fase.
 * Entiende el valor legado `FASE_4_PROVISION` como la fase 4.
 */
export function seqDeMomento(momento?: string | null): number | null {
  const m = String(momento ?? '').trim().toUpperCase();
  if (!m || m === MOMENTO_AVISO) return null;
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
 * Opciones del picklist **Momento** del subtab Cargos.
 *
 * Antes era una lista fija con una única fase hardcodeada ("Fase 4 — Provisión
 * de garantía"). Eso ataba el catálogo de cargos al nombre y al número de fase
 * de UN producto: al renombrar o reordenar las fases, el cargo quedaba
 * apuntando a una fase que ya no existía y la Solicitud dejaba de generarlo en
 * silencio. Ahora las opciones salen de las fases configuradas en el producto
 * que se está editando, y el valor guardado es la POSICIÓN (`FASE_<seq>`), no
 * el nombre — así renombrar una fase no invalida nada.
 */
export function construirMomentosCargo(fases?: FaseProducto[] | any): OpcionMomento[] {
  const lista = leerFasesProducto(fases);
  const deFases = lista.map((f, idx) => {
    const seq = seqDeFase(f, idx);
    const nombre = String(f?.fase || f?.phaseName || f?.descripcion || '').trim();
    return {
      value: momentoDeFase(seq),
      label: nombre ? `Fase ${seq} — ${nombre}` : `Fase ${seq}`,
    };
  });
  return [
    { value: '', label: 'Sin especificar' },
    ...deFases,
    { value: MOMENTO_AVISO, label: 'Aviso de vencimiento — Comisión' },
  ];
}

/** Etiqueta legible de un Momento ya guardado, para la tabla del subtab. */
export function etiquetaMomento(momento: string | undefined, fases?: FaseProducto[] | any): string {
  const opciones = construirMomentosCargo(fases);
  const exacta = opciones.find(o => o.value === (momento || ''));
  if (exacta) return exacta.label;
  // Valor legado o fase que ya no existe en el producto: no mentir con
  // "Sin especificar" — decir a qué fase apunta aunque no esté configurada.
  const seq = seqDeMomento(momento);
  return seq != null ? `Fase ${seq} (no configurada en este producto)` : 'Sin especificar';
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
 * CA-10…CA-13 — cargos que deben generarse al autorizar la fase `seqFase`.
 *
 * `seqFase` es la POSICIÓN de la fase en el producto (1..N), no su nombre: es
 * lo único estable cuando el analista renombra las fases desde el subtab Fases.
 *
 * Orden de criterios:
 *   1. `momento` capturado en el producto — la configuración explícita manda.
 *   2. Componente presente en la guía de formalización (`GPO-FORMAL-001`).
 *      Sólo aplica a la fase de provisión (la 4 del BPM GPO), que es la que esa
 *      guía contabiliza.
 *   3. Ninguno de los dos: se devuelven **todos**, que es el comportamiento
 *      histórico de REQ-15. Se conserva a propósito para no romper productos que
 *      nunca configuraron nada; el llamador avisa que no pudo distinguir.
 */
export function cargosDeFase(
  cargosProducto: CargoProducto[] | undefined | null,
  seqFase: number,
  motorContable?: any[] | null,
): SeleccionCargos {
  const cargos = Array.isArray(cargosProducto) ? cargosProducto : [];
  if (cargos.length === 0) return { cargos: [], criterio: 'sin-criterio' };

  // 1 — configuración explícita
  if (cargos.some(c => String(c?.momento ?? '').trim() !== '')) {
    return {
      cargos: cargos.filter(c => seqDeMomento(c?.momento) === seqFase),
      criterio: 'momento',
    };
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

// ═══════════════════════════════════════════════════════════════════
// CAMPO A MAPEAR — de dónde sale el IMPORTE de cada cargo
//
// Hasta aquí el monto de todo cargo generado era, fijo en código, el Monto
// Garantizado GPO. Eso sólo tiene sentido para la provisión de garantía de UN
// producto: un cargo de comisión por apertura tendría que salir del Monto
// Autorizado, y uno de seguro del Monto del Seguro. Ahora cada cargo del
// producto declara de qué campo monetario de la Solicitud toma su importe.
//
// El catálogo es FIJO a propósito: son campos del MODELO de la Solicitud, no
// datos capturables. Si mañana se agrega un campo monetario a Términos, se
// agrega aquí un renglón — que es justamente el punto de revisión que uno
// quiere, en vez de que el picklist ofrezca campos que el generador no sabe
// leer.
// ═══════════════════════════════════════════════════════════════════

/** Dónde vive físicamente el dato dentro de la Solicitud. */
export type OrigenCampoMonto = 'solicitud' | 'terminos' | 'modeloViabilidad';

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
  // ── Encabezado de la Solicitud ──
  { value: 'solicitud.montoAutorizado',       label: 'Monto Autorizado (encabezado)', origen: 'solicitud', campo: 'montoAutorizado' },
  { value: 'solicitud.montoSolicitado',       label: 'Monto Solicitado (encabezado)', origen: 'solicitud', campo: 'montoSolicitado' },
];

/** Opciones del picklist "Campo a Mapear", con la opción vacía al frente. */
export function opcionesCampoMonto(): OpcionMomento[] {
  return [
    { value: '', label: 'Sin mapear' },
    ...CAMPOS_MONTO_SOLICITUD.map(c => ({
      value: c.value,
      label: c.nota ? `${c.label} · ${c.nota}` : c.label,
    })),
  ];
}

/** Etiqueta legible de un Campo a Mapear ya guardado. */
export function etiquetaCampoMonto(value?: string): string {
  if (!value) return 'Sin mapear';
  const c = CAMPOS_MONTO_SOLICITUD.find(x => x.value === value);
  return c ? c.label : `${value} (campo desconocido)`;
}

/** "$1,234.50" | "1234.5" | 1234.5 → 1234.5. Devuelve 0 si no hay número. */
function aNumero(v: unknown): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const limpio = String(v ?? '').replace(/[^0-9.\-]/g, '');
  const n = parseFloat(limpio);
  return isFinite(n) ? n : 0;
}

export interface FuentesMonto {
  solicitud?: Record<string, any> | null;
  terminos?: Record<string, any> | null;
  modeloViabilidad?: Record<string, any> | null;
}

/**
 * Importe de un cargo a partir de su Campo a Mapear.
 * `null` = el cargo no declara campo, o el campo existe pero viene vacío/cero:
 * en ambos casos el llamador decide (hoy: no generar ese cargo y decir por qué).
 */
export function resolverMontoCargo(campoMapeado: string | undefined | null, fuentes: FuentesMonto): number | null {
  const def = CAMPOS_MONTO_SOLICITUD.find(c => c.value === campoMapeado);
  if (!def) return null;
  const origen = fuentes[def.origen];
  if (!origen) return null;
  const n = aNumero(origen[def.campo]);
  return n > 0 ? n : null;
}

// ═══════════════════════════════════════════════════════════════════
// GENERACIÓN DE CARGOS AL AUTORIZAR UNA FASE
//
// Antes esto vivía enterrado dentro de la compuerta de Cláusulas Fiduciarias de
// SolicitudCreditoForm: sólo corría en el producto GPO, sólo en su fase 4, y con
// el importe fijo al Monto Garantizado. Aquí queda como una función pura, sin
// React ni storage, para que cualquier fase de cualquier producto pueda pedir
// "los cargos que me tocan" y para poder probarla sin montar el formulario.
//
// RN: que una fase NO tenga cargos configurados **no es un error**. Es el caso
// normal — casi ninguna fase genera cargos. El llamador no debe avisar nada.
// ═══════════════════════════════════════════════════════════════════

/** Cargo ya materializado en la Solicitud (shape que consume SolicitudCargosTab). */
export interface CargoSolicitud {
  id: number;
  tipoCargo: string;
  descripcion: string;
  monto: number;
  moneda?: string;
  fechaCargo: string;
  estatus: string;
  notas: string;
  /** Trazabilidad: de qué fase y de qué campo salió. */
  _faseOrigen?: number;
  _campoMapeado?: string;
}

export interface CargoOmitido {
  tipoCargo: string;
  motivo: string;
}

export interface ResultadoCargosFase {
  /** Cargos nuevos a agregar (ya des-duplicados contra los existentes). */
  nuevos: CargoSolicitud[];
  /** Cargos del producto que tocaban esta fase pero no se pudieron importar. */
  omitidos: CargoOmitido[];
  /** true = esta fase no tiene cargos configurados. Caso normal, no es error. */
  sinConfiguracion: boolean;
  /** Cuántos de los que tocaban ya existían en la Solicitud. */
  duplicados: number;
  criterio: SeleccionCargos['criterio'];
}

/** Llave de identidad de un cargo dentro de la Solicitud. */
const claveCargo = (t: unknown, d: unknown) =>
  `${String(t ?? '').trim().toLowerCase()}|${String(d ?? '').trim().toLowerCase()}`;

export interface ArgsCargosFase {
  /** Catálogo de Cargos del producto. */
  cargosProducto: CargoProducto[] | undefined | null;
  /** Posición de la fase que se está autorizando. */
  seqFase: number;
  /** Nombre de la fase — sólo para la nota de trazabilidad. */
  nombreFase?: string;
  /** Cargos que ya tiene la Solicitud, para no duplicar. */
  cargosExistentes?: any[] | null;
  /** De dónde leer los importes mapeados. */
  fuentes: FuentesMonto;
  /** Motor Contable del producto — sólo para el respaldo histórico. */
  motorContable?: any[] | null;
  /**
   * Permite los criterios de respaldo (Motor Contable / copiar todos) cuando el
   * producto no marcó el Momento de sus cargos. Se activa SÓLO en el camino que
   * ya lo hacía (fase de provisión del BPM GPO): habilitarlo en todas las fases
   * volcaría el catálogo entero —18 conceptos en una tarjeta de crédito— en
   * cada avance de fase.
   */
  permitirRespaldo?: boolean;
  /** Monto a usar cuando un cargo no declara Campo a Mapear. Compatibilidad. */
  montoPorDefecto?: number | null;
}

export function construirCargosDeFase(args: ArgsCargosFase): ResultadoCargosFase {
  const {
    cargosProducto, seqFase, nombreFase, cargosExistentes, fuentes,
    motorContable, permitirRespaldo = false, montoPorDefecto = null,
  } = args;

  const catalogo = Array.isArray(cargosProducto) ? cargosProducto : [];
  const vacio: ResultadoCargosFase = {
    nuevos: [], omitidos: [], sinConfiguracion: true, duplicados: 0, criterio: 'momento',
  };
  if (catalogo.length === 0) return vacio;

  const seleccion = permitirRespaldo
    ? cargosDeFase(catalogo, seqFase, motorContable)
    : { cargos: catalogo.filter(c => seqDeMomento(c?.momento) === seqFase), criterio: 'momento' as const };

  if (seleccion.cargos.length === 0) return { ...vacio, criterio: seleccion.criterio };

  const yaEstan = new Set(
    (Array.isArray(cargosExistentes) ? cargosExistentes : [])
      .map((c: any) => claveCargo(c?.tipoCargo, c?.descripcion)),
  );

  const hoyISO = new Date().toISOString().slice(0, 10);
  const nuevos: CargoSolicitud[] = [];
  const omitidos: CargoOmitido[] = [];
  let duplicados = 0;

  seleccion.cargos.forEach((c, i) => {
    const nombre = c?.tipoCargo || c?.descripcion || '(sin nombre)';
    if (yaEstan.has(claveCargo(c?.tipoCargo, c?.descripcion))) { duplicados++; return; }

    const mapeado = resolverMontoCargo(c?.campoMapeado, fuentes);
    const monto = mapeado ?? (montoPorDefecto && montoPorDefecto > 0 ? montoPorDefecto : null);

    if (monto == null) {
      omitidos.push({
        tipoCargo: nombre,
        motivo: c?.campoMapeado
          ? `${etiquetaCampoMonto(c.campoMapeado)} viene vacío o en cero en la Solicitud`
          : 'no tiene Campo a Mapear configurado en el producto',
      });
      return;
    }

    nuevos.push({
      id: Date.now() + i,
      tipoCargo: c?.tipoCargo || '',
      descripcion: c?.descripcion || '',
      monto,
      moneda: c?.moneda || undefined,
      fechaCargo: hoyISO,
      estatus: 'Pendiente',
      notas:
        `Generado automáticamente al autorizar la Fase ${seqFase}` +
        (nombreFase ? ` (${nombreFase})` : '') +
        `. Importe = ${c?.campoMapeado ? etiquetaCampoMonto(c.campoMapeado) : 'monto por defecto de la fase'}.`,
      _faseOrigen: seqFase,
      _campoMapeado: c?.campoMapeado || undefined,
    });
  });

  return { nuevos, omitidos, sinConfiguracion: false, duplicados, criterio: seleccion.criterio };
}
