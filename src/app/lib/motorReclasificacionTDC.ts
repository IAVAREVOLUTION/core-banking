/**
 * motorReclasificacionTDC — ESPECIFICACIÓN 9, el motor puro.
 *
 * Al cerrar el Estado de Cuenta, el saldo que quedó al corte se reinyecta a la
 * Línea como cargos del periodo siguiente:
 *
 *   023 — Saldo Anterior     el saldo al corte, con fecha del día
 *   012 — Interés Ordinario  interés simple sobre ese saldo (sólo si es > 0)
 *   03  — Iva Interés        el interés por la tasa de IVA
 *
 * Aquí sólo se DECIDE qué movimientos proceden y por cuánto. Registrarlos es
 * trabajo de `aplicarReclasificacionTDC`, que los pasa por el mismo RPC que
 * usa la captura manual para que corran las mismas reglas.
 *
 * ── Por qué las claves son parámetros ────────────────────────────────────
 * La especificación nombra 023, 012 y 03, pero son claves del catálogo de
 * componentes, no constantes del negocio: otro producto puede usar otras. Se
 * reciben con esos valores por omisión y quedan en un solo lugar.
 */

/** Dos decimales, sin sorpresas de punto flotante. */
export const money = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

/** Normaliza cualquier fecha a 'YYYY-MM-DD'. */
export const aISO = (v: unknown): string => {
  const t = String(v ?? '').trim();
  if (!t) return '';
  const dmy = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  return t.slice(0, 10);
};

/**
 * Tasa de IVA cuando el producto no la tiene configurada.
 *
 * Es una decisión de negocio, no una suposición del código: mientras los
 * productos no capturen su IVA, todos los cálculos que lo necesiten usan 16%.
 * La configuración del producto SIEMPRE gana sobre esta constante — sólo se
 * usa cuando no hay ninguna capturada.
 *
 * Mismo valor que `IVA_DEFAULT` de ComisionesIvaTab, que ya lo proponía al dar
 * de alta un renglón.
 */
export const IVA_POR_OMISION = 16;

/** Claves del catálogo que usa la reclasificación. */
export const CLAVES_RECLASIFICACION = {
  saldoAnterior: '023',
  interesOrdinario: '012',
  ivaInteres: '03',
} as const;

/**
 * Días transcurridos entre dos fechas, en días naturales.
 * Se cuenta el intervalo, no los extremos: del 16/08 al 05/10 son 50 días.
 */
export function diasEntre(desde: string, hasta: string): number {
  const a = aISO(desde), b = aISO(hasta);
  if (!a || !b) return 0;
  const ta = Date.parse(`${a}T00:00:00Z`), tb = Date.parse(`${b}T00:00:00Z`);
  if (isNaN(ta) || isNaN(tb)) return 0;
  const dias = Math.round((tb - ta) / 86400000);
  return dias > 0 ? dias : 0;
}

/**
 * Interés simple: Capital × (TasaAnual / 100) × (Días / BaseAnual).
 *
 * `baseCalculo` es la convención de días del producto (360 comercial o 365
 * natural). No se asume: llega desde la configuración, y si no viene se usa
 * 360, que es la base con la que opera el resto del sistema.
 */
export function calcularInteresSimple(params: {
  capital: number;
  tasaAnual: number;
  dias: number;
  baseCalculo?: number;
}): number {
  const capital = money(params.capital);
  const tasa = Number(params.tasaAnual) || 0;
  const dias = Number(params.dias) || 0;
  const base = Number(params.baseCalculo) > 0 ? Number(params.baseCalculo) : 360;

  if (capital <= 0 || tasa <= 0 || dias <= 0) return 0;
  return money(capital * (tasa / 100) * (dias / base));
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
 * La fecha con la que se registran los cargos de la reclasificación.
 *
 * §1 dice "fecha del día", y eso se respeta mientras el día ya sea posterior
 * al corte. Cuando el Estado de Cuenta se genera EL MISMO día del corte —el
 * caso normal— la fecha del día caería dentro del periodo recién cerrado, así
 * que se recorre al día siguiente del corte, que es donde estos cargos
 * pertenecen.
 */
export function fechaEfectivaCargos(fechaMovimiento: string, fechaCorte?: string): string {
  const hoy = aISO(fechaMovimiento);
  const corte = aISO(fechaCorte || '');
  if (!hoy) return '';
  if (!corte) return hoy;
  const siguiente = sumarDias(corte, 1);
  return siguiente && siguiente > hoy ? siguiente : hoy;
}

/** Un movimiento que la reclasificación va a registrar en la Línea. */
export interface MovimientoReclasificacion {
  clave: string;
  descripcion: string;
  monto: number;
  fecha: string;
  /** Para poder explicar en pantalla de dónde salió la cifra. */
  origen: 'saldoAnterior' | 'interesOrdinario' | 'ivaInteres';
}

export interface ParamsReclasificacion {
  /** §1 — el saldo al corte del Estado de Cuenta recién generado. */
  saldoAlCorte: number;
  /** §1 — fecha del día para los movimientos. */
  fechaMovimiento: string;
  /**
   * Fecha de corte del periodo que se acaba de cerrar.
   *
   * Los cargos de la reclasificación pertenecen al periodo SIGUIENTE: si
   * cayeran dentro del que se cerró, el próximo Estado de Cuenta los contaría
   * como Cargos del Periodo y el saldo se cobraría dos veces. Por eso la fecha
   * efectiva nunca es anterior al día después del corte.
   */
  fechaCorte?: string;
  /** §1.1.1 — extremos del cálculo de días. */
  fechaInicioPeriodo: string;
  fechaLimitePago: string;
  /** Tasa anual de Términos y Condiciones de la Línea. */
  tasaAnual: number;
  /** Tasa de IVA aplicable al interés. */
  tasaIva: number;
  /** Convención de días del producto. */
  baseCalculo?: number;
  claves?: Partial<typeof CLAVES_RECLASIFICACION>;
}

export interface ResultadoReclasificacion {
  ok: boolean;
  /** Motivo por el que no procede; vacío cuando sí procede. */
  motivo?: string;
  movimientos: MovimientoReclasificacion[];
  /** Los insumos del cálculo, para poder auditarlo sin rehacerlo. */
  dias: number;
  interesOrdinario: number;
  ivaInteres: number;
  /** Avisos sin tasa o sin IVA configurados: se dicen, no se inventan. */
  advertencias: string[];
}

/**
 * §1 y §1.1 — qué movimientos genera el cierre del Estado de Cuenta.
 *
 * Con saldo cero o negativo sólo se registra el Saldo Anterior… y ni eso: un
 * saldo no positivo no es un cargo, así que no se registra nada. §1.1 lo dice
 * al condicionar el interés a saldo > 0, y un "Saldo Anterior" de cero o a
 * favor ensuciaría la línea con un movimiento sin efecto.
 */
export function planReclasificacion(p: ParamsReclasificacion): ResultadoReclasificacion {
  const claves = { ...CLAVES_RECLASIFICACION, ...(p.claves || {}) };
  const advertencias: string[] = [];
  const fecha = fechaEfectivaCargos(p.fechaMovimiento, p.fechaCorte);
  const saldo = money(p.saldoAlCorte);

  const vacio = (motivo: string): ResultadoReclasificacion => ({
    ok: false, motivo, movimientos: [], dias: 0,
    interesOrdinario: 0, ivaInteres: 0, advertencias,
  });

  if (!fecha) return vacio('No se recibió la fecha del movimiento.');
  if (saldo <= 0) {
    return vacio('El saldo al corte no es mayor a cero: no hay nada que reclasificar.');
  }

  const movimientos: MovimientoReclasificacion[] = [{
    clave: claves.saldoAnterior,
    descripcion: 'Saldo Anterior',
    monto: saldo,
    fecha,
    origen: 'saldoAnterior',
  }];

  // §1.1.1 — días entre el inicio del periodo y la fecha límite de pago.
  const dias = diasEntre(p.fechaInicioPeriodo, p.fechaLimitePago);
  if (dias <= 0) {
    advertencias.push(
      'No se pudo calcular el interés: la fecha de inicio del periodo y la fecha límite de pago no delimitan días.',
    );
  }

  const tasa = Number(p.tasaAnual) || 0;
  if (tasa <= 0) {
    advertencias.push(
      'La Línea no tiene Tasa (%) capturada en Términos y Condiciones: no se generó el Interés Ordinario.',
    );
  }

  const interesOrdinario = calcularInteresSimple({
    capital: saldo, tasaAnual: tasa, dias, baseCalculo: p.baseCalculo,
  });

  if (interesOrdinario > 0) {
    movimientos.push({
      clave: claves.interesOrdinario,
      descripcion: 'Interés Ordinario',
      monto: interesOrdinario,
      fecha,
      origen: 'interesOrdinario',
    });
  }

  // Con `resolverTasaIvaInteres` esto nunca es cero, porque cae a
  // IVA_POR_OMISION. Se conserva por si alguien llama al motor con 0 a
  // propósito: el aviso explica la ausencia en vez de dejarla muda.
  const tasaIva = Number(p.tasaIva) || 0;
  if (interesOrdinario > 0 && tasaIva <= 0) {
    advertencias.push(
      'Se recibió una Tasa de IVA en cero: no se generó el IVA del Interés.',
    );
  }

  const ivaInteres = interesOrdinario > 0 && tasaIva > 0
    ? money(interesOrdinario * (tasaIva / 100))
    : 0;

  if (ivaInteres > 0) {
    movimientos.push({
      clave: claves.ivaInteres,
      descripcion: 'Iva Interés',
      monto: ivaInteres,
      fecha,
      origen: 'ivaInteres',
    });
  }

  return { ok: true, movimientos, dias, interesOrdinario, ivaInteres, advertencias };
}

/**
 * Tasa de IVA aplicable al interés, por orden de especificidad:
 *
 *   1. Prom Comis e Impue del concepto de interés → porcentajeIvaInteres
 *   2. Comisiones e IVA del concepto de IVA       → porcentajeIva
 *   3. IVA Porcentaje del producto (no fronterizo)
 *   4. `IVA_POR_OMISION`
 *
 * Lo capturado en el producto manda; el 16% es el piso para que un producto
 * sin IVA configurado no deje de calcularlo.
 */
export function resolverTasaIvaInteres(producto: {
  promComisImpuestos?: any[];
  comisionesIva?: any[];
  ivaPorcentaje?: any[];
}, claveInteres = CLAVES_RECLASIFICACION.interesOrdinario,
   claveIva = CLAVES_RECLASIFICACION.ivaInteres): number {
  const num = (v: unknown): number => {
    const n = parseFloat(String(v ?? '').replace(/[%,\s]/g, ''));
    return isNaN(n) ? 0 : n;
  };
  const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

  const prom = (producto.promComisImpuestos || []).find(r => norm(r?.clave) === norm(claveInteres));
  const dePro = num(prom?.porcentajeIvaInteres);
  if (dePro > 0) return dePro;

  const com = (producto.comisionesIva || []).find(r => norm(r?.clave) === norm(claveIva));
  const deCom = num(com?.porcentajeIva);
  if (deCom > 0) return deCom;

  const fila = (producto.ivaPorcentaje || []).find(r => r?.zonaFronteriza !== true)
            ?? (producto.ivaPorcentaje || [])[0];
  const delProducto = num(fila?.porcentaje);
  if (delProducto > 0) return delProducto;

  return IVA_POR_OMISION;
}
