import { useState } from 'react';
import { toast } from 'sonner';

interface JerarquiaProducto {
  id: number;
  principal: boolean;
  producto: string;
  limiteMaximoS: number;
  limiteMaximo: number;
  frecuenciaMaxima: number;
  spreadMinimo: number;
  rentabilidad: number;
  observaciones: string;
  sga: string;
  porcentajeSga: number;
  montoSga: number;
}

interface JerarquiaProductosTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
}

export function JerarquiaProductosTab({ mode }: JerarquiaProductosTabProps) {
  const [data, setData] = useState<JerarquiaProducto[]>([
    { id: 1, principal: true, producto: 'Crédito Personal', limiteMaximoS: 0, limiteMaximo: 999, frecuenciaMaxima: 1, spreadMinimo: 5, rentabilidad: 40, observaciones: 'Producto principal', sga: 'SGA001', porcentajeSga: 2.5, montoSga: 1000 },
  ]);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showConsulta, setShowConsulta] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedItem, setSelectedItem] = useState<JerarquiaProducto | undefined>();
  const [showMenu, setShowMenu] = useState(false);
  const [filters, setFilters] = useState({
    producto: '',
  });

  const isViewMode = mode === 'ver';

  const handleDelete = () => {
    if (selectedRow === null) {
      toast.error('Debe seleccionar una fila');
      return;
    }
    const confirmed = window.confirm('¿Está seguro de eliminar este registro?');
    if (confirmed) {
      setData(data.filter(item => item.id !== selectedRow));
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

  const handleEdit = (item: JerarquiaProducto) => {
    if (isViewMode) {
      handleView(item);
      return;
    }
    setFormMode('edit');
    setSelectedItem(item);
    setShowFormModal(true);
  };

  const handleView = (item: JerarquiaProducto) => {
    setFormMode('view');
    setSelectedItem(item);
    setShowFormModal(true);
  };

  const handleSaveForm = (formData: any) => {
    if (formMode === 'create') {
      // Validar que solo un registro sea principal
      if (formData.principal) {
        setData(data.map(d => ({ ...d, principal: false })));
      }
      const newItem: JerarquiaProducto = {
        id: Math.max(...data.map(d => d.id), 0) + 1,
        ...formData
      };
      setData([...data, newItem]);
      toast.success('Jerarquía creada');
    } else if (formMode === 'edit') {
      if (formData.principal) {
        setData(data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : { ...d, principal: false }));
      } else {
        setData(data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d));
      }
      toast.success('Jerarquía actualizada');
    }
    setShowFormModal(false);
  };

  const handleConsulta = () => {
    setShowConsulta(!showConsulta);
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters({ ...filters, [field]: value });
  };

  const filteredData = data.filter(item => 
    item.producto.toLowerCase().includes(filters.producto.toLowerCase())
  );

  return (
    <>
      <div className="bg-white">
        <div className="mb-3">
          <span className="text-sm font-medium text-gray-800">Jerarquía de Productos</span>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] flex items-center gap-1"
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

          <button onClick={handleNew} disabled={isViewMode} className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:cursor-not-allowed">Nuevo</button>
          <button onClick={handleDelete} disabled={selectedRow === null || isViewMode} className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:cursor-not-allowed">Eliminar</button>
          <button onClick={handleConsulta} className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91]">Consulta</button>
        </div>

        {showConsulta && (
          <div className="mb-3 p-3 bg-[#F5F5F5] border border-gray-400">
            <div className="grid grid-cols-3 gap-3 mb-2">
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Producto</label>
                <input 
                  type="text"
                  value={filters.producto}
                  onChange={(e) => handleFilterChange('producto', e.target.value)}
                  placeholder="Buscar producto..."
                  className="w-full px-2 py-1 border border-gray-400 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setFilters({ producto: '' })}
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
              <tr className="bg-[#4A6FA5] text-white">
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Principal</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Producto</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">% Límite Máx S</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Límite Máximo</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Frec. Máxima</th>
                <th className="px-3 py-2 text-left font-medium text-xs">% Rentabilidad</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500 text-xs">No se encontraron registros</td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr 
                    key={item.id}
                    onClick={() => setSelectedRow(item.id)}
                    className={`border-b border-gray-300 cursor-pointer transition-colors ${selectedRow === item.id ? 'bg-[#D6EAF8]' : index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'}`}
                  >
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">
                      <input type="checkbox" checked={item.principal} readOnly className="w-4 h-4" />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.producto}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.limiteMaximoS}%</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.limiteMaximo}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.frecuenciaMaxima}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">{item.rentabilidad}%</td>
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
  item?: JerarquiaProducto;
  onSave: (data: any) => void;
  onClose: () => void;
}

function FormModal({ mode, item, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    principal: item?.principal || false,
    producto: item?.producto || '',
    limiteMaximoS: item?.limiteMaximoS || 0,
    limiteMaximo: item?.limiteMaximo || 0,
    frecuenciaMaxima: item?.frecuenciaMaxima || 0,
    spreadMinimo: item?.spreadMinimo || 0,
    rentabilidad: item?.rentabilidad || 0,
    observaciones: item?.observaciones || '',
    sga: item?.sga || '',
    porcentajeSga: item?.porcentajeSga || 0,
    montoSga: item?.montoSga || 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
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
      <div className="bg-white shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">{mode === 'create' ? 'Nueva Jerarquía' : mode === 'edit' ? 'Editar Jerarquía' : 'Ver Jerarquía'}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE JERARQUÍA</span>
              </div>

              <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Principal</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input type="checkbox" checked={formData.principal} onChange={(e) => handleChange('principal', e.target.checked)} disabled={isViewMode} className="w-4 h-4" />
                    <span className="text-xs text-gray-700">Es principal</span>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Producto <span className="text-red-600">*</span></label>
                  <input type="text" value={formData.producto} onChange={(e) => handleChange('producto', e.target.value)} disabled={isViewMode} className={inputClassName()} />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">% Límite Máximo S</label>
                  <input type="number" value={formData.limiteMaximoS} onChange={(e) => handleChange('limiteMaximoS', parseFloat(e.target.value))} disabled={isViewMode} className={inputClassName()} />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Límite Máximo</label>
                  <input type="number" value={formData.limiteMaximo} onChange={(e) => handleChange('limiteMaximo', parseInt(e.target.value))} disabled={isViewMode} className={inputClassName()} />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Frecuencia Máxima</label>
                  <input type="number" value={formData.frecuenciaMaxima} onChange={(e) => handleChange('frecuenciaMaxima', parseInt(e.target.value))} disabled={isViewMode} className={inputClassName()} />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Spread Mínimo</label>
                  <input type="number" value={formData.spreadMinimo} onChange={(e) => handleChange('spreadMinimo', parseFloat(e.target.value))} disabled={isViewMode} className={inputClassName()} />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">% Rentabilidad</label>
                  <input type="number" value={formData.rentabilidad} onChange={(e) => handleChange('rentabilidad', parseFloat(e.target.value))} disabled={isViewMode} placeholder="40" className={inputClassName()} />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">SGA</label>
                  <input type="text" value={formData.sga} onChange={(e) => handleChange('sga', e.target.value)} disabled={isViewMode} className={inputClassName()} />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">% SGA</label>
                  <input type="number" value={formData.porcentajeSga} onChange={(e) => handleChange('porcentajeSga', parseFloat(e.target.value))} disabled={isViewMode} className={inputClassName()} />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Monto SGA</label>
                  <input type="number" value={formData.montoSga} onChange={(e) => handleChange('montoSga', parseFloat(e.target.value))} disabled={isViewMode} className={inputClassName()} />
                </div>

                <div className="col-span-3">
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Observaciones</label>
                  <textarea value={formData.observaciones} onChange={(e) => handleChange('observaciones', e.target.value)} disabled={isViewMode} rows={3} className={inputClassName() + ' resize-none'} />
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-gray-300">
              <button type="button" onClick={onClose} className="px-4 py-1.5 bg-gray-500 text-white text-xs hover:bg-gray-600">{isViewMode ? 'Cerrar' : 'Cancelar'}</button>
              {!isViewMode && (
                <button type="submit" className="px-4 py-1.5 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91]">Guardar</button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}