import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DatePicker } from '../clientes/DatePicker';
import {
  OriginacionFormData, OriginacionListItem,
  OriginacionAutorizacion, OriginacionGarantia, OriginacionCargo, OriginacionAviso,
  CotizacionRow, EMPTY_FORM,
  saveToSession, loadFromSession, loadFromSavedStore, saveToSavedStore,
  clearSession, commitAndClearSession, generateId,
  formatCurrency, parseCurrency,
  CAT_CLIENTES, CAT_SUCURSAL, CAT_EMPRESA_FONDEADORA, CAT_SUBLINEA, CAT_PRODUCTO,
  CAT_PERIODO, CAT_PLAZOS, CAT_DESTINO_CREDITO, CAT_ESTATUS, CAT_SUB_ESTATUS,
  CAT_MONEDA, CAT_ESTATUS_AUTORIZACION, CAT_AREA,
  CAT_TIPO_GARANTIA, CAT_TIPO_CARGO, CAT_ESTATUS_CARGO, CAT_TIPO_AVISO, CAT_ESTATUS_AVISO,
  CAT_ESTATUS_SC, CAT_ESTATUS_CLIENTE, CAT_ESTATUS_LISTA_NEGRA,
  getOriginaciones, seedOriginacionFromSolicitudItem,
} from './originacionStore';
import { useSolicitudesDB } from '../../hooks/useSolicitudesDB';
import { useProductosCatalogoDB } from '../../hooks/useProductosCatalogoDB';
import { ExpedientesSection } from './ExpedientesSection';
import {
  ejecutarReglasFase,
  FaseOriginacion,
  ReglaValidacionResult,
  getDocumentosObligatorios,
} from './originacionRules';
import { FlujoTrabajo } from './FlujoTrabajo';
import { FasesOriginacionTab } from './tabs/FasesOriginacionTab';
import { PartesRelacionadasTab } from '../solicitudes/tabs/PartesRelacionadasTab';
import { TerminosCondicionesTab } from '../solicitudes/TerminosCondicionesTab';
import { SimulacionTab } from '../solicitudes/SimulacionTab';
import { ComisionesTab } from '../solicitudes/ComisionesTab';

// ═══════════════════════════════════════════════════════════════════
// VIEW STATE — Solo consulta: editar | ver (sin nuevo)
// ═══════════════════════════════════════════════════════════════════
type ViewState = { type: 'dashboard' } | { type: 'list' } | { type: 'form'; mode: 'editar' | 'ver'; id: number | string };

function parseDate(d: string): Date {
  const [day, month, year] = d.split('/');
  const y = parseInt(year);
  return new Date(y < 100 ? 2000 + y : y, parseInt(month) - 1, parseInt(day));
}

const fmtCur = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Mapeo de subEstatus → índice de fase (para FasesOriginacionTab)
const FASE_INDEX: Record<string, number> = {
  'Integración del Expediente': 1,
  'Análisis de Expediente Operativo': 2,
  'Análisis de Expediente Jurídico': 3,
  'Formalización de Cuenta Financiera': 4,
  'Validación de Contratos y Pagarés Firmados': 5,
  'Solicitud de Activación de Cuenta Financiera': 6,
  'Activación de Cuenta Financiera': 7,
};

// Fases de Originación para el listado en Default
const ORIGINACION_FASES = [
  { id: 'integracion', label: 'Integración del Expediente', area: 'INTEGRACIÓN', promptIA: '' },
  { id: 'analisis_op', label: 'Análisis de Expediente Operativo', area: 'ANÁLISIS', promptIA: '' },
  { id: 'analisis_jur', label: 'Análisis de Expediente Jurídico', area: 'ANÁLISIS', promptIA: '' },
  { id: 'formalizacion', label: 'Formalización de Cuenta Financiera', area: 'LIBERACIÓN', promptIA: '' },
  { id: 'contratos', label: 'Validación de Contratos y Pagarés Firmados', area: 'LIBERACIÓN', promptIA: '' },
  { id: 'solic_activacion', label: 'Solicitud de Activación de Cuenta Financiera', area: 'LIBERACIÓN', promptIA: '' },
  { id: 'activacion', label: 'Activación de Cuenta Financiera', area: 'LIBERACIÓN', promptIA: '' },
];

function getCurrentFaseData(subEstatus: string) {
  const faseIndex = parseInt(getFaseIdFromSubEstatus(subEstatus)) - 1;
  return ORIGINACION_FASES[faseIndex] || ORIGINACION_FASES[0];
}

function getFaseIdFromSubEstatus(subEstatus: string): string {
  if (FASE_INDEX[subEstatus] !== undefined) {
    return String(FASE_INDEX[subEstatus]);
  }
  const lower = subEstatus.toLowerCase();
  if (lower.includes('integraci')) return '1';
  if (lower.includes('operativo') || (lower.includes('análisis') && lower.includes('oper'))) return '2';
  if (lower.includes('jurídi')) return '3';
  if (lower.includes('formaliz')) return '4';
  if (lower.includes('contrato') || lower.includes('validaci')) return '5';
  if (lower.includes('solic') && lower.includes('activ')) return '6';
  if (lower.includes('activac')) return '7';
  return '1';
}

// ═══════════════════════════════════════════════════════════════════
// MAIN MODULE — 100% Consulta, sin botón Nuevo
// ═══════════════════════════════════════════════════════════════════
export function OriginacionModule() {
  const [view, setView] = useState<ViewState>({ type: 'dashboard' });
  // Bridge: items locales enviados desde Solicitudes aún no en DB
  const [items, setItems] = useState<OriginacionListItem[]>(() => getOriginaciones());

  // ── Fuente de datos real: Fin_Corp_Accnt (Supabase) ──
  const { solicitudes: solicitudesDB, backendStatus, saveSolicitud } = useSolicitudesDB(true);

  // Mapear SolicitudListItem → OriginacionListItem
  const mapSolToOrig = useCallback((sol: Record<string, any>): OriginacionListItem => ({
    id: sol.id,
    noOriginacion: sol.noSol || String(sol.id),
    noSolicitud: sol.noSol || '',
    noCliente: sol._clienteId || '',
    cliente: sol.nombreCompleto || '',
    fechaSolicitud: sol.fechaSolicitud || '',
    montoSolicitado: sol.montoSolicitado || 0,
    montoAutorizado: sol.montoAutorizado || 0,
    sublinea: sol.tipoProducto || '',
    producto: sol.nombreProducto || '',
    sucursal: sol.sucursal || '',
    estatus: sol.estatusSolicitud || '',
    subEstatus: sol.faseDescripcion || '',
    responsable: sol._data?.solicitud?.header?.responsable || '',
  }), []);

  // Sincronizar lista desde DB cuando lleguen datos — filtro: EstatusSolicitud ≠ "Pendiente"
  useEffect(() => {
    if (backendStatus === 'ready' || backendStatus === 'empty') {
      const dbItems = (solicitudesDB as Record<string, any>[])
        .filter(s => s.estatusSolicitud !== 'Pendiente')
        .map(mapSolToOrig);
      // Agregar bridge items que aún no estén en DB (por noSolicitud)
      const dbNoSols = new Set(dbItems.map(i => i.noSolicitud));
      const bridgeItems = getOriginaciones().filter(i => !dbNoSols.has(i.noSolicitud));
      setItems([...dbItems, ...bridgeItems]);
    }
  }, [solicitudesDB, backendStatus, mapSolToOrig]);

  const goToDashboard = () => { setView({ type: 'dashboard' }); };
  const goToList = () => { setView({ type: 'list' }); };

  // Antes de abrir el form, sembrar datos reales desde DB si no están en el store de Originación
  const seedAndOpen = useCallback((i: OriginacionListItem, mode: 'editar' | 'ver') => {
    const solItem = (solicitudesDB as Record<string, any>[]).find(s => s.id === i.id || s.noSol === i.noSolicitud);
    if (solItem) {
      seedOriginacionFromSolicitudItem(i.id, solItem);
    }
    if (mode === 'editar') clearSession(i.id);
    setView({ type: 'form', mode, id: i.id });
  }, [solicitudesDB]);

  const handleEditar = (i: OriginacionListItem) => { seedAndOpen(i, 'editar'); };
  const handleVer = (i: OriginacionListItem) => { seedAndOpen(i, 'ver'); };

  const handleSave = (data: OriginacionFormData, id: number | string) => {
    const ms = parseFloat(parseCurrency(data.montoSolicitado || '0')) || 0;
    const ma = parseFloat(parseCurrency(data.montoAutorizado || '0')) || 0;
    const fmtDt = (d: string) => { if (!d) return ''; const p = d.split('/'); if (p.length !== 3) return d; return p[2].length <= 2 ? d : `${p[0]}/${p[1]}/${p[2].slice(-2)}`; };

    saveToSavedStore(id, 'form', { ...data });
    setItems(prev => prev.map(i => i.id === id ? {
      ...i, cliente: data.cliente || i.cliente, fechaSolicitud: fmtDt(data.fechaSolicitud) || i.fechaSolicitud,
      montoSolicitado: ms || i.montoSolicitado, montoAutorizado: ma || i.montoAutorizado,
      sublinea: data.sublinea || i.sublinea, producto: data.producto || i.producto,
      sucursal: data.sucursal || i.sucursal, estatus: data.estatus || i.estatus,
      subEstatus: data.subEstatus || i.subEstatus, responsable: data.responsable || i.responsable,
    } : i));
    goToList();
  };

  // Callback FASE 7: actualiza DB cuando se activa la cuenta
  const handleActivarCuentaDB = useCallback(async (origId: number | string, estatusSolicitud: string, estatusCuenta: string, estatusPago: string, estatusCartera: string) => {
    const solItem = (solicitudesDB as Record<string, any>[]).find(s => s.id === origId || s.noSol === String(origId));
    if (!solItem) return;
    const dbId: string | undefined = solItem._dbId || (typeof solItem.id === 'string' ? solItem.id : undefined);
    if (!dbId) return;
    try {
      // Construir SolicitudFormData mínimo con los estatus actualizados
      const d = solItem._data || {};
      const hdr = d.solicitud?.header || {};
      const formForSave = {
        id: dbId, noSol: solItem.noSol || '', cotizacionId: '',
        lineaProducto: solItem._lineaProducto || hdr.linea_producto || 'Crédito',
        tipoProducto: solItem.tipoProducto || hdr.tipo_producto || '',
        tipoPersona: hdr.tipo_persona || '',
        nombrePersona: hdr.nombre_persona || '',
        apellidoPaternoPersona: hdr.apellido_paterno_persona || '',
        apellidoMaternoPersona: hdr.apellido_materno_persona || '',
        productoId: hdr.producto_id || '',
        nombreProducto: solItem.nombreProducto || '',
        fechaSolicitud: solItem.fechaSolicitud || '',
        descripcion: hdr.descripcion || '',
        faseId: hdr.fase_id || '7',
        descripcionFase: 'Activación de Cuenta Financiera',
        estatusSolicitud,
        sucursal: solItem.sucursal || '',
        montoSolicitado: String(solItem.montoSolicitado || ''),
        montoAutorizado: String(solItem.montoAutorizado || ''),
      } as import('../solicitudes/solicitudCreditoStore').SolicitudFormData;
      await saveSolicitud(formForSave, dbId);
    } catch (err) {
      console.warn('[Originación] FASE 7 DB update falló:', err);
    }
  }, [solicitudesDB, saveSolicitud]);

  // ── FORM VIEW ──
  if (view.type === 'form') {
    return <OriginacionForm
      mode={view.mode}
      originacionId={view.id}
      onCancel={goToList}
      onSave={(d) => handleSave(d, view.id)}
      onActivarCuentaDB={(statuses) => handleActivarCuentaDB(view.id, statuses.estatusSolicitud, statuses.estatusCuenta, statuses.estatusPago, statuses.estatusCartera)}
    />;
  }

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD VIEW
  // ═══════════════════════════════════════════════════════════════
  if (view.type === 'dashboard') {
    return (
      <>
        {/* Sub-navigation */}
        <div className="bg-gray-100 border-b border-gray-300">
          <div className="px-6 py-3 flex items-center gap-4">
            <button onClick={goToDashboard} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-active">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/><path d="M6 14v-5h4v5"/></svg>
              <span>Inicio</span>
            </button>
            <button onClick={goToList} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-inactive">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3h10M3 8h10M3 13h10"/></svg>
              <span>Lista de Originación</span>
            </button>
          </div>
        </div>
        <OriginacionDashboard items={items} onGoToList={goToList} />
      </>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // LIST VIEW
  // ═══════════════════════════════════════════════════════════════
  return (
    <>
      {/* Sub-navigation */}
      <div className="bg-gray-100 border-b border-gray-300">
        <div className="px-6 py-3 flex items-center gap-4">
          <button onClick={goToDashboard} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-inactive">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/><path d="M6 14v-5h4v5"/></svg>
            <span>Inicio</span>
          </button>
          <button onClick={goToList} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-active">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3h10M3 8h10M3 13h10"/></svg>
            <span>Lista de Originación</span>
          </button>
        </div>
      </div>
      <OriginacionList items={items} onEditar={handleEditar} onVer={handleVer} />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════
function OriginacionDashboard({ items, onGoToList }: {
  items: OriginacionListItem[]; onGoToList: () => void;
}) {
  const total = items.length;
  const montoTotal = items.reduce((s, i) => s + i.montoSolicitado, 0);
  const aprobadas = items.filter(i => i.estatus === 'Aprobado').length;
  const tasaAprobacion = total > 0 ? (aprobadas / total * 100) : 0;
  const tiempoPromedio = 4.2;

  const recientes = [...items].sort((a, b) => parseDate(b.fechaSolicitud).getTime() - parseDate(a.fechaSolicitud).getTime()).slice(0, 8);

  // Solo estatus activos en Originación (sin Pendiente — regla de negocio)
  const distribucionEstatus = [
    { estatus: 'En Proceso', cantidad: items.filter(i => i.estatus === 'En Proceso').length, color: '#3B82F6' },
    { estatus: 'Aprobado', cantidad: items.filter(i => i.estatus === 'Aprobado').length, color: '#10B981' },
    { estatus: 'Rechazado', cantidad: items.filter(i => i.estatus === 'Rechazado').length, color: '#EF4444' },
    { estatus: 'Cancelado', cantidad: items.filter(i => i.estatus === 'Cancelado').length, color: '#6B7280' },
  ];

  const distribucionSubEstatus = [
    { fase: 'Integración', cantidad: items.filter(i => i.subEstatus === 'Integración del Expediente').length, color: '#3B82F6' },
    { fase: 'Análisis', cantidad: items.filter(i => i.subEstatus === 'Análisis de Crédito').length, color: '#F59E0B' },
    { fase: 'Jurídico', cantidad: items.filter(i => i.subEstatus === 'Jurídico').length, color: '#7C3AED' },
    { fase: 'Liberación', cantidad: items.filter(i => i.subEstatus === 'Liberación').length, color: '#10B981' },
  ];

  const evolucion = [
    { mes: 'Ago', solicitudes: 12 }, { mes: 'Sep', solicitudes: 18 },
    { mes: 'Oct', solicitudes: 15 }, { mes: 'Nov', solicitudes: 22 },
    { mes: 'Dic', solicitudes: 19 }, { mes: 'Ene', solicitudes: total },
  ];
  const crecimiento = evolucion[4].solicitudes > 0 ? ((evolucion[5].solicitudes - evolucion[4].solicitudes) / evolucion[4].solicitudes * 100).toFixed(1) : '0';

  const subEstatusBadge = (se: string) => {
    const m: Record<string, string> = {
      'Integración del Expediente': 'bg-blue-100 text-blue-700',
      'Análisis de Crédito': 'bg-yellow-100 text-yellow-700',
      'Jurídico': 'bg-purple-100 text-purple-700',
      'Liberación': 'bg-green-100 text-green-700',
    };
    return m[se] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="p-6 space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Total de Originaciones</p>
              <p className="text-2xl text-gray-900">{total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E5C91" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span className="text-green-600">+{crecimiento}%</span>
            <span className="text-gray-600">vs. mes anterior</span>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Monto Total Solicitado</p>
              <p className="text-2xl text-gray-900">{fmtCur(montoTotal)}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">Promedio: {fmtCur(total > 0 ? montoTotal / total : 0)}</div>
        </div>

        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Tasa de Aprobación</p>
              <p className="text-2xl text-gray-900">{tasaAprobacion.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">{aprobadas} de {total} aprobadas</div>
        </div>

        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Tiempo Promedio</p>
              <p className="text-2xl text-gray-900">{tiempoPromedio} días</p>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">Meta: 4.0 días</div>
        </div>
      </div>

      {/* Registros Recientes + Distribución por Sub-Estatus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base text-gray-900">Registros Recientes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimas originaciones (provenientes de Solicitud de Crédito)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-700">N° Solicitud</th>
                  <th className="text-left px-3 py-2 text-gray-700">Cliente</th>
                  <th className="text-left px-3 py-2 text-gray-700">Monto</th>
                  <th className="text-left px-3 py-2 text-gray-700">Sub-Estatus</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-900">{item.noSolicitud}</td>
                    <td className="px-3 py-2 text-gray-700">{item.cliente.substring(0, 25)}{item.cliente.length > 25 ? '...' : ''}</td>
                    <td className="px-3 py-2 text-gray-900">{fmtCur(item.montoSolicitado)}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs ${subEstatusBadge(item.subEstatus)}`}>{item.subEstatus.substring(0, 15)}{item.subEstatus.length > 15 ? '...' : ''}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-300 flex justify-end">
            <button onClick={onGoToList} className="text-xs text-[#0066CC] hover:underline">Ver todas las originaciones →</button>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base text-gray-900">Fases de Originación</h2>
            <p className="text-xs text-gray-600 mt-0.5">Distribución por sub-estatus (4 fases)</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            <div className="w-full">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart id="orig-pie-subestatus">
                  <Pie data={distribucionSubEstatus} cx="50%" cy="50%" labelLine={false} label={({ fase, cantidad }) => `${fase}: ${cantidad}`} outerRadius={80} fill="#8884d8" dataKey="cantidad" nameKey="fase">
                    {distribucionSubEstatus.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {distribucionSubEstatus.map(item => (
                  <div key={item.fase} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-700">{item.fase}: {item.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base text-gray-900">Evolución de Originaciones</h2>
            <p className="text-xs text-gray-600 mt-0.5">Tendencia en los últimos 6 meses</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart id="orig-line-evolucion" data={evolucion}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip />
                <Line type="monotone" dataKey="solicitudes" stroke="#2E5C91" strokeWidth={2} dot={{ fill: '#2E5C91', r: 4 }} activeDot={{ r: 6 }} name="Solicitudes" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base text-gray-900">Distribución por Estatus</h2>
            <p className="text-xs text-gray-600 mt-0.5">Estado general de originaciones</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart id="orig-bar-estatus" data={distribucionEstatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="estatus" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip />
                <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} name="Cantidad">
                  {distribucionEstatus.map((entry, index) => <Cell key={`bar-${index}`} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LIST COMPONENT — Diseño institucional idéntico al patrón (sin Nuevo)
// ═══════════════════════════════════════════════════════════════════
function OriginacionList({ items, onEditar, onVer }: {
  items: OriginacionListItem[];
  onEditar: (i: OriginacionListItem) => void;
  onVer: (i: OriginacionListItem) => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [fEstatus, setFEstatus] = useState('');
  const [fSubEstatus, setFSubEstatus] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const handleExportExcel = () => { toast.success('Exportando a Excel', { description: 'El archivo se está descargando...', duration: 3000 }); };
  const handleExportCSV = () => { toast.success('Exportando a CSV', { description: 'El archivo CSV se está descargando...', duration: 3000 }); };
  const handleExportPDF = () => { toast.success('Exportando a PDF', { description: 'El archivo PDF se está descargando...', duration: 3000 }); };
  const handlePrint = () => { toast.success('Imprimiendo', { description: 'Enviando documento a la impresora...', duration: 3000 }); };

  const filtered = items.filter(i => {
    if (fEstatus && i.estatus !== fEstatus) return false;
    if (fSubEstatus && i.subEstatus !== fSubEstatus) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return i.noSolicitud.toLowerCase().includes(s) || i.noOriginacion.toLowerCase().includes(s) || i.cliente.toLowerCase().includes(s) || i.noCliente.toLowerCase().includes(s) || i.sucursal.toLowerCase().includes(s) || i.responsable.toLowerCase().includes(s);
    }
    return true;
  }).sort((a, b) => {
    const da = parseDate(a.fechaSolicitud).getTime();
    const db = parseDate(b.fechaSolicitud).getTime();
    return sortOrder === 'desc' ? db - da : da - db;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><path d="M6 2h8l4 4v11a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M14 2v4h4"/><path d="M6 10h8M6 13h5"/></svg>
            <h2 className="text-lg text-gray-800">Originación</h2>
            <button className="p-1 ml-2"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2"><circle cx="8" cy="8" r="6"/><path d="M13 13l3 3"/></svg></button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span className="cursor-pointer hover:text-secondary-theme transition-colors" onClick={() => { if (tableRef.current) { tableRef.current.classList.add('animate-highlight'); setTimeout(() => tableRef.current?.classList.remove('animate-highlight'), 1000); } }}>Lista</span>
            <span className="cursor-pointer hover:text-secondary-theme transition-colors" onClick={() => { if (searchRef.current) { searchRef.current.focus(); } }}>Buscar</span>
          </div>
        </div>
      </div>

      {/* View selector — sin botón Nuevo */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[250px]">
              <option>Vista general de Originación</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z"/></svg>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Filtros</span>
          <div className="flex items-center gap-2">
            <select value={fSubEstatus} onChange={e => { setFSubEstatus(e.target.value); setCurrentPage(1); }} className="px-2 py-1 text-xs border border-gray-300 rounded">
              <option value="">Sub-Estatus: Todos</option>
              <option value="Integración del Expediente">Integración de Expediente</option>
              <option value="Análisis de Crédito">Análisis de Crédito</option>
              <option value="Jurídico">Jurídico</option>
              <option value="Liberación">Liberación</option>
            </select>
            <select value={fEstatus} onChange={e => { setFEstatus(e.target.value); setCurrentPage(1); }} className="px-2 py-1 text-xs border border-gray-300 rounded">
              <option value="">Estatus: Todos</option>
              {CAT_ESTATUS.filter(c => c.value !== 'Pendiente').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input ref={searchRef} type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} placeholder="Buscar originaciones..." className="px-3 py-1 border border-gray-400 rounded text-sm w-64 transition-all" />
          </div>
        </div>
      </div>

      {/* Action Icons Bar */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-200 rounded transition-colors hover:scale-110 transform" title="Exportar a CSV" onClick={handleExportCSV}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280"/><text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text></svg>
            </button>
            <button className="p-1.5 hover:bg-green-100 rounded transition-colors hover:scale-110 transform" title="Exportar a Excel" onClick={handleExportExcel}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B"/><path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2"/></svg>
            </button>
            <button className="p-1.5 hover:bg-red-100 rounded transition-colors hover:scale-110 transform" title="Exportar a PDF" onClick={handleExportPDF}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F"/><path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none"/><path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2"/></svg>
            </button>
            <button className="p-1.5 hover:bg-blue-100 rounded transition-colors hover:scale-110 transform" title="Imprimir" onClick={handlePrint}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="3" width="10" height="3" rx="0.5" fill="#1976D2"/><rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none"/><rect x="5" y="11" width="10" height="6" rx="0.5" fill="#1976D2"/><circle cx="5" cy="8" r="0.8" fill="#1976D2"/></svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>Orden Rápido</span>
              <div className="relative">
                <select value={sortOrder} onChange={e => { setSortOrder(e.target.value as 'desc' | 'asc'); setCurrentPage(1); }} className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none">
                  <option value="desc">Descendente</option>
                  <option value="asc">Ascendente</option>
                </select>
                <svg className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#666"><path d="M5 7l-3-3h6z"/></svg>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-0.5 text-secondary-theme disabled:opacity-40" title="Anterior" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3L5 8l5 5V3z"/></svg>
              </button>
              <button className="p-0.5 text-secondary-theme disabled:opacity-40" title="Siguiente" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>
              </button>
            </div>
            <span>Total: {filtered.length}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-hidden" style={{ backgroundColor: 'transparent' }}>
          <table className="w-full text-sm" style={{ backgroundColor: 'transparent' }}>
            <thead>
              <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">Editar | Ver</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">N° SOLICITUD</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">CLIENTE</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">ESTATUS</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">SUB-ESTATUS</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">FECHA</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">MONTO</th>
                <th className="px-3 py-2.5 text-left text-xs text-gray-700">RESPONSABLE</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">No se encontraron registros de originación</td></tr>
              ) : paginated.map((i, idx) => (
                <tr key={i.id} className="border-b border-gray-200 transition-colors duration-150"
                  style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}>
                  <td className="px-3 py-2.5 text-xs">
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); onEditar(i); }}>Editar</a>
                    <span className="text-gray-700"> | </span>
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); onVer(i); }}>Ver</a>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{i.noSolicitud}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{i.cliente}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{i.estatus}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{i.subEstatus}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{i.fechaSolicitud}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{fmtCur(i.montoSolicitado)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{i.responsable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" title="Primera página" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M13 4L4 9l9 5V4z"/></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" title="Página anterior" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 4L4 9l5 5V4z"/></svg>
          </button>
          <div className="text-sm text-gray-700 min-w-[100px] text-center">Página {currentPage} de {totalPages || 1}</div>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" title="Página siguiente" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 4l5 5-5 5V4z"/></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40 disabled:cursor-not-allowed" title="Última página" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M4 4L13 9l-9 5V4z"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FORM COMPONENT — Solo editar | ver (sin nuevo)
// ═══════════════════════════════════════════════════════════════════
function OriginacionForm({ mode, originacionId, onCancel, onSave, onActivarCuentaDB }: {
  mode: 'editar' | 'ver'; originacionId: number | string;
  onCancel: () => void; onSave: (d: OriginacionFormData) => void;
  onActivarCuentaDB?: (statuses: { estatusSolicitud: string; estatusCuenta: string; estatusPago: string; estatusCartera: string }) => void;
}) {
  const isRO = mode === 'ver';

  const [expedientes, setExpedientes] = useState<{ id: number; fechaHora: string; usuario: string; tipoDocumento: string; archivo: string; descripcion: string; estatus: string; observaciones: string }[]>(() =>
    loadFromSession(originacionId, 'expedientes') || loadFromSavedStore(originacionId, 'expedientes') || []);
  const [notas, setNotas] = useState<{ id: number; fechaCreacion: Date; usuario: string; contenido: string }[]>(() => {
    const raw: any[] = loadFromSession(originacionId, 'notas') || loadFromSavedStore(originacionId, 'notas') || [];
    // Deserializar fechaCreacion: JSON.parse devuelve strings, no Date
    return raw.map(n => ({ ...n, fechaCreacion: n.fechaCreacion instanceof Date ? n.fechaCreacion : new Date(n.fechaCreacion) }));
  });
  const [garantias, setGarantias] = useState<OriginacionGarantia[]>(() =>
    loadFromSession(originacionId, 'garantias') || loadFromSavedStore(originacionId, 'garantias') || []);
  const [autorizaciones, setAutorizaciones] = useState<OriginacionAutorizacion[]>(() =>
    loadFromSession(originacionId, 'autorizaciones') || loadFromSavedStore(originacionId, 'autorizaciones') || []);
  const [comites, setComites] = useState<{ autoridad: string; estatus: string }[]>(() =>
    loadFromSession(originacionId, 'comites') || loadFromSavedStore(originacionId, 'comites') || []);
  const [beneficiarios, setBeneficiarios] = useState<{ id: number; nombre: string; firma: boolean }[]>(() =>
    loadFromSession(originacionId, 'beneficiarios') || loadFromSavedStore(originacionId, 'beneficiarios') || []);
  const [solicitudActivacion, setSolicitudActivacion] = useState<{ estatusPago: string; monto: number } | undefined>(() =>
    loadFromSession(originacionId, 'solicitudActivacion') || loadFromSavedStore(originacionId, 'solicitudActivacion') || undefined);
  // Cargos: leídos para pasar al contexto de FASE 6 (CxP/CxC)
  const [cargosCtx, setCargosCtx] = useState<OriginacionCargo[]>(() =>
    loadFromSession(originacionId, 'cargos') || loadFromSavedStore(originacionId, 'cargos') || []);

  useEffect(() => {
    if (!isRO) {
      saveToSession(originacionId, 'expedientes', expedientes);
      saveToSession(originacionId, 'notas', notas);
      saveToSession(originacionId, 'garantias', garantias);
      saveToSession(originacionId, 'autorizaciones', autorizaciones);
      saveToSession(originacionId, 'comites', comites);
      saveToSession(originacionId, 'beneficiarios', beneficiarios);
      saveToSession(originacionId, 'solicitudActivacion', solicitudActivacion);
    }
  }, [expedientes, notas, garantias, autorizaciones, comites, beneficiarios, solicitudActivacion, originacionId, isRO]);

  // Sincronizar cargosCtx cuando CargosSection los actualiza en session
  useEffect(() => {
    const fresh = loadFromSession<OriginacionCargo[]>(originacionId, 'cargos');
    if (fresh) setCargosCtx(fresh);
  }, [originacionId]);

  const handleActualizarFase = useCallback((nuevaFaseOrFaseId: FaseOriginacion | string, descripcion?: string, area?: string, _promptIA?: string) => {
    // Sobrecarga 1: FasesOriginacionTab llama con (faseId, descripcion, area, promptIA)
    if (descripcion !== undefined) {
      const areaFinal = area || '';
      setFd(p => ({ ...p, subEstatus: descripcion, area: areaFinal }));
      toast.success('Fase actualizada', { description: `${descripcion}${areaFinal ? ` — Área: ${areaFinal}` : ''}` });
      return;
    }
    
    // Sobrecarga 2: FaseActionBar llama con (FaseOriginacion)
    const nuevaFase = nuevaFaseOrFaseId as FaseOriginacion;
    // Buscar el área directamente en la tabla de fases de originación
    const faseDef = ORIGINACION_FASES.find(f => f.label === nuevaFase);
    const areaResult = faseDef?.area || '';
    setFd(p => ({ ...p, subEstatus: nuevaFase, area: areaResult || p.area }));
    toast.success('Fase actualizada', { description: `${nuevaFase}${areaResult ? ` — Área: ${areaResult}` : ''}` });
  }, []);

  // Acumula los 4 campos de FASE 7 para disparar DB update cuando todos lleguen
  const fase7StatusRef = useRef<{ sol?: string; cuenta?: string; pago?: string; cartera?: string }>({});

  const triggerFase7DB = useCallback((updates: { sol?: string; cuenta?: string; pago?: string; cartera?: string }) => {
    fase7StatusRef.current = { ...fase7StatusRef.current, ...updates };
    const { sol, cuenta, pago, cartera } = fase7StatusRef.current;
    if (sol && cuenta && pago && cartera && onActivarCuentaDB) {
      onActivarCuentaDB({ estatusSolicitud: sol, estatusCuenta: cuenta, estatusPago: pago, estatusCartera: cartera });
    }
  }, [onActivarCuentaDB]);

  const handleActualizarEstatus = useCallback((estatus: string) => {
    setFd(p => ({ ...p, estatus }));
    // Participa en el trigger de FASE 7 cuando estatus = 'Autorizada'
    if (estatus === 'Autorizada') triggerFase7DB({ sol: estatus });
  }, [triggerFase7DB]);

  const handleActualizarEstatusCuenta = useCallback((estatus: string) => {
    setFd(p => ({ ...p, estatusSC: estatus }));
    triggerFase7DB({ cuenta: estatus });
  }, [triggerFase7DB]);

  const handleActualizarEstatusPago = useCallback((estatus: string) => {
    setFd(p => ({ ...p, estatusPago: estatus }));
    triggerFase7DB({ pago: estatus });
  }, [triggerFase7DB]);

  const handleActualizarEstatusCartera = useCallback((estatus: string) => {
    setFd(p => ({ ...p, estatusCartera: estatus }));
    triggerFase7DB({ cartera: estatus });
  }, [triggerFase7DB]);

  const handleGenerarContrato = useCallback(() => {
    toast.success('Contrato y pagaré generados', { description: 'Documentos listos para formalización' });
  }, []);

  const handleCrearCuenta = useCallback((tipo: 'CuentaporPagar' | 'CuentaporCobrar') => {
    toast.success(`${tipo} creada`, { description: 'Cuenta registrada exitosamente' });
  }, []);

  const sid = originacionId;

  const getInit = useCallback((): OriginacionFormData => {
    const s = loadFromSession<OriginacionFormData>(sid, 'form');
    if (s) return s;
    const saved = loadFromSavedStore<OriginacionFormData>(sid, 'form');
    if (saved) return saved;
    return { ...EMPTY_FORM };
  }, [sid]);

  const [fd, setFd] = useState<OriginacionFormData>(getInit);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeSec, setActiveSec] = useState('default');
  const [showDebug, setShowDebug] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);

  // Producto seleccionado para obtener fases
  const { productos: productosDB } = useProductosCatalogoDB(true);
  
  const productoSeleccionado = useMemo(() => {
    if (!fd.producto) return undefined;
    return productosDB.find(p => p.id === fd.producto || p.nombreProducto === fd.producto);
  }, [fd.producto, productosDB]);
  
  // Fases del producto seleccionado
  const fasesDelProducto = useMemo(() => {
    if (!productoSeleccionado) return [];
    const rd = productoSeleccionado.rawData;
    const raw = rd?.fases ?? rd?.fasesRegistros ?? rd?.fase;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((f: any) => ({
        faseId: String(f.seq ?? f.id ?? '1'),
        fase: f.fase || '',
        area: f.area || '',
        notes: f.notes || '',
        promptIA: f.promptIA || '',
      }));
    }
    return [];
  }, [productoSeleccionado]);
  
  // Fase actual basada en subEstatus
  const currentFase = useMemo(() => {
    const faseIndex = parseInt(getFaseIdFromSubEstatus(fd.subEstatus)) - 1;
    return fasesDelProducto[faseIndex] || null;
  }, [fasesDelProducto, fd.subEstatus]);

  // Sync fase data when productoSeleccionado becomes available
  useEffect(() => {
    if (!productoSeleccionado || fasesDelProducto.length === 0) return;
    
    const faseIndex = parseInt(getFaseIdFromSubEstatus(fd.subEstatus)) - 1;
    const fase = fasesDelProducto[faseIndex] || fasesDelProducto[0];
    
    if (fase && fase.fase) {
      console.log('[OrigForm] Syncing fase from product:', fase);
      setFd(prev => ({
        ...prev,
        area: fase.area || prev.area,
        notasFase: fase.notes || fase.fase || prev.notasFase,
      }));
    }
  }, [productoSeleccionado, fasesDelProducto.length]);

  useEffect(() => { if (!isRO) saveToSession(sid, 'form', fd); }, [fd, sid, isRO]);

  const set = (f: keyof OriginacionFormData, v: string) => {
    if (isRO) return;
    setFd(p => ({ ...p, [f]: v }));
    if (errors[f]) setErrors(p => { const n = { ...p }; delete n[f]; return n; });
  };
  const numSet = (f: keyof OriginacionFormData, v: string) => set(f, v.replace(/[^0-9.,-]/g, ''));
  const curBlur = (f: keyof OriginacionFormData) => { const n = parseFloat(parseCurrency(fd[f])); if (!isNaN(n) && n >= 0) set(f, n.toFixed(2)); };
  const pctBlur = (f: keyof OriginacionFormData) => { const n = parseFloat((fd[f] || '').replace(/[^0-9.-]/g, '')); if (!isNaN(n)) set(f, Math.min(100, Math.max(0, n)).toFixed(4)); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fd.cliente) e.cliente = 'Obligatorio';
    if (!fd.fechaSolicitud) e.fechaSolicitud = 'Obligatorio';
    if (!fd.sucursal) e.sucursal = 'Obligatorio';
    if (!fd.montoSolicitado || parseFloat(parseCurrency(fd.montoSolicitado)) <= 0) e.montoSolicitado = 'Monto > 0';
    if (!fd.sublinea) e.sublinea = 'Obligatorio';
    if (!fd.producto) e.producto = 'Obligatorio';
    if (!fd.periodo) e.periodo = 'Obligatorio';
    if (!fd.plazos) e.plazos = 'Obligatorio';
    setErrors(e);
    if (Object.keys(e).length > 0) { toast.error('Campos obligatorios incompletos', { description: `${Object.keys(e).length} campo(s)`, duration: 4000 }); return false; }
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    const d = { ...fd };
    saveToSavedStore(sid, 'form', d);
    commitAndClearSession(sid);
    saveToSavedStore(sid, 'form', d);
    toast.success('Originación actualizada', { description: `N° ${d.noOriginacion} — Solicitud ${d.noSolicitud}`, duration: 3000 });
    onSave(d);
  };

  const handleCancel = () => { clearSession(sid); onCancel(); };

  const ic = (err = false, dis = false) => `w-full px-2 py-1 text-xs border rounded focus:outline-none ${err ? 'border-red-400' : 'border-gray-300'} ${dis || isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-[#4A6FA5]'}`;
  const sc = (err = false) => `w-full px-2 py-1 text-xs border rounded focus:outline-none ${err ? 'border-red-400' : 'border-gray-300'} ${isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-[#4A6FA5]'}`;
  const Lbl = ({ children, req, error }: { children: string; req?: boolean; error?: string }) => (
    <label className={`block text-xs mb-1 ${error ? 'text-red-600' : 'text-gray-700'}`}>{children}{req && <span className="text-red-600 ml-0.5">*</span>}</label>
  );

  const sections = [
    { id: 'default', label: 'Default' },
    { id: 'fases', label: 'Fases' },
    { id: 'partesRelacionadas', label: 'Partes Relacionadas' },
    { id: 'terminos', label: 'Términos y Condiciones' },
    { id: 'simulacion', label: 'Simulación' },
    { id: 'expedientes', label: 'Expediente Electrónico' },
    { id: 'garantias', label: 'Garantías' },
    { id: 'comisiones', label: 'Comisiones' },
    { id: 'autorizacion', label: 'Autorizaciones' },
    { id: 'notas', label: 'Notas' },
  ];

  return (
    <div className="flex-1 flex flex-col bg-white overflow-auto">
      <div className="bg-white px-6 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#4A6FA5" strokeWidth="1.5"><path d="M5 1h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z"/><path d="M12 1v3h3"/><path d="M5 9h7M5 12h4"/></svg>
            <span className="text-sm text-gray-700">
              {mode === 'editar' ? `Edición Originación — N° ${fd.noOriginacion}` : `Detalle Originación — N° ${fd.noOriginacion}`}
              {fd.noSolicitud && <span className="text-gray-500 ml-2">(Solicitud: {fd.noSolicitud})</span>}
            </span>
          </div>
          <button onClick={handleCancel} className="text-secondary-theme text-sm hover:underline">Lista</button>
        </div>
      </div>
      <div className="bg-white px-6 py-3 border-b border-gray-200 flex items-center gap-2">
        {!isRO && (<>
          <button onClick={handleSave} className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB]">Guardar</button>
          <button onClick={handleCancel} className="px-5 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50">Cancelar</button>
        </>)}
        {isRO && <button onClick={handleCancel} className="px-5 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50">Cerrar</button>}
      </div>

      {/* ── Flujo de Trabajo — 7 fases ── */}
      <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
        <FlujoTrabajo subEstatus={fd.subEstatus} faseActual={fd.subEstatus} />
      </div>

      <FaseActionBar
        fase={fd.subEstatus as FaseOriginacion}
        estatus={fd.estatus}
        documentos={expedientes.filter(e => e.estatus === 'Aprobado' || e.estatus === 'Validado').map(e => e.tipoDocumento)}
        expedientesData={expedientes}
        notas={notas}
        garantias={garantias}
        comites={comites}
        beneficiarios={beneficiarios}
        solicitudActivacion={solicitudActivacion}
        cargos={cargosCtx}
        formData={fd}
        onActualizarFase={handleActualizarFase}
        onActualizarEstatus={handleActualizarEstatus}
        onActualizarEstatusCuenta={handleActualizarEstatusCuenta}
        onActualizarEstatusPago={handleActualizarEstatusPago}
        onActualizarEstatusCartera={handleActualizarEstatusCartera}
        onResult={setLastResult}
        isRO={isRO}
      />

      {/* PANEL DE DEBUG */}
      <div className="px-6">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-white rounded text-xs hover:bg-gray-700 mb-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
          </svg>
          Panel de Debug - Reglas Originación
        </button>

        {showDebug && (
          <div className="bg-gray-900 text-green-400 rounded p-4 font-mono text-xs overflow-auto max-h-96">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-white font-bold">DEBUG - Estado Actual</h3>
              <button
                onClick={() => setLastResult(null)}
                className="px-2 py-1 bg-red-600 text-white rounded text-[10px]"
              >
                Limpiar Resultado
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h4 className="text-yellow-400 mb-2">Estado del Formulario</h4>
                <ul className="space-y-1">
                  <li>Fase: <span className="text-cyan-300">{fd.subEstatus}</span></li>
                  <li>Estatus: <span className="text-cyan-300">{fd.estatus}</span></li>
                  <li>Línea Producto: <span className="text-cyan-300">{fd.lineaProducto}</span></li>
                  <li>Producto: <span className="text-cyan-300">{fd.producto}</span></li>
                  <li>Monto Autorizado: <span className="text-cyan-300">${parseFloat(fd.montoAutorizado || '0').toLocaleString()}</span></li>
                </ul>
              </div>

              <div>
                <h4 className="text-yellow-400 mb-2">Validaciones Actuales</h4>
                <ul className="space-y-1">
                  <li className={expedientes.length > 0 ? 'text-green-400' : 'text-red-400'}>
                    Documentos: {expedientes.length} cargados
                  </li>
                  <li className={notas.length > 0 ? 'text-green-400' : 'text-red-400'}>
                    Notas: {notas.length} creadas
                  </li>
                  <li className={garantias.length > 0 ? 'text-green-400' : 'text-red-400'}>
                    Garantías: {garantias.length} registradas
                  </li>
                  <li className={comites.length > 0 ? 'text-green-400' : 'text-red-400'}>
                    Comités: {comites.length} registrados
                  </li>
                  <li className={beneficiarios.length > 0 ? 'text-green-400' : 'text-red-400'}>
                    Beneficiarios: {beneficiarios.length} registrados
                  </li>
                  <li className={solicitudActivacion?.estatusPago === 'Pagado' ? 'text-green-400' : 'text-red-400'}>
                    Pago Activación: {solicitudActivacion?.estatusPago || 'No definido'}
                  </li>
                </ul>
              </div>
            </div>

            <h4 className="text-yellow-400 mb-2">Herramientas de Prueba</h4>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => {
                  const newDoc = { id: Date.now(), fechaHora: new Date().toLocaleString(), usuario: 'Test', tipoDocumento: 'Credencial de elector', archivo: 'test.pdf', descripcion: 'Doc prueba', estatus: 'Validado', observaciones: '' };
                  setExpedientes([...expedientes, newDoc]);
                  toast.success('Documento añadido');
                }}
                className="px-2 py-1 bg-blue-600 text-white rounded text-[10px]"
              >
                + Documento
              </button>
              <button
                onClick={() => {
                  const newNota = { id: Date.now(), fechaCreacion: new Date(), usuario: 'Test', contenido: 'Nota de prueba' };
                  setNotas([...notas, newNota]);
                  toast.success('Nota reciente creada');
                }}
                className="px-2 py-1 bg-blue-600 text-white rounded text-[10px]"
              >
                + Nota Reciente
              </button>
              <button
                onClick={() => {
                  setGarantias([...garantias, { id: Date.now(), tipo: 'Hipotecaria', subtipo: 'Inmueble', descripcion: 'Casa habitación', valorNominal: parseFloat(fd.montoAutorizado || '0'), ubicacion: 'CDMX', estatus: 'Aprobado' }]);
                  toast.success('Garantía aprobada añadida');
                }}
                className="px-2 py-1 bg-blue-600 text-white rounded text-[10px]"
              >
                + Garantía Aprobada
              </button>
              <button
                onClick={() => {
                  setComites([...comites, { autoridad: 'Comité de Crédito', estatus: 'Autorizado' }]);
                  toast.success('Comité autorizado añadido');
                }}
                className="px-2 py-1 bg-blue-600 text-white rounded text-[10px]"
              >
                + Comité Autorizado
              </button>
              <button
                onClick={() => {
                  setBeneficiarios([...beneficiarios, { id: Date.now(), nombre: 'Beneficiario Test', firma: true }]);
                  toast.success('Beneficiario con firma añadido');
                }}
                className="px-2 py-1 bg-blue-600 text-white rounded text-[10px]"
              >
                + Beneficiario
              </button>
              <button
                onClick={() => {
                  setSolicitudActivacion({ estatusPago: 'Pagado', monto: parseFloat(fd.montoAutorizado || '0') });
                  toast.success('Solicitud activada - Pagado');
                }}
                className="px-2 py-1 bg-green-600 text-white rounded text-[10px]"
              >
                PAGO = Pagado
              </button>
              <button
                onClick={() => {
                  setExpedientes([]);
                  setNotas([]);
                  setGarantias([]);
                  setComites([]);
                  setBeneficiarios([]);
                  setSolicitudActivacion(undefined);
                  toast.info('Todo reseteado');
                }}
                className="px-2 py-1 bg-red-600 text-white rounded text-[10px]"
              >
                Reset Todo
              </button>
              <button
                onClick={() => {
                  setFd(p => ({ ...p, estatus: 'En Proceso', subEstatus: 'Integración del Expediente' }));
                  toast.info('Fase 1 - En Proceso');
                }}
                className="px-2 py-1 bg-purple-600 text-white rounded text-[10px]"
              >
                Fase 1
              </button>
              <button
                onClick={() => {
                  setFd(p => ({ ...p, subEstatus: 'Análisis de Expediente Operativo' }));
                  toast.info('Fase 2');
                }}
                className="px-2 py-1 bg-purple-600 text-white rounded text-[10px]"
              >
                Fase 2
              </button>
              <button
                onClick={() => {
                  setFd(p => ({ ...p, subEstatus: 'Activación de Cuenta Financiera' }));
                  toast.info('Fase 7');
                }}
                className="px-2 py-1 bg-purple-600 text-white rounded text-[10px]"
              >
                Fase 7
              </button>
            </div>

            {lastResult && (
              <>
                <h4 className="text-yellow-400 mb-2">Último Resultado de Validación</h4>
                <pre className="bg-gray-800 p-2 rounded overflow-auto max-h-48">
                  {JSON.stringify(lastResult, null, 2)}
                </pre>
              </>
            )}
          </div>
        )}
      </div>

      <div className="px-6 py-6">
        <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-4 py-2 mb-5"><h3 className="text-sm text-gray-800 uppercase">Información de Originación</h3></div>
        <div className="grid grid-cols-3 gap-x-6 gap-y-3 mb-8">
          <div className="space-y-3">
            <div><Lbl req>N° Originación</Lbl><input type="text" value={fd.noOriginacion} disabled className={ic(false, true)} /></div>
            <div><Lbl>N° Solicitud</Lbl><input type="text" value={fd.noSolicitud} disabled className={ic(false, true)} /></div>
            <div><Lbl req error={errors.cliente}>Cliente</Lbl><select value={fd.cliente} onChange={e => set('cliente', e.target.value)} disabled={isRO} className={sc(!!errors.cliente)}><option value="">Seleccionar...</option>{CAT_CLIENTES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>{errors.cliente && <span className="text-[10px] text-red-500">{errors.cliente}</span>}</div>
            <div><Lbl req error={errors.fechaSolicitud}>Fecha de Solicitud</Lbl><DatePicker value={fd.fechaSolicitud} onChange={v => set('fechaSolicitud', v)} disabled={isRO} placeholder="DD/MM/YYYY" className={`px-2 py-1 ${errors.fechaSolicitud ? 'border-red-400' : ''}`} />{errors.fechaSolicitud && <span className="text-[10px] text-red-500">{errors.fechaSolicitud}</span>}</div>
            <div><Lbl>Empresa Fondeadora</Lbl><select value={fd.empresaFondeadora} onChange={e => set('empresaFondeadora', e.target.value)} disabled={isRO} className={sc()}><option value="">Seleccionar...</option>{CAT_EMPRESA_FONDEADORA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            <div><Lbl req error={errors.sucursal}>Sucursal</Lbl><select value={fd.sucursal} onChange={e => set('sucursal', e.target.value)} disabled={isRO} className={sc(!!errors.sucursal)}><option value="">Seleccionar...</option>{CAT_SUCURSAL.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>{errors.sucursal && <span className="text-[10px] text-red-500">{errors.sucursal}</span>}</div>
            <div><Lbl req error={errors.montoSolicitado}>Monto Solicitado</Lbl><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">$</span><input type="text" value={fd.montoSolicitado} onChange={e => numSet('montoSolicitado', e.target.value)} onBlur={() => curBlur('montoSolicitado')} disabled={isRO} placeholder="0.00" className={`${ic(!!errors.montoSolicitado)} pl-5`} /></div>{errors.montoSolicitado && <span className="text-[10px] text-red-500">{errors.montoSolicitado}</span>}</div>
          </div>
          <div className="space-y-3">
            <div><Lbl req>Línea Producto</Lbl><input type="text" value={fd.lineaProducto} disabled className={ic(false, true)} /></div>
            <div><Lbl req error={errors.sublinea}>Sublínea</Lbl><select value={fd.sublinea} onChange={e => set('sublinea', e.target.value)} disabled={isRO} className={sc(!!errors.sublinea)}><option value="">Seleccionar...</option>{CAT_SUBLINEA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>{errors.sublinea && <span className="text-[10px] text-red-500">{errors.sublinea}</span>}</div>
            <div><Lbl req error={errors.producto}>Producto</Lbl><select value={fd.producto} onChange={e => set('producto', e.target.value)} disabled={isRO} className={sc(!!errors.producto)}><option value="">Seleccionar...</option>{CAT_PRODUCTO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>{errors.producto && <span className="text-[10px] text-red-500">{errors.producto}</span>}</div>
            <div><Lbl req error={errors.periodo}>Periodo</Lbl><select value={fd.periodo} onChange={e => set('periodo', e.target.value)} disabled={isRO} className={sc(!!errors.periodo)}><option value="">Seleccionar...</option>{CAT_PERIODO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>{errors.periodo && <span className="text-[10px] text-red-500">{errors.periodo}</span>}</div>
            <div><Lbl req error={errors.plazos}>Plazos</Lbl><select value={fd.plazos} onChange={e => set('plazos', e.target.value)} disabled={isRO} className={sc(!!errors.plazos)}><option value="">Seleccionar...</option>{CAT_PLAZOS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>{errors.plazos && <span className="text-[10px] text-red-500">{errors.plazos}</span>}</div>
            <div><Lbl>Destino del Crédito</Lbl><select value={fd.destinoCredito} onChange={e => set('destinoCredito', e.target.value)} disabled={isRO} className={sc()}><option value="">Seleccionar...</option>{CAT_DESTINO_CREDITO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
          </div>
          <div className="space-y-3">
            <div><Lbl req>Estatus</Lbl><select value={fd.estatus} onChange={e => set('estatus', e.target.value)} disabled={isRO} className={sc()}>{CAT_ESTATUS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            <div><Lbl req>Sub Estatus</Lbl><select value={fd.subEstatus} onChange={e => set('subEstatus', e.target.value)} disabled={isRO} className={sc()}>{CAT_SUB_ESTATUS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
            <div><Lbl>Responsable</Lbl><input type="text" value={fd.responsable} onChange={e => set('responsable', e.target.value)} disabled={isRO} className={ic()} placeholder="Nombre del responsable" /></div>
            <div><Lbl>Área</Lbl><select value={fd.area} onChange={e => set('area', e.target.value)} disabled={isRO} className={sc()}>{CAT_AREA.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}</select></div>
            <div><Lbl>Monto Autorizado</Lbl><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">$</span><input type="text" value={fd.montoAutorizado} onChange={e => numSet('montoAutorizado', e.target.value)} onBlur={() => curBlur('montoAutorizado')} disabled={isRO} placeholder="0.00" className={`${ic()} pl-5`} /></div></div>
            <div><Lbl>Tasa Autorizada (%)</Lbl><input type="text" value={fd.tasaAutorizada} onChange={e => numSet('tasaAutorizada', e.target.value)} onBlur={() => pctBlur('tasaAutorizada')} disabled={isRO} placeholder="0.0000" className={ic()} /></div>
            <div><Lbl>Fecha Inicio</Lbl><DatePicker value={fd.fechaInicio} onChange={v => set('fechaInicio', v)} disabled={isRO} placeholder="DD/MM/YYYY" className="px-2 py-1" /></div>
            <div><Lbl>Fecha Fin</Lbl><DatePicker value={fd.fechaFin} onChange={v => set('fechaFin', v)} disabled={isRO} placeholder="DD/MM/YYYY" className="px-2 py-1" /></div>
          </div>
        </div>

        {/* SUBTABS */}
        {sections.map(sec => (
          <div key={sec.id} className="mb-2">
            <button onClick={() => setActiveSec(p => p === sec.id ? '' : sec.id)} className="w-full bg-primary-theme text-white px-3 py-2 text-sm flex items-center justify-between hover:bg-[var(--theme-primary-hover)]">
              <div className="flex items-center gap-2"><input type="checkbox" className="w-3.5 h-3.5 pointer-events-none" checked={activeSec === sec.id} readOnly /><span>{sec.label}</span></div>
              <svg className={`transition-transform ${activeSec === sec.id ? 'rotate-180' : ''}`} width="14" height="14" viewBox="0 0 16 16" fill="white"><path d="M8 10l-4-4h8z"/></svg>
            </button>
            {activeSec === sec.id && (
              <div className="border border-gray-300 border-t-0 px-4 py-4 bg-gray-50">
                {sec.id === 'default' && (
                  <div className="bg-white border border-gray-200 p-4 space-y-4">
                    {/* ── 1. INFORMACIÓN DE LA FASE ACTUAL (del producto) ── */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                        </svg>
                        Fase Actual
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          — {currentFase?.fase || fd.subEstatus || 'Sin fase'}
                        </span>
                      </h4>
                      <div className="grid grid-cols-3 gap-4">
                        {/* Número de Fase (seq) */}
                        <div>
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Seq</label>
                          <div className="mt-1 px-3 py-2 bg-white border border-blue-200 rounded text-sm font-semibold text-blue-700">
                            {currentFase?.faseId || getFaseIdFromSubEstatus(fd.subEstatus) || '—'}
                          </div>
                        </div>
                        
                        {/* Área */}
                        <div>
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Área</label>
                          <div className="mt-1 px-3 py-2 bg-white border border-blue-200 rounded text-sm">
                            <span className="inline-flex items-center px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full text-xs font-medium">
                              {currentFase?.area || fd.area || '—'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Título */}
                        <div>
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Título</label>
                          <div className="mt-1 px-3 py-2 bg-white border border-blue-200 rounded text-sm text-gray-700">
                            {currentFase?.fase || fd.subEstatus || '—'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Notas */}
                      <div className="mt-3">
                        <label className="text-[10px] font-medium text-gray-500 uppercase">Notas</label>
                        <div className="mt-1 px-3 py-2 bg-white border border-blue-200 rounded text-sm text-gray-600">
                          {currentFase?.notes || fd.notasFase || '—'}
                        </div>
                      </div>
                    </div>

                    {/* ── 2. ESTATUS DE LA ORIGINACIÓN ── */}
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">Estatus de la Originación</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Estatus</label>
                          <select 
                            value={fd.estatus} 
                            onChange={e => set('estatus', e.target.value)} 
                            disabled={isRO} 
                            className="w-full mt-1 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#4A6FA5] disabled:bg-gray-100"
                          >
                            {CAT_ESTATUS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Responsable</label>
                          <input 
                            type="text" 
                            value={fd.responsable} 
                            onChange={e => set('responsable', e.target.value)} 
                            disabled={isRO} 
                            placeholder="Nombre del responsable" 
                            className="w-full mt-1 px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#4A6FA5] disabled:bg-gray-100"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {sec.id === 'fases' && (
                  <FasesOriginacionTab
                    mode={mode}
                    productoId={fd.producto}
                    faseIdActual={getFaseIdFromSubEstatus(fd.subEstatus)}
                    onFaseChange={handleActualizarFase}
                  />
                )}
                {sec.id === 'partesRelacionadas' && (
                  <PartesRelacionadasTab
                    mode={mode}
                    solicitudId={sid}
                    montoSolicitado={fd.montoSolicitado}
                    clienteNombre={fd.cliente}
                  />
                )}
                {sec.id === 'terminos' && (
                  <TerminosCondicionesTab
                    mode={mode}
                    solicitudId={sid}
                    lineaProducto={fd.lineaProducto}
                    productoSeleccionado={undefined}
                    montoSolicitadoHeader={fd.montoSolicitado}
                  />
                )}
                {sec.id === 'simulacion' && (
                  <SimulacionTab
                    mode={mode}
                    solicitudId={sid}
                    lineaProducto={fd.lineaProducto}
                  />
                )}
                {sec.id === 'expedientes' && (
                  <ExpedientesSection sid={sid} mode={mode} isRO={isRO} />
                )}
                {sec.id === 'garantias' && (
                  <GarantiasSection sid={sid} mode={mode} isRO={isRO} />
                )}
                {sec.id === 'comisiones' && (
                  <ComisionesTab
                    mode={mode}
                    solicitudId={sid}
                    montoSolicitado={fd.montoSolicitado}
                    productoId={fd.producto}
                  />
                )}
                {sec.id === 'autorizacion' && (
                  <AutorizacionSection sid={sid} mode={mode} isRO={isRO} />
                )}
                {sec.id === 'notas' && (
                  <NotasSection notas={notas} setNotas={setNotas} isRO={isRO} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FASE ACTION BAR — Barra de acciones según fase y estatus
// ═══════════════════════════════════════════════════════════════════
type AccionFase = 'enviarFase' | 'regresarFase' | 'formalizarContrato' | 'solicitudActivacion' | 'activarCuenta';

interface FaseActionBarProps {
  fase: FaseOriginacion;
  estatus: string;
  documentos: string[];
  /** Objetos completos de expediente — usados para validar estatus "Validado" en Fase 1 */
  expedientesData: { id: number; tipoDocumento: string; estatus: string }[];
  notas: { id: number; fechaCreacion: Date; usuario: string; contenido: string }[];
  garantias: OriginacionGarantia[];
  comites: { autoridad: string; estatus: string }[];
  beneficiarios: { id: number; nombre: string; firma: boolean }[];
  solicitudActivacion?: { estatusPago: string; monto: number };
  cargos: OriginacionCargo[];
  formData: OriginacionFormData;
  onActualizarFase: (fase: FaseOriginacion) => void;
  onActualizarEstatus: (estatus: string) => void;
  onActualizarEstatusCuenta: (estatus: string) => void;
  onActualizarEstatusPago: (estatus: string) => void;
  onActualizarEstatusCartera: (estatus: string) => void;
  onResult: (result: any) => void;
  isRO: boolean;
}

function FaseActionBar({
  fase,
  estatus,
  documentos,
  expedientesData,
  notas,
  garantias,
  comites,
  beneficiarios,
  solicitudActivacion,
  cargos,
  formData,
  onActualizarFase,
  onActualizarEstatus,
  onActualizarEstatusCuenta,
  onActualizarEstatusPago,
  onActualizarEstatusCartera,
  onResult,
  isRO,
}: FaseActionBarProps) {
  const [contratoModal, setContratoModal] = useState<{ contrato: any; lineaProducto: string; tipoProducto: string; noOriginacion: string } | null>(null);

  const ejecutarAccion = useCallback((accion: AccionFase) => {
    // Detectar tipo de persona: Moral, Fís. c/Act. Emp. o Física
    const cli = formData.cliente || '';
    const tipoPersona: import('./originacionRules').TipoPersona =
      (cli.includes('S.A.') || cli.includes('S. de R.L.') || cli.includes('S.C.') || cli.includes('S.A.P.I.'))
        ? 'Moral'
        : (formData.lineaProducto === 'Crédito' && (cli.includes('Act. Emp') || cli.includes('Empresarial')))
        ? 'Fís. c/Act. Emp.'
        : 'Física';

    const montoAutorizadoNum = parseFloat(formData.montoAutorizado) || 0;

    // ── FASE 1: Validación enriquecida — documentos presentes Y validados por IA ──
    if (fase === 'Integración del Expediente' && accion === 'enviarFase') {
      const docsRequeridos = getDocumentosObligatorios(fase, tipoPersona);
      const docsPresentes = expedientesData.map(e => e.tipoDocumento);
      const docsValidados = expedientesData
        .filter(e => e.estatus === 'Validado')
        .map(e => e.tipoDocumento);

      const faltanPresencia = docsRequeridos.filter(d => !docsPresentes.includes(d));
      const noValidadosPorIA = docsRequeridos.filter(d => docsPresentes.includes(d) && !docsValidados.includes(d));

      if (faltanPresencia.length > 0 || noValidadosPorIA.length > 0) {
        if (faltanPresencia.length > 0) {
          toast.error('Documentos obligatorios no adjuntados', {
            description: faltanPresencia.join(', '),
          });
        }
        if (noValidadosPorIA.length > 0) {
          toast.error('Documentos pendientes de validación IA', {
            description: `Los siguientes documentos deben tener estatus "Validado": ${noValidadosPorIA.join(', ')}`,
          });
        }
        const failResult: ReglaValidacionResult = {
          accionPermitida: false,
          fase,
          faseDestino: null,
          motivos: [
            ...faltanPresencia.map(d => `Documento no adjuntado: ${d}`),
            ...noValidadosPorIA.map(d => `Sin validación IA: ${d}`),
          ],
          validaciones: {
            documentosCompletos: false,
            notaReciente: true,
            garantiasSuficientes: true,
            comitesAutorizados: true,
            beneficiariosCompletos: true,
            solicitudPagoCompletado: true,
          },
          actualizaciones: [],
          documentosFaltantes: [...faltanPresencia, ...noValidadosPorIA],
        };
        onResult(failResult);
        return;
      }
    }

    // Mapear cargos → formato esperado por las reglas (CargoItem)
    const cargosCtxMapped = cargos.map(c => ({
      cveSubproducto: c.tipoCargo || 'Capital',
      descSubproducto: c.descripcion || c.tipoCargo || 'Capital',
      cantidad: 1,
      monto: c.monto || 0,
      impuesto: 0,
      moneda: 'MXN',
      subTotal: c.monto || 0,
      estatus: c.estatus || 'Pendiente',
    }));

    const context = {
      id: 0,
      estatusSolicitud: formData.estatus,
      fase,
      lineaProducto: formData.lineaProducto as 'Crédito' | 'Captación' | 'Línea de Crédito',
      tipoProducto: formData.producto as 'Crédito Simple' | 'Crédito Revolvente' | 'Línea de Crédito',
      tipoPersona,
      documentos,
      notas,
      garantias,
      comites,
      beneficiarios,
      solicitudActivacion,
      cargos: cargosCtxMapped,
      // Si hay garantías o comités registrados, se considera que el producto los requiere
      requiereGarantia: garantias.length > 0,
      requiereComite: comites.length > 0,
      header: {
        solicitudId: formData.noOriginacion,
        cliente: formData.cliente,
        noCuenta: formData.noOriginacion,
        tasa: formData.tasaAutorizada,
        plazo: formData.plazos,
        periodicidad: formData.periodo,
        montoAutorizado: montoAutorizadoNum,
        fechaInicio: formData.fechaInicio,
        fechaFin: formData.fechaFin,
        tipoAmortizacion: formData.tipoAmortizacion,
        moneda: 'MXN',
      },
    };

    const result = ejecutarReglasFase(context, accion);

    if (!result.accionPermitida) {
      result.motivos.forEach(motivo => toast.error('Validación fallida', { description: motivo }));
      if (result.documentosFaltantes?.length) {
        toast.error('Documentos faltantes', { description: result.documentosFaltantes.join(', ') });
      }
    } else {
      toast.success('Acción ejecutada', { description: result.motivos.join(' ') });
      if (result.faseDestino && result.faseDestino !== fase) {
        onActualizarFase(result.faseDestino);
      }
      result.actualizaciones.forEach(update => {
        if (update.estatusSolicitud) onActualizarEstatus(update.estatusSolicitud);
        if (update.estatusCuenta) onActualizarEstatusCuenta(update.estatusCuenta);
        if (update.estatusPago) onActualizarEstatusPago(update.estatusPago);
        if (update.estatusCartera) onActualizarEstatusCartera(update.estatusCartera);
      });
      // Mostrar modal de contrato/pagaré cuando se formaliza
      if (result.contrato) {
        setContratoModal({
          contrato: result.contrato,
          lineaProducto: formData.lineaProducto,
          tipoProducto: formData.producto,
          noOriginacion: formData.noOriginacion,
        });
      }
    }
    onResult(result);
  }, [fase, formData, documentos, expedientesData, notas, garantias, comites, beneficiarios, solicitudActivacion, onActualizarFase, onActualizarEstatus, onActualizarEstatusCuenta, onActualizarEstatusPago, onActualizarEstatusCartera, onResult]);

  if (isRO || estatus === 'Pendiente') {
    return fase === 'Activación de Cuenta Financiera' ? (
      <div className="bg-green-50 border border-green-300 rounded px-4 py-3 mb-4">
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          <span className="text-sm text-green-800">Solicitud <strong>{estatus}</strong> — Fase: <strong>{fase}</strong></span>
        </div>
      </div>
    ) : null;
  }

  // "Enviar de Fase" no aplica en FASE 6 (usa "Solicitud de Activación") ni en la última fase
  const puedeEnviar = !['Solicitud de Activación de Cuenta Financiera', 'Activación de Cuenta Financiera'].includes(fase);
  const puedeRegresar = !['Integración del Expediente'].includes(fase);
  const puedeFormalizar = fase === 'Formalización de Cuenta Financiera';
  const puedeSolicitarActivacion = fase === 'Solicitud de Activación de Cuenta Financiera';
  const puedeActivar = fase === 'Activación de Cuenta Financiera';

  return (<>
    <div className="bg-[#EBF3FB] border border-[#4A6FA5] rounded px-4 py-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-700">
            <strong>Fase:</strong> {fase}
          </span>
          <span className={`px-2 py-0.5 rounded text-xs ${estatus === 'Aprobado' ? 'bg-green-100 text-green-800' : estatus === 'En Proceso' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
            {estatus}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {puedeEnviar && (
            <button
              onClick={() => ejecutarAccion('enviarFase')}
              className="px-4 py-1.5 bg-[#10B981] text-white rounded text-xs hover:bg-[#059669] flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              Enviar de Fase
            </button>
          )}
          {puedeRegresar && (
            <button
              onClick={() => ejecutarAccion('regresarFase')}
              className="px-4 py-1.5 bg-[#F59E0B] text-white rounded text-xs hover:bg-[#D97706] flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Regresar de Fase
            </button>
          )}
          {puedeFormalizar && (
            <button
              onClick={() => ejecutarAccion('formalizarContrato')}
              className="px-4 py-1.5 bg-[#7C3AED] text-white rounded text-xs hover:bg-[#6D28D9] flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
              Formalizar Contrato
            </button>
          )}
          {puedeSolicitarActivacion && (
            <button
              onClick={() => ejecutarAccion('solicitudActivacion')}
              className="px-4 py-1.5 bg-[#2E5C91] text-white rounded text-xs hover:bg-[#1E4A75] flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              Solicitud Activación
            </button>
          )}
          {puedeActivar && (
            <button
              onClick={() => ejecutarAccion('activarCuenta')}
              className="px-4 py-1.5 bg-[#10B981] text-white rounded text-xs hover:bg-[#059669] flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              Activar Cuenta
            </button>
          )}
        </div>
      </div>
    </div>

    {/* Panel de estado documental — solo visible en Fase 1 */}
    {fase === 'Integración del Expediente' && (() => {
      const cli = formData.cliente || '';
      const tp: import('./originacionRules').TipoPersona =
        (cli.includes('S.A.') || cli.includes('S. de R.L.') || cli.includes('S.C.') || cli.includes('S.A.P.I.'))
          ? 'Moral'
          : (formData.lineaProducto === 'Crédito' && (cli.includes('Act. Emp') || cli.includes('Empresarial')))
          ? 'Fís. c/Act. Emp.'
          : 'Física';
      const requeridos = getDocumentosObligatorios(fase, tp);
      return (
        <div className="mb-4 border border-blue-200 rounded bg-blue-50 px-4 py-3">
          <p className="text-xs font-semibold text-blue-800 mb-2">
            Documentos obligatorios — Expediente Electrónico ({tp})
          </p>
          <ul className="space-y-1">
            {requeridos.map(doc => {
              const item = expedientesData.find(e => e.tipoDocumento === doc);
              const validado = item?.estatus === 'Validado';
              const presente = !!item;
              return (
                <li key={doc} className="flex items-center gap-2 text-xs">
                  {validado
                    ? <span className="text-green-600">✓</span>
                    : presente
                      ? <span className="text-yellow-600">⚠</span>
                      : <span className="text-red-600">✗</span>}
                  <span className={validado ? 'text-green-700' : presente ? 'text-yellow-700' : 'text-red-700'}>
                    {doc}
                  </span>
                  {presente && !validado && (
                    <span className="text-[10px] text-yellow-600 bg-yellow-100 px-1 rounded">
                      {item.estatus} — requiere estatus Validado
                    </span>
                  )}
                  {!presente && (
                    <span className="text-[10px] text-red-600 bg-red-100 px-1 rounded">No adjuntado</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      );
    })()}

    {/* Modal de Contrato/Pagaré — Formalización FASE 4 */}
    {contratoModal && (
      <ContratoModal
        contrato={contratoModal.contrato}
        lineaProducto={contratoModal.lineaProducto}
        tipoProducto={contratoModal.tipoProducto}
        noOriginacion={contratoModal.noOriginacion}
        onClose={() => setContratoModal(null)}
      />
    )}
  </>);
}

// ═══════════════════════════════════════════════════════════════════
// CONTRATO MODAL — Vista de contrato/pagaré para impresión (FASE 4)
// ═══════════════════════════════════════════════════════════════════
function ContratoModal({ contrato, lineaProducto, tipoProducto, noOriginacion, onClose }: {
  contrato: any;
  lineaProducto: string;
  tipoProducto: string;
  noOriginacion: string;
  onClose: () => void;
}) {
  const fmtCurrency = (v: number) => `$${(v || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const hoy = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  const tc = contrato.terminosCondiciones || {};
  const hdr = contrato.header || {};
  const garantias: any[] = contrato.garantias || [];

  const handlePrint = () => {
    const el = document.getElementById('contrato-print-area');
    if (!el) return;
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Contrato — ${noOriginacion}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 40px; }
        h1 { font-size: 16px; text-align: center; margin-bottom: 4px; }
        h2 { font-size: 13px; border-bottom: 1px solid #999; padding-bottom: 4px; margin: 20px 0 8px; }
        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin-bottom: 12px; }
        .field label { font-size: 10px; color: #555; display: block; }
        .field span { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #ddd; padding: 6px; text-align: left; font-size: 11px; border: 1px solid #bbb; }
        td { padding: 5px 6px; font-size: 11px; border: 1px solid #ddd; }
        .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; }
        .firma-box { border-top: 1px solid #333; padding-top: 6px; text-align: center; font-size: 11px; }
        @media print { body { margin: 20px; } }
      </style></head><body>${el.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
            <span className="text-sm font-semibold text-gray-800">Contrato / Pagaré — {noOriginacion}</span>
            <span className="px-2 py-0.5 text-[10px] bg-purple-100 text-purple-700 rounded">{lineaProducto} · {tipoProducto}</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body scrollable */}
        <div className="overflow-auto flex-1 px-5 py-4" id="contrato-print-area">
          {/* ── CONTRATO ── */}
          <h1 className="text-base font-bold text-center text-gray-900 mb-1">CONTRATO DE {lineaProducto.toUpperCase()}</h1>
          <p className="text-[10px] text-center text-gray-500 mb-4">{tipoProducto} — Folio: {noOriginacion} — Fecha: {hoy}</p>

          <h2 className="text-xs font-semibold text-gray-700 border-b border-gray-200 pb-1 mb-3">1. DATOS DEL CLIENTE</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4">
            {[
              { label: 'Cliente', value: hdr.cliente },
              { label: 'No. Originación', value: noOriginacion },
              { label: 'Línea de Producto', value: lineaProducto },
              { label: 'Tipo de Producto', value: tipoProducto },
            ].map(f => (
              <div key={f.label}>
                <span className="text-[10px] text-gray-500 block">{f.label}</span>
                <span className="text-xs font-medium text-gray-800">{f.value || '—'}</span>
              </div>
            ))}
          </div>

          <h2 className="text-xs font-semibold text-gray-700 border-b border-gray-200 pb-1 mb-3">2. TÉRMINOS Y CONDICIONES</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4">
            {[
              { label: 'Monto Autorizado', value: fmtCurrency(tc.montoAutorizado) },
              { label: 'Tasa de Interés', value: tc.tasa ? `${tc.tasa}%` : '—' },
              { label: 'Plazo', value: tc.plazo ? `${tc.plazo} períodos` : '—' },
              { label: 'Periodicidad', value: tc.periodicidad || '—' },
              { label: 'Fecha Inicio', value: tc.fechaInicio || '—' },
              { label: 'Fecha Fin', value: tc.fechaFin || '—' },
              { label: 'Tipo Amortización', value: tc.tipoAmortizacion || '—' },
            ].map(f => (
              <div key={f.label}>
                <span className="text-[10px] text-gray-500 block">{f.label}</span>
                <span className="text-xs font-medium text-gray-800">{f.value}</span>
              </div>
            ))}
          </div>

          {garantias.length > 0 && (<>
            <h2 className="text-xs font-semibold text-gray-700 border-b border-gray-200 pb-1 mb-3">3. GARANTÍAS</h2>
            <table className="w-full text-xs mb-4 border border-gray-200">
              <thead><tr className="bg-gray-100">
                <th className="px-2 py-1.5 text-left border-r border-gray-200">Tipo</th>
                <th className="px-2 py-1.5 text-left border-r border-gray-200">Descripción</th>
                <th className="px-2 py-1.5 text-right">Valor Nominal</th>
              </tr></thead>
              <tbody>
                {garantias.map((g: any, i: number) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-2 py-1 border-r border-gray-200">{g.tipo || '—'}</td>
                    <td className="px-2 py-1 border-r border-gray-200">{g.descripcion || '—'}</td>
                    <td className="px-2 py-1 text-right">{fmtCurrency(g.valorNominal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>)}

          {/* ── PAGARÉ ── */}
          <div className="border-t-2 border-dashed border-gray-400 mt-6 pt-4">
            <h1 className="text-base font-bold text-center text-gray-900 mb-1">PAGARÉ</h1>
            <p className="text-[10px] text-center text-gray-500 mb-4">Asociado al Contrato {noOriginacion} — Fecha: {hoy}</p>

            <p className="text-xs text-gray-700 mb-4 leading-relaxed">
              Por este pagaré me/nos obligo/obligamos incondicionalmente a pagar a la orden de <strong>la Institución</strong> la
              cantidad de <strong>{fmtCurrency(tc.montoAutorizado)}</strong> ({lineaProducto} — {tipoProducto}),
              más los intereses pactados a una tasa del <strong>{tc.tasa || '—'}%</strong>,
              pagaderos en <strong>{tc.plazo || '—'}</strong> períodos con periodicidad <strong>{tc.periodicidad || '—'}</strong>,
              con vencimiento el <strong>{tc.fechaFin || '—'}</strong>.
            </p>

            <div className="grid grid-cols-2 gap-12 mt-10">
              <div className="text-center">
                <div className="border-t border-gray-600 pt-1 mt-8">
                  <p className="text-[10px] text-gray-600">Firma del Acreditado</p>
                  <p className="text-[10px] text-gray-500">{hdr.cliente || '___________________________'}</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-600 pt-1 mt-8">
                  <p className="text-[10px] text-gray-600">Firma del Representante Institucional</p>
                  <p className="text-[10px] text-gray-500">___________________________</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
          <button onClick={onClose} className="px-4 py-1.5 bg-white border border-gray-300 text-gray-700 rounded text-xs hover:bg-gray-50">
            Cerrar
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 bg-[#7C3AED] text-white rounded text-xs hover:bg-[#6D28D9] flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══ INLINE SUBTAB SECTIONS ═══
const ic0 = (isRO: boolean, dis = false) => `w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none ${dis || isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-[#4A6FA5]'}`;

function DefaultSection({ fd, set, isRO }: { fd: OriginacionFormData; set: (f: keyof OriginacionFormData, v: string) => void; isRO: boolean }) {
  const badge = fd.estatusListaNegra === 'POSITIVO' ? 'bg-green-100 text-green-800' : fd.estatusListaNegra === 'NEGATIVO' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
  return (<>
    <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5 mb-4"><span className="text-xs text-gray-800">DATOS DEL CLIENTE</span></div>
    <div className="grid grid-cols-2 gap-x-8 gap-y-3">
      <div><label className="block text-xs text-gray-700 mb-1">ESTATUS S.C</label><select value={fd.estatusSC} onChange={e => set('estatusSC', e.target.value)} disabled={isRO} className={ic0(isRO)}><option value="">Seleccionar...</option>{CAT_ESTATUS_SC.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
      <div className="row-span-3"><label className="block text-xs text-gray-700 mb-1">DIRECCIÓN PRINCIPAL</label><textarea value={fd.direccionPrincipal} onChange={e => set('direccionPrincipal', e.target.value)} disabled={isRO} className={`${ic0(isRO)} resize-none`} rows={5} maxLength={500} /></div>
      <div><label className="block text-xs text-gray-700 mb-1">ESTATUS LISTA NEGRA</label><div className="flex items-center gap-2"><select value={fd.estatusListaNegra} onChange={e => set('estatusListaNegra', e.target.value)} disabled={isRO} className={`flex-1 ${ic0(isRO)}`}>{CAT_ESTATUS_LISTA_NEGRA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select><span className={`px-2 py-0.5 text-[10px] rounded ${badge}`}>{fd.estatusListaNegra === 'POSITIVO' ? '✓' : '✗'}</span></div></div>
      <div><label className="block text-xs text-gray-700 mb-1">ESTATUS DEL CLIENTE</label><select value={fd.estatusCliente} onChange={e => set('estatusCliente', e.target.value)} disabled={isRO} className={ic0(isRO)}><option value="">Seleccionar...</option>{CAT_ESTATUS_CLIENTE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
      <div><label className="block text-xs text-gray-700 mb-1">MONEDA</label><select value={fd.moneda} onChange={e => set('moneda', e.target.value)} disabled={isRO} className={ic0(isRO)}>{CAT_MONEDA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
    </div>
  </>);
}

function MontosSection({ fd, set, isRO }: { fd: OriginacionFormData; set: (f: keyof OriginacionFormData, v: string) => void; isRO: boolean }) {
  return (<div className="grid grid-cols-2 gap-x-8 gap-y-4">
    <div className="space-y-3">
      <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5"><span className="text-xs text-gray-800">PLAZOS</span></div>
      <div><label className="block text-xs text-gray-700 mb-1">PLAZO MÍNIMO</label><input type="text" value={fd.plazoMinimo} disabled className={ic0(isRO, true)} /></div>
      <div><label className="block text-xs text-gray-700 mb-1">PLAZO AUTORIZADO <span className="text-red-600">*</span></label><input type="text" value={fd.plazoAutorizadoMontos} onChange={e => set('plazoAutorizadoMontos', e.target.value.replace(/[^0-9.]/g, ''))} disabled={isRO} placeholder="0" className={ic0(isRO)} /></div>
      <div><label className="block text-xs text-gray-700 mb-1">PLAZO MÁXIMO</label><input type="text" value={fd.plazoMaximo} disabled className={ic0(isRO, true)} /></div>
    </div>
    <div className="space-y-3">
      <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5"><span className="text-xs text-gray-800">MONTOS</span></div>
      <div><label className="block text-xs text-gray-700 mb-1">MONTO MÍNIMO</label><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">$</span><input type="text" value={fd.montoMinimo} disabled className={`${ic0(isRO, true)} pl-5`} /></div></div>
      <div><label className="block text-xs text-gray-700 mb-1">MONTO AUTORIZADO <span className="text-red-600">*</span></label><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">$</span><input type="text" value={fd.montoAutorizadoMontos} onChange={e => set('montoAutorizadoMontos', e.target.value.replace(/[^0-9.,-]/g, ''))} disabled={isRO} placeholder="0.00" className={`${ic0(isRO)} pl-5`} /></div></div>
      <div><label className="block text-xs text-gray-700 mb-1">MONTO MÁXIMO</label><div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">$</span><input type="text" value={fd.montoMaximo} disabled className={`${ic0(isRO, true)} pl-5`} /></div></div>
    </div>
  </div>);
}

function TasasSection({ fd, set, isRO }: { fd: OriginacionFormData; set: (f: keyof OriginacionFormData, v: string) => void; isRO: boolean }) {
  return (<>
    <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5 mb-4"><span className="text-xs text-gray-800">TASAS DE INTERÉS</span></div>
    <div className="grid grid-cols-2 gap-x-8 gap-y-4"><div className="space-y-3">
      <div><label className="block text-xs text-gray-700 mb-1">TASA MÍNIMA (%)</label><input type="text" value={fd.tasaMinima} disabled className={ic0(isRO, true)} /></div>
      <div><label className="block text-xs text-gray-700 mb-1">TASA AUTORIZADA (%) <span className="text-red-600">*</span></label><input type="text" value={fd.tasaAutorizadaTasas} onChange={e => set('tasaAutorizadaTasas', e.target.value.replace(/[^0-9.]/g, ''))} disabled={isRO} placeholder="0.0000" className={ic0(isRO)} /></div>
      <div><label className="block text-xs text-gray-700 mb-1">TASA MÁXIMA (%)</label><input type="text" value={fd.tasaMaxima} disabled className={ic0(isRO, true)} /></div>
    </div><div /></div>
  </>);
}

function CotizacionSection({ sid, mode, fd, isRO }: { sid: number; mode: string; fd: OriginacionFormData; isRO: boolean }) {
  const [rows, setRows] = useState<CotizacionRow[]>(() => loadFromSession<CotizacionRow[]>(sid, 'cotizacion') || loadFromSavedStore<CotizacionRow[]>(sid, 'cotizacion') || []);
  useEffect(() => { if (!isRO) saveToSession(sid, 'cotizacion', rows); }, [rows, sid, isRO]);
  const handleGen = () => {
    const monto = parseFloat(parseCurrency(fd.montoAutorizado || fd.montoSolicitado || '0'));
    const tasa = parseFloat((fd.tasaAutorizada || '0').replace(/[^0-9.-]/g, ''));
    const plazo = parseInt(fd.plazoAutorizado || fd.plazos || '0');
    if (!monto || !tasa || !plazo) { toast.error('Complete Monto, Tasa y Plazo'); return; }
    const tasaP = tasa / 100 / 12;
    const pago = monto * (tasaP * Math.pow(1 + tasaP, plazo)) / (Math.pow(1 + tasaP, plazo) - 1);
    const nr: CotizacionRow[] = []; let s = monto; const base = generateId();
    for (let i = 1; i <= plazo; i++) {
      const int = s * tasaP; const cap = pago - int; const iva = int * 0.16; const sf = Math.max(0, s - cap);
      const d = new Date(); d.setMonth(d.getMonth() + i);
      nr.push({ id: base + i, numeroPago: i, fechaPago: `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`, saldoInicial: +s.toFixed(2), capital: +cap.toFixed(2), interes: +int.toFixed(2), iva: +iva.toFixed(2), pagoTotal: +(pago + iva).toFixed(2), saldoFinal: +sf.toFixed(2) });
      s = sf;
    }
    setRows(nr); toast.success(`Cotización generada — ${plazo} pagos`);
  };
  return (<>
    <div className="flex items-center justify-between mb-3"><div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5"><span className="text-xs text-gray-800">TABLA DE AMORTIZACIÓN</span></div>{!isRO && <button onClick={handleGen} className="px-4 py-1.5 bg-[#0099CC] text-white rounded text-xs hover:bg-[#0088BB]">Generar Cotización</button>}</div>
    <div className="border border-gray-300 bg-white overflow-x-auto"><table className="w-full border-collapse min-w-[900px]"><thead><tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300"><th className="px-3 py-2 text-xs text-gray-700 text-center border-r border-gray-300 w-[60px]">N°</th><th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Fecha</th><th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Saldo Inicial</th><th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Capital</th><th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Interés</th><th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">IVA</th><th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Pago Total</th><th className="px-3 py-2 text-xs text-gray-700 text-right">Saldo Final</th></tr></thead><tbody>
      {rows.length === 0 ? <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-400">Sin tabla de amortización</td></tr>
      : rows.map(r => <tr key={r.id} className="border-b border-gray-200 hover:bg-gray-50"><td className="px-3 py-1.5 text-xs text-center border-r border-gray-200">{r.numeroPago}</td><td className="px-3 py-1.5 text-xs border-r border-gray-200">{r.fechaPago}</td><td className="px-3 py-1.5 text-xs text-right border-r border-gray-200">{formatCurrency(r.saldoInicial)}</td><td className="px-3 py-1.5 text-xs text-right border-r border-gray-200">{formatCurrency(r.capital)}</td><td className="px-3 py-1.5 text-xs text-right border-r border-gray-200">{formatCurrency(r.interes)}</td><td className="px-3 py-1.5 text-xs text-right border-r border-gray-200">{formatCurrency(r.iva)}</td><td className="px-3 py-1.5 text-xs text-right border-r border-gray-200">{formatCurrency(r.pagoTotal)}</td><td className="px-3 py-1.5 text-xs text-right">{formatCurrency(r.saldoFinal)}</td></tr>)}
    </tbody></table></div>
  </>);
}

function AutorizacionSection({ sid, mode, isRO }: { sid: number; mode: string; isRO: boolean }) {
  const [items, setItems] = useState<OriginacionAutorizacion[]>(() => loadFromSession<OriginacionAutorizacion[]>(sid, 'autorizaciones') || loadFromSavedStore<OriginacionAutorizacion[]>(sid, 'autorizaciones') || []);
  useEffect(() => { if (!isRO) saveToSession(sid, 'autorizaciones', items); }, [items, sid, isRO]);
  const add = () => { const n = new Date(); setItems(p => [...p, { id: generateId(), fechaHora: `${n.getDate().toString().padStart(2,'0')}/${(n.getMonth()+1).toString().padStart(2,'0')}/${n.getFullYear()} ${n.getHours().toString().padStart(2,'0')}:${n.getMinutes().toString().padStart(2,'0')}`, usuario: '', area: '', descripcion: '', observaciones: '', estatus: 'Pendiente' }]); };
  return (<>
    <div className="flex items-center justify-between mb-3"><div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5"><span className="text-xs text-gray-800">AUTORIZACIONES</span></div>{!isRO && <button onClick={add} className="px-4 py-1.5 bg-[#0099CC] text-white rounded text-xs hover:bg-[#0088BB]">Autorizar</button>}</div>
    <div className="border border-gray-300 bg-white overflow-x-auto"><table className="w-full border-collapse min-w-[900px]"><thead><tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300"><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Fecha</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Usuario</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Área</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Descripción</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Observaciones</th><th className="px-2 py-2 text-xs text-gray-700 text-left">Estatus</th></tr></thead><tbody>
      {items.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400">Sin autorizaciones</td></tr>
      : items.map(a => <tr key={a.id} className="border-b border-gray-200 hover:bg-gray-50"><td className="px-2 py-1.5 text-xs border-r border-gray-200">{a.fechaHora}</td><td className="px-2 py-1.5 border-r border-gray-200"><input type="text" value={a.usuario} onChange={e => setItems(p => p.map(x => x.id === a.id ? {...x, usuario: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`} /></td><td className="px-2 py-1.5 border-r border-gray-200"><input type="text" value={a.area} onChange={e => setItems(p => p.map(x => x.id === a.id ? {...x, area: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`} /></td><td className="px-2 py-1.5 border-r border-gray-200"><input type="text" value={a.descripcion} onChange={e => setItems(p => p.map(x => x.id === a.id ? {...x, descripcion: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`} /></td><td className="px-2 py-1.5 border-r border-gray-200"><input type="text" value={a.observaciones} onChange={e => setItems(p => p.map(x => x.id === a.id ? {...x, observaciones: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`} /></td><td className="px-2 py-1.5"><select value={a.estatus} onChange={e => setItems(p => p.map(x => x.id === a.id ? {...x, estatus: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`}>{CAT_ESTATUS_AUTORIZACION.map(s => <option key={s} value={s}>{s}</option>)}</select></td></tr>)}
    </tbody></table></div>
  </>);
}

function GarantiasSection({ sid, mode, isRO }: { sid: number; mode: string; isRO: boolean }) {
  const [items, setItems] = useState<OriginacionGarantia[]>(() => loadFromSession<OriginacionGarantia[]>(sid, 'garantias') || loadFromSavedStore<OriginacionGarantia[]>(sid, 'garantias') || []);
  useEffect(() => { if (!isRO) saveToSession(sid, 'garantias', items); }, [items, sid, isRO]);
  const add = () => setItems(p => [...p, { id: generateId(), tipo: '', subtipo: '', descripcion: '', valorNominal: 0, ubicacion: '', estatus: 'Vigente' }]);
  return (<>
    <div className="flex items-center justify-between mb-3"><div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5"><span className="text-xs text-gray-800">GARANTÍAS</span></div>{!isRO && <button onClick={add} className="px-4 py-1.5 bg-[#0099CC] text-white rounded text-xs hover:bg-[#0088BB]">Nuevo</button>}</div>
    <div className="border border-gray-300 bg-white overflow-x-auto"><table className="w-full border-collapse min-w-[800px]"><thead><tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300"><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Tipo</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Subtipo</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Descripción</th><th className="px-2 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Valor Nominal</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Ubicación</th><th className="px-2 py-2 text-xs text-gray-700 text-left">Estatus</th></tr></thead><tbody>
      {items.length === 0 ? <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-gray-400">Sin garantías</td></tr>
      : items.map(g => <tr key={g.id} className="border-b border-gray-200 hover:bg-gray-50"><td className="px-2 py-1.5 border-r border-gray-200"><select value={g.tipo} onChange={e => setItems(p => p.map(x => x.id === g.id ? {...x, tipo: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`}><option value="">Seleccione...</option>{CAT_TIPO_GARANTIA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></td><td className="px-2 py-1.5 border-r border-gray-200"><input type="text" value={g.subtipo} onChange={e => setItems(p => p.map(x => x.id === g.id ? {...x, subtipo: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`} /></td><td className="px-2 py-1.5 border-r border-gray-200"><input type="text" value={g.descripcion} onChange={e => setItems(p => p.map(x => x.id === g.id ? {...x, descripcion: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`} /></td><td className="px-2 py-1.5 border-r border-gray-200"><input type="number" step="0.01" min="0" value={g.valorNominal} onChange={e => setItems(p => p.map(x => x.id === g.id ? {...x, valorNominal: +e.target.value || 0} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded text-right ${isRO ? 'bg-gray-100' : 'bg-white'}`} /></td><td className="px-2 py-1.5 border-r border-gray-200"><input type="text" value={g.ubicacion} onChange={e => setItems(p => p.map(x => x.id === g.id ? {...x, ubicacion: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`} /></td><td className="px-2 py-1.5"><select value={g.estatus} onChange={e => setItems(p => p.map(x => x.id === g.id ? {...x, estatus: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`}><option>Vigente</option><option>En trámite</option><option>Cancelada</option></select></td></tr>)}
    </tbody></table></div>
  </>);
}

function CargosSection({ sid, mode, isRO }: { sid: number; mode: string; isRO: boolean }) {
  const [items, setItems] = useState<OriginacionCargo[]>(() => loadFromSession<OriginacionCargo[]>(sid, 'cargos') || loadFromSavedStore<OriginacionCargo[]>(sid, 'cargos') || []);
  useEffect(() => { if (!isRO) saveToSession(sid, 'cargos', items); }, [items, sid, isRO]);
  const add = () => setItems(p => [...p, { id: generateId(), tipoCargo: '', descripcion: '', monto: 0, fechaCargo: '', estatus: 'Pendiente', notas: '' }]);
  return (<>
    <div className="flex items-center justify-between mb-3"><div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5"><span className="text-xs text-gray-800">CARGOS</span></div>{!isRO && <button onClick={add} className="px-4 py-1.5 bg-[#0099CC] text-white rounded text-xs hover:bg-[#0088BB]">Nuevo</button>}</div>
    <div className="border border-gray-300 bg-white overflow-x-auto"><table className="w-full border-collapse min-w-[800px]"><thead><tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300"><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Tipo Cargo</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Descripción</th><th className="px-2 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Monto</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Estatus</th><th className="px-2 py-2 text-xs text-gray-700 text-left">Notas</th></tr></thead><tbody>
      {items.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-400">Sin cargos</td></tr>
      : items.map(c => <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50"><td className="px-2 py-1.5 border-r border-gray-200"><select value={c.tipoCargo} onChange={e => setItems(p => p.map(x => x.id === c.id ? {...x, tipoCargo: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`}><option value="">Seleccione...</option>{CAT_TIPO_CARGO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></td><td className="px-2 py-1.5 border-r border-gray-200"><input type="text" value={c.descripcion} onChange={e => setItems(p => p.map(x => x.id === c.id ? {...x, descripcion: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`} /></td><td className="px-2 py-1.5 border-r border-gray-200"><input type="number" step="0.01" min="0" value={c.monto} onChange={e => setItems(p => p.map(x => x.id === c.id ? {...x, monto: +e.target.value || 0} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded text-right ${isRO ? 'bg-gray-100' : 'bg-white'}`} /></td><td className="px-2 py-1.5 border-r border-gray-200"><select value={c.estatus} onChange={e => setItems(p => p.map(x => x.id === c.id ? {...x, estatus: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`}>{CAT_ESTATUS_CARGO.map(s => <option key={s} value={s}>{s}</option>)}</select></td><td className="px-2 py-1.5"><input type="text" value={c.notas} onChange={e => setItems(p => p.map(x => x.id === c.id ? {...x, notas: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`} /></td></tr>)}
    </tbody></table></div>
  </>);
}

// ── NOTAS SECTION — necesario para validar "Regresar de Fase" (nota en últimos 30 min)
type NotaItem = { id: number; fechaCreacion: Date; usuario: string; contenido: string };

function NotasSection({ notas, setNotas, isRO }: {
  notas: NotaItem[];
  setNotas: React.Dispatch<React.SetStateAction<NotaItem[]>>;
  isRO: boolean;
}) {
  const [contenido, setContenido] = useState('');

  const addNota = () => {
    if (!contenido.trim()) { toast.error('Escribe el contenido de la nota'); return; }
    const nueva: NotaItem = { id: Date.now(), fechaCreacion: new Date(), usuario: 'Usuario', contenido: contenido.trim() };
    setNotas(prev => [nueva, ...prev]);
    setContenido('');
    toast.success('Nota agregada', { description: 'La nota quedó registrada y permite regresar de fase en los próximos 30 min.' });
  };

  const deleteNota = (id: number) => setNotas(prev => prev.filter(n => n.id !== id));

  const fmtFecha = (d: Date) => {
    const dt = d instanceof Date ? d : new Date(d);
    return isNaN(dt.getTime()) ? '—' : dt.toLocaleString('es-MX');
  };

  const ahora = new Date();
  const limite30 = new Date(ahora.getTime() - 30 * 60 * 1000);
  const hayNotaReciente = notas.some(n => {
    const fc = n.fechaCreacion instanceof Date ? n.fechaCreacion : new Date(n.fechaCreacion);
    return fc >= limite30;
  });

  return (<>
    <div className="flex items-center justify-between mb-3">
      <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5 flex items-center gap-3">
        <span className="text-xs text-gray-800">NOTAS</span>
        {hayNotaReciente
          ? <span className="px-2 py-0.5 text-[10px] bg-green-100 text-green-700 rounded">✓ Nota reciente (≤30 min)</span>
          : <span className="px-2 py-0.5 text-[10px] bg-yellow-100 text-yellow-700 rounded">⚠ Sin nota reciente — requerida para Regresar de Fase</span>}
      </div>
    </div>
    {!isRO && (
      <div className="mb-4 space-y-2">
        <textarea
          value={contenido}
          onChange={e => setContenido(e.target.value)}
          placeholder="Escribe una nota (requerida para regresar de fase)..."
          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#4A6FA5] bg-white resize-none"
          rows={3}
          maxLength={1024}
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400">{contenido.length}/1024</span>
          <button onClick={addNota} className="px-4 py-1.5 bg-[#0099CC] text-white rounded text-xs hover:bg-[#0088BB]">
            Agregar Nota
          </button>
        </div>
      </div>
    )}
    <div className="border border-gray-300 bg-white overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
            <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300 whitespace-nowrap">Fecha / Hora</th>
            <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Usuario</th>
            <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Nota</th>
            <th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300 whitespace-nowrap">Reciente</th>
            {!isRO && <th className="px-2 py-2 w-8"></th>}
          </tr>
        </thead>
        <tbody>
          {notas.length === 0
            ? <tr><td colSpan={isRO ? 4 : 5} className="px-3 py-6 text-center text-xs text-gray-400">Sin notas</td></tr>
            : notas.map(n => {
                const fc = n.fechaCreacion instanceof Date ? n.fechaCreacion : new Date(n.fechaCreacion);
                const esReciente = fc >= limite30;
                return (
                  <tr key={n.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-2 py-1.5 text-xs border-r border-gray-200 whitespace-nowrap">{fmtFecha(n.fechaCreacion)}</td>
                    <td className="px-2 py-1.5 text-xs border-r border-gray-200 whitespace-nowrap">{n.usuario}</td>
                    <td className="px-2 py-1.5 text-xs border-r border-gray-200">{n.contenido}</td>
                    <td className="px-2 py-1.5 text-xs border-r border-gray-200 text-center">
                      {esReciente
                        ? <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">✓</span>
                        : <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]">—</span>}
                    </td>
                    {!isRO && (
                      <td className="px-2 py-1.5 text-center">
                        <button onClick={() => deleteNota(n.id)} className="text-red-500 hover:text-red-700">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
          }
        </tbody>
      </table>
    </div>
  </>);
}

function AvisosSection({ sid, mode, isRO }: { sid: number; mode: string; isRO: boolean }) {
  const [items, setItems] = useState<OriginacionAviso[]>(() => loadFromSession<OriginacionAviso[]>(sid, 'avisos') || loadFromSavedStore<OriginacionAviso[]>(sid, 'avisos') || []);
  useEffect(() => { if (!isRO) saveToSession(sid, 'avisos', items); }, [items, sid, isRO]);
  const add = () => { const n = new Date(); setItems(p => [...p, { id: generateId(), tipo: '', mensaje: '', fechaCreacion: `${n.getDate().toString().padStart(2,'0')}/${(n.getMonth()+1).toString().padStart(2,'0')}/${n.getFullYear()}`, fechaVencimiento: '', destinatario: '', estatus: 'Activo' }]); };
  return (<>
    <div className="flex items-center justify-between mb-3"><div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-3 py-1.5"><span className="text-xs text-gray-800">AVISOS</span></div>{!isRO && <button onClick={add} className="px-4 py-1.5 bg-[#0099CC] text-white rounded text-xs hover:bg-[#0088BB]">Nuevo</button>}</div>
    <div className="border border-gray-300 bg-white overflow-x-auto"><table className="w-full border-collapse min-w-[800px]"><thead><tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300"><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Tipo</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Mensaje</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Fecha Creación</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Destinatario</th><th className="px-2 py-2 text-xs text-gray-700 text-left">Estatus</th></tr></thead><tbody>
      {items.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-xs text-gray-400">Sin avisos</td></tr>
      : items.map(a => <tr key={a.id} className="border-b border-gray-200 hover:bg-gray-50"><td className="px-2 py-1.5 border-r border-gray-200"><select value={a.tipo} onChange={e => setItems(p => p.map(x => x.id === a.id ? {...x, tipo: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`}><option value="">Seleccione...</option>{CAT_TIPO_AVISO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></td><td className="px-2 py-1.5 border-r border-gray-200"><input type="text" value={a.mensaje} onChange={e => setItems(p => p.map(x => x.id === a.id ? {...x, mensaje: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`} /></td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{a.fechaCreacion}</td><td className="px-2 py-1.5 border-r border-gray-200"><input type="text" value={a.destinatario} onChange={e => setItems(p => p.map(x => x.id === a.id ? {...x, destinatario: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`} /></td><td className="px-2 py-1.5"><select value={a.estatus} onChange={e => setItems(p => p.map(x => x.id === a.id ? {...x, estatus: e.target.value} : x))} disabled={isRO} className={`w-full px-1 py-0.5 text-xs border border-gray-300 rounded ${isRO ? 'bg-gray-100' : 'bg-white'}`}>{CAT_ESTATUS_AVISO.map(s => <option key={s} value={s}>{s}</option>)}</select></td></tr>)}
    </tbody></table></div>
  </>);
}
