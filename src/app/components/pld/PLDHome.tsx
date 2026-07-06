import { useState, useEffect } from 'react';
import { PLDDashboard } from './PLDDashboard';
import { PLDKYCInfo } from './PLDKYCInfo';
import { PLDPerfilTransaccional } from './PLDPerfilTransaccional';
import { PLDCalificacionRiesgo } from './PLDCalificacionRiesgo';
import { PLDAlertasPLD } from './PLDAlertasPLD';
import { PLDAlertasInternas } from './PLDAlertasInternas';
import { PLDParametros } from './PLDParametros';
import { PLDCatalogos } from './PLDCatalogos';
import { PLDReportesCNBV } from './PLDReportesCNBV';
import { usePLDClientes } from './usePLDClientes';
import * as store from './pldStore';

interface PLDHomeProps { onNavigate: (screen: string) => void; }
type TabId = 'inicio' | 'kyc' | 'perfil' | 'riesgo' | 'alertas' | 'internas' | 'parametros' | 'catalogos' | 'reportes';

const SEED_FAKE_NOMBRES = [
  'Juan Carlos García López', 'Comercializadora Del Norte SA de CV',
  'María Elena Rodríguez Sánchez', 'Roberto Sánchez Cruz', 'Ana Patricia Mendoza Flores',
];

(() => {
  try {
    if (store.getKYCClientes().some(k => SEED_FAKE_NOMBRES.includes(k.clienteNombre || ''))) sessionStorage.removeItem('pld_kyc_clientes');
    if (store.getCalificaciones().some(c => SEED_FAKE_NOMBRES.includes(c.nombreCliente))) sessionStorage.removeItem('pld_calificaciones');
    if (store.getPerfiles().some(p => SEED_FAKE_NOMBRES.includes(p.clienteNombre || ''))) sessionStorage.removeItem('pld_perfiles');
    if (store.getAlertas().some(a => SEED_FAKE_NOMBRES.includes(a.cliente))) sessionStorage.removeItem('pld_alertas');
    if (store.getAlertasInternas().some(a => SEED_FAKE_NOMBRES.includes(a.cliente))) sessionStorage.removeItem('pld_alertas_internas');
    if (store.getReportes().some(r => SEED_FAKE_NOMBRES.includes(r.cliente))) sessionStorage.removeItem('pld_reportes');
  } catch { /* silencioso */ }
})();

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'inicio',     label: 'Dashboard',           icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z' },
  { id: 'kyc',        label: 'KYC',                 icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z' },
  { id: 'perfil',     label: 'Perfil Transaccional', icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7' },
  { id: 'riesgo',     label: 'Calificación Riesgo',  icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
  { id: 'alertas',    label: 'Alertas PLD',          icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  { id: 'internas',   label: 'Alertas Internas',     icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  { id: 'parametros', label: 'Parámetros',           icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
  { id: 'catalogos',  label: 'Catálogos',            icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
  { id: 'reportes',   label: 'Reportes CNBV',        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
];

export function PLDHome({ onNavigate }: PLDHomeProps) {
  const [tabActivo, setTabActivo] = useState<TabId>('inicio');
  const [hidratado, setHidratado] = useState(false);
  const { clientes } = usePLDClientes();

  useEffect(() => {
    if (clientes.length === 0) return;

    const kycActual = store.getKYCClientes();
    if (kycActual.some(k => SEED_FAKE_NOMBRES.includes(k.clienteNombre || '')) || kycActual.length === 0) {
      store.saveKYCClientes(clientes.slice(0, 20).map(c =>
        store.createEmptyKYC(c.id, c.nombre, c.rfc, c.curp, c.personalidad, c.sucursal || 'Matriz')
      ));
    }
    if (store.getCalificaciones().some(c => SEED_FAKE_NOMBRES.includes(c.nombreCliente))) store.saveCalificaciones([]);
    if (store.getPerfiles().some(p => SEED_FAKE_NOMBRES.includes(p.clienteNombre || ''))) store.savePerfiles([]);

    const alertas = store.getAlertas();
    if (alertas.some(a => SEED_FAKE_NOMBRES.includes(a.cliente)) && clientes.length >= 4) {
      const desc = ['Depósito en efectivo excede perfil transaccional','Transferencia internacional no habitual','Retiros frecuentes en efectivo','Operación relevante detectada por sistema','Cambio en patrón transaccional','Depósito recurrente en efectivo','Operaciones con países de alto riesgo','Compra de divisas fuera de perfil'];
      const montos = ['$125,000.00','$85,400.00','$45,200.00','$210,000.00','$32,100.00','$95,600.00','$178,000.00','$67,300.00'];
      store.saveAlertas(alertas.map((a, idx) => ({ ...a, cliente: clientes[idx % clientes.length].nombre, descripcion: desc[idx] || a.descripcion, monto: montos[idx] || a.monto })));
    }
    const internas = store.getAlertasInternas();
    if (internas.some(a => SEED_FAKE_NOMBRES.includes(a.cliente)) && clientes.length >= 3)
      store.saveAlertasInternas(internas.map((a, idx) => ({ ...a, cliente: clientes[idx % clientes.length].nombre })));
    const reportes = store.getReportes();
    if (reportes.some(r => SEED_FAKE_NOMBRES.includes(r.cliente)) && clientes.length >= 3)
      store.saveReportes(reportes.map((r, idx) => ({ ...r, cliente: clientes[idx % clientes.length].nombre })));

    setHidratado(true);
  }, [clientes]);

  const alertasActivas = store.getAlertas().filter(a => a.estatus !== 'Atendida').length;
  const reportesPendientes = store.getReportes().filter(r => r.estatus === 'Pendiente').length;

  const BADGES: Partial<Record<TabId, number>> = {
    alertas: alertasActivas,
    reportes: reportesPendientes,
  };

  const renderContent = () => {
    switch (tabActivo) {
      case 'inicio':     return <PLDDashboard />;
      case 'kyc':        return <PLDKYCInfo onBack={() => setTabActivo('inicio')} />;
      case 'perfil':     return <PLDPerfilTransaccional onBack={() => setTabActivo('inicio')} />;
      case 'riesgo':     return <PLDCalificacionRiesgo onBack={() => setTabActivo('inicio')} />;
      case 'alertas':    return <PLDAlertasPLD onBack={() => setTabActivo('inicio')} />;
      case 'internas':   return <PLDAlertasInternas onBack={() => setTabActivo('inicio')} />;
      case 'parametros': return <PLDParametros onBack={() => setTabActivo('inicio')} />;
      case 'catalogos':  return <PLDCatalogos onBack={() => setTabActivo('inicio')} />;
      case 'reportes':   return <PLDReportesCNBV onBack={() => setTabActivo('inicio')} />;
      default:           return <PLDDashboard />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F0F2F5]">
      {/* Header del módulo */}
      <div className="bg-[#1E3A5F] px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
          </div>
          <span className="text-white text-xs font-bold tracking-wide">MÓDULO PLD</span>
          <span className="text-white/40 text-[10px] mx-1">|</span>
          <span className="text-white/60 text-[10px]">Prevención de Lavado de Dinero</span>
        </div>
        {alertasActivas > 0 && (
          <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-400/30 rounded px-2 py-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-red-300 text-[10px] font-medium">{alertasActivas} alerta{alertasActivas !== 1 ? 's' : ''} activa{alertasActivas !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Navegación de tabs */}
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center overflow-x-auto">
          {TABS.map(tab => {
            const isActive = tabActivo === tab.id;
            const badge = BADGES[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => setTabActivo(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2.5 text-[11px] whitespace-nowrap transition-all border-b-2 ${
                  isActive
                    ? 'border-[#1E3A5F] text-[#1E3A5F] bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
                style={{ fontWeight: isActive ? 600 : 400 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {tab.icon.split(' M').map((seg, i) => <path key={i} d={i === 0 ? seg : 'M' + seg} />)}
                </svg>
                {tab.label}
                {badge != null && badge > 0 && (
                  <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto" key={hidratado ? 'h' : 'l'}>
        {renderContent()}
      </div>
    </div>
  );
}
