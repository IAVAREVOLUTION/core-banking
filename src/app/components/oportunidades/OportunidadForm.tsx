/**
 * OportunidadForm.tsx
 *
 * Vista de detalle de una Oportunidad — HU-CRM-05.
 *
 *   CA-01  Pestaña 'Default' activa por defecto
 *   CA-02  Pestaña 'Solicitudes' (mapea a j_corp_fin)
 *   CA-03  ID Oportunidad, Cliente Emisor y Sector son de solo lectura
 *   CA-04  Default contiene: Estructura Bursátil, Cotización de Comisiones, Estatus
 *   RN-01  Los campos heredados del Lead no se editan aquí
 *
 * Una Oportunidad es una Cotización de Línea de Crédito (decisión HU-CRM-03),
 * así que persiste sobre el mismo registro de J_COTIZACIONES.
 */
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import type { CotizacionCredito, BitacoraEstatusOportunidad, ArchivoAdjuntoOportunidad } from '../cotizaciones/cotizacionCreditoTypes';
import { generarCartaOferta, subirCartaOferta, CartaOfertaError } from './cartaOfertaPDF';
import { CAT_ESTATUS_OPORTUNIDAD } from '../cotizaciones/cotizacionCreditoTypes';
import { currentUser } from '../../data/mockData';
import { useProductosLineaCreditoDB } from '../../hooks/useProductosLineaCreditoDB';
import { useCorpFinDB, type SolicitudCorpFin } from '../../hooks/useCorpFinDB';

type FormMode = 'create' | 'edit' | 'view';
type TabId = 'default' | 'solicitudes' | 'adjuntos';

interface Props {
  mode: FormMode;
  oportunidad?: CotizacionCredito;
  onSave: (o: CotizacionCredito) => void;
  onBack: () => void;
  existeEnBD?: boolean;
}

/** RN-01 — política de riesgo comercial: la GPO no cubre más del 50%. */
const COBERTURA_GPO_MAXIMA = 50;

const CAT_TIPO_CORP_FIN = [
  'Emisión de Deuda Bursátil',
  'Crédito Bancario Tradicional',
  'Crédito de Recuperación',
  'Garantía de Pago Oportuno',
];
const CAT_ESTATUS_CORP_FIN = ['Pendiente', 'En Análisis', 'Aprobada', 'Rechazada', 'Cancelada'];


/** HU-CRM-07 CA-02 */
const CAT_PERIODICIDAD_COMISION = ['Mensual', 'Trimestral', 'Semestral'];

const formatMoney = (v: number) =>
  `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toNum = (v: unknown): number => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};

/** Sanitiza a dígitos con un solo punto decimal. */
const limpiarDecimal = (v: string): string | null => {
  const c = v.replace(/[^0-9.]/g, '');
  return c.split('.').length > 2 ? null : c;
};

export function OportunidadForm({ mode, oportunidad, onSave, onBack, existeEnBD }: Props) {
  const isView = mode === 'view';

  const [form, setForm] = useState<CotizacionCredito | undefined>(oportunidad);
  const [activeTab, setActiveTab] = useState<TabId>('default'); // CA-01

  // ── HU-CRM-06 — Catálogo de productos de Línea de Crédito ──
  // Los hooks van ANTES de cualquier return temprano (Rules of Hooks).
  const { productos } = useProductosLineaCreditoDB(true);

  const productoSel = useMemo(
    () => productos.find(p => String(p.dbUuid || p.id) === String(form?.producto_id)),
    [productos, form?.producto_id],
  );

  // ── Pestaña Solicitudes (j_corp_fin) — HU-CRM-05 CA-02 ──
  // Solo consulta cuando la Oportunidad ya existe en BD: sin id no hay
  // a qué colgar las solicitudes.
  const {
    solicitudes: solicitudesCorpFin,
    loading: cargandoCorpFin,
    error: errorCorpFin,
    crear: crearCorpFin,
    actualizar: actualizarCorpFin,
    eliminar: eliminarCorpFin,
  } = useCorpFinDB(form?.id || null);

  const [showCorpFinModal, setShowCorpFinModal] = useState(false);
  const [corpFinEdit, setCorpFinEdit] = useState<SolicitudCorpFin | undefined>();

  // ── HU-CRM-10 ──
  const [generandoCarta, setGenerandoCarta] = useState(false);
  const [cartaEnVisor, setCartaEnVisor] = useState<{ url: string; nombre: string } | null>(null);

  if (!form) {
    return (
      <div className="px-4 py-8 text-center text-sm text-gray-500">
        No hay una Oportunidad seleccionada.
        <div className="mt-3">
          <button onClick={onBack} className="px-4 py-1.5 border border-gray-400 rounded text-sm hover:bg-gray-50">Volver</button>
        </div>
      </div>
    );
  }

  const data = form.data as any;

  /** Renglones de la Matriz Tasa Fija del producto (CA-02). */
  const matrizProducto: any[] = Array.isArray(productoSel?.matrizTasaFija) ? productoSel!.matrizTasaFija as any[] : [];
  const matrizSel = matrizProducto.find(m => String(m.id) === String(data.matrizTasaFijaSeleccionId));

  /** Renglones de "Cobertura y Comisiones 2o Piso" del producto (CA-05, REQ-8). */
  const coberturasProducto: any[] = Array.isArray(productoSel?.cobertura2oPiso) ? productoSel!.cobertura2oPiso as any[] : [];

  /** Actualiza un campo del nodo data. */
  const setData = (patch: Record<string, any>) => {
    setForm(prev => (prev ? { ...prev, data: { ...(prev.data as any), ...patch } } : prev));
  };

  // ── Cálculos de la GPO ──
  // CA-06: Monto Máximo Garantizado = Monto Emisión × % Cobertura.
  // El Monto Emisión sale del renglón elegido de la matriz; si aún no se
  // elige producto, cae al Monto Inversión heredado del Lead.
  const montoInversion = toNum(data.montoInversion) || toNum(data.montoSolicitado);
  const montoEmision = toNum(data.montoEmision) || montoInversion;
  const pctCobertura = toNum(data.coberturaGPOPorcentaje);
  const pctComision = toNum(data.comisionGPOPorcentaje);
  const montoGarantizado = montoEmision * (pctCobertura / 100);
  // CA-03 — Ingreso Anual Estimado = Monto Máximo Garantizado × Tasa Comisión Anual.
  // RN-01: al ser derivado en render, se recalcula solo al mover monto de
  // emisión, % cobertura o tasa de comisión.
  const ingresoAnualComisiones = montoGarantizado * (pctComision / 100);

  // ── HU-CRM-08 CA-05 — Error inline inmediato sobre el tope de cobertura ──
  // Derivado en render: aparece en cuanto el valor excede, sin submit.
  const errorCobertura =
    pctCobertura > COBERTURA_GPO_MAXIMA
      ? `El % Cobertura GPO (${pctCobertura}%) excede el máximo de ${COBERTURA_GPO_MAXIMA}% que permite la política de riesgo comercial.`
      : pctCobertura < 0 || pctCobertura > 100
        ? 'El % Cobertura GPO debe estar entre 0 y 100.'
        : null;

  const errorComision =
    pctComision < 0 || pctComision > 100 ? 'La Tasa Comisión Anual debe estar entre 0 y 100.' : null;

  /** CA-05: con cualquier error de cálculo no se permite guardar. */
  const puedeGuardar = !errorCobertura && !errorComision;

  // ── Handlers de la cascada Producto → Matriz → Cobertura ──

  /** CA-07: cambiar de producto resetea Plazo, Tasa y Cobertura. */
  const handleProductoChange = (uuid: string) => {
    const p = productos.find(x => String(x.dbUuid || x.id) === uuid);
    setForm(prev => (prev ? {
      ...prev,
      producto_id: uuid,
      data: {
        ...(prev.data as any),
        producto: {
          claveProducto: p?.clave || '',
          nombreProducto: p?.nombre || '',
          tipoProducto: p?.subTipo || '',
          lineaProducto: 'Línea de Crédito',
        },
        matrizTasaFijaSeleccionId: '',
        montoEmision: '',
        plazoBonosAnios: '',
        tasaBonosAnios: '',
        cobertura2oPisoSeleccionId: '',
        coberturaGPOPorcentaje: '',
        coberturaGPOSobre: '',
      },
    } : prev));
  };

  /** CA-02/03/04: el renglón de matriz alimenta Monto, Plazo y Tasa. */
  const handleMatrizChange = (id: string) => {
    const m = matrizProducto.find(x => String(x.id) === id);
    setData({
      matrizTasaFijaSeleccionId: id,
      montoEmision: m ? String(m.montoDefault ?? '') : '',
      plazoBonosAnios: m ? String(m.plazoDefault ?? '') : '',
      tasaBonosAnios: m ? String(m.tasaDefault ?? '') : '',
    });
  };

  /** CA-05 + RN-01: la cobertura sale del producto y tope de 50%. */
  const handleCoberturaChange = (id: string) => {
    const c = coberturasProducto.find(x => String(x.id) === id);
    if (!c) {
      setData({ cobertura2oPisoSeleccionId: '', coberturaGPOPorcentaje: '', coberturaGPOSobre: '' });
      return;
    }
    // El valor se aplica aunque exceda el tope: CA-05 pide error inline
    // inmediato y bloqueo de guardado, no un rechazo silencioso de la opción.
    setData({
      cobertura2oPisoSeleccionId: id,
      coberturaGPOPorcentaje: String(c.porcentajeDefaultCobertura ?? ''),
      coberturaGPOSobre: c.sobreCobertura || '',
      // La comisión pactada se propone del mismo renglón del producto.
      comisionGPOPorcentaje: data.comisionGPOPorcentaje || String(c.porcentajeDefaultComision ?? ''),
      comisionGPOSobre: data.comisionGPOSobre || c.sobreComision || '',
    });
  };

  const fieldClass = isView
    ? 'w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded text-gray-700'
    : 'w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  const readonlyClass = 'w-full px-3 py-2 text-xs bg-gray-100 border border-gray-200 rounded text-gray-500';

  const handleGuardar = () => {
    // Defensa en profundidad: el botón ya está deshabilitado en estos casos.
    if (errorCobertura) {
      toast.error('Cobertura GPO fuera de política', { description: errorCobertura });
      return;
    }
    if (errorComision) {
      toast.error('Tasa de comisión inválida', { description: errorComision });
      return;
    }
    onSave(form);
  };

  // ── Handlers de solicitudes corporativas ──
  const handleNuevaSolicitud = () => {
    if (!form.id) {
      toast.error('Guarde la Oportunidad primero', {
        description: 'Las solicitudes corporativas se ligan al folio de la Oportunidad.',
      });
      return;
    }
    setCorpFinEdit(undefined);
    setShowCorpFinModal(true);
  };

  const handleEditarSolicitud = (sol: SolicitudCorpFin) => {
    if (isView) return;
    setCorpFinEdit(sol);
    setShowCorpFinModal(true);
  };

  const handleEliminarSolicitud = async (sol: SolicitudCorpFin) => {
    if (!window.confirm(`¿Eliminar la solicitud ${sol.folio || sol.id}?`)) return;
    const r = await eliminarCorpFin(sol.id);
    if (r.ok) toast.success('Solicitud eliminada');
    else toast.error('No se pudo eliminar', { description: r.error });
  };

  const handleGuardarSolicitud = async (payload: any) => {
    const r = corpFinEdit
      ? await actualizarCorpFin(corpFinEdit.id, payload)
      : await crearCorpFin({ ...payload, cliente_id: form.cliente_id || undefined });

    if (r.ok) {
      toast.success(corpFinEdit ? 'Solicitud actualizada' : 'Solicitud creada');
      setShowCorpFinModal(false);
    } else {
      toast.error('No se pudo guardar', { description: r.error });
    }
  };

  // ══════════════════════════════════════════════════════════════
  // HU-CRM-10 — Carta Oferta
  // ══════════════════════════════════════════════════════════════
  const archivosAdjuntos: ArchivoAdjuntoOportunidad[] = Array.isArray(data.archivosAdjuntos)
    ? data.archivosAdjuntos
    : [];

  /** RN-01 — campos obligatorios antes de poder emitir la propuesta. */
  const faltantesCartaOferta = (): string[] => {
    const f: string[] = [];
    if (!form.producto_id) f.push('Producto');
    if (montoEmision <= 0) f.push('Monto Emisión');
    if (!data.plazoBonosAnios) f.push('Plazo Bonos');
    if (!data.tasaBonosAnios) f.push('Tasa Bonos');
    if (pctCobertura <= 0) f.push('% Cobertura GPO');
    if (pctComision <= 0) f.push('Tasa Comisión Anual GPO');
    // HU-CRM-07 CA-04 — aquí es donde la periodicidad se vuelve exigible.
    if (!data.periodicidadCobroComision) f.push('Periodicidad Cobro Comisión');
    return f;
  };

  const handleGenerarCartaOferta = async () => {
    if (errorCobertura || errorComision) {
      toast.error('Corrija los errores antes de generar la Carta Oferta');
      return;
    }
    const faltan = faltantesCartaOferta();
    if (faltan.length > 0) {
      toast.error('Faltan campos obligatorios', { description: faltan.join(', ') });
      return;
    }

    setGenerandoCarta(true);
    try {
      // CA-02/CA-03 — plantilla del producto + datos vigentes (RN-02)
      const generada = await generarCartaOferta(form, productoSel?.plantillas as any);

      // CA-04 — se adjunta a la Oportunidad
      const subida = await subirCartaOferta(generada.dataUri, generada.nombreArchivo, form.id || form.no_cotiza);

      const adjunto: ArchivoAdjuntoOportunidad = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nombre: generada.nombreArchivo,
        tipo: 'Carta Oferta',
        url: subida.url,
        storagePath: subida.storagePath,
        tamanoKB: subida.tamanoKB,
        fecha: new Date().toISOString(),
        usuario: currentUser.name,
        plantilla: generada.plantillaVersion
          ? `${generada.plantillaNombre} v${generada.plantillaVersion}`
          : generada.plantillaNombre,
        enStorage: subida.enStorage,
      };

      // RN-03 — se agrega, nunca se reemplaza.
      setForm(prev => (prev ? {
        ...prev,
        data: { ...(prev.data as any), archivosAdjuntos: [...archivosAdjuntos, adjunto] },
      } : prev));

      // CA-05 — se despliega para revisión
      setCartaEnVisor({ url: generada.dataUri, nombre: generada.nombreArchivo });

      if (subida.enStorage) {
        toast.success('Carta Oferta generada', { description: 'Se adjuntó a la Oportunidad. Guarde para conservar el registro.' });
      } else {
        toast.warning('Carta Oferta generada, pero no se subió a Storage', {
          description: 'Queda disponible en esta sesión. Revise permisos del bucket.',
        });
      }
    } catch (err) {
      // CA-06
      if (err instanceof CartaOfertaError) {
        toast.error('No hay plantilla de Carta Oferta', { description: err.message, duration: 8000 });
      } else {
        console.error('[OportunidadForm] Error generando la Carta Oferta:', err);
        toast.error('No se pudo generar la Carta Oferta', {
          description: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    } finally {
      setGenerandoCarta(false);
    }
  };

  // ── HU-CRM-09 CA-03 — cada cambio de estatus deja rastro ──
  const bitacoraEstatus: BitacoraEstatusOportunidad[] = Array.isArray(data.bitacoraEstatus)
    ? data.bitacoraEstatus
    : [];

  const handleEstatusChange = (nuevo: string) => {
    const anterior = form.estatus_cotiza || '';
    if (nuevo === anterior) return;

    const entrada: BitacoraEstatusOportunidad = {
      fecha: new Date().toISOString(),
      usuario: currentUser.name,
      estatusAnterior: anterior,
      estatusNuevo: nuevo,
    };

    setForm(prev => (prev ? {
      ...prev,
      estatus_cotiza: nuevo,
      data: {
        ...(prev.data as any),
        bitacoraEstatus: [...bitacoraEstatus, entrada],
      },
    } : prev));
  };

  const seccion = (titulo: string) => (
    <div className="border-l-4 border-primary-theme px-3 py-1.5 border-t border-gray-300">
      <span className="text-xs font-medium text-gray-800 uppercase">{titulo}</span>
    </div>
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: 'default', label: 'Default' },
    { id: 'solicitudes', label: 'Solicitudes' },
    { id: 'adjuntos', label: `Archivos Adjuntos${archivosAdjuntos.length ? ` (${archivosAdjuntos.length})` : ''}` },
  ];

  return (
    <div className="bg-[#F5F5F5] min-h-screen">
      {/* ═══ Header ═══ */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" />
            </svg>
            <h2 className="text-lg font-normal text-gray-800">
              {mode === 'create' ? 'Nueva Oportunidad' : mode === 'edit' ? 'Editar Oportunidad' : 'Consultar Oportunidad'}
            </h2>
            {existeEnBD && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-green-50 text-green-700 border border-green-200">
                Guardada en BD
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isView && (
              <button
                onClick={handleGenerarCartaOferta}
                disabled={generandoCarta}
                title="Genera la Carta Oferta en PDF con la plantilla del producto"
                className={`px-5 py-1.5 rounded text-sm font-medium transition-colors border ${
                  generandoCarta
                    ? 'bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed'
                    : 'bg-white text-[#0099CC] border-[#0099CC] hover:bg-[#E8F6FB]'
                }`}
              >
                {generandoCarta ? 'Generando…' : 'Generar Carta Oferta'}
              </button>
            )}
            {!isView && (
              <button
                onClick={handleGuardar}
                disabled={!puedeGuardar}
                title={errorCobertura || errorComision || 'Guardar la Oportunidad'}
                className={`px-5 py-1.5 rounded text-sm font-medium transition-colors ${
                  puedeGuardar
                    ? 'bg-[#0099CC] text-white hover:bg-[#0088BB]'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Guardar
              </button>
            )}
            <button onClick={onBack} className="px-5 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700">
              {isView ? 'Volver' : 'Cancelar'}
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="bg-white border border-gray-300">
          {/* ═══ Campos heredados — CA-03 / RN-01: siempre solo lectura ═══ */}
          <div className="border-l-4 border-primary-theme px-3 py-1.5">
            <span className="text-xs font-medium text-gray-800 uppercase">Información Heredada</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-1">ID OPORTUNIDAD</label>
              <input value={form.no_cotiza || '—'} disabled className={readonlyClass} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-1">CLIENTE EMISOR</label>
              <input value={data.cliente?.nombreCompleto || '—'} disabled className={readonlyClass} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-1">SECTOR</label>
              <input value={data.sectorInfraestructura || '—'} disabled className={readonlyClass} />
            </div>
          </div>
          <p className="px-4 pb-3 -mt-2 text-[10px] text-gray-400 italic">
            Heredados del Lead. No se editan desde la Oportunidad (RN-01).
          </p>

          {/* ═══ Tabs ═══ */}
          <div className="bg-primary-theme border-t border-gray-400">
            <div className="flex items-center overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-[11px] whitespace-nowrap border-r border-gray-500/30 transition-colors ${
                    activeTab === tab.id ? 'bg-secondary-theme text-white font-medium' : 'text-white/90 hover:bg-[#5A7FB5]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ═══════════ TAB DEFAULT — CA-04 ═══════════ */}
          {activeTab === 'default' && (
            <div>
              {/* ── Estructura Bursátil — HU-CRM-06 ── */}
              {seccion('Estructura Bursátil')}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                {/* CA-01 — Producto */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">PRODUCTO</label>
                  <select
                    value={form.producto_id || ''}
                    disabled={isView}
                    onChange={e => handleProductoChange(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">— Seleccionar producto —</option>
                    {productos.map(p => (
                      <option key={String(p.dbUuid || p.id)} value={String(p.dbUuid || p.id)}>
                        {p.nombre || p.clave || String(p.id)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* CA-02 — Monto Plazos Proyectado (Matriz Tasa Fija del producto) */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">MONTO PLAZOS PROYECTADO</label>
                  <select
                    value={data.matrizTasaFijaSeleccionId || ''}
                    disabled={isView || !productoSel}
                    onChange={e => handleMatrizChange(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">
                      {productoSel ? '— Seleccionar monto/plazo —' : '— Elija primero un producto —'}
                    </option>
                    {matrizProducto.map(m => (
                      <option key={String(m.id)} value={String(m.id)}>
                        {`${formatMoney(toNum(m.montoDefault))} · ${m.plazoDefault ?? '—'} · ${m.tasaDefault ?? '—'}%`}
                      </option>
                    ))}
                  </select>
                  {productoSel && matrizProducto.length === 0 && (
                    <span className="text-[9px] text-amber-600 mt-0.5">El producto no tiene Matriz Tasa Fija configurada.</span>
                  )}
                </div>

                {/* Monto Emisión — base del cálculo de CA-06 */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">MONTO EMISIÓN</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={data.montoEmision ?? ''}
                    disabled={isView}
                    onChange={e => { const c = limpiarDecimal(e.target.value); if (c !== null) setData({ montoEmision: c }); }}
                    onBlur={e => { const n = parseFloat(e.target.value); if (!isNaN(n)) setData({ montoEmision: n.toFixed(2) }); }}
                    placeholder={formatMoney(montoInversion)}
                    className={`${fieldClass} text-right font-mono`}
                  />
                  <span className="text-[9px] text-gray-400 mt-0.5">Default del monto/plazo; si está vacío usa el Monto Inversión del Lead.</span>
                </div>

                {/* CA-03 — Plazo Bonos (editable, RN-02) */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">PLAZO BONOS (AÑOS)</label>
                  <input
                    type="number"
                    min={0}
                    value={data.plazoBonosAnios ?? ''}
                    disabled={isView}
                    onChange={e => setData({ plazoBonosAnios: e.target.value })}
                    className={`${fieldClass} text-right font-mono`}
                  />
                  {matrizSel && <span className="text-[9px] text-gray-400 mt-0.5">Mapeado de {matrizSel.plazoDefault}; editable.</span>}
                </div>

                {/* CA-04 — Tasa Bonos (editable, RN-02) */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">TASA BONOS (%)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={data.tasaBonosAnios ?? ''}
                    disabled={isView}
                    onChange={e => { const c = limpiarDecimal(e.target.value); if (c !== null) setData({ tasaBonosAnios: c }); }}
                    className={`${fieldClass} text-right font-mono`}
                  />
                  {matrizSel && <span className="text-[9px] text-gray-400 mt-0.5">Mapeado de {matrizSel.tasaDefault}%; editable.</span>}
                </div>

                {/* CA-05 — % Cobertura GPO Estimado */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">% COBERTURA GPO ESTIMADO</label>
                  <select
                    value={data.cobertura2oPisoSeleccionId || ''}
                    disabled={isView || !productoSel}
                    onChange={e => handleCoberturaChange(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">
                      {productoSel ? '— Seleccionar cobertura —' : '— Elija primero un producto —'}
                    </option>
                    {coberturasProducto.map(c => (
                      <option key={String(c.id)} value={String(c.id)}>
                        {`${toNum(c.porcentajeDefaultCobertura).toFixed(2)}% sobre ${c.sobreCobertura || '—'}`}
                      </option>
                    ))}
                  </select>
                  {productoSel && coberturasProducto.length === 0 && (
                    <span className="text-[9px] text-amber-600 mt-0.5">El producto no tiene Cobertura y Comisiones 2o Piso configurada.</span>
                  )}
                </div>

                {/* CA-06 — Monto Máximo Garantizado */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">MONTO MÁXIMO GARANTIZADO</label>
                  <input value={formatMoney(montoGarantizado)} disabled className={`${readonlyClass} text-right font-mono`} />
                  <span className="text-[9px] text-gray-400 mt-0.5">Monto Emisión × % Cobertura</span>
                </div>

                {/* HU-CRM-08 CA-05 — error inline inmediato */}
                {errorCobertura && (
                  <div className="md:col-span-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700 flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                      <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                    </svg>
                    {errorCobertura}
                  </div>
                )}

                {/* ── Heredado del Lead (HU-CRM-03 CA-05) ── */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">MONTO INVERSIÓN</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={data.montoInversion ?? ''}
                    disabled={isView}
                    onChange={e => { const c = limpiarDecimal(e.target.value); if (c !== null) setData({ montoInversion: c }); }}
                    onBlur={e => { const n = parseFloat(e.target.value); setData({ montoInversion: isNaN(n) ? '0.00' : n.toFixed(2) }); }}
                    className={`${fieldClass} text-right font-mono`}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">MONEDA</label>
                  <select
                    value={data.monedaInversion || data.moneda || 'MXN'}
                    disabled={isView}
                    onChange={e => setData({ monedaInversion: e.target.value, moneda: e.target.value })}
                    className={fieldClass}
                  >
                    <option value="MXN">MXN - Peso Mexicano</option>
                    <option value="USD">USD - Dólar Americano</option>
                    <option value="EUR">EUR - Euro</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">TIPO FINANCIAMIENTO</label>
                  <select
                    value={data.tipoFinanciamiento || ''}
                    disabled={isView}
                    onChange={e => setData({ tipoFinanciamiento: e.target.value })}
                    className={fieldClass}
                  >
                    <option value="">— Seleccionar —</option>
                    <option value="Emisión de Deuda Bursátil">Emisión de Deuda Bursátil</option>
                    <option value="Crédito Bancario Tradicional">Crédito Bancario Tradicional</option>
                  </select>
                </div>
                <div className="flex flex-col md:col-span-3">
                  <label className="text-[10px] text-gray-600 mb-1">DESCRIPCIÓN OBRA</label>
                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={data.descripcionObra || ''}
                    disabled={isView}
                    onChange={e => setData({ descripcionObra: e.target.value })}
                    className={`${fieldClass} resize-y`}
                  />
                </div>
              </div>

              {/* ── Cotización de Comisiones ── */}
              {seccion('Cotización de Comisiones')}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                {/* CA-01 — Tasa Comisión Anual GPO */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">TASA COMISIÓN ANUAL GPO</label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={data.comisionGPOPorcentaje ?? ''}
                      disabled={isView}
                      onChange={e => { const c = limpiarDecimal(e.target.value); if (c !== null) setData({ comisionGPOPorcentaje: c }); }}
                      className={`${fieldClass} text-right font-mono pr-6`}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">%</span>
                  </div>
                  <span className="text-[9px] text-gray-400 mt-0.5">Default del % Cobertura GPO elegido; editable.</span>
                </div>

                {/* CA-02 / CA-04 — Periodicidad de cobro */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">
                    PERIODICIDAD COBRO COMISIÓN <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={data.periodicidadCobroComision || ''}
                    disabled={isView}
                    onChange={e => setData({ periodicidadCobroComision: e.target.value })}
                    className={fieldClass}
                  >
                    <option value="">— Seleccionar —</option>
                    {CAT_PERIODICIDAD_COMISION.map(x => <option key={x} value={x}>{x}</option>)}
                  </select>
                  <span className="text-[9px] text-gray-400 mt-0.5">Requerida para generar la Carta Oferta.</span>
                </div>

                {/* CA-03 — Ingreso Anual Estimado */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">INGRESO ANUAL ESTIMADO COMISIONES</label>
                  <input value={formatMoney(ingresoAnualComisiones)} disabled className={`${readonlyClass} text-right font-mono`} />
                  <span className="text-[9px] text-gray-400 mt-0.5">Monto Máximo Garantizado × Tasa Comisión Anual</span>
                </div>

                {/* Contexto heredado del producto — solo lectura para no duplicar
                    dónde se captura cada dato. */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">% COBERTURA GPO</label>
                  <input
                    value={data.coberturaGPOPorcentaje ? `${data.coberturaGPOPorcentaje}%` : '—'}
                    disabled
                    className={`${readonlyClass} text-right font-mono`}
                  />
                  <span className="text-[9px] text-gray-400 mt-0.5">Se define en Estructura Bursátil</span>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">MONTO MÁXIMO GARANTIZADO</label>
                  <input value={formatMoney(montoGarantizado)} disabled className={`${readonlyClass} text-right font-mono`} />
                  <span className="text-[9px] text-gray-400 mt-0.5">Monto Emisión × % Cobertura</span>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">BASE PACTADA (PRODUCTO)</label>
                  <input value={data.comisionGPOSobre || '—'} disabled className={readonlyClass} />
                  <span className="text-[9px] text-gray-400 mt-0.5">Heredada de Cobertura y Comisiones 2o Piso</span>
                </div>

                {errorComision && (
                  <div className="md:col-span-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700 flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
                      <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                    </svg>
                    {errorComision}
                  </div>
                )}
              </div>

              {/* ── Estatus ── */}
              {seccion('Estatus')}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">ESTATUS DE LA OPORTUNIDAD</label>
                  <select
                    value={form.estatus_cotiza || ''}
                    disabled={isView}
                    onChange={e => handleEstatusChange(e.target.value)}
                    className={fieldClass}
                  >
                    {/* Un estatus heredado fuera del catálogo (ej. cotizaciones
                        previas a HU-CRM-09) se conserva visible para no perderlo. */}
                    {form.estatus_cotiza && !CAT_ESTATUS_OPORTUNIDAD.includes(form.estatus_cotiza as any) && (
                      <option value={form.estatus_cotiza}>{form.estatus_cotiza}</option>
                    )}
                    {CAT_ESTATUS_OPORTUNIDAD.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">FECHA CREACIÓN</label>
                  <input
                    value={form.fecha_cotiza ? new Date(form.fecha_cotiza).toLocaleString('es-MX') : '—'}
                    disabled
                    className={readonlyClass}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-1">LEAD DE ORIGEN</label>
                  <input value={data.leadOrigenId || '— Captura directa —'} disabled className={`${readonlyClass} font-mono text-[10px]`} />
                </div>
              </div>

              {/* HU-CRM-09 CA-03 — Log de auditoría de cambios de estatus */}
              <div className="px-4 pb-4">
                <div className="text-[10px] text-gray-600 mb-1.5 uppercase tracking-wide">Bitácora de Estatus</div>
                <div className="border border-gray-300 rounded overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-300">
                        <th className="px-3 py-1.5 text-left font-normal text-gray-700 w-44">FECHA Y HORA</th>
                        <th className="px-3 py-1.5 text-left font-normal text-gray-700 w-48">USUARIO</th>
                        <th className="px-3 py-1.5 text-left font-normal text-gray-700">CAMBIO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bitacoraEstatus.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-gray-400">
                            Sin cambios de estatus registrados.
                          </td>
                        </tr>
                      ) : (
                        [...bitacoraEstatus].reverse().map((b, i) => (
                          <tr key={`${b.fecha}-${i}`} className="border-b border-gray-200" style={{ backgroundColor: i % 2 === 1 ? '#F9F9F9' : '#FFFFFF' }}>
                            <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">
                              {new Date(b.fecha).toLocaleString('es-MX')}
                            </td>
                            <td className="px-3 py-1.5 text-gray-700">{b.usuario || '—'}</td>
                            <td className="px-3 py-1.5 text-gray-700">
                              <span className="text-gray-500">{b.estatusAnterior || '(alta)'}</span>
                              <span className="mx-1.5 text-gray-400">→</span>
                              <span className="font-medium">{b.estatusNuevo}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ TAB ARCHIVOS ADJUNTOS — HU-CRM-10 CA-04 ═══════════ */}
          {activeTab === 'adjuntos' && (
            <div>
              {seccion('Archivos Adjuntos')}
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-gray-500">
                    {archivosAdjuntos.length} archivo{archivosAdjuntos.length === 1 ? '' : 's'} adjunto{archivosAdjuntos.length === 1 ? '' : 's'}
                  </span>
                  {!isView && (
                    <button
                      onClick={handleGenerarCartaOferta}
                      disabled={generandoCarta}
                      className={`px-4 py-1.5 rounded text-xs font-medium ${
                        generandoCarta ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#0099CC] text-white hover:bg-[#0088BB]'
                      }`}
                    >
                      {generandoCarta ? 'Generando…' : '+ Generar Carta Oferta'}
                    </button>
                  )}
                </div>

                <div className="border border-gray-300 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-300">
                        <th className="px-3 py-2 text-left font-normal text-gray-700 w-20">Ver</th>
                        <th className="px-3 py-2 text-left font-normal text-gray-700">ARCHIVO</th>
                        <th className="px-3 py-2 text-left font-normal text-gray-700 w-32">TIPO</th>
                        <th className="px-3 py-2 text-left font-normal text-gray-700 w-44">PLANTILLA</th>
                        <th className="px-3 py-2 text-right font-normal text-gray-700 w-20">TAMAÑO</th>
                        <th className="px-3 py-2 text-left font-normal text-gray-700 w-40">FECHA</th>
                        <th className="px-3 py-2 text-left font-normal text-gray-700 w-36">USUARIO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archivosAdjuntos.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                            Sin archivos adjuntos. Genere la Carta Oferta para agregar el primero.
                          </td>
                        </tr>
                      ) : (
                        [...archivosAdjuntos].reverse().map((a, i) => (
                          <tr key={a.id} className="border-b border-gray-200" style={{ backgroundColor: i % 2 === 1 ? '#F9F9F9' : '#FFFFFF' }}>
                            <td className="px-3 py-2">
                              <a
                                href="#"
                                className="text-[#0066CC] hover:underline"
                                onClick={e => { e.preventDefault(); setCartaEnVisor({ url: a.url, nombre: a.nombre }); }}
                              >
                                Ver
                              </a>
                            </td>
                            <td className="px-3 py-2 text-gray-700 font-mono text-[10px] break-all">{a.nombre}</td>
                            <td className="px-3 py-2">
                              <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px]">{a.tipo}</span>
                            </td>
                            <td className="px-3 py-2 text-gray-600 text-[10px]">{a.plantilla || '—'}</td>
                            <td className="px-3 py-2 text-gray-700 text-right font-mono">{a.tamanoKB} KB</td>
                            <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{new Date(a.fecha).toLocaleString('es-MX')}</td>
                            <td className="px-3 py-2 text-gray-700">
                              {a.usuario}
                              {!a.enStorage && (
                                <span className="ml-1 text-[9px] text-amber-600" title="No se subió a Storage; se pierde al recargar">⚠ local</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ TAB SOLICITUDES (j_corp_fin) — CA-02 ═══════════ */}
          {activeTab === 'solicitudes' && (
            <div>
              {seccion('Solicitudes Corporativas (j_corp_fin)')}

              <div className="p-4">
                {/* Barra de acciones */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] text-gray-500">
                    {cargandoCorpFin
                      ? 'Consultando…'
                      : `${solicitudesCorpFin.length} solicitud${solicitudesCorpFin.length === 1 ? '' : 'es'} asociada${solicitudesCorpFin.length === 1 ? '' : 's'}`}
                  </span>
                  {!isView && (
                    <button
                      onClick={handleNuevaSolicitud}
                      className="px-4 py-1.5 bg-[#0099CC] text-white rounded text-xs hover:bg-[#0088BB] font-medium"
                    >
                      + Nueva Solicitud
                    </button>
                  )}
                </div>

                {errorCorpFin && (
                  <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">
                    No se pudo consultar j_corp_fin: {errorCorpFin}
                  </div>
                )}

                {!form.id && (
                  <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                    Guarde la Oportunidad para poder registrar solicitudes corporativas.
                  </div>
                )}

                <div className="border border-gray-300 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-300">
                        {!isView && <th className="px-3 py-2 text-left font-normal text-gray-700 w-28">Editar | Borrar</th>}
                        <th className="px-3 py-2 text-left font-normal text-gray-700">FOLIO</th>
                        <th className="px-3 py-2 text-left font-normal text-gray-700">TIPO</th>
                        <th className="px-3 py-2 text-right font-normal text-gray-700">MONTO</th>
                        <th className="px-3 py-2 text-center font-normal text-gray-700">ESTATUS</th>
                        <th className="px-3 py-2 text-left font-normal text-gray-700">FECHA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {solicitudesCorpFin.length === 0 ? (
                        <tr>
                          <td colSpan={isView ? 5 : 6} className="px-3 py-8 text-center text-gray-400">
                            {cargandoCorpFin ? 'Cargando…' : 'Sin solicitudes corporativas asociadas.'}
                          </td>
                        </tr>
                      ) : solicitudesCorpFin.map((sol, i) => (
                        <tr
                          key={sol.id}
                          className="border-b border-gray-200"
                          style={{ backgroundColor: i % 2 === 1 ? '#F9F9F9' : '#FFFFFF' }}
                          onDoubleClick={() => handleEditarSolicitud(sol)}
                        >
                          {!isView && (
                            <td className="px-3 py-2 whitespace-nowrap">
                              <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); handleEditarSolicitud(sol); }}>Editar</a>
                              <span className="text-gray-700"> | </span>
                              <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); handleEliminarSolicitud(sol); }}>Borrar</a>
                            </td>
                          )}
                          <td className="px-3 py-2 text-gray-700 font-mono">{sol.folio || '—'}</td>
                          <td className="px-3 py-2 text-gray-700">{sol.type || '—'}</td>
                          <td className="px-3 py-2 text-gray-700 text-right font-mono">{formatMoney(sol.monto)}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                              sol.estatus === 'Aprobada' ? 'bg-green-100 text-green-800'
                              : sol.estatus === 'Rechazada' || sol.estatus === 'Cancelada' ? 'bg-red-100 text-red-800'
                              : sol.estatus === 'En Análisis' ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {sol.estatus || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-700">{sol.fechaSolicitud || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* HU-CRM-10 CA-05 — visor del PDF generado */}
      {cartaEnVisor && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setCartaEnVisor(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative bg-white rounded-lg shadow-2xl w-[92vw] h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="modal-header-theme px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold tracking-wide uppercase truncate">{cartaEnVisor.nombre}</span>
              <div className="flex items-center gap-2">
                <a
                  href={cartaEnVisor.url}
                  download={cartaEnVisor.nombre}
                  className="px-3 py-1 rounded text-xs bg-white/20 text-white hover:bg-white/30"
                >
                  Descargar
                </a>
                <button
                  onClick={() => setCartaEnVisor(null)}
                  className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <iframe src={cartaEnVisor.url} title={cartaEnVisor.nombre} className="flex-1 w-full border-0" />
          </div>
        </div>
      )}

      {showCorpFinModal && (
        <CorpFinModal
          item={corpFinEdit}
          monedaDefault={data.monedaInversion || data.moneda || 'MXN'}
          onSave={handleGuardarSolicitud}
          onClose={() => setShowCorpFinModal(false)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Modal de alta/edición de solicitud corporativa
// ═══════════════════════════════════════════════════════════════
interface CorpFinModalProps {
  item?: SolicitudCorpFin;
  monedaDefault: string;
  onSave: (payload: any) => void;
  onClose: () => void;
}

function CorpFinModal({ item, monedaDefault, onSave, onClose }: CorpFinModalProps) {
  const [f, setF] = useState({
    folio: item?.folio || '',
    type: item?.type || '',
    estatus: item?.estatus || 'Pendiente',
    monto: item ? String(item.monto) : '',
    moneda: item?.moneda || monedaDefault,
    fecha_solicitud: item?.fechaSolicitud || new Date().toISOString().slice(0, 10),
  });

  const set = (k: string, v: string) => setF(prev => ({ ...prev, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.type) {
      toast.error('Campo requerido', { description: 'Seleccione el tipo de solicitud.' });
      return;
    }
    const montoNum = parseFloat(f.monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      toast.error('Monto inválido', { description: 'El monto debe ser mayor a cero.' });
      return;
    }
    onSave({ ...f, monto: montoNum.toFixed(2) });
  };

  const inputCls = 'w-full px-2.5 py-1.5 text-xs rounded border border-gray-300 bg-white focus:border-blue-500 focus:ring-1 ring-blue-500 outline-none';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="modal-header-theme px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-wide uppercase">
            {item ? 'Editar Solicitud Corporativa' : 'Nueva Solicitud Corporativa'}
          </span>
          <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18" /><path d="M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={submit} className="p-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1.5">Tipo <span className="text-red-500">*</span></label>
              <select value={f.type} onChange={e => set('type', e.target.value)} className={inputCls}>
                <option value="">— Seleccionar —</option>
                {CAT_TIPO_CORP_FIN.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1.5">Monto <span className="text-red-500">*</span></label>
              <input
                type="text"
                inputMode="decimal"
                value={f.monto}
                onChange={e => { const c = limpiarDecimal(e.target.value); if (c !== null) set('monto', c); }}
                className={`${inputCls} text-right font-mono`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1.5">Moneda</label>
              <select value={f.moneda} onChange={e => set('moneda', e.target.value)} className={inputCls}>
                <option value="MXN">MXN</option><option value="USD">USD</option><option value="EUR">EUR</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1.5">Estatus</label>
              <select value={f.estatus} onChange={e => set('estatus', e.target.value)} className={inputCls}>
                {CAT_ESTATUS_CORP_FIN.map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1.5">Fecha Solicitud</label>
              <input type="date" value={f.fecha_solicitud} onChange={e => set('fecha_solicitud', e.target.value)} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-semibold text-gray-600 uppercase mb-1.5">Folio</label>
              <input
                type="text"
                value={f.folio}
                onChange={e => set('folio', e.target.value)}
                placeholder="Se genera automáticamente (CF-000001)"
                className={`${inputCls} font-mono`}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-200">
            <button type="button" onClick={onClose} className="px-4 py-1.5 rounded text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-100">Cancelar</button>
            <button type="submit" className="px-5 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium">
              {item ? 'Guardar Cambios' : 'Agregar Solicitud'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
