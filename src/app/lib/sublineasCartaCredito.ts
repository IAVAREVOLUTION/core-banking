/**
 * sublineasCartaCredito.ts — SubLíneas de Carta de Crédito NAFIN.
 *
 * Capa de decisión de los dos productos hijo de disposición de una Línea Global
 * NAFIN (`SubLínea Carta de Crédito Automática` y `... Selectiva`). Aquí vive
 * TODO lo que los MD 00/01/12/13 exigen centralizar, y nada de UI:
 *
 *   - identificación del producto (MD 12 §2: por Id/Clave/relaciones, nunca por
 *     el nombre visible);
 *   - resolución de los parámetros que el administrador captura en Taller de
 *     Producto (MD 01: reutilizar campos existentes antes que inventar);
 *   - la fórmula de Monto Garantizado (MD 05 / MD 08);
 *   - la derivación Autorizado / Contingente / Disponible de la Línea Global
 *     (MD 08);
 *   - el motor de las 10 reglas de elegibilidad (MD 06), que Automática usa para
 *     resolver sin fases y Selectiva vuelve a correr en Fase 5.
 *
 * ── Por qué los parámetros se leen "a la defensiva" ────────────────────────
 * Los flags nuevos del MD 01 (Naturaleza Financiera, Tipo de Carta Permitida,
 * Producto Padre Requerido, Requiere Línea Global Activa, Consume Disponible al
 * Activar) todavía no tienen captura en Taller de Producto. Este módulo los lee
 * de `producto` sin exigir que el tipo los declare, así que funciona igual antes
 * y después de que existan esos campos, y documenta el default que aplica cuando
 * el administrador no capturó nada. Es lo que permite escribir y probar la lógica
 * sin bloquearse en la UI del producto.
 *
 * ── Qué NO hace ───────────────────────────────────────────────────────────
 * No toca la BD, no importa React y no conoce `banca2oPisoStore`. El efecto de
 * activar (restar disponible, sellar contingente) vive en el servicio
 * `ActivarSublinea()`; esto sólo decide qué debe pasar. Separarlo es lo que
 * permite probar las reglas sin red y lo que evita duplicar el motor de cargos
 * (MD 06 / MD 12 §1).
 */

// ═══════════════════════════════════════════════════════════════════
// Vocabulario
// ═══════════════════════════════════════════════════════════════════

/** MD 12 §3 — la modalidad la determina el PRODUCTO, no un switch en pantalla. */
export const MODALIDAD_AUTOMATICA = 'Automatica';
export const MODALIDAD_SELECTIVA = 'Selectiva';
export type ModalidadSubLinea = typeof MODALIDAD_AUTOMATICA | typeof MODALIDAD_SELECTIVA;

/** MD 01 — naturaleza financiera de ambos productos hijo. */
export const NATURALEZA_CONTINGENTE = 'Contingente';

/** MD 01 — `Tipo de Operación`. Se captura en el campo `destino` del producto. */
export const OPERACION_CARTA_CREDITO = 'Carta de Crédito';

/** MD 05 Bloque B — tipos de carta que puede amparar una SubLínea. */
export const CARTA_COMERCIAL = 'Comercial';
export const CARTA_STANDBY = 'Standby';
export const CARTA_AMBAS = 'Ambas';
export type TipoCarta = typeof CARTA_COMERCIAL | typeof CARTA_STANDBY;

/** MD 05 — roles mínimos de Partes Relacionadas para una Carta de Crédito. */
export const ROL_ORDENANTE = 'Ordenante / Acreditado Final';
export const ROL_BENEFICIARIO_CARTA = 'Beneficiario Carta';

/** MD 08 §Estados. */
export const ESTADO_BORRADOR = 'BORRADOR';
export const ESTADO_EN_ORIGINACION = 'EN_ORIGINACION';
export const ESTADO_AUTORIZADA = 'AUTORIZADA';
export const ESTADO_ACTIVA = 'ACTIVA';
export const ESTADO_RECHAZADA = 'RECHAZADA';
export const ESTADO_NO_ELEGIBLE = 'NO ELEGIBLE PARA AUTOMATICA';

/** MD 01 — mensaje exacto cuando el producto no es Producto Disposición del padre. */
export const MSG_PRODUCTO_NO_PERMITIDO =
  'El producto seleccionado no se encuentra configurado como Producto de Disposición de la Línea Global.';

/** MD 12 §3 — 5 fases exactas del producto Selectivo. */
export const FASES_SELECTIVA = [
  'Integración de Expediente',
  'Evaluación',
  'Aprobación',
  'Instrumentación',
  'Activación',
] as const;

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

/** Misma normalización que usa el resto del repo (ver `cargosProductoGPO.ts`). */
const norm = (v: unknown) =>
  String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Número desde lo que sea que traiga el producto o la pantalla. Taller de
 * Producto guarda casi todo como texto (`number | string` en el tipo) y los
 * montos capturados llegan con separadores de miles y signo de moneda.
 */
export function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const limpio = String(v ?? '').replace(/[^0-9.-]/g, '');
  const n = parseFloat(limpio);
  return Number.isFinite(n) ? n : 0;
}

/** Sí/No capturado como booleano, 'Sí'/'No', 'true'/'false' o 1/0. */
export function flag(v: unknown, porDefecto: boolean): boolean {
  if (v === undefined || v === null || v === '') return porDefecto;
  if (typeof v === 'boolean') return v;
  const n = norm(v);
  if (n === 'si' || n === 'true' || n === '1' || n === 'x') return true;
  if (n === 'no' || n === 'false' || n === '0') return false;
  return porDefecto;
}

/** Primer valor no vacío entre varias claves candidatas del producto. */
function leer(producto: any, ...claves: string[]): unknown {
  for (const k of claves) {
    const v = producto?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

/** Centavos. Evita que un 0.5 * 33.33 arrastre binario hasta el saldo. */
function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════════
// 1 — Identificación del producto (MD 12 §2)
// ═══════════════════════════════════════════════════════════════════

/**
 * ¿El producto opera Cartas de Crédito? (padre o hijo, sin distinguir)
 *
 * Es la mitad común de la identificación: `Tipo de Operación`, que reutiliza el
 * campo `destino` de Default (MD 01 §Prioridad 1). Lo usan tanto la Línea Global
 * como sus SubLíneas, por eso vive aparte.
 */
export function esOperacionCartaCredito(producto: any): boolean {
  if (!producto) return false;
  const operacion = norm(leer(producto, 'tipoOperacion', 'destino'));
  return operacion.includes('carta') && operacion.includes('credito');
}

/**
 * ¿El producto tiene Productos Disposición configurados?
 *
 * Es el discriminador PADRE / HIJO, y es estructural: sale de la relación real
 * del modelo (MD 12 §2), no de un atributo descriptivo.
 *
 * ── Por qué NO se usa `Naturaleza Financiera` para esto ───────────────────
 * Fue el primer intento y estaba mal. `Contingente` es una verdad de negocio
 * que aplica a AMBOS: una Línea Global de Garantías es exposición contingente
 * tanto como las cartas que cuelgan de ella. Un administrador que marque
 * `Contingente` en la Línea Global está capturando bien, y aun así el producto
 * quedaba clasificado como SubLínea y la pantalla de Oportunidad no cambiaba.
 *
 * La arquitectura del MD 00 sí da un criterio inequívoco:
 *   `Línea Global → Productos Disposición → SubLínea`
 * El padre es quien LISTA hijos; el hijo es quien NO lista ninguno. Eso no
 * admite dos lecturas.
 */
function tieneProductosDisposicion(producto: any): boolean {
  const paquetes = producto?.paquetes;
  if (!Array.isArray(paquetes)) return false;
  // Se exige nombre: `PaquetesTab` deja renglones en blanco al capturar.
  return paquetes.some(p => String(p?.paqueteProductoNombre ?? '').trim() !== '');
}

/**
 * ¿Este producto es una SubLínea de Carta de Crédito? (el HIJO)
 *
 * Opera Cartas de Crédito y no cuelga nada de sí mismo: es un producto de
 * disposición, no un cupo.
 */
export function esSubLineaCartaCredito(producto: any): boolean {
  return esOperacionCartaCredito(producto) && !tieneProductosDisposicion(producto);
}

/**
 * ¿Es la LÍNEA GLOBAL de Carta de Crédito? (el PADRE)
 *
 * Opera Cartas de Crédito y tiene Productos Disposición configurados — o sea,
 * hay SubLíneas que pueden colgarse de ella.
 *
 * Distinguirlos importa porque la Oportunidad se levanta sobre el padre y las
 * Disposiciones sobre los hijos.
 */
export function esLineaGlobalCartaCredito(producto: any): boolean {
  return esOperacionCartaCredito(producto) && tieneProductosDisposicion(producto);
}

/**
 * Modalidad del producto.
 *
 * MD 12 §3: *"Producto Automático = sin fases, Producto Selectivo = 5 fases. No
 * usar un único producto con un switch manual de modalidad"*. Por eso la
 * modalidad se **deriva de las fases configuradas** y el campo explícito sólo
 * desempata cuando no hay fases: así un producto no puede quedar marcado
 * "Automática" mientras arrastra un workflow de fases, que es justo la
 * incoherencia que el MD prohíbe.
 *
 * Devuelve `null` si el producto no es una SubLínea de Carta de Crédito.
 */
export function modalidadDe(producto: any): ModalidadSubLinea | null {
  if (!esSubLineaCartaCredito(producto)) return null;
  const fases = Array.isArray(producto?.fases) ? producto.fases : [];
  if (fases.length > 0) return MODALIDAD_SELECTIVA;
  const explicita = norm(leer(producto, 'modalidadResolucion', 'modalidad'));
  if (explicita.startsWith('select')) return MODALIDAD_SELECTIVA;
  return MODALIDAD_AUTOMATICA;
}

/** MD 02 / MD 06 — ¿se resuelve sin recorrer fases? */
export function esAutomatica(producto: any): boolean {
  return modalidadDe(producto) === MODALIDAD_AUTOMATICA;
}

/** MD 03 / MD 07 — ¿recorre F1-F5 de Originación? */
export function esSelectiva(producto: any): boolean {
  return modalidadDe(producto) === MODALIDAD_SELECTIVA;
}

// ═══════════════════════════════════════════════════════════════════
// 2 — Parámetros configurados en Taller de Producto (MD 01)
// ═══════════════════════════════════════════════════════════════════

export interface ParametrosSubLinea {
  modalidad: ModalidadSubLinea | null;
  /** MD 01 — banderas de control del producto hijo. */
  productoPadreRequerido: boolean;
  requiereLineaGlobalActiva: boolean;
  consumeDisponibleAlActivar: boolean;
  permiteSobregiro: boolean;
  /** Rangos de monto de la SubLínea — reutiliza `montoMinimo`/`montoMaximo`. */
  montoMinimo: number;
  montoMaximo: number;
  /** Plazo en días — reutiliza `plazo{Minimo,Maximo}Disposicion`. */
  plazoMinimo: number;
  plazoMaximo: number;
  /** % de cobertura — del subtab `Cobertura y Comisiones 2º Piso`. */
  coberturaMinima: number;
  coberturaDefault: number;
  coberturaMaxima: number;
  /** % de comisión — del mismo subtab. */
  comisionMinima: number;
  comisionDefault: number;
  comisionMaxima: number;
  monedasPermitidas: string[];
  tiposCartaPermitidos: TipoCarta[];
  /** true cuando falta la captura de Cobertura y Comisiones 2º Piso. */
  sinCoberturaConfigurada: boolean;
}

/**
 * Resuelve los parámetros de una SubLínea leyendo el producto configurado.
 *
 * MD 01 §Prioridad: *reutilizar campos existentes → extender Default/Cobertura →
 * sólo en último caso crear subpestaña*. La mayoría ya existía en
 * `ProductoLineaCredito`, así que aquí se mapean en vez de duplicarse:
 *
 *   Monto mínimo/máximo de SubLínea → `montoMinimo` / `montoMaximo`
 *   Plazo mínimo/máximo            → `plazoMinimoDisposicion` / `plazoMaximoDisposicion`
 *   Cobertura mín/default/máx      → `cobertura2oPiso[].porcentaje*Cobertura`
 *   Comisión  mín/default/máx      → `cobertura2oPiso[].porcentaje*Comision`
 *   Permite Sobregiro              → `permiteSobregiros`
 *   Tipo de Operación              → `destino`
 *
 * Sólo quedan como campos nuevos los flags de control, `Tipo de Carta Permitida`,
 * `Naturaleza Financiera` y `Monedas permitidas` (hoy `moneda` es una sola).
 *
 * Defaults cuando el administrador no capturó: los del MD 01 §Valores
 * recomendados, que son los restrictivos (padre requerido, línea activa
 * requerida, consume al activar, sin sobregiro). Un flag ausente nunca debe
 * relajar un control.
 */
export function parametrosSubLinea(producto: any): ParametrosSubLinea {
  const cob = Array.isArray(producto?.cobertura2oPiso) ? producto.cobertura2oPiso : [];
  // Se toma el primer renglón: la cobertura de una SubLínea es un solo juego de
  // topes. Si algún día hay varios por moneda o plazo, este es el punto a tocar.
  const c: any = cob[0] || {};

  const monedas = (() => {
    const lista = leer(producto, 'monedasPermitidas');
    if (Array.isArray(lista) && lista.length > 0) {
      return lista.map((m: unknown) => String(m).trim()).filter(Boolean);
    }
    const una = String(leer(producto, 'moneda') ?? '').trim();
    return una ? [una] : [];
  })();

  const tiposCarta = ((): TipoCarta[] => {
    const v = leer(producto, 'tipoCartaPermitida', 'tiposCartaPermitidos');
    if (Array.isArray(v)) {
      const arr = v.map((x: unknown) => norm(x));
      const out: TipoCarta[] = [];
      if (arr.some((x: string) => x.includes('comercial'))) out.push(CARTA_COMERCIAL);
      if (arr.some((x: string) => x.includes('standby') || x.includes('stand by'))) out.push(CARTA_STANDBY);
      return out;
    }
    const n = norm(v);
    // 'Ambas' y la ausencia de captura se tratan igual: sin restricción. Un
    // producto sin este dato no debe rechazar cartas válidas en la demo.
    if (!n || n === norm(CARTA_AMBAS)) return [CARTA_COMERCIAL, CARTA_STANDBY];
    if (n.includes('comercial')) return [CARTA_COMERCIAL];
    if (n.includes('standby') || n.includes('stand by')) return [CARTA_STANDBY];
    return [CARTA_COMERCIAL, CARTA_STANDBY];
  })();

  return {
    modalidad: modalidadDe(producto),
    productoPadreRequerido: flag(leer(producto, 'productoPadreRequerido'), true),
    requiereLineaGlobalActiva: flag(leer(producto, 'requiereLineaGlobalActiva'), true),
    consumeDisponibleAlActivar: flag(leer(producto, 'consumeDisponibleAlActivar'), true),
    permiteSobregiro: flag(leer(producto, 'permiteSobregiro', 'permiteSobregiros'), false),
    montoMinimo: num(leer(producto, 'montoMinimoSublinea', 'montoMinimo')),
    montoMaximo: num(leer(producto, 'montoMaximoSublinea', 'montoMaximo')),
    plazoMinimo: num(leer(producto, 'plazoMinimo', 'plazoMinimoDisposicion')),
    plazoMaximo: num(leer(producto, 'plazoMaximo', 'plazoMaximoDisposicion')),
    coberturaMinima: num(c.porcentajeMinCobertura),
    coberturaDefault: num(c.porcentajeDefaultCobertura),
    coberturaMaxima: num(c.porcentajeMaxCobertura),
    comisionMinima: num(c.porcentajeMinComision),
    comisionDefault: num(c.porcentajeDefaultComision),
    comisionMaxima: num(c.porcentajeMaxComision),
    monedasPermitidas: monedas,
    tiposCartaPermitidos: tiposCarta,
    sinCoberturaConfigurada: cob.length === 0,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 3 — Producto Disposición permitido (MD 01 / MD 04 CA-01)
// ═══════════════════════════════════════════════════════════════════

/**
 * CA-01 — `ProductoSeleccionado ∈ LineaGlobal.ProductosDisposicion`.
 *
 * Se compara por las TRES identidades que puede traer un producto, porque en
 * este código conviven y el subtab guarda cualquiera de ellas:
 *
 *   `dbUuid` — la PK de `J_PRODUCTOS`. Es lo que `paqueteProductoId` almacena en
 *              un producto dado de alta de verdad, así que es la que manda.
 *   `id`     — el id local (`data.localId`, o la posición en la lista). Sólo
 *              sirve para catálogos capturados a mano.
 *   `clave`  — respaldo legible.
 *
 * Omitir `dbUuid` era un defecto: rompía CA-01 justo con los productos reales,
 * que es el único caso que importa. El nombre NO participa en la decisión
 * (MD 12 §2); sólo se usa para el mensaje.
 */
export function esProductoDisposicionPermitido(
  producto: { id?: unknown; dbUuid?: unknown; clave?: unknown } | null | undefined,
  productosDisposicion: { id?: unknown; dbUuid?: unknown; clave?: unknown }[] | null | undefined,
): boolean {
  if (!producto) return false;
  const lista = Array.isArray(productosDisposicion) ? productosDisposicion : [];
  if (lista.length === 0) return false;

  // Identidades del producto, ya normalizadas y sin vacíos.
  const propias = new Set(
    [producto.dbUuid, producto.id, producto.clave].map(norm).filter(Boolean),
  );
  if (propias.size === 0) return false;

  return lista.some(p =>
    [p?.dbUuid, p?.id, p?.clave].map(norm).filter(Boolean).some(v => propias.has(v)),
  );
}

// ═══════════════════════════════════════════════════════════════════
// 4 — Monto Garantizado (MD 00 / MD 05 / MD 08)
// ═══════════════════════════════════════════════════════════════════

/** Qué tope terminó fijando el Monto Garantizado. */
export type TopeMontoGarantizado = 'cobertura' | 'maximo-sublinea' | 'disponible-global';

export interface ResultadoMontoGarantizado {
  montoGarantizado: number;
  /** Producto de `MontoElegible × %Cobertura`, antes de aplicar topes. */
  porCobertura: number;
  /** Cuál de los tres términos ganó el MIN — se le explica al usuario. */
  tope: TopeMontoGarantizado;
  /** true si el disponible de la Línea Global fue el que limitó. */
  limitadoPorDisponible: boolean;
}

/**
 * `MontoGarantizado = MIN(MontoElegible × %Cobertura, MontoMaximoSublinea, DisponibleLineaGlobal)`
 *
 * Es la regla financiera principal del MD 00 y se repite en MD 05 y MD 08, así
 * que vive en un solo lugar. Devuelve además **qué** tope aplicó: sin eso, un
 * usuario que pidió 50% de cobertura y recibió menos no tiene forma de saber si
 * lo limitó el máximo del producto o el disponible de la línea, que son dos
 * acciones distintas (bajar el monto de la carta vs. esperar una liberación).
 *
 * Un tope en 0 o ausente se ignora en vez de aterrizar el resultado en 0: en
 * Taller de Producto un máximo sin capturar significa "sin tope", no "nada
 * garantizable". El disponible sí cuenta cuando es 0 — ahí un 0 es un 0 real.
 */
export function calcularMontoGarantizado(params: {
  montoElegible: unknown;
  porcentajeCobertura: unknown;
  montoMaximoSublinea?: unknown;
  disponibleLineaGlobal: unknown;
}): ResultadoMontoGarantizado {
  const elegible = Math.max(0, num(params.montoElegible));
  const pct = Math.max(0, num(params.porcentajeCobertura));
  const maxSub = num(params.montoMaximoSublinea);
  const disponible = Math.max(0, num(params.disponibleLineaGlobal));

  const porCobertura = elegible * (pct / 100);

  let montoGarantizado = porCobertura;
  let tope: TopeMontoGarantizado = 'cobertura';

  if (maxSub > 0 && maxSub < montoGarantizado) {
    montoGarantizado = maxSub;
    tope = 'maximo-sublinea';
  }
  if (disponible < montoGarantizado) {
    montoGarantizado = disponible;
    tope = 'disponible-global';
  }

  return {
    montoGarantizado: redondear(montoGarantizado),
    porCobertura: redondear(porCobertura),
    tope,
    limitadoPorDisponible: tope === 'disponible-global',
  };
}

// ═══════════════════════════════════════════════════════════════════
// 5 — Saldos de la Línea Global (MD 08)
// ═══════════════════════════════════════════════════════════════════

export interface SubLineaActiva {
  sublineaId: string;
  montoGarantizado: number;
}

export interface SaldosLineaGlobal {
  autorizado: number;
  /** Suma del Monto Garantizado de las SubLíneas vigentes. */
  contingente: number;
  /** `Autorizado - Contingente`. Nunca negativo. */
  disponible: number;
  /** true si el contingente excede el autorizado — dato corrupto, no un saldo. */
  sobregirado: boolean;
}

/**
 * MD 08 — Autorizado / Contingente / Disponible de una Línea Global.
 *
 * **Decisión de diseño: el Disponible se DERIVA, no se almacena.**
 *
 * El mecanismo que ya existe para BANOBRAS guarda un único número decreciente
 * (`saldo_actual`) y lo resta en cada disposición aplicada. Para la Línea Global
 * eso no alcanza: el MD 08 necesita tres cantidades a la vez (Autorizado fijo,
 * Contingente creciente, Disponible decreciente) y el MD 09 —fuera de este
 * alcance— hará que el Contingente **baje** al vencer una SubLínea sin reclamo.
 * Un contador decreciente no sabe volver atrás sin arriesgar doble conteo.
 *
 * Derivándolo de las SubLíneas vigentes, en cambio: liberar una SubLínea es
 * quitarla del conjunto, el Disponible se recalcula solo, y la operación es
 * idempotente por construcción (RN-02 de REQ-24: restar dos veces le quita
 * crédito real al cliente). El precio es tener que leer las SubLíneas para
 * pintar el saldo, que es exactamente lo que ya hace `DisposicionesTab`.
 */
export function derivarSaldosLineaGlobal(params: {
  montoAutorizado: unknown;
  sublineasActivas: SubLineaActiva[] | null | undefined;
}): SaldosLineaGlobal {
  const autorizado = Math.max(0, num(params.montoAutorizado));
  const activas = Array.isArray(params.sublineasActivas) ? params.sublineasActivas : [];

  // Se deduplica por id: la misma SubLínea contada dos veces infla el
  // contingente y le come disponible real a la línea.
  const vistas = new Set<string>();
  let contingente = 0;
  for (const s of activas) {
    const id = String(s?.sublineaId ?? '');
    if (!id || vistas.has(id)) continue;
    vistas.add(id);
    contingente += Math.max(0, num(s?.montoGarantizado));
  }
  contingente = redondear(contingente);

  return {
    autorizado,
    contingente,
    disponible: redondear(Math.max(0, autorizado - contingente)),
    sobregirado: contingente > autorizado + 0.005,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 6 — Motor de reglas de elegibilidad (MD 06)
// ═══════════════════════════════════════════════════════════════════

/** Clave estable de cada regla. Se usa en mensajes y pruebas, no el texto. */
export type ClaveRegla =
  | 'linea-global-activa'
  | 'producto-disposicion-permitido'
  | 'monto-en-rango'
  | 'disponible-suficiente'
  | 'cobertura-permitida'
  | 'plazo-permitido'
  | 'moneda-permitida'
  | 'tipo-carta-permitido'
  | 'ordenante-registrado'
  | 'beneficiario-registrado'
  | 'no-sobregiro';

export interface ResultadoRegla {
  clave: ClaveRegla;
  etiqueta: string;
  cumple: boolean;
  /** Por qué falló, con los valores concretos. Vacío si cumple. */
  detalle: string;
}

export interface ResultadoValidacion {
  elegible: boolean;
  reglas: ResultadoRegla[];
  cumplidas: ResultadoRegla[];
  incumplidas: ResultadoRegla[];
  /** Monto Garantizado resuelto con los topes del producto y de la línea. */
  garantia: ResultadoMontoGarantizado;
  /** Estatus que corresponde según el resultado y la modalidad del producto. */
  estatusSugerido: string;
}

/** Parte Relacionada reducida a lo que la validación necesita (MD 05). */
export interface ParteRelacionadaMin {
  tipoRelacion?: string;
  rolAsignado?: string;
}

export interface ContextoSubLinea {
  /** El producto hijo seleccionado, tal como lo devuelve Taller de Producto. */
  producto: any;
  /** Productos Disposición configurados en la Línea Global padre. */
  productosDisposicionLineaGlobal: { id?: unknown; clave?: unknown }[] | null | undefined;
  lineaGlobal: {
    estatus?: unknown;
    montoAutorizado?: unknown;
    /** Vencimiento de la Línea Global, para la regla de fecha del MD 05. */
    fechaVencimiento?: unknown;
  };
  /** SubLíneas ya vigentes de la línea — definen contingente y disponible. */
  sublineasActivas: SubLineaActiva[] | null | undefined;
  /** Datos capturados en Términos y Condiciones, Bloque B y C (MD 05). */
  carta: {
    tipoCarta?: unknown;
    montoCarta?: unknown;
    montoElegible?: unknown;
    moneda?: unknown;
    porcentajeCobertura?: unknown;
    /** Plazo en días. */
    plazoDias?: unknown;
    fechaVencimiento?: unknown;
  };
  partesRelacionadas: ParteRelacionadaMin[] | null | undefined;
}

/** ¿Hay una parte con ese rol? Compara rol asignado o tipo de relación. */
function tieneRol(partes: ParteRelacionadaMin[], rol: string): boolean {
  const objetivo = norm(rol);
  // El rol se captura en `rolAsignado` (tabs/PartesRelacionadasTab) o viaja como
  // `tipoRelacion` cuando se hereda de Personas Relacionadas del cliente.
  return partes.some(p => {
    const a = norm(p?.rolAsignado);
    const b = norm(p?.tipoRelacion);
    return a === objetivo || b === objetivo
      || (objetivo.includes('ordenante') && (a.includes('ordenante') || b.includes('ordenante')))
      || (objetivo.includes('beneficiario') && (a.includes('beneficiario') || b.includes('beneficiario')));
  });
}

/**
 * MD 06 §Reglas mínimas para demo — las 10 reglas, más la de no sobregiro que
 * el MD 08 §5 vuelve a exigir en la transacción de activación.
 *
 * Es UNA sola función para los dos productos a propósito. Automática la corre
 * para resolver sin fases (MD 06) y Selectiva la vuelve a correr al autorizar la
 * Fase 5 (MD 07 §Fase 5 y CA-13): si el Disponible cambió durante la
 * Originación, la activación tiene que bloquearse, y la única forma de
 * garantizar que ambos caminos apliquen el mismo criterio es que sea el mismo
 * código. Duplicarla es como se acaba con una Automática más estricta que una
 * Selectiva, o al revés.
 *
 * Devuelve TODAS las reglas evaluadas —cumplidas e incumplidas— porque el MD 06
 * §Resultado de validación pide mostrar ambas listas: un rechazo que sólo dice
 * "no elegible" no le sirve al analista.
 */
export function validarSubLinea(ctx: ContextoSubLinea): ResultadoValidacion {
  const p = parametrosSubLinea(ctx.producto);
  const partes = Array.isArray(ctx.partesRelacionadas) ? ctx.partesRelacionadas : [];
  const saldos = derivarSaldosLineaGlobal({
    montoAutorizado: ctx.lineaGlobal?.montoAutorizado,
    sublineasActivas: ctx.sublineasActivas,
  });

  const garantia = calcularMontoGarantizado({
    montoElegible: ctx.carta?.montoElegible,
    porcentajeCobertura: ctx.carta?.porcentajeCobertura,
    montoMaximoSublinea: p.montoMaximo,
    disponibleLineaGlobal: saldos.disponible,
  });

  const montoCarta = num(ctx.carta?.montoCarta);
  const cobertura = num(ctx.carta?.porcentajeCobertura);
  const plazo = num(ctx.carta?.plazoDias);
  const moneda = String(ctx.carta?.moneda ?? '').trim();
  const tipoCarta = String(ctx.carta?.tipoCarta ?? '').trim();
  const fmt = (n: number) => n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const reglas: ResultadoRegla[] = [];
  const add = (clave: ClaveRegla, etiqueta: string, cumple: boolean, detalle = '') =>
    reglas.push({ clave, etiqueta, cumple, detalle: cumple ? '' : detalle });

  // 1 — Línea Global ACTIVA
  const estatusLinea = norm(ctx.lineaGlobal?.estatus);
  const lineaActiva = estatusLinea === norm(ESTADO_ACTIVA);
  add(
    'linea-global-activa',
    'Línea Global activa',
    p.requiereLineaGlobalActiva ? lineaActiva : true,
    `La Línea Global está en estatus "${String(ctx.lineaGlobal?.estatus ?? '—')}" y el producto exige que esté ACTIVA.`,
  );

  // 2 — Producto relacionado como Producto Disposición
  const permitido = esProductoDisposicionPermitido(ctx.producto, ctx.productosDisposicionLineaGlobal);
  add(
    'producto-disposicion-permitido',
    'Producto configurado como Producto Disposición',
    p.productoPadreRequerido ? permitido : true,
    MSG_PRODUCTO_NO_PERMITIDO,
  );

  // 3 — Monto dentro del rango del producto. El monto que se valida es el de la
  // CARTA (MD 04: `MontoSolicitado = Monto total de la Carta`), no el garantizado.
  const bajoMinimo = p.montoMinimo > 0 && montoCarta < p.montoMinimo;
  const sobreMaximo = p.montoMaximo > 0 && montoCarta > p.montoMaximo;
  add(
    'monto-en-rango',
    'Monto de la Carta dentro del rango del producto',
    montoCarta > 0 && !bajoMinimo && !sobreMaximo,
    montoCarta <= 0
      ? 'No se capturó el Monto de la Carta.'
      : bajoMinimo
        ? `El Monto de la Carta (${fmt(montoCarta)}) es menor al mínimo configurado (${fmt(p.montoMinimo)}).`
        : `El Monto de la Carta (${fmt(montoCarta)}) excede el máximo configurado (${fmt(p.montoMaximo)}).`,
  );

  // 4 — Disponible suficiente. Se compara contra el Monto Garantizado, no contra
  // el de la carta: la Línea Global sólo se consume por lo garantizado (MD 00).
  add(
    'disponible-suficiente',
    'Disponible suficiente en la Línea Global',
    garantia.montoGarantizado > 0 && !garantia.limitadoPorDisponible,
    garantia.porCobertura <= 0
      ? 'No hay Monto Garantizado que respaldar: revise Monto Elegible y % Cobertura.'
      : `El Monto Garantizado requerido (${fmt(garantia.porCobertura)}) excede el Disponible de la Línea Global (${fmt(saldos.disponible)}).`,
  );

  // 5 — Cobertura dentro del rango configurado
  const sinRangoCobertura = p.coberturaMinima <= 0 && p.coberturaMaxima <= 0;
  const coberturaOk = cobertura > 0
    && (p.coberturaMinima <= 0 || cobertura >= p.coberturaMinima)
    && (p.coberturaMaxima <= 0 || cobertura <= p.coberturaMaxima);
  add(
    'cobertura-permitida',
    '% de Cobertura dentro del rango configurado',
    coberturaOk,
    cobertura <= 0
      ? 'No se capturó el % de Cobertura.'
      : sinRangoCobertura
        ? 'El producto no tiene Cobertura y Comisiones 2º Piso configurada.'
        : `El % de Cobertura (${cobertura}%) está fuera del rango configurado (${p.coberturaMinima}% – ${p.coberturaMaxima}%).`,
  );

  // 6 — Plazo permitido
  const plazoOk = plazo > 0
    && (p.plazoMinimo <= 0 || plazo >= p.plazoMinimo)
    && (p.plazoMaximo <= 0 || plazo <= p.plazoMaximo);
  add(
    'plazo-permitido',
    'Plazo dentro del rango configurado',
    plazoOk,
    plazo <= 0
      ? 'No se capturó el plazo de la Carta.'
      : `El plazo (${plazo} días) está fuera del rango configurado (${p.plazoMinimo} – ${p.plazoMaximo} días).`,
  );

  // 7 — Moneda permitida
  const monedaOk = !!moneda
    && (p.monedasPermitidas.length === 0
      || p.monedasPermitidas.some(m => norm(m) === norm(moneda)));
  add(
    'moneda-permitida',
    'Moneda permitida por el producto',
    monedaOk,
    !moneda
      ? 'No se capturó la moneda.'
      : `La moneda ${moneda} no está entre las permitidas (${p.monedasPermitidas.join(', ')}).`,
  );

  // 8 — Tipo de Carta permitido
  const tipoOk = !!tipoCarta
    && p.tiposCartaPermitidos.some(t => norm(t) === norm(tipoCarta));
  add(
    'tipo-carta-permitido',
    'Tipo de Carta permitido por el producto',
    tipoOk,
    !tipoCarta
      ? 'No se capturó el Tipo de Carta.'
      : `El producto no permite cartas de tipo ${tipoCarta} (permitidos: ${p.tiposCartaPermitidos.join(', ')}).`,
  );

  // 9 y 10 — Partes Relacionadas mínimas (MD 05 §Reglas demo)
  add(
    'ordenante-registrado',
    'Ordenante / Acreditado Final registrado',
    tieneRol(partes, ROL_ORDENANTE),
    `No hay ninguna Parte Relacionada con rol "${ROL_ORDENANTE}".`,
  );
  add(
    'beneficiario-registrado',
    'Beneficiario de la Carta registrado',
    tieneRol(partes, ROL_BENEFICIARIO_CARTA),
    `No hay ninguna Parte Relacionada con rol "${ROL_BENEFICIARIO_CARTA}".`,
  );

  // 11 — No sobregiro (MD 08 §5). Con el disponible derivado esto sólo puede
  // fallar si la línea ya venía sobregirada; se valida igual porque el MD 08 lo
  // pide dentro de la transacción y un dato corrupto no debe activar nada.
  add(
    'no-sobregiro',
    'La operación no sobregira la Línea Global',
    p.permiteSobregiro ? true : !saldos.sobregirado,
    `El Contingente vigente (${fmt(saldos.contingente)}) ya excede el Monto Autorizado (${fmt(saldos.autorizado)}).`,
  );

  const cumplidas = reglas.filter(r => r.cumple);
  const incumplidas = reglas.filter(r => !r.cumple);
  const elegible = incumplidas.length === 0;

  // MD 06 §Si no cumple / MD 02 §Resultado — el estatus de rechazo distingue la
  // modalidad: una Automática que no califica NO se convierte en Selectiva
  // (CA-08), y decirlo en el estatus es lo que evita que alguien lo intente.
  const estatusSugerido = elegible
    ? ESTADO_ACTIVA
    : p.modalidad === MODALIDAD_AUTOMATICA
      ? ESTADO_NO_ELEGIBLE
      : ESTADO_RECHAZADA;

  return { elegible, reglas, cumplidas, incumplidas, garantia, estatusSugerido };
}
