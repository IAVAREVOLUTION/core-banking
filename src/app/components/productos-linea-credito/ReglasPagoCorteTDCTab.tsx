/**
 * ReglasPagoCorteTDCTab — Reglas de pago y corte de la Tarjeta de Crédito
 * (producto Línea de Crédito revolvente).
 *
 * Es una configuración ÚNICA por producto (no un listado maestro-detalle),
 * dividida en cinco secciones:
 *   1. Vigencia de la configuración   (versionado y a quién alcanza)
 *   2. Ciclo de corte                 (día de corte, fecha límite de pago)
 *   3. Pago mínimo                    (método, % base, mínimo absoluto, conceptos)
 *   4. Pago para no generar intereses (método, %, conceptos)
 *   5. Aplicación de pagos            (regla de prelación y orden)
 *
 * Todo se persiste dentro del JSON institucional de J_PRODUCTOS.data,
 * en el nodo `reglasPagoCorteTDC` (el Form lo recoge vía ref.getData()).
 */
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useProductoPersistence } from '@/app/hooks/useProductoPersistence';
import { useComponentesContablesCatalogo } from '@/app/hooks/useComponentesContablesCatalogo';
import type {
  ReglasPagoCorteTDC,
  OrdenPrelacionTDC,
  AplicacionVersionTDC,
} from '@/app/types/productoLineaCredito';

// ── Catálogos del subtab ──
const ESTATUS_REGLA = ['Activa', 'Inactiva', 'En revisión'];

const TIPOS_CORTE = [
  'Día fijo mensual',
  'Día hábil del mes',
  'Fin de mes',
  'Ciclo asignado al cliente',
];

const AJUSTES_DIA_INHABIL = [
  'Siguiente día hábil',
  'Día hábil anterior',
  'No ajustar',
];

const METODOS_PAGO_MINIMO = [
  '% + mínimo fijo',
  '% del saldo al corte',
  'Monto fijo',
  'El mayor entre % y monto fijo',
];

const CONCEPTOS_PAGO_MINIMO = [
  'Capital',
  'Interés ordinario',
  'Interés moratorio',
  'Comisiones',
  'IVA',
  'Otros cargos',
];

const METODOS_PAGO_NO_INTERESES = [
  'Saldo revolvente exigible',
  'Saldo total al corte',
  'Saldo al corte menos no exigibles',
];

const CONCEPTOS_PAGO_NO_INTERESES = [
  'Compras normales',
  'Disposiciones de efectivo',
  'Interés ordinario',
  'Comisiones',
  'IVA',
  'MSI no exigibles',
  'Saldos diferidos no exigibles',
];

const CONCEPTOS_PRELACION = [
  'Saldo vencido',
  'IVA',
  'Comisiones',
  'Interés moratorio',
  'Interés ordinario',
  'Capital',
];

/** Configuración inicial: campos capturables vacíos, catálogos con el default normativo. */
export const reglasPagoCorteTDCVacias = (): ReglasPagoCorteTDC => ({
  // [VIGENCIA DE LA CONFIGURACIÓN]
  claveRegla: '',
  version: '',
  vigenciaDesde: '',
  vigenciaHasta: '',
  vigenciaIndefinida: true,
  estatus: 'Activa',
  aplicacionNuevaVersion: 'SOLO_NUEVAS',
  // [CICLO DE CORTE]
  tipoCorte: '',
  diaCorte: '',
  diasFechaLimitePago: '',
  ajusteDiaInhabil: '',
  generarEstadoCuenta: true,
  horaCierre: '',
  // [PAGO MÍNIMO]
  pagoMinimoMetodo: '',
  pagoMinimoPorcentajeBase: '',
  pagoMinimoMontoAbsoluto: '',
  pagoMinimoAgregarSaldoVencido: true,
  pagoMinimoConceptos: ['Capital', 'Interés ordinario', 'Interés moratorio', 'Comisiones', 'IVA'],
  // [PAGO PARA NO GENERAR INTERESES]
  pagoNoInteresesMetodo: '',
  pagoNoInteresesPorcentaje: '',
  pagoNoInteresesConceptos: ['Compras normales', 'Disposiciones de efectivo', 'Interés ordinario', 'Comisiones', 'IVA'],
  // [APLICACIÓN DE PAGOS]
  reglaPrelacion: '',
  ordenAplicacionPagos: CONCEPTOS_PRELACION.map((concepto, i) => ({
    id: i + 1,
    seq: i + 1,
    concepto,
  })),
});

interface Props {
  mode: 'create' | 'edit' | 'view';
  productId: number | string;
  initialData?: ReglasPagoCorteTDC;
  persistToStorage?: boolean;
}

export const ReglasPagoCorteTDCTab = forwardRef<{ getData: () => ReglasPagoCorteTDC }, Props>(
  ({ mode, productId, initialData, persistToStorage }, ref) => {
    const storageKey =
      persistToStorage && productId ? `linea_credito_reglas_pago_corte_tdc_${productId}` : '';
    const isView = mode === 'view';

    // Mismo guard que Prelacion2oPisoTab: limpiar el storage UNA sola vez al montar
    // en alta, no en cada render (si no, se borra lo que la persistencia acaba de escribir).
    const clearedOnCreateRef = useRef(false);
    useEffect(() => {
      if (mode === 'create' && storageKey && !clearedOnCreateRef.current) {
        try { sessionStorage.removeItem(storageKey); } catch (_) { /* ignore */ }
        clearedOnCreateRef.current = true;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { data, setData } = useProductoPersistence<ReglasPagoCorteTDC>(
      storageKey,
      initialData ? { ...reglasPagoCorteTDCVacias(), ...initialData } : reglasPagoCorteTDCVacias()
    );

    // En consulta la BD es la única fuente de verdad: nunca mostrar WIP de sesión.
    useEffect(() => {
      if (isView && initialData) {
        setData({ ...reglasPagoCorteTDCVacias(), ...initialData });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isView, initialData]);

    // Conceptos del orden de aplicación: Catálogo de Componentes institucional
    // (Configuración → Componentes Contables), la misma fuente que Prelación de cargos.
    const { componentes, loading: cargandoCatalogo } = useComponentesContablesCatalogo();

    useImperativeHandle(ref, () => ({ getData: () => data }), [data]);

    const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
      vigencia: true,
      corte: true,
      pagoMinimo: true,
      pagoNoIntereses: true,
      aplicacionPagos: true,
    });

    const toggleSection = (section: string) =>
      setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));

    const setField = <K extends keyof ReglasPagoCorteTDC>(field: K, value: ReglasPagoCorteTDC[K]) => {
      if (isView) return;
      setData(prev => ({ ...prev, [field]: value }));
    };

    const toggleConcepto = (
      field: 'pagoMinimoConceptos' | 'pagoNoInteresesConceptos',
      concepto: string
    ) => {
      if (isView) return;
      const actuales = data[field] || [];
      setField(
        field,
        actuales.includes(concepto)
          ? actuales.filter(c => c !== concepto)
          : [...actuales, concepto]
      );
    };

    // ── Orden de aplicación de pagos ──
    const orden = [...(data.ordenAplicacionPagos || [])].sort((a, b) => a.seq - b.seq);

    /** Renumera SEQ 1..n para que la prelación nunca quede con huecos ni empates. */
    const renumerar = (items: OrdenPrelacionTDC[]) =>
      items.map((item, i) => ({ ...item, seq: i + 1 }));

    const moverConcepto = (index: number, direccion: -1 | 1) => {
      const destino = index + direccion;
      if (isView || destino < 0 || destino >= orden.length) return;
      const copia = [...orden];
      [copia[index], copia[destino]] = [copia[destino], copia[index]];
      setField('ordenAplicacionPagos', renumerar(copia));
    };

    const eliminarConcepto = (id: number) => {
      if (isView) return;
      setField('ordenAplicacionPagos', renumerar(orden.filter(o => o.id !== id)));
    };

    const [conceptoNuevo, setConceptoNuevo] = useState('');

    /** Un concepto no puede repetirse dentro de la prelación. */
    const yaEnOrden = (concepto: string) =>
      orden.some(o => o.concepto.toLowerCase() === concepto.toLowerCase());

    const agregarConcepto = () => {
      const concepto = conceptoNuevo.trim();
      if (isView || !concepto || yaEnOrden(concepto)) return;
      const nuevo: OrdenPrelacionTDC = {
        id: Math.max(...orden.map(o => o.id), 0) + 1,
        seq: orden.length + 1,
        concepto,
      };
      setField('ordenAplicacionPagos', renumerar([...orden, nuevo]));
      setConceptoNuevo('');
    };

    // ── Estilos homologados con el tab Default ──
    const viewFieldClass =
      'flex-1 px-2 py-1 text-xs bg-gray-50 border border-transparent rounded text-gray-800 cursor-default';
    const inputClass =
      'flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500';
    const labelClass = 'text-xs text-gray-700 w-56 flex-shrink-0';

    // Cabecera de sección con el fondo temático institucional (mismo estilo que
    // el header "PERIODOS" del Form), con chevron para colapsar/expandir.
    const renderSectionHeader = (id: string, titulo: string) => (
      <div
        className="section-header-theme px-4 py-2 mb-4 flex items-center justify-between rounded-t cursor-pointer"
        onClick={() => toggleSection(id)}
      >
        <span className="text-xs font-semibold tracking-wide uppercase">{titulo}</span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform duration-200 ${openSections[id] ? 'rotate-180' : ''}`}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </div>
    );

    const renderCheckboxes = (
      field: 'pagoMinimoConceptos' | 'pagoNoInteresesConceptos',
      catalogo: string[]
    ) => {
      const seleccionados = data[field] || [];
      return (
        <div className="grid grid-cols-3 gap-y-2 gap-x-4">
          {catalogo.map(concepto => (
            <label
              key={concepto}
              className={`flex items-center gap-2 text-xs text-gray-700 ${isView ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <input
                type="checkbox"
                checked={seleccionados.includes(concepto)}
                onChange={() => toggleConcepto(field, concepto)}
                disabled={isView}
                className="w-3.5 h-3.5"
              />
              {concepto}
            </label>
          ))}
        </div>
      );
    };

    return (
      <div className="space-y-6 p-4">
        {/* ═══ SECCIÓN 1: VIGENCIA DE LA CONFIGURACIÓN ═══ */}
        <div>
          {renderSectionHeader('vigencia', 'Vigencia de la Configuración')}
          {openSections.vigencia && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className={labelClass}>Clave de regla</label>
                  {isView ? (
                    <div className={viewFieldClass}>{data.claveRegla || 'No definido'}</div>
                  ) : (
                    <input
                      type="text"
                      maxLength={30}
                      placeholder="TC-PAGO-001"
                      value={data.claveRegla}
                      onChange={e => setField('claveRegla', e.target.value.toUpperCase())}
                      className={inputClass}
                    />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className={labelClass}>Versión</label>
                  {isView ? (
                    <div className={viewFieldClass}>{data.version || 'No definido'}</div>
                  ) : (
                    <input
                      type="text"
                      maxLength={10}
                      placeholder="1.0"
                      value={data.version}
                      onChange={e => setField('version', e.target.value)}
                      className={inputClass}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className={labelClass}>Vigencia desde</label>
                  {isView ? (
                    <div className={viewFieldClass}>{data.vigenciaDesde || 'No definido'}</div>
                  ) : (
                    <input
                      type="date"
                      value={data.vigenciaDesde}
                      onChange={e => setField('vigenciaDesde', e.target.value)}
                      className={inputClass}
                    />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className={labelClass}>Vigencia hasta</label>
                  {isView ? (
                    <div className={viewFieldClass}>
                      {data.vigenciaIndefinida ? 'Indefinida' : data.vigenciaHasta || 'No definido'}
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="date"
                        value={data.vigenciaHasta}
                        onChange={e => setField('vigenciaHasta', e.target.value)}
                        disabled={data.vigenciaIndefinida}
                        className={`${inputClass} ${data.vigenciaIndefinida ? 'bg-gray-100 text-gray-400' : ''}`}
                      />
                      <label className="flex items-center gap-1 text-xs text-gray-700 whitespace-nowrap cursor-pointer">
                        <input
                          type="checkbox"
                          checked={data.vigenciaIndefinida}
                          onChange={e => {
                            setField('vigenciaIndefinida', e.target.checked);
                            if (e.target.checked) setField('vigenciaHasta', '');
                          }}
                          className="w-3.5 h-3.5"
                        />
                        Indefinida
                      </label>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className={labelClass}>Estatus</label>
                  {isView ? (
                    <div className={viewFieldClass}>{data.estatus || 'No definido'}</div>
                  ) : (
                    <select
                      value={data.estatus}
                      onChange={e => setField('estatus', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Seleccione...</option>
                      {ESTATUS_REGLA.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="pt-1">
                <span className="block text-xs text-gray-700 mb-2">Aplicación de nueva versión</span>
                <div className="space-y-1.5 pl-1">
                  {([
                    { id: 'SOLO_NUEVAS', label: 'Solo nuevas originaciones' },
                    { id: 'EXISTENTES_Y_NUEVAS', label: 'Cuentas existentes y nuevas' },
                  ] as { id: AplicacionVersionTDC; label: string }[]).map(op => (
                    <label
                      key={op.id}
                      className={`flex items-center gap-2 text-xs text-gray-700 ${isView ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <input
                        type="radio"
                        name="aplicacionNuevaVersion"
                        checked={data.aplicacionNuevaVersion === op.id}
                        onChange={() => setField('aplicacionNuevaVersion', op.id)}
                        disabled={isView}
                        className="w-3.5 h-3.5"
                      />
                      {op.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ SECCIÓN 2: CICLO DE CORTE ═══ */}
        <div>
          {renderSectionHeader('corte', 'Ciclo de Corte')}
          {openSections.corte && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className={labelClass}>Tipo de corte</label>
                  {isView ? (
                    <div className={viewFieldClass}>{data.tipoCorte || 'No definido'}</div>
                  ) : (
                    <select
                      value={data.tipoCorte}
                      onChange={e => setField('tipoCorte', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Seleccione...</option>
                      {TIPOS_CORTE.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className={labelClass}>Día de corte</label>
                  {isView ? (
                    <div className={viewFieldClass}>{data.diaCorte || 'No definido'}</div>
                  ) : (
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={data.diaCorte}
                      onChange={e => setField('diaCorte', e.target.value)}
                      className={inputClass}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className={labelClass}>Días para fecha límite de pago</label>
                  {isView ? (
                    <div className={viewFieldClass}>{data.diasFechaLimitePago || 'No definido'}</div>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      value={data.diasFechaLimitePago}
                      onChange={e => setField('diasFechaLimitePago', e.target.value)}
                      className={inputClass}
                    />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className={labelClass}>Ajuste por día inhábil</label>
                  {isView ? (
                    <div className={viewFieldClass}>{data.ajusteDiaInhabil || 'No definido'}</div>
                  ) : (
                    <select
                      value={data.ajusteDiaInhabil}
                      onChange={e => setField('ajusteDiaInhabil', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Seleccione...</option>
                      {AJUSTES_DIA_INHABIL.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className={labelClass}>Generar estado de cuenta</label>
                  {isView ? (
                    <div className={viewFieldClass}>{data.generarEstadoCuenta ? 'Sí' : 'No'}</div>
                  ) : (
                    <select
                      value={data.generarEstadoCuenta ? 'Si' : 'No'}
                      onChange={e => setField('generarEstadoCuenta', e.target.value === 'Si')}
                      className={inputClass}
                    >
                      <option value="Si">Sí</option>
                      <option value="No">No</option>
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className={labelClass}>Hora de cierre</label>
                  {isView ? (
                    <div className={viewFieldClass}>{data.horaCierre || 'No definido'}</div>
                  ) : (
                    <input
                      type="time"
                      value={data.horaCierre}
                      onChange={e => setField('horaCierre', e.target.value)}
                      className={inputClass}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ SECCIÓN 3: PAGO MÍNIMO ═══ */}
        <div>
          {renderSectionHeader('pagoMinimo', 'Pago Mínimo')}
          {openSections.pagoMinimo && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className={labelClass}>Método de cálculo</label>
                  {isView ? (
                    <div className={viewFieldClass}>{data.pagoMinimoMetodo || 'No definido'}</div>
                  ) : (
                    <select
                      value={data.pagoMinimoMetodo}
                      onChange={e => setField('pagoMinimoMetodo', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Seleccione...</option>
                      {METODOS_PAGO_MINIMO.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className={labelClass}>Porcentaje base (%)</label>
                  {isView ? (
                    <div className={viewFieldClass}>
                      {data.pagoMinimoPorcentajeBase !== '' ? `${data.pagoMinimoPorcentajeBase} %` : 'No definido'}
                    </div>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={data.pagoMinimoPorcentajeBase}
                      onChange={e => setField('pagoMinimoPorcentajeBase', e.target.value)}
                      className={inputClass}
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className={labelClass}>Monto mínimo absoluto</label>
                  {isView ? (
                    <div className={viewFieldClass}>
                      {data.pagoMinimoMontoAbsoluto !== ''
                        ? `$${Number(data.pagoMinimoMontoAbsoluto).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                        : 'No definido'}
                    </div>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={data.pagoMinimoMontoAbsoluto}
                      onChange={e => setField('pagoMinimoMontoAbsoluto', e.target.value)}
                      className={inputClass}
                    />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className={labelClass}>Agregar saldo vencido</label>
                  {isView ? (
                    <div className={viewFieldClass}>{data.pagoMinimoAgregarSaldoVencido ? 'Sí' : 'No'}</div>
                  ) : (
                    <select
                      value={data.pagoMinimoAgregarSaldoVencido ? 'Si' : 'No'}
                      onChange={e => setField('pagoMinimoAgregarSaldoVencido', e.target.value === 'Si')}
                      className={inputClass}
                    >
                      <option value="Si">Sí</option>
                      <option value="No">No</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="pt-1">
                <span className="block text-xs text-gray-700 mb-2">Conceptos incluidos</span>
                {renderCheckboxes('pagoMinimoConceptos', CONCEPTOS_PAGO_MINIMO)}
              </div>
            </div>
          )}
        </div>

        {/* ═══ SECCIÓN 4: PAGO PARA NO GENERAR INTERESES ═══ */}
        <div>
          {renderSectionHeader('pagoNoIntereses', 'Pago para No Generar Intereses')}
          {openSections.pagoNoIntereses && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className={labelClass}>Método de cálculo</label>
                  {isView ? (
                    <div className={viewFieldClass}>{data.pagoNoInteresesMetodo || 'No definido'}</div>
                  ) : (
                    <select
                      value={data.pagoNoInteresesMetodo}
                      onChange={e => setField('pagoNoInteresesMetodo', e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Seleccione...</option>
                      {METODOS_PAGO_NO_INTERESES.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <label className={labelClass}>Porcentaje (%)</label>
                  {isView ? (
                    <div className={viewFieldClass}>
                      {data.pagoNoInteresesPorcentaje !== '' ? `${data.pagoNoInteresesPorcentaje} %` : 'No definido'}
                    </div>
                  ) : (
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={data.pagoNoInteresesPorcentaje}
                      onChange={e => setField('pagoNoInteresesPorcentaje', e.target.value)}
                      className={inputClass}
                    />
                  )}
                </div>
              </div>

              <div className="pt-1">
                <span className="block text-xs text-gray-700 mb-2">Conceptos incluidos</span>
                {renderCheckboxes('pagoNoInteresesConceptos', CONCEPTOS_PAGO_NO_INTERESES)}
              </div>
            </div>
          )}
        </div>

        {/* ═══ SECCIÓN 5: APLICACIÓN DE PAGOS ═══ */}
        <div>
          {renderSectionHeader('aplicacionPagos', 'Aplicación de Pagos')}
          {openSections.aplicacionPagos && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <label className={labelClass}>Regla de prelación</label>
                  {isView ? (
                    <div className={viewFieldClass}>{data.reglaPrelacion || 'No definido'}</div>
                  ) : (
                    <input
                      type="text"
                      maxLength={30}
                      placeholder="TC-PREL-001"
                      value={data.reglaPrelacion}
                      onChange={e => setField('reglaPrelacion', e.target.value.toUpperCase())}
                      className={inputClass}
                    />
                  )}
                </div>
              </div>

              <div className="pt-1">
                <span className="block text-xs text-gray-700 mb-2">Orden de aplicación</span>

                {!isView && (
                  <div className="mb-2">
                    <div className="flex items-center gap-2">
                      <select
                        value={conceptoNuevo}
                        onChange={e => setConceptoNuevo(e.target.value)}
                        className="w-80 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">
                          {cargandoCatalogo ? 'Cargando catálogo...' : 'Seleccione un concepto...'}
                        </option>
                        {componentes.map(c => (
                          <option key={c.id} value={c.nombre} disabled={yaEnOrden(c.nombre)}>
                            {c.codigo} — {c.nombre}{yaEnOrden(c.nombre) ? ' (ya agregado)' : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={agregarConcepto}
                        disabled={!conceptoNuevo}
                        className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] disabled:bg-gray-400 disabled:border-gray-400 disabled:cursor-not-allowed"
                      >
                        Agregar
                      </button>
                    </div>
                    <span className="text-[10px] text-gray-500 italic">
                      {cargandoCatalogo
                        ? 'Consultando Catálogo de Componentes...'
                        : componentes.length > 0
                          ? `Catálogo de Componentes (${componentes.length} registros)`
                          : 'No se pudo cargar el Catálogo de Componentes. Revise Configuración → Componentes Contables.'}
                    </span>
                  </div>
                )}

                <div className="border border-gray-400 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="table-header-theme">
                        <th className="px-3 py-2 text-center font-medium border-r border-white/20 w-16">ORDEN</th>
                        <th className="px-3 py-2 text-left font-medium border-r border-white/20">CONCEPTO</th>
                        {!isView && <th className="px-3 py-2 text-center font-medium w-32">ACCIONES</th>}
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {orden.length === 0 ? (
                        <tr>
                          <td colSpan={isView ? 2 : 3} className="px-3 py-6 text-center text-gray-500 text-xs">
                            No se encontraron registros
                          </td>
                        </tr>
                      ) : (
                        orden.map((item, index) => (
                          <tr
                            key={item.id}
                            className={`border-b border-gray-300 ${index % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'}`}
                          >
                            <td className="px-3 py-2 text-center text-gray-700 border-r border-gray-300 font-medium">
                              {item.seq}
                            </td>
                            <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{item.concepto}</td>
                            {!isView && (
                              <td className="px-3 py-2 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => moverConcepto(index, -1)}
                                    disabled={index === 0}
                                    title="Subir"
                                    className="px-2 py-0.5 border border-gray-400 text-gray-700 hover:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moverConcepto(index, 1)}
                                    disabled={index === orden.length - 1}
                                    title="Bajar"
                                    className="px-2 py-0.5 border border-gray-400 text-gray-700 hover:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => eliminarConcepto(item.id)}
                                    title="Eliminar"
                                    className="px-2 py-0.5 border border-gray-400 text-red-600 hover:bg-red-50"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-2 text-xs text-gray-600">
                  <span className="font-medium">Total de conceptos: {orden.length}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

ReglasPagoCorteTDCTab.displayName = 'ReglasPagoCorteTDCTab';
