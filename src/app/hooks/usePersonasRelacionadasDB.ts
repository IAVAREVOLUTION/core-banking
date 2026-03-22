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
}

interface JClienteRow {
  id: string;
  type: string;
  data: Record<string, any>;
}

// ESTRATEGIA 1: RPC
async function tryRPC(): Promise<{ ok: boolean; rows: JClienteRow[]; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('get_all_jclientes');
    if (error) {
      console.warn(`${LOG} RPC failed:`, error.message);
      return { ok: false, rows: [], error: error.message };
    }
    return { ok: true, rows: (data || []) as JClienteRow[] };
  } catch (err: any) {
    return { ok: false, rows: [], error: err?.message || String(err) };
  }
}

// ESTRATEGIA 2: Edge Function
async function tryEdgeFunction(): Promise<{ ok: boolean; rows: JClienteRow[]; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/clientes-lista-todos`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      return { ok: false, rows: [], error: json.error || `HTTP ${res.status}` };
    }
    return { ok: true, rows: json.data || [] };
  } catch (err: any) {
    return { ok: false, rows: [], error: err?.message || String(err) };
  }
}

export function usePersonasRelacionadasDB(clienteId?: string | null) {
  const [personas, setPersonas] = useState<PersonaRelacionada[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPersonas = useCallback(async () => {
    console.log(`${LOG} ═══ fetchPersonas() START ═══`);
    setLoading(true);
    setError(null);

    try {
      if (!clienteId) {
        console.log(`${LOG} No clienteId provided, returning empty`);
        setPersonas([]);
        setLoading(false);
        return;
      }

      let clienteData: Record<string, any> | null = null;

      // Try RPC first
      const rpcResult = await tryRPC();
      if (rpcResult.ok && rpcResult.rows.length > 0) {
        console.log(`${LOG} RPC success, searching for clienteId:`, clienteId);
        const clienteRow = rpcResult.rows.find(r => r.id === clienteId);
        if (clienteRow) {
          clienteData = clienteRow.data;
          console.log(`${LOG} Cliente found via RPC`);
        }
      }

      // If not found, try Edge Function
      if (!clienteData) {
        const edgeResult = await tryEdgeFunction();
        if (edgeResult.ok && edgeResult.rows.length > 0) {
          console.log(`${LOG} Edge function success, searching for clienteId:`, clienteId);
          const clienteRow = edgeResult.rows.find(r => r.id === clienteId);
          if (clienteRow) {
            clienteData = clienteRow.data;
            console.log(`${LOG} Cliente found via Edge Function`);
          }
        }
      }

      if (clienteData) {
        console.log(`${LOG} Cliente data keys:`, Object.keys(clienteData));
        const personasRelacionadas = clienteData.personasRelacionadas || [];
        console.log(`${LOG} Personas relacionadas found:`, personasRelacionadas.length);
        console.log(`${LOG} Personas relacionadas data:`, JSON.stringify(personasRelacionadas).substring(0, 500));
        setPersonas(personasRelacionadas);
      } else {
        console.log(`${LOG} No cliente data found for id:`, clienteId);
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
    console.log(`${LOG} Auto-fetch triggered, clienteId:`, clienteId);
    fetchPersonas();
  }, [clienteId, fetchPersonas]);

  return {
    personas,
    loading,
    error,
    refetch: fetchPersonas,
  };
}
