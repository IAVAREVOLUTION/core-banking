import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { useTabPersistence } from '@/app/hooks/useProductoPersistence';
import { useComponentesContablesCatalogo } from '@/app/hooks/useComponentesContablesCatalogo';
// REQ-21 — momento del ciclo en el que aplica cada cargo.
import {
  MOMENTO_AUTORIZAR_FASE, MOMENTO_FASE4,
  construirMomentosCargo, etiquetaMomento, opcionesCampoMonto, etiquetaCampoMonto, leerFasesProducto, seqDeFase, momentoDeFase,
  type FaseProducto, type OpcionMomento,
} from '@/app/lib/cargosProductoGPO';

interface Cargo {
  id: number;
  productId: number;
  lineaProducto: string;
  sublinea: string;
  tipoCargo: string;
  descripcion: string;
  moneda: string;
  /** 'FASE_<seq>' | 'AVISO_COMISION' | 'ACTIVACION_SUBLINEA' | '' — y los legados
   *  'FASE_4_PROVISION' / 'AUTORIZAR_FASE' (+ `fase`). */
  momento?: string;
  /** MD NAFIN — fase del producto cuya autorización genera el cargo. */
  fase?: string;
  /** Campo monetario de la Solicitud del que sale el importe. */
  campoMapeado?: string;
}

interface CargoTabProps {
  mode: 'create' | 'edit' | 'view';
  productId: number | string;
  lineaProducto?: string;
  sublinea?: string;
  initialData?: Cargo[];
  persistToStorage?: boolean;
  storagePrefix?: string;
  /** Fases guardadas del producto. El picklist Momento prefiere las fases vivas
   *  de sessionStorage (las recién editadas en el subtab Fases) y cae a éstas. */
  fasesProducto?: FaseProducto[];
}

// Catálogos — Tipo de Cargo sale del catálogo de Componentes Contables (REQ-15)
const MONEDA_OPTIONS = ['MXN', 'USD', 'EUR', 'CAD', 'GBP'];

export const CargoTab = forwardRef<{ getData: () => Cargo[] }, CargoTabProps>(
  ({ mode, productId, lineaProducto = '', sublinea = '', initialData, persistToStorage, storagePrefix, fasesProducto }, ref) => {
    const prefix = storagePrefix || 'credito';
    const storageKey = persistToStorage && productId ? `${prefix}_cargo_${productId}` : '';
    // Fases vivas del producto: FasesTab las persiste bajo esta misma convención.
    const fasesStorageKey = persistToStorage && productId ? `${prefix}_fases_${productId}` : '';
    const leerFases = (): FaseProducto[] => {
      if (fasesStorageKey) {
        try {
          const raw = sessionStorage.getItem(fasesStorageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        } catch (_) { /* ignore */ }
      }
      return Array.isArray(fasesProducto) ? fasesProducto : [];
    };

    // ══════════════════════════════════════════════════════════════
    // FIX: Cargos es 100% manual. Sin defaults hardcodeados.
    // ══════════════════════════════════════════════════════════════
    const defaultCargos: Cargo[] = [];

    const isCreate = mode === 'create';
    if (isCreate && storageKey) {
      try { sessionStorage.removeItem(storageKey); } catch (_) { /* ignore */ }
    }

    const { data, setData } = useTabPersistence<Cargo>(
      storageKey,
      initialData && initialData.length > 0 ? initialData : defaultCargos
    );

    useImperativeHandle(ref, () => ({ getData: () => data }), [data]);

    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [showConsulta, setShowConsulta] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedItem, setSelectedItem] = useState<Cargo | undefined>();
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

    const handleEdit = (item: Cargo) => {
      if (isViewMode) {
        handleView(item);
        return;
      }
      setFormMode('edit');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleView = (item: Cargo) => {
      setFormMode('view');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleSaveForm = (formData: any) => {
      if (formMode === 'create') {
        const newItem: Cargo = {
          id: Math.max(...data.map(d => d.id), 0) + 1,
          productId: typeof productId === 'string' ? parseInt(productId) : productId,
          lineaProducto: lineaProducto,
          sublinea: sublinea,
          ...formData
        };
        setData([...data, newItem]);
        toast.success('Cargo creado');
      } else if (formMode === 'edit') {
        setData(data.map(d => d.id === selectedItem?.id ? { ...d, ...formData } : d));
        toast.success('Cargo actualizado');
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
            <span className="text-sm font-medium text-gray-800">Cargos</span>
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
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Línea Producto</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Sublínea</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Tipo de Cargo</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Descripción</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Moneda</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20 whitespace-nowrap">Momento</th>
                  <th className="px-3 py-2 text-left font-medium text-xs whitespace-nowrap">Campo a Mapear</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-500 text-xs">No se encontraron registros</td>
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
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.lineaProducto}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.sublinea}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.tipoCargo}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.descripcion}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{item.moneda}</td>
                      <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{etiquetaMomento(item.momento, leerFases(), item.fase)}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">{etiquetaCampoMonto(item.campoMapeado)}</td>
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
          <FormModal 
            mode={formMode} 
            item={selectedItem} 
            productId={typeof productId === 'string' ? parseInt(productId) : productId} 
            lineaProducto={lineaProducto}
            sublinea={sublinea}
            fases={leerFases()}
            onSave={handleSaveForm} 
            onClose={() => setShowFormModal(false)} 
          />
        )}
      </>
    );
  }
);

CargoTab.displayName = 'CargoTab';

interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: Cargo;
  productId: number;
  lineaProducto: string;
  sublinea: string;
  fases: FaseProducto[];
  onSave: (data: any) => void;
  onClose: () => void;
}

function FormModal({ mode, item, productId, lineaProducto, sublinea, fases, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const { opcionesTipoCargo, desdeCatalogo } = useComponentesContablesCatalogo();
  const momentos: OpcionMomento[] = construirMomentosCargo(fases);
  // Un cargo capturado como "Al autorizar una fase" + nombre se reabre como la
  // fase de ese nombre (FASE_<seq>), si el producto la tiene.
  const momentoInicial = (() => {
    if (item?.momento === MOMENTO_FASE4 && momentos.some(m => m.value === momentoDeFase(4))) return momentoDeFase(4);
    if (item?.momento !== MOMENTO_AUTORIZAR_FASE) return item?.momento || '';
    const lista = leerFasesProducto(fases);
    const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
    const idx = lista.findIndex(f => norm(f?.fase) === norm(item?.fase));
    return idx >= 0 ? momentoDeFase(seqDeFase(lista[idx], idx)) : MOMENTO_AUTORIZAR_FASE;
  })();
  const [formData, setFormData] = useState({
    tipoCargo: item?.tipoCargo || '',
    descripcion: item?.descripcion || '',
    moneda: item?.moneda || '',
    // REQ-21 §Decisión 1(a) — en qué momento del ciclo aplica este cargo.
    momento: momentoInicial,
    fase: item?.fase || '',
    campoMapeado: item?.campoMapeado || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }

    // Validar campos requeridos
    const requiredFields = [
      { field: 'tipoCargo', label: 'Tipo de Cargo' },
      { field: 'descripcion', label: 'Descripción' },
    ];

    const emptyFields = requiredFields.filter(({ field }) => {
      const value = formData[field as keyof typeof formData];
      if (typeof value === 'string') {
        return value.trim() === '';
      }
      return value === null || value === undefined;
    });

    if (emptyFields.length > 0) {
      const fieldNames = emptyFields.map(({ label }) => label).join(', ');
      toast.error('Campos requeridos faltantes', {
        description: `Por favor complete los siguientes campos: ${fieldNames}`,
      });
      return;
    }

    // El nombre de fase sólo se conserva en el legado AUTORIZAR_FASE.
    onSave({ ...formData, fase: formData.momento === MOMENTO_AUTORIZAR_FASE ? formData.fase : '' });
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
          <h3 className="text-sm font-medium text-white">{mode === 'create' ? 'Nuevo Cargo' : mode === 'edit' ? 'Editar Cargo' : 'Ver Cargo'}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE CARGO</span>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Línea Producto</label>
                  <input 
                    type="text" 
                    value={lineaProducto} 
                    readOnly
                    className="w-full px-2 py-1 text-xs border-0 bg-gray-100 text-gray-600 cursor-default"
                  />
                  <span className="text-[10px] text-gray-500 italic">Campo obtenido del producto</span>
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Sublínea</label>
                  <input 
                    type="text" 
                    value={sublinea} 
                    readOnly
                    className="w-full px-2 py-1 text-xs border-0 bg-gray-100 text-gray-600 cursor-default"
                  />
                  <span className="text-[10px] text-gray-500 italic">Campo obtenido del producto</span>
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Tipo de Cargo <span className="text-red-600">*</span></label>
                  <select
                    value={formData.tipoCargo}
                    onChange={(e) => handleChange('tipoCargo', e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName()}
                  >
                    <option value="">Seleccione...</option>
                    {/* REQ-15 — los elementos salen del catálogo de Componentes Contables */}
                    {opcionesTipoCargo.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                    {/* Un valor capturado antes de que existiera el catálogo no debe
                        desaparecer del select al reabrir el cargo. */}
                    {formData.tipoCargo && !opcionesTipoCargo.some(o => o.value === formData.tipoCargo) && (
                      <option value={formData.tipoCargo}>{formData.tipoCargo}</option>
                    )}
                  </select>
                  <span className="text-[10px] text-gray-500 italic">
                    {desdeCatalogo
                      ? 'Catálogo de Componentes Contables'
                      : 'Catálogo de Componentes Contables no disponible — valores base'}
                  </span>
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Moneda</label>
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

                {/* REQ-21 §Decisión 1(a) — sin esto, el catálogo no dice en qué
                    momento aplica cada cargo y Fase 4 los copiaba todos. */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Momento</label>
                  <select
                    value={formData.momento}
                    onChange={(e) => handleChange('momento', e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName()}
                  >
                    {momentos.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                    {/* Un valor guardado que ya no está entre las opciones (fase
                        eliminada o valor legado) no debe desaparecer al reabrir. */}
                    {formData.momento && !momentos.some(m => m.value === formData.momento) && (
                      <option value={formData.momento}>{etiquetaMomento(formData.momento, fases, formData.fase)}</option>
                    )}
                  </select>
                  <span className="block text-[10px] text-gray-500 mt-1">
                    {momentos.length > 3
                      ? 'Fase del producto cuya autorización genera el cargo, o evento: Aviso de Vencimiento / Activación de SubLínea.'
                      : 'El producto no tiene fases configuradas: captúrelas en el subtab Fases para listarlas aquí.'}
                  </span>
                </div>

                {/* De dónde sale el IMPORTE del cargo al generarse en la Solicitud. */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Campo a Mapear</label>
                  <select
                    value={formData.campoMapeado}
                    onChange={(e) => handleChange('campoMapeado', e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName()}
                  >
                    {opcionesCampoMonto().map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                    {formData.campoMapeado && !opcionesCampoMonto().some(o => o.value === formData.campoMapeado) && (
                      <option value={formData.campoMapeado}>{etiquetaCampoMonto(formData.campoMapeado)}</option>
                    )}
                  </select>
                  <span className="block text-[10px] text-gray-500 mt-1">
                    Campo monetario de la Solicitud del que se toma el importe al generar el cargo.
                    Sin mapear, el cargo de una fase no se genera.
                  </span>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Descripción <span className="text-red-600">*</span></label>
                  <input 
                    type="text" 
                    maxLength={255}
                    value={formData.descripcion} 
                    onChange={(e) => handleChange('descripcion', e.target.value)} 
                    disabled={isViewMode} 
                    placeholder="Ingrese descripción" 
                    className={inputClassName()} 
                  />
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