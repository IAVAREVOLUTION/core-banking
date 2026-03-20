import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { GarantiaLineaCredito } from '@/app/types/productoLineaCredito';

interface GarantiasLineaCreditoTabProps {
  mode: 'create' | 'edit' | 'view';
  garantias: GarantiaLineaCredito[];
  onGarantiasChange: (garantias: GarantiaLineaCredito[]) => void;
}

export function GarantiasLineaCreditoTab({ mode, garantias, onGarantiasChange }: GarantiasLineaCreditoTabProps) {
  const [data, setData] = useState<GarantiaLineaCredito[]>(garantias);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showConsulta, setShowConsulta] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedItem, setSelectedItem] = useState<GarantiaLineaCredito | undefined>();
  const [showMenu, setShowMenu] = useState(false);
  const [filters, setFilters] = useState({
    tipo: '',
    subtipo: '',
    descripcion: '',
  });

  const isViewMode = mode === 'view';

  // Sincronizar el estado local cuando cambian las garantías del prop
  useEffect(() => {
    setData(garantias);
  }, [garantias]);

  const handleDelete = () => {
    if (selectedRow === null) {
      toast.error('Debe seleccionar una fila');
      return;
    }
    const confirmed = window.confirm('¿Está seguro de eliminar este registro?');
    if (confirmed) {
      const newData = data.filter(item => item.id !== selectedRow);
      setData(newData);
      onGarantiasChange(newData);
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
      const newItem: GarantiaLineaCredito = {
        id: Math.max(...data.map(d => d.id), 0) + 1,
        ...formData
      };
      const newData = [...data, newItem];
      setData(newData);
      onGarantiasChange(newData);
      toast.success('Garantía creada');
    } else if (formMode === 'edit') {
      const newData = data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d);
      setData(newData);
      onGarantiasChange(newData);
      toast.success('Garantía actualizada');
    }
    setShowFormModal(false);
  };

  const handleConsulta = () => {
    setShowConsulta(!showConsulta);
  };

  const handleRowDoubleClick = (item: GarantiaLineaCredito) => {
    if (isViewMode) {
      return;
    }
    setFormMode('edit');
    setSelectedItem(item);
    setShowFormModal(true);
  };

  // Aplicar filtros
  let filteredData = data.filter(item => {
    const matchesTipo = filters.tipo === '' || item.tipo.toLowerCase().includes(filters.tipo.toLowerCase());
    const matchesSubtipo = filters.subtipo === '' || item.subtipo.toLowerCase().includes(filters.subtipo.toLowerCase());
    const matchesDescripcion = filters.descripcion === '' || item.descripcion.toLowerCase().includes(filters.descripcion.toLowerCase());
    return matchesTipo && matchesSubtipo && matchesDescripcion;
  });

  return (
    <>
      <div className="bg-white">
        <div className="mb-3">
          <span className="text-sm font-medium text-gray-800">Garantías</span>
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
            <div className="grid grid-cols-3 gap-3 mb-2">
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Tipo</label>
                <input 
                  type="text"
                  value={filters.tipo}
                  onChange={(e) => setFilters({...filters, tipo: e.target.value})}
                  placeholder="Buscar tipo..."
                  className="w-full px-2 py-1 border border-gray-400 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Subtipo</label>
                <input 
                  type="text"
                  value={filters.subtipo}
                  onChange={(e) => setFilters({...filters, subtipo: e.target.value})}
                  placeholder="Buscar subtipo..."
                  className="w-full px-2 py-1 border border-gray-400 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Descripción</label>
                <input 
                  type="text"
                  value={filters.descripcion}
                  onChange={(e) => setFilters({...filters, descripcion: e.target.value})}
                  placeholder="Buscar descripción..."
                  className="w-full px-2 py-1 border border-gray-400 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setFilters({ tipo: '', subtipo: '', descripcion: '' })}
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

        <div className="border border-gray-400">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-primary-theme text-white">
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Tipo</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Subtipo</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Descripción</th>
                <th className="px-3 py-2 text-left font-medium text-xs">Aforo</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-500 text-xs">No se encontraron registros</td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr 
                    key={item.id ?? `garantia-${index}`}
                    onClick={() => setSelectedRow(item.id)}
                    onDoubleClick={() => handleRowDoubleClick(item)}
                    className={`border-b border-gray-300 cursor-pointer transition-colors ${selectedRow === item.id ? 'bg-[#D6EAF8]' : index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'}`}
                  >
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.tipo}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.subtipo}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300 text-left">{item.descripcion}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">{item.aforo}%</td>
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
  item?: GarantiaLineaCredito;
  onSave: (data: any) => void;
  onClose: () => void;
}

function FormModal({ mode, item, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    tipo: item?.tipo || '',
    subtipo: item?.subtipo || '',
    descripcion: item?.descripcion || '',
    aforo: item?.aforo || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }

    // Validación de campos requeridos
    const newErrors: Record<string, string> = {};
    if (!formData.tipo) newErrors.tipo = 'El tipo es requerido';
    if (!formData.subtipo) newErrors.subtipo = 'El subtipo es requerido';
    if (!formData.aforo.trim()) {
      newErrors.aforo = 'El aforo es requerido';
    } else {
      const aforoNum = parseFloat(formData.aforo);
      if (isNaN(aforoNum) || aforoNum < 0) {
        newErrors.aforo = 'El aforo debe ser >= 0%';
      } else if (aforoNum > 1000) {
        newErrors.aforo = 'El aforo no puede exceder 1000%';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Campos requeridos', {
        description: 'Por favor complete todos los campos obligatorios',
      });
      return;
    }

    // Formatear aforo a dos decimales al guardar
    onSave({
      ...formData,
      aforo: parseFloat(formData.aforo).toFixed(2),
    });
  };

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: '' });
  };

  const inputClassName = (fieldName?: string) => {
    const baseClass = 'w-full px-2 py-1 text-xs';
    if (isViewMode) {
      return `${baseClass} border-0 bg-transparent text-gray-700 cursor-default`;
    }
    const errorClass = fieldName && errors[fieldName] ? 'border-2 border-red-500' : 'border border-gray-400';
    return `${baseClass} ${errorClass}`;
  };

  // Subtipos dinámicos según el tipo
  const getSubtipos = () => {
    if (formData.tipo === 'Mueble') {
      return ['Vehículo', 'Maquinaria', 'Equipo de Cómputo', 'Inventario', 'Otro Mueble'];
    }
    if (formData.tipo === 'Inmueble') {
      return ['Terreno', 'Casa Habitación', 'Departamento', 'Local Comercial', 'Nave Industrial', 'Otro Inmueble'];
    }
    return [];
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">{mode === 'create' ? 'Nueva Garantía' : mode === 'edit' ? 'Editar Garantía' : 'Ver Garantía'}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">&times;</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE GARANTÍA</span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Tipo <span className="text-red-600">*</span></label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => {
                      handleChange('tipo', e.target.value);
                      setFormData(prev => ({ ...prev, tipo: e.target.value, subtipo: '' }));
                    }}
                    disabled={isViewMode}
                    className={inputClassName('tipo')}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Mueble">Mueble</option>
                    <option value="Inmueble">Inmueble</option>
                  </select>
                  {errors.tipo && <p className="text-red-600 text-[10px] mt-1">{errors.tipo}</p>}
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Subtipo <span className="text-red-600">*</span></label>
                  <select
                    value={formData.subtipo}
                    onChange={(e) => handleChange('subtipo', e.target.value)}
                    disabled={isViewMode || !formData.tipo}
                    className={inputClassName('subtipo')}
                  >
                    <option value="">Seleccionar...</option>
                    {getSubtipos().map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                  {errors.subtipo && <p className="text-red-600 text-[10px] mt-1">{errors.subtipo}</p>}
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Descripción</label>
                  <textarea value={formData.descripcion} onChange={(e) => handleChange('descripcion', e.target.value)} disabled={isViewMode} rows={3} placeholder="Descripción de la garantía..." className={inputClassName() + ' resize-none'} />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Aforo (%) <span className="text-red-600">*</span></label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.aforo}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^\d{0,4}(\.\d{0,2})?$/.test(val)) {
                          handleChange('aforo', val);
                        }
                      }}
                      onBlur={() => {
                        if (formData.aforo && !isNaN(parseFloat(formData.aforo))) {
                          handleChange('aforo', parseFloat(formData.aforo).toFixed(2));
                        }
                      }}
                      disabled={isViewMode}
                      placeholder="Ej: 100.00"
                      min="0"
                      max="1000"
                      step="0.01"
                      className={inputClassName('aforo') + ' pr-6'}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">%</span>
                  </div>
                  <p className="text-gray-400 text-[10px] mt-0.5">Rango: 0.00% - 1000.00%</p>
                  {errors.aforo && <p className="text-red-600 text-[10px] mt-1">{errors.aforo}</p>}
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