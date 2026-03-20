/**
 * useOriginacionesDB.ts — v1.5
 *
 * Hook para el módulo de Originación
 *
 * Regla de negocio:
 *   - Mostrar SOLO solicitudes donde estatus_sol != 'Pendiente'
 *   - Estas solicitudes vienen del módulo de Solicitudes cuando se envía
 *
 * Fuentes de datos:
 *   1. useSolicitudesDB (solicitudes guardadas en BD)
 *   2. J_CLIENTES (datos de ejemplo para mostrar cuando no hay solicitudes)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { OriginacionListItem, getEjemploFromDB } from '../components/originacion/originacionStore';
import type { SolicitudListItem } from '../components/solicitudes/solicitudCreditoStore';
import { useSolicitudesDB } from './useSolicitudesDB';
import { supabase } from '../lib/supabaseClient';

// ═══════════════════════════════════════════════════════════════════
// MAP: SolicitudListItem → OriginacionListItem
// ═══════════════════════════════════════════════════════════════════
function mapSolicitudToOriginacion(sol: SolicitudListItem): OriginacionListItem {
  return {
    id: typeof sol.id === 'string' ? parseInt(sol.id.replace(/\D/g, '').slice(0, 8)) || Date.now() : sol.id,
    noOriginacion: '',
    noSolicitud: sol.noSol || '',
    noCliente: (sol as any)._clienteId?.slice(0, 8) || '',
    cliente: sol.nombreCompleto || '(sin nombre)',
    fechaSolicitud: sol.fechaSolicitud || '',
    montoSolicitado: sol.montoSolicitado || 0,
    montoAutorizado: sol.montoAutorizado || 0,
    sublinea: sol.tipoProducto || '',
    producto: sol.nombreProducto || '',
    sucursal: sol.sucursal || '',
    estatus: sol.estatusSolicitud || 'En Proceso',
    subEstatus: sol.faseDescripcion || 'Integración del Expediente',
    responsable: '',
  };
}

// ═══════════════════════════════════════════════════════════════════
// Fetch clientes para datos de ejemplo
// ═══════════════════════════════════════════════════════════════════
async function fetchClientesEjemplo(): Promise<any[]> {
  try {
    console.log('[OriginacionDB] Fetching clientes desde J_CLIENTES...');
    const { data, error } = await supabase.rpc('get_clientes');
    if (error) {
      console.warn('[OriginacionDB] RPC get_clientes failed:', error.message);
      return [];
    }
    console.log(`[OriginacionDB] Clientes obtenidos: ${data?.length || 0}`);
    return data || [];
  } catch (err) {
    console.warn('[OriginacionDB] Error fetching clientes:', err);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════
export type OriginacionBackendStatus = 'ready' | 'loading' | 'empty' | 'error';

export function useOriginacionesDB() {
  const [items, setItems] = useState<OriginacionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<OriginacionBackendStatus>('loading');
  const [fetchMethod, setFetchMethod] = useState<string>('');
  const hasFetched = useRef(false);

  // Usar el hook de Solicitudes como fuente de datos
  const { solicitudes, loading: loadingSolicitudes, backendStatus: solicitudesStatus, refetch: refetchSolicitudes } = useSolicitudesDB(true);

  const fetchItems = useCallback(async () => {
    console.log('[OriginacionDB] === fetchItems() START ===');
    setLoading(true);
    setError(null);

    // Esperar a que useSolicitudesDB termine de cargar
    if (solicitudesStatus === 'loading' || solicitudesStatus === 'pending-deploy') {
      console.log('[OriginacionDB] Esperando datos de Solicitudes...');
      setLoading(true);
      return;
    }

    console.log(`[OriginacionDB] Solicitudes: ${solicitudes.length}, status: ${solicitudesStatus}`);

    // 1. Filtrar solicitudes NO Pendiente (enviadas a Originación)
    const solicitudesReales = solicitudes.filter(s => {
      const estatus = s.estatusSolicitud || '';
      return estatus !== 'Pendiente';
    });

    console.log(`[OriginacionDB] Solicitudes reales (no-Pendiente): ${solicitudesReales.length}`);

    if (solicitudesReales.length > 0) {
      // Usar solicitudes reales de la BD
      const mapped = solicitudesReales.map(mapSolicitudToOriginacion);
      setItems(mapped);
      setBackendStatus('ready');
      setFetchMethod('solicitudes-reales');
      console.log(`[OriginacionDB] OK: ${mapped.length} originaciones reales`);
    } else {
      // 2. No hay solicitudes reales, usar datos de ejemplo desde J_CLIENTES
      console.log('[OriginacionDB] Sin solicitudes reales, buscando datos de ejemplo...');
      const clientes = await fetchClientesEjemplo();
      
      if (clientes.length > 0) {
        const ejemplos = getEjemploFromDB(clientes);
        setItems(ejemplos);
        setBackendStatus('ready');
        setFetchMethod('ejemplo-db');
        console.log(`[OriginacionDB] Mostrando ${ejemplos.length} ejemplos de J_CLIENTES`);
      } else {
        setItems([]);
        setBackendStatus('empty');
        setFetchMethod('sin-datos');
        console.log('[OriginacionDB] No hay datos para mostrar');
      }
    }

    setLoading(false);
  }, [solicitudes, solicitudesStatus]);

  // Actualizar cuando cambien las solicitudes
  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Refrescar manualmente
  const refetch = useCallback(() => {
    refetchSolicitudes();
    hasFetched.current = false;
    fetchItems();
  }, [refetchSolicitudes, fetchItems]);

  return {
    items,
    loading: loading || loadingSolicitudes,
    error,
    backendStatus,
    fetchMethod,
    refetch,
  };
}
