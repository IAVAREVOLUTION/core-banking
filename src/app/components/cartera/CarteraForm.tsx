/**
 * CarteraForm.tsx — Gestión de Cartera / Módulo de Créditos
 * Header + Default + Amortizaciones + Avisos + Pagos + Sol. Ext. + Generación Contable
 */
import { useState, useEffect } from 'react';
import { DefaultTab } from './DefaultTab';
import { AmortizacionesTab } from './AmortizacionesTab';
import { AvisosVencimientoTab } from './AvisosVencimientoTab';
import { PagosTab } from './PagosTab';
import { SolicitudesExtTab } from './SolicitudesExtTab';
import { GeneracionContableTab } from './GeneracionContableTab';
import { fetchMontoAut } from '../../hooks/useCarteraDB';

export interface CarteraCredito {
  id: string;              // solicitud_id (J_CUENTAS_CORP_CLIENTES.id)
  noSol: string;
  cliente: string;
  clienteId?: string;
  productoNombre: string;
  lineaProducto: string;
  tipoProducto?: string;
  montoAut: number;
  montoSol: number;
  tasa?: string;
  plazo?: string;
  frecuencia?: string;
  estatus: string;
  noCuenta?: string;
  moneda?: string;
  usuario?: string;
  gobierno?: string;
  fechaSol?: string;
}

interface Props {
  credito: CarteraCredito;
  mode: 'ver' | 'editar';
  onBack: () => void;
}

const TABS = [
  { id: 'default',          label: 'Default' },
  { id: 'amortizaciones',   label: 'Amortizaciones' },
  { id: 'avisos',           label: 'Avisos de Vencimiento' },
  { id: 'movimientos',      label: 'Movimientos' },
  { id: 'solicitudes-ext',  label: 'Solicitudes Extraordinarias' },
  { id: 'contable',         label: 'Generación Contable' },
];

const ESTATUS_COLOR: Record<string, string> = {
  Pendiente:   'bg-amber-100 text-amber-800',
  Autorizada:  'bg-green-100 text-green-800',
  Activa:      'bg-green-100 text-green-800',
  Rechazada:   'bg-red-100 text-red-800',
  Cancelada:   'bg-gray-100 text-gray-600',
  Finiquitado: 'bg-blue-100 text-blue-800',
};

const fmtMoney = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

export function CarteraForm({ credito, mode, onBack }: Props) {
  const [activeTab, setActiveTab] = useState('default');
  const [montoActual, setMontoActual] = useState(credito.montoAut);
  const isRO = mode === 'ver';

  useEffect(() => {
    fetchMontoAut(credito.id).then(r => { if (r) setMontoActual(r.monto_aut); });
  }, [credito.id]);

  return (
    <div className="bg-white min-h-screen">

      {/* ── Header institucional ── */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-gray-400 hover:text-gray-700 p-1">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M11 4L6 9l5 5"/>
              </svg>
            </button>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#666" strokeWidth="1.5">
              <rect x="3" y="5" width="16" height="12" rx="2"/><path d="M3 9h16"/><path d="M7 5V3M15 5V3"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">
              {isRO ? `Ver Crédito — ${credito.noSol}` : `Editar Crédito — ${credito.noSol}`}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${ESTATUS_COLOR[credito.estatus] || 'bg-gray-100 text-gray-600'}`}>
              {credito.estatus}
            </span>
            {isRO && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500 border border-gray-200">
                <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="4.5" cy="3" r="2"/><path d="M1 8c0-1.9 1.6-3.5 3.5-3.5S8 6.1 8 8"/></svg>
                Solo lectura
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Datos clave del cliente y producto ── */}
      <div className="px-4 py-2.5 bg-[#F0F2F5] border-b border-gray-300">
        <div className="flex flex-wrap gap-x-8 gap-y-1.5">
          {[
            { label: 'Cliente',             value: credito.cliente },
            { label: 'Inst. Gobierno',      value: credito.gobierno || '—' },
            { label: 'Producto',            value: credito.productoNombre },
            { label: 'Línea',               value: credito.lineaProducto },
            { label: 'Monto Aut.',          value: fmtMoney(montoActual) },
            { label: 'Tasa',                value: credito.tasa ? `${credito.tasa}%` : '—' },
            { label: 'Plazo',               value: credito.plazo ? `${credito.plazo}m` : '—' },
            { label: 'No. Cuenta',          value: credito.noCuenta || '—' },
            { label: 'Moneda',              value: credito.moneda || 'MXN' },
          ].map(chip => (
            <div key={chip.label} className="flex flex-col">
              <span className="text-[9px] text-gray-400 uppercase tracking-wide">{chip.label}</span>
              <span className="text-xs text-gray-800 font-medium">{chip.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sub-tabs estilo institucional ── */}
      <div className="bg-primary-theme text-white border-b border-gray-400">
        <div className="px-4 flex items-center overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'bg-secondary-theme text-white font-medium' : 'text-white/90 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="px-4 py-4 bg-[#F5F5F5]">
        {activeTab === 'default' && (
          <DefaultTab credito={credito} />
        )}
        {activeTab === 'amortizaciones' && (
          <div className="bg-white border border-gray-300 p-4">
            <AmortizacionesTab solicitudId={credito.id} cliente={credito.cliente} noSol={credito.noSol} noCuenta={credito.noCuenta} moneda={credito.moneda} tipoProducto={credito.tipoProducto} />
          </div>
        )}
        {activeTab === 'avisos' && (
          <div className="bg-white border border-gray-300 p-4">
            <AvisosVencimientoTab solicitudId={credito.id} />
          </div>
        )}
        {activeTab === 'movimientos' && (
          <div className="bg-white border border-gray-300 p-4">
            <PagosTab solicitudId={credito.id} noSol={credito.noSol} montoAut={montoActual} />
          </div>
        )}
        {activeTab === 'solicitudes-ext' && (
          <div className="bg-white border border-gray-300 p-4">
            <SolicitudesExtTab solicitudId={credito.id} usuario={credito.usuario} />
          </div>
        )}
        {activeTab === 'contable' && (
          <div className="bg-white border border-gray-300 p-4">
            <GeneracionContableTab
              solicitudId={credito.id}
              credito={{ noSol: credito.noSol, cliente: credito.cliente, montoAut: credito.montoAut, tasa: credito.tasa, plazo: credito.plazo }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
