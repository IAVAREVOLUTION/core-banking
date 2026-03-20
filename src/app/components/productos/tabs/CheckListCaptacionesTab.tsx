import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { CheckListCaptacion } from '@/types/checkListCaptacion';
import { K_PHASES } from '@/app/data/mockData';
import { toast } from 'sonner';

interface CheckListCaptacionesTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
  productId?: number | string;
  initialData?: CheckListCaptacion[];
}

export const CheckListCaptacionesTab = forwardRef<{ getData: () => CheckListCaptacion[] }, CheckListCaptacionesTabProps>(
  ({ mode, productId, initialData }, ref) => {
    const storageKey = productId ? `captacion_checklist_${productId}` : '';

    const getInitialData = (): CheckListCaptacion[] => {
      if (storageKey) {
        try {
          const stored = sessionStorage.getItem(storageKey);
          if (stored) return JSON.parse(stored);
        } catch (e) { /* ignore */ }
      }
      if (initialData && initialData.length > 0) return initialData;
      // FIX: Sin registros automáticos. Vacío hasta captura manual del usuario.
      return [];
    };

    const [data, setData] = useState<CheckListCaptacion[]>(getInitialData);
    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [showConsulta, setShowConsulta] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedItem, setSelectedItem] = useState<CheckListCaptacion | undefined>();
    const [showMenu, setShowMenu] = useState(false);
    const [filters, setFilters] = useState({
      tipoPersona: '',
      tipoDocumento: '',
      fase: ''
    });

    useImperativeHandle(ref, () => ({ getData: () => data }));

    useEffect(() => {
      if (storageKey) {
        try { sessionStorage.setItem(storageKey, JSON.stringify(data)); } catch (e) { /* ignore */ }
      }
    }, [data, storageKey]);

    const isViewMode = mode === 'ver';

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
          description: 'El documento ha sido eliminado correctamente',
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

    const handleEdit = (item: CheckListCaptacion) => {
      if (isViewMode) {
        handleView(item);
        return;
      }
      setFormMode('edit');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleView = (item: CheckListCaptacion) => {
      setFormMode('view');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleSaveForm = (formData: any) => {
      if (formMode === 'create') {
        const newItem: CheckListCaptacion = {
          id: Math.max(...data.map(d => d.id)) + 1,
          ...formData
        };
        setData([...data, newItem]);
        toast.success('Documento creado', {
          description: 'El documento ha sido agregado al check list',
        });
      } else if (formMode === 'edit') {
        setData(data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d));
        toast.success('Documento actualizado', {
          description: 'Los cambios han sido guardados correctamente',
        });
      }
      setShowFormModal(false);
    };

    const handleConsulta = () => {
      setShowConsulta(!showConsulta);
    };

    const handleExportExcel = () => {
      toast.success('Exportando a Excel', {
        description: 'Generando archivo Excel...',
      });
    };

    const handleExportCSV = () => {
      toast.success('Exportando a CSV', {
        description: 'Generando archivo CSV...',
      });
    };

    const handleExportPDF = () => {
      toast.success('Exportando a PDF', {
        description: 'Generando archivo PDF...',
      });
    };

    const handlePrint = () => {
      toast.success('Imprimiendo', {
        description: 'Enviando a impresora...',
      });
    };

    // Aplicar filtros
    let filteredData = data.filter(item => {
      const matchesTipoPersona = filters.tipoPersona === '' || item.tipoPersona === filters.tipoPersona;
      const matchesTipoDocumento = filters.tipoDocumento === '' || item.tipoDocumento.toLowerCase().includes(filters.tipoDocumento.toLowerCase());
      const matchesFase = filters.fase === '' || item.fases.toLowerCase().includes(filters.fase.toLowerCase());

      return matchesTipoPersona && matchesTipoDocumento && matchesFase;
    });

    return (
      <>
        <div className="bg-white">
          {/* Header con título */}
          <div className="mb-3">
            <span className="text-sm font-medium text-gray-800">Documentación Captaciones</span>
          </div>

          {/* Barra de botones de acciones */}
          <div className="flex items-center gap-2 mb-3">
            {/* Botón Menú con dropdown */}
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
                  <button 
                    onClick={() => { handleExportExcel(); setShowMenu(false); }}
                    className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200"
                  >
                    Exportar a Excel
                  </button>
                  <button 
                    onClick={() => { handleExportCSV(); setShowMenu(false); }}
                    className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200"
                  >
                    Exportar a CSV
                  </button>
                  <button 
                    onClick={() => { handleExportPDF(); setShowMenu(false); }}
                    className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200"
                  >
                    Exportar a PDF
                  </button>
                  <button 
                    onClick={() => { handlePrint(); setShowMenu(false); }}
                    className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                  >
                    Imprimir
                  </button>
                </div>
              )}
            </div>

            <button 
              onClick={handleNew}
              disabled={isViewMode}
              className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed"
            >
              Nuevo
            </button>

            <button 
              onClick={handleDelete}
              disabled={selectedRow === null || isViewMode}
              className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed"
            >
              Eliminar
            </button>

            <button 
              onClick={handleConsulta}
              className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91]"
            >
              Consulta
            </button>
          </div>

          {/* Panel de Consulta/Filtros */}
          {showConsulta && (
            <div className="mb-3 p-3 bg-[#F5F5F5] border border-gray-400">
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Tipo Persona</label>
                  <select 
                    value={filters.tipoPersona}
                    onChange={(e) => setFilters({...filters, tipoPersona: e.target.value})}
                    className="w-full px-2 py-1 border border-gray-400 text-xs bg-white"
                  >
                    <option value="">Todos</option>
                    <option value="Física">Física</option>
                    <option value="Moral">Moral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Tipo Documento</label>
                  <input 
                    type="text"
                    value={filters.tipoDocumento}
                    onChange={(e) => setFilters({...filters, tipoDocumento: e.target.value})}
                    placeholder="Buscar documento..."
                    className="w-full px-2 py-1 border border-gray-400 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Fase</label>
                  <input 
                    type="text"
                    value={filters.fase}
                    onChange={(e) => setFilters({...filters, fase: e.target.value})}
                    placeholder="Ej: Apertura"
                    className="w-full px-2 py-1 border border-gray-400 text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setFilters({ tipoPersona: '', tipoDocumento: '', fase: '' })}
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
          <div className="border border-gray-400">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#4A6FA5] text-white">
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Tipo persona</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Tipo documento</th>
                  <th className="px-3 py-2 text-center font-medium text-xs border-r border-white/20">Requerido</th>
                  <th className="px-3 py-2 text-center font-medium text-xs border-r border-white/20">Permanente</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Descripción</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Requerido Por</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Esquema de Firma</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Procede</th>
                  <th className="px-3 py-2 text-left font-medium text-xs">Fases</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-gray-500 text-xs">
                      No se encontraron registros
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item, index) => (
                    <tr 
                      key={item.id}
                      onClick={() => setSelectedRow(item.id)}
                      className={`border-b border-gray-300 cursor-pointer transition-colors ${
                        selectedRow === item.id ? 'bg-[#D6EAF8]' : index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'
                      }`}
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
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.tipoPersona}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300" title={item.tipoDocumento}>
                        {item.tipoDocumento}
                      </td>
                      <td className="px-3 py-2 text-xs text-center border-r border-gray-300">
                        {item.requerido ? (
                          <span className="text-green-600 font-bold">✓</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-center border-r border-gray-300">
                        {item.permanente ? (
                          <span className="text-green-600 font-bold">✓</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300" title={item.descripcion}>
                        <div className="max-w-[200px] truncate">{item.descripcion}</div>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.requeridoPor}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.esquemaFirma}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.procede}</td>
                      <td className="px-3 py-2 text-xs text-gray-700" title={item.fases}>
                        <div className="max-w-[150px] truncate">{item.fases}</div>
                      </td>
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
              <span className="ml-4">| Seleccionado: {data.find(d => d.id === selectedRow)?.tipoDocumento}</span>
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

CheckListCaptacionesTab.displayName = 'CheckListCaptacionesTab';

// Componente de Modal de Formulario
interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: CheckListCaptacion;
  onSave: (data: any) => void;
  onClose: () => void;
}

function FormModal({ mode, item, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    tipoPersona: item?.tipoPersona || 'Física',
    tipoDocumento: item?.tipoDocumento || '',
    requerido: item?.requerido || false,
    permanente: item?.permanente || false,
    descripcion: item?.descripcion || '',
    requeridoPor: item?.requeridoPor || '',
    esquemaFirma: item?.esquemaFirma || '',
    procede: item?.procede || '',
    fases: item?.fases || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.tipoDocumento.trim()) {
      newErrors.tipoDocumento = 'El tipo de documento es requerido';
    }

    if (!formData.descripcion.trim()) {
      newErrors.descripcion = 'La descripción es requerida';
    }

    if (!formData.requeridoPor.trim()) {
      newErrors.requeridoPor = 'El campo "Requerido por" es obligatorio';
    }

    if (!formData.procede.trim()) {
      newErrors.procede = 'El campo "Procede" es obligatorio';
    }

    if (!formData.fases.trim()) {
      newErrors.fases = 'Las fases son requeridas';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isViewMode) {
      onClose();
      return;
    }

    if (!validate()) {
      toast.error('Formulario incompleto', {
        description: 'Por favor complete todos los campos requeridos',
      });
      return;
    }

    onSave(formData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const getTitle = () => {
    if (mode === 'create') return 'Nuevo Documento - Check List Captaciones';
    if (mode === 'edit') return 'Editar Documento - Check List Captaciones';
    return 'Ver Documento - Check List Captaciones';
  };

  const inputClassName = (fieldName: string) => {
    const baseClass = 'w-full px-2 py-1 text-xs';
    const errorClass = errors[fieldName] ? 'border-2 border-red-500' : 'border border-gray-400';
    
    if (isViewMode) {
      return `${baseClass} border-0 bg-transparent text-gray-700 cursor-default`;
    }
    return `${baseClass} ${errorClass}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">{getTitle()}</h3>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-300 font-bold text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            {/* Sección: Información General */}
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN GENERAL</span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {/* Tipo Persona */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Tipo Persona <span className="text-red-600">*</span>
                  </label>
                  <select 
                    value={formData.tipoPersona}
                    onChange={(e) => handleChange('tipoPersona', e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName('tipoPersona')}
                  >
                    <option value="Física">Física</option>
                    <option value="Moral">Moral</option>
                  </select>
                </div>

                {/* Tipo Documento */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Tipo Documento <span className="text-red-600">*</span>
                  </label>
                  <input 
                    type="text"
                    value={formData.tipoDocumento}
                    onChange={(e) => handleChange('tipoDocumento', e.target.value)}
                    disabled={isViewMode}
                    placeholder="Ej: INE/IFE, Acta constitutiva..."
                    className={inputClassName('tipoDocumento')}
                  />
                  {errors.tipoDocumento && (
                    <p className="text-red-600 text-[10px] mt-1">{errors.tipoDocumento}</p>
                  )}
                </div>

                {/* Requerido Por */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Requerido Por <span className="text-red-600">*</span>
                  </label>
                  <input 
                    type="text"
                    value={formData.requeridoPor}
                    onChange={(e) => handleChange('requeridoPor', e.target.value)}
                    disabled={isViewMode}
                    placeholder="Ej: CNBV, SAT, Interno..."
                    className={inputClassName('requeridoPor')}
                  />
                  {errors.requeridoPor && (
                    <p className="text-red-600 text-[10px] mt-1">{errors.requeridoPor}</p>
                  )}
                </div>

                {/* Esquema Firma */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Esquema Firma
                  </label>
                  <input 
                    type="text"
                    value={formData.esquemaFirma}
                    onChange={(e) => handleChange('esquemaFirma', e.target.value)}
                    disabled={isViewMode}
                    placeholder="Ej: Autógrafa, Notarial, N/A..."
                    className={inputClassName('esquemaFirma')}
                  />
                </div>

                {/* Procede */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Procede <span className="text-red-600">*</span>
                  </label>
                  <input 
                    type="text"
                    value={formData.procede}
                    onChange={(e) => handleChange('procede', e.target.value)}
                    disabled={isViewMode}
                    placeholder="Ej: Apertura, Evaluación..."
                    className={inputClassName('procede')}
                  />
                  {errors.procede && (
                    <p className="text-red-600 text-[10px] mt-1">{errors.procede}</p>
                  )}
                </div>

                {/* Fases */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Fases <span className="text-red-600">*</span>
                  </label>
                  <select 
                    value={formData.fases}
                    onChange={(e) => handleChange('fases', e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName('fases')}
                  >
                    <option value="">Seleccione una fase...</option>
                    {K_PHASES.map((phase) => (
                      <option key={phase.id} value={phase.descripcion}>
                        {phase.descripcion}
                      </option>
                    ))}
                  </select>
                  {errors.fases && (
                    <p className="text-red-600 text-[10px] mt-1">{errors.fases}</p>
                  )}
                </div>

                {/* Descripción - full width */}
                <div className="col-span-2">
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Descripción <span className="text-red-600">*</span>
                  </label>
                  <textarea 
                    value={formData.descripcion}
                    onChange={(e) => handleChange('descripcion', e.target.value)}
                    disabled={isViewMode}
                    placeholder="Descripción del documento..."
                    rows={3}
                    className={inputClassName('descripcion')}
                  />
                  {errors.descripcion && (
                    <p className="text-red-600 text-[10px] mt-1">{errors.descripcion}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Sección: Configuración */}
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
                <span className="text-xs font-medium text-gray-800">CONFIGURACIÓN</span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {/* Requerido */}
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox"
                    id="requerido"
                    checked={formData.requerido}
                    onChange={(e) => handleChange('requerido', e.target.checked)}
                    disabled={isViewMode}
                    className="w-4 h-4 border-gray-400"
                  />
                  <label htmlFor="requerido" className="text-xs text-gray-700 font-medium cursor-pointer">
                    Documento Requerido
                  </label>
                </div>

                {/* Permanente */}
                <div className="flex items-center gap-2">
                  <input 
                    type="checkbox"
                    id="permanente"
                    checked={formData.permanente}
                    onChange={(e) => handleChange('permanente', e.target.checked)}
                    disabled={isViewMode}
                    className="w-4 h-4 border-gray-400"
                  />
                  <label htmlFor="permanente" className="text-xs text-gray-700 font-medium cursor-pointer">
                    Documento Permanente
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-4 border-t-2 border-gray-300">
              {!isViewMode && (
                <button 
                  type="submit"
                  className="px-4 py-1.5 bg-[#2E5C91] text-white text-xs hover:bg-[#244A7A] border border-[#244A7A]"
                >
                  {mode === 'edit' ? 'Guardar Cambios' : 'Crear Documento'}
                </button>
              )}
              <button 
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-gray-600 text-white text-xs hover:bg-gray-700 border border-gray-700"
              >
                {isViewMode ? 'Cerrar' : 'Cancelar'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}