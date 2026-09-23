/**
 * aplicarReclasificacionTDC — ESPECIFICACIÓN 9, la capa que ejecuta.
 *
 * El motor decide qué movimientos proceden; aquí se registran y se cierran los
 * Avisos parciales.
 *
 * ── Por qué se pasa por `aplicarMovimientoTDC` ───────────────────────────
 * §1.1.1 pide que los movimientos entren "por las APIs correspondientes, para
 * que se ejecute el proceso natural del procesamiento". Insertar directo en
 * J_MOVIMIENTOS_LINEA sería más corto y saltaría todo lo que ESPEC 1 y 2
 * exigen: validación contra Cargos Permitidos, Afectación de la Línea,
 * promociones, consumo de disponible, cargo a la Cuenta EJE e idempotencia.
 * Por eso se usa el mismo camino que la captura manual.
 *
 * ── El orden importa ─────────────────────────────────────────────────────
 * Primero los movimientos, después la reclasificación de los Avisos. Si se
 * cerraran los Avisos primero y fallara un movimiento, el saldo quedaría sin
 * cobrar en ningún lado. Al revés, el peor caso es un saldo cobrado en la
 * Línea con el Aviso todavía parcial: visible, reversible y detectable.
 */
import { supabase } from './supabaseClient';
import { aplicarMovimientoTDC } from './aplicarMovimientoTDC';
import {
  planReclasificacion,
  type MovimientoReclasificacion,
  type ParamsReclasificacion,
  type ResultadoReclasificacion,
} from './motorReclasificacionTDC';

export interface MovimientoAplicado extends MovimientoReclasificacion {
  ok: boolean;
  error?: string;
  movimientoId?: string;
}

export interface ResultadoAplicacionReclasificacion {
  ok: boolean;
  error?: string;
  /** Lo que decidió el motor; sirve para explicar aunque no se aplique nada. */
  plan: ResultadoReclasificacion;
  movimientos: MovimientoAplicado[];
  /** §2 — Avisos que pasaron a 'Pagado x Reclasificación'. */
  avisosReclasificados: number;
  saldoReclasificado: number;
  advertencias: string[];
}

export interface ContextoReclasificacion {
  idLineaCredito: string;
  idCliente: string;
  montoAutorizado?: number;
  saldoDisponible: number;
  /** Configuración del producto que exige `aplicarMovimientoTDC`. */
  producto: any;
  catalogo: { codigo: string; nombre: string }[];
  usuario?: string;
  /** Id del Estado de Cuenta que disparó la reclasificación (trazabilidad). */
  idEstadoCuenta?: string;
}

/**
 * Corre la ESPECIFICACIÓN 9 completa.
 *
 * No aborta al primer movimiento fallido: registra lo que pueda y reporta
 * cuál falló. Un interés rechazado por configuración no debería impedir que
 * el Saldo Anterior —que es el cargo importante— quede asentado.
 *
 * La reclasificación de Avisos SÓLO corre si el Saldo Anterior se registró:
 * es la condición que evita cerrar un Aviso cuyo saldo no se reinyectó.
 */
export async function aplicarReclasificacion(
  params: ParamsReclasificacion,
  ctx: ContextoReclasificacion,
): Promise<ResultadoAplicacionReclasificacion> {
  const plan = planReclasificacion(params);

  const base: ResultadoAplicacionReclasificacion = {
    ok: false, plan, movimientos: [], avisosReclasificados: 0,
    saldoReclasificado: 0, advertencias: [...plan.advertencias],
  };

  if (!plan.ok) return { ...base, ok: true, error: plan.motivo };

  // ── §1 / §1.1.1 — los movimientos, por la API de siempre ──
  const aplicados: MovimientoAplicado[] = [];
  let saldoDisponible = Number(ctx.saldoDisponible) || 0;

  for (const mov of plan.movimientos) {
    const res = await aplicarMovimientoTDC({
      movimiento: {
        clave: mov.clave,
        descripcion: mov.descripcion,
        monto: mov.monto,
        fecha: mov.fecha,
      },
      producto: ctx.producto,
      catalogo: ctx.catalogo,
      saldoDisponible,
      montoAutorizado: ctx.montoAutorizado,
      idLineaCredito: ctx.idLineaCredito,
      idCliente: ctx.idCliente,
      // Idempotencia (§8 de ESPEC 1): dos cierres del MISMO Estado de Cuenta
      // traen el mismo identificador y el segundo no vuelve a cargar nada.
      correlationId: `reclas|${ctx.idEstadoCuenta || ctx.idLineaCredito}|${mov.origen}`,
    });

    aplicados.push({
      ...mov,
      ok: res.ok,
      error: res.ok ? undefined : `${res.pasoFallido ? `[${res.pasoFallido}] ` : ''}${res.error || ''}`,
      movimientoId: (res as any).movimientoId,
    });

    // El disponible que ve el siguiente movimiento es el que dejó el anterior.
    if (res.ok && typeof (res as any).saldoDisponible === 'number') {
      saldoDisponible = (res as any).saldoDisponible;
    }
  }

  const saldoAnterior = aplicados.find(m => m.origen === 'saldoAnterior');
  const fallidos = aplicados.filter(m => !m.ok);

  for (const f of fallidos) {
    base.advertencias.push(`No se registró "${f.descripcion}" (${f.clave}): ${f.error}`);
  }

  if (!saldoAnterior?.ok) {
    return {
      ...base,
      movimientos: aplicados,
      error:
        'No se registró el cargo "Saldo Anterior", así que los Avisos NO se reclasificaron: ' +
        'cerrarlos dejaría el saldo sin cobrar en ninguna parte.',
    };
  }

  // ── §2 — cerrar los Avisos parciales ──
  try {
    const { data, error } = await supabase.rpc('reclasificar_avisos_parciales', {
      p_linea_id: String(ctx.idLineaCredito),
      p_estado_cuenta_id: ctx.idEstadoCuenta || null,
      p_usuario: ctx.usuario || 'Sistema',
      p_correlation_id: `reclas|${ctx.idEstadoCuenta || ctx.idLineaCredito}`,
    });

    if (error) {
      return {
        ...base,
        movimientos: aplicados,
        error: traducirErrorReclasificacion(error.message || String(error)),
      };
    }

    const fila = Array.isArray(data) ? data[0] : data;
    return {
      ...base,
      ok: true,
      movimientos: aplicados,
      avisosReclasificados: Number(fila?.avisos) || 0,
      saldoReclasificado: Number(fila?.saldo_total) || 0,
    };
  } catch (e: any) {
    return {
      ...base,
      movimientos: aplicados,
      error: traducirErrorReclasificacion(e?.message || 'Error al reclasificar los Avisos.'),
    };
  }
}

export function traducirErrorReclasificacion(msg: string): string {
  const m = String(msg || '');
  if (/PGRST202|Could not find the function/i.test(m)) {
    return 'La función de reclasificación no existe en la base. Ejecute ' +
           'supabase/migrations/create_rpc_reclasificacion_tdc.sql (ESPECIFICACIÓN 9).';
  }
  if (/chk_cxc_linea_estatus/i.test(m)) {
    return 'El estatus "Pagado x Reclasificación" no está permitido en la base. ' +
           'Ejecute create_rpc_reclasificacion_tdc.sql, que amplía el CHECK.';
  }
  return m;
}
