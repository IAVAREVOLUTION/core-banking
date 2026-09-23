/**
 * motorEstadoCuentaTDC — ESPECIFICACIÓN 6, el motor puro.
 *
 * Decide QUÉ entra al Estado de Cuenta: qué periodo, qué movimientos, qué
 * pagos y con qué cifras. No lee, no escribe, no genera PDF. Igual que los
 * motores de las especificaciones 1 a 5, es testeable sin base de datos.
 *
 * ── Las tres decisiones de REQ-31 ────────────────────────────────────────
 * D2  `PagoNoGeneraIntereses` = CargosPeriodo + SaldoAnterior. Es el importe
 *     que, cubierto por completo, evita la generación de intereses: todo lo
 *     que se debe al corte, sin descontar lo ya pagado.
 * D3  `SaldoAlCorte` = SaldoAnterior + CargosPeriodo − PagosAplicados.
 *     Es el SALDO, no el importe facturado: el Aviso conserva su
 *     `montoTotalPagar` intacto y sigue siendo la base de la póliza de
 *     CORTE_PERIODO (ESPEC 5 §20). Como los pagos considerados son los de
 *     toda la Línea hasta la Fecha Estado (§9), este saldo puede quedar en
 *     negativo cuando el cliente pagó de más: eso es saldo a favor, no un
 *     error, y por eso no se rechaza.
 *
 * ── H-1: el Aviso de Vencimiento ES la CxC ───────────────────────────────
 * §11 los dibuja como entidades distintas; en este sistema el cierre de corte
 * produce la CxC y esa CxC es el Aviso. Por eso §17.4 sólo puede dispararse
 * cuando la CxC del periodo está Cancelada.
 */

/** Dos decimales, sin sorpresas de punto flotante. */
export const money = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/** Normaliza cualquier fecha a 'YYYY-MM-DD'; las de ese formato se comparan como texto. */
export const aISO = (v: unknown): string => {
  const t = String(v ?? '').trim();
  if (!t) return '';
  const dmy = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return t.slice(0, 10);
};

// ─────────────────────────────────────────────────────────────────────────
// Entradas
// ─────────────────────────────────────────────────────────────────────────

/** Un concepto del Detail del Aviso (§11). */
export interface ConceptoAviso {
  id: string;
  claveConcepto: string;
  nombreConcepto: string;
  monto: number;
  pagoTotal?: number;
  saldoPendiente?: number;
  ordenPrelacion?: number;
  estatusPago?: string;
}

/**
 * Un Aviso de Vencimiento = una CxC = un periodo de corte (H-1).
 * Tal como lo devuelve `obtener_avisos_tdc`.
 */
export interface AvisoPeriodo {
  id: string;
  folio?: string;
  fechaInicio: string;
  fechaFin: string;
  /** §17 de la ESPEC 3: FechaDocumento = FechaFin = la fecha de CORTE. */
  fechaDocumento: string;
  fechaVencimiento: string;
  montoTotalPagar: number;
  montoMinimoPagar: number;
  pagoTotal?: number;
  saldoPendiente?: number;
  cantidadCargos?: number;
  moneda?: string;
  estatus?: string;
  detalle: ConceptoAviso[];
}

/** Un movimiento/cargo de la línea, como lo devuelve `obtener_cargos_linea`. */
export interface MovimientoPeriodo {
  id: string;
  clave: string;
  nombre?: string;
  naturaleza: 'Cargo' | 'Abono' | string;
  monto: number;
  fecha: string;
}

/** Una aplicación de pago ya confirmada (§9). */
export interface PagoAplicado {
  id: string;
  idCxC?: string;
  idProceso?: string;
  referencia?: string;
  montoAplicado: number;
  fechaPago: string;
  /** Estatus del proceso de aplicación; sólo 'OK'/'Aplicado'/'Confirmado' cuentan. */
  estatus?: string;
}

/** Lo que ya existe en el historial, para §16 y §12 paso 8. */
export interface EstadoCuentaPrevio {
  id: string;
  fechaEstado: string;
  fechaCorte: string;
  saldoAlCorte: number;
  estatus?: string;
}

export interface DatosLinea {
  idLinea: string;
  idCliente?: string;
  idProducto?: string;
  numeroLinea?: string;
  limiteAutorizado: number;
  saldoDisponible: number;
  moneda?: string;
  /** Estatus de la Línea, tal como lo muestra el encabezado de Cartera TDC. */
  estatus?: string;
}

export interface ParamsEstadoCuenta {
  linea: DatosLinea;
  /** Capturada por el usuario (§4.1). */
  fechaEstado: string;
  /** Hoy, para §17.2. Se inyecta para que las pruebas no dependan del reloj. */
  fechaActual: string;
  avisos: AvisoPeriodo[];
  movimientos: MovimientoPeriodo[];
  pagos: PagoAplicado[];
  estadosPrevios?: EstadoCuentaPrevio[];
}

// ─────────────────────────────────────────────────────────────────────────
// Salidas
// ─────────────────────────────────────────────────────────────────────────

export type CodigoErrorEstadoCuenta =
  | 'FECHA_REQUERIDA'
  | 'FECHA_FUTURA'
  | 'DUPLICADO'
  | 'SIN_PERIODO'
  | 'SIN_AVISO'
  | 'INCONSISTENTE';

/** Los campos de §14 que dependen del cálculo. */
export interface SnapshotEstadoCuenta {
  limiteAutorizado: number;
  saldoAnterior: number;
  cargosPeriodo: number;
  pagosPeriodo: number;
  saldoAlCorte: number;
  saldoConsumeLinea: number;
  creditoDisponible: number;
  pagoMinimo: number;
  /** D2 — CargosPeriodo + SaldoAnterior: lo que hay que cubrir para no generar intereses. */
  pagoNoGeneraIntereses: number;
  /**
   * false sólo en los Estados de Cuenta emitidos ANTES de que se definiera la
   * fórmula: aquéllos guardaron cero. Se conserva para que el historial no
   * presente un cero viejo como si fuera un importe calculado.
   */
  pagoNoGeneraInteresesConfigurado: boolean;
}

export interface ResultadoEstadoCuenta {
  ok: boolean;
  error?: string;
  codigoError?: CodigoErrorEstadoCuenta;
  /** El Aviso/periodo elegido por §7. */
  periodo: AvisoPeriodo | null;
  fechaEstado: string;
  fechaInicioPeriodo: string;
  fechaFinPeriodo: string;
  fechaCorte: string;
  fechaLimitePago: string;
  snapshot: SnapshotEstadoCuenta | null;
  /** §10 — los del periodo, congelados. */
  movimientosPeriodo: MovimientoPeriodo[];
  /** §9 — los aplicados hasta la Fecha Estado. */
  pagosConsiderados: PagoAplicado[];
  /** §12 paso 8. */
  estadoAnterior: EstadoCuentaPrevio | null;
  /** §12 paso 10 — vacío significa que cuadra. */
  descuadres: string[];
}

const SNAPSHOT_VACIO = (): SnapshotEstadoCuenta => ({
  limiteAutorizado: 0, saldoAnterior: 0, cargosPeriodo: 0, pagosPeriodo: 0,
  saldoAlCorte: 0, saldoConsumeLinea: 0, creditoDisponible: 0, pagoMinimo: 0,
  pagoNoGeneraIntereses: 0, pagoNoGeneraInteresesConfigurado: false,
});

const fallo = (
  codigo: CodigoErrorEstadoCuenta,
  mensaje: string,
  fechaEstado: string,
): ResultadoEstadoCuenta => ({
  ok: false, error: mensaje, codigoError: codigo,
  periodo: null, fechaEstado,
  fechaInicioPeriodo: '', fechaFinPeriodo: '', fechaCorte: '', fechaLimitePago: '',
  snapshot: null, movimientosPeriodo: [], pagosConsiderados: [],
  estadoAnterior: null, descuadres: [],
});

// ─────────────────────────────────────────────────────────────────────────
// Piezas
// ─────────────────────────────────────────────────────────────────────────

/** Una CxC cancelada no es un Aviso vigente (H-1 sobre §17.4). */
const estaCancelada = (a: AvisoPeriodo): boolean =>
  String(a.estatus || '').toLowerCase() === 'cancelada';

/**
 * Un Aviso reclasificado (ESPEC 9 §2) ya entregó su saldo a la Línea como el
 * cargo "Saldo Anterior". Sumarlo otra vez al Saldo Anterior del documento lo
 * cobraría dos veces: una por el cargo y otra por el arrastre.
 */
const estaReclasificado = (a: AvisoPeriodo): boolean =>
  String(a.estatus || '').toLowerCase().includes('reclasificaci');

/**
 * §7 — `PeriodoSeleccionado = MAX(FechaCorte) WHERE FechaCorte <= FechaEstado`.
 * Empate de fecha de corte: gana el de vencimiento posterior y, si también
 * empata, el id mayor — para que la elección sea determinista.
 */
export function elegirPeriodo(avisos: AvisoPeriodo[], fechaEstado: string): AvisoPeriodo | null {
  const fe = aISO(fechaEstado);
  const candidatos = (avisos || []).filter(a => {
    const corte = aISO(a.fechaDocumento || a.fechaFin);
    return corte !== '' && corte <= fe;
  });
  if (candidatos.length === 0) return null;

  return candidatos.reduce((mejor, a) => {
    const ca = aISO(a.fechaDocumento || a.fechaFin);
    const cm = aISO(mejor.fechaDocumento || mejor.fechaFin);
    if (ca !== cm) return ca > cm ? a : mejor;
    const va = aISO(a.fechaVencimiento), vm = aISO(mejor.fechaVencimiento);
    if (va !== vm) return va > vm ? a : mejor;
    return String(a.id) > String(mejor.id) ? a : mejor;
  });
}

/** Suma días a una fecha ISO sin que el huso horario mueva el resultado. */
export function sumarDias(iso: string, dias: number): string {
  const f = aISO(iso);
  const m = f.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * La Fecha Estado que corresponde proponer: FechaLímitePago + 1 día.
 *
 * Se emite al día siguiente del vencimiento porque es cuando ya se sabe si el
 * cliente pagó: un documento emitido antes mostraría como impagado algo que
 * todavía está en plazo.
 *
 * Por eso se elige el último corte cuyo límite YA venció —no simplemente el
 * último corte—: si el plazo sigue abierto, el estado que toca emitir es el
 * del periodo anterior. Sin ningún corte vencido se devuelve la fecha actual,
 * para que la pantalla siga siendo usable y sea el usuario quien decida.
 */
export function fechaEstadoSugerida(avisos: AvisoPeriodo[], fechaActual: string): string {
  const hoy = aISO(fechaActual);
  if (!hoy) return '';

  let mejor = '';
  for (const a of avisos || []) {
    if (estaCancelada(a)) continue;
    const propuesta = sumarDias(a.fechaVencimiento, 1);
    if (!propuesta || propuesta > hoy) continue;      // el plazo sigue abierto
    if (propuesta > mejor) mejor = propuesta;
  }
  return mejor || hoy;
}
/** §10 — los movimientos del periodo, por fecha contable. */
export function filtrarMovimientos(
  movimientos: MovimientoPeriodo[],
  fechaInicio: string,
  fechaFin: string,
): MovimientoPeriodo[] {
  const ini = aISO(fechaInicio), fin = aISO(fechaFin);
  return (movimientos || [])
    .filter(m => {
      const f = aISO(m.fecha);
      return f !== '' && f >= ini && f <= fin;
    })
    .sort((a, b) => aISO(a.fecha).localeCompare(aISO(b.fecha)) || String(a.id).localeCompare(String(b.id)));
}

/** §9 — estatus que cuentan como pago confirmado. */
const PAGO_CUENTA = new Set(['ok', 'aplicado', 'confirmado', 'aplicado parcialmente']);

/**
 * §9 — pagos con `FechaPago <= FechaEstado` y estatus aplicado/confirmado.
 *
 * `cxcExcluidas` saca los pagos aplicados a Avisos ya RECLASIFICADOS. Ese
 * descuento ya está hecho: al reclasificar, lo que se reinyectó a la Línea fue
 * el saldo PENDIENTE del Aviso —es decir, su importe menos lo pagado—, así que
 * volver a restar esos pagos aquí los descontaría dos veces y hundiría el
 * Saldo al Corte.
 */
export function filtrarPagos(
  pagos: PagoAplicado[],
  fechaEstado: string,
  cxcExcluidas?: Set<string>,
): PagoAplicado[] {
  const fe = aISO(fechaEstado);
  return (pagos || [])
    .filter(p => {
      if (cxcExcluidas?.size && p.idCxC && cxcExcluidas.has(String(p.idCxC))) return false;
      const f = aISO(p.fechaPago);
      if (f === '' || f > fe) return false;
      // Sin estatus explícito se asume aplicado: el lector ya filtra resultado='OK'.
      const e = String(p.estatus ?? 'OK').toLowerCase();
      return PAGO_CUENTA.has(e);
    })
    .sort((a, b) => aISO(a.fechaPago).localeCompare(aISO(b.fechaPago)) || String(a.id).localeCompare(String(b.id)));
}

/**
 * §12 paso 8 — el Estado de Cuenta inmediatamente anterior al periodo actual.
 * Sirve para el encadenamiento del documento, no para recalcular nada.
 */
export function estadoCuentaAnterior(
  previos: EstadoCuentaPrevio[] | undefined,
  fechaCorte: string,
): EstadoCuentaPrevio | null {
  const fc = aISO(fechaCorte);
  const antes = (previos || []).filter(
    e => String(e.estatus || 'GENERADO').toUpperCase() === 'GENERADO' && aISO(e.fechaCorte) < fc,
  );
  if (antes.length === 0) return null;
  return antes.reduce((mejor, e) => (aISO(e.fechaCorte) > aISO(mejor.fechaCorte) ? e : mejor));
}

/**
 * D3 — `SaldoAnterior` es lo que quedaba pendiente de los cortes previos.
 * El corte no lo arrastra (H-3), así que se arma sumando el saldo de las CxC
 * anteriores a este corte. No se recalcula desde movimientos.
 *
 * Se excluyen las canceladas y las RECLASIFICADAS: éstas últimas ya pusieron
 * su saldo en la Línea como cargo, y contarlas aquí lo duplicaría.
 */
export function saldoAnteriorDeAvisos(avisos: AvisoPeriodo[], fechaCorte: string): number {
  const fc = aISO(fechaCorte);
  return money(
    (avisos || [])
      .filter(a => !estaCancelada(a)
                && !estaReclasificado(a)
                && aISO(a.fechaDocumento || a.fechaFin) < fc)
      .reduce((acc, a) => {
        const saldo = a.saldoPendiente != null
          ? Number(a.saldoPendiente)
          : Number(a.montoTotalPagar || 0) - Number(a.pagoTotal || 0);
        return acc + (Number.isFinite(saldo) ? saldo : 0);
      }, 0),
  );
}

/**
 * §12 paso 10 — validaciones financieras.
 *
 * La única igualdad exigible hoy es la de §48 de la ESPEC 4 trasladada al
 * Aviso: el encabezado debe valer lo que suma su Detail. La identidad
 * `SaldoAnterior + Cargos − Pagos = SaldoAlCorte` NO se verifica porque el
 * cierre no arrastra saldo anterior (H-3): exigirla reprobaría cortes
 * correctos.
 */
export function validarConsistencia(
  periodo: AvisoPeriodo,
  snapshot: SnapshotEstadoCuenta,
): string[] {
  const problemas: string[] = [];

  const sumaDetalle = money((periodo.detalle || []).reduce((a, d) => a + (Number(d.monto) || 0), 0));
  if ((periodo.detalle || []).length > 0 && sumaDetalle !== money(periodo.montoTotalPagar)) {
    problemas.push(
      `El Aviso ${periodo.folio || periodo.id} vale ${money(periodo.montoTotalPagar)} pero su detalle suma ${sumaDetalle}.`,
    );
  }
  // Un Saldo al Corte negativo es saldo A FAVOR del cliente —pagó más de lo
  // que debía— y debe poder emitirse. Rechazarlo impediría generar el estado
  // justo a quien está al corriente.

  // El Pago Mínimo se compara contra lo FACTURADO más lo que venía pendiente,
  // no contra el saldo ya neteado de pagos: si no, a un cliente que liquidó le
  // saldría "el mínimo excede el saldo" y no podría emitir su estado.
  if (snapshot.pagoMinimo > money(periodo.montoTotalPagar + snapshot.saldoAnterior)) {
    problemas.push('El Pago Mínimo es mayor que el saldo exigible del periodo.');
  }
  if (snapshot.creditoDisponible > snapshot.limiteAutorizado) {
    problemas.push('El Crédito Disponible excede el Límite Autorizado.');
  }
  if (snapshot.saldoConsumeLinea < 0) problemas.push('El saldo que consume línea no puede ser negativo.');

  return problemas;
}

// ─────────────────────────────────────────────────────────────────────────
// §23 — el proceso completo, en orden
// ─────────────────────────────────────────────────────────────────────────

export function generarEstadoCuenta(params: ParamsEstadoCuenta): ResultadoEstadoCuenta {
  const fechaEstado = aISO(params.fechaEstado);
  const fechaActual = aISO(params.fechaActual);

  // §17.1
  if (!fechaEstado) return fallo('FECHA_REQUERIDA', 'Debe capturar la Fecha Estado.', '');

  // §17.2
  if (fechaActual && fechaEstado > fechaActual) {
    return fallo('FECHA_FUTURA', 'La Fecha Estado no puede ser mayor a la fecha actual.', fechaEstado);
  }

  // §16 — el duplicado se valida antes de trabajar. La base lo vuelve a
  // impedir con un índice único: esto es el aviso amable, no la garantía.
  const yaExiste = (params.estadosPrevios || []).some(
    e => aISO(e.fechaEstado) === fechaEstado && String(e.estatus || 'GENERADO').toUpperCase() !== 'ERROR',
  );
  if (yaExiste) {
    return fallo('DUPLICADO', `Ya existe un Estado de Cuenta generado para la fecha ${fechaEstado}.`, fechaEstado);
  }

  // §7 / §17.3
  const periodo = elegirPeriodo(params.avisos || [], fechaEstado);
  if (!periodo) {
    return fallo(
      'SIN_PERIODO',
      'No existe un periodo de corte disponible para la Fecha Estado seleccionada.',
      fechaEstado,
    );
  }

  // §17.4, reinterpretado por H-1: el Aviso es la CxC, así que el único modo
  // de tener corte sin Aviso vigente es que esté cancelada.
  if (estaCancelada(periodo)) {
    return fallo('SIN_AVISO', 'No existe un Aviso de Vencimiento asociado al periodo seleccionado.', fechaEstado);
  }

  const fechaInicioPeriodo = aISO(periodo.fechaInicio);
  const fechaFinPeriodo = aISO(periodo.fechaFin);
  const fechaCorte = aISO(periodo.fechaDocumento || periodo.fechaFin);
  const fechaLimitePago = aISO(periodo.fechaVencimiento);

  const movimientosPeriodo = filtrarMovimientos(params.movimientos, fechaInicioPeriodo, fechaFinPeriodo);

  // Los Avisos reclasificados ya entregaron su saldo NETO a la Línea: sus
  // pagos no vuelven a restarse (ver `filtrarPagos`).
  const cxcReclasificadas = new Set(
    (params.avisos || []).filter(estaReclasificado).map(a => String(a.id)),
  );
  const pagosConsiderados = filtrarPagos(params.pagos, fechaEstado, cxcReclasificadas);
  const estadoAnterior = estadoCuentaAnterior(params.estadosPrevios, fechaCorte);

  const cargosPeriodo = money(
    movimientosPeriodo.filter(m => m.naturaleza === 'Cargo').reduce((a, m) => a + (Number(m.monto) || 0), 0),
  );
  const pagosPeriodo = money(pagosConsiderados.reduce((a, p) => a + (Number(p.montoAplicado) || 0), 0));

  const limiteAutorizado = money(params.linea.limiteAutorizado);
  const creditoDisponible = money(params.linea.saldoDisponible);

  // D3 — del estado anterior si lo hay; si no, de las CxC previas.
  // Se calcula aparte porque D2 lo necesita para el pago que no genera intereses.
  const saldoAnterior = estadoAnterior
    ? money(estadoAnterior.saldoAlCorte)
    : saldoAnteriorDeAvisos(params.avisos || [], fechaCorte);

  const snapshot: SnapshotEstadoCuenta = {
    limiteAutorizado,
    saldoAnterior,
    cargosPeriodo,
    pagosPeriodo,
    // D3 — la identidad del estado de cuenta. Ojo: NO es el importe facturado
    // del Aviso (`montoTotalPagar`); ése sigue siendo la base de la póliza de
    // CORTE_PERIODO (ESPEC 5 §20). Aquí se describe el SALDO, que los pagos
    // posteriores al corte reducen.
    saldoAlCorte: money(saldoAnterior + cargosPeriodo - pagosPeriodo),
    saldoConsumeLinea: money(limiteAutorizado - creditoDisponible),
    creditoDisponible,
    pagoMinimo: money(periodo.montoMinimoPagar),
    // D2 — lo que se debe al corte: los cargos del periodo más lo que venía
    // pendiente. NO se descuenta lo ya pagado: el importe describe el total
    // que evita intereses, no el faltante a esta fecha.
    pagoNoGeneraIntereses: money(cargosPeriodo + saldoAnterior),
    pagoNoGeneraInteresesConfigurado: true,
  };

  const descuadres = validarConsistencia(periodo, snapshot);

  return {
    ok: descuadres.length === 0,
    error: descuadres.length > 0 ? descuadres[0] : undefined,
    codigoError: descuadres.length > 0 ? 'INCONSISTENTE' : undefined,
    periodo,
    fechaEstado,
    fechaInicioPeriodo,
    fechaFinPeriodo,
    fechaCorte,
    fechaLimitePago,
    // Se devuelve aun con descuadres: la pantalla debe poder mostrar QUÉ no cuadra.
    snapshot,
    movimientosPeriodo,
    pagosConsiderados,
    estadoAnterior,
    descuadres,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Placeholders de la plantilla (§11 del Taller de Producto)
//
// Ningún importe se calcula en la plantilla (CA-27): todo llega resuelto.
// ─────────────────────────────────────────────────────────────────────────

const fmtMoney = (n: number, moneda = 'MXN'): string =>
  `$${money(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`.trim();

const fmtFecha = (iso: string): string => {
  const m = aISO(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : aISO(iso);
};

export function construirDatosEstadoCuenta(
  r: ResultadoEstadoCuenta,
  linea: DatosLinea,
  extra: { cliente?: string; producto?: string; usuario?: string; fechaGeneracion?: string } = {},
): Record<string, string> {
  const s = r.snapshot || SNAPSHOT_VACIO();
  const moneda = linea.moneda || r.periodo?.moneda || 'MXN';

  return {
    NUMERO_LINEA: linea.numeroLinea || linea.idLinea || '',
    ID_LINEA: linea.idLinea || '',
    CLIENTE: extra.cliente || '',
    CLIENTE_ID: linea.idCliente || '',
    PRODUCTO: extra.producto || '',
    MONEDA: moneda,
    ESTATUS_LINEA: linea.estatus || '',
    FOLIO_AVISO: r.periodo?.folio || '',

    FECHA_INICIO_PERIODO: fmtFecha(r.fechaInicioPeriodo),
    FECHA_FIN_PERIODO: fmtFecha(r.fechaFinPeriodo),
    PERIODO: `${fmtFecha(r.fechaInicioPeriodo)} al ${fmtFecha(r.fechaFinPeriodo)}`,
    FECHA_CORTE: fmtFecha(r.fechaCorte),
    FECHA_LIMITE_PAGO: fmtFecha(r.fechaLimitePago),
    FECHA_ESTADO: fmtFecha(r.fechaEstado),
    FECHA_GENERACION: extra.fechaGeneracion || new Date().toLocaleString('es-MX'),

    LIMITE_AUTORIZADO: fmtMoney(s.limiteAutorizado, moneda),
    SALDO_ANTERIOR: fmtMoney(s.saldoAnterior, moneda),
    CARGOS_PERIODO: fmtMoney(s.cargosPeriodo, moneda),
    PAGOS_PERIODO: fmtMoney(s.pagosPeriodo, moneda),
    SALDO_AL_CORTE: fmtMoney(s.saldoAlCorte, moneda),
    SALDO_CONSUME_LINEA: fmtMoney(s.saldoConsumeLinea, moneda),
    CREDITO_DISPONIBLE: fmtMoney(s.creditoDisponible, moneda),
    PAGO_MINIMO: fmtMoney(s.pagoMinimo, moneda),
    // D2 — se rotula, no se inventa.
    PAGO_NO_GENERA_INTERESES: s.pagoNoGeneraInteresesConfigurado
      ? fmtMoney(s.pagoNoGeneraIntereses, moneda)
      : 'No configurado',

    USUARIO: extra.usuario || 'Sistema',
    TOTAL_MOVIMIENTOS: String(r.movimientosPeriodo.length),
    TOTAL_PAGOS: String(r.pagosConsiderados.length),
    TABLA_MOVIMIENTOS: tablaMovimientos(r.movimientosPeriodo, moneda),
    TABLA_PAGOS: tablaPagos(r.pagosConsiderados, moneda),
    TABLA_CONCEPTOS: tablaConceptos(r.periodo?.detalle || [], moneda),
    TABLA_DESGLOSE: tablaDesglose(r.movimientosPeriodo, moneda),
  };
}

/**
 * Agrupa los cargos del periodo por clave de concepto.
 *
 * Sustituye al desglose fijo —intereses, comisiones, IVA, disposiciones— que
 * suele traer un estado de cuenta: clasificar cada clave en esas categorías
 * exigiría un mapeo que el producto no configura hoy, y etiquetar a ojo
 * produciría un documento que miente. Agrupar por la clave real dice lo mismo
 * sin inventar nada, y se adapta solo a los conceptos que cada producto use.
 */
export function agruparCargosPorConcepto(
  movs: MovimientoPeriodo[],
): Array<{ clave: string; nombre: string; cantidad: number; total: number }> {
  const mapa = new Map<string, { clave: string; nombre: string; cantidad: number; total: number }>();
  for (const m of movs) {
    if (m.naturaleza !== 'Cargo') continue;
    const clave = m.clave || '(sin clave)';
    const actual = mapa.get(clave) || { clave, nombre: m.nombre || '', cantidad: 0, total: 0 };
    actual.cantidad += 1;
    actual.total = money(actual.total + (Number(m.monto) || 0));
    if (!actual.nombre && m.nombre) actual.nombre = m.nombre;
    mapa.set(clave, actual);
  }
  return [...mapa.values()].sort((a, b) => b.total - a.total || a.clave.localeCompare(b.clave));
}

const fila = (celdas: string[]): string =>
  `<tr>${celdas.map(c => `<td style="padding:4px 8px;border-bottom:1px solid #ddd">${c}</td>`).join('')}</tr>`;

const tabla = (encabezados: string[], filas: string[]): string =>
  `<table style="width:100%;border-collapse:collapse;font-size:11px">` +
  `<thead><tr>${encabezados
    .map(h => `<th style="padding:4px 8px;text-align:left;border-bottom:2px solid #999">${h}</th>`)
    .join('')}</tr></thead><tbody>${filas.join('')}</tbody></table>`;

/**
 * Cargo y Abono en columnas separadas, como espera un estado de cuenta.
 * NO se incluye una columna de saldo corrido: el sistema no guarda el saldo
 * movimiento a movimiento, y calcularlo aquí sería inventar una progresión
 * que la contabilidad no respalda.
 */
function tablaMovimientos(movs: MovimientoPeriodo[], moneda: string): string {
  if (movs.length === 0) return '<p style="font-size:11px">Sin movimientos en el periodo.</p>';
  return tabla(
    ['Fecha', 'Clave', 'Concepto', 'Cargo', 'Abono'],
    movs.map(m => fila([
      fmtFecha(m.fecha), m.clave, m.nombre || '',
      m.naturaleza === 'Cargo' ? fmtMoney(m.monto, moneda) : '',
      m.naturaleza === 'Abono' ? fmtMoney(m.monto, moneda) : '',
    ])),
  );
}

function tablaDesglose(movs: MovimientoPeriodo[], moneda: string): string {
  const grupos = agruparCargosPorConcepto(movs);
  if (grupos.length === 0) return '<p style="font-size:11px">Sin cargos en el periodo.</p>';
  const total = money(grupos.reduce((a, g) => a + g.total, 0));
  return tabla(
    ['Clave', 'Concepto', 'Cantidad', 'Importe'],
    [
      ...grupos.map(g => fila([g.clave, g.nombre, String(g.cantidad), fmtMoney(g.total, moneda)])),
      `<tr><td style="padding:4px 8px;border-top:2px solid #999"><strong>TOTAL</strong></td>` +
      `<td style="border-top:2px solid #999"></td><td style="border-top:2px solid #999"></td>` +
      `<td style="padding:4px 8px;border-top:2px solid #999"><strong>${fmtMoney(total, moneda)}</strong></td></tr>`,
    ],
  );
}

function tablaPagos(pagos: PagoAplicado[], moneda: string): string {
  if (pagos.length === 0) return '<p style="font-size:11px">Sin pagos aplicados a la Fecha Estado.</p>';
  return tabla(
    ['Fecha', 'Referencia', 'Monto aplicado'],
    pagos.map(p => fila([fmtFecha(p.fechaPago), p.referencia || p.id, fmtMoney(p.montoAplicado, moneda)])),
  );
}

function tablaConceptos(detalle: ConceptoAviso[], moneda: string): string {
  if (detalle.length === 0) return '<p style="font-size:11px">El Aviso no tiene detalle.</p>';
  return tabla(
    ['Orden', 'Clave', 'Concepto', 'Monto', 'Pagado', 'Saldo'],
    detalle.map(d => {
      const pagado = Number(d.pagoTotal || 0);
      const saldo = d.saldoPendiente != null ? Number(d.saldoPendiente) : Number(d.monto || 0) - pagado;
      return fila([
        String(d.ordenPrelacion ?? ''), d.claveConcepto, d.nombreConcepto,
        fmtMoney(d.monto, moneda), fmtMoney(pagado, moneda), fmtMoney(saldo, moneda),
      ]);
    }),
  );
}

/** Sustituye {{CLAVE}} y {CLAVE}. Mismo contrato que la Carta Oferta. */
export function sustituirPlaceholders(html: string, datos: Record<string, string>): string {
  let out = html;
  for (const [clave, valor] of Object.entries(datos)) {
    out = out
      .replace(new RegExp(`\\{\\{\\s*${clave}\\s*\\}\\}`, 'g'), valor)
      .replace(new RegExp(`\\{\\s*${clave}\\s*\\}`, 'g'), valor);
  }
  return out;
}
