import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DatePicker } from '@/app/components/ui/DatePicker';
import { ExpedientesCreditoSection } from './ExpedientesCreditoSection';
import {
  CreditoFormData, CreditoListItem, CreditoAutorizacion, CreditoGarantia,
  CreditoCargo, CreditoAviso, CreditoSolicitudExtra, AmortizacionRow,
  EMPTY_FORM, MOCK_CREDITOS,
  saveToSession, loadFromSession, loadFromSavedStore, saveToSavedStore,
  clearSession, commitAndClearSession, migrateSavedStore, generateId,
  formatCurrency, parseCurrency, getNextCreditoId, consumeCreditoId,
  CAT_CLIENTES, CAT_SUCURSAL, CAT_EMPRESA_FONDEADORA, CAT_SUBLINEA, CAT_PRODUCTO,
  CAT_PERIODO, CAT_PLAZOS, CAT_ESTATUS_PAGO, CAT_ESTATUS_CARTERA, CAT_ESTATUS_CREDITO,
  CAT_MONEDA, CAT_ESTATUS_AUTORIZACION,
  CAT_TIPO_GARANTIA, CAT_TIPO_CARGO, CAT_ESTATUS_CARGO,
  CAT_TIPO_AVISO, CAT_ESTATUS_AVISO,
  CAT_TIPO_SOL_EXTRA, CAT_ESTATUS_SOL_EXTRA,
  CLIENT_DETAIL_MAP,
} from './creditoStore';

type ViewState = { type: 'dashboard' } | { type: 'list' } | { type: 'form'; mode: 'nuevo' | 'editar' | 'ver'; id?: number };

function parseDate(d: string): Date { const [day, month, year] = d.split('/'); const y = parseInt(year); return new Date(y < 100 ? 2000 + y : y, parseInt(month) - 1, parseInt(day)); }
const fmtCur = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ═══════════════════════════════════════════════════════════════════
// MAIN MODULE
// ═══════════════════════════════════════════════════════════════════
export function CreditosModule() {
  const [view, setView] = useState<ViewState>({ type: 'dashboard' });
  const [items, setItems] = useState<CreditoListItem[]>([...MOCK_CREDITOS]);

  const goToDashboard = () => setView({ type: 'dashboard' });
  const goToList = () => setView({ type: 'list' });
  const handleNuevo = () => { clearSession('new'); setView({ type: 'form', mode: 'nuevo' }); };
  const handleEditar = (i: CreditoListItem) => { clearSession(i.id); setView({ type: 'form', mode: 'editar', id: i.id }); };
  const handleVer = (i: CreditoListItem) => { setView({ type: 'form', mode: 'ver', id: i.id }); };

  const handleSave = (data: CreditoFormData) => {
    const ms = parseFloat(parseCurrency(data.montoSolicitado || '0')) || 0;
    const ma = parseFloat(parseCurrency(data.montoAutorizado || '0')) || 0;
    const fmtDt = (d: string) => { if (!d) return ''; const p = d.split('/'); if (p.length !== 3) return d; return p[2].length <= 2 ? d : `${p[0]}/${p[1]}/${p[2].slice(-2)}`; };
    if (view.type === 'form' && view.mode === 'nuevo') {
      const newId = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
      migrateSavedStore('new', newId);
      saveToSavedStore(newId, 'form', { ...data });
      setItems(prev => [{ id: newId, noCredito: data.noCredito, noCliente: data.noCliente || data.cliente.split(' - ')[0] || '', cliente: data.cliente, fechaCredito: fmtDt(data.fechaCredito), montoSolicitado: ms, montoAutorizado: ma, lineaProducto: data.lineaProducto, sublinea: data.sublinea, producto: data.producto, sucursal: data.sucursal, estatusCredito: data.estatusCredito, fechaInicio: fmtDt(data.fechaInicio), fechaFin: fmtDt(data.fechaFin) }, ...prev]);
    } else if (view.type === 'form' && view.mode === 'editar' && view.id) {
      saveToSavedStore(view.id, 'form', { ...data });
      setItems(prev => prev.map(i => i.id === view.id ? { ...i, cliente: data.cliente || i.cliente, fechaCredito: fmtDt(data.fechaCredito) || i.fechaCredito, montoSolicitado: ms || i.montoSolicitado, montoAutorizado: ma || i.montoAutorizado, sublinea: data.sublinea || i.sublinea, producto: data.producto || i.producto, sucursal: data.sucursal || i.sucursal, estatusCredito: data.estatusCredito || i.estatusCredito, fechaInicio: fmtDt(data.fechaInicio) || i.fechaInicio, fechaFin: fmtDt(data.fechaFin) || i.fechaFin } : i));
    }
    goToList();
  };

  if (view.type === 'form') return (<>
    <div className="bg-gray-100 border-b border-gray-300"><div className="px-6 py-3 flex items-center gap-4">
      <button onClick={goToDashboard} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-inactive"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/><path d="M6 14v-5h4v5"/></svg><span>Inicio</span></button>
      <button onClick={goToList} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-inactive"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3h10M3 8h10M3 13h10"/></svg><span>Lista de Créditos</span></button>
    </div></div>
    <CreditoFormView mode={view.mode} creditoId={view.id} onCancel={goToList} onSave={handleSave} />
  </>);

  // ── DASHBOARD ──
  if (view.type === 'dashboard') {
    return (<>
      <div className="bg-gray-100 border-b border-gray-300"><div className="px-6 py-3 flex items-center gap-4">
        <button onClick={goToDashboard} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-active"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/><path d="M6 14v-5h4v5"/></svg><span>Inicio</span></button>
        <button onClick={goToList} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-inactive"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3h10M3 8h10M3 13h10"/></svg><span>Lista de Créditos</span></button>
      </div></div>
      <CreditosDashboardView items={items} onGoToList={goToList} onNuevo={handleNuevo} />
    </>);
  }

  // ── LIST ──
  return (<>
    <div className="bg-gray-100 border-b border-gray-300"><div className="px-6 py-3 flex items-center gap-4">
      <button onClick={goToDashboard} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-inactive"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/><path d="M6 14v-5h4v5"/></svg><span>Inicio</span></button>
      <button onClick={goToList} className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors tab-active"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3h10M3 8h10M3 13h10"/></svg><span>Lista de Créditos</span></button>
    </div></div>
    <CreditoListView items={items} onNuevo={handleNuevo} onEditar={handleEditar} onVer={handleVer} />
  </>);
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function CreditosDashboardView({ items, onGoToList, onNuevo }: { items: CreditoListItem[]; onGoToList: () => void; onNuevo: () => void }) {
  const total = items.length;
  const montoTotalAutorizado = items.reduce((s, i) => s + i.montoAutorizado, 0);
  const autorizados = items.filter(i => i.estatusCredito === 'Autorizado').length;
  const pendientes = items.filter(i => i.estatusCredito === 'Pendiente').length;
  const enRevision = items.filter(i => i.estatusCredito === 'En revisión').length;
  const recientes = [...items].sort((a, b) => parseDate(b.fechaCredito).getTime() - parseDate(a.fechaCredito).getTime()).slice(0, 8);
  const distribucionEstatus = [
    { tipo: 'Autorizado', cantidad: autorizados, color: '#10B981' },
    { tipo: 'Pendiente', cantidad: pendientes, color: '#F59E0B' },
    { tipo: 'En revisión', cantidad: enRevision, color: '#3B82F6' },
  ];
  const nuevosPorMes = [{ mes: 'Ago', creditos: 10 }, { mes: 'Sep', creditos: 15 }, { mes: 'Oct', creditos: 12 }, { mes: 'Nov', creditos: 18 }, { mes: 'Dic', creditos: 16 }, { mes: 'Ene', creditos: total }];
  const porSucursal = [
    { sucursal: 'CDMX', creditos: items.filter(i => i.sucursal === 'CDMX').length },
    { sucursal: 'Monterrey', creditos: items.filter(i => i.sucursal === 'Monterrey').length },
    { sucursal: 'Guadalajara', creditos: items.filter(i => i.sucursal === 'Guadalajara').length },
    { sucursal: 'Querétaro', creditos: items.filter(i => i.sucursal === 'Querétaro').length },
    { sucursal: 'Otras', creditos: items.filter(i => !['CDMX','Monterrey','Guadalajara','Querétaro'].includes(i.sucursal)).length },
  ].filter(x => x.creditos > 0);
  const estatusCreditos = [
    { estatus: 'Autorizados', cantidad: autorizados, color: '#10B981' },
    { estatus: 'Pendientes', cantidad: pendientes, color: '#F59E0B' },
    { estatus: 'En revisión', cantidad: enRevision, color: '#3B82F6' },
  ];
  const crec = nuevosPorMes.length >= 2 && nuevosPorMes[nuevosPorMes.length-2].creditos > 0
    ? ((nuevosPorMes[nuevosPorMes.length-1].creditos - nuevosPorMes[nuevosPorMes.length-2].creditos) / nuevosPorMes[nuevosPorMes.length-2].creditos * 100).toFixed(1) : '0.0';
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-300 rounded p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-gray-600 mb-1">Total de Créditos</p><p className="text-2xl text-gray-900">{total}</p></div><div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E5C91" strokeWidth="2"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 9h20"/><path d="M7 3v4M17 3v4"/></svg></div></div><div className="mt-2 flex items-center gap-1 text-xs"><span className="text-green-600">+{crec}%</span><span className="text-gray-600">vs. mes anterior</span></div></div>
        <div className="bg-white border border-gray-300 rounded p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-gray-600 mb-1">Monto Total Autorizado</p><p className="text-2xl text-gray-900">{fmtCur(montoTotalAutorizado)}</p></div><div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="stroke-primary-theme" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg></div></div><div className="mt-2 text-xs text-gray-600">Suma de montos autorizados</div></div>
        <div className="bg-white border border-gray-300 rounded p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-gray-600 mb-1">Créditos Autorizados</p><p className="text-2xl text-gray-900">{autorizados}</p></div><div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div></div><div className="mt-2 text-xs text-gray-600">{total > 0 ? ((autorizados/total)*100).toFixed(1) : '0.0'}% del total</div></div>
        <div className="bg-white border border-gray-300 rounded p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-gray-600 mb-1">Créditos Pendientes</p><p className="text-2xl text-gray-900">{pendientes}</p></div><div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg></div></div><div className="mt-2 text-xs text-gray-600">{total > 0 ? ((pendientes/total)*100).toFixed(1) : '0.0'}% del total</div></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3"><h2 className="text-base text-gray-900">Registros Recientes</h2><p className="text-xs text-gray-600 mt-0.5">Últimos créditos registrados en el sistema</p></div>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-gray-50 border-b border-gray-300"><tr><th className="text-left px-3 py-2 text-gray-700">No. Crédito</th><th className="text-left px-3 py-2 text-gray-700">Cliente</th><th className="text-left px-3 py-2 text-gray-700">Fecha</th><th className="text-left px-3 py-2 text-gray-700">Monto</th></tr></thead><tbody>
            {recientes.map((item, idx) => (<tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}><td className="px-3 py-2 text-gray-900">{item.noCredito}</td><td className="px-3 py-2 text-gray-900">{item.cliente}</td><td className="px-3 py-2 text-gray-700">{item.fechaCredito}</td><td className="px-3 py-2 text-gray-700">{fmtCur(item.montoAutorizado)}</td></tr>))}
          </tbody></table></div>
        </div>
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3"><h2 className="text-base text-gray-900">Distribución por Estatus</h2><p className="text-xs text-gray-600 mt-0.5">Clasificación de créditos por estado</p></div>
          <div className="p-4 flex items-center justify-center"><div className="w-full">
            <ResponsiveContainer width="100%" height={240}><PieChart id="creditos-pie-estatus"><Pie data={distribucionEstatus} nameKey="tipo" cx="50%" cy="50%" labelLine={false} label={({ tipo, cantidad }: any) => `${tipo}: ${cantidad}`} outerRadius={80} dataKey="cantidad">{distribucionEstatus.map((e, i) => <Cell key={i} fill={e.color} />)}</Pie><Tooltip contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }} /></PieChart></ResponsiveContainer>
            <div className="mt-4 flex justify-center gap-6">{distribucionEstatus.map(d => <div key={d.tipo} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} /><span className="text-xs text-gray-700">{d.tipo}</span></div>)}</div>
          </div></div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 rounded"><div className="bg-white border-b border-gray-300 px-4 py-3"><h2 className="text-base text-gray-900">Nuevos Créditos por Mes</h2><p className="text-xs text-gray-600 mt-0.5">Evolución de otorgamiento de créditos</p></div><div className="p-4"><ResponsiveContainer width="100%" height={240}><BarChart id="creditos-bar-mes" data={nuevosPorMes}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#6B7280" /><YAxis tick={{ fontSize: 11 }} stroke="#6B7280" /><Tooltip contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }} /><Bar dataKey="creditos" fill="#2E5C91" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className="bg-white border border-gray-300 rounded"><div className="bg-white border-b border-gray-300 px-4 py-3"><h2 className="text-base text-gray-900">Créditos por Sucursal</h2><p className="text-xs text-gray-600 mt-0.5">Distribución de cartera por ubicación</p></div><div className="p-4"><ResponsiveContainer width="100%" height={240}><BarChart id="creditos-bar-sucursal" data={porSucursal} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis type="number" tick={{ fontSize: 11 }} stroke="#6B7280" /><YAxis dataKey="sucursal" type="category" tick={{ fontSize: 11 }} stroke="#6B7280" width={100} /><Tooltip contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }} /><Bar dataKey="creditos" fill="var(--theme-primary)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div></div>
        <div className="bg-white border border-gray-300 rounded"><div className="bg-white border-b border-gray-300 px-4 py-3"><h2 className="text-base text-gray-900">Estatus de Créditos</h2><p className="text-xs text-gray-600 mt-0.5">Clasificación por estado de operación</p></div><div className="p-4"><div className="space-y-4">{estatusCreditos.map(item => (<div key={item.estatus} className="space-y-1"><div className="flex justify-between text-xs"><span className="text-gray-700">{item.estatus}</span><span className="text-gray-900">{item.cantidad} créditos ({total > 0 ? ((item.cantidad/total)*100).toFixed(0) : 0}%)</span></div><div className="w-full bg-gray-200 rounded-full h-2.5"><div className="h-2.5 rounded-full transition-all" style={{ width: `${total > 0 ? (item.cantidad/total)*100 : 0}%`, backgroundColor: item.color }} /></div></div>))}</div></div></div>
        <div className="bg-white border border-gray-300 rounded"><div className="bg-white border-b border-gray-300 px-4 py-3"><h2 className="text-base text-gray-900">Tendencia de Crecimiento</h2><p className="text-xs text-gray-600 mt-0.5">Proyección de otorgamiento de créditos</p></div><div className="p-4"><ResponsiveContainer width="100%" height={240}><LineChart id="creditos-line-tendencia" data={nuevosPorMes}><CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" /><XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#6B7280" /><YAxis tick={{ fontSize: 11 }} stroke="#6B7280" /><Tooltip contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }} /><Line type="monotone" dataKey="creditos" stroke="#2E5C91" strokeWidth={2} dot={{ fill: '#2E5C91', r: 4 }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div></div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LIST
// ═══════════════════════════════════════════════════════════════════
function CreditoListView({ items, onNuevo, onEditar, onVer }: { items: CreditoListItem[]; onNuevo: () => void; onEditar: (i: CreditoListItem) => void; onVer: (i: CreditoListItem) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const tableRef = useRef<HTMLDivElement>(null);
  const searchBarRef = useRef<HTMLInputElement>(null);

  const filtered = items.filter(i => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return i.noCredito.toLowerCase().includes(s) || i.cliente.toLowerCase().includes(s) || i.sucursal.toLowerCase().includes(s) || i.estatusCredito.toLowerCase().includes(s);
  }).sort((a, b) => { const da = parseDate(a.fechaCredito).getTime(); const db = parseDate(b.fechaCredito).getTime(); return sortOrder === 'desc' ? db - da : da - db; });
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="bg-white min-h-screen">
      {/* Header con ícono y título */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><path d="M2 9h20"/><path d="M7 3v4M17 3v4"/></svg>
            <h2 className="text-lg text-gray-800">Crédito</h2>
            <button className="p-1 ml-2"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2"><circle cx="8" cy="8" r="6"/><path d="M13 13l3 3"/></svg></button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span onClick={() => tableRef.current?.scrollIntoView({ behavior: 'smooth' })} className="cursor-pointer hover:text-[#0099CC] transition-colors">Lista</span>
            <span onClick={() => searchBarRef.current?.focus()} className="cursor-pointer hover:text-[#0099CC] transition-colors">Buscar</span>
          </div>
        </div>
      </div>
      {/* Filter Section */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative"><select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[200px]"><option>Vista general de Créditos</option></select><svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z"/></svg></div>
          <button onClick={onNuevo} className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB]">Nuevo</button>
        </div>
      </div>
      {/* Filtros */}
      <div className="px-4 py-2 bg-[#F0F0F0] border-b border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700">Filtros</span>
          <input ref={searchBarRef} type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} placeholder="Buscar créditos..." className="px-3 py-1 border border-gray-400 rounded text-sm w-64 transition-all" />
        </div>
      </div>
      {/* Action Icons Bar */}
      <div className="px-4 py-2.5 bg-[#F0F0F0] border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-200 rounded transition-colors hover:scale-110 transform" title="Exportar a CSV" onClick={() => toast.success('Exportando a CSV', { description: 'El archivo CSV se está descargando...', duration: 3000 })}><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280"/><text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text></svg></button>
            <button className="p-1.5 hover:bg-green-100 rounded transition-colors hover:scale-110 transform" title="Exportar a Excel" onClick={() => toast.success('Exportando a Excel', { description: 'El archivo se está descargando...', duration: 3000 })}><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B"/><path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2"/></svg></button>
            <button className="p-1.5 hover:bg-red-100 rounded transition-colors hover:scale-110 transform" title="Exportar a PDF" onClick={() => toast.success('Exportando a PDF', { description: 'El archivo PDF se está descargando...', duration: 3000 })}><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F"/><path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none"/><path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2"/></svg></button>
            <button className="p-1.5 hover:bg-blue-100 rounded transition-colors hover:scale-110 transform" title="Imprimir" onClick={() => toast.success('Imprimiendo', { description: 'Enviando documento a la impresora...', duration: 3000 })}><svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="3" width="10" height="3" rx="0.5" fill="#1976D2"/><rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none"/><rect x="5" y="11" width="10" height="6" rx="0.5" fill="#1976D2"/><circle cx="5" cy="8" r="0.8" fill="#1976D2"/></svg></button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>Orden Rápido</span>
              <div className="relative"><select value={sortOrder} onChange={e => { setSortOrder(e.target.value as any); setCurrentPage(1); }} className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none"><option value="desc">Descendente</option><option value="asc">Ascendente</option></select><svg className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 10 10" fill="#666"><path d="M5 7l-3-3h6z"/></svg></div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-0.5 text-[#0099CC] hover:text-[#0088BB] disabled:opacity-40" title="Anterior" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3L5 8l5 5V3z"/></svg></button>
              <button className="p-0.5 text-[#0099CC] hover:text-[#0088BB] disabled:opacity-40" title="Siguiente" onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))} disabled={currentPage >= totalPages}><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg></button>
            </div>
            <span>Total: {items.length}</span>
          </div>
        </div>
      </div>
      {/* Table */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-hidden" style={{ backgroundColor: 'transparent' }}>
          <table className="w-full text-sm" style={{ backgroundColor: 'transparent' }}>
            <thead><tr className="bg-[#D0D0D0] border-b border-gray-300">
              <th className="px-3 py-2.5 text-left text-xs text-gray-700 whitespace-nowrap">Editar | Ver</th>
              <th className="px-3 py-2.5 text-left text-xs text-gray-700">NO. DE CRÉDITO</th>
              <th className="px-3 py-2.5 text-left text-xs text-gray-700">CLIENTE</th>
              <th className="px-3 py-2.5 text-left text-xs text-gray-700">FECHA DE CRÉDITO</th>
              <th className="px-3 py-2.5 text-left text-xs text-gray-700">MONTO SOLICITADO</th>
              <th className="px-3 py-2.5 text-left text-xs text-gray-700">MONTO AUTORIZADO</th>
              <th className="px-3 py-2.5 text-left text-xs text-gray-700">LÍNEA PRODUCTO</th>
              <th className="px-3 py-2.5 text-left text-xs text-gray-700">SUBLÍNEA</th>
              <th className="px-3 py-2.5 text-left text-xs text-gray-700">PRODUCTO</th>
              <th className="px-3 py-2.5 text-left text-xs text-gray-700">SUCURSAL</th>
              <th className="px-3 py-2.5 text-left text-xs text-gray-700">ESTATUS CRÉDITO</th>
              <th className="px-3 py-2.5 text-left text-xs text-gray-700">FECHA DE INICIO</th>
              <th className="px-3 py-2.5 text-left text-xs text-gray-700">FECHA FIN</th>
            </tr></thead>
            <tbody>
              {paginated.length === 0 ? <tr><td colSpan={13} className="px-3 py-8 text-center text-gray-500">No se encontraron créditos</td></tr>
              : paginated.map((item, idx) => (
                <tr key={item.id} className="border-b border-gray-200 transition-colors duration-150" style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E8F4F8'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'; }}>
                  <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); onEditar(item); }}>Editar</a>
                    <span className="text-gray-700"> | </span>
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); onVer(item); }}>Ver</a>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{item.noCredito}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{item.cliente}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{item.fechaCredito}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{fmtCur(item.montoSolicitado)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{fmtCur(item.montoAutorizado)}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{item.lineaProducto}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{item.sublinea}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{item.producto}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{item.sucursal}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{item.estatusCredito}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{item.fechaInicio}</td>
                  <td className="px-3 py-2.5 text-xs text-gray-700">{item.fechaFin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Pagination */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Primera página" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M13 4L4 9l9 5V4z"/></svg></button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Página anterior" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 4L4 9l5 5V4z"/></svg></button>
          <div className="text-sm text-gray-700 min-w-[100px] text-center">Página {currentPage} de {totalPages || 1}</div>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Página siguiente" onClick={() => setCurrentPage(p => Math.min(totalPages || 1, p + 1))} disabled={currentPage >= totalPages}><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 4l5 5-5 5V4z"/></svg></button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed" title="Última página" onClick={() => setCurrentPage(totalPages || 1)} disabled={currentPage >= totalPages}><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M4 4L13 9l-9 5V4z"/></svg></button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FORM (con 10 subtabs inline)
// ═══════════════════════════════════════════════════════════════════
function FormField({ label, req, error, children }: { label: string; req?: boolean; error?: string; children: React.ReactNode }) {
  return (<div className="flex items-center gap-2"><label className={`text-xs w-32 flex-shrink-0 ${error ? 'text-red-600' : 'text-gray-700'}`}>{label}{req && <span className="text-red-600 ml-0.5">*</span>}</label>{children}</div>);
}

function CreditoFormView({ mode, creditoId, onCancel, onSave }: { mode: 'nuevo' | 'editar' | 'ver'; creditoId?: number; onCancel: () => void; onSave: (d: CreditoFormData) => void }) {
  const sid: number | 'new' = mode === 'nuevo' ? 'new' : (creditoId || 1);
  const isRO = mode === 'ver';
  const getInit = useCallback((): CreditoFormData => { const s = loadFromSession<CreditoFormData>(sid, 'form'); if (s) return s; if (mode === 'nuevo') return { ...EMPTY_FORM, noCredito: getNextCreditoId() }; const saved = loadFromSavedStore<CreditoFormData>(sid, 'form'); if (saved) return saved; return { ...EMPTY_FORM }; }, [mode, sid]);
  const [fd, setFd] = useState<CreditoFormData>(getInit);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeSec, setActiveSec] = useState('default');
  useEffect(() => { if (!isRO) saveToSession(sid, 'form', fd); }, [fd, sid, isRO]);
  const set = (f: keyof CreditoFormData, v: string) => { if (isRO) return; setFd(p => ({ ...p, [f]: v })); if (errors[f]) setErrors(p => { const n = { ...p }; delete n[f]; return n; }); };
  const curBlur = (f: keyof CreditoFormData) => { const n = parseFloat(parseCurrency(fd[f])); if (!isNaN(n) && n >= 0) set(f, n.toFixed(2)); };
  const pctBlur = (f: keyof CreditoFormData) => { const n = parseFloat((fd[f] || '').replace(/[^0-9.-]/g, '')); if (!isNaN(n)) set(f, Math.min(100, Math.max(0, n)).toFixed(4)); };
  const validate = () => { const e: Record<string, string> = {}; if (!fd.cliente) e.cliente = 'Obligatorio'; if (!fd.fechaCredito) e.fechaCredito = 'Obligatorio'; if (!fd.sucursal) e.sucursal = 'Obligatorio'; if (!fd.montoSolicitado || parseFloat(parseCurrency(fd.montoSolicitado)) <= 0) e.montoSolicitado = 'Monto > 0'; if (!fd.sublinea) e.sublinea = 'Obligatorio'; if (!fd.producto) e.producto = 'Obligatorio'; if (!fd.periodo) e.periodo = 'Obligatorio'; if (!fd.plazos) e.plazos = 'Obligatorio'; setErrors(e); if (Object.keys(e).length > 0) { toast.error('Campos obligatorios incompletos', { description: `${Object.keys(e).length} campo(s)`, duration: 4000 }); return false; } return true; };
  const handleSave = () => { if (!validate()) return; const d = { ...fd }; if (mode === 'nuevo') d.noCredito = consumeCreditoId(); saveToSavedStore(sid, 'form', d); commitAndClearSession(sid); saveToSavedStore(sid, 'form', d); toast.success('Crédito guardado', { description: `N° ${d.noCredito} — ${d.cliente}`, duration: 3000 }); onSave(d); };
  const handleCancel = () => { clearSession(sid); onCancel(); };
  const ic = (err = false, dis = false) => `flex-1 px-2 py-1 text-xs border rounded focus:outline-none ${err ? 'border-red-400' : 'border-gray-300'} ${dis || isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-primary-theme'}`;
  const sc = (err = false) => `flex-1 px-2 py-1 text-xs border rounded focus:outline-none ${err ? 'border-red-400' : 'border-gray-300'} ${isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-primary-theme'}`;
  const Field = FormField;
  const sections = [{ id: 'default', label: 'Default' }, { id: 'montos', label: 'Montos/Plazos' }, { id: 'tasas', label: 'Tasas' }, { id: 'amortizaciones', label: 'Amortizaciones' }, { id: 'expedientes', label: 'Expedientes Electrónicos' }, { id: 'autorizacion', label: 'Autorización' }, { id: 'garantias', label: 'Garantías' }, { id: 'cargos', label: 'Cargos' }, { id: 'avisos', label: 'Avisos' }, { id: 'solicitudes', label: 'Sol. Extraordinarias' }];

  return (
    <div className="bg-white min-h-screen">
      <div className="bg-white px-4 py-3 border-b border-gray-300"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><h2 className="text-lg text-gray-800">{mode === 'nuevo' ? 'Alta Crédito' : mode === 'editar' ? 'Editar Crédito' : 'Ver Crédito'}</h2><button className="p-1 ml-2"><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2"><circle cx="8" cy="8" r="6"/><path d="M13 13l3 3"/></svg></button></div></div></div>
      <div className="px-4 py-2.5 bg-white border-b border-gray-300"><div className="flex items-center gap-2">{!isRO && <button onClick={handleSave} className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB]">Guardar</button>}<button onClick={handleCancel} className="px-5 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700">{isRO ? 'Volver' : 'Cancelar'}</button></div></div>

      <div className="px-4 py-4 bg-[#F5F5F5]">
        <div className="bg-white border border-gray-300 p-4">
          <div className="mb-4">
            <div className="bg-primary-tint-theme px-3 py-2 mb-3 text-sm text-gray-800 border-l-4 border-primary-theme">Información Principal</div>
            <div className="grid grid-cols-3 gap-x-4">
              <div className="space-y-1">
                <Field label="N° CRÉDITO" req><input type="text" value={fd.noCredito} disabled className={ic(false, true)} /></Field>
                <Field label="CLIENTE" req error={errors.cliente}>{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.cliente}</div> : <select value={fd.noCliente} onChange={e => { const v = e.target.value; const cl = CAT_CLIENTES.find(c => c.value === v); set('noCliente', v); set('cliente', cl?.label || ''); const cd = CLIENT_DETAIL_MAP[v]; if (cd) { set('estatusSIC', cd.estatusSIC); set('estatusListaNegra', cd.estatusListaNegra); set('estatusCliente', cd.estatusCliente); set('direccionPrincipal', cd.direccionPrincipal); } else { set('estatusSIC', ''); set('estatusListaNegra', ''); set('estatusCliente', ''); set('direccionPrincipal', ''); } }} className={sc(!!errors.cliente)}><option value="">Seleccionar...</option>{CAT_CLIENTES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>}</Field>
                <Field label="EMPRESA FONDEADORA">{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.empresaFondeadora}</div> : <select value={fd.empresaFondeadora} onChange={e => set('empresaFondeadora', e.target.value)} className={sc()}><option value="">Seleccionar...</option>{CAT_EMPRESA_FONDEADORA.map(ef => <option key={ef} value={ef}>{ef}</option>)}</select>}</Field>
                <Field label="LÍNEA PRODUCTO" req><input type="text" value={fd.lineaProducto || 'Crédito'} disabled className={ic(false, true)} /></Field>
                <Field label="SUBLÍNEA" req error={errors.sublinea}>{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.sublinea}</div> : <select value={fd.sublinea} onChange={e => set('sublinea', e.target.value)} className={sc(!!errors.sublinea)}><option value="">Seleccionar...</option>{CAT_SUBLINEA.map(s => <option key={s} value={s}>{s}</option>)}</select>}</Field>
                <Field label="PRODUCTO" req error={errors.producto}>{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.producto}</div> : <select value={fd.producto} onChange={e => set('producto', e.target.value)} className={sc(!!errors.producto)}><option value="">Seleccionar...</option>{CAT_PRODUCTO.map(p => <option key={p} value={p}>{p}</option>)}</select>}</Field>
              </div>
              <div className="space-y-1">
                <Field label="FECHA DE CRÉDITO" req error={errors.fechaCredito}>{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.fechaCredito}</div> : <DatePicker value={fd.fechaCredito} onChange={v => set('fechaCredito', v)} placeholder="dd/mm/aaaa" className={errors.fechaCredito ? 'border-red-400' : ''} />}</Field>
                <Field label="SUCURSAL" req error={errors.sucursal}>{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.sucursal}</div> : <select value={fd.sucursal} onChange={e => set('sucursal', e.target.value)} className={sc(!!errors.sucursal)}><option value="">Seleccionar...</option>{CAT_SUCURSAL.map(s => <option key={s} value={s}>{s}</option>)}</select>}</Field>
                <Field label="PERIODO" req error={errors.periodo}>{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.periodo}</div> : <select value={fd.periodo} onChange={e => set('periodo', e.target.value)} className={sc(!!errors.periodo)}><option value="">Seleccionar...</option>{CAT_PERIODO.map(p => <option key={p} value={p}>{p}</option>)}</select>}</Field>
                <Field label="PLAZOS" req error={errors.plazos}>{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.plazos}</div> : <select value={fd.plazos} onChange={e => set('plazos', e.target.value)} className={sc(!!errors.plazos)}><option value="">Seleccionar...</option>{CAT_PLAZOS.map(p => <option key={p} value={p}>{p}</option>)}</select>}</Field>
                <Field label="FECHA INICIO" req>{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.fechaInicio}</div> : <DatePicker value={fd.fechaInicio} onChange={v => set('fechaInicio', v)} placeholder="dd/mm/aaaa" />}</Field>
                <Field label="FECHA FIN" req>{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.fechaFin}</div> : <DatePicker value={fd.fechaFin} onChange={v => set('fechaFin', v)} placeholder="dd/mm/aaaa" />}</Field>
              </div>
              <div className="space-y-1">
                <Field label="MONTO SOLICITADO" req error={errors.montoSolicitado}>{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.montoSolicitado}</div> : <input type="text" value={fd.montoSolicitado} onChange={e => set('montoSolicitado', e.target.value.replace(/[^0-9.,-]/g, ''))} onBlur={() => curBlur('montoSolicitado')} className={ic(!!errors.montoSolicitado)} />}</Field>
                <Field label="MONTO AUTORIZADO">{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.montoAutorizado}</div> : <input type="text" value={fd.montoAutorizado} onChange={e => set('montoAutorizado', e.target.value.replace(/[^0-9.,-]/g, ''))} onBlur={() => curBlur('montoAutorizado')} className={ic()} />}</Field>
                <Field label="ESTATUS CRÉDITO">{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.estatusCredito}</div> : <select value={fd.estatusCredito} onChange={e => set('estatusCredito', e.target.value)} className={sc()}>{CAT_ESTATUS_CREDITO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select>}</Field>
                <Field label="ESTATUS DE PAGO">{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.estatusPago}</div> : <select value={fd.estatusPago} onChange={e => set('estatusPago', e.target.value)} className={sc()}>{CAT_ESTATUS_PAGO.map(s => <option key={s} value={s}>{s}</option>)}</select>}</Field>
                <Field label="ESTATUS CARTERA">{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.estatusCartera}</div> : <select value={fd.estatusCartera} onChange={e => set('estatusCartera', e.target.value)} className={sc()}>{CAT_ESTATUS_CARTERA.map(s => <option key={s} value={s}>{s}</option>)}</select>}</Field>
                <Field label="DESTINO CRÉDITO">{isRO ? <div className="flex-1 px-2 py-1 text-xs text-gray-700">{fd.destinoCredito}</div> : <textarea value={fd.destinoCredito} onChange={e => set('destinoCredito', e.target.value)} className={`${ic()} resize-none`} rows={2} />}</Field>
              </div>
            </div>
          </div>

          <div className="flex items-stretch bg-primary-theme overflow-hidden">
            {sections.map(sec => (<button key={sec.id} onClick={() => setActiveSec(sec.id)} className={`px-4 py-2 text-xs transition-colors whitespace-nowrap border-r border-white/20 last:border-r-0 ${activeSec === sec.id ? 'bg-[var(--theme-primary-hover)] text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}>{sec.label}</button>))}
          </div>
          <div className="border border-gray-300 border-t-0 px-4 py-4 bg-gray-50 mb-4">
            {activeSec === 'default' && <DefaultSection fd={fd} set={set} isRO={isRO} />}
            {activeSec === 'montos' && <MontosSection fd={fd} set={set} isRO={isRO} />}
            {activeSec === 'tasas' && <TasasSection fd={fd} set={set} isRO={isRO} pctBlur={pctBlur} />}
            {activeSec === 'amortizaciones' && <AmortizacionesSection sid={sid} mode={mode} isRO={isRO} fd={fd} />}
            {activeSec === 'expedientes' && <ExpedientesCreditoSection sid={sid} mode={mode} isRO={isRO} />}
            {activeSec === 'autorizacion' && <AutorizacionSection sid={sid} mode={mode} isRO={isRO} />}
            {activeSec === 'garantias' && <GarantiasSection sid={sid} mode={mode} isRO={isRO} />}
            {activeSec === 'cargos' && <CargosSection sid={sid} mode={mode} isRO={isRO} />}
            {activeSec === 'avisos' && <AvisosSection sid={sid} mode={mode} isRO={isRO} />}
            {activeSec === 'solicitudes' && <SolicitudesExtraSection sid={sid} mode={mode} isRO={isRO} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DEFAULT SECTION ──
function DefaultSection({ fd, set, isRO }: any) {
  const ic = (_e = false, dis = false) => `flex-1 px-2 py-1 text-xs border rounded focus:outline-none border-gray-300 ${dis || isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-primary-theme'}`;
  const sc = () => `flex-1 px-2 py-1 text-xs border rounded focus:outline-none border-gray-300 ${isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-primary-theme'}`;
  const roField = `flex-1 px-2 py-1 text-xs border rounded border-gray-300 bg-gray-100 text-gray-600`;
  const sicColor = fd.estatusSIC === 'Positivo' ? 'text-green-700' : fd.estatusSIC === 'Negativo' ? 'text-red-600' : 'text-yellow-600';
  const lnColor = fd.estatusListaNegra === 'Negativo' ? 'text-green-700' : fd.estatusListaNegra === 'Positivo' ? 'text-red-600' : 'text-gray-600';
  const ecColor = fd.estatusCliente === 'Activo' ? 'text-green-700' : fd.estatusCliente === 'Inactivo' ? 'text-red-600' : 'text-yellow-600';
  return (
    <div>
      <div className="bg-primary-tint-theme px-3 py-2 mb-3 text-sm text-gray-800 border-l-4 border-primary-theme">DEFAULT — Datos del Cliente</div>
      {!fd.noCliente && <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-2 mb-3 text-xs text-yellow-700">Seleccione un cliente en la sección de Información Principal para cargar automáticamente los datos.</div>}
      <div className="grid grid-cols-3 gap-x-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2"><label className="text-xs w-32 flex-shrink-0 text-gray-700">ESTATUS SIC</label><input type="text" value={fd.estatusSIC} readOnly className={`${roField} ${sicColor}`} /></div>
          <div className="flex items-center gap-2"><label className="text-xs w-32 flex-shrink-0 text-gray-700">ESTATUS LISTA NEGRA</label><input type="text" value={fd.estatusListaNegra} readOnly className={`${roField} ${lnColor}`} /></div>
          <div className="flex items-center gap-2"><label className="text-xs w-32 flex-shrink-0 text-gray-700">TASA AUTORIZADA (%)</label><input type="text" value={fd.tasaAutorizada} onChange={(e: any) => set('tasaAutorizada', e.target.value.replace(/[^0-9.]/g, ''))} disabled={isRO} className={ic()} /></div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2"><label className="text-xs w-32 flex-shrink-0 text-gray-700">ESTATUS DEL CLIENTE</label><input type="text" value={fd.estatusCliente} readOnly className={`${roField} ${ecColor}`} /></div>
          <div className="flex items-center gap-2"><label className="text-xs w-32 flex-shrink-0 text-gray-700">MONEDA</label><select value={fd.moneda} onChange={(e: any) => set('moneda', e.target.value)} disabled={isRO} className={sc()}>{CAT_MONEDA.map((m: string) => <option key={m} value={m}>{m}</option>)}</select></div>
          <div className="flex items-center gap-2"><label className="text-xs w-32 flex-shrink-0 text-gray-700">PLAZO AUTORIZADO</label><input type="text" value={fd.plazoAutorizado} onChange={(e: any) => set('plazoAutorizado', e.target.value.replace(/[^0-9]/g, ''))} disabled={isRO} className={ic()} /></div>
        </div>
        <div className="space-y-1">
          <div className="flex items-start gap-2"><label className="text-xs w-32 flex-shrink-0 text-gray-700 pt-1">DIRECCIÓN</label><textarea value={fd.direccionPrincipal} readOnly className={`${roField} resize-none`} rows={3} /></div>
        </div>
      </div>
    </div>
  );
}

// ── MONTOS SECTION ──
function MontosSection({ fd, set, isRO }: any) {
  const ic = () => `flex-1 px-2 py-1 text-xs border rounded focus:outline-none border-gray-300 ${isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-primary-theme'}`;
  return (
    <div>
      <div className="bg-primary-tint-theme px-3 py-2 mb-3 text-sm text-gray-800 border-l-4 border-primary-theme">MONTOS / PLAZOS</div>
      <div className="grid grid-cols-2 gap-x-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2"><label className="text-xs w-32 flex-shrink-0 text-gray-700">PLAZO MÍNIMO</label><input type="text" value={fd.plazoMinimo} onChange={(e: any) => set('plazoMinimo', e.target.value.replace(/[^0-9]/g, ''))} disabled={isRO} className={ic()} /></div>
          <div className="flex items-center gap-2"><label className="text-xs w-32 flex-shrink-0 text-gray-700">MONTO MÍNIMO</label><input type="text" value={fd.montoMinimo} onChange={(e: any) => set('montoMinimo', e.target.value.replace(/[^0-9.,-]/g, ''))} disabled={isRO} className={ic()} /></div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2"><label className="text-xs w-32 flex-shrink-0 text-gray-700">PLAZO MÁXIMO</label><input type="text" value={fd.plazoMaximo} onChange={(e: any) => set('plazoMaximo', e.target.value.replace(/[^0-9]/g, ''))} disabled={isRO} className={ic()} /></div>
          <div className="flex items-center gap-2"><label className="text-xs w-32 flex-shrink-0 text-gray-700">MONTO MÁXIMO</label><input type="text" value={fd.montoMaximo} onChange={(e: any) => set('montoMaximo', e.target.value.replace(/[^0-9.,-]/g, ''))} disabled={isRO} className={ic()} /></div>
        </div>
      </div>
    </div>
  );
}

// ── TASAS SECTION ──
function TasasSection({ fd, set, isRO, pctBlur }: any) {
  const ic = () => `flex-1 px-2 py-1 text-xs border rounded focus:outline-none border-gray-300 ${isRO ? 'bg-gray-100 text-gray-600' : 'bg-white focus:ring-2 focus:ring-primary-theme'}`;
  return (
    <div>
      <div className="bg-primary-tint-theme px-3 py-2 mb-3 text-sm text-gray-800 border-l-4 border-primary-theme">TASAS</div>
      <div className="grid grid-cols-3 gap-x-4">
        <div className="flex items-center gap-2"><label className="text-xs w-32 flex-shrink-0 text-gray-700">TASA MÍNIMA (%)</label><input type="text" value={fd.tasaMinima} onChange={(e: any) => set('tasaMinima', e.target.value.replace(/[^0-9.]/g, ''))} onBlur={() => pctBlur('tasaMinima')} disabled={isRO} className={ic()} /></div>
        <div className="flex items-center gap-2"><label className="text-xs w-32 flex-shrink-0 text-gray-700">TASA MÁXIMA (%)</label><input type="text" value={fd.tasaMaxima} onChange={(e: any) => set('tasaMaxima', e.target.value.replace(/[^0-9.]/g, ''))} onBlur={() => pctBlur('tasaMaxima')} disabled={isRO} className={ic()} /></div>
        <div className="flex items-center gap-2"><label className="text-xs w-32 flex-shrink-0 text-gray-700">TASA AUTORIZADA (%)</label><input type="text" value={fd.tasaAutorizadaTasas} onChange={(e: any) => set('tasaAutorizadaTasas', e.target.value.replace(/[^0-9.]/g, ''))} onBlur={() => pctBlur('tasaAutorizadaTasas')} disabled={isRO} className={ic()} /></div>
      </div>
    </div>
  );
}

// ── AMORTIZACIONES SECTION ──
function AmortizacionesSection({ sid, mode, isRO, fd }: { sid: number | 'new'; mode: string; isRO: boolean; fd: CreditoFormData }) {
  const [rows, setRows] = useState<AmortizacionRow[]>(() => loadFromSession<AmortizacionRow[]>(sid, 'amortizaciones') || (mode !== 'nuevo' ? loadFromSavedStore<AmortizacionRow[]>(sid, 'amortizaciones') : null) || []);
  useEffect(() => { if (!isRO) saveToSession(sid, 'amortizaciones', rows); }, [rows, sid, isRO]);

  const generate = () => {
    const monto = parseFloat(parseCurrency(fd.montoAutorizado || fd.montoSolicitado || '0')) || 0;
    const tasa = parseFloat((fd.tasaAutorizada || fd.tasaAutorizadaTasas || '0').replace(/[^0-9.]/g, '')) || 0;
    const plazo = parseInt(fd.plazoAutorizado || '12') || 12;
    if (monto <= 0) { toast.error('Ingrese un monto autorizado para generar amortizaciones'); return; }
    const tasaMensual = tasa / 100 / 12;
    const pago = tasaMensual > 0 ? monto * (tasaMensual * Math.pow(1 + tasaMensual, plazo)) / (Math.pow(1 + tasaMensual, plazo) - 1) : monto / plazo;
    const newRows: AmortizacionRow[] = [];
    let saldo = monto;
    const hoy = new Date();
    for (let i = 1; i <= plazo; i++) {
      const interes = saldo * tasaMensual;
      const capital = pago - interes;
      const ivaInteres = interes * 0.16;
      saldo = Math.max(0, saldo - capital);
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + i, hoy.getDate());
      newRows.push({ noPago: i, fechaPago: `${fecha.getDate().toString().padStart(2, '0')}/${(fecha.getMonth() + 1).toString().padStart(2, '0')}/${fecha.getFullYear()}`, capital: +capital.toFixed(2), interes: +interes.toFixed(2), ivaInteres: +ivaInteres.toFixed(2), pagoTotal: +(pago + ivaInteres).toFixed(2), saldoInsoluto: +saldo.toFixed(2) });
    }
    setRows(newRows);
    toast.success('Tabla de amortización generada');
  };

  return (<>
    <div className="flex items-center justify-between mb-3"><div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-1.5"><span className="text-xs text-gray-800">TABLA DE AMORTIZACIÓN</span></div>{!isRO && <button onClick={generate} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">Generar</button>}</div>
    <div className="border border-gray-300 bg-white overflow-x-auto"><table className="w-full border-collapse min-w-[800px]"><thead><tr className="bg-[#4AC5CC]/20 border-b-2 border-[#4AC5CC]"><th className="px-2 py-2 text-xs text-gray-700 text-center border-r border-gray-300 w-[50px]">No</th><th className="px-3 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Fecha Pago</th><th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Capital</th><th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Interés</th><th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">IVA Interés</th><th className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Pago Total</th><th className="px-3 py-2 text-xs text-gray-700 text-right">Saldo Insoluto</th></tr></thead><tbody>
      {rows.length === 0 ? <tr><td colSpan={7} className="px-3 py-6 text-center text-xs text-gray-400">Presione &quot;Generar&quot; para crear la tabla de amortización</td></tr>
      : rows.map(r => <tr key={r.noPago} className="border-b border-gray-200 hover:bg-gray-50"><td className="px-2 py-1.5 text-xs text-center text-gray-600 border-r border-gray-200">{r.noPago}</td><td className="px-3 py-1.5 text-xs border-r border-gray-200">{r.fechaPago}</td><td className="px-3 py-1.5 text-xs text-right border-r border-gray-200">{fmtCur(r.capital)}</td><td className="px-3 py-1.5 text-xs text-right border-r border-gray-200">{fmtCur(r.interes)}</td><td className="px-3 py-1.5 text-xs text-right border-r border-gray-200">{fmtCur(r.ivaInteres)}</td><td className="px-3 py-1.5 text-xs text-right border-r border-gray-200">{fmtCur(r.pagoTotal)}</td><td className="px-3 py-1.5 text-xs text-right">{fmtCur(r.saldoInsoluto)}</td></tr>)}
    </tbody></table></div>
  </>);
}

// ── AUTORIZACION SECTION ──
function AutorizacionSection({ sid, mode, isRO }: { sid: number | 'new'; mode: string; isRO: boolean }) {
  const [items, setItems] = useState<CreditoAutorizacion[]>(() => loadFromSession<CreditoAutorizacion[]>(sid, 'autorizaciones') || (mode !== 'nuevo' ? loadFromSavedStore<CreditoAutorizacion[]>(sid, 'autorizaciones') : null) || []);
  useEffect(() => { if (!isRO) saveToSession(sid, 'autorizaciones', items); }, [items, sid, isRO]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const emptyDraft = (): CreditoAutorizacion => { const n = new Date(); return { id: generateId(), fechaHora: `${n.getDate().toString().padStart(2,'0')}/${(n.getMonth()+1).toString().padStart(2,'0')}/${n.getFullYear()} ${n.getHours().toString().padStart(2,'0')}:${n.getMinutes().toString().padStart(2,'0')}`, usuario: '', area: '', descripcion: '', observaciones: '', estatus: 'Pendiente' }; };
  const [draft, setDraft] = useState<CreditoAutorizacion>(emptyDraft);
  const openNew = () => { setDraft(emptyDraft()); setEditId(null); setShowModal(true); };
  const openEdit = (a: CreditoAutorizacion) => { setDraft({ ...a }); setEditId(a.id); setShowModal(true); };
  const saveDraft = () => { if (editId) { setItems(p => p.map(x => x.id === editId ? { ...draft } : x)); } else { setItems(p => [...p, { ...draft }]); } setShowModal(false); toast.success(editId ? 'Autorización actualizada' : 'Autorización agregada'); };
  const mIc = `w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary-theme`;
  return (<>
    <div className="flex items-center justify-between mb-3"><div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-1.5"><span className="text-xs text-gray-800">AUTORIZACIONES</span></div>{!isRO && <button onClick={openNew} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">Autorizar</button>}</div>
    <div className="border border-gray-300 bg-white overflow-x-auto"><table className="w-full border-collapse min-w-[900px]"><thead><tr className="bg-gray-100 border-b border-gray-300"><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Fecha</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Usuario</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Área</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Descripción</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Observaciones</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Estatus</th>{!isRO && <th className="px-2 py-2 text-xs text-gray-700 text-center w-16">Acción</th>}</tr></thead><tbody>
      {items.length === 0 ? <tr><td colSpan={isRO ? 6 : 7} className="px-3 py-6 text-center text-xs text-gray-400">Sin autorizaciones</td></tr>
      : items.map(a => <tr key={a.id} className="border-b border-gray-200 hover:bg-gray-50"><td className="px-2 py-1.5 text-xs border-r border-gray-200">{a.fechaHora}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{a.usuario}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{a.area}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{a.descripcion}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{a.observaciones}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{a.estatus}</td>{!isRO && <td className="px-2 py-1.5 text-center"><a href="#" className="text-[#0066CC] hover:underline text-xs" onClick={e => { e.preventDefault(); openEdit(a); }}>Editar</a></td>}</tr>)}
    </tbody></table></div>
    {showModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <div className="bg-primary-theme px-6 py-4 flex items-center justify-between"><h3 className="text-base text-white">{editId ? 'Editar Autorización' : 'Nueva Autorización'}</h3><button onClick={() => setShowModal(false)} className="text-white hover:text-gray-200"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/></svg></button></div>
          <div className="p-6 overflow-y-auto flex-1 space-y-3">
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Fecha/Hora</label><input type="text" value={draft.fechaHora} disabled className={`${mIc} !bg-gray-100 text-gray-600`} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Usuario</label><input type="text" value={draft.usuario} onChange={e => setDraft(p => ({ ...p, usuario: e.target.value }))} className={mIc} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Área</label><input type="text" value={draft.area} onChange={e => setDraft(p => ({ ...p, area: e.target.value }))} className={mIc} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Descripción</label><input type="text" value={draft.descripcion} onChange={e => setDraft(p => ({ ...p, descripcion: e.target.value }))} className={mIc} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Observaciones</label><input type="text" value={draft.observaciones} onChange={e => setDraft(p => ({ ...p, observaciones: e.target.value }))} className={mIc} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Estatus</label><select value={draft.estatus} onChange={e => setDraft(p => ({ ...p, estatus: e.target.value }))} className={mIc}>{CAT_ESTATUS_AUTORIZACION.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2"><button onClick={() => setShowModal(false)} className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600">Cancelar</button><button onClick={saveDraft} className="px-5 py-2 text-sm btn-primary-theme rounded hover:bg-primary-hover-theme">Guardar</button></div>
        </div>
      </div>
    )}
  </>);
}

// ── GARANTIAS SECTION ──
function GarantiasSection({ sid, mode, isRO }: { sid: number | 'new'; mode: string; isRO: boolean }) {
  const [items, setItems] = useState<CreditoGarantia[]>(() => loadFromSession<CreditoGarantia[]>(sid, 'garantias') || (mode !== 'nuevo' ? loadFromSavedStore<CreditoGarantia[]>(sid, 'garantias') : null) || []);
  useEffect(() => { if (!isRO) saveToSession(sid, 'garantias', items); }, [items, sid, isRO]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const emptyDraft = (): CreditoGarantia => ({ id: generateId(), tipo: '', subtipo: '', descripcion: '', valorNominal: 0, ubicacion: '', estatus: 'Vigente' });
  const [draft, setDraft] = useState<CreditoGarantia>(emptyDraft);
  const openNew = () => { setDraft(emptyDraft()); setEditId(null); setShowModal(true); };
  const openEdit = (g: CreditoGarantia) => { setDraft({ ...g }); setEditId(g.id); setShowModal(true); };
  const saveDraft = () => { if (editId) { setItems(p => p.map(x => x.id === editId ? { ...draft } : x)); } else { setItems(p => [...p, { ...draft }]); } setShowModal(false); toast.success(editId ? 'Garantía actualizada' : 'Garantía agregada'); };
  const mIc = `w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary-theme`;
  return (<>
    <div className="flex items-center justify-between mb-3"><div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-1.5"><span className="text-xs text-gray-800">GARANTÍAS</span></div>{!isRO && <button onClick={openNew} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">Nuevo</button>}</div>
    <div className="border border-gray-300 bg-white overflow-x-auto"><table className="w-full border-collapse min-w-[800px]"><thead><tr className="bg-gray-100 border-b border-gray-300"><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Tipo</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Subtipo</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Descripción</th><th className="px-2 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Valor Nominal</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Ubicación</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Estatus</th>{!isRO && <th className="px-2 py-2 text-xs text-gray-700 text-center w-16">Acción</th>}</tr></thead><tbody>
      {items.length === 0 ? <tr><td colSpan={isRO ? 6 : 7} className="px-3 py-6 text-center text-xs text-gray-400">Sin garantías</td></tr>
      : items.map(g => <tr key={g.id} className="border-b border-gray-200 hover:bg-gray-50"><td className="px-2 py-1.5 text-xs border-r border-gray-200">{CAT_TIPO_GARANTIA.find(t => t.value === g.tipo)?.label || g.tipo}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{g.subtipo}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{g.descripcion}</td><td className="px-2 py-1.5 text-xs text-right border-r border-gray-200">{fmtCur(g.valorNominal)}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{g.ubicacion}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{g.estatus}</td>{!isRO && <td className="px-2 py-1.5 text-center"><a href="#" className="text-[#0066CC] hover:underline text-xs" onClick={e => { e.preventDefault(); openEdit(g); }}>Editar</a></td>}</tr>)}
    </tbody></table></div>
    {showModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <div className="bg-primary-theme px-6 py-4 flex items-center justify-between"><h3 className="text-base text-white">{editId ? 'Editar Garantía' : 'Nueva Garantía'}</h3><button onClick={() => setShowModal(false)} className="text-white hover:text-gray-200"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/></svg></button></div>
          <div className="p-6 overflow-y-auto flex-1 space-y-3">
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Tipo</label><select value={draft.tipo} onChange={e => setDraft(p => ({ ...p, tipo: e.target.value }))} className={mIc}><option value="">Seleccione...</option>{CAT_TIPO_GARANTIA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Subtipo</label><input type="text" value={draft.subtipo} onChange={e => setDraft(p => ({ ...p, subtipo: e.target.value }))} className={mIc} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Descripción</label><input type="text" value={draft.descripcion} onChange={e => setDraft(p => ({ ...p, descripcion: e.target.value }))} className={mIc} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Valor Nominal</label><input type="text" value={draft.valorNominal || ''} onChange={e => { const v = e.target.value.replace(/[^0-9.,-]/g, ''); setDraft(p => ({ ...p, valorNominal: v as any })); }} onBlur={() => { const n = parseFloat(String(draft.valorNominal).replace(/[^0-9.-]/g, '')) || 0; setDraft(p => ({ ...p, valorNominal: n })); }} className={mIc} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Ubicación</label><input type="text" value={draft.ubicacion} onChange={e => setDraft(p => ({ ...p, ubicacion: e.target.value }))} className={mIc} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Estatus</label><select value={draft.estatus} onChange={e => setDraft(p => ({ ...p, estatus: e.target.value }))} className={mIc}><option>Vigente</option><option>En trámite</option><option>Cancelada</option></select></div>
          </div>
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2"><button onClick={() => setShowModal(false)} className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600">Cancelar</button><button onClick={saveDraft} className="px-5 py-2 text-sm btn-primary-theme rounded hover:bg-primary-hover-theme">Guardar</button></div>
        </div>
      </div>
    )}
  </>);
}

// ── CARGOS SECTION ──
function CargosSection({ sid, mode, isRO }: { sid: number | 'new'; mode: string; isRO: boolean }) {
  const [items, setItems] = useState<CreditoCargo[]>(() => loadFromSession<CreditoCargo[]>(sid, 'cargos') || (mode !== 'nuevo' ? loadFromSavedStore<CreditoCargo[]>(sid, 'cargos') : null) || []);
  useEffect(() => { if (!isRO) saveToSession(sid, 'cargos', items); }, [items, sid, isRO]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const emptyDraft = (): CreditoCargo => ({ id: generateId(), tipoCargo: '', descripcion: '', monto: 0, fechaCargo: '', estatus: 'Pendiente', notas: '' });
  const [draft, setDraft] = useState<CreditoCargo>(emptyDraft);
  const openNew = () => { setDraft(emptyDraft()); setEditId(null); setShowModal(true); };
  const openEdit = (c: CreditoCargo) => { setDraft({ ...c }); setEditId(c.id); setShowModal(true); };
  const saveDraft = () => { if (editId) { setItems(p => p.map(x => x.id === editId ? { ...draft } : x)); } else { setItems(p => [...p, { ...draft }]); } setShowModal(false); toast.success(editId ? 'Cargo actualizado' : 'Cargo agregado'); };
  const mIc = `w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary-theme`;
  return (<>
    <div className="flex items-center justify-between mb-3"><div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-1.5"><span className="text-xs text-gray-800">CARGOS</span></div>{!isRO && <button onClick={openNew} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">Nuevo</button>}</div>
    <div className="border border-gray-300 bg-white overflow-x-auto"><table className="w-full border-collapse min-w-[800px]"><thead><tr className="bg-gray-100 border-b border-gray-300"><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Tipo Cargo</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Descripción</th><th className="px-2 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Monto</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Estatus</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Notas</th>{!isRO && <th className="px-2 py-2 text-xs text-gray-700 text-center w-16">Acción</th>}</tr></thead><tbody>
      {items.length === 0 ? <tr><td colSpan={isRO ? 5 : 6} className="px-3 py-6 text-center text-xs text-gray-400">Sin cargos</td></tr>
      : items.map(c => <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50"><td className="px-2 py-1.5 text-xs border-r border-gray-200">{CAT_TIPO_CARGO.find(t => t.value === c.tipoCargo)?.label || c.tipoCargo}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{c.descripcion}</td><td className="px-2 py-1.5 text-xs text-right border-r border-gray-200">{fmtCur(c.monto)}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{c.estatus}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{c.notas}</td>{!isRO && <td className="px-2 py-1.5 text-center"><a href="#" className="text-[#0066CC] hover:underline text-xs" onClick={e => { e.preventDefault(); openEdit(c); }}>Editar</a></td>}</tr>)}
    </tbody></table></div>
    {showModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <div className="bg-primary-theme px-6 py-4 flex items-center justify-between"><h3 className="text-base text-white">{editId ? 'Editar Cargo' : 'Nuevo Cargo'}</h3><button onClick={() => setShowModal(false)} className="text-white hover:text-gray-200"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/></svg></button></div>
          <div className="p-6 overflow-y-auto flex-1 space-y-3">
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Tipo Cargo</label><select value={draft.tipoCargo} onChange={e => setDraft(p => ({ ...p, tipoCargo: e.target.value }))} className={mIc}><option value="">Seleccione...</option>{CAT_TIPO_CARGO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Descripción</label><input type="text" value={draft.descripcion} onChange={e => setDraft(p => ({ ...p, descripcion: e.target.value }))} className={mIc} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Monto</label><input type="text" value={draft.monto || ''} onChange={e => { const v = e.target.value.replace(/[^0-9.,-]/g, ''); setDraft(p => ({ ...p, monto: v as any })); }} onBlur={() => { const n = parseFloat(String(draft.monto).replace(/[^0-9.-]/g, '')) || 0; setDraft(p => ({ ...p, monto: n })); }} className={mIc} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Estatus</label><select value={draft.estatus} onChange={e => setDraft(p => ({ ...p, estatus: e.target.value }))} className={mIc}>{CAT_ESTATUS_CARGO.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Notas</label><input type="text" value={draft.notas} onChange={e => setDraft(p => ({ ...p, notas: e.target.value }))} className={mIc} /></div>
          </div>
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2"><button onClick={() => setShowModal(false)} className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600">Cancelar</button><button onClick={saveDraft} className="px-5 py-2 text-sm btn-primary-theme rounded hover:bg-primary-hover-theme">Guardar</button></div>
        </div>
      </div>
    )}
  </>);
}

// ── AVISOS SECTION ──
function AvisosSection({ sid, mode, isRO }: { sid: number | 'new'; mode: string; isRO: boolean }) {
  const [items, setItems] = useState<CreditoAviso[]>(() => loadFromSession<CreditoAviso[]>(sid, 'avisos') || (mode !== 'nuevo' ? loadFromSavedStore<CreditoAviso[]>(sid, 'avisos') : null) || []);
  useEffect(() => { if (!isRO) saveToSession(sid, 'avisos', items); }, [items, sid, isRO]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const emptyDraft = (): CreditoAviso => { const n = new Date(); return { id: generateId(), tipo: '', mensaje: '', fechaCreacion: `${n.getDate().toString().padStart(2,'0')}/${(n.getMonth()+1).toString().padStart(2,'0')}/${n.getFullYear()}`, fechaVencimiento: '', destinatario: '', estatus: 'Activo' }; };
  const [draft, setDraft] = useState<CreditoAviso>(emptyDraft);
  const openNew = () => { setDraft(emptyDraft()); setEditId(null); setShowModal(true); };
  const openEdit = (a: CreditoAviso) => { setDraft({ ...a }); setEditId(a.id); setShowModal(true); };
  const saveDraft = () => { if (editId) { setItems(p => p.map(x => x.id === editId ? { ...draft } : x)); } else { setItems(p => [...p, { ...draft }]); } setShowModal(false); toast.success(editId ? 'Aviso actualizado' : 'Aviso agregado'); };
  const mIc = `w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary-theme`;
  return (<>
    <div className="flex items-center justify-between mb-3"><div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-1.5"><span className="text-xs text-gray-800">AVISOS</span></div>{!isRO && <button onClick={openNew} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">Nuevo</button>}</div>
    <div className="border border-gray-300 bg-white overflow-x-auto"><table className="w-full border-collapse min-w-[800px]"><thead><tr className="bg-gray-100 border-b border-gray-300"><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Tipo</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Mensaje</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Fecha Creación</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Destinatario</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Estatus</th>{!isRO && <th className="px-2 py-2 text-xs text-gray-700 text-center w-16">Acción</th>}</tr></thead><tbody>
      {items.length === 0 ? <tr><td colSpan={isRO ? 5 : 6} className="px-3 py-6 text-center text-xs text-gray-400">Sin avisos</td></tr>
      : items.map(a => <tr key={a.id} className="border-b border-gray-200 hover:bg-gray-50"><td className="px-2 py-1.5 text-xs border-r border-gray-200">{CAT_TIPO_AVISO.find(t => t.value === a.tipo)?.label || a.tipo}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{a.mensaje}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{a.fechaCreacion}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{a.destinatario}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{a.estatus}</td>{!isRO && <td className="px-2 py-1.5 text-center"><a href="#" className="text-[#0066CC] hover:underline text-xs" onClick={e => { e.preventDefault(); openEdit(a); }}>Editar</a></td>}</tr>)}
    </tbody></table></div>
    {showModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <div className="bg-primary-theme px-6 py-4 flex items-center justify-between"><h3 className="text-base text-white">{editId ? 'Editar Aviso' : 'Nuevo Aviso'}</h3><button onClick={() => setShowModal(false)} className="text-white hover:text-gray-200"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/></svg></button></div>
          <div className="p-6 overflow-y-auto flex-1 space-y-3">
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Tipo</label><select value={draft.tipo} onChange={e => setDraft(p => ({ ...p, tipo: e.target.value }))} className={mIc}><option value="">Seleccione...</option>{CAT_TIPO_AVISO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Mensaje</label><input type="text" value={draft.mensaje} onChange={e => setDraft(p => ({ ...p, mensaje: e.target.value }))} className={mIc} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Fecha Creación</label><input type="text" value={draft.fechaCreacion} disabled className={`${mIc} !bg-gray-100 text-gray-600`} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Destinatario</label><input type="text" value={draft.destinatario} onChange={e => setDraft(p => ({ ...p, destinatario: e.target.value }))} className={mIc} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Estatus</label><select value={draft.estatus} onChange={e => setDraft(p => ({ ...p, estatus: e.target.value }))} className={mIc}>{CAT_ESTATUS_AVISO.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          </div>
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2"><button onClick={() => setShowModal(false)} className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600">Cancelar</button><button onClick={saveDraft} className="px-5 py-2 text-sm btn-primary-theme rounded hover:bg-primary-hover-theme">Guardar</button></div>
        </div>
      </div>
    )}
  </>);
}

// ── SOLICITUDES EXTRAORDINARIAS SECTION ──
function SolicitudesExtraSection({ sid, mode, isRO }: { sid: number | 'new'; mode: string; isRO: boolean }) {
  const [items, setItems] = useState<CreditoSolicitudExtra[]>(() => loadFromSession<CreditoSolicitudExtra[]>(sid, 'solicitudes_extra') || (mode !== 'nuevo' ? loadFromSavedStore<CreditoSolicitudExtra[]>(sid, 'solicitudes_extra') : null) || []);
  useEffect(() => { if (!isRO) saveToSession(sid, 'solicitudes_extra', items); }, [items, sid, isRO]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const emptyDraft = (): CreditoSolicitudExtra => { const n = new Date(); return { id: generateId(), tipo: '', descripcion: '', fechaSolicitud: `${n.getDate().toString().padStart(2,'0')}/${(n.getMonth()+1).toString().padStart(2,'0')}/${n.getFullYear()}`, solicitante: '', estatus: 'Pendiente', observaciones: '' }; };
  const [draft, setDraft] = useState<CreditoSolicitudExtra>(emptyDraft);
  const openNew = () => { setDraft(emptyDraft()); setEditId(null); setShowModal(true); };
  const openEdit = (s: CreditoSolicitudExtra) => { setDraft({ ...s }); setEditId(s.id); setShowModal(true); };
  const saveDraft = () => { if (editId) { setItems(p => p.map(x => x.id === editId ? { ...draft } : x)); } else { setItems(p => [...p, { ...draft }]); } setShowModal(false); toast.success(editId ? 'Solicitud actualizada' : 'Solicitud agregada'); };
  const mIc = `w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary-theme`;
  return (<>
    <div className="flex items-center justify-between mb-3"><div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-1.5"><span className="text-xs text-gray-800">SOLICITUDES EXTRAORDINARIAS</span></div>{!isRO && <button onClick={openNew} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">Nuevo</button>}</div>
    <div className="border border-gray-300 bg-white overflow-x-auto"><table className="w-full border-collapse min-w-[900px]"><thead><tr className="bg-gray-100 border-b border-gray-300"><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Tipo</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Descripción</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Fecha</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Solicitante</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Estatus</th><th className="px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300">Observaciones</th>{!isRO && <th className="px-2 py-2 text-xs text-gray-700 text-center w-16">Acción</th>}</tr></thead><tbody>
      {items.length === 0 ? <tr><td colSpan={isRO ? 6 : 7} className="px-3 py-6 text-center text-xs text-gray-400">Sin solicitudes extraordinarias</td></tr>
      : items.map(s => <tr key={s.id} className="border-b border-gray-200 hover:bg-gray-50"><td className="px-2 py-1.5 text-xs border-r border-gray-200">{CAT_TIPO_SOL_EXTRA.find(t => t.value === s.tipo)?.label || s.tipo}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{s.descripcion}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{s.fechaSolicitud}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{s.solicitante}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{s.estatus}</td><td className="px-2 py-1.5 text-xs border-r border-gray-200">{s.observaciones}</td>{!isRO && <td className="px-2 py-1.5 text-center"><a href="#" className="text-[#0066CC] hover:underline text-xs" onClick={e => { e.preventDefault(); openEdit(s); }}>Editar</a></td>}</tr>)}
    </tbody></table></div>
    {showModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <div className="bg-primary-theme px-6 py-4 flex items-center justify-between"><h3 className="text-base text-white">{editId ? 'Editar Solicitud Extraordinaria' : 'Nueva Solicitud Extraordinaria'}</h3><button onClick={() => setShowModal(false)} className="text-white hover:text-gray-200"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z"/></svg></button></div>
          <div className="p-6 overflow-y-auto flex-1 space-y-3">
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Tipo</label><select value={draft.tipo} onChange={e => setDraft(p => ({ ...p, tipo: e.target.value }))} className={mIc}><option value="">Seleccione...</option>{CAT_TIPO_SOL_EXTRA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Descripción</label><input type="text" value={draft.descripcion} onChange={e => setDraft(p => ({ ...p, descripcion: e.target.value }))} className={mIc} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Fecha</label><input type="text" value={draft.fechaSolicitud} disabled className={`${mIc} !bg-gray-100 text-gray-600`} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Solicitante</label><input type="text" value={draft.solicitante} onChange={e => setDraft(p => ({ ...p, solicitante: e.target.value }))} className={mIc} /></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Estatus</label><select value={draft.estatus} onChange={e => setDraft(p => ({ ...p, estatus: e.target.value }))} className={mIc}>{CAT_ESTATUS_SOL_EXTRA.map(es => <option key={es} value={es}>{es}</option>)}</select></div>
            <div className="flex items-center gap-2"><label className="text-xs w-28 flex-shrink-0 text-gray-700">Observaciones</label><input type="text" value={draft.observaciones} onChange={e => setDraft(p => ({ ...p, observaciones: e.target.value }))} className={mIc} /></div>
          </div>
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end gap-2"><button onClick={() => setShowModal(false)} className="px-5 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600">Cancelar</button><button onClick={saveDraft} className="px-5 py-2 text-sm btn-primary-theme rounded hover:bg-primary-hover-theme">Guardar</button></div>
        </div>
      </div>
    )}
  </>);
}
