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
import {
  SolicitudFormData, EMPTY_FORM, MOCK_FORMS, SOLICITUDES_LISTA,
  saveToSession, loadFromSession, loadFromSavedStore, saveToSavedStore, commitAndClearSession, clearSession,
  formatCurrency, parseCurrency, generateNoSol, consumeNoSol, getFechaSolicitudNow,
  CAT_LINEA_PRODUCTO, CAT_TIPO_PRODUCTO, CAT_TIPO_PERSONA, CAT_PRODUCTOS,
  CAT_FASES, CAT_SUCURSAL, CAT_ESTATUS_SOLICITUD,
  type DocumentoCargado, type RequisitoProducto,
} from './solicitudCreditoStore';
import { TerminosCondicionesTab } from './TerminosCondicionesTab';
import { SimulacionTab, calcularNumeroPeriodos } from './SimulacionTab';
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
import { fetchNextNoSol, updateFaseSolicitudDB, avanzarFaseSolicitudDB, regresarFaseSolicitudDB, formalizarContratoSolicitudDB, activarCuentaDB } from '../../hooks/useSolicitudesDB';
import {
  validarDocumentosFase, validarDocumentosPorFase, validarNotaReciente, validarFormalizarContrato,
  validarContratosYPagares, validarFase4Envio, validarFase6, leerRequisitosProducto,
  getRequisitosFromRawData, validarResultadoActivacion,
} from '../../hooks/useOriginacionValidaciones';
import { useSolicitudesActivacionDB } from '../../hooks/useSolicitudesActivacionDB';
import type { SolicitudActivacionListItem } from '../solicitudes-activacion/solicitudActivacionStore';
import { calcularFechaPrimerPago } from '../solicitudes-activacion/solicitudActivacionStore';
import {
  generarContratoPDF, generarPagePDF, generarSolicitudPDF,
  autoCrearDocumentosFase2, CLAVE_SOLICITUD_BASE,
  type DatosSolicitud,
} from '../../hooks/generarDocumentosFase4';
import { SolicitudActivacionModal } from '../originacion/SolicitudActivacionModal';
import { FaseActionsComponent } from '../shared/FaseActionsComponent';
import { addOriginacionItem, CAT_AREA } from '../originacion/originacionStore';
import { FlujoTrabajo } from '../originacion/FlujoTrabajo';
import { SolicitudCargosTab } from './SolicitudCargosTab';
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

export function SolicitudCreditoForm({ mode, solicitudId, onCancel, onSave, cotizacionData, modo: modoProp = 'solicitudes' }: SolicitudCreditoFormProps) {
  const storageId: number | string | 'new' = mode === 'nuevo' ? 'new' : (solicitudId ?? 1);
  const initialRender = useRef(true);
  /** Tracks the formData snapshot at mount time — used to detect user-driven changes */
  const loadedProductoId = useRef<string>('');
  const loadedTipoProducto = useRef<string>('');

  const getInitial = useCallback((): SolicitudFormData => {
    console.log('[SolicForm] getInitial → mode:', mode, '| solicitudId:', solicitudId, '| storageId:', storageId);
    const session = loadFromSession<SolicitudFormData>(storageId, 'form');
    console.log('[SolicForm] getInitial → loadFromSession result:', session ? `OK (noSol: ${session.noSol}, nombre: ${(session as any).nombrePersona}, tipoProducto: ${(session as any).tipoProducto}, productoId: ${(session as any).productoId})` : 'NULL');
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
    console.log('[SolicForm] Safety re-init fired → solicitudId:', solicitudId, '| storageId:', storageId);
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
      console.log('[SolicForm] Auto-resolve tipoProducto from product:', dbProd.sublineaProducto);
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
        console.log('[SolicForm] CASCADE RESET productoId:', formData.productoId, '→ cleared (not in filtrados)');
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
        console.log('[SolicForm] initialRender → false (productos loaded, settling complete)');
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
      console.log('[SolicForm] Syncing from product:', { faseData, faseIdMismatch, needsFaseSync, needsNombreProducto, needsTipoProducto });
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
    // Crédito / Captación: requiere Solicitud de Activación con estatus "Enviada" o "Pagado"
    const est = (activacionForThisSol?.estatus || '').toLowerCase().trim();
    return est === 'enviada' || est === 'pagado';
  }, [activacionForThisSol, formData.lineaProducto]);

  // (Auto-generación de documentos en Fase 4 eliminada — los PDFs se generan
  //  manualmente con "Formalizar Contrato" y el usuario los firma y sube al expediente.)

  const handleEnviarFase = useCallback(async () => {
    // En modo originación siempre se permite; en otros modos respeta isRO
    if ((isRO && modo !== 'originacion') || enviandoFase) return;
    setEnviandoFase(true);
    try {
      // ── 1. Encontrar faseActualReal por faseId (NO por índice) ──
      const faseActualReal = fasesDelProducto.find(f => String(f.faseId) === String(formData.faseId));
      const seqActual = faseActualReal?.seq ?? (parseInt(formData.faseId) || 1);

      // ── 2. Obtener documentos cargados (Sección 2) y requisitos (Sección 1) ──
      const documentos: DocumentoCargado[] =
        loadFromSession<DocumentoCargado[]>(storageId, 'documentos') ||
        loadFromSavedStore<DocumentoCargado[]>(storageId, 'documentos') ||
        [];
      const rawData = productoSeleccionado?.rawData as Record<string, any> | undefined;
      const requisitosProducto = getRequisitosFromRawData(rawData);

      // ── 3. Validar documentos obligatorios de la fase actual (Sección B) ──
      // Solo valida documentos cuya FaseConfigurada == FaseActual
      const faseNombre = faseActualReal?.fase || `Fase ${seqActual}`;
      console.log(`[handleEnviarFase] tipoPersona="${formData.tipoPersona}"`);
      console.log(`[handleEnviarFase] requisitos:`, requisitosProducto.map(r => `"${r.tipoDocumento}" → faseId=${r.faseId} oblig=${r.obligatorio} persona=${(r as any).tipoPersona || (r as any).persona || 'N/A'}`));
      const valFase = validarDocumentosPorFase(
        seqActual, faseNombre, requisitosProducto, documentos, formData.tipoPersona,
      );
      if (!valFase.valido) {
        // Solo faltantes (sin archivo o rechazados) bloquean el avance
        const desc = valFase.faltantes.slice(0, 3).join(', ') + (valFase.faltantes.length > 3 ? ` (+${valFase.faltantes.length - 3} más)` : '');
        toast.error('No se puede avanzar de fase', {
          description: `Documentos faltantes: ${desc}`,
          duration: 8000,
        });
        console.log(`[Fase ${seqActual}] Validación por fase:`, valFase);
        return;
      }
      // Advertencia no bloqueante: docs cargados pero pendientes de validación IA
      if (valFase.pendientesValidacion.length > 0) {
        toast.warning('Documentos pendientes de validación IA', {
          description: valFase.pendientesValidacion.slice(0, 3).join(', '),
          duration: 5000,
        });
      }
      console.log(`[Fase ${seqActual}] ✅ Documentos validados:`, valFase.documentosValidados.join(', '));

      // ── 3a. Validación IA con el prompt de la fase ──
      // Envía los datos extraídos de los documentos al Edge Function con el prompt de la fase.
      // El prompt de la fase define QUÉ validar a nivel de fase completa.
      const fasePromptIA = faseActualReal?.promptIA;
      if (fasePromptIA) {
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

          const promptConContexto =
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

          const payloadFaseIA = {
            faseActual: faseNombre,
            faseNumero: seqActual,
            botonPresionado: 'enviarFase',
            promptIA: promptConContexto,
            // Datos del cliente
            nombreSolicitante: nombreCliente,
            tipoPersona: formData.tipoPersona,
            noSol: formData.noSol || '',
            // Datos del producto / crédito
            lineaProducto: formData.lineaProducto || '',
            tipoProducto: formData.tipoProducto || '',
            productoNombre: productoSeleccionado?.nombreProducto || formData.tipoProducto || '',
            monto: terminos.montoSolicitado || terminos.monto || '',
            plazo: terminos.plazo || terminos.plazoMeses || '',
            moneda: terminos.moneda || 'MXN',
            // Expediente
            documentos: contextoDocs,
            resumenDocumentos: resumenDocs || 'Sin documentos registrados.',
            requisitosObligatorios: requisitosDeEstaFase,
            // Conteo de documentos
            totalDocumentosCargados: docsCargados,
            documentosValidadosIA: docsValidados,
            documentosRechazadosIA: docsRechazados,
            documentosPendientesValidacion: docsPendientes,
          };

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

          console.log(`[Fase ${seqActual}] Enviando validacion IA → /validar-documento-ia | docs: ${contextoDocs.length} | prompt: "${fasePromptIA?.substring(0, 80)}..."`);

          const resFaseIA = await fetch(`${API_BASE_FASE}/validar-documento-ia`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify(payloadFaseIA),
          });

          toast.dismiss(toastIA);

          if (resFaseIA.ok) {
            const resultadoFaseIA = await resFaseIA.json();
            setIaFaseDebug(prev => prev ? { ...prev, status: 'ok', httpStatus: resFaseIA.status, resultado: resultadoFaseIA } : null);
            console.log(`[Fase ${seqActual}] IA resultado:`, resultadoFaseIA);

            if (resultadoFaseIA.valido === false) {
              toast.error(`IA: Fase "${faseNombre}" no cumple criterios`, {
                description: (resultadoFaseIA.motivos || []).slice(0, 3).join(' · '),
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
          } else if (resFaseIA.status === 404) {
            setIaFaseDebug(prev => prev ? { ...prev, status: 'error', httpStatus: 404, errorMsg: 'Endpoint no encontrado (404)' } : null);
            console.warn(`[Fase ${seqActual}] /validar-documento-ia 404.`);
          } else {
            const errText = await resFaseIA.text();
            setIaFaseDebug(prev => prev ? { ...prev, status: 'error', httpStatus: resFaseIA.status, errorMsg: errText } : null);
            console.warn(`[Fase ${seqActual}] Error IA HTTP ${resFaseIA.status}:`, errText);
          }
        } catch (errFaseIA: any) {
          toast.dismiss(toastIA);
          console.warn(`[Fase ${seqActual}] Error de red en validación IA de fase:`, errFaseIA.message);
          // No bloquear por errores de red — continuar
        }
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
        console.log(`[Fase ${seqActual}] Sin promptIA configurado — omitiendo validacion IA de fase.`);
      }

      // ── 3b. Fase 4: validar Términos, Garantías y Comités antes de avanzar ──
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
      }

      // ── 3c. Fase 5: validar contratos y pagarés (Sección D) ──
      if (seqActual === 5) {
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
      if (!sigFase) {
        toast.info('Esta es la última fase del flujo', { description: faseActualReal?.fase || formData.descripcionFase });
        return;
      }

      const nuevaAreaActual = sigFase.area || inferirAreaFase(sigFase.fase);

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
      } else {
        toast.success('Fase avanzada', { description: `${faseActualReal?.fase || formData.descripcionFase} → ${sigFase.fase}. Guarda para persistir.` });
      }
    } finally {
      setEnviandoFase(false);
    }
  }, [isRO, modo, enviandoFase, formData, fasesDelProducto, storageId, productoSeleccionado]);

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
      if (!formData.montoSolicitado || formData.montoSolicitado.trim() === '' || parseFloat(formData.montoSolicitado.replace(/[^0-9.-]/g, '')) <= 0) errores.push('Monto Solicitado');
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

        const cliente = [formData.nombrePersona, formData.apellidoPaternoPersona, formData.apellidoMaternoPersona]
          .filter(Boolean).join(' ').trim() || 'Cliente';

        // ── Enriquecer datos del cliente desde DB si hay _clienteId y faltan campos ──
        // Esto aplica cuando la solicitud viene de Cotización (el modal de cliente no fue usado)
        let clienteExtra: Record<string, string> = {
          rfc: (formData as any)._rfc || '',
          curp: (formData as any)._curp || '',
          domicilio: (formData as any)._domicilio || '',
          telefono: (formData as any)._telefono || '',
          email: (formData as any)._email || '',
          fechaNacimiento: (formData as any)._fechaNacimiento || '',
        };

        const clienteUUID = (formData as any)._clienteId || '';
        const faltanDatos = !clienteExtra.rfc || !clienteExtra.curp || !clienteExtra.telefono;
        if (clienteUUID && faltanDatos) {
          try {
            const _API = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
            const _heads = { 'Authorization': `Bearer ${publicAnonKey}` };
            // Intentar ambos endpoints — el primero que responda OK gana
            let rows: any[] = [];
            for (const ep of ['/clientes-lista-todos', '/clientes-prospectos']) {
              const res = await fetch(`${_API}${ep}`, { headers: _heads });
              if (res.ok) {
                const json = await res.json();
                rows = json.data || [];
                if (rows.length > 0) break;
              }
            }
            // Buscar por UUID (row.id) o por authUserId dentro del data
            const rowC = rows.find((r: any) =>
              r.id === clienteUUID ||
              r.data?.authUserId === clienteUUID
            );
            if (rowC) {
              const d = rowC.data || {};
              const g = (k: string) => d[k] || d.default?.[k] || '';
              const dirs: any[] = Array.isArray(d.direcciones) ? d.direcciones : [];
              // Preferir la dirección principal; si no hay, usar la primera
              const dir0 = dirs.find((x: any) => x.principal) || dirs[0] || {};
              const domParts = [
                dir0.calle || d.calle || d.direccion || '',
                dir0.numeroExterior || '',
                dir0.colonia || d.colonia || '',
                dir0.municipio || d.municipio || '',
                dir0.estado || dir0.entidadFederativa || d.entidadFederativa || '',
                dir0.codigoPostal ? `C.P. ${dir0.codigoPostal}` : '',
              ].filter(Boolean);
              clienteExtra = {
                rfc: g('rfc') || clienteExtra.rfc,
                curp: g('curp') || clienteExtra.curp,
                domicilio: domParts.length > 0 ? domParts.join(', ') : (d.domicilio || d.direccion || clienteExtra.domicilio),
                telefono: g('telefono') || g('telefonoDomicilio') || g('celular') || g('telefonoCelular') || clienteExtra.telefono,
                email: g('correoElectronico') || g('email') || g('correo') || clienteExtra.email,
                fechaNacimiento: g('fechaNacimiento') || g('fechaNac') || clienteExtra.fechaNacimiento,
              };
            }
          } catch (_) { /* si falla el fetch, continúa con los datos que ya hay */ }
        }

        const datosSolicitud: DatosSolicitud = {
          noSol: formData.noSol,
          cliente,
          lineaProducto: formData.lineaProducto,
          tipoProducto: formData.tipoProducto,
          productoNombre: productoSeleccionado?.nombreProducto || formData.tipoProducto || '',
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
        console.error('[SolicForm] handleGenerarSolicitud error:', err);
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
      const plantillasProducto = rawData?.plantillas || [];

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

      // ── Generar PDFs ──
      const datosSolicitud: DatosSolicitud = {
        noSol: formData.noSol,
        cliente,
        lineaProducto: formData.lineaProducto,
        tipoProducto: formData.tipoProducto,
        productoNombre: productoSeleccionado?.nombreProducto || formData.tipoProducto || '',
        terminos,
      };

      const contratoPDF = generarContratoPDF(datosSolicitud);
      const pagarePDF   = generarPagePDF(datosSolicitud);

      // ── Convertir base64 a blob URL (window.open no acepta data: URLs en Chrome) ──
      const toObjectURL = (dataUrl: string): string => {
        const [header, b64] = dataUrl.split(',');
        const mime = header.match(/:(.*?);/)?.[1] ?? 'application/pdf';
        const bin = atob(b64);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        return URL.createObjectURL(new Blob([buf], { type: mime }));
      };

      const contratoUrl = toObjectURL(contratoPDF);
      const pagareUrl   = toObjectURL(pagarePDF);

      // ── Abrir en pestañas nuevas ──
      const tabContrato = window.open(contratoUrl, '_blank');
      const tabPagare   = window.open(pagareUrl,   '_blank');
      if (!tabContrato || !tabPagare) {
        toast.warning('El navegador bloqueó las pestañas', {
          description: 'Permita las ventanas emergentes para este sitio y vuelva a intentarlo.',
        });
      }

      // ── Descarga automática ──
      const descargar = (url: string, nombre: string) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      descargar(contratoUrl, `Contrato_${formData.noSol}.pdf`);
      descargar(pagareUrl,   `Pagare_${formData.noSol}.pdf`);

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
          console.warn('[SolicForm] formalizarContrato BD FALLÓ (guardado local):', res.error);
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
      console.warn('[PROMPT_IA] handleSolicitudActivacion: storageId no es UUID →', storageIdStr);
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
    console.log('[PROMPT_IA] handleSolicitudActivacion: abriendo modal', { storageId: storageIdStr, esSoloVer, faseActual: faseActual?.fase, nombre });
    setActivacionModalRO(esSoloVer);
    setShowActivacionModal(true);
  };

  /**
   * Callback invocado por SolicitudActivacionModal cuando el usuario guarda.
   * Originación valida el resultado (estatus, montos) y avanza de fase si todo está correcto.
   * Para Línea de Crédito: avanza automáticamente.
   */
  const handleActivacionSaved = useCallback(async (savedItem: SolicitudActivacionListItem) => {
    console.log('[DIAG] handleActivacionSaved llamado, savedItem:', savedItem);
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
    const esPagado    = estatusNorm === 'pagado';
    const fromActivar = !!savedItem._fromActivar;

    console.log('[PROMPT_IA] handleActivacionSaved - estatus:', savedItem.estatus, '| esPagado:', esPagado, '| fromActivar:', fromActivar);

    const faseDebugBefore = formData.faseId;

    // Helper reutilizable para avanzar fase ─────────────────────────────────
    const avanzarFase = async (nuevoEstatusLocal: string, logAccion: string) => {
      setEnviandoFase(true);
      try {
        // ── GUARD: fases deben estar cargadas ──────────────────────────────
        if (fasesDelProducto.length === 0) {
          console.warn('[PROMPT_IA] avancerFase: fasesDelProducto vacío — no se puede avanzar fase. faseId actual:', formData.faseId);
          toast.warning('No se pudo avanzar fase', { description: 'Las fases del producto no están cargadas. Guarda y recarga la solicitud.' });
          setEnviandoFase(false);
          return;
        }

        console.log('[PROMPT_IA] avanceFase - formData.faseId:', formData.faseId, '| fasesDelProducto:', fasesDelProducto.map(f => ({ faseId: f.faseId, seq: f.seq, fase: f.fase })));

        const faseActualReal2 = fasesDelProducto.find(f => String(f.faseId) === String(formData.faseId));
        const seqActual2      = parseInt(String(faseActualReal2?.seq || '1'), 10);
        const sigFase2        = fasesDelProducto.find(f => parseInt(String(f.seq), 10) === seqActual2 + 1);

        const esFasesFinal         = !sigFase2;
        // Fix: en fase final conservar el faseId actual (no agregar '_completada' que rompe el lookup en useFaseConsistency)
        const nuevaFaseId          = sigFase2?.faseId ?? String(faseActualReal2?.faseId ?? formData.faseId);
        const nuevaDescripcionFase = esFasesFinal ? 'Completada' : (sigFase2?.fase || formData.descripcionFase);
        const nuevaArea            = sigFase2?.area  ?? (esFasesFinal ? formData.area : inferirAreaFase(sigFase2?.fase || ''));
        // En fase final siempre 'Aprobado' (independientemente de si es activar o enviar)
        const estatusFinal         = esFasesFinal ? 'Aprobado' : nuevoEstatusLocal;

        console.log('[PROMPT_IA] avanzarFase calc:', { esFasesFinal, nuevaFaseId, nuevaDescripcionFase, estatusFinal });

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

        console.log('[PROMPT_IA] avanzarFase: BD update →', { dbId2, esUUID2, nuevaFaseId, estatusFinal });

        if (esUUID2) {
          const resultFase = await avanzarFaseSolicitudDB(dbId2, nuevaFaseId, nuevaDescripcionFase, nuevaArea, estatusFinal);
          if (!resultFase.ok) {
            console.error('[PROMPT_IA] avanzarFaseSolicitudDB FALLÓ:', resultFase.error);
            toast.warning('Fase actualizada localmente (sin BD)', { description: resultFase.error || 'Sincronización pendiente' });
          }
        } else {
          console.warn('[PROMPT_IA] avanzarFase: storageId no es UUID, se omite avanzarFaseSolicitudDB →', dbId2);
        }

        // ── DEBUG PROMPT_IA ──────────────────────────────────────────────
        console.log('[PROMPT_IA] DEBUG:', {
          solicitud_id_recibido:          String(storageId),
          solicitud_id_generado:          savedItem._dbId || '(ver consola onEnviar)',
          estatus_recibido_en_backend:    savedItem.estatus,
          estatus_guardado_en_bd:         estatusFinal,
          accionEjecutada:                logAccion,
          faseAntes:                      faseDebugBefore,
          faseDespues:                    nuevaFaseId,
          descripcionFase:                nuevaDescripcionFase,
          esFasesFinal,
          origenLogica:                   'PROMPT_IA',
          validacionesSistemaEjecutadas:  false,
        });

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
      // ── "Activar" → finalizar fase actual, estatusSolicitud: 'Aprobado' ──
      console.log('[PROMPT_IA] accion=activar_solicitud | faseAntes=', faseDebugBefore);
      await avanzarFase('Aprobado', 'activar_solicitud');

    } else if (estatusNorm === 'enviada' && !fromActivar) {
      // ── "Enviar Solicitud" → avanzar a siguiente fase, estatusSolicitud: 'En proceso' ──
      console.log('[PROMPT_IA] accion=enviar_solicitud | faseAntes=', faseDebugBefore);
      await avanzarFase('En proceso', 'enviar_solicitud');

    } else {
      // ── Guardar (Pendiente / Pagado) → NO avanzar fase ──
      console.log('[PROMPT_IA] DEBUG:', {
        solicitud_id_recibido:         String(storageId),
        solicitud_id_generado:         savedItem._dbId || '(local)',
        estatus_recibido_en_backend:   savedItem.estatus,
        estatus_guardado_en_bd:        savedItem.estatus,
        accionEjecutada:               'guardar_solicitud',
        faseAntes:                     faseDebugBefore,
        faseDespues:                   faseDebugBefore,
        origenLogica:                  'PROMPT_IA',
        validacionesSistemaEjecutadas: false,
      });
      if (estatusNorm === 'pagado') {
        toast.info('Solicitud marcada como Pagado. Presione "Activar" para finalizar la fase.');
      }
    }
  }, [formData, fasesDelProducto, storageId, refetchActivaciones]);

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
      const dbId = storageId !== 'new' ? String(storageId) : null;
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const datosActivacion = {
        estatusSolicitud: 'Autorizada',
        estatusCuenta:    'Activa',
        estatusPago:      'Pagado',
        estatusCartera:   'Activa',
        fechaActivacion:  new Date().toISOString().split('T')[0],
      };

      // Actualizar estado local
      setFormData(prev => ({ ...prev, estatusSolicitud: 'Autorizada' }));

      if (dbId && UUID_REGEX.test(dbId)) {
        const res = await activarCuentaDB(dbId, datosActivacion);
        if (res.ok) {
          toast.success('¡Cuenta activada exitosamente!', {
            description: `Solicitud ${formData.noSol} — EstatusSolicitud: Autorizada | EstatusCuenta: Activa`,
          });
        } else {
          toast.warning('Cuenta activada localmente (sin conexión BD)', { description: res.error });
        }
      } else {
        toast.success('Cuenta activada (modo local)', { description: formData.noSol });
      }
    } finally {
      setEnviandoFase(false);
    }
  }, [enviandoFase, canActivarCuenta, formData, storageId]);

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
    
    setFormData(prev => ({
      ...prev,
      productoId,
      nombreProducto: dbProd?.nombreProducto || staticProd?.nombre || '',
      tipoProducto: dbProd?.sublineaProducto || prev.tipoProducto || '',
      faseId,
      descripcionFase: faseNombre,
      area: faseArea,
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
    if (!formData.nombrePersona) e.nombrePersona = 'Obligatorio';
    if (!formData.apellidoPaternoPersona) e.apellidoPaternoPersona = 'Obligatorio';
    if (!formData.productoId) e.productoId = 'Obligatorio';
    if (!formData.sucursal) e.sucursal = 'Obligatorio';
    const ms = parseFloat(parseCurrency(formData.montoSolicitado || '0'));
    if (!formData.montoSolicitado || isNaN(ms) || ms <= 0) e.montoSolicitado = 'Monto > 0';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error('Campos obligatorios incompletos', { description: `${Object.keys(e).length} campo(s) requieren corrección`, duration: 4000 });
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
        console.log('[SolicForm] handleSave → NO_SOL from backend:', nextNoSol);
      } catch (err) {
        console.warn('[SolicForm] handleSave → fetchNextNoSol falló, usando consumeNoSol:', err);
        d.noSol = consumeNoSol();
      } finally {
        setSavingNoSol(false);
      }
    }

    // ── Recopilar datos de TODAS las subtabs ANTES de commitAndClearSession ──
    const allSubtabs: Record<string, any> = {};
    const subtabKeys = ['terminos', 'simulacion', 'documentos', 'garantias', 'comisiones', 'autorizaciones', 'notas', 'partesRelacionadas', '_originalData'];
    for (const key of subtabKeys) {
      const data = loadFromSession(storageId, key);
      if (data) allSubtabs[key] = data;
    }

    console.log('[SolicForm] handleSave → formData fields:',
      Object.entries(d).filter(([, v]) => v).map(([k, v]) => `${k}=${String(v).substring(0, 30)}`).join(' | '));
    console.log('[SolicForm] handleSave → subtabs collected:', Object.keys(allSubtabs).join(', ') || '(none)');
    if (allSubtabs.comisiones) {
      console.log('[SolicForm] handleSave → comisiones count:', Array.isArray(allSubtabs.comisiones) ? allSubtabs.comisiones.length : 'NOT-ARRAY', '| data:', JSON.stringify(allSubtabs.comisiones).substring(0, 300));
    } else {
      console.log('[SolicForm] handleSave → SIN comisiones en session para storageId:', storageId);
    }

    // ── Guardar en BD (await — blocking) ──
    setSavingToDB(true);
    try {
      await onSave?.({ ...d, _allSubtabs: allSubtabs });
      // Solo limpiar session DESPUÉS de que la BD confirmó
      saveToSavedStore(storageId, 'form', d);
      commitAndClearSession(storageId);
      saveToSavedStore(storageId, 'form', d);
    } catch (err) {
      console.error('[SolicForm] handleSave → onSave error:', err);
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
  const isCreditoForm      = !isCaptacionForm && !isLineaCreditoForm;

  // ── Subtabs dinámicos según tipo de producto ────────────────────────────────
  // Reglas:
  //   Captación:      sin Garantías (no aplica préstamo), sin Comisiones clásicas
  //   Crédito:        todas las secciones
  //   Línea de Crédito: igual que Crédito pero Simulación = "Disposiciones"
  const sections = [
    { id: 'default',           label: 'Default' },
    { id: 'terminos',          label: 'Términos y Condiciones' },
    {
      id: 'simulacion',
      label: isCaptacionForm    ? 'Calendario de Aportaciones'
           : isLineaCreditoForm ? 'Tabla de Amortización'
           :                      'Simulación',
    },
    { id: 'expediente',        label: 'Expediente Electrónico' },
    { id: 'partesRelacionadas',label: 'Partes Relacionadas' },
    ...(!isCaptacionForm  ? [{ id: 'garantias', label: 'Garantías' }] : []),
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
                    console.log(`[DIAG Producto] DB total=${productosDB.length} | filtrados=${productosFiltrados.length} | línea="${formData.lineaProducto}" | tipo="${formData.tipoProducto}"`);
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
              <Lbl req error={errors.montoSolicitado}>Monto Solicitado</Lbl>
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
            </div>
            <div>
              <Lbl>Monto Autorizado</Lbl>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">$</span>
                <input
                  type="text" inputMode="decimal"
                  value={formData.montoAutorizado}
                  onChange={e => handleNumeric('montoAutorizado', e.target.value)}
                  onBlur={() => handleCurrencyBlur('montoAutorizado')}
                  disabled={isRO} placeholder="0.00"
                  className={`${ic()} pl-5`}
                />
              </div>
            </div>
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
                    faseActualSeq={fasesDelProducto.find(f => String(f.faseId) === String(formData.faseId))?.seq}
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
                    mode={mode}
                    solicitudId={storageId}
                    lineaProducto={formData.lineaProducto}
                    productoSeleccionado={productoSeleccionado}
                    montoSolicitadoHeader={formData.montoSolicitado}
                    fechaInicioHeader={formData.fechaInicio || ''}
                    tasaCotizacion={(cotizacionData as any)?._terminosCondiciones?.tasa || ''}
                    plazoCotizacion={(cotizacionData as any)?._terminosCondiciones?.plazo || ''}
                    cotizacionTerminos={(cotizacionData as any)?._terminosCondiciones}
                    onFechaPrimeraAportacionChange={v => set('fechaInicio', v)}
                  />
                )}
                {sec.id === 'simulacion' && (
                  <SimulacionTab
                    mode={mode}
                    solicitudId={storageId}
                    lineaProducto={formData.lineaProducto}
                    tipoProducto={formData.tipoProducto}
                    calendarioAportaciones={formData._calendarioAportaciones}
                  />
                )}
                {sec.id === 'expediente' && (
                  <ExpedienteElectronicoTab
                    key={`exp-${storageId}-${expedienteKey}`}
                    mode={mode}
                    solicitudId={storageId}
                    faseIdActual={parseInt(formData.faseId) || 1}
                    productoId={formData.productoId}
                    nombreSolicitante={`${formData.nombrePersona || ''} ${formData.apellidoPaternoPersona || ''} ${formData.apellidoMaternoPersona || ''}`.trim()}
                    curpCliente={formData._curp || ''}
                    rfcCliente={formData._rfc || ''}
                    fasePromptIA={fasePromptIA}
                    onEnviarSolicitud={handleEnviarSolicitud}
                  />
                )}
                {sec.id === 'garantias' && (
                  <GarantiasTab mode={mode} solicitudId={storageId} montoSolicitado={formData.montoSolicitado} clienteId={formData._clienteId} faseIdActual={parseInt(formData.faseId) || 1} />
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
                  <SolicitudCargosTab mode={mode} solicitudId={storageId} />
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
          {console.log('[DIAG] Renderizando SolicitudActivacionModal, storageId=', storageId)}
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
              // Primer pago real de la simulación (pagoPeriodo del periodo 1)
              const primerPago = _s.length > 0 && (_s[0].pagoPeriodo ?? 0) > 0
                ? (_s[0].pagoPeriodo as number)
                : 0;
              const montoTotalRaw = _t.montoSolicitado || formData.montoSolicitado || '0';
              const montoTotal = parseFloat(String(montoTotalRaw).replace(/[^0-9.-]/g, '')) || 0;
              const plazoMeses = parseInt(String(_t.plazo || '0'), 10) || 1;
              const numPeriodos = calcularNumeroPeriodos(plazoMeses, frecuencia);
              // Fallback solo si realmente no hay simulación (registro sin tabla de amortización)
              const pagoPeriodo = primerPago > 0 ? primerPago : (montoTotal > 0 && numPeriodos > 0 ? montoTotal / numPeriodos : 0);
              // Fecha Compromiso = fecha del PRIMER PAGO (fechaInicio + 1 periodo)
              // Para crédito: fechaPrimerPago ya es la fecha real del primer pago → usar directo
              // Para captación: fechaPrimeraAportacion = fechaInicio (inicio), no primer pago → sumar intervalo
              const esCapt = (formData.lineaProducto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('captac');
              let fechaCompromiso: string;
              if (!esCapt && _t.fechaPrimerPago) {
                // Crédito con fecha de primer pago explícita → usarla directamente
                fechaCompromiso = _t.fechaPrimerPago;
              } else {
                // Captación (fechaPrimeraAportacion = fechaInicio) o fallback → calcular primer pago
                const fechaBase = _t.fechaPrimeraAportacion || _t.fechaPrimerPago || formData.fechaInicio || '';
                fechaCompromiso = calcularFechaPrimerPago(fechaBase, frecuencia);
              }
              return {
                cliente: [formData.nombrePersona, formData.apellidoPaternoPersona, formData.apellidoMaternoPersona]
                  .filter(Boolean).join(' ').trim(),
                clienteId: formData._clienteId || '',
                lineaProducto: formData.lineaProducto || '',
                montoTransaccion: pagoPeriodo > 0 ? String(pagoPeriodo.toFixed(2)) : (formData.montoSolicitado || '0'),
                moneda: _t.moneda || 'MXN',
                productoId: formData.productoId || '',
                fechaCompromiso,
                periodicidad: frecuencia,
              };
            })()}
            existingActivacion={activacionForThisSol}
            readOnly={activacionModalRO}
            onClose={() => setShowActivacionModal(false)}
            onSaved={handleActivacionSaved}
          />
        </>
      ) : (
        console.log('[DIAG] showActivacionModal es false, NO se renderiza modal')
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
    </div>
  );
}