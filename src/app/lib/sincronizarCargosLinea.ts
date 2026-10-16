/**
 * sincronizarCargosLinea — el botón "Guardar" de la Línea TDC.
 *
 * El subtab Cargos trabaja sobre el espejo de sesión; esto deja
 * `J_CARGOS_LINEA` igual a lo que quedó en pantalla, en una transacción.
 *
 * ── Por qué hace falta ───────────────────────────────────────────────────
 * Los Cargos nacen de los Movimientos de la Línea y el RPC los escribe en la
 * base. Pero editarlos o eliminarlos desde el subtab sólo tocaba la copia de
 * sesión: al recargar volvían. Esta función es el camino de vuelta.
 *
 * ── Lo que deliberadamente NO puede hacer ────────────────────────────────
 * Borrar un cargo ya facturado. Un cargo 'Procesado' pertenece a una CxC
 * emitida y a su póliza; eliminarlo dejaría el documento sin respaldo y la
 * contabilidad descuadrada. El RPC los ignora y devuelve cuántos protegió,
 * para poder decírselo al usuario en vez de fingir que se borraron.
 */
import { supabase } from './supabaseClient';

/** Un cargo tal como vive en el espejo de sesión `cargosLinea`. */
export interface CargoLineaParaGuardar {
  /** uuid de J_CARGOS_LINEA; vacío o ausente si el cargo es nuevo. */
  id?: string;
  clave: string;
  nombre?: string;
  naturaleza?: string;
  monto: number;
  fecha: string;
  bFactura?: string;
  bCargo?: string;
  estatus?: string;
}

export interface ResultadoSincronizacion {
  ok: boolean;
  error?: string;
  mensaje?: string;
  conservados?: number;
  eliminados?: number;
  creados?: number;
  /** Cargos que se intentaron eliminar pero ya estaban facturados. */
  protegidos?: number;
}

export async function sincronizarCargosLinea(params: {
  idLineaCredito: string;
  cargos: CargoLineaParaGuardar[];
  usuario?: string;
}): Promise<ResultadoSincronizacion> {
  const { idLineaCredito, cargos } = params;

  if (!idLineaCredito) {
    return { ok: false, error: 'No se identificó la Línea de Crédito.' };
  }

  try {
    const { data, error } = await supabase.rpc('sincronizar_cargos_linea', {
      p_linea_id: idLineaCredito,
      // Sólo los campos que el RPC lee: mandar el objeto entero arrastraría
      // basura del espejo de sesión (ids locales, banderas de la interfaz).
      p_cargos: (cargos || []).map(c => ({
        // Un id local (`1789…-0`) no es un uuid: se manda vacío y el RPC lo
        // trata como cargo nuevo, que es exactamente lo que es.
        id: esUuid(c.id) ? c.id : '',
        clave: String(c.clave ?? ''),
        nombre: c.nombre ?? '',
        naturaleza: c.naturaleza === 'Abono' ? 'Abono' : 'Cargo',
        monto: Number(c.monto) || 0,
        fecha: String(c.fecha ?? '').slice(0, 10),
        bFactura: c.bFactura === 'S' ? 'S' : 'N',
        bCargo: c.bCargo === 'N' ? 'N' : 'S',
      })),
      p_usuario: params.usuario || null,
    });

    if (error) {
      return { ok: false, error: traducirError(error.message || String(error)) };
    }

    const fila = Array.isArray(data) ? data[0] : data;
    return {
      ok: true,
      mensaje: fila?.mensaje,
      conservados: Number(fila?.conservados) || 0,
      eliminados: Number(fila?.eliminados) || 0,
      creados: Number(fila?.creados) || 0,
      protegidos: Number(fila?.protegidos) || 0,
    };
  } catch (e: any) {
    return { ok: false, error: traducirError(e?.message || 'Error desconocido.') };
  }
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const esUuid = (v?: string): boolean => RE_UUID.test(String(v ?? '').trim());

function traducirError(msg: string): string {
  const m = (msg || '').toLowerCase();
  if (m.includes('could not find the function') || m.includes('42883') || m.includes('pgrst202')) {
    return (
      'La función sincronizar_cargos_linea no existe en la base de datos. ' +
      'Ejecute supabase/migrations/create_rpc_sincronizar_cargos_linea.sql.'
    );
  }
  return `No se pudieron guardar los cargos: ${msg}`;
}
