/**
 * PromComisImpuestosTab — "Prom Comis e Impue" (Producto Línea de Crédito).
 *
 * Promociones, comisiones e impuestos por concepto. Igual que las otras dos
 * pestañas de la familia, el concepto se elige del Catálogo de Componentes
 * (Configuración → Componentes Contables) y la CLAVE es su código.
 *
 * Cada valor numérico puede llevar asociada una **clave contable** — el
 * `valor|clave` de la especificación (p. ej. `250.00|021`, `10%|900`, `6|101`).
 * Se capturan en dos campos separados y se muestran juntos en el listado, para
 * no obligar a teclear un formato con pipe ni a validarlo a mano.
 *
 * Persiste en el nodo `promComisImpuestos` de J_PRODUCTOS.data.
 */
import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { toast } from 'sonner';
import { useProductoPersistence } from '@/app/hooks/useProductoPersistence';
import { useComponentesContablesCatalogo } from '@/app/hooks/useComponentesContablesCatalogo';
import type { ComponenteContable } from '@/app/hooks/useComponentesContablesCatalogo';
import type { PromComisImpuesto, ValorConClave } from '@/app/types/productoLineaCredito';

/** Las siete columnas numéricas, en el orden de la especificación. */
const COLUMNAS: { campo: keyof ConfigProm; label: string; header: string; tipo: 'monto' | 'pct' | 'entero' }[] = [
  { campo: 'comisionFija', label: 'Comisión Fija', header: 'COMISIÓN FIJA', tipo: 'monto' },
  { campo: 'porcentajeComision', label: '% Com', header: '%COM', tipo: 'pct' },
  { campo: 'porcentajeIvaComision', label: '% IVAC', header: '%IVAC', tipo: 'pct' },
  { campo: 'porcentajeCashback', label: '% CBack', header: '%CBACK', tipo: 'pct' },
  { campo: 'plazo', label: 'Plazo', header: 'PLAZO', tipo: 'entero' },
  { campo: 'porcentajeInteresAnual', label: '% IntAnl', header: '%INTANL', tipo: 'pct' },
  { campo: 'porcentajeIvaInteres', label: '% IvaInt', header: '%IVAINT', tipo: 'pct' },
];

interface ConfigProm {
  concepto: string;
  comisionFija: ValorConClave;
  porcentajeComision: ValorConClave;
  porcentajeIvaComision: ValorConClave;
  porcentajeCashback: ValorConClave;
  plazo: ValorConClave;
  porcentajeInteresAnual: ValorConClave;
  porcentajeIvaInteres: ValorConClave;
}

const VC = (valor = '', clave = ''): ValorConClave => ({ valor, clave });

const CONFIG_NUEVA = (concepto = ''): ConfigProm => ({
  concepto,
  comisionFija: VC('0.00'),
  porcentajeComision: VC('0'),
  porcentajeIvaComision: VC('0'),
  porcentajeCashback: VC('0'),
  plazo: VC('0'),
  porcentajeInteresAnual: VC('0'),
  porcentajeIvaInteres: VC('0'),
});

/** Normaliza lo que viene de BD: acepta el objeto o el string "valor|clave". */
const leerVC = (v: any): ValorConClave => {
  if (v && typeof v === 'object') return VC(String(v.valor ?? ''), String(v.clave ?? ''));
  const s = String(v ?? '');
  if (s.includes('|')) {
    const [valor, clave] = s.split('|');
    return VC(valor.trim(), clave.trim());
  }
  return VC(s.trim(), '');
};

interface Props {
  mode: 'create' | 'edit' | 'view';
  productId: number | string;
  initialData?: PromComisImpuesto[];
  persistToStorage?: boolean;
}

export const PromComisImpuestosTab = forwardRef<{ getData: () => PromComisImpuesto[] }, Props>(
  ({ mode, productId, initialData, persistToStorage }, ref) => {
    const storageKey =
      persistToStorage && productId ? `linea_credito_prom_comis_impuestos_${productId}` : '';
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

    const initialMap: Record<string, ConfigProm> = {};
    (initialData || []).forEach(r => {
      if (!r?.clave && !r?.concepto) return;
      const k = r.clave || r.concepto;
      initialMap[k] = {
        concepto: r.concepto || '',
        comisionFija: leerVC(r.comisionFija),
        porcentajeComision: leerVC(r.porcentajeComision),
        porcentajeIvaComision: leerVC(r.porcentajeIvaComision),
        porcentajeCashback: leerVC(r.porcentajeCashback),
        plazo: leerVC(r.plazo),
        porcentajeInteresAnual: leerVC(r.porcentajeInteresAnual),
        porcentajeIvaInteres: leerVC(r.porcentajeIvaInteres),
      };
    });

    const { data: config, setData: setConfig } = useProductoPersistence<Record<string, ConfigProm>>(
      storageKey,
      initialMap
    );

    const conceptoDe = (clave: string): string =>
      componentes.find(c => c.codigo === clave)?.nombre || config[clave]?.concepto || clave;

    const clavesConfig = Object.keys(config);
    const ordenCatalogo = componentes.map(c => c.codigo);
    const vistas = new Set<string>();
    const clavesOrdenadas = [...ordenCatalogo, ...clavesConfig].filter(k => {
      if (!clavesConfig.includes(k) || vistas.has(k)) return false;
      vistas.add(k);
      return true;
    });

    const filas: PromComisImpuesto[] = clavesOrdenadas.map(clave => {
      const cfg = config[clave];
      return {
        clave,
        concepto: conceptoDe(clave),
        comisionFija: cfg.comisionFija,
        porcentajeComision: cfg.porcentajeComision,
        porcentajeIvaComision: cfg.porcentajeIvaComision,
        porcentajeCashback: cfg.porcentajeCashback,
        plazo: cfg.plazo,
        porcentajeInteresAnual: cfg.porcentajeInteresAnual,
        porcentajeIvaInteres: cfg.porcentajeIvaInteres,
      };
    });

    useImperativeHandle(ref, () => ({ getData: () => filas }), [filas]);

    const [selectedClave, setSelectedClave] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit' | 'view'>('create');
    const [claveEnEdicion, setClaveEnEdicion] = useState<string>('');

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

    const handleGuardar = (clave: string, cfg: ConfigProm) => {
      setConfig(prev => ({ ...prev, [clave]: cfg }));
      setSelectedClave(clave);
      setShowModal(false);
      toast.success(formMode === 'create' ? 'Configuración creada' : 'Configuración actualizada');
    };

    /** "250.00|021" — el formato de la especificación, sólo para mostrar. */
    const mostrar = (vc: ValorConClave, tipo: 'monto' | 'pct' | 'entero') => {
      const v = (vc?.valor ?? '').trim();
      if (v === '') return '—';
      const base = tipo === 'pct' ? `${v}%` : tipo === 'monto' ? v : v;
      return vc.clave ? `${base}|${vc.clave}` : base;
    };

    const btn = 'px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed';

    return (
      <>
        <div className="bg-white">
          <div className="section-header-theme px-4 py-2 mb-4 flex items-center justify-between rounded-t">
            <span className="text-xs font-semibold tracking-wide uppercase">Prom Comis e Impue</span>
            <span className="text-[10px] text-white/80">Conceptos del Catálogo de Componentes</span>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <button onClick={handleNuevo} disabled={isView} className={btn}>Nuevo</button>
            <button onClick={() => handleEditar()} disabled={!selectedClave} className={btn}>Editar</button>
            <button onClick={handleBorrar} disabled={!selectedClave || isView} className={btn}>Borrar</button>
          </div>

          <div className="border border-gray-400 overflow-x-auto">
            <table className="w-full text-xs min-w-[1000px]">
              <thead>
                <tr className="table-header-theme">
                  <th className="px-3 py-2 text-left font-medium border-r border-white/20 w-20">CLAVE</th>
                  <th className="px-3 py-2 text-left font-medium border-r border-white/20">CONCEPTO</th>
                  {COLUMNAS.map(col => (
                    <th key={col.campo} className="px-3 py-2 text-right font-medium border-r border-white/20 w-28 last:border-r-0">
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {filas.length === 0 ? (
                  <tr>
                    <td colSpan={2 + COLUMNAS.length} className="px-3 py-6 text-center text-gray-500 text-xs">
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
                        <td className="px-3 py-2 text-gray-700 border-r border-gray-300 font-medium">{fila.clave}</td>
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
                        {COLUMNAS.map(col => (
                          <td key={col.campo} className="px-3 py-2 text-gray-700 border-r border-gray-300 text-right font-mono last:border-r-0">
                            {mostrar((fila as any)[col.campo], col.tipo)}
                          </td>
                        ))}
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
              Formato <strong>valor|clave</strong>: la clave es el componente contable que recibe el movimiento.
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
            componentes={componentes}
            onSave={handleGuardar}
            onClose={() => setShowModal(false)}
          />
        )}
      </>
    );
  }
);

PromComisImpuestosTab.displayName = 'PromComisImpuestosTab';

interface FormModalProps {
  mode: 'create' | 'edit' | 'view';
  clave: string;
  concepto: string;
  configActual?: ConfigProm;
  disponibles: ComponenteContable[];
  componentes: ComponenteContable[];
  onSave: (clave: string, cfg: ConfigProm) => void;
  onClose: () => void;
}

function FormModal({
  mode, clave, concepto, configActual, disponibles, componentes, onSave, onClose,
}: FormModalProps) {
  const isViewMode = mode === 'view';
  const isCreate = mode === 'create';

  const [claveSel, setClaveSel] = useState(clave);
  const [form, setForm] = useState<ConfigProm>(configActual || CONFIG_NUEVA(concepto));

  const componenteSel = disponibles.find(c => c.codigo === claveSel);
  const claveMostrada = isCreate ? claveSel : clave;
  const conceptoMostrado = isCreate ? (componenteSel?.nombre || '') : concepto;

  const setVC = (campo: keyof ConfigProm, parte: 'valor' | 'clave', v: string) =>
    setForm(prev => ({
      ...prev,
      [campo]: { ...(prev[campo] as ValorConClave), [parte]: v },
    }));

  const soloNumero = (v: string) => v.replace(/[^0-9.]/g, '');
  const soloEntero = (v: string) => v.replace(/[^0-9]/g, '');

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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">
            {isCreate ? 'Nueva Promoción / Comisión' : mode === 'edit' ? 'Editar Promoción / Comisión' : 'Ver Promoción / Comisión'}
          </h3>
          <button onClick={onClose} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
        </div>

        <div className="px-6 py-4 overflow-auto bg-white">
          <form onSubmit={handleSubmit}>
            <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91]">
              <span className="text-xs font-medium text-gray-800">INFORMACIÓN DEL CONCEPTO</span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
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
              </div>
            </div>

            <div className="bg-[#E7E6E6] px-3 py-1.5 mb-3 border-l-4 border-[#2E5C91] flex items-center justify-between">
              <span className="text-xs font-medium text-gray-800">VALORES</span>
              <span className="text-[10px] text-gray-600">
                Cada valor puede apuntar a un componente contable (la parte <strong>|clave</strong>)
              </span>
            </div>

            <div className="border border-gray-300">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F1F1F1] border-b border-gray-300">
                    <th className="px-2 py-1.5 text-left font-medium text-gray-700 border-r border-gray-300">CAMPO</th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-700 border-r border-gray-300 w-36">VALOR</th>
                    <th className="px-2 py-1.5 text-left font-medium text-gray-700">CLAVE CONTABLE</th>
                  </tr>
                </thead>
                <tbody>
                  {COLUMNAS.map((col, i) => {
                    const vc = form[col.campo] as ValorConClave;
                    return (
                      <tr key={col.campo} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'}`}>
                        <td className="px-2 py-1.5 text-gray-700 border-r border-gray-200">{col.label}</td>
                        <td className="px-2 py-1 border-r border-gray-200">
                          <div className="relative">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={vc?.valor ?? ''}
                              disabled={isViewMode}
                              onChange={e =>
                                setVC(col.campo, 'valor', col.tipo === 'entero' ? soloEntero(e.target.value) : soloNumero(e.target.value))
                              }
                              onBlur={() => {
                                const raw = (vc?.valor ?? '').trim();
                                if (raw === '') return;
                                const n = parseFloat(raw);
                                if (isNaN(n)) return;
                                if (col.tipo === 'monto') setVC(col.campo, 'valor', n.toFixed(2));
                                if (col.tipo === 'pct') setVC(col.campo, 'valor', String(Math.min(100, Math.max(0, n))));
                              }}
                              placeholder={col.tipo === 'monto' ? '0.00' : '0'}
                              className={`${inputClass()} text-right font-mono ${col.tipo === 'pct' ? 'pr-5' : ''}`}
                            />
                            {col.tipo === 'pct' && (
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600">%</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-1">
                          <select
                            value={vc?.clave ?? ''}
                            disabled={isViewMode}
                            onChange={e => setVC(col.campo, 'clave', e.target.value)}
                            className={inputClass()}
                          >
                            <option value="">— Sin clave —</option>
                            {componentes.map(c => (
                              <option key={c.id} value={c.codigo}>{c.codigo} — {c.nombre}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
