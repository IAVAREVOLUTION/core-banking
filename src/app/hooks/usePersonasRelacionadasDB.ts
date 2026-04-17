/**
 * usePersonasRelacionadasDB.ts
 *
 * Hook para cargar personas relacionadas de un cliente desde J_CLIENTES.data.personasRelacionadas
 * Usa la misma estrategia que useClientesDB: RPC o Edge Function
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const LOG = '[PersonasRelacionadasDB]';

export interface PersonaRelacionada {
  id: string | number;
  rfc?: string;
  curp?: string;
  nombre: string;
  nombreCompleto: string;
  telefono?: string;
  email?: string;
  clienteUuid?: string;
  claveCliente?: string;
  personalidad?: string;
  fechaRegistro?: string;
  esPrincipal?: boolean;
  tipoRelacion?: string;
}

// ESTRATEGIA 1: Edge Function GET /clientes/:clienteId (per-client, más confiable)
// Respuesta: { success: true, data: { id, type, subtipo, estatus, data: <JSONB>, par_cliente_id } }
async function tryEdgeFunctionSingle(clienteId: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API_BASE}/clientes/${clienteId}`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    // json.data es la fila completa; json.data.data es el JSONB del cliente
    const clienteData: Record<string, any> | null = json?.data?.data ?? null;
    console.log(`${LOG} Edge single — personasRelacionadas:`, (clienteData?.personasRelacionadas ?? []).length);
    return clienteData;
  } catch (err: any) {
    console.warn(`${LOG} Edge function single failed:`, err?.message || err);
    return null;
  }
}

// ESTRATEGIA 2: RPC get_all_jclientes (carga todos los clientes y filtra)
async function tryRPC(clienteId: string): Promise<Record<string, any> | null> {
  try {
    const { data, error } = await supabase.rpc('get_all_jclientes');
    if (error) {
      console.warn(`${LOG} RPC failed:`, error.message);
      return null;
    }
    const rows = (data || []) as Array<{ id: string; type: string; data: Record<string, any> }>;
    const clienteRow = rows.find(r => r.id === clienteId);
    return clienteRow?.data || null;
  } catch (err: any) {
    console.warn(`${LOG} RPC exception:`, err?.message || err);
    return null;
  }
}

// ESTRATEGIA 3: Edge Function GET /clientes-lista-todos (fallback)
async function tryEdgeFunctionAll(clienteId: string): Promise<Record<string, any> | null> {
  try {
    const res = await fetch(`${API_BASE}/clientes-lista-todos`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });
    const json = await res.json();
    if (!res.ok || json.error) return null;
    const rows = (json.data || []) as Array<{ id: string; data: Record<string, any> }>;
    const clienteRow = rows.find(r => r.id === clienteId);
    return clienteRow?.data || null;
  } catch (err: any) {
    console.warn(`${LOG} Edge function all failed:`, err?.message || err);
    return null;
  }
}

export function usePersonasRelacionadasDB(clienteId?: string | null) {
  const [personas, setPersonas] = useState<PersonaRelacionada[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPersonas = useCallback(async () => {
    if (!clienteId) {
      setPersonas([]);
      return;
    }

    console.log(`${LOG} ═══ fetchPersonas() START — clienteId:`, clienteId);
    setLoading(true);
    setError(null);

    try {
      let clienteData: Record<string, any> | null = null;

      // Estrategia 1: fetch directo al cliente (más rápido y confiable)
      clienteData = await tryEdgeFunctionSingle(clienteId);
      if (clienteData) {
        console.log(`${LOG} Cliente obtenido via Edge Function single`);
      }

      // Estrategia 2: RPC get_all_jclientes
      if (!clienteData) {
        clienteData = await tryRPC(clienteId);
        if (clienteData) {
          console.log(`${LOG} Cliente obtenido via RPC`);
        }
      }

      // Estrategia 3: Edge Function lista completa
      if (!clienteData) {
        clienteData = await tryEdgeFunctionAll(clienteId);
        if (clienteData) {
          console.log(`${LOG} Cliente obtenido via Edge Function all`);
        }
      }

      if (clienteData) {
        const personasRelacionadas: PersonaRelacionada[] = clienteData.personasRelacionadas || [];
        console.log(`${LOG} personasRelacionadas encontradas:`, personasRelacionadas.length);
        // Normalizar campos para asegurar compatibilidad con la UI
        const normalized = personasRelacionadas.map((p: any) => ({
          ...p,
          nombre: p.nombre || p.nombreCompleto || '',
          nombreCompleto: p.nombreCompleto || p.nombre || '',
        }));
        setPersonas(normalized);
      } else {
        console.warn(`${LOG} No se encontró data del cliente:`, clienteId);
        setPersonas([]);
      }
    } catch (err: any) {
      console.error(`${LOG} Error:`, err.message);
      setError(err.message);
      setPersonas([]);
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  return {
    personas,
    loading,
    error,
    refetch: fetchPersonas,
  };
}
