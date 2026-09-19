/**
 * ComisionesIvaTab — Comisiones e IVA por cargo (Producto Línea de Crédito).
 *
 * Los conceptos NO se inventan aquí: al dar de alta un renglón se elige entre
 * los cargos capturados en el subtab "Cargos Permitidos". Esta pestaña define,
 * para cada uno, cómo se cobra: comisión fija, % de comisión, si causa IVA y a
 * qué tasa.
 *
 *   Clave    → código del Catálogo de Componentes (Configuración → Componentes)
 *   Concepto → nombre del componente, que es el "Tipo de Cargo" del cargo
 *
 * La configuración se guarda indexada por concepto (no por id de renglón): así
 * sobrevive a que un cargo se borre y se vuelva a dar de alta, que es lo normal
 * mientras se arma el producto.
 *
 * Persiste en el nodo `comisionesIva` de J_PRODUCTOS.data.
 */
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { useProductoPersistence } from '@/app/hooks/useProductoPersistence';
import { useComponentesContablesCatalogo } from '@/app/hooks/useComponentesContablesCatalogo';
import type { ComponenteContable } from '@/app/hooks/useComponentesContablesCatalogo';
import type { ComisionIvaCargo } from '@/app/types/productoLineaCredito';

/**
 * Config editable de un concepto. El mapa se indexa por CLAVE (código del
 * catálogo), no por nombre: el catálogo admite dos componentes distintos con el
 * mismo nombre (p. ej. 002 y 013, ambos "Disposición de efectivo"), y indexar
 * por nombre los fundía en un solo renglón duplicado.
 * `concepto` se guarda junto para poder pintar la fila aunque el catálogo no responda.
 */
interface ConfigComision {
  concepto: string;
  comisionFija: string;
  porcentajeComision: string;
  aplicaIva: 'S' | 'N';
  porcentajeIva: string;
}

/** IVA general vigente en México: es el default, pero queda editable por cargo. */
const IVA_DEFAULT = '16.00';

const CONFIG_NUEVA = (concepto = ''): ConfigComision => ({
  concepto,
  comisionFija: '0.00',
  porcentajeComision: '',
  aplicaIva: 'S',
  porcentajeIva: IVA_DEFAULT,
});

interface Props {
  mode: 'create' | 'edit' | 'view';
  productId: number | string;
  initialData?: ComisionIvaCargo[];
  persistToStorage?: boolean;
}

export const ComisionesIvaTab = forwardRef<{ getData: () => ComisionIvaCargo[] }, Props>(
  ({ mode, productId, initialData, persistToStorage }, ref) => {
    const storageKey =
      persistToStorage && productId ? `linea_credito_comisiones_iva_${productId}` : '';
    const isView = mode === 'view';

    const { componentes } = useComponentesContablesCatalogo();

    // Mismo guard que los demás subtabs: limpiar el storage una sola vez al montar en alta.
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
    const initialMap: Record<string, ConfigComision> = {};
    (initialData || []).forEach(r => {
      if (!r?.concepto && !r?.clave) return;
      const k = r.clave || r.concepto;
      initialMap[k] = {
        concepto: r.concepto || '',
        comisionFija: String(r.comisionFija ?? ''),
        porcentajeComision: String(r.porcentajeComision ?? ''),
        aplicaIva: r.aplicaIva === 'N' ? 'N' : 'S',
        porcentajeIva: String(r.porcentajeIva ?? IVA_DEFAULT),
      };
    });

    const { data: config, setData: setConfig } = useProductoPersistence<Record<string, ConfigComision>>(
      storageKey,
      initialMap
    );

    // ── Migración de llaves indexadas por nombre ──
    // Las capturas anteriores usaban el nombre como llave. Al llegar el catálogo
    // se re-indexan por código; si no, aparecerían como "fuera de catálogo".
    useEffect(() => {
      if (componentes.length === 0) return;
      let cambio = false;
      const next: Record<string, ConfigComision> = {};
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

    const filas: ComisionIvaCargo[] = clavesOrdenadas.map(clave => {
      const cfg = config[clave];
      return {
        clave,
        concepto: conceptoDe(clave),
        comisionFija: cfg.comisionFija,
        porcentajeComision: cfg.porcentajeComision,
        aplicaIva: cfg.aplicaIva,
        porcentajeIva: cfg.aplicaIva === 'S' ? cfg.porcentajeIva : '',
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

    const handleGuardar = (clave: string, cfg: ConfigComision) => {
      setConfig(prev => ({ ...prev, [clave]: cfg }));
      setSelectedClave(clave);
      setShowModal(false);
      toast.success(formMode === 'create' ? 'Configuración creada' : 'Configuración actualizada');
    };

    const fmtMoneda = (v: string) => {
      const n = parseFloat(v);
      return isNaN(n) ? '—' : `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };
    const fmtPct = (v: string) => {
      const n = parseFloat(v);
      return isNaN(n) ? '—' : `${n.toFixed(2)} %`;
    };

    const btn = 'px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed';

    return (
      <>
        <div className="bg-white">
          <div className="section-header-theme px-4 py-2 mb-4 flex items-center justify-between rounded-t">
            <span className="text-xs font-semibold tracking-wide uppercase">Comisiones e IVA</span>
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
                  <th className="px-3 py-2 text-right font-medium border-r border-white/20 w-36">COMISIÓN FIJA</th>
                  <th className="px-3 py-2 text-right font-medium border-r border-white/20 w-32">% COMISIÓN</th>
                  <th className="px-3 py-2 text-center font-medium border-r border-white/20 w-28">IVA (S/N)</th>
                  <th className="px-3 py-2 text-right font-medium w-28">% IVA</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {filas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-500 text-xs">
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
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-300 text-right">{fmtMoneda(fila.comisionFija)}</td>
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-300 text-right">{fmtPct(fila.porcentajeComision)}</td>
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-300 text-center">{fila.aplicaIva}</td>
                        <td className="px-3 py-2 text-gray-700 text-right">
                          {fila.aplicaIva === 'N' ? '—' : fmtPct(fila.porcentajeIva)}
                        </td>
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

ComisionesIvaTab.displayName = 'ComisionesIvaTab';

interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  /** Código del componente: es la identidad del renglón. */
  clave: string;
  concepto: string;
  configActual?: ConfigComision;
  disponibles: ComponenteContable[];
  onSave: (clave: string, cfg: ConfigComision) => void;
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
  const [form, setForm] = useState<ConfigComision>(configActual || CONFIG_NUEVA(concepto));

  const componenteSel = disponibles.find(c => c.codigo === claveSel);
  const claveMostrada = isCreate ? claveSel : clave;
  const conceptoMostrado = isCreate ? (componenteSel?.nombre || '') : concepto;

  const set = (campo: keyof ConfigComision, valor: string) =>
    setForm(prev => ({ ...prev, [campo]: valor } as ConfigComision));

  const soloNumero = (v: string) => v.replace(/[^0-9.]/g, '');

  const blurMonto = (campo: 'comisionFija') => {
    const n = parseFloat(form[campo]);
    if (!isNaN(n) && n >= 0) set(campo, n.toFixed(2));
  };
  const blurPorcentaje = (campo: 'porcentajeComision' | 'porcentajeIva') => {
    const raw = form[campo];
    if (!raw || raw.trim() === '') return;
    const n = parseFloat(raw);
    if (!isNaN(n)) set(campo, Math.min(100, Math.max(0, n)).toFixed(2));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) { onClose(); return; }

    if (!claveSel) {
      toast.error('Campos requeridos faltantes', { description: 'Seleccione el concepto' });
      return;
    }
    if (form.aplicaIva === 'S' && (!form.porcentajeIva || form.porcentajeIva.trim() === '')) {
      toast.error('Capture el % de IVA', { description: 'O ponga IVA en "N" si el concepto no causa IVA.' });
      return;
    }
    onSave(claveSel, {
      ...form,
      concepto: conceptoMostrado,
      porcentajeIva: form.aplicaIva === 'S' ? form.porcentajeIva : '',
    });
  };

  const inputClass = () =>
    isViewMode
      ? 'w-full px-2 py-1 text-xs border-0 bg-transparent text-gray-700 cursor-default'
      : 'w-full px-2 py-1 text-xs border border-gray-400';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">
            {isCreate ? 'Nueva Comisión e IVA' : mode === 'edit' ? 'Editar Comisión e IVA' : 'Ver Comisión e IVA'}
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
                <label className="block text-xs text-gray-700 mb-1 font-medium">Comisión Fija</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">$</span>
                  <input
                    type="text"
                    value={form.comisionFija}
                    onChange={e => set('comisionFija', soloNumero(e.target.value))}
                    onBlur={() => blurMonto('comisionFija')}
                    disabled={isViewMode}
                    placeholder="0.00"
                    className={`${inputClass()} pl-5`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">% Comisión</label>
                <div className="relative">
                  <input
                    type="text"
                    value={form.porcentajeComision}
                    onChange={e => set('porcentajeComision', soloNumero(e.target.value))}
                    onBlur={() => blurPorcentaje('porcentajeComision')}
                    disabled={isViewMode}
                    placeholder="0.00"
                    className={`${inputClass()} pr-5`}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">%</span>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">IVA (S/N)</label>
                <select
                  value={form.aplicaIva}
                  onChange={e => set('aplicaIva', e.target.value)}
                  disabled={isViewMode}
                  className={inputClass()}
                >
                  <option value="S">S — Causa IVA</option>
                  <option value="N">N — Exento</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1 font-medium">% IVA</label>
                {form.aplicaIva === 'N' ? (
                  <div className="w-full px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded text-gray-400">
                    No aplica
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={form.porcentajeIva}
                      onChange={e => set('porcentajeIva', soloNumero(e.target.value))}
                      onBlur={() => blurPorcentaje('porcentajeIva')}
                      disabled={isViewMode}
                      placeholder={IVA_DEFAULT}
                      className={`${inputClass()} pr-5`}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">%</span>
                  </div>
                )}
              </div>
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
