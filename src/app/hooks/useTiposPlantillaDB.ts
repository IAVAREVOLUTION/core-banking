/**
 * useTiposPlantillaDB — el catálogo de Tipos de Plantilla, desde la base.
 *
 * Lo consumen dos pantallas:
 *   · Configuración → Tipos de Plantilla (alta, edición, baja)
 *   · el subtab Plantillas de cualquier producto (el picklist de captura)
 *
 * ── Por qué hay respaldo en la constante ─────────────────────────────────
 * `TIPO_PLANTILLA_CATALOGO` sigue existiendo en types/product.ts y es la
 * semilla de la tabla. Si la Edge Function no responde —o la migración aún
 * no se corrió— el picklist cae a esa constante en vez de quedarse vacío:
 * un producto sin tipos disponibles bloquearía la captura de plantillas de
 * todo el sistema, y eso sería un fallo peor que trabajar desactualizado.
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { TIPO_PLANTILLA_CATALOGO } from '../types/product';
import { nombreIconoDeTipo } from '../lib/iconosPlantilla';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${publicAnonKey}`,
};
const STORAGE_KEY = 'config_tipos_plantilla_v1';
const ENDPOINT = 'tipos-plantilla';
const LOG = '[TiposPlantilla]';

export interface TipoPlantillaCatalogo {
  id: string;
  clave: string;
  nombre: string;
  descripcion: string;
  icono: string;
  color: string;
  activo: boolean;
  /** true → lo consume un proceso del sistema: clave bloqueada, no borrable. */
  esSistema: boolean;
  orden: number;
}

/** Las claves que el código busca literalmente. Deben existir siempre. */
export const CLAVES_DE_SISTEMA = [
  'solicitud', 'contrato', 'pagare', 'minuta',
  'carta-oferta', 'contrato-gpo', 'estado-cuenta',
] as const;

/** Respaldo: la constante que era la fuente antes de que hubiera tabla. */
export const TIPOS_RESPALDO: TipoPlantillaCatalogo[] = TIPO_PLANTILLA_CATALOGO.map((t, i) => ({
  id: `local-${t.value}`,
  clave: t.value,
  nombre: t.label,
  descripcion: t.descripcion,
  icono: nombreIconoDeTipo(t.icon),
  color: t.color,
  activo: true,
  esSistema: true,
  orden: (i + 1) * 10,
}));

const normalizar = (r: any): TipoPlantillaCatalogo => ({
  id: String(r.id),
  clave: r.clave || '',
  nombre: r.nombre || '',
  descripcion: r.descripcion || '',
  // Se normaliza al leer: una fila sembrada con emoji entra ya como nombre
  // de icono, y la UI no tiene que saber que alguna vez hubo emojis.
  icono: nombreIconoDeTipo(r.icono),
  color: r.color || '#666666',
  activo: r.activo !== false,
  esSistema: r.es_sistema === true,
  orden: Number(r.orden) || 100,
});

export function useTiposPlantillaDB() {
  const [data, setData] = useState<TipoPlantillaCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);
  const loadedRef = useRef(false);

  const saveCache = (items: TipoPlantillaCatalogo[]) => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* */ }
  };
  const loadCache = (): TipoPlantillaCatalogo[] => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* */ }
    return [];
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/${ENDPOINT}`, { headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items: TipoPlantillaCatalogo[] = (json.data || []).map(normalizar);
      // Una tabla vacía significa que la migración no sembró: mejor el
      // respaldo que un picklist sin opciones.
      const finales = items.length > 0 ? items : TIPOS_RESPALDO;
      setData(finales);
      saveCache(finales);
      setSynced(items.length > 0);
    } catch (err: any) {
      console.log(`${LOG} ${err.message} — usando cache o respaldo local`);
      const cached = loadCache();
      setData(cached.length > 0 ? cached : TIPOS_RESPALDO);
      setSynced(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      void fetchAll();
    }
  }, [fetchAll]);

  const create = useCallback(async (
    item: Omit<TipoPlantillaCatalogo, 'id' | 'esSistema'>,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${BASE_URL}/${ENDPOINT}`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({
          clave: item.clave, nombre: item.nombre, descripcion: item.descripcion,
          icono: item.icono, color: item.color, activo: item.activo, orden: item.orden,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };

      const nuevo = normalizar(json.data);
      setData(prev => {
        const u = [...prev, nuevo].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
        saveCache(u);
        return u;
      });
      setSynced(true);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'No se pudo conectar con el servidor.' };
    }
  }, []);

  const update = useCallback(async (
    item: TipoPlantillaCatalogo,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${BASE_URL}/${ENDPOINT}/${item.id}`, {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({
          clave: item.clave, nombre: item.nombre, descripcion: item.descripcion,
          icono: item.icono, color: item.color, activo: item.activo, orden: item.orden,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };

      const actualizado = normalizar(json.data);
      setData(prev => {
        const u = prev.map(d => (d.id === item.id ? actualizado : d))
                      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
        saveCache(u);
        return u;
      });
      setSynced(true);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'No se pudo conectar con el servidor.' };
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const res = await fetch(`${BASE_URL}/${ENDPOINT}/${id}`, { method: 'DELETE', headers: HEADERS });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: json.error || `HTTP ${res.status}` };

      setData(prev => { const u = prev.filter(d => d.id !== id); saveCache(u); return u; });
      setSynced(true);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'No se pudo conectar con el servidor.' };
    }
  }, []);

  return { data, loading, synced, fetchAll, create, update, remove };
}

/** Sólo los activos, que son los que se ofrecen al capturar una plantilla. */
export function tiposActivos(todos: TipoPlantillaCatalogo[]): TipoPlantillaCatalogo[] {
  return todos.filter(t => t.activo);
}

/**
 * Busca un tipo por su clave para poder pintar su etiqueta e ícono.
 * Cae al respaldo para que una plantilla vieja nunca se vea sin nombre.
 */
export function metaTipoPlantilla(
  todos: TipoPlantillaCatalogo[],
  clave: string,
): TipoPlantillaCatalogo | undefined {
  return todos.find(t => t.clave === clave) || TIPOS_RESPALDO.find(t => t.clave === clave);
}
