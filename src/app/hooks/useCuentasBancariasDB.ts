/**
 * useCuentasBancariasDB.ts
 *
 * ═══════════════════════════════════════════════════════════════════
 * Subtab "Cuentas Bancarias" — Módulo Personas (Clientes)
 * Reusa EFINANCIANET_DB."J_CUENTAS_CORP_CLIENTES" (misma tabla que
 * Cuentas de Ahorro) con tipo_produc = 'otros_bancos'.
 *
 * Campos específicos de banco (país, banco, CLABE, número de cuenta,
 * moneda, SWIFT) no tienen columna física — viven dentro de "data"
 * jsonb, bajo la clave "bancaria".
 *
 * Lectura → RPC get_cuentas_bancarias_by_cliente (filtra por
 *           tipo_produc='otros_bancos' AND cliente_id).
 * Escritura → RPCs dedicadas insert_cuenta_bancaria /
 *             update_cuenta_bancaria / delete_cuenta_bancaria.
 *             NO reusan insert_cuenta_ahorro/update_cuenta_ahorro:
 *             esas tienen overloads ambiguos (insert) o no existen
 *             en producción (update) — ver notas de la migración
 *             20260807165437_cuentas_bancarias_catalogos_rpc.sql.
 *             tipo_produc='otros_bancos' se fija dentro de la RPC,
 *             el frontend nunca lo envía ni lo edita.
 * ═══════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const LOG = '[CuentasBancariasDB]';
const SS_KEY = 'cuentas_bancarias_local';

export interface CuentaBancariaData {
  pais: string;
  banco: string;
  cuentaClabe: string;
  numeroCuenta: string;
  moneda: string;
  cuentaSwift: string;
}

export interface CuentaBancaria extends CuentaBancariaData {
  id: string;
  clienteId: string;
  estatus: string;
  fechaRegistro: string;
}

interface RpcRow {
  id: string;
  cliente_id: string | null;
  estatus_cuen: string | null;
  fecha_sol: string | null;
  data: Record<string, any> | null;
}

function mapRow(row: RpcRow): CuentaBancaria {
  const d = (row.data?.bancaria || {}) as Partial<CuentaBancariaData>;
  return {
    id: row.id,
    clienteId: row.cliente_id || '',
    estatus: row.estatus_cuen || 'Activo',
    fechaRegistro: row.fecha_sol || '',
    pais: d.pais || '',
    banco: d.banco || '',
    cuentaClabe: d.cuentaClabe || '',
    numeroCuenta: d.numeroCuenta || '',
    moneda: d.moneda || '',
    cuentaSwift: d.cuentaSwift || '',
  };
}

function loadLocal(clienteId: string): CuentaBancaria[] {
  try {
    const raw = sessionStorage.getItem(`${SS_KEY}_${clienteId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLocal(clienteId: string, items: CuentaBancaria[]) {
  try { sessionStorage.setItem(`${SS_KEY}_${clienteId}`, JSON.stringify(items)); } catch { /* quota */ }
}

export function useCuentasBancariasDB(clienteId?: string | null) {
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'pending-deploy' | 'local-only'>('connected');

  const fetchCuentas = useCallback(async () => {
    if (!clienteId) { setCuentas([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_cuentas_bancarias_by_cliente', { p_cliente_id: clienteId });
      if (error) {
        console.warn(`${LOG} RPC falló:`, error.message);
        setCuentas(loadLocal(clienteId));
        setBackendStatus('pending-deploy');
        return;
      }
      const mapped = ((data || []) as RpcRow[]).map(mapRow);
      setCuentas(mapped);
      saveLocal(clienteId, mapped);
      setBackendStatus('connected');
    } catch (err) {
      console.error(`${LOG} Excepción:`, err);
      setCuentas(loadLocal(clienteId));
      setBackendStatus('pending-deploy');
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => { fetchCuentas(); }, [fetchCuentas]);

  const saveCuenta = useCallback(async (
    payload: CuentaBancariaData & { id?: string; estatus?: string }
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!clienteId) return { ok: false, error: 'Sin cliente asociado' };
    setSaving(true);
    try {
      const dataJson = { bancaria: {
        pais: payload.pais,
        banco: payload.banco,
        cuentaClabe: payload.cuentaClabe,
        numeroCuenta: payload.numeroCuenta,
        moneda: payload.moneda,
        cuentaSwift: payload.cuentaSwift,
      } };

      if (payload.id) {
        const { error } = await supabase.rpc('update_cuenta_bancaria', {
          p_id: payload.id,
          p_data: dataJson,
          p_estatus: payload.estatus || 'Activo',
        });
        if (error) {
          console.warn(`${LOG} UPDATE falló:`, error.message);
          return { ok: false, error: error.message };
        }
      } else {
        // tipo_produc='otros_bancos' se fija dentro de la RPC — nunca se envía desde aquí
        const { error } = await supabase.rpc('insert_cuenta_bancaria', {
          p_cliente_id: clienteId,
          p_data: dataJson,
        });
        if (error) {
          console.warn(`${LOG} INSERT falló:`, error.message);
          return { ok: false, error: error.message };
        }
      }

      await fetchCuentas();
      return { ok: true };
    } catch (err: any) {
      console.error(`${LOG} Excepción al guardar:`, err);
      return { ok: false, error: err?.message || String(err) };
    } finally {
      setSaving(false);
    }
  }, [clienteId, fetchCuentas]);

  const deleteCuenta = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    if (!clienteId) return { ok: false, error: 'Sin cliente asociado' };
    setSaving(true);
    try {
      const { error } = await supabase.rpc('delete_cuenta_bancaria', { p_id: id });
      if (error) {
        console.warn(`${LOG} DELETE falló:`, error.message);
        return { ok: false, error: error.message };
      }
      await fetchCuentas();
      return { ok: true };
    } finally {
      setSaving(false);
    }
  }, [clienteId, fetchCuentas]);

  return { cuentas, loading, saving, backendStatus, refetch: fetchCuentas, saveCuenta, deleteCuenta };
}
