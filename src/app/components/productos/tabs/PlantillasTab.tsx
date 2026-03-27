import { useState, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import { toast } from 'sonner';
import { useTabPersistence } from '@/app/hooks/useProductoPersistence';
import type { PlantillaInstitucional, TipoPlantilla } from '@/app/types/product';
import { TIPO_PLANTILLA_OPTIONS, TIPO_PLANTILLA_CATALOGO, getTipoPlantillaMeta } from '@/app/types/product';

interface PlantillasTabProps {
  mode: 'create' | 'edit' | 'view';
  productId: number | string;
  initialData?: PlantillaInstitucional[];
  persistToStorage?: boolean;
  storagePrefix?: string;
}

const ESTATUS_OPTIONS: Array<'Activo' | 'Inactivo'> = ['Activo', 'Inactivo'];
const ARCHIVO_FORMATOS = ['PDF', 'DOCX', 'HTML'];

export const PlantillasTab = forwardRef<{ getData: () => PlantillaInstitucional[] }, PlantillasTabProps>(
  ({ mode, productId, initialData, persistToStorage, storagePrefix }, ref) => {
    const prefix = storagePrefix || 'credito';
    const storageKey = persistToStorage && productId ? `${prefix}_plantillas_${productId}` : '';

    const isCreate = mode === 'create';
    if (isCreate && storageKey) {
      try { sessionStorage.removeItem(storageKey); } catch (_) { /* ignore */ }
    }

    const { data, setData } = useTabPersistence<PlantillaInstitucional>(
      storageKey,
      initialData && initialData.length > 0 ? initialData : []
    );

    // Ref que siempre tiene el valor actual de data (evita problemas de closure)
    const dataRef = useRef<PlantillaInstitucional[]>(data);
    useEffect(() => { dataRef.current = data; }, [data]);

    useImperativeHandle(ref, () => ({
      getData: () => dataRef.current,
    }), []);

    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedItem, setSelectedItem] = useState<PlantillaInstitucional | undefined>();
    const [showMenu, setShowMenu] = useState(false);

    const isViewMode = mode === 'view';

    const handleDelete = () => {
      if (selectedRow === null) {
        toast.error('Debe seleccionar una fila');
        return;
      }
      const confirmed = window.confirm('¿Está seguro de eliminar esta plantilla?');
      if (confirmed) {
        setData(data.filter(item => item.id !== selectedRow));
        setSelectedRow(null);
        toast.success('Plantilla eliminada');
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

    const handleEdit = (item: PlantillaInstitucional) => {
      if (isViewMode) {
        handleView(item);
        return;
      }
      setFormMode('edit');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleView = (item: PlantillaInstitucional) => {
      setFormMode('view');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleToggleEstatus = (item: PlantillaInstitucional) => {
      if (isViewMode) {
        toast.warning('Modo solo lectura');
        return;
      }
      const nuevoEstatus = item.estatus === 'Activo' ? 'Inactivo' : 'Activo';
      setData(data.map(d =>
        d.id === item.id
          ? { ...d, estatus: nuevoEstatus, fechaModificacion: new Date().toISOString() }
          : d
      ));
      toast.success(`Plantilla ${nuevoEstatus === 'Activo' ? 'activada' : 'desactivada'}`);
    };

    const handleSaveForm = (formData: any) => {
      const now = new Date().toISOString();
      if (formMode === 'create') {
        const newItem: PlantillaInstitucional = {
          id: Math.max(...data.map(d => d.id), 0) + 1,
          productId: typeof productId === 'string' ? parseInt(productId) : productId,
          nombre: formData.nombre,
          tipoPlantilla: formData.tipoPlantilla,
          archivoBase: formData.archivoBase,
          archivoData: formData.archivoData || '',
          version: formData.version,
          estatus: formData.estatus,
          fechaCreacion: now,
          fechaModificacion: now,
        };
        setData([...data, newItem]);
        toast.success('Plantilla creada');
      } else if (formMode === 'edit') {
        setData(data.map(d =>
          d.id === selectedItem?.id
            ? { ...d, ...formData, fechaModificacion: now }
            : d
        ));
        toast.success('Plantilla actualizada');
      }
      setShowFormModal(false);
    };

    return (
      <>
        <div className="bg-white">
          <div className="mb-3">
            <span className="text-sm font-medium text-gray-800">Plantillas Institucionales</span>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] flex items-center gap-1"
              >
                Menú
                <svg width="10" height="6" viewBox="0 0 10 6" fill="white">
                  <path d="M0 0l5 6 5-6z" />
                </svg>
              </button>
              {showMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-400 shadow-lg z-10 min-w-[140px]">
                  <button onClick={() => { toast.success('Exportando a Excel'); setShowMenu(false); }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200">Exportar a Excel</button>
                  <button onClick={() => { toast.success('Exportando a PDF'); setShowMenu(false); }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100 border-b border-gray-200">Exportar a PDF</button>
                  <button onClick={() => { toast.success('Imprimiendo'); setShowMenu(false); }} className="block w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100">Imprimir</button>
                </div>
              )}
            </div>

            <button onClick={handleNew} disabled={isViewMode} className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:cursor-not-allowed">Nuevo</button>
            <button onClick={handleDelete} disabled={selectedRow === null || isViewMode} className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:cursor-not-allowed">Eliminar</button>
            {selectedRow !== null && !isViewMode && (
              <button
                onClick={() => {
                  const item = data.find(d => d.id === selectedRow);
                  if (item) handleToggleEstatus(item);
                }}
                className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91]"
              >
                {data.find(d => d.id === selectedRow)?.estatus === 'Activo' ? 'Desactivar' : 'Activar'}
              </button>
            )}
          </div>

          <div className="border border-gray-400 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#4A6FA5] text-white">
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Nombre</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Tipo</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Archivo</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Versión</th>
                  <th className="px-3 py-2 text-left font-medium text-xs whitespace-nowrap">Estatus</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500 text-xs">No se encontraron plantillas registradas</td>
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
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.nombre}</td>
                      <td className="px-3 py-2 text-xs border-r border-gray-300">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-medium"
                          style={{
                            backgroundColor: `${getTipoPlantillaMeta(item.tipoPlantilla)?.color || '#666'}18`,
                            color: getTipoPlantillaMeta(item.tipoPlantilla)?.color || '#666',
                          }}
                        >
                          {getTipoPlantillaMeta(item.tipoPlantilla)?.icon} {getTipoPlantillaMeta(item.tipoPlantilla)?.label || item.tipoPlantilla}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.archivoBase}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.version}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${item.estatus === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {item.estatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-xs text-gray-600">
            <span className="font-medium">Total de plantillas: {data.length}</span>
            {data.length > 0 && (
              <span className="ml-4">
                Activas: {data.filter(d => d.estatus === 'Activo').length} | Inactivas: {data.filter(d => d.estatus === 'Inactivo').length}
              </span>
            )}
          </div>
        </div>

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

PlantillasTab.displayName = 'PlantillasTab';

// ═══════════════════════════════════════════════════════════════
// Modal de Alta / Edición / Consulta de Plantilla
// ═══════════════════════════════════════════════════════════════

interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: PlantillaInstitucional;
  onSave: (data: any) => void;
  onClose: () => void;
}

function FormModal({ mode, item, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    nombre: item?.nombre || '',
    tipoPlantilla: item?.tipoPlantilla || ('' as TipoPlantilla | ''),
    archivoBase: item?.archivoBase || '',
    archivoData: item?.archivoData || '',
    version: item?.version || '1.0',
    estatus: item?.estatus || 'Activo' as 'Activo' | 'Inactivo',
  });
  const [fileName, setFileName] = useState(item?.archivoBase || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }

    const requiredFields = [
      { field: 'nombre', label: 'Nombre de la plantilla' },
      { field: 'tipoPlantilla', label: 'Tipo de plantilla' },
      { field: 'archivoBase', label: 'Archivo base' },
      { field: 'version', label: 'Versión' },
    ];

    const emptyFields = requiredFields.filter(({ field }) => {
      const value = formData[field as keyof typeof formData];
      if (typeof value === 'string') return value.trim() === '';
      return value === null || value === undefined;
    });

    if (emptyFields.length > 0) {
      const fieldNames = emptyFields.map(({ label }) => label).join(', ');
      toast.error('Campos requeridos faltantes', {
        description: `Por favor complete: ${fieldNames}`,
      });
      return;
    }

    if (!TIPO_PLANTILLA_OPTIONS.includes(formData.tipoPlantilla as TipoPlantilla)) {
      toast.error('Tipo de plantilla inválido', {
        description: `Debe ser uno de: ${TIPO_PLANTILLA_OPTIONS.join(', ')}`,
      });
      return;
    }

    onSave(formData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toUpperCase() || '';
    if (!['PDF', 'DOCX', 'HTML'].includes(ext)) {
      toast.error('Formato no permitido', {
        description: 'Solo se aceptan archivos PDF, DOCX o HTML',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({
        ...prev,
        archivoBase: file.name,
        archivoData: reader.result as string,
      }));
      setFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const inputClassName = () => {
    const baseClass = 'w-full px-2 py-1 text-xs';
    if (isViewMode) return `${baseClass} border-0 bg-transparent text-gray-700 cursor-default`;
    return `${baseClass} border border-gray-400`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">
            {mode === 'create' ? 'Nueva Plantilla' : mode === 'edit' ? 'Editar Plantilla' : 'Ver Plantilla'}
          </h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE LA PLANTILLA</span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Nombre de la plantilla <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={120}
                    value={formData.nombre}
                    onChange={(e) => handleChange('nombre', e.target.value)}
                    disabled={isViewMode}
                    placeholder="Ej: Contrato de Crédito Simple"
                    className={inputClassName()}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Tipo de plantilla <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={formData.tipoPlantilla}
                    onChange={(e) => handleChange('tipoPlantilla', e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName()}
                  >
                    <option value="">Seleccione el tipo de plantilla...</option>
                    {TIPO_PLANTILLA_CATALOGO.map((tipo) => (
                      <option key={tipo.value} value={tipo.value}>
                        {tipo.icon} {tipo.label}
                      </option>
                    ))}
                  </select>
                  {formData.tipoPlantilla && (
                    <span className="text-[10px] text-gray-500 mt-0.5 block">
                      {getTipoPlantillaMeta(formData.tipoPlantilla)?.descripcion}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Versión <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    value={formData.version}
                    onChange={(e) => handleChange('version', e.target.value)}
                    disabled={isViewMode}
                    placeholder="Ej: 1.0"
                    className={inputClassName()}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Estatus <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={formData.estatus}
                    onChange={(e) => handleChange('estatus', e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName()}
                  >
                    {ESTATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-700 mb-1 font-medium">
                    Archivo base <span className="text-red-600">*</span>
                    <span className="text-[10px] text-gray-500 font-normal ml-1">(PDF, DOCX o HTML)</span>
                  </label>
                  {isViewMode ? (
                    <input
                      type="text"
                      value={formData.archivoBase}
                      readOnly
                      className="w-full px-2 py-1 text-xs border-0 bg-gray-100 text-gray-600 cursor-default"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] cursor-pointer border border-[#3E5C91]">
                        Seleccionar archivo
                        <input
                          type="file"
                          accept=".pdf,.docx,.html"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      <span className="text-xs text-gray-600">
                        {fileName || 'Ningún archivo seleccionado'}
                      </span>
                    </div>
                  )}
                  {!isViewMode && formData.archivoData && (
                    <span className="text-[10px] text-green-600 mt-1 block">Archivo cargado correctamente</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-gray-300">
              <button type="button" onClick={onClose} className="px-4 py-1.5 bg-gray-500 text-white text-xs hover:bg-gray-600">
                {isViewMode ? 'Cerrar' : 'Cancelar'}
              </button>
              {!isViewMode && (
                <button type="submit" className="px-4 py-1.5 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91]">
                  Guardar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
