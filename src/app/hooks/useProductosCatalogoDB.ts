/**
 * useProductosCatalogoDB.ts
 *
 * Hook institucional para consultar TODOS los productos de J_PRODUCTOS
 * sin filtrar por type. Se usa en el subtab Perfil Transaccional
 * para mostrar el catálogo completo (Captación, Crédito, ProductoLineaCredito, etc.)
 *
 * Tabla:    "EFINANCIANET_DB"."J_PRODUCTOS"
 * Columnas: id (uuid PK), type (varchar), data (jsonb)
 *
 * Estrategia de fetch:
 *   1. Edge Function /productos (todos sin filtro)
 *   2. Edge Function /productos-captacion (también retorna todos)
 *   3. sessionStorage fallback
 *   4. Datos locales fallback
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const LOG = '[CatalogoDB]';
const STORAGE_KEY = 'catalogo_productos_all';

export interface ProductoCatalogo {
  id: string;
  nombreProducto: string;
  lineaProducto: string;
  tipoProducto: string;
  sublineaProducto: string;
  claveProducto: string;
  type: string;
  source: 'db' | 'local';
  rawData?: Record<string, any>;
  plantillas?: any[];
}

interface ProductoRow {
  id: string;
  type: string;
  data: Record<string, any>;
}

/**
 * Mapea un registro crudo de J_PRODUCTOS al catálogo simplificado.
 */
function mapRowToCatalogo(row: ProductoRow): ProductoCatalogo | null {
  const d = row.data || {};

  // Soportar esquema nuevo y legacy (datosGenerales[0])
  const dg = Array.isArray(d.datosGenerales) && d.datosGenerales.length > 0
    ? d.datosGenerales[0]
    : null;

  const nombreProducto = d.nombreProducto || dg?.producto || dg?.nombre || d.producto || d.nombre || '';
  if (!nombreProducto) return null; // Sin nombre → skip

  // ── CANONICAL LINE NAMES (only 3 exist in J_PRODUCTOS) ──
  // Map EVERY known variant (DB type, data.lineaProducto, legacy strings)
  // to one of the 3 canonical display names.
  const CANONICAL_LINEA: Record<string, string> = {
    // From row.type
    'ProductoLineaCredito': 'Línea de Crédito',
    'Credito':              'Crédito',
    'Producto':             'Captación',
    // Variants without accents
    'Captacion':            'Captación',
    'Captación':            'Captación',
    'Crédito':              'Crédito',
    'Linea Credito':        'Línea de Crédito',
    'Linea de Credito':     'Línea de Crédito',
    'Línea Crédito':        'Línea de Crédito',
    'Línea de Crédito':     'Línea de Crédito',
    'Linea de Crédito':     'Línea de Crédito',
    'Línea de Credito':     'Línea de Crédito',
    'LineaCredito':         'Línea de Crédito',
    'LíneaCrédito':         'Línea de Crédito',
    'Producto Linea Credito': 'Línea de Crédito',
    // Seguros
    'Seguro':               'Seguros',
    'Seguros':              'Seguros',
    'Seguro de Vida':       'Seguros',
  };
  // row.type is the most reliable source for distinguishing Crédito vs Línea de Crédito,
  // because the JSONB data.lineaProducto may incorrectly say "Crédito" for LineaCredito products.
  // Prioritize row.type when it has a canonical match, then fall back to JSONB fields.
  const rawLineaFromType = row.type ? CANONICAL_LINEA[row.type] : undefined;
  const rawLineaFromData = d.lineaProducto || dg?.lineaProducto || '';
  const rawLinea = rawLineaFromType || rawLineaFromData || row.type || 'Sin línea';
  // First try exact match, then fuzzy normalize
  const lineaProducto = CANONICAL_LINEA[rawLinea] || (() => {
    const stripped = rawLinea.toLowerCase().replace(/[^a-záéíóúñ]/gi, '');
    if (stripped.includes('lineacredito') || stripped.includes('lineadecredito')) return 'Línea de Crédito';
    if (stripped.includes('credito') && !stripped.includes('linea')) return 'Crédito';
    if (stripped.includes('captacion') || stripped === 'producto') return 'Captación';
    if (stripped.includes('seguro')) return 'Seguros';
    return rawLinea;
  })();
  const tipoProducto = d.tipoProducto || dg?.tipoProducto || '';
  const sublineaProducto = d.sublineaProducto || d.subLinea || d.sublínea || dg?.sublineaProducto || dg?.subLinea || dg?.sublínea || d.sublinea || d.subTipo || d.tipoProducto || dg?.subTipo || dg?.tipoProducto || '';
  const claveProducto = d.claveProducto || dg?.clave || d.clave || '';

  return {
    id: row.id,
    nombreProducto,
    lineaProducto,
    tipoProducto,
    sublineaProducto,
    claveProducto,
    type: row.type,
    source: 'db',
    rawData: d,
    // Plantillas del nivel raíz del JSON (hermano de data)
    plantillas: d.plantillas || row.data?.plantillas || [],
  };
}

/**
 * Datos fallback — lista vacía para no mostrar productos ficticios cuando la DB no responde
 */
const PRODUCTOS_FALLBACK: ProductoCatalogo[] = [];

/**
 * Hook principal — consulta TODOS los productos de J_PRODUCTOS sin filtro de tipo.
 * @param active - solo fetch cuando el componente está visible
 */
export function useProductosCatalogoDB(active: boolean) {
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'fallback' | 'offline'>('offline');
  const hasFetched = useRef(false);

  const fetchWithRetry = useCallback(async (url: string, opts: RequestInit, signal?: AbortSignal, retries = 3, delay = 800): Promise<Response> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, { ...opts, signal });
        return res;
      } catch (err) {
        if (signal?.aborted) throw err;
        if (attempt === retries) throw err;
        console.warn(`${LOG} Intento ${attempt}/${retries} fallo, reintentando en ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }
    throw new Error('Unreachable');
  }, []);

  const fetchProductos = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    const headers = { 'Authorization': `Bearer ${publicAnonKey}` };

    // Limpiar cache si contiene productos fallback ficticios de versiones anteriores
    try {
      const cached = sessionStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.some((p: any) => p.source === 'local')) {
          console.log(`${LOG} Limpiando sessionStorage con productos fallback ficticios`);
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch { /* ignore */ }

    try {
      // ── INTENTO 1: /productos (todos sin filtro) ──
      console.log(`${LOG} INTENTO 1: GET /productos (todos sin filtro)...`);
      let res: Response;
      let json: any;

      try {
        res = await fetchWithRetry(`${API_BASE}/productos`, { headers }, signal);
        json = await res.json();
      } catch {
        // ── INTENTO 2: /productos-captacion (también retorna todos) ──
        console.log(`${LOG} INTENTO 2: GET /productos-captacion (fallback, también retorna todos)...`);
        res = await fetchWithRetry(`${API_BASE}/productos-captacion`, { headers }, signal);
        json = await res.json();
      }

      if (json.error) {
        throw new Error(json.error);
      }

      const rows: ProductoRow[] = json.data || [];
      console.log(`${LOG} ${rows.length} registros recibidos de J_PRODUCTOS`);

      const mapped = rows
        .map(mapRowToCatalogo)
        .filter((p): p is ProductoCatalogo => p !== null);

      console.log(`${LOG} ${mapped.length} productos con nombre válido`);

      if (!signal?.aborted) {
        setProductos(mapped);
        setBackendStatus('connected');
        // Cachear en sessionStorage
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        } catch { /* ignore */ }
      }
    } catch (err: any) {
      if (signal?.aborted) return;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`${LOG} Error DB: ${msg}`);

      // ── INTENTO 3: sessionStorage ──
      try {
        const cached = sessionStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`${LOG} INTENTO 3: sessionStorage → ${parsed.length} productos`);
            setProductos(parsed);
            setBackendStatus('fallback');
            setLoading(false);
            return;
          }
        }
      } catch { /* ignore */ }

      // ── INTENTO 4: fallback local ──
      console.log(`${LOG} INTENTO 4: Datos fallback locales (${PRODUCTOS_FALLBACK.length})`);
      setProductos(PRODUCTOS_FALLBACK);
      setBackendStatus('offline');
      setError(msg);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [fetchWithRetry]);

  useEffect(() => {
    if (!active || hasFetched.current) return;
    hasFetched.current = true;
    const controller = new AbortController();
    fetchProductos(controller.signal);
    return () => controller.abort();
  }, [active, fetchProductos]);

  // Extraer líneas únicas dinámicamente
  const lineasDisponibles = [...new Set(productos.map(p => p.lineaProducto))].sort();

  return {
    productos,
    loading,
    error,
    backendStatus,
    lineasDisponibles,
    refetch: () => {
      hasFetched.current = false;
      fetchProductos();
    },
  };
}