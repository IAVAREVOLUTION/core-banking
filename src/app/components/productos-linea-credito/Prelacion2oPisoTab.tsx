/**
 * Prelacion2oPisoTab — Cascada de Pagos (Cash Flow Waterfall) del fideicomiso
 * para el producto "Garantía Financiera 2o Piso".
 *
 * REQ-8. Dos escenarios contractuales en un solo tab:
 *   - OPERACIÓN NORMAL: cascada mientras el proyecto cumple.
 *   - BOTÓN DE PÁNICO: cascada cuando la GPO fue ejercida.
 *
 * ══════════════════════════════════════════════════════════════
 * La cascada es 100% manual. Sin defaults hardcodeados, sin catálogo
 * cerrado de conceptos. Mismo criterio que PrelacionTab de Producto Crédito.
 * ══════════════════════════════════════════════════════════════
 *
 * Se persiste como UN array con discriminante `escenario` (no dos arrays), para que
 * el motor de cascada consuma el mismo shape filtrando.
 */
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { useTabPersistence } from '@/app/hooks/useProductoPersistence';
import type { PrelacionSegundoPiso, EscenarioPrelacion2oPiso } from '@/app/types/productoLineaCredito';

const ESCENARIOS: { id: EscenarioPrelacion2oPiso; label: string }[] = [
  { id: 'OPERACION_NORMAL', label: 'Operación Normal' },
  { id: 'BOTON_PANICO', label: 'Botón de Pánico' },
];

interface Props {
  mode: 'create' | 'edit' | 'view';
  productId: number | string;
  initialData?: PrelacionSegundoPiso[];
  persistToStorage?: boolean;
}

export const Prelacion2oPisoTab = forwardRef<{ getData: () => PrelacionSegundoPiso[] }, Props>(
  ({ mode, productId, initialData, persistToStorage }, ref) => {
    const storageKey = persistToStorage && productId ? `linea_credito_prelacion_2o_piso_${productId}` : '';
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

    const { data, setData } = useTabPersistence<PrelacionSegundoPiso>(
      storageKey,
      initialData && initialData.length > 0 ? initialData : []
    );

    useImperativeHandle(ref, () => ({ getData: () => data }), [data]);

    const [escenario, setEscenario] = useState<EscenarioPrelacion2oPiso>('OPERACION_NORMAL');
    const [selectedRow, setSelectedRow] = useState<number | null>(null);
    const [showFormModal, setShowFormModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [selectedItem, setSelectedItem] = useState<PrelacionSegundoPiso | undefined>();

    const escenarioActual = ESCENARIOS.find(e => e.id === escenario)!;
    const rows = data
      .filter(d => d.escenario === escenario)
      .sort((a, b) => Number(a.seq) - Number(b.seq));

    const handleNew = () => {
      if (isViewMode) { toast.warning('Modo solo lectura'); return; }
      setFormMode('create');
      setSelectedItem(undefined);
      setShowFormModal(true);
    };

    const handleEdit = (item: PrelacionSegundoPiso) => {
      setFormMode(isViewMode ? 'view' : 'edit');
      setSelectedItem(item);
      setShowFormModal(true);
    };

    const handleDelete = () => {
      if (selectedRow === null) { toast.error('Debe seleccionar una fila'); return; }
      if (!window.confirm('¿Está seguro de eliminar este renglón de la cascada?')) return;
      setData(data.filter(d => d.id !== selectedRow));
      setSelectedRow(null);
      toast.success('Renglón eliminado');
    };

    /** SEQ único dentro del escenario — la cascada no admite dos posiciones iguales. */
    const seqDuplicado = (seq: number, excluirId?: number) =>
      data.some(d => d.escenario === escenario && Number(d.seq) === seq && d.id !== excluirId);

    const handleSaveForm = (form: { seq: string; concepto: string; valor: string }) => {
      const seqNum = parseInt(form.seq, 10);

      if (formMode === 'create') {
        if (seqDuplicado(seqNum)) {
          toast.error(`Ya existe el SEQ ${seqNum} en "${escenarioActual.label}"`);
          return;
        }
        setData([...data, {
          id: Math.max(...data.map(d => d.id), 0) + 1,
          escenario,
          seq: seqNum,
          concepto: form.concepto,
          valor: form.valor,
        }]);
        toast.success('Renglón agregado a la cascada');
      } else if (formMode === 'edit' && selectedItem) {
        if (seqDuplicado(seqNum, selectedItem.id)) {
          toast.error(`Ya existe el SEQ ${seqNum} en "${escenarioActual.label}"`);
          return;
        }
        setData(data.map(d => d.id === selectedItem.id
          ? { ...d, seq: seqNum, concepto: form.concepto, valor: form.valor }
          : d));
        toast.success('Renglón actualizado');
      }
      setShowFormModal(false);
    };

    return (
      <>
        <div className="bg-white">
          <div className="mb-3">
            <span className="text-sm font-medium text-gray-800">Prelación — Cascada de Pagos del Fideicomiso</span>
          </div>

          {/* Selector de escenario */}
          <div className="flex items-center gap-1 mb-3 border-b border-gray-300">
            {ESCENARIOS.map(e => (
              <button
                key={e.id}
                onClick={() => { setEscenario(e.id); setSelectedRow(null); }}
                className={`px-4 py-2 text-xs border border-b-0 transition-colors ${
                  escenario === e.id
                    ? 'bg-[#4A6FA5] text-white border-[#3E5C91] font-medium'
                    : 'bg-[#F5F5F5] text-gray-700 border-gray-300 hover:bg-gray-200'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2 mb-3">
            <button onClick={handleNew} disabled={isViewMode} className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:cursor-not-allowed">Nuevo</button>
            <button onClick={handleDelete} disabled={selectedRow === null || isViewMode} className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:cursor-not-allowed">Eliminar</button>
          </div>

          <div className="border border-gray-400 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#4A6FA5] text-white">
                  <th className="px-3 py-2 text-center font-medium border-r border-white/20 w-16">SEQ</th>
                  <th className="px-3 py-2 text-left font-medium border-r border-white/20">CONCEPTO</th>
                  <th className="px-3 py-2 text-left font-medium w-56">VALOR</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-gray-500 text-xs">No se encontraron registros</td>
                  </tr>
                ) : (
                  rows.map((item, index) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedRow(item.id)}
                      onDoubleClick={() => handleEdit(item)}
                      className={`border-b border-gray-300 cursor-pointer transition-colors ${
                        selectedRow === item.id ? 'bg-[#D6EAF8]' : index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'
                      }`}
                    >
                      <td className="px-3 py-2 text-center text-gray-700 border-r border-gray-300 font-medium">{item.seq}</td>
                      <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{item.concepto}</td>
                      <td className="px-3 py-2 text-gray-700">{item.valor}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-xs text-gray-600">
            <span className="font-medium">Total de renglones en {escenarioActual.label}: {rows.length}</span>
          </div>
        </div>

        {showFormModal && (
          <FormModal
            mode={formMode}
            item={selectedItem}
            escenarioLabel={escenarioActual.label}
            onSave={handleSaveForm}
            onClose={() => setShowFormModal(false)}
          />
        )}
      </>
    );
  }
);

Prelacion2oPisoTab.displayName = 'Prelacion2oPisoTab';

interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  item?: PrelacionSegundoPiso;
  escenarioLabel: string;
  onSave: (data: { seq: string; concepto: string; valor: string }) => void;
  onClose: () => void;
}

function FormModal({ mode, item, escenarioLabel, onSave, onClose }: FormModalProps) {
  const isViewMode = mode === 'view';
  const [formData, setFormData] = useState({
    seq: item?.seq !== undefined ? String(item.seq) : '',
    concepto: item?.concepto || '',
    valor: item?.valor || '',
  });

  const handleChange = (field: string, value: string) => setFormData({ ...formData, [field]: value });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) { onClose(); return; }

    const seqNum = parseInt(formData.seq, 10);
    if (!formData.seq || isNaN(seqNum) || seqNum < 1) {
      toast.error('SEQ debe ser un número entero mayor a cero');
      return;
    }
    if (!formData.concepto || formData.concepto.trim() === '') {
      toast.error('Campos requeridos faltantes', { description: 'Por favor capture el Concepto' });
      return;
    }
    onSave(formData);
  };

  const inputClassName = () => {
    const base = 'w-full px-2 py-1 text-xs';
    return isViewMode ? `${base} border-0 bg-transparent text-gray-700 cursor-default` : `${base} border border-gray-400`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">
            {mode === 'create' ? 'Nuevo Renglón de Cascada' : mode === 'edit' ? 'Editar Renglón de Cascada' : 'Ver Renglón de Cascada'}
          </h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91] flex items-center justify-between">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DEL RENGLÓN</span>
                <span className="text-[10px] text-gray-600">Escenario: <strong>{escenarioLabel}</strong></span>
              </div>

              <div className="grid grid-cols-1 gap-y-3">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">SEQ <span className="text-red-600">*</span></label>
                  <input
                    type="number"
                    min={1}
                    value={formData.seq}
                    onChange={(e) => handleChange('seq', e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName()}
                  />
                  <span className="text-[10px] text-gray-500 italic">Posición en la cascada. No puede repetirse dentro del escenario.</span>
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Concepto <span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    maxLength={150}
                    value={formData.concepto}
                    onChange={(e) => handleChange('concepto', e.target.value)}
                    disabled={isViewMode}
                    className={inputClassName()}
                  />
                  <span className="text-[10px] text-gray-500 italic">Máximo 150 caracteres</span>
                </div>

                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Valor</label>
                  <input
                    type="text"
                    maxLength={60}
                    value={formData.valor}
                    onChange={(e) => handleChange('valor', e.target.value)}
                    disabled={isViewMode}
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
