/**
 * Cobertura2oPisoTab — Parámetros de cobertura y comisión de la Garantía de Pago
 * Oportuno (GPO) para el producto "Garantía Financiera 2o Piso".
 *
 * REQ-8. Mismo patrón de UI que ComisionesTab: cabecera temática con "+ Nuevo" /
 * "Eliminar", barra de acciones con menú de exportación, listado, y alta/edición
 * por modal. Al guardar el renglón se muestra en el listado.
 *
 * Sin datos predeterminados: abre vacío.
 * Se persiste como `data.cobertura2oPiso` (array).
 */
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { useTabPersistence } from '@/app/hooks/useProductoPersistence';
import type { CoberturaComisiones2oPiso } from '@/app/types/productoLineaCredito';

// Del requerimiento: "Sobre (drop list Monto Emisión, Saldo Garantizado)"
const BASES_CALCULO = ['Monto Emisión', 'Saldo Garantizado'];

interface Props {
  mode: 'create' | 'edit' | 'view';
  productId: number | string;
  initialData?: CoberturaComisiones2oPiso[];
  persistToStorage?: boolean;
}

/** '' y undefined no son 0: solo valida lo capturado. */
const num = (v: number | string): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

const fmtPct = (v: number | string) => (num(v) === null ? '—' : `${v}%`);

export const Cobertura2oPisoTab = forwardRef<{ getData: () => CoberturaComisiones2oPiso[] }, Props>(
  ({ mode, productId, initialData, persistToStorage }, ref) => {
    const storageKey = persistToStorage && productId ? `linea_credito_cobertura_2o_piso_${productId}` : '';
    const isViewMode = mode === 'view';


    // BUG FIX (mismo que ComisionesTab): limpiar storage solo UNA VEZ al montar,
    // no en cada render. Sin el guard, cada alta re-renderiza y vuelve a borrar el
    // storage que useTabPersistence acaba de escribir, desincronizando storage y
    // estado — el renglón agregado "no aparece" en el listado.
    const clearedOnCreateRef = useRef(false);
    useEffect(() => {
      if (mode === 'create' && storageKey && !clearedOnCreateRef.current) {
        try { sessionStorage.removeItem(storageKey); } catch (_) { /* ignore */ }
        try { localStorage.removeItem(storageKey); } catch (_) { /* ignore */ }
        clearedOnCreateRef.current = true;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { data, setData } = useTabPersistence<CoberturaComisiones2oPiso>(
      storageKey,
      initialData && initialData.length > 0 ? initialData : []
    );

    useImperativeHandle(ref, () => ({ getData: () => data }), [data]);

    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedItem, setSelectedItem] = useState<CoberturaComisiones2oPiso | undefined>();
    const [showMenu, setShowMenu] = useState(false);
    const [deleteMode, setDeleteMode] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

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
        toast.success('Configuración eliminada correctamente');
      }
    };

    const handleNew = () => {
      if (isViewMode) { toast.warning('Modo solo lectura'); return; }
      setFormMode('create');
      setSelectedItem(undefined);
      setShowFormModal(true);
    };

    const handleEdit = (item: CoberturaComisiones2oPiso) => {
      setFormMode(isViewMode ? 'view' : 'edit');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleSaveForm = (formData: Omit<CoberturaComisiones2oPiso, 'id' | 'productId'>) => {
      if (formMode === 'create') {
        const newItem: CoberturaComisiones2oPiso = {
          id: Math.max(...data.map(d => d.id), 0) + 1,
          productId: typeof productId === 'number' ? productId : 0,
          ...formData,
        };
        setData([...data, newItem]);
        toast.success('Configuración creada correctamente');
      } else if (formMode === 'edit') {
        setData(data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d));
        toast.success('Configuración actualizada correctamente');
      }
      setShowFormModal(false);
    };

    const colSpan = deleteMode && !isViewMode ? 9 : 8;

    return (
      <>
        <div className="bg-white">
          {/* Header temático */}
          <div className="section-header-theme px-4 py-2 mb-4 flex items-center justify-between rounded-t">
            <span className="text-xs font-semibold tracking-wide uppercase">
              Cobertura y Comisiones 2o Piso — Rangos de negociación de la GPO
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
          <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="table-header-theme">
                <tr>
                  {deleteMode && !isViewMode && (
                    <th rowSpan={2} className="text-center px-2 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-16 border-r border-white/20">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </th>
                  )}
                  <th colSpan={4} className="text-center px-3 py-1.5 font-semibold text-white/90 text-[11px] uppercase tracking-wide border-r border-white/20">Cobertura</th>
                  <th colSpan={4} className="text-center px-3 py-1.5 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Comisión</th>
                </tr>
                <tr>
                  <th className="text-right px-3 py-2 font-semibold text-white/80 text-[10px] uppercase tracking-wide w-20">% Mín</th>
                  <th className="text-right px-3 py-2 font-semibold text-white/80 text-[10px] uppercase tracking-wide w-24">% Default</th>
                  <th className="text-right px-3 py-2 font-semibold text-white/80 text-[10px] uppercase tracking-wide w-20">% Máx</th>
                  <th className="text-left px-3 py-2 font-semibold text-white/80 text-[10px] uppercase tracking-wide w-36 border-r border-white/20">Sobre</th>
                  <th className="text-right px-3 py-2 font-semibold text-white/80 text-[10px] uppercase tracking-wide w-20">% Mín</th>
                  <th className="text-right px-3 py-2 font-semibold text-white/80 text-[10px] uppercase tracking-wide w-24">% Default</th>
                  <th className="text-right px-3 py-2 font-semibold text-white/80 text-[10px] uppercase tracking-wide w-20">% Máx</th>
                  <th className="text-left px-3 py-2 font-semibold text-white/80 text-[10px] uppercase tracking-wide w-36">Sobre</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="px-3 py-10 text-center text-gray-400 text-xs">
                      <div className="flex flex-col items-center gap-2">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="font-medium text-gray-500">No hay configuraciones de cobertura y comisión</span>
                        {!isViewMode && (
                          <span className="text-gray-400">Haga clic en "+ Nuevo" para agregar una configuración</span>
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
                        <td className="text-center px-2 py-1.5 border-b border-gray-200">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteRequest(item.id); }}
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                            title="Eliminar configuración"
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                            </svg>
                          </button>
                        </td>
                      )}
                      <td className="px-3 py-1.5 border-b border-gray-200 text-right font-mono text-gray-600">{fmtPct(item.porcentajeMinCobertura)}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-right font-mono font-semibold text-gray-800">{fmtPct(item.porcentajeDefaultCobertura)}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-right font-mono text-gray-600">{fmtPct(item.porcentajeMaxCobertura)}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200 border-r border-r-gray-200">
                        {item.sobreCobertura ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium">{item.sobreCobertura}</span>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-right font-mono text-gray-600">{fmtPct(item.porcentajeMinComision)}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-right font-mono font-semibold text-gray-800">{fmtPct(item.porcentajeDefaultComision)}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200 text-right font-mono text-gray-600">{fmtPct(item.porcentajeMaxComision)}</td>
                      <td className="px-3 py-1.5 border-b border-gray-200">
                        {item.sobreComision ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-medium">{item.sobreComision}</span>
                        ) : '—'}
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
              Total: <span className="font-semibold text-gray-700">{data.length}</span> configuraci{data.length !== 1 ? 'ones' : 'ón'}
            </span>
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
                  <p className="text-sm font-medium text-gray-800 mb-1">¿Eliminar esta configuración?</p>
                  <p className="text-xs text-gray-500">Los rangos de cobertura y comisión serán removidos del producto.</p>
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
          <Cobertura2oPisoFormModal
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

Cobertura2oPisoTab.displayName = 'Cobertura2oPisoTab';

// ═══════════════════════════════════════════════════════════════
// Modal de formulario
// ═══════════════════════════════════════════════════════════════
interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: CoberturaComisiones2oPiso;
  onSave: (data: Omit<CoberturaComisiones2oPiso, 'id' | 'productId'>) => void;
  onClose: () => void;
}

/** Devuelve el mensaje de error del bloque, o null si está bien. */
function validarBloque(min: string, def: string, max: string, etiqueta: string): string | null {
  const nMin = num(min), nDef = num(def), nMax = num(max);

  if (nDef === null) return `Capture el % Default de ${etiqueta}.`;

  for (const [nombre, valor] of [['mínimo', nMin], ['default', nDef], ['máximo', nMax]] as const) {
    if (valor !== null && (valor < 0 || valor > 100)) {
      return `El porcentaje ${nombre} de ${etiqueta} debe estar entre 0 y 100.`;
    }
  }
  if (nMin !== null && nMax !== null && nMin > nMax) {
    return `En ${etiqueta}, el porcentaje mínimo no puede ser mayor al máximo.`;
  }
  if (nMin !== null && nDef < nMin) {
    return `En ${etiqueta}, el porcentaje default no puede ser menor al mínimo.`;
  }
  if (nMax !== null && nDef > nMax) {
    return `En ${etiqueta}, el porcentaje default no puede ser mayor al máximo.`;
  }
  return null;
}

function Cobertura2oPisoFormModal({ mode, item, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    porcentajeMinCobertura: String(item?.porcentajeMinCobertura ?? ''),
    porcentajeDefaultCobertura: String(item?.porcentajeDefaultCobertura ?? ''),
    porcentajeMaxCobertura: String(item?.porcentajeMaxCobertura ?? ''),
    sobreCobertura: item?.sobreCobertura || '',
    porcentajeMinComision: String(item?.porcentajeMinComision ?? ''),
    porcentajeDefaultComision: String(item?.porcentajeDefaultComision ?? ''),
    porcentajeMaxComision: String(item?.porcentajeMaxComision ?? ''),
    sobreComision: item?.sobreComision || '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /** Sanitiza: solo dígitos y un punto decimal. */
  const handlePctChange = (field: string, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    if (cleaned.split('.').length > 2) return;
    handleChange(field, cleaned);
  };

  const errorCobertura = validarBloque(
    formData.porcentajeMinCobertura, formData.porcentajeDefaultCobertura,
    formData.porcentajeMaxCobertura, 'Cobertura'
  );
  const errorComision = validarBloque(
    formData.porcentajeMinComision, formData.porcentajeDefaultComision,
    formData.porcentajeMaxComision, 'Comisión'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) { onClose(); return; }

    if (errorCobertura) { toast.error('Rango de Cobertura inválido', { description: errorCobertura }); return; }
    if (errorComision) { toast.error('Rango de Comisión inválido', { description: errorComision }); return; }

    onSave(formData as unknown as Omit<CoberturaComisiones2oPiso, 'id' | 'productId'>);
  };

  const inputClassName = () => {
    const base = 'w-full px-2.5 py-1.5 text-xs rounded';
    if (isViewMode) return `${base} border-0 bg-gray-50 text-gray-700 cursor-default`;
    return `${base} border border-gray-300 bg-white focus:border-blue-500 focus:ring-1 ring-blue-500 outline-none transition-colors`;
  };

  const campoPct = (label: string, field: string, requerido = false) => (
    <div>
      <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
        {label} {requerido && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={(formData as any)[field]}
          onChange={(e) => handlePctChange(field, e.target.value)}
          disabled={isViewMode}
          className={`${inputClassName()} pr-6`}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">%</span>
      </div>
    </div>
  );

  const campoSobre = (field: string) => (
    <div>
      <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Sobre</label>
      <select
        value={(formData as any)[field]}
        onChange={(e) => handleChange(field, e.target.value)}
        disabled={isViewMode}
        className={inputClassName()}
      >
        <option value="">— Seleccionar base —</option>
        {BASES_CALCULO.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
    </div>
  );

  const bannerError = (msg: string) => (
    <div className="mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700 flex items-center gap-2">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
        <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
      </svg>
      {msg}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4 overflow-hidden animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header-theme px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-wide uppercase">
            {mode === 'create' ? 'Nueva Configuración 2o Piso' : mode === 'edit' ? 'Editar Configuración 2o Piso' : 'Detalle de Configuración 2o Piso'}
          </span>
          <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center transition-colors" title="Cerrar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[75vh] overflow-auto">
          <form onSubmit={handleSubmit}>
            {/* Cobertura */}
            <div className="mb-5">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-4 border-l-4 border-[#2E5C91] rounded-r">
                <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Cobertura de la Garantía</span>
              </div>
              <div className="grid grid-cols-4 gap-x-4 gap-y-3">
                {campoPct('% Mín. Cobertura', 'porcentajeMinCobertura')}
                {campoPct('% Default Cobertura', 'porcentajeDefaultCobertura', true)}
                {campoPct('% Máx. Cobertura', 'porcentajeMaxCobertura')}
                {campoSobre('sobreCobertura')}
              </div>
              {!isViewMode && errorCobertura && bannerError(errorCobertura)}
            </div>

            {/* Comisión */}
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-4 border-l-4 border-[#2E5C91] rounded-r">
                <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Comisión por Garantía Financiera</span>
              </div>
              <div className="grid grid-cols-4 gap-x-4 gap-y-3">
                {campoPct('% Mín. Comisión', 'porcentajeMinComision')}
                {campoPct('% Default Comisión', 'porcentajeDefaultComision', true)}
                {campoPct('% Máx. Comisión', 'porcentajeMaxComision')}
                {campoSobre('sobreComision')}
              </div>
              {!isViewMode && errorComision && bannerError(errorComision)}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
              <button type="button" onClick={onClose} className="px-4 py-1.5 rounded text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors">
                {isViewMode ? 'Cerrar' : 'Cancelar'}
              </button>
              {!isViewMode && (
                <button type="submit" className="px-5 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium transition-colors shadow-sm">
                  {mode === 'create' ? 'Agregar Configuración' : 'Guardar Cambios'}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
