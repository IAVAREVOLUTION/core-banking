/**
 * Mapa id (UUID) → No. de solicitud legible ("SOL-2026-000123").
 *
 * Las Solicitudes de Activación sólo guardan el UUID de la solicitud de
 * crédito. Para mostrar algo legible se usa la misma lista de solicitudes que
 * carga el módulo de Solicitudes (misma URL → la comparte la caché de lecturas
 * de lib/cacheLecturas) y el resultado se recuerda durante la sesión.
 */
import { useEffect, useState } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

let cache: Map<string, string> | null = null;
let enCurso: Promise<Map<string, string>> | null = null;

function noSolDeFila(r: any): string {
  if (r?.no_sol) return String(r.no_sol);
  let d = r?.data;
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch { d = null; }
  }
  return String(d?.header?.no_sol || d?.noSol || d?.no_sol || '');
}

export function cargarNoSolicitudes(): Promise<Map<string, string>> {
  if (cache) return Promise.resolve(cache);
  if (!enCurso) {
    enCurso = fetch(`${API_BASE}/solicitudes-credito?vista=lista`, { headers: { Authorization: `Bearer ${publicAnonKey}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        const filas: any[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        const m = new Map<string, string>();
        for (const f of filas) {
          const no = noSolDeFila(f);
          if (f?.id && no) m.set(String(f.id), no);
        }
        cache = m;
        return m;
      })
      .catch(() => new Map<string, string>())
      .finally(() => { enCurso = null; });
  }
  return enCurso;
}

export function useNoSolicitudes(activo = true): Map<string, string> {
  const [mapa, setMapa] = useState<Map<string, string>>(() => cache || new Map());
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    cargarNoSolicitudes().then(m => { if (vivo) setMapa(m); });
    return () => { vivo = false; };
  }, [activo]);
  return mapa;
}
