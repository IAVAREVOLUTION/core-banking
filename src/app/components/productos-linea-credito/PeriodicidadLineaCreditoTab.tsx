import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { PeriodicidadLineaCredito } from '@/app/types/productoLineaCredito';

interface PeriodicidadLineaCreditoTabProps {
  mode: 'create' | 'edit' | 'view';
  periodicidades: PeriodicidadLineaCredito[];
  onPeriodicidadesChange: (periodicidades: PeriodicidadLineaCredito[]) => void;
}

export function PeriodicidadLineaCreditoTab({ mode, periodicidades, onPeriodicidadesChange }: PeriodicidadLineaCreditoTabProps) {
  const [data, setData] = useState<PeriodicidadLineaCredito[]>(periodicidades);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showConsulta, setShowConsulta] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedItem, setSelectedItem] = useState<PeriodicidadLineaCredito | undefined>();
  const [showMenu, setShowMenu] = useState(false);
  const [filters, setFilters] = useState({
    periodicidad: '',
    observaciones: '',
  });

  const isViewMode = mode === 'view';

  // Sincronizar el estado local cuando cambian las periodicidades del prop
  useEffect(() => {
    setData(periodicidades);
  }, [periodicidades]);

  const handleDelete = () => {
    if (selectedRow === null) {
      toast.error('Debe seleccionar una fila');
      return;
    }
    const confirmed = window.confirm('¿Está seguro de eliminar este registro?');
    if (confirmed) {
      const newData = data.filter(item => item.id !== selectedRow);
      setData(newData);
      onPeriodicidadesChange(newData);
      setSelectedRow(null);
      toast.success('Registro eliminado');
    }
  };

  const handleNew = () => {
    if (isViewMode) {
      toast.warning('Modo solo lectura');
      return;
    }
    setFormMode('create');
    setSelectedItem(undefined);
    setShowFormModal(true);
  };

  const handleSaveForm = (formData: any) => {
    if (formMode === 'create') {
      const newItem: PeriodicidadLineaCredito = {
        id: Math.max(...data.map(d => d.id), 0) + 1,
        ...formData
      };
      const newData = [...data, newItem];
      setData(newData);
      onPeriodicidadesChange(newData);
      toast.success('Periodicidad creada');
    } else if (formMode === 'edit') {
      const newData = data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d);
      setData(newData);
      onPeriodicidadesChange(newData);
      toast.success('Periodicidad actualizada');
    }
    setShowFormModal(false);
  };

  const handleConsulta = () => {
    setShowConsulta(!showConsulta);
  };

  const handleRowDoubleClick = (item: PeriodicidadLineaCredito) => {
    if (isViewMode) {
      return;
    }
    setFormMode('edit');
    setSelectedItem(item);
    setShowFormModal(true);
  };

  // Aplicar filtros
  let filteredData = data.filter(item => {
    const matchesPeriodicidad = filters.periodicidad === '' || item.periodicidad.toLowerCase().includes(filters.periodicidad.toLowerCase());
    const matchesObservaciones = filters.observaciones === '' || item.observaciones.toLowerCase().includes(filters.observaciones.toLowerCase());
    return matchesPeriodicidad && matchesObservaciones;
  });

  return (
    <>
      <div className="bg-white">
        <div className="mb-3">
          <span className="text-sm font-medium text-gray-800">Periodicidad</span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="px-3 py-1 bg-primary-theme text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] flex items-center gap-1"
            >
              Menú
              <svg width="10" height="6" viewBox="0 0 10 6" fill="white">
                <path d="M0 0l5 6 5-6z"/>
              </svg>
            </button>
            {showMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-400 shadow-lg z-10 min-w-[140px]">
                <button onClick={() => { toast.success('Exportando a Excel'); setShowMenu(false); }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200">Exportar a Excel</button>
                <button onClick={() => { toast.success('Exportando a CSV'); setShowMenu(false); }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200">Exportar a CSV</button>
                <button onClick={() => { toast.success('Exportando a PDF'); setShowMenu(false); }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200">Exportar a PDF</button>
                <button onClick={() => { toast.success('Imprimiendo'); setShowMenu(false); }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100">Imprimir</button>
              </div>
            )}
          </div>

          <button onClick={handleNew} disabled={isViewMode} className="px-3 py-1 bg-primary-theme text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:cursor-not-allowed">Nuevo</button>
          <button onClick={handleDelete} disabled={selectedRow === null || isViewMode} className="px-3 py-1 bg-primary-theme text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:cursor-not-allowed">Eliminar</button>
          <button onClick={handleConsulta} className="px-3 py-1 bg-primary-theme text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91]">Consulta</button>
        </div>

        {showConsulta && (
          <div className="mb-3 p-3 bg-[#F5F5F5] border border-gray-400">
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Periodicidad</label>
                <input 
                  type="text"
                  value={filters.periodicidad}
                  onChange={(e) => setFilters({...filters, periodicidad: e.target.value})}
                  placeholder="Buscar periodicidad..."
                  className="w-full px-2 py-1 border border-gray-400 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Observaciones</label>
                <input 
                  type="text"
                  value={filters.observaciones}
                  onChange={(e) => setFilters({...filters, observaciones: e.target.value})}
                  placeholder="Buscar observaciones..."
                  className="w-full px-2 py-1 border border-gray-400 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setFilters({ periodicidad: '', observaciones: '' })}
                className="px-3 py-1 bg-gray-600 text-white text-xs hover:bg-gray-700 border border-gray-700"
              >
                Limpiar Filtros
              </button>
              <button 
                onClick={() => setShowConsulta(false)}
                className="px-3 py-1 bg-gray-600 text-white text-xs hover:bg-gray-700 border border-gray-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        <div className="border border-gray-400 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-primary-theme text-white">
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Periodicidad</th>
                <th className="px-3 py-2 text-left font-medium text-xs">Observaciones</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-gray-500 text-xs">No se encontraron registros</td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr 
                    key={item.id ?? `periodicidad-${index}`}
                    onClick={() => setSelectedRow(item.id)}
                    onDoubleClick={() => handleRowDoubleClick(item)}
                    className={`border-b border-gray-300 cursor-pointer transition-colors ${selectedRow === item.id ? 'bg-[#D6EAF8]' : index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'}`}
                  >
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.periodicidad}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">{item.observaciones}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-xs text-gray-600">
          <span className="font-medium">Total de registros: {filteredData.length}</span>
        </div>
      </div>

      {showFormModal && (
        <FormModal mode={formMode} item={selectedItem} onSave={handleSaveForm} onClose={() => setShowFormModal(false)} />
      )}
    </>
  );
}

interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: PeriodicidadLineaCredito;
  onSave: (data: any) => void;
  onClose: () => void;
}

function FormModal({ mode, item, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    periodicidad: item?.periodicidad || '',
    observaciones: item?.observaciones || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }

    // Validación de campos requeridos
    if (!formData.periodicidad || !formData.observaciones) {
      toast.error('Campos requeridos', {
        description: 'Por favor complete todos los campos obligatorios',
      });
      return;
    }

    onSave(formData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
  };

  const inputClassName = () => {
    const baseClass = 'w-full px-2 py-1 text-xs';
    if (isViewMode) {
      return `${baseClass} border-0 bg-transparent text-gray-700 cursor-default`;
    }
    return `${baseClass} border border-gray-400`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">{mode === 'create' ? 'Nueva Periodicidad' : mode === 'edit' ? 'Editar Periodicidad' : 'Ver Periodicidad'}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE PERIODICIDAD</span>
              </div>

              <div className="grid grid-cols-1 gap-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Periodicidad <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    value={formData.periodicidad} 
                    onChange={(e) => handleChange('periodicidad', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ej: En días"
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Observaciones <span className="text-red-600">*</span></label>
                  <textarea 
                    value={formData.observaciones} 
                    onChange={(e) => handleChange('observaciones', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ej: Los créditos siempre estarán en días"
                    rows={4}
                    className={inputClassName()} 
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-gray-300">
              <button type="button" onClick={onClose} className="px-4 py-1.5 bg-gray-500 text-white text-xs hover:bg-gray-600">{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
              {!isViewMode && (
                <button type="submit" className="px-4 py-1.5 bg-primary-theme text-white text-xs hover:bg-[#3E5C91]">Guardar</button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}