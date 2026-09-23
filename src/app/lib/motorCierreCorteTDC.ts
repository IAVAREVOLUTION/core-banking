/**
 * motorCierreCorteTDC — REQ-27.
 *
 * Motor puro del Cierre de Corte de la Línea de Crédito. Determina el periodo,
 * selecciona los Cargos, los ordena por Prelación, calcula Monto Total, Monto
 * Mínimo y Fecha Límite de Pago, y DEVUELVE el conjunto a persistir.
 *
 * ── Por qué es puro ──────────────────────────────────────────────────────
 * No escribe en BD, no toca React, no hace fetch. Igual que
 * `motorMovimientosTDC` (REQ-26): el motor decide QUÉ se factura y en qué
 * orden, la transacción decide CÓMO se escribe. Es lo que permite cumplir la
 * atomicidad de RN-08 y, a la vez, probar las reglas sin base de datos.
 */

import { money } from './motorMovimientosTDC';

export type SiNo = 'S' | 'N';

/** Un Cargo de la Línea, tal como lo dejó REQ-26. */
export interface CargoLinea {
  id: string | number;
  clave: string;
  nombre: string;
  naturaleza: 'Cargo' | 'Abono';
  monto: number;
  /** Fecha FINANCIERA del cargo — nunca la de captura (RN-02). */
  fecha: string;
  bFactura: SiNo;
  bCargo: SiNo | string;
  estatus: 'Pendiente' | 'Procesado' | 'Cancelado' | string;
  /** Movimiento que lo originó — trazabilidad (CA-36). */
  movimientoId?: string | number;
  /** CxC que ya lo procesó; si viene, no se vuelve a cortar (CA-42). */
  cxcId?: string | null;
}

/** Un renglón de cualquiera de las dos configuraciones de prelación. */
export interface RenglonPrelacion {
  orden: number;
  /** Clave del componente, cuando la configuración la guarda. */
  clave?: string;
  /** Nombre del concepto — algunas configuraciones sólo guardan esto. */
  concepto?: string;
}

/** Configuración de corte y pago, ya resuelta por nivel (§Decisión 2). */
export interface ConfigCorte {
  diaCorte: number;
  diasParaPago: number;
  ajusteDiaInhabil?: string;
  pagoMinimoMetodo?: string;
  pagoMinimoPorcentaje?: number;
  pagoMinimoMonto?: number;
  pagoMinimoAgregarSaldoVencido?: boolean;
  /** Conceptos que suman al mínimo; vacío = todos. */
  pagoMinimoConceptos?: string[];
}

export interface DatosLinea {
  idLineaCredito: string;
  idCliente: string;
  idSolicitud: string;
  idProducto: string;
  claveProducto?: string;
  nombreCliente?: string;
  moneda?: string;
}

export interface RenglonDetalleCxC {
  idCargo: string | number;
  claveConcepto: string;
  nombreConcepto: string;
  monto: number;
  fechaCargo: string;
  naturaleza: 'Cargo' | 'Abono';
  /** Lo consume la ESPECIFICACIÓN 4 para aplicar pagos (CA-24). */
  ordenPrelacion: number;
  bFactura: SiNo;
  idMovimientoOrigen?: string | number;
}

export interface ResultadoCierre {
  ok: boolean;
  error?: string;
  pasoFallido?: string;
  advertencias: string[];
  periodo: { fechaInicio: string; fechaFin: string };
  /**
   * §17 — FechaDocumento = FechaFin, la fecha de CORTE.
   * La especificación lo marca como regla obligatoria (§44.8) y prohíbe usar
   * FechaInicio o FechaHoraProceso: el documento representa funcionalmente la
   * fecha en que se realizó el corte.
   */
  fechaDocumento: string;
  fechaVencimiento: string;
  detalle: RenglonDetalleCxC[];
  montoTotalPagar: number;
  montoMinimoPagar: number;
  cantidadCargos: number;
  /** Ids a marcar Procesado, en el mismo orden del detalle. */
  cargosProcesados: (string | number)[];
}

// ─────────────────────────────────────────────────────────────────────────
// Fechas
// ─────────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
const aISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Acepta ISO corto y dd/mm/aaaa — las dos formas que circulan en el sistema. */
export function aFecha(v: string): Date {
  if (!v) return new Date(NaN);
  if (v.includes('/')) {
    const [d, m, y] = v.split('/');
    const anio = y?.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y || '0', 10);
    return new Date(anio, parseInt(m, 10) - 1, parseInt(d, 10));
  }
  return new Date(`${v.slice(0, 10)}T00:00:00`);
}

/** Día de corte del mes dado, acotado al último día si el mes no lo tiene (CA-11). */
function diaCorteDelMes(anio: number, mes: number, dia: number): Date {
  const ultimo = new Date(anio, mes + 1, 0).getDate();
  return new Date(anio, mes, Math.min(Math.max(1, dia), ultimo));
}

/**
 * Periodo de corte (RN-01).
 *
 * ── Sin cortes anteriores ────────────────────────────────────────────────
 * Del día siguiente al corte del mes previo, al corte del mes de referencia.
 * Con diaCorte=20 y referencia en septiembre 2026 devuelve
 * 21/08/2026 – 20/09/2026.
 *
 * ── Con un corte anterior ────────────────────────────────────────────────
 * `fechaInicio` es el día siguiente al FIN del corte anterior, no un día de
 * corte recalculado: así los periodos quedan encadenados sin huecos ni
 * traslapes aunque un cierre se haya hecho en fecha irregular.
 *
 * `fechaFin` se sigue determinando por el día de corte configurado, tomando
 * la PRIMERA ocurrencia posterior al inicio. Sin esa condición, un corte
 * anterior del mismo mes produciría un fin previo al inicio: con corte previo
 * al 15/09 el periodo nuevo arranca el 16/09, y el día de corte de septiembre
 * ya pasó, así que el fin correcto es el 15/10.
 *
 * @param fechaFinCorteAnterior fin del último corte de la línea, si lo hay.
 */
export function calcularPeriodoCorte(
  diaCorte: number,
  referencia: Date = new Date(),
  fechaFinCorteAnterior?: string,
): { fechaInicio: string; fechaFin: string } {
  const anterior = fechaFinCorteAnterior ? aFecha(fechaFinCorteAnterior) : null;

  if (anterior && !isNaN(anterior.getTime())) {
    const inicio = new Date(anterior);
    inicio.setDate(inicio.getDate() + 1);

    // Primera ocurrencia del día de corte que no sea anterior al inicio.
    let fin = diaCorteDelMes(inicio.getFullYear(), inicio.getMonth(), diaCorte);
    if (fin < inicio) {
      fin = diaCorteDelMes(inicio.getFullYear(), inicio.getMonth() + 1, diaCorte);
    }
    return { fechaInicio: aISO(inicio), fechaFin: aISO(fin) };
  }

  const fin = diaCorteDelMes(referencia.getFullYear(), referencia.getMonth(), diaCorte);
  const corteAnterior = diaCorteDelMes(referencia.getFullYear(), referencia.getMonth() - 1, diaCorte);
  const inicio = new Date(corteAnterior);
  inicio.setDate(inicio.getDate() + 1);
  return { fechaInicio: aISO(inicio), fechaFin: aISO(fin) };
}

/** Domingo o sábado. No hay calendario de días festivos en el sistema (§Decisión 7). */
const esInhabil = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/**
 * Fecha Límite de Pago (CA-28): días naturales sobre la FECHA DE CORTE, con el
 * ajuste por día inhábil que declare la configuración. Los días NO se
 * hardcodean: llegan en `config.diasParaPago`.
 */
export function calcularFechaLimitePago(fechaFin: string, config: ConfigCorte): string {
  const base = aFecha(fechaFin);
  if (isNaN(base.getTime())) return fechaFin;
  const d = new Date(base);
  d.setDate(d.getDate() + (Number(config.diasParaPago) || 0));

  const ajuste = (config.ajusteDiaInhabil || '').toLowerCase();
  if (ajuste.includes('siguiente')) {
    while (esInhabil(d)) d.setDate(d.getDate() + 1);
  } else if (ajuste.includes('anterior')) {
    while (esInhabil(d)) d.setDate(d.getDate() - 1);
  }
  return aISO(d);
}

// ─────────────────────────────────────────────────────────────────────────
// Selección de cargos
// ─────────────────────────────────────────────────────────────────────────

/** Normaliza bCargo antes de evaluarlo (CA-16): 's', ' S', 'y' valen igual. */
export const cargoFacturable = (v: unknown): boolean => {
  const s = String(v ?? '').trim().toUpperCase();
  return s === 'S' || s === 'Y';
};

/** Cargos del periodo que deben cortarse (CA-13 … CA-18). */
export function seleccionarCargosDelPeriodo(
  cargos: CargoLinea[],
  fechaInicio: string,
  fechaFin: string,
): CargoLinea[] {
  const ini = aFecha(fechaInicio).getTime();
  const fin = aFecha(fechaFin).getTime();
  return (cargos || []).filter(c => {
    if (!cargoFacturable(c.bCargo)) return false;
    if (String(c.estatus || '').toLowerCase() !== 'pendiente') return false;
    if (c.cxcId) return false; // ya ligado a una CxC — idempotencia (CA-42)
    const f = aFecha(c.fecha).getTime();
    if (isNaN(f)) return false;
    return f >= ini && f <= fin;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Prelación
// ─────────────────────────────────────────────────────────────────────────

const norm = (s?: string) =>
  (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Orden de prelación de un concepto. Se busca por clave y, si la configuración
 * sólo guarda el nombre, por nombre — las dos formas conviven en el sistema.
 * Devuelve null cuando no está configurado, que es motivo de aborto (RN-04).
 */
export function ordenDePrelacion(
  cargo: CargoLinea,
  prelacion: RenglonPrelacion[],
): number | null {
  const porClave = prelacion.find(p => p.clave && norm(p.clave) === norm(cargo.clave));
  if (porClave) return porClave.orden;
  const porNombre = prelacion.find(p => p.concepto && norm(p.concepto) === norm(cargo.nombre));
  if (porNombre) return porNombre.orden;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Pago mínimo
// ─────────────────────────────────────────────────────────────────────────

/**
 * Monto Mínimo a Pagar (CA-26/CA-27). La fórmula NO está fija aquí: se aplica
 * el método que declara la configuración de la línea/producto.
 *
 * @param saldoVencido saldo exigible de cortes anteriores; 0 en el primero.
 */
export function calcularPagoMinimo(
  config: ConfigCorte,
  detalle: RenglonDetalleCxC[],
  montoTotal: number,
  saldoVencido = 0,
): number {
  const metodo = norm(config.pagoMinimoMetodo);
  const pct = Number(config.pagoMinimoPorcentaje) || 0;
  const fijo = Number(config.pagoMinimoMonto) || 0;

  // Base: sólo los conceptos incluidos, si la configuración los acota.
  const incluidos = config.pagoMinimoConceptos || [];
  const base = incluidos.length > 0
    ? detalle
        .filter(d => incluidos.some(c => norm(c) === norm(d.nombreConcepto)))
        .reduce((a, d) => a + d.monto, 0)
    : montoTotal;

  const porPorcentaje = base * (pct / 100);

  let minimo: number;
  // El orden importa: "El mayor entre % y monto fijo" CONTIENE "monto fijo",
  // así que la rama del mayor tiene que evaluarse primero o se lo come.
  if (metodo.includes('mayor')) {
    minimo = Math.max(porPorcentaje, fijo);
  } else if (metodo.includes('monto fijo')) {
    minimo = fijo;
  } else if (metodo.includes('+')) {
    // "% + mínimo fijo": el porcentaje, pero nunca por debajo del mínimo absoluto.
    minimo = Math.max(porPorcentaje, fijo);
  } else if (metodo.includes('%')) {
    minimo = porPorcentaje;
  } else {
    // Sin método configurado, el mínimo es el total: nunca menos de lo exigible.
    minimo = montoTotal;
  }

  if (config.pagoMinimoAgregarSaldoVencido) minimo += saldoVencido;

  // El mínimo jamás excede el total del documento.
  return money(Math.min(minimo, montoTotal + (config.pagoMinimoAgregarSaldoVencido ? saldoVencido : 0)));
}

// ─────────────────────────────────────────────────────────────────────────
// Motor
// ─────────────────────────────────────────────────────────────────────────

export function ejecutarCierreCorte(params: {
  linea: DatosLinea;
  config: ConfigCorte;
  cargos: CargoLinea[];
  prelacion: RenglonPrelacion[];
  fechaInicio: string;
  fechaFin: string;
  /** Saldo exigible de cortes anteriores (§Decisión 6). */
  saldoVencido?: number;
}): ResultadoCierre {
  const { linea, config, cargos, prelacion, fechaInicio, fechaFin } = params;
  const saldoVencido = params.saldoVencido || 0;

  const base: ResultadoCierre = {
    ok: false,
    advertencias: [],
    periodo: { fechaInicio, fechaFin },
    fechaDocumento: fechaFin,   // §17 — la del CORTE
    fechaVencimiento: '',
    detalle: [],
    montoTotalPagar: 0,
    montoMinimoPagar: 0,
    cantidadCargos: 0,
    cargosProcesados: [],
  };

  // ── CA-50 — validaciones previas ──
  const ini = aFecha(fechaInicio);
  const fin = aFecha(fechaFin);
  if (isNaN(ini.getTime()) || isNaN(fin.getTime())) {
    return { ...base, error: 'El periodo de corte tiene fechas inválidas.', pasoFallido: 'Validación del periodo' };
  }
  if (ini.getTime() > fin.getTime()) {
    return { ...base, error: 'La Fecha de Inicio no puede ser posterior a la Fecha Fin.', pasoFallido: 'Validación del periodo' };
  }
  for (const [campo, valor] of [
    ['Línea de Crédito', linea.idLineaCredito],
    ['Cliente', linea.idCliente],
    ['Solicitud', linea.idSolicitud],
    ['Producto', linea.idProducto],
  ] as [string, string][]) {
    if (!valor) {
      return { ...base, error: `Falta ${campo} en la Línea de Crédito.`, pasoFallido: 'Validación de la línea' };
    }
  }
  if (!prelacion || prelacion.length === 0) {
    return {
      ...base,
      error: `El Producto "${linea.idProducto}" no tiene configurada la sección "Prelación".`,
      pasoFallido: 'Validación de Prelación',
    };
  }

  // ── CA-13 … CA-18 — cargos del periodo ──
  const delPeriodo = seleccionarCargosDelPeriodo(cargos, fechaInicio, fechaFin);

  // §Decisión 8 — los Abonos no son exigibles: no entran al documento.
  const abonos = delPeriodo.filter(c => c.naturaleza === 'Abono');
  const facturables = delPeriodo.filter(c => c.naturaleza !== 'Abono');
  const advertencias = abonos.length > 0
    ? [`${abonos.length} cargo(s) de naturaleza Abono quedaron fuera del documento; no son exigibles al cliente.`]
    : [];

  // ── CA-19 — sin cargos, no se emite un documento vacío ──
  if (facturables.length === 0) {
    return {
      ...base,
      advertencias,
      error:
        `No existen cargos pendientes para procesar en el periodo "${fechaInicio}" a "${fechaFin}" ` +
        `para la Línea de Crédito "${linea.idLineaCredito}".`,
      pasoFallido: 'Sin cargos pendientes',
    };
  }

  // ── CA-20 … CA-22 — prelación, abortando si falta alguna ──
  const conOrden: { cargo: CargoLinea; orden: number }[] = [];
  for (const c of facturables) {
    const orden = ordenDePrelacion(c, prelacion);
    if (orden === null) {
      return {
        ...base,
        advertencias,
        error:
          `El concepto "${c.clave} — ${c.nombre}" no se encuentra configurado en la sección ` +
          `"Prelación" del Producto "${linea.idProducto}".`,
        pasoFallido: 'Prelación no configurada',
      };
    }
    conOrden.push({ cargo: c, orden });
  }

  // ── CA-23 — orden determinístico ──
  conOrden.sort((a, b) => {
    if (a.orden !== b.orden) return a.orden - b.orden;
    const fa = aFecha(a.cargo.fecha).getTime();
    const fb = aFecha(b.cargo.fecha).getTime();
    if (fa !== fb) return fa - fb;
    return String(a.cargo.id).localeCompare(String(b.cargo.id));
  });

  // ── CA-34 — un renglón de detalle por cargo ──
  const detalle: RenglonDetalleCxC[] = conOrden.map(({ cargo, orden }) => ({
    idCargo: cargo.id,
    claveConcepto: cargo.clave,
    nombreConcepto: cargo.nombre,
    monto: money(cargo.monto),
    fechaCargo: cargo.fecha,
    naturaleza: cargo.naturaleza,
    ordenPrelacion: orden,
    bFactura: cargo.bFactura === 'S' ? 'S' : 'N',
    idMovimientoOrigen: cargo.movimientoId,
  }));

  // ── CA-25 … CA-30 — montos y fechas ──
  const montoTotalPagar = money(detalle.reduce((a, d) => a + d.monto, 0));
  const montoMinimoPagar = calcularPagoMinimo(config, detalle, montoTotalPagar, saldoVencido);
  const fechaVencimiento = calcularFechaLimitePago(fechaFin, config);

  return {
    ok: true,
    advertencias,
    periodo: { fechaInicio, fechaFin },
    fechaDocumento: fechaFin, // §17 — la fecha de CORTE, nunca la de inicio
    fechaVencimiento,
    detalle,
    montoTotalPagar,
    montoMinimoPagar,
    cantidadCargos: detalle.length,
    cargosProcesados: detalle.map(d => d.idCargo),
  };
}
