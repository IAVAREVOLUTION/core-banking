import { useState } from 'react';
import { CuentasAhorroDashboard } from './CuentasAhorroDashboard';
import { CuentasAhorroLista } from './CuentasAhorroLista';
import { CuentasAhorroForm } from './CuentasAhorroForm';
import { clearSession } from './cuentasAhorroStore';

// Force clean HMR remount after hook changes — v3.0 (INSERT + UPDATE)
export function CuentasAhorroModule() {
  const [view, setView] = useState<'dashboard' | 'lista' | 'nuevo' | 'editar' | 'ver'>('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<number | string | null>(null);

  const handleNew = () => {
    clearSession('new');
    setSelectedAccountId(null);
    setView('nuevo');
  };

  const handleEdit = (id: number | string) => {
    if (typeof id === 'number') clearSession(id);
    setSelectedAccountId(id);
    setView('editar');
  };

  const handleView = (id: number | string) => {
    setSelectedAccountId(id);
    setView('ver');
  };

  const handleBack = () => {
    if (typeof selectedAccountId === 'number') clearSession(selectedAccountId);
    clearSession('new');
    setView('lista');
    setSelectedAccountId(null);
  };

  const handleSaved = () => {
    if (typeof selectedAccountId === 'number') clearSession(selectedAccountId);
    clearSession('new');
    setView('lista');
    setSelectedAccountId(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-white overflow-hidden">
      {/* Subnavegacion interna del modulo Cuentas de Ahorro */}
      <div className="bg-gray-100 border-b border-gray-300">
        <div className="px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => setView('dashboard')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
              view === 'dashboard'
                ? 'bg-primary-theme text-white'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
            title="Dashboard de Cuentas de Ahorro"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z"/>
              <path d="M6 14v-5h4v5"/>
            </svg>
            <span>Inicio</span>
          </button>
          <button
            onClick={() => setView('lista')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
              view === 'lista' || view === 'editar' || view === 'ver'
                ? 'bg-primary-theme text-white'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
            title="Lista de Cuentas de Ahorro"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 4h12M2 8h12M2 12h12"/>
            </svg>
            <span>Lista Cuenta Ahorro</span>
          </button>
          {view === 'nuevo' && (
            <button
              className="flex items-center gap-2 px-3 py-1.5 rounded text-sm bg-primary-theme text-white"
              title="Nueva Cuenta de Ahorro"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M8 2v12M2 8h12"/>
              </svg>
              <span>Nueva Cuenta</span>
            </button>
          )}
        </div>
      </div>

      {/* Contenido principal segun la vista */}
      {view === 'dashboard' && (
        <CuentasAhorroDashboard
          onNew={handleNew}
          onEdit={handleEdit}
          onView={handleView}
        />
      )}

      {view === 'lista' && (
        <CuentasAhorroLista
          onNew={handleNew}
          onEdit={handleEdit}
          onView={handleView}
        />
      )}

      {(view === 'nuevo' || view === 'editar' || view === 'ver') && (
        <CuentasAhorroForm
          key={`${view}-${selectedAccountId}`}
          mode={view as 'nuevo' | 'editar' | 'ver'}
          accountId={selectedAccountId || undefined}
          onCancel={handleBack}
          onSave={handleSaved}
        />
      )}
    </div>
  );
}