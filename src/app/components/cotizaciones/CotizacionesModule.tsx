/**
 * CotizacionesModule.tsx
 *
 * Módulo principal de Cotizaciones
 * Subcategorías: Captación | Crédito | Línea de Crédito
 *
 * Cada subcategoría tiene: Dashboard → Lista → Formulario (Alta/Editar/Ver)
 * Persistencia futura en J_COTIZACIONES (esquema EFINANCIANET_DB)
 *
 * ══════════════════════════════════════════════════════════════════
 * Diseño:
 *   - Barra superior de subcategorías (Captación / Crédito / Línea de Crédito)
 *     estilo Productos: tab activo bg-primary-theme text-white, ícono hamburger
 *   - Lista institucional réplica de ClientesList
 *   - Formulario con blue-stripe tabs (réplica AltaClienteDefault)
 * ══════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, DollarSign, Clock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

import { CotizacionCaptacionList } from './CotizacionCaptacionList';
import { CotizacionCaptacionForm } from './CotizacionCaptacionForm';
import type { CotizacionCaptacion } from './cotizacionCaptacionTypes';
import { useCotizacionesCaptacionDB } from '../../hooks/useCotizacionesCaptacionDB';
import { CotizacionCreditoList } from './CotizacionCreditoList';
import { CotizacionCreditoForm } from './CotizacionCreditoForm';
import type { CotizacionCredito } from './cotizacionCreditoTypes';
import { generarNoCotizaCredito, crearCotizacionCreditoVacia } from './cotizacionCreditoTypes';

type SubCategoria = 'captacion' | 'credito' | 'linea-credito';
type ViewMode = 'dashboard' | 'list' | 'form';
type FormMode = 'create' | 'edit' | 'view';

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#6B7280'];
const formatMoney = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

// ════════════════════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════════════════════
function CotizacionesDashboard({ cotizaciones, onNew, onViewList }: {
  cotizaciones: CotizacionCaptacion[];
  onNew: () => void;
  onViewList: () => void;
}) {
  const total = cotizaciones.length;
  const pendientes = cotizaciones.filter(c => c.estatus_cotiza === 'Pendiente').length;
  const aprobadas = cotizaciones.filter(c => c.estatus_cotiza === 'Aprobada').length;
  const montoTotal = cotizaciones.reduce((s, c) => s + (c.data.montoCotizado || 0), 0);

  const estatusData = Object.entries(
    cotizaciones.reduce((acc, c) => { acc[c.estatus_cotiza] = (acc[c.estatus_cotiza] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const productoData = Object.entries(
    cotizaciones.reduce((acc, c) => {
      const key = c.data.producto?.nombreProducto || 'Sin producto';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  const montoByProducto = Object.entries(
    cotizaciones.reduce((acc, c) => {
      const key = c.data.producto?.nombreProducto || 'Otro';
      acc[key] = (acc[key] || 0) + (c.data.montoCotizado || 0);
      return acc;
    }, {} as Record<string, number>)
  ).map(([prod, monto]) => ({ prod, monto: monto / 1000 }));

  const renderEstatus = (est: string) => {
    let bg = 'bg-gray-100 text-gray-700';
    if (est === 'Pendiente') bg = 'bg-yellow-100 text-yellow-800';
    else if (est === 'Aprobada') bg = 'bg-green-100 text-green-800';
    return <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${bg}`}>{est}</span>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><FileText className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-[10px] text-gray-500">Total Cotizaciones</p><p className="text-xl text-gray-900">{total}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center"><Clock className="w-5 h-5 text-yellow-600" /></div>
            <div><p className="text-[10px] text-gray-500">Pendientes</p><p className="text-xl text-yellow-600">{pendientes}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <div><p className="text-[10px] text-gray-500">Aprobadas</p><p className="text-xl text-green-600">{aprobadas}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center"><DollarSign className="w-5 h-5 text-emerald-600" /></div>
            <div><p className="text-[10px] text-gray-500">Monto Total</p><p className="text-lg text-emerald-600">{formatMoney(montoTotal)}</p></div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-sm text-gray-700 mb-3">Por Estatus</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={estatusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {estatusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-sm text-gray-700 mb-3">Por Producto</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={productoData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {productoData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="text-sm text-gray-700 mb-3">Monto por Producto (miles)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={montoByProducto}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="prod" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `$${v.toLocaleString()} K`} />
              <Bar dataKey="monto" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabla resumen */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm text-gray-700">Cotizaciones Captación Recientes</h3>
          <button onClick={onViewList} className="text-xs text-blue-600 hover:underline">Ver todas</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left px-3 py-2">ID Cotiza</th>
                <th className="text-left px-3 py-2">Cliente</th>
                <th className="text-left px-3 py-2">Producto</th>
                <th className="text-right px-3 py-2">Monto</th>
                <th className="text-center px-3 py-2">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {cotizaciones.slice(0, 5).map(c => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-3 py-2 text-blue-600">{c.no_cotiza}</td>
                  <td className="px-3 py-2">{c.data.cliente?.nombreCompleto || '—'}</td>
                  <td className="px-3 py-2">{c.data.producto?.nombreProducto || '—'}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(c.data.montoCotizado || 0)}</td>
                  <td className="px-3 py-2 text-center">{renderEstatus(c.estatus_cotiza)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MÓDULO PRINCIPAL
// ════════════════════════════════════════════════════════════════
interface CotizacionesModuleProps {
  /** Deep-link: ID de cotización a abrir automáticamente en modo ver */
  deepLinkCotizacionId?: string | null;
  /** Deep-link: línea de producto ("Captación", "Crédito", "Línea de Crédito") */
  deepLinkLinea?: string | null;
  /** Callback para limpiar el deep-link después de consumirlo */
  onDeepLinkConsumed?: () => void;
  /** Callback para crear una Solicitud desde una Cotización — spec solicitudes-financieras §1 */
  onCrearSolicitudDesdeCotizacion?: (cotizacionData: any) => void;
}

export function CotizacionesModule({ deepLinkCotizacionId, deepLinkLinea, onDeepLinkConsumed, onCrearSolicitudDesdeCotizacion }: CotizacionesModuleProps = {}) {
  const [subCategoria, setSubCategoria] = useState<SubCategoria>('captacion');
  const [view, setView] = useState<ViewMode>('list');
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [selectedCap, setSelectedCap] = useState<CotizacionCaptacion | undefined>();

  // ── State para Crédito y Línea de Crédito (local, sessionStorage) ──
  const [cotizacionesCredito, setCotizacionesCredito] = useState<CotizacionCredito[]>(() => {
    try { const r = sessionStorage.getItem('cotizaciones_credito_local'); return r ? JSON.parse(r) : []; } catch { return []; }
  });
  const [cotizacionesLC, setCotizacionesLC] = useState<CotizacionCredito[]>(() => {
    try { const r = sessionStorage.getItem('cotizaciones_lc_local'); return r ? JSON.parse(r) : []; } catch { return []; }
  });
  const [selectedCredito, setSelectedCredito] = useState<CotizacionCredito | undefined>();

  // ── IDs de cotizaciones guardadas en BD en esta sesión (evita race condition con cotizacionesDB) ──
  const [capSavedId, setCapSavedId] = useState<string | null>(null);
  const [creSavedId, setCreSavedId] = useState<string | null>(null);

  // ── Ref para deep-link (debe declararse ANTES del hook que lo usa) ──
  const deepLinkProcessedRef = useRef(false);
  const isDeepLinkActive = !!deepLinkCotizacionId && !deepLinkProcessedRef.current;

  // ════════════════════════════════════════════════════════════
  // Hook real — J_COTIZACIONES con fallback a datos mock
  // Activo SIEMPRE para que Crédito y LC también lean de BD
  // ══════════════════════════════════════════════════════════════
  const {
    cotizaciones: cotizacionesDB,
    loading: loadingDB,
    saving: savingDB,
    error: errorDB,
    warning: warningDB,
    backendStatus,
    fetchMethod,
    saveCotizacion,
    refetch,
    seedTestRecord,
  } = useCotizacionesCaptacionDB(true);

  // ══════════════════════════════════════════════════════════════
  // DEEP-LINK — Abrir cotización automáticamente desde otro módulo
  //
  // BUG FIX: `loading` del hook inicia en false (no hay fetch aún),
  // así que el efecto anterior se disparaba con cotizacionesDB vacío
  // y consumía el deep-link sin encontrar nada.
  //
  // Solución: usar un ref para rastrear si ya se procesó, y depender
  // de cotizacionesDB para re-intentar cuando los datos lleguen.
  // También activar el hook de DB forzosamente durante el deep-link.
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    // Reset processed flag cuando cambia el deep-link ID
    if (deepLinkCotizacionId) {
      deepLinkProcessedRef.current = false;
    }
  }, [deepLinkCotizacionId]);

  useEffect(() => {
    if (!deepLinkCotizacionId || deepLinkProcessedRef.current) return;

    console.log(`[CotizModule] Deep-link evaluando: id=${deepLinkCotizacionId}, línea=${deepLinkLinea}, loadingDB=${loadingDB}, cotizacionesDB.length=${cotizacionesDB.length}`);

    // Esperar a que la carga termine Y los datos estén disponibles
    if (loadingDB) {
      console.log('[CotizModule] Deep-link: esperando fin de carga DB...');
      return;
    }

    // Determinar la subcategoría según la línea
    const linea = deepLinkLinea || 'Captación';
    let targetSub: SubCategoria = 'captacion';
    if (linea === 'Crédito') targetSub = 'credito';
    else if (linea === 'Línea de Crédito') targetSub = 'linea-credito';

    const targetId = deepLinkCotizacionId;

    // ── Función de búsqueda unificada: buscar en TODAS las fuentes ──
    const searchAllSources = (): { found: boolean; type: 'cap' | 'cre'; data?: any } => {
      // 1) Buscar en cotizacionesDB (J_COTIZACIONES — fuente de verdad)
      const foundInDB = cotizacionesDB.find(c => c.id === targetId);
      if (foundInDB) {
        return { found: true, type: foundInDB.data?.lineaProducto === 'Captación' ? 'cap' : 'cre', data: foundInDB };
      }

      // 2) Buscar en cotizaciones locales de Crédito (sessionStorage)
      const foundInCredito = cotizacionesCredito.find(c => c.id === targetId);
      if (foundInCredito) return { found: true, type: 'cre', data: foundInCredito };

      // 3) Buscar en cotizaciones locales de Línea de Crédito (sessionStorage)
      const foundInLC = cotizacionesLC.find(c => c.id === targetId);
      if (foundInLC) return { found: true, type: 'cre', data: foundInLC };

      return { found: false };
    };

    const result = searchAllSources();

    if (result.found && result.data) {
      console.log(`[CotizModule] Deep-link: Cotización encontrada (tipo=${result.type}) → abriendo en modo ver`);
      deepLinkProcessedRef.current = true;

      setSubCategoria(targetSub);

      if (result.type === 'cap') {
        setSelectedCap(result.data as CotizacionCaptacion);
      } else {
        // Adaptar a CotizacionCredito si viene de DB
        const adapted: CotizacionCredito = {
          id: result.data.id,
          no_cotiza: result.data.no_cotiza,
          descripcion: result.data.descripcion,
          producto_id: result.data.producto_id,
          cliente_id: result.data.cliente_id,
          fecha_cotiza: result.data.fecha_cotiza,
          estatus_cotiza: result.data.estatus_cotiza,
          linea_cotizacion: result.data.linea_cotizacion,
          data: result.data.data,
        };
        setSelectedCredito(adapted);
      }

      setFormMode('view');
      setView('form');
      onDeepLinkConsumed?.();
    } else if (cotizacionesDB.length > 0) {
      // Ya cargamos datos de DB pero no encontramos → no va a aparecer
      console.warn(`[CotizModule] Deep-link: Cotización id=${targetId} NO encontrada en ninguna fuente (DB: ${cotizacionesDB.length} registros). Mostrando lista.`);
      deepLinkProcessedRef.current = true;
      setSubCategoria(targetSub);
      setView('list');
      onDeepLinkConsumed?.();
    } else {
      // DB aún no ha cargado datos (loading fue false pero cotizacionesDB está vacío → el hook no ha hecho fetch aún)
      console.log(`[CotizModule] Deep-link: Datos DB aún no disponibles (${cotizacionesDB.length} registros), esperando...`);
    }
  }, [deepLinkCotizacionId, deepLinkLinea, loadingDB, cotizacionesDB, cotizacionesCredito, cotizacionesLC]);

  // ════════════════════════════════════════════════════════════
  // FILTRADO UI — spec captacion-cotizaciones-lista.ts §2
  // El hook trae TODOS los registros de J_COTIZACIONES.
  // Filtramos por data.lineaProducto para cada subcategoría.
  // DB es fuente de verdad; sessionStorage como complemento local.
  // ════════════════════════════════════════════════════════════
  const cotizacionesCapDB = cotizacionesDB.filter(
    c => c.data?.lineaProducto === 'Captación'
  );
  const cotizacionesCap = cotizacionesCapDB;

  // ── Crédito: filtrar de BD + merge con sessionStorage local ──
  const cotizacionesCreDB: CotizacionCredito[] = cotizacionesDB
    .filter(c => c.data?.lineaProducto === 'Crédito')
    .map(c => ({
      id: c.id,
      no_cotiza: c.no_cotiza,
      descripcion: c.descripcion,
      producto_id: c.producto_id,
      cliente_id: c.cliente_id,
      fecha_cotiza: c.fecha_cotiza,
      estatus_cotiza: c.estatus_cotiza,
      linea_cotizacion: c.linea_cotizacion || 'Crédito',
      data: c.data as any,
    }));

  // ── Línea de Crédito: filtrar de BD + merge con sessionStorage local ──
  const cotizacionesLCDB: CotizacionCredito[] = cotizacionesDB
    .filter(c => c.data?.lineaProducto === 'Línea de Crédito')
    .map(c => ({
      id: c.id,
      no_cotiza: c.no_cotiza,
      descripcion: c.descripcion,
      producto_id: c.producto_id,
      cliente_id: c.cliente_id,
      fecha_cotiza: c.fecha_cotiza,
      estatus_cotiza: c.estatus_cotiza,
      linea_cotizacion: c.linea_cotizacion || 'Línea Crédito',
      data: c.data as any,
    }));

  // Merge: BD toma precedencia por id, luego agregar locales que no estén en BD
  const mergeDBAndLocal = (dbItems: CotizacionCredito[], localItems: CotizacionCredito[]): CotizacionCredito[] => {
    const dbIds = new Set(dbItems.map(c => c.id));
    const dbFolios = new Set(dbItems.map(c => c.no_cotiza));
    const localOnly = localItems.filter(c => !dbIds.has(c.id) && !dbFolios.has(c.no_cotiza));
    return [...dbItems, ...localOnly];
  };

  const cotizacionesCreDisplay = mergeDBAndLocal(cotizacionesCreDB, cotizacionesCredito);
  const cotizacionesLCDisplay = mergeDBAndLocal(cotizacionesLCDB, cotizacionesLC);

  // ── Captación handlers ──
  const handleNew = () => { setSelectedCap(undefined); setCapSavedId(null); setFormMode('create'); setView('form'); };
  const handleView = (c: CotizacionCaptacion) => { setSelectedCap(c); setFormMode('view'); setView('form'); };
  const handleEdit = (c: CotizacionCaptacion) => { setSelectedCap(c); setFormMode('edit'); setView('form'); };

  /** Convierte YYYY-MM-DD → DD/MM/YYYY (formato DatePicker). Devuelve '' si inválido. */
  const isoToDMY = (iso: string): string => {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return iso; // ya estaba en otro formato
  };

  /** Crear Solicitud desde Cotización Captación — spec solicitudes-financieras §1–§4 */
  const handleCrearSolicitudCaptacion = (c: CotizacionCaptacion) => {
    if (c.estatus_cotiza === 'Aceptada') {
      toast.error('Cotización ya aceptada', { description: 'Esta cotización ya generó una solicitud.', duration: 3000 });
      return;
    }
    const nameParts = (c.data.cliente?.nombreCompleto || '').split(' ');
    const isMoral = (c.data.cliente?.nombreCompleto || '').includes('S.A.') || (c.data.cliente?.nombreCompleto || '').includes('SA de CV');
    const mappedData = {
      cotizacionId: c.no_cotiza,
      lineaProducto: 'Captación',
      tipoProducto: c.data.producto?.tipoProducto || '',
      tipoPersona: isMoral ? 'Moral' : 'Física',
      nombrePersona: nameParts[0] || '',
      apellidoPaternoPersona: nameParts[1] || '',
      apellidoMaternoPersona: nameParts.slice(2).join(' ') || '',
      // FIX: usar c.producto_id (UUID de J_PRODUCTOS) — claveProducto es la clave textual, no el UUID
      productoId: c.producto_id || '',
      nombreProducto: c.data.producto?.nombreProducto || '',
      montoSolicitado: String(parseFloat(String(c.data.montoCotizado || '0').replace(/[^0-9.-]/g, '')) || 0),
      // Cliente — requerido para Solicitud de Activación (Fase 6)
      _clienteId: c.cliente_id || c.data?.cliente?.id || '',
      // Fechas derivadas del calendario de aportaciones — convertir YYYY-MM-DD → DD/MM/YYYY
      fechaInicio: isoToDMY(c.data.calendarioAportaciones?.[0]?.fecha || ''),
      fechaFin: c.data.calendarioAportaciones?.length > 0
        ? isoToDMY(c.data.calendarioAportaciones[c.data.calendarioAportaciones.length - 1].fecha)
        : '',
      // Calendario completo — se muestra directamente en el subtab Simulación de la Solicitud
      _calendarioAportaciones: c.data.calendarioAportaciones || [],
      _terminosCondiciones: {
        montoSolicitado: String(parseFloat(String(c.data.montoCotizado || '0').replace(/[^0-9.-]/g, '')) || 0),
        fechaPrimeraAportacion: c.data.fechaPrimeraAportacion || '',
        plazo: String(c.data.plazoCumplirMontoMinimo || ''),
        frecuencia: c.data.frecuenciaCapitalizacion || c.data.periodoCumplirMontoMinimo || 'Mensual',
        tasa: String(c.data.tasaMinInteres || ''),
        tipoTasa: 'Fija',
        tipoCalculo: String(c.data.baseCalculo || c.data.tipoCalculo || 'Simple'),
        moneda: c.data.moneda || 'MXN',
        montoGarantia: '',
        seguroFinanciado: false,
        montoSeguro: '',
        // Captación — perfil del inversionista y rendimientos
        perfilInversionista: c.data.perfilInversionista || '',
        riesgoInversionista: c.data.riesgoInversionista || '',
        horizonteInversion: c.data.horizonteInversion || '',
        rendimientos: Array.isArray(c.data.tasaInversionRegistros)
          ? c.data.tasaInversionRegistros.map((r: any) => ({
              plazo: String(r.plazo || ''),
              tasaAnual: String(r.tasaAnual ?? ''),
              montoMinimo: String(r.montoMinimo ?? ''),
              tasaMensual: String(r.tasaMensual ?? ''),
            }))
          : [],
      },
    };
    onCrearSolicitudDesdeCotizacion?.(mappedData);
    toast.success('Creando Solicitud desde Cotización Captación', {
      description: `${c.no_cotiza} → Navegando al módulo Solicitudes.`,
      duration: 4000,
    });
  };

  const handleSave = async (c: CotizacionCaptacion) => {
    try {
      const result = await saveCotizacion(c);
      if (result.ok) {
        const savedId = result.id ?? c.id;
        const savedRecord: CotizacionCaptacion = { ...c, id: savedId };
        setSelectedCap(savedRecord);
        setCapSavedId(savedId);
        setFormMode('edit');
        toast.success('Cotización guardada', { description: `Folio: ${c.no_cotiza}` });
        setTimeout(() => refetch(), 500);
      } else {
        toast.error('Error al guardar la cotización', { description: result.error || 'No se pudo guardar en la base de datos' });
      }
    } catch (err: any) {
      toast.error('Error inesperado al guardar', { description: err?.message || String(err) });
    }
    // No redirigir al listado; el usuario permanece en el formulario
  };

  // ── Crédito / Línea de Crédito handlers ──
  const handleNewCredito = () => { setSelectedCredito(undefined); setCreSavedId(null); setFormMode('create'); setView('form'); };
  const handleViewCredito = (c: CotizacionCredito) => { setSelectedCredito(c); setFormMode('view'); setView('form'); };
  const handleEditCredito = (c: CotizacionCredito) => { setSelectedCredito(c); setFormMode('edit'); setView('form'); };

  /** Crear Solicitud desde Cotización (Crédito / LC) — spec solicitudes-financieras §1–§4 */
  const handleCrearSolicitudCredito = (c: CotizacionCredito) => {
    if (c.estatus_cotiza === 'Aceptada') {
      toast.error('Cotización ya aceptada', { description: 'Esta cotización ya generó una solicitud.', duration: 3000 });
      return;
    }
    // Mapeo Cotización → Solicitud según spec §4
    const nameParts = (c.data.cliente?.nombreCompleto || '').split(' ');
    const mappedData = {
      cotizacionId: c.no_cotiza,
      lineaProducto: c.data.lineaProducto || 'Crédito',
      tipoProducto: c.data.producto?.tipoProducto || '',
      tipoPersona: (c.data.cliente?.nombreCompleto || '').includes('S.A.') || (c.data.cliente?.nombreCompleto || '').includes('SA de CV') ? 'Moral' : 'Física',
      nombrePersona: nameParts[0] || '',
      apellidoPaternoPersona: nameParts[1] || '',
      apellidoMaternoPersona: nameParts.slice(2).join(' ') || '',
      productoId: c.producto_id || '',
      nombreProducto: c.data.producto?.nombreProducto || '',
      montoSolicitado: Number(c.data.montoSolicitado || 0).toFixed(2),
      // Cliente — requerido para Solicitud de Activación (Fase 6)
      _clienteId: c.cliente_id || c.data?.cliente?.id || '',
      // Fechas derivadas de la tabla de amortización
      fechaInicio: isoToDMY(c.data.fechaPrimerPago || (c.data.tablaAmortizacion?.[0] as any)?.fechaPago || ''),
      fechaFin: (() => {
        const tabla = c.data.tablaAmortizacion || [];
        const ultima = tabla[tabla.length - 1] as any;
        return isoToDMY(ultima?.fechaPago || '');
      })(),
      // Calendario para el subtab Simulación (usa tablaAmortizacion de la cotización)
      _calendarioAportaciones: (c.data.tablaAmortizacion || []).map((r: any) => ({
        noAportacion: r.noPago,
        fecha: r.fechaPago,
        monto: r.pagoTotal ?? r.pagoPeriodo ?? 0,
        moneda: c.data.moneda || 'MXN',
      })),
      // Términos y condiciones para pre-llenar
      _terminosCondiciones: {
        montoSolicitado: Number(c.data.montoSolicitado || 0).toFixed(2),
        fechaPrimerPago: c.data.fechaPrimerPago || '',
        plazo: String(c.data.plazo || ''),
        frecuencia: c.data.periodo || c.data.frecuenciaPago || 'Mensual',
        tasa: String(c.data.tasaCotizada || ''),
        tipoTasa: c.data.tipoTasa || 'Fija',
        tipoCalculo: c.data.tipoCalculoAmortizacion || 'Francés',
        moneda: c.data.moneda || 'MXN',
        montoGarantia: Number(c.data.montoGarantia || 0).toFixed(2),
        seguroFinanciado: c.data.seguroFinanciado || false,
        montoSeguro: Number(c.data.montoSeguro || 0).toFixed(2),
        // Línea de Crédito — campos específicos (homologados §4)
        ...(c.data.lineaProducto === 'Línea de Crédito' ? {
          tipoLinea: c.data.tipoLinea || '',
          montoLineaAutorizada: Number((c.data as any).montoLineaAutorizada || 0).toFixed(2),
          disposicionesPermitidas: String((c.data as any).disposicionesPermitidas || ''),
          montoDisposicionMinima: Number((c.data as any).montoDisposicionMinima || 0).toFixed(2),
          vigenciaLinea: String((c.data as any).vigenciaLinea || ''),
        } : {}),
        // Simulación completa — tabla de amortización desde Cotización
        _simulacion: (c.data.tablaAmortizacion || []).map((r: any) => ({
          noPago: r.noPago,
          fechaPago: r.fechaPago,
          saldoInsoluto: r.saldoInsoluto,
          pagoCapital: r.pagoCapital,
          pagoInteres: r.pagoInteres,
          ivaInteres: r.ivaInteres,
          pagoPeriodo: r.pagoPeriodo,
          pagoSeguro: r.pagoSeguro || 0,
          pagoTotal: r.pagoTotal,
        })),
      },
    };
    // Marcar cotización como "Aceptada"
    const isCredito = subCategoria === 'credito';
    const ssKey = isCredito ? 'cotizaciones_credito_local' : 'cotizaciones_lc_local';
    const setter = isCredito ? setCotizacionesCredito : setCotizacionesLC;
    setter(prev => {
      const next = prev.map(x => x.id === c.id ? { ...x, estatus_cotiza: 'Aceptada' } : x);
      try { sessionStorage.setItem(ssKey, JSON.stringify(next)); } catch {}
      return next;
    });
    // Callback al módulo padre (App.tsx) para navegar a Solicitudes
    onCrearSolicitudDesdeCotizacion?.(mappedData);
    toast.success('Creando Solicitud desde Cotización', {
      description: `${c.no_cotiza} → El sistema navegará al módulo Solicitudes con los datos pre-llenados.`,
      duration: 4000,
    });
  };

  const handleSaveCredito = async (c: CotizacionCredito) => {
    const isCredito = subCategoria === 'credito';
    const ssKey = isCredito ? 'cotizaciones_credito_local' : 'cotizaciones_lc_local';
    const setter = isCredito ? setCotizacionesCredito : setCotizacionesLC;

    // ── Persistir en BD vía RPC (misma tabla J_COTIZACIONES) ──
    const dbResult = await saveCotizacion(c as any);
    const savedId = dbResult.id ?? c.id;

    if (dbResult.ok) {
      console.log('[CotizModule] Cotización Crédito/LC guardada en BD OK, id:', savedId);
    } else {
      console.warn('[CotizModule] Cotización Crédito/LC falló en BD, guardando localmente:', dbResult.error);
    }

    // ── Actualizar sessionStorage con el ID definitivo ──
    const savedRecord: CotizacionCredito = { ...c, id: savedId };
    setter(prev => {
      const idx = prev.findIndex(x => x.id === c.id || x.no_cotiza === c.no_cotiza);
      let next: CotizacionCredito[];
      if (idx >= 0) { next = [...prev]; next[idx] = savedRecord; } else { next = [...prev, savedRecord]; }
      try { sessionStorage.setItem(ssKey, JSON.stringify(next)); } catch {}
      return next;
    });

    // Actualizar el registro seleccionado con el ID definitivo y permanecer en el formulario
    setSelectedCredito(savedRecord);
    setCreSavedId(savedId);
    setFormMode('edit');
    toast.success('Cotización guardada', { description: `Folio: ${c.no_cotiza}` });

    // Refetch para sincronizar con BD
    if (dbResult.ok) {
      setTimeout(() => refetch(), 500);
    }
    // No redirigir al listado; el usuario permanece en el formulario
  };

  // ── Verificar si la cotización seleccionada existe en BD ──
  // capSavedId/creSavedId se establece sincrónicamente en el mismo ciclo de render que el save,
  // evitando la race condition entre setCotizaciones (hook) y setSelectedCap (módulo).
  const cotizacionCapEnBD =
    (selectedCap != null && selectedCap.id === capSavedId) ||
    (selectedCap ? cotizacionesDB.some(c => c.id === selectedCap.id) : false);
  const cotizacionCreEnBD =
    (selectedCredito != null && selectedCredito.id === creSavedId) ||
    (selectedCredito ? cotizacionesDB.some(c => c.id === selectedCredito.id) : false);

  // ── Cambiar subcategoría resetea la vista ──
  const handleSubCategoriaChange = (sc: SubCategoria) => {
    setSubCategoria(sc);
    setView('list');
  };

  // ── Subcategoría config ──
  const subCats: { id: SubCategoria; label: string }[] = [
    { id: 'captacion', label: 'Cotizaciones Captación' },
    { id: 'credito', label: 'Cotizaciones Crédito' },
    { id: 'linea-credito', label: 'Cotizaciones Línea de Crédito' },
  ];

  return (
    <>
      {/* ═══ Barra de subcategorías — estilo Productos ═══ */}
      <div className="bg-white border-b border-gray-300 px-4 py-2.5">
        <div className="flex items-center gap-1">
          {subCats.map(sc => {
            const isActive = subCategoria === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => handleSubCategoriaChange(sc.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded text-sm transition-colors ${
                  isActive
                    ? 'bg-primary-theme text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {/* Hamburger icon */}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 3.5h10M2 7h10M2 10.5h10" />
                </svg>
                <span>{sc.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ Contenido según subcategoría y vista ═══ */}
      {subCategoria === 'captacion' ? (
        <>
          {view === 'list' ? (
            <CotizacionCaptacionList
              cotizaciones={cotizacionesCap}
              onNew={handleNew}
              onView={handleView}
              onEdit={handleEdit}
              loading={loadingDB}
              warning={warningDB}
              backendStatus={backendStatus}
              fetchMethod={fetchMethod}
              onRefresh={refetch}
              onSeedTest={seedTestRecord}
              dbRowCount={cotizacionesDB.length}
              onCrearSolicitud={handleCrearSolicitudCaptacion}
            />
          ) : (
            <CotizacionCaptacionForm mode={formMode} cotizacion={selectedCap} onSave={handleSave} onBack={() => setView('list')} onCrearSolicitud={handleCrearSolicitudCaptacion} existeEnBD={cotizacionCapEnBD} />
          )}
        </>
      ) : subCategoria === 'credito' ? (
        <>
          {view === 'list' ? (
            <CotizacionCreditoList
              cotizaciones={cotizacionesCreDisplay}
              lineaLabel="Crédito"
              onNew={handleNewCredito}
              onView={handleViewCredito}
              onEdit={handleEditCredito}
              loading={loadingDB}
              onRefresh={refetch}
              onCrearSolicitud={handleCrearSolicitudCredito}
            />
          ) : (
            <CotizacionCreditoForm
              mode={formMode}
              lineaProducto="Crédito"
              cotizacion={selectedCredito}
              onSave={handleSaveCredito}
              onBack={() => setView('list')}
              onCrearSolicitud={handleCrearSolicitudCredito}
              existeEnBD={cotizacionCreEnBD}
            />
          )}
        </>
      ) : (
        <>
          {view === 'list' ? (
            <CotizacionCreditoList
              cotizaciones={cotizacionesLCDisplay}
              lineaLabel="Línea de Crédito"
              onNew={handleNewCredito}
              onView={handleViewCredito}
              onEdit={handleEditCredito}
              loading={loadingDB}
              onRefresh={refetch}
              onCrearSolicitud={handleCrearSolicitudCredito}
            />
          ) : (
            <CotizacionCreditoForm
              mode={formMode}
              lineaProducto="Línea de Crédito"
              cotizacion={selectedCredito}
              onSave={handleSaveCredito}
              onBack={() => setView('list')}
              onCrearSolicitud={handleCrearSolicitudCredito}
              existeEnBD={cotizacionCreEnBD}
            />
          )}
        </>
      )}
    </>
  );
}