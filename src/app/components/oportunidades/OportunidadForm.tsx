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
import { useState, useMemo, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { CotizacionCredito, BitacoraEstatusOportunidad, ArchivoAdjuntoOportunidad, SolicitudLOSRef, BitacoraCierreComercial } from '../cotizaciones/cotizacionCreditoTypes';
import { generarCartaOferta, subirCartaOferta, CartaOfertaError, subirDocumentoAceptacion, esPDFValido, DocumentoAceptacionError } from './cartaOfertaPDF';
import { CAT_ESTATUS_OPORTUNIDAD, CAT_ESTATUS_OPORTUNIDAD_CIERRE, ESTATUS_OPORTUNIDAD_GANADA, ESTATUS_OPORTUNIDAD_PERDIDA } from '../cotizaciones/cotizacionCreditoTypes';
import { currentUser } from '../../data/mockData';
import { useProductosLineaCreditoDB } from '../../hooks/useProductosLineaCreditoDB';
import { useCorpFinDB, type SolicitudCorpFin } from '../../hooks/useCorpFinDB';
import { useClientesDB } from '../../hooks/useClientesDB';
import { useSolicitudesDB, fetchNextNoSol } from '../../hooks/useSolicitudesDB';
import { EMPTY_FORM as EMPTY_FORM_LOS, getFechaSolicitudNow, CAT_FASES } from '../solicitudes/solicitudCreditoStore';
import type { SolicitudFormData, TerminosCondiciones as TerminosCondicionesLOS } from '../solicitudes/solicitudCreditoStore';
import { syncToJClientes } from '../../hooks/useSyncJClientes';
import { SeleccionarClienteModal } from '../solicitudes/SeleccionarClienteModal';

type FormMode = 'create' | 'edit' | 'view';
type TabId = 'default' | 'solicitudes' | 'adjuntos' | 'cierre';

interface Props {
  mode: FormMode;
  oportunidad?: CotizacionCredito;
  onSave: (o: CotizacionCredito) => void;
  onBack: () => void;
  existeEnBD?: boolean;
  /** Navega al módulo LOS abriendo directamente la Solicitud generada por el Cierre Comercial. */
  onNavigateToSolicitud?: (
    solicitudId: string,
    noSol: string,
    fromClienteId?: string,
    opts?: { mode?: 'ver' | 'editar'; volverAOportunidadId?: string },
  ) => void;
  /**
   * "+ Nueva Solicitud" del tab Solicitudes — mismo patrón que Cotización →
   * Solicitud: navega al módulo de Solicitudes con un formulario nuevo ya
   * pre-llenado con los datos de la Oportunidad (el usuario lo revisa y guarda).
   */
  onCrearSolicitudDesdeOportunidad?: (data: any) => void;
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
const CAT_PERIODICIDAD_COMISION = ['Mensual', 'Trimestral', 'Semestral', 'Anual'];

/** Mismo catálogo del subtab Perfil de Prospecto (ProspectoForm.tsx) — se
 *  captura aquí solo cuando la Oportunidad se crea directa (sin Lead). */
const CAT_SECTOR_INFRAESTRUCTURA = [
  'Transporte/Carreteras',
  'Energía',
  'Agua/Medio Ambiente',
  'Social/Urbano',
];

/** Cierre Comercial — periodos por año para prorratear el ingreso anual estimado. */
const PERIODOS_POR_ANIO: Record<string, number> = { Mensual: 12, Trimestral: 4, Semestral: 2, Anual: 1 };

/**
 * Simulación de flujo de comisiones GPO para la pestaña "Simulación" de la
 * Solicitud LOS heredada. No es amortización de crédito: el Monto Garantizado
 * no se abona con cada pago, solo se cobra la comisión pactada por periodo.
 *
 * BUG FIX (2026-08-25): antes generaba plazoAnios × periodosPorAnio filas —
 * para un bono a 20 años cobrado mensualmente eso son 240 líneas. La spec
 * pide ver las comisiones A PAGAR DURANTE EL AÑO: Anual→1 línea,
 * Semestral→2, Trimestral→4, Mensual→12. También calculaba ivaInteres en 0
 * fijo; ahora se calcula con el % IVA del producto (16% si no está capturado).
 */
function construirSimulacionComisionGPO(
  montoGarantizado: number,
  ingresoPorPeriodo: number,
  periodosPorAnio: number,
  ivaPorcentaje: number,
): Array<Record<string, any>> {
  const totalPeriodos = Math.max(0, Math.round(periodosPorAnio || 0));
  if (totalPeriodos <= 0 || ingresoPorPeriodo <= 0) return [];

  const ivaPorPeriodo = ingresoPorPeriodo * ((ivaPorcentaje || 0) / 100);
  const mesesPorPeriodo = 12 / periodosPorAnio;
  const rows: Array<Record<string, any>> = [];
  let fecha = new Date();
  for (let i = 0; i < totalPeriodos; i++) {
    fecha = new Date(fecha.getFullYear(), fecha.getMonth() + mesesPorPeriodo, fecha.getDate());
    rows.push({
      noPago: i + 1,
      fechaPago: fecha.toISOString().split('T')[0],
      saldoInsoluto: montoGarantizado,
      pagoCapital: 0,
      pagoInteres: ingresoPorPeriodo,
      ivaInteres: ivaPorPeriodo,
      pagoPeriodo: ingresoPorPeriodo,
      pagoSeguro: 0,
      pagoTotal: ingresoPorPeriodo + ivaPorPeriodo,
      moneda: 'MXN',
    });
  }
  return rows;
}

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

export function OportunidadForm({ mode, oportunidad, onSave, onBack, existeEnBD, onNavigateToSolicitud, onCrearSolicitudDesdeOportunidad }: Props) {
  const [form, setForm] = useState<CotizacionCredito | undefined>(oportunidad);
  const [activeTab, setActiveTab] = useState<TabId>('default'); // CA-01

  // ══════════════════════════════════════════════════════════════
  // BUG FIX — `form` no se refrescaba tras el primer Guardar.
  //
  // `form` se siembra UNA SOLA VEZ desde el prop `oportunidad` (useState
  // solo usa el valor inicial). Al guardar por primera vez, el padre
  // (OportunidadesModule) hace INSERT, obtiene el id real de la BD y
  // reemplaza `oportunidad` — pero React NO vuelve a inicializar el
  // estado de un componente ya montado, así que `form.id` seguía vacío
  // en memoria aunque el badge "Guardada en BD" (prop `existeEnBD`,
  // calculado aparte en el padre) ya mostrara verde.
  //
  // Efecto: cualquier acción atada a `form.id` — "+ Nueva Solicitud" y
  // la consulta a J_CORP_FIN (useCorpFinDB más abajo) — se quedaba
  // bloqueada o vacía hasta recargar la página.
  //
  // Fix mínimo: si el prop trae id y el estado local todavía no, adoptar
  // el prop completo. `oportunidad` en ese momento es exactamente el
  // `form` que se acaba de guardar más el id — no se pierde ninguna
  // captura del usuario.
  // ══════════════════════════════════════════════════════════════
  useEffect(() => {
    if (oportunidad?.id && (!form || !form.id)) {
      setForm(oportunidad);
    }
  }, [oportunidad?.id]);

  // ── Cierre Comercial — Read-Only Hard Lock tras Cerrada-Ganada ──
  // Congela el formulario aunque mode='edit': ningún campo (ni siquiera
  // Estatus) puede volver a tocarse una vez ganada la Oportunidad.
  const congelado = !!(form?.data as any)?.congelado;
  const isView = mode === 'view' || congelado;

  // ── HU-CRM-06 — Catálogo de productos de Línea de Crédito ──
  // Los hooks van ANTES de cualquier return temprano (Rules of Hooks).
  const { productos } = useProductosLineaCreditoDB(true);

  // ── Cierre Comercial — RFC del emisor (para el payload a Originación) ──
  const { clientes } = useClientesDB(true);
  // ── Cierre Comercial — creación real de la Solicitud en el módulo LOS ──
  // También se usa la lista para ubicar la Solicitud vinculada cuando se creó
  // navegando (Nueva Solicitud) en vez del POST silencioso de Cerrada-Ganada,
  // caso en el que nadie "avisa" de vuelta a la Oportunidad.
  const {
    saveSolicitud,
    solicitudes: solicitudesLOSTodas,
    loading: cargandoSolicitudesLOS,
    error: errorSolicitudesLOS,
  } = useSolicitudesDB(true);
  const [subiendoAceptacion, setSubiendoAceptacion] = useState(false);
  const [cerrando, setCerrando] = useState<'ganada' | 'perdida' | null>(null);
  /** Solo se ofrece cuando la Oportunidad se crea sin Lead — con Lead, RN-01
   *  exige mantener Cliente Emisor/Sector como heredados, no editables. */
  const [showClienteModal, setShowClienteModal] = useState(false);

  const productoSel = useMemo(
    () => productos.find(p => String(p.dbUuid || p.id) === String(form?.producto_id)),
    [productos, form?.producto_id],
  );

  // ── Cierre Comercial — RFC del emisor, no vive en la Oportunidad; se
  // resuelve del expediente del cliente ligado (payload lo exige). ──
  const clienteMatch = useMemo(
    () => clientes.find(c => String(c.dbUuid) === String(form?.cliente_id)),
    [clientes, form?.cliente_id],
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

  /**
   * Selector de archivo único para la Carta Oferta FIRMADA. Vive fuera de las
   * pestañas para poder dispararse desde donde el usuario esté: el visor de
   * PDF, la pestaña Archivos Adjuntos o Cierre Comercial. El flujo real es
   * Descargar → firmar → volver a subir; el navegador no permite recuperar
   * las anotaciones que se dibujan en su propio visor de PDF.
   */
  const inputFirmadaRef = useRef<HTMLInputElement>(null);
  const abrirSelectorFirmada = () => inputFirmadaRef.current?.click();

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

  /**
   * RN-01 exige Cliente Emisor/Sector heredados y de solo lectura cuando la
   * Oportunidad viene de un Lead calificado. Pero una Oportunidad dada de
   * alta directa (botón "Nuevo" del módulo, sin pasar por Prospecto) nunca
   * tiene leadOrigenId — y sin él, esos campos se quedaban vacíos para
   * siempre (de solo lectura, sin ningún flujo que los llenara), bloqueando
   * el Cierre Comercial de raíz. Aquí sí se permite capturarlos a mano.
   */
  const esDirecta = !data.leadOrigenId;

  /** Renglones de la Matriz Tasa Fija del producto (CA-02). */
  const matrizProducto: any[] = Array.isArray(productoSel?.matrizTasaFija) ? productoSel!.matrizTasaFija as any[] : [];
  const matrizSel = matrizProducto.find(m => String(m.id) === String(data.matrizTasaFijaSeleccionId));

  /**
   * Pickmap Producto → Plazo(s) disponibles.
   *
   * Los plazos NO son un catálogo aparte: son los que declara la Matriz de
   * Tasa Fija del producto seleccionado. Se listan sólo esos (regla 6/7: sin
   * catálogos duplicados ni captura manual). Se leen de plazoDefault y, si la
   * fila no lo trae, del extremo del rango.
   */
  const plazosProducto: string[] = (() => {
    const vistos: string[] = [];
    for (const m of matrizProducto) {
      const p = String((m as any)?.plazoDefault ?? (m as any)?.plazoMaximo ?? (m as any)?.plazoMinimo ?? '').trim();
      if (p && p !== '0' && !vistos.includes(p)) vistos.push(p);
    }
    // Orden numérico — el objeto de la matriz no garantiza ningún orden.
    return vistos.sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0));
  })();

  /** Plazos marcados en la Oportunidad (selección múltiple). */
  const plazosSeleccionados: string[] = Array.isArray(data.plazosProducto)
    ? (data.plazosProducto as any[]).map(String)
    : [];

  const togglePlazoProducto = (plazo: string) => {
    const next = plazosSeleccionados.includes(plazo)
      ? plazosSeleccionados.filter(p => p !== plazo)
      : [...plazosSeleccionados, plazo].sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0));
    setData({ plazosProducto: next });
  };

  /** Renglones de "Cobertura y Comisiones 2o Piso" del producto (CA-05, REQ-8). */
  const coberturasProducto: any[] = Array.isArray(productoSel?.cobertura2oPiso) ? productoSel!.cobertura2oPiso as any[] : [];

  /** % IVA aplicable a la comisión GPO — del subtab IVA del producto; 16% si no está capturado. */
  const ivaGPOPorcentaje = Array.isArray(productoSel?.ivaPorcentaje) && (productoSel!.ivaPorcentaje as any[]).length > 0
    ? (toNum((productoSel!.ivaPorcentaje as any[])[0]?.porcentaje) || 16)
    : 16;

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

  // ══════════════════════════════════════════════════════════════
  // Cierre de Venta Comercial — puente CRM → Originación (LOS)
  // ══════════════════════════════════════════════════════════════
  const periodosPorAnio = PERIODOS_POR_ANIO[data.periodicidadCobroComision || ''] || 0;
  /** Campo calculado — Ingreso_Comision_Anual_Estimado ÷ periodos_por_año. */
  const ingresoComisionPorPeriodo = periodosPorAnio > 0 ? ingresoAnualComisiones / periodosPorAnio : 0;

  const documentoAceptacion: ArchivoAdjuntoOportunidad | undefined = data.documentoAceptacion;
  // La referencia guardada en la Oportunidad (la escribe Cerrada-Ganada al crear
  // en silencio) es la fuente principal; si no existe, se busca en la lista real
  // de Solicitudes por no_referenc1 === folio — cubre "+ Nueva Solicitud", que
  // navega a otro módulo y el usuario guarda allá, sin volver a tocar la Oportunidad.
  const solicitudLOSDesdeLista = solicitudesLOSTodas.find(
    s => !!(s as any)._noReferenc1 && (s as any)._noReferenc1 === form.no_cotiza,
  );
  const solicitudLOSRef: SolicitudLOSRef | undefined = data.solicitudLOS || (solicitudLOSDesdeLista ? {
    id: String((solicitudLOSDesdeLista as any)._dbId || solicitudLOSDesdeLista.id),
    noSol: solicitudLOSDesdeLista.noSol,
    fecha: (solicitudLOSDesdeLista as any)._fechaInicio || new Date().toISOString(),
  } : undefined);
  // Tabla del tab Solicitudes: TODAS las Solicitudes reales de
  // J_CUENTAS_CORP_CLIENTES ligadas a esta Oportunidad. El vínculo es
  // no_referenc1 === folio de la Oportunidad (lo escriben tanto
  // "+ Nueva Solicitud" como el POST de Cerrada-Ganada). Se suma la referencia
  // guardada en la propia Oportunidad (data.solicitudLOS) por si el filtro por
  // folio no la alcanza — así el folio de la tarjeta LOS de arriba siempre
  // aparece también en la tabla de abajo.
  const solicitudesDeLaOportunidad = (() => {
    const ligadas = solicitudesLOSTodas.filter(
      s => !!(s as any)._noReferenc1 && (s as any)._noReferenc1 === form.no_cotiza,
    );
    const refGuardada = data.solicitudLOS as SolicitudLOSRef | undefined;
    if (refGuardada?.noSol && !ligadas.some(s => s.noSol === refGuardada.noSol)) {
      const desdeLista = solicitudesLOSTodas.find(
        s => s.noSol === refGuardada.noSol || String((s as any)._dbId) === String(refGuardada.id),
      );
      if (desdeLista) ligadas.push(desdeLista);
    }
    return ligadas;
  })();
  const bitacoraCierreComercial: BitacoraCierreComercial[] = Array.isArray(data.bitacoraCierreComercial)
    ? data.bitacoraCierreComercial
    : [];
  const rfcEmisor = clienteMatch?.rfc || '';

  const isTerminal = form.estatus_cotiza === ESTATUS_OPORTUNIDAD_GANADA || form.estatus_cotiza === ESTATUS_OPORTUNIDAD_PERDIDA;
  /** Perdida no congela el resto del formulario, pero sí bloquea reintentar el Cierre Comercial. */
  const cierreLocked = isView || isTerminal;

  /**
   * Candado de evidencia — el Cierre Comercial exige la Carta Oferta firmada.
   * Ya NO deshabilita el botón (quedaba muerto y sin explicación); se usa para
   * avisar en pantalla qué falta, y handleCerrarGanada lo vuelve a validar.
   */
  const faltaEvidenciaCierre = !documentoAceptacion;

  /** Valida el payload antes de disparar el gatillo — no se ejecuta con campos obligatorios nulos. */
  const faltantesCierreComercial = (): string[] => {
    const f: string[] = [];
    if (!documentoAceptacion) f.push('Carta Oferta firmada por el cliente');
    if (!form.cliente_id) f.push('Cliente Emisor');
    if (!data.cliente?.nombreCompleto) f.push('Nombre del Emisor');
    if (!rfcEmisor) f.push('RFC del Emisor (no encontrado en el expediente del cliente)');
    if (!data.sectorInfraestructura) f.push('Sector de Infraestructura');
    if (montoEmision <= 0) f.push('Monto Emisión');
    if (pctCobertura <= 0) f.push('% Cobertura GPO');
    if (pctComision <= 0) f.push('Tasa Comisión Anual Pactada');
    if (!data.periodicidadCobroComision) f.push('Periodicidad de Cobro');
    return f;
  };

  const handleCargarDocumentoAceptacion = async (file: File) => {
    if (!esPDFValido(file)) {
      toast.error('Archivo inválido', { description: 'Solo se acepta un archivo PDF para la Carta Oferta firmada.' });
      return;
    }
    setSubiendoAceptacion(true);
    try {
      const subida = await subirDocumentoAceptacion(file, form.id || form.no_cotiza);
      const adjunto: ArchivoAdjuntoOportunidad = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nombre: file.name,
        tipo: 'Carta Oferta Firmada',
        url: subida.url,
        storagePath: subida.storagePath,
        tamanoKB: subida.tamanoKB,
        fecha: new Date().toISOString(),
        usuario: currentUser.name,
        enStorage: subida.enStorage,
      };
      // BUG FIX (2026-08-25): esta era evidencia crítica — desbloquea
      // Cerrada-Ganada — y solo quedaba en estado local hasta un "Guardar"
      // manual. Se persiste de inmediato para no perder la carga si el
      // usuario navega o recarga antes de guardar.
      //
      // Se guarda en dos lugares a propósito: en documentoAceptacion (es el
      // candado del Cierre Comercial) y en archivosAdjuntos (para que el
      // ejecutivo la vea junto a la carta original en su pestaña). Si se
      // reemplaza por una nueva versión firmada, se sustituye la anterior en
      // la lista en vez de acumular copias.
      const adjuntosSinFirmaPrevia = archivosAdjuntos.filter(
        a => a.id !== documentoAceptacion?.id,
      );
      const actualizado: CotizacionCredito = {
        ...form,
        data: {
          ...data,
          documentoAceptacion: adjunto,
          archivosAdjuntos: [...adjuntosSinFirmaPrevia, adjunto],
        },
      };
      setForm(actualizado);
      onSave(actualizado);
      if (subida.enStorage) {
        toast.success('Carta Oferta firmada cargada y guardada', { description: 'Ya puede cerrar la Oportunidad como Ganada.' });
      } else {
        toast.warning('Documento cargado, pero no se subió a Storage', {
          description: 'Queda disponible en esta sesión. Revise permisos del bucket.',
        });
      }
    } catch (err) {
      if (err instanceof DocumentoAceptacionError) {
        toast.error('Archivo inválido', { description: err.message });
      } else {
        toast.error('No se pudo cargar el documento', { description: err instanceof Error ? err.message : 'Error desconocido' });
      }
    } finally {
      setSubiendoAceptacion(false);
    }
  };

  /** [Cerrada-Perdida] — siempre habilitado; cambia estatus y registra motivo. No congela el formulario. */
  const handleCerrarPerdida = () => {
    if (isTerminal) return;
    const motivo = window.prompt('Motivo de la pérdida de la Oportunidad:');
    if (motivo === null) return;
    if (!motivo.trim()) {
      toast.error('Debe capturar un motivo para marcar la Oportunidad como Perdida.');
      return;
    }

    const entradaEstatus: BitacoraEstatusOportunidad = {
      fecha: new Date().toISOString(),
      usuario: currentUser.name,
      estatusAnterior: form.estatus_cotiza || '',
      estatusNuevo: ESTATUS_OPORTUNIDAD_PERDIDA,
    };
    const entradaCierre: BitacoraCierreComercial = {
      fecha: new Date().toISOString(),
      usuario: currentUser.name,
      folioCRM: form.no_cotiza,
      resultado: 'Perdida',
      motivo: motivo.trim(),
    };

    const actualizado: CotizacionCredito = {
      ...form,
      estatus_cotiza: ESTATUS_OPORTUNIDAD_PERDIDA,
      data: {
        ...data,
        motivoPerdida: motivo.trim(),
        bitacoraEstatus: [...bitacoraEstatus, entradaEstatus],
        bitacoraCierreComercial: [...bitacoraCierreComercial, entradaCierre],
      },
    };
    setForm(actualizado);
    onSave(actualizado);
    toast.success('Oportunidad marcada como Perdida');
  };

  /**
   * [Cerrada-Ganada] — solo si hay evidencia cargada. Cambia estatus, congela
   * la Oportunidad (Read-Only Hard Lock) y crea la Solicitud en Originación
   * (mismo patrón que Cotización → Solicitud: se hereda del registro padre).
   * Si el POST falla, no se toca nada — ni estatus ni congelamiento — así
   * que "revertir" es simplemente no haber aplicado el cambio.
   */
  const handleCerrarGanada = async () => {
    if (isTerminal || cerrando) return;

    // Idempotencia — ya existe una Solicitud LOS vinculada a este folio.
    if (solicitudLOSRef?.id) {
      toast.error('Ya existe una Solicitud LOS vinculada a esta Oportunidad', {
        description: `Folio LOS: ${solicitudLOSRef.noSol}`,
      });
      return;
    }

    const faltan = faltantesCierreComercial();
    if (faltan.length > 0) {
      toast.error('Faltan datos obligatorios para el Cierre Comercial', { description: faltan.join(', ') });
      return;
    }

    setCerrando('ganada');
    try {
      const noSol = await fetchNextNoSol();
      const nombreProducto = data.producto?.nombreProducto || '';
      const tipoProducto = data.producto?.tipoProducto || 'Garantía Financiera 2o Piso';
      const montoStr = montoEmision.toFixed(2);

      // FORMULARIO GENERAL — folio_crm, id_cliente_crm, rfc_emisor, nombre_emisor.
      const formLOS: SolicitudFormData = {
        ...EMPTY_FORM_LOS,
        id: '',
        noSol,
        cotizacionId: form.no_cotiza, // folio_crm — referencia cruzada al CRM (cabe en no_referenc1, ≤30 chars)
        lineaProducto: 'Línea de Crédito',
        tipoProducto,
        tipoPersona: 'Moral',
        noCliente: data.cliente?.claveCliente || '',
        nombrePersona: data.cliente?.nombreCompleto || '',
        apellidoPaternoPersona: '',
        apellidoMaternoPersona: '',
        productoId: form.producto_id || '',
        nombreProducto,
        fechaSolicitud: getFechaSolicitudNow(),
        descripcion: `Solicitud generada automáticamente desde Cierre Comercial — Oportunidad ${form.no_cotiza}`,
        faseId: CAT_FASES[0].faseId,
        descripcionFase: CAT_FASES[0].descripcion,
        area: 'INTEGRACIÓN',
        promptIAFase: '',
        // BUG FIX (2026-08-25): nacía como 'Pendiente', pero la Lista de
        // Originación filtra explícitamente `estatusSolicitud !== 'Pendiente'`
        // (OriginacionModule.tsx) — es decir, la Solicitud que este Cierre
        // Comercial acaba de crear NUNCA aparecía en Originación. 'En proceso'
        // es el mismo estatus que aplica "Enviar de Fase" al mover una
        // Solicitud hacia adelante, y es el correcto aquí: una Oportunidad
        // Ganada ya no es un borrador pendiente de captura.
        estatusSolicitud: 'En proceso',
        montoSolicitado: montoStr,
        montoAutorizado: montoStr,
        fechaInicio: '',
        fechaFin: '',
        _clienteId: form.cliente_id || '',
        _rfc: rfcEmisor, // rfc_emisor
      };

      // TÉRMINOS Y CONDICIONES — campos GPO (Línea de Crédito / Garantía Financiera 2o Piso).
      const terminosLOS: Partial<TerminosCondicionesLOS> = {
        montoSolicitado: montoStr,
        montoAutorizado: montoStr,
        moneda: data.monedaInversion || data.moneda || 'MXN',
        sectorInfraestructura: data.sectorInfraestructura || '',
        montoEmisionProyectado: montoStr,
        porcentajeCoberturaGpo: String(pctCobertura),
        montoGarantizadoGpo: montoGarantizado.toFixed(2),
        tasaComisionAnualPactada: String(pctComision),
        periodicidadCobroGpo: data.periodicidadCobroComision || '',
        // Plazo(s) elegidos en Estructura Bursátil — quedan disponibles en la
        // Solicitud para su mapeo (§4). No sustituyen al Plazo del producto.
        plazosProducto: plazosSeleccionados,
        // REQ-10 — plazo de la EMISIÓN BURSÁTIL. Dimensiona la matriz de
        // proyecciones del Análisis de Grado de Riesgo. Es un concepto distinto
        // de `plazo` (duración del financiamiento) y de la periodicidad de
        // comisión; sin mapearlo, la Solicitud no sabe cuántos años proyectar.
        plazoBonosAnios: data.plazoBonosAnios || '',
        // BUG FIX: la Solicitud nacía SIN `frecuencia` — solo con
        // periodicidadCobroGpo, que en Términos y Condiciones se pinta
        // deshabilitado. El select de Frecuencia quedaba en "" y el
        // navegador mostraba la primera opción del catálogo (Semanal),
        // aparentando un valor que no existía; y como la cotización cae a
        // periodicidadCobroGpo cuando no hay Frecuencia, siempre "se
        // quedaba con la de la Oportunidad". Sembrarla deja el campo
        // editable con el valor heredado y permite cambiarlo de verdad.
        frecuencia: data.periodicidadCobroComision || '',
      };

      // Pestaña Simulación — flujo de comisiones proyectado (no es amortización de crédito).
      const simulacionGPO = construirSimulacionComisionGPO(
        montoGarantizado,
        ingresoComisionPorPeriodo,
        periodosPorAnio,
        ivaGPOPorcentaje,
      );

      const result = await saveSolicitud(formLOS, undefined, { terminos: terminosLOS, simulacion: simulacionGPO });
      if (!result.ok || !result.id) {
        throw new Error(result.error || 'El módulo de Originación rechazó la solicitud.');
      }

      // ── Conversión Prospecto → Cliente ──
      // Cambio de diseño (2026-08-25): el Lead ya no se convierte a Cliente
      // al Calificar (ver ProspectoForm.tsx handleCalificarLead) — ocurre
      // AQUÍ, al cerrar la Oportunidad como Ganada. Mismo patrón que
      // "Activar Prospecto" (mover type 'Prospecto' → 'Clientes' sobre la
      // misma fila de J_CLIENTES), pero SIN las validaciones de KYC
      // individual (CURP, fecha nacimiento, sexo, SIC/Listas Negras =
      // NEGATIVO) que exige activarProspecto — no aplican a una Persona
      // Moral. Si la Oportunidad no vino de un Lead (alta manual, sin
      // cliente_id/leadOrigenId), no hay nada que convertir y se omite.
      const idClienteACerrar = form.cliente_id || data.leadOrigenId || '';
      if (idClienteACerrar) {
        try {
          await syncToJClientes({
            type: 'Clientes',
            tipoFormulario: '', // '' → subtipo no se toca (COALESCE conserva el capturado en el Lead)
            estatus: 'Activo',
            data: { estatusProspecto: 'Cliente' },
            label: 'Cliente activado desde Cierre Comercial',
            existingId: idClienteACerrar,
          });
        } catch (errCliente) {
          // No abortar el cierre por esto: la Solicitud LOS ya se creó y es
          // el efecto de negocio principal. Si la conversión falla, queda
          // rastro en consola para revisar manualmente el registro en
          // J_CLIENTES; el usuario no debe perder el cierre ya logrado.
          console.error('[OportunidadForm] Cerrada-Ganada: no se pudo convertir el Prospecto a Cliente:', errCliente);
          toast.warning('Oportunidad Ganada, pero no se pudo activar el Cliente', {
            description: 'Revise el registro del Prospecto manualmente.',
          });
        }
      }

      const solicitudRef: SolicitudLOSRef = { id: result.id, noSol, fecha: new Date().toISOString() };
      const entradaEstatus: BitacoraEstatusOportunidad = {
        fecha: new Date().toISOString(),
        usuario: currentUser.name,
        estatusAnterior: form.estatus_cotiza || '',
        estatusNuevo: ESTATUS_OPORTUNIDAD_GANADA,
      };
      const entradaCierre: BitacoraCierreComercial = {
        fecha: new Date().toISOString(),
        usuario: currentUser.name,
        folioCRM: form.no_cotiza,
        resultado: 'Ganada',
        idSolicitudLOS: result.id,
      };

      const actualizado: CotizacionCredito = {
        ...form,
        estatus_cotiza: ESTATUS_OPORTUNIDAD_GANADA,
        data: {
          ...data,
          congelado: true,
          solicitudLOS: solicitudRef,
          bitacoraEstatus: [...bitacoraEstatus, entradaEstatus],
          bitacoraCierreComercial: [...bitacoraCierreComercial, entradaCierre],
        },
      };
      setForm(actualizado);
      onSave(actualizado);
      toast.success('Oportunidad Ganada — Solicitud creada en Originación', { description: `Folio LOS: ${noSol}` });
    } catch (err) {
      console.error('[OportunidadForm] Cierre Comercial — POST a Originación falló:', err);
      toast.error('No se pudo crear la solicitud en Originación. Intente nuevamente.');
    } finally {
      setCerrando(null);
    }
  };

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
    ? 'w-full px-2 py-1 text-xs bg-gray-50 border border-gray-200 rounded text-gray-700'
    : 'w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  const readonlyClass = 'w-full px-2 py-1 text-xs bg-gray-100 border border-gray-200 rounded text-gray-500';

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
  /**
   * "+ Nueva Solicitud" — mismo patrón que Cotización → Solicitud: navega al
   * módulo de Solicitudes con un formulario nuevo pre-llenado con los datos
   * de la Oportunidad; el usuario lo revisa y lo guarda él mismo (no es un
   * POST silencioso — eso ya lo cubre Cerrada-Ganada en Cierre Comercial).
   */
  const handleNuevaSolicitud = () => {
    if (!form.id) {
      toast.error('Guarde la Oportunidad primero', {
        description: 'La Solicitud se liga al folio de la Oportunidad.',
      });
      return;
    }
    if (!onCrearSolicitudDesdeOportunidad) {
      // Respaldo si el padre no wireó el bridge — conserva la captura manual.
      setCorpFinEdit(undefined);
      setShowCorpFinModal(true);
      return;
    }

    const montoStr = montoEmision > 0 ? montoEmision.toFixed(2) : '';
    // Pestaña Simulación — mismo flujo de comisiones proyectado que arma Cerrada-Ganada.
    const simulacionGPO = construirSimulacionComisionGPO(
      montoGarantizado,
      ingresoComisionPorPeriodo,
      periodosPorAnio,
      ivaGPOPorcentaje,
    );
    // El formulario de Solicitud exige apellidoPaternoPersona no vacío para validar
    // (aunque el emisor sea persona Moral) — mismo split crudo que ya usa Cotización → Solicitud.
    const nombreCompletoEmisor = data.cliente?.nombreCompleto || '';
    const nameParts = nombreCompletoEmisor.split(' ').filter(Boolean);
    onCrearSolicitudDesdeOportunidad({
      cotizacionId: form.no_cotiza,
      lineaProducto: 'Línea de Crédito',
      // Mismo fallback que handleCerrarGanada — el producto GPO no siempre
      // trae su propio tipoProducto capturado; sin esto, SimulacionTab no
      // podía distinguir esta Solicitud de una Línea de Crédito genérica y
      // le pintaba columnas de amortización (Capital/Saldo Insoluto) en vez
      // de Comisión/IVA/Total.
      tipoProducto: data.producto?.tipoProducto || 'Garantía Financiera 2o Piso',
      tipoPersona: 'Moral',
      nombrePersona: nameParts[0] || nombreCompletoEmisor,
      apellidoPaternoPersona: nameParts[1] || nombreCompletoEmisor || 'N/A',
      apellidoMaternoPersona: nameParts.slice(2).join(' '),
      productoId: form.producto_id || '',
      nombreProducto: data.producto?.nombreProducto || '',
      montoSolicitado: montoStr,
      _clienteId: form.cliente_id || '',
      _rfc: rfcEmisor,
      // TÉRMINOS Y CONDICIONES + SIMULACIÓN — hereda los mismos campos GPO que Cerrada-Ganada.
      _terminosCondiciones: {
        montoSolicitado: montoStr,
        moneda: data.monedaInversion || data.moneda || 'MXN',
        sectorInfraestructura: data.sectorInfraestructura || '',
        montoEmisionProyectado: montoStr,
        porcentajeCoberturaGpo: String(pctCobertura),
        montoGarantizadoGpo: montoGarantizado.toFixed(2),
        tasaComisionAnualPactada: String(pctComision),
        periodicidadCobroGpo: data.periodicidadCobroComision || '',
        plazosProducto: plazosSeleccionados,
        plazoBonosAnios: data.plazoBonosAnios || '',
        // Misma semilla que el Cierre Comercial — ver comentario allá.
        frecuencia: data.periodicidadCobroComision || '',
        _simulacion: simulacionGPO,
      },
    });
    toast.success('Creando Solicitud desde Oportunidad', {
      description: `${form.no_cotiza} → Navegando al módulo Solicitudes.`,
      duration: 4000,
    });
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
  /** Paso 1 del flujo Generar → Firmar → Subir: ¿ya existe una carta que firmar? */
  const hayCartaGenerada = archivosAdjuntos.some(a => a.tipo === 'Carta Oferta');

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
      // BUG FIX (2026-08-25): antes solo se actualizaba el estado local y el
      // toast le pedía al usuario "Guarde para conservar el registro" — si no
      // volvía a picar Guardar, el adjunto se perdía y nunca aparecía en la
      // pestaña Archivos Adjuntos al recargar. Se persiste de inmediato,
      // mismo patrón que handleCerrarGanada/handleCerrarPerdida.
      const actualizado: CotizacionCredito = {
        ...form,
        data: { ...data, archivosAdjuntos: [...archivosAdjuntos, adjunto] },
      };
      setForm(actualizado);
      onSave(actualizado);

      // CA-05 — se despliega para revisión
      setCartaEnVisor({ url: generada.dataUri, nombre: generada.nombreArchivo });

      if (subida.enStorage) {
        toast.success('Carta Oferta generada', { description: 'Se adjuntó a la Oportunidad y se guardó en la pestaña Archivos Adjuntos.' });
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

    // BUG FIX (2026-08-25): antes solo se actualizaba el estado local — si el
    // usuario no volvía a picar "Guardar" manualmente, el cambio de estatus
    // (y su entrada en la bitácora) nunca llegaba a J_COTIZACIONES. Mismo
    // patrón que ya usan handleCerrarGanada/handleCerrarPerdida: persistir
    // de inmediato en cuanto cambia el estatus.
    const actualizado: CotizacionCredito = {
      ...form,
      estatus_cotiza: nuevo,
      data: {
        ...data,
        bitacoraEstatus: [...bitacoraEstatus, entrada],
      },
    };
    setForm(actualizado);
    onSave(actualizado);
  };

  /** Encabezado de sección — mismo patrón que "Información Principal" en Alta Persona. */
  const seccion = (titulo: string) => (
    <div className="border-l-4 border-primary-theme px-3 py-1.5 border-t border-gray-300">
      <span className="text-xs font-medium text-gray-800 uppercase">{titulo}</span>
    </div>
  );

  const tabs: { id: TabId; label: string }[] = [
    { id: 'default', label: 'Default' },
    { id: 'adjuntos', label: `Archivos Adjuntos${archivosAdjuntos.length ? ` (${archivosAdjuntos.length})` : ''}` },
    { id: 'cierre', label: 'Cierre Comercial' },
    { id: 'solicitudes', label: 'Solicitudes' },
  ];

  return (
    <div className="bg-[#F5F5F5] min-h-screen">
      {/* ═══ Header — mismo patrón de 2 filas que Alta Persona ═══ */}
      <div className="bg-white px-4 py-2.5 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="stroke-accent-theme" strokeWidth="1.5">
              <path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" />
            </svg>
            <span className="text-sm text-gray-700 font-normal">
              {mode === 'create' ? 'Nueva Oportunidad' : mode === 'edit' ? 'Editar Oportunidad' : 'Consultar Oportunidad'}
            </span>
            {existeEnBD && (
              <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-green-50 text-green-700 border border-green-200">
                Guardada en BD
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Botones de acción ═══ */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-2">
          {!isView && (
            <button
              onClick={handleGuardar}
              disabled={!puedeGuardar}
              title={errorCobertura || errorComision || 'Guardar la Oportunidad'}
              className={`px-5 py-1.5 rounded text-xs font-normal transition-colors ${
                puedeGuardar
                  ? 'btn-secondary-theme'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Guardar
            </button>
          )}
          {!isView && (
            <button
              onClick={handleGenerarCartaOferta}
              disabled={generandoCarta}
              title="Genera la Carta Oferta en PDF con la plantilla del producto"
              className={`px-5 py-1.5 rounded text-xs font-normal transition-colors border ${
                generandoCarta
                  ? 'bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed'
                  : 'bg-white text-[#0099CC] border-[#0099CC] hover:bg-[#E8F6FB]'
              }`}
            >
              {generandoCarta ? 'Generando…' : 'Generar Carta Oferta'}
            </button>
          )}
          <button onClick={onBack} className="px-5 py-1.5 bg-white border border-gray-400 rounded text-xs hover:bg-gray-50 text-gray-700">
            {isView ? 'Volver' : 'Cancelar'}
          </button>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="bg-white border border-gray-300">
          {/* ═══ Campos heredados — CA-03 / RN-01: solo lectura SI viene de un Lead ═══ */}
          <div className="border-l-4 border-primary-theme px-3 py-1 flex items-baseline justify-between">
            <span className="text-xs font-medium text-gray-800 uppercase">Información Heredada</span>
            <span className="text-[9px] text-gray-400 italic">
              {esDirecta ? 'Alta directa — sin Lead de origen, capture Cliente y Sector' : 'Heredados del Lead, no se editan (RN-01)'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 p-3">
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-0.5">ID OPORTUNIDAD</label>
              <input value={form.no_cotiza || '—'} disabled className={readonlyClass} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-0.5">CLIENTE EMISOR</label>
              {esDirecta && !isView ? (
                <button
                  type="button"
                  onClick={() => setShowClienteModal(true)}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs border border-gray-300 rounded hover:border-primary-theme hover:bg-blue-50/30 transition-colors text-left"
                >
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="#9CA3AF" strokeWidth="1.5" className="shrink-0">
                    <circle cx="7" cy="5" r="2.5" /><path d="M2 13c0-3 2.2-5 5-5s5 2 5 5" />
                  </svg>
                  <span className={`flex-1 truncate ${data.cliente?.nombreCompleto ? 'text-gray-700' : 'text-gray-400'}`}>
                    {data.cliente?.nombreCompleto || 'Seleccionar cliente...'}
                  </span>
                </button>
              ) : (
                <input value={data.cliente?.nombreCompleto || '—'} disabled className={readonlyClass} />
              )}
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-0.5">SECTOR</label>
              {esDirecta && !isView ? (
                <select
                  value={data.sectorInfraestructura || ''}
                  onChange={e => setData({ sectorInfraestructura: e.target.value })}
                  className={fieldClass}
                >
                  <option value="">— Seleccionar sector —</option>
                  {CAT_SECTOR_INFRAESTRUCTURA.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input value={data.sectorInfraestructura || '—'} disabled className={readonlyClass} />
              )}
            </div>
          </div>

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 p-3">
                {/* CA-01 — Producto */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">PRODUCTO</label>
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
                  <label className="text-[10px] text-gray-600 mb-0.5">MONTO PLAZOS PROYECTADO</label>
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

                {/* Plazo(s) del Producto — pickmap desde el producto seleccionado */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">PLAZO(S) DEL PRODUCTO</label>
                  {!productoSel ? (
                    <div className={readonlyClass}>— Elija primero un producto —</div>
                  ) : plazosProducto.length === 0 ? (
                    <div className={readonlyClass}>El producto no tiene plazos configurados.</div>
                  ) : (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 px-2 py-1 border border-gray-300 rounded bg-white">
                      {plazosProducto.map(p => (
                        <label key={p} className="flex items-center gap-1 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={plazosSeleccionados.includes(p)}
                            onChange={() => togglePlazoProducto(p)}
                            disabled={isView}
                            className="w-3 h-3 accent-[#0099CC]"
                          />
                          {p}
                        </label>
                      ))}
                    </div>
                  )}
                  <span className="text-[9px] text-gray-400 mt-0.5">
                    Sólo los plazos configurados en el producto. Se mapea a la Solicitud.
                  </span>
                </div>

                {/* Monto Emisión — base del cálculo de CA-06 */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">MONTO EMISIÓN</label>
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
                  <label className="text-[10px] text-gray-600 mb-0.5">PLAZO BONOS (AÑOS)</label>
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
                  <label className="text-[10px] text-gray-600 mb-0.5">TASA BONOS (%)</label>
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
                  <label className="text-[10px] text-gray-600 mb-0.5">% COBERTURA GPO ESTIMADO</label>
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
                  <label className="text-[10px] text-gray-600 mb-0.5">MONTO MÁXIMO GARANTIZADO</label>
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
                  <label className="text-[10px] text-gray-600 mb-0.5">MONTO INVERSIÓN</label>
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
                  <label className="text-[10px] text-gray-600 mb-0.5">MONEDA</label>
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
                  <label className="text-[10px] text-gray-600 mb-0.5">TIPO FINANCIAMIENTO</label>
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
                  <label className="text-[10px] text-gray-600 mb-0.5">DESCRIPCIÓN OBRA</label>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 p-3">
                {/* CA-01 — Tasa Comisión Anual GPO */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">TASA COMISIÓN ANUAL GPO</label>
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
                  <label className="text-[10px] text-gray-600 mb-0.5">
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
                  <label className="text-[10px] text-gray-600 mb-0.5">INGRESO ANUAL ESTIMADO COMISIONES</label>
                  <input value={formatMoney(ingresoAnualComisiones)} disabled className={`${readonlyClass} text-right font-mono`} />
                  <span className="text-[9px] text-gray-400 mt-0.5">Monto Máximo Garantizado × Tasa Comisión Anual</span>
                </div>

                {/* Ingreso de Comisión por Periodo — Ingreso Anual Estimado ÷ periodos del año
                    (Mensual=12 | Trimestral=4 | Semestral=2 | Anual=1). */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">INGRESO DE COMISIÓN POR PERIODO</label>
                  <input value={formatMoney(ingresoComisionPorPeriodo)} disabled className={`${readonlyClass} text-right font-mono`} />
                  <span className="text-[9px] text-gray-400 mt-0.5">
                    Ingreso Anual Estimado ÷ periodos del año {data.periodicidadCobroComision ? `(${data.periodicidadCobroComision})` : ''}
                  </span>
                </div>

                {/* Contexto heredado del producto — solo lectura para no duplicar
                    dónde se captura cada dato. */}
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">% COBERTURA GPO</label>
                  <input
                    value={data.coberturaGPOPorcentaje ? `${data.coberturaGPOPorcentaje}%` : '—'}
                    disabled
                    className={`${readonlyClass} text-right font-mono`}
                  />
                  <span className="text-[9px] text-gray-400 mt-0.5">Se define en Estructura Bursátil</span>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">MONTO MÁXIMO GARANTIZADO</label>
                  <input value={formatMoney(montoGarantizado)} disabled className={`${readonlyClass} text-right font-mono`} />
                  <span className="text-[9px] text-gray-400 mt-0.5">Monto Emisión × % Cobertura</span>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">BASE PACTADA (PRODUCTO)</label>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 p-3">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">ESTATUS DE LA OPORTUNIDAD</label>
                  <select
                    value={form.estatus_cotiza || ''}
                    disabled={isView}
                    onChange={e => handleEstatusChange(e.target.value)}
                    className={fieldClass}
                  >
                    {/* Un estatus heredado fuera del catálogo (ej. cotizaciones
                        previas a HU-CRM-09) se conserva visible para no perderlo. */}
                    {form.estatus_cotiza
                      && !CAT_ESTATUS_OPORTUNIDAD.includes(form.estatus_cotiza as any)
                      && !CAT_ESTATUS_OPORTUNIDAD_CIERRE.includes(form.estatus_cotiza as any) && (
                      <option value={form.estatus_cotiza}>{form.estatus_cotiza}</option>
                    )}
                    {CAT_ESTATUS_OPORTUNIDAD.map(e => <option key={e} value={e}>{e}</option>)}
                    {/* Cierre Comercial — se listan para ver el pipeline completo,
                        pero los mueve el botón, no la mano (deshabilitados). */}
                    <optgroup label="Cierre Comercial (automático)">
                      {CAT_ESTATUS_OPORTUNIDAD_CIERRE.map(e => (
                        <option key={e} value={e} disabled={e !== form.estatus_cotiza}>{e}</option>
                      ))}
                    </optgroup>
                  </select>
                  <span className="text-[9px] text-gray-400 mt-0.5">
                    "Ganada Comercial" y "Perdida" los asigna el Cierre Comercial automáticamente.
                  </span>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">FECHA CREACIÓN</label>
                  <input
                    value={form.fecha_cotiza ? new Date(form.fecha_cotiza).toLocaleString('es-MX') : '—'}
                    disabled
                    className={readonlyClass}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">LEAD DE ORIGEN</label>
                  <input value={data.leadOrigenId || '— Captura directa —'} disabled className={`${readonlyClass} font-mono text-[10px]`} />
                </div>
              </div>

              {/* HU-CRM-09 CA-03 — Log de auditoría de cambios de estatus */}
              <div className="px-4 pb-4">
                <div className="text-[10px] text-gray-600 mb-0.5.5 uppercase tracking-wide">Bitácora de Estatus</div>
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

          {/* ═══════════ TAB CIERRE COMERCIAL — puente CRM → Originación (LOS) ═══════════ */}
          {activeTab === 'cierre' && (
            <div>
              {/* Estatus actual de la Oportunidad — siempre visible en Cierre Comercial */}
              <div className="px-4 pt-3">
                {form.estatus_cotiza === ESTATUS_OPORTUNIDAD_GANADA ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2" className="shrink-0"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                    <strong>Ganada Comercial</strong> — Oportunidad congelada.
                    {solicitudLOSRef?.noSol && <span className="text-green-700"> Solicitud LOS: {solicitudLOSRef.noSol}</span>}
                  </div>
                ) : form.estatus_cotiza === ESTATUS_OPORTUNIDAD_PERDIDA ? (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2" className="shrink-0"><circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" /></svg>
                    <strong>Perdida</strong>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
                    Estatus actual: <strong className="text-gray-800">{form.estatus_cotiza || '—'}</strong>
                  </div>
                )}
              </div>

              {seccion('Resumen Definitivo')}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-2 p-3">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">MONTO EMISIÓN</label>
                  <input value={formatMoney(montoEmision)} disabled className={`${readonlyClass} text-right font-mono`} />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">% COBERTURA GPO</label>
                  <input value={pctCobertura ? `${pctCobertura}%` : '—'} disabled className={`${readonlyClass} text-right font-mono`} />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">TASA COMISIÓN PACTADA</label>
                  <input value={pctComision ? `${pctComision}%` : '—'} disabled className={`${readonlyClass} text-right font-mono`} />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">PERIODICIDAD DE COBRO</label>
                  <input value={data.periodicidadCobroComision || '—'} disabled className={readonlyClass} />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">INGRESO COMISIÓN ANUAL ESTIMADO</label>
                  <input value={formatMoney(ingresoAnualComisiones)} disabled className={`${readonlyClass} text-right font-mono`} />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">INGRESO COMISIÓN POR PERIODO</label>
                  <input value={formatMoney(ingresoComisionPorPeriodo)} disabled className={`${readonlyClass} text-right font-mono`} />
                  <span className="text-[9px] text-gray-400 mt-0.5">Ingreso Anual Estimado ÷ periodos por año ({data.periodicidadCobroComision || '—'})</span>
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">RFC EMISOR</label>
                  <input value={rfcEmisor || '— No encontrado en el expediente —'} disabled className={readonlyClass} />
                </div>
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">SECTOR DE INFRAESTRUCTURA</label>
                  <input value={data.sectorInfraestructura || '—'} disabled className={readonlyClass} />
                </div>
              </div>

              {seccion('Evidencia Comercial')}
              <div className="p-4">
                <label className="text-[10px] text-gray-600 mb-1 block uppercase">
                  Carta Oferta firmada por el cliente <span className="text-red-600">*</span>
                </label>
                {!documentoAceptacion ? (
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    disabled={cierreLocked || subiendoAceptacion}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleCargarDocumentoAceptacion(f);
                      e.target.value = '';
                    }}
                    className="text-xs"
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-green-50 border border-green-200 rounded text-xs">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803D" strokeWidth="2" className="shrink-0">
                      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <a
                      href="#"
                      className="text-[#0066CC] hover:underline font-mono"
                      onClick={e => { e.preventDefault(); setCartaEnVisor({ url: documentoAceptacion.url, nombre: documentoAceptacion.nombre }); }}
                    >
                      {documentoAceptacion.nombre}
                    </a>
                    <span className="text-gray-500">
                      {documentoAceptacion.tamanoKB} KB · {new Date(documentoAceptacion.fecha).toLocaleString('es-MX')}
                    </span>
                    {!documentoAceptacion.enStorage && (
                      <span className="text-[9px] text-amber-600" title="No se subió a Storage; se pierde al recargar">⚠ local</span>
                    )}
                    {!cierreLocked && (
                      <div className="ml-auto flex items-center gap-3">
                        <button
                          type="button"
                          onClick={abrirSelectorFirmada}
                          disabled={subiendoAceptacion}
                          className="text-[#0066CC] hover:underline disabled:opacity-60"
                        >
                          {subiendoAceptacion ? 'Subiendo…' : 'Reemplazar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setData({ documentoAceptacion: undefined })}
                          className="text-red-600 hover:underline"
                        >
                          Quitar
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {subiendoAceptacion && <span className="text-[10px] text-gray-500 mt-1 block">Cargando…</span>}
                <span className="text-[9px] text-gray-400 mt-1 block">
                  Solo PDF. Es la Carta Oferta que el cliente devuelve firmada — no la que genera el botón [Generar Carta Oferta].
                </span>
                {faltaEvidenciaCierre && !cierreLocked && (
                  <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
                    Falta cargar la Carta Oferta firmada para poder cerrar como <strong>Ganada</strong>.
                  </div>
                )}
              </div>

              {data.motivoPerdida && (
                <div className="mx-4 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">
                  <strong>Motivo de la pérdida:</strong> {data.motivoPerdida}
                </div>
              )}

              {!isView && (
                <div className="px-4 pb-4 flex items-center gap-2">
                  {/* El botón solo se bloquea si la Oportunidad ya está cerrada
                      (terminal) o si hay un cierre en curso. Antes se
                      deshabilitaba también por falta de evidencia y quedaba
                      "muerto" sin explicar por qué; ahora se puede picar y
                      handleCerrarGanada dice exactamente qué falta. */}
                  <button
                    onClick={handleCerrarGanada}
                    disabled={cierreLocked || cerrando !== null}
                    title={cierreLocked ? 'La Oportunidad ya está cerrada.' : 'Cierra la Oportunidad como Ganada y crea la Solicitud en Originación'}
                    className={`px-5 py-1.5 rounded text-xs font-medium transition-colors ${
                      !cierreLocked && cerrando === null ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {cerrando === 'ganada' ? 'Creando Solicitud…' : 'Cerrada-Ganada'}
                  </button>
                  <button
                    onClick={handleCerrarPerdida}
                    disabled={isTerminal || cerrando !== null}
                    className={`px-5 py-1.5 rounded text-xs font-medium transition-colors border ${
                      isTerminal ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-white text-red-600 border-red-300 hover:bg-red-50'
                    }`}
                  >
                    Cerrada-Perdida
                  </button>
                </div>
              )}

              {/* Bitácora del gatillo Cierre Comercial — folio, usuario, timestamp, id_solicitud generada */}
              <div className="px-4 pb-4">
                <div className="text-[10px] text-gray-600 mb-0.5 uppercase tracking-wide">Bitácora de Cierre Comercial</div>
                <div className="border border-gray-300 rounded overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-300">
                        <th className="px-3 py-1.5 text-left font-normal text-gray-700 w-44">FECHA Y HORA</th>
                        <th className="px-3 py-1.5 text-left font-normal text-gray-700 w-40">USUARIO</th>
                        <th className="px-3 py-1.5 text-left font-normal text-gray-700 w-28">RESULTADO</th>
                        <th className="px-3 py-1.5 text-left font-normal text-gray-700">DETALLE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bitacoraCierreComercial.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-gray-400">Sin movimientos de Cierre Comercial.</td>
                        </tr>
                      ) : (
                        [...bitacoraCierreComercial].reverse().map((b, i) => (
                          <tr key={`${b.fecha}-${i}`} className="border-b border-gray-200" style={{ backgroundColor: i % 2 === 1 ? '#F9F9F9' : '#FFFFFF' }}>
                            <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{new Date(b.fecha).toLocaleString('es-MX')}</td>
                            <td className="px-3 py-1.5 text-gray-700">{b.usuario || '—'}</td>
                            <td className="px-3 py-1.5">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                                b.resultado === 'Ganada' ? 'bg-green-100 text-green-800'
                                : b.resultado === 'Perdida' ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {b.resultado}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-gray-700">
                              {b.idSolicitudLOS ? `Solicitud LOS: ${b.idSolicitudLOS}` : b.motivo || b.detalle || '—'}
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
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <span className="text-[11px] text-gray-500">
                    {archivosAdjuntos.length} archivo{archivosAdjuntos.length === 1 ? '' : 's'} adjunto{archivosAdjuntos.length === 1 ? '' : 's'}
                  </span>

                  {!isView && (
                    /* Flujo en 2 pasos, agrupado en un solo bloque para que se
                       lea como una secuencia y no como dos acciones sueltas:
                       1. generar la carta → 2. subir la que regresa firmada.
                       El paso 2 se deshabilita hasta que exista al menos una
                       Carta Oferta generada — no tiene sentido "firmar" algo
                       que aún no se emitió. */
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
                      <span className="w-4 h-4 flex items-center justify-center rounded-full bg-[#0099CC] text-white text-[9px] font-bold shrink-0">1</span>
                      <button
                        onClick={handleGenerarCartaOferta}
                        disabled={generandoCarta}
                        className={`px-4 py-1.5 rounded text-xs font-medium whitespace-nowrap ${
                          generandoCarta ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#0099CC] text-white hover:bg-[#0088BB]'
                        }`}
                      >
                        {generandoCarta ? 'Generando…' : 'Generar Carta Oferta'}
                      </button>

                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" className="shrink-0 mx-0.5">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>

                      <span className={`w-4 h-4 flex items-center justify-center rounded-full text-white text-[9px] font-bold shrink-0 ${hayCartaGenerada ? 'bg-green-600' : 'bg-gray-300'}`}>2</span>
                      <button
                        onClick={abrirSelectorFirmada}
                        disabled={!hayCartaGenerada || cierreLocked || subiendoAceptacion}
                        title={
                          !hayCartaGenerada
                            ? 'Primero genere la Carta Oferta (paso 1)'
                            : 'Suba el PDF que el cliente devolvió firmado'
                        }
                        className={`px-4 py-1.5 rounded text-xs font-medium border whitespace-nowrap ${
                          !hayCartaGenerada || cierreLocked || subiendoAceptacion
                            ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed'
                            : 'bg-white text-green-700 border-green-500 hover:bg-green-50'
                        }`}
                      >
                        {subiendoAceptacion
                          ? 'Subiendo…'
                          : (documentoAceptacion ? 'Actualizar Carta firmada' : 'Subir Carta firmada')}
                      </button>
                    </div>
                  )}
                </div>
                {!isView && !hayCartaGenerada && (
                  <p className="text-[10px] text-gray-400 mb-3 -mt-2">
                    Flujo: genere la carta → descárguela con las anotaciones/firma del cliente → súbala firmada para habilitar Cerrada-Ganada.
                  </p>
                )}

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

          {/* ═══════════ TAB SOLICITUDES — LOS (generada por Nueva Solicitud / Cerrada-Ganada) + Corporativas (j_corp_fin, histórico) ═══════════ */}
          {activeTab === 'solicitudes' && (
            <div>
              {/* ── Solicitud en Originación (LOS) — un único botón de alta ── */}
              <div className="p-4">
                <div className={`rounded-lg border p-4 ${solicitudLOSRef ? 'border-green-200 bg-green-50' : 'border-[#0099CC]/40 bg-[#F0F9FC]'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-gray-800 uppercase tracking-wide">Solicitud en Originación (LOS)</span>
                    {!isView && !solicitudLOSRef && (
                      <button
                        onClick={handleNuevaSolicitud}
                        className="px-4 py-1.5 bg-[#0099CC] text-white rounded text-xs hover:bg-[#0088BB] font-medium whitespace-nowrap"
                      >
                        + Nueva Solicitud
                      </button>
                    )}
                  </div>

                  {!solicitudLOSRef ? (
                    <p className="text-[11px] text-gray-500 mt-2">
                      Presiona <span className="font-medium text-gray-700">+ Nueva Solicitud</span> para generarla pre-llenada
                      con los datos de la Oportunidad (la revisas y guardas en Solicitudes), o se crea automáticamente al
                      presionar <span className="font-medium text-gray-700">[Cerrada-Ganada]</span> en Cierre Comercial.
                    </p>
                  ) : (
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-3">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-700">
                        <div><span className="text-gray-500">Folio LOS:</span> <span className="font-mono font-medium">{solicitudLOSRef.noSol}</span></div>
                        <div><span className="text-gray-500">Fecha:</span> {new Date(solicitudLOSRef.fecha).toLocaleString('es-MX')}</div>
                      </div>
                      {onNavigateToSolicitud && (
                        <button
                          onClick={() => onNavigateToSolicitud(solicitudLOSRef.id, solicitudLOSRef.noSol, form.cliente_id, {
                            mode: 'editar',
                            volverAOportunidadId: form.id,
                          })}
                          className="px-4 py-1.5 bg-[#0099CC] text-white rounded text-xs hover:bg-[#0088BB] font-medium whitespace-nowrap"
                        >
                          Abrir Solicitud
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Solicitudes reales del LOS — se consulta J_CUENTAS_CORP_CLIENTES ── */}
              <div className="border-t border-gray-200 mt-1">
                {seccion('Solicitudes (J_CUENTAS_CORP_CLIENTES)')}
                <div className="p-4">
                  <p className="text-[10px] text-gray-400 mb-2">
                    Solicitudes cuyo <span className="font-mono">no_referenc1</span> es el folio de esta Oportunidad
                    (<span className="font-mono text-gray-600">{form.no_cotiza}</span>). Se dan de alta y se editan
                    desde el módulo de Solicitudes; aquí son de solo lectura.
                  </p>

                  {errorSolicitudesLOS && (
                    <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">
                      No se pudo consultar J_CUENTAS_CORP_CLIENTES: {errorSolicitudesLOS}
                    </div>
                  )}

                  <div className="border border-gray-300 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-100 border-b border-gray-300">
                          {!!onNavigateToSolicitud && <th className="px-3 py-2 text-left font-normal text-gray-700 w-16">Abrir</th>}
                          <th className="px-3 py-2 text-left font-normal text-gray-700">FOLIO</th>
                          <th className="px-3 py-2 text-left font-normal text-gray-700">PRODUCTO</th>
                          <th className="px-3 py-2 text-right font-normal text-gray-700">MONTO SOLICITADO</th>
                          <th className="px-3 py-2 text-right font-normal text-gray-700">MONTO AUTORIZADO</th>
                          <th className="px-3 py-2 text-left font-normal text-gray-700">FASE</th>
                          <th className="px-3 py-2 text-center font-normal text-gray-700">ESTATUS</th>
                          <th className="px-3 py-2 text-left font-normal text-gray-700">FECHA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {solicitudesDeLaOportunidad.length === 0 ? (
                          <tr>
                            <td colSpan={onNavigateToSolicitud ? 8 : 7} className="px-3 py-8 text-center text-gray-400">
                              {cargandoSolicitudesLOS ? 'Consultando J_CUENTAS_CORP_CLIENTES…' : 'Sin solicitudes asociadas a esta Oportunidad.'}
                            </td>
                          </tr>
                        ) : solicitudesDeLaOportunidad.map((sol, i) => {
                          const solId = String((sol as any)._dbId || sol.id);
                          const abrir = () => onNavigateToSolicitud?.(solId, sol.noSol, form.cliente_id, {
                            mode: 'editar',
                            volverAOportunidadId: form.id,
                          });
                          return (
                            <tr
                              key={solId}
                              className="border-b border-gray-200"
                              style={{ backgroundColor: i % 2 === 1 ? '#F9F9F9' : '#FFFFFF' }}
                              onDoubleClick={abrir}
                            >
                              {!!onNavigateToSolicitud && (
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); abrir(); }}>Abrir</a>
                                </td>
                              )}
                              <td className="px-3 py-2 text-gray-700 font-mono">{sol.noSol || '—'}</td>
                              <td className="px-3 py-2 text-gray-700">{sol.nombreProducto || sol.tipoProducto || '—'}</td>
                              <td className="px-3 py-2 text-gray-700 text-right font-mono">{formatMoney(sol.montoSolicitado)}</td>
                              <td className="px-3 py-2 text-gray-700 text-right font-mono">{formatMoney(sol.montoAutorizado)}</td>
                              <td className="px-3 py-2 text-gray-700">{sol.faseDescripcion || '—'}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                                  sol.estatusSolicitud === 'Aprobado' ? 'bg-green-100 text-green-800'
                                  : sol.estatusSolicitud === 'Rechazado' ? 'bg-red-100 text-red-800'
                                  : sol.estatusSolicitud === 'Cancelado' ? 'bg-gray-100 text-gray-700'
                                  : sol.estatusSolicitud === 'En Análisis' ? 'bg-blue-100 text-blue-800'
                                  : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {sol.estatusSolicitud || '—'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-700">{sol.fechaSolicitud || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* HU-CRM-10 CA-05 — visor del PDF generado */}
      {/* Selector único de la Carta Oferta firmada — lo disparan el visor de
          PDF, la pestaña Archivos Adjuntos y Cierre Comercial. */}
      <input
        ref={inputFirmadaRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleCargarDocumentoAceptacion(f);
          e.target.value = '';
        }}
      />

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
                {!isView && !cierreLocked && (
                  <button
                    onClick={abrirSelectorFirmada}
                    disabled={subiendoAceptacion}
                    title="Suba aquí el PDF ya firmado por el cliente (reemplaza el anterior si ya había uno)"
                    className="px-3 py-1 rounded text-xs bg-white text-[#0F5132] font-medium hover:bg-white/90 disabled:opacity-60"
                  >
                    {subiendoAceptacion ? 'Subiendo…' : (documentoAceptacion ? 'Actualizar firmada' : 'Subir firmada')}
                  </button>
                )}
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

      {/* ── Selección de Cliente Emisor — solo Oportunidades de alta directa (esDirecta) ── */}
      <SeleccionarClienteModal
        isOpen={showClienteModal}
        onClose={() => setShowClienteModal(false)}
        onSelect={(c) => {
          setForm(prev => (prev ? {
            ...prev,
            cliente_id: c.dbUuid || c.idCliente,
            data: {
              ...(prev.data as any),
              cliente: {
                claveCliente: c.idCliente || '',
                nombreCompleto: c.nombreCompleto || '',
              },
            },
          } : prev));
          setShowClienteModal(false);
        }}
      />

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
