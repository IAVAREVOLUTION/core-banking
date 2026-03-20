import { useState, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { K_PHASES } from '@/app/data/mockData';
import { useTabPersistence } from '@/app/hooks/useProductoPersistence';

interface Fase {
  id: number;
  productId: number;
  seq: string;
  phaseId: number;
  phaseName: string;
  notes: string;
  assetBoolean: boolean;
}

interface FasesTabProps {
  mode: 'create' | 'edit' | 'view' | 'nuevo' | 'editar' | 'ver';
  productId: number | string;
  initialData?: Fase[];
  persistToStorage?: boolean;
  storagePrefix?: string;
}

const generateDefaultFases = (productId: number | string): Fase[] => {
  const notasPorFase: Record<string, string> = {
    'Análisis': 'Evaluación de capacidad de pago y riesgo crediticio del solicitante',
    'Aprobación': 'Revisión y aprobación por comité de crédito según políticas vigentes',
    'Desembolso': 'Liberación de fondos según cronograma y condiciones aprobadas',
    'Seguimiento': 'Monitoreo continuo del cumplimiento de obligaciones contractuales',
    'Cobranza': 'Gestión de recuperación de cartera y control de morosidad',
    'Cierre': 'Liquidación total del crédito y archivo de expediente',
  };
  
  return K_PHASES.map((phase, index) => ({
    id: index + 1,
    productId: typeof productId === 'number' ? productId : 0,
    seq: (index + 1).toString(),
    phaseId: phase.id,
    phaseName: phase.descripcion,
    notes: notasPorFase[phase.descripcion] || `Nota para fase ${phase.descripcion}`,
    assetBoolean: true,
  }));
};

export const FasesTab = forwardRef<{ getData: () => Fase[] }, FasesTabProps>(
  ({ mode, productId, initialData, persistToStorage, storagePrefix }, ref) => {
    const prefix = storagePrefix || 'captacion';
    const storageKey = persistToStorage && productId ? `${prefix}_fases_${productId}` : '';

    // ══════════════════════════════════════════════════════════════
    // FIX: Fases del Producto es 100% manual.
    // - En Alta: vacío (sin defaults automáticos).
    // - En Editar/Ver: solo mostrar datos guardados (initialData de BD).
    // - Si no hay datos guardados: vacío (sin registros de ejemplo).
    // ══════════════════════════════════════════════════════════════
    const isCreate = mode === 'create' || mode === 'nuevo';
    const defaultFases: Fase[] = initialData && initialData.length > 0 
      ? initialData 
      : [];

    // Protección contra datos stale en sessionStorage:
    // En modo create, limpiar cualquier residuo del storage antes de inicializar
    if (isCreate && storageKey) {
      try { sessionStorage.removeItem(storageKey); } catch (_) { /* ignore */ }
    }

    const { data, setData } = useTabPersistence<Fase>(storageKey, defaultFases);

    useImperativeHandle(ref, () => ({ getData: () => data }), [data]);

    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedItem, setSelectedItem] = useState<Fase | undefined>();
    const [showMenu, setShowMenu] = useState(false);
    const [deleteMode, setDeleteMode] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

    const isViewMode = mode === 'view' || mode === 'ver';

    const handleDeleteRequest = (id: number) => {
      setDeleteTargetId(id);
      setShowDeleteModal(true);
    };

    const confirmDelete = () => {
      if (deleteTargetId !== null) {
        setData(data.filter(item => item.id !== deleteTargetId));
        setSelectedRow(null);
        setDeleteTargetId(null);
        setShowDeleteModal(false);
        toast.success('Fase eliminada correctamente');
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

    const handleEdit = (item: Fase) => {
      if (isViewMode) {
        handleView(item);
        return;
      }
      setFormMode('edit');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleView = (item: Fase) => {
      setFormMode('view');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleSaveForm = (formData: any) => {
      if (formMode === 'create') {
        const newItem: Fase = {
          id: Math.max(...data.map(d => d.id), 0) + 1,
          productId: typeof productId === 'number' ? productId : 0,
          ...formData
        };
        setData([...data, newItem]);
        toast.success('Fase creada correctamente');
      } else if (formMode === 'edit') {
        setData(data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d));
        toast.success('Fase actualizada correctamente');
      }
      setShowFormModal(false);
    };

    return (
      <>
        <div className="bg-white">
          {/* Header temático */}
          <div className="section-header-theme px-4 py-2 mb-4 flex items-center justify-between rounded-t">
            <span className="text-xs font-semibold tracking-wide uppercase">Fases del Producto</span>
            {!isViewMode && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleNew}
                  className="px-4 py-1 rounded text-xs font-medium transition-colors bg-white/20 text-white hover:bg-white/30"
                >
                  + Nueva
                </button>
                <button
                  onClick={() => setDeleteMode(!deleteMode)}
                  className={`px-4 py-1 rounded text-xs font-medium transition-colors ${
                    deleteMode
                      ? 'bg-white text-red-600 font-semibold shadow-sm'
                      : 'bg-white/20 text-white hover:bg-white/30'
                  }`}
                >
                  Eliminar
                </button>
              </div>
            )}
          </div>

          {/* Barra de acciones secundarias */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative">
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] rounded flex items-center gap-1"
              >
                Menú
                <svg width="10" height="6" viewBox="0 0 10 6" fill="white">
                  <path d="M0 0l5 6 5-6z"/>
                </svg>
              </button>
              {showMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 shadow-lg z-10 min-w-[160px] rounded overflow-hidden">
                  <button onClick={() => { toast.success('Exportando a Excel'); setShowMenu(false); }} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 border-b border-gray-100">
                    <span className="flex items-center gap-2">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      Exportar a Excel
                    </span>
                  </button>
                  <button onClick={() => { toast.success('Exportando a CSV'); setShowMenu(false); }} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 border-b border-gray-100">
                    <span className="flex items-center gap-2">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      Exportar a CSV
                    </span>
                  </button>
                  <button onClick={() => { toast.success('Exportando a PDF'); setShowMenu(false); }} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 border-b border-gray-100">
                    <span className="flex items-center gap-2">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      Exportar a PDF
                    </span>
                  </button>
                  <button onClick={() => { toast.success('Imprimiendo...'); setShowMenu(false); }} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50">
                    <span className="flex items-center gap-2">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                      Imprimir
                    </span>
                  </button>
                </div>
              )}
            </div>
            <span className="text-[11px] text-gray-500 ml-auto">
              Doble clic en una fila para {isViewMode ? 'ver detalle' : 'editar'}
            </span>
          </div>

          {/* Tabla de Fases */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead className="table-header-theme">
                <tr>
                  {deleteMode && !isViewMode && (
                    <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-20">
                      Acciones
                    </th>
                  )}
                  <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-16">Seq</th>
                  <th className="text-left px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-36">Fase</th>
                  <th className="text-left px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Nota</th>
                  <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-24">Activo</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={deleteMode && !isViewMode ? 5 : 4} className="px-3 py-10 text-center text-gray-400 text-xs">
                      <div className="flex flex-col items-center gap-2">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M9 14l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="font-medium text-gray-500">No hay fases configuradas</span>
                        {!isViewMode && (
                          <span className="text-gray-400">Haga clic en "+ Nueva" para agregar una fase</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.map((item, index) => (
                    <tr 
                      key={item.id}
                      onClick={() => setSelectedRow(item.id)}
                      onDoubleClick={() => handleEdit(item)}
                      className={`row-hover-theme transition-colors cursor-pointer ${
                        selectedRow === item.id 
                          ? 'bg-blue-100/70 ring-1 ring-inset ring-blue-300' 
                          : index % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'
                      }`}
                    >
                      {deleteMode && !isViewMode && (
                        <td className="text-center px-3 py-2 border-b border-gray-200">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteRequest(item.id); }}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                            title="Eliminar fase"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                          </button>
                        </td>
                      )}
                      <td className="px-3 py-2 border-b border-gray-200 text-center">
                        <span className="inline-flex items-center justify-center bg-primary-tint-theme text-primary-theme font-semibold rounded-full px-2.5 py-0.5 min-w-[1.8rem] text-[11px]">
                          {item.seq}
                        </span>
                      </td>
                      <td className="px-3 py-2 border-b border-gray-200 font-medium text-gray-700">{item.phaseName || item.phaseId || '—'}</td>
                      <td className="px-3 py-2 border-b border-gray-200 text-gray-600">{item.notes}</td>
                      <td className="px-3 py-2 border-b border-gray-200 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          item.assetBoolean 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${item.assetBoolean ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {item.assetBoolean ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer con total */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-gray-500">
              Total: <span className="font-semibold text-gray-700">{data.length}</span> fase{data.length !== 1 ? 's' : ''}
            </span>
            {data.filter(f => f.assetBoolean).length !== data.length && data.length > 0 && (
              <span className="text-[11px] text-amber-600">
                {data.filter(f => !f.assetBoolean).length} inactiva{data.filter(f => !f.assetBoolean).length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>

        {/* Modal de confirmación de eliminación */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-[440px] mx-4 overflow-hidden">
              <div className="modal-header-theme px-5 py-3">
                <h3 className="text-sm font-semibold text-white">Confirmar Eliminación</h3>
              </div>
              <div className="px-6 py-6 flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">¿Eliminar esta fase?</p>
                  <p className="text-xs text-gray-500">Esta acción no se puede deshacer. La fase será removida de la configuración del producto.</p>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-3 flex justify-end gap-2.5 border-t border-gray-200">
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteTargetId(null); }}
                  className="px-5 py-1.5 text-xs bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-5 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-medium transition-colors shadow-sm"
                >
                  Sí, Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Nueva/Editar/Ver Fase */}
        {showFormModal && (
          <FormModal 
            mode={formMode} 
            item={selectedItem} 
            productId={productId} 
            existingData={data}
            onSave={handleSaveForm} 
            onClose={() => setShowFormModal(false)} 
          />
        )}
      </>
    );
  }
);

FasesTab.displayName = 'FasesTab';

interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: Fase;
  productId: number | string;
  existingData: Fase[];
  onSave: (data: any) => void;
  onClose: () => void;
}

function FormModal({ mode, item, productId, existingData, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';

  // Auto-seq: al crear, calcular siguiente número secuencial
  const autoSeq = (() => {
    if (item?.seq) return item.seq; // editar/ver: conservar valor original
    const nums = existingData.map(d => parseInt(d.seq, 10)).filter(n => !isNaN(n));
    return nums.length > 0 ? (Math.max(...nums) + 1).toString() : '1';
  })();

  const [formData, setFormData] = useState({
    seq: autoSeq,
    phaseId: item?.phaseId?.toString() || '',
    phaseName: item?.phaseName || item?.phaseId?.toString() || '',
    notes: item?.notes || '',
    assetBoolean: item?.assetBoolean !== undefined ? item.assetBoolean : true,
  });

  // Filtrar fases ya usadas (en modo crear, excluir las que ya están en la tabla)
  const availablePhases = mode === 'create'
    ? K_PHASES.filter(p => !existingData.some(d => d.phaseId === p.id))
    : K_PHASES;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }

    const requiredFields = [
      { field: 'seq', label: 'Seq' },
      { field: 'phaseId', label: 'Fase' },
      { field: 'notes', label: 'Nota' },
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
        description: `Por favor complete: ${fieldNames}`,
      });
      return;
    }

    if (formData.seq.length > 5) {
      toast.error('Seq no puede exceder 5 caracteres');
      return;
    }

    if (formData.notes.length > 255) {
      toast.error('Nota no puede exceder 255 caracteres');
      return;
    }

    // Validar duplicado de fase (en modo crear)
    if (mode === 'create') {
      const phaseIdNum = parseInt(formData.phaseId);
      if (existingData.some(d => d.phaseId === phaseIdNum)) {
        toast.error('Fase duplicada', { description: 'Esta fase ya está asignada al producto' });
        return;
      }
    }

    onSave(formData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'phaseId') {
      // El campo "Fase" es texto libre. Siempre sincronizar phaseName
      // con el valor ingresado (ya no depende de K_PHASES lookup).
      const phase = K_PHASES.find(p => p.id === parseInt(value));
      setFormData(prev => ({ 
        ...prev, 
        phaseId: value,
        phaseName: phase ? phase.descripcion : value
      }));
    }
  };

  const inputClassName = () => {
    const baseClass = 'w-full px-2.5 py-1.5 text-xs rounded';
    if (isViewMode) {
      return `${baseClass} border-0 bg-transparent text-gray-700 cursor-default`;
    }
    return `${baseClass} border border-gray-300 bg-white focus:border-blue-500 focus:ring-1 ring-blue-500 outline-none transition-colors`;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-xl mx-4 overflow-hidden animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header-theme px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-wide uppercase">
            {mode === 'create' ? 'Nueva Fase' : mode === 'edit' ? 'Editar Fase' : 'Detalle de Fase'}
          </span>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
            title="Cerrar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-4 border-l-4 border-[#2E5C91] rounded-r">
                <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Información de Fase</span>
              </div>

              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                {/* Seq */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Seq <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    maxLength={5}
                    value={formData.seq} 
                    disabled 
                    className={`${inputClassName()} bg-gray-100 text-gray-600 cursor-not-allowed`} 
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Secuencia automática</span>
                </div>

                {/* Fase - Campo abierto de 30 caracteres */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Fase <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    value={formData.phaseId} 
                    onChange={(e) => handleChange('phaseId', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ingrese nombre de fase..."
                    className={inputClassName()}
                  />
                  <span className="text-[10px] text-gray-400 mt-0.5 block">Máximo 30 caracteres</span>
                </div>

                {/* Nota */}
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Nota <span className="text-red-500">*</span>
                  </label>
                  <textarea 
                    maxLength={255}
                    rows={2}
                    value={formData.notes} 
                    onChange={(e) => handleChange('notes', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Descripción o nota de la fase..." 
                    className={`${inputClassName()} resize-none`} 
                  />
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[10px] text-gray-400">Máximo 255 caracteres</span>
                    <span className={`text-[10px] ${formData.notes.length > 230 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {formData.notes.length}/255
                    </span>
                  </div>
                </div>

                {/* Activo */}
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Estado</label>
                  <div className="flex items-center gap-2">
                    <label className={`relative inline-flex items-center ${isViewMode ? 'cursor-default' : 'cursor-pointer'}`}>
                      <input 
                        type="checkbox" 
                        checked={formData.assetBoolean} 
                        onChange={(e) => handleChange('assetBoolean', e.target.checked)} 
                        disabled={isViewMode} 
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                    <span className={`text-xs font-medium ${formData.assetBoolean ? 'text-green-700' : 'text-gray-500'}`}>
                      {formData.assetBoolean ? 'Fase Activa' : 'Fase Inactiva'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <button 
                type="button" 
                onClick={onClose} 
                className="px-4 py-1.5 rounded text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors"
              >
                {isViewMode ? 'Cerrar' : 'Cancelar'}
              </button>
              {!isViewMode && (
                <button 
                  type="submit" 
                  className="px-5 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium transition-colors shadow-sm"
                >
                  {mode === 'create' ? 'Agregar Fase' : 'Guardar Cambios'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}