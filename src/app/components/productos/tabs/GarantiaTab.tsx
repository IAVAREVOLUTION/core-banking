import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import React from 'react';

interface Garantia {
  id: number;
  tipo: string;
  subtipo: string;
  descripcion: string;
  aforo: string;
}

interface GarantiaTabProps {
  mode: 'nuevo' | 'editar' | 'ver' | 'create' | 'edit' | 'view';
  productId?: number | string;
  initialData?: Garantia[];
  persistToStorage?: boolean;
}

const defaultGarantiasData: Garantia[] = [];

const GARANTIAS_MOCK: Garantia[] = [
  { id: 1, tipo: 'Mueble', subtipo: 'Automóvil', descripcion: 'Inventario completo de mercancía en tienda...', aforo: '100.00' },
  { id: 2, tipo: 'Inmueble', subtipo: 'Departamento', descripcion: 'Casa habitación de 3 recámaras, 2 baños co...', aforo: '200.00' },
  { id: 3, tipo: 'Inmueble', subtipo: 'Terreno', descripcion: 'Terreno urbano con servicios de 500 m2...', aforo: '300.00' },
];

export const GarantiaTab = forwardRef<{ getData: () => Garantia[] }, GarantiaTabProps>(
  ({ mode, productId, initialData, persistToStorage = true }, ref) => {
    const storageKey = persistToStorage && productId ? `credito_garantias_${productId}` : '';

    const getInitialData = (): Garantia[] => {
      if (storageKey) {
        try {
          const stored = sessionStorage.getItem(storageKey);
          if (stored) {
            const parsed = JSON.parse(stored);
            // Si storage tiene datos reales, usarlos
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            // Si storage tiene [] vacío pero initialData tiene datos de BD, preferir BD
            if (Array.isArray(parsed) && parsed.length === 0 && initialData && initialData.length > 0) {
              console.log(`[GarantiaTab] Storage vacío pero initialData tiene ${initialData.length} registros — usando datos de BD`);
              sessionStorage.setItem(storageKey, JSON.stringify(initialData));
              return initialData;
            }
          }
        } catch (e) { /* ignore */ }
      }
      if (initialData && initialData.length > 0) return initialData;
      return defaultGarantiasData;
    };

    const [data, setData] = useState<Garantia[]>(getInitialData);

    // ── Seed from DB: safety net para cuando useState arrancó vacío
    // pero initialData tiene datos reales (race condition o StrictMode) ──
    const seededRef = React.useRef(false);
    useEffect(() => {
      if (!seededRef.current && initialData && initialData.length > 0 && data.length === 0) {
        console.log(`[GarantiaTab] Seeding ${initialData.length} garantías from DB (initialData)`);
        setData(initialData);
        seededRef.current = true;
      }
    }, [initialData, data.length]);

    useImperativeHandle(ref, () => ({ getData: () => data }));

    useEffect(() => {
      if (storageKey) {
        try { sessionStorage.setItem(storageKey, JSON.stringify(data)); } catch (e) { /* ignore */ }
      }
    }, [data, storageKey]);

    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [showConsulta, setShowConsulta] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedItem, setSelectedItem] = useState<Garantia | undefined>();
    const [showMenu, setShowMenu] = useState(false);
    const [filters, setFilters] = useState({
      tipo: '',
      subtipo: '',
      descripcion: '',
    });

    const isViewMode = mode === 'ver' || mode === 'view';

    const handleDelete = () => {
      if (selectedRow === null) {
        toast.error('Debe seleccionar una fila', {
          description: 'Seleccione un registro antes de eliminar',
        });
        return;
      }
      const confirmed = window.confirm('¿Está seguro de eliminar este registro?');
      if (confirmed) {
        setData(data.filter(item => item.id !== selectedRow));
        setSelectedRow(null);
        toast.success('Registro eliminado', {
          description: 'La garantía ha sido eliminada correctamente',
        });
      }
    };

    const handleNew = () => {
      if (isViewMode) {
        toast.warning('Modo solo lectura', {
          description: 'No se pueden crear registros en modo de visualización',
        });
        return;
      }
      setFormMode('create');
      setSelectedItem(undefined);
      setShowFormModal(true);
    };

    const handleEdit = (item: Garantia) => {
      if (isViewMode) {
        handleView(item);
        return;
      }
      setFormMode('edit');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleView = (item: Garantia) => {
      setFormMode('view');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleSaveForm = (formData: any) => {
      if (formMode === 'create') {
        const newItem: Garantia = {
          id: data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 1,
          ...formData
        };
        setData([...data, newItem]);
        toast.success('Garantía creada', {
          description: 'La garantía ha sido agregada correctamente',
        });
      } else if (formMode === 'edit') {
        setData(data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d));
        toast.success('Garantía actualizada', {
          description: 'Los cambios han sido guardados correctamente',
        });
      }
      setShowFormModal(false);
    };

    const handleConsulta = () => {
      setShowConsulta(!showConsulta);
    };

    const handleExportExcel = () => {
      toast.success('Exportando a Excel', { description: 'Generando archivo Excel...' });
    };
    const handleExportCSV = () => {
      toast.success('Exportando a CSV', { description: 'Generando archivo CSV...' });
    };
    const handleExportPDF = () => {
      toast.success('Exportando a PDF', { description: 'Generando archivo PDF...' });
    };
    const handlePrint = () => {
      toast.success('Imprimiendo', { description: 'Enviando a impresora...' });
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
          {/* Header con título */}
          <div className="mb-3">
            <span className="text-sm font-medium text-gray-800">Garantías</span>
          </div>

          {/* Barra de botones de acciones */}
          <div className="flex items-center gap-2 mb-3">
            {/* Botón Menú con dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="px-3 py-1 btn-primary-theme text-xs border border-transparent flex items-center gap-1"
              >
                Menú
                <svg width="10" height="6" viewBox="0 0 10 6" fill="white">
                  <path d="M0 0l5 6 5-6z"/>
                </svg>
              </button>
              {showMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-400 shadow-lg z-10 min-w-[140px]">
                  <button onClick={() => { handleExportExcel(); setShowMenu(false); }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200">Exportar a Excel</button>
                  <button onClick={() => { handleExportCSV(); setShowMenu(false); }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200">Exportar a CSV</button>
                  <button onClick={() => { handleExportPDF(); setShowMenu(false); }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200">Exportar a PDF</button>
                  <button onClick={() => { handlePrint(); setShowMenu(false); }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100">Imprimir</button>
                </div>
              )}
            </div>

            <button 
              onClick={handleNew}
              disabled={isViewMode}
              className="px-3 py-1 btn-primary-theme text-xs border border-transparent disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Nuevo
            </button>

            <button 
              onClick={handleDelete}
              disabled={selectedRow === null || isViewMode}
              className="px-3 py-1 btn-primary-theme text-xs border border-transparent disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Eliminar
            </button>

            <button 
              onClick={handleConsulta}
              className="px-3 py-1 btn-primary-theme text-xs border border-transparent"
            >
              Consulta
            </button>
          </div>

          {/* Panel de Consulta/Filtros */}
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

          {/* Tabla */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead className="table-header-theme">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-white/90 text-[11px] uppercase tracking-wide border-r border-white/20">Tipo</th>
                  <th className="px-3 py-2 text-left font-semibold text-white/90 text-[11px] uppercase tracking-wide border-r border-white/20">Subtipo</th>
                  <th className="px-3 py-2 text-left font-semibold text-white/90 text-[11px] uppercase tracking-wide border-r border-white/20">Descripción</th>
                  <th className="px-3 py-2 text-left font-semibold text-white/90 text-[11px] uppercase tracking-wide">Aforo</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-gray-500 text-xs">
                      No se encontraron registros
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, index) => (
                    <tr 
                      key={item.id != null ? item.id : `garantia-${index}`}
                      onClick={() => setSelectedRow(item.id)}
                      onDoubleClick={() => isViewMode ? handleView(item) : handleEdit(item)}
                      className={`border-b border-gray-200 cursor-pointer transition-colors ${
                        selectedRow === item.id
                          ? 'row-selected-theme !text-white'
                          : index % 2 === 0 ? 'bg-white row-hover-theme' : 'bg-gray-50/60 row-hover-theme'
                      }`}
                    >
                      <td className="px-3 py-2 text-xs border-r border-gray-200">{item.tipo}</td>
                      <td className="px-3 py-2 text-xs border-r border-gray-200">{item.subtipo}</td>
                      <td className="px-3 py-2 text-xs border-r border-gray-200">{item.descripcion}</td>
                      <td className="px-3 py-2 text-xs">{item.aforo}%</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Información de registros */}
          <div className="mt-2 text-xs text-gray-600">
            <span className="font-medium">Total de registros: {filteredData.length}</span>
            {selectedRow !== null && (
              <span className="ml-4">| Seleccionado: {data.find(d => d.id === selectedRow)?.tipo} - {data.find(d => d.id === selectedRow)?.subtipo}</span>
            )}
          </div>
        </div>

        {/* Modal de Formulario */}
        {showFormModal && (
          <FormModal
            mode={formMode}
            item={selectedItem}
            onSave={handleSaveForm}
            onClose={() => setShowFormModal(false)}
          />
        )}
      </>
    );
  }
);

GarantiaTab.displayName = 'GarantiaTab';

// Componente de Modal de Formulario
interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: Garantia;
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

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.tipo) newErrors.tipo = 'El tipo de garantía es requerido';
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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) { onClose(); return; }
    if (!validate()) {
      toast.error('Formulario incompleto', { description: 'Por favor complete todos los campos requeridos' });
      return;
    }
    // Formatear aforo a dos decimales al guardar
    const formatted = {
      ...formData,
      aforo: parseFloat(formData.aforo).toFixed(2),
    };
    onSave(formatted);
  };

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) setErrors({ ...errors, [field]: '' });
  };

  const getTitle = () => {
    if (mode === 'create') return 'Nueva Garantía';
    if (mode === 'edit') return 'Editar Garantía';
    return 'Ver Garantía';
  };

  const inputClassName = (fieldName: string) => {
    const baseClass = 'w-full px-2 py-1 text-xs';
    const errorClass = errors[fieldName] ? 'border-2 border-red-500' : 'border border-gray-400';
    if (isViewMode) return `${baseClass} border-0 bg-transparent text-gray-700 cursor-default`;
    return `${baseClass} ${errorClass}`;
  };

  // Subtipos dinámicos según el tipo
  const getSubtipos = () => {
    if (formData.tipo === 'Mueble') {
      return ['Automóvil', 'Maquinaria', 'Equipo de Cómputo', 'Inventario', 'Otro Mueble'];
    }
    if (formData.tipo === 'Inmueble') {
      return ['Terreno', 'Casa Habitación', 'Departamento', 'Local Comercial', 'Nave Industrial', 'Otro Inmueble'];
    }
    return [];
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={onClose}>
      <div className="bg-white shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col rounded-lg" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header-theme px-5 py-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white tracking-wide uppercase">{getTitle()}</h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-primary-tint-theme px-3 py-1.5 mb-3 border-l-4 border-primary-theme">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE GARANTÍA</span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Tipo <span className="text-red-600">*</span></label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => {
                      handleChange('tipo', e.target.value);
                      // Reset subtipo al cambiar tipo
                      setFormData(prev => ({ ...prev, tipo: e.target.value, subtipo: '' }));
                      if (errors.subtipo) setErrors(prev => ({ ...prev, subtipo: '' }));
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
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => handleChange('descripcion', e.target.value)}
                    disabled={isViewMode}
                    rows={3}
                    placeholder="Descripción de la garantía..."
                    className={inputClassName('descripcion') + ' resize-none'}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Aforo (%) <span className="text-red-600">*</span></label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.aforo}
                      onChange={(e) => {
                        const val = e.target.value;
                        // Permitir vacío, o números con hasta 2 decimales
                        if (val === '' || /^\d{0,4}(\.\d{0,2})?$/.test(val)) {
                          handleChange('aforo', val);
                        }
                      }}
                      onBlur={() => {
                        // Formatear a 2 decimales al perder foco si tiene valor
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

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-4 border-t border-gray-300">
              {!isViewMode && (
                <button type="submit" className="px-5 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium transition-colors shadow-sm">
                  {mode === 'edit' ? 'Guardar Cambios' : 'Crear Garantía'}
                </button>
              )}
              <button type="button" onClick={onClose} className="px-4 py-1.5 rounded text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors">
                {isViewMode ? 'Cerrar' : 'Cancelar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}