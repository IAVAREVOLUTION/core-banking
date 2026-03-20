import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { K_PERIODS } from '@/app/data/mockData';
import { useTabPersistence } from '@/app/hooks/useProductoPersistence';

interface MatrizTasaFija {
  id: number;
  productId: number;
  periodo: string;
  plazoMinimo: number;
  plazoMaximo: number;
  plazoDefault: number;
  montoMinimo: number;
  montoMaximo: number;
  montoDefault: number;
  tasaMinima: string;
  tasaMaxima: string;
  tasaDefault: string;
}

interface PeriodoItem {
  id: number;
  periodoId: number;
  descripcion: string;
}

interface MatrizTasaFijaTabProps {
  mode: 'create' | 'edit' | 'view';
  productId: number | string;
  periodos?: PeriodoItem[];
  initialData?: MatrizTasaFija[];
  persistToStorage?: boolean;
  isSeguros?: boolean;
  storagePrefix?: string;
}

export const MatrizTasaFijaTab = forwardRef<{ getData: () => MatrizTasaFija[] }, MatrizTasaFijaTabProps>(
  ({ mode, productId, periodos, initialData, persistToStorage, isSeguros, storagePrefix }, ref) => {
    const prefix = storagePrefix || 'credito';
    const storageKey = persistToStorage && productId ? `${prefix}_matriztasafija_${productId}` : '';

    // ══════════════════════════════════════════════════════════════
    // FIX: Matriz Tasa Fija es 100% manual.
    // - En modo create: siempre vacío (sin defaults automáticos).
    // - En modo edit/view: solo mostrar datos guardados (initialData de BD).
    // - Si no hay datos guardados: vacío (sin registros de ejemplo).
    // ══════════════════════════════════════════════════════════════
    const defaultMatrizTasaFija: MatrizTasaFija[] = [];

    // Protección contra datos stale en sessionStorage:
    // En modo create, limpiar cualquier residuo del storage antes de inicializar
    if (mode === 'create' && storageKey) {
      try { sessionStorage.removeItem(storageKey); } catch (_) { /* ignore */ }
    }

    const { data, setData } = useTabPersistence<MatrizTasaFija>(
      storageKey,
      initialData && initialData.length > 0 ? initialData : defaultMatrizTasaFija
    );

    useImperativeHandle(ref, () => ({ getData: () => data }), [data]);

    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [showConsulta, setShowConsulta] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedItem, setSelectedItem] = useState<MatrizTasaFija | undefined>();
    const [showMenu, setShowMenu] = useState(false);

    const isViewMode = mode === 'view';
    
    // Obtener los periodos disponibles desde el prop o usar K_PERIODS como fallback
    const periodosDisponibles = periodos && periodos.length > 0 
      ? periodos.map(p => K_PERIODS.find(kp => kp.id === p.periodoId)?.descripcion || '').filter(Boolean)
      : K_PERIODS.map(p => p.descripcion);

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

    const handleEdit = (item: MatrizTasaFija) => {
      if (isViewMode) {
        handleView(item);
        return;
      }
      setFormMode('edit');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleView = (item: MatrizTasaFija) => {
      setFormMode('view');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleSaveForm = (formData: any) => {
      if (formMode === 'create') {
        const newItem: MatrizTasaFija = {
          id: Math.max(...data.map(d => d.id), 0) + 1,
          productId: typeof productId === 'number' ? productId : 0,
          ...formData
        };
        setData([...data, newItem]);
        toast.success('Matriz creada');
      } else if (formMode === 'edit') {
        setData(data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d));
        toast.success('Matriz actualizada');
      }
      setShowFormModal(false);
    };

    const handleConsulta = () => {
      setShowConsulta(!showConsulta);
    };

    return (
      <>
        <div className="bg-white">
          <div className="mb-3">
            <span className="text-sm font-medium text-gray-800">{isSeguros ? 'Montos y Coberturas' : 'Matriz de Tasa Fija'}</span>
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
              <div className="flex gap-2">
                <button onClick={() => setShowConsulta(false)} className="px-3 py-1 bg-gray-600 text-white text-xs hover:bg-gray-700">Cerrar</button>
              </div>
            </div>
          )}

          <div className="border border-gray-400 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#4A6FA5] text-white">
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Periodo</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Plazo Mínimo</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Plazo Máximo</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Plazo Default</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Monto Mínimo</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Monto Máximo</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Monto Default</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Tasa Mínima</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Tasa Máxima</th>
                  <th className="px-3 py-2 text-left font-medium text-xs">Tasa Default</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-6 text-center text-gray-500 text-xs">No se encontraron registros</td>
                  </tr>
                ) : (
                  data.map((item, index) => (
                    <tr 
                      key={item.id}
                      onClick={() => setSelectedRow(item.id)}
                      onDoubleClick={() => handleEdit(item)}
                      className={`border-b border-gray-300 cursor-pointer transition-colors ${selectedRow === item.id ? 'bg-[#D6EAF8]' : index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'}`}
                      onMouseEnter={(e) => {
                        if (selectedRow !== item.id) {
                          e.currentTarget.style.backgroundColor = '#E8F4F8';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedRow !== item.id) {
                          e.currentTarget.style.backgroundColor = index % 2 === 0 ? '#FFFFFF' : '#F9F9F9';
                        }
                      }}
                    >
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.periodo}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.plazoMinimo}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.plazoMaximo}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.plazoDefault}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{(item.montoMinimo ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{(item.montoMaximo ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{(item.montoDefault ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.tasaMinima}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.tasaMaxima}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">{item.tasaDefault}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-xs text-gray-600">
            <span className="font-medium">Total de registros: {data.length}</span>
          </div>
        </div>

        {showFormModal && (
          <FormModal mode={formMode} item={selectedItem} productId={productId} periodosDisponibles={periodosDisponibles} onSave={handleSaveForm} onClose={() => setShowFormModal(false)} />
        )}
      </>
    );
  }
);
MatrizTasaFijaTab.displayName = 'MatrizTasaFijaTab';

interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: MatrizTasaFija;
  productId: number | string;
  periodosDisponibles: string[];
  onSave: (data: any) => void;
  onClose: () => void;
}

function FormModal({ mode, item, productId, periodosDisponibles, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    periodo: item?.periodo || '',
    plazoMinimo: item?.plazoMinimo || 0,
    plazoMaximo: item?.plazoMaximo || 0,
    plazoDefault: item?.plazoDefault || 0,
    montoMinimo: item?.montoMinimo || 0,
    montoMaximo: item?.montoMaximo || 0,
    montoDefault: item?.montoDefault || 0,
    tasaMinima: item?.tasaMinima || '',
    tasaMaxima: item?.tasaMaxima || '',
    tasaDefault: item?.tasaDefault || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }

    // Validar campos requeridos
    const requiredFields = [
      { field: 'periodo', label: 'Periodo' },
      { field: 'plazoMinimo', label: 'Plazo Mínimo' },
      { field: 'plazoMaximo', label: 'Plazo Máximo' },
      { field: 'plazoDefault', label: 'Plazo Default' },
      { field: 'montoMinimo', label: 'Monto Mínimo' },
      { field: 'montoMaximo', label: 'Monto Máximo' },
      { field: 'montoDefault', label: 'Monto Default' },
      { field: 'tasaMinima', label: 'Tasa Mínima' },
      { field: 'tasaMaxima', label: 'Tasa Máxima' },
      { field: 'tasaDefault', label: 'Tasa Default' },
    ];

    const emptyFields = requiredFields.filter(({ field }) => {
      const value = formData[field as keyof typeof formData];
      if (typeof value === 'string') {
        return value.trim() === '';
      }
      return value === 0 || value === null || value === undefined;
    });

    if (emptyFields.length > 0) {
      const fieldNames = emptyFields.map(({ label }) => label).join(', ');
      toast.error('Campos requeridos faltantes', {
        description: `Por favor complete los siguientes campos: ${fieldNames}`,
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
          <h3 className="text-sm font-medium text-white">{mode === 'create' ? 'Nueva Matriz de Tasa Fija' : mode === 'edit' ? 'Editar Matriz de Tasa Fija' : 'Ver Matriz de Tasa Fija'}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE MATRIZ</span>
              </div>

              <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Periodo <span className="text-red-600">*</span></label>
                  <select 
                    value={formData.periodo} 
                    onChange={(e) => handleChange('periodo', e.target.value)} 
                    disabled={isViewMode} 
                    className={inputClassName()}
                  >
                    <option value="">Seleccione...</option>
                    {periodosDisponibles.map((periodo) => (
                      <option key={periodo} value={periodo}>{periodo}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Plazo Mínimo <span className="text-red-600">*</span></label>
                  <input 
                    type="number" 
                    value={formData.plazoMinimo || ''} 
                    onChange={(e) => handleChange('plazoMinimo', e.target.value === '' ? 0 : parseInt(e.target.value))} 
                    disabled={isViewMode} 
                    placeholder="0" 
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Plazo Máximo <span className="text-red-600">*</span></label>
                  <input 
                    type="number" 
                    value={formData.plazoMaximo || ''} 
                    onChange={(e) => handleChange('plazoMaximo', e.target.value === '' ? 0 : parseInt(e.target.value))} 
                    disabled={isViewMode} 
                    placeholder="0" 
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Plazo Default <span className="text-red-600">*</span></label>
                  <input 
                    type="number" 
                    value={formData.plazoDefault || ''} 
                    onChange={(e) => handleChange('plazoDefault', e.target.value === '' ? 0 : parseInt(e.target.value))} 
                    disabled={isViewMode} 
                    placeholder="0" 
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Monto Mínimo <span className="text-red-600">*</span></label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={formData.montoMinimo || ''} 
                    onChange={(e) => handleChange('montoMinimo', e.target.value === '' ? 0 : parseFloat(e.target.value))} 
                    disabled={isViewMode} 
                    placeholder="0.00" 
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Monto Máximo <span className="text-red-600">*</span></label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={formData.montoMaximo || ''} 
                    onChange={(e) => handleChange('montoMaximo', e.target.value === '' ? 0 : parseFloat(e.target.value))} 
                    disabled={isViewMode} 
                    placeholder="0.00" 
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Monto Default <span className="text-red-600">*</span></label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={formData.montoDefault || ''} 
                    onChange={(e) => handleChange('montoDefault', e.target.value === '' ? 0 : parseFloat(e.target.value))} 
                    disabled={isViewMode} 
                    placeholder="0.00" 
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Tasa Mínima <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    maxLength={5}
                    value={formData.tasaMinima} 
                    onChange={(e) => handleChange('tasaMinima', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="0.00" 
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Tasa Máxima <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    maxLength={5}
                    value={formData.tasaMaxima} 
                    onChange={(e) => handleChange('tasaMaxima', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="0.00" 
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Tasa Default <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    maxLength={5}
                    value={formData.tasaDefault} 
                    onChange={(e) => handleChange('tasaDefault', e.target.value)} 
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
                <button type="submit" className="px-4 py-1.5 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91]">Guardar</button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}