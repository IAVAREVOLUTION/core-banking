/**
 * CatalogoInstitucionGobierno.tsx
 *
 * Modal catalogo reutilizable que consulta J_CLIENTES filtrando por
 * clasificacionCliente = "Gobierno Magisterio".
 *
 * Se integra en los modulos de Prospectos y Clientes como campo opcional
 * "INSTITUCION GOBIERNO" con boton de busqueda que abre este catalogo.
 *
 * Arquitectura:
 *   - Consulta la edge function GET /clientes-prospectos
 *   - Filtra client-side por data.clasificacionCliente === "Gobierno Magisterio"
 *   - Muestra tabla con busqueda en tiempo real
 *   - Al seleccionar, devuelve { id, nombre, rfc } del cliente seleccionado
 */
import { useState, useEffect, useCallback } from 'react';
import { Search, X, Building2, Loader2 } from 'lucide-react';
import { supabase, SUPABASE_URL } from '../../lib/supabaseClient';
import { publicAnonKey } from '/utils/supabase/info';

const API_BASE = `${SUPABASE_URL}/functions/v1/make-server-7e2d13d9`;

export interface InstitucionGobiernoSeleccion {
  id: string;
  nombre: string;
  rfc: string;
  subtipo: string;
  estatus: string;
  clasificacionCliente: string;
}

interface CatalogoInstitucionGobiernoProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (institucion: InstitucionGobiernoSeleccion) => void;
}

interface ClienteRow {
  id: string;
  type: string;
  subtipo: string;
  estatus: string;
  data: Record<string, any>;
}

/** Parsea el campo data que puede venir como objeto o como string JSON */
function parseData(raw: any): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw;
}

/** Estructura cruda de una fila de J_CLIENTES */
interface RawRow {
  id: string;
  type: string;
  subtipo?: string;
  estatus?: string;
  data: any;
}

/**
 * 3 estrategias para traer J_CLIENTES (misma lógica que useProspectosDB/useClientesDB):
 *  1. Supabase JS directo — schema('EFINANCIANET_DB').from('J_CLIENTES')
 *  2. Supabase RPC — rpc('get_all_jclientes')
 *  3. Edge Function — /clientes-prospectos (legacy fallback)
 */
async function fetchAllJClientes(): Promise<{ rows: RawRow[]; method: string }> {
  // ── INTENTO 1: Supabase JS directo ──
  try {
    console.log('[CatalogoInstitucionGobierno] INTENTO 1: supabase.schema("EFINANCIANET_DB").from("J_CLIENTES")');
    const { data, error } = await supabase
      .schema('EFINANCIANET_DB')
      .from('J_CLIENTES')
      .select('id, type, subtipo, estatus, data');

    if (!error && data && data.length > 0) {
      console.log(`[CatalogoInstitucionGobierno] INTENTO 1 ÉXITO: ${data.length} registros via schema directo`);
      return { rows: data as RawRow[], method: 'supabase-direct-schema' };
    }
    if (error) console.log('[CatalogoInstitucionGobierno] INTENTO 1 FALLÓ:', error.message);
  } catch (err: any) {
    console.log('[CatalogoInstitucionGobierno] INTENTO 1 EXCEPCIÓN:', err.message);
  }

  // ── INTENTO 2: Supabase RPC ──
  try {
    console.log('[CatalogoInstitucionGobierno] INTENTO 2: supabase.rpc("get_all_jclientes")');
    const { data, error } = await supabase.rpc('get_all_jclientes');

    if (!error && data && (data as any[]).length > 0) {
      const rows = data as RawRow[];
      console.log(`[CatalogoInstitucionGobierno] INTENTO 2 ÉXITO: ${rows.length} registros via RPC`);
      return { rows, method: 'supabase-rpc' };
    }
    if (error) console.log('[CatalogoInstitucionGobierno] INTENTO 2 FALLÓ:', error.message);
  } catch (err: any) {
    console.log('[CatalogoInstitucionGobierno] INTENTO 2 EXCEPCIÓN:', err.message);
  }

  // ── INTENTO 3: Edge Function ──
  try {
    console.log('[CatalogoInstitucionGobierno] INTENTO 3: Edge function /clientes-prospectos');
    const res = await fetch(`${API_BASE}/clientes-prospectos`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { json = null; }

    if (json && res.ok) {
      const rows: RawRow[] = Array.isArray(json) ? json : (json.data || json.rows || []);
      console.log(`[CatalogoInstitucionGobierno] INTENTO 3 ÉXITO: ${rows.length} registros via edge function`);
      return { rows, method: 'edge-function' };
    }
    console.log('[CatalogoInstitucionGobierno] INTENTO 3 FALLÓ:', res.status, json?.error || text.substring(0, 200));
  } catch (err: any) {
    console.log('[CatalogoInstitucionGobierno] INTENTO 3 EXCEPCIÓN:', err.message);
  }

  return { rows: [], method: 'ninguno' };
}

/** Construye nombre completo desde el JSONB data de J_CLIENTES */
function buildNombreCompleto(d: Record<string, any>): string {
  // Persona Moral: usar razonSocial o denominacionRazonSocial
  if (d.razonSocial) return d.razonSocial;
  if (d.denominacionRazonSocial) return d.denominacionRazonSocial;
  // Persona Fisica / PFAE: nombre + apellidos
  const parts = [d.nombre, d.apellidoPaterno, d.apellidoMaterno].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  // Fallback: nombreCompleto si existe
  if (d.nombreCompleto) return d.nombreCompleto;
  return '';
}

export function CatalogoInstitucionGobierno({ isOpen, onClose, onSelect }: CatalogoInstitucionGobiernoProps) {
  const [instituciones, setInstituciones] = useState<InstitucionGobiernoSeleccion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queryMethod, setQueryMethod] = useState('');

  const fetchInstituciones = useCallback(async () => {
    setLoading(true);
    setError(null);
    setQueryMethod('');
    try {
      console.log('[CatalogoInstitucionGobierno] ═══ Iniciando consulta J_CLIENTES (3 estrategias) ═══');

      const { rows: rawRows, method } = await fetchAllJClientes();
      setQueryMethod(method);

      if (rawRows.length === 0) {
        console.warn('[CatalogoInstitucionGobierno] Los 3 intentos fallaron o devolvieron 0 registros');
        setError('No se pudo consultar J_CLIENTES (3 estrategias fallaron)');
        setInstituciones([]);
        return;
      }

      // Debug: mostrar primer registro para verificar estructura
      if (rawRows.length > 0) {
        const sample = rawRows[0];
        const sampleData = parseData(sample.data);
        console.log('[CatalogoInstitucionGobierno] Ejemplo registro[0]:', {
          id: sample.id,
          type: sample.type,
          dataType: typeof sample.data,
          dataKeys: Object.keys(sampleData).slice(0, 12),
          clasificacionCliente: sampleData.clasificacionCliente || '(no existe)',
        });
        // Debug: mostrar TODAS las clasificaciones distintas para diagnosticar
        const todasClasif = new Map<string, number>();
        for (const r of rawRows) {
          const dd = parseData(r.data);
          const c = (dd.clasificacionCliente || '(vacío)').toString().trim();
          todasClasif.set(c, (todasClasif.get(c) || 0) + 1);
        }
        console.log('[CatalogoInstitucionGobierno] Clasificaciones distintas en J_CLIENTES:', Object.fromEntries(todasClasif));
      }

      // Filtrar client-side por clasificacionCliente = "Gobierno Magisterio"
      const filtradas = rawRows
        .filter((row) => {
          const d = parseData(row.data);
          const clasif = (d.clasificacionCliente || '').toString().trim();
          return clasif === 'Gobierno Magisterio';
        })
        .map((row): InstitucionGobiernoSeleccion => {
          const d = parseData(row.data);
          return {
            id: row.id,
            nombre: buildNombreCompleto(d),
            rfc: (d.rfc as string) || '',
            subtipo: row.subtipo || (d.subtipo as string) || '',
            estatus: row.estatus || (d.estatus as string) || '',
            clasificacionCliente: (d.clasificacionCliente as string) || '',
          };
        });

      console.log(`[CatalogoInstitucionGobierno] ${rawRows.length} registros totales, ${filtradas.length} con clasificacion "Gobierno Magisterio" (via ${method})`);
      if (filtradas.length > 0) {
        console.log('[CatalogoInstitucionGobierno] Primera institucion:', filtradas[0]);
      }
      setInstituciones(filtradas);
    } catch (err) {
      console.warn('[CatalogoInstitucionGobierno] Error inesperado:', err);
      setError('Error inesperado al consultar J_CLIENTES');
      setInstituciones([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchInstituciones();
      setBusqueda('');
      setSelectedId(null);
    }
  }, [isOpen, fetchInstituciones]);

  const institucionesFiltradas = instituciones.filter((inst) => {
    if (!busqueda.trim()) return true;
    const term = busqueda.toLowerCase();
    return (
      inst.nombre.toLowerCase().includes(term) ||
      inst.rfc.toLowerCase().includes(term) ||
      inst.subtipo.toLowerCase().includes(term) ||
      inst.clasificacionCliente.toLowerCase().includes(term)
    );
  });

  const handleSeleccionar = () => {
    const selected = instituciones.find((i) => i.id === selectedId);
    if (selected) {
      onSelect(selected);
      onClose();
    }
  };

  const handleDobleClick = (inst: InstitucionGobiernoSeleccion) => {
    onSelect(inst);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-2xl w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="bg-primary-theme text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            <span className="text-sm font-medium">Catalogo de Instituciones - Gobierno Magisterio</span>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, RFC o subtipo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
              autoFocus
            />
          </div>
          <div className="mt-1 text-[10px] text-gray-500">
            Filtro: J_CLIENTES &rarr; Clasificacion Cliente = &quot;Gobierno Magisterio&quot; | {institucionesFiltradas.length} registro(s)
            {queryMethod && <span className="ml-2 text-gray-400">via {queryMethod}</span>}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-4 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500 mr-2" />
              <span className="text-xs text-gray-500">Consultando J_CLIENTES...</span>
            </div>
          ) : error ? (
            <div className="text-center py-10 text-xs text-red-500">{error}</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 border-b">
                  <th className="text-left px-2 py-2 w-8"></th>
                  <th className="text-left px-2 py-2">ID</th>
                  <th className="text-left px-2 py-2">NOMBRE / RAZON SOCIAL</th>
                  <th className="text-left px-2 py-2">RFC</th>
                  <th className="text-left px-2 py-2">CLASIFICACION</th>
                  <th className="text-left px-2 py-2">SUBTIPO</th>
                  <th className="text-left px-2 py-2">ESTATUS</th>
                </tr>
              </thead>
              <tbody>
                {institucionesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-gray-400">
                      No se encontraron instituciones con clasificacion "Gobierno Magisterio"
                    </td>
                  </tr>
                ) : (
                  institucionesFiltradas.map((inst) => (
                    <tr
                      key={inst.id}
                      onClick={() => setSelectedId(inst.id)}
                      onDoubleClick={() => handleDobleClick(inst)}
                      className={`border-b cursor-pointer transition-colors ${
                        selectedId === inst.id
                          ? 'bg-blue-100 border-blue-300'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-2 py-2">
                        <input
                          type="radio"
                          checked={selectedId === inst.id}
                          onChange={() => setSelectedId(inst.id)}
                          className="w-3 h-3"
                        />
                      </td>
                      <td className="px-2 py-2 text-gray-500 font-mono">{inst.id.length > 8 ? inst.id.substring(0, 8) + '...' : inst.id}</td>
                      <td className="px-2 py-2 font-medium text-gray-800">{inst.nombre}</td>
                      <td className="px-2 py-2 text-gray-600">{inst.rfc}</td>
                      <td className="px-2 py-2">
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                          {inst.clasificacionCliente}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px]">
                          {inst.subtipo}
                        </span>
                      </td>
                      <td className="px-2 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          inst.estatus === 'Activo'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {inst.estatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t flex items-center justify-between bg-gray-50 rounded-b-lg">
          <span className="text-[10px] text-gray-400">
            Doble clic para seleccionar directamente
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-700"
            >
              Cancelar
            </button>
            <button
              onClick={handleSeleccionar}
              disabled={!selectedId}
              className={`px-4 py-1.5 text-xs rounded text-white ${
                selectedId
                  ? 'bg-primary-theme hover:opacity-90'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              Seleccionar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Campo reutilizable "INSTITUCION GOBIERNO" con input + boton de busqueda.
 * Integra el modal CatalogoInstitucionGobierno internamente.
 */
interface CampoInstitucionGobiernoProps {
  value: string;
  onChange: (value: string, institucion?: InstitucionGobiernoSeleccion) => void;
  disabled?: boolean;
  /** Estilo visual: 'prospectos' usa layout inline, 'clientes' usa layout apilado */
  variant?: 'prospectos' | 'clientes';
}

export function CampoInstitucionGobierno({ value, onChange, disabled = false, variant = 'prospectos' }: CampoInstitucionGobiernoProps) {
  const [showCatalogo, setShowCatalogo] = useState(false);

  const handleSelect = (inst: InstitucionGobiernoSeleccion) => {
    onChange(inst.nombre, inst);
  };

  const handleClear = () => {
    onChange('', undefined);
  };

  if (variant === 'clientes') {
    // Layout apilado para el modulo de Clientes
    return (
      <>
        <div className="flex flex-col min-h-[52px]">
          <label className="text-[10px] text-gray-600 mb-0.5">
            INSTITUCION GOBIERNO
            <span className="ml-1 text-[9px] text-gray-400">(opcional)</span>
          </label>
          {disabled ? (
            <div className="px-2 py-1 text-xs text-gray-700">{value || ''}</div>
          ) : (
            <div className="flex gap-1">
              <input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Sin institucion asignada"
                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700"
              />
              <button
                type="button"
                onClick={() => setShowCatalogo(true)}
                className="px-2 py-1 bg-primary-theme text-white rounded text-[10px] hover:opacity-90 flex items-center gap-0.5"
                title="Buscar institucion de gobierno"
              >
                <Search className="w-3 h-3" />
              </button>
              {value && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-1.5 py-1 bg-red-50 text-red-500 rounded text-[10px] hover:bg-red-100"
                  title="Limpiar seleccion"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
        <CatalogoInstitucionGobierno
          isOpen={showCatalogo}
          onClose={() => setShowCatalogo(false)}
          onSelect={handleSelect}
        />
      </>
    );
  }

  // Layout inline para el modulo de Prospectos
  return (
    <>
      <div className="flex items-center gap-2">
        <label className="text-xs w-28 flex-shrink-0 text-gray-700">
          INST. GOBIERNO
          <span className="ml-0.5 text-[9px] text-gray-400">(opc.)</span>
        </label>
        {disabled ? (
          <div className="flex-1 px-2 py-1 text-xs text-gray-700 bg-gray-100">{value || ''}</div>
        ) : (
          <div className="flex-1 flex gap-1">
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Sin institucion asignada"
              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700"
            />
            <button
              type="button"
              onClick={() => setShowCatalogo(true)}
              className="px-2 py-1 bg-primary-theme text-white rounded text-[10px] hover:opacity-90 flex items-center gap-0.5"
              title="Buscar institucion de gobierno"
            >
              <Search className="w-3 h-3" />
            </button>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="px-1.5 py-1 bg-red-50 text-red-500 rounded text-[10px] hover:bg-red-100"
                title="Limpiar seleccion"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>
      <CatalogoInstitucionGobierno
        isOpen={showCatalogo}
        onClose={() => setShowCatalogo(false)}
        onSelect={handleSelect}
      />
    </>
  );
}