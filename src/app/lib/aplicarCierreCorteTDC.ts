/**
 * aplicarCierreCorteTDC — capa transaccional del Cierre de Corte (§36, §37, §38, §39).
 *
 * El motor (`motorCierreCorteTDC`) decide QUÉ se corta; este módulo decide CÓMO
 * se escribe, en UNA sola llamada al RPC `aplicar_cierre_corte_tdc`, que corre
 * dentro de una transacción de Postgres.
 *
 * Es el gemelo de `aplicarMovimientoTDC` y existe por la misma razón: §38
 * prohíbe que CrearCxC, CrearCxCDetail y ActualizarCargo hagan commits
 * independientes. Una sola llamada, una sola transacción, un solo rollback.
 *
 * ── De dónde salen los Cargos ────────────────────────────────────────────
 * De `J_CARGOS_LINEA`, que es donde la ESPECIFICACIÓN 2 los deja cuando
 * bCargo = S/Y. Leerlos del store de sesión dejaría las dos especificaciones
 * desconectadas: la 3 no vería lo que produjo la 2.
 */
import { supabase } from './supabaseClient';
import type { CargoLinea, ResultadoCierre } from './motorCierreCorteTDC';

/** Un Cargo tal como lo devuelve el RPC lector. */
interface FilaCargo {
  id: string;
  clave: string | null;
  nombre: string | null;
  naturaleza: string | null;
  monto: string | number | null;
  fecha: string | null;
  b_factura: string | null;
  b_cargo: string | null;
  estatus: string | null;
  movimiento_id: string | null;
  cxc_id: string | null;
}

export interface CargosCargados {
  cargos: CargoLinea[];
  /** true si vinieron de la base; false si se cayó al store de sesión. */
  desdeBD: boolean;
  error?: string;
}

/**
 * Lee los Cargos de la línea desde la base.
 *
 * No filtra por estatus ni bCargo: eso lo decide el motor (§8.1/§8.2), que es
 * el único lugar donde viven esas reglas.
 */
export async function cargarCargosLinea(
  idLineaCredito: string,
  fechaInicio?: string,
  fechaFin?: string,
): Promise<CargosCargados> {
  try {
    const { data, error } = await supabase.rpc('obtener_cargos_linea', {
      p_linea_id: idLineaCredito,
      p_fecha_inicio: fechaInicio || null,
      p_fecha_fin: fechaFin || null,
    });
    if (error) return { cargos: [], desdeBD: false, error: traducirErrorCierre(error.message || String(error)) };

    const filas: FilaCargo[] = Array.isArray(data) ? data : [];
    return {
      desdeBD: true,
      cargos: filas.map(f => ({
        id: f.id,
        clave: f.clave || '',
        nombre: f.nombre || '',
        naturaleza: f.naturaleza === 'Abono' ? 'Abono' : 'Cargo',
        monto: Number(f.monto) || 0,
        fecha: String(f.fecha || '').slice(0, 10),
        bFactura: f.b_factura === 'S' ? 'S' : 'N',
        bCargo: (f.b_cargo ?? 'S') as CargoLinea['bCargo'],
        estatus: f.estatus || 'Pendiente',
        movimientoId: f.movimiento_id || undefined,
        cxcId: f.cxc_id || null,
      })),
    };
  } catch (e: any) {
    return { cargos: [], desdeBD: false, error: traducirErrorCierre(e?.message || 'Error al leer los cargos.') };
  }
}

export interface ResultadoAplicacionCierre {
  ok: boolean;
  error?: string;
  persistido: boolean;
  cxcId?: string;
  folio?: string;
  cargos?: number;
}

/**
 * Persiste un cierre ya calculado por el motor. No recalcula nada: recibe el
 * `ResultadoCierre` y lo manda íntegro al RPC.
 */
export async function aplicarCierreCorteTDC(params: {
  resultado: ResultadoCierre;
  idLineaCredito: string;
  idCliente?: string;
  idSolicitud?: string;
  idProducto?: string;
  moneda?: string;
  usuario?: string;
  correlationId?: string;
}): Promise<ResultadoAplicacionCierre> {
  const { resultado: r, idLineaCredito } = params;

  if (!r.ok) return { ok: false, error: r.error, persistido: false };

  // §33 — dos envíos del mismo corte comparten el id y el segundo no duplica.
  const correlationId =
    params.correlationId || `${idLineaCredito}|${r.periodo.fechaInicio}|${r.periodo.fechaFin}`;

  try {
    const { data, error } = await supabase.rpc('aplicar_cierre_corte_tdc', {
      p_linea_id: idLineaCredito,
      p_cliente_id: params.idCliente || null,
      p_solicitud_id: params.idSolicitud || null,
      p_producto_id: params.idProducto || null,
      p_fecha_inicio: r.periodo.fechaInicio,
      p_fecha_fin: r.periodo.fechaFin,
      p_fecha_doc: r.fechaDocumento,     // §17 — = FechaFin
      p_fecha_venc: r.fechaVencimiento,
      p_monto_total: r.montoTotalPagar,
      p_monto_minimo: r.montoMinimoPagar,
      p_moneda: params.moneda || 'MXN',
      p_detalle: r.detalle,
      p_usuario: params.usuario || 'Sistema',
      p_correlation_id: correlationId,
    });

    if (error) {
      // §37 — el RPC hizo ROLLBACK: los cargos siguen en Pendiente.
      return { ok: false, error: traducirErrorCierre(error.message || String(error)), persistido: false };
    }

    const fila = Array.isArray(data) ? data[0] : data;
    return {
      ok: true,
      persistido: true,
      cxcId: fila?.cxc_id,
      folio: fila?.folio,
      cargos: fila?.cargos != null ? Number(fila.cargos) : r.cantidadCargos,
    };
  } catch (e: any) {
    return { ok: false, error: traducirErrorCierre(e?.message || 'Error desconocido.'), persistido: false };
  }
}

function traducirErrorCierre(msg: string): string {
  const m = (msg || '').toLowerCase();
  if (m.includes('could not find the function') || m.includes('42883') || m.includes('pgrst202')) {
    return (
      'Las funciones del Cierre de Corte no existen en la base de datos. ' +
      'Ejecute supabase/migrations/create_rpc_movimiento_tdc.sql y después ' +
      'create_rpc_cierre_corte_tdc.sql.'
    );
  }
  // §39 — el índice único del periodo, o el candado de estatus del cargo.
  if (m.includes('ux_cxc_linea_periodo') || m.includes('duplicate key')) {
    return 'Este periodo ya tiene un cierre generado. No se duplicó.';
  }
  if (m.includes('ya fue procesado por otro cierre')) {
    return 'Otro proceso tomó estos cargos mientras se generaba el cierre. No se aplicó nada; vuelva a intentarlo.';
  }
  if (m.includes('no hay cargos que procesar')) {
    return 'No hay cargos que procesar en el periodo seleccionado.';
  }
  return `No se pudo generar el Cierre de Corte: ${msg}`;
}
