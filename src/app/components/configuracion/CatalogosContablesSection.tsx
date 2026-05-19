import React, { useState } from 'react';
import { BookOpen, ArrowLeftRight, Layers } from 'lucide-react';
import { CatalogoContableSection } from './CatalogoContableSection';
import { EventosContablesSection } from './EventosContablesSection';
import { ComponentesContablesSection } from './ComponentesContablesSection';

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
type ContablesTab = 'catalogo-contable' | 'eventos-contables' | 'componentes';

const SUB_TABS: { id: ContablesTab; label: string; icon: React.ReactNode }[] = [
  { id: 'catalogo-contable', label: 'Catálogo Contable', icon: <BookOpen size={13} /> },
  { id: 'eventos-contables', label: 'Eventos Contables', icon: <ArrowLeftRight size={13} /> },
  { id: 'componentes',       label: 'Componentes',       icon: <Layers size={13} /> },
];

// ═══════════════════════════════════════════════════════════════════
// CONTENEDOR — Catálogos Contables
// ═══════════════════════════════════════════════════════════════════
export function CatalogosContablesSection() {
  const [activeTab, setActiveTab] = useState<ContablesTab>('catalogo-contable');

  return (
    <>
      {/* Barra de sub-tabs */}
      <div className="bg-[#F3F4F6] border-b border-gray-300 px-5 py-2 flex items-center gap-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-2 select-none">
          Catálogos Contables
        </span>
        {SUB_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-sm transition-all duration-150 border ${
                isActive
                  ? 'bg-[#2E5C91] text-white border-[#2E5C91] shadow-sm'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-[#E8EDF3] hover:text-[#2E5C91] hover:border-[#2E5C91]/40'
              }`}
            >
              <span className={isActive ? 'text-white/80' : 'text-gray-400'}>{tab.icon}</span>
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Contenido de la sub-sección activa */}
      {activeTab === 'catalogo-contable' && <CatalogoContableSection />}
      {activeTab === 'eventos-contables' && <EventosContablesSection />}
      {activeTab === 'componentes' && <ComponentesContablesSection />}
    </>
  );
}
