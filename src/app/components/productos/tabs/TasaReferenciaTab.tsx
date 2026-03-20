import { useState } from 'react';
import { toast } from 'sonner';

interface TasaReferencia {
  id: number;
  productId: number;
  tasaReferenciaId: number;
  tasaReferenciaNombre: string;
  moneda: string;
  activo: boolean;
}

interface TasaReferenciaItem {
  id: number;
  productId: number;
  tasaReferenciaId: number;
  tasaReferenciaNombre: string;
  moneda: string;
  activo: boolean;
}

interface TasaReferenciaTabProps {
  mode: 'create' | 'edit' | 'view';
  productId: number;
  tasasReferencia: TasaReferenciaItem[];
  setTasasReferencia: React.Dispatch<React.SetStateAction<TasaReferenciaItem[]>>;
}

// Catálogo de tasas de referencia (K_REFERENCE_RATE)
const K_REFERENCE_RATE = [
  { id: 1, nombre: 'TIIE' },
  { id: 2, nombre: 'Tasa Objetivo de Banxico' },
  { id: 3, nombre: 'CETES' },
  { id: 4, nombre: 'Tasa de Fondeo Gubernamental' },
  { id: 5, nombre: 'LIBOR' },
];

const MONEDA_OPTIONS = ['USD', 'MXN'];

export function TasaReferenciaTab({ mode, productId, tasasReferencia, setTasasReferencia }: TasaReferenciaTabProps) {
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showConsulta, setShowConsulta] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedItem, setSelectedItem] = useState<TasaReferencia | undefined>();
  const [showMenu, setShowMenu] = useState(false);

  const isViewMode = mode === 'view';

  const handleDelete = () => {
    if (selectedRow === null) {
      toast.error('Debe seleccionar una fila');
      return;
    }
    const confirmed = window.confirm('¿Está seguro de eliminar este registro?');
    if (confirmed) {
      setTasasReferencia(tasasReferencia.filter(item => item.id !== selectedRow));
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

  const handleEdit = (item: TasaReferencia) => {
    if (isViewMode) {
      handleView(item);
      return;
    }
    setFormMode('edit');
    setSelectedItem(item);
    setShowFormModal(true);
  };

  const handleView = (item: TasaReferencia) => {
    setFormMode('view');
    setSelectedItem(item);
    setShowFormModal(true);
  };

  const handleSaveForm = (formData: any) => {
    if (formMode === 'create') {
      const newItem: TasaReferencia = {
        id: Math.max(...tasasReferencia.map(d => d.id), 0) + 1,
        productId: productId,
        ...formData
      };
      setTasasReferencia([...tasasReferencia, newItem]);
      toast.success('Tasa de referencia creada');
    } else if (formMode === 'edit') {
      setTasasReferencia(tasasReferencia.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d));
      toast.success('Tasa de referencia actualizada');
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
          <span className="text-sm font-medium text-gray-800">Tasa Referencia</span>
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
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Tasa Referencia</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Moneda</th>
                <th className="px-3 py-2 text-center font-medium text-xs">Activo</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {tasasReferencia.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-gray-500 text-xs">No se encontraron registros</td>
                </tr>
              ) : (
                tasasReferencia.map((item, index) => (
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
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.tasaReferenciaNombre}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.moneda}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 text-center">
                      <input type="checkbox" checked={item.activo} readOnly className="w-4 h-4 pointer-events-none" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-xs text-gray-600">
          <span className="font-medium">Total de registros: {tasasReferencia.length}</span>
        </div>
      </div>

      {showFormModal && (
        <FormModal mode={formMode} item={selectedItem} productId={productId} onSave={handleSaveForm} onClose={() => setShowFormModal(false)} />
      )}
    </>
  );
}

interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: TasaReferencia;
  productId: number;
  onSave: (data: any) => void;
  onClose: () => void;
}

function FormModal({ mode, item, productId, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    tasaReferenciaId: item?.tasaReferenciaId || 0,
    tasaReferenciaNombre: item?.tasaReferenciaNombre || '',
    moneda: item?.moneda || '',
    activo: item?.activo !== undefined ? item.activo : true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }

    // Validar campos requeridos
    const requiredFields = [
      { field: 'tasaReferenciaNombre', label: 'Tasa Referencia' },
      { field: 'moneda', label: 'Moneda' },
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
      <div className="bg-white shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">{mode === 'create' ? 'Nueva Tasa de Referencia' : mode === 'edit' ? 'Editar Tasa de Referencia' : 'Ver Tasa de Referencia'}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE TASA REFERENCIA</span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Tasa Referencia <span className="text-red-600">*</span></label>
                  <input 
                    type="text"
                    value={formData.tasaReferenciaNombre} 
                    onChange={(e) => handleChange('tasaReferenciaNombre', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ingrese la tasa de referencia"
                    className={inputClassName()}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Moneda <span className="text-red-600">*</span></label>
                  <select 
                    value={formData.moneda} 
                    onChange={(e) => handleChange('moneda', e.target.value)} 
                    disabled={isViewMode} 
                    className={inputClassName()}
                  >
                    <option value="">Seleccione...</option>
                    {MONEDA_OPTIONS.map((moneda) => (
                      <option key={moneda} value={moneda}>{moneda}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Activo <span className="text-red-600">*</span></label>
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="checkbox" 
                      checked={formData.activo} 
                      onChange={(e) => handleChange('activo', e.target.checked)} 
                      disabled={isViewMode} 
                      className="w-4 h-4" 
                    />
                    <span className="text-xs text-gray-700">Activar tasa de referencia</span>
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