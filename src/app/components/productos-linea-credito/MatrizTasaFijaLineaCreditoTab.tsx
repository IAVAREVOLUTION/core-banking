import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { MatrizTasaFijaLineaCredito } from '@/app/types/productoLineaCredito';

interface MatrizTasaFijaLineaCreditoTabProps {
  mode: 'create' | 'edit' | 'view';
  matrizTasaFija: MatrizTasaFijaLineaCredito[];
  onMatrizTasaFijaChange: (matrizTasaFija: MatrizTasaFijaLineaCredito[]) => void;
}

export function MatrizTasaFijaLineaCreditoTab({ mode, matrizTasaFija, onMatrizTasaFijaChange }: MatrizTasaFijaLineaCreditoTabProps) {
  const [data, setData] = useState<MatrizTasaFijaLineaCredito[]>(matrizTasaFija);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showConsulta, setShowConsulta] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedItem, setSelectedItem] = useState<MatrizTasaFijaLineaCredito | undefined>();
  const [showMenu, setShowMenu] = useState(false);
  const [filters, setFilters] = useState({
    plazoMinimo: '',
    plazoMaximo: '',
    frecuencia: '',
    tasaAplicable: '',
  });

  const isViewMode = mode === 'view';

  // Sincronizar el estado local cuando cambia la matriz del prop
  useEffect(() => {
    setData(matrizTasaFija);
  }, [matrizTasaFija]);

  const handleDelete = () => {
    if (selectedRow === null) {
      toast.error('Debe seleccionar una fila');
      return;
    }
    const confirmed = window.confirm('¿Está seguro de eliminar este registro?');
    if (confirmed) {
      const newData = data.filter(item => item.id !== selectedRow);
      setData(newData);
      onMatrizTasaFijaChange(newData);
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
      const newItem: MatrizTasaFijaLineaCredito = {
        id: Math.max(...data.map(d => d.id), 0) + 1,
        ...formData
      };
      const newData = [...data, newItem];
      setData(newData);
      onMatrizTasaFijaChange(newData);
      toast.success('Matriz de tasa fija creada');
    } else if (formMode === 'edit') {
      const newData = data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d);
      setData(newData);
      onMatrizTasaFijaChange(newData);
      toast.success('Matriz de tasa fija actualizada');
    }
    setShowFormModal(false);
  };

  const handleConsulta = () => {
    setShowConsulta(!showConsulta);
  };

  const handleRowDoubleClick = (item: MatrizTasaFijaLineaCredito) => {
    if (isViewMode) {
      return;
    }
    setFormMode('edit');
    setSelectedItem(item);
    setShowFormModal(true);
  };

  // Aplicar filtros
  let filteredData = data.filter(item => {
    const matchesPlazoMinimo = filters.plazoMinimo === '' || String(item.plazoMinimo).includes(filters.plazoMinimo);
    const matchesPlazoMaximo = filters.plazoMaximo === '' || String(item.plazoMaximo).includes(filters.plazoMaximo);
    const matchesFrecuencia = filters.frecuencia === '' || item.frecuencia.toLowerCase().includes(filters.frecuencia.toLowerCase());
    const matchesTasaAplicable = filters.tasaAplicable === '' || String(item.tasaAplicable).includes(filters.tasaAplicable);
    return matchesPlazoMinimo && matchesPlazoMaximo && matchesFrecuencia && matchesTasaAplicable;
  });

  return (
    <>
      <div className="bg-white">
        <div className="mb-3">
          <span className="text-sm font-medium text-gray-800">Matriz Tasa Fija</span>
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
            <div className="grid grid-cols-4 gap-3 mb-2">
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Plazo mínimo</label>
                <input 
                  type="text"
                  value={filters.plazoMinimo}
                  onChange={(e) => setFilters({...filters, plazoMinimo: e.target.value})}
                  placeholder="Buscar plazo mínimo..."
                  className="w-full px-2 py-1 border border-gray-400 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Plazo máximo</label>
                <input 
                  type="text"
                  value={filters.plazoMaximo}
                  onChange={(e) => setFilters({...filters, plazoMaximo: e.target.value})}
                  placeholder="Buscar plazo máximo..."
                  className="w-full px-2 py-1 border border-gray-400 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Frecuencia</label>
                <input 
                  type="text"
                  value={filters.frecuencia}
                  onChange={(e) => setFilters({...filters, frecuencia: e.target.value})}
                  placeholder="Buscar frecuencia..."
                  className="w-full px-2 py-1 border border-gray-400 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Tasa aplicable</label>
                <input 
                  type="text"
                  value={filters.tasaAplicable}
                  onChange={(e) => setFilters({...filters, tasaAplicable: e.target.value})}
                  placeholder="Buscar tasa..."
                  className="w-full px-2 py-1 border border-gray-400 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setFilters({ plazoMinimo: '', plazoMaximo: '', frecuencia: '', tasaAplicable: '' })}
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
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Plazo mínimo</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Plazo máximo</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Frecuencia</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Tasa aplicable</th>
                <th className="px-3 py-2 text-center font-medium text-xs border-r border-white/20">Aplica valor residual</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Valor residual</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Inicio vigencia</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Fin vigencia</th>
                <th className="px-3 py-2 text-left font-medium text-xs">Días de anticipo al fondeador</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-gray-500 text-xs">No se encontraron registros</td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr 
                    key={item.id}
                    onClick={() => setSelectedRow(item.id)}
                    onDoubleClick={() => handleRowDoubleClick(item)}
                    className={`border-b border-gray-300 cursor-pointer transition-colors ${selectedRow === item.id ? 'bg-[#D6EAF8]' : index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'}`}
                  >
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.plazoMinimo}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.plazoMaximo}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.frecuencia}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{Number(item.tasaAplicable).toFixed(3)}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300 text-center">
                      <input 
                        type="checkbox" 
                        checked={item.aplicaValorResidual} 
                        readOnly 
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.valorResidual}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.inicioVigencia}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.finVigencia}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">{item.diasAnticipoFondeador}</td>
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
  item?: MatrizTasaFijaLineaCredito;
  onSave: (data: any) => void;
  onClose: () => void;
}

function FormModal({ mode, item, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    plazoMinimo: item?.plazoMinimo || '',
    plazoMaximo: item?.plazoMaximo || '',
    frecuencia: item?.frecuencia || '',
    tasaAplicable: item?.tasaAplicable || '',
    aplicaValorResidual: item?.aplicaValorResidual || false,
    valorResidual: item?.valorResidual || '',
    inicioVigencia: item?.inicioVigencia || '',
    finVigencia: item?.finVigencia || '',
    diasAnticipoFondeador: item?.diasAnticipoFondeador || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }

    // Validación de campos requeridos
    if (formData.plazoMinimo === '' || formData.plazoMaximo === '' || 
        formData.tasaAplicable === '' || formData.valorResidual === '' || 
        !formData.inicioVigencia || !formData.finVigencia || !formData.diasAnticipoFondeador) {
      toast.error('Campos requeridos', {
        description: 'Por favor complete todos los campos obligatorios',
      });
      return;
    }

    // Siempre establecer frecuencia a "Días"
    onSave({ ...formData, frecuencia: 'Días' });
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
      <div className="bg-white shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">{mode === 'create' ? 'Nueva Matriz Tasa Fija' : mode === 'edit' ? 'Editar Matriz Tasa Fija' : 'Ver Matriz Tasa Fija'}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE MATRIZ TASA FIJA</span>
              </div>

              <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Plazo mínimo <span className="text-red-600">*</span></label>
                  <input 
                    type="number" 
                    value={formData.plazoMinimo} 
                    onChange={(e) => handleChange('plazoMinimo', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ej: 1"
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Plazo máximo <span className="text-red-600">*</span></label>
                  <input 
                    type="number" 
                    value={formData.plazoMaximo} 
                    onChange={(e) => handleChange('plazoMaximo', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ej: 325"
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Frecuencia <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    value="Días"
                    readOnly
                    className="w-full px-2 py-1 text-xs border border-gray-400 bg-gray-100 cursor-not-allowed text-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Tasa aplicable (%) <span className="text-red-600">*</span></label>
                  <input 
                    type="number" 
                    step="0.001"
                    value={formData.tasaAplicable} 
                    onChange={(e) => handleChange('tasaAplicable', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ej: 15.000"
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Valor residual <span className="text-red-600">*</span></label>
                  <input 
                    type="number" 
                    value={formData.valorResidual} 
                    onChange={(e) => handleChange('valorResidual', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ej: 0"
                    className={inputClassName()} 
                  />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input 
                    type="checkbox" 
                    checked={formData.aplicaValorResidual} 
                    onChange={(e) => handleChange('aplicaValorResidual', e.target.checked)} 
                    disabled={isViewMode}
                    className="cursor-pointer"
                  />
                  <label className="text-xs text-gray-700 font-medium">Aplica valor residual</label>
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Inicio vigencia <span className="text-red-600">*</span></label>
                  <input 
                    type="date" 
                    value={formData.inicioVigencia} 
                    onChange={(e) => handleChange('inicioVigencia', e.target.value)} 
                    disabled={isViewMode} 
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Fin vigencia <span className="text-red-600">*</span></label>
                  <input 
                    type="date" 
                    value={formData.finVigencia} 
                    onChange={(e) => handleChange('finVigencia', e.target.value)} 
                    disabled={isViewMode} 
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Días de anticipo al fondeador <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    value={formData.diasAnticipoFondeador} 
                    onChange={(e) => handleChange('diasAnticipoFondeador', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ej: Recursos Propios"
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