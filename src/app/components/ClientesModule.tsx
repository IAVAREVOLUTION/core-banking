import { useState } from 'react';
import { ClientesList } from './clientes/ClientesList';
import { ClienteDB, useClientesDB } from '../hooks/useClientesDB';
import { AltaClienteDefault } from './clientes/AltaClienteDefault';
import { clearAllClienteData } from '../hooks/useClientePersistence';
import { toast } from 'sonner';

type FormMode = 'nuevo' | 'editar' | 'ver';

export function ClientesModule() {
  const [currentView, setCurrentView] = useState<'list' | 'form'>('list');
  const [formMode, setFormMode] = useState<FormMode>('ver');
  const [selectedCliente, setSelectedCliente] = useState<ClienteDB | undefined>();

  // ── Fuente única de verdad: J_CLIENTES (SIN FILTROS — todos los registros) ──
  // useClientesDB v10.1: endpoint exclusivo /clientes-lista-todos, sin fallback, sin filtro
  const { clientes: dbClientes, loading, error, warning, backendStatus, diagnostico, refetch: dbRefetch } = useClientesDB(currentView === 'list');

  const handleNuevo = () => {
    setFormMode('nuevo');
    setSelectedCliente(undefined);
    setCurrentView('form');
  };

  const handleEditar = (cliente: ClienteDB) => {
    setFormMode('editar');
    setSelectedCliente(cliente);
    setCurrentView('form');
  };

  const handleVer = (cliente: ClienteDB) => {
    setFormMode('ver');
    setSelectedCliente(cliente);
    setCurrentView('form');
  };

  const handleSave = (clienteData: any) => {
    // ═══════════════════════════════════════════════════════════════
    // J_CLIENTES (Supabase) es la fuente de verdad.
    // AltaClienteDefault ya ejecutó syncToJClientes (INSERT/UPDATE).
    // Aquí solo navegamos de vuelta y hacemos refetch.
    // ═══════════════════════════════════════════════════════════════
    if (formMode === 'nuevo') {
      toast.success('Cliente creado exitosamente', {
        description: `El cliente "${clienteData.nombre || 'Nuevo Cliente'}" ha sido registrado en J_CLIENTES.`,
      });
    } else if (formMode === 'editar') {
      toast.success('Cliente actualizado', {
        description: `Los cambios en "${clienteData.nombre || ''}" han sido guardados en J_CLIENTES.`,
      });
    }
    setTimeout(() => {
      setCurrentView('list');
      setSelectedCliente(undefined);
      // Refetch desde J_CLIENTES para reflejar los cambios en BD
      setTimeout(() => {
        dbRefetch();
      }, 500);
    }, 1500);
  };

  const handleCancel = () => {
    setCurrentView('list');
    setSelectedCliente(undefined);
  };

  return (
    <>
      {currentView === 'list' ? (
        <ClientesList
          clientes={dbClientes}
          loading={loading}
          error={error}
          warning={warning}
          backendStatus={backendStatus}
          diagnostico={diagnostico}
          onRefresh={dbRefetch}
          onNew={handleNuevo}
          onEdit={handleEditar}
          onView={handleVer}
        />
      ) : (
        <AltaClienteDefault
          mode={formMode}
          cliente={selectedCliente as any}
          onSave={handleSave}
          onBack={handleCancel}
        />
      )}
    </>
  );
}