import { useState } from 'react';
import { PolizaContableList } from './PolizaContableList';
import { PolizaContableForm } from './PolizaContableForm';
import { usePolizasContablesDB } from '../../hooks/usePolizasContablesDB';

export interface PolizaContable {
  // Columnas físicas de J_GL_JOURNAL_ENCABEZADO
  id?: string;
  journal_date: string;
  producto_id: string;
  event_code: string;
  account_id: string;
  transaction_id?: string;
  currency: string;
  total_debit: number;
  total_credit: number;
  status: 'Creada' | 'Aplicada' | 'Cancelada' | 'Procesando' | 'Error';
  created_at?: string;
  // JSONB data — campos flexibles
  data: {
    concepto?: string;
    referencia?: string;
    partidas?: Partida[];
    [key: string]: any;
  };
}

export interface Partida {
  cuentaGl: string;
  nombreCuenta: string;
  concepto: string;
  debito: string;
  credito: string;
}

type View = 'list' | 'form';
type FormMode = 'create' | 'edit' | 'view';

export function PolizasContablesModule() {
  const [view, setView] = useState<View>('list');
  const [formMode, setFormMode] = useState<FormMode>('view');
  const [selected, setSelected] = useState<PolizaContable | undefined>();
  const { polizas, loading, error, refetch } = usePolizasContablesDB(true);

  const handleNew = () => {
    setSelected(undefined);
    setFormMode('create');
    setView('form');
  };

  const handleEdit = (p: PolizaContable) => {
    setSelected(p);
    setFormMode('edit');
    setView('form');
  };

  const handleView = (p: PolizaContable) => {
    setSelected(p);
    setFormMode('view');
    setView('form');
  };

  const handleSave = () => {
    refetch();
    setView('list');
    setSelected(undefined);
  };

  const handleCancel = () => {
    setView('list');
    setSelected(undefined);
  };

  if (view === 'form') {
    return (
      <PolizaContableForm
        mode={formMode}
        poliza={selected}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <PolizaContableList
      polizas={polizas}
      onNew={handleNew}
      onEdit={handleEdit}
      onView={handleView}
      loading={loading}
      error={error}
      onRefetch={refetch}
    />
  );
}
