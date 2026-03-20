import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { CheckListLineaCredito } from '@/app/types/productoLineaCredito';

interface CheckListLineaCreditoTabProps {
  mode: 'create' | 'edit' | 'view';
  checkList: CheckListLineaCredito[];
  onCheckListChange: (checkList: CheckListLineaCredito[]) => void;
}

const tiposPersona = ['Moral', 'Física'];

const tiposDocumento = [
  'Estado Financiero Dictaminado',
  'Acta Constitutiva inscrita en el RPC del Acreedor',
  'Autorización Buró de Crédito',
  'Contrato Original Firmado',
  'Dictamen Jurídico',
  'Estados Financieros Dictaminados de los últimos dos años',
  'Formato Visita Legal',
  'Pagaré Mesa de Control',
  'Poderes inscritos en el RPPC del Acreditado',
  'RFC Obligado Solidario Persona Física',
  'Copia DNI',
  'Certificado de domicilio',
];

const requeridosPor = [
  'Análisis Crédito',
  'Jurídico',
  'Mesa Control',
  'Operaciones',
  'Riesgos',
];

export function CheckListLineaCreditoTab({ mode, checkList, onCheckListChange }: CheckListLineaCreditoTabProps) {
  const [data, setData] = useState<CheckListLineaCredito[]>(checkList);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showConsulta, setShowConsulta] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedItem, setSelectedItem] = useState<CheckListLineaCredito | undefined>();
  const [showMenu, setShowMenu] = useState(false);
  const [filters, setFilters] = useState({
    tipoPersona: '',
    tipoDocumento: '',
    requeridoPor: '',
  });

  const isViewMode = mode === 'view';

  // Sincronizar el estado local cuando cambia el checkList del prop
  useEffect(() => {
    setData(checkList);
  }, [checkList]);

  const handleDelete = () => {
    if (selectedRow === null) {
      toast.error('Debe seleccionar una fila');
      return;
    }
    const confirmed = window.confirm('¿Está seguro de eliminar este registro?');
    if (confirmed) {
      const newData = data.filter(item => item.id !== selectedRow);
      setData(newData);
      onCheckListChange(newData);
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
      const newItem: CheckListLineaCredito = {
        id: Math.max(...data.map(d => d.id), 0) + 1,
        ...formData
      };
      const newData = [...data, newItem];
      setData(newData);
      onCheckListChange(newData);
      toast.success('Check List creado');
    } else if (formMode === 'edit') {
      const newData = data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d);
      setData(newData);
      onCheckListChange(newData);
      toast.success('Check List actualizado');
    }
    setShowFormModal(false);
  };

  const handleConsulta = () => {
    setShowConsulta(!showConsulta);
  };

  const handleRowDoubleClick = (item: CheckListLineaCredito) => {
    if (isViewMode) {
      return;
    }
    setFormMode('edit');
    setSelectedItem(item);
    setShowFormModal(true);
  };

  // Aplicar filtros
  let filteredData = data.filter(item => {
    const matchesTipoPersona = filters.tipoPersona === '' || item.tipoPersona.toLowerCase().includes(filters.tipoPersona.toLowerCase());
    const matchesTipoDocumento = filters.tipoDocumento === '' || item.tipoDocumento.toLowerCase().includes(filters.tipoDocumento.toLowerCase());
    const matchesRequeridoPor = filters.requeridoPor === '' || item.requeridoPor.toLowerCase().includes(filters.requeridoPor.toLowerCase());
    return matchesTipoPersona && matchesTipoDocumento && matchesRequeridoPor;
  });

  return (
    <>
      <div className="bg-white">
        <div className="mb-3">
          <span className="text-sm font-medium text-gray-800">Check List Línea de Crédito</span>
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
                <label className="block text-xs text-gray-700 mb-1 font-medium">Tipo Persona</label>
                <input 
                  type="text"
                  value={filters.tipoPersona}
                  onChange={(e) => setFilters({...filters, tipoPersona: e.target.value})}
                  placeholder="Buscar tipo persona..."
                  className="w-full px-2 py-1 border border-gray-400 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Tipo Documento</label>
                <input 
                  type="text"
                  value={filters.tipoDocumento}
                  onChange={(e) => setFilters({...filters, tipoDocumento: e.target.value})}
                  placeholder="Buscar tipo documento..."
                  className="w-full px-2 py-1 border border-gray-400 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Requerido por</label>
                <input 
                  type="text"
                  value={filters.requeridoPor}
                  onChange={(e) => setFilters({...filters, requeridoPor: e.target.value})}
                  placeholder="Buscar requerido por..."
                  className="w-full px-2 py-1 border border-gray-400 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setFilters({ tipoPersona: '', tipoDocumento: '', requeridoPor: '' })}
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
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Tipo persona</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Tipo documento</th>
                <th className="px-3 py-2 text-center font-medium text-xs border-r border-white/20">Requerido</th>
                <th className="px-3 py-2 text-center font-medium text-xs border-r border-white/20">Permanente</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Descripción</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Requerido por</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Esquema de Firma</th>
                <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Proceso</th>
                <th className="px-3 py-2 text-left font-medium text-xs">Fases</th>
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
                    key={item.id ?? `checklist-${index}`}
                    onClick={() => setSelectedRow(item.id)}
                    onDoubleClick={() => handleRowDoubleClick(item)}
                    className={`border-b border-gray-300 cursor-pointer transition-colors ${selectedRow === item.id ? 'bg-[#D6EAF8]' : index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'}`}
                  >
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.tipoPersona}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.tipoDocumento}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300 text-center">
                      <input 
                        type="checkbox" 
                        checked={item.requerido} 
                        readOnly 
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300 text-center">
                      <input 
                        type="checkbox" 
                        checked={item.permanente} 
                        readOnly 
                        className="cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.descripcion || '-'}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.requeridoPor}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.esquemaFirma}</td>
                    <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.proceso}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">{item.fases}</td>
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
  item?: CheckListLineaCredito;
  onSave: (data: any) => void;
  onClose: () => void;
}

function FormModal({ mode, item, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    tipoPersona: item?.tipoPersona || '',
    tipoDocumento: item?.tipoDocumento || '',
    requerido: item?.requerido || false,
    permanente: item?.permanente || false,
    descripcion: item?.descripcion || '',
    requeridoPor: item?.requeridoPor || '',
    esquemaFirma: item?.esquemaFirma || '',
    proceso: item?.proceso || '',
    fases: item?.fases || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }

    // Validación de campos requeridos
    if (!formData.tipoPersona || !formData.tipoDocumento || !formData.requeridoPor || 
        !formData.esquemaFirma || !formData.proceso || !formData.fases) {
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
      <div className="bg-white shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">{mode === 'create' ? 'Nuevo Check List' : mode === 'edit' ? 'Editar Check List' : 'Ver Check List'}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE CHECK LIST</span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Tipo persona <span className="text-red-600">*</span></label>
                  {isViewMode ? (
                    <input 
                      type="text" 
                      value={formData.tipoPersona} 
                      disabled 
                      className={inputClassName()} 
                    />
                  ) : (
                    <select 
                      value={formData.tipoPersona} 
                      onChange={(e) => handleChange('tipoPersona', e.target.value)} 
                      className={inputClassName()}
                    >
                      <option value="">Seleccione...</option>
                      {tiposPersona.map(tipo => (
                        <option key={tipo} value={tipo}>{tipo}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Tipo documento <span className="text-red-600">*</span></label>
                  {isViewMode ? (
                    <input 
                      type="text" 
                      value={formData.tipoDocumento} 
                      disabled 
                      className={inputClassName()} 
                    />
                  ) : (
                    <select 
                      value={formData.tipoDocumento} 
                      onChange={(e) => handleChange('tipoDocumento', e.target.value)} 
                      className={inputClassName()}
                    >
                      <option value="">Seleccione...</option>
                      {tiposDocumento.map(tipo => (
                        <option key={tipo} value={tipo}>{tipo}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={formData.requerido} 
                      onChange={(e) => handleChange('requerido', e.target.checked)} 
                      disabled={isViewMode}
                      className="cursor-pointer"
                    />
                    <label className="text-xs text-gray-700 font-medium">Requerido</label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={formData.permanente} 
                      onChange={(e) => handleChange('permanente', e.target.checked)} 
                      disabled={isViewMode}
                      className="cursor-pointer"
                    />
                    <label className="text-xs text-gray-700 font-medium">Permanente</label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Requerido por <span className="text-red-600">*</span></label>
                  {isViewMode ? (
                    <input 
                      type="text" 
                      value={formData.requeridoPor} 
                      disabled 
                      className={inputClassName()} 
                    />
                  ) : (
                    <select 
                      value={formData.requeridoPor} 
                      onChange={(e) => handleChange('requeridoPor', e.target.value)} 
                      className={inputClassName()}
                    >
                      <option value="">Seleccione...</option>
                      {requeridosPor.map(req => (
                        <option key={req} value={req}>{req}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Descripción</label>
                  <textarea 
                    value={formData.descripcion} 
                    onChange={(e) => handleChange('descripcion', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ingrese descripción (opcional)"
                    rows={2}
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Esquema de Firma <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    value={formData.esquemaFirma} 
                    onChange={(e) => handleChange('esquemaFirma', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ej: Autógrafa"
                    className={inputClassName()} 
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Proceso <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    value={formData.proceso} 
                    onChange={(e) => handleChange('proceso', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ej: Obligado S"
                    className={inputClassName()} 
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Fases <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    value={formData.fases} 
                    onChange={(e) => handleChange('fases', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ej: Fase 1, Fase 3, Integración Expediente"
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