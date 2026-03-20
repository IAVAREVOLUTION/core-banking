import { useState } from 'react';
import { PLDDashboard } from './PLDDashboard';
import { PLDKYCInfo } from './PLDKYCInfo';
import { PLDPerfilTransaccional } from './PLDPerfilTransaccional';
import { PLDCalificacionRiesgo } from './PLDCalificacionRiesgo';
import { PLDAlertasPLD } from './PLDAlertasPLD';
import { PLDAlertasInternas } from './PLDAlertasInternas';
import { PLDParametros } from './PLDParametros';
import { PLDCatalogos } from './PLDCatalogos';
import { PLDReportesCNBV } from './PLDReportesCNBV';

interface PLDHomeProps {
  onNavigate: (screen: string) => void;
}

type TabId = 'inicio' | 'kyc' | 'perfil' | 'riesgo' | 'alertas' | 'internas' | 'parametros' | 'catalogos' | 'reportes';

const TABS: { id: TabId; label: string }[] = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'kyc', label: 'KYC Información' },
  { id: 'perfil', label: 'Perfil Transaccional' },
  { id: 'riesgo', label: 'Calificación Riesgo' },
  { id: 'alertas', label: 'Alertas PLD' },
  { id: 'internas', label: 'Alertas Internas' },
  { id: 'parametros', label: 'Parámetros PLD' },
  { id: 'catalogos', label: 'Catálogos PLD' },
  { id: 'reportes', label: 'Reportes CNBV' },
];

export function PLDHome({ onNavigate }: PLDHomeProps) {
  const [tabActivo, setTabActivo] = useState<TabId>('inicio');

  const renderContent = () => {
    switch (tabActivo) {
      case 'inicio': return <PLDDashboard />;
      case 'kyc': return <PLDKYCInfo onBack={() => setTabActivo('inicio')} />;
      case 'perfil': return <PLDPerfilTransaccional onBack={() => setTabActivo('inicio')} />;
      case 'riesgo': return <PLDCalificacionRiesgo onBack={() => setTabActivo('inicio')} />;
      case 'alertas': return <PLDAlertasPLD onBack={() => setTabActivo('inicio')} />;
      case 'internas': return <PLDAlertasInternas onBack={() => setTabActivo('inicio')} />;
      case 'parametros': return <PLDParametros onBack={() => setTabActivo('inicio')} />;
      case 'catalogos': return <PLDCatalogos onBack={() => setTabActivo('inicio')} />;
      case 'reportes': return <PLDReportesCNBV onBack={() => setTabActivo('inicio')} />;
      default: return <PLDDashboard />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Tabs de navegación institucional */}
      <div className="bg-[#F0F2F5] border-b border-gray-300">
        <div className="px-3 py-2 flex items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = tabActivo === tab.id;
            const isInicio = tab.id === 'inicio';
            return (
              <button
                key={tab.id}
                onClick={() => setTabActivo(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs whitespace-nowrap rounded transition-all ${
                  isActive
                    ? 'bg-[#3D5A80] text-white shadow-sm'
                    : 'text-[#4A5568] hover:bg-[#E2E6EC]'
                }`}
                style={{ fontWeight: isActive ? 600 : 400 }}
              >
                {isInicio ? (
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/>
                    <path d="M6 14v-5h4v5"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                    <path d="M2 3.5h10M2 7h10M2 10.5h10"/>
                  </svg>
                )}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido del tab activo */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
}