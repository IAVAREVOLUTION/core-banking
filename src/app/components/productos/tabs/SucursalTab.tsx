import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { organizations } from '@/app/data/mockData';
import { useTabPersistence } from '@/app/hooks/useProductoPersistence';

interface Sucursal {
  id: number;
  productId: number;
  branchId: number;
  branchName: string;
  location: string;
  assetBoolean: boolean;
}

interface SucursalTabProps {
  mode: 'create' | 'edit' | 'view';
  productId: number | string;
  initialData?: Sucursal[];
  persistToStorage?: boolean;
}

export const SucursalTab = forwardRef<{ getData: () => Sucursal[] }, SucursalTabProps>(
  ({ mode, productId, initialData, persistToStorage }, ref) => {
    const storageKey = persistToStorage && productId ? `credito_sucursal_${productId}` : '';

    // ══════════════════════════════════════════════════════════════
    // FIX: Sucursales es 100% manual. Sin defaults hardcodeados.
    // ══════════════════════════════════════════════════════════════
    const defaultSucursales: Sucursal[] = [];

    const isCreate = mode === 'create';
    if (isCreate && storageKey) {
      try { sessionStorage.removeItem(storageKey); } catch (_) { /* ignore */ }
    }

    const { data, setData } = useTabPersistence<Sucursal>(
      storageKey,
      initialData && initialData.length > 0 ? initialData : defaultSucursales
    );

    useImperativeHandle(ref, () => ({ getData: () => data }), [data]);

    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [showConsulta, setShowConsulta] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedItem, setSelectedItem] = useState<Sucursal | undefined>();
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

    const handleEdit = (item: Sucursal) => {
      if (isViewMode) {
        handleView(item);
        return;
      }
      setFormMode('edit');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleView = (item: Sucursal) => {
      setFormMode('view');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleSaveForm = (formData: any) => {
      if (formMode === 'create') {
        const newItem: Sucursal = {
          id: Math.max(...data.map(d => d.id), 0) + 1,
          productId: typeof productId === 'string' ? parseInt(productId) : productId,
          ...formData
        };
        setData([...data, newItem]);
        toast.success('Sucursal creada');
      } else if (formMode === 'edit') {
        setData(data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d));
        toast.success('Sucursal actualizada');
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
            <span className="text-sm font-medium text-gray-800">Sucursales</span>
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
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Sucursal</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Ubicación</th>
                  <th className="px-3 py-2 text-center font-medium text-xs whitespace-nowrap">Activo</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-gray-500 text-xs">No se encontraron registros</td>
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
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.branchName}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.location}</td>
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
          <FormModal mode={formMode} item={selectedItem} productId={productId} onSave={handleSaveForm} onClose={() => setShowFormModal(false)} />
        )}
      </>
    );
  }
);

SucursalTab.displayName = 'SucursalTab';

interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: Sucursal;
  productId: number | string;
  onSave: (data: any) => void;
  onClose: () => void;
}

function FormModal({ mode, item, productId, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    branchId: item?.branchId || 0,
    branchName: item?.branchName || '',
    location: item?.location || '',
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
      { field: 'branchId', label: 'Sucursal' },
      { field: 'location', label: 'Ubicación' },
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
    
    // Si cambia la sucursal, actualizar nombre y ubicación también
    if (field === 'branchId') {
      const branch = organizations.find(org => org.id === parseInt(value));
      if (branch) {
        setFormData(prev => ({ 
          ...prev, 
          branchName: branch.name,
          location: branch.location 
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
          <h3 className="text-sm font-medium text-white">{mode === 'create' ? 'Nueva Sucursal' : mode === 'edit' ? 'Editar Sucursal' : 'Ver Sucursal'}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE SUCURSAL</span>
              </div>

              <div className="grid grid-cols-1 gap-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Sucursal <span className="text-red-600">*</span></label>
                  <select 
                    value={formData.branchId} 
                    onChange={(e) => handleChange('branchId', e.target.value)} 
                    disabled={isViewMode} 
                    className={inputClassName()}
                  >
                    <option value="0">Seleccione...</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Ubicación <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    maxLength={30}
                    value={formData.location} 
                    readOnly
                    disabled={isViewMode} 
                    placeholder="Se autocompleta al seleccionar sucursal" 
                    className={`${inputClassName()} bg-gray-100`}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Activo <span className="text-red-600">*</span></label>
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="checkbox" 
                      checked={formData.assetBoolean} 
                      onChange={(e) => handleChange('assetBoolean', e.target.checked)} 
                      disabled={isViewMode} 
                      className="w-4 h-4" 
                    />
                    <span className="text-xs text-gray-700">Activar producto en esta sucursal</span>
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