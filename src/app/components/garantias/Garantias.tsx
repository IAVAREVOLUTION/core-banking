import { useState } from 'react';
import { Garantia } from '@/types/garantia';
import { FormMode } from '@/types/product';
import { GarantiasList } from './GarantiasList';
import { GarantiaForm } from './GarantiaForm';
import { useGarantiasDB } from '@/app/hooks/useGarantiasDB';
import { toast } from 'sonner';

export function Garantias() {
  // ── Hook DB (RPC-based) — datos reales de J_GARANTIAS (todas) ──
  const {
    garantias,
    loading,
    saving,
    backendStatus,
    saveGarantia,
    refetch,
  } = useGarantiasDB();

  const [currentView, setCurrentView] = useState<'list' | 'form'>('list');
  const [selectedGarantia, setSelectedGarantia] = useState<Garantia | undefined>(undefined);
  const [formMode, setFormMode] = useState<FormMode>('view');

  const nextId = garantias.length > 0
    ? Math.max(...garantias.map((g) => typeof g.id === 'number' ? g.id : 0), 0) + 1
    : 1;

  const handleNew = () => {
    setFormMode('create');
    setSelectedGarantia(undefined);
    setCurrentView('form');
  };

  const handleEdit = (garantia: Garantia) => {
    setFormMode('edit');
    setSelectedGarantia(garantia);
    setCurrentView('form');
  };

  const handleView = (garantia: Garantia) => {
    setFormMode('view');
    setSelectedGarantia(garantia);
    setCurrentView('form');
  };

  const handleSave = async (garantiaData: Garantia) => {
    // Intentar persistir en DB via RPC
    const result = await saveGarantia(garantiaData);
    if (result.ok && result.source === 'db') {
      toast.success(
        formMode === 'create' ? 'Garantia creada en DB' : 'Garantia actualizada en DB',
        { description: `"${garantiaData.garantia}" — guardado en J_GARANTIAS` }
      );
      // Refetch para asegurar sincronización con la tabla real
      refetch();
    } else if (result.ok && result.source === 'local') {
      toast.warning('Guardado solo en sessionStorage (DB falló)', {
        description: 'Revisar consola [GarantiasDB] para ver el error. Ejecutar hotfix-insert-jgarantia.sql si es necesario.',
      });
    } else {
      toast.error('Error al guardar garantía', {
        description: result.error || 'Error desconocido',
      });
    }
    setCurrentView('list');
  };

  const handleCancel = () => {
    setCurrentView('list');
    setSelectedGarantia(undefined);
  };

  return (
    <div className="h-full">
      {currentView === 'list' ? (
        <GarantiasList
          garantias={garantias}
          loading={loading}
          backendStatus={backendStatus}
          onNew={handleNew}
          onEdit={handleEdit}
          onView={handleView}
        />
      ) : (
        <GarantiaForm
          garantia={selectedGarantia}
          mode={formMode}
          onSave={handleSave}
          onCancel={handleCancel}
          nextId={nextId}
        />
      )}
    </div>
  );
}