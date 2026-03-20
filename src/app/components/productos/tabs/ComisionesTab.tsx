import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { useTabPersistence } from '@/app/hooks/useProductoPersistence';

// ═══════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════
interface Comision {
  id: number;
  productId: number;
  transaccion: string;
  tipoComision: 'Porcentaje' | 'Monto' | '';
  percentage: string;
  amount: string;
  moneda: string;
  sobre: string;
  assetBoolean: boolean;
}

interface CargoItem {
  id: number;
  tipoCargo: string;
  descripcion: string;
  [k: string]: any;
}

interface ComisionesTabProps {
  mode: 'nuevo' | 'editar' | 'ver' | 'create' | 'edit' | 'view';
  productId?: number | string;
  initialData?: Comision[];
  onDataChange?: (data: Comision[]) => void;
  cargos?: CargoItem[];
  storagePrefix?: string;
}

// ═══════════════════════════════════════════════════════════════
// Catálogos fijos
// ═══════════════════════════════════════════════════════════════
const TRANSACCIONES = [
  'Apertura Cuenta',
  'Manejo Cuenta',
  'Disposición Capital',
  'Depósito Efectivo',
  'Retiro en Cajero',
  'Cancelación Cuenta',
  'Transferencia Interbancaria',
  'Impresión Estado de Cuenta',
];

const MONEDAS = ['MXN', 'USD', 'EUR', 'CAD', 'GBP'];

// ═══════════════════════════════════════════════════════════════
// Helper: leer cargos desde sessionStorage (CargoTab pattern)
// ═══════════════════════════════════════════════════════════════
function readCargosFromStorage(productId: number | string, storagePrefix: string = 'credito'): CargoItem[] {
  try {
    const key = `${storagePrefix}_cargo_${productId}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch { return []; }
}

// ═════════════════════════��════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════
export const ComisionesTab = forwardRef<{ getData: () => Comision[] }, ComisionesTabProps>(
  ({ mode, productId = 0, initialData = [], onDataChange, cargos, storagePrefix }, ref) => {
    const prefix = storagePrefix || 'credito';
    const storageKey = `${prefix}_comisiones_producto_${productId || 'nuevo'}`;

    // ══════════════════════════════════════════════════════════════
    // FIX: Comisiones es 100% manual. Sin defaults hardcodeados.
    // ══════════════════════════════════════════════════════════════
    const defaultComisiones: Comision[] = [];

    const isCreate = mode === 'create' || mode === 'nuevo';
    if (isCreate && storageKey) {
      // ComisionesTab usa localStorage (storageType: 'local'), limpiar ambos por seguridad
      try { localStorage.removeItem(storageKey); } catch (_) { /* ignore */ }
      try { sessionStorage.removeItem(storageKey); } catch (_) { /* ignore */ }
    }

    const { data, setData } = useTabPersistence<Comision>(
      storageKey,
      Array.isArray(initialData) && initialData.length > 0 ? initialData : defaultComisiones,
      { storageType: 'local' }
    );

    const safeData = Array.isArray(data) ? data : [];

    useImperativeHandle(ref, () => ({
      getData: () => data,
    }), [data]);

    useEffect(() => {
      if (onDataChange) {
        onDataChange(data);
      }
    }, [data, onDataChange]);

    // ── Cargos: prop > sessionStorage > fallback ──
    const [cargosDisponibles, setCargosDisponibles] = useState<CargoItem[]>([]);
    useEffect(() => {
      if (cargos && cargos.length > 0) {
        setCargosDisponibles(cargos);
      } else {
        const fromStorage = readCargosFromStorage(productId, prefix);
        if (fromStorage.length > 0) {
          setCargosDisponibles(fromStorage);
        }
      }
    }, [cargos, productId, prefix]);

    // ── Refrescar cargos al abrir modal (BD + sessionStorage) ──
    const refreshCargosDisponibles = () => {
      const fromDB: CargoItem[] = cargos && cargos.length > 0 ? cargos : [];
      const fromStorage = readCargosFromStorage(productId, prefix);
      // Merge: DB como base, agregar de storage los que no existan por id
      const dbIds = new Set(fromDB.map(c => c.id));
      const merged = [...fromDB, ...fromStorage.filter(c => !dbIds.has(c.id))];
      setCargosDisponibles(merged.length > 0 ? merged : fromStorage);
    };

    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedItem, setSelectedItem] = useState<Comision | undefined>();
    const [showMenu, setShowMenu] = useState(false);
    const [deleteMode, setDeleteMode] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

    const isViewMode = mode === 'ver' || mode === 'view';

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
        toast.success('Comisión eliminada correctamente');
      }
    };

    const handleNew = () => {
      if (isViewMode) {
        toast.warning('Modo solo lectura');
        return;
      }
      refreshCargosDisponibles();
      setFormMode('create');
      setSelectedItem(undefined);
      setShowFormModal(true);
    };

    const handleEdit = (item: Comision) => {
      if (isViewMode) {
        handleView(item);
        return;
      }
      refreshCargosDisponibles();
      setFormMode('edit');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleView = (item: Comision) => {
      refreshCargosDisponibles();
      setFormMode('view');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleSaveForm = (formData: Omit<Comision, 'id' | 'productId'>) => {
      if (formMode === 'create') {
        const newItem: Comision = {
          id: Math.max(...safeData.map(d => d.id), 0) + 1,
          productId: typeof productId === 'number' ? productId : 0,
          ...formData,
        };
        setData([...data, newItem]);
        toast.success('Comisión creada correctamente');
      } else if (formMode === 'edit') {
        setData(safeData.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d));
        toast.success('Comisión actualizada correctamente');
      }
      setShowFormModal(false);
    };

    return (
      <>
        <div className="bg-white">
          {/* Header temático */}
          <div className="section-header-theme px-4 py-2 mb-4 flex items-center justify-between rounded-t">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Comisiones — Configuración por transacción
            </span>
            {!isViewMode && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleNew}
                  className="px-4 py-1 rounded text-xs font-medium transition-colors bg-white/20 text-white hover:bg-white/30"
                >
                  + Nuevo
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

          {/* Barra de acciones */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] rounded flex items-center gap-1"
              >
                Menú
                <svg width="10" height="6" viewBox="0 0 10 6" fill="white"><path d="M0 0l5 6 5-6z"/></svg>
              </button>
              {showMenu && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 shadow-lg z-10 min-w-[160px] rounded overflow-hidden">
                  <button onClick={() => { toast.success('Exportando a Excel'); setShowMenu(false); }} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 border-b border-gray-100">Exportar a Excel</button>
                  <button onClick={() => { toast.success('Exportando a CSV'); setShowMenu(false); }} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 border-b border-gray-100">Exportar a CSV</button>
                  <button onClick={() => { toast.success('Exportando a PDF'); setShowMenu(false); }} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50 border-b border-gray-100">Exportar a PDF</button>
                  <button onClick={() => { toast.success('Imprimiendo...'); setShowMenu(false); }} className="block w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-blue-50">Imprimir</button>
                </div>
              )}
            </div>

            <span className="text-[11px] text-gray-500 ml-auto">
              Doble clic para {isViewMode ? 'ver detalle' : 'editar'}
            </span>
          </div>

          {/* Tabla */}
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead className="table-header-theme">
                <tr>
                  {deleteMode && !isViewMode && (
                    <th className="text-center px-2 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-16">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </th>
                  )}
                  <th className="text-left px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Transacción</th>
                  <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-28">Tipo Comisión</th>
                  <th className="text-right px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-24">Porcentaje</th>
                  <th className="text-right px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-28">Monto</th>
                  <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-20">Moneda</th>
                  <th className="text-left px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-32">Sobre</th>
                  <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-20">Activo</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={deleteMode && !isViewMode ? 9 : 8} className="px-3 py-10 text-center text-gray-400 text-xs">
                      <div className="flex flex-col items-center gap-2">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                          <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="font-medium text-gray-500">No hay comisiones configuradas</span>
                        {!isViewMode && (
                          <span className="text-gray-400">Haga clic en "+ Nuevo" para agregar una comisión</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  safeData.map((item, index) => (
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
                        <td className="text-center px-2 py-1.5 border-b border-gray-200">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteRequest(item.id); }}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                            title="Eliminar comisión"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                          </button>
                        </td>
                      )}
                      <td className="px-3 py-1.5 border-b border-gray-200 font-medium text-gray-800">{item.transaccion}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${
                          item.tipoComision === 'Porcentaje' ? 'bg-blue-50 text-blue-700' :
                          item.tipoComision === 'Monto' ? 'bg-green-50 text-green-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {item.tipoComision || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-right font-mono">
                        {item.tipoComision === 'Porcentaje' && item.percentage ? `${item.percentage}%` : '—'}
                      </td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-right font-mono">
                        {item.tipoComision === 'Monto' && item.amount ? `$${item.amount}` : '—'}
                      </td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-center">
                        <span className="text-gray-600">{item.moneda}</span>
                      </td>
                      <td className="px-3 py-1.5 border-b border-gray-200">
                        {item.tipoComision === 'Porcentaje' && item.sobre ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium">
                            {item.sobre}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          item.assetBoolean ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${item.assetBoolean ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {item.assetBoolean ? 'Sí' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer con stats */}
          <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] text-gray-500">
              Total: <span className="font-semibold text-gray-700">{data.length}</span> comisi{data.length !== 1 ? 'ones' : 'ón'}
            </span>
            {data.length > 0 && (
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-blue-600">
                  <span className="font-semibold">{data.filter(d => d.tipoComision === 'Porcentaje').length}</span> por porcentaje
                </span>
                <span className="text-gray-400">|</span>
                <span className="text-green-600">
                  <span className="font-semibold">{data.filter(d => d.tipoComision === 'Monto').length}</span> por monto
                </span>
              </div>
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
                  <p className="text-sm font-medium text-gray-800 mb-1">¿Eliminar esta comisión?</p>
                  <p className="text-xs text-gray-500">La comisión será removida de la configuración del producto.</p>
                </div>
              </div>
              <div className="bg-gray-50 px-6 py-3 flex justify-end gap-2.5 border-t border-gray-200">
                <button onClick={() => { setShowDeleteModal(false); setDeleteTargetId(null); }} className="px-5 py-1.5 text-xs bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-50 font-medium transition-colors">
                  Cancelar
                </button>
                <button onClick={confirmDelete} className="px-5 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-medium transition-colors shadow-sm">
                  Sí, Eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de formulario */}
        {showFormModal && (
          <ComisionFormModal
            mode={formMode}
            item={selectedItem}
            cargosDisponibles={cargosDisponibles}
            onSave={handleSaveForm}
            onClose={() => setShowFormModal(false)}
          />
        )}
      </>
    );
  }
);

ComisionesTab.displayName = 'ComisionesTab';

// ═══════════════════════════════════════════════════════════════
// Modal de formulario
// ═══════════════════════════════════════════════════════════════
interface ComisionFormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: Comision;
  cargosDisponibles: CargoItem[];
  onSave: (data: Omit<Comision, 'id' | 'productId'>) => void;
  onClose: () => void;
}

function ComisionFormModal({ mode, item, cargosDisponibles, onSave, onClose }: ComisionFormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    transaccion: item?.transaccion || '',
    tipoComision: (item?.tipoComision || '') as 'Porcentaje' | 'Monto' | '',
    percentage: item?.percentage || '',
    amount: item?.amount || '',
    moneda: item?.moneda || 'MXN',
    sobre: item?.sobre || '',
    assetBoolean: item?.assetBoolean !== undefined ? item.assetBoolean : true,
  });

  const isPorcentaje = formData.tipoComision === 'Porcentaje';
  const isMonto = formData.tipoComision === 'Monto';

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTipoComisionChange = (tipo: 'Porcentaje' | 'Monto' | '') => {
    setFormData(prev => ({
      ...prev,
      tipoComision: tipo,
      // Limpiar campos del tipo contrario al cambiar
      ...(tipo === 'Porcentaje' ? { amount: '' } : {}),
      ...(tipo === 'Monto' ? { percentage: '', sobre: '' } : {}),
    }));
  };

  const handlePercentageChange = (value: string) => {
    // Permitir vacío, números y un punto decimal
    const cleaned = value.replace(/[^0-9.]/g, '');
    // Validar rango 1-100 solo al guardar, aquí solo sanitizar input
    const parts = cleaned.split('.');
    if (parts.length > 2) return; // No permitir más de un punto
    handleChange('percentage', cleaned);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) { onClose(); return; }

    // Validaciones
    if (!formData.transaccion) {
      toast.error('Campo requerido', { description: 'Seleccione una transacción' });
      return;
    }
    if (!formData.tipoComision) {
      toast.error('Campo requerido', { description: 'Seleccione un tipo de comisión' });
      return;
    }
    if (!formData.moneda) {
      toast.error('Campo requerido', { description: 'Seleccione una moneda' });
      return;
    }

    if (isPorcentaje) {
      if (!formData.percentage.trim()) {
        toast.error('Campo requerido', { description: 'Ingrese el porcentaje de la comisión' });
        return;
      }
      const pctNum = parseFloat(formData.percentage);
      if (isNaN(pctNum) || pctNum < 1 || pctNum > 100) {
        toast.error('Porcentaje inválido', { description: 'El porcentaje debe estar entre 1 y 100' });
        return;
      }
      if (!formData.sobre) {
        toast.error('Campo requerido', { description: 'Seleccione el cargo sobre el cual aplica el porcentaje' });
        return;
      }
    }

    if (isMonto) {
      if (!formData.amount.trim()) {
        toast.error('Campo requerido', { description: 'Ingrese el monto de la comisión' });
        return;
      }
      const amtNum = parseFloat(formData.amount);
      if (isNaN(amtNum) || amtNum <= 0) {
        toast.error('Monto inválido', { description: 'El monto debe ser mayor a 0' });
        return;
      }
    }

    onSave(formData);
  };

  const inputClassName = (disabled?: boolean) => {
    const baseClass = 'w-full px-2.5 py-1.5 text-xs rounded';
    if (isViewMode || disabled) {
      return `${baseClass} border-0 bg-gray-50 text-gray-700 cursor-default`;
    }
    return `${baseClass} border border-gray-300 bg-white focus:border-blue-500 focus:ring-1 ring-blue-500 outline-none transition-colors`;
  };

  const disabledClassName = 'w-full px-2.5 py-1.5 text-xs rounded border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header-theme px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-wide uppercase">
            {mode === 'create' ? 'Nueva Comisión' : mode === 'edit' ? 'Editar Comisión' : 'Detalle de Comisión'}
          </span>
          <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center transition-colors" title="Cerrar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-4 border-l-4 border-[#2E5C91] rounded-r">
                <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Información de Comisión</span>
              </div>

              <div className="grid grid-cols-2 gap-x-5 gap-y-4">

                {/* 1. Transacción */}
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Transacción <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.transaccion}
                    onChange={(e) => handleChange('transaccion', e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName()}
                  >
                    <option value="">— Seleccionar transacción —</option>
                    {TRANSACCIONES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Tipo Comisión */}
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Tipo Comisión <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.tipoComision}
                    onChange={(e) => handleTipoComisionChange(e.target.value as any)}
                    disabled={isViewMode}
                    className={inputClassName()}
                  >
                    <option value="">— Seleccionar tipo —</option>
                    <option value="Porcentaje">Porcentaje</option>
                    <option value="Monto">Monto</option>
                  </select>
                  {formData.tipoComision && (
                    <span className="text-[10px] text-blue-600 mt-0.5 block">
                      {isPorcentaje
                        ? 'Se habilitarán los campos Porcentaje y Sobre'
                        : 'Se habilitará únicamente el campo Monto'}
                    </span>
                  )}
                </div>

                {/* 3. Porcentaje — habilitado solo cuando tipo = Porcentaje */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Porcentaje {isPorcentaje && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.percentage}
                      onChange={(e) => handlePercentageChange(e.target.value)}
                      disabled={isViewMode || !isPorcentaje}
                      placeholder={isPorcentaje ? 'Ej: 5, 10.5, 15.75' : '—'}
                      className={!isPorcentaje && !isViewMode ? disabledClassName : inputClassName(!isPorcentaje)}
                    />
                    {isPorcentaje && (
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    )}
                  </div>
                  {isPorcentaje && (
                    <span className="text-[10px] text-gray-400 mt-0.5 block">Rango permitido: 1 a 100</span>
                  )}
                </div>

                {/* 4. Sobre — habilitado solo cuando tipo = Porcentaje, valores del subtab Cargo */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Sobre {isPorcentaje && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={formData.sobre}
                    onChange={(e) => handleChange('sobre', e.target.value)}
                    disabled={isViewMode || !isPorcentaje}
                    className={!isPorcentaje && !isViewMode ? disabledClassName : inputClassName(!isPorcentaje)}
                  >
                    <option value="">{isPorcentaje ? '— Seleccionar cargo —' : '—'}</option>
                    {cargosDisponibles.map(c => (
                      <option key={c.id} value={c.tipoCargo}>
                        {c.tipoCargo} — {c.descripcion}
                      </option>
                    ))}
                  </select>
                  {isPorcentaje && cargosDisponibles.length === 0 && (
                    <span className="text-[10px] text-amber-600 mt-0.5 block">Configure cargos en el subtab "Cargo" primero</span>
                  )}
                  {isPorcentaje && cargosDisponibles.length > 0 && (
                    <span className="text-[10px] text-gray-400 mt-0.5 block">Valores del subtab Cargo</span>
                  )}
                </div>

                {/* 5. Monto — habilitado solo cuando tipo = Monto */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Monto {isMonto && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    {isMonto && (
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                    )}
                    <input
                      type="text"
                      maxLength={30}
                      value={formData.amount}
                      onChange={(e) => handleChange('amount', e.target.value.replace(/[^0-9.]/g, ''))}
                      disabled={isViewMode || !isMonto}
                      placeholder={isMonto ? 'Ej: 100, 500.50, 1000' : '—'}
                      className={`${!isMonto && !isViewMode ? disabledClassName : inputClassName(!isMonto)} ${isMonto ? 'pl-5' : ''}`}
                    />
                  </div>
                  {isMonto && (
                    <span className="text-[10px] text-gray-400 mt-0.5 block">Monto fijo en la moneda seleccionada</span>
                  )}
                </div>

                {/* 6. Moneda */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    Moneda <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.moneda}
                    onChange={(e) => handleChange('moneda', e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName()}
                  >
                    <option value="">— Seleccionar moneda —</option>
                    {MONEDAS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* 7. Activo */}
                <div className="col-span-2">
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Activo</label>
                  <div className="flex items-center gap-2 mt-1">
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
                      {formData.assetBoolean ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <button type="button" onClick={onClose} className="px-4 py-1.5 rounded text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors">
                {isViewMode ? 'Cerrar' : 'Cancelar'}
              </button>
              {!isViewMode && (
                <button type="submit" className="px-5 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium transition-colors shadow-sm">
                  {mode === 'create' ? 'Agregar Comisión' : 'Guardar Cambios'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}