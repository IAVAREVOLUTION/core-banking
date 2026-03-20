/**
 * useCatalogoClasificaciones.ts
 *
 * Hook que consulta J_CLIENTES para extraer los valores DISTINTOS
 * del campo data.clasificacionCliente y poblar el dropdown dinámicamente.
 *
 * Fallback: si la DB no devuelve resultados, usa valores por defecto.
 */
import { useState, useEffect, useCallback } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

/** Valores por defecto si la DB no tiene datos */
const DEFAULT_CLASIFICACIONES = [
  'Persona',
  'Empresa Privada',
  'Gobierno Magisterio',
  'Otros',
];

export function useCatalogoClasificaciones() {
  const [clasificaciones, setClasificaciones] = useState<string[]>(DEFAULT_CLASIFICACIONES);
  const [loading, setLoading] = useState(false);

  const fetchClasificaciones = useCallback(async () => {
    setLoading(true);
    try {
      console.log('[useCatalogoClasificaciones] Consultando J_CLIENTES para clasificaciones...');

      const res = await fetch(`${API_BASE}/clientes-prospectos`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });

      if (!res.ok) {
        console.warn('[useCatalogoClasificaciones] Error HTTP, usando defaults');
        setClasificaciones(DEFAULT_CLASIFICACIONES);
        return;
      }

      const json = await res.json();
      const rows: any[] = json.data || [];

      // Extraer valores distintos de data.clasificacionCliente
      const valoresUnicos = new Set<string>();
      for (const row of rows) {
        const d = row.data || {};
        const clasif = d.clasificacionCliente;
        if (clasif && typeof clasif === 'string' && clasif.trim() !== '') {
          valoresUnicos.add(clasif.trim());
        }
      }

      if (valoresUnicos.size > 0) {
        // Merge: valores de DB + defaults que no existan en DB
        const fromDb = Array.from(valoresUnicos).sort();
        const merged = [...fromDb];
        for (const def of DEFAULT_CLASIFICACIONES) {
          if (!merged.includes(def)) {
            merged.push(def);
          }
        }
        console.log(`[useCatalogoClasificaciones] ${valoresUnicos.size} clasificaciones de DB:`, fromDb);
        setClasificaciones(merged);
      } else {
        console.log('[useCatalogoClasificaciones] Sin clasificaciones en DB, usando defaults');
        setClasificaciones(DEFAULT_CLASIFICACIONES);
      }
    } catch (err) {
      console.warn('[useCatalogoClasificaciones] Error de red, usando defaults:', err);
      setClasificaciones(DEFAULT_CLASIFICACIONES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasificaciones();
  }, [fetchClasificaciones]);

  return { clasificaciones, loading, refetch: fetchClasificaciones };
}