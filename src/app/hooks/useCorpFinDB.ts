// ════════════════════════════════════════════════════════
// useCorpFinDB.ts
//
// Solicitudes de financiamiento corporativo (EFINANCIANET_DB.J_CORP_FIN)
// asociadas a una Oportunidad. Respalda la pestaña "Solicitudes" de la vista
// de Oportunidad (HU-CRM-05 CA-02).
//
// Acceso vía RPC SECURITY DEFINER en public — mismo patrón que
// J_COTIZACIONES y J_GARANTIAS. El esquema EFINANCIANET_DB no está
// concedido a anon, así que un .from() directo responde 42501.
//
//   SELECT → supabase.rpc('get_corp_fin',    { p_cotizacion_id })
//   INSERT → supabase.rpc('insert_corp_fin', { p_payload })
//   UPDATE → supabase.rpc('update_corp_fin', { p_id, p_payload })
//   DELETE → supabase.rpc('delete_corp_fin', { p_id })
//
// Ver supabase/migrations/create_j_corp_fin_table.sql y create_rpc_corp_fin.sql
// ════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabaseClient';

export interface SolicitudCorpFin {
  id: string;
  cotizacionId: string;
  clienteId: string;
  folio: string;
  type: string;
  estatus: string;
  monto: number;
  moneda: string;
  fechaSolicitud: string;
  createdAt: string;
  data: Record<string, any>;
}

/** Payload de alta/edición — todo opcional salvo lo que se quiera cambiar. */
export interface CorpFinInput {
  cotizacion_id?: string;
  cliente_id?: string;
  folio?: string;
  type?: string;
  estatus?: string;
  monto?: string;
  moneda?: string;
  fecha_solicitud?: string;
  data?: Record<string, any>;
}

/** La RPC devuelve todo como text para evitar sorpresas de serialización. */
function mapRow(r: any): SolicitudCorpFin {
  return {
    id: r.id ?? '',
    cotizacionId: r.cotizacion_id ?? '',
    clienteId: r.cliente_id ?? '',
    folio: r.folio ?? '',
    type: r.type ?? '',
    estatus: r.estatus ?? '',
    monto: parseFloat(r.monto ?? '0') || 0,
    moneda: r.moneda ?? 'MXN',
    fechaSolicitud: r.fecha_solicitud ?? '',
    createdAt: r.created_at ?? '',
    data: r.data ?? {},
  };
}

/** cotizacion_id es UUID en BD — un id local sin guardar (p.ej. "local-171...") no es consultable. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param cotizacionId  Oportunidad de la que se listan solicitudes.
 *                      Sin valor (o sin guardar en BD todavía), el hook queda inactivo.
 */
export function useCorpFinDB(cotizacionId?: string | null) {
  const [solicitudes, setSolicitudes] = useState<SolicitudCorpFin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSolicitudes = useCallback(async () => {
    if (!cotizacionId || !UUID_RE.test(cotizacionId)) {
      setSolicitudes([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_corp_fin', {
        p_cotizacion_id: cotizacionId,
      });
      if (rpcError) throw rpcError;
      setSolicitudes(Array.isArray(data) ? data.map(mapRow) : []);
    } catch (err: any) {
      const msg = err?.message || 'Error consultando J_CORP_FIN';
      console.error('[useCorpFinDB] fetch:', msg);
      setError(msg);
      setSolicitudes([]);
    } finally {
      setLoading(false);
    }
  }, [cotizacionId]);

  useEffect(() => { fetchSolicitudes(); }, [fetchSolicitudes]);

  const crear = useCallback(async (input: CorpFinInput): Promise<{ ok: boolean; id?: string; folio?: string; error?: string }> => {
    const cotizacionIdFinal = input.cotizacion_id ?? cotizacionId ?? '';
    if (!cotizacionIdFinal || !UUID_RE.test(cotizacionIdFinal)) {
      return { ok: false, error: 'Guarde la Oportunidad en la base de datos antes de registrar solicitudes corporativas.' };
    }
    try {
      const { data, error: rpcError } = await supabase.rpc('insert_corp_fin', {
        p_payload: { ...input, cotizacion_id: cotizacionIdFinal },
      });
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      await fetchSolicitudes();
      return { ok: true, id: row?.id, folio: row?.folio };
    } catch (err: any) {
      const msg = err?.message || 'Error creando la solicitud';
      console.error('[useCorpFinDB] insert:', msg);
      return { ok: false, error: msg };
    }
  }, [cotizacionId, fetchSolicitudes]);

  const actualizar = useCallback(async (id: string, input: CorpFinInput): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { error: rpcError } = await supabase.rpc('update_corp_fin', { p_id: id, p_payload: input });
      if (rpcError) throw rpcError;
      await fetchSolicitudes();
      return { ok: true };
    } catch (err: any) {
      const msg = err?.message || 'Error actualizando la solicitud';
      console.error('[useCorpFinDB] update:', msg);
      return { ok: false, error: msg };
    }
  }, [fetchSolicitudes]);

  const eliminar = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const { error: rpcError } = await supabase.rpc('delete_corp_fin', { p_id: id });
      if (rpcError) throw rpcError;
      await fetchSolicitudes();
      return { ok: true };
    } catch (err: any) {
      const msg = err?.message || 'Error eliminando la solicitud';
      console.error('[useCorpFinDB] delete:', msg);
      return { ok: false, error: msg };
    }
  }, [fetchSolicitudes]);

  return { solicitudes, loading, error, refetch: fetchSolicitudes, crear, actualizar, eliminar };
}
