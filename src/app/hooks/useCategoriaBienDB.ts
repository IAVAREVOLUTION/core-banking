/**
 * useCategoriaBienDB.ts
 *
 * Hook para cargar el catálogo de Categoría de Bien desde J_CATALOGOS
 * donde type = 'CategoriaBien' (Garantía / Activo Fijo).
 *
 * Extensible: agregar una categoría nueva en BD es solo un INSERT,
 * este hook la recoge automáticamente sin cambios de código.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const LOG = '[CategoriaBienDB]';

export interface CategoriaBien {
  id: string;
  clave: string;
  nombre: string;
  activo: boolean;
}

interface CategoriaBienRow {
  id: string;
  type: string;
  data: Record<string, any>;
}

function mapRowToCategoriaBien(row: CategoriaBienRow): CategoriaBien {
  const d = row.data || {};
  return {
    id: row.id,
    clave: d.clave || '',
    nombre: d.nombre || d.clave || '',
    activo: d.activo ?? true,
  };
}

export function useCategoriaBienDB() {
  const [categorias, setCategorias] = useState<CategoriaBien[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategorias = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .schema('EFINANCIANET_DB')
        .from('J_CATALOGOS')
        .select('id, type, data')
        .eq('type', 'CategoriaBien');

      if (error) {
        console.warn(`${LOG} Query error:`, error.message);
        setError(error.message);
        setCategorias([]);
        return;
      }

      const rows = (data || []) as CategoriaBienRow[];
      const mapped = rows.map(mapRowToCategoriaBien).filter(c => c.activo);
      setCategorias(mapped);
    } catch (err: any) {
      console.error(`${LOG} Exception:`, err);
      setError(err?.message || String(err));
      setCategorias([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  return { categorias, loading, error, refetch: fetchCategorias };
}
