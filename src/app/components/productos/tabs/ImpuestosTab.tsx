import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { K_TAX_TYPES } from '@/app/data/mockData';
import { useTabPersistence } from '@/app/hooks/useProductoPersistence';

interface Impuesto {
  id: number;
  productId: number;
  personality: string;
  taxTypeId: number;
  taxTypeName: string;
  percentage: string;
  baseConcept: string;
  assetBoolean: boolean;
}

interface ImpuestosTabProps {
  mode: 'create' | 'edit' | 'view';
  productId: number | string;
  initialData?: Impuesto[];
  persistToStorage?: boolean;
}

// Opciones para el campo Personalidad
const PERSONALITY_OPTIONS = [
  'Física',
  'Moral',
  'Física con Actividad Empresarial',
];

export const ImpuestosTab = forwardRef<{ getData: () => Impuesto[] }, ImpuestosTabProps>(
  ({ mode, productId, initialData, persistToStorage }, ref) => {
    const storageKey = persistToStorage && productId ? `credito_impuestos_${productId}` : '';

    // ══════════════════════════════════════════════════════════════
    // FIX: Impuestos es 100% manual. Sin defaults hardcodeados.
    // ══════════════════════════════════════════════════════════════
    const defaultImpuestos: Impuesto[] = [];

    const isCreate = mode === 'create';
    if (isCreate && storageKey) {
      try { sessionStorage.removeItem(storageKey); } catch (_) { /* ignore */ }
    }

    const { data, setData } = useTabPersistence<Impuesto>(
      storageKey,
      initialData && initialData.length > 0 ? initialData : defaultImpuestos
    );

    useImperativeHandle(ref, () => ({ getData: () => data }), [data]);

    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [showConsulta, setShowConsulta] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedItem, setSelectedItem] = useState<Impuesto | undefined>();
    const [showMenu, setShowMenu] = useState(false);

    const isViewMode = mode === 'view';

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

    const handleEdit = (item: Impuesto) => {
      if (isViewMode) {
        handleView(item);
        return;
      }
      setFormMode('edit');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleView = (item: Impuesto) => {
      setFormMode('view');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleSaveForm = (formData: any) => {
      if (formMode === 'create') {
        const newItem: Impuesto = {
          id: Math.max(...data.map(d => d.id), 0) + 1,
          productId: typeof productId === 'number' ? productId : 0,
          ...formData
        };
        setData([...data, newItem]);
        toast.success('Impuesto creado');
      } else if (formMode === 'edit') {
        setData(data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d));
        toast.success('Impuesto actualizado');
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
            <span className="text-sm font-medium text-gray-800">Impuestos</span>
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
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Personalidad</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Tipo Impuesto</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Porcentaje</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Concepto Base</th>
                  <th className="px-3 py-2 text-center font-medium text-xs whitespace-nowrap">Activo</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500 text-xs">No se encontraron registros</td>
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
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.personality}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.taxTypeName}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.percentage}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.baseConcept}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 text-center">
                        <input type="checkbox" checked={item.assetBoolean} readOnly className="w-4 h-4 pointer-events-none" />
                      </td>
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
          <FormModal 
            mode={formMode} 
            item={selectedItem} 
            productId={typeof productId === 'number' ? productId : 0} 
            onSave={handleSaveForm} 
            onClose={() => setShowFormModal(false)} 
          />
        )}
      </>
    );
  }
);

ImpuestosTab.displayName = 'ImpuestosTab';

interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: Impuesto;
  productId: number;
  onSave: (data: any) => void;
  onClose: () => void;
}

function FormModal({ mode, item, productId, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    personality: item?.personality || '',
    taxTypeId: item?.taxTypeId || 0,
    taxTypeName: item?.taxTypeName || '',
    percentage: item?.percentage || '',
    baseConcept: item?.baseConcept || '',
    assetBoolean: item?.assetBoolean !== undefined ? item.assetBoolean : true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }

    // Validar campos requeridos
    const requiredFields = [
      { field: 'personality', label: 'Personalidad' },
      { field: 'taxTypeId', label: 'Tipo Impuesto' },
      { field: 'percentage', label: 'Porcentaje' },
      { field: 'baseConcept', label: 'Concepto Base' },
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

    // Validar longitud máxima de Personalidad (VARCHAR 30)
    if (formData.personality.length > 30) {
      toast.error('Personalidad no puede exceder 30 caracteres');
      return;
    }

    // Validar longitud máxima de Porcentaje (VARCHAR 30)
    if (formData.percentage.length > 30) {
      toast.error('Porcentaje no puede exceder 30 caracteres');
      return;
    }

    // Validar longitud máxima de Concepto Base (VARCHAR 50)
    if (formData.baseConcept.length > 50) {
      toast.error('Concepto Base no puede exceder 50 caracteres');
      return;
    }

    onSave(formData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    
    // Si cambia el tipo de impuesto, actualizar el nombre también
    if (field === 'taxTypeId') {
      const taxType = K_TAX_TYPES.find(t => t.id === parseInt(value));
      if (taxType) {
        setFormData(prev => ({ 
          ...prev, 
          taxTypeName: taxType.descripcion 
        }));
      }
    }
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
          <h3 className="text-sm font-medium text-white">{mode === 'create' ? 'Nuevo Impuesto' : mode === 'edit' ? 'Editar Impuesto' : 'Ver Impuesto'}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE IMPUESTO</span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Personalidad <span className="text-red-600">*</span></label>
                  <select 
                    value={formData.personality} 
                    onChange={(e) => handleChange('personality', e.target.value)} 
                    disabled={isViewMode} 
                    className={inputClassName()}
                  >
                    <option value="">Seleccione...</option>
                    {PERSONALITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-gray-500 italic">Máximo 30 caracteres</span>
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Tipo Impuesto <span className="text-red-600">*</span></label>
                  <select 
                    value={formData.taxTypeId} 
                    onChange={(e) => handleChange('taxTypeId', e.target.value)} 
                    disabled={isViewMode} 
                    className={inputClassName()}
                  >
                    <option value="0">Seleccione...</option>
                    {K_TAX_TYPES.map((taxType) => (
                      <option key={taxType.id} value={taxType.id}>{taxType.descripcion}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Porcentaje <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    maxLength={30}
                    value={formData.percentage} 
                    onChange={(e) => handleChange('percentage', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ej: 16, 16.00, 10.5" 
                    className={inputClassName()} 
                  />
                  <span className="text-[10px] text-gray-500 italic">Máximo 30 caracteres</span>
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Concepto Base <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    maxLength={50}
                    value={formData.baseConcept} 
                    onChange={(e) => handleChange('baseConcept', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ingrese concepto base" 
                    className={inputClassName()} 
                  />
                  <span className="text-[10px] text-gray-500 italic">Máximo 50 caracteres</span>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Activo</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="checkbox" 
                      checked={formData.assetBoolean} 
                      onChange={(e) => handleChange('assetBoolean', e.target.checked)} 
                      disabled={isViewMode} 
                      className="w-4 h-4" 
                    />
                    <span className="text-xs text-gray-700">Activar impuesto</span>
                  </div>
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