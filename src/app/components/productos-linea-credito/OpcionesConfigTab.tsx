/**
 * OpcionesConfigTab.tsx — Subtab genérico de configuración por lista simple
 *
 * Usado para 3 subtabs del Cotizador de Arrendamiento Puro:
 *   - Comisiones por Apertura   (% comisión, estatus)
 *   - % Enganche                (% enganche, estatus)
 *   - Rentas Anticipadas        (No. de rentas anticipadas, estatus)
 *
 * Cada uno es una lista independiente de opciones {valor, estatus},
 * guardada como array en el JSON del producto (mismo patrón que
 * ComisionesTab.tsx / CargoTab.tsx: forwardRef + getData()).
 *
 * Los dropdowns que consumen estas listas en Términos y Condiciones
 * de la Solicitud solo muestran las opciones con estatus='ACTIVO'.
 */
import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { toast } from 'sonner';
import { useTabPersistence } from '@/app/hooks/useProductoPersistence';

export interface OpcionConfig {
  id: number;
  valor: string;   // porcentaje o número, como string (ej. "10", "2.5", "1")
  estatus: 'ACTIVO' | 'INACTIVO';
}

interface OpcionesConfigTabProps {
  mode: 'nuevo' | 'editar' | 'ver' | 'create' | 'edit' | 'view';
  productId?: number | string;
  initialData?: OpcionConfig[];
  storagePrefix?: string;
  /** Sufijo único de storage por subtab: 'comision_apertura' | 'enganche' | 'renta_anticipada' */
  storageSuffix: string;
  /** Título mostrado en el header, ej. "Comisiones por Apertura" */
  titulo: string;
  /** Label del campo valor, ej. "% Comisión" */
  labelValor: string;
  /** Sufijo visual del valor, ej. "%" o "renta(s)" */
  sufijoValor: string;
  /** Tipo de input: 'porcentaje' (0-100, decimales), 'entero' (número, > 0) o 'lista' (select con valores fijos, incluye 0) */
  tipoValor?: 'porcentaje' | 'entero' | 'lista';
  /** Valores fijos del <select> cuando tipoValor='lista', ej. ['0','1','2','3','4','5'] */
  opcionesLista?: string[];
}

export const OpcionesConfigTab = forwardRef<{ getData: () => OpcionConfig[] }, OpcionesConfigTabProps>(
  ({ mode, productId = 0, initialData = [], storagePrefix, storageSuffix, titulo, labelValor, sufijoValor, tipoValor = 'porcentaje', opcionesLista = [] }, ref) => {
    const prefix = storagePrefix || 'credito';
    const storageKey = `${prefix}_${storageSuffix}_producto_${productId || 'nuevo'}`;
    const isCreate = mode === 'create' || mode === 'nuevo';
    const isViewMode = mode === 'ver' || mode === 'view';

    // BUG FIX (mismo patrón que ComisionesTab.tsx): limpiar storage solo UNA
    // VEZ al montar, no en cada render. Antes corría sin guard en el cuerpo
    // del componente, así que cada vez que el usuario agregaba una opción y
    // React re-renderizaba, volvía a borrar el storage recién escrito por
    // useTabPersistence — la fila agregada parecía "no aparecer" hasta
    // guardar el producto (momento en que getData() lee directo del estado
    // de React, sin pasar por storage).
    const clearedOnCreateRef = useRef(false);
    useEffect(() => {
      if (isCreate && storageKey && !clearedOnCreateRef.current) {
        try { sessionStorage.removeItem(storageKey); } catch { /* ignore */ }
        clearedOnCreateRef.current = true;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { data, setData } = useTabPersistence<OpcionConfig>(
      storageKey,
      Array.isArray(initialData) && initialData.length > 0 ? initialData : [],
      { storageType: 'local' }
    );

    // BUG FIX: en modo editar/ver, la BD (initialData) es la fuente de verdad.
    // El localStorage de OpcionesConfigTab es solo caché de sesión — si quedó
    // un residuo (ej. de una prueba anterior a que este subtab guardara
    // correctamente en el producto), esa caché podía tapar para siempre el
    // dato real recién leído de Supabase, aunque el guardado en BD sí
    // funcionara. Al entrar a editar un producto con datos reales en
    // initialData, se sincroniza el estado con ellos una sola vez.
    const syncedFromDbRef = useRef(false);
    useEffect(() => {
      if (!isCreate && !syncedFromDbRef.current && Array.isArray(initialData) && initialData.length > 0) {
        setData(initialData);
        syncedFromDbRef.current = true;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData]);

    const safeData = Array.isArray(data) ? data : [];

    useImperativeHandle(ref, () => ({ getData: () => data }), [data]);

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formValor, setFormValor] = useState('');
    const [formEstatus, setFormEstatus] = useState<'ACTIVO' | 'INACTIVO'>('ACTIVO');
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    const openNew = () => {
      setEditingId(null);
      setFormValor(tipoValor === 'lista' ? (opcionesLista[0] || '') : '');
      setFormEstatus('ACTIVO');
      setShowModal(true);
    };

    const openEdit = (item: OpcionConfig) => {
      setEditingId(item.id);
      setFormValor(item.valor);
      setFormEstatus(item.estatus);
      setShowModal(true);
    };

    const handleValorChange = (raw: string) => {
      if (tipoValor === 'entero') {
        setFormValor(raw.replace(/[^0-9]/g, ''));
      } else {
        const cleaned = raw.replace(/[^0-9.]/g, '');
        const parts = cleaned.split('.');
        setFormValor(parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned);
      }
    };

    const handleSubmit = () => {
      if (!formValor.trim() && formValor !== '0') {
        toast.error('Campo requerido', { description: `Ingrese ${labelValor.toLowerCase()}` });
        return;
      }
      const num = parseFloat(formValor);
      const minimoValido = tipoValor === 'lista' ? 0 : 0.0001; // 'lista' permite 0 (ej. 0 rentas anticipadas)
      if (isNaN(num) || num < minimoValido) {
        toast.error('Valor inválido', { description: `${labelValor} debe ser ${tipoValor === 'lista' ? 'un valor válido' : 'mayor a 0'}` });
        return;
      }
      if (tipoValor === 'porcentaje' && num > 100) {
        toast.error('Valor inválido', { description: `${labelValor} no puede exceder 100%` });
        return;
      }

      if (editingId != null) {
        setData(safeData.map(d => d.id === editingId ? { ...d, valor: formValor, estatus: formEstatus } : d));
        toast.success('Opción actualizada correctamente');
      } else {
        const newItem: OpcionConfig = {
          id: Math.max(0, ...safeData.map(d => d.id)) + 1,
          valor: formValor,
          estatus: formEstatus,
        };
        setData([...safeData, newItem]);
        toast.success('Opción agregada correctamente');
      }
      setShowModal(false);
    };

    const confirmDelete = () => {
      if (confirmDeleteId == null) return;
      setData(safeData.filter(d => d.id !== confirmDeleteId));
      setConfirmDeleteId(null);
      toast.success('Opción eliminada correctamente');
    };

    return (
      <div className="bg-white">
        <div className="section-header-theme px-4 py-2 mb-4 flex items-center justify-between rounded-t">
          <span className="text-xs font-semibold tracking-wide uppercase">{titulo} — Opciones configurables</span>
          {!isViewMode && (
            <button
              onClick={openNew}
              className="px-4 py-1 rounded text-xs font-medium transition-colors bg-white/20 text-white hover:bg-white/30"
            >
              + Nuevo
            </button>
          )}
        </div>

        <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-xs">
            <thead className="table-header-theme">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide">{labelValor}</th>
                <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-32">Estatus</th>
                {!isViewMode && <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-32">Acción</th>}
              </tr>
            </thead>
            <tbody className="bg-white">
              {safeData.length === 0 ? (
                <tr>
                  <td colSpan={isViewMode ? 2 : 3} className="px-3 py-10 text-center text-gray-400 text-xs">
                    No hay opciones configuradas{!isViewMode ? ' — haga clic en "+ Nuevo" para agregar' : ''}
                  </td>
                </tr>
              ) : (
                safeData.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                    <td className="px-3 py-1.5 border-b border-gray-200 font-medium text-gray-800">
                      {item.valor}{sufijoValor ? ` ${sufijoValor}` : ''}
                    </td>
                    <td className="px-3 py-1.5 border-b border-gray-200 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        item.estatus === 'ACTIVO' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.estatus === 'ACTIVO' ? 'bg-green-500' : 'bg-gray-400'}`} />
                        {item.estatus === 'ACTIVO' ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    {!isViewMode && (
                      <td className="px-3 py-1.5 border-b border-gray-200 text-center">
                        <button onClick={() => openEdit(item)} className="text-[#0066CC] hover:underline text-[10px] mr-2">Editar</button>
                        <button onClick={() => setConfirmDeleteId(item.id)} className="text-red-500 hover:underline text-[10px]">Eliminar</button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-2 text-[11px] text-gray-500">
          Total: <span className="font-semibold text-gray-700">{safeData.length}</span> opción{safeData.length !== 1 ? 'es' : ''}
        </div>

        {/* Modal alta/edición */}
        {showModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setShowModal(false)}>
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="modal-header-theme px-5 py-3">
                <span className="text-sm font-semibold tracking-wide uppercase">
                  {editingId != null ? 'Editar Opción' : `Nueva Opción — ${titulo}`}
                </span>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">
                    {labelValor} <span className="text-red-500">*</span>
                  </label>
                  {tipoValor === 'lista' ? (
                    <select
                      value={formValor}
                      onChange={(e) => setFormValor(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-300 bg-white"
                    >
                      {opcionesLista.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={formValor}
                        onChange={(e) => handleValorChange(e.target.value)}
                        placeholder={tipoValor === 'porcentaje' ? 'Ej: 10, 20.5' : 'Ej: 1, 2, 3'}
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-300 bg-white focus:border-blue-500 focus:ring-1 ring-blue-500 outline-none"
                      />
                      {sufijoValor && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">{sufijoValor}</span>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Estatus</label>
                  <select
                    value={formEstatus}
                    onChange={(e) => setFormEstatus(e.target.value as 'ACTIVO' | 'INACTIVO')}
                    className="w-full px-2.5 py-1.5 text-xs rounded border border-gray-300 bg-white"
                  >
                    <option value="ACTIVO">Activo</option>
                    <option value="INACTIVO">Inactivo</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-200 bg-gray-50">
                <button onClick={() => setShowModal(false)} className="px-4 py-1.5 rounded text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-100">
                  Cancelar
                </button>
                <button onClick={handleSubmit} className="px-5 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium shadow-sm">
                  {editingId != null ? 'Guardar Cambios' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmación de eliminación */}
        {confirmDeleteId != null && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setConfirmDeleteId(null)}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-sm mx-4 p-5" onClick={e => e.stopPropagation()}>
              <p className="text-sm text-gray-700 mb-4">¿Eliminar esta opción? Esta acción no se puede deshacer.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-1.5 rounded text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-100">
                  Cancelar
                </button>
                <button onClick={confirmDelete} className="px-4 py-1.5 bg-red-600 text-white rounded text-xs hover:bg-red-700 font-medium">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

OpcionesConfigTab.displayName = 'OpcionesConfigTab';
