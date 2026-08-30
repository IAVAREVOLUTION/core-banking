/**
 * ComitesCreditoLineaCreditoTab.tsx
 *
 * Escalamiento de Comité por Monto — MATRIZ DE CONFIGURACIÓN DEL PRODUCTO.
 * Define, por rango de monto, qué comité tiene autoridad de aprobación en
 * esta línea de crédito. Ej.: "$500,000,000 – $1,000,000,000 → COMITÉ 1".
 *
 * Mismo patrón que los demás subtabs de Línea de Crédito (Matriz Tasa Fija,
 * Fases, etc.): barra Menú/Nuevo/Eliminar/Consulta, tabla con encabezado
 * bg-primary-theme, alta/edición vía modal (no edición inline), confirmación
 * antes de eliminar y contador de "Total de registros".
 *
 * Nota de diseño: este tab NO muestra el catálogo global de Puestos de
 * Trabajo ni una bitácora de autorización de solicitud. Ambos pertenecen al
 * flujo de una SOLICITUD real (otra escala de montos, otro propósito) y
 * mostrarlos aquí —dentro de la CONFIGURACIÓN del producto— generaba
 * confusión: dos tablas con la misma forma visual ("rango de monto → algo")
 * pero datos sin relación entre sí.
 */
import { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { useProductoPersistence } from '../../hooks/useProductoPersistence';
import type { ComiteEscalamientoMonto } from '../../types/productoLineaCredito';

interface Props {
  mode: 'create' | 'edit' | 'view';
  productId: number | string;
  /** Monto de referencia para resaltar qué rango aplica (ej. Monto Mínimo del producto). */
  montoSolicitado?: string;
  initialEscalamiento?: ComiteEscalamientoMonto[];
  persistToStorage?: boolean;
}

export interface ComitesCreditoLineaCreditoRef {
  getEscalamiento: () => ComiteEscalamientoMonto[];
}

const fmtCurrency = (n: number | undefined | null) => {
  if (n === undefined || n === null || isNaN(Number(n))) return '$0.00';
  return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const ComitesCreditoLineaCreditoTab = forwardRef<ComitesCreditoLineaCreditoRef, Props>(
  ({ mode, productId, montoSolicitado, initialEscalamiento, persistToStorage }, ref) => {
    const storageKey = persistToStorage && productId ? `linea_credito_comite_escalamiento_${productId}` : '';
    const isViewMode = mode === 'view';

    const { data: escalamiento, setData: setEscalamiento } = useProductoPersistence<ComiteEscalamientoMonto[]>(
      storageKey,
      initialEscalamiento && initialEscalamiento.length > 0 ? initialEscalamiento : []
    );

    useImperativeHandle(ref, () => ({ getEscalamiento: () => escalamiento }), [escalamiento]);

    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [showConsulta, setShowConsulta] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedItem, setSelectedItem] = useState<ComiteEscalamientoMonto | undefined>();
    const [showMenu, setShowMenu] = useState(false);
    const [filters, setFilters] = useState({ montoDesde: '', montoHasta: '', comiteAsignado: '' });

    const montoNum = parseFloat((montoSolicitado || '0').replace(/[^0-9.-]/g, ''));

    const aplicaPara = (r: ComiteEscalamientoMonto) => {
      const desde = Number(r.montoDesde);
      const hasta = Number(r.montoHasta);
      return montoNum > 0 && !isNaN(desde) && !isNaN(hasta) && montoNum >= desde && montoNum <= hasta;
    };

    const escalamientoAplicable = useMemo(
      () => (montoNum > 0 ? escalamiento.find(aplicaPara) || null : null),
      [escalamiento, montoNum]
    );

    const handleDelete = () => {
      if (selectedRow === null) {
        toast.error('Debe seleccionar una fila');
        return;
      }
      const confirmed = window.confirm('¿Está seguro de eliminar este registro?');
      if (confirmed) {
        setEscalamiento(p => p.filter(r => r.id !== selectedRow));
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

    const handleSaveForm = (formData: Omit<ComiteEscalamientoMonto, 'id'>) => {
      if (formMode === 'create') {
        const newItem: ComiteEscalamientoMonto = { id: Date.now() + Math.floor(Math.random() * 1000), ...formData };
        setEscalamiento(p => [...p, newItem]);
        toast.success('Rango de comité creado');
      } else if (formMode === 'edit' && selectedItem) {
        setEscalamiento(p => p.map(r => (r.id === selectedItem.id ? { ...r, ...formData } : r)));
        toast.success('Rango de comité actualizado');
      }
      setShowFormModal(false);
    };

    const handleConsulta = () => setShowConsulta(v => !v);

    const handleRowDoubleClick = (item: ComiteEscalamientoMonto) => {
      if (isViewMode) {
        return;
      }
      setFormMode('edit');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const filteredData = escalamiento.filter(r => {
      const matchesDesde = filters.montoDesde === '' || String(r.montoDesde).includes(filters.montoDesde);
      const matchesHasta = filters.montoHasta === '' || String(r.montoHasta).includes(filters.montoHasta);
      const matchesComite = filters.comiteAsignado === '' || String(r.comiteAsignado).toLowerCase().includes(filters.comiteAsignado.toLowerCase());
      return matchesDesde && matchesHasta && matchesComite;
    });

    return (
      <>
        <div className="bg-white">
          <div className="mb-3">
            <span className="text-sm font-medium text-gray-800">Escalamiento de Comité por Monto</span>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Define, por rango de monto, qué comité tiene autoridad de aprobación en este producto.
            </p>
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

            <button onClick={handleNew} disabled={isViewMode} className="px-3 py-1 bg-primary-theme text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:cursor-not-allowed">Nuevo Rango</button>
            <button onClick={handleDelete} disabled={selectedRow === null || isViewMode} className="px-3 py-1 bg-primary-theme text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:cursor-not-allowed">Eliminar</button>
            <button onClick={handleConsulta} className="px-3 py-1 bg-primary-theme text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91]">Consulta</button>
          </div>

          {showConsulta && (
            <div className="mb-3 p-3 bg-[#F5F5F5] border border-gray-400">
              <div className="grid grid-cols-3 gap-3 mb-2">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Monto desde</label>
                  <input
                    type="text"
                    value={filters.montoDesde}
                    onChange={(e) => setFilters({ ...filters, montoDesde: e.target.value })}
                    placeholder="Buscar monto desde..."
                    className="w-full px-2 py-1 border border-gray-400 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Monto hasta</label>
                  <input
                    type="text"
                    value={filters.montoHasta}
                    onChange={(e) => setFilters({ ...filters, montoHasta: e.target.value })}
                    placeholder="Buscar monto hasta..."
                    className="w-full px-2 py-1 border border-gray-400 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Comité asignado</label>
                  <input
                    type="text"
                    value={filters.comiteAsignado}
                    onChange={(e) => setFilters({ ...filters, comiteAsignado: e.target.value })}
                    placeholder="Buscar comité..."
                    className="w-full px-2 py-1 border border-gray-400 text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilters({ montoDesde: '', montoHasta: '', comiteAsignado: '' })}
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
                  <th className="px-3 py-2 text-right font-medium text-xs border-r border-white/20 w-48">Monto Desde (MXN)</th>
                  <th className="px-3 py-2 text-right font-medium text-xs border-r border-white/20 w-48">Monto Hasta (MXN)</th>
                  <th className="px-3 py-2 text-left font-medium text-xs border-r border-white/20">Comité Asignado</th>
                  {montoNum > 0 && <th className="px-3 py-2 text-center font-medium text-xs w-24">Aplica</th>}
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={montoNum > 0 ? 4 : 3} className="px-3 py-6 text-center text-gray-500 text-xs">
                      Sin rangos configurados. Presione "Nuevo Rango" para capturar el escalamiento por monto.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((r, index) => {
                    const aplica = aplicaPara(r);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedRow(r.id)}
                        onDoubleClick={() => handleRowDoubleClick(r)}
                        className={`border-b border-gray-300 cursor-pointer transition-colors ${selectedRow === r.id ? 'bg-[#D6EAF8]' : index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'}`}
                      >
                        <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300 text-right">{fmtCurrency(Number(r.montoDesde))}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300 text-right">{fmtCurrency(Number(r.montoHasta))}</td>
                        <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{r.comiteAsignado || '—'}</td>
                        {montoNum > 0 && (
                          <td className="px-3 py-2 text-center">
                            {aplica ? (
                              <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded text-[10px] border border-green-200">
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 5l2 2 4-4" /></svg>
                                Sí
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[10px]">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
            <span className="font-medium">Total de registros: {filteredData.length}</span>
            {montoNum > 0 && (
              <span className="text-[10px] text-gray-500">
                Monto mínimo del producto: {fmtCurrency(montoNum)}
                {escalamientoAplicable ? ` → aplica "${escalamientoAplicable.comiteAsignado}"` : ' → sin rango que lo cubra'}
              </span>
            )}
          </div>
        </div>

        {showFormModal && (
          <FormModal mode={formMode} item={selectedItem} onSave={handleSaveForm} onClose={() => setShowFormModal(false)} />
        )}
      </>
    );
  }
);

ComitesCreditoLineaCreditoTab.displayName = 'ComitesCreditoLineaCreditoTab';

interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: ComiteEscalamientoMonto;
  onSave: (data: Omit<ComiteEscalamientoMonto, 'id'>) => void;
  onClose: () => void;
}

function FormModal({ mode, item, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    montoDesde: item?.montoDesde !== undefined ? String(item.montoDesde) : '',
    montoHasta: item?.montoHasta !== undefined ? String(item.montoHasta) : '',
    comiteAsignado: item?.comiteAsignado || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) {
      onClose();
      return;
    }

    if (formData.montoDesde === '' || formData.montoHasta === '' || formData.comiteAsignado.trim() === '') {
      toast.error('Campos requeridos', {
        description: 'Por favor complete todos los campos obligatorios',
      });
      return;
    }

    const desde = Number(formData.montoDesde);
    const hasta = Number(formData.montoHasta);
    if (isNaN(desde) || isNaN(hasta) || desde > hasta) {
      toast.error('Rango inválido', {
        description: 'Monto Desde no puede ser mayor que Monto Hasta',
      });
      return;
    }

    onSave({ montoDesde: desde, montoHasta: hasta, comiteAsignado: formData.comiteAsignado.trim() });
  };

  const handleChange = (field: string, value: string) => {
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
      <div className="bg-white shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">{mode === 'create' ? 'Nuevo Rango de Comité' : mode === 'edit' ? 'Editar Rango de Comité' : 'Ver Rango de Comité'}</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
                <span className="text-xs font-medium text-gray-800">ESCALAMIENTO DE COMITÉ POR MONTO</span>
              </div>

              <div className="grid grid-cols-1 gap-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Monto desde (MXN) <span className="text-red-600">*</span></label>
                  <input
                    type="number"
                    value={formData.montoDesde}
                    onChange={(e) => handleChange('montoDesde', e.target.value)}
                    disabled={isViewMode}
                    placeholder="Ej: 500000000"
                    className={inputClassName()}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Monto hasta (MXN) <span className="text-red-600">*</span></label>
                  <input
                    type="number"
                    value={formData.montoHasta}
                    onChange={(e) => handleChange('montoHasta', e.target.value)}
                    disabled={isViewMode}
                    placeholder="Ej: 1000000000"
                    className={inputClassName()}
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Comité asignado <span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    value={formData.comiteAsignado}
                    onChange={(e) => handleChange('comiteAsignado', e.target.value)}
                    disabled={isViewMode}
                    placeholder="Ej: COMITÉ 1"
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
