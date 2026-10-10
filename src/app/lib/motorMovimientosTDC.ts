/**
 * motorMovimientosTDC — REQ-26.
 *
 * Motor puro del prewrite de Movimientos de la Línea de Crédito para producto
 * Tarjeta de Crédito. Implementa ESPECIFICACIÓN 1 (validación contra Cargos
 * Permitidos) y ESPECIFICACIÓN 2 (promociones → afectación de la línea).
 *
 * ── Por qué es puro ──────────────────────────────────────────────────────
 * No escribe en BD, no toca React, no hace fetch. Recibe la configuración del
 * producto y el movimiento, y DEVUELVE el conjunto de efectos a aplicar. Quien
 * lo llama decide cómo persistirlos — y es ahí donde vive la transacción de
 * RN-08. Separarlo así es lo único que permite probar las reglas de negocio
 * sin base de datos y, a la vez, cumplir el rollback: el motor decide QUÉ
 * pasa, la transacción decide CÓMO se escribe.
 *
 * ── El carácter "|" ──────────────────────────────────────────────────────
 * La especificación pide parsear antes del "|". Aquí los valores ya vienen
 * como { valor, clave } desde el subtab Prom Comis e Impue, pero `leerVC()`
 * acepta también el string plano "250.00|021" porque los datos que entren por
 * API pueden venir en esa forma.
 */

export interface ValorClave {
  valor: string;
  /** Código del Catálogo de Componentes al que se imputa; '' = no imputa. */
  clave: string;
}

/** Fila del Catálogo de Componentes — el código es la identidad (RN-07). */
export interface ComponenteRef {
  codigo: string;
  nombre: string;
}

export interface MovimientoEntrada {
  /** Clave del movimiento = código del componente. */
  clave: string;
  descripcion: string;
  monto: number;
  /** ISO corto: YYYY-MM-DD. */
  fecha: string;
}

export interface ConfigProductoTDC {
  claveProducto: string;
  nombreProducto: string;
  /** Línea en proceso — sólo para los mensajes controlados de §1.1.2. */
  idLineaCredito?: string;
  /** Subtab Cargos Permitidos — J_PRODUCTOS.data.cargo */
  cargosPermitidos: any[];
  /** Subtab Prom Comis e Impue — data.promComisImpuestos */
  promComisImpuestos: any[];
  /** Subtab Afectación de la línea — data.afectacionLinea */
  afectacionLinea: any[];
}

/** Un concepto ya resuelto contra Afectación de la línea (punto 3). */
export interface EfectoLinea {
  clave: string;
  nombre: string;
  naturaleza: 'Cargo' | 'Abono';
  monto: number;
  fecha: string;
  bFactura: 'S' | 'N';
  bCargo: 'S' | 'N';
  consumeLineaDisponible: 'S' | 'N';
  /** De qué paso de la ESPEC 2 salió — para la bitácora y para depurar. */
  origen: 'movimiento' | 'comision' | 'iva-comision' | 'cash-back' | 'msi-mci';
}

/** Movimiento a crear en la Cuenta Eje del cliente (§1.1.2). */
export interface EfectoCuentaEje {
  /** Cuenta EJE resuelta por la relación del modelo, NO igual a IdCliente. */
  idCuentaEje: string;
  idCliente: string;
  clave: string;
  /** Nombre y naturaleza vienen de Afectación de la Línea, no de la clave. */
  nombre: string;
  descripcion: string;
  monto: number;
  fecha: string;
  naturaleza: 'Cargo' | 'Abono';
  /** Abono suma, Cargo resta (RN-04). */
  efectoEnSaldo: number;
}

export interface RenglonCalendario {
  /** §1.1.3 — NumeroParcialidad. */
  periodo: number;
  fecha: string;
  clave: string;
  concepto: 'Capital' | 'Interés' | 'IVA Interés';
  monto: number;
  /** Capital que queda por amortizar después de esta parcialidad. */
  saldoCapital: number;
}

export interface ResultadoMotor {
  ok: boolean;
  /** Mensaje de rechazo; sólo cuando ok === false. */
  error?: string;
  /** Qué paso falló — CA-38. */
  pasoFallido?: string;
  advertencias: string[];
  efectosLinea: EfectoLinea[];
  efectosCuentaEje: EfectoCuentaEje[];
  calendario: RenglonCalendario[];
  /** Renglones a crear en el subtab Cargos de la Línea (bCargo = S). */
  cargosACrear: EfectoLinea[];
  /** Suma de los efectos con consumeLineaDisponible = 'S'. */
  totalConsumido: number;
  saldoDisponibleFinal: number;
  esMSI: boolean;
  esMCI: boolean;
}

// ─────────────────────────────────────────────────────────────────────────
// Utilidades
// ─────────────────────────────────────────────────────────────────────────

const norm = (s?: string) =>
  (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Redondeo bancario a 2 decimales — Decisión 8. */
export const money = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * §11 — Normaliza los indicadores bCargo, bFactura y ConsumeLineaDisponible.
 * "s", "S" y " S " deben interpretarse igual. NULL NO se convierte a 'S':
 * ausencia de configuración significa que el indicador no aplica.
 */
export const indicador = (v: unknown): 'S' | 'N' => {
  const t = String(v ?? '').trim().toUpperCase();
  return t === 'S' || t === 'Y' ? 'S' : 'N';
};

/**
 * Acepta el objeto { valor, clave } del subtab o el string plano "250.00|021".
 * Devuelve siempre el par, con el valor ya numérico.
 */
export function leerVC(v: any): { num: number; clave: string; crudo: string } {
  if (v && typeof v === 'object') {
    const crudo = String(v.valor ?? '').trim();
    const num = parseFloat(crudo.replace(/[,%$\s]/g, ''));
    return { num: isNaN(num) ? 0 : num, clave: String(v.clave ?? '').trim(), crudo };
  }
  const s = String(v ?? '').trim();
  const [valorRaw, claveRaw] = s.includes('|') ? s.split('|') : [s, ''];
  const num = parseFloat((valorRaw || '').replace(/[,%$\s]/g, ''));
  return { num: isNaN(num) ? 0 : num, clave: (claveRaw || '').trim(), crudo: valorRaw || '' };
}

/** Suma meses a una fecha ISO corta, sin desbordar a otro mes. */
export function sumarMeses(fechaISO: string, meses: number): string {
  const base = new Date(`${fechaISO}T00:00:00`);
  if (isNaN(base.getTime())) return fechaISO;
  const dia = base.getDate();
  const d = new Date(base.getFullYear(), base.getMonth() + meses, 1);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimoDia));
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ─────────────────────────────────────────────────────────────────────────
// ESPECIFICACIÓN 1 — validación del prewrite
// ─────────────────────────────────────────────────────────────────────────

/**
 * ¿La clave del movimiento está dada de alta en Cargos Permitidos del producto?
 *
 * Cargos Permitidos guarda `tipoCargo` con el NOMBRE del componente, mientras
 * que el movimiento trae su CÓDIGO. Se resuelve por catálogo y se acepta
 * cualquiera de los dos por si un alta vieja guardó el código.
 */
export function claveEstaPermitida(
  claveMovimiento: string,
  cargosPermitidos: any[],
  catalogo: ComponenteRef[],
): boolean {
  const clave = norm(claveMovimiento);
  if (!clave) return false;
  const comp = catalogo.find(c => norm(c.codigo) === clave);
  const nombre = comp ? norm(comp.nombre) : '';
  return (cargosPermitidos || []).some(c => {
    const tipo = norm(c?.tipoCargo);
    return tipo === clave || (!!nombre && tipo === nombre);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// ESPECIFICACIÓN 2 — punto 2 y 3: afectación de la línea
// ─────────────────────────────────────────────────────────────────────────

/** Punto 2: resuelve un (clave, monto, fecha) contra Afectación de la línea. */
function resolverAfectacion(
  clave: string,
  monto: number,
  fecha: string,
  origen: EfectoLinea['origen'],
  cfg: ConfigProductoTDC,
  catalogo: ComponenteRef[],
): { efecto?: EfectoLinea; error?: string } {
  const fila = (cfg.afectacionLinea || []).find(a => norm(a?.clave) === norm(clave));
  if (!fila) {
    // §2.2 — mensaje literal del requerimiento.
    return {
      error:
        `El Cargo "${clave}" no se encuentra configurado en la sección ` +
        `"Afectación de la Línea" del Producto "${cfg.claveProducto || cfg.nombreProducto}".`,
    };
  }
  // §10 — la Naturaleza debe ser una de las dos válidas; un valor capturado a
  // mano ("abono ", "ABONO", vacío) no puede decidir en silencio el signo del
  // saldo de la Cuenta EJE.
  const natRaw = String(fila.naturaleza ?? '').trim().toLowerCase();
  if (natRaw !== 'cargo' && natRaw !== 'abono') {
    return {
      error:
        `La Naturaleza del Cargo "${clave}" en "Afectación de la Línea" no es válida ` +
        `("${fila.naturaleza ?? ''}"): debe ser "Cargo" o "Abono".`,
    };
  }

  return {
    efecto: {
      clave: String(fila.clave),
      nombre: fila.concepto || catalogo.find(c => norm(c.codigo) === norm(clave))?.nombre || String(fila.clave),
      naturaleza: natRaw === 'abono' ? 'Abono' : 'Cargo',
      monto: money(monto),
      fecha,
      // §11 — se normalizan antes de comparar: 's', ' S ', 'y' valen igual.
      bFactura: indicador(fila.bFactura),
      bCargo: indicador(fila.bCargo),
      consumeLineaDisponible: indicador(fila.consumeLineaDisponible),
      origen,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Motor
// ─────────────────────────────────────────────────────────────────────────

export function ejecutarMovimientoTDC(params: {
  movimiento: MovimientoEntrada;
  producto: ConfigProductoTDC;
  catalogo: ComponenteRef[];
  saldoDisponible: number;
  /** Cliente dueño de la Línea — §0. */
  idCliente?: string;
  /**
   * §1.1.2 — Cuenta EJE ya resuelta por la relación del modelo. La
   * especificación prohíbe asumir `IdCliente == IdCuentaEje`: quien llama al
   * motor debe resolverla y pasarla. Vacío o nulo = no existe.
   */
  idCuentaEje?: string | null;
}): ResultadoMotor {
  const { movimiento, producto, catalogo, saldoDisponible } = params;
  const idCliente = params.idCliente || '';
  const idCuentaEje = String(params.idCuentaEje || '').trim();

  const base: ResultadoMotor = {
    ok: false,
    advertencias: [],
    efectosLinea: [],
    efectosCuentaEje: [],
    calendario: [],
    cargosACrear: [],
    totalConsumido: 0,
    saldoDisponibleFinal: saldoDisponible,
    esMSI: false,
    esMCI: false,
  };

  // ── §10 — validaciones de configuración y de entrada ──
  if (!(movimiento.monto > 0)) {
    return { ...base, error: 'El Monto del Movimiento debe ser mayor a cero.', pasoFallido: '§10 — validación de entrada' };
  }
  if (!movimiento.clave) {
    return { ...base, error: 'El Movimiento no trae Clave de Movimiento.', pasoFallido: '§10 — validación de entrada' };
  }

  // ── ESPEC 1 §1.2 — la clave debe existir en Cargos Permitidos ──
  if (!claveEstaPermitida(movimiento.clave, producto.cargosPermitidos, catalogo)) {
    return {
      ...base,
      error:
        `La Clave de Movimiento "${movimiento.clave}" no está configurada en el Producto ` +
        `"${producto.claveProducto} ${producto.nombreProducto}", en la sección "Cargos Permitidos".`,
      pasoFallido: 'ESPEC 1 — Cargos Permitidos',
    };
  }

  const efectos: EfectoLinea[] = [];
  const cuentaEje: EfectoCuentaEje[] = [];
  const calendario: RenglonCalendario[] = [];
  const advertencias: string[] = [];

  /** Empuja un efecto por el punto 2; si no está configurado, aborta todo (CA-29). */
  const aplicar = (clave: string, monto: number, fecha: string, origen: EfectoLinea['origen']): string | null => {
    if (!clave) {
      // §10 — un parámetro con valor financiero > 0 pero SIN clave es
      // configuración inválida: no hay a qué concepto imputarlo. Antes esto
      // era sólo una advertencia y el importe se perdía en silencio.
      return (
        `La configuración de "${origen}" del concepto "${movimiento.clave}" tiene un valor de ` +
        `${money(monto)} pero no declara la clave del concepto (formato "valor|clave"). ` +
        `Revise Prom Comis e Impue del Producto "${producto.claveProducto || producto.nombreProducto}".`
      );
    }
    const { efecto, error } = resolverAfectacion(clave, monto, fecha, origen, producto, catalogo);
    if (error) return error;
    efectos.push(efecto!);
    return null;
  };

  // ── ESPEC 2 §1 — ¿el cargo tiene promoción configurada? ──
  const prom = (producto.promComisImpuestos || []).find(p => norm(p?.clave) === norm(movimiento.clave));

  if (prom) {
    // ── §1.1.1 Determinación de Comisiones ──
    const comFija = leerVC(prom.comisionFija);
    const pctCom = leerVC(prom.porcentajeComision);
    const pctIvaCom = leerVC(prom.porcentajeIvaComision);

    if (comFija.num > 0 || pctCom.num > 0) {
      const porPorcentaje = movimiento.monto * (pctCom.num / 100);
      const montoComision = money(Math.max(comFija.num, porPorcentaje));
      // La clave es la del campo que GANÓ. En empate manda la comisión fija,
      // según la regla explícita del requerimiento.
      const claveComision = porPorcentaje > comFija.num ? pctCom.clave : comFija.clave;

      const e1 = aplicar(claveComision, montoComision, movimiento.fecha, 'comision');
      if (e1) return { ...base, error: e1, pasoFallido: 'ESPEC 2 §1.1.1 — comisión' };

      if (pctIvaCom.num > 0) {
        // RN-03: el IVA va sobre la comisión, no sobre el monto del movimiento.
        const montoIva = money(montoComision * (pctIvaCom.num / 100));
        const e2 = aplicar(pctIvaCom.clave, montoIva, movimiento.fecha, 'iva-comision');
        if (e2) return { ...base, error: e2, pasoFallido: 'ESPEC 2 §1.1.1 — IVA de comisión' };
      }
    }

    // ── §1.1.2 Determinación de Cash Back ──
    const pctCBack = leerVC(prom.porcentajeCashback);
    if (pctCBack.num > 0) {
      const montoCB = money(movimiento.monto * (pctCBack.num / 100));
      const e3 = aplicar(pctCBack.clave, montoCB, movimiento.fecha, 'cash-back');
      if (e3) return { ...base, error: e3, pasoFallido: 'ESPEC 2 §1.1.2 — cash back' };

      if (!idCuentaEje) {
        // §1.1.2 — sin Cuenta EJE válida se revierte todo; mensaje literal.
        return {
          ...base,
          error:
            `No se encontró una Cuenta EJE válida para el Cliente "${idCliente}" ` +
            `asociado a la Línea de Crédito "${producto.idLineaCredito || ''}".`,
          pasoFallido: 'ESPEC 2 §1.1.2 — Cuenta EJE',
        };
      }

      // Nombre y Naturaleza salen de Afectación de la Línea (§ "no hardcodear
      // Clave 900 = Abono"), no de la clave ni de un default.
      const efectoCB = efectos.find(e => e.origen === 'cash-back')!;
      cuentaEje.push({
        idCuentaEje,
        idCliente,
        clave: pctCBack.clave,
        nombre: efectoCB.nombre,
        descripcion: `Cash Back — ${movimiento.descripcion || movimiento.clave}`,
        monto: montoCB,
        fecha: movimiento.fecha,
        naturaleza: efectoCB.naturaleza,
        // RN-04: Abono aumenta el saldo, Cargo lo disminuye.
        efectoEnSaldo: efectoCB.naturaleza === 'Abono' ? montoCB : -montoCB,
      });
    }

    // ── §1.1.3 Determinación de MCI / MSI ──
    const plazo = leerVC(prom.plazo);
    if (plazo.num > 0) {
      // §10 — el Plazo debe ser entero positivo; 6.5 meses no existe.
      if (!Number.isInteger(plazo.num)) {
        return {
          ...base,
          error: `El Plazo configurado para "${movimiento.clave}" (${plazo.crudo}) no es un entero positivo.`,
          pasoFallido: '§10 — validación de Plazo',
        };
      }
      const pctInt = leerVC(prom.porcentajeInteresAnual);
      const pctIvaInt = leerVC(prom.porcentajeIvaInteres);
      const esMCI = pctInt.num > 0 || pctIvaInt.num > 0; // RN-05
      const n = Math.round(plazo.num);

      const capitalPorPeriodo = money(movimiento.monto / n);
      // Interés simple sobre el monto, prorrateado al plazo.
      const interesTotal = esMCI ? money(movimiento.monto * (pctInt.num / 100) * (n / 12)) : 0;
      const interesPorPeriodo = esMCI ? money(interesTotal / n) : 0;
      const ivaIntPorPeriodo = esMCI ? money(interesPorPeriodo * (pctIvaInt.num / 100)) : 0;

      // REGLA DE REDONDEO: la suma del capital de las parcialidades tiene que
      // dar EXACTAMENTE el monto del movimiento. Dividir 100/3 deja 0.01 de
      // diferencia; el ajuste va completo en la última parcialidad.
      const capitalAjuste = money(movimiento.monto - capitalPorPeriodo * n);

      let saldo = money(movimiento.monto);
      for (let i = 1; i <= n; i++) {
        // Decisión 5: el calendario lleva fecha por periodo, mensual desde el movimiento.
        const fechaPeriodo = sumarMeses(movimiento.fecha, i);
        const esUltima = i === n;
        const capital = esUltima ? money(capitalPorPeriodo + capitalAjuste) : capitalPorPeriodo;
        saldo = money(saldo - capital);

        calendario.push({
          periodo: i, fecha: fechaPeriodo, clave: plazo.clave,
          concepto: 'Capital', monto: capital, saldoCapital: saldo,
        });
        if (esMCI) {
          if (interesPorPeriodo > 0) {
            calendario.push({
              periodo: i, fecha: fechaPeriodo, clave: pctInt.clave,
              concepto: 'Interés', monto: interesPorPeriodo, saldoCapital: saldo,
            });
          }
          if (ivaIntPorPeriodo > 0) {
            calendario.push({
              periodo: i, fecha: fechaPeriodo, clave: pctIvaInt.clave,
              concepto: 'IVA Interés', monto: ivaIntPorPeriodo, saldoCapital: saldo,
            });
          }
        }
      }

      // El arreglo completo se manda en una sola pasada al punto 2 (CA-27).
      for (const r of calendario) {
        const err = aplicar(r.clave, r.monto, r.fecha, 'msi-mci');
        if (err) return { ...base, error: err, pasoFallido: `ESPEC 2 §1.1.3 — ${esMCI ? 'MCI' : 'MSI'}` };
      }

      base.esMCI = esMCI;
      base.esMSI = !esMCI;
    }
  }

  // ── §1.1 cierre / §1.2 — el propio movimiento pasa por el punto 2 ──
  const errMov = aplicar(movimiento.clave, movimiento.monto, movimiento.fecha, 'movimiento');
  if (errMov) return { ...base, error: errMov, pasoFallido: 'ESPEC 2 §2 — Afectación de la línea' };

  // ── Punto 3 — saldo disponible y cargos ──
  // Decisión 6: en MSI/MCI consume el total del movimiento, no el capital por periodo;
  // los renglones del calendario ya no vuelven a consumir para no contar doble.
  const consumen = efectos.filter(e => e.consumeLineaDisponible === 'S' && e.origen !== 'msi-mci');
  const totalConsumido = money(consumen.reduce((acc, e) => acc + e.monto, 0));

  return {
    ok: true,
    advertencias,
    efectosLinea: efectos,
    efectosCuentaEje: cuentaEje,
    calendario,
    cargosACrear: efectos.filter(e => e.bCargo === 'S'), // CA-32
    totalConsumido,
    saldoDisponibleFinal: money(saldoDisponible - totalConsumido),
    esMSI: base.esMSI,
    esMCI: base.esMCI,
  };
}
