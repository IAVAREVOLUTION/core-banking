/**
 * aplicarMovimientoTDC — capa transaccional del prewrite (§4, §5, §7, §8).
 *
 * El motor (`motorMovimientosTDC`) decide QUÉ pasa; este módulo decide CÓMO se
 * escribe, y lo hace en UNA sola llamada al RPC `aplicar_movimiento_tdc`, que
 * corre dentro de una transacción de Postgres.
 *
 * ── Por qué aquí y no en el componente ───────────────────────────────────
 * §0 exige que la lógica funcione igual venga de la UI o de un API. Este
 * módulo es el punto único de persistencia: la pantalla y cualquier endpoint
 * llaman lo mismo. No hay `fire-and-forget` ni proceso en background: se
 * espera el resultado antes de dar por bueno el movimiento (§6).
 *
 * ── Resolución de la Cuenta EJE (§1.1.2) ─────────────────────────────────
 * La especificación prohíbe asumir `IdCliente == IdCuentaEje`. Aquí se busca
 * la cuenta marcada como eje del cliente por el mismo endpoint que ya usa la
 * pantalla de Movimientos de Personas, y se pasa al motor ya resuelta.
 */
import { supabase } from './supabaseClient';
import { buscarCuentaEje } from '../hooks/useCuentaEjeGenerator';
import {
  ejecutarMovimientoTDC,
  type ConfigProductoTDC,
  type ComponenteRef,
  type MovimientoEntrada,
  type ResultadoMotor,
} from './motorMovimientosTDC';

/**
 * §1.1.2 — Cuenta EJE del cliente, por la relación del modelo.
 *
 * Delega en `buscarCuentaEje`, el único resolver de la relación Cliente → Cuenta
 * Eje, en lugar de volver a consultar `/cuentas-ahorro` por su cuenta: así el
 * criterio de qué cuenta es la eje vive en un solo lugar.
 *
 * Devuelve null cuando el cliente no tiene ninguna marcada como eje.
 */
export async function resolverCuentaEje(idCliente: string): Promise<string | null> {
  const cuenta = await buscarCuentaEje(idCliente);
  return cuenta?.id || null;
}

export interface ResultadoAplicacion {
  ok: boolean;
  error?: string;
  pasoFallido?: string;
  /** Resultado del motor — sirve para pintar el desglose aunque no se persista. */
  motor: ResultadoMotor;
  /** true cuando el RPC confirmó la transacción. */
  persistido: boolean;
  movimientoId?: string;
  saldoDisponible?: number;
}

/**
 * Corre el motor y, si aprueba, persiste TODO en una transacción.
 *
 * @param correlationId §9 — identificador de la operación para la auditoría y
 *        para la idempotencia de §8: dos envíos del mismo movimiento comparten
 *        el mismo id y el RPC descarta el segundo.
 */
export async function aplicarMovimientoTDC(params: {
  movimiento: MovimientoEntrada;
  producto: ConfigProductoTDC;
  catalogo: ComponenteRef[];
  saldoDisponible: number;
  idLineaCredito: string;
  idCliente: string;
  /** Límite autorizado de la línea — siembra su saldo en la primera operación. */
  montoAutorizado?: number;
  idSolicitud?: string;
  correlationId?: string;
  /** Sólo simula: corre el motor sin escribir nada. */
  soloSimular?: boolean;
}): Promise<ResultadoAplicacion> {
  const {
    movimiento, producto, catalogo, saldoDisponible,
    idLineaCredito, idCliente, soloSimular,
  } = params;

  // §8 — sin un id estable, un doble clic se aplicaría dos veces. Se deriva de
  // los datos del movimiento para que el reintento del MISMO movimiento traiga
  // el mismo id, y uno distinto traiga otro.
  const correlationId =
    params.correlationId ||
    `${idLineaCredito}|${movimiento.clave}|${movimiento.fecha}|${movimiento.monto}|${movimiento.descripcion || ''}`;

  // ── §1.1.2 — resolver la Cuenta EJE ANTES de correr el motor ──
  // Sólo hace falta si la promoción del concepto declara cash back; si no, se
  // evita una consulta por cada movimiento.
  const prom = (producto.promComisImpuestos || []).find(
    p => String(p?.clave ?? '').trim().toLowerCase() === String(movimiento.clave).trim().toLowerCase(),
  );
  const tieneCashBack = !!prom && parseFloat(String((prom as any)?.porcentajeCashback?.valor ?? (prom as any)?.porcentajeCashback ?? '0').replace(/[%|\s]/g, '')) > 0;
  const idCuentaEje = tieneCashBack ? await resolverCuentaEje(idCliente) : null;

  const motor = ejecutarMovimientoTDC({
    movimiento,
    producto: { ...producto, idLineaCredito },
    catalogo,
    saldoDisponible,
    idCliente,
    idCuentaEje,
  });

  if (!motor.ok) {
    return { ok: false, error: motor.error, pasoFallido: motor.pasoFallido, motor, persistido: false };
  }
  if (soloSimular) {
    return { ok: true, motor, persistido: false };
  }

  // ── §4/§5 — una sola llamada, una sola transacción, sin commits internos ──
  try {
    const { data, error } = await supabase.rpc('aplicar_movimiento_tdc', {
      p_linea_id: idLineaCredito,
      p_cliente_id: idCliente,
      p_clave: movimiento.clave,
      p_concepto: motor.efectosLinea.find(e => e.origen === 'movimiento')?.nombre || movimiento.clave,
      p_descripcion: movimiento.descripcion,
      p_monto: movimiento.monto,
      p_fecha: movimiento.fecha,
      p_naturaleza: motor.efectosLinea.find(e => e.origen === 'movimiento')?.naturaleza || 'Cargo',
      p_efectos: motor.efectosLinea,
      p_calendario: motor.calendario,
      p_cuenta_eje: motor.efectosCuentaEje,
      p_correlation_id: correlationId,
      p_monto_autorizado: params.montoAutorizado ?? null,
    });

    if (error) {
      // El RPC hizo ROLLBACK: no quedó ninguna afectación parcial (§37).
      return {
        ok: false,
        error: traducirErrorRPC(error.message || String(error)),
        pasoFallido: 'Transacción',
        motor,
        persistido: false,
      };
    }

    const fila = Array.isArray(data) ? data[0] : data;
    return {
      ok: true,
      motor,
      persistido: true,
      movimientoId: fila?.movimiento_id,
      saldoDisponible: fila?.saldo_disponible != null ? Number(fila.saldo_disponible) : undefined,
    };
  } catch (e: any) {
    return {
      ok: false,
      error: traducirErrorRPC(e?.message || 'Error desconocido al aplicar el movimiento.'),
      pasoFallido: 'Transacción',
      motor,
      persistido: false,
    };
  }
}

/** Un 42883/PGRST202 significa que la migración no se ha corrido. Decirlo así. */
function traducirErrorRPC(msg: string): string {
  const m = (msg || '').toLowerCase();
  if (m.includes('could not find the function') || m.includes('42883') || m.includes('pgrst202')) {
    return (
      'La función aplicar_movimiento_tdc no existe en la base de datos. ' +
      'Ejecute la migración supabase/migrations/create_rpc_movimiento_tdc.sql antes de operar movimientos.'
    );
  }
  if (m.includes('saldo disponible insuficiente')) {
    return 'Saldo disponible insuficiente en la línea para aplicar este movimiento.';
  }
  if (m.includes('no tiene saldo registrado')) {
    return 'La línea no tiene un límite autorizado registrado: revíselo en Términos y Condiciones antes de operar movimientos.';
  }
  if (m.includes('cuenta eje')) {
    return msg;
  }
  if (m.includes('ux_mov_linea_correlation') || m.includes('duplicate key')) {
    return 'Este movimiento ya fue aplicado. No se duplicó.';
  }
  return `No se pudo aplicar el movimiento: ${msg}`;
}

/**
 * Saldo de la Línea tal como lo tiene la base.
 *
 * `J_SALDOS_LINEA` es la AUTORIDAD sobre el disponible: lo bajan los cargos
 * (`aplicar_movimiento_tdc`) y lo suben los pagos cuyos conceptos liberan
 * línea (`aplicar_pago_referenciado`, §40). Derivarlo sumando los movimientos
 * que la pantalla trae en sesión deja fuera lo segundo, porque la liberación
 * ocurre en la base y no produce un renglón en esa lista.
 *
 * Devuelve `null` cuando la función todavía no está desplegada o la línea aún
 * no tiene fila — en ambos casos la pantalla debe seguir con su cálculo local
 * en vez de quedarse sin saldo.
 */
export async function leerSaldoLinea(
  idLineaCredito: string,
): Promise<{ montoAutorizado: number; saldoDisponible: number } | null> {
  if (!idLineaCredito) return null;
  try {
    const { data, error } = await supabase.rpc('obtener_saldo_linea', {
      p_linea_id: String(idLineaCredito),
    });
    if (error) return null;

    const fila = Array.isArray(data) ? data[0] : data;
    if (!fila || fila.saldo_disponible == null) return null;

    return {
      montoAutorizado: Number(fila.monto_autorizado) || 0,
      saldoDisponible: Number(fila.saldo_disponible) || 0,
    };
  } catch {
    return null;
  }
}
