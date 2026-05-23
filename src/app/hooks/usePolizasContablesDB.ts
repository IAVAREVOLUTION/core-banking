import { useState, useEffect, useCallback } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { PolizaContable } from '../components/polizas-contables/PolizasContablesModule';

export const GL_BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
export const GL_JOURNAL_URL = `${GL_BASE_URL}/gl-journal`;
export const GL_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${publicAnonKey}`,
};

function mapRow(row: any): PolizaContable {
  return {
    id: row.id,
    journal_date: row.journal_date ?? '',
    producto_id: row.producto_id ?? '',
    event_code: row.event_code ?? '',
    account_id: row.account_id ?? '',
    transaction_id: row.transaction_id,
    currency: row.currency ?? 'MXN',
    total_debit: parseFloat(row.total_debit) || 0,
    total_credit: parseFloat(row.total_credit) || 0,
    status: row.status ?? 'Creada',
    created_at: row.created_at,
    data: typeof row.data === 'string' ? JSON.parse(row.data) : (row.data ?? {}),
  };
}

export function usePolizasContablesDB(active: boolean) {
  const [polizas, setPolizas] = useState<PolizaContable[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPolizas = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(GL_JOURNAL_URL, { headers: GL_HEADERS, signal });
      if (signal?.aborted) return;
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (!signal?.aborted) setPolizas((json.data || []).map(mapRow));
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) {
      const ctrl = new AbortController();
      fetchPolizas(ctrl.signal);
      return () => ctrl.abort();
    }
  }, [active, fetchPolizas]);

  return { polizas, loading, error, refetch: fetchPolizas };
}
