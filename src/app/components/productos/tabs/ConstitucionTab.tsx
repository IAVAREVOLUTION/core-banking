import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';

interface ConstitucionTabProps {
  mode: 'nuevo' | 'editar' | 'ver' | 'create' | 'edit' | 'view';
  productId?: number | string;
  initialData?: ConstitucionItem[];
  persistToStorage?: boolean;
}

interface ConstitucionItem {
  id: number;
  edadMinimaTitu: string;
  edadMaximaTitu: string;
  tipo: string;
  edadMaximaCofir1: string;
  edadMaximaCofir2: string;
}

// FIX: Sin registros automaticos. Vacio hasta captura manual del usuario.
const defaultConstitucionData: ConstitucionItem[] = [];

export const ConstitucionTab = forwardRef<{ getData: () => ConstitucionItem[] }, ConstitucionTabProps>(
  ({ mode, productId, initialData, persistToStorage }, ref) => {
    const storageKey = persistToStorage && productId ? `captacion_constitucion_${productId}` : '';

    const getInitialData = (): ConstitucionItem[] => {
      if (storageKey) {
        try {
          const stored = sessionStorage.getItem(storageKey);
          if (stored) return JSON.parse(stored);
        } catch (e) { /* ignore */ }
      }
      if (initialData && initialData.length > 0) return initialData;
      return defaultConstitucionData;
    };

    const [data, setData] = useState<ConstitucionItem[]>(getInitialData);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<ConstitucionItem | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

    const isViewMode = mode === 'ver' || mode === 'view';

    useImperativeHandle(ref, () => ({ getData: () => data }));

    useEffect(() => {
      if (storageKey) {
        try { sessionStorage.setItem(storageKey, JSON.stringify(data)); } catch (e) { /* ignore */ }
      }
    }, [data, storageKey]);

    const emptyForm: Omit<ConstitucionItem, 'id'> = {
      edadMinimaTitu: '',
      edadMaximaTitu: '',
      tipo: '',
      edadMaximaCofir1: '',
      edadMaximaCofir2: '',
    };

    const [formData, setFormData] = useState<Omit<ConstitucionItem, 'id'>>(emptyForm);

    const handleNumericInput = (value: string): string => {
      // Solo permite digitos
      return value.replace(/[^0-9]/g, '');
    };

    const handleOpenNew = () => {
      setEditingItem(null);
      setFormData(emptyForm);
      setShowModal(true);
    };

    const handleOpenEdit = (item: ConstitucionItem) => {
      if (isViewMode) return;
      setEditingItem(item);
      setFormData({
        edadMinimaTitu: item.edadMinimaTitu,
        edadMaximaTitu: item.edadMaximaTitu,
        tipo: item.tipo,
        edadMaximaCofir1: item.edadMaximaCofir1,
        edadMaximaCofir2: item.edadMaximaCofir2,
      });
      setShowModal(true);
    };

    const handleSave = () => {
      if (!formData.tipo.trim()) {
        toast.error('El campo Tipo es requerido');
        return;
      }

      if (editingItem) {
        setData(data.map(d => d.id === editingItem.id ? { ...d, ...formData } : d));
        toast.success('Registro actualizado');
      } else {
        const newId = data.length > 0 ? Math.max(...data.map(d => d.id)) + 1 : 1;
        setData([...data, { id: newId, ...formData }]);
        toast.success('Registro agregado');
      }
      setShowModal(false);
    };

    const handleRequestDelete = (id: number) => {
      setDeleteTarget(id);
      setShowDeleteModal(true);
    };

    const confirmDelete = () => {
      if (deleteTarget !== null) {
        setData(data.filter(d => d.id !== deleteTarget));
        toast.success('Registro eliminado');
      }
      setShowDeleteModal(false);
      setDeleteTarget(null);
    };

    return (
      <div>
        {/* Header */}
        <div className="section-header-theme px-4 py-2 mb-4 flex items-center justify-between rounded-t">
          <span className="text-xs font-semibold tracking-wide uppercase">Constitucion</span>
          {!isViewMode && (
            <button
              onClick={handleOpenNew}
              className="px-4 py-1 rounded text-xs font-medium transition-colors bg-white/20 text-white hover:bg-white/30"
            >
              + Nuevo
            </button>
          )}
        </div>

        {/* Tabla */}
        <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead className="table-header-theme">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Tipo</th>
                <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Edad Min. Titular</th>
                <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Edad Max. Titular</th>
                <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Edad Max. Cofirmante 1</th>
                <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Edad Max. Cofirmante 2</th>
                {!isViewMode && (
                  <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-24">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={isViewMode ? 5 : 6} className="px-3 py-8 text-center text-gray-400 text-xs">
                    <div className="flex flex-col items-center gap-1">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                        <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>No hay registros de constitucion</span>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((item, idx) => (
                  <tr
                    key={item.id}
                    className={`row-hover-theme transition-colors cursor-pointer ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}
                    onDoubleClick={() => handleOpenEdit(item)}
                  >
                    <td className="px-3 py-1.5 border-b border-gray-200 font-medium text-gray-700">{item.tipo || '—'}</td>
                    <td className="px-3 py-1.5 border-b border-gray-200 text-center">{item.edadMinimaTitu || '—'}</td>
                    <td className="px-3 py-1.5 border-b border-gray-200 text-center">{item.edadMaximaTitu || '—'}</td>
                    <td className="px-3 py-1.5 border-b border-gray-200 text-center">{item.edadMaximaCofir1 || '—'}</td>
                    <td className="px-3 py-1.5 border-b border-gray-200 text-center">{item.edadMaximaCofir2 || '—'}</td>
                    {!isViewMode && (
                      <td className="px-3 py-1.5 border-b border-gray-200 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Editar"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleRequestDelete(item.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                            title="Eliminar"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Nuevo/Editar */}
        {showModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setShowModal(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header-theme px-5 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold tracking-wide uppercase">
                  {editingItem ? 'Editar Constitucion' : 'Nueva Constitucion'}
                </span>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                  title="Cerrar"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Tipo <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                    placeholder="Ej: Mayor de edad, Menor acumulador..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Edad Min. Titular</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.edadMinimaTitu}
                      onChange={(e) => setFormData({ ...formData, edadMinimaTitu: handleNumericInput(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Edad Max. Titular</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.edadMaximaTitu}
                      onChange={(e) => setFormData({ ...formData, edadMaximaTitu: handleNumericInput(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Edad Max. Cofirmante 1</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.edadMaximaCofir1}
                      onChange={(e) => setFormData({ ...formData, edadMaximaCofir1: handleNumericInput(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Edad Max. Cofirmante 2</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.edadMaximaCofir2}
                      onChange={(e) => setFormData({ ...formData, edadMaximaCofir2: handleNumericInput(e.target.value) })}
                      className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 py-1.5 rounded text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-5 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium transition-colors shadow-sm"
                  >
                    {editingItem ? 'Guardar Cambios' : 'Agregar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal confirmacion eliminacion */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-2xl w-[440px] mx-4 overflow-hidden">
              <div className="modal-header-theme px-5 py-3">
                <h3 className="text-sm font-semibold text-white">Confirmar Eliminacion</h3>
              </div>
              <div className="px-6 py-6 flex items-start gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">Eliminar este registro?</p>
                  <p className="text-xs text-gray-500">Esta accion no se puede deshacer.</p>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-3 flex justify-end gap-2.5 border-t border-gray-200">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="px-5 py-1.5 text-xs bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-5 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-medium transition-colors shadow-sm"
                >
                  Si, Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

ConstitucionTab.displayName = 'ConstitucionTab';
