/**
 * useCatalogoBancario.ts
 *
 * Hook para cargar catálogos de País / Banco / Moneda desde J_CATALOGOS
 * (type='Pais' | 'Banco' | 'Moneda'), usados por el subtab Cuentas Bancarias.
 * Mismo patrón que useCategoriaBienDB — extensible vía INSERT en BD.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface CatalogoItem {
  id: string;
  clave: string;
  nombre: string;
  activo: boolean;
}

interface CatalogoRow {
  id: string;
  type: string;
  data: Record<string, any>;
}

function mapRow(row: CatalogoRow): CatalogoItem {
  const d = row.data || {};
  return { id: row.id, clave: d.clave || '', nombre: d.nombre || d.clave || '', activo: d.activo ?? true };
}

export function useCatalogoBancario(type: 'Pais' | 'Banco' | 'Moneda') {
  const [items, setItems] = useState<CatalogoItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .schema('EFINANCIANET_DB')
        .from('J_CATALOGOS')
        .select('id, type, data')
        .eq('type', type);

      if (error) {
        console.warn(`[useCatalogoBancario:${type}] Query error:`, error.message);
        setItems([]);
        return;
      }
      const mapped = ((data || []) as CatalogoRow[]).map(mapRow).filter(i => i.activo);
      setItems(mapped);
    } catch (err) {
      console.error(`[useCatalogoBancario:${type}] Exception:`, err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  return { items, loading, refetch: fetchItems };
}
