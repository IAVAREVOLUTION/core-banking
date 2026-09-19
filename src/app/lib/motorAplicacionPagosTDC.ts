/**
 * motorAplicacionPagosTDC — ESPECIFICACIÓN 4, decisión pura.
 *
 * Dado un pago recibido, el saldo de la Cuenta EJE y las CxC del cliente,
 * decide CUÁNTO se aplica a cada línea de detalle y en qué orden. No escribe
 * nada: la persistencia vive en `aplicar_pago_referenciado` (§50, §52).
 *
 * ── La regla central (§57) ───────────────────────────────────────────────
 *   1. CxC por FechaVencimiento ASC   (desempate: FechaDocumento, IdCxC)
 *   2. Detalle por OrdenPrelacion ASC (desempate: IdDetalle)
 * No se toca una CxC posterior mientras la anterior tenga saldo pagable.
 *
 * ── Por qué el OrdenPrelacion se lee del detalle y no del producto (§10) ──
 * El detalle guarda la prelación vigente cuando se emitió el corte. Volver a
 * consultar el Taller de Producto cambiaría retroactivamente cómo se paga un
 * documento ya emitido. La ESPECIFICACIÓN 3 lo dejó ahí justamente para esto.
 *
 * ── De dónde sale el dinero (§24, §43, §44) ──────────────────────────────
 * El disponible NO es sólo el pago recibido: es el saldo de la Cuenta EJE ya
 * incrementado con ese pago. Así, un remanente de una aplicación anterior
 * vuelve a participar sin tratamiento especial.
 */

/** Centavos exactos: evita que 0.1 + 0.2 deje un saldo de 3e-17 sin pagar. */
export const money = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

export type EstatusPago = 'Pendiente' | 'Parcial' | 'Pagado';

/** Una línea de detalle de CxC, tal como la dejó la ESPECIFICACIÓN 3. */
export interface DetalleCxC {
  id: string;
  claveConcepto: string;
  nombreConcepto: string;
  /** Importe original de la línea. */
  monto: number;
  /** Acumulado ya pagado (§14, §18): NO se sobrescribe, se suma. */
  pagoTotal: number;
  /** §9 — la prelación congelada en la emisión, no la vigente del producto. */
  ordenPrelacion: number;
  estatusPago?: EstatusPago;
}

/** Un Aviso de Vencimiento / CxC del cliente. */
export interface DocumentoCxC {
  id: string;
  folio?: string;
  /** §35 — el contrato/producto al que pertenece; agrupa los abonos (§36). */
  idContrato: string;
  fechaVencimiento: string;
  fechaDocumento: string;
  montoTotalPagar: number;
  pagoTotal: number;
  estatus?: string;
  detalle: DetalleCxC[];
}

/** Lo que se aplicará a una línea. Cada uno será un renglón histórico (§15). */
export interface AplicacionDetalle {
  idCxC: string;
  /** §15 — se conserva para la trazabilidad por contrato. */
  idContrato: string;
  idDetalle: string;
  claveConcepto: string;
  nombreConcepto: string;
  ordenPrelacion: number;
  montoAplicado: number;
  saldoAnterior: number;
  saldoPosterior: number;
  pagoTotalNuevo: number;
  estatusPagoNuevo: EstatusPago;
}

/** Lo que se aplicará a un documento completo (§22). */
export interface AplicacionCxC {
  idCxC: string;
  folio?: string;
  idContrato: string;
  montoAplicado: number;
  saldoAnterior: number;
  saldoPosterior: number;
  pagoTotalNuevo: number;
  estatusNuevo: EstatusPago;
  lineasAfectadas: number;
}

/** §36 — cuánto se abonará a cada contrato. */
export interface AbonoContrato {
  idContrato: string;
  monto: number;
}

export interface ResultadoAplicacionPago {
  ok: boolean;
  error?: string;
  pasoFallido?: string;

  /** §24 — saldo EJE + pago, antes de aplicar. */
  montoDisponibleInicial: number;
  montoPagoRecibido: number;
  /** §29 — suma de todo lo aplicado. Nunca mayor al disponible. */
  montoTotalAplicado: number;
  /** §30 — lo que se queda en la Cuenta EJE. */
  saldoRemanenteEje: number;

  saldoEjeAnterior: number;
  /** §5 tras el abono, §32 tras el cargo. */
  saldoEjePosterior: number;

  aplicacionesDetalle: AplicacionDetalle[];
  aplicacionesCxC: AplicacionCxC[];
  abonosPorContrato: AbonoContrato[];

  /** §55 — resumen para el usuario. */
  cxcAfectadas: number;
  lineasAfectadas: number;
  contratosAfectados: number;

  /** §42 — cómo queda el Pago Referenciado. */
  estatusPagoReferenciado: 'Aplicado' | 'Aplicado Parcialmente' | 'Pendiente de Aplicación';

  /** §48/§49 — las igualdades que deben cuadrar; vacío significa que cuadran. */
  descuadres: string[];
}

const estatusPorMontos = (pagoTotal: number, monto: number): EstatusPago => {
  if (pagoTotal <= 0) return 'Pendiente';
  if (pagoTotal >= monto) return 'Pagado';
  return 'Parcial';
};

const aTiempo = (f?: string): number => {
  const t = new Date(`${String(f || '').slice(0, 10)}T00:00:00`).getTime();
  return isNaN(t) ? Number.POSITIVE_INFINITY : t;
};

/**
 * §7 + §7.1 + §57 — orden determinístico de los documentos.
 * Exportado para poder probarlo y reusarlo en la vista previa.
 */
export function ordenarDocumentos(docs: DocumentoCxC[]): DocumentoCxC[] {
  return [...(docs || [])].sort((a, b) => {
    const va = aTiempo(a.fechaVencimiento), vb = aTiempo(b.fechaVencimiento);
    if (va !== vb) return va - vb;
    const da = aTiempo(a.fechaDocumento), db = aTiempo(b.fechaDocumento);
    if (da !== db) return da - db;
    return String(a.id).localeCompare(String(b.id));
  });
}

/** §9 + §57 — sólo las líneas pagables, en orden de prelación. */
export function ordenarDetalle(detalle: DetalleCxC[]): DetalleCxC[] {
  return (detalle || [])
    .filter(d => money(d.monto - (d.pagoTotal || 0)) > 0)   // §28: Parcial sigue siendo elegible
    .sort((a, b) => {
      if (a.ordenPrelacion !== b.ordenPrelacion) return a.ordenPrelacion - b.ordenPrelacion;
      return String(a.id).localeCompare(String(b.id));
    });
}

/**
 * Distribuye un pago siguiendo la prelación de dos niveles.
 *
 * @param saldoEjeAnterior saldo de la Cuenta EJE ANTES del abono del pago.
 */
export function aplicarPago(params: {
  montoPago: number;
  saldoEjeAnterior: number;
  documentos: DocumentoCxC[];
  idCuentaEje?: string | null;
  idCliente?: string;
  idPagoReferenciado?: string;
}): ResultadoAplicacionPago {
  const { documentos } = params;
  const montoPago = money(params.montoPago);
  const saldoEjeAnterior = money(params.saldoEjeAnterior);

  const base: ResultadoAplicacionPago = {
    ok: false,
    montoDisponibleInicial: 0,
    montoPagoRecibido: montoPago,
    montoTotalAplicado: 0,
    saldoRemanenteEje: 0,
    saldoEjeAnterior,
    saldoEjePosterior: saldoEjeAnterior,
    aplicacionesDetalle: [],
    aplicacionesCxC: [],
    abonosPorContrato: [],
    cxcAfectadas: 0,
    lineasAfectadas: 0,
    contratosAfectados: 0,
    estatusPagoReferenciado: 'Pendiente de Aplicación',
    descuadres: [],
  };

  // ── §47 — validaciones previas ──
  if (!(montoPago > 0)) {
    return { ...base, error: 'El monto del pago debe ser mayor a cero.', pasoFallido: '§47 — validación del pago' };
  }
  // §3 — sin Cuenta EJE válida no hay dónde abonar; se revierte todo.
  if (!String(params.idCuentaEje || '').trim()) {
    return {
      ...base,
      error:
        `No se encontró una Cuenta EJE válida para el Cliente "${params.idCliente || ''}" ` +
        `asociado al Pago Referenciado "${params.idPagoReferenciado || ''}".`,
      pasoFallido: '§3 — Cuenta EJE',
    };
  }

  // ── §4/§5 — el abono entra a la Cuenta EJE ANTES de aplicar ──
  // Por eso el disponible incluye cualquier remanente previo (§43, §44).
  const montoDisponibleInicial = money(saldoEjeAnterior + montoPago);
  let disponible = montoDisponibleInicial;

  const aplicacionesDetalle: AplicacionDetalle[] = [];
  const aplicacionesCxC: AplicacionCxC[] = [];

  // ── §24 — recorrido de dos niveles ──
  for (const doc of ordenarDocumentos(documentos)) {
    if (disponible <= 0) break;                       // §24 BREAK
    if (String(doc.estatus || '').toLowerCase() === 'pagado') continue;  // §6

    const pagoTotalDocAntes = money(doc.pagoTotal || 0);
    const saldoDocAntes = money(doc.montoTotalPagar - pagoTotalDocAntes);
    if (saldoDocAntes <= 0) continue;                 // §8 — nada que aplicar

    let aplicadoEnDoc = 0;
    let lineasDelDoc = 0;

    for (const det of ordenarDetalle(doc.detalle)) {
      if (disponible <= 0) break;                     // §24 BREAK interno

      const pagoTotalAntes = money(det.pagoTotal || 0);
      const saldoLinea = money(det.monto - pagoTotalAntes);
      if (saldoLinea <= 0) continue;

      // §13 — nunca más que el saldo de la línea: así PagoTotal no rebasa
      // el Monto (§12), sin necesidad de un tope posterior.
      const montoAplicado = money(Math.min(disponible, saldoLinea));
      if (montoAplicado <= 0) continue;

      const pagoTotalNuevo = money(pagoTotalAntes + montoAplicado);

      aplicacionesDetalle.push({
        idCxC: doc.id,
        idContrato: doc.idContrato,
        idDetalle: det.id,
        claveConcepto: det.claveConcepto,
        nombreConcepto: det.nombreConcepto,
        ordenPrelacion: det.ordenPrelacion,
        montoAplicado,
        saldoAnterior: saldoLinea,
        saldoPosterior: money(saldoLinea - montoAplicado),
        pagoTotalNuevo,
        estatusPagoNuevo: estatusPorMontos(pagoTotalNuevo, det.monto),
      });

      disponible = money(disponible - montoAplicado);
      aplicadoEnDoc = money(aplicadoEnDoc + montoAplicado);
      lineasDelDoc++;
    }

    if (aplicadoEnDoc > 0) {
      const pagoTotalDocNuevo = money(pagoTotalDocAntes + aplicadoEnDoc);
      aplicacionesCxC.push({
        idCxC: doc.id,
        folio: doc.folio,
        idContrato: doc.idContrato,
        montoAplicado: aplicadoEnDoc,
        saldoAnterior: saldoDocAntes,
        saldoPosterior: money(saldoDocAntes - aplicadoEnDoc),
        pagoTotalNuevo: pagoTotalDocNuevo,
        // §19 — el estatus del header sale de sus propios acumulados
        estatusNuevo: estatusPorMontos(pagoTotalDocNuevo, doc.montoTotalPagar),
        lineasAfectadas: lineasDelDoc,
      });
    }
  }

  const montoTotalAplicado = money(aplicacionesDetalle.reduce((a, x) => a + x.montoAplicado, 0));

  // ── §36 — agrupar por contrato, conservando la distribución real (§39) ──
  const porContrato = new Map<string, number>();
  for (const a of aplicacionesCxC) {
    porContrato.set(a.idContrato, money((porContrato.get(a.idContrato) || 0) + a.montoAplicado));
  }
  const abonosPorContrato: AbonoContrato[] = [...porContrato.entries()]
    .map(([idContrato, monto]) => ({ idContrato, monto }))
    .sort((a, b) => a.idContrato.localeCompare(b.idContrato));

  // ── §30/§32 — el cargo a la EJE es el aplicado, no el pago recibido (§33) ──
  const saldoRemanenteEje = money(montoDisponibleInicial - montoTotalAplicado);

  // ── §48/§49 — las igualdades que deben cuadrar ──
  const descuadres: string[] = [];
  const sumaCxC = money(aplicacionesCxC.reduce((a, x) => a + x.montoAplicado, 0));
  const sumaContratos = money(abonosPorContrato.reduce((a, x) => a + x.monto, 0));
  if (sumaCxC !== montoTotalAplicado) {
    descuadres.push(`§49: la suma por CxC (${sumaCxC}) no coincide con el total aplicado (${montoTotalAplicado}).`);
  }
  if (sumaContratos !== montoTotalAplicado) {
    descuadres.push(`§49: la suma por contrato (${sumaContratos}) no coincide con el total aplicado (${montoTotalAplicado}).`);
  }
  if (montoTotalAplicado > montoDisponibleInicial) {
    descuadres.push(`§29: se aplicó más (${montoTotalAplicado}) que el disponible (${montoDisponibleInicial}).`);
  }
  // §48 — header contra detalle, documento por documento
  for (const a of aplicacionesCxC) {
    const sumaDet = money(
      aplicacionesDetalle.filter(d => d.idCxC === a.idCxC).reduce((s, d) => s + d.montoAplicado, 0),
    );
    if (sumaDet !== a.montoAplicado) {
      descuadres.push(`§48: en la CxC ${a.folio || a.idCxC} el header (${a.montoAplicado}) no cuadra con su detalle (${sumaDet}).`);
    }
  }

  // ── §42 — estado del Pago Referenciado ──
  // Se mide contra el pago recibido, no contra el disponible: aplicar el
  // remanente de un pago anterior no vuelve "total" a este pago.
  const estatusPagoReferenciado: ResultadoAplicacionPago['estatusPagoReferenciado'] =
    montoTotalAplicado >= montoPago ? 'Aplicado'
    : montoTotalAplicado > 0 ? 'Aplicado Parcialmente'
    : 'Pendiente de Aplicación';

  return {
    ok: true,
    montoDisponibleInicial,
    montoPagoRecibido: montoPago,
    montoTotalAplicado,
    saldoRemanenteEje,
    saldoEjeAnterior,
    // §5 sube por el pago, §32 baja por lo aplicado.
    saldoEjePosterior: saldoRemanenteEje,
    aplicacionesDetalle,
    aplicacionesCxC,
    abonosPorContrato,
    cxcAfectadas: aplicacionesCxC.length,
    lineasAfectadas: aplicacionesDetalle.length,
    contratosAfectados: abonosPorContrato.length,
    estatusPagoReferenciado,
    descuadres,
  };
}
