/**
 * SolicitudCreditoForm.tsx — Spec: financial-account-request-spec.md
 *
 * Header siempre visible + 7 acordeones:
 *  1. Términos y Condiciones
 *  2. Simulación
 *  3. Expediente Electrónico
 *  4. Garantías
 *  5. Comisiones
 *  6. Autorizaciones
 *  7. Notas
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase } from '../../lib/supabaseClient';
import {
  SolicitudFormData, EMPTY_FORM, MOCK_FORMS, SOLICITUDES_LISTA,
  saveToSession, loadFromSession, loadFromSavedStore, saveToSavedStore, commitAndClearSession, clearSession,
  formatCurrency, parseCurrency, generateNoSol, consumeNoSol, getFechaSolicitudNow,
  CAT_LINEA_PRODUCTO, CAT_TIPO_PRODUCTO, CAT_TIPO_PERSONA, CAT_PRODUCTOS,
  CAT_FASES, CAT_SUCURSAL, CAT_ESTATUS_SOLICITUD,
  calcularCargosArrendamiento, generarFacturaDesembolsoInicial,
  generarXMLProveedor, leerXMLProveedor,
  type DocumentoCargado, type RequisitoProducto, type FacturaArrendamiento,
  esArrendamiento,
} from './solicitudCreditoStore';
import { TerminosCondicionesTab } from './TerminosCondicionesTab';
import {
  EstructuraOperativa2oPisoTab, SUBTAB_ESTRUCTURA_2O_PISO,
  leerEstructura2oPiso, faltantesEstructura2oPiso,
} from './EstructuraOperativa2oPisoTab';
import {
  ModeloViabilidadFinancieraTab, leerModeloViabilidad, faltantesModeloViabilidad,
  dscrPromedio, semaforoDeDscr, dscrDeFila,
} from './ModeloViabilidadFinancieraTab';
import { VotacionCPCTab, leerVotacionCPC } from './VotacionCPCTab';
import {
  ValidacionClausulasFiduciariasTab, leerValidacionClausulas, faltantesValidacionClausulas,
} from './ValidacionClausulasFiduciariasTab';
import {
  ResolucionFinalCICTab, leerResolucionCIC, faltantesResolucionCIC,
  type EmitirOficioPayload, type EmitirOficioResultado,
} from './ResolucionFinalCICTab';
import { SimulacionTab, calcularNumeroPeriodos } from './SimulacionTab';
import { formalizarGarantiaGPO } from '../../hooks/formalizacionCarteraGPO';
import { ExpedienteElectronicoTab } from './ExpedienteElectronicoTab';
import { GarantiasTab } from './GarantiasTab';
import { ComisionesTab } from './ComisionesTab';
import { AutorizacionTab } from './AutorizacionTab';
import { NotasTab } from './NotasTab';
import { DatePicker } from '../ui/DatePicker';
import { FasesSolicitudTab } from './tabs/FasesSolicitudTab';
import { SeleccionarClienteModal } from './SeleccionarClienteModal';
import { PartesRelacionadasTab } from './tabs/PartesRelacionadasTab';
import { useProductosCatalogoDB, type ProductoCatalogo } from '../../hooks/useProductosCatalogoDB';
import { useSolicitudesDB, fetchNextNoSol, updateFaseSolicitudDB, avanzarFaseSolicitudDB, regresarFaseSolicitudDB, formalizarContratoSolicitudDB, activarCuentaDB, actualizarEstatusSolicitudDB, crearCuentaDesdeSolicitudDB, actualizarDispersionDB, actualizarFacturasDB } from '../../hooks/useSolicitudesDB';
import {
  validarDocumentosFase, validarDocumentosPorFase, validarNotaReciente, validarFormalizarContrato,
  validarContratosYPagares, validarFase4Envio, validarFase6, leerRequisitosProducto,
  getRequisitosFromRawData, validarResultadoActivacion,
} from '../../hooks/useOriginacionValidaciones';
import { useSolicitudesActivacionDB, crearFacturaProveedorActivacion, fetchEstatusSolicitudActivacion } from '../../hooks/useSolicitudesActivacionDB';
import type { SolicitudActivacionListItem } from '../solicitudes-activacion/solicitudActivacionStore';
import { calcularFechaPrimerPago } from '../solicitudes-activacion/solicitudActivacionStore';
import {
  generarContratoPDF, generarPagePDF, generarSolicitudPDF,
  autoCrearDocumentosFase2, CLAVE_SOLICITUD_BASE,
  autoCrearReporteBuro,
  autoCrearDocumentosComitePrepago,
  autoCrearDictamenRiesgo,
  autoCrearOficioCIC,
  autoCrearPropuestaContratoGPO,
  htmlToPdfBlobUrl, sustituirPlaceholders, decodificarArchivoData,
  type DatosSolicitud,
} from '../../hooks/generarDocumentosFase4';
import { SolicitudActivacionModal } from '../originacion/SolicitudActivacionModal';
import { FaseActionsComponent } from '../shared/FaseActionsComponent';
import { crearFacturaArrendamientoCobranza, fetchEstatusFacturaCobranza } from '../../hooks/useCarteraDB';

/** UUID de solicitud requerido para dar de alta facturas en Cobranza. */
const UUID_RE_FACTURA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import { addOriginacionItem, CAT_AREA } from '../originacion/originacionStore';
import { FlujoTrabajo } from '../originacion/FlujoTrabajo';
import { SolicitudCargosTab } from './SolicitudCargosTab';
import { FacturasArrendamientoTab } from './FacturasArrendamientoTab';
import { ComitesTab } from '../shared/ComitesTab';

// ── Helper: inferir AreaActual según el nombre de la fase ──
function inferirAreaFase(descripcionFase: string): string {
  const f = descripcionFase.toLowerCase();
  if (f.includes('integración') || f.includes('integracion') || f.includes('expediente')) return 'INTEGRACIÓN';
  if (f.includes('jurídico') || f.includes('juridico')) return 'JURÍDICO';
  if (f.includes('análisis') || f.includes('analisis') || f.includes('operativo')) return 'ANÁLISIS';
  if (f.includes('formalización') || f.includes('formalizacion')) return 'LIBERACIÓN';
  if (f.includes('validación') || f.includes('validacion') || f.includes('contrato')) return 'LIBERACIÓN';
  if (f.includes('activación') || f.includes('activacion') || f.includes('solicitud')) return 'LIBERACIÓN';
  return 'INTEGRACIÓN';
}

// ── Helper: obtener requisitos obligatorios para la fase actual ──
// Lee de rawData.requisitos (Sección 1 del Expediente Electrónico)
function getRequisitosObligatoriosFase(
  rawData: Record<string, any> | null | undefined,
  faseIdNum: number,
  tipoPersona: string,
): { tipoDocumento: string; descripcion: string }[] {
  if (!rawData) return [];

  // Buscar en múltiples keys posibles
  const rows: any[] =
    rawData.requisitos ??
    rawData.requisitosDocumentales ??
    rawData.expedientesElectronicos ??
    rawData.expediente_electronico ??
    [];

  if (!Array.isArray(rows) || rows.length === 0) return [];

  return rows
    .filter(r => {
      // Filtrar por faseId
      const fId =
        typeof r.faseId === 'number' ? r.faseId :
        typeof r.fase_id === 'number' ? r.fase_id :
        (() => { const m = String(r.fase || '').match(/(\d+)/); return m ? parseInt(m[1]) : 1; })();
      if (fId !== faseIdNum) return false;

      // Filtrar por obligatorio
      if (r.obligatorio === false || r.activo === false) return false;

      // Filtrar por tipo de persona (si el campo existe)
      const persona = String(r.persona || r.tipoPersona || '').toLowerCase();
      if (persona && !persona.includes('todo') && !persona.includes('all')) {
        const tp = tipoPersona.toLowerCase();
        const isMoral = tp.includes('moral');
        const isEmp = tp.includes('emp') || tp.includes('empresarial');
        if (isMoral && !persona.includes('moral')) return false;
        if (!isMoral && !isEmp && persona.includes('moral')) return false;
      }
      return true;
    })
    .map(r => ({
      tipoDocumento: r.tipoDocumento ?? r.tipo_documento ?? r.requisitoNombre ?? r.tipo ?? r.clave ?? '',
      descripcion: r.descripcion ?? r.nota ?? '',
    }))
    .filter(r => !!r.tipoDocumento);
}

type FormMode = 'nuevo' | 'editar' | 'ver';

interface SolicitudCreditoFormProps {
  mode: FormMode;
  solicitudId?: number | string;
  onCancel: () => void;
  onSave?: (data: any) => void;
  /** Datos pre-cargados desde cotización */
  cotizacionData?: Partial<SolicitudFormData>;
  /**
   * 'solicitudes' (default) → solo botón Enviar de Fase
   * 'originacion'           → todos los botones de fase, siempre visibles
   */
  modo?: 'solicitudes' | 'originacion';
}

/**
 * Nombre legible de cada campo obligatorio, para poder decir CUÁL falta.
 * Antes el aviso sólo daba el conteo ("1 campo(s) requieren corrección") y
 * el mensaje en rojo vive junto al campo — que puede estar en un acordeón
 * cerrado o en el encabezado, fuera de lo que el usuario está mirando. Sin
 * el nombre no había forma de saber dónde buscar.
 */
const ETIQUETAS_CAMPO_OBLIGATORIO: Record<string, string> = {
  lineaProducto: 'Línea de Producto',
  tipoProducto: 'Tipo de Producto',
  tipoPersona: 'Tipo de Persona',
  nombrePersona: 'Nombre',
  apellidoPaternoPersona: 'Apellido Paterno',
  productoId: 'Producto',
  sucursal: 'Sucursal',
  montoSolicitado: 'Monto Solicitado',
  plazo: 'Plazo',
};

export function SolicitudCreditoForm({ mode, solicitudId, onCancel, onSave, cotizacionData, modo: modoProp = 'solicitudes' }: SolicitudCreditoFormProps): JSX.Element {
  const storageId: number | string | 'new' = mode === 'nuevo' ? 'new' : (solicitudId ?? 1);
  /**
   * Documentos vivos del subtab Expediente. Es la fuente preferente al validar
   * el avance de fase: sessionStorage puede quedarse sin cuota al guardar los
   * archivos en base64 y devolver una lista vacia aunque el usuario los tenga
   * cargados en pantalla (saveToSession se tragaba el QuotaExceededError).
   */
  const documentosDelTabRef = useRef<DocumentoCargado[] | null>(null);
  /** REQ-9 — última estructura capturada; la validación de avance la prefiere. */
  const estructura2oPisoRef = useRef<any>(null);
  /** REQ-10 — último modelo de viabilidad capturado. */
  const modeloViabilidadRef = useRef<any>(null);
  /** REQ-11 — no se usa para validar (decisión #4 sin resolver); sólo espeja para no perder datos si se necesitara en el futuro. */
  const votacionCPCRef = useRef<any>(null);
  /** REQ-12 — última Resolución Final del CIC capturada; la validación de avance la prefiere. */
  const resolucionCICRef = useRef<any>(null);
  /** Actividad 7.1 — última Validación de Cláusulas Fiduciarias capturada; la validación de avance la prefiere. */
  const validacionClausulasRef = useRef<any>(null);
  const initialRender = useRef(true);
  /** Tracks the formData snapshot at mount time — used to detect user-driven changes */
  const loadedProductoId = useRef<string>('');
  const loadedTipoProducto = useRef<string>('');

  const getInitial = useCallback((): SolicitudFormData => {
    const session = loadFromSession<SolicitudFormData>(storageId, 'form');
    if (session) return { ...EMPTY_FORM, ...session };
    if (mode === 'nuevo') {
      const base = {
        ...EMPTY_FORM,
        noSol: generateNoSol(),
        fechaSolicitud: getFechaSolicitudNow(),
        ...(cotizacionData || {}),
      };
      return base;
    }
    const saved = loadFromSavedStore<SolicitudFormData>(storageId, 'form');
    if (saved) return { ...EMPTY_FORM, ...saved };
    const mock = MOCK_FORMS[solicitudId ?? 1];
    return mock ? { ...EMPTY_FORM, ...mock } : { ...EMPTY_FORM };
  }, [mode, solicitudId, storageId, cotizacionData]);

  const [formData, setFormData] = useState<SolicitudFormData>(() => {
    const initial = getInitial();
    // Snapshot loaded values so cascade resets can distinguish DB-loaded vs user-changed
    loadedProductoId.current = initial.productoId;
    loadedTipoProducto.current = initial.tipoProducto;
    return initial;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<string>('fases');

  // ══════════════════════════════════════════════════════════════════
  // AUTO-HIDRATACIÓN DESDE BD — red de seguridad
  //
  // BUG FIX (2026-08-25): hasta aquí, este formulario SOLO sabía leer de
  // sessionStorage; dependía de que quien lo abriera hubiera sembrado antes
  // (handleVer/handleEditar en la lista, seedAndOpen en Originación, el deep
  // link del Cierre Comercial...). Cualquier ruta que no sembrara — o un
  // simple refresh de la página, que vacía la sesión — dejaba el formulario
  // en EMPTY_FORM: se veía vacío aunque la Solicitud estuviera completa en
  // la BD (verificado: la fila traía los 15 campos correctos).
  //
  // En vez de seguir parchando cada punto de entrada uno por uno, el
  // formulario ahora se hidrata solo: si está en modo ver/editar y detecta
  // que no tiene datos (noSol vacío), busca su registro en la BD y se llena.
  //
  // El import es dinámico a propósito: SolicitudCreditoList ya importa a
  // este componente, así que un import estático crearía un ciclo.
  // ══════════════════════════════════════════════════════════════════
  const { solicitudes: solicitudesBD } = useSolicitudesDB(mode !== 'nuevo');
  const autoHidratado = useRef(false);
  /**
   * Se incrementa cuando la auto-hidratación termina de sembrar sessionStorage.
   * Los subtabs (Términos, Simulación) leen su sesión UNA SOLA VEZ, en el
   * inicializador de useState; si ya estaban montados cuando llegó la
   * hidratación (que es asíncrona), se quedaban con su estado vacío para
   * siempre — la sección se veía completa pero con "—" en todos los campos.
   * Usarlo como `key` los obliga a remontar y releer.
   */
  const [hidratacionKey, setHidratacionKey] = useState(0);

  useEffect(() => {
    if (mode === 'nuevo' || autoHidratado.current) return;
    // Ya tiene datos (la sembraron bien) — no hay nada que reparar.
    if (formData.noSol) { autoHidratado.current = true; return; }
    if (!solicitudesBD.length) return;

    const sid = String(storageId);
    const row = (solicitudesBD as Record<string, any>[]).find(
      s => String(s._dbId ?? s.id) === sid || s.noSol === sid,
    );
    if (!row) return;

    autoHidratado.current = true;
    import('./SolicitudCreditoList')
      .then(({ buildFormDataFromListItem, preloadSubtabsFromDBData }) => {
        const hidratado = buildFormDataFromListItem(row as any);
        saveToSession(storageId, 'form', hidratado);
        const dbData = row._data;
        if (dbData && typeof dbData === 'object') {
          preloadSubtabsFromDBData(storageId, dbData, {
            montoCubrirGarantia: row._montoCubrirGarantia,
            porcentajeAforo: row._porcentajeAforo,
          });
        }
        setFormData(prev => ({ ...prev, ...hidratado }));
        // Fuerza el remontaje de los subtabs para que relean la sesión recién sembrada.
        setHidratacionKey(k => k + 1);
        console.log('[SolicitudCreditoForm] Auto-hidratación desde BD OK —', hidratado.noSol);
      })
      .catch(err => console.error('[SolicitudCreditoForm] Auto-hidratación falló:', err));
  }, [mode, storageId, formData.noSol, solicitudesBD]);

  // Limpiar datos de simulación de solicitudes previas que quedaron en sessionStorage bajo 'new'
  useEffect(() => {
    if (mode !== 'nuevo') return;
    const hasCotizSimulacion = !!(cotizacionData as any)?._terminosCondiciones?._simulacion?.length ||
      !!(cotizacionData as any)?._calendarioAportaciones?.length;
    if (!hasCotizSimulacion) {
      saveToSession('new', 'simulacion', []);
      saveToSession('new', 'simulacion_cal', null);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guard: si la sección activa no existe en el set actual, volver a 'fases' ──
  useEffect(() => {
    // sections se recalcula en cada render — no es un dep estable, se resuelve con el string de lineaProducto
    const ids = ['default','expediente','garantias','comites','cargos','terminos','simulacion','partesRelacionadas','fases','notas','flujoTrabajo','comisiones','autorizaciones'];
    const _l = (formData.lineaProducto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const _cap = _l.includes('captac') || _l.includes('ahorro') || _l.includes('invers');
    const hidden = _cap ? ['garantias'] : [];
    const unavailable = hidden.filter(id => !ids.includes(id));
    if (hidden.includes(activeSection) || unavailable.includes(activeSection)) {
      setActiveSection('fases');
    }
  }, [formData.lineaProducto, activeSection]);
  const [showClienteModal, setShowClienteModal] = useState(false);

  const isRO = mode === 'ver';
  // modo: controla qué botones de fase se muestran
  const modo = modoProp;

  // ── Safety re-init: if solicitudId changed but React reused the instance ──
  useEffect(() => {
    const fresh = getInitial();
    loadedProductoId.current = fresh.productoId;
    loadedTipoProducto.current = fresh.tipoProducto;
    setFormData(fresh);
    initialRender.current = true;
  }, [solicitudId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-persist formData en sessionStorage ──
  useEffect(() => {
    if (isRO) return;
    if (initialRender.current) return; // No guardar en el primer render
    saveToSession(storageId, 'form', formData);
  }, [formData, storageId, isRO]);


  // ── Productos DB: catálogo real de J_PRODUCTOS ──
  const { productos: productosDB, loading: loadingProductos } = useProductosCatalogoDB(true);

  // ── Tipos de producto filtrados por línea seleccionada ──
  const tiposProductoFiltrados = useMemo(() => {
    if (!formData.lineaProducto) return [];
    const fromDB = productosDB
      .filter(p => p.lineaProducto === formData.lineaProducto && p.sublineaProducto)
      .map(p => p.sublineaProducto);
    // Deduplicate, preserving DB values first; fallback to static catalog
    const unique = [...new Set(fromDB)];
    if (unique.length > 0) return unique.sort();
    // Fallback: static catalog (all types if no DB products for this line)
    return CAT_TIPO_PRODUCTO.map(c => c.value);
  }, [formData.lineaProducto, productosDB]);

  // ── Productos filtrados por línea seleccionada ──
  const productosFiltrados = useMemo(() => {
    if (!formData.lineaProducto) return productosDB;
    return productosDB.filter(p => p.lineaProducto === formData.lineaProducto);
  }, [formData.lineaProducto, productosDB]);

  // ── Auto-resolve tipoProducto from selected product when catalog loads ──
  useEffect(() => {
    if (!formData.productoId || productosDB.length === 0) return;
    const dbProd = productosDB.find(p => p.id === formData.productoId);
    if (dbProd?.sublineaProducto && dbProd.sublineaProducto !== formData.tipoProducto) {
      setFormData(prev => ({ ...prev, tipoProducto: dbProd.sublineaProducto }));
    }
  }, [formData.productoId, productosDB]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cascade reset productoId: skip on initial render to preserve loaded data ──
  useEffect(() => {
    if (initialRender.current) return;
    if (isRO) return;
    // If productoId is the one we loaded from DB/session, don't clear it
    if (formData.productoId === loadedProductoId.current) return;
    if (formData.productoId && productosFiltrados.length > 0) {
      const stillValid = productosFiltrados.some(p => p.id === formData.productoId);
      if (!stillValid) {
        setFormData(prev => ({ ...prev, productoId: '', nombreProducto: '' }));
      }
    }
  }, [formData.tipoProducto, productosFiltrados]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark initial render complete ONLY after productosDB has finished loading
  useEffect(() => {
    if (!loadingProductos) {
      // Wait one animation frame so the render with loaded products has settled
      const raf = requestAnimationFrame(() => {
        initialRender.current = false;
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [loadingProductos]);

  const set = (field: keyof SolicitudFormData, value: string) => {
    if (isRO) return;
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  };

  const handleEnviarSolicitud = useCallback(() => {
    setFormData(prev => ({ ...prev, estatusSolicitud: 'En proceso' }));
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yy = String(today.getFullYear()).slice(-2);

    const clienteNombre = `${formData.nombrePersona || ''} ${formData.apellidoPaternoPersona || ''} ${formData.apellidoMaternoPersona || ''}`.trim() || 'Sin nombre';

    // Actualizar SOLICITUDES_LISTA para que OriginacionModule lo vea en tiempo real
    const listItem = SOLICITUDES_LISTA.find(s =>
      s.noSol === formData.noSol || String(s.id) === String(storageId)
    );
    if (listItem) {
      listItem.estatusSolicitud = 'En proceso';
    }

    // Bridge local para cuando OriginacionModule ya estaba montado
    addOriginacionItem({
      noSolicitud: formData.noSol || `SC-${storageId}`,
      noCliente: '',
      cliente: clienteNombre,
      fechaSolicitud: `${dd}/${mm}/${yy}`,
      montoSolicitado: parseFloat(parseCurrency(formData.montoSolicitado || '0')) || 0,
      montoAutorizado: 0,
      sublinea: formData.lineaProducto || '',
      producto: formData.tipoProducto || '',
      sucursal: formData.sucursal || '',
      estatus: 'En Proceso',
      subEstatus: 'Integración del Expediente',
      responsable: '',
    });
    toast.success('Solicitud enviada', { description: 'Estatus actualizado a "En proceso". La solicitud aparece en Originación.' });
  }, [formData, storageId]);

  // ── Producto seleccionado (rawData para auto-llenar Términos y Condiciones) ──
  const productoSeleccionado = useMemo(() => {
    if (!formData.productoId) return undefined;
    const found = productosDB.find(p => p.id === formData.productoId);
    return found;
  }, [formData.productoId, productosDB]);

  // ── % Enganche — visible en el encabezado (solo Arrendamiento) ──
  const isArrendamientoHeader = (formData.tipoProducto || '').toLowerCase().includes('arrendamiento');
  const enganchesProductoHeader = useMemo(() => {
    const arr = productoSeleccionado?.rawData?.enganches;
    return Array.isArray(arr)
      ? arr.filter((o: any) => o?.estatus === 'ACTIVO').map((o: any) => ({ id: o.id, valor: String(o.valor) }))
      : [];
  }, [productoSeleccionado]);

  // ── Plazo + Matriz de Tasa Fija — visible en el encabezado junto al producto ──
  // Sembrado desde 'terminos' guardado (sessionStorage/BD) para no perder Tasa/
  // Frecuencia ya persistidas al reabrir una solicitud, mientras la Matriz del
  // producto (aún no cargada en el primer render) no confirme una fila igual.
  const [showMatrizModal, setShowMatrizModal] = useState(false);
  const [tasaSeleccionadaHeader, setTasaSeleccionadaHeader] = useState<string>(() => {
    const t = loadFromSession<any>(storageId, 'terminos') || loadFromSavedStore<any>(storageId, 'terminos');
    return t?.tasa || '';
  });
  const [frecuenciaSeleccionadaHeader, setFrecuenciaSeleccionadaHeader] = useState<string>(() => {
    const t = loadFromSession<any>(storageId, 'terminos') || loadFromSavedStore<any>(storageId, 'terminos');
    return t?.frecuencia || '';
  });
  type FilaMatriz = {
    plazoMinimo?: number; plazoMaximo?: number; plazoDefault?: number;
    montoMinimo?: number; montoMaximo?: number; montoDefault?: number;
    tasaMinima?: string; tasaMaxima?: string; tasaDefault?: string; tasaAplicable?: string;
    periodo?: string;
  };
  // Fila completa de la Matriz que corresponde al Plazo actual — fuente de
  // verdad para validar que Monto/Plazo/Tasa se mantengan en su rango.
  const [filaMatrizSeleccionada, setFilaMatrizSeleccionada] = useState<FilaMatriz | null>(null);
  const matrizTasaFijaProducto = useMemo(() => {
    const rd = productoSeleccionado?.rawData;
    const arr = Array.isArray(rd?.matrizTasaFija) ? rd.matrizTasaFija : [];
    return arr as FilaMatriz[];
  }, [productoSeleccionado]);

  /**
   * Periodicidades que declara la Matriz de Tasa Fija (columna FRECUENCIA).
   * Es la MISMA lista que acota el select de Términos y Condiciones; se pasa
   * también a la Cotización para que ambos acordeones compartan la fuente de
   * verdad. Sin esto la Cotización podía cotizar con una frecuencia que el
   * producto no ofrece (ver comentario en handleCotizarGPO).
   */
  const frecuenciasPermitidas = useMemo(() => {
    const vistas: string[] = [];
    for (const f of matrizTasaFijaProducto) {
      const per = String((f as any)?.periodo ?? '').trim();
      if (per && !vistas.includes(per)) vistas.push(per);
    }
    return vistas;
  }, [matrizTasaFijaProducto]);

  // Auto-derivar la fila de Matriz SOLO la primera vez que hay un Plazo sin
  // fila fija aún (p.ej. solicitud recién cargada con Plazo guardado, o el
  // usuario tecleó un Plazo antes de haber abierto el modal alguna vez).
  // Una vez que existe una fila seleccionada (filaMatrizSeleccionada, fijada
  // aquí o por el botón "Seleccionar" del modal), esta NO se reasigna nunca
  // automáticamente — si el usuario edita el Plazo en Términos y Condiciones
  // a un valor que cae en el rango de OTRA fila, la matriz elegida debe
  // mantenerse igual y el campo simplemente queda fuera de rango (error de
  // validación), no cambia de matriz por su cuenta.
  useEffect(() => {
    if (filaMatrizSeleccionada) return;
    const plazoNum = parseInt(formData.plazo || '0', 10);
    if (!plazoNum || matrizTasaFijaProducto.length === 0) return;
    // Los rangos de plazo de distintas filas se traslapan (p.ej. 12–36 y 24–60),
    // así que buscar sólo por plazo devolvía SIEMPRE la primera coincidencia y
    // aplicaba su tasa default aunque el monto no cupiera en esa fila.
    // Se filtra también por monto; si ninguna fila cuadra con ambos, se cae al
    // criterio anterior (sólo plazo) para no dejar al usuario sin matriz.
    const montoNum = parseFloat(parseCurrency(formData.montoSolicitado || '0')) || 0;
    const enRango = (v: number, min?: number, max?: number) =>
      v <= 0 || ((!min || v >= min) && (!max || v <= max));
    const porPlazo = (f: FilaMatriz) =>
      plazoNum >= (f.plazoMinimo || 0) && plazoNum <= (f.plazoMaximo || Infinity);

    const fila =
      matrizTasaFijaProducto.find(f => porPlazo(f) && enRango(montoNum, f.montoMinimo, f.montoMaximo))
      ?? matrizTasaFijaProducto.find(porPlazo);
    if (!fila) return;
    const tasaAnual = parseFloat(String(fila.tasaMinima ?? fila.tasaAplicable ?? '0')) || 0;
    const tasaDefault = parseFloat(String(fila.tasaDefault ?? '')) || tasaAnual;
    // Sólo sembrar el default cuando NO hay tasa capturada. Antes se pisaba la
    // tasa guardada en cada re-montaje del formulario, porque la fila de matriz
    // no se persiste y este efecto vuelve a correr desde cero al recargar.
    if (tasaDefault > 0 && !tasaSeleccionadaHeader) setTasaSeleccionadaHeader(tasaDefault.toFixed(4));
    if (fila.periodo) setFrecuenciaSeleccionadaHeader(fila.periodo);
    setFilaMatrizSeleccionada(fila);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.plazo, formData.montoSolicitado, matrizTasaFijaProducto, filaMatrizSeleccionada]);

  // Validación en tiempo real: Monto y Plazo del encabezado deben permanecer
  // dentro del rango de la fila de Matriz vigente.
  const matrizRangoError = useMemo(() => {
    if (!filaMatrizSeleccionada) return null;
    const montoNum = parseFloat(parseCurrency(formData.montoSolicitado || '0')) || 0;
    const min = filaMatrizSeleccionada.montoMinimo || 0;
    const max = filaMatrizSeleccionada.montoMaximo || 0;
    if (montoNum > 0 && ((min > 0 && montoNum < min) || (max > 0 && montoNum > max))) {
      return `Monto fuera de rango para este plazo (${formatCurrency(min)} – ${formatCurrency(max)})`;
    }
    return null;
  }, [filaMatrizSeleccionada, formData.montoSolicitado]);

  // Rango de Tasa anual [mín, máx] de la fila vigente — habilita edición de
  // Tasa en Términos y Condiciones dentro de ese rango.
  const tasaRangoMatrizHeader = useMemo(() => {
    if (!filaMatrizSeleccionada) return null;
    const min = parseFloat(String(filaMatrizSeleccionada.tasaMinima ?? '0')) || 0;
    const max = parseFloat(String(filaMatrizSeleccionada.tasaMaxima ?? filaMatrizSeleccionada.tasaMinima ?? '0')) || 0;
    if (min <= 0 && max <= 0) return null;
    return { min, max: max > 0 ? max : min };
  }, [filaMatrizSeleccionada]);

  // Rango de Plazo [mín, máx] de la fila vigente — permite capturar un Plazo
  // custom en Términos y Condiciones, validado contra ese rango.
  const plazoRangoMatrizHeader = useMemo(() => {
    if (!filaMatrizSeleccionada) return null;
    const min = filaMatrizSeleccionada.plazoMinimo || 0;
    const max = filaMatrizSeleccionada.plazoMaximo || 0;
    if (min <= 0 && max <= 0) return null;
    return { min, max: max > 0 ? max : min };
  }, [filaMatrizSeleccionada]);

  // ── Fases del producto seleccionado — fuente de verdad ──
  const fasesDelProducto = useMemo(() => {
    const rd = productoSeleccionado?.rawData;
    // Captación guarda fases en fasesRegistros; fases puede ser {} (objeto vacío) — usar Array.isArray para no bloquear el fallback
    const raw = (Array.isArray(rd?.fases) && rd.fases.length > 0 ? rd.fases : null)
      ?? (Array.isArray(rd?.fasesRegistros) && rd.fasesRegistros.length > 0 ? rd.fasesRegistros : null)
      ?? (Array.isArray(rd?.fase) ? rd.fase : null);
    if (Array.isArray(raw) && raw.length > 0) {
      const mapped = raw.map((f: any, idx: number) => ({
        faseId: String(f.id ?? f.fase_id ?? f.seq ?? idx + 1),
        seq: parseInt(String(f.seq ?? f.numero_consecutivo ?? f.orden ?? idx + 1)),
        fase: f.fase || f.phaseName || f.descripcion || '',
        area: f.area || '',
        notes: f.notes || '',
        promptIA: f.promptIA || '',
      }));
      return mapped;
    }
    // Fallback: CAT_FASES con seq explícito
    return CAT_FASES.map((f, idx) => ({
      faseId: f.faseId,
      seq: idx + 1,
      fase: f.descripcion,
      area: '',
      notes: '',
      promptIA: '',
    }));
  }, [productoSeleccionado]);

  // Sync fase data when productoSeleccionado becomes available (for editing existing solicitudes)
  useEffect(() => {
    if (!productoSeleccionado || loadingProductos) return;
    // No sobreescribir si la solicitud ya fue aprobada/completada
    if (formData.estatusSolicitud === 'Aprobado' || formData.descripcionFase === 'Completada') return;

    const rd = productoSeleccionado.rawData;
    const raw = (Array.isArray(rd?.fases) && rd.fases.length > 0 ? rd.fases : null)
      ?? (Array.isArray(rd?.fasesRegistros) && rd.fasesRegistros.length > 0 ? rd.fasesRegistros : null)
      ?? (Array.isArray(rd?.fase) ? rd.fase : null);
    if (!Array.isArray(raw) || raw.length === 0) return;

    // Buscar la fase que coincide con formData.faseId, o usar la primera
    const fase = raw.find((f: any, idx: number) => {
      const fId = String(f.id ?? f.fase_id ?? f.seq ?? idx + 1);
      return fId === formData.faseId;
    }) || raw[0];

    const faseData = {
      faseId: String(fase.id ?? fase.fase_id ?? fase.seq ?? '1'),
      fase: fase.fase || fase.descripcion || '',
      area: fase.area || '',
      promptIA: fase.promptIA || '',
    };

    // Sync si: faseId no coincide, descripción no coincide, o faltan nombreProducto/tipoProducto
    const faseIdMismatch = formData.faseId && formData.faseId !== faseData.faseId;
    const needsFaseSync = !!(faseData.fase && faseData.fase !== formData.descripcionFase);
    const needsNombreProducto = !formData.nombreProducto && !!productoSeleccionado.nombreProducto;
    const needsTipoProducto = !formData.tipoProducto && !!productoSeleccionado.sublineaProducto;

    if (faseIdMismatch || needsFaseSync || needsNombreProducto || needsTipoProducto) {
      setFormData(prev => ({
        ...prev,
        ...(faseIdMismatch || needsFaseSync ? {
          faseId: faseData.faseId,
          descripcionFase: faseData.fase,
          area: faseData.area,
          promptIAFase: faseData.promptIA,
        } : {}),
        nombreProducto: prev.nombreProducto || productoSeleccionado.nombreProducto || '',
        tipoProducto: prev.tipoProducto || productoSeleccionado.sublineaProducto || '',
      }));
    }
  }, [productoSeleccionado, loadingProductos]); // eslint-disable-line react-hooks/exhaustive-deps

  const [enviandoFase, setEnviandoFase] = useState(false);

  // Clave para forzar remount de ExpedienteElectronicoTab tras auto-generar docs en Fase 4
  const [expedienteKey, setExpedienteKey] = useState(0);
  /** REQ-13 — folios a mostrar en la pantalla de éxito tras formalizar (solo GPO). */
  const [formalizacionExitosaGPO, setFormalizacionExitosaGPO] = useState<{
    idGarantiaCartera: string; polizaContableApertura: string;
  } | null>(null);

  // Debug IA de fases — registro del último intento de validación IA al enviar fase
  const [iaFaseDebug, setIaFaseDebug] = useState<{
    faseSeq: number;
    faseNombre: string;
    promptIA: string;
    docsEnContexto: number;
    payload: object;
    status: 'pending' | 'ok' | 'error' | 'skipped';
    httpStatus?: number;
    resultado?: any;
    errorMsg?: string;
    timestamp: string;
  } | null>(null);
  const [showIAFaseDebug, setShowIAFaseDebug] = useState(false);

  // ── Solicitudes de Activación del módulo externo ────────────────────────────
  // Cargamos cuando la solicitud ya existe (storageId válido) para poder detectar
  // si hay un registro existente y mostrarlo en modo ver/editar correctamente.
  const { solicitudesActivacion, refetch: refetchActivaciones } =
    useSolicitudesActivacionDB(mode !== 'nuevo' && storageId !== 'new');

  // Modal de Solicitud de Activación
  const [showActivacionModal,   setShowActivacionModal]   = useState(false);
  const [activacionModalRO,     setActivacionModalRO]     = useState(false);

  // Solicitud de Activación vinculada a ESTA originación (por solicitudId = storageId)
  const activacionForThisSol = useMemo(() =>
    solicitudesActivacion.find(
      s => s.solicitudId === String(storageId) || s.solicitudId === storageId
    ) as SolicitudActivacionListItem | undefined,
    [solicitudesActivacion, storageId]
  );

  // Determina si el botón "Activar Cuenta" está habilitado (Fase 7)
  const canActivarCuenta = useMemo(() => {
    const linea = (formData.lineaProducto || '').toLowerCase();
    const isLineaCredito =
      (linea.includes('línea') || linea.includes('linea')) &&
      (linea.includes('créd') || linea.includes('cred'));
    // Línea de Crédito: no requiere validación de pago
    if (isLineaCredito) return true;
    // Crédito / Captación: requiere Solicitud de Activación con estatus "Enviada", "Pagado" o "Autorizada"
    const est = (activacionForThisSol?.estatus || '').toLowerCase().trim();
    return est === 'enviada' || est === 'pagado' || est === 'autorizada';
  }, [activacionForThisSol, formData.lineaProducto]);

  // (Auto-generación de documentos en Fase 4 eliminada — los PDFs se generan
  //  manualmente con "Formalizar Contrato" y el usuario los firma y sube al expediente.)

  /**
   * REQ-10 — [Procesar Grado de Riesgo y Generar Dictamen].
   * El subtab ya validó; aquí sólo se arma el PDF y se adjunta al Expediente.
   */
  const handleProcesarDictamenRiesgo = useCallback(async (datos: any, resumen: any) => {
    try {
      const res = await autoCrearDictamenRiesgo({
        storageId,
        datos: {
          noSol: formData.noSol || '',
          cliente: formData.denominacionRazonSocial || `${formData.nombrePersona || ''} ${formData.apellidoPaternoPersona || ''}`.trim() || 'Cliente',
          lineaProducto: formData.lineaProducto || '',
          tipoProducto: formData.tipoProducto || '',
          productoNombre: productoSeleccionado?.nombreProducto || formData.nombreProducto || '',
          terminos: loadFromSession<any>(storageId, 'terminos') || loadFromSavedStore<any>(storageId, 'terminos') || {},
        },
        riesgo: {
          fuentePrimariaIngreso: datos.fuentePrimariaIngreso,
          montoFondoReserva: parseFloat(String(datos.montoFondoReservaFideicomiso || '0')) || 0,
          plazoBonosAnios: datos.proyecciones.length,
          dscrPromedio: resumen.promedio,
          semaforo: resumen.semaforo,
          dictamenTexto: datos.dictamenRiesgoTexto,
          proyecciones: datos.proyecciones.map((f: any) => ({
            anio: f.anio,
            ebitda: parseFloat(String(f.flujoCajaNetoOperativo || f.ebitdaProyectado || '0')) || 0,
            servicioDeuda: parseFloat(String(f.servicioDeudaBursatil || '0')) || 0,
            dscr: dscrDeFila(f),
          })),
        },
        faseNombre: formData.descripcionFase,
        faseId: parseInt(formData.faseId) || 2,
        supabase,
        projectId,
      });
      if (res.documentosCreados.length > 0) {
        if (res.registradosEnExpediente) {
          toast.success('Dictamen de Riesgo generado', {
            description: `Semáforo ${resumen.semaforo} · DSCR ${resumen.promedio === null ? '—' : resumen.promedio.toFixed(2)} — adjuntado al Expediente Electrónico.`,
            duration: 8000,
          });
        } else {
          toast.warning('Dictamen generado, pero NO se guardó en base de datos', {
            description: res.error || 'Error desconocido al persistir.',
            duration: 12000,
          });
        }
      } else {
        toast.info('El Dictamen ya existía', { description: 'No se generó un duplicado.', duration: 5000 });
      }
      setExpedienteKey(k => k + 1);
    } catch (err: any) {
      toast.error('Error al generar el Dictamen de Riesgo', { description: err?.message || String(err), duration: 8000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageId, formData, productoSeleccionado]);

  /**
   * REQ-12 — [Emitir Oficio de Autorización y Bloquear Cupo].
   * El subtab valida el Registro Legal y arma el payload; aquí se intenta la
   * reserva atómica de cupo (RPC `reservar_cupo_gpo`, necesita el cliente de
   * Supabase) y se genera/adjunta el Oficio. El resultado se regresa al
   * subtab para que persista su propio cupoReservado/cupoMensaje.
   */
  const handleEmitirOficioCIC = useCallback(async (payload: EmitirOficioPayload): Promise<EmitirOficioResultado> => {
    let cupoReservado = false;
    let cupoMensaje = 'No aplica — la operación fue rechazada, no se reserva capacidad.';
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Si ya se reservó cupo antes para esta Solicitud (persistido en un click
    // anterior), NO se vuelve a llamar el RPC — reservar_cupo_gpo no es
    // idempotente por sí mismo (no sabe si esta Solicitud ya tiene una
    // reserva), y reintentar "Emitir Oficio" (p. ej. tras recargar sin haber
    // guardado) descontaría el monto una segunda vez del límite global.
    const previa = leerResolucionCIC(storageId);
    const yaReservado = previa.cupoReservado === true;

    if (yaReservado) {
      cupoReservado = true;
      cupoMensaje = previa.cupoMensaje || 'Cupo ya estaba reservado.';
    } else if (payload.registroLegal.estatusResolucion === 'Aprobada por CIC') {
      if (payload.montoOperacion <= 0) {
        cupoMensaje = 'No se pudo determinar el monto de la operación — revise Términos y Condiciones.';
      } else if (storageId === 'new' || !UUID_RE.test(String(storageId))) {
        cupoMensaje = 'La Solicitud aún no tiene ID de BD — guárdela antes de bloquear cupo.';
      } else {
        const { data, error } = await supabase.rpc('reservar_cupo_gpo', {
          p_clave: 'GPO_GLOBAL',
          p_monto: payload.montoOperacion,
          p_solicitud_id: storageId,
          p_folio_oficio: null,
        });
        if (error) {
          // El RPC puede no existir todavía si create_rpc_bloqueo_cupo_gpo.sql no se ha corrido.
          cupoMensaje = `No se pudo bloquear el cupo: ${error.message}. ` +
            'Verifique que la migración create_rpc_bloqueo_cupo_gpo.sql esté aplicada en Supabase.';
        } else {
          const fila = Array.isArray(data) ? data[0] : data;
          cupoReservado = !!fila?.ok;
          cupoMensaje = fila?.mensaje || (cupoReservado ? 'Cupo reservado.' : 'No se pudo reservar el cupo.');
          if (fila?.saldo_disponible != null) {
            cupoMensaje += ` Saldo disponible: ${formatCurrency(Number(fila.saldo_disponible))}.`;
          }
        }
      }
    }

    try {
      const res = await autoCrearOficioCIC({
        storageId,
        datos: {
          noSol: formData.noSol || '',
          cliente: formData.denominacionRazonSocial || `${formData.nombrePersona || ''} ${formData.apellidoPaternoPersona || ''}`.trim() || 'Cliente',
          lineaProducto: formData.lineaProducto || '',
          tipoProducto: formData.tipoProducto || '',
          productoNombre: productoSeleccionado?.nombreProducto || formData.nombreProducto || '',
          terminos: loadFromSession<any>(storageId, 'terminos') || loadFromSavedStore<any>(storageId, 'terminos') || {},
        },
        datosOficio: {
          numeroActaCIC: payload.registroLegal.numeroActaCIC,
          fechaSesionCIC: payload.registroLegal.fechaSesionCIC,
          estatusResolucion: payload.registroLegal.estatusResolucion,
          montoOperacion: payload.montoOperacion,
          cupoReservado,
          cupoMensaje,
          votos: payload.votos,
        },
        faseNombre: formData.descripcionFase,
        faseId: parseInt(formData.faseId) || 3,
        supabase,
        projectId,
      });
      // Espejar en memoria, igual que documentosDelTabRef en el resto del form:
      // si sessionStorage rechazó el guardado por cuota (documentos con PDFs
      // en base64 la agotan fácil), el remount de Expediente Electrónico NO
      // debe quedarse con la lista vieja sólo porque la caché local falló —
      // la persistencia en BD (arriba) sí ocurrió igual.
      if (res.documentosActualizados) {
        documentosDelTabRef.current = res.documentosActualizados;
      }
      if (res.documentosCreados.length > 0) {
        if (res.registradosEnExpediente) {
          toast.success('Oficio de Autorización emitido', { description: cupoMensaje, duration: 9000 });
        } else {
          toast.warning('Oficio generado, pero NO se guardó en base de datos', {
            description: res.error || 'Error desconocido al persistir.',
            duration: 12000,
          });
        }
      } else {
        toast.info('El Oficio ya existía', { description: 'No se generó un duplicado.', duration: 5000 });
      }
      if (payload.registroLegal.estatusResolucion === 'Aprobada por CIC') {
        if (cupoReservado) {
          toast.success('Cupo bloqueado', { description: cupoMensaje, duration: 9000 });
        } else {
          toast.error('Cupo NO bloqueado', { description: cupoMensaje, duration: 12000 });
        }
      }
      setExpedienteKey(k => k + 1);
    } catch (err: any) {
      toast.error('Error al emitir el Oficio', { description: err?.message || String(err), duration: 8000 });
    }

    if (payload.registroLegal.estatusResolucion) {
      setFormData(prev => ({ ...prev, estatusSolicitud: payload.registroLegal.estatusResolucion }));
    }

    return { cupoReservado, cupoMensaje };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageId, formData, productoSeleccionado]);

  const handleEnviarFase = useCallback(async () => {
    // En modo originación siempre se permite; en otros modos respeta isRO
    if ((isRO && modo !== 'originacion') || enviandoFase) return;
    setEnviandoFase(true);
    try {
      // ── 1. Encontrar faseActualReal por faseId (NO por índice) ──
      const faseActualReal = fasesDelProducto.find(f => String(f.faseId) === String(formData.faseId));
      const seqActual = faseActualReal?.seq ?? (parseInt(formData.faseId) || 1);

      // ── 2. Obtener documentos cargados (Sección 2) y requisitos (Sección 1) ──
      // Cuatro fuentes, en orden de confiabilidad. El subtab manda cuando esta
      // montado; el storage es el respaldo historico; y el JSONB original de la
      // BD cierra el hueco cuando sessionStorage se quedo sin cuota (los
      // documentos llevan el archivo en base64 y la agotan facil).
      const docsEnMemoria = documentosDelTabRef.current;
      const docsSession = loadFromSession<DocumentoCargado[]>(storageId, 'documentos');
      const docsSaved = loadFromSavedStore<DocumentoCargado[]>(storageId, 'documentos');
      const origData: any =
        loadFromSession<any>(storageId, '_originalData') ||
        loadFromSavedStore<any>(storageId, '_originalData');
      const docsDeBD: DocumentoCargado[] = Array.isArray(origData?.solicitud?.expediente_electronico?.documentos)
        ? origData.solicitud.expediente_electronico.documentos.map((d: any, i: number) => ({
            id: d.id || (i + 1),
            tipoDocumento: String(d.tipo_documento || d.tipoDocumento || '').trim(),
            archivo: d.archivo_adjunto || d.archivo || '',
            url: d.url || '',
            storagePath: d.storage_path || '',
            estatus: d.estatus || 'Pendiente',
            faseId: d.fase_id ?? d.faseId ?? null,
          } as any))
        : [];
      const documentos: DocumentoCargado[] =
        (docsEnMemoria && docsEnMemoria.length > 0 ? docsEnMemoria : null) ||
        (docsSession && docsSession.length > 0 ? docsSession : null) ||
        (docsSaved && docsSaved.length > 0 ? docsSaved : null) ||
        (docsDeBD.length > 0 ? docsDeBD : null) ||
        [];
      console.warn(`[avanzarFase] origen de documentos → ref=${docsEnMemoria?.length ?? 'null'} session=${docsSession?.length ?? 'null'} saved=${docsSaved?.length ?? 'null'} bd=${docsDeBD.length} | usados=${documentos.length} | storageId=${String(storageId)}`);
      const rawData = productoSeleccionado?.rawData as Record<string, any> | undefined;
      const requisitosProducto = getRequisitosFromRawData(rawData);

      // ── Detectar "Activación Cuenta Financiera" en Línea de Crédito ──────────
      const faseNombre = faseActualReal?.fase || formData.descripcionFase || `Fase ${seqActual}`;
      const lpLower = (formData.lineaProducto || '').toLowerCase();
      const esLineaCredito = lpLower.includes('nea') && lpLower.includes('cr');
      const esActivacionCuentaFinanciera = esLineaCredito && faseNombre.toLowerCase().includes('activac');

      // ── Activación Cuenta Financiera: manejo completo aquí, sin IA ──────
      if (esActivacionCuentaFinanciera) {
        const toastActiv = toast.loading('Autorizando solicitud...', { description: faseNombre });
        const UUID_R = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        // Priorizar formData.id (UUID real de BD) sobre storageId (puede ser número)
        const dbIdAct = UUID_R.test(String(formData.id || ''))
          ? String(formData.id)
          : UUID_R.test(String(storageId))
            ? String(storageId)
            : '';
        const API_ACT = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
        const sigFaseAct = fasesDelProducto.find(f => f.seq === seqActual + 1);
        let activadoEnBD = false;

        // Intento 1: endpoint transaccional /activar-cuenta-financiera
        try {
          const res = await fetch(`${API_ACT}/activar-cuenta-financiera`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
            body: JSON.stringify({
              solicitud_id:  UUID_R.test(dbIdAct) ? dbIdAct : null,
              usuario_id:    (formData as any)._userId || '',
              fase_actual:   faseNombre,
              fase_siguiente: sigFaseAct?.fase || null,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            activadoEnBD = data.valido !== false;
          } else {
          }
        } catch (e: any) {
        }

        // Intento 2 (fallback): actualizar estatus directo desde frontend
        if (!activadoEnBD && UUID_R.test(dbIdAct)) {
          await actualizarEstatusSolicitudDB(dbIdAct, 'Autorizada').catch(() => {});
        }

        // Crear cuenta nueva en J_CUENTAS_CORP_CLIENTES para esta solicitud autorizada
        if (dbIdAct) {
          crearCuentaDesdeSolicitudDB({
            solicitudId:     dbIdAct,
            clienteId:       formData._clienteId || '',
            productoId:      formData.productoId || '',
            noSol:           formData.noSol || '',
            lineaProducto:   formData.lineaProducto || '',
            tipoProducto:    formData.tipoProducto || '',
            montoSolicitado: parseFloat(String(formData.montoSolicitado || 0)) || undefined,
            montoAutorizado: parseFloat(String(formData.montoAutorizado || formData.montoSolicitado || 0)) || undefined,
          }).then(r => {
            if (r.ok && r.noCuenta) {
              toast.success('Cuenta creada en módulo Cuentas de Ahorro', {
                description: `No. Cuenta: ${r.noCuenta} — ${formData.lineaProducto}`,
              });
            } else if (!r.ok) {
            }
          });
        }

        toast.dismiss(toastActiv);
        setFormData(prev => ({ ...prev, estatusSolicitud: 'Autorizada' }));
        toast.success('Solicitud autorizada — flujo finalizado', {
          description: sigFaseAct ? `Siguiente: ${sigFaseAct.fase}` : faseNombre,
          duration: 8000,
        });
        return;
      }

      // ── REQ-9: Estructura Operativa de 2o Piso obligatoria al salir de Admisión ──
      // Es el botón [Validar Ecosistema y Crear Expediente de Riesgo] del BPM: no se
      // crea uno nuevo, se le agrega esta condición al avance existente.
      if (esGPOForm) {
        const nombreFaseActual = (faseNombre || '')
          .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const saliendoDeAdmision = nombreFaseActual.includes('admision') || nombreFaseActual.includes('ecosistema');
        if (saliendoDeAdmision) {
          const est = estructura2oPisoRef.current || leerEstructura2oPiso(storageId);
          const faltan = faltantesEstructura2oPiso(est);
          if (faltan.length > 0) {
            toast.error('No se puede avanzar de fase', {
              description: `Estructura Operativa de 2o Piso incompleta: ${faltan.join(' · ')}`,
              duration: 10000,
            });
            return;
          }
        }
      }

      // ── REQ-10: Análisis de Grado de Riesgo completo antes de ir a Comités ──
      // "Si los flujos son muy ajustados, el Core detendrá el proceso": semáforo
      // Rojo bloquea de forma dura (decisión de negocio 27/08/2026).
      if (esGPOForm) {
        const nf = (faseNombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const saliendoDeRiesgo = nf.includes('grado de riesgo') || nf.includes('analisis de grado');
        if (saliendoDeRiesgo) {
          const mv = modeloViabilidadRef.current || leerModeloViabilidad(storageId);
          const faltanMv = faltantesModeloViabilidad(mv);
          if (faltanMv.length > 0) {
            toast.error('No se puede avanzar de fase', {
              description: `Análisis de Grado de Riesgo incompleto: ${faltanMv.join(' · ')}`,
              duration: 12000,
            });
            return;
          }
        }
      }

      // ── REQ-12: Resolución Final del CIC completa antes de salir del Comité ──
      // El bloqueo de cupo es la condición dura del requerimiento: si el CIC
      // aprobó pero el cupo no quedó reservado, no se deja avanzar — es
      // justamente el "impedir que el banco comprometa esa misma capacidad
      // en otros proyectos" del BPM.
      if (esGPOForm) {
        const nf3 = (faseNombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const saliendoDeComitePrepago = nf3.includes('comite') && nf3.includes('prepago');
        if (saliendoDeComitePrepago) {
          // Actividad 6.1 — sin votos del CPC no hay nada que el CIC pueda resolver.
          const votacion = leerVotacionCPC(storageId);
          if (votacion.votos.length === 0) {
            toast.error('No se puede avanzar de fase', {
              description: 'Votación CPC incompleta: no hay ningún voto registrado.',
              duration: 10000,
            });
            return;
          }
          const rc = resolucionCICRef.current || leerResolucionCIC(storageId);
          const faltanRc = faltantesResolucionCIC(rc);
          if (faltanRc.length > 0) {
            toast.error('No se puede avanzar de fase', {
              description: `Resolución Final del CIC incompleta: ${faltanRc.join(' · ')}`,
              duration: 12000,
            });
            return;
          }
        }
      }

      // ── Actividad 7.1: Validación de Cláusulas Fiduciarias completa antes de salir de Fase 4 ──
      if (esGPOForm) {
        const nf4 = (faseNombre || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        const saliendoDeClausulasFiduciarias = nf4.includes('clausulas fiduciarias') || nf4.includes('clausulas fiduciari');
        if (saliendoDeClausulasFiduciarias) {
          const vc = validacionClausulasRef.current || leerValidacionClausulas(storageId);
          const faltanVc = faltantesValidacionClausulas(vc);
          if (faltanVc.length > 0) {
            toast.error('No se puede avanzar de fase', {
              description: `Validación de Cláusulas Fiduciarias incompleta: ${faltanVc.join(' · ')}`,
              duration: 12000,
            });
            return;
          }

          // ── REQ-14: Propuesta de Contrato GPO desde la plantilla del producto ──
          // Se genera con lo ya capturado en Solicitud + Términos + Estructura
          // Operativa 2o Piso + Cláusulas Fiduciarias, y se adjunta al requisito
          // del Expediente. RN-03: NUNCA bloquea el cierre — si no hay plantilla
          // activa o el render falla, se avisa y el avance de fase continúa.
          try {
            const est4 = estructura2oPisoRef.current || leerEstructura2oPiso(storageId);
            const clienteExtra4 = await obtenerDatosCliente();
            const rawData4 = productoSeleccionado?.rawData as Record<string, any> | undefined;
            const plantillas4 =
              (Array.isArray(productoSeleccionado?.plantillas) && productoSeleccionado!.plantillas!.length > 0
                ? productoSeleccionado!.plantillas
                : null) ??
              (Array.isArray(rawData4?.plantillas) ? rawData4!.plantillas : []);
            const resContrato = await autoCrearPropuestaContratoGPO({
              storageId,
              datos: {
                noSol: formData.noSol || '',
                cliente:
                  formData.denominacionRazonSocial ||
                  `${formData.nombrePersona || ''} ${formData.apellidoPaternoPersona || ''}`.trim() ||
                  clienteExtra4.nombreDB ||
                  'Cliente',
                lineaProducto: formData.lineaProducto || '',
                tipoProducto: formData.tipoProducto || '',
                productoNombre: productoSeleccionado?.nombreProducto || formData.nombreProducto || '',
                terminos:
                  loadFromSession<any>(storageId, 'terminos') ||
                  loadFromSavedStore<any>(storageId, 'terminos') ||
                  {},
                ...clienteExtra4,
                sucursal: formData.sucursal || '',
                finalidad: formData.descripcion || '',
              },
              datosContrato: {
                estructura: est4,
                clausulas: vc,
                institucionGobierno:
                  (formData as any)._gobierno || clienteExtra4.gobierno || '',
              },
              plantillas: plantillas4 as any,
              faseNombre: formData.descripcionFase,
              faseId: parseInt(formData.faseId) || 4,
              supabase,
              projectId,
            });
            if (resContrato.documentosActualizados) {
              documentosDelTabRef.current = resContrato.documentosActualizados;
            }
            if (resContrato.documentosCreados.length > 0) {
              if (resContrato.registradosEnExpediente) {
                toast.success('Propuesta de Contrato GPO generada', {
                  description: 'Adjuntada al Expediente Electrónico de la Solicitud.',
                  duration: 8000,
                });
              } else {
                toast.warning('Propuesta generada, pero NO se guardó en base de datos', {
                  description: resContrato.error || 'Error desconocido al persistir.',
                  duration: 12000,
                });
              }
            } else if (!resContrato.exito) {
              toast.warning('No se generó la Propuesta de Contrato GPO', {
                description:
                  resContrato.validacionPlantillas.motivos[0] ||
                  resContrato.error ||
                  'Revise el subtab Plantillas del producto.',
                duration: 12000,
              });
            }
            setExpedienteKey(k => k + 1);
          } catch (err: any) {
            toast.warning('No se generó la Propuesta de Contrato GPO', {
              description: err?.message || String(err),
              duration: 10000,
            });
          }

          // ── REQ-15: Cargos de la Solicitud desde el subtab Cargos del producto ──
          // Del producto se toma sólo el CONCEPTO (tipo de cargo + descripción);
          // el monto de cada cargo es el Monto Garantizado GPO de Términos.
          // No bloquea el avance de fase: si falta configuración, se avisa.
          try {
            const rawProd4 = productoSeleccionado?.rawData as Record<string, any> | undefined;
            const cargosProducto: any[] =
              (Array.isArray((productoSeleccionado as any)?.cargos)
                ? (productoSeleccionado as any).cargos
                : null) ??
              (Array.isArray(rawProd4?.cargo) ? rawProd4!.cargo : []);
            const terminosGPO: any =
              loadFromSession<any>(storageId, 'terminos') ||
              loadFromSavedStore<any>(storageId, 'terminos') ||
              {};
            const montoGarantizado =
              parseFloat(parseCurrency(String(terminosGPO.montoGarantizadoGpo || '0'))) || 0;

            if (cargosProducto.length === 0) {
              toast.warning('No se generaron cargos', {
                description: 'El producto no tiene cargos configurados en su subtab Cargos.',
                duration: 10000,
              });
            } else if (montoGarantizado <= 0) {
              toast.warning('No se generaron cargos', {
                description: 'La Solicitud no tiene Monto Garantizado GPO en Términos y Condiciones.',
                duration: 10000,
              });
            } else {
              const cargosPrevios: any[] =
                loadFromSession<any[]>(storageId, 'cargos') ||
                loadFromSavedStore<any[]>(storageId, 'cargos') ||
                [];
              const claveCargo = (t: string, d: string) =>
                `${(t || '').trim().toLowerCase()}|${(d || '').trim().toLowerCase()}`;
              const yaEstan = new Set(
                cargosPrevios.map((c: any) => claveCargo(c.tipoCargo, c.descripcion)),
              );
              const hoyISO = new Date().toISOString().slice(0, 10);
              const nuevosCargos = cargosProducto
                .filter((c: any) => !yaEstan.has(claveCargo(c.tipoCargo, c.descripcion)))
                .map((c: any, i: number) => ({
                  id: Date.now() + i,
                  tipoCargo: c.tipoCargo || '',
                  descripcion: c.descripcion || '',
                  monto: montoGarantizado,
                  fechaCargo: hoyISO,
                  estatus: 'Pendiente',
                  notas:
                    'Generado automáticamente desde el subtab Cargos del producto al ejecutar ' +
                    'la Formalización Legal. Monto = Monto Garantizado GPO.',
                }));

              if (nuevosCargos.length === 0) {
                toast.info('Los cargos ya estaban generados', {
                  description: 'No se duplicaron.',
                  duration: 6000,
                });
              } else {
                const todosLosCargos = [...cargosPrevios, ...nuevosCargos];
                saveToSession(storageId, 'cargos', todosLosCargos);
                saveToSavedStore(storageId, 'cargos', todosLosCargos);
                // Cargos sólo viaja a BD cuando se incluye explícitamente en
                // _allSubtabs — mismo camino que usa el envío a originación.
                try {
                  await onSave?.({ ...formData, _allSubtabs: { cargos: todosLosCargos } });
                } catch (saveErr: any) {
                  toast.warning('Cargos generados, pero no se persistieron en BD', {
                    description: saveErr?.message || String(saveErr),
                    duration: 12000,
                  });
                }
                toast.success(`${nuevosCargos.length} cargo(s) generados en la Solicitud`, {
                  description:
                    `${nuevosCargos.map((c: any) => c.tipoCargo).filter(Boolean).join(', ')} — ` +
                    `${formatCurrency(montoGarantizado)} cada uno.`,
                  duration: 9000,
                });
              }
            }
          } catch (err: any) {
            toast.warning('No se generaron los cargos de la Solicitud', {
              description: err?.message || String(err),
              duration: 10000,
            });
          }
        }
      }

      // ── 3. Validar documentos obligatorios de la fase actual (Sección B) ──
      if (!esActivacionCuentaFinanciera) {
        const valFase = validarDocumentosPorFase(
          seqActual, faseNombre, requisitosProducto, documentos, formData.tipoPersona,
        );
        if (!valFase.valido) {
          // Solo faltantes (sin archivo o rechazados) bloquean el avance.
          //
          // Se muestra el MOTIVO de cada uno, no sólo el nombre: "faltante"
          // agrupa casos muy distintos — no cargado, cargado pero sin archivo
          // adjunto, o rechazado. Con sólo el nombre el usuario ve el documento
          // en pantalla (y hasta validado), da por hecho que está bien, y el
          // aviso parece estar mintiendo.
          const motivosDeFaltantes = valFase.motivos.filter(m =>
            valFase.faltantes.some(f => m.startsWith(`"${f}"`)),
          );
          const detalle = (motivosDeFaltantes.length > 0 ? motivosDeFaltantes : valFase.faltantes)
            .slice(0, 3).join(' · ')
            + (valFase.faltantes.length > 3 ? ` (+${valFase.faltantes.length - 3} más)` : '');
          // Traza completa para diagnóstico: incluye los motivos de TODOS.
          console.warn('[avanzarFase] bloqueado — motivos:', valFase.motivos);
          console.warn('[avanzarFase] documentos vistos:', documentos.map(d => `"${d.tipoDocumento}" faseId=${d.faseId} estatus=${d.estatus}`));
          toast.error('No se puede avanzar de fase', {
            description: detalle,
            duration: 10000,
          });
          return;
        }
        // Advertencia no bloqueante: docs cargados pero pendientes de validación IA
        if (valFase.pendientesValidacion.length > 0) {
          toast.warning('Documentos pendientes de validación IA', {
            description: valFase.pendientesValidacion.slice(0, 3).join(', '),
            duration: 5000,
          });
        }
      }

      // ── Detección Arrendamiento Puro + nombre de fase normalizado ──
      // Se calcula aquí (antes del paso 3a) porque la Fase 4 de Arrendamiento
      // Puro necesita saltar la validación IA genérica: esa IA sólo ve
      // documentos del Expediente Electrónico y nunca tuvo visibilidad de las
      // facturas de Cobranza, así que siempre reporta "falta la factura"
      // aunque ya esté generada y pagada (paso 3b-bis, más abajo, es la
      // validación real para esa fase).
      const faseNombreNorm = (faseActualReal?.fase || formData.descripcionFase || '')
        .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const tpNorm = (formData.tipoProducto || '').toLowerCase();
      // Puro y Financiero: misma fase de Recaudación, misma omisión de validación.
      const esArrPuro = esArrendamiento(formData.lineaProducto, formData.tipoProducto);
      const esFaseRecaudacionArrPuro = esArrPuro && faseNombreNorm.includes('recaudacion') && faseNombreNorm.includes('compra');
      console.log('[DIAG Fase4] tipoProducto:', JSON.stringify(formData.tipoProducto), '| tpNorm:', JSON.stringify(tpNorm), '| esArrPuro:', esArrPuro, '| faseActualReal?.fase:', JSON.stringify(faseActualReal?.fase), '| descripcionFase:', JSON.stringify(formData.descripcionFase), '| faseNombreNorm:', JSON.stringify(faseNombreNorm), '| esFaseRecaudacionArrPuro:', esFaseRecaudacionArrPuro, '| seqActual:', seqActual);

      // ── 3a. Validación IA con el prompt de la fase ──
      // Usa faseActualReal.promptIA; si no resuelve (faseActualReal nulo), usa formData.promptIAFase.
      // Se omite por completo en la fase de Recaudación de Arrendamiento Puro:
      // esa fase se valida en el paso 3b-bis contra el registro real de Cobranza.
      const fasePromptIA = esFaseRecaudacionArrPuro ? '' : (faseActualReal?.promptIA || (formData as any).promptIAFase || '');

      // Si todos los documentos requeridos de esta fase ya están validados por IA,
      // la validación de fase es redundante — saltar directo al avance.
      const docsRequeridosFase = requisitosProducto.filter((r: any) => {
        const rFaseId = Number(r.faseId ?? r.fase_id ?? 0);
        if (rFaseId !== seqActual) return false;
        return r.obligatorio !== false;
      });
      const todosValidados = docsRequeridosFase.length > 0 && docsRequeridosFase.every((req: any) => {
        const tipoReq = (req.tipoDocumento || req.tipo_documento || '').toLowerCase();
        return documentos.some(d =>
          (d.tipoDocumento || '').toLowerCase().includes(tipoReq.substring(0, 8)) &&
          d.validadoIA === true &&
          d.estatus === 'Validado'
        );
      });

      if (fasePromptIA && !todosValidados) {
        const toastIA = toast.loading(`Validando fase con IA: "${faseNombre}"...`, {
          description: 'Enviando datos de documentos al validador IA...',
        });

        try {
          // Contexto: todos los docs de esta fase O ANTERIORES (dId <= seqActual)
          // Docs sin faseId (banca móvil) se incluyen — no tienen fase asignada pero están cargados
          const docsDeFase = documentos.filter(d => {
            if (d.faseId == null) return true;
            const dId = Number(d.faseId);
            if (isNaN(dId) || dId === 0) return true; // sin fase → incluir
            return dId <= seqActual;
          });

          const contextoDocs = docsDeFase.map(d => ({
            tipoDocumento: d.tipoDocumento,
            estatus: d.estatus,
            validadoIA: d.validadoIA,
            tieneArchivo: !!(d.archivo || (d as any).url || (d as any).storagePath || (d as any).fileData),
            faseId: d.faseId ?? 0,
            ia_motivos: (d as any).iaMotivos || [],
            ia_extraido: (d as any).iaExtraido || {},
          }));

          // Resumen claro de documentos para el prompt
          const resumenDocs = contextoDocs.map(d => {
            const archivoTag = d.tieneArchivo ? '[ARCHIVO PRESENTE]' : '[SIN ARCHIVO]';
            const faseTag = d.faseId > 0 ? `[Fase ${d.faseId}]` : '[Sin fase/Banca Móvil]';
            const estado = d.validadoIA
              ? (d.estatus === 'Validado' ? '✓ VALIDADO POR IA' : d.estatus === 'Rechazado' ? '✗ RECHAZADO POR IA' : d.estatus)
              : `○ CARGADO ${archivoTag} (pendiente de validación IA)`;
            return `- ${d.tipoDocumento} ${faseTag}: ${estado}` +
              (d.ia_motivos?.length ? ` | ${d.ia_motivos.slice(0, 2).join('; ')}` : '');
          }).join('\n');

          // Conteo de documentos
          const docsValidados = contextoDocs.filter(d => d.validadoIA && d.estatus === 'Validado').length;
          const docsCargados = contextoDocs.length;
          const docsRechazados = contextoDocs.filter(d => d.validadoIA && d.estatus === 'Rechazado').length;
          const docsPendientes = contextoDocs.filter(d => !d.validadoIA).length;

          const API_BASE_FASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
          const nombreCliente = [formData.nombrePersona, formData.apellidoPaternoPersona].filter(Boolean).join(' ') || 'Cliente';

          // Requisitos obligatorios de esta fase (Sección 1 del expediente)
          const clienteTipoPersonaLower = (formData.tipoPersona || '').toLowerCase();
          const requisitosDeEstaFase = requisitosProducto.filter((r: any) => {
            const rFaseId = Number(r.faseId ?? r.fase_id ?? 0);
            if (rFaseId !== seqActual) return false;
            // Filtrar por tipo de persona: excluir docs que no aplican al cliente
            const docPersona = String(r.tipoPersona || '').toLowerCase();
            if (docPersona && docPersona !== 'todos' && docPersona !== 'all') {
              const esMoral = clienteTipoPersonaLower.includes('moral');
              if (docPersona.includes('moral') && !esMoral) return false;
              if (!docPersona.includes('moral') && esMoral) return false;
            }
            return true;
          }).map((r: any) => ({
            tipoDocumento: r.tipoDocumento || r.tipo_documento,
            obligatorio: r.obligatorio !== false,
            area: r.area || '',
          }));

          const terminos = loadFromSession<any>(storageId, 'terminos')
            || loadFromSavedStore<any>(storageId, 'terminos')
            || {};

          // Construir prompt enriquecido con todos los datos embebidos directamente
          const reqResumen = requisitosDeEstaFase.length > 0
            ? requisitosDeEstaFase.map((r: any) =>
                `  - ${r.tipoDocumento}${r.obligatorio ? ' (OBLIGATORIO)' : ' (opcional)'}${r.area ? ` [${r.area}]` : ''}`
              ).join('\n')
            : '  Sin requisitos configurados para esta fase.';

          // ── Payload e instrucción de respuesta según tipo de fase ────────────
          let promptConContexto: string;
          let payloadFaseIA: Record<string, any>;

          {
            promptConContexto =
              (fasePromptIA || '') + '\n\n' +
              'INSTRUCCIÓN IMPORTANTE: Algunos documentos provienen de banca móvil y pueden tener nombres ' +
              'abreviados o en formato snake_case (ej: "ine", "identificacion_oficial", "comprobante_domicilio"). ' +
              'Debes hacer matching SEMÁNTICO: si el nombre del documento cargado corresponde al tipo requerido ' +
              '(aunque el texto sea diferente), considera que SÍ está cubierto. Documentos sin fase asignada ' +
              '(faseId=0 o vacío) también deben considerarse presentes para la validación.\n\n' +
              '=== DATOS DEL CLIENTE ===\n' +
              `Nombre: ${nombreCliente}\n` +
              `Tipo persona: ${formData.tipoPersona || 'No especificado'}\n` +
              `No. Solicitud: ${formData.noSol || 'No asignado'}\n\n` +
              '=== DATOS DEL CRÉDITO ===\n' +
              `Línea de producto: ${formData.lineaProducto || 'No especificada'}\n` +
              `Tipo de producto: ${formData.tipoProducto || 'No especificado'}\n` +
              `Producto: ${productoSeleccionado?.nombreProducto || formData.tipoProducto || 'No especificado'}\n` +
              `Monto solicitado: ${terminos.montoSolicitado || terminos.monto || 'No especificado'}\n` +
              `Plazo: ${terminos.plazo || terminos.plazoMeses || 'No especificado'}\n` +
              `Moneda: ${terminos.moneda || 'MXN'}\n\n` +
              `=== FASE ACTUAL: ${faseNombre} (Fase ${seqActual}) ===\n\n` +
              '=== DOCUMENTOS OBLIGATORIOS PARA ESTA FASE ===\n' +
              reqResumen + '\n\n' +
              '=== DOCUMENTOS CARGADOS EN EL EXPEDIENTE (incluyendo banca móvil) ===\n' +
              (resumenDocs || 'Sin documentos registrados.') + '\n\n' +
              `Total documentos: ${docsDeFase.length} | Validados por IA: ${docsDeFase.filter(d => d.validadoIA).length} | Pendientes validación: ${docsDeFase.filter(d => !d.validadoIA).length}\n\n` +
              'Responde ÚNICAMENTE en JSON válido con esta estructura exacta:\n' +
              '{ "valido": true|false, "motivos": ["motivo1", "motivo2"], "confianza": 0.0 }';

            payloadFaseIA = {
              faseActual: faseNombre,
              faseNumero: seqActual,
              botonPresionado: 'enviarFase',
              promptIA: promptConContexto,
              nombreSolicitante: nombreCliente,
              tipoPersona: formData.tipoPersona,
              noSol: formData.noSol || '',
              lineaProducto: formData.lineaProducto || '',
              tipoProducto: formData.tipoProducto || '',
              productoNombre: productoSeleccionado?.nombreProducto || formData.tipoProducto || '',
              monto: terminos.montoSolicitado || terminos.monto || '',
              plazo: terminos.plazo || terminos.plazoMeses || '',
              moneda: terminos.moneda || 'MXN',
              documentos: contextoDocs,
              resumenDocumentos: resumenDocs || 'Sin documentos registrados.',
              requisitosObligatorios: requisitosDeEstaFase,
              totalDocumentosCargados: docsCargados,
              documentosValidadosIA: docsValidados,
              documentosRechazadosIA: docsRechazados,
              documentosPendientesValidacion: docsPendientes,
            };
          }

          // Registrar intento en debug
          setIaFaseDebug({
            faseSeq: seqActual,
            faseNombre,
            promptIA: promptConContexto,
            docsEnContexto: contextoDocs.length,
            payload: payloadFaseIA,
            status: 'pending',
            timestamp: new Date().toLocaleTimeString('es-MX'),
          });
          setShowIAFaseDebug(true);

          // ── Llamada con reintentos (hasta 3 intentos, espera 2s entre cada uno) ──
          const MAX_REINTENTOS = 3;
          let resFaseIA: Response | null = null;
          let ultimoError = '';

          for (let intento = 1; intento <= MAX_REINTENTOS; intento++) {
            try {
              if (intento > 1) {
                toast.loading(`Reintentando validación IA (${intento}/${MAX_REINTENTOS})...`);
                await new Promise(r => setTimeout(r, 2000));
              }
              resFaseIA = await fetch(`${API_BASE_FASE}/validar-documento-ia`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}` },
                body: JSON.stringify(payloadFaseIA),
              });
              // Solo reintentar en errores de servidor (5xx) o red — no en 4xx
              if (resFaseIA.ok || resFaseIA.status < 500) break;
              ultimoError = `HTTP ${resFaseIA.status}`;
            } catch (netErr: any) {
              ultimoError = netErr.message;
              if (intento === MAX_REINTENTOS) resFaseIA = null;
            }
          }

          toast.dismiss(toastIA);

          if (resFaseIA?.ok) {
            const resultadoFaseIA = await resFaseIA.json();
            setIaFaseDebug(prev => prev ? { ...prev, status: 'ok', httpStatus: resFaseIA!.status, resultado: resultadoFaseIA } : null);

            if (resultadoFaseIA.valido === false) {
              toast.error(`IA: Fase "${faseNombre}" no cumple criterios`, {
                description: (resultadoFaseIA.motivos || resultadoFaseIA.faltantes || []).slice(0, 3).join(' · '),
                duration: 10000,
              });
              return;
            }

            toast.success(`IA: Fase "${faseNombre}" validada`, {
              description: resultadoFaseIA.motivos?.length > 0
                ? resultadoFaseIA.motivos.slice(0, 2).join(' · ')
                : 'Todos los criterios de la fase se cumplen.',
              duration: 5000,
            });
          } else {
            const httpStatus = resFaseIA?.status ?? 0;
            const errText = resFaseIA ? await resFaseIA.text().catch(() => ultimoError) : ultimoError;
            setIaFaseDebug(prev => prev ? { ...prev, status: 'error', httpStatus, errorMsg: errText } : null);
            // No bloquear — continuar avance de fase
          }
        } catch (errFaseIA: any) {
          toast.dismiss(toastIA);
        }
      } else if (todosValidados) {
      } else {
        setIaFaseDebug({
          faseSeq: seqActual,
          faseNombre,
          promptIA: '',
          docsEnContexto: 0,
          payload: {},
          status: 'skipped',
          errorMsg: 'La fase no tiene promptIA configurado en el subtab Fases del producto.',
          timestamp: new Date().toLocaleTimeString('es-MX'),
        });
      }

      // ── 3b. Fase 4: validar Términos, Garantías, Comités y contratos/pagarés formalizados ──
      if (seqActual === 4) {
        const terminos4: any = loadFromSession<any>(storageId, 'terminos') || loadFromSavedStore<any>(storageId, 'terminos') || {};
        const garantias4: any[] = loadFromSession<any[]>(storageId, 'garantias') || loadFromSavedStore<any[]>(storageId, 'garantias') || [];
        const comites4: any[] = loadFromSession<any[]>(storageId, 'comites') || loadFromSavedStore<any[]>(storageId, 'comites') || [];
        const { requiereGarantia: rg4, requiereComite: rc4 } = leerRequisitosProducto(rawData);
        const resultFase4 = validarFase4Envio({
          terminos: terminos4,
          garantias: garantias4,
          comites: comites4,
          productoRequiereGarantia: rg4,
          productoRequiereComite: rc4,
        });
        if (!resultFase4.valid) {
          toast.error('Requisitos de formalización incompletos', {
            description: resultFase4.errors.slice(0, 3).join(' · ') + (resultFase4.errors.length > 3 ? ` (+${resultFase4.errors.length - 3} más)` : ''),
          });
          return;
        }
        // Validar que contratos y pagarés estén formalizados antes de pasar a "Validación contratos y pagarés".
        // NO aplica a Garantía Financiera 2o Piso: su fase 4 es "Validación de Cláusulas
        // Fiduciarias" y no maneja pagarés — este chequeo se disparaba sólo por coincidir
        // en número de fase con el flujo de Crédito. Su equivalente real para GPO es
        // faltantesValidacionClausulas (contrato GPO firmado + cláusulas blindadas).
        if (!esGPOForm) {
          const resultContratos4 = validarContratosYPagares(documentos);
          if (!resultContratos4.valid) {
            toast.error('Formaliza el contrato antes de avanzar', {
              description: resultContratos4.errors.join(' · '),
              duration: 8000,
            });
            return;
          }
        }
      }

      // ── 3b-bis. Arrendamiento Puro: la fase de Recaudación exige la factura
      // del pago inicial REGISTRADA EN COBRANZA, no un PDF del expediente.
      // esArrPuro/faseNombreNorm/esFaseRecaudacionArrPuro ya se calcularon
      // arriba (antes del paso 3a) para poder saltar la IA en esta fase.
      if (esFaseRecaudacionArrPuro) {
        const facturasFase4: FacturaArrendamiento[] =
          loadFromSession<FacturaArrendamiento[]>(storageId, 'facturas') ||
          loadFromSavedStore<FacturaArrendamiento[]>(storageId, 'facturas') || [];
        const facturaInicial = facturasFase4.find(f => f.tipo === 'DESEMBOLSO_INICIAL');

        if (!facturaInicial || !facturaInicial.facturaIdCobranza) {
          toast.error('Falta la Factura de Pago Inicial', {
            description: 'Pulse "Generar Factura de Pago Inicial" en esta fase: debe existir el registro en Cobranza — Avisos de Vencimiento — Créditos antes de avanzar.',
            duration: 10000,
          });
          return;
        }

        const existeEnCobranza = await fetchEstatusFacturaCobranza(facturaInicial.facturaIdCobranza);
        if (!existeEnCobranza.ok) {
          toast.error('La Factura de Pago Inicial no está en Cobranza', {
            description: existeEnCobranza.error || 'Vuelva a generarla.',
            duration: 10000,
          });
          return;
        }

        // Cobranza marca 'Pagado'; la factura local usa 'Pagada' — sincronizar
        // la copia local con lo que diga Cobranza (misma convención que Fase 6).
        const estatusRealInicial = existeEnCobranza.estatus === 'Pagado' ? 'Pagada' : existeEnCobranza.estatus;
        if (estatusRealInicial !== facturaInicial.estatus) {
          const sincronizadasFase4 = facturasFase4.map(f =>
            f.id === facturaInicial.id ? { ...f, estatus: estatusRealInicial as any } : f
          );
          saveToSession(storageId, 'facturas', sincronizadasFase4);
          saveToSavedStore(storageId, 'facturas', sincronizadasFase4);
        }

        if (estatusRealInicial !== 'Pagada') {
          toast.error('La Factura de Pago Inicial no está pagada', {
            description: `${existeEnCobranza.noDocto || facturaInicial.noFactura} está en estatus "${estatusRealInicial}". Aplíquele el pago en Cobranza → Avisos de Vencimiento — Créditos y vuelva a intentar.`,
            duration: 10000,
          });
          return;
        }
      }

      // ── 3c. Fase 5: validar contratos y pagarés (Sección D) ──
      // Sólo aplica al flujo de crédito: en arrendamiento la fase 5 emite el
      // CFDI del proveedor y no exige pagarés; en GPO la fase 5 es "Activación
      // de Línea 2o Piso" (detonación contable), que tampoco los maneja.
      if (seqActual === 5 && !esArrPuro && !esGPOForm) {
        const resultContratos = validarContratosYPagares(documentos);
        if (!resultContratos.valid) {
          toast.error('Contratos y pagarés pendientes', {
            description: resultContratos.errors.join(' · '),
          });
          return;
        }
      }

      // ── 4. Buscar faseSiguiente por numero_consecutivo ──
      const sigFase = fasesDelProducto.find(f => f.seq === seqActual + 1);
      console.log('[handleEnviarFase] DEBUG llegó al punto 4 — seqActual:', seqActual, '| sigFase:', sigFase);
      if (!sigFase) {
        // Para "Activación Cuenta Financiera" el prompt ya corrió arriba; solo notificar completado.
        if (esActivacionCuentaFinanciera) {
          toast.success('Proceso completado', { description: faseNombre });
          return;
        }

        // ── Última fase: cerrar el proceso ────────────────────────────────
        // Antes esta rama solo informaba y hacía return, por lo que el flujo
        // no se podía terminar. El cierre exige que Tesorería ya haya
        // dispersado (Fase 6 — Liberación y Dispersión).
        const UUID_R_CIERRE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const dbIdCierre = UUID_R_CIERRE.test(String(formData.id || ''))
          ? String(formData.id)
          : UUID_R_CIERRE.test(String(storageId)) ? String(storageId) : '';

        if (!dbIdCierre) {
          toast.error('No se puede cerrar el proceso', {
            description: 'La solicitud aún no está guardada en base de datos.',
          });
          return;
        }

        // La Fase 6 (Liberación y Dispersión) no valida documentos: valida que
        // la factura del proveedor (cuenta por pagar de la Fase 5) ya esté
        // marcada como Pagada. Con eso se cierra el flujo y pasa a cartera.
        const facturasCierre: FacturaArrendamiento[] =
          loadFromSession<FacturaArrendamiento[]>(storageId, 'facturas') ||
          loadFromSavedStore<FacturaArrendamiento[]>(storageId, 'facturas') || [];

        const facturaProveedor = facturasCierre.find(f => f.tipo === 'COMPRA_PROVEEDOR');
        if (!facturaProveedor) {
          toast.error('No se puede cerrar el proceso', {
            description: 'Falta la factura del proveedor. Genérela en la fase "Recepción del Activo y Cierre".',
            duration: 9000,
          });
          return;
        }
        // El estatus se lee del registro REAL de Solicitud de Activación: el
        // pago se aplica ahí (botón "Activar" → estatus 'Pagado') y ese cambio
        // no vuelve solo a la solicitud. La copia local se sincroniza con lo
        // que diga Solicitud de Activación.
        let estatusReal = facturaProveedor.estatus;
        if (facturaProveedor.facturaIdCobranza) {
          const enActivacion = await fetchEstatusSolicitudActivacion(facturaProveedor.facturaIdCobranza);
          if (!enActivacion.ok) {
            toast.error('No se pudo verificar la cuenta por pagar en Solicitud de Activación', {
              description: enActivacion.error || 'Intente de nuevo.',
              duration: 9000,
            });
            return;
          }
          // Solicitud de Activación marca 'Pagado'; la factura local usa 'Pagada'.
          estatusReal = enActivacion.estatus === 'Pagado' ? 'Pagada' : (enActivacion.estatus as any);
          const sincronizadas = facturasCierre.map(f =>
            f.id === facturaProveedor.id ? { ...f, estatus: estatusReal } : f
          );
          saveToSession(storageId, 'facturas', sincronizadas);
          saveToSavedStore(storageId, 'facturas', sincronizadas);
        }

        if (estatusReal !== 'Pagada') {
          toast.error('La cuenta por pagar al proveedor no está pagada', {
            description: `${facturaProveedor.contraparte} está en estatus "${estatusReal}". Márquela como Pagada en Solicitud de Activación y vuelva a intentar.`,
            duration: 10000,
          });
          return;
        }

        // Pasa a cartera: el contrato queda Vigente y aparece en Cartera de Arrendamiento.
        const act = await actualizarDispersionDB(dbIdCierre, {
          estatusCartera: 'Vigente',
          montoDispersado: facturaProveedor.total,
          fechaDispersion: new Date().toISOString(),
          contratoActivado: true,
        });
        if (!act.ok) {
          toast.error('No se pudo pasar el contrato a cartera', {
            description: act.error || 'El contrato no quedó en estatus Vigente.',
            duration: 9000,
          });
          return;
        }

        const cierre = await actualizarEstatusSolicitudDB(dbIdCierre, 'Autorizada');
        if (!cierre.ok) {
          toast.error('No se pudo cerrar la solicitud', {
            description: cierre.error || 'El estatus no se actualizó en base de datos.',
            duration: 9000,
          });
          return;
        }

        setFormData(prev => ({ ...prev, estatusSolicitud: 'Autorizada' }));
        toast.success('Proceso completado — contrato en cartera', {
          description: `${formData.noSol}: factura del proveedor pagada. El contrato pasó a Cartera de Arrendamiento con estatus Vigente.`,
          duration: 9000,
        });
        return;
      }

      const nuevaAreaActual = sigFase.area || inferirAreaFase(sigFase.fase);

      // ── Generación automática de documentos al ENTRAR a una fase ──
      // Fase 2 (Análisis y Dictaminación): Reporte de Buró simulado, adjuntado
      // automáticamente al Expediente Electrónico. No bloquea el avance de fase
      // si falla — solo se registra el error en consola.
      if (String(sigFase.faseId) === '2') {
        try {
          const terminosBuro: any = loadFromSession<any>(storageId, 'terminos') || loadFromSavedStore<any>(storageId, 'terminos') || {};
          const clienteBuro = [formData.nombrePersona, formData.apellidoPaternoPersona, formData.apellidoMaternoPersona]
            .filter(Boolean).join(' ').trim() || 'Cliente';
          const clienteExtraBuro = await obtenerDatosCliente();
          const resultBuro = await autoCrearReporteBuro({
            storageId,
            datos: {
              noSol: formData.noSol,
              cliente: clienteBuro,
              lineaProducto: formData.lineaProducto,
              tipoProducto: formData.tipoProducto,
              productoNombre: productoSeleccionado?.nombreProducto || formData.nombreProducto || formData.tipoProducto || '',
              terminos: terminosBuro,
              ...clienteExtraBuro,
              sucursal: formData.sucursal || '',
            },
            supabase,
            projectId,
          });
          if (resultBuro.exito && resultBuro.documentosCreados.length > 0) {
            // `exito` sólo indica que el PDF se generó. Si no se persistió en BD
            // el documento vive únicamente en sessionStorage y desaparece al
            // recargar — avisar en vez de reportar un éxito que no ocurrió.
            if (resultBuro.registradosEnExpediente) {
              toast.success('Reporte de Buró generado', {
                description: `Adjuntado automáticamente al Expediente Electrónico${resultBuro.subidosASupabase ? '' : ' (guardado local, sin conexión a Storage)'}.`,
                duration: 6000,
              });
            } else {
              toast.warning('Reporte de Buró generado, pero NO se guardó en base de datos', {
                description: `${resultBuro.error || 'Error desconocido al persistir.'} El documento se perderá al recargar; genérelo de nuevo desde el Expediente Electrónico.`,
                duration: 12000,
              });
            }
          } else if (resultBuro.exito) {
            toast.info('Reporte de Buró ya existía', { description: 'No se generó uno nuevo (ya estaba en el Expediente).', duration: 5000 });
          } else {
            toast.warning('No se pudo generar el Reporte de Buró', { description: resultBuro.error || 'Error desconocido', duration: 8000 });
          }
        } catch (buroErr: any) {
          toast.error('Error al generar el Reporte de Buró', { description: buroErr?.message || String(buroErr), duration: 8000 });
        }
      }

      // ── Fase "Dictamen del Comité de Prepago y Crédito" ──
      // Su prompt exige que el sistema genere y asocie automáticamente el Acta
      // de Sesión del Comité y el Certificado de Pre-Apartado de Cupo, sin
      // carga manual. Se detecta por NOMBRE de fase y no por número: el faseId
      // de este producto no es correlativo (sus fases se llaman por su nombre
      // institucional, no "Fase N"), y esta pareja de documentos pertenece a
      // esa fase concreta, no a un ordinal.
      const nombreSigFase = (sigFase.fase || '')
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const esFaseComitePrepago = nombreSigFase.includes('comite') && nombreSigFase.includes('prepago');
      // Actividad 7.2 — "ejecutada automáticamente por el Core... al presionar el
      // botón de la Actividad 7.1": el disparador real es ENTRAR a Fase 5, sin
      // importar cuál botón concreto hizo avanzar la fase (mismo criterio que
      // esFaseComitePrepago arriba, que dispara al ENTRAR a Fase 3).
      const entrandoAActivacion2oPiso = esGPOForm && nombreSigFase.includes('activacion') && nombreSigFase.includes('piso');
      if (esFaseComitePrepago) {
        try {
          const terminosComite: any = loadFromSession<any>(storageId, 'terminos') || loadFromSavedStore<any>(storageId, 'terminos') || {};
          const clienteComite = [formData.nombrePersona, formData.apellidoPaternoPersona, formData.apellidoMaternoPersona]
            .filter(Boolean).join(' ').trim() || 'Cliente';
          const resComite = await autoCrearDocumentosComitePrepago({
            storageId,
            datos: {
              noSol: formData.noSol,
              cliente: clienteComite,
              lineaProducto: formData.lineaProducto,
              tipoProducto: formData.tipoProducto,
              productoNombre: productoSeleccionado?.nombreProducto || formData.nombreProducto || formData.tipoProducto || '',
              terminos: terminosComite,
              sucursal: formData.sucursal || '',
            },
            faseNombre: sigFase.fase,
            faseId: sigFase.seq,
            supabase,
            projectId,
          });
          if (resComite.documentosCreados.length > 0) {
            if (resComite.registradosEnExpediente) {
              toast.success('Documentos del Comité generados', {
                description: `${resComite.documentosCreados.join(' · ')} — adjuntados al Expediente Electrónico.`,
                duration: 7000,
              });
            } else {
              toast.warning('Documentos del Comité generados, pero NO se guardaron en base de datos', {
                description: `${resComite.error || 'Error desconocido al persistir.'} Se perderán al recargar.`,
                duration: 12000,
              });
            }
          } else {
            toast.info('Documentos del Comité ya existían', {
              description: 'No se generaron duplicados (ya estaban en el Expediente).',
              duration: 5000,
            });
          }
        } catch (comiteErr: any) {
          toast.error('Error al generar los documentos del Comité', {
            description: comiteErr?.message || String(comiteErr),
            duration: 8000,
          });
        }
      }

      // ── 5. Actualizar estado local ──
      setFormData(prev => ({
        ...prev,
        faseId: sigFase.faseId,
        descripcionFase: sigFase.fase,
        area: nuevaAreaActual,
        estatusSolicitud: prev.estatusSolicitud === 'Pendiente' ? 'En proceso' : prev.estatusSolicitud,
      }));

      // ── 6. Persistir en BD ──
      const dbId = storageId !== 'new' ? String(storageId) : null;
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (dbId && UUID_REGEX.test(dbId)) {
        const nuevoEstatus = formData.estatusSolicitud === 'Pendiente' ? 'En proceso' : undefined;
        const result = await avanzarFaseSolicitudDB(dbId, sigFase.faseId, sigFase.fase, nuevaAreaActual, nuevoEstatus);
        if (result.ok) {
          toast.success('Fase avanzada correctamente', { description: `${faseActualReal?.fase || formData.descripcionFase} → ${sigFase.fase}` });
        } else {
          toast.warning('Fase actualizada localmente (sin conexión BD)', { description: result.error || 'Sincronización pendiente' });
        }

        // ── Auto-guardado al avanzar fase ──
        // Guardar el estado completo de la solicitud para no perder datos al cambiar de fase
        try {
          const subtabsAutoSave: Record<string, any> = {};
          const subtabKeys = ['terminos', 'simulacion', 'simulacion_cal', 'simulacion_inv', 'simulacion_arrendamiento', 'documentos', 'garantias', 'comisiones', 'autorizaciones', 'notas', 'partesRelacionadas', 'facturas', 'estructura2oPiso', 'modeloViabilidad', 'votacionCPC', 'resolucionCIC', 'validacionClausulas', '_originalData'];
          for (const key of subtabKeys) {
            const data = loadFromSession(storageId, key) ?? loadFromSavedStore(storageId, key);
            if (data) subtabsAutoSave[key] = data;
          }
          const formDataConFase = {
            ...formData,
            faseId: sigFase.faseId,
            descripcionFase: sigFase.fase,
            area: nuevaAreaActual,
            estatusSolicitud: formData.estatusSolicitud === 'Pendiente' ? 'En proceso' : formData.estatusSolicitud,
          };
          await onSave?.({ ...formDataConFase, _allSubtabs: subtabsAutoSave });
        } catch (autoSaveErr: any) {
          console.error('[handleEnviarFase] Auto-guardado falló al avanzar de fase — los datos de esta fase (incluyendo documentos generados) NO se persistieron en BD:', autoSaveErr);
          toast.error('No se guardaron los cambios de esta fase en la base de datos', {
            description: autoSaveErr?.message || 'El avance de fase se ve localmente, pero se perderá al recargar. Intente guardar manualmente.',
            duration: 10000,
          });
        }

        // Actividad 7.2 — fin del BPM, automático al entrar a Fase 5.
        if (entrandoAActivacion2oPiso) {
          await formalizarGarantiaSiEsGPO(dbId);
        }
      } else {
        toast.success('Fase avanzada', { description: `${faseActualReal?.fase || formData.descripcionFase} → ${sigFase.fase}. Guarda para persistir.` });
      }
    } finally {
      setEnviandoFase(false);
    }
  }, [isRO, modo, enviandoFase, formData, fasesDelProducto, storageId, productoSeleccionado]);

  // ══════════════════════════════════════════════════════════════════
  // FACTURAS DE ARRENDAMIENTO PURO (Fases 4 y 5)
  //
  // Las facturas viven en el subtab 'facturas' de la solicitud. No se
  // persisten aquí: se guardan con el resto de la solicitud al enviar a
  // originación, que es justo lo que pide la regla "no persiste hasta
  // enviar a originación".
  // ══════════════════════════════════════════════════════════════════

  // Puro y Financiero: mismo subtab Facturas y mismos botones de factura por
  // fase (pago inicial en Fase 4, CFDI del proveedor en Fase 5).
  const esArrendamientoPuro = useMemo(
    () => esArrendamiento(formData.lineaProducto, formData.tipoProducto),
    [formData.lineaProducto, formData.tipoProducto]
  );

  const leerFacturas = useCallback((): FacturaArrendamiento[] => {
    return loadFromSession<FacturaArrendamiento[]>(storageId, 'facturas')
      || loadFromSavedStore<FacturaArrendamiento[]>(storageId, 'facturas')
      || [];
  }, [storageId]);

  const [facturasVersion, setFacturasVersion] = useState(0);
  const facturasActuales = useMemo(() => leerFacturas(), [leerFacturas, facturasVersion]);
  // Una factura sólo cuenta como generada si llegó a Cobranza. Si existe la
  // copia local pero sin facturaIdCobranza (se creó antes de conectar Cobranza,
  // o el alta falló), el botón debe seguir disponible para reintentar — si no,
  // queda oculto para siempre y el registro nunca se crea.
  const facturaInicialGenerada = facturasActuales.some(
    f => f.tipo === 'DESEMBOLSO_INICIAL' && !!f.facturaIdCobranza
  );
  const facturaProveedorGenerada = facturasActuales.some(
    f => f.tipo === 'COMPRA_PROVEEDOR' && !!f.facturaIdCobranza
  );

  const guardarFacturas = useCallback((facturas: FacturaArrendamiento[]) => {
    saveToSession(storageId, 'facturas', facturas);
    saveToSavedStore(storageId, 'facturas', facturas);
    setFacturasVersion(v => v + 1);

    // Persistir a BD de inmediato — sin esto, el Detail de Cobranza (fallback
    // cuando J_FACTURAS_DETALLE viene vacío) no encuentra los conceptos hasta
    // que alguien guarda la solicitud completa por separado.
    const dbIdFacturas = UUID_RE_FACTURA.test(String(formData.id || ''))
      ? String(formData.id)
      : UUID_RE_FACTURA.test(String(storageId)) ? String(storageId) : '';
    if (dbIdFacturas) {
      actualizarFacturasDB(dbIdFacturas, facturas).then(r => {
        if (!r.ok) console.warn('[guardarFacturas] No se pudo persistir a BD:', r.error);
      });
    }
  }, [storageId, formData.id]);

  /** Fase "Recaudación Inicial y Compra" — Factura del Pago Inicial. */
  const handleGenerarFacturaInicial = useCallback(async () => {
    const terminos: any = loadFromSession<any>(storageId, 'terminos')
      || loadFromSavedStore<any>(storageId, 'terminos') || {};

    const montoAutorizado = parseFloat(String(
      terminos.montoAutorizado || formData.montoAutorizado || formData.montoSolicitado || 0
    ).replace(/[^0-9.-]/g, '')) || 0;
    const montoEnganche = parseFloat(String(terminos.montoEnganche || (formData as any).montoEnganche || 0)
      .replace(/[^0-9.-]/g, '')) || 0;

    // Las rentas anticipadas salen del calendario simulado: así la factura y el
    // subtab Cargos usan exactamente los mismos importes.
    const simArr: any = loadFromSession<any>(storageId, 'simulacion_arrendamiento')
      || loadFromSavedStore<any>(storageId, 'simulacion_arrendamiento');
    const anticipadas = (simArr?.rentasAnticipadasDescontadas || []).map((r: any) => ({
      rentaSinIva: Number(r.rentaSinIva) || 0,
      seguro: Number(r.seguro) || 0,
    }));

    const conceptosCargos = calcularCargosArrendamiento({
      montoSolicitado: parseFloat(String(formData.montoSolicitado || 0).replace(/[^0-9.-]/g, '')) || 0,
      montoAutorizado,
      porcentajeEnganche: parseFloat(String(terminos.porcentajeEnganche || formData.porcentajeEnganche || 0)) || 0,
      porcentajeComisionApertura: parseFloat(String(terminos.comisionApertura || 0)) || 0,
      montoEnganche,
      rentasAnticipadas: anticipadas,
    });

    const totalCalculado = conceptosCargos.find(c => c.concepto === 'TOTAL_PAGO_INICIAL')?.monto || 0;
    if (totalCalculado <= 0) {
      toast.error('No se puede generar la factura', {
        description: 'El desembolso inicial es cero. Complete Términos y Condiciones y ejecute Simular.',
        duration: 8000,
      });
      return;
    }

    const factura = generarFacturaDesembolsoInicial({
      noSol: formData.noSol || '',
      solicitudId: String(storageId),
      cliente: [formData.nombrePersona, formData.apellidoPaternoPersona, formData.apellidoMaternoPersona]
        .filter(Boolean).join(' ').trim() || 'Cliente',
      rfcCliente: (formData as any).rfcPersona || '',
      conceptosCargos,
    });

    // Alta del registro REAL en Cobranza — Avisos de Vencimiento — Créditos.
    // La factura sólo se marca como generada si el alta tuvo éxito: si falla,
    // el botón sigue disponible para reintentar.
    const dbIdFac = UUID_RE_FACTURA.test(String(formData.id || ''))
      ? String(formData.id)
      : UUID_RE_FACTURA.test(String(storageId)) ? String(storageId) : '';

    if (!dbIdFac) {
      toast.error('Guarde la solicitud antes de generar la factura', {
        description: 'El registro de Cobranza necesita el id de la solicitud en base de datos.',
        duration: 8000,
      });
      return;
    }

    const alta = await crearFacturaArrendamientoCobranza({
      solicitud_id: dbIdFac,
      cliente: factura.contraparte,
      // Pago Inicial: el cliente le paga a la institución — Por Cobrar.
      tipo: 'Por Cobrar',
      conceptos: factura.conceptos.map(c => ({ cve: c.concepto, desc: c.descripcion, monto: c.monto })),
      total: factura.total,
      fecha_compromiso: factura.fechaVencimiento,
      referencia: formData.noSol || undefined,
    });

    if (!alta.ok) {
      toast.error('No se pudo crear el registro en Cobranza', {
        description: alta.error || 'La factura NO se generó. Reintente.',
        duration: 10000,
      });
      return;
    }

    const facturaConCobranza: FacturaArrendamiento = {
      ...factura,
      facturaIdCobranza: alta.factura_id,
      noFactura: alta.no_docto || factura.noFactura,
    };

    guardarFacturas([...leerFacturas().filter(f => f.tipo !== 'DESEMBOLSO_INICIAL'), facturaConCobranza]);

    toast.success('Factura de Pago Inicial generada', {
      description: `${facturaConCobranza.noFactura} · Total ${formatCurrency(factura.total)}. Ya aparece en Cobranza → Avisos de Vencimiento — Créditos.`,
      duration: 9000,
    });
  }, [storageId, formData, guardarFacturas, leerFacturas]);

  /** Fase "Recepción del Activo y Cierre" — CFDI del proveedor (cuenta por pagar). */
  const handleGenerarFacturaProveedor = useCallback(async () => {
    // El proveedor sale del BIEN seleccionado en la solicitud (subtab Bienes),
    // que es donde se captura con GarantiaForm → proveedorNombre/proveedor_id.
    const bienes: any[] =
      loadFromSession<any[]>(storageId, 'garantias')
      || loadFromSavedStore<any[]>(storageId, 'garantias') || [];

    if (bienes.length === 0) {
      toast.error('La solicitud no tiene Bienes', {
        description: 'Agregue el bien objeto del arrendamiento en el subtab Bienes.',
        duration: 9000,
      });
      return;
    }

    let bienConProveedor = bienes.find(b =>
      b?.proveedorNombre || b?.proveedor_nombre || b?.proveedorId || b?.proveedor_id
    );

    // Fallback al catálogo de Bienes (J_GARANTIAS): las solicitudes guardadas
    // antes de que el proveedor viajara en el payload no lo tienen en su copia,
    // pero el bien original sí. Se busca por id y, si no, por descripción.
    if (!bienConProveedor) {
      try {
        const { data: catalogo } = await supabase.rpc('get_all_jgarantias');
        const norm = (v: any) => String(v ?? '').trim().toLowerCase();

        for (const b of bienes) {
          const match = (catalogo || []).find((c: any) => {
            const d = c.data?.default || {};
            if (b.garantiaId && String(c.uuid) === String(b.garantiaId)) return true;
            // En el catálogo el nombre del bien vive en `garantia`; `descripcion`
            // suele venir vacío, y la solicitud guarda ese nombre en `descripcion`.
            const nombresCat = [c.garantia, d.garantia, c.descripcion, d.descripcion].map(norm).filter(Boolean);
            return nombresCat.includes(norm(b.descripcion));
          });
          const d = match?.data?.default || {};
          const nombreProv = d.proveedorNombre || d.proveedor_nombre;
          if (nombreProv) {
            bienConProveedor = {
              ...b,
              proveedorNombre: nombreProv,
              proveedorId: d.proveedor_id || null,
              proveedorRfc: d.proveedorRfc || d.proveedor_rfc || '',
              descripcion: b.descripcion || match?.garantia || '',
            };
            break;
          }
        }
      } catch { /* si el catálogo no responde, cae al mensaje de abajo */ }
    }

    if (!bienConProveedor) {
      toast.error('El bien no tiene proveedor capturado', {
        description: 'Abra el bien en el módulo Bienes, seleccione el Proveedor y vuelva a guardar la solicitud.',
        duration: 10000,
      });
      return;
    }

    const proveedor = String(
      bienConProveedor.proveedorNombre || bienConProveedor.proveedor_nombre || ''
    ).trim();
    if (!proveedor) {
      toast.error('El proveedor del bien no tiene nombre', {
        description: 'Revise el Proveedor seleccionado en el subtab Bienes.',
        duration: 9000,
      });
      return;
    }
    const rfcProveedor = String(
      bienConProveedor.proveedorRfc || bienConProveedor.proveedor_rfc || ''
    ).trim() || 'XAXX010101000';

    // El proveedor es una Persona en J_CLIENTES (type='Proveedor'); su UUID es
    // el cliente_id de la cuenta por pagar — la columna es NOT NULL.
    const proveedorId = String(
      bienConProveedor.proveedorId || bienConProveedor.proveedor_id || ''
    ).trim();
    if (!UUID_RE_FACTURA.test(proveedorId)) {
      toast.error('El proveedor del bien no está ligado a una Persona', {
        description: `"${proveedor}" no tiene un registro de Proveedor válido. Abra el bien en el módulo Bienes, seleccione el Proveedor desde el catálogo de Personas y vuelva a guardar la solicitud.`,
        duration: 11000,
      });
      return;
    }

    const terminos: any = loadFromSession<any>(storageId, 'terminos')
      || loadFromSavedStore<any>(storageId, 'terminos') || {};
    // La factura del proveedor va por el VALOR DEL BIEN que capturó el usuario
    // (Monto Solicitado), NO por el Monto Autorizado (que es el calculado
    // montoSolicitado × (1 − %enganche)).
    //
    // El banco le compra el activo al proveedor por su precio completo: el
    // enganche es una aportación del cliente que ya se le cobra aparte en la
    // Fase 4 (Recaudación Inicial). Descontarlo también de lo que se le paga al
    // proveedor lo contaría dos veces y dejaría el activo pagado de menos.
    const importe = parseFloat(String(
      formData.montoSolicitado || terminos.montoSolicitado || 0
    ).replace(/[^0-9.-]/g, '')) || 0;

    if (importe <= 0) {
      toast.error('No se puede generar la factura del proveedor', {
        description: 'El Monto Solicitado (Valor del Bien) es cero — captúrelo en Plazos y Montos.',
      });
      return;
    }

    const descripcionBien =
      bienConProveedor.descripcion || bienConProveedor.tipo || 'Bien objeto del arrendamiento';

    const { xml } = generarXMLProveedor({
      noSol: formData.noSol || '',
      proveedor,
      rfcProveedor,
      descripcionBien,
      importe,
    });

    // Se lee el XML recién generado: los datos del detalle vienen del CFDI.
    const factura = leerXMLProveedor(xml, {
      noSol: formData.noSol || '',
      solicitudId: String(storageId),
    });

    if (!factura) {
      toast.error('No se pudo leer el CFDI generado', {
        description: 'El XML no se pudo parsear.',
        duration: 8000,
      });
      return;
    }

    const dbIdProv = UUID_RE_FACTURA.test(String(formData.id || ''))
      ? String(formData.id)
      : UUID_RE_FACTURA.test(String(storageId)) ? String(storageId) : '';

    if (!dbIdProv) {
      toast.error('Guarde la solicitud antes de generar la factura', {
        description: 'El registro de Cobranza necesita el id de la solicitud en base de datos.',
        duration: 8000,
      });
      return;
    }

    // Cuenta por pagar al proveedor: NO va a Cobranza (ese panel es solo para
    // lo que el cliente le debe a la institución). El proveedor no es cliente
    // del banco, así que se registra como Solicitud de Activación tipo "Por
    // Pagar" — mismo criterio de Tipo que usa ese módulo (lineaProdToTipo).
    const alta = await crearFacturaProveedorActivacion({
      solicitudId: dbIdProv,
      proveedorId,
      proveedor: factura.contraparte,
      rfcProveedor: factura.rfcContraparte,
      monto: factura.total,
      fechaCompromiso: factura.fechaVencimiento,
      referencia: factura.uuid || formData.noSol || undefined,
    });

    if (!alta.ok) {
      toast.error('No se pudo crear la cuenta por pagar en Solicitud de Activación', {
        description: alta.error || 'La factura NO se generó. Reintente.',
        duration: 10000,
      });
      return;
    }

    const facturaConCobranza: FacturaArrendamiento = {
      ...factura,
      facturaIdCobranza: alta.id,
    };

    guardarFacturas([...leerFacturas().filter(f => f.tipo !== 'COMPRA_PROVEEDOR'), facturaConCobranza]);

    toast.success('Cuenta por pagar creada', {
      description: `${factura.contraparte} · ${formatCurrency(factura.total)}. Márquela como Pagada en Solicitud de Activación para poder cerrar el proceso.`,
      duration: 10000,
    });
  }, [storageId, formData, guardarFacturas, leerFacturas]);

  /** Regresar de Fase — requiere nota reciente (≤30 min). */
  const handleRegresarFase = useCallback(async () => {
    if (enviandoFase) return;
    setEnviandoFase(true);
    try {
      // ── Validar nota reciente (≤30 min) — Sección C ──
      // Intentar desde session primero; si no hay, desde savedStore (notas persistidas)
      const notasSession = loadFromSession<any[]>(storageId, 'notas');
      const notasSaved = loadFromSavedStore<any[]>(storageId, 'notas');
      // Unificar: notas de session tienen prioridad (más recientes)
      const todasNotas: any[] = notasSession ?? notasSaved ?? [];
      if (!validarNotaReciente(todasNotas)) {
        toast.error('No se puede regresar de fase', {
          description: 'Cree una nota en los últimos 30 minutos (sección Notas) antes de regresar.',
        });
        return;
      }

      // ── Encontrar faseActualReal y faseAnterior por seq ──
      const faseActualReal = fasesDelProducto.find(f => String(f.faseId) === String(formData.faseId));
      const seqActual = faseActualReal?.seq ?? (parseInt(formData.faseId) || 1);
      const faseAnterior = fasesDelProducto.find(f => f.seq === seqActual - 1);

      if (!faseAnterior) {
        toast.info('No hay fase anterior', { description: 'Esta es la primera fase del flujo.' });
        return;
      }

      const nuevaArea = faseAnterior.area || inferirAreaFase(faseAnterior.fase);

      // ── Actualizar estado local ──
      setFormData(prev => ({
        ...prev,
        faseId: faseAnterior.faseId,
        descripcionFase: faseAnterior.fase,
        area: nuevaArea,
      }));

      // ── Persistir en BD ──
      const dbId = storageId !== 'new' ? String(storageId) : null;
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (dbId && UUID_REGEX.test(dbId)) {
        const result = await regresarFaseSolicitudDB(dbId, faseAnterior.faseId, faseAnterior.fase, nuevaArea);
        if (result.ok) {
          toast.success('Fase regresada correctamente', {
            description: `${faseActualReal?.fase || formData.descripcionFase} → ${faseAnterior.fase}`,
          });
        } else {
          toast.warning('Fase regresada localmente (sin conexión BD)', { description: result.error });
        }
      } else {
        toast.success('Fase regresada', {
          description: `${faseActualReal?.fase || formData.descripcionFase} → ${faseAnterior.fase}. Guarda para persistir.`,
        });
      }
    } finally {
      setEnviandoFase(false);
    }
  }, [enviandoFase, formData, fasesDelProducto, storageId]);

  /** Obtiene datos completos del cliente desde BD para rellenar plantillas. */
  const obtenerDatosCliente = useCallback(async (): Promise<Record<string, string> & { nombreDB?: string }> => {
    const fd = formData as any;
    let extra: Record<string, string> & { nombreDB?: string } = {
      rfc:             fd._rfc             || '',
      curp:            fd._curp            || '',
      domicilio:       fd._domicilio       || '',
      telefono:        fd._telefono        || '',
      email:           fd._email           || '',
      fechaNacimiento: fd._fechaNacimiento || '',
      nombreDB:        '',
    };
    const clienteUUID = fd._clienteId || '';
    if (clienteUUID) {
      try {
        const _API   = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
        const _heads = { 'Authorization': `Bearer ${publicAnonKey}` };
        let rowC: any = null;
        for (const ep of ['/clientes-lista-todos', '/clientes-prospectos']) {
          try {
            const res = await fetch(`${_API}${ep}`, { headers: _heads });
            if (res.ok) {
              const allRows: any[] = (await res.json()).data || [];
              rowC = allRows.find((r: any) => r.id === clienteUUID || r.data?.authUserId === clienteUUID);
              if (rowC) break;
            }
          } catch (_) { /* intentar siguiente endpoint */ }
        }
        if (rowC) {
          const d   = rowC.data || {};
          const g   = (k: string) => String(d[k] || d.default?.[k] || '');
          const dirs: any[] = Array.isArray(d.direcciones) ? d.direcciones : [];
          const dir0 = dirs.find((x: any) => x.principal) || dirs[0] || {};
          const domParts = [
            dir0.calle || d.calle || d.direccion || '',
            dir0.numeroExterior || '',
            dir0.colonia || d.colonia || '',
            dir0.municipio || d.municipio || '',
            dir0.estado || dir0.entidadFederativa || d.entidadFederativa || '',
            dir0.codigoPostal ? `C.P. ${dir0.codigoPostal}` : '',
          ].filter(Boolean);
          // Nombre completo desde el registro del cliente.
          // BUG FIX: el campo real de Persona Moral es `denominacionRazonSocial`
          // (así lo guarda ProspectoForm); `razonSocial` nunca existió.
          // Ademas, para Moral NUNCA concatenar apellidoPaterno/apellidoMaterino:
          // un bug ya corregido en ProspectoForm.tsx llego a inyectar palabras de
          // la Razon Social ahi (crecia en cada guardado: "PRUEBA 2 2 2"), y ese
          // guardado parcial nunca puede limpiarse a '' (los vacios se ignoran
          // para no borrar datos por accidente) — por eso se ignoran esos dos
          // campos por completo aqui, sin importar que haya quedado guardado.
          const esClienteMoral = rowC.subtipo === 'Persona Moral';
          const nombreDB = esClienteMoral
            ? (g('denominacionRazonSocial') || g('razonSocial') || g('nombre') || g('nombreCompleto') || '')
            : ([g('nombre'), g('apellidoPaterno'), g('apellidoMaterno')].filter(Boolean).join(' ') || g('nombreCompleto') || '');
          extra = {
            rfc:             g('rfc')             || extra.rfc,
            curp:            g('curp')            || extra.curp,
            domicilio:       domParts.join(', ')  || d.domicilio || d.direccion || extra.domicilio,
            telefono:        g('telefono') || g('telefonoDomicilio') || g('celular') || g('telefonoCelular') || extra.telefono,
            email:           g('correoElectronico') || g('email') || g('correo') || extra.email,
            fechaNacimiento: g('fechaNacimiento') || g('fechaNac') || extra.fechaNacimiento,
            gobierno:        g('institucionGobierno') || extra.gobierno,
            nombreDB,
          };
        }
      } catch (err) {
      }
    }
    return extra;
  }, [formData, projectId, publicAnonKey]);

  // Hidratar _gobierno para registros existentes que no lo tengan en session
  useEffect(() => {
    if (mode === 'nuevo') return;
    if ((formData as any)._gobierno) return;
    if (!(formData as any)._clienteId) return;
    obtenerDatosCliente().then(extra => {
      if (extra.gobierno) {
        (setFormData as any)(prev => ({ ...prev, _gobierno: extra.gobierno }));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(formData as any)._clienteId, mode]);

  /** Formalizar Contrato — Fase 4. Valida docs previos, términos, garantías y comités. */
    /**
     * Generar Solicitud — Fase 1.
     * Detecta tipo de producto, selecciona plantilla, valida datos mínimos,
     * genera PDF, lo registra en expediente, evita duplicados, descarga y abre.
     */
    const handleGenerarSolicitud = useCallback(async () => {
      if (enviandoFase) return;

      // ── 1. Detectar tipo de producto (semántico, no literal) ──
      const linea = (formData.lineaProducto || '').toLowerCase();
      const tipo = (formData.tipoProducto || '').toLowerCase();
      const nombreProd = (productoSeleccionado?.nombreProducto || formData.tipoProducto || '').toLowerCase();

      let tipoProductoDetectado = 'Credito';
      if (linea.includes('captacion') || linea.includes('ahorro') || linea.includes('inversion') || linea.includes('inversión')) {
        tipoProductoDetectado = tipo.includes('inversion') || tipo.includes('inversión') || nombreProd.includes('inversion') || nombreProd.includes('inversión') ? 'Inversion' : 'Captacion';
      } else if (linea.includes('linea') || linea.includes('línea')) {
        tipoProductoDetectado = 'Linea de Credito';
      } else if (linea.includes('credito') || linea.includes('crédito')) {
        tipoProductoDetectado = 'Credito';
      }

      // ── 2. Validar datos mínimos requeridos ──
      const errores: string[] = [];
      if (!formData.noSol || formData.noSol.trim() === '') errores.push('Número de Solicitud');
      if (!formData.nombrePersona || formData.nombrePersona.trim() === '') errores.push('Nombre del solicitante');
      if (!formData.apellidoPaternoPersona || formData.apellidoPaternoPersona.trim() === '') errores.push('Apellido Paterno');
      if (!formData.lineaProducto || formData.lineaProducto.trim() === '') errores.push('Línea de Producto');
      if (!formData.tipoProducto || formData.tipoProducto.trim() === '') errores.push('Tipo de Producto');
      if (!formData.productoId || formData.productoId.trim() === '') errores.push('Producto');
      if (!formData.fechaSolicitud || formData.fechaSolicitud.trim() === '') errores.push('Fecha de Solicitud');
      if (!formData.montoSolicitado || formData.montoSolicitado.trim() === '' || parseFloat(formData.montoSolicitado.replace(/[^0-9.-]/g, '')) <= 0) errores.push('Monto Autorizado');
      if (!formData.sucursal || formData.sucursal.trim() === '') errores.push('Sucursal');
      // Validaciones específicas por tipo
      const _lineaVal = (formData.lineaProducto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const _esCaptVal = _lineaVal.includes('captac') || _lineaVal.includes('invers');
      if (_esCaptVal) {
        const termCap = loadFromSession<any>(storageId, 'terminos') || {};
        if (!termCap.perfilInversionista) errores.push('Perfil del Inversionista (Términos y Condiciones)');
      }

      if (errores.length > 0) {
        toast.error('Datos incompletos para generar la solicitud', {
          description: `Los siguientes campos obligatorios están vacíos o son inválidos: ${errores.join(', ')}. Complete los datos antes de generar la solicitud.`,
          duration: 10000,
        });
        return;
      }

      // ── 3. Verificar duplicado en expediente ──
      const docsPrevios = loadFromSession(storageId, 'documentos') ?? loadFromSavedStore(storageId, 'documentos') ?? [];
      const yaExiste = docsPrevios.some((d: any) => d.tipoDocumento === CLAVE_SOLICITUD_BASE || d.claveDocumento === CLAVE_SOLICITUD_BASE);
      if (yaExiste) {
        toast.info('Solicitud ya generada', {
          description: `Ya existe un documento SOLICITUD_BASE registrado en el expediente de esta solicitud (${formData.noSol}). No se generará un duplicado.`,
          duration: 8000,
        });
        return;
      }

      setEnviandoFase(true);
      try {
        const terminos: any = loadFromSession<any>(storageId, 'terminos') || loadFromSavedStore<any>(storageId, 'terminos') || {};
        // rawData del producto — contiene plantillas, fases, expedientesRegistros, etc.
        const _rawDataProducto = productoSeleccionado?.rawData as Record<string, any> | undefined;
        const plantillasProducto: any[] =
          (Array.isArray(productoSeleccionado?.plantillas) && productoSeleccionado.plantillas!.length > 0
            ? productoSeleccionado.plantillas
            : null)
          ?? (Array.isArray(_rawDataProducto?.plantillas) && _rawDataProducto.plantillas.length > 0
            ? _rawDataProducto.plantillas
            : null)
          ?? [];

        console.log('[DIAG Solicitud] productoId:', formData.productoId, '| productoSeleccionado.id:', productoSeleccionado?.id, '| productoSeleccionado.plantillas:', productoSeleccionado?.plantillas, '| rawData.plantillas:', _rawDataProducto?.plantillas, '| plantillasProducto FINAL:', plantillasProducto);

        const cliente = [formData.nombrePersona, formData.apellidoPaternoPersona, formData.apellidoMaternoPersona]
          .filter(Boolean).join(' ').trim() || 'Cliente';

        const clienteExtra = await obtenerDatosCliente();

        const datosSolicitud: DatosSolicitud = {
          noSol: formData.noSol,
          cliente,
          lineaProducto: formData.lineaProducto,
          tipoProducto: formData.tipoProducto,
          productoNombre: productoSeleccionado?.nombreProducto || formData.nombreProducto || formData.tipoProducto || '',
          terminos,
          ...clienteExtra,
          sucursal: formData.sucursal || '',
          finalidad: formData.descripcion || '',
        };

        // ── 4. Generar PDF (sin registrar en expediente) ──
        const resultado = await autoCrearDocumentosFase2({
          storageId,
          datos: datosSolicitud,
          plantillas: plantillasProducto,
        });

        const fileData = resultado.fileData;

        if (!fileData) {
          toast.error('Error al generar el PDF', {
            description: 'No se pudo obtener el archivo PDF generado.',
          });
          setEnviandoFase(false);
          return;
        }

        // ── 6. Convertir a blob URL, abrir y descargar ──
        // fileData puede ser:
        //   a) "blob:<mime>::<objectUrl>" → Blob ya creado en el hook (plantilla HTML)
        //   b) "data:<mime>;base64,<b64>"  → base64 clásico (PDF generado)
        let solicitudUrl: string;
        let solicitudExt: string;
        let needsRevoke = true;

        if (fileData.startsWith('blob:')) {
          // Formato especial: blob:<mime>::<objectUrl>
          const m = fileData.match(/^blob:([^:]+)::(.+)$/);
          solicitudUrl = m ? m[2] : fileData;
          solicitudExt = (m?.[1] || '').includes('html') ? 'html' : 'pdf';
          needsRevoke = !!m; // el Object URL ya fue creado en el hook
        } else {
          // base64 clásico
          const [header, b64] = fileData.split(',');
          const mime = header.match(/:(.*?);/)?.[1] ?? 'application/pdf';
          const bin = atob(b64);
          const buf = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
          solicitudUrl = URL.createObjectURL(new Blob([buf], { type: mime }));
          solicitudExt = mime.includes('html') ? 'html' : 'pdf';
        }

        const tab = window.open(solicitudUrl, '_blank');
        if (!tab) {
          toast.warning('El navegador bloqueó la pestaña', {
            description: 'Permita las ventanas emergentes para este sitio.',
          });
        }

        const a = document.createElement('a');
        a.href = solicitudUrl;
        a.download = `Solicitud_${formData.noSol}.${solicitudExt}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        if (needsRevoke) setTimeout(() => URL.revokeObjectURL(solicitudUrl), 120_000);

        const plantillaInfo = resultado.validacionPlantillas?.plantillasDetectadas?.length > 0
          ? resultado.validacionPlantillas.plantillasDetectadas.join(', ')
          : 'Sin plantilla (datos del formulario)';

        toast.success('Solicitud generada exitosamente', {
          description: `Plantilla: ${plantillaInfo} | Tipo: ${tipoProductoDetectado} | Documento registrado en expediente.`,
          duration: 8000,
        });
      } catch (err) {
        toast.error('Error al generar la solicitud');
      } finally {
        setEnviandoFase(false);
      }
    }, [enviandoFase, formData, storageId, productoSeleccionado]);

  const handleFormalizarContrato = useCallback(async () => {
    if (enviandoFase) return;
    setEnviandoFase(true);
    try {
      const terminos: any = loadFromSession<any>(storageId, 'terminos') || loadFromSavedStore<any>(storageId, 'terminos') || {};
      const garantias: any[] = loadFromSession<any[]>(storageId, 'garantias') || loadFromSavedStore<any[]>(storageId, 'garantias') || [];
      const comites: any[] = loadFromSession<any[]>(storageId, 'comites') || loadFromSavedStore<any[]>(storageId, 'comites') || [];
      const documentos: DocumentoCargado[] =
        loadFromSession<DocumentoCargado[]>(storageId, 'documentos') ||
        loadFromSavedStore<DocumentoCargado[]>(storageId, 'documentos') ||
        [];
      const rawData = productoSeleccionado?.rawData as Record<string, any> | undefined;
      const requisitosProducto = getRequisitosFromRawData(rawData);
      const { requiereGarantia, requiereComite } = leerRequisitosProducto(rawData);
      const plantillasProducto =
        (Array.isArray(productoSeleccionado?.plantillas) && productoSeleccionado!.plantillas!.length > 0
          ? productoSeleccionado!.plantillas
          : null) ??
        (Array.isArray(rawData?.plantillas) && rawData!.plantillas.length > 0
          ? rawData!.plantillas
          : []);

      // Fases 1-3 previas
      const faseActualReal = fasesDelProducto.find(f => String(f.faseId) === String(formData.faseId));
      const seqActual = faseActualReal?.seq ?? 4;
      const fasesAnteriores = Array.from({ length: seqActual - 1 }, (_, i) => i + 1);

      const result = validarFormalizarContrato({
        documentosCargados: documentos,
        requisitos: requisitosProducto,
        fasesAnterioresSeq: fasesAnteriores,
        tipoPersona: formData.tipoPersona,
        terminos,
        garantias,
        comites,
        productoRequiereGarantia: requiereGarantia,
        productoRequiereComite: requiereComite,
        plantillas: plantillasProducto,
      });

      if (!result.valid) {
        toast.error('No se puede formalizar el contrato', {
          description: result.errors.slice(0, 3).join(' · ') + (result.errors.length > 3 ? ` (+${result.errors.length - 3} más)` : ''),
        });
        return;
      }

      const cliente = [formData.nombrePersona, formData.apellidoPaternoPersona, formData.apellidoMaternoPersona]
        .filter(Boolean).join(' ').trim();

      const datosContrato = {
        solicitudId: formData.id || String(storageId),
        noSol: formData.noSol,
        lineaProducto: formData.lineaProducto,
        tipoProducto: formData.tipoProducto,
        tipoPersona: formData.tipoPersona,
        cliente,
        terminos,
        garantias,
        comites,
        fechaFormalizacion: new Date().toISOString(),
      };

      // ── Persistir localmente SIEMPRE (fuente de verdad local) ──
      saveToSavedStore(storageId, 'contrato', datosContrato);
      saveToSession(storageId, 'contrato', datosContrato);

      // ── Generar PDFs — enriquecer datos del cliente desde BD ──
      const clienteExtra = await obtenerDatosCliente();
      // Si formData no tiene nombre (solicitud cargada de BD sin header), usar el del cliente
      const clienteFinal = cliente || clienteExtra.nombreDB || '';
      const datosSolicitud: DatosSolicitud = {
        noSol:          formData.noSol,
        cliente:        clienteFinal,
        lineaProducto:  formData.lineaProducto,
        tipoProducto:   formData.tipoProducto,
        productoNombre: productoSeleccionado?.nombreProducto || formData.nombreProducto || formData.tipoProducto || '',
        terminos,
        ...clienteExtra,
        sucursal:  formData.sucursal    || '',
        finalidad: formData.descripcion || '',
      };

      // Usar plantilla configurada en el producto si tiene archivoData; fallback a PDF genérico
      const plantillaContrato = plantillasProducto.find(
        (p: any) => p.tipoPlantilla === 'contrato' && p.estatus === 'Activo'
      );
      const plantillaPagare = plantillasProducto.find(
        (p: any) => p.tipoPlantilla === 'pagare' && p.estatus === 'Activo'
      );

      const toObjectURL = (dataUrl: string): string => {
        const [header, b64] = dataUrl.split(',');
        const mime = header.match(/:(.*?);/)?.[1] ?? 'application/pdf';
        const bin = atob(b64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([buf], { type: mime }));
      };

      const generarUrlDesdeRef = async (plantilla: any, fallbackFn: () => string): Promise<string> => {
        if (plantilla?.archivoData) {
          try {
            const html = sustituirPlaceholders(decodificarArchivoData(plantilla.archivoData), datosSolicitud);
            return await htmlToPdfBlobUrl(html);
          } catch (e) {
          }
        }
        return toObjectURL(fallbackFn());
      };

      const tpNormFormal = (
        formData.tipoProducto ||
        productoSeleccionado?.tipoProducto ||
        (productoSeleccionado?.rawData as any)?.tipoProducto ||
        (productoSeleccionado?.rawData as any)?.default?.tipoProducto ||
        ''
      ).toLowerCase();
      const esInversionFormal = tpNormFormal.includes('invers');

      // Para Inversión: ignorar la plantilla de contrato (es de crédito) y usar PDF de inversión.
      // Pasar null como plantilla fuerza el fallback → generarSolicitudPDF detecta isInversion.
      const contratoUrl = await generarUrlDesdeRef(
        esInversionFormal ? null : plantillaContrato,
        () => esInversionFormal ? generarSolicitudPDF(datosSolicitud) : generarContratoPDF(datosSolicitud)
      );
      const pagareUrl = esInversionFormal
        ? null
        : await generarUrlDesdeRef(plantillaPagare, () => generarPagePDF(datosSolicitud));

      // ── Abrir en pestañas nuevas ──
      const tabContrato = window.open(contratoUrl, '_blank');
      const tabPagare   = pagareUrl ? window.open(pagareUrl, '_blank') : null;
      if (!tabContrato || (pagareUrl && !tabPagare)) {
        toast.warning('El navegador bloqueó las pestañas', {
          description: 'Permita las ventanas emergentes para este sitio y vuelva a intentarlo.',
        });
      }

      // ── Descarga ──
      const descargar = (url: string, nombre: string) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      const docLabel = esInversionFormal ? 'Solicitud_Inversion' : 'Contrato';
      descargar(contratoUrl, `${docLabel}_${formData.noSol}.pdf`);
      if (pagareUrl) descargar(pagareUrl, `Pagare_${formData.noSol}.pdf`);

      // Liberar blob URLs tras 2 minutos
      setTimeout(() => { URL.revokeObjectURL(contratoUrl); URL.revokeObjectURL(pagareUrl); }, 120_000);

      // ── Intentar sincronizar con BD (no bloqueante) ──
      const dbId = storageId !== 'new' ? String(storageId) : null;
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (dbId && UUID_REGEX.test(dbId)) {
        const res = await formalizarContratoSolicitudDB(dbId, datosContrato);
        if (res.ok) {
          toast.success('Contrato formalizado — documentos generados', {
            description: `Contrato y Pagaré descargados. No. Solicitud: ${formData.noSol}`,
          });
        } else {
          toast.success('Contrato formalizado (local) — documentos generados', {
            description: `Contrato y Pagaré descargados. No. Solicitud: ${formData.noSol}`,
          });
        }
      } else {
        toast.success('Contrato formalizado — documentos generados', {
          description: `Contrato_${formData.noSol}.pdf y Pagare_${formData.noSol}.pdf descargados.`,
        });
      }
    } finally {
      setEnviandoFase(false);
    }
  }, [enviandoFase, formData, fasesDelProducto, storageId, productoSeleccionado]);

  /**
   * Solicitud de Activación — abre el módulo externo.
   * Si la fase contiene "activac" pero NO "solicitud", abre en modo solo lectura.
   */
  const handleSolicitudActivacion = () => {
    if (enviandoFase) return;

    // ── VALIDACIÓN: la solicitud debe estar guardada en BD (UUID) ───────────
    const UUID_REGEX_SOL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const storageIdStr   = String(storageId);
    if (!UUID_REGEX_SOL.test(storageIdStr)) {
      toast.error('Guarda la solicitud primero', {
        description: 'La solicitud de crédito debe estar guardada en BD antes de crear una Solicitud de Activación.',
      });
      return;
    }

    const faseActual = fasesDelProducto.find(f => String(f.faseId) === String(formData.faseId));
    const nombre = (faseActual?.fase || formData.descripcionFase || '')
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Solo lectura cuando la fase ya está completada o el estatus de la solicitud es Aprobado
    const esSoloVer = nombre.includes('completada')
      || formData.faseId?.includes('_completada')
      || formData.estatusSolicitud === 'Aprobado';
    setActivacionModalRO(esSoloVer);
    setShowActivacionModal(true);
  };

  /**
   * REQ-13 — Detonación Contable y Traspaso a Cartera (fin del BPM), sólo GPO.
   * Se llama justo después de que la activación (crearCuentaDesdeSolicitudDB) corre —
   * mismo punto que hoy hace las veces de "Actividad 7.1" para este producto (HU
   * §Decisión #1: no hay un botón "7.1" separado en el código).
   * Idempotente (CA-07): si la Solicitud ya tiene idGarantiaCartera, no genera nada de
   * nuevo ni crea una segunda póliza.
   */
  const formalizarGarantiaSiEsGPO = useCallback(async (dbId: string, cuentaVinculadaId?: string) => {
    if (!esGPOForm) return;
    if (formData.idGarantiaCartera) return;
    const terminosGPO: any = loadFromSession<any>(storageId, 'terminos') || loadFromSavedStore<any>(storageId, 'terminos') || {};
    const monto = parseFloat(parseCurrency(String(terminosGPO.montoGarantizadoGpo || '0'))) || 0;
    // REQ-16 — la guía contabilizadora APERTURA_LINEA vive en el Motor Contable del
    // producto, y los importes de cada partida en los Cargos de la Solicitud (REQ-15).
    const rawProdGPO = productoSeleccionado?.rawData as Record<string, any> | undefined;
    const motorContableProducto: any[] =
      (Array.isArray((productoSeleccionado as any)?.motorContable)
        ? (productoSeleccionado as any).motorContable
        : null) ??
      (Array.isArray(rawProdGPO?.motorContable) ? rawProdGPO!.motorContable : []);
    const cargosSolicitud: any[] =
      loadFromSession<any[]>(storageId, 'cargos') || loadFromSavedStore<any[]>(storageId, 'cargos') || [];
    const resultado = await formalizarGarantiaGPO({
      solicitudId: dbId,
      noSol: formData.noSol || '',
      productoId: formData.productoId || '',
      montoGarantizado: monto,
      cuentaVinculadaId,
      motorContable: motorContableProducto,
      cargos: cargosSolicitud.map((c: any) => ({
        tipoCargo: String(c?.tipoCargo || ''),
        monto: Number(c?.monto) || 0,
      })),
    });
    if (resultado.ok && resultado.idGarantiaCartera && resultado.polizaContableApertura) {
      const idGarantiaCartera = resultado.idGarantiaCartera;
      const polizaContableApertura = resultado.polizaContableApertura;
      setFormData(prev => ({ ...prev, idGarantiaCartera, polizaContableApertura, estatusSolicitud: 'En Administración' }));
      try {
        await onSave?.({ ...formData, idGarantiaCartera, polizaContableApertura, estatusSolicitud: 'En Administración' });
      } catch (err: any) {
        toast.warning('Garantía formalizada, pero no se pudo guardar de inmediato', { description: err?.message || String(err) });
      }
      // REQ-16 — decir con qué quedó la póliza: con desglose de la guía, o sin él y por qué.
      if ((resultado.partidas ?? 0) > 0) {
        toast.success(`Póliza generada desde la guía ${resultado.eventCode}`, {
          description: `${resultado.partidas} partidas por componente. ${resultado.avisoGuia || ''}`.trim(),
          duration: 9000,
        });
      } else if (resultado.avisoGuia) {
        toast.warning('Póliza generada sin desglose por componente', {
          description: resultado.avisoGuia,
          duration: 12000,
        });
      }
      setFormalizacionExitosaGPO({ idGarantiaCartera, polizaContableApertura });
    } else if (!resultado.ok) {
      toast.error('No se pudo generar la póliza de apertura', {
        description: resultado.error || 'Error desconocido — la garantía quedó activada, pero sin póliza contable.',
        duration: 12000,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, storageId, onSave]);

  /**
   * Callback invocado por SolicitudActivacionModal cuando el usuario guarda.
   * Originación valida el resultado (estatus, montos) y avanza de fase si todo está correcto.
   * Para Línea de Crédito: avanza automáticamente.
   */
  const handleActivacionSaved = useCallback(async (savedItem: SolicitudActivacionListItem) => {
    setShowActivacionModal(false);

    // Refrescar la lista de solicitudes de activación para que canActivarCuenta se actualice
    // Awaiting ensures activacionForThisSol reflects latest estatus when modal re-opens
    await refetchActivaciones();

    // Post-validación: la solicitud existe, está en estatus válido y montos coinciden
    const montoSol = parseFloat((formData.montoSolicitado || '0').replace(/[^0-9.-]/g, '')) || 0;
    const resultPostVal = validarResultadoActivacion({
      savedItem,
      montoEsperado: montoSol > 0 ? montoSol : undefined,
    });

    if (!resultPostVal.valid) {
      toast.warning('Solicitud de Activación guardada con advertencias', {
        description: resultPostVal.errors.slice(0, 3).join(' · '),
      });
      // Solo advertimos — el flujo continúa para avanzar fase si el estatus lo requiere.
    } else {
      toast.success('Solicitud de Activación guardada', {
        description: `Estatus: ${savedItem.estatus}`,
      });
    }

    // ── Determinar la acción según la señal que viene del formulario ────────
    //
    // Flujo PROMPT_IA:
    //  1. Guardar (cualquier estatus, _fromActivar=false) → NO avanzar fase
    //  2. Enviar Solicitud  (estatus='Enviada', _fromActivar=false) → avanzar 1 fase, 'En proceso'
    //  3. Activar           (estatus='Pagado', _fromActivar=true)    → avanzar/finalizar, 'Aprobado'
    //
    const estatusNorm = (savedItem.estatus || '').toLowerCase().trim();
    const esPagado    = estatusNorm === 'pagado' || estatusNorm === 'aprobado' || estatusNorm === 'activada';
    const fromActivar = !!savedItem._fromActivar;


    const faseDebugBefore = formData.faseId;

    // Helper reutilizable para avanzar fase ─────────────────────────────────
    const avanzarFase = async (nuevoEstatusLocal: string, logAccion: string) => {
      setEnviandoFase(true);
      try {
        // ── GUARD: fases deben estar cargadas ──────────────────────────────
        if (fasesDelProducto.length === 0) {
          toast.warning('No se pudo avanzar fase', { description: 'Las fases del producto no están cargadas. Guarda y recarga la solicitud.' });
          setEnviandoFase(false);
          return;
        }


        const faseActualReal2 = fasesDelProducto.find(f => String(f.faseId) === String(formData.faseId));
        const seqActual2      = parseInt(String(faseActualReal2?.seq || '1'), 10);
        const sigFase2        = fasesDelProducto.find(f => parseInt(String(f.seq), 10) === seqActual2 + 1);

        const esFasesFinal         = !sigFase2;
        // Fix: en fase final conservar el faseId actual (no agregar '_completada' que rompe el lookup en useFaseConsistency)
        const nuevaFaseId          = sigFase2?.faseId ?? String(faseActualReal2?.faseId ?? formData.faseId);
        const nuevaDescripcionFase = esFasesFinal ? 'Completada' : (sigFase2?.fase || formData.descripcionFase);
        const nuevaArea            = sigFase2?.area  ?? (esFasesFinal ? formData.area : inferirAreaFase(sigFase2?.fase || ''));
        // En fase final siempre 'Aprobado' (independientemente de si es activar o enviar)
        // Para activaciones, usar 'Aprobado' como estatus final del flujo
        const estatusFinal         = esFasesFinal ? 'Aprobado' : nuevoEstatusLocal;

        setFormData(prev => ({
          ...prev,
          faseId:           nuevaFaseId,
          descripcionFase:  nuevaDescripcionFase,
          area:             nuevaArea,
          estatusSolicitud: estatusFinal,
        }));

        const UUID_REGEX2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const dbId2       = String(storageId);
        const esUUID2     = storageId !== 'new' && UUID_REGEX2.test(dbId2);


        if (esUUID2) {
          const resultFase = await avanzarFaseSolicitudDB(dbId2, nuevaFaseId, nuevaDescripcionFase, nuevaArea, estatusFinal);
          if (!resultFase.ok) {
            toast.warning('Fase actualizada localmente (sin BD)', { description: resultFase.error || 'Sincronización pendiente' });
          }

          // ── Persistir Cargos SOLO al enviar a originación (estatus → 'En proceso') ──
          // El resto del tiempo Cargos es vista previa (sessionStorage), nunca viaja a BD.
          if (logAccion === 'enviar_solicitud' && estatusFinal === 'En proceso') {
            const cargos = loadFromSession(storageId, 'cargos') ?? loadFromSavedStore(storageId, 'cargos');
            if (cargos) {
              try {
                await onSave?.({
                  ...formData,
                  faseId: nuevaFaseId,
                  descripcionFase: nuevaDescripcionFase,
                  area: nuevaArea,
                  estatusSolicitud: estatusFinal,
                  _allSubtabs: { cargos },
                });
              } catch (cargosErr) {
                console.warn('[SolicitudCreditoForm] No se pudieron persistir los cargos al enviar a originación:', cargosErr);
              }
            }
          }
        } else {
        }


        if (esFasesFinal) {
          toast.success('¡Flujo completado!', {
            description: `Fase final cerrada: ${faseActualReal2?.fase || formData.descripcionFase} — Estatus: Aprobado`,
          });
        } else if (logAccion === 'activar_solicitud') {
          toast.success(`Fase finalizada: ${faseActualReal2?.fase || formData.descripcionFase}`, {
            description: `Avanzado a: ${nuevaDescripcionFase} — Estatus: Aprobado`,
          });
        } else {
          toast.success(`Avanzado a fase: ${nuevaDescripcionFase}`, {
            description: `Solicitud de activación enviada — Estatus: ${estatusFinal}`,
          });
        }
      } finally {
        setEnviandoFase(false);
      }
    };
    // ────────────────────────────────────────────────────────────────────────

    if (esPagado && fromActivar) {
      // ── "Activar" → finalizar fase actual, estatusSolicitud: 'Autorizada' ──
      await avanzarFase('Autorizada', 'activar_solicitud');

      // Actualizar J_CUENTAS_CORP_CLIENTES con los 4 estatus de activación
      const UUID_RE_ACT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      // Priorizar formData.id (UUID real de BD) sobre storageId (puede ser número)
      const actDbId = UUID_RE_ACT.test(String(formData.id || ''))
        ? String(formData.id)
        : UUID_RE_ACT.test(String(storageId))
          ? String(storageId)
          : '';

      if (actDbId) {
        try {
          const actResult = await activarCuentaDB(actDbId, {
            estatus_sol:  'Aprobado',
            estatus_cuen: 'Activa',
            estatus_disp: 'Pagado',
            estatus_cart: 'Activa',
          }, formData.lineaProducto);
          if (actResult.ok) {
            setFormData(prev => ({ ...prev, estatusSolicitud: 'Aprobado', faseId: '7', descripcionFase: 'Completada' }));
          } else {
          }

          // Crear cuenta nueva en J_CUENTAS_CORP_CLIENTES para esta solicitud autorizada
          const cuentaResult = await crearCuentaDesdeSolicitudDB({
            solicitudId:      actDbId,
            clienteId:        formData._clienteId || actResult.clienteId || '',
            productoId:       formData.productoId || '',
            noSol:            formData.noSol || '',
            lineaProducto:    formData.lineaProducto || '',
            tipoProducto:     formData.tipoProducto || '',
            montoSolicitado:  parseFloat(String(formData.montoSolicitado || 0)) || undefined,
            montoAutorizado:  parseFloat(String(formData.montoAutorizado || formData.montoSolicitado || 0)) || undefined,
          });
          if (cuentaResult.ok && cuentaResult.noCuenta) {
            toast.success('Cuenta creada exitosamente', {
              description: `No. Cuenta: ${cuentaResult.noCuenta} — ${formData.lineaProducto}`,
            });
          } else if (!cuentaResult.ok) {
            toast.warning('Cuenta activada pero no se pudo crear el registro de cuenta', {
              description: cuentaResult.error,
            });
          }

          // REQ-13 — sólo GPO: no interfiere con el flujo de Línea de Crédito normal.
          await formalizarGarantiaSiEsGPO(actDbId, cuentaResult.cuentaId);
        } catch (err) {
        }
      } else {
        toast.warning('No se pudo crear la cuenta — ID de solicitud no disponible');
      }

    } else if (estatusNorm === 'enviada' && !fromActivar) {
      // ── "Enviar Solicitud" → avanzar a siguiente fase, estatusSolicitud: 'En proceso' ──
      await avanzarFase('En proceso', 'enviar_solicitud');

    } else {
      // ── Guardar (Pendiente / Pagado) → NO avanzar fase ──
      if (estatusNorm === 'pagado') {
        toast.info('Solicitud marcada como Pagado. Presione "Activar" para finalizar la fase.');
      }
    }
  }, [formData, fasesDelProducto, storageId, refetchActivaciones, formalizarGarantiaSiEsGPO]);

  /**
   * Activar Cuenta — Fase 7.
   * Originación NO edita la Solicitud de Activación.
   * Solo valida su estatus (Crédito/Captación: "Pagado") y activa la cuenta.
   * La validación preventiva ya está en canActivarCuenta — el botón se deshabilita antes.
   */
  const handleActivarCuenta = useCallback(async () => {
    if (enviandoFase) return;
    // Seguridad extra: verificar canActivarCuenta
    if (!canActivarCuenta) {
      toast.error('No se puede activar la cuenta', {
        description: 'La Solicitud de Activación no está pagada.',
      });
      return;
    }
    setEnviandoFase(true);
    try {
      // Actualizar estatus en BD (Spec §C.2)
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      // Priorizar formData.id (UUID real de BD) sobre storageId (puede ser número)
      const dbId = UUID_REGEX.test(String(formData.id || ''))
        ? String(formData.id)
        : UUID_REGEX.test(String(storageId))
          ? String(storageId)
          : null;

      const datosActivacion = {
        estatusSolicitud: 'Aprobado',
        estatusCuenta:    'Activa',
        estatusPago:      'Pagado',
        estatusCartera:   'Activa',
        fechaActivacion:  new Date().toISOString().split('T')[0],
      };

      setFormData(prev => ({ ...prev, estatusSolicitud: 'Aprobado', faseId: '7', descripcionFase: 'Completada' }));

      if (dbId) {
        const res = await activarCuentaDB(dbId, datosActivacion, formData.lineaProducto);
        if (res.ok) {
          toast.success('¡Cuenta activada exitosamente!', {
            description: `Solicitud ${formData.noSol} — EstatusSolicitud: Aprobado | EstatusCuenta: Activa`,
          });
        } else {
          toast.warning(res.error || 'Cuenta activada localmente (sin conexión BD)', { description: res.error });
        }

        // Crear cuenta nueva en J_CUENTAS_CORP_CLIENTES para esta solicitud autorizada
        const cuentaResult = await crearCuentaDesdeSolicitudDB({
          solicitudId:     dbId,
          clienteId:       formData._clienteId || res.clienteId || '',
          productoId:      formData.productoId || '',
          noSol:           formData.noSol || '',
          lineaProducto:   formData.lineaProducto || '',
          tipoProducto:    formData.tipoProducto || '',
          montoSolicitado: parseFloat(String(formData.montoSolicitado || 0)) || undefined,
          montoAutorizado: parseFloat(String(formData.montoAutorizado || formData.montoSolicitado || 0)) || undefined,
        });
        if (cuentaResult.ok && cuentaResult.noCuenta) {
          toast.success('Cuenta creada en módulo Cuentas de Ahorro', {
            description: `No. Cuenta: ${cuentaResult.noCuenta} — ${formData.lineaProducto}`,
          });
        } else if (!cuentaResult.ok) {
          toast.warning('No se pudo crear el registro de cuenta', { description: cuentaResult.error });
        }

        // REQ-13 — sólo GPO: no interfiere con el flujo de Línea de Crédito normal.
        await formalizarGarantiaSiEsGPO(dbId, cuentaResult.cuentaId);
      } else {
        toast.success('Cuenta activada (modo local)', { description: formData.noSol });
      }
    } finally {
      setEnviandoFase(false);
    }
  }, [enviandoFase, canActivarCuenta, formData, storageId, formalizarGarantiaSiEsGPO]);

  const handleNumeric = (field: keyof SolicitudFormData, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned;
    if (parts.length === 2 && parts[1].length > 2) return;
    set(field, formatted);
  };

  const handleCurrencyBlur = (field: keyof SolicitudFormData) => {
    const raw = parseCurrency(formData[field] as string);
    const num = parseFloat(raw);
    if (!isNaN(num) && num >= 0) set(field, num.toFixed(2));
  };

  // When producto changes, fill nombreProducto (busca en DB primero, fallback catálogo estático)
  const handleProductoChange = (productoId: string) => {
    const dbProd = productosDB.find(p => p.id === productoId);
    const staticProd = CAT_PRODUCTOS.find(p => p.value === productoId);

    // Get first fase from product config to initialize
    const rd = dbProd?.rawData;
    const rawFases = (Array.isArray(rd?.fases) && rd.fases.length > 0 ? rd.fases : null)
      ?? (Array.isArray(rd?.fasesRegistros) && rd.fasesRegistros.length > 0 ? rd.fasesRegistros : null)
      ?? (Array.isArray(rd?.fase) ? rd.fase : null);
    const firstFase = Array.isArray(rawFases) && rawFases.length > 0 ? rawFases[0] : null;

    const faseId = firstFase ? String(firstFase.id ?? firstFase.fase_id ?? firstFase.seq ?? '1') : '1';
    const faseNombre = firstFase?.fase || firstFase?.notes || 'Fase 1';
    const faseArea = firstFase?.area || '';

    // Cambio real de producto (no la carga inicial) — limpiar Plazo/Tasa/%
    // Enganche del encabezado y forzar nueva selección de plazo en la Matriz,
    // ya que pertenecían al producto anterior.
    const isRealChange = !!formData.productoId && formData.productoId !== productoId;
    if (isRealChange) {
      try { sessionStorage.removeItem(`sol_credito_${storageId}_terminos`); } catch { /* ignore */ }
      setTasaSeleccionadaHeader('');
      setFrecuenciaSeleccionadaHeader('');
      setFilaMatrizSeleccionada(null);
    }

    setFormData(prev => ({
      ...prev,
      productoId,
      nombreProducto: dbProd?.nombreProducto || staticProd?.nombre || '',
      tipoProducto: dbProd?.sublineaProducto || prev.tipoProducto || '',
      faseId,
      descripcionFase: faseNombre,
      area: faseArea,
      ...(isRealChange ? { plazo: '', porcentajeEnganche: '', montoAutorizado: '' } : {}),
    }));
  };

  // When fase changes, fill descripcionFase, area and promptIA
  // Get current fase data from product config (usa 'fase' no 'descripcion')
  const currentFase = useMemo(() => {
    return fasesDelProducto.find(f => f.faseId === formData.faseId) || null;
  }, [fasesDelProducto, formData.faseId]);

  const handleFaseChange = (faseId: string) => {
    const fase = fasesDelProducto.find(f => f.faseId === faseId);
    const nombreFase = fase?.fase || fase?.descripcion || '';
    const promptIAProducto = fase?.promptIA || '';
    let area = fase?.area || '';
    if (!area && nombreFase) {
      const lower = nombreFase.toLowerCase();
      if (lower.includes('integraci')) area = 'INTEGRACIÓN';
      else if (lower.includes('análisis') || lower.includes('operativo')) area = 'ANÁLISIS';
      else if (lower.includes('jurídi')) area = 'JURÍDICO';
      else if (lower.includes('formaliz') || lower.includes('liberac')) area = 'LIBERACIÓN';
    }
    setFormData(prev => ({
      ...prev,
      faseId,
      descripcionFase: nombreFase,
      area,
      promptIAFase: promptIAProducto,
    }));
  };

  // Get promptIA for current phase (from form data or product config)
  const fasePromptIA = useMemo(() => {
    if (formData.promptIAFase) return formData.promptIAFase;
    const fase = fasesDelProducto.find(f => f.faseId === formData.faseId);
    return fase?.promptIA || '';
  }, [fasesDelProducto, formData.faseId, formData.promptIAFase]);

  // Validation
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!formData.lineaProducto) e.lineaProducto = 'Obligatorio';
    if (!formData.tipoProducto) e.tipoProducto = 'Obligatorio';
    if (!formData.tipoPersona) e.tipoPersona = 'Obligatorio';
    // Persona Moral no tiene apellidos: el formulario ni siquiera dibuja el
    // campo (ahí va la Razón Social). Exigirlo dejaba la Solicitud imposible
    // de guardar, y el aviso señalaba un campo que no existe en pantalla.
    const esMoral = (formData.tipoPersona || '').toLowerCase().startsWith('moral');
    if (!formData.nombrePersona) e.nombrePersona = esMoral ? 'Capture la Razón Social' : 'Obligatorio';
    if (!esMoral && !formData.apellidoPaternoPersona) e.apellidoPaternoPersona = 'Obligatorio';
    if (!formData.productoId) e.productoId = 'Obligatorio';
    if (!formData.sucursal) e.sucursal = 'Obligatorio';
    const ms = parseFloat(parseCurrency(formData.montoSolicitado || '0'));
    if (!formData.montoSolicitado || isNaN(ms) || ms <= 0) e.montoSolicitado = 'Monto > 0';
    if (!formData.plazo || parseInt(formData.plazo, 10) <= 0) e.plazo = 'Obligatorio';
    if (!e.montoSolicitado && matrizRangoError) e.montoSolicitado = matrizRangoError;
    setErrors(e);
    if (Object.keys(e).length > 0) {
      // Nombrar los campos y, cuando el motivo no es un simple "Obligatorio"
      // (p. ej. fuera del rango de la Matriz), decir también por qué.
      const detalle = Object.entries(e)
        .map(([campo, motivo]) => {
          const etiqueta = campo === 'nombrePersona' && esMoral
            ? 'Razón Social'
            : (ETIQUETAS_CAMPO_OBLIGATORIO[campo] || campo);
          return motivo && motivo !== 'Obligatorio' ? `${etiqueta} (${motivo})` : etiqueta;
        })
        .join(' · ');
      toast.error('Campos obligatorios incompletos', { description: detalle, duration: 7000 });
      return false;
    }
    return true;
  };

  const [savingNoSol, setSavingNoSol] = useState(false);
  const [savingToDB, setSavingToDB] = useState(false);

  const handleSave = async () => {
    if (!validate()) return;
    const d = { ...formData };

    // Para solicitudes nuevas: obtener el NO_SOL atómico del backend (consulta BD)
    if (mode === 'nuevo') {
      setSavingNoSol(true);
      try {
        const nextNoSol = await fetchNextNoSol();
        d.noSol = nextNoSol;
      } catch (err) {
        d.noSol = consumeNoSol();
      } finally {
        setSavingNoSol(false);
      }
    }

    // ── Recopilar datos de TODAS las subtabs ANTES de commitAndClearSession ──
    const allSubtabs: Record<string, any> = {};
    const subtabKeys = ['terminos', 'simulacion', 'simulacion_cal', 'simulacion_inv', 'simulacion_arrendamiento', 'documentos', 'garantias', 'comisiones', 'autorizaciones', 'notas', 'partesRelacionadas', 'facturas', 'estructura2oPiso', 'modeloViabilidad', 'votacionCPC', 'resolucionCIC', 'validacionClausulas', '_originalData'];
    for (const key of subtabKeys) {
      // _originalData puede haber sido limpiado de session por commitAndClearSession en el save anterior;
      // usar savedStore como fallback para no perder los datos de banca móvil al hacer deep merge
      const data = loadFromSession(storageId, key) ?? loadFromSavedStore(storageId, key);
      if (data) allSubtabs[key] = data;
    }

    // ── Guardar en BD (await — blocking) ──
    setSavingToDB(true);
    try {
      await onSave?.({ ...d, _allSubtabs: allSubtabs });
      // Solo limpiar session DESPUÉS de que la BD confirmó
      saveToSavedStore(storageId, 'form', d);
      // Actualizar _originalData en savedStore con los datos que se acaban de guardar,
      // para que el próximo merge incluya los últimos datos y no pierda info de banca móvil
      if (allSubtabs._originalData) {
        saveToSavedStore(storageId, '_originalData', allSubtabs._originalData);
      }
      commitAndClearSession(storageId);
      saveToSavedStore(storageId, 'form', d);
    } catch (err) {
    } finally {
      setSavingToDB(false);
    }
  };

  const handleCancel = () => {
    clearSession(storageId);
    onCancel();
  };

  // Input helpers
  const ic = (hasError = false, disabled = false) => {
    const base = 'w-full px-2 py-1.5 text-xs border rounded focus:outline-none';
    const bdr = hasError ? 'border-red-400' : 'border-gray-300';
    const focus = !disabled && !isRO ? 'focus:ring-2 focus:ring-[#4A6FA5] focus:border-[#4A6FA5]' : '';
    const bg = disabled || isRO ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-800';
    return `${base} ${bdr} ${focus} ${bg}`;
  };

  const sc = (hasError = false) => {
    const base = 'w-full px-2 py-1.5 text-xs border rounded focus:outline-none';
    const bdr = hasError ? 'border-red-400' : 'border-gray-300';
    const focus = !isRO ? 'focus:ring-2 focus:ring-[#4A6FA5]' : '';
    const bg = isRO ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-800';
    return `${base} ${bdr} ${focus} ${bg}`;
  };

  const Lbl = ({ children, req, error }: { children: string; req?: boolean; error?: string }) => (
    <label className={`block text-xs mb-1 ${error ? 'text-red-600' : 'text-gray-700'}`}>
      {children}{req && <span className="text-red-600 ml-0.5">*</span>}
    </label>
  );

  // ── Detección de tipo de producto ──────────────────────────────────────────
  const _linea = (formData.lineaProducto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const isCaptacionForm    = _linea.includes('captac') || _linea.includes('ahorro') || _linea.includes('invers');
  const isLineaCreditoForm = (_linea.includes('linea') || _linea.includes('línea')) && _linea.includes('cred');
  /**
   * Garantía Financiera 2o Piso. Se detecta por nombre O por presencia de los
   * datos GPO heredados: la Solicitud que genera el Cierre Comercial guarda
   * tipo_producto = "Simple" y linea_producto = "Línea de Crédito" — ninguno
   * contiene "garantía", así que el nombre por sí solo no basta.
   */
  const esGPOForm = useMemo(() => {
    const nombre = `${productoSeleccionado?.nombreProducto || ''} ${formData.nombreProducto || ''} ${formData.tipoProducto || ''}`
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (nombre.includes('garant')) return true;
    const t: any = loadFromSession<any>(storageId, 'terminos') || loadFromSavedStore<any>(storageId, 'terminos') || {};
    return !!(t.periodicidadCobroGpo || t.porcentajeCoberturaGpo || t.montoGarantizadoGpo || t.sectorInfraestructura);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoSeleccionado, formData.nombreProducto, formData.tipoProducto, storageId, expedienteKey]);
  /**
   * REQ-13 — ¿la Solicitud está en la fase final del BPM GPO ("Activación de
   * Línea 2o Piso") o ya la cerró? Se detecta por NOMBRE de fase, igual que el
   * resto de las compuertas GPO; 'Completada' cubre el estado posterior al
   * cierre, donde el nombre de la fase ya se reemplazó.
   */
  const enFaseActivacion2oPiso = useMemo(() => {
    const nf = (formData.descripcionFase || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return (nf.includes('activacion') && nf.includes('piso')) || nf.includes('completada');
  }, [formData.descripcionFase]);
  const isCreditoForm      = !isCaptacionForm && !isLineaCreditoForm;

  // ── Subtabs dinámicos según tipo de producto ────────────────────────────────
  // Reglas:
  //   Captación:      sin Garantías (no aplica préstamo), sin Comisiones clásicas
  //   Crédito:        todas las secciones
  //   Línea de Crédito: igual que Crédito pero Simulación = "Disposiciones"
  const sections = [
    { id: 'default',           label: 'Default' },
    { id: 'terminos',          label: 'Términos y Condiciones' },
    // REQ-9 — solo en Garantía Financiera 2o Piso; va antes de cotizar porque el
    // analista "viste" el ecosistema al admitir la solicitud.
    ...(esGPOForm ? [{ id: 'estructura2oPiso', label: 'Estructura Operativa de 2o Piso' }] : []),
    // REQ-10 — Actividad 5 del BPM: Análisis de Grado de Riesgo.
    ...(esGPOForm ? [{ id: 'modeloViabilidad', label: 'Modelo y Viabilidad Financiera' }] : []),
    // REQ-11 — Actividad 6.1 del BPM: Votación del Comité de Prepago y Crédito.
    ...(esGPOForm ? [{ id: 'votacionCPC', label: 'Votación CPC' }] : []),
    // REQ-12 — Actividad 6.2 del BPM: Autorización del Comité Interno de Crédito.
    ...(esGPOForm ? [{ id: 'resolucionCIC', label: 'Resolución Final CIC' }] : []),
    // Actividad 7.1 del BPM: Confección y Validación de Cláusulas Fiduciarias.
    ...(esGPOForm ? [{ id: 'validacionClausulas', label: 'Validación de Cláusulas Fiduciarias' }] : []),
    {
      id: 'simulacion',
      label: isCaptacionForm    ? 'Calendario de Aportaciones'
           : isLineaCreditoForm ? 'Cotización'
           :                      'Simulación',
    },
    ...(esArrendamientoPuro ? [{ id: 'facturas', label: 'Facturas' }] : []),
    { id: 'expediente',        label: 'Expediente Electrónico' },
    { id: 'partesRelacionadas',label: 'Partes Relacionadas' },
    ...(!isCaptacionForm  ? [{ id: 'garantias', label: 'Bienes' }] : []),
    { id: 'comites',           label: 'Comités' },
    { id: 'autorizaciones',    label: 'Autorizaciones' },
    { id: 'fases',             label: 'Fases' },
    { id: 'cargos',            label: 'Cargos' },
    { id: 'comisiones',        label: 'Comisiones' },
    { id: 'notas',             label: 'Notas' },
    { id: 'flujoTrabajo',      label: 'Flujo de Trabajo' },
  ];

  return (
    <div className="flex-1 flex flex-col bg-white overflow-auto">
      {/* ═══ HEADER BAR ═══ */}
      <div className="bg-white px-6 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#4A6FA5" strokeWidth="1.5">
              <path d="M5 1h7l3 3v10a1 1 0 01-1 1H3a1 1 0 01-1-1V2a1 1 0 011-1z" />
              <path d="M12 1v3h3" /><path d="M5 9h7M5 12h4" />
            </svg>
            <span className="text-sm text-gray-700">
              {mode === 'nuevo' ? 'Alta de Solicitud'
                : mode === 'editar' ? `Edición Solicitud — ${formData.noSol}`
                : `Detalle Solicitud — ${formData.noSol}`}
            </span>
            {/* Badge tipo de producto */}
            {formData.lineaProducto && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                isCaptacionForm    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : isLineaCreditoForm ? 'bg-purple-50 text-purple-700 border-purple-200'
                :                     'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {isCaptacionForm ? '💼 Captación' : isLineaCreditoForm ? '🔄 Línea de Crédito' : '📄 Crédito'}
              </span>
            )}
          </div>
          <button onClick={handleCancel} className="text-secondary-theme text-sm hover:underline">Lista</button>
        </div>
      </div>

      {/* ═══ ACTION BAR ═══ */}
      <div className="bg-white px-6 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          {!isRO && (
            <>
              <button onClick={handleSave} disabled={savingToDB || savingNoSol} className="px-5 py-1.5 btn-secondary-theme rounded text-sm disabled:opacity-60 flex items-center gap-2">
                {(savingToDB || savingNoSol) && (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="7" cy="7" r="5" strokeDasharray="20" strokeDashoffset="10" />
                  </svg>
                )}
                {savingNoSol ? 'Generando N° Sol...' : savingToDB ? 'Guardando en BD...' : 'Guardar'}
              </button>
              <button onClick={handleCancel} disabled={savingToDB} className="px-5 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
            </>
          )}
          {isRO && <button onClick={handleCancel} className="px-5 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50">Cerrar</button>}
        </div>
      </div>

      {/* ═══ FLUJO DE TRABAJO — fases del producto seleccionado ═══ */}
      {formData.descripcionFase && (
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
          <FlujoTrabajo
            subEstatus={formData.descripcionFase}
            faseActual={formData.descripcionFase}
            faseActualSeq={fasesDelProducto.find(f => String(f.faseId) === String(formData.faseId))?.seq}
            fases={fasesDelProducto.map(f => ({ seq: f.seq, fase: f.fase, area: f.area }))}
            completada={['Aprobado', 'Autorizada', 'Activo', 'Activa'].includes(formData.estatusSolicitud || '')}
          />
        </div>
      )}

      {/* ═══ FASE ACTION BAR — siempre visible (fasesDelProducto siempre tiene fallback) ═══ */}
      <div className="px-6 py-2.5 border-b border-gray-200">
        <FaseActionsComponent
          fases={fasesDelProducto}
          faseActualId={formData.faseId || '1'}
          formData={formData}
          storageId={storageId}
          modo={modo}
          onEnviarFase={handleEnviarFase}
                  onGenerarFacturaInicial={handleGenerarFacturaInicial}
                  onGenerarFacturaProveedor={handleGenerarFacturaProveedor}
                  esArrendamientoPuro={esArrendamientoPuro}
                  facturaInicialGenerada={facturaInicialGenerada}
                  facturaProveedorGenerada={facturaProveedorGenerada}
          onRegresarFase={handleRegresarFase}
          onGenerarSolicitud={handleGenerarSolicitud}
          onFormalizarContrato={handleFormalizarContrato}
          onSolicitudActivacion={handleSolicitudActivacion}
          onActivarCuenta={handleActivarCuenta}
          canActivarCuenta={canActivarCuenta}
          enviandoFase={enviandoFase}
          existingActivacion={activacionForThisSol}
        />
      </div>

      {/* ═══ REQ-13 — Cierre del BPM GPO: banda persistente con los folios de cartera ═══
          El modal de éxito es de un solo uso (se dispara al formalizar); esta banda
          deja el resultado visible siempre que se reabra la Solicitud. Si la fase
          final se alcanzó sin que la detonación contable llegara a completarse
          —le pasó al bug de FK de account_id— ofrece ejecutarla, en vez de dejar
          la Solicitud en un cierre a medias sin forma de repararlo. */}
      {esGPOForm && enFaseActivacion2oPiso && (
        <div className="mx-6 mt-3">
          {formData.idGarantiaCartera ? (
            <div className="bg-green-50 border border-green-300 rounded px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <div>
                  <div className="text-sm font-medium text-green-900">¡Solicitud Formalizada con Éxito!</div>
                  <div className="text-[11px] text-green-800 mt-0.5">
                    Garantía en Cartera: <span className="font-mono font-medium">{formData.idGarantiaCartera}</span>
                    <span className="mx-2 text-green-400">·</span>
                    Póliza de Apertura: <span className="font-mono font-medium">{formData.polizaContableApertura || '—'}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setFormalizacionExitosaGPO({
                  idGarantiaCartera: formData.idGarantiaCartera || '',
                  polizaContableApertura: formData.polizaContableApertura || '',
                })}
                className="px-3 py-1.5 rounded text-xs font-medium bg-white border border-green-300 text-green-800 hover:bg-green-100 whitespace-nowrap"
              >
                Ver detalle
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-300 rounded px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
              <div className="text-xs text-amber-800">
                <strong>Detonación contable pendiente.</strong> Esta Solicitud llegó a la fase
                final pero aún no tiene folio de cartera ni póliza de apertura.
              </div>
              <button
                onClick={() => {
                  const dbId = String(formData.id || storageId);
                  formalizarGarantiaSiEsGPO(dbId);
                }}
                disabled={enviandoFase}
                className="px-3 py-1.5 rounded text-xs font-medium bg-[#0F766E] text-white hover:bg-[#0D5F58] disabled:opacity-60 whitespace-nowrap"
              >
                Ejecutar Detonación Contable
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ DEBUG IA DE FASES ═══ */}
      {showIAFaseDebug && iaFaseDebug && (
        <div className="mx-6 mt-3 rounded-xl border border-violet-300 overflow-hidden shadow text-xs">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-violet-700 text-white">
            <div className="flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="6" cy="3.5" r="2.5"/><path d="M1 11c0-2.8 2.2-5 5-5s5 2.2 5 5"/>
                <path d="M7.5 2l2-1.5M4.5 2l-2-1.5"/>
              </svg>
              <span className="font-bold tracking-wide">Debug — Validación IA de Fase</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500">
                Fase {iaFaseDebug.faseSeq}: {iaFaseDebug.faseNombre}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-violet-300 text-[10px]">{iaFaseDebug.timestamp}</span>
              {/* Badge de estado */}
              {iaFaseDebug.status === 'pending' && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold">
                  <svg className="animate-spin w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="5" cy="5" r="4" strokeOpacity=".3"/><path d="M5 1a4 4 0 0 1 4 4" strokeLinecap="round"/></svg>
                  ENVIANDO
                </span>
              )}
              {iaFaseDebug.status === 'ok' && iaFaseDebug.resultado?.valido === true && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">✓ VALIDADO</span>
              )}
              {iaFaseDebug.status === 'ok' && iaFaseDebug.resultado?.valido === false && (
                <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">✗ RECHAZADO</span>
              )}
              {iaFaseDebug.status === 'error' && (
                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                  ERROR {iaFaseDebug.httpStatus}
                </span>
              )}
              {iaFaseDebug.status === 'skipped' && (
                <span className="px-2 py-0.5 rounded-full bg-gray-500 text-white text-[10px] font-bold">SIN PROMPT</span>
              )}
              {/* Modelo IA usado */}
              {iaFaseDebug.resultado?.modelo && (
                <span className="px-2 py-0.5 rounded-full bg-violet-900 text-violet-200 text-[10px] font-mono border border-violet-500" title="Modelo IA utilizado">
                  🤖 {iaFaseDebug.resultado.modelo}
                </span>
              )}
              {iaFaseDebug.resultado?._rateLimited && (
                <span className="px-2 py-0.5 rounded-full bg-orange-600 text-white text-[10px] font-bold">⚠ SIN IA (rate limit)</span>
              )}
              <button onClick={() => setShowIAFaseDebug(false)} className="text-violet-300 hover:text-white transition-colors ml-1">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8"/></svg>
              </button>
            </div>
          </div>

          {/* Fila de datos del cliente/producto que se envían */}
          <div className="grid grid-cols-5 gap-px bg-violet-100 border-b border-violet-200 text-[10px]">
            {[
              { label: 'Cliente', value: (iaFaseDebug.payload as any).nombreSolicitante },
              { label: 'Tipo Persona', value: (iaFaseDebug.payload as any).tipoPersona },
              { label: 'Línea Producto', value: (iaFaseDebug.payload as any).lineaProducto },
              { label: 'Tipo Producto', value: (iaFaseDebug.payload as any).tipoProducto },
              { label: 'No. Solicitud', value: (iaFaseDebug.payload as any).noSol },
            ].map(({ label, value }) => (
              <div key={label} className={`px-3 py-1.5 bg-white ${!value ? 'bg-red-50' : ''}`}>
                <div className="text-[9px] text-gray-400 uppercase tracking-wide">{label}</div>
                <div className={`font-semibold truncate ${value ? 'text-gray-800' : 'text-red-500 italic'}`}>
                  {value || 'vacío'}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 divide-x divide-violet-100 bg-white">
            {/* Columna 1: Prompt */}
            <div className="p-3">
              <div className="text-[10px] font-semibold text-violet-700 uppercase tracking-wider mb-1.5">
                Prompt IA de Fase
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${iaFaseDebug.promptIA ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {iaFaseDebug.promptIA ? 'CONFIGURADO' : 'NO CONFIGURADO'}
                </span>
              </div>
              {iaFaseDebug.promptIA ? (
                <p className="text-[10px] text-gray-600 leading-relaxed font-mono bg-violet-50 rounded p-2 max-h-28 overflow-auto">
                  {iaFaseDebug.promptIA}
                </p>
              ) : (
                <p className="text-[10px] text-red-500 italic">
                  Sin promptIA en el subtab Fases del producto. Configúralo para habilitar esta validación.
                </p>
              )}
            </div>

            {/* Columna 2: Documentos en contexto */}
            <div className="p-3">
              <div className="text-[10px] font-semibold text-violet-700 uppercase tracking-wider mb-1.5">
                Documentos enviados al contexto
                <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold ${iaFaseDebug.docsEnContexto > 0 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                  {iaFaseDebug.docsEnContexto} docs
                </span>
              </div>
              {(iaFaseDebug.payload as any).documentos?.length > 0 ? (
                <ul className="space-y-1 max-h-28 overflow-auto">
                  {(iaFaseDebug.payload as any).documentos.map((d: any, i: number) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.validadoIA ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                      <span className="text-[10px] text-gray-700 truncate">{d.tipoDocumento}</span>
                      <span className={`text-[9px] shrink-0 ${d.estatus === 'Validado' ? 'text-emerald-600' : d.estatus === 'Rechazado' ? 'text-red-600' : 'text-amber-600'}`}>
                        {d.estatus}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[10px] text-orange-500 italic">
                  0 documentos en contexto. Verifica que los docs tengan faseId correcto (≤ fase actual).
                </p>
              )}
            </div>

            {/* Columna 3: Resultado IA */}
            <div className="p-3">
              <div className="text-[10px] font-semibold text-violet-700 uppercase tracking-wider mb-1.5">Respuesta del Endpoint</div>
              {iaFaseDebug.status === 'pending' && (
                <p className="text-[10px] text-blue-500 italic animate-pulse">Esperando respuesta...</p>
              )}
              {iaFaseDebug.status === 'ok' && iaFaseDebug.resultado && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${iaFaseDebug.resultado.valido ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {iaFaseDebug.resultado.valido ? '✓ valido: true' : '✗ valido: false'}
                    </span>
                    {typeof iaFaseDebug.resultado.confianza === 'number' && (
                      <span className="text-[10px] text-gray-600 font-semibold">
                        {Math.round(iaFaseDebug.resultado.confianza * 100)}% confianza
                      </span>
                    )}
                  </div>
                  {iaFaseDebug.resultado.motivos?.length > 0 && (
                    <ul className="space-y-0.5 max-h-20 overflow-auto">
                      {iaFaseDebug.resultado.motivos.map((m: string, i: number) => (
                        <li key={i} className="text-[10px] text-gray-600 leading-snug">· {m}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {iaFaseDebug.status === 'error' && (
                <div>
                  <p className="text-[10px] text-red-600 font-semibold mb-1">HTTP {iaFaseDebug.httpStatus}</p>
                  <p className="text-[10px] text-red-500 font-mono bg-red-50 rounded p-1.5 max-h-20 overflow-auto break-all">
                    {iaFaseDebug.errorMsg}
                  </p>
                </div>
              )}
              {iaFaseDebug.status === 'skipped' && (
                <p className="text-[10px] text-gray-400 italic">{iaFaseDebug.errorMsg}</p>
              )}
            </div>
          </div>

          {/* Footer: endpoint */}
          <div className="px-4 py-1.5 bg-violet-50 border-t border-violet-100 flex items-center gap-2">
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeLinecap="round"><circle cx="4.5" cy="4.5" r="3.5"/><path d="M4.5 3v2l1 1"/></svg>
            <span className="text-[10px] text-violet-600 font-mono">
              POST https://{projectId}.supabase.co/functions/v1/make-server-7e2d13d9/validar-documento-ia
            </span>
          </div>
        </div>
      )}

      <div className="px-6 py-6">
        {/* ═══ DIAGNÓSTICO TEMPORAL — eliminar después de verificar ═══ */}
        <details className="mb-4 border border-orange-300 rounded bg-orange-50 text-xs">
          <summary className="px-3 py-1.5 cursor-pointer text-orange-800 font-medium">
            🔍 Debug formData  {Object.values(formData).filter(v => v && v !== '' && v !== '0.00').length}/{Object.keys(formData).length} campos con datos | storageId={String(storageId)} | mode={mode}
          </summary>
          <div className="px-3 py-2 space-y-1 text-[10px] font-mono text-gray-700 max-h-48 overflow-auto">
            {Object.entries(formData).map(([k, v]) => (
              <div key={k} className={`flex gap-2 ${!v || v === '' || v === '0.00' ? 'text-red-500' : 'text-green-700'}`}>
                <span className="w-44 shrink-0 font-semibold">{k}:</span>
                <span className="truncate">{String(v) || '(vacío)'}</span>
              </div>
            ))}
          </div>
        </details>

        {/* ═══════════════════════════════════════════════════════════════
            HEADER — Siempre visible (Spec §3)
            ══════════════════════════════════════════════════════════════ */}

        {/* Banner origen cotización — spec §4 */}
        {formData.cotizacionId && (
          <div className="bg-green-50 border border-green-200 rounded px-4 py-2.5 mb-4 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#0E7B1F" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2z" />
              <path d="M4 6H2a2 2 0 00-2 2v4a2 2 0 002 2h2" /><path d="M8 7l2 2 3-3" />
            </svg>
            <span className="text-xs text-green-800">
              <strong>Solicitud generada desde Cotización</strong> — N° {formData.cotizacionId}
              {' '}| Los datos del header y términos fueron pre-llenados automáticamente.
            </span>
          </div>
        )}

        <div className="bg-[#D9E2F3] border-l-4 border-[#4A6FA5] px-4 py-2 mb-5">
          <h3 className="text-sm text-gray-800 uppercase">Información de la Solicitud</h3>
        </div>

        <div className="grid grid-cols-3 gap-x-6 gap-y-3 mb-8">
          {/* ── Col 1 ── */}
          <div className="space-y-3">
            <div>
              <Lbl>ID</Lbl>
              <input type="text" value={formData.id || 'Automático'} disabled className={ic(false, true)} />
            </div>
            <div>
              <Lbl>N° Solicitud</Lbl>
              <input type="text" value={formData.noSol || 'Automático'} disabled className={ic(false, true)} />
            </div>
            <div>
              <Lbl>Cotización ID</Lbl>
              <input type="text" value={formData.cotizacionId || '(creación directa)'} disabled className={ic(false, true)} />
            </div>
            <div>
              <Lbl req error={errors.lineaProducto}>Línea de Producto</Lbl>
              <select value={formData.lineaProducto} onChange={e => { set('lineaProducto', e.target.value); setActiveSection('fases'); }} disabled={isRO} className={sc(!!errors.lineaProducto)}>
                {CAT_LINEA_PRODUCTO.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {errors.lineaProducto && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.lineaProducto}</span>}
            </div>
            <div>
              <Lbl req error={errors.tipoProducto}>Tipo de Producto</Lbl>
              <input
                type="text"
                value={formData.tipoProducto}
                disabled
                placeholder="(se llena al seleccionar producto)"
                className={ic(!!errors.tipoProducto, true)}
              />
              {errors.tipoProducto && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.tipoProducto}</span>}
            </div>
            <div>
              <Lbl req error={errors.sucursal}>Sucursal</Lbl>
              <select value={formData.sucursal} onChange={e => set('sucursal', e.target.value)} disabled={isRO} className={sc(!!errors.sucursal)}>
                {CAT_SUCURSAL.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {errors.sucursal && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.sucursal}</span>}
            </div>
          </div>

          {/* ── Col 2 ── */}
          <div className="space-y-3">
            <div>
              <Lbl req error={errors.tipoPersona}>Tipo de Persona</Lbl>
              <select value={formData.tipoPersona} onChange={e => set('tipoPersona', e.target.value)} disabled={isRO} className={sc(!!errors.tipoPersona)}>
                <option value="">Seleccionar...</option>
                {CAT_TIPO_PERSONA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {errors.tipoPersona && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.tipoPersona}</span>}
            </div>
            <div>
              <Lbl req error={errors.nombrePersona}>Cliente</Lbl>
              <div
                onClick={() => !isRO && setShowClienteModal(true)}
                className={`flex items-center gap-2 px-3 py-2 text-xs border rounded-lg transition-colors ${
                  isRO
                    ? 'bg-gray-100 text-gray-600 cursor-not-allowed border-gray-200'
                    : errors.nombrePersona
                      ? 'border-red-400 cursor-pointer hover:border-[#4A6FA5] hover:bg-blue-50/30'
                      : 'border-gray-200 cursor-pointer hover:border-[#4A6FA5] hover:bg-blue-50/30'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#9CA3AF" strokeWidth="1.5" className="shrink-0">
                  <circle cx="7" cy="5" r="2.5" />
                  <path d="M2 13c0-3 2.2-5 5-5s5 2 5 5" />
                </svg>
                <span className={`flex-1 truncate ${formData.nombrePersona ? 'text-gray-700' : 'text-gray-400'}`}>
                  {formData.nombrePersona
                    ? `${formData.nombrePersona} ${formData.apellidoPaternoPersona || ''} ${formData.apellidoMaternoPersona || ''}`.trim()
                    : 'Seleccionar cliente...'
                  }
                </span>
                {formData.tipoPersona && (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${
                    formData.tipoPersona === 'Moral' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {formData.tipoPersona}
                  </span>
                )}
                {formData.noCliente && (
                  <span className="text-[10px] text-gray-400 font-mono shrink-0">ID: {formData.noCliente}</span>
                )}
                {!isRO && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#9CA3AF" strokeWidth="1.5" className="shrink-0">
                    <path d="M5 3l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              {errors.nombrePersona && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.nombrePersona}</span>}
            </div>
            {/* BUG FIX (2026-08-25): el RFC del emisor ya viajaba internamente
                como formData._rfc (Buró de Crédito, Expediente Electrónico),
                pero nunca se mostraba como campo visible en el Formulario
                General — para el usuario "no llegaba" aunque sí estaba ahí. */}
            {(formData as any)._rfc && (
              <div>
                <Lbl>RFC Emisor</Lbl>
                <input type="text" value={(formData as any)._rfc} disabled className={ic(false, true)} />
              </div>
            )}
            {/* id_cliente_crm — sí viajaba en formData.noCliente, pero solo se
                pintaba como un "ID: xxx" gris diminuto dentro del selector de
                Cliente; la spec lo pide como campo del Formulario General. */}
            {formData.noCliente && (
              <div>
                <Lbl>ID Cliente CRM</Lbl>
                <input type="text" value={formData.noCliente} disabled className={ic(false, true)} />
              </div>
            )}
            <div>
              <Lbl req error={errors.productoId}>Producto</Lbl>
              <select value={formData.productoId} onChange={e => handleProductoChange(e.target.value)} disabled={isRO} className={sc(!!errors.productoId)}>
                <option value="">{ loadingProductos ? 'Cargando productos...' : 'Seleccionar...' }</option>
                {/* Fallback: si el productoId actual no está en productosFiltrados, mostrarlo como opción para no perder la selección */}
                {formData.productoId && !productosFiltrados.some(p => p.id === formData.productoId) && (
                  <option key={formData.productoId} value={formData.productoId}>
                    {formData.nombreProducto || formData.productoId}
                  </option>
                )}
                {productosFiltrados.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.claveProducto ? `${p.claveProducto} — ${p.nombreProducto}` : p.nombreProducto}
                  </option>
                ))}
              </select>
              {errors.productoId && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.productoId}</span>}
              {/* ═══ DIAGNÓSTICO: conteo de productos ═══ */}
              <div className="mt-1 p-1.5 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-800 space-y-0.5">
                <div className="font-semibold">Diag Productos:</div>
                <div>DB total: <b>{productosDB.length}</b> | Filtrados: <b>{productosFiltrados.length}</b> | Loading: {loadingProductos ? 'Sí' : 'No'}</div>
                <div>Filtro línea: <b>"{formData.lineaProducto || '(ninguna)'}"</b> | Filtro tipo: <b>"{formData.tipoProducto || '(ninguno)'}"</b></div>
                {productosDB.length > 0 && (
                  <details className="cursor-pointer">
                    <summary className="text-amber-700 hover:underline">Ver {productosDB.length} productos de DB</summary>
                    <div className="mt-1 max-h-32 overflow-auto bg-white/70 rounded p-1 text-[9px] font-mono">
                      {productosDB.map((p, i) => (
                        <div key={p.id ?? `prod-${i}`} className={i % 2 === 0 ? 'bg-amber-50/50' : ''}>
                          {i+1}. [{p.type ?? '?'}] linea="{p.lineaProducto ?? ''}" tipo="{p.tipoProducto ?? ''}" → <b>{p.nombreProducto ?? '(sin nombre)'}</b> (id: {(p.id ?? '').slice(0,8)}...)
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                {(() => {
                  try {
                    if (productosDB.length > 0) console.log('[DIAG Producto] Todos los productos DB:', productosDB.map(p => ({ id: (p.id ?? '').slice(0,8), nombre: p.nombreProducto, linea: p.lineaProducto, tipo: p.tipoProducto, type: p.type, source: p.source })));
                  } catch (e) { console.warn('[DIAG Producto] error logging:', e); }
                  return null;
                })()}
              </div>
            </div>
            <div>
              <Lbl>Nombre Producto</Lbl>
              <input type="text" value={formData.nombreProducto} disabled className={ic(false, true)} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Lbl req error={errors.plazo}>Plazo</Lbl>
                {matrizTasaFijaProducto.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowMatrizModal(true)}
                    className="text-[10px] text-[#0066CC] hover:underline"
                  >
                    Ver Matriz de Tasa Fija
                  </button>
                )}
              </div>
              <input
                type="text" inputMode="decimal"
                value={formData.plazo || ''}
                onChange={e => handleNumeric('plazo', e.target.value)}
                disabled={isRO}
                placeholder="Ej: 12"
                className={ic(false, !!errors.plazo)}
              />
              {errors.plazo && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.plazo}</span>}
            </div>
          </div>

          {/* ── Col 3 ── */}
          <div className="space-y-3">
            <div>
              <Lbl>Fecha Solicitud</Lbl>
              <input type="text" value={formData.fechaSolicitud} disabled className={ic(false, true)} />
            </div>
            <div>
              <Lbl>Estatus Solicitud</Lbl>
              <select value={formData.estatusSolicitud} onChange={e => set('estatusSolicitud', e.target.value)} disabled={isRO} className={sc()}>
                {CAT_ESTATUS_SOLICITUD.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <Lbl req error={errors.montoSolicitado}>Monto Autorizado</Lbl>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                <input
                  type="text" inputMode="decimal"
                  value={formData.montoSolicitado}
                  onChange={e => handleNumeric('montoSolicitado', e.target.value)}
                  onBlur={() => handleCurrencyBlur('montoSolicitado')}
                  disabled={isRO} placeholder="0.00"
                  className={`${ic(!!errors.montoSolicitado)} pl-5`}
                />
              </div>
              {errors.montoSolicitado && <span className="text-[10px] text-red-500 mt-0.5 block">{errors.montoSolicitado}</span>}
              {!errors.montoSolicitado && matrizRangoError && (
                <span className="text-[10px] text-red-500 mt-0.5 block">{matrizRangoError}</span>
              )}
              {isArrendamientoHeader && (
                <p className="text-[10px] text-gray-400 mt-0.5">Monto financiado (post-enganche) se calcula en Términos y Condiciones</p>
              )}
            </div>
            {isArrendamientoHeader && (
              <div>
                <Lbl>% Enganche</Lbl>
                <select
                  value={formData.porcentajeEnganche || ''}
                  onChange={e => set('porcentajeEnganche', e.target.value)}
                  disabled={isRO}
                  className={sc()}
                >
                  <option value="">Seleccione...</option>
                  {enganchesProductoHeader.map(o => (
                    <option key={o.id} value={o.valor}>{o.valor}%</option>
                  ))}
                </select>
                {enganchesProductoHeader.length === 0 && (
                  <span className="text-[10px] text-amber-600 mt-0.5 block">Sin opciones activas en el producto</span>
                )}
              </div>
            )}
            <div>
              <Lbl>Fecha Inicio</Lbl>
              <DatePicker value={formData.fechaInicio || ''} onChange={v => set('fechaInicio', v)} disabled={isRO} placeholder="DD/MM/YYYY" className={ic()} />
            </div>
            <div>
              <Lbl>Fecha Fin</Lbl>
              <DatePicker value={formData.fechaFin || ''} onChange={v => set('fechaFin', v)} disabled={isRO} placeholder="DD/MM/YYYY" className={ic()} />
            </div>
          </div>
        </div>

        {/* Descripción (textarea 1024) */}
        <div className="mb-8">
          <Lbl>Descripción</Lbl>
          <textarea
            value={formData.descripcion}
            onChange={e => { if (e.target.value.length <= 1024) set('descripcion', e.target.value); }}
            disabled={isRO}
            rows={3}
            placeholder="Descripción de la solicitud (máximo 1024 caracteres)..."
            className={`w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none resize-none ${
              isRO ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-800 focus:ring-2 focus:ring-[#4A6FA5]'
            }`}
          />
          <div className="text-right text-[10px] text-gray-400 mt-0.5">{(formData.descripcion || '').length}/1024</div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            ACORDEONES (Spec §4–§10)
            ═══════════════════════════════════════════════════════════════ */}
        {sections.map(sec => (
          <div key={sec.id} className="mb-2">
            <button
              onClick={() => setActiveSection(prev => prev === sec.id ? '' : sec.id)}
              className="w-full bg-primary-theme text-white px-3 py-2 text-sm flex items-center justify-between transition-colors hover:bg-[var(--theme-primary-hover)]"
            >
              <div className="flex items-center gap-2">
                <input type="checkbox" className="w-3.5 h-3.5 pointer-events-none" checked={activeSection === sec.id} readOnly />
                <span>{sec.label}</span>
              </div>
              <svg className={`transition-transform ${activeSection === sec.id ? 'rotate-180' : ''}`} width="14" height="14" viewBox="0 0 16 16" fill="white">
                <path d="M8 10l-4-4h8z" />
              </svg>
            </button>

            {activeSection === sec.id && (
              <>
                {sec.id === 'default' && (
                  <div className="bg-white border border-gray-200 p-4 space-y-4">

                    {/* ── BANNER: tipo de producto ── */}
                    {formData.lineaProducto && (
                      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-xs ${
                        isCaptacionForm    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : isLineaCreditoForm ? 'bg-purple-50 border-purple-200 text-purple-800'
                        :                     'bg-blue-50 border-blue-200 text-blue-800'
                      }`}>
                        <span className="font-semibold">{formData.lineaProducto}</span>
                        {formData.tipoProducto && <span className="text-gray-500">·</span>}
                        {formData.tipoProducto && <span>{formData.tipoProducto}</span>}
                        {formData.nombreProducto && <span className="text-gray-500">·</span>}
                        {formData.nombreProducto && <span className="font-medium">{formData.nombreProducto}</span>}
                        <span className="ml-auto text-gray-400">
                          {isCaptacionForm    ? 'Instrumento de captación — tasa de producto, sin garantías'
                          : isLineaCreditoForm ? 'Línea de crédito revolvente — disposiciones y vigencia'
                          :                     'Crédito — tabla de amortización, garantías y seguros'}
                        </span>
                      </div>
                    )}

                    {/* ── Institución de Gobierno ── */}
                    <div className={`flex items-center gap-3 px-3 py-1.5 rounded text-xs border ${(formData as any)._gobierno ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
                      <span className="text-gray-500 font-medium min-w-[150px]">Institución de Gobierno</span>
                      <span className={(formData as any)._gobierno ? 'text-amber-900 font-medium' : 'text-gray-400'}>
                        {(formData as any)._gobierno || '—'}
                      </span>
                    </div>

                    {/* ── FASE ACTUAL (datos del JSON) ── */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                        </svg>
                        Fase Actual
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          — {currentFase?.fase || formData.descripcionFase || 'Sin fase'}
                        </span>
                      </h4>
                      
                      <div className="grid grid-cols-3 gap-4">
                        {/* Número de Fase (seq) */}
                        <div>
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Seq</label>
                          <div className="mt-1 px-3 py-2 bg-white border border-blue-200 rounded text-sm font-semibold text-blue-700">
                            {currentFase?.faseId || formData.faseId || '—'}
                          </div>
                        </div>
                        
                        {/* Área */}
                        <div>
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Área</label>
                          <div className="mt-1 px-3 py-2 bg-white border border-blue-200 rounded text-sm">
                            <span className="inline-flex items-center px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full text-xs font-medium">
                              {currentFase?.area || formData.area || '—'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Título */}
                        <div>
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Título</label>
                          <div className="mt-1 px-3 py-2 bg-white border border-blue-200 rounded text-sm text-gray-700">
                            {currentFase?.fase || formData.descripcionFase || '—'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Notas */}
                      <div className="mt-3">
                        <label className="text-[10px] font-medium text-gray-500 uppercase">Notas</label>
                        <div className="mt-1 px-3 py-2 bg-white border border-blue-200 rounded text-sm text-gray-600">
                          {currentFase?.notes || '—'}
                        </div>
                      </div>

                      {/* Prompt IA */}
                      {(currentFase?.promptIA || formData.promptIAFase) && (
                        <div className="mt-3">
                          <label className="text-[10px] font-medium text-gray-500 uppercase">Prompt IA</label>
                          <div className="mt-1 px-3 py-2 bg-white border border-blue-200 rounded text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                            {currentFase?.promptIA || formData.promptIAFase}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Botones de Fase ── */}
                    <FaseActionsComponent
                      fases={fasesDelProducto}
                      faseActualId={formData.faseId || '1'}
                      formData={formData}
                      storageId={storageId}
                      modo={modo}
                      onEnviarFase={handleEnviarFase}
                  onGenerarFacturaInicial={handleGenerarFacturaInicial}
                  onGenerarFacturaProveedor={handleGenerarFacturaProveedor}
                  esArrendamientoPuro={esArrendamientoPuro}
                  facturaInicialGenerada={facturaInicialGenerada}
                  facturaProveedorGenerada={facturaProveedorGenerada}
                      onRegresarFase={handleRegresarFase}
                      onGenerarSolicitud={handleGenerarSolicitud}
                      onFormalizarContrato={handleFormalizarContrato}
                      onSolicitudActivacion={handleSolicitudActivacion}
                      onActivarCuenta={handleActivarCuenta}
                      canActivarCuenta={canActivarCuenta}
                      enviandoFase={enviandoFase}
                      existingActivacion={activacionForThisSol}
                    />

                  </div>
                )}
                {sec.id === 'fases' && (
                  <FasesSolicitudTab
                    mode={mode}
                    productoId={formData.productoId}
                    faseIdActual={formData.faseId}
                    faseActualSeq={(() => {
                      const seq = fasesDelProducto.find(f => String(f.faseId) === String(formData.faseId))?.seq;
                      const flujoFin = ['Aprobado', 'Autorizada', 'Activo', 'Activa'].includes(formData.estatusSolicitud || '');
                      const maxSeq = fasesDelProducto.length > 0 ? Math.max(...fasesDelProducto.map(f => f.seq)) : 0;
                      // Si el flujo está finalizado en la última fase, seq+1 hace que isPast sea true para ella
                      return (flujoFin && seq === maxSeq) ? (seq || 0) + 1 : seq;
                    })()}
                    estatusSolicitud={formData.estatusSolicitud}
                  />
                )}
                {sec.id === 'estructura2oPiso' && (
                  <EstructuraOperativa2oPisoTab
                    mode={mode}
                    solicitudId={storageId}
                    folioSolicitudLOS={formData.noSol}
                    folioOrigenCRM={formData.cotizacionId}
                    acreditadoEmisor={formData.denominacionRazonSocial || `${formData.nombrePersona || ''} ${formData.apellidoPaternoPersona || ''}`.trim()}
                    clienteId={formData._clienteId}
                    onChange={datos => { estructura2oPisoRef.current = datos; }}
                  />
                )}
                {sec.id === 'modeloViabilidad' && (
                  <ModeloViabilidadFinancieraTab
                    mode={mode}
                    solicitudId={storageId}
                    plazoBonosAnios={(() => {
                      const t: any = loadFromSession<any>(storageId, 'terminos') || loadFromSavedStore<any>(storageId, 'terminos') || {};
                      return t.plazoBonosAnios || '';
                    })()}
                    noSolicitud={formData.noSol}
                    nombreSolicitante={formData.denominacionRazonSocial || `${formData.nombrePersona || ''} ${formData.apellidoPaternoPersona || ''}`.trim()}
                    onChange={d => { modeloViabilidadRef.current = d; }}
                    onProcesarDictamen={handleProcesarDictamenRiesgo}
                  />
                )}
                {sec.id === 'votacionCPC' && (
                  <VotacionCPCTab
                    mode={mode}
                    solicitudId={storageId}
                    onChange={d => { votacionCPCRef.current = d; }}
                  />
                )}
                {sec.id === 'resolucionCIC' && (
                  <ResolucionFinalCICTab
                    mode={mode}
                    solicitudId={storageId}
                    onChange={d => { resolucionCICRef.current = d; }}
                    onEmitirOficio={handleEmitirOficioCIC}
                  />
                )}
                {sec.id === 'validacionClausulas' && (
                  <ValidacionClausulasFiduciariasTab
                    mode={mode}
                    solicitudId={storageId}
                    onChange={d => { validacionClausulasRef.current = d; }}
                  />
                )}
                {sec.id === 'partesRelacionadas' && (
                  <PartesRelacionadasTab
                    mode={mode}
                    solicitudId={storageId}
                    montoSolicitado={formData.montoSolicitado}
                    clienteNombre={`${formData.nombrePersona || ''} ${formData.apellidoPaternoPersona || ''} ${formData.apellidoMaternoPersona || ''}`.trim()}
                    clienteId={formData._clienteId}
                  />
                )}
                {sec.id === 'terminos' && (
                  <TerminosCondicionesTab
                    key={`term-${storageId}-${hidratacionKey}`}
                    mode={mode}
                    solicitudId={storageId}
                    lineaProducto={formData.lineaProducto}
                    tipoProducto={formData.tipoProducto}
                    productoSeleccionado={productoSeleccionado}
                    montoSolicitadoHeader={formData.montoSolicitado}
                    fechaInicioHeader={formData.fechaInicio || ''}
                    tasaCotizacion={(cotizacionData as any)?._terminosCondiciones?.tasa || ''}
                    plazoCotizacion={(cotizacionData as any)?._terminosCondiciones?.plazo || ''}
                    cotizacionTerminos={(cotizacionData as any)?._terminosCondiciones}
                    onFechaPrimeraAportacionChange={v => set('fechaInicio', v)}
                    onMontoAutorizadoChange={v => set('montoAutorizado', v)}
                    onTasaChange={v => setTasaSeleccionadaHeader(v)}
                    onFrecuenciaChange={v => setFrecuenciaSeleccionadaHeader(v)}
                    porcentajeEngancheHeader={formData.porcentajeEnganche}
                    plazoHeader={formData.plazo}
                    onPlazoLoaded={v => set('plazo', v)}
                    tasaHeader={tasaSeleccionadaHeader}
                    frecuenciaHeader={frecuenciaSeleccionadaHeader}
                    tasaRangoMatriz={tasaRangoMatrizHeader}
                    plazoRangoMatriz={plazoRangoMatrizHeader}
                  />
                )}
                {sec.id === 'simulacion' && (
                  <SimulacionTab
                    key={`sim-${storageId}-${hidratacionKey}`}
                    mode={mode}
                    solicitudId={storageId}
                    lineaProducto={formData.lineaProducto}
                    tipoProducto={formData.tipoProducto}
                    calendarioAportaciones={formData._calendarioAportaciones}
                    montoAutorizado={typeof formData.montoAutorizado === 'number' ? formData.montoAutorizado : parseFloat(String(formData.montoAutorizado || '0').replace(/[^0-9.-]/g, ''))}
                    montoSolicitadoHeader={formData.montoSolicitado}
                    plazoHeader={formData.plazo}
                    tasaHeader={tasaSeleccionadaHeader}
                    fechaInicioHeader={formData.fechaInicio || ''}
                    frecuenciaHeader={frecuenciaSeleccionadaHeader}
                    onFechaFinChange={v => set('fechaFin', v)}
                  />
                )}
                {sec.id === 'facturas' && (
                  <FacturasArrendamientoTab
                    mode={mode}
                    solicitudId={storageId}
                    esArrendamientoPuro={esArrendamientoPuro}
                    facturaInicialGenerada={facturaInicialGenerada}
                    facturaProveedorGenerada={facturaProveedorGenerada}
                    onGenerarFacturaInicial={handleGenerarFacturaInicial}
                    onGenerarFacturaProveedor={handleGenerarFacturaProveedor}
                  />
                )}
                {sec.id === 'expediente' && (
                  <ExpedienteElectronicoTab
                    key={`exp-${storageId}-${expedienteKey}-${formData.faseId}`}
                    mode={mode}
                    solicitudId={storageId}
                    faseIdActual={parseInt(formData.faseId) || 1}
                    productoId={formData.productoId}
                    nombreSolicitante={`${formData.nombrePersona || ''} ${formData.apellidoPaternoPersona || ''} ${formData.apellidoMaternoPersona || ''}`.trim()}
                    curpCliente={formData._curp || ''}
                    rfcCliente={formData._rfc || ''}
                    fasePromptIA={fasePromptIA}
                    tipoPersona={formData.tipoPersona || ''}
                    lineaProducto={formData.lineaProducto || ''}
                    descripcionFase={formData.descripcionFase || ''}
                    onEnviarSolicitud={modo === 'originacion' ? handleEnviarSolicitud : undefined}
                    onDocumentosChange={docs => { documentosDelTabRef.current = docs; }}
                    documentosIniciales={documentosDelTabRef.current || undefined}
                    noSolicitud={formData.noSol || ''}
                    tipoProducto={formData.tipoProducto || ''}
                    nombreProducto={productoSeleccionado?.nombreProducto || formData.nombreProducto || ''}
                    plantillasProducto={
                      (Array.isArray(productoSeleccionado?.plantillas) && productoSeleccionado.plantillas.length > 0
                        ? productoSeleccionado.plantillas
                        : (productoSeleccionado?.rawData as any)?.plantillas) || []
                    }
                  />
                )}
                {sec.id === 'garantias' && (
                  <GarantiasTab mode={mode} solicitudId={storageId} montoSolicitado={formData.montoSolicitado} clienteId={formData._clienteId} faseIdActual={parseInt(formData.faseId) || 1} tipoProducto={formData.tipoProducto} />
                )}
                {sec.id === 'comisiones' && (
                  <ComisionesTab mode={mode} solicitudId={storageId} montoSolicitado={formData.montoSolicitado} productoId={formData.productoId} />
                )}
                {sec.id === 'autorizaciones' && (
                  <AutorizacionTab mode={mode} solicitudId={storageId} montoSolicitado={formData.montoSolicitado} productoId={formData.productoId} />
                )}
                {sec.id === 'notas' && (
                  <NotasTab mode={mode} solicitudId={storageId} allowAddNotes={modo === 'originacion'} />
                )}
                {sec.id === 'comites' && (
                  <ComitesTab mode={mode} solicitudId={storageId} />
                )}
                {sec.id === 'cargos' && (
                  <SolicitudCargosTab mode={mode} solicitudId={storageId} lineaProducto={formData.lineaProducto} tipoProducto={formData.tipoProducto} />
                )}
                {sec.id === 'flujoTrabajo' && (
                  <div className="bg-white border border-gray-200 p-4">
                    <h4 className="text-sm font-medium text-gray-800 mb-3">Flujo de Trabajo — Fases del Proceso</h4>
                    <FlujoTrabajo
                      subEstatus={formData.descripcionFase}
                      faseActual={formData.descripcionFase}
                      faseActualSeq={fasesDelProducto.find(f => String(f.faseId) === String(formData.faseId))?.seq}
                      fases={fasesDelProducto.map(f => ({ seq: f.seq, fase: f.fase, area: f.area }))}
                      completada={['Aprobado', 'Autorizada', 'Activo', 'Activa'].includes(formData.estatusSolicitud || '')}
                      className="mt-2"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Modal Solicitud de Activación (Fase 6) — módulo externo ── */}
      {showActivacionModal ? (
        <>
          <SolicitudActivacionModal
            originacionSolicitudId={String(storageId)}
            seed={(() => {
              const _t: any = loadFromSession<any>(storageId, 'terminos') || loadFromSavedStore<any>(storageId, 'terminos') || {};
              // Simulación: session → savedStore → JSONB original (registros de banca móvil)
              const _sSession: any[] = loadFromSession<any[]>(storageId, 'simulacion') || loadFromSavedStore<any[]>(storageId, 'simulacion') || [];
              const _origData: any = loadFromSession<any>(storageId, '_originalData') || {};
              const _sOrig: any[] = (() => {
                const res = _origData?.solicitud?.simulacion?.resultado_simulacion;
                if (Array.isArray(res) && res.length > 0) {
                  // Banca móvil usa snake_case: no_pago, pago_periodo, etc.
                  return res.map((r: any) => ({
                    noPago: r.noPago ?? r.no_pago,
                    pagoPeriodo: r.pagoPeriodo ?? r.pago_periodo ?? r.pago_total ?? 0,
                    pagoCapital: r.pagoCapital ?? r.pago_capital ?? 0,
                    pagoInteres: r.pagoInteres ?? r.pago_interes ?? 0,
                  }));
                }
                return [];
              })();
              const _s: any[] = _sSession.length > 0 ? _sSession : _sOrig;
              const frecuencia = _t.frecuencia || '';

              // ── Regla de negocio: MONTO TRANSACCIÓN según tipo de producto ──
              const lpNorm = (formData.lineaProducto || '').toLowerCase();
              const tpNorm = (formData.tipoProducto || '').toLowerCase();
              const esCredito = lpNorm.includes('cr') && !lpNorm.includes('cap') && !lpNorm.includes('apor');
              const esCaptacionOAportacion = lpNorm.includes('cap') || lpNorm.includes('apor');
              const esInversion = tpNorm.includes('invers') || lpNorm.includes('invers');

              const _montoAutNum = parseFloat(String(formData.montoAutorizado || '0').replace(/[^0-9.-]/g, '')) || 0;
              const _montoSolNum = parseFloat(String(_t.montoSolicitado || formData.montoSolicitado || '0').replace(/[^0-9.-]/g, '')) || 0;
              const _montoBase = _montoAutNum > 0 ? _montoAutNum : _montoSolNum;

              let montoTransaccion = '0';

              if (esCredito || esInversion) {
                // Crédito e Inversión: usar monto autorizado (o solicitado como fallback)
                montoTransaccion = String(_montoBase.toFixed(2));
              } else if (esCaptacionOAportacion) {
                // Captación/Aportación: primer pago del calendario de aportaciones
                const calAportaciones: any[] = (() => {
                  const fromSession = loadFromSession<any[]>(storageId, 'simulacion_cal') || loadFromSavedStore<any[]>(storageId, 'simulacion_cal') || [];
                  if (fromSession.length > 0) return fromSession;
                  const fromOrig = _origData?.solicitud?.simulacion?.calendario_aportaciones;
                  return Array.isArray(fromOrig) ? fromOrig : [];
                })();
                const primerAportacion = calAportaciones.length > 0
                  ? parseFloat(String(calAportaciones[0].monto ?? calAportaciones[0].pagoPeriodo ?? calAportaciones[0].pago_periodo ?? 0)) || 0
                  : 0;
                const primerSimulacion = _s.length > 0 ? (parseFloat(String(_s[0].pagoPeriodo ?? 0)) || 0) : 0;
                const primerPago = primerAportacion > 0 ? primerAportacion : primerSimulacion;
                montoTransaccion = String((primerPago > 0 ? primerPago : _montoBase).toFixed(2));
              } else {
                // Línea de Crédito u otro: primer pago de simulación
                const primerPago = _s.length > 0 ? (parseFloat(String(_s[0].pagoPeriodo ?? 0)) || 0) : 0;
                montoTransaccion = String((primerPago > 0 ? primerPago : 0).toFixed(2));
              }

              // Fecha Compromiso = Fecha Inicio de la solicitud
              const fechaCompromiso: string = formData.fechaInicio || '';
              return {
                cliente: [formData.nombrePersona, formData.apellidoPaternoPersona, formData.apellidoMaternoPersona]
                  .filter(Boolean).join(' ').trim(),
                clienteId: formData._clienteId || '',
                lineaProducto: formData.lineaProducto || '',
                tipoProducto: formData.tipoProducto || '',
                montoTransaccion,
                moneda: _t.moneda || 'MXN',
                productoId: formData.productoId || '',
                fechaCompromiso,
                periodicidad: frecuencia,
                numeroDocumento: (formData as any)._curp || (formData as any)._rfc || '',
                institucionFinanciera: (formData as any)._gobierno || '',
              };
            })()}
            existingActivacion={activacionForThisSol}
            readOnly={activacionModalRO}
            onClose={() => setShowActivacionModal(false)}
            onSaved={handleActivacionSaved}
          />
        </>
      ) : null}

      {/* ── REQ-13: Pantalla de Éxito de Formalización (fin del BPM, solo GPO) ── */}
      {formalizacionExitosaGPO && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-800">¡Solicitud Formalizada con Éxito!</h3>
              <p className="text-xs text-gray-500 mt-1">
                La garantía quedó activa en cartera, lista para administración.
              </p>
            </div>
            <div className="space-y-3 mb-6">
              <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">ID de Garantía en Cartera</div>
                <div className="text-sm font-mono font-medium text-gray-800">{formalizacionExitosaGPO.idGarantiaCartera}</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
                <div className="text-[10px] text-gray-500 uppercase tracking-wide">Póliza Contable de Apertura</div>
                <div className="text-sm font-mono font-medium text-gray-800">{formalizacionExitosaGPO.polizaContableApertura}</div>
                <div className="text-[10px] text-amber-600 mt-1">
                  Cuenta contable provisional — pendiente de confirmar con Contabilidad.
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                disabled
                title="Módulo de Monitoreo de Cartera GPO — próximamente"
                className="w-full px-4 py-2 rounded text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
              >
                Ir a Monitoreo de Cartera GPO (próximamente)
              </button>
              <button
                onClick={() => setFormalizacionExitosaGPO(null)}
                className="w-full px-4 py-2 rounded text-sm font-medium bg-[#2E5C91] text-white hover:bg-[#254A75]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Selección de Cliente ── */}
      <SeleccionarClienteModal
        isOpen={showClienteModal}
        onClose={() => setShowClienteModal(false)}
        onSelect={(c) => {
          set('nombrePersona', c.nombre);
          set('apellidoPaternoPersona', c.apellidoPaterno);
          set('apellidoMaternoPersona', c.apellidoMaterno || '');
          set('noCliente', c.idCliente);
          set('_clienteId' as keyof SolicitudFormData, c.dbUuid || c.idCliente);
          set('tipoPersona', c.personalidad?.toLowerCase().includes('moral') ? 'Moral' : 'Física');
          set('_rfc' as keyof SolicitudFormData, c.rfc || '');
          set('_curp' as keyof SolicitudFormData, c.curp || '');
          set('_gobierno' as keyof SolicitudFormData, c.gobierno || '');
          (setFormData as any)(prev => ({
            ...prev,
            _domicilio: c.domicilio || '',
            _telefono: c.telefono || '',
            _email: c.email || '',
            _fechaNacimiento: c.fechaNacimiento || '',
          }));
          // Limpiar error de nombre
          setErrors(prev => {
            const { nombrePersona, ...rest } = prev;
            return rest;
          });
        }}
      />

      {/* ── Modal Matriz de Tasa Fija (solo consulta) ── */}
      {showMatrizModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setShowMatrizModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-3xl mx-4 max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="modal-header-theme px-5 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold tracking-wide uppercase">Matriz de Tasa Fija — {formData.nombreProducto}</span>
              <button onClick={() => setShowMatrizModal(false)} className="text-white/80 hover:text-white">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 2l12 12M14 2L2 14" /></svg>
              </button>
            </div>
            <div className="p-4 overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                    <th className="px-3 py-2 text-center font-semibold text-[10px] text-gray-700 border-r border-gray-300">PLAZO (MESES)</th>
                    <th className="px-3 py-2 text-center font-semibold text-[10px] text-gray-700 border-r border-gray-300">FRECUENCIA</th>
                    <th className="px-3 py-2 text-right font-semibold text-[10px] text-gray-700 border-r border-gray-300">MONTO MÍNIMO</th>
                    <th className="px-3 py-2 text-right font-semibold text-[10px] text-gray-700 border-r border-gray-300">MONTO MÁXIMO</th>
                    <th className="px-3 py-2 text-right font-semibold text-[10px] text-gray-700 border-r border-gray-300">TASA ANUAL</th>
                    <th className="px-3 py-2 text-right font-semibold text-[10px] text-gray-700 border-r border-gray-300">TASA MENSUAL</th>
                    <th className="px-3 py-2 text-center font-semibold text-[10px] text-gray-700 border-r border-gray-300">ESTATUS</th>
                    <th className="px-3 py-2 text-center font-semibold text-[10px] text-gray-700 w-24">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {matrizTasaFijaProducto.map((f, idx) => {
                    const tasaAnual = parseFloat(String(f.tasaMinima ?? f.tasaAplicable ?? '0')) || 0;
                    const tasaDefault = parseFloat(String(f.tasaDefault ?? '')) || tasaAnual;
                    const tasaMensual = tasaAnual / 12;
                    const montoNum = parseFloat(parseCurrency(formData.montoSolicitado || '0')) || 0;
                    const min = f.montoMinimo || 0;
                    const max = f.montoMaximo || 0;
                    const fueraDeRango = montoNum > 0 && ((min > 0 && montoNum < min) || (max > 0 && montoNum > max));
                    const esSeleccionada = !!filaMatrizSeleccionada
                      && filaMatrizSeleccionada.plazoMinimo === f.plazoMinimo
                      && filaMatrizSeleccionada.plazoMaximo === f.plazoMaximo;
                    return (
                      <tr key={idx} className={esSeleccionada ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-1.5 text-center border-r border-gray-200 font-medium">
                          {esSeleccionada && (
                            <svg className="inline-block mr-1 -mt-0.5" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#0066CC" strokeWidth="2.5">
                              <path d="M3 8l3.5 3.5L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          {f.plazoMinimo} – {f.plazoMaximo}
                        </td>
                        <td className="px-3 py-1.5 text-center border-r border-gray-200">{f.periodo || '—'}</td>
                        <td className="px-3 py-1.5 text-right border-r border-gray-200 font-mono">{formatCurrency(min)}</td>
                        <td className="px-3 py-1.5 text-right border-r border-gray-200 font-mono">{formatCurrency(max)}</td>
                        <td className="px-3 py-1.5 text-right border-r border-gray-200 font-mono">{tasaAnual.toFixed(2)}%</td>
                        <td className="px-3 py-1.5 text-right border-r border-gray-200 font-mono">{tasaMensual.toFixed(2)}%</td>
                        <td className="px-3 py-1.5 text-center border-r border-gray-200">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Activo
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <button
                            type="button"
                            title={fueraDeRango ? 'El Monto Autorizado actual no está en el rango de este plazo — podrás ajustarlo después de seleccionar' : ''}
                            onClick={() => {
                              set('plazo', String(f.plazoDefault || f.plazoMaximo || f.plazoMinimo || ''));
                              setTasaSeleccionadaHeader(tasaDefault.toFixed(4));
                              if (f.periodo) setFrecuenciaSeleccionadaHeader(f.periodo);
                              setFilaMatrizSeleccionada(f);
                              // Si el usuario no capturó Monto, o el que tiene queda fuera del
                              // rango de esta fila, sugerir el Monto Default de la fila elegida.
                              if ((!formData.montoSolicitado || fueraDeRango) && f.montoDefault) {
                                set('montoSolicitado', String(f.montoDefault));
                              }
                              setShowMatrizModal(false);
                              toast.success('Plazo, tasa y frecuencia aplicados', { description: `Plazo ${f.plazoMinimo}–${f.plazoMaximo} meses · Tasa ${tasaDefault.toFixed(2)}% anual${f.periodo ? ` · ${f.periodo}` : ''}` });
                            }}
                            className={`px-2.5 py-1 rounded text-[10px] font-medium ${
                              esSeleccionada
                                ? 'bg-blue-100 text-[#0066CC] cursor-default'
                                : 'bg-[#0099CC] text-white hover:bg-[#0088BB]'
                            }`}
                          >
                            {esSeleccionada ? 'Seleccionada' : 'Seleccionar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(() => {
                const montoNum = parseFloat(parseCurrency(formData.montoSolicitado || '0')) || 0;
                if (montoNum <= 0) {
                  return <p className="text-[10px] text-amber-600 mt-3">Capture el Monto Autorizado para validar el rango de cada plazo.</p>;
                }
                const algunoEnRango = matrizTasaFijaProducto.some(f => {
                  const min = f.montoMinimo || 0, max = f.montoMaximo || 0;
                  return (min <= 0 || montoNum >= min) && (max <= 0 || montoNum <= max);
                });
                if (!algunoEnRango) {
                  return <p className="text-[10px] text-red-600 mt-3">El Monto Autorizado no está dentro del rango de ningún plazo de este producto.</p>;
                }
                return <p className="text-[10px] text-gray-400 mt-3">Seleccione el plazo correspondiente al Monto Autorizado.</p>;
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}