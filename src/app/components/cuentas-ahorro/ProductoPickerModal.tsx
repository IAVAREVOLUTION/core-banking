/**
 * ProductoPickerModal.tsx — Pick Map de Productos (CAPTACION / Ahorro)
 *
 * Modal que carga productos reales desde J_PRODUCTOS via RPCs en public.
 *
 * J_PRODUCTOS estructura real:
 *   id   (uuid)
 *   type (varchar) — "Captación" con acento para captación
 *   data (jsonb)   — { nombreProducto, claveProducto, tipoProducto, lineaProducto, ... }
 *
 * Estrategia de carga (multi-intento):
 *   1. RPC get_productos_captacion via supabase.rpc()
 *   2. RPC get_all_jproductos via supabase.rpc() + filtro client-side
 *   3. REST directo via fetch POST /rest/v1/rpc/get_productos_captacion
 *   4. REST directo via fetch POST /rest/v1/rpc/get_all_jproductos
 *   5. REST directo query tabla via fetch GET /rest/v1/J_PRODUCTOS (schema header)
 *   6. Estado vacío con instrucciones
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabaseClient';
import { SUPABASE_URL } from '@/app/lib/supabaseClient';
import { publicAnonKey } from '/utils/supabase/info';

export interface ProductoPickResult {
  productoId: string;
  claveProducto: string;
  nombreProducto: string;
  tasa: number;
  montoMinimo: number;
}

interface ProductoRow {
  id: string;
  type?: string;
  data?: Record<string, any>;
  [key: string]: any;
}

const LOG = '[ProductosPicker]';

/** Mapear row de BD a resultado del pick — todo viene del JSONB data */
function mapRow(row: ProductoRow): ProductoPickResult {
  const d = row.data || {};
  const def = d.default || {};
  return {
    productoId: row.id,
    claveProducto: d.claveProducto || def.claveProducto || d.idProducto || def.clave || row.id?.slice(0, 8) || '',
    nombreProducto: d.nombreProducto || def.nombreProducto || d.nombre || def.nombre || d.descripcion || '',
    tasa: parseFloat(d.tasaInicial ?? def.tasaInicial ?? d.tasa ?? def.tasa ?? '0') || 0,
    montoMinimo: parseFloat(d.montoMinimo ?? def.montoMinimo ?? d.montoMin ?? '0') || 0,
  };
}

/** Filtrar solo CAPTACION client-side */
function filterCaptacion(rows: ProductoRow[]): ProductoRow[] {
  return rows.filter(r => {
    const t = (r.type || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (t.includes('CAPTACION')) return true;
    const d = r.data || {};
    const linea = (d.lineaProducto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (!linea) return true;
    return linea.includes('CAPTACION');
  });
}

/** Helper: hacer POST directo a una RPC via fetch */
async function fetchRpc(rpcName: string): Promise<{ data: any[] | null; error: string | null }> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/rpc/${rpcName}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': publicAnonKey,
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: '{}',
    });
    const text = await res.text();
    console.log(`${LOG} fetch RPC ${rpcName} status=${res.status} body=${text.slice(0, 300)}`);
    if (!res.ok) return { data: null, error: `${res.status}: ${text.slice(0, 200)}` };
    const json = JSON.parse(text);
    return { data: Array.isArray(json) ? json : [], error: null };
  } catch (e: any) {
    return { data: null, error: e?.message || 'fetch error' };
  }
}

/** Helper: query directa a la tabla via REST */
async function fetchTableDirect(): Promise<{ data: any[] | null; error: string | null }> {
  try {
    // Intentar con schema header para EFINANCIANET_DB
    const url = `${SUPABASE_URL}/rest/v1/J_PRODUCTOS?select=id,type,data`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': publicAnonKey,
        'Authorization': `Bearer ${publicAnonKey}`,
        'Accept': 'application/json',
        'Accept-Profile': 'EFINANCIANET_DB',
      },
    });
    const text = await res.text();
    console.log(`${LOG} fetch table direct status=${res.status} body=${text.slice(0, 300)}`);
    if (!res.ok) return { data: null, error: `${res.status}: ${text.slice(0, 200)}` };
    const json = JSON.parse(text);
    return { data: Array.isArray(json) ? json : [], error: null };
  } catch (e: any) {
    return { data: null, error: e?.message || 'fetch error' };
  }
}

interface ProductoPickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (result: ProductoPickResult) => void;
}

export function ProductoPickerModal({ open, onClose, onSelect }: ProductoPickerModalProps) {
  const [productos, setProductos] = useState<ProductoPickResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addDebug = (msg: string) => {
    console.log(`${LOG} ${msg}`);
    setDebugLog(prev => [...prev, msg]);
  };

  const fetchProductos = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    setDebugLog([]);
    addDebug('Iniciando carga de productos CAPTACION...');

    // ── Intento 1: supabase.rpc('get_productos_captacion') ──
    try {
      addDebug('Intento 1 → supabase.rpc("get_productos_captacion")');
      const { data, error } = await supabase.rpc('get_productos_captacion');
      addDebug(`  Resultado: error=${error?.message || 'null'}, data=${Array.isArray(data) ? data.length + ' rows' : typeof data}`);
      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped = (data as ProductoRow[]).map(mapRow);
        addDebug(`  ✓ OK → ${mapped.length} productos de captación`);
        setProductos(mapped);
        setSource('RPC get_productos_captacion');
        setLoading(false);
        return;
      }
      if (error) addDebug(`  ✗ Error: ${error.message} (code: ${error.code})`);
      else if (Array.isArray(data) && data.length === 0) addDebug('  ✗ RPC existe pero retornó 0 filas');
    } catch (e: any) {
      addDebug(`  ✗ Excepción: ${e?.message}`);
    }

    // ── Intento 2: supabase.rpc('get_all_jproductos') ──
    try {
      addDebug('Intento 2 → supabase.rpc("get_all_jproductos")');
      const { data, error } = await supabase.rpc('get_all_jproductos');
      addDebug(`  Resultado: error=${error?.message || 'null'}, data=${Array.isArray(data) ? data.length + ' rows' : typeof data}`);
      if (!error && Array.isArray(data) && data.length > 0) {
        const captacion = filterCaptacion(data as ProductoRow[]);
        const mapped = captacion.map(mapRow);
        addDebug(`  ✓ OK → ${data.length} total, ${mapped.length} después de filtro CAPTACION`);
        setProductos(mapped);
        setSource(`RPC get_all_jproductos (${mapped.length} de ${data.length})`);
        setLoading(false);
        return;
      }
      if (error) addDebug(`  ✗ Error: ${error.message} (code: ${error.code})`);
      else if (Array.isArray(data) && data.length === 0) addDebug('  ✗ RPC existe pero retornó 0 filas');
    } catch (e: any) {
      addDebug(`  ✗ Excepción: ${e?.message}`);
    }

    // ── Intento 3: fetch directo RPC get_productos_captacion ──
    {
      addDebug('Intento 3 → fetch POST /rest/v1/rpc/get_productos_captacion');
      const result = await fetchRpc('get_productos_captacion');
      addDebug(`  Resultado: error=${result.error || 'null'}, data=${result.data ? result.data.length + ' rows' : 'null'}`);
      if (!result.error && result.data && result.data.length > 0) {
        const mapped = (result.data as ProductoRow[]).map(mapRow);
        addDebug(`  ✓ OK → ${mapped.length} productos`);
        setProductos(mapped);
        setSource('REST directo get_productos_captacion');
        setLoading(false);
        return;
      }
      if (result.error) addDebug(`  ✗ Error: ${result.error}`);
    }

    // ── Intento 4: fetch directo RPC get_all_jproductos ──
    {
      addDebug('Intento 4 → fetch POST /rest/v1/rpc/get_all_jproductos');
      const result = await fetchRpc('get_all_jproductos');
      addDebug(`  Resultado: error=${result.error || 'null'}, data=${result.data ? result.data.length + ' rows' : 'null'}`);
      if (!result.error && result.data && result.data.length > 0) {
        const captacion = filterCaptacion(result.data as ProductoRow[]);
        const mapped = captacion.map(mapRow);
        addDebug(`  ✓ OK → ${result.data.length} total, ${mapped.length} CAPTACION`);
        setProductos(mapped);
        setSource(`REST directo get_all_jproductos (${mapped.length} de ${result.data.length})`);
        setLoading(false);
        return;
      }
      if (result.error) addDebug(`  ✗ Error: ${result.error}`);
    }

    // ── Intento 5: REST directo a tabla con Accept-Profile header ──
    {
      addDebug('Intento 5 → fetch GET J_PRODUCTOS con Accept-Profile: EFINANCIANET_DB');
      const result = await fetchTableDirect();
      addDebug(`  Resultado: error=${result.error || 'null'}, data=${result.data ? result.data.length + ' rows' : 'null'}`);
      if (!result.error && result.data && result.data.length > 0) {
        const captacion = filterCaptacion(result.data as ProductoRow[]);
        const mapped = captacion.map(mapRow);
        addDebug(`  ✓ OK → ${result.data.length} total, ${mapped.length} CAPTACION`);
        setProductos(mapped);
        setSource(`REST directo tabla (${mapped.length} de ${result.data.length})`);
        setLoading(false);
        return;
      }
      if (result.error) addDebug(`  ✗ Error: ${result.error}`);
    }

    // ── Sin datos ──
    addDebug('✗ Todos los intentos fallaron');
    setProductos([]);
    setSource('Sin conexión a J_PRODUCTOS');
    setErrorMsg(
      'No se encontraron productos. Ejecute el SQL de migración en Supabase SQL Editor para crear las RPCs.'
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      fetchProductos();
      setSearch('');
    }
  }, [open, fetchProductos]);

  if (!open) return null;

  const filtered = productos.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      p.claveProducto.toLowerCase().includes(s) ||
      p.nombreProducto.toLowerCase().includes(s)
    );
  });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-[750px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#4A6FA5" strokeWidth="1.5">
              <rect x="3" y="3" width="12" height="12" rx="2" />
              <path d="M3 7h12M7 3v12" />
            </svg>
            <h3 className="text-sm text-gray-800">Seleccionar Producto — CAPTACIÓN / Ahorro</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
        </div>

        {/* Search */}
        <div className="px-5 py-2 border-b border-gray-200">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por clave o nombre de producto..."
            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5] focus:border-[#4A6FA5] focus:outline-none"
            autoFocus
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-gray-400">{source ? `Fuente: ${source}` : ''}</span>
            <span className="text-[10px] text-gray-500">{filtered.length} producto{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-xs text-gray-500">
              <svg className="animate-spin h-5 w-5 mr-2 text-[#4A6FA5]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Cargando productos desde J_PRODUCTOS...
            </div>
          ) : productos.length === 0 ? (
            <div className="text-center py-6 px-6">
              <div className="text-gray-400 mb-3">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto">
                  <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-xs text-gray-500 mb-2">No se encontraron productos de Captación</p>
              {errorMsg && (
                <p className="text-[10px] text-amber-700 mb-2">{errorMsg}</p>
              )}

              {/* Debug log */}
              {debugLog.length > 0 && (
                <div className="mt-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-left max-h-[200px] overflow-auto">
                  <p className="text-[10px] text-gray-500 mb-1">Diagnóstico de conexión ({debugLog.length} pasos):</p>
                  <div className="space-y-0.5">
                    {debugLog.map((line, i) => (
                      <p
                        key={i}
                        className={`text-[9px] font-mono ${
                          line.includes('✓') ? 'text-green-600' :
                          line.includes('✗') ? 'text-red-500' :
                          line.startsWith('  ') ? 'text-gray-500' : 'text-gray-700'
                        }`}
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* SQL de migración */}
              <details className="mt-3 text-left">
                <summary className="text-[10px] text-blue-600 cursor-pointer hover:underline">
                  Ver SQL para crear las RPCs en Supabase
                </summary>
                <pre className="mt-1 p-2 bg-gray-50 border border-gray-200 rounded text-[8px] font-mono whitespace-pre-wrap max-h-[180px] overflow-auto text-gray-700">
{`-- Ejecutar en Supabase SQL Editor:

DROP FUNCTION IF EXISTS public.get_productos_captacion();
CREATE OR REPLACE FUNCTION public.get_productos_captacion()
RETURNS TABLE (id uuid, type text, data jsonb)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '' AS $$
  SELECT p.id, p.type::text, p.data
  FROM "EFINANCIANET_DB"."J_PRODUCTOS" p
  WHERE p.type ILIKE '%Captaci%'
  ORDER BY COALESCE(p.data->>'nombreProducto',
    p.data->>'nombre', '') ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_productos_captacion()
  TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_all_jproductos();
CREATE OR REPLACE FUNCTION public.get_all_jproductos()
RETURNS TABLE (id uuid, type text, data jsonb)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = '' AS $$
  SELECT p.id, p.type::text, p.data
  FROM "EFINANCIANET_DB"."J_PRODUCTOS" p
  ORDER BY COALESCE(p.data->>'nombreProducto',
    p.data->>'nombre', '') ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_all_jproductos()
  TO anon, authenticated, service_role;`}
                </pre>
              </details>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-200 sticky top-0">
                  <th className="px-3 py-2 text-left text-gray-600">CLAVE</th>
                  <th className="px-3 py-2 text-left text-gray-600">PRODUCTO</th>
                  <th className="px-3 py-2 text-left text-gray-600">TIPO</th>
                  <th className="px-3 py-2 text-right text-gray-600">TASA %</th>
                  <th className="px-3 py-2 text-right text-gray-600">MONTO MIN.</th>
                  <th className="px-3 py-2 text-center text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                      Sin resultados para la búsqueda
                    </td>
                  </tr>
                ) : filtered.map((p, i) => (
                  <tr
                    key={p.productoId}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                      i % 2 === 1 ? 'bg-gray-50' : 'bg-white'
                    } hover:bg-blue-50`}
                    onDoubleClick={() => { onSelect(p); onClose(); }}
                  >
                    <td className="px-3 py-2 text-gray-700">{p.claveProducto}</td>
                    <td className="px-3 py-2 text-gray-700">{p.nombreProducto}</td>
                    <td className="px-3 py-2 text-gray-500">Captación</td>
                    <td className="px-3 py-2 text-right text-gray-700">{p.tasa.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right text-gray-700">{formatCurrency(p.montoMinimo)}</td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => { onSelect(p); onClose(); }}
                        className="px-3 py-1 btn-secondary-theme rounded text-[10px]"
                      >
                        Seleccionar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg flex items-center justify-between">
          <button
            onClick={fetchProductos}
            className="px-3 py-1.5 text-xs text-[#4A6FA5] hover:bg-blue-50 rounded border border-transparent hover:border-blue-200 transition-colors"
            title="Reintentar carga desde la BD"
          >
            Reintentar
          </button>
          <button onClick={onClose} className="px-4 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-100">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
