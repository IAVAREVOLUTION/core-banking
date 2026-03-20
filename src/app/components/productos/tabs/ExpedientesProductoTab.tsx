import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { useTabPersistence } from '@/app/hooks/useProductoPersistence';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// ═══════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════
interface ExpedienteProducto {
  id: number;
  tipo: string;
  claveDocumento: string;
  descripcion: string;
  obligatorio: boolean;
  persona: string;
  fase: string;
  formato: string;
  area: string;
  promptIA: string; // FIX: Copiar promptIA del catálogo de documentos
}

interface CatalogoDocItem {
  id: string;
  clave: string;
  nombre: string;
  activo: boolean;
  promptIA: string; // FIX: Campo para almacenar prompt de IA
}

interface ExpedientesProductoTabProps {
  mode: 'create' | 'edit' | 'view' | 'nuevo' | 'editar' | 'ver';
  productId: number | string;
  initialData?: ExpedienteProducto[];
  persistToStorage?: boolean;
  storagePrefix?: string;
  fases?: { phaseName: string; [k: string]: any }[];
}

// ════════════════════════════════��══════════════════════════════
// Catálogos
// ═══════════════════════════════════════════════════════════════
const TIPOS_PERSONA = ['Ambas', 'Física', 'Moral'];

const FORMATOS = ['PDF', 'PDF / Imagen', 'PDF / Excel', 'Imagen', 'Excel', 'Word', 'Otro'];

const AREAS = ['Comercial', 'Jurídico', 'Mesa de Control', 'Tesorería']; // Nuevo catálogo

// ═══════════════════════════════════════════════════════════════
// Hook: useCatalogoDocumentos
// Patrón: API → sessionStorage fallback
// ═══════════════════════════════════════════════════════════════
const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HEADERS_API = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${publicAnonKey}`,
};

function useCatalogoDocumentos() {
  const [catalogo, setCatalogo] = useState<CatalogoDocItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const CACHE_KEY = 'exp_catalogo_documentos_cache';

    // Helper para extraer promptIA (maneja objeto anidado o string directo)
    const extractPromptIA = (data: any): string => {
      if (!data) return '';
      // Caso 1: promptIA es un objeto con propiedad promptIA anidada (estructura J_CATALOGOS)
      if (typeof data.promptIA === 'object' && data.promptIA !== null) {
        return data.promptIA.promptIA || data.promptIA.instrucciones || data.promptIA.texto || '';
      }
      // Caso 2: promptIA es un string directo
      if (typeof data.promptIA === 'string') {
        return data.promptIA;
      }
      return '';
    };

    const loadCache = (): CatalogoDocItem[] => {
      try {
        const raw = sessionStorage.getItem(CACHE_KEY);
        if (!raw) return [];
        const items = JSON.parse(raw);
        // FIX: Re-extraer promptIA para manejar cache antiguo o datos anidados
        return items.map((d: CatalogoDocItem) => {
          // Si el item tiene promptIA como objeto anidado (estructura J_CATALOGOS), re-extraer
          if (typeof d.promptIA === 'object' && d.promptIA !== null && typeof d.promptIA.promptIA === 'string') {
            return {
              ...d,
              promptIA: d.promptIA.promptIA || '',
            };
          }
          return d;
        });
      } catch { return []; }
    };

    const saveCache = (items: CatalogoDocItem[]) => {
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(items)); } catch { /* noop */ }
    };

    const fetchFromAPI = async () => {
      try {
        console.log('[RequisitosOK] Fetching catálogo documentos desde API...');
        const res = await fetch(`${BASE_URL}/catalogos/documentos`, { headers: HEADERS_API });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        const rows: any[] = json.data || json || [];
        console.log('[RequisitosOK] Rows received:', rows.length);
        
        const items: CatalogoDocItem[] = rows
          .map((r: any) => {
            const promptIA = extractPromptIA(r.data);
            console.log(`[RequisitosOK] Documento: "${r.data?.nombre}" | r.data.promptIA tipo: ${typeof r.data?.promptIA} | promptIA extraído: ${promptIA ? 'SÍ (' + promptIA.substring(0, 50) + '...)' : 'NO VACÍO'}`);
            return {
              id: r.id,
              clave: r.data?.clave || '',
              nombre: r.data?.nombre || '',
              activo: r.data?.activo !== false,
              promptIA,
            };
          })
          .filter((d: CatalogoDocItem) => d.activo);
        console.log(`[RequisitosOK] Catálogo documentos cargado: ${items.length} activos`);
        console.log(`[RequisitosOK] Catálogo con promptIA:`, items.filter(i => i.promptIA).length, 'de', items.length);
        if (!cancelled) {
          setCatalogo(items);
          saveCache(items);
        }
      } catch (err) {
        console.warn('[RequisitosOK] Error fetching catálogo, usando cache:', err);
        if (!cancelled) {
          setCatalogo(loadCache());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Carga inmediata desde cache, luego refresca desde API
    // IMPORTANTE: Siempre hacer fetch para obtener datos actualizados con promptIA
    const cached = loadCache();
    if (cached.length > 0) {
      setCatalogo(cached);
      setLoading(false);
    }
    // Siempre hacer fetch para refrescar promptIA desde la BD
    fetchFromAPI();

    return () => { cancelled = true; };
  }, []);

  return { catalogo, loading };
}

// ═══════════════════════════════════════════════════════════════
// Helper: extraer nombre de fase de un objeto (soporta múltiples formatos)
// ═══════════════════════════════════════════════════════════════
function extractPhaseName(f: any): string {
  if (!f || typeof f !== 'object') return '';
  // Primero intentar phaseName, luego phaseId (bug legacy: el nombre se guardaba en phaseId),
  // luego otros posibles campos
  return f.phaseName || f.phaseId || f.nombre || f.name || f.descripcion || f.fase || f.phase || '';
}

// ═══════════════════════════════════════════════════════════════
// Helper: leer fases desde sessionStorage (FasesTab pattern)
// ═══════════════════════════════════════════════════════════════
function readFasesFromStorage(storagePrefix: string, productId: number | string): string[] {
  try {
    const key = `${storagePrefix}_fases_${productId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) {
      console.log(`[RequisitosOK] No hay fases en storage key="${key}"`);
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const names = parsed.map((f: any) => extractPhaseName(f)).filter(Boolean);
      console.log(`[RequisitosOK] Fases desde storage key="${key}":`, names);
      return names;
    }
    return [];
  } catch { return []; }
}

// ═══════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════
export const ExpedientesProductoTab = forwardRef<{ getData: () => ExpedienteProducto[] }, ExpedientesProductoTabProps>(
  ({ mode, productId, initialData, persistToStorage, storagePrefix, fases }, ref) => {
    const prefix = storagePrefix || 'credito';
    const storageKey = persistToStorage && productId ? `${prefix}_expedientes_prod_${productId}` : '';

    const isCreate = mode === 'create' || mode === 'nuevo';
    const isViewMode = mode === 'view' || mode === 'ver';

    // ══════════════════════════════════════════════════════════════
    // FIX: Requisitos OK (Expedientes) es 100% manual.
    // - En Alta: vacío (sin defaults automáticos).
    // - En Editar/Ver: solo mostrar datos guardados (initialData de BD).
    // - Si no hay datos guardados: vacío (sin registros de ejemplo).
    // Los requisitos solo deben existir si el usuario los registra manualmente.
    // ══════════════════════════════════════════════════════════════
    const defaultData: ExpedienteProducto[] = initialData && initialData.length > 0
      ? initialData
      : [];

    // Protección contra datos stale en sessionStorage
    if (isCreate && storageKey) {
      try { sessionStorage.removeItem(storageKey); } catch (_) { /* ignore */ }
    }

    const { data, setData } = useTabPersistence<ExpedienteProducto>(storageKey, defaultData);

    useImperativeHandle(ref, () => ({ getData: () => data }), [data]);

    // ── Catálogo de documentos dinámico desde J_CATALOGOS ──
    const { catalogo: catalogoDocumentos, loading: loadingCatalogo } = useCatalogoDocumentos();

    // ── Fases: prop > sessionStorage (sin fallback hardcodeado) ──
    // Solo muestra las fases reales configuradas en el subtab Fases del producto.
    // Se re-lee desde sessionStorage periódicamente para capturar fases agregadas
    // en el subtab Fases sin necesidad de guardar el producto.
    const [fasesDisponibles, setFasesDisponibles] = useState<string[]>([]);

    // Helper para sincronizar fases desde props o sessionStorage
    const syncFases = () => {
      const allNames: string[] = [];

      // 1) Desde prop fases (viene del producto guardado en BD)
      if (fases && fases.length > 0) {
        const propNames = fases.map(f => extractPhaseName(f)).filter(Boolean);
        console.log(`[RequisitosOK] syncFases — prop fases (${fases.length} items):`, propNames, '| raw[0]:', JSON.stringify(fases[0]));
        allNames.push(...propNames);
      }

      // 2) Desde sessionStorage (fases agregadas en FasesTab, guardadas o no)
      const storageNames = readFasesFromStorage(prefix, productId);
      if (storageNames.length > 0) {
        // Agregar las que no estén ya desde props (merge sin duplicados)
        storageNames.forEach(name => {
          if (!allNames.includes(name)) allNames.push(name);
        });
      }

      console.log(`[RequisitosOK] syncFases — total fases disponibles: ${allNames.length}`, allNames);

      setFasesDisponibles(prev => {
        const joined = allNames.join(',');
        return prev.join(',') === joined ? prev : allNames;
      });
    };

    // Carga inicial + re-sync cuando cambian props
    useEffect(() => {
      syncFases();
    }, [fases, prefix, productId]);

    // Polling: re-leer fases desde sessionStorage cada 2s
    // para capturar fases que el usuario agregó en el subtab Fases
    // sin haber guardado el producto aún.
    useEffect(() => {
      const interval = setInterval(() => {
        syncFases();
      }, 2000);
      return () => clearInterval(interval);
    }, [fases, prefix, productId]);

    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedItem, setSelectedItem] = useState<ExpedienteProducto | undefined>();
    const [showMenu, setShowMenu] = useState(false);
    const [deleteMode, setDeleteMode] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
    const [filterText, setFilterText] = useState('');
    const [filterPersona, setFilterPersona] = useState<string>('');

    // Filtrado
    const filteredData = data.filter(item => {
      const matchText = !filterText || 
        item.tipo.toLowerCase().includes(filterText.toLowerCase()) ||
        item.descripcion.toLowerCase().includes(filterText.toLowerCase()) ||
        item.fase.toLowerCase().includes(filterText.toLowerCase());
      const matchPersona = !filterPersona || item.persona === filterPersona;
      return matchText && matchPersona;
    });

    const handleDeleteRequest = (id: number) => {
      setDeleteTargetId(id);
      setShowDeleteModal(true);
    };

    const confirmDelete = () => {
      if (deleteTargetId !== null) {
        setData(data.filter(item => item.id !== deleteTargetId));
        setSelectedRow(null);
        setDeleteTargetId(null);
        setShowDeleteModal(false);
        toast.success('Documento eliminado correctamente');
      }
    };

    const handleNew = () => {
      if (isViewMode) { toast.warning('Modo solo lectura'); return; }
      syncFases(); // Refresh fases desde sessionStorage antes de abrir modal
      setFormMode('create');
      setSelectedItem(undefined);
      setShowFormModal(true);
    };

    const handleEdit = (item: ExpedienteProducto) => {
      if (isViewMode) { handleView(item); return; }
      syncFases(); // Refresh fases desde sessionStorage antes de abrir modal
      
      // FIX: Buscar promptIA del catálogo usando claveDocumento para requisitos guardados antes de la corrección
      const catalogoMatch = catalogoDocumentos.find(d => d.clave === item.claveDocumento);
      const itemConPrompt = {
        ...item,
        promptIA: catalogoMatch?.promptIA || item.promptIA || '',
      };
      
      console.log('[RequisitosOK] handleEdit - item original:', { claveDocumento: item.claveDocumento, promptIA: item.promptIA ? 'SÍ' : 'NO' });
      console.log('[RequisitosOK] handleEdit - catálogo match:', catalogoMatch ? { nombre: catalogoMatch.nombre, promptIA: catalogoMatch.promptIA ? 'SÍ' : 'NO' } : 'NO ENCONTRADO');
      
      setFormMode('edit');
      setSelectedItem(itemConPrompt);
      setShowFormModal(true);
    };

    const handleView = (item: ExpedienteProducto) => {
      syncFases(); // Refresh fases desde sessionStorage antes de abrir modal
      
      // FIX: Buscar promptIA del catálogo usando claveDocumento
      const catalogoMatch = catalogoDocumentos.find(d => d.clave === item.claveDocumento);
      const itemConPrompt = {
        ...item,
        promptIA: catalogoMatch?.promptIA || item.promptIA || '',
      };
      
      setFormMode('view');
      setSelectedItem(itemConPrompt);
      setShowFormModal(true);
    };

    const handleSaveForm = (formData: Omit<ExpedienteProducto, 'id'>) => {
      console.log('[RequisitosOK] handleSaveForm - formData recibido:', JSON.stringify(formData));
      console.log('[RequisitosOK] handleSaveForm - promptIA:', formData.promptIA ? 'SÍ (' + formData.promptIA.substring(0, 50) + '...)' : 'NO VACÍO');
      
      if (formMode === 'create') {
        const newItem: ExpedienteProducto = {
          id: Math.max(...data.map(d => d.id), 0) + 1,
          ...formData,
        };
        console.log('[RequisitosOK] handleSaveForm - newItem a guardar:', JSON.stringify(newItem));
        setData([...data, newItem]);
        toast.success('Documento agregado correctamente');
      } else if (formMode === 'edit') {
        const updated = data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d);
        console.log('[RequisitosOK] handleSaveForm - items actualizados:', updated.length);
        setData(updated);
        toast.success('Documento actualizado correctamente');
      }
      setShowFormModal(false);
    };

    // Stats
    const obligatorios = data.filter(d => d.obligatorio).length;
    const opcionales = data.length - obligatorios;

    return (
      <>
        <div className="bg-white">
          {/* Header temático */}
          <div className="section-header-theme px-4 py-2 mb-4 flex items-center justify-between rounded-t">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Requisitos OK — Documentación requerida
            </span>
            {!isViewMode && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleNew}
                  className="px-4 py-1 rounded text-xs font-medium transition-colors bg-white/20 text-white hover:bg-white/30"
                >
                  + Nuevo
                </button>
                <button
                  onClick={() => setDeleteMode(!deleteMode)}
                  className={`px-4 py-1 rounded text-xs font-medium transition-colors ${
                    deleteMode
                      ? 'bg-white text-red-600 font-semibold shadow-sm'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>

          {/* Barra de filtros y acciones */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="relative">
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] rounded flex items-center gap-1"
              >
                Menú
                <svg width="10" height="6" viewBox="0 0 10 6" fill="white"><path d="M0 0l5 6 5-6z"/></svg>
              </button>
              {showMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 shadow-lg z-10 min-w-[160px] rounded overflow-hidden">
                  <button onClick={() => { toast.success('Exportando a Excel'); setShowMenu(false); }} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 border-b border-gray-100">Exportar a Excel</button>
                  <button onClick={() => { toast.success('Exportando a CSV'); setShowMenu(false); }} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 border-b border-gray-100">Exportar a CSV</button>
                  <button onClick={() => { toast.success('Exportando a PDF'); setShowMenu(false); }} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 border-b border-gray-100">Exportar a PDF</button>
                  <button onClick={() => { toast.success('Imprimiendo...'); setShowMenu(false); }} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50">Imprimir</button>
                </div>
              )}
            </div>

            {/* Filtro por texto */}
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Buscar documento..."
                className="px-2.5 py-1 text-xs border border-gray-300 rounded w-48 focus:border-blue-500 focus:ring-1 ring-blue-500 outline-none"
              />
            </div>

            {/* Filtro por persona */}
            <select
              value={filterPersona}
              onChange={(e) => setFilterPersona(e.target.value)}
              className="px-2.5 py-1 text-xs border border-gray-300 rounded bg-white focus:border-blue-500 outline-none"
            >
              <option value="">Todas las personas</option>
              {TIPOS_PERSONA.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {filterText || filterPersona ? (
              <button
                onClick={() => { setFilterText(''); setFilterPersona(''); }}
                className="text-[10px] text-blue-600 hover:underline"
              >
                Limpiar filtros
              </button>
            ) : null}

            <span className="text-[11px] text-gray-500 ml-auto">
              Doble clic para {isViewMode ? 'ver detalle' : 'editar'}
            </span>
          </div>

          {/* Tabla */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead className="table-header-theme">
                <tr>
                  {deleteMode && !isViewMode && (
                    <th className="text-center px-2 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-16">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </th>
                  )}
                  <th className="text-center px-2 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-12">ID</th>
                  <th className="text-left px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Tipo de Documento</th>
                  <th className="text-center px-2 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-20">Clave</th>
                  <th className="text-left px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Descripción</th>
                  <th className="text-center px-2 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-24">Obligatorio</th>
                  <th className="text-center px-2 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-28">Tipo Persona</th>
                  <th className="text-center px-2 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-28">Fase Requerida</th>
                  <th className="text-center px-2 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-28">Formato</th>
                  <th className="text-center px-2 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-28">Área</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={deleteMode && !isViewMode ? 11 : 10} className="px-3 py-10 text-center text-gray-400 text-xs">
                      <div className="flex flex-col items-center gap-2">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" strokeLinecap="round" strokeLinejoin="round"/>
                          <polyline points="14 2 14 8 20 8" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="9" y1="15" x2="15" y2="15" strokeLinecap="round"/>
                        </svg>
                        <span className="font-medium text-gray-500">
                          {data.length === 0 ? 'No hay documentos configurados' : 'No se encontraron resultados'}
                        </span>
                        {!isViewMode && data.length === 0 && (
                          <span className="text-gray-400">Haga clic en "+ Nuevo" para agregar un documento requerido</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, index) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedRow(item.id)}
                      onDoubleClick={() => handleEdit(item)}
                      className={`row-hover-theme transition-colors cursor-pointer ${
                        selectedRow === item.id
                          ? 'bg-blue-100/70 ring-1 ring-inset ring-blue-300'
                          : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
                      }`}
                    >
                      {deleteMode && !isViewMode && (
                        <td className="text-center px-2 py-1.5 border-b border-gray-200">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteRequest(item.id); }}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                            title="Eliminar documento"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                          </button>
                        </td>
                      )}
                      <td className="px-2 py-1.5 border-b border-gray-200 text-center">
                        <span className="inline-flex items-center justify-center bg-primary-tint-theme text-primary-theme font-semibold rounded-full px-2 py-0.5 min-w-[1.6rem] text-[10px]">
                          {item.id}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 border-b border-gray-200 font-medium text-gray-800">{item.tipo}</td>
                      <td className="px-2 py-1.5 border-b border-gray-200 text-center">
                        <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-mono font-semibold">
                          {item.claveDocumento || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-gray-600">{item.descripcion}</td>
                      <td className="px-2 py-1.5 border-b border-gray-200 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          item.obligatorio
                            ? 'bg-red-50 text-red-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${item.obligatorio ? 'bg-red-500' : 'bg-gray-400'}`} />
                          {item.obligatorio ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 border-b border-gray-200 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                          item.persona === 'Ambas' ? 'bg-purple-50 text-purple-700' :
                          item.persona === 'Física' ? 'bg-blue-50 text-blue-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>
                          {item.persona}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 border-b border-gray-200 text-center">
                        <span className="text-gray-600">{item.fase}</span>
                      </td>
                      <td className="px-2 py-1.5 border-b border-gray-200 text-center">
                        <span className="text-gray-600">{item.formato}</span>
                      </td>
                      <td className="px-2 py-1.5 border-b border-gray-200 text-center">
                        <span className="text-gray-600">{item.area}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer con stats */}
          <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] text-gray-500">
              Total: <span className="font-semibold text-gray-700">{data.length}</span> documento{data.length !== 1 ? 's' : ''}
              {filteredData.length !== data.length && (
                <span className="text-blue-600 ml-1">(mostrando {filteredData.length})</span>
              )}
            </span>
            {data.length > 0 && (
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-red-600">
                  <span className="font-semibold">{obligatorios}</span> obligatorio{obligatorios !== 1 ? 's' : ''}
                </span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-500">
                  <span className="font-semibold">{opcionales}</span> opcional{opcionales !== 1 ? 'es' : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Modal de confirmación de eliminación */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-[440px] mx-4 overflow-hidden">
              <div className="modal-header-theme px-5 py-3">
                <h3 className="text-sm font-semibold text-white">Confirmar Eliminación</h3>
              </div>
              <div className="px-6 py-6 flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">¿Eliminar este documento?</p>
                  <p className="text-xs text-gray-500">El requisito documental será removido de la configuración del producto.</p>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-3 flex justify-end gap-2.5 border-t border-gray-200">
                <button onClick={() => { setShowDeleteModal(false); setDeleteTargetId(null); }} className="px-5 py-1.5 text-xs bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-50 font-medium transition-colors">
                  Cancelar
                </button>
                <button onClick={confirmDelete} className="px-5 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-medium transition-colors shadow-sm">
                  Sí, Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de formulario */}
        {showFormModal && (
          <ExpedienteFormModal
            mode={formMode}
            item={selectedItem}
            onSave={handleSaveForm}
            onClose={() => setShowFormModal(false)}
            catalogoDocumentos={catalogoDocumentos}
            loadingCatalogo={loadingCatalogo}
            fasesDisponibles={fasesDisponibles}
          />
        )}
      </>
    );
  }
);

ExpedientesProductoTab.displayName = 'ExpedientesProductoTab';

// ═══════════════════════════════════════════════════════════════
// Modal de formulario
// ═══════════════════════════════════════════════════════════════
interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: ExpedienteProducto;
  onSave: (data: Omit<ExpedienteProducto, 'id'>) => void;
  onClose: () => void;
  catalogoDocumentos: CatalogoDocItem[];
  loadingCatalogo: boolean;
  fasesDisponibles: string[];
}

function ExpedienteFormModal({ mode, item, onSave, onClose, catalogoDocumentos, loadingCatalogo, fasesDisponibles }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    tipo: item?.tipo || '',
    claveDocumento: item?.claveDocumento || '',
    descripcion: item?.descripcion || '',
    obligatorio: item?.obligatorio ?? true,
    persona: item?.persona || 'Ambas',
    fase: item?.fase || '',
    formato: item?.formato || 'PDF',
    area: item?.area || 'Comercial',
    promptIA: item?.promptIA || '', // FIX: Incluir promptIA del item o vacío
  });

  // ── Auto-map claveDocumento AND promptIA when tipo changes ──
  const handleTipoChange = (nombre: string) => {
    const match = catalogoDocumentos.find(d => d.nombre === nombre);
    console.log('[RequisitosOK] handleTipoChange - documento seleccionado:', nombre);
    console.log('[RequisitosOK] handleTipoChange - match del catálogo:', match ? { clave: match.clave, promptIA: match.promptIA ? 'SÍ' : 'NO' } : 'NO ENCONTRADO');
    
    setFormData(prev => {
      const newForm = {
        ...prev,
        tipo: nombre,
        claveDocumento: match?.clave || '',
        promptIA: match?.promptIA || prev.promptIA,
      };
      console.log('[RequisitosOK] handleTipoChange - formData actualizado:', { promptIA: newForm.promptIA ? 'SÍ' : 'NO' });
      return newForm;
    });
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) { onClose(); return; }

    if (!formData.tipo.trim()) {
      toast.error('Campo requerido', { description: 'Seleccione un tipo de documento' });
      return;
    }
    if (!formData.descripcion.trim()) {
      toast.error('Campo requerido', { description: 'Ingrese una descripción del documento' });
      return;
    }
    if (formData.descripcion.length > 255) {
      toast.error('Descripción no puede exceder 255 caracteres');
      return;
    }

    console.log('[RequisitosOK] handleSubmit - formData completo:', JSON.stringify(formData));
    console.log('[RequisitosOK] handleSubmit - promptIA presente:', formData.promptIA ? 'SÍ' : 'NO');
    console.log('[RequisitosOK] handleSubmit - promptIA contenido:', formData.promptIA?.substring(0, 100) || 'VACÍO');

    onSave(formData);
  };

  const inputClassName = (disabled?: boolean) => {
    const baseClass = 'w-full px-2.5 py-1.5 text-xs rounded';
    if (isViewMode || disabled) {
      return `${baseClass} border-0 bg-gray-50 text-gray-700 cursor-default`;
    }
    return `${baseClass} border border-gray-300 bg-white focus:border-blue-500 focus:ring-1 ring-blue-500 outline-none transition-colors`;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header-theme px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-wide uppercase">
            {mode === 'create' ? 'Nuevo Documento Requerido' : mode === 'edit' ? 'Editar Documento' : 'Detalle del Documento'}
          </span>
          <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center transition-colors" title="Cerrar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-4 border-l-4 border-[#2E5C91] rounded-r">
                <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Información del Documento</span>
              </div>

              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                {/* Tipo de Documento — desde Catálogo J_CATALOGOS */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Tipo de Documento <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => handleTipoChange(e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName()}
                  >
                    <option value="">{loadingCatalogo ? '— Cargando catálogo…' : '— Seleccionar tipo —'}</option>
                    {catalogoDocumentos.map(doc => (
                      <option key={doc.id} value={doc.nombre}>{doc.nombre}</option>
                    ))}
                  </select>
                  {catalogoDocumentos.length === 0 && !loadingCatalogo && (
                    <span className="text-[10px] text-amber-600 mt-0.5 block">No se encontraron documentos en el catálogo</span>
                  )}
                </div>

                {/* Clave Documento — solo lectura, mapeado automático 1:1 */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Clave Documento
                  </label>
                  <input
                    type="text"
                    value={formData.claveDocumento}
                    readOnly
                    className={inputClassName(true)}
                    placeholder="Se asigna automáticamente"
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Mapeada desde el catálogo</span>
                </div>

                {/* Descripción */}
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Descripción <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    maxLength={255}
                    rows={2}
                    value={formData.descripcion}
                    onChange={(e) => handleChange('descripcion', e.target.value)}
                    disabled={isViewMode}
                    placeholder="Descripción del requisito documental..."
                    className={`${inputClassName()} resize-none`}
                  />
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[10px] text-gray-400">Máximo 255 caracteres</span>
                    <span className={`text-[10px] ${formData.descripcion.length > 230 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {formData.descripcion.length}/255
                    </span>
                  </div>
                </div>

                {/* Tipo Persona */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Tipo Persona</label>
                  <select
                    value={formData.persona}
                    onChange={(e) => handleChange('persona', e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName()}
                  >
                    {TIPOS_PERSONA.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Fase Requerida — desde subtab Fases del producto */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Fase Requerida</label>
                  <select
                    value={formData.fase}
                    onChange={(e) => handleChange('fase', e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName()}
                  >
                    <option value="">— Seleccionar fase —</option>
                    {fasesDisponibles.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  {fasesDisponibles.length === 0 && !isViewMode && (
                    <span className="text-[10px] text-amber-600 mt-0.5 block">
                      No hay fases configuradas. Agregue fases en el subtab "Fases" del producto.
                    </span>
                  )}
                </div>

                {/* Formato */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Formato</label>
                  <select
                    value={formData.formato}
                    onChange={(e) => handleChange('formato', e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName()}
                  >
                    {FORMATOS.map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                {/* Obligatorio */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Obligatorio</label>
                  <div className="flex items-center gap-2 mt-1">
                    <label className={`relative inline-flex items-center ${isViewMode ? 'cursor-default' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={formData.obligatorio}
                        onChange={(e) => handleChange('obligatorio', e.target.checked)}
                        disabled={isViewMode}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-500"></div>
                    </label>
                    <span className={`text-xs font-medium ${formData.obligatorio ? 'text-red-700' : 'text-gray-500'}`}>
                      {formData.obligatorio ? 'Obligatorio' : 'Opcional'}
                    </span>
                  </div>
                </div>

                {/* Area */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Área</label>
                  <select
                    value={formData.area}
                    onChange={(e) => handleChange('area', e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName()}
                  >
                    {AREAS.map(a => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                {/* Prompt IA — instrucciones para validación del documento */}
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    <span className="flex items-center gap-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8zm1-13h-2v6h2zm0 8h-2v-2h2z"/>
                      </svg>
                      Instrucciones IA para Validación
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    value={formData.promptIA}
                    onChange={(e) => handleChange('promptIA', e.target.value)}
                    disabled={isViewMode}
                    placeholder="Ej: Verificar que sea una credencial INE/IFE vigente con fotografía visible y datos legibles..."
                    className={`${inputClassName()} resize-none`}
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">
                    Instrucciones que usará la IA para validar este documento. Se autocompleta desde el catálogo.
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <button type="button" onClick={onClose} className="px-4 py-1.5 rounded text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors">
                {isViewMode ? 'Cerrar' : 'Cancelar'}
              </button>
              {!isViewMode && (
                <button type="submit" className="px-5 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium transition-colors shadow-sm">
                  {mode === 'create' ? 'Agregar Documento' : 'Guardar Cambios'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}