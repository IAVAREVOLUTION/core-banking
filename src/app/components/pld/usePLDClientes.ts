import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { Authorization: `Bearer ${publicAnonKey}` };

export interface PLDCliente {
  id: number;
  dbUuid: string;
  nombre: string;
  rfc: string;
  curp: string;
  personalidad: string;
  sucursal: string;
  estatus: string;
  tipo: string;
}

function mapRow(row: any, idx: number): PLDCliente {
  const d = row.data || {};
  const def = d.default || {};
  const g = (k: string) => (d[k] || def[k] || '') as string;

  const nombre = g('nombre');
  const apPat  = g('apellidoPaterno');
  const apMat  = g('apellidoMaterno');
  const razon  = g('razonSocial');

  const nombreCompleto = razon || [nombre, apPat, apMat].filter(Boolean).join(' ') || 'Sin nombre';

  return {
    id:          idx + 1,
    dbUuid:      row.id,
    nombre:      nombreCompleto,
    rfc:         g('rfc'),
    curp:        g('curp'),
    personalidad: row.subtipo || g('personalidad') || 'Persona Física',
    sucursal:    g('sucursal') || 'Matriz',
    estatus:     row.estatus || 'Activo',
    tipo:        row.type || '',
  };
}

export function usePLDClientes() {
  const [clientes, setClientes] = useState<PLDCliente[]>([]);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/clientes-lista-todos`, { headers: HDR })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(json => {
        const rows: any[] = Array.isArray(json) ? json : (json.data || []);
        // Solo clientes registrados (excluir prospectos puros sin RFC)
        const mapped = rows
          .map(mapRow)
          .filter(c => c.nombre !== 'Sin nombre');
        setClientes(mapped);
      })
      .catch(() => {
        // Fallback al endpoint alternativo
        fetch(`${API_BASE}/clientes-prospectos`, { headers: HDR })
          .then(r => r.json())
          .then(json => {
            const rows: any[] = Array.isArray(json) ? json : (json.data || []);
            setClientes(rows.map(mapRow).filter(c => c.nombre !== 'Sin nombre'));
          })
          .catch(() => setClientes([]));
      })
      .finally(() => setLoading(false));
  }, []);

  return { clientes, loading };
}
