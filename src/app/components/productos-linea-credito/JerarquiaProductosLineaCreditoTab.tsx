import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { JerarquiaProductoLineaCredito } from '@/app/types/productoLineaCredito';

// Lista local de productos disponibles para jerarquía de Línea de Crédito
const productosDisponiblesLC = [
  { id: 1, nombre: 'Arrendamiento Financiero' },
  { id: 2, nombre: 'Arrendamiento Puro' },
  { id: 3, nombre: 'Crédito Automotriz' },
  { id: 4, nombre: 'Crédito DOMO' },
  { id: 5, nombre: 'Crédito OPM' },
  { id: 6, nombre: 'Crédito Refaccionario' },
  { id: 7, nombre: 'Cuenta Corriente' },
  { id: 8, nombre: 'Factoraje' },
  { id: 9, nombre: 'Crédito CPN' },
  { id: 10, nombre: 'Save Day' },
  { id: 11, nombre: 'Crédito Tradicional' },
  { id: 12, nombre: 'OPN' },
];

interface JerarquiaProductosLineaCreditoTabProps {
  mode: 'create' | 'edit' | 'view';
  jerarquias: JerarquiaProductoLineaCredito[];
  onJerarquiasChange: (jerarquias: JerarquiaProductoLineaCredito[]) => void;
}

export function JerarquiaProductosLineaCreditoTab({ mode, jerarquias, onJerarquiasChange }: JerarquiaProductosLineaCreditoTabProps) {
  const [data, setData] = useState<JerarquiaProductoLineaCredito[]>(jerarquias);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showConsulta, setShowConsulta] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedItem, setSelectedItem] = useState<JerarquiaProductoLineaCredito | undefined>();
  const [showMenu, setShowMenu] = useState(false);
  const [filters, setFilters] = useState({
    producto: '',
    observaciones: '',
    sga: '',
  });

  const isViewMode = mode === 'view';

  // Sincronizar el estado local cuando cambian las jerarquías del prop
  useEffect(() => {
    setData(jerarquias);
  }, [jerarquias]);

  const handleDelete = () => {
    if (selectedRow === null) {
      toast.error('Debe seleccionar una fila');
      return;
    }
    const confirmed = window.confirm('¿Está seguro de eliminar este registro?');
    if (confirmed) {
      const newData = data.filter(item => item.id !== selectedRow);
      setData(newData);
      onJerarquiasChange(newData);
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
      const newItem: JerarquiaProductoLineaCredito = {
        id: Math.max(...data.map(d => d.id), 0) + 1,
        ...formData
      };
      const newData = [...data, newItem];
      setData(newData);
      onJerarquiasChange(newData);
      toast.success('Jerarquía de producto creada');
    } else if (formMode === 'edit') {
      const newData = data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d);
      setData(newData);
      onJerarquiasChange(newData);
      toast.success('Jerarquía de producto actualizada');
    }
    setShowFormModal(false);
  };

  const handleConsulta = () => {
    setShowConsulta(!showConsulta);
  };

  const handleRowDoubleClick = (item: JerarquiaProductoLineaCredito) => {
    if (isViewMode) {
      return;
    }
    setFormMode('edit');
    setSelectedItem(item);
    setShowFormModal(true);
  };

  // Aplicar filtros
  let filteredData = data.filter(item => {
    const matchesProducto = filters.producto === '' || item.producto.toLowerCase().includes(filters.producto.toLowerCase());
    const matchesObservaciones = filters.observaciones === '' || item.observaciones.toLowerCase().includes(filters.observaciones.toLowerCase());
    const matchesSga = filters.sga === '' || item.sga.toLowerCase().includes(filters.sga.toLowerCase());
    return matchesProducto && matchesObservaciones && matchesSga;
  });

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
                <label className="block text-xs text-gray-700 mb-1 font-medium">Producto</label>
                <input 
                  type="text"
                  value={filters.producto}
                  onChange={(e) => setFilters({...filters, producto: e.target.value})}
                  placeholder="Buscar producto..."
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
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">SGA</label>
                <input 
                  type="text"
                  value={filters.sga}
                  onChange={(e) => setFilters({...filters, sga: e.target.value})}
                  placeholder="Buscar SGA..."
                  className="w-full px-2 py-1 border border-gray-400 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setFilters({ producto: '', observaciones: '', sga: '' })}
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
                <th className="px-3 py-2 text-center font-medium text-xs border-r border-white/20">Principal</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Producto</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">% Límite Máximo</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20"># Límite Máximo</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Frecuencia Máx.</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Spread Mínimo</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">% Rentabilidad</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Observaciones</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">SGA</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">% SGA</th>
                <th className="px-3 py-2 text-left font-medium text-xs">MONTO SGA</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-gray-500 text-xs">No se encontraron registros</td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr 
                    key={item.id ?? `jerarquia-${index}`}
                    onClick={() => setSelectedRow(item.id)}
                    onDoubleClick={() => handleRowDoubleClick(item)}
                    className={`border-b border-gray-300 cursor-pointer transition-colors ${selectedRow === item.id ? 'bg-[#D6EAF8]' : index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'}`}
                  >
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300 text-center">
                      <input 
                        type="checkbox" 
                        checked={item.principal} 
                        readOnly 
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.producto}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.porcentajeLimiteMaximo}%</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.numeroLimiteMaximo}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.frecuenciaMaxima}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.spreadMinimo}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.porcentajeRentabilidad}%</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.observaciones}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.sga}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.porcentajeSga ? `${item.porcentajeSga}%` : ''}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">{item.montoSga || ''}</td>
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
  item?: JerarquiaProductoLineaCredito;
  onSave: (data: any) => void;
  onClose: () => void;
}

function FormModal({ mode, item, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    principal: item?.principal || false,
    producto: item?.producto || '',
    porcentajeLimiteMaximo: item?.porcentajeLimiteMaximo || '',
    numeroLimiteMaximo: item?.numeroLimiteMaximo || '',
    frecuenciaMaxima: item?.frecuenciaMaxima || '',
    spreadMinimo: item?.spreadMinimo || '',
    porcentajeRentabilidad: item?.porcentajeRentabilidad || '',
    observaciones: item?.observaciones || '',
    sga: item?.sga || '',
    porcentajeSga: item?.porcentajeSga || '',
    montoSga: item?.montoSga || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }

    // Validación de campos requeridos
    if (!formData.producto || !formData.porcentajeLimiteMaximo || !formData.numeroLimiteMaximo || 
        !formData.frecuenciaMaxima || !formData.spreadMinimo || !formData.porcentajeRentabilidad || !formData.sga) {
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
      <div className="bg-white shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">{mode === 'create' ? 'Nueva Jerarquía de Producto' : mode === 'edit' ? 'Editar Jerarquía de Producto' : 'Ver Jerarquía de Producto'}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE JERARQUÍA</span>
              </div>

              <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox" 
                    checked={formData.principal} 
                    onChange={(e) => handleChange('principal', e.target.checked)} 
                    disabled={isViewMode}
                    className="cursor-pointer"
                  />
                  <label className="text-xs text-gray-700 font-medium">Principal <span className="text-red-600">*</span></label>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Producto <span className="text-red-600">*</span></label>
                  <select 
                    value={formData.producto} 
                    onChange={(e) => handleChange('producto', e.target.value)} 
                    disabled={isViewMode} 
                    className={inputClassName()}
                  >
                    <option value="">Seleccionar...</option>
                    {productosDisponiblesLC.map((prod) => (
                      <option key={prod.id} value={prod.nombre}>
                        {prod.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">% Límite Máximo <span className="text-red-600">*</span></label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.porcentajeLimiteMaximo} 
                    onChange={(e) => handleChange('porcentajeLimiteMaximo', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="0.00"
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium"># Límite Máximo <span className="text-red-600">*</span></label>
                  <input 
                    type="number" 
                    value={formData.numeroLimiteMaximo} 
                    onChange={(e) => handleChange('numeroLimiteMaximo', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="999"
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Frecuencia Máx. <span className="text-red-600">*</span></label>
                  <input 
                    type="number" 
                    value={formData.frecuenciaMaxima} 
                    onChange={(e) => handleChange('frecuenciaMaxima', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="10"
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Spread Mínimo <span className="text-red-600">*</span></label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.spreadMinimo} 
                    onChange={(e) => handleChange('spreadMinimo', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="0.00"
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">% Rentabilidad <span className="text-red-600">*</span></label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.porcentajeRentabilidad} 
                    onChange={(e) => handleChange('porcentajeRentabilidad', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="45.00"
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">SGA <span className="text-red-600">*</span></label>
                  <select 
                    value={formData.sga} 
                    onChange={(e) => handleChange('sga', e.target.value)} 
                    disabled={isViewMode} 
                    className={inputClassName()}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Sí">Sí</option>
                    <option value="No">No</option>
                  </select>
                </div>

                <div className="col-span-3">
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Observaciones</label>
                  <input 
                    type="text" 
                    value={formData.observaciones} 
                    onChange={(e) => handleChange('observaciones', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Observaciones adicionales..."
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">% SGA</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.porcentajeSga} 
                    onChange={(e) => handleChange('porcentajeSga', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="0.00"
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">MONTO SGA</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.montoSga} 
                    onChange={(e) => handleChange('montoSga', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="0.00"
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