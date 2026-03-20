import { useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import { toast } from 'sonner';
import { useProductosCatalogoDB, type ProductoCatalogo } from '@/app/hooks/useProductosCatalogoDB';
import { useTabPersistence } from '@/app/hooks/useProductoPersistence';
import React from 'react';

interface Paquete {
  id: number;
  productId: number;
  selectBoolean: boolean;
  paqueteProductoId: number;
  paqueteProductoNombre: string;
  lineaProducto: string;
  sublineaProducto: string;
  tipo: string; // 'Seguro' | 'Crédito' | 'Captación' | 'Otro'
}

interface PaquetesTabProps {
  mode: 'create' | 'edit' | 'view';
  productId: number | string;
  initialData?: Paquete[];
  persistToStorage?: boolean;
  isSeguros?: boolean;
}

const defaultPaquetesData: Paquete[] = [];

export const PaquetesTab = forwardRef<{ getData: () => Paquete[] }, PaquetesTabProps>(
  ({ mode, productId, initialData, persistToStorage, isSeguros }, ref) => {
    const storageKey = persistToStorage && productId ? `credito_paquetes_${productId}` : '';

    // ── Pre-seed: si hay initialData (DB) pero sessionStorage tiene [] vacío,
    // limpiar storage ANTES de que useTabPersistence haga lazy init ──
    const effectiveInitial = React.useMemo(() => {
      if (initialData && initialData.length > 0) {
        // Si sessionStorage tiene un array vacío, sobreescribir con datos de BD
        if (storageKey) {
          try {
            const stored = sessionStorage.getItem(storageKey);
            if (!stored || stored === '[]') {
              console.log(`[PaquetesTab] Pre-seeding sessionStorage con ${initialData.length} paquetes from DB`);
              sessionStorage.setItem(storageKey, JSON.stringify(initialData));
            }
          } catch (e) { /* ignore */ }
        }
        return initialData;
      }
      return defaultPaquetesData.map(p => ({ ...p, productId: typeof productId === 'number' ? productId : 0 }));
    }, [initialData, storageKey, productId]);

    const { data, setData } = useTabPersistence<Paquete>(
      storageKey,
      effectiveInitial
    );

    // ── Seed from DB: safety net para cuando useTabPersistence arrancó vacío
    // (race condition o StrictMode) pero initialData tiene datos reales ──
    const seededRef = React.useRef(false);
    useEffect(() => {
      if (!seededRef.current && initialData && initialData.length > 0 && data.length === 0) {
        console.log(`[PaquetesTab] Seeding ${initialData.length} paquetes from DB (initialData) — storageKey=${storageKey}`);
        setData(initialData);
        seededRef.current = true;
      }
    }, [initialData, data.length, setData, storageKey]);

    useImperativeHandle(ref, () => ({ getData: () => data }), [data]);

    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [showConsulta, setShowConsulta] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedItem, setSelectedItem] = useState<Paquete | undefined>();
    const [showMenu, setShowMenu] = useState(false);

    const isViewMode = mode === 'view';

    const handleDelete = () => {
      const checkedItems = data.filter(item => item.selectBoolean);
      if (checkedItems.length === 0 && selectedRow === null) {
        toast.error('Seleccione al menos un registro (checkbox o clic en fila)');
        return;
      }
      const count = checkedItems.length > 0 ? checkedItems.length : 1;
      const confirmed = window.confirm(`¿Está seguro de eliminar ${count} registro(s)?`);
      if (confirmed) {
        if (checkedItems.length > 0) {
          const idsToRemove = new Set(checkedItems.map(i => i.id));
          setData(data.filter(item => !idsToRemove.has(item.id)));
          if (selectedRow !== null && idsToRemove.has(selectedRow)) {
            setSelectedRow(null);
          }
        } else {
          setData(data.filter(item => item.id !== selectedRow));
          setSelectedRow(null);
        }
        toast.success(`${count} registro(s) eliminado(s)`);
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

    const handleEdit = (item: Paquete) => {
      if (isViewMode) {
        handleView(item);
        return;
      }
      setFormMode('edit');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleView = (item: Paquete) => {
      setFormMode('view');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleSaveForm = (formData: any) => {
      if (formMode === 'create') {
        const newItem: Paquete = {
          id: Math.max(...data.map(d => d.id), 0) + 1,
          productId: typeof productId === 'number' ? productId : 0,
          ...formData
        };
        setData([...data, newItem]);
        toast.success('Paquete creado');
      } else if (formMode === 'edit') {
        setData(data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d));
        toast.success('Paquete actualizado');
      }
      setShowFormModal(false);
    };

    const handleConsulta = () => {
      setShowConsulta(!showConsulta);
    };

    const handleToggleSelect = (itemId: number) => {
      if (isViewMode) {
        toast.warning('Modo solo lectura');
        return;
      }
      setData(data.map(d => d.id === itemId ? { ...d, selectBoolean: !d.selectBoolean } : d));
    };

    /** Map lineaProducto raw values to display labels */
    const displayLinea = (val: string) => {
      if (!val) return '';
      const map: Record<string, string> = { 'Credito': 'Crédito', 'Seguros': 'Seguros', 'Captacion': 'Captación' };
      return map[val] || val;
    };

    const lineaBadgeClass = (linea: string) => {
      const l = linea?.toLowerCase() || '';
      if (l.includes('seguro')) return 'bg-amber-100 text-amber-800';
      if (l.includes('credito') || l.includes('crédito')) return 'bg-blue-100 text-blue-800';
      if (l.includes('captacion') || l.includes('captación')) return 'bg-green-100 text-green-800';
      return 'bg-gray-100 text-gray-700';
    };

    return (
      <>
        <div className="bg-[#FAFBFC] border-2 border-gray-400">
          {/* ── Header institucional ── */}
          <div className="bg-gradient-to-r from-[#2E5C91] to-[#4A6FA5] px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Paquetes de Producto</span>
              <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 font-medium">{data.length}</span>
            </div>
            <div className="flex items-center gap-1">
              {!isViewMode && (
                <button
                  onClick={handleNew}
                  className="flex items-center gap-1 px-2.5 py-1 bg-white/15 text-white text-[10px] font-medium hover:bg-white/25 rounded-sm transition-colors border border-white/20"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Nuevo
                </button>
              )}
              {!isViewMode && (
                <button
                  onClick={handleDelete}
                  disabled={selectedRow === null && !data.some(d => d.selectBoolean)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-red-500/80 text-white text-[10px] font-medium hover:bg-red-600 rounded-sm transition-colors border border-red-400/30 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Eliminar
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="flex items-center gap-1 px-2 py-1 bg-white/15 text-white text-[10px] hover:bg-white/25 rounded-sm transition-colors border border-white/20"
                  title="Más opciones"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                </button>
                {showMenu && (
                  <div className="absolute top-full right-0 mt-1 bg-white border-2 border-gray-400 shadow-lg z-10 min-w-[160px] overflow-hidden">
                    <button onClick={() => { toast.success('Exportando a Excel'); setShowMenu(false); }} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-100 border-b border-gray-200">
                      <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Exportar a Excel
                    </button>
                    <button onClick={() => { toast.success('Exportando a CSV'); setShowMenu(false); }} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-100 border-b border-gray-200">
                      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      Exportar a CSV
                    </button>
                    <button onClick={() => { toast.success('Exportando a PDF'); setShowMenu(false); }} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-100 border-b border-gray-200">
                      <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      Exportar a PDF
                    </button>
                    <button onClick={() => { toast.success('Imprimiendo'); setShowMenu(false); }} className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-100">
                      <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                      Imprimir
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {showConsulta && (
            <div className="p-3 bg-[#F5F5F5] border-b-2 border-gray-400">
              <div className="flex gap-2">
                <button onClick={() => setShowConsulta(false)} className="px-3 py-1 bg-gray-600 text-white text-[10px] hover:bg-gray-700 rounded-sm">Cerrar</button>
              </div>
            </div>
          )}

          {/* ── Tabla maestro-detalle ── */}
          {data.length === 0 ? (
            <div className="bg-white border-t border-gray-300 py-8 flex flex-col items-center justify-center">
              <svg className="w-8 h-8 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Sin paquetes configurados</p>
              {!isViewMode && (
                <p className="text-[10px] text-gray-400 mt-1">Haga clic en <strong className="text-[#2E5C91]">Nuevo</strong> para agregar un producto al paquete</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-[#E8EDF2] border-b border-gray-400">
                    <th className="px-2 py-1.5 text-left font-semibold text-[#2E5C91] uppercase tracking-wider border-r border-gray-300 w-8">Sel</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-[#2E5C91] uppercase tracking-wider border-r border-gray-300 w-8">#</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-[#2E5C91] uppercase tracking-wider border-r border-gray-300 w-[50px]">Tipo</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-[#2E5C91] uppercase tracking-wider border-r border-gray-300">Producto</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-[#2E5C91] uppercase tracking-wider border-r border-gray-300 w-[120px]">Línea</th>
                    <th className="px-2 py-1.5 text-left font-semibold text-[#2E5C91] uppercase tracking-wider border-r border-gray-300 w-[120px]">Sub-línea</th>
                    <th className="px-2 py-1.5 text-center font-semibold text-[#2E5C91] uppercase tracking-wider w-[70px]">Acc.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, index) => {
                    const isSelected = selectedRow === item.id;
                    const isSeguro = (item.tipo || '').toLowerCase().includes('seguro') || (item.lineaProducto || '').toLowerCase().includes('seguro');
                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedRow(item.id)}
                        onDoubleClick={() => handleEdit(item)}
                        className={`cursor-pointer border-b border-gray-200 transition-colors ${
                          isSelected
                            ? 'bg-[#D6E4F0]'
                            : index % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-[#F8F9FA] hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center">
                          <input
                            type="checkbox"
                            checked={item.selectBoolean}
                            onChange={() => handleToggleSelect(item.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-3.5 h-3.5 cursor-pointer accent-[#2E5C91]"
                          />
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-center text-gray-500 font-medium">{index + 1}</td>
                        <td className="px-2 py-1.5 border-r border-gray-200">
                          <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                            isSeguro ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-[#D6E4F0] text-[#2E5C91] border border-[#B8CCE0]'
                          }`}>
                            {isSeguro ? 'SEG' : 'CRE'}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 border-r border-gray-200 font-medium text-gray-800 truncate max-w-[200px]">{item.paqueteProductoNombre}</td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-gray-600">{displayLinea(item.lineaProducto) || item.tipo || '—'}</td>
                        <td className="px-2 py-1.5 border-r border-gray-200 text-gray-600">{item.sublineaProducto || '—'}</td>
                        <td className="px-2 py-1.5 text-center">
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleView(item); }}
                              className="p-1 text-gray-400 hover:text-[#2E5C91] hover:bg-[#E8EDF2] rounded-sm transition-colors"
                              title="Ver detalle"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            {!isViewMode && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleEdit(item); }}
                                className="p-1 text-gray-400 hover:text-[#2E5C91] hover:bg-[#E8EDF2] rounded-sm transition-colors"
                                title="Editar"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Footer ── */}
          {data.length > 0 && (
            <div className="px-3 py-1.5 bg-[#E8EDF2] border-t border-gray-400 flex items-center justify-between">
              <span className="text-[10px] text-[#2E5C91] font-medium">{data.length} paquete(s) configurado(s)</span>
              <span className="text-[10px] text-gray-500">Doble clic para editar · Clic para seleccionar</span>
            </div>
          )}
        </div>

        {showFormModal && (
          <FormModal
            mode={formMode}
            item={selectedItem}
            productId={productId}
            onSave={handleSaveForm}
            onClose={() => setShowFormModal(false)}
            isSeguros={isSeguros}
          />
        )}
      </>
    );
  }
);

PaquetesTab.displayName = 'PaquetesTab';

interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: Paquete;
  productId: number | string;
  onSave: (data: any) => void;
  onClose: () => void;
  isSeguros?: boolean;
}

function FormModal({ mode, item, productId, onSave, onClose, isSeguros }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    selectBoolean: item?.selectBoolean !== undefined ? item.selectBoolean : true,
    paqueteProductoId: item?.paqueteProductoId || 0,
    paqueteProductoNombre: item?.paqueteProductoNombre || '',
    lineaProducto: item?.lineaProducto || '',
    sublineaProducto: item?.sublineaProducto || '',
    tipo: item?.tipo || 'Crédito',
  });

  const [showProductPicker, setShowProductPicker] = useState(false);

  // ── Hook real: consulta J_PRODUCTOS para el select directo ──
  const { productos: allProductos, loading: loadingProductos } = useProductosCatalogoDB(true);

  const ALLOWED_TYPES = ['Credito', 'Seguro'];
  const productosFiltrados = useMemo(() => {
    return allProductos.filter(p => {
      const t = (p.type || '').trim();
      const typeAllowed = ALLOWED_TYPES.some(allowed => allowed.toLowerCase() === t.toLowerCase());
      if (!typeAllowed) return false;
      // Si estamos en submódulo Seguros, solo mostrar productos cuya línea sea "Seguros"
      if (isSeguros) {
        const linea = (p.lineaProducto || '').toLowerCase();
        const tipo = t.toLowerCase();
        return linea.includes('seguro') || tipo === 'seguro';
      }
      return true;
    });
  }, [allProductos, isSeguros]);

  // ── Estado del buscador de productos ──
  const [prodSearchTerm, setProdSearchTerm] = useState('');

  const productosVisibles = useMemo(() => {
    if (!prodSearchTerm.trim()) return productosFiltrados;
    const t = prodSearchTerm.toLowerCase();
    return productosFiltrados.filter(p =>
      p.nombreProducto.toLowerCase().includes(t) ||
      (p.lineaProducto || '').toLowerCase().includes(t) ||
      (p.sublineaProducto || '').toLowerCase().includes(t)
    );
  }, [productosFiltrados, prodSearchTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }

    if (formData.paqueteProductoId === 0) {
      toast.error('Campos requeridos faltantes', {
        description: 'Por favor seleccione un Producto.',
      });
      return;
    }

    onSave({ ...formData });
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /** Called when user selects a product from the picker */
  const handleProductSelected = (producto: ProductoCatalogo) => {
    const lineaRaw = producto.lineaProducto || '';
    // Derive tipo from type (DB column) or lineaProducto
    let tipo = 'Otro';
    const dbType = (producto.type || '').toLowerCase();
    if (dbType === 'seguro' || lineaRaw.toLowerCase().includes('seguro')) tipo = 'Seguro';
    else if (dbType === 'credito' || lineaRaw.toLowerCase().includes('credito') || lineaRaw.toLowerCase().includes('crédito')) tipo = 'Crédito';
    else if (lineaRaw.toLowerCase().includes('captacion') || lineaRaw.toLowerCase().includes('captación')) tipo = 'Captación';

    setFormData(prev => ({
      ...prev,
      paqueteProductoId: producto.id as any,
      paqueteProductoNombre: producto.nombreProducto,
      lineaProducto: lineaRaw,
      sublineaProducto: producto.sublineaProducto || producto.tipoProducto || '',
      tipo,
    }));
    setShowProductPicker(false);
  };

  /** Display-friendly linea */
  const displayLinea = (val: string) => {
    if (!val) return '';
    const map: Record<string, string> = { 'Credito': 'Crédito', 'Seguros': 'Seguros', 'Captacion': 'Captación' };
    return map[val] || val;
  };

  const inputClassName = () => {
    const baseClass = 'w-full px-2 py-1 text-xs';
    if (isViewMode) {
      return `${baseClass} border-0 bg-transparent text-gray-700 cursor-default`;
    }
    return `${baseClass} border border-gray-400`;
  };

  const numInputClass = isViewMode
    ? 'w-full px-1.5 py-1 text-[11px] border-0 bg-transparent text-gray-700 cursor-default text-right'
    : 'w-full px-1.5 py-1 text-[11px] border border-gray-300 text-right focus:border-blue-400 focus:outline-none';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white shadow-2xl w-full max-w-[95vw] sm:max-w-2xl lg:max-w-3xl mx-2 max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded bg-white/15 flex items-center justify-center">
              {mode === 'create' ? (
                <svg className="w-3.5 h-3.5 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              ) : mode === 'edit' ? (
                <svg className="w-3.5 h-3.5 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              )}
            </div>
            <div>
              <h3 className="text-sm font-medium text-white">{mode === 'create' ? 'Nuevo Paquete' : mode === 'edit' ? 'Editar Paquete' : 'Ver Paquete'}</h3>
              <p className="text-[10px] text-white/50">
                {mode === 'create' ? 'Configure producto y matriz de seguro' : mode === 'edit' ? 'Modifique los datos del paquete' : 'Solo lectura'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-3 sm:px-6 py-4 sm:py-5 overflow-auto bg-[#FAFBFC]" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isViewMode) { e.preventDefault(); handleSubmit(e as any); } }}>
          <form onSubmit={handleSubmit}>
            {/* ═══ Sección: Producto ═══ */}
            <div className="mb-5">
              <div className="bg-gradient-to-r from-[#2E5C91] to-[#4A6FA5] px-4 py-2 mb-4 rounded-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span className="text-xs font-semibold text-white tracking-wide uppercase">Producto del Paquete</span>
                </div>
                {/* Toggle Activo */}
                <label className="flex items-center gap-1.5 cursor-pointer" onClick={e => e.stopPropagation()}>
                  <span className="text-[10px] text-white/70">Activo</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={formData.selectBoolean}
                      onChange={(e) => !isViewMode && handleChange('selectBoolean', e.target.checked)}
                      disabled={isViewMode}
                      className="sr-only peer"
                    />
                    <div className="w-7 h-4 bg-white/20 rounded-full peer-checked:bg-emerald-400 transition-colors" />
                    <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow peer-checked:translate-x-3 transition-transform" />
                  </div>
                </label>
              </div>

              <div className="space-y-4">
                {/* Select de producto */}
                <div>
                  <label className="block text-[11px] text-gray-600 mb-1.5 font-semibold uppercase tracking-wider">
                    Producto <span className="text-red-500">*</span>
                  </label>
                  {/* Buscador + lista de productos */}
                  <div className="border border-gray-400 bg-white overflow-hidden">
                    {/* Buscador */}
                    {!isViewMode && !loadingProductos && productosFiltrados.length > 3 && (
                      <div className="px-2.5 py-2 border-b border-gray-300 bg-[#F0F4F8]">
                        <div className="relative">
                          <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <input
                            type="text"
                            value={prodSearchTerm}
                            onChange={e => setProdSearchTerm(e.target.value)}
                            placeholder="Filtrar productos..."
                            className="w-full pl-7 pr-8 py-1.5 text-xs border border-gray-300 bg-white focus:border-[#2E5C91] focus:outline-none"
                          />
                          {prodSearchTerm && (
                            <button type="button" onClick={() => setProdSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1">{productosVisibles.length} de {productosFiltrados.length} producto(s)</p>
                      </div>
                    )}
                    {/* Lista */}
                    <div className="overflow-y-auto" style={{ maxHeight: '180px' }}>
                      {loadingProductos ? (
                        <div className="flex items-center justify-center gap-2 py-6">
                          <div className="w-4 h-4 border-2 border-[#4A6FA5] border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-[#4A6FA5]">Consultando J_PRODUCTOS...</span>
                        </div>
                      ) : productosVisibles.length === 0 ? (
                        <div className="py-6 text-center">
                          <p className="text-xs text-gray-400">{prodSearchTerm ? 'Sin resultados' : 'No hay productos disponibles'}</p>
                        </div>
                      ) : (
                        productosVisibles.map((p) => {
                          const isActive = String(formData.paqueteProductoId) === String(p.id);
                          const isSeguro = (p.type || '').toLowerCase() === 'seguro' || (p.lineaProducto || '').toLowerCase().includes('seguro');
                          return (
                            <button
                              key={p.id}
                              type="button"
                              disabled={isViewMode}
                              onClick={() => {
                                if (isActive) {
                                  setFormData(prev => ({ ...prev, paqueteProductoId: 0, paqueteProductoNombre: '', lineaProducto: '', sublineaProducto: '', tipo: 'Crédito' }));
                                } else {
                                  handleProductSelected(p);
                                }
                              }}
                              className={`w-full text-left px-3 py-2 flex items-center gap-2 border-b border-gray-100 last:border-b-0 transition-colors ${
                                isActive
                                  ? 'bg-[#2E5C91]/8 border-l-[3px] border-l-[#2E5C91]'
                                  : isViewMode
                                  ? 'cursor-default'
                                  : 'hover:bg-gray-50 border-l-[3px] border-l-transparent cursor-pointer'
                              }`}
                            >
                              <span className={`flex-shrink-0 inline-block w-[38px] text-center py-px text-[9px] font-bold uppercase tracking-wide ${
                                isSeguro ? 'bg-amber-100 text-amber-700' : 'bg-[#D6E4F0] text-[#2E5C91]'
                              }`}>
                                {isSeguro ? 'SEG' : 'CRE'}
                              </span>
                              <span className="flex-1 min-w-0 text-xs text-gray-800 truncate">{p.nombreProducto}</span>
                              {p.sublineaProducto && (
                                <span className="hidden sm:inline text-[10px] text-gray-400 truncate max-w-[120px]">{p.sublineaProducto}</span>
                              )}
                              {isActive && (
                                <svg className="w-3.5 h-3.5 text-[#2E5C91] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {/* Detalle del producto seleccionado */}
                {formData.paqueteProductoId !== 0 && (
                  <div className="bg-white border border-gray-200 rounded-sm p-3 shadow-sm">
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${formData.tipo === 'Seguro' ? 'bg-amber-500' : 'bg-[#2E5C91]'}`} />
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Detalle del producto</span>
                      <span className="text-[9px] text-gray-400 ml-1">ID: {formData.paqueteProductoId}</span>
                      <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-medium ${
                        formData.tipo === 'Seguro' ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : formData.tipo === 'Crédito' ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-gray-50 text-gray-600 border border-gray-200'
                      }`}>{formData.tipo}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                      <div>
                        <span className="block text-[10px] text-gray-400 mb-0.5">Nombre</span>
                        <span className="block text-xs text-gray-800 font-medium">{formData.paqueteProductoNombre || '-'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-400 mb-0.5">Línea</span>
                        <span className="block text-xs text-gray-700">{displayLinea(formData.lineaProducto) || '-'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-400 mb-0.5">Sub-línea</span>
                        <span className="block text-xs text-gray-700">{formData.sublineaProducto || '-'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ═══ Resumen de validación pre-guardado ═══ */}
            {!isViewMode && (() => {
              const issues: string[] = [];
              if (formData.paqueteProductoId === 0) issues.push('Seleccione un Producto');
              if (issues.length > 0) {
                return (
                  <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-sm">
                    <div className="flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      <div>
                        <span className="text-[10px] font-semibold text-red-700">Pendiente para guardar:</span>
                        <ul className="mt-0.5 space-y-0.5">
                          {issues.map((issue, i) => (
                            <li key={i} className="text-[10px] text-red-600 flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-red-400 flex-shrink-0" />
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <span className="text-[10px] text-gray-400">
                {!isViewMode && <><kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[9px] font-mono">Esc</kbd> cerrar &nbsp; <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[9px] font-mono">Ctrl+Enter</kbd> guardar</>}
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-5 py-1.5 bg-white text-gray-600 text-xs font-medium border border-gray-300 hover:bg-gray-50 rounded-sm transition-colors">
                  {isViewMode ? 'Cerrar' : 'Cancelar'}
                </button>
                {!isViewMode && (
                  <button type="submit" className="flex items-center gap-1.5 px-5 py-1.5 bg-[#2E5C91] text-white text-xs font-medium hover:bg-[#24497A] rounded-sm transition-colors shadow-sm">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Guardar
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* ═══ Modal de Picker de Productos ═══ */}
      {showProductPicker && (
        <ProductPickerModal
          onSelect={handleProductSelected}
          onClose={() => setShowProductPicker(false)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Product Picker Modal — consulta J_PRODUCTOS via Edge Function
   Filtra por type IN ('Credito', 'Seguro') — datos reales de BD
   ═══════════════════════════════════════════════════════════════════ */

interface ProductPickerModalProps {
  onSelect: (producto: ProductoCatalogo) => void;
  onClose: () => void;
}

function ProductPickerModal({ onSelect, onClose }: ProductPickerModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Hook real: consulta J_PRODUCTOS via Edge Function /productos ──
  const { productos: allProductos, loading, error, backendStatus } = useProductosCatalogoDB(true);

  /** Filtrado estricto: solo type IN ('Credito', 'Seguro') */
  const ALLOWED_TYPES = ['Credito', 'Seguro'];

  const filteredProducts = useMemo(() => {
    // Paso 1: filtrar por type de BD (columna real de J_PRODUCTOS)
    let products = allProductos.filter(p => {
      const t = (p.type || '').trim();
      return ALLOWED_TYPES.some(allowed => allowed.toLowerCase() === t.toLowerCase());
    });

    // Paso 2: búsqueda de texto libre
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      products = products.filter(p =>
        p.nombreProducto.toLowerCase().includes(term) ||
        (p.tipoProducto || '').toLowerCase().includes(term) ||
        (p.lineaProducto || '').toLowerCase().includes(term) ||
        (p.claveProducto || '').toLowerCase().includes(term)
      );
    }

    return products;
  }, [allProductos, searchTerm]);

  const displayLinea = (val: string) => {
    if (!val) return '';
    const map: Record<string, string> = { 'Credito': 'Crédito', 'Seguros': 'Seguros', 'Seguro': 'Seguros', 'Captacion': 'Captación' };
    return map[val] || val;
  };

  const handleConfirm = () => {
    if (selectedId === null) {
      toast.warning('Seleccione un producto de la lista');
      return;
    }
    const producto = allProductos.find(p => p.id === selectedId);
    if (producto) onSelect(producto);
  };

  /** Badge de estado de conexión */
  const statusBadge = () => {
    if (loading) return <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-yellow-100 text-yellow-800 animate-pulse">Cargando BD...</span>;
    if (backendStatus === 'connected') return <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-green-100 text-green-800">BD Conectada</span>;
    if (backendStatus === 'fallback') return <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-orange-100 text-orange-800">Cache Local</span>;
    return <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-red-100 text-red-800">Datos Fallback</span>;
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="bg-white shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Seleccionar Producto</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        {/* Search bar */}
        <div className="px-4 py-3 bg-[#F5F5F5] border-b border-gray-300">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, línea, tipo o clave..."
              className="flex-1 px-2 py-1.5 text-xs border border-gray-400 focus:border-blue-400 focus:outline-none"
              autoFocus
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-gray-500">
              Filtro: <strong>type IN ('Credito', 'Seguro')</strong> sobre J_PRODUCTOS
            </p>
            {statusBadge()}
          </div>
          {error && (
            <p className="text-[10px] text-red-600 mt-1">⚠ {error} — mostrando datos de respaldo</p>
          )}
        </div>

        {/* Product table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs text-gray-500">Consultando J_PRODUCTOS...</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0">
                <tr className="bg-[#4A6FA5] text-white">
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Línea Producto</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Tipo (Sub-línea)</th>
                  <th className="px-3 py-2 text-left font-medium text-xs whitespace-nowrap">Nombre Producto</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-gray-500 text-xs">
                      No se encontraron productos con type IN ('Credito', 'Seguro')
                      {searchTerm && <span className="block mt-1">Intente con otro término de búsqueda</span>}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((producto, index) => {
                    const isSelected = selectedId === producto.id;
                    const lineaLabel = displayLinea(producto.lineaProducto);
                    const isSeguro = (producto.type || '').toLowerCase() === 'seguro' || (producto.lineaProducto || '').toLowerCase().includes('seguro');
                    return (
                      <tr
                        key={producto.id}
                        onClick={() => setSelectedId(producto.id)}
                        onDoubleClick={() => { setSelectedId(producto.id); onSelect(producto); }}
                        className={`border-b border-gray-200 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#D6EAF8] ring-1 ring-inset ring-blue-300'
                            : index % 2 === 0
                            ? 'bg-white hover:bg-[#E8F4F8]'
                            : 'bg-[#F9F9F9] hover:bg-[#E8F4F8]'
                        }`}
                      >
                        <td className="px-3 py-2.5 text-xs border-r border-gray-200">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                            isSeguro ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {lineaLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700 border-r border-gray-200">{producto.sublineaProducto || producto.tipoProducto || '-'}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-800 font-medium">{producto.nombreProducto}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#F5F5F5] border-t border-gray-300 flex items-center justify-between">
          <span className="text-[10px] text-gray-500">
            {filteredProducts.length} producto(s) de {allProductos.length} total
            {backendStatus === 'connected' && <span className="text-green-700 ml-1">(BD real)</span>}
            {backendStatus === 'fallback' && <span className="text-orange-700 ml-1">(cache)</span>}
            {backendStatus === 'offline' && <span className="text-red-700 ml-1">(fallback)</span>}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-1.5 bg-gray-500 text-white text-xs hover:bg-gray-600">Cancelar</button>
            <button
              onClick={handleConfirm}
              disabled={selectedId === null}
              className="px-4 py-1.5 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Seleccionar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}