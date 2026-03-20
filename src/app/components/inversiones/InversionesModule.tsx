import { useState, useCallback } from 'react';
import { InversionesList } from './InversionesList';
import { InversionForm } from './InversionForm';
import { InversionesHome } from './InversionesHome';
import type { Inversion, InversionCompleta } from '@/types/inversion';
import * as store from './inversionesStore';
import { toast } from 'sonner';

type ViewMode = 'home' | 'list' | 'form';
type FormMode = 'nuevo' | 'editar' | 'ver';

// ═══════════════════════════════════════════════════════════════════
// Exportaciones legacy para App.tsx
// ═══════════════════════════════════════════════════════════════════
export const inversionesData = store.getAllLegacy();
export type { Inversion };

// ═══════════════════════════════════════════════════════════════════
// MÓDULO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function InversionesModule() {
  const [currentView, setCurrentView] = useState<ViewMode>('home');
  const [formMode, setFormMode] = useState<FormMode>('nuevo');
  const [selectedId, setSelectedId] = useState<number | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleNew = useCallback(() => {
    store.clearTemp();
    setFormMode('nuevo');
    setSelectedId(undefined);
    setCurrentView('form');
  }, []);

  const handleEdit = useCallback((inv: InversionCompleta) => {
    store.clearTemp();
    setFormMode('editar');
    setSelectedId(inv.id);
    setCurrentView('form');
  }, []);

  const handleView = useCallback((inv: InversionCompleta) => {
    store.clearTemp();
    setFormMode('ver');
    setSelectedId(inv.id);
    setCurrentView('form');
  }, []);

  const handleSave = useCallback((data: InversionCompleta) => {
    const saved = store.save(data);
    store.clearTemp();
    toast.success(
      formMode === 'nuevo' ? 'Inversión creada exitosamente' : 'Inversión actualizada',
      { description: `${saved.numero} — ${saved.form.cliente}` }
    );
    refresh();
    setCurrentView('list');
  }, [formMode, refresh]);

  const handleCancel = useCallback(() => {
    store.clearTemp();
    setCurrentView('list');
  }, []);

  if (currentView === 'form') {
    const isNew = formMode === 'nuevo';
    return (
      <div className="flex-1 flex flex-col bg-white">
        {/* Tabs de navegación — siempre visibles */}
        <div className="bg-gray-100 border-b border-gray-300">
          <div className="px-6 py-3 flex items-center gap-4">
            <button
              onClick={() => { store.clearTemp(); setCurrentView('home'); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors text-gray-700 hover:bg-gray-200"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/>
                <path d="M6 14v-5h4v5"/>
              </svg>
              <span>Inicio</span>
            </button>
            <button
              onClick={() => { store.clearTemp(); setCurrentView('list'); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors text-gray-700 hover:bg-gray-200"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3h10M3 8h10M3 13h10"/>
              </svg>
              <span>Lista de Inversiones</span>
            </button>
            <span className="flex items-center gap-2 px-3 py-1.5 rounded text-sm btn-primary-theme text-white">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 3v10M3 8h10"/>
              </svg>
              <span>{isNew ? 'Nueva Inversión' : formMode === 'editar' ? 'Editar Inversión' : 'Ver Inversión'}</span>
            </span>
          </div>
        </div>
        <InversionForm
          key={`form-${selectedId ?? 'new'}-${refreshKey}`}
          mode={formMode}
          inversionId={selectedId}
          onCancel={handleCancel}
          onSave={handleSave}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Tabs de navegación */}
      <div className="bg-gray-100 border-b border-gray-300">
        <div className="px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => setCurrentView('home')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
              currentView === 'home' ? 'btn-primary-theme text-white' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/>
              <path d="M6 14v-5h4v5"/>
            </svg>
            <span>Inicio</span>
          </button>
          <button
            onClick={() => setCurrentView('list')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
              currentView === 'list' ? 'btn-primary-theme text-white' : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 3h10M3 8h10M3 13h10"/>
            </svg>
            <span>Lista de Inversiones</span>
          </button>
        </div>
      </div>

      {currentView === 'home' ? (
        <InversionesHome
          onViewList={() => setCurrentView('list')}
          onNewInversion={handleNew}
        />
      ) : (
        <InversionesList
          key={`list-${refreshKey}`}
          onNew={handleNew}
          onEdit={handleEdit}
          onView={handleView}
        />
      )}
    </div>
  );
}