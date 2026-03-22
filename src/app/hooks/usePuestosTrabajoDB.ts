/**
 * usePuestosTrabajoDB.ts
 *
 * Hook para cargar puestos de trabajo desde J_Catalogos
 * donde type = 'PuestoTrabajo'
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const LOG = '[PuestosTrabajoDB]';

export interface PuestoTrabajo {
  id: string;
  nombre: string;
  puesto: string;
  area: string;
  nivel: string;
  montoMinimo: number;
  montoMaximo: number;
  requiereFirma: boolean;
  activo: boolean;
}

export interface PuestoTrabajoRow {
  id: string;
  type: string;
  data: Record<string, any>;
}

async function fetchPuestosTrabajo(): Promise<PuestoTrabajoRow[]> {
  try {
    console.log(`${LOG} ═══ FETCH START ═══`);
    console.log(`${LOG} Trying direct schema query...`);
    
    const { data, error } = await supabase
      .schema('EFINANCIANET_DB')
      .from('J_CATALOGOS')
      .select('id, type, data');
    
    console.log(`${LOG} Result: count=${data?.length}, error=${error?.message}`);
    
    if (error) {
      console.error(`${LOG} Query error:`, error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log(`${LOG} No data returned from J_CATALOGOS`);
      return [];
    }
    
    // Log all types found
    const types = [...new Set(data.map(r => r.type))];
    console.log(`${LOG} All types found:`, types);
    
    // Log first record as sample
    console.log(`${LOG} First record:`, JSON.stringify(data[0], null, 2));
    
    // Filter by type containing 'puesto' (case insensitive)
    const filtered = data.filter(r => 
      r.type && r.type.toLowerCase().includes('puesto')
    );
    
    console.log(`${LOG} Filtered by 'puesto': count=${filtered.length}`);
    
    return filtered as PuestoTrabajoRow[];
  } catch (err: any) {
    console.error(`${LOG} Exception:`, err);
    return [];
  }
}

function mapRowToPuesto(row: PuestoTrabajoRow): PuestoTrabajo {
  const d = row.data || {};
  return {
    id: row.id,
    nombre: d.nombre || '',
    area: d.area || d.departamento || '',
    nivel: d.nivel || '',
    montoMinimo: d.montoDesde ?? d.monto_desde ?? 0,
    montoMaximo: d.montoHasta ?? d.monto_hasta ?? 0,
    requiereFirma: d.requiereFirma ?? d.requiere_firma ?? false,
    activo: d.activo ?? true,
    puesto: d.puesto || '',
  };
}

export function usePuestosTrabajoDB() {
  const [puestos, setPuestos] = useState<PuestoTrabajo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPuestos = useCallback(async () => {
    console.log(`${LOG} ═══ fetchPuestos() START ═══`);
    setLoading(true);
    setError(null);

    try {
      const rows = await fetchPuestosTrabajo();
      console.log(`${LOG} Rows found:`, rows.length);
      
      const mapped = rows.map(mapRowToPuesto);
      console.log(`${LOG} Mapped puestos:`, mapped);
      
      setPuestos(mapped);
    } catch (err: any) {
      console.error(`${LOG} Error:`, err.message);
      setError(err.message);
      setPuestos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    console.log(`${LOG} Hook mounted, fetching...`);
    fetchPuestos();
  }, [fetchPuestos]);

  return {
    puestos,
    loading,
    error,
    refetch: fetchPuestos,
  };
}
