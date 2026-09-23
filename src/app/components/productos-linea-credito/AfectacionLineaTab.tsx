/**
 * AfectacionLineaTab — Afectación de la línea (Producto Línea de Crédito).
 *
 * Igual que "Comisiones e IVA", los conceptos no se inventan aquí: al dar de
 * alta un renglón se elige entre los cargos capturados en "Cargos Permitidos".
 * Esta pestaña define, para cada uno, cómo mueve la línea revolvente:
 *
 *   Naturaleza                   → Cargo (suma al saldo) o Abono (lo disminuye)
 *   Consume línea disponible     → si resta disponible al límite autorizado
 *   bFactura                     → si el movimiento genera factura
 *   bCargo                       → si el movimiento genera cargo a la cuenta
 *   Libera línea cuando se paga  → si al pagarlo se restituye el disponible
 *
 * Una regla de coherencia se aplica sola: un Abono no consume línea y no la
 * libera, porque un abono no es un cargo que se pague.
 *
 * "Libera línea cuando se paga" es independiente de "Consume línea
 * disponible". Antes se forzaba a No cuando el concepto no consumía línea
 * —"lo que no consumió no puede liberar"—, pero el negocio pidió poder
 * capturar las dos combinaciones: hay conceptos que no descuentan disponible
 * al generarse y que, al cobrarse, sí deben restituirlo. El tope de
 * `LEAST(monto_autorizado, ...)` del RPC impide que esa combinación deje la
 * línea con más disponible que su propio límite.
 *
 * La configuración se guarda indexada por concepto (no por id de renglón), para
 * que sobreviva a que un cargo se borre y se vuelva a dar de alta.
 * Persiste en el nodo `afectacionLinea` de J_PRODUCTOS.data.
 */
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { useProductoPersistence } from '@/app/hooks/useProductoPersistence';
import { useComponentesContablesCatalogo } from '@/app/hooks/useComponentesContablesCatalogo';
import type { ComponenteContable } from '@/app/hooks/useComponentesContablesCatalogo';
import type { AfectacionLineaCargo, NaturalezaMovimiento } from '@/app/types/productoLineaCredito';

type SiNo = 'S' | 'N';

interface ConfigAfectacion {
  concepto: string;
  naturaleza: NaturalezaMovimiento;
  consumeLineaDisponible: SiNo;
  bFactura: SiNo;
  bCargo: SiNo;
  liberaLineaAlPagar: SiNo;
}

/** Un cargo nuevo se asume como el caso típico: consume y libera línea. */
const CONFIG_NUEVA = (concepto = ''): ConfigAfectacion => ({
  concepto,
  naturaleza: 'Cargo',
  consumeLineaDisponible: 'S',
  bFactura: 'N',
  bCargo: 'N',
  liberaLineaAlPagar: 'S',
});

/** Aplica las reglas de coherencia sobre una configuración capturada. */
const normalizar = (cfg: ConfigAfectacion): ConfigAfectacion => {
  if (cfg.naturaleza === 'Abono') {
    return { ...cfg, naturaleza: 'Abono', consumeLineaDisponible: 'N', liberaLineaAlPagar: 'N' };
  }
  return cfg;
};

const siNo = (v: SiNo) => (v === 'S' ? 'Sí' : 'No');

interface Props {
  mode: 'create' | 'edit' | 'view';
  productId: number | string;
  initialData?: AfectacionLineaCargo[];
  persistToStorage?: boolean;
}

export const AfectacionLineaTab = forwardRef<{ getData: () => AfectacionLineaCargo[] }, Props>(
  ({ mode, productId, initialData, persistToStorage }, ref) => {
    const storageKey =
      persistToStorage && productId ? `linea_credito_afectacion_linea_${productId}` : '';
    const isView = mode === 'view';

    const { componentes } = useComponentesContablesCatalogo();

    const clearedOnCreateRef = useRef(false);
    useEffect(() => {
      if (mode === 'create' && storageKey && !clearedOnCreateRef.current) {
        try { sessionStorage.removeItem(storageKey); } catch (_) { /* ignore */ }
        clearedOnCreateRef.current = true;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Los datos guardados traen clave y concepto; si vienen de una versión previa
    // sin clave, se resuelve por nombre contra el catálogo.
    const initialMap: Record<string, ConfigAfectacion> = {};
    (initialData || []).forEach(r => {
      if (!r?.concepto && !r?.clave) return;
      const k = r.clave || r.concepto;
      initialMap[k] = normalizar({
        concepto: r.concepto || '',
        naturaleza: r.naturaleza === 'Abono' ? 'Abono' : 'Cargo',
        consumeLineaDisponible: r.consumeLineaDisponible === 'N' ? 'N' : 'S',
        bFactura: r.bFactura === 'S' ? 'S' : 'N',
        bCargo: r.bCargo === 'S' ? 'S' : 'N',
        liberaLineaAlPagar: r.liberaLineaAlPagar === 'N' ? 'N' : 'S',
      });
    });

    const { data: config, setData: setConfig } = useProductoPersistence<Record<string, ConfigAfectacion>>(
      storageKey,
      initialMap
    );

    // ── Migración de llaves indexadas por nombre ──
    // Las capturas anteriores usaban el nombre como llave. Al llegar el catálogo
    // se re-indexan por código; si no, aparecerían como "fuera de catálogo".
    useEffect(() => {
      if (componentes.length === 0) return;
      let cambio = false;
      const next: Record<string, ConfigAfectacion> = {};
      Object.entries(config).forEach(([k, v]) => {
        if (componentes.some(c => c.codigo === k)) { next[k] = v; return; }
        const porNombre = componentes.find(c => (c.nombre || '').toLowerCase() === k.toLowerCase());
        if (porNombre) {
          next[porNombre.codigo] = { ...v, concepto: porNombre.nombre };
          cambio = true;
        } else {
          next[k] = v;
        }
      });
      if (cambio) setConfig(next);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [componentes]);

    /** Nombre vigente del componente; si ya no está en el catálogo, el guardado. */
    const conceptoDe = (clave: string): string =>
      componentes.find(c => c.codigo === clave)?.nombre || config[clave]?.concepto || clave;

    // ── Renglones configurados, en el orden del Catálogo de Componentes ──
    // Una clave que ya no esté en el catálogo se conserva al final: borrarla en
    // silencio perdería una captura sin que el usuario se entere.
    const clavesConfig = Object.keys(config);
    const ordenCatalogo = componentes.map(c => c.codigo);
    const vistas = new Set<string>();
    const clavesOrdenadas = [...ordenCatalogo, ...clavesConfig].filter(k => {
      if (!clavesConfig.includes(k) || vistas.has(k)) return false;
      vistas.add(k);
      return true;
    });

    const filas: AfectacionLineaCargo[] = clavesOrdenadas.map(clave => {
      const cfg = normalizar(config[clave]);
      return {
        clave,
        concepto: conceptoDe(clave),
        naturaleza: cfg.naturaleza,
        consumeLineaDisponible: cfg.consumeLineaDisponible,
        bFactura: cfg.bFactura,
        bCargo: cfg.bCargo,
        liberaLineaAlPagar: cfg.liberaLineaAlPagar,
      };
    });

    useImperativeHandle(ref, () => ({ getData: () => filas }), [filas]);

    // ── Estado de la UI ──
    const [selectedClave, setSelectedClave] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [claveEnEdicion, setClaveEnEdicion] = useState<string>('');

    /** Componentes del catálogo que aún no tienen configuración — los que ofrece "Nuevo". */
    const disponibles = componentes.filter(c => !clavesConfig.includes(c.codigo));

    const handleNuevo = () => {
      if (isView) { toast.warning('Modo solo lectura'); return; }
      if (componentes.length === 0) {
        toast.error('No se pudo cargar el Catálogo de Componentes', {
          description: 'Revise Configuración → Componentes Contables.',
        });
        return;
      }
      if (disponibles.length === 0) {
        toast.info('Todos los componentes ya están configurados', {
          description: 'Seleccione un renglón y use Editar para modificarlo.',
        });
        return;
      }
      setFormMode('create');
      setClaveEnEdicion('');
      setShowModal(true);
    };

    const handleEditar = (clave?: string) => {
      const target = clave ?? selectedClave;
      if (!target) { toast.error('Debe seleccionar una fila'); return; }
      setFormMode(isView ? 'view' : 'edit');
      setClaveEnEdicion(target);
      setShowModal(true);
    };

    const handleBorrar = () => {
      if (isView) { toast.warning('Modo solo lectura'); return; }
      if (!selectedClave) { toast.error('Debe seleccionar una fila'); return; }
      if (!window.confirm(`¿Eliminar la configuración de "${conceptoDe(selectedClave)}"?`)) return;
      setConfig(prev => {
        const next = { ...prev };
        delete next[selectedClave];
        return next;
      });
      setSelectedClave(null);
      toast.success('Configuración eliminada');
    };

    const handleGuardar = (clave: string, cfg: ConfigAfectacion) => {
      setConfig(prev => ({ ...prev, [clave]: normalizar(cfg) }));
      setSelectedClave(clave);
      setShowModal(false);
      toast.success(formMode === 'create' ? 'Configuración creada' : 'Configuración actualizada');
    };

    const btn = 'px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed';

    return (
      <>
        <div className="bg-white">
          <div className="section-header-theme px-4 py-2 mb-4 flex items-center justify-between rounded-t">
            <span className="text-xs font-semibold tracking-wide uppercase">Afectación de la línea</span>
            <span className="text-[10px] text-white/80">Conceptos del Catálogo de Componentes</span>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <button onClick={handleNuevo} disabled={isView} className={btn}>Nuevo</button>
            <button onClick={() => handleEditar()} disabled={!selectedClave} className={btn}>Editar</button>
            <button onClick={handleBorrar} disabled={!selectedClave || isView} className={btn}>Borrar</button>
          </div>

          <div className="border border-gray-400 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="table-header-theme">
                  <th className="px-3 py-2 text-left font-medium border-r border-white/20 w-24">CLAVE</th>
                  <th className="px-3 py-2 text-left font-medium border-r border-white/20">CONCEPTO</th>
                  <th className="px-3 py-2 text-center font-medium border-r border-white/20 w-32">NATURALEZA</th>
                  <th className="px-3 py-2 text-center font-medium border-r border-white/20 w-44">CONSUME LÍNEA DISPONIBLE</th>
                  <th className="px-3 py-2 text-center font-medium border-r border-white/20 w-24">bFACTURA</th>
                  <th className="px-3 py-2 text-center font-medium border-r border-white/20 w-24">bCARGO</th>
                  <th className="px-3 py-2 text-center font-medium w-48">LIBERA LÍNEA CUANDO SE PAGA</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-gray-500 text-xs">
                      No se encontraron registros. Use "Nuevo" para configurar un concepto.
                    </td>
                  </tr>
                ) : (
                  filas.map((fila, index) => {
                    const huerfano = !ordenCatalogo.includes(fila.clave);
                    return (
                      <tr
                        key={fila.clave}
                        onClick={() => setSelectedClave(fila.clave)}
                        onDoubleClick={() => handleEditar(fila.clave)}
                        className={`border-b border-gray-300 cursor-pointer transition-colors ${
                          selectedClave === fila.clave
                            ? 'bg-[#D6EAF8]'
                            : index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'
                        }`}
                      >
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-300 font-medium">
                          {fila.clave || <span className="text-gray-400 italic">sin clave</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-300">
                          {fila.concepto}
                          {huerfano && (
                            <span
                              className="ml-2 text-[10px] text-amber-700"
                              title="Este concepto ya no está en el Catálogo de Componentes"
                            >
                              (fuera de catálogo)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-300 text-center">{fila.naturaleza}</td>
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-300 text-center">{siNo(fila.consumeLineaDisponible)}</td>
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-300 text-center">{siNo(fila.bFactura)}</td>
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-300 text-center">{siNo(fila.bCargo)}</td>
                        <td className="px-3 py-2 text-gray-700 text-center">{siNo(fila.liberaLineaAlPagar)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2 text-xs text-gray-600 flex items-center justify-between">
            <span className="font-medium">Total de registros: {filas.length}</span>
            <span className="text-[10px] text-gray-500 italic">
              Concepto y clave provienen del Catálogo de Componentes (Configuración → Componentes Contables).
            </span>
          </div>
        </div>

        {showModal && (
          <FormModal
            mode={formMode}
            clave={claveEnEdicion}
            concepto={claveEnEdicion ? conceptoDe(claveEnEdicion) : ''}
            configActual={claveEnEdicion ? config[claveEnEdicion] : undefined}
            disponibles={disponibles}
            onSave={handleGuardar}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }
);

AfectacionLineaTab.displayName = 'AfectacionLineaTab';

interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  /** Código del componente: es la identidad del renglón. */
  clave: string;
  concepto: string;
  configActual?: ConfigAfectacion;
  disponibles: ComponenteContable[];
  onSave: (clave: string, cfg: ConfigAfectacion) => void;
  onClose: () => void;
}

function FormModal({
  mode, clave, concepto, configActual, disponibles, onSave, onClose,
}: FormModalProps) {
  const isViewMode = mode === 'view';
  const isCreate = mode === 'create';

  // En alta se elige la CLAVE; el nombre se deriva de ella. Así dos componentes
  // homónimos con distinto código siguen siendo renglones distintos.
  const [claveSel, setClaveSel] = useState(clave);
  const [form, setForm] = useState<ConfigAfectacion>(configActual || CONFIG_NUEVA(concepto));

  const componenteSel = disponibles.find(c => c.codigo === claveSel);
  const claveMostrada = isCreate ? claveSel : clave;
  const conceptoMostrado = isCreate ? (componenteSel?.nombre || '') : concepto;

  // Las reglas de coherencia se aplican al capturar, para que el modal muestre
  // de inmediato el efecto de elegir "Abono" o "no consume línea".
  const set = (campo: keyof ConfigAfectacion, valor: string) =>
    setForm(prev => normalizar({ ...prev, [campo]: valor } as ConfigAfectacion));

  const esAbono = form.naturaleza === 'Abono';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) { onClose(); return; }
    if (!claveSel) {
      toast.error('Campos requeridos faltantes', { description: 'Seleccione el concepto' });
      return;
    }
    onSave(claveSel, { ...form, concepto: conceptoMostrado });
  };

  const inputClass = () =>
    isViewMode
      ? 'w-full px-2 py-1 text-xs border-0 bg-transparent text-gray-700 cursor-default'
      : 'w-full px-2 py-1 text-xs border border-gray-400';

  const campoSiNo = (
    label: string,
    campo: 'consumeLineaDisponible' | 'bFactura' | 'bCargo' | 'liberaLineaAlPagar',
    bloqueado: boolean,
    motivo: string
  ) => (
    <div>
      <label className="block text-xs text-gray-700 mb-1 font-medium">{label}</label>
      {isViewMode || bloqueado ? (
        <div className="w-full px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded text-gray-600">
          {siNo(form[campo])}
        </div>
      ) : (
        <select value={form[campo]} onChange={e => set(campo, e.target.value)} className={inputClass()}>
          <option value="S">Sí</option>
          <option value="N">No</option>
        </select>
      )}
      {bloqueado && !isViewMode && (
        <span className="text-[10px] text-gray-500 italic">{motivo}</span>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">
            {isCreate ? 'Nueva Afectación' : mode === 'edit' ? 'Editar Afectación' : 'Ver Afectación'}
          </h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
              <span className="text-xs font-medium text-gray-800">INFORMACIÓN DEL CONCEPTO</span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Clave</label>
                <div className="w-full px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded text-gray-700">
                  {claveMostrada || '—'}
                </div>
                <span className="text-[10px] text-gray-500 italic">Catálogo de Componentes</span>
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">
                  Concepto <span className="text-red-600">*</span>
                </label>
                {isCreate ? (
                  <select
                    value={claveSel}
                    onChange={e => setClaveSel(e.target.value)}
                    className={inputClass()}
                  >
                    <option value="">Seleccione...</option>
                    {disponibles.map(c => (
                      <option key={c.id} value={c.codigo}>{c.codigo} — {c.nombre}</option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded text-gray-700">
                    {conceptoMostrado}
                  </div>
                )}
                <span className="text-[10px] text-gray-500 italic">Catálogo de Componentes</span>
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">Naturaleza</label>
                {isViewMode ? (
                  <div className="w-full px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded text-gray-700">
                    {form.naturaleza}
                  </div>
                ) : (
                  <select
                    value={form.naturaleza}
                    onChange={e => set('naturaleza', e.target.value)}
                    className={inputClass()}
                  >
                    <option value="Cargo">Cargo</option>
                    <option value="Abono">Abono</option>
                  </select>
                )}
              </div>

              {campoSiNo(
                'Consume línea disponible', 'consumeLineaDisponible',
                esAbono, 'Un Abono no consume línea disponible'
              )}
              {campoSiNo('bFactura', 'bFactura', false, '')}
              {campoSiNo('bCargo', 'bCargo', false, '')}
              {campoSiNo(
                'Libera línea cuando se paga', 'liberaLineaAlPagar',
                esAbono,
                'Un Abono no libera línea'
              )}
            </div>

            <div className="flex gap-2 justify-end pt-4 mt-4 border-t border-gray-300">
              <button type="button" onClick={onClose} className="px-4 py-1.5 bg-gray-500 text-white text-xs hover:bg-gray-600">
                {isViewMode ? 'Cerrar' : 'Cancelar'}
              </button>
              {!isViewMode && (
                <button type="submit" className="px-4 py-1.5 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91]">
                  Guardar
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
