/**
 * contabilizarEventoTDC — capa transaccional de la ESPECIFICACIÓN 5.
 *
 * El motor (`motorContableTDC`) arma la póliza; este módulo la persiste en UNA
 * llamada a `contabilizar_evento_tdc` (§58, §59, §86) y marca el documento
 * origen como contabilizado — sólo después de que la póliza quedó cuadrada
 * (§93.20).
 *
 * Cuarto gemelo de `aplicarMovimientoTDC`, `aplicarCierreCorteTDC` y
 * `aplicarPagoReferenciado`. Mismo contrato, mismas garantías.
 *
 * ── Las cuatro funciones de evento son envoltorios, no motores (§8) ──────
 * `contabilizarActivacion`, `contabilizarCorte`, `contabilizarAplicacionPagos`
 * y `reclasificarSaldo` sólo saben DE DÓNDE salen los componentes. El asiento
 * lo arma siempre `contabilizarEvento()` y lo escribe siempre el mismo RPC.
 */
import { supabase } from './supabaseClient';
import {
  contabilizarEvento,
  componentesDeActivacion,
  componentesDeCorte,
  componentesDeAplicacionPagos,
  componentesDeReclasificacion,
  claveIdempotencia,
  EVENTOS,
  type ClaveEvento,
  type ComponenteContable,
  type PolizaArmada,
  type RenglonCxC,
  type RenglonAplicacion,
} from './motorContableTDC';

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  CONTABILIZACIÓN AUTOMÁTICA — APAGADA
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Mientras se prueba el flujo operativo (movimientos → cargos → corte →
 * pagos), ningún evento genera su póliza. Los documentos quedan SIN
 * contabilizar, que es justo lo que se quiere: probar la operación sin
 * ensuciar el mayor con asientos de prueba.
 *
 * Para reactivarla: poner `true`. Es lo único que hay que tocar — los cuatro
 * eventos pasan por aquí, así que no queda ninguno encendido por descuido.
 *
 * NO deja nada a medias: al estar apagada, la operación se completa igual y el
 * documento simplemente no se marca como contabilizado. Como la
 * contabilización es idempotente por clave lógica (§53), al reactivarla se
 * pueden contabilizar los documentos pendientes sin duplicar nada.
 */
export const CONTABILIZACION_AUTOMATICA = false;

/** Resultado neutro cuando la contabilización está apagada. */
function omitida(poliza: PolizaArmada, evento: string): ResultadoContable {
  console.info(
    `[Contabilidad] ${evento}: omitida — CONTABILIZACION_AUTOMATICA está en false ` +
    `(src/app/lib/contabilizarEventoTDC.ts). El documento queda pendiente de contabilizar.`,
  );
  return { ok: true, poliza, persistido: false, pendiente: true };
}

export interface ContextoContable {
  /** `data.motorContable` del producto — la Guía Contabilizadora (§2). */
  guia: any[] | null | undefined;
  productoId?: string;
  claveProducto?: string;
  nombreProducto?: string;
  clienteId?: string;
  lineaId?: string;
  cuentaId?: string;
  usuario?: string;
  correlationId?: string;
}

export interface ResultadoContable {
  ok: boolean;
  error?: string;
  pasoFallido?: string;
  /** La póliza armada — sirve para mostrarla aunque no se persista. */
  poliza: PolizaArmada;
  persistido: boolean;
  /** true cuando NO se contabilizó porque la automatización está apagada. */
  pendiente?: boolean;
  polizaId?: string;
  numeroPoliza?: string;
  /** true cuando el evento ya estaba contabilizado y no se duplicó (§53). */
  yaEstaba?: boolean;
}

/** Núcleo común: arma, valida y persiste. Los cuatro eventos pasan por aquí. */
async function ejecutar(params: {
  ctx: ContextoContable;
  claveEvento: ClaveEvento;
  componentes: ComponenteContable[];
  fechaContable: string;
  tipoDocumento: string;
  idDocumentoOrigen: string;
  cxcId?: string | null;
  detallesOrigen?: string[];
  soloSimular?: boolean;
}): Promise<ResultadoContable> {
  const { ctx, claveEvento, componentes, fechaContable, idDocumentoOrigen } = params;

  const poliza = contabilizarEvento({
    guia: ctx.guia,
    claveEvento,
    componentes,
    fechaContable,
    idDocumentoOrigen,
    claveProducto: ctx.claveProducto,
    nombreProducto: ctx.nombreProducto,
  });

  // §60/§61/§62 — cualquiera de estos deja el evento SIN contabilizar.
  if (!poliza.ok) {
    // Con la automatización apagada, una guía incompleta no debe frenar la
    // operación: se reporta en consola y el documento sigue su curso.
    if (!CONTABILIZACION_AUTOMATICA) return omitida(poliza, claveEvento);
    return { ok: false, error: poliza.error, pasoFallido: poliza.pasoFallido, poliza, persistido: false };
  }
  if (!CONTABILIZACION_AUTOMATICA) return omitida(poliza, claveEvento);
  if (params.soloSimular) {
    return { ok: true, poliza, persistido: false };
  }

  try {
    const { data, error } = await supabase.rpc('contabilizar_evento_tdc', {
      p_clave_evento: claveEvento,
      p_tipo_documento: params.tipoDocumento,
      p_id_documento_origen: idDocumentoOrigen,
      p_clave_idempotencia: claveIdempotencia(claveEvento, idDocumentoOrigen),
      p_fecha_contable: fechaContable,
      p_partidas: poliza.partidas,
      p_total_debe: poliza.totalDebe,
      p_total_haber: poliza.totalHaber,
      p_monto_contabilizado: poliza.montoContabilizado,
      p_producto_id: ctx.productoId || null,
      p_cliente_id: ctx.clienteId || null,
      p_linea_id: ctx.lineaId || null,
      p_cxc_id: params.cxcId || null,
      p_cuenta_id: ctx.cuentaId || null,
      p_usuario: ctx.usuario || 'Sistema',
      p_correlation_id: ctx.correlationId || null,
      p_detalles_origen: params.detallesOrigen || [],
    });

    if (error) {
      // §59 — ROLLBACK completo: ni póliza parcial ni marca de contabilizado.
      return { ok: false, error: traducirErrorContable(error.message || String(error)), poliza, persistido: false };
    }

    const fila = Array.isArray(data) ? data[0] : data;
    return {
      ok: true,
      poliza,
      persistido: true,
      polizaId: fila?.poliza_id,
      numeroPoliza: fila?.numero_poliza,
      yaEstaba: String(fila?.mensaje || '').includes('idempotente'),
    };
  } catch (e: any) {
    return { ok: false, error: traducirErrorContable(e?.message || 'Error desconocido.'), poliza, persistido: false };
  }
}

/** §11-§16 — ACTIVACIÓN_LINEA. Cuentas de orden por el límite autorizado. */
export function contabilizarActivacion(params: {
  ctx: ContextoContable;
  idLineaCredito: string;
  montoAprobado: number;
  fechaActivacion: string;
  claveComponente?: string;
  soloSimular?: boolean;
}) {
  return ejecutar({
    ctx: params.ctx,
    claveEvento: EVENTOS.ACTIVACION_LINEA,
    componentes: componentesDeActivacion(params.montoAprobado, params.claveComponente),
    fechaContable: params.fechaActivacion,
    tipoDocumento: 'LINEA',
    idDocumentoOrigen: params.idLineaCredito,
    soloSimular: params.soloSimular,
  });
}

/**
 * §17-§26 — CORTE_PERIODO.
 * §19: la fecha contable es la FechaDocumento, que la ESPECIFICACIÓN 3 fijó
 * igual a FechaFin del periodo.
 */
export async function contabilizarCorte(params: {
  ctx: ContextoContable;
  idCxC: string;
  detalle: RenglonCxC[];
  montoTotalPagar: number;
  fechaDocumento: string;
  soloSimular?: boolean;
}): Promise<ResultadoContable> {
  const { componentes, error } = componentesDeCorte(params.detalle, params.montoTotalPagar);

  if (error) {
    // §24 — documento operativo inconsistente: no se contabiliza.
    // Con la contabilidad apagada esto no es un fallo que reportar: el corte
    // operativo ya se hizo y la póliza no se iba a generar de todos modos.
    const vacia: PolizaArmada = {
      ok: false, claveEvento: EVENTOS.CORTE_PERIODO, fechaContable: params.fechaDocumento,
      partidas: [], totalDebe: 0, totalHaber: 0, cuadrada: false, montoContabilizado: 0,
    };
    if (!CONTABILIZACION_AUTOMATICA) return omitida(vacia, EVENTOS.CORTE_PERIODO);
    return {
      ok: false, error, pasoFallido: '§24 — CxC inconsistente', persistido: false,
      poliza: {
        ok: false, claveEvento: EVENTOS.CORTE_PERIODO, fechaContable: params.fechaDocumento,
        partidas: [], totalDebe: 0, totalHaber: 0, cuadrada: false, montoContabilizado: 0,
      },
    };
  }

  return ejecutar({
    ctx: params.ctx,
    claveEvento: EVENTOS.CORTE_PERIODO,
    componentes,
    fechaContable: params.fechaDocumento,
    tipoDocumento: 'CXC',
    idDocumentoOrigen: params.idCxC,
    cxcId: params.idCxC,
    soloSimular: params.soloSimular,
  });
}

/**
 * §27-§35 — APLICACIÓN_PAGOS.
 * §33: una ejecución del proceso produce UNA póliza, aunque toque varias CxC.
 * §28: sólo lo realmente aplicado, nunca el monto del Pago Referenciado.
 */
export function contabilizarAplicacionPagos(params: {
  ctx: ContextoContable;
  idProcesoAplicacion: string;
  aplicaciones: RenglonAplicacion[];
  fechaAplicacion: string;
  soloSimular?: boolean;
}) {
  return ejecutar({
    ctx: params.ctx,
    claveEvento: EVENTOS.APLICACION_PAGOS,
    componentes: componentesDeAplicacionPagos(params.aplicaciones),
    fechaContable: params.fechaAplicacion,
    tipoDocumento: 'PROCESO_PAGO',
    idDocumentoOrigen: params.idProcesoAplicacion,
    // §32 — cada aplicación se marca; el RPC falla si alguna ya lo estaba.
    detallesOrigen: (params.aplicaciones || []).filter(a => a.montoAplicado > 0).map(a => a.id),
    soloSimular: params.soloSimular,
  });
}

export interface ResultadoReclasificacion extends ResultadoContable {
  cargoId?: string;
  saldoReclasificado?: number;
  conceptos?: number;
}

/**
 * §36-§50, §70 — RECLASIFICACIÓN_SALDO.
 *
 * Los diez pasos de §70 viven en `reclasificar_saldo_cxc`, no aquí: póliza,
 * cierre de la CxC, Cargo Saldo Anterior y composición son indivisibles (§85).
 */
export async function reclasificarSaldo(params: {
  ctx: ContextoContable;
  idCxC: string;
  detalle: RenglonCxC[];
  saldoPendiente: number;
  fechaContable: string;
  /** §42 — la clave configurada en el catálogo; '010' es sólo el ejemplo. */
  claveSaldoAnterior: string;
  nombreSaldoAnterior?: string;
  ordenPrelacion?: Record<string, number>;
  soloSimular?: boolean;
}): Promise<ResultadoReclasificacion> {
  const { ctx } = params;

  const vacia: PolizaArmada = {
    ok: false, claveEvento: EVENTOS.RECLASIFICACION_SALDO, fechaContable: params.fechaContable,
    partidas: [], totalDebe: 0, totalHaber: 0, cuadrada: false, montoContabilizado: 0,
  };

  const { componentes, composicion, saldoTotal, error } = componentesDeReclasificacion(
    params.detalle, params.saldoPendiente, params.ordenPrelacion,
  );
  if (error) {
    if (!CONTABILIZACION_AUTOMATICA) return omitida(vacia, EVENTOS.RECLASIFICACION_SALDO);
    return { ok: false, error, pasoFallido: '§39/§72 — saldo inconsistente', poliza: vacia, persistido: false };
  }

  const poliza = contabilizarEvento({
    guia: ctx.guia,
    claveEvento: EVENTOS.RECLASIFICACION_SALDO,
    componentes,
    fechaContable: params.fechaContable,
    idDocumentoOrigen: params.idCxC,
    claveProducto: ctx.claveProducto,
    nombreProducto: ctx.nombreProducto,
  });

  if (!poliza.ok) {
    if (!CONTABILIZACION_AUTOMATICA) return omitida(poliza, EVENTOS.RECLASIFICACION_SALDO);
    return { ok: false, error: poliza.error, pasoFallido: poliza.pasoFallido, poliza, persistido: false };
  }
  // La reclasificación es indivisible de su póliza (§85): con la contabilidad
  // apagada NO se ejecuta a medias — se omite entera.
  if (!CONTABILIZACION_AUTOMATICA) return omitida(poliza, EVENTOS.RECLASIFICACION_SALDO);
  if (params.soloSimular) {
    return { ok: true, poliza, persistido: false, saldoReclasificado: saldoTotal, conceptos: composicion.length };
  }

  try {
    const { data, error: errRpc } = await supabase.rpc('reclasificar_saldo_cxc', {
      p_cxc_id: params.idCxC,
      p_linea_id: ctx.lineaId || null,
      p_cliente_id: ctx.clienteId || null,
      p_producto_id: ctx.productoId || null,
      p_fecha_contable: params.fechaContable,
      p_clave_saldo_ant: params.claveSaldoAnterior,
      p_nombre_saldo_ant: params.nombreSaldoAnterior || 'Saldo Anterior',
      p_partidas: poliza.partidas,
      p_composicion: composicion,
      p_saldo_total: saldoTotal,
      p_monto_poliza: poliza.totalDebe,
      p_usuario: ctx.usuario || 'Sistema',
      p_correlation_id: ctx.correlationId || null,
    });

    if (errRpc) {
      return { ok: false, error: traducirErrorContable(errRpc.message || String(errRpc)), poliza, persistido: false };
    }

    const fila = Array.isArray(data) ? data[0] : data;
    return {
      ok: true,
      poliza,
      persistido: true,
      polizaId: fila?.poliza_id,
      cargoId: fila?.cargo_id,
      saldoReclasificado: fila?.saldo_reclasificado != null ? Number(fila.saldo_reclasificado) : saldoTotal,
      conceptos: fila?.conceptos != null ? Number(fila.conceptos) : composicion.length,
    };
  } catch (e: any) {
    return { ok: false, error: traducirErrorContable(e?.message || 'Error desconocido.'), poliza, persistido: false };
  }
}

/** §79/§80 — qué pólizas tiene un documento. */
export async function obtenerContabilizaciones(tipoDocumento: string, idDocumento: string) {
  try {
    const { data, error } = await supabase.rpc('obtener_contabilizaciones', {
      p_tipo_documento: tipoDocumento,
      p_id_documento: idDocumento,
    });
    if (error) return { ok: false, filas: [] as any[], error: traducirErrorContable(error.message) };
    return { ok: true, filas: (Array.isArray(data) ? data : []) as any[] };
  } catch (e: any) {
    return { ok: false, filas: [] as any[], error: traducirErrorContable(e?.message || '') };
  }
}

function traducirErrorContable(msg: string): string {
  const m = (msg || '').toLowerCase();
  if (m.includes('could not find the function') || m.includes('42883') || m.includes('pgrst202')) {
    return (
      'Las funciones de contabilidad no existen en la base de datos. ' +
      'Ejecute supabase/migrations/create_rpc_contabilidad_tdc.sql (después de las tres anteriores).'
    );
  }
  if (m.includes('ux_contab_clave_vigente') || m.includes('duplicate key')) {
    return 'Este evento ya estaba contabilizado. No se generó una segunda póliza.';
  }
  if (m.includes('no se encuentra cuadrada')) return msg;
  if (m.includes('ya fue reclasificada')) return msg;
  if (m.includes('ya estaba contabilizada')) return msg;
  return `No se pudo contabilizar el evento: ${msg}`;
}
