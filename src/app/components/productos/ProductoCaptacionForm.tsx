import { useState, useRef, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { K_PERIODS } from '../../data/mockData';
import { CheckListCaptacionesTab } from './tabs/CheckListCaptacionesTab';
import { TasaInversionTab } from './tabs/TasaInversionTab';
import { ConstitucionTab } from './tabs/ConstitucionTab';
import { ComisionesTab } from './tabs/ComisionesTab';
import { CargoTab } from './tabs/CargoTab';
import { FasesTab } from './tabs/FasesTab';
import { MatrizTasaFijaTab } from './tabs/MatrizTasaFijaTab';
import { TasaReferenciaTab } from './tabs/TasaReferenciaTab';
import { MatrizTasaVariableTab } from './tabs/MatrizTasaVariableTab';
import { ExpedientesProductoTab } from './tabs/ExpedientesProductoTab';
import { SucursalTab } from './tabs/SucursalTab';
import { PlantillasTab } from './tabs/PlantillasTab';
import { useProductoPersistence, useProductoTabs } from '../../hooks/useProductoPersistence';
import { syncToJProducts } from '../../hooks/useSyncJProducts';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

// ⚠️ Flag institucional: la ruta GET /productos/:id NO está desplegada.
// Cuando se redespliegue la edge function con soporte para esta ruta,
// cambiar a true para activar el Nivel 1 (más eficiente).
const RUTA_POR_ID_DISPONIBLE = false;

interface PeriodoItemCaptacion {
  id: number;
  periodoId: number;
  descripcion: string;
  dias: number;
}

interface ProductoCaptacionFormProps {
  mode: 'nuevo' | 'editar' | 'ver';
  productoId?: number;
  producto?: any; // Producto completo para modo editar/ver
  onCancel: () => void;
  onSave: (data: any) => void;
  /** Info de cuenta eje ya asignada a OTRO producto (null = ninguna tiene cuenta eje) */
  cuentaEjeExistente?: { productoNombre: string; productoClave: string; productoDbUuid: string } | null;
}

// Interfaces para los refs de los tabs
export interface TabDataRef {
  getData: () => any[];
}

// Interface para los datos del formulario
interface FormDataCaptacion {
  clave: string;
  producto: string;
  tipoProducto: string;
  lineaProducto: string;
  descripcion: string;
  estatus: string;
  tasaBase: string;
  generaInteres: boolean;
  cuentaEje: boolean;
  tipoTasa: string;
  capitalizaIntereses: boolean;
  frecuenciaPagoIntereses: string;
  plazo: string;
  periodoCorte: string;
  tipoMoneda: string;
  diasVentana: string;
  montoMinimo: string;
  montoMaximo: string;
  periodoCompletarMinimo: string;
  plazoCompletarMinimo: string;
  numeroMaximoRenovaciones: string;
  tasaInicial: string;
  porcentajeIncremento: string;
  tasaMinima: string;
  tasaMaxima: string;
  // Check List Captaciones
  checkListRequiereIdentificacion: boolean;
  checkListRequiereComprobante: boolean;
  checkListRequiereRFC: boolean;
  checkListRequiereCURP: boolean;
  checkListRequiereEstadoCuenta: boolean;
  checkListRequiereActaConstitutiva: boolean;
  checkListRequierePoderNotarial: boolean;
  checkListObservaciones: string;
  // Tasa de Inversión
  tasaInversionTipoCalculo: string;
  tasaInversionPorcentajeBase: string;
  tasaInversionPorcentajeAdicional: string;
  tasaInversionTotalCalculada: string;
  tasaInversionIndexada: string;
  tasaInversionPuntosSobreTasa: string;
  tasaInversionAplicaCapitalizacion: boolean;
  tasaInversionFrecuenciaCapitalizacion: string;
  tasaInversionDiasBaseCalculo: string;
  // Constitución
  constitucionMontoMinimoCuenta: string;
  constitucionMontoMaximoCuenta: string;
  constitucionPlazoDiasCuenta: string;
  constitucionPermiteFondeoInicial: boolean;
  constitucionMontoFondeoMinimo: string;
  constitucionPermiteFondeosParciales: boolean;
  constitucionNumeroMaximoAbonos: string;
  constitucionCobraPenalidadRetiroAnticipado: boolean;
  constitucionPorcentajePenalidad: string;
  constitucionObservaciones: string;
  // Comisiones
  comisionesCobraApertura: boolean;
  comisionesMontoApertura: string;
  comisionesPorcentajeApertura: string;
  comisionesCobraManejo: boolean;
  comisionesMontoManejo: string;
  comisionesFrecuenciaManejo: string;
  comisionesCobraCancelacion: boolean;
  comisionesMontoCancelacion: string;
  comisionesCobraRetiroAnticipado: boolean;
  comisionesPorcentajeRetiroAnticipado: string;
  comisionesObservaciones: string;
  // Fases
  fasesRequiereAutorizacionGerencia: boolean;
  fasesRequiereValidacionCompliance: boolean;
  fasesRequiereRevisionMesaControl: boolean;
  fasesRequiereAprobacionComite: boolean;
  fasesDiasVigenciaAutorizacion: string;
  fasesObservaciones: string;
}

export function ProductoCaptacionForm({ mode, productoId, producto, onCancel, onSave, cuentaEjeExistente }: ProductoCaptacionFormProps) {
  // Mapeo de modo Captación → modo Crédito (para tabs reutilizados)
  const modeCredito: 'create' | 'edit' | 'view' = mode === 'nuevo' ? 'create' : mode === 'editar' ? 'edit' : 'view';

  // Referencias a los tabs para capturar sus datos al guardar
  const checkListTabRef = useRef<TabDataRef>(null);
  const tasaInversionTabRef = useRef<TabDataRef>(null);
  const constitucionTabRef = useRef<TabDataRef>(null);
  const comisionesTabRef = useRef<TabDataRef>(null);
  const cargoTabRef = useRef<TabDataRef>(null);
  const fasesTabRef = useRef<TabDataRef>(null);
  // === REFS para tabs homologados desde Productos Crédito ===
  const matrizTasaFijaRef = useRef<TabDataRef>(null);
  const matrizTasaVariableRef = useRef<TabDataRef>(null);
  const sucursalRef = useRef<TabDataRef>(null);
  const expedientesRef = useRef<TabDataRef>(null);
  const plantillasRef = useRef<TabDataRef>(null);

  // Estado para los datos de comisiones (para sincronización)
  const [comisionesData, setComisionesData] = useState<any[]>(Array.isArray(producto?.comisiones) ? producto.comisiones : producto?.comisionesRegistros || []);

  // ═══════════════════════════════════════════════════════════
  // Estado para "Acceso Cuenta" — Solo lectura, alimentado desde BD
  // Default institucional para productos NUEVOS; en editar/ver se
  // sobreescribe con lo que venga del jsonb data.accesoCuenta.
  // ═══════════════════════════════════════════════════════════
  // FIX: Sin registros automáticos. Vacío hasta captura manual del usuario.
  // Al editar, los datos provienen exclusivamente de BD vía producto?.accesoCuenta.
  const [accesoCuentaRows, setAccesoCuentaRows] = useState<any[]>(
    Array.isArray(producto?.accesoCuenta) && producto.accesoCuenta.length > 0
      ? producto.accesoCuenta
      : []
  );

  // ═══════════════════════════════════════════════════════════
  // Validación: solo UN producto puede tener Cuenta Eje activa.
  // Si otro producto ya la tiene Y no es este mismo → bloquear.
  // ═══════════════════════════════════════════════════════════
  const esEsteProductoElCuentaEje =
    cuentaEjeExistente &&
    producto?.dbUuid &&
    cuentaEjeExistente.productoDbUuid === producto.dbUuid;

  const otroProdTieneCuentaEje =
    !!cuentaEjeExistente && !esEsteProductoElCuentaEje;

  // Generar clave autogenerada (PC-003 en adelante)
  const generarClave = () => {
    const numero = productoId ? String(productoId).padStart(3, '0') : '003';
    return `PC-${numero}`;
  };

  // Función para obtener datos iniciales según el modo
  const getInitialFormData = (): FormDataCaptacion => {
    if (producto && mode !== 'nuevo') {
      // Si estamos editando o viendo, cargar TODOS los datos del producto
      return {
        clave: producto.clave?.toString() || '',
        producto: producto.producto || '',
        tipoProducto: producto.tipoProducto || '',
        lineaProducto: 'Captacion',
        descripcion: producto.descripcion || '',
        estatus: producto.estatus as 'Activo' | 'Inactivo' | 'Pendiente',
        tasaBase: producto.tasaBase?.toString() || 'Fija',
        generaInteres: producto.generaInteres || false,
        cuentaEje: producto.cuentaEje || false,
        tipoTasa: producto.tipoTasa || 'Fija',
        capitalizaIntereses: producto.capitalizaIntereses || false,
        frecuenciaPagoIntereses: producto.frecuenciaPagoIntereses || '',
        plazo: producto.plazo || '',
        periodoCorte: producto.periodoCorte || '',
        tipoMoneda: producto.moneda || 'MXN',
        diasVentana: producto.diasVentana || '',
        montoMinimo: producto.montoMinimo?.toString() || '',
        montoMaximo: producto.montoMaximo?.toString() || '',
        periodoCompletarMinimo: producto.periodoCompletarMinimo || '',
        plazoCompletarMinimo: producto.plazoCompletarMinimo?.toString() || '',
        numeroMaximoRenovaciones: producto.numeroMaximoRenovaciones || '',
        tasaInicial: producto.tasaInicial || '',
        porcentajeIncremento: producto.porcentajeIncremento || '',
        tasaMinima: producto.tasaMinima || '',
        tasaMaxima: producto.tasaMaxima || '',
        // === Cargar datos de los objetos anidados ===
        // Check List Captaciones
        checkListRequiereIdentificacion: producto.checkListCaptaciones?.requiereIdentificacion || false,
        checkListRequiereComprobante: producto.checkListCaptaciones?.requiereComprobantedomicilio || false,
        checkListRequiereRFC: producto.checkListCaptaciones?.requiereRFC || false,
        checkListRequiereCURP: producto.checkListCaptaciones?.requiereCURP || false,
        checkListRequiereEstadoCuenta: producto.checkListCaptaciones?.requiereEstadoCuenta || false,
        checkListRequiereActaConstitutiva: producto.checkListCaptaciones?.requiereActaConstitutiva || false,
        checkListRequierePoderNotarial: producto.checkListCaptaciones?.requierePoderNotarial || false,
        checkListObservaciones: producto.checkListCaptaciones?.observaciones || '',
        // Tasa de Inversión
        tasaInversionTipoCalculo: producto.tasaInversion?.tasaTipoCalculo || 'Simple',
        tasaInversionPorcentajeBase: producto.tasaInversion?.tasaPorcentajeBase?.toString() || '',
        tasaInversionPorcentajeAdicional: producto.tasaInversion?.tasaPorcentajeAdicional?.toString() || '',
        tasaInversionTotalCalculada: producto.tasaInversion?.tasaTotalCalculada?.toString() || '',
        tasaInversionIndexada: producto.tasaInversion?.tasaIndexada || '',
        tasaInversionPuntosSobreTasa: producto.tasaInversion?.puntosSobreTasa?.toString() || '',
        tasaInversionAplicaCapitalizacion: producto.tasaInversion?.aplicaCapitalizacion || false,
        tasaInversionFrecuenciaCapitalizacion: producto.tasaInversion?.frecuenciaCapitalizacion || '',
        tasaInversionDiasBaseCalculo: producto.tasaInversion?.diasBaseCalculo?.toString() || '360',
        // Constitución
        constitucionMontoMinimoCuenta: producto.constitucion?.montoMinimoCuenta?.toString() || '',
        constitucionMontoMaximoCuenta: producto.constitucion?.montoMaximoCuenta?.toString() || '',
        constitucionPlazoDiasCuenta: producto.constitucion?.plazoDiasCuenta?.toString() || '',
        constitucionPermiteFondeoInicial: producto.constitucion?.permiteFondeoInicial || false,
        constitucionMontoFondeoMinimo: producto.constitucion?.montoFondeoMinimo?.toString() || '',
        constitucionPermiteFondeosParciales: producto.constitucion?.permiteFondeosParciales || false,
        constitucionNumeroMaximoAbonos: producto.constitucion?.numeroMaximoAbonos?.toString() || '',
        constitucionCobraPenalidadRetiroAnticipado: producto.constitucion?.cobraPenalidadRetiroAnticipado || false,
        constitucionPorcentajePenalidad: producto.constitucion?.porcentajePenalidad?.toString() || '',
        constitucionObservaciones: producto.constitucion?.observaciones || '',
        // Comisiones (config plano — desde comisionesConfig, no del array comisiones[])
        comisionesCobraApertura: (producto as any).comisionesConfig?.cobraComisionApertura || false,
        comisionesMontoApertura: (producto as any).comisionesConfig?.montoComisionApertura?.toString() || '',
        comisionesPorcentajeApertura: (producto as any).comisionesConfig?.porcentajeComisionApertura?.toString() || '',
        comisionesCobraManejo: (producto as any).comisionesConfig?.cobraComisionManejo || false,
        comisionesMontoManejo: (producto as any).comisionesConfig?.montoComisionManejo?.toString() || '',
        comisionesFrecuenciaManejo: (producto as any).comisionesConfig?.frecuenciaCobroManejo || '',
        comisionesCobraCancelacion: (producto as any).comisionesConfig?.cobraComisionCancelacion || false,
        comisionesMontoCancelacion: (producto as any).comisionesConfig?.montoComisionCancelacion?.toString() || '',
        comisionesCobraRetiroAnticipado: (producto as any).comisionesConfig?.cobraComisionRetiroAnticipado || false,
        comisionesPorcentajeRetiroAnticipado: (producto as any).comisionesConfig?.porcentajeRetiroAnticipado?.toString() || '',
        comisionesObservaciones: (producto as any).comisionesConfig?.observaciones || '',
        // Fases
        fasesRequiereAutorizacionGerencia: typeof producto.fases === 'object' ? producto.fases.requiereAutorizacionGerencia || false : false,
        fasesRequiereValidacionCompliance: typeof producto.fases === 'object' ? producto.fases.requiereValidacionCompliance || false : false,
        fasesRequiereRevisionMesaControl: typeof producto.fases === 'object' ? producto.fases.requiereRevisionMesaControl || false : false,
        fasesRequiereAprobacionComite: typeof producto.fases === 'object' ? producto.fases.requiereAprobacionComite || false : false,
        fasesDiasVigenciaAutorizacion: typeof producto.fases === 'object' ? producto.fases.diasVigenciaAutorizacion?.toString() || '' : '',
        fasesObservaciones: typeof producto.fases === 'object' ? producto.fases.observaciones || '' : '',
      };
    }
    
    // Nuevo producto: valores por defecto
    return {
      clave: producto?.clave?.toString() || '',
      producto: '',
      tipoProducto: '',
      lineaProducto: 'Captacion',
      descripcion: '',
      estatus: 'Activo',
      tasaBase: 'Fija',
      generaInteres: false,
      cuentaEje: false,
      tipoTasa: 'Fija',
      capitalizaIntereses: false,
      frecuenciaPagoIntereses: '',
      plazo: '',
      periodoCorte: '',
      tipoMoneda: 'MXN',
      diasVentana: '',
      montoMinimo: '',
      montoMaximo: '',
      periodoCompletarMinimo: '',
      plazoCompletarMinimo: '',
      numeroMaximoRenovaciones: '',
      tasaInicial: '',
      porcentajeIncremento: '',
      tasaMinima: '',
      tasaMaxima: '',
      // Check List Captaciones
      checkListRequiereIdentificacion: false,
      checkListRequiereComprobante: false,
      checkListRequiereRFC: false,
      checkListRequiereCURP: false,
      checkListRequiereEstadoCuenta: false,
      checkListRequiereActaConstitutiva: false,
      checkListRequierePoderNotarial: false,
      checkListObservaciones: '',
      // Tasa de Inversión
      tasaInversionTipoCalculo: 'Simple',
      tasaInversionPorcentajeBase: '',
      tasaInversionPorcentajeAdicional: '',
      tasaInversionTotalCalculada: '',
      tasaInversionIndexada: '',
      tasaInversionPuntosSobreTasa: '',
      tasaInversionAplicaCapitalizacion: false,
      tasaInversionFrecuenciaCapitalizacion: '',
      tasaInversionDiasBaseCalculo: '360',
      // Constitución
      constitucionMontoMinimoCuenta: '',
      constitucionMontoMaximoCuenta: '',
      constitucionPlazoDiasCuenta: '',
      constitucionPermiteFondeoInicial: false,
      constitucionMontoFondeoMinimo: '',
      constitucionPermiteFondeosParciales: false,
      constitucionNumeroMaximoAbonos: '',
      constitucionCobraPenalidadRetiroAnticipado: false,
      constitucionPorcentajePenalidad: '',
      constitucionObservaciones: '',
      // Comisiones
      comisionesCobraApertura: false,
      comisionesMontoApertura: '',
      comisionesPorcentajeApertura: '',
      comisionesCobraManejo: false,
      comisionesMontoManejo: '',
      comisionesFrecuenciaManejo: '',
      comisionesCobraCancelacion: false,
      comisionesMontoCancelacion: '',
      comisionesCobraRetiroAnticipado: false,
      comisionesPorcentajeRetiroAnticipado: '',
      comisionesObservaciones: '',
      // Fases
      fasesRequiereAutorizacionGerencia: false,
      fasesRequiereValidacionCompliance: false,
      fasesRequiereRevisionMesaControl: false,
      fasesRequiereAprobacionComite: false,
      fasesDiasVigenciaAutorizacion: '',
      fasesObservaciones: '',
    };
  };

  // Hook de persistencia - DEBE SER LLAMADO SIEMPRE EN EL MISMO ORDEN
  const storageKey = `producto_captacion_${productoId || 'nuevo'}`;
  const { data: rawFormData, updateField, updateFields, clearPersistedData } = useProductoPersistence<FormDataCaptacion>(
    storageKey,
    getInitialFormData()
  );

  // Guard: ensure every field has a defined value to prevent React controlled/uncontrolled warnings
  // when stale sessionStorage data is missing newly-added fields.
  const formData = useMemo<FormDataCaptacion>(() => {
    const defaults = getInitialFormData();
    const safe = { ...defaults } as Record<string, any>;
    for (const key of Object.keys(defaults)) {
      const val = (rawFormData as Record<string, any>)[key];
      if (val !== undefined && val !== null) {
        safe[key] = val;
      }
    }
    return safe as FormDataCaptacion;
  }, [rawFormData]);

  // Hook para tabs activos - También persiste el tab activo
  const [activeTab, setActiveTab] = useProductoTabs(storageKey, 'default');

  // ═══════════════════════════════════════════════════════════
  // Estado para el tab de Periodos - Con persistencia (igual que en Créditos)
  // ═══════════════════════════════════════════════════════════
  const periodosStorageKey = `${storageKey}_periodos`;
  const {
    data: periodos,
    setData: setPeriodos,
  } = useProductoPersistence<PeriodoItemCaptacion[]>(
    periodosStorageKey,
    Array.isArray(producto?.periodosRegistros) && producto.periodosRegistros.length > 0
      ? producto.periodosRegistros
      : []
  );

  const [periodosActionTab, setPeriodosActionTab] = useState<'nuevo' | 'eliminar' | null>(null);
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null);
  const [selectedPeriodoDescripcion, setSelectedPeriodoDescripcion] = useState('');
  const [selectedPeriodoDias, setSelectedPeriodoDias] = useState<number | ''>('');
  const [showDeletePeriodoModal, setShowDeletePeriodoModal] = useState(false);
  const [periodoToDelete, setPeriodoToDelete] = useState<number | null>(null);

  // ═══════════════════════════════════════════════════════════
  // Estado para Tasa Referencia (homologado de Productos Crédito)
  // ═══════════════════════════════════════════════════════════
  interface TasaReferenciaItemCaptacion {
    id: number;
    productId: number;
    tasaReferenciaId: number;
    tasaReferenciaNombre: string;
    moneda: string;
    activo: boolean;
  }
  const tasasStorageKey = `${storageKey}_tasas_referencia`;
  const {
    data: tasasReferencia,
    setData: setTasasReferencia,
  } = useProductoPersistence<TasaReferenciaItemCaptacion[]>(
    tasasStorageKey,
    // FIX: Tasa Referencia es 100% manual. Sin defaults hardcodeados.
    // Solo cargar datos si existen registros guardados previamente en BD.
    Array.isArray(producto?.tasasReferenciaRegistros) && producto.tasasReferenciaRegistros.length > 0
      ? producto.tasasReferenciaRegistros
      : []
  );

  // ═══════════════════════════════════════════════════════════
  // FETCH FRESCO DESDE BD — Modo Editar / Ver
  //
  // Cuando el usuario hace clic en "Editar" o "Ver", el producto
  // que llega como prop solo tiene los campos mapeados del grid.
  // Aquí hacemos GET del registro completo de J_PRODUCTOS para
  // obtener el jsonb `data` íntegro y poblar TODOS los campos
  // del formulario (nodo padre + subtabs).
  //
  // Estrategia de 2 niveles (misma que useSyncJProducts):
  //   1. GET /productos/:id
  //   2. Fallback: GET /productos (todos) + filtro client-side
  // ═══════════════════════════════════════════════════════════
  const [isLoadingFromDB, setIsLoadingFromDB] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    const dbUuid = producto?.dbUuid || producto?.identificacion;
    if (!dbUuid || mode === 'nuevo' || hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchFresh = async () => {
      setIsLoadingFromDB(true);
      const headers = { 'Authorization': `Bearer ${publicAnonKey}` };
      let rawData: Record<string, any> | null = null;

      // ── Nivel 1: GET /productos/:id ──
      // ⚠️ Desactivado hasta que la edge function soporte esta ruta.
      // Reactivar cambiando RUTA_POR_ID_DISPONIBLE = true.
      if (RUTA_POR_ID_DISPONIBLE) {
        try {
          const res1 = await fetch(`${API_BASE}/productos/${dbUuid}`, { headers });
          if (res1.ok) {
            const json1 = await res1.json();
            if (json1?.success && json1?.data) {
              const record = Array.isArray(json1.data) ? json1.data[0] : json1.data;
              const d = record?.data;
              rawData = typeof d === 'string' ? JSON.parse(d) : d;
              if (rawData) console.log(`[CaptacionForm] Nivel 1 OK: /productos/${dbUuid} — ${Object.keys(rawData).length} keys`);
            }
          } else {
            console.warn(`[CaptacionForm] Nivel 1: GET /productos/${dbUuid} → HTTP ${res1.status}, cayendo a Nivel 2...`);
          }
        } catch (err) {
          console.warn(`[CaptacionForm] Nivel 1 error:`, err);
        }
      }

      // ── Nivel 2: GET /productos (todos) + filtro client-side ──
      if (!rawData) {
        try {
          console.log(`[CaptacionForm] Nivel 2: GET /productos + filtro client-side id=${dbUuid}`);
          const res2 = await fetch(`${API_BASE}/productos`, { headers });
          if (res2.ok) {
            const json2 = await res2.json();
            const allRows: any[] = json2?.data || [];
            const match = allRows.find((r: any) => r.id === dbUuid);
            if (match) {
              const d = match.data;
              rawData = typeof d === 'string' ? JSON.parse(d) : d;
              if (rawData) console.log(`[CaptacionForm] Nivel 2 OK: encontrado entre ${allRows.length} registros — ${Object.keys(rawData).length} keys`);
            } else {
              console.warn(`[CaptacionForm] Nivel 2: id=${dbUuid} no encontrado entre ${allRows.length} registros`);
            }
          }
        } catch (err) {
          console.warn(`[CaptacionForm] Nivel 2 error:`, err);
        }
      }

      // ── Mapear jsonb fresco a campos del formulario ──
      if (rawData) {
        const d = rawData;
        const dg = Array.isArray(d.datosGenerales) && d.datosGenerales.length > 0 ? d.datosGenerales[0] : null;

        // Helper: leer campo con fallback legacy
        const r = (key: string, legacyKey?: string) => d[key] ?? (dg ? dg[legacyKey || key] : undefined);

        const freshFields: Partial<FormDataCaptacion> = {
          clave: r('claveProducto', 'clave') || producto?.clave?.toString() || '',
          producto: r('nombreProducto', 'producto') || r('nombre') || '',
          tipoProducto: r('tipoProducto') || '',
          lineaProducto: r('lineaProducto') || 'Captacion',
          descripcion: r('descripcion') || '',
          estatus: r('estatus') || 'Activo',
          tasaBase: r('tasaBase') || 'Fija',
          generaInteres: r('generaInteres') ?? false,
          cuentaEje: r('cuentaEje') ?? false,
          tipoTasa: r('tipoTasa') || 'Fija',
          capitalizaIntereses: r('capitalizaIntereses') ?? false,
          frecuenciaPagoIntereses: r('frecuenciaPagoIntereses') || '',
          plazo: r('plazo') || '',
          periodoCorte: r('periodoCorte') || '',
          tipoMoneda: r('tipoMoneda') || d.moneda || 'MXN',
          diasVentana: r('diasVentana') || '',
          montoMinimo: String(r('montoMinimo') ?? ''),
          montoMaximo: String(r('montoMaximo') ?? ''),
          periodoCompletarMinimo: r('periodoCompletarMinimo') || '',
          plazoCompletarMinimo: String(r('plazoCompletarMinimo') ?? ''),
          numeroMaximoRenovaciones: r('numeroMaximoRenovaciones') || '',
          tasaInicial: r('tasaInicial') || '',
          porcentajeIncremento: r('porcentajeIncremento') || '',
          tasaMinima: r('tasaMinima') || '',
          tasaMaxima: r('tasaMaxima') || '',
          // ── Check List Captaciones ──
          checkListRequiereIdentificacion: d.checkListCaptaciones?.requiereIdentificacion ?? false,
          checkListRequiereComprobante: d.checkListCaptaciones?.requiereComprobantedomicilio ?? false,
          checkListRequiereRFC: d.checkListCaptaciones?.requiereRFC ?? false,
          checkListRequiereCURP: d.checkListCaptaciones?.requiereCURP ?? false,
          checkListRequiereEstadoCuenta: d.checkListCaptaciones?.requiereEstadoCuenta ?? false,
          checkListRequiereActaConstitutiva: d.checkListCaptaciones?.requiereActaConstitutiva ?? false,
          checkListRequierePoderNotarial: d.checkListCaptaciones?.requierePoderNotarial ?? false,
          checkListObservaciones: d.checkListCaptaciones?.observaciones || '',
          // ── Tasa de Inversión ──
          tasaInversionTipoCalculo: d.tasaInversion?.tasaTipoCalculo || 'Simple',
          tasaInversionPorcentajeBase: String(d.tasaInversion?.tasaPorcentajeBase ?? ''),
          tasaInversionPorcentajeAdicional: String(d.tasaInversion?.tasaPorcentajeAdicional ?? ''),
          tasaInversionTotalCalculada: String(d.tasaInversion?.tasaTotalCalculada ?? ''),
          tasaInversionIndexada: d.tasaInversion?.tasaIndexada || '',
          tasaInversionPuntosSobreTasa: String(d.tasaInversion?.puntosSobreTasa ?? ''),
          tasaInversionAplicaCapitalizacion: d.tasaInversion?.aplicaCapitalizacion ?? false,
          tasaInversionFrecuenciaCapitalizacion: d.tasaInversion?.frecuenciaCapitalizacion || '',
          tasaInversionDiasBaseCalculo: String(d.tasaInversion?.diasBaseCalculo ?? '360'),
          // ── Constitución ──
          constitucionMontoMinimoCuenta: String(d.constitucion?.montoMinimoCuenta ?? ''),
          constitucionMontoMaximoCuenta: String(d.constitucion?.montoMaximoCuenta ?? ''),
          constitucionPlazoDiasCuenta: String(d.constitucion?.plazoDiasCuenta ?? ''),
          constitucionPermiteFondeoInicial: d.constitucion?.permiteFondeoInicial ?? false,
          constitucionMontoFondeoMinimo: String(d.constitucion?.montoFondeoMinimo ?? ''),
          constitucionPermiteFondeosParciales: d.constitucion?.permiteFondeosParciales ?? false,
          constitucionNumeroMaximoAbonos: String(d.constitucion?.numeroMaximoAbonos ?? ''),
          constitucionCobraPenalidadRetiroAnticipado: d.constitucion?.cobraPenalidadRetiroAnticipado ?? false,
          constitucionPorcentajePenalidad: String(d.constitucion?.porcentajePenalidad ?? ''),
          constitucionObservaciones: d.constitucion?.observaciones || '',
          // ── Comisiones ──
          comisionesCobraApertura: d.comisiones?.cobraComisionApertura ?? false,
          comisionesMontoApertura: String(d.comisiones?.montoComisionApertura ?? ''),
          comisionesPorcentajeApertura: String(d.comisiones?.porcentajeComisionApertura ?? ''),
          comisionesCobraManejo: d.comisiones?.cobraComisionManejo ?? false,
          comisionesMontoManejo: String(d.comisiones?.montoComisionManejo ?? ''),
          comisionesFrecuenciaManejo: d.comisiones?.frecuenciaCobroManejo || '',
          comisionesCobraCancelacion: d.comisiones?.cobraComisionCancelacion ?? false,
          comisionesMontoCancelacion: String(d.comisiones?.montoComisionCancelacion ?? ''),
          comisionesCobraRetiroAnticipado: d.comisiones?.cobraComisionRetiroAnticipado ?? false,
          comisionesPorcentajeRetiroAnticipado: String(d.comisiones?.porcentajeRetiroAnticipado ?? ''),
          comisionesObservaciones: d.comisiones?.observaciones || '',
          // ── Fases ──
          fasesRequiereAutorizacionGerencia: d.fases?.requiereAutorizacionGerencia ?? false,
          fasesRequiereValidacionCompliance: d.fases?.requiereValidacionCompliance ?? false,
          fasesRequiereRevisionMesaControl: d.fases?.requiereRevisionMesaControl ?? false,
          fasesRequiereAprobacionComite: d.fases?.requiereAprobacionComite ?? false,
          fasesDiasVigenciaAutorizacion: String(d.fases?.diasVigenciaAutorizacion ?? ''),
          fasesObservaciones: d.fases?.observaciones || '',
        };

        console.log(`[CaptacionForm] Aplicando ${Object.keys(freshFields).length} campos frescos desde BD al formulario`);
        updateFields(freshFields);

        // Actualizar periodos si existen en el jsonb
        if (Array.isArray(d.periodosRegistros) && d.periodosRegistros.length > 0) {
          setPeriodos(d.periodosRegistros);
        } else {
          setPeriodos([]);
        }

        // Actualizar tasas de referencia desde BD (si existen en el jsonb)
        if (Array.isArray(d.tasasReferenciaRegistros)) {
          setTasasReferencia(d.tasasReferenciaRegistros);
          console.log(`[CaptacionForm] Tasas Referencia: ${d.tasasReferenciaRegistros.length} registros cargados desde BD`);
        }

        // Actualizar accesoCuenta desde BD (si existe en el jsonb)
        if (Array.isArray(d.accesoCuenta) && d.accesoCuenta.length > 0) {
          setAccesoCuentaRows(d.accesoCuenta);
          console.log(`[CaptacionForm] Acceso Cuenta: ${d.accesoCuenta.length} registros cargados desde BD`);
        }
      } else {
        console.warn(`[CaptacionForm] No se pudo obtener data fresca de BD para id=${dbUuid}. Usando datos del prop.`);
      }

      setIsLoadingFromDB(false);
    };

    fetchFresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto?.dbUuid, producto?.identificacion, mode]);

  const isViewMode = mode === 'ver';

  // ═══════════════════════════════════════════════════════════
  // Estilos institucionales Modo Consulta (solo lectura visual)
  // ═══════════════════════════════════════════════════════════
  const viewFieldClass = 'w-full px-2 py-1 text-xs bg-gray-50 border border-transparent rounded text-gray-800 cursor-default';
  const editFieldClass = 'w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white';
  const fieldClass = isViewMode ? viewFieldClass : editFieldClass;
  const selectFieldClass = isViewMode
    ? 'w-full px-2 py-1 text-xs bg-gray-50 border border-transparent rounded text-gray-800 cursor-default appearance-none'
    : 'w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white';
  const textareaFieldClass = isViewMode
    ? 'w-full px-2 py-1 text-xs bg-gray-50 border border-transparent rounded text-gray-800 cursor-default resize-none'
    : 'w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white resize-none';

  const handleInputChange = (field: keyof FormDataCaptacion, value: any) => {
    if (!isViewMode) {
      updateField(field, value);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // Handlers para Periodos (réplica del patrón de ProductoForm créditos)
  // ═══════════════════════════════════════════════════════════
  const handleAddPeriodo = () => {
    if (!selectedPeriodoId) {
      toast.error('Debe seleccionar un período');
      return;
    }
    const periodoExiste = periodos.some(p => p.periodoId === selectedPeriodoId);
    if (periodoExiste) {
      toast.error('Este período ya ha sido agregado');
      return;
    }
    const diasValue = typeof selectedPeriodoDias === 'number' && selectedPeriodoDias > 0
      ? selectedPeriodoDias
      : K_PERIODS.find(p => p.id === selectedPeriodoId)?.dias || 0;

    const newPeriodo: PeriodoItemCaptacion = {
      id: periodos.length > 0 ? Math.max(...periodos.map((p) => p.id), 0) + 1 : 1,
      periodoId: selectedPeriodoId,
      descripcion: selectedPeriodoDescripcion,
      dias: diasValue,
    };
    setPeriodos((prev) => [...prev, newPeriodo]);
    toast.success('Período agregado exitosamente');
    setSelectedPeriodoId(null);
    setSelectedPeriodoDescripcion('');
    setSelectedPeriodoDias('');
    setPeriodosActionTab(null);
  };

  const handleDeletePeriodo = (periodoId: number) => {
    setPeriodoToDelete(periodoId);
    setShowDeletePeriodoModal(true);
  };

  const confirmDeletePeriodo = () => {
    if (periodoToDelete !== null) {
      setPeriodos((prev) => prev.filter((p) => p.id !== periodoToDelete));
      toast.success('Período eliminado exitosamente');
      setShowDeletePeriodoModal(false);
      setPeriodoToDelete(null);
    }
  };

  const handleCancelWithCleanup = () => {
    // Limpiar sessionStorage de todos los tabs al cancelar
    const pid = productoId || 'nuevo';
    // Tabs específicos de Captación
    sessionStorage.removeItem(`captacion_checklist_${pid}`);
    sessionStorage.removeItem(`captacion_tasainversion_${pid}`);
    sessionStorage.removeItem(`captacion_constitucion_${pid}`);
    sessionStorage.removeItem(`captacion_fases_${pid}`);
    localStorage.removeItem(`captacion_comisiones_producto_${pid}`);
    localStorage.removeItem(`comisiones_producto_${pid}`); // legacy cleanup
    // Periodos y Tasas Referencia (state-managed)
    try { sessionStorage.removeItem(periodosStorageKey); } catch (e) { /* ignore */ }
    try { sessionStorage.removeItem(tasasStorageKey); } catch (e) { /* ignore */ }
    // Tabs homologados desde Productos Crédito (ref-based)
    try {
      sessionStorage.removeItem(`credito_matriztasafija_${pid}`);
      sessionStorage.removeItem(`credito_matriztasavariable_${pid}`);
      sessionStorage.removeItem(`credito_sucursal_${pid}`);
      sessionStorage.removeItem(`captacion_expedientes_prod_${pid}`);
      sessionStorage.removeItem(`captacion_plantillas_${pid}`);
    } catch (e) { /* ignore */ }
    clearPersistedData();
    onCancel();
  };

  const handleSave = async () => {
    if (saving) return; // Prevenir doble clic
    setSaving(true);
    try {
    // Validar campos requeridos - Solo 3 campos obligatorios
    const requiredFields = [
      { field: 'producto', label: 'PRODUCTO' },
      { field: 'tipoProducto', label: 'TIPO DE PRODUCTO' },
      { field: 'estatus', label: 'ESTATUS' },
    ];

    const emptyFields = requiredFields.filter(({ field }) => {
      const value = formData[field];
      return value === '' || value === undefined || value === null;
    });

    if (emptyFields.length > 0) {
      const fieldNames = emptyFields.map(({ label }) => label).join(', ');
      toast.error('Campos requeridos faltantes', {
        description: `Por favor complete los siguientes campos: ${fieldNames}`,
      });
      return;
    }

    // ── Validación: solo UN producto puede ser Cuenta Eje ──
    if (formData.cuentaEje && otroProdTieneCuentaEje) {
      toast.error('Cuenta Eje ya asignada', {
        description: `El producto "${cuentaEjeExistente!.productoNombre}" (${cuentaEjeExistente!.productoClave}) ya tiene la Cuenta Eje activada. Solo puede haber una.`,
        duration: 6000,
      });
      return;
    }

    // Construir objeto Product válido
    const newProduct: any = {
      id: producto?.id || productoId || Date.now(), // Preservar ID en edición
      nombre: formData.producto, // Ahora usamos el campo producto como nombre
      descripcion: formData.descripcion || '',
      lineaProducto: 'Captacion',
      sublineaProducto: formData.tipoProducto || '',
      moneda: formData.tipoMoneda || 'MXN',
      estatus: formData.estatus as 'Activo' | 'Inactivo' | 'Pendiente',
      tipoTasa: formData.tipoTasa as 'Fija' | 'Variable',
      sucursal: producto?.sucursal || 'Matriz',
      fechaRegistro: producto?.fechaRegistro || new Date().toISOString(),
      baseCalculo: '360' as '360' | '180',
      aplicaInteresMoratorio: false,
      usuarioRegistro: producto?.usuarioRegistro || 'admin',
      puestoTrabajo: producto?.puestoTrabajo || 'Administrador',
      // Campos específicos de Captación
      producto: formData.producto,
      cuentaEje: formData.cuentaEje,
      clave: formData.clave,
      tipoProducto: formData.tipoProducto,
      // Campos adicionales del formulario
      tasaBase: formData.tasaBase,
      generaInteres: formData.generaInteres,
      capitalizaIntereses: formData.capitalizaIntereses,
      frecuenciaPagoIntereses: formData.frecuenciaPagoIntereses,
      periodoCorte: formData.periodoCorte,
      diasVentana: formData.diasVentana,
      montoMinimo: formData.montoMinimo,
      montoMaximo: formData.montoMaximo,
      periodoCompletarMinimo: formData.periodoCompletarMinimo,
      plazoCompletarMinimo: formData.plazoCompletarMinimo ? parseInt(formData.plazoCompletarMinimo) : null,
      numeroMaximoRenovaciones: formData.numeroMaximoRenovaciones,
      tasaInicial: formData.tasaInicial,
      porcentajeIncremento: formData.porcentajeIncremento,
      tasaMinima: formData.tasaMinima,
      tasaMaxima: formData.tasaMaxima,
      // Check List Captaciones
      checkListCaptaciones: {
        requiereIdentificacion: formData.checkListRequiereIdentificacion,
        requiereComprobantedomicilio: formData.checkListRequiereComprobante,
        requiereRFC: formData.checkListRequiereRFC,
        requiereCURP: formData.checkListRequiereCURP,
        requiereEstadoCuenta: formData.checkListRequiereEstadoCuenta,
        requiereActaConstitutiva: formData.checkListRequiereActaConstitutiva,
        requierePoderNotarial: formData.checkListRequierePoderNotarial,
        observaciones: formData.checkListObservaciones,
      },
      // Tasa de Inversión
      tasaInversion: {
        tasaTipoCalculo: formData.tasaInversionTipoCalculo,
        tasaPorcentajeBase: parseFloat(formData.tasaInversionPorcentajeBase) || 0,
        tasaPorcentajeAdicional: parseFloat(formData.tasaInversionPorcentajeAdicional) || 0,
        tasaTotalCalculada: parseFloat(formData.tasaInversionTotalCalculada) || 0,
        tasaIndexada: formData.tasaInversionIndexada,
        puntosSobreTasa: parseFloat(formData.tasaInversionPuntosSobreTasa) || 0,
        aplicaCapitalizacion: formData.tasaInversionAplicaCapitalizacion,
        frecuenciaCapitalizacion: formData.tasaInversionFrecuenciaCapitalizacion,
        diasBaseCalculo: parseInt(formData.tasaInversionDiasBaseCalculo) || 360,
      },
      // Constitución
      constitucion: {
        montoMinimoCuenta: parseFloat(formData.constitucionMontoMinimoCuenta) || 0,
        montoMaximoCuenta: parseFloat(formData.constitucionMontoMaximoCuenta) || 0,
        plazoDiasCuenta: parseInt(formData.constitucionPlazoDiasCuenta) || 0,
        permiteFondeoInicial: formData.constitucionPermiteFondeoInicial,
        montoFondeoMinimo: parseFloat(formData.constitucionMontoFondeoMinimo) || 0,
        permiteFondeosParciales: formData.constitucionPermiteFondeosParciales,
        numeroMaximoAbonos: parseInt(formData.constitucionNumeroMaximoAbonos) || 0,
        cobraPenalidadRetiroAnticipado: formData.constitucionCobraPenalidadRetiroAnticipado,
        porcentajePenalidad: parseFloat(formData.constitucionPorcentajePenalidad) || 0,
        observaciones: formData.constitucionObservaciones,
      },
      // Comisiones
      comisiones: {
        cobraComisionApertura: formData.comisionesCobraApertura,
        montoComisionApertura: parseFloat(formData.comisionesMontoApertura) || 0,
        porcentajeComisionApertura: parseFloat(formData.comisionesPorcentajeApertura) || 0,
        cobraComisionManejo: formData.comisionesCobraManejo,
        montoComisionManejo: parseFloat(formData.comisionesMontoManejo) || 0,
        frecuenciaCobroManejo: formData.comisionesFrecuenciaManejo,
        cobraComisionCancelacion: formData.comisionesCobraCancelacion,
        montoComisionCancelacion: parseFloat(formData.comisionesMontoCancelacion) || 0,
        cobraComisionRetiroAnticipado: formData.comisionesCobraRetiroAnticipado,
        porcentajeRetiroAnticipado: parseFloat(formData.comisionesPorcentajeRetiroAnticipado) || 0,
        observaciones: formData.comisionesObservaciones,
      },
      // Fases
      fases: {
        requiereAutorizacionGerencia: formData.fasesRequiereAutorizacionGerencia,
        requiereValidacionCompliance: formData.fasesRequiereValidacionCompliance,
        requiereRevisionMesaControl: formData.fasesRequiereRevisionMesaControl,
        requiereAprobacionComite: formData.fasesRequiereAprobacionComite,
        diasVigenciaAutorizacion: parseInt(formData.fasesDiasVigenciaAutorizacion) || 0,
        observaciones: formData.fasesObservaciones,
      },
      // ===  ARRAYS DE REGISTROS DE LOS TABS ===
      // Capturar los datos de las tablas dentro de los tabs
      checkListRegistros: checkListTabRef.current?.getData() || [],
      tasaInversionRegistros: tasaInversionTabRef.current?.getData() || [],
      periodosRegistros: periodos,
      constitucionRegistros: constitucionTabRef.current?.getData() || [],
      comisionesRegistros: comisionesTabRef.current?.getData() || [],
      cargoRegistros: cargoTabRef.current?.getData() || [],
      fasesRegistros: fasesTabRef.current?.getData() || [],
      // Arrays homologados desde Productos Crédito
      matrizTasaFijaRegistros: matrizTasaFijaRef.current?.getData() || [],
      matrizTasaVariableRegistros: matrizTasaVariableRef.current?.getData() || [],
      sucursalRegistros: sucursalRef.current?.getData() || [],
      expedientesRegistros: expedientesRef.current?.getData() || [],
      tasasReferenciaRegistros: tasasReferencia || [],
      plantillas: plantillasRef.current?.getData() || [],
    };
    
    console.log('handleSave - Producto completo con registros:', newProduct);

    // ═══════════════════════════════════════════════════════════════
    // Sincronizar con EFINANCIANET_DB.J_PRODUCTOS (Supabase)
    //
    // Estructura real de la tabla (solo 3 columnas):
    //   id   (uuid PK) — gen_random_uuid(), NO se envía
    //   type (varchar)  — "Captación"
    //   data (jsonb)    — JSON institucional completo
    //
    // Body enviado al servidor: { tipo, datos }
    // (useSyncJProducts traduce type→tipo, data→datos)
    //
    // JSON institucional para data (jsonb):
    //   { ...nodoPadre, default: {...}, subtabs..., arrays... }
    //
    // En modo Editar: Deep Merge v6.0 (GET previo + merge + PUT)
    // ═══════════════════════════════════════════════════════════════
    {
      // ── A. Nodo padre: campos planos del formulario ──
      const nodoPadre = {
        localId: newProduct.id,
        claveProducto: formData.clave,
        nombreProducto: formData.producto,
        tipoProducto: formData.tipoProducto,
        lineaProducto: 'Captacion',
        descripcion: formData.descripcion,
        estatus: formData.estatus,
        tasaBase: formData.tasaBase,
        generaInteres: formData.generaInteres,
        cuentaEje: formData.cuentaEje,
        tipoTasa: formData.tipoTasa,
        capitalizaIntereses: formData.capitalizaIntereses,
        frecuenciaPagoIntereses: formData.frecuenciaPagoIntereses,
        periodoCorte: formData.periodoCorte,
        tipoMoneda: formData.tipoMoneda,
        diasVentana: formData.diasVentana,
        montoMinimo: formData.montoMinimo,
        montoMaximo: formData.montoMaximo,
        periodoCompletarMinimo: formData.periodoCompletarMinimo,
        plazoCompletarMinimo: formData.plazoCompletarMinimo ? parseInt(formData.plazoCompletarMinimo) : null,
        numeroMaximoRenovaciones: formData.numeroMaximoRenovaciones,
        tasaInicial: formData.tasaInicial,
        porcentajeIncremento: formData.porcentajeIncremento,
        tasaMinima: formData.tasaMinima,
        tasaMaxima: formData.tasaMaxima,
        fechaRegistro: producto?.fechaRegistro || new Date().toISOString(),
        usuarioRegistro: producto?.usuarioRegistro || 'admin',
        puestoTrabajo: producto?.puestoTrabajo || 'Administrador',
        sucursal: producto?.sucursal || 'Matriz',
        baseCalculo: '360',
      };

      // ── B. Nodos hijos: SubTabs (objetos, NO arrays de un solo elemento) ──
      const checkListCaptaciones = newProduct.checkListCaptaciones || {};
      const tasaInversion = newProduct.tasaInversion || {};
      const constitucion = newProduct.constitucion || {};
      const comisiones = newProduct.comisiones || {};
      const fases = newProduct.fases || {};

      // ── C. Arrays de registros de tabs ──
      const checkListRegistros = newProduct.checkListRegistros || [];
      const tasaInversionRegistros = newProduct.tasaInversionRegistros || [];
      const periodosRegistros = newProduct.periodosRegistros || [];
      const constitucionRegistros = newProduct.constitucionRegistros || [];
      const comisionesRegistros = newProduct.comisionesRegistros || [];
      const cargoRegistros = newProduct.cargoRegistros || [];
      const fasesRegistros = newProduct.fasesRegistros || [];

      // Acceso Cuenta: usar datos del estado (cargados de BD o default institucional)
      const accesoCuentaData = accesoCuentaRows;

      // ═══════════════════════════════════════════════════════════
      // JSON institucional para J_PRODUCTOS.data (jsonb)
      //
      // { ...nodoPadre, default: {...nodoPadre}, subtab1: {...}, ... }
      //
      // El nodo "default" es copia de referencia del nodo padre.
      // Los subtabs son nodos hijos (objetos planos, no arrays).
      // Los registros de grids se mantienen como arrays.
      // ═══════════════════════════════════════════════════════════
      // ── D. Datos de tabs homologados desde Productos Crédito (forwardRef) ──
      const matrizTasaFijaRegistros = matrizTasaFijaRef.current?.getData() || [];
      const matrizTasaVariableRegistros = matrizTasaVariableRef.current?.getData() || [];
      const sucursalRegistros = sucursalRef.current?.getData() || [];
      const expedientesRegistros = expedientesRef.current?.getData() || [];
      const tasasReferenciaRegistros = tasasReferencia || [];

      const jProductoData: Record<string, any> = {
        // Nodo padre — campos planos
        ...nodoPadre,
        // Nodo default — copia de referencia
        default: { ...nodoPadre },
        // Nodos hijos — SubTabs
        checkListCaptaciones,
        tasaInversion,
        constitucion,
        comisionesConfig: comisiones,
        fases,
        // Arrays de registros
        checkListRegistros,
        tasaInversionRegistros,
        periodosRegistros,
        constitucionRegistros,
        comisiones: comisionesRegistros,
        cargoRegistros,
        fasesRegistros,
        accesoCuenta: accesoCuentaData,
        // Arrays homologados desde Productos Crédito
        matrizTasaFijaRegistros,
        matrizTasaVariableRegistros,
        sucursalRegistros,
        expedientesRegistros,
        tasasReferenciaRegistros,
        plantillas: plantillasRef.current?.getData() || [],
      };

      console.log('[handleSave] JSON institucional para J_PRODUCTOS.data:', jProductoData);

      // ── Sincronizar con Supabase ──
      // INSERT: type="Captación" (columna type), estatus del formulario
      // UPDATE: deep merge frontend v6.0
      const existingDbUuid = producto?.dbUuid || null;
      const returnedUuid = await syncToJProducts({
        type: 'Captación',
        subtipo: 'Captación',
        estatus: formData.estatus,
        data: jProductoData,
        label: 'Producto de Captación',
        existingId: existingDbUuid,
      });

      // Propagar el UUID de la BD al producto para que el UPDATE funcione en ediciones futuras
      if (returnedUuid) {
        newProduct.dbUuid = String(returnedUuid);
        newProduct.identificacion = String(returnedUuid);
      }
    }

    toast.success('Producto de captación guardado correctamente');
    onSave(newProduct);
    clearPersistedData();
    // Limpiar sessionStorage/localStorage de tabs
    const pid = productoId || 'nuevo';
    sessionStorage.removeItem(`captacion_checklist_${pid}`);
    sessionStorage.removeItem(`captacion_tasainversion_${pid}`);
    sessionStorage.removeItem(`captacion_constitucion_${pid}`);
    sessionStorage.removeItem(`captacion_fases_${pid}`);
    localStorage.removeItem(`captacion_comisiones_producto_${pid}`);
    localStorage.removeItem(`comisiones_producto_${pid}`); // legacy cleanup
    try { sessionStorage.removeItem(periodosStorageKey); } catch (e) { /* ignore */ }
    try { sessionStorage.removeItem(tasasStorageKey); } catch (e) { /* ignore */ }
    // Limpiar storage de tabs homologados
    try {
      sessionStorage.removeItem(`credito_matriztasafija_${pid}`);
      sessionStorage.removeItem(`credito_matriztasavariable_${pid}`);
      sessionStorage.removeItem(`credito_sucursal_${pid}`);
      sessionStorage.removeItem(`captacion_expedientes_prod_${pid}`);
      sessionStorage.removeItem(`captacion_plantillas_${pid}`);
    } catch (e) { /* ignore */ }
    } catch (err) {
      console.error('[ProductoCaptacionForm] Error inesperado al guardar:', err);
      toast.error('Error inesperado al guardar producto', { description: String(err) });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'default', label: 'Default' },
    // === Tabs homologados desde Producto Crédito (orden exacto) ===
    { id: 'periodos', label: 'Periodos' },
    { id: 'matriz-tasa-fija', label: 'Matriz Tasa Fija' },
    { id: 'tasa-referencia', label: 'Tasa Referencia' },
    { id: 'matriz-tasa-variable', label: 'Matriz Tasa Variable' },
    { id: 'fases', label: 'Fases' },
    { id: 'expedientes', label: 'Requisitos OK' },
    { id: 'cargo', label: 'Cargo' },
    { id: 'comisiones', label: 'Comisiones' },
    { id: 'sucursal', label: 'Sucursal' },
    // === Tabs específicos de Captación (mantener sin cambios) ===
    { id: 'constitucion', label: 'Constitución' },
    { id: 'acceso-cuenta', label: 'Acceso Cuenta' },
    // === Tabs adicionales de Captación ===
    { id: 'tasaInversion', label: 'Tasa de Inversión' },
    { id: 'checklist', label: 'Check List Captaciones' },
    { id: 'plantillas', label: 'Plantillas' },
  ];

  return (
    <div className="flex-1 flex flex-col bg-white relative">
      {/* Overlay de carga cuando se obtiene data fresca de BD */}
      {isLoadingFromDB && (
        <div className="absolute inset-0 bg-white/70 z-50 flex items-center justify-center">
          <div className="flex items-center gap-3 bg-white px-6 py-3 rounded shadow-lg border border-gray-200">
            <svg className="animate-spin h-5 w-5 text-[#0099CC]" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="text-sm text-gray-700">{isViewMode ? 'Consultando registro desde J_PRODUCTOS...' : 'Cargando datos desde la base de datos...'}</span>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="bg-white px-6 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#4A90E2">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M4 9h16M9 4v16" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <span className="text-base text-gray-800">
              {mode === 'editar' ? 'Editar Producto Captación' : mode === 'ver' ? 'Consultar Producto de Captación' : 'Alta Producto Captación'}
            </span>
            {isViewMode && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Modo Consulta
              </span>
            )}
            <button className="p-1">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#999" strokeWidth="2">
                <circle cx="7" cy="7" r="5"/>
                <path d="M11 11l3 3"/>
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {!isViewMode && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`px-4 py-1 bg-[#5B9BD5] text-white text-sm rounded hover:bg-[#4A8BC2] flex items-center gap-1.5 ${saving ? 'opacity-60 cursor-wait' : ''}`}
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                        <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                      </svg>
                      Guardando...
                    </>
                  ) : 'Guardar'}
                </button>
                <button
                  onClick={handleCancelWithCleanup}
                  className="px-4 py-1 bg-white border border-gray-400 text-gray-700 text-sm rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </>
            )}
            {isViewMode && (
              <button
                onClick={onCancel}
                className="px-4 py-1 bg-white border border-gray-400 text-gray-700 text-sm rounded hover:bg-gray-50"
              >
                Cerrar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Banner Modo Consulta + campos físicos type / id ═══ */}
      {isViewMode && (
        <div className="px-6 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-6 text-xs text-gray-700">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-500">TYPE (J_PRODUCTOS):</span>
              <span className="font-semibold text-gray-800">Captación</span>
            </div>
            {(producto?.dbUuid || producto?.identificacion) && (
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-500">ID (UUID):</span>
                <span className="font-mono text-[11px] text-gray-800 bg-white px-1.5 py-0.5 rounded border border-gray-200">{producto?.dbUuid || producto?.identificacion}</span>
              </div>
            )}
          </div>
          <span className="text-[10px] text-blue-600 italic">Solo lectura — No se permite modificación</span>
        </div>
      )}

      {/* Información Principal */}
      <div className="px-6 py-4 bg-white border-b border-gray-300 space-y-5">

        {/* ── Sub-sección 1: Datos de Identificación ── */}
        <div>
          <div className="bg-[#D9E2F3] px-3 py-1 mb-4 border-l-4 border-[#4A6FA5]">
            <span className="text-sm text-gray-800">Datos de Identificación</span>
          </div>
          <div className="grid grid-cols-3 gap-x-8 gap-y-3">
            <div>
              <label className="block text-xs text-gray-700 mb-1">CLAVE</label>
              <input
                type="text"
                value={formData.clave}
                disabled
                className={isViewMode ? viewFieldClass : "w-full px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded"}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">PRODUCTO {!isViewMode && <span className="text-red-600">*</span>}</label>
              <input
                type="text"
                value={formData.producto}
                onChange={(e) => handleInputChange('producto', e.target.value)}
                disabled={isViewMode}
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">ESTATUS {!isViewMode && <span className="text-red-600">*</span>}</label>
              <select
                value={formData.estatus}
                onChange={(e) => handleInputChange('estatus', e.target.value)}
                disabled={isViewMode}
                className={selectFieldClass}
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">TIPO DE PRODUCTO {!isViewMode && <span className="text-red-600">*</span>}</label>
              <select
                value={formData.tipoProducto}
                onChange={(e) => handleInputChange('tipoProducto', e.target.value)}
                disabled={isViewMode}
                className={selectFieldClass}
              >
                <option value="">Seleccionar...</option>
                <option value="Ahorro">Ahorro</option>
                <option value="Inversión">Inversión</option>
                <option value="Cuenta Corriente">Cuenta Corriente</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">LÍNEA DE PRODUCTO</label>
              <input
                type="text"
                value={formData.lineaProducto}
                disabled
                className={isViewMode ? viewFieldClass : "w-full px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded"}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">MONEDA</label>
              <select
                value={formData.tipoMoneda}
                onChange={(e) => handleInputChange('tipoMoneda', e.target.value)}
                disabled={isViewMode}
                className={selectFieldClass}
              >
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs text-gray-700 mb-1">DESCRIPCIÓN</label>
              <textarea
                value={formData.descripcion}
                onChange={(e) => handleInputChange('descripcion', e.target.value)}
                disabled={isViewMode}
                className={textareaFieldClass}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2 self-end pb-1" title={
              otroProdTieneCuentaEje && !formData.cuentaEje
                ? `Cuenta Eje ya asignada a "${cuentaEjeExistente!.productoNombre}" (${cuentaEjeExistente!.productoClave})`
                : ''
            }>
              <input
                type="checkbox"
                checked={formData.cuentaEje ?? false}
                onChange={(e) => {
                  if (e.target.checked && otroProdTieneCuentaEje) {
                    toast.error('Cuenta Eje ya asignada', {
                      description: `El producto "${cuentaEjeExistente!.productoNombre}" (${cuentaEjeExistente!.productoClave}) ya tiene la Cuenta Eje activada. Solo puede haber una.`,
                      duration: 5000,
                    });
                    return;
                  }
                  handleInputChange('cuentaEje', e.target.checked);
                }}
                disabled={isViewMode || (otroProdTieneCuentaEje && !formData.cuentaEje)}
                className={`w-4 h-4 ${otroProdTieneCuentaEje && !formData.cuentaEje ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <label className={`text-xs ${otroProdTieneCuentaEje && !formData.cuentaEje ? 'text-gray-400' : 'text-gray-700'}`}>
                CUENTA EJE
              </label>
              {otroProdTieneCuentaEje && !formData.cuentaEje && (
                <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                  Asignada a {cuentaEjeExistente!.productoClave}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Sub-sección 2: Tasas e Intereses ── */}
        <div>
          <div className="bg-[#D9E2F3] px-3 py-1 mb-4 border-l-4 border-[#4A6FA5]">
            <span className="text-sm text-gray-800">Tasas e Intereses</span>
          </div>
          <div className="grid grid-cols-3 gap-x-8 gap-y-3">
            <div>
              <label className="block text-xs text-gray-700 mb-1">TASA BASE</label>
              <select
                value={formData.tasaBase}
                onChange={(e) => handleInputChange('tasaBase', e.target.value)}
                disabled={isViewMode}
                className={selectFieldClass}
              >
                <option value="">-- Seleccione --</option>
                <option value="Fija">Fija</option>
                {tasasReferencia
                  .filter((t: any) => t.activo !== false)
                  .map((t: any) => (
                    <option key={t.id} value={t.tasaReferenciaNombre}>
                      {t.tasaReferenciaNombre}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">TIPO TASA</label>
              <select
                value={formData.tipoTasa}
                onChange={(e) => handleInputChange('tipoTasa', e.target.value)}
                disabled={isViewMode}
                className={selectFieldClass}
              >
                <option value="Fija">Fija</option>
                <option value="Variable">Variable</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">TASA INICIAL (%)</label>
              <input
                type="text"
                value={formData.tasaInicial}
                onChange={(e) => handleInputChange('tasaInicial', e.target.value)}
                disabled={isViewMode}
                placeholder="0.00"
                className={fieldClass}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.generaInteres ?? false}
                onChange={(e) => handleInputChange('generaInteres', e.target.checked)}
                disabled={isViewMode}
                className="w-4 h-4"
              />
              <label className="text-xs text-gray-700">GENERA INTERÉS</label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.capitalizaIntereses ?? false}
                onChange={(e) => handleInputChange('capitalizaIntereses', e.target.checked)}
                disabled={isViewMode}
                className="w-4 h-4"
              />
              <label className="text-xs text-gray-700">CAPITALIZA INTERESES</label>
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">FRECUENCIA CAPITALIZACIÓN</label>
              <select
                value={formData.frecuenciaPagoIntereses ?? ''}
                onChange={(e) => handleInputChange('frecuenciaPagoIntereses', e.target.value)}
                disabled={isViewMode}
                className={selectFieldClass}
              >
                <option value="">Seleccionar...</option>
                <option value="Mensual">Mensual</option>
                <option value="Trimestral">Trimestral</option>
                <option value="Semestral">Semestral</option>
                <option value="Anual">Anual</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── Sub-sección 3: Montos y Plazos ── */}
        <div>
          <div className="bg-[#D9E2F3] px-3 py-1 mb-4 border-l-4 border-[#4A6FA5]">
            <span className="text-sm text-gray-800">Montos y Plazos</span>
          </div>
          <div className="grid grid-cols-3 gap-x-8 gap-y-3">
            <div>
              <label className="block text-xs text-gray-700 mb-1">MONTO MÍNIMO</label>
              <input
                type="text"
                value={formData.montoMinimo}
                onChange={(e) => handleInputChange('montoMinimo', e.target.value)}
                disabled={isViewMode}
                placeholder="$0.00"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">MONTO MÁXIMO</label>
              <input
                type="text"
                value={formData.montoMaximo}
                onChange={(e) => handleInputChange('montoMaximo', e.target.value)}
                disabled={isViewMode}
                placeholder="$0.00"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">PERIODO COMPLETAR MÍNIMO</label>
              <select
                value={formData.periodoCompletarMinimo ?? ''}
                onChange={(e) => handleInputChange('periodoCompletarMinimo', e.target.value)}
                disabled={isViewMode}
                className={selectFieldClass}
              >
                <option value="">Seleccionar...</option>
                {K_PERIODS.map((p) => (
                  <option key={p.id} value={p.descripcion}>{p.descripcion} ({p.dias} días)</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">PLAZO COMPLETAR MÍNIMO</label>
              <input
                type="number"
                value={formData.plazoCompletarMinimo ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || (Number.isInteger(Number(val)) && Number(val) > 0)) {
                    handleInputChange('plazoCompletarMinimo', val);
                  }
                }}
                disabled={isViewMode}
                placeholder="1"
                min="1"
                step="1"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">DÍAS DE VENTANA</label>
              <input
                type="number"
                value={formData.diasVentana}
                onChange={(e) => handleInputChange('diasVentana', e.target.value)}
                disabled={isViewMode}
                placeholder="0"
                className={fieldClass}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-700 mb-1">NÚM. MÁX. RENOVACIONES</label>
              <input
                type="number"
                value={formData.numeroMaximoRenovaciones}
                onChange={(e) => handleInputChange('numeroMaximoRenovaciones', e.target.value)}
                disabled={isViewMode}
                placeholder="0"
                className={fieldClass}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Tabs */}
      <div className="flex items-center bg-primary-theme overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 px-6 py-3 text-xs font-medium transition-colors border-r border-white/10 ${
              activeTab === tab.id
                ? 'bg-[#5B9BD5] text-white'
                : 'bg-primary-theme text-white hover:bg-primary-hover-theme'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido del Tab Activo - Todos montados, ocultos con hidden para preservar refs y estado */}
      <div className="flex-1 bg-white px-6 py-4 overflow-auto">
        <div className={activeTab === 'default' ? '' : 'hidden'}>
          <div className="grid grid-cols-3 gap-x-8 gap-y-3">
            {/* Replica exacta del formulario principal sin título */}
            {/* Columna 1 */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-700 mb-1">PRODUCTO {!isViewMode && <span className="text-red-600">*</span>}</label>
                <input
                  type="text"
                  value={formData.producto}
                  onChange={(e) => handleInputChange('producto', e.target.value)}
                  disabled={isViewMode}
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1">TIPO DE PRODUCTO {!isViewMode && <span className="text-red-600">*</span>}</label>
                <select
                  value={formData.tipoProducto}
                  onChange={(e) => handleInputChange('tipoProducto', e.target.value)}
                  disabled={isViewMode}
                  className={selectFieldClass}
                >
                  <option value="">Seleccionar...</option>
                  <option value="Ahorro">Ahorro</option>
                  <option value="Inversión">Inversión</option>
                  <option value="Cuenta Corriente">Cuenta Corriente</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1">LÍNEA DE PRODUCTO</label>
                <input
                  type="text"
                  value={formData.lineaProducto}
                  disabled
                  className={isViewMode ? viewFieldClass : "w-full px-2 py-1 text-xs bg-gray-100 border border-gray-300 rounded"}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1">DESCRIPCIÓN</label>
                <textarea
                  value={formData.descripcion}
                  onChange={(e) => handleInputChange('descripcion', e.target.value)}
                  disabled={isViewMode}
                  className={textareaFieldClass}
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1">ESTATUS {!isViewMode && <span className="text-red-600">*</span>}</label>
                <select
                  value={formData.estatus}
                  onChange={(e) => handleInputChange('estatus', e.target.value)}
                  disabled={isViewMode}
                  className={selectFieldClass}
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1">TASA BASE</label>
                <select
                  value={formData.tasaBase}
                  onChange={(e) => handleInputChange('tasaBase', e.target.value)}
                  disabled={isViewMode}
                  className={selectFieldClass}
                >
                  <option value="Fija">Fija</option>
                  <option value="Variable">Variable</option>
                </select>
              </div>
            </div>

            {/* Columna 2 */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.generaInteres ?? false}
                  onChange={(e) => handleInputChange('generaInteres', e.target.checked)}
                  disabled={isViewMode}
                  className="w-4 h-4"
                />
                <label className="text-xs text-gray-700">GENERA INTERÉS</label>
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1">TIPO TASA</label>
                <select
                  value={formData.tipoTasa}
                  onChange={(e) => handleInputChange('tipoTasa', e.target.value)}
                  disabled={isViewMode}
                  className={selectFieldClass}
                >
                  <option value="Fija">Fija</option>
                  <option value="Variable">Variable</option>
                </select>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  checked={formData.capitalizaIntereses ?? false}
                  onChange={(e) => handleInputChange('capitalizaIntereses', e.target.checked)}
                  disabled={isViewMode}
                  className="w-4 h-4"
                />
                <label className="text-xs text-gray-700">CAPITALIZA INTERESES</label>
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1">FRECUENCIA DE CAPITALIZA INTERESES</label>
                <select
                  value={formData.frecuenciaPagoIntereses ?? ''}
                  onChange={(e) => handleInputChange('frecuenciaPagoIntereses', e.target.value)}
                  disabled={isViewMode}
                  className={selectFieldClass}
                >
                  <option value="">Seleccionar...</option>
                  <option value="Mensual">Mensual</option>
                  <option value="Trimestral">Trimestral</option>
                  <option value="Semestral">Semestral</option>
                  <option value="Anual">Anual</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1">TIPO DE MONEDA</label>
                <select
                  value={formData.tipoMoneda}
                  onChange={(e) => handleInputChange('tipoMoneda', e.target.value)}
                  disabled={isViewMode}
                  className={selectFieldClass}
                >
                  <option value="MXN">MXN</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            {/* Columna 3 */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-700 mb-1">DÍAS DE VENTANA</label>
                <input
                  type="number"
                  value={formData.diasVentana}
                  onChange={(e) => handleInputChange('diasVentana', e.target.value)}
                  disabled={isViewMode}
                  placeholder="0"
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1">MONTO MÍNIMO</label>
                <input
                  type="text"
                  value={formData.montoMinimo}
                  onChange={(e) => handleInputChange('montoMinimo', e.target.value)}
                  disabled={isViewMode}
                  placeholder="$0.00"
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1">PERIODO COMPLETAR MÍNIMO</label>
                <select
                  value={formData.periodoCompletarMinimo ?? ''}
                  onChange={(e) => handleInputChange('periodoCompletarMinimo', e.target.value)}
                  disabled={isViewMode}
                  className={selectFieldClass}
                >
                  <option value="">Seleccionar...</option>
                  <option value="Diario">Diario</option>
                  <option value="Semanal">Semanal</option>
                  <option value="Catorcenal">Catorcenal</option>
                  <option value="Quincenal">Quincenal</option>
                  <option value="Mensual">Mensual</option>
                  <option value="Trimestral">Trimestral</option>
                  <option value="Semestral">Semestral</option>
                  <option value="Anual">Anual</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1">PLAZO COMPLETAR MÍNIMO</label>
                <input
                  type="number"
                  value={formData.plazoCompletarMinimo ?? ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || (Number.isInteger(Number(val)) && Number(val) > 0)) {
                      handleInputChange('plazoCompletarMinimo', val);
                    }
                  }}
                  disabled={isViewMode}
                  placeholder="1"
                  min="1"
                  step="1"
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1">MONTO MÁXIMO</label>
                <input
                  type="text"
                  value={formData.montoMaximo}
                  onChange={(e) => handleInputChange('montoMaximo', e.target.value)}
                  disabled={isViewMode}
                  placeholder="$0.00"
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1">NÚMERO MÁXIMO RENOVACIONES</label>
                <input
                  type="number"
                  value={formData.numeroMaximoRenovaciones}
                  onChange={(e) => handleInputChange('numeroMaximoRenovaciones', e.target.value)}
                  disabled={isViewMode}
                  placeholder="0"
                  className={fieldClass}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-700 mb-1">TASA INICIAL (%)</label>
                <input
                  type="text"
                  value={formData.tasaInicial}
                  onChange={(e) => handleInputChange('tasaInicial', e.target.value)}
                  disabled={isViewMode}
                  placeholder="0.00"
                  className={fieldClass}
                />
              </div>

            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            TAB: Periodos (réplica exacta del patrón de ProductoForm créditos)
            ═══════════════════════════════════════════════════ */}
        {activeTab === 'periodos' && (
          <div>
            {/* Header PERIODOS con botones de acción */}
            <div className="section-header-theme px-4 py-2 mb-4 flex items-center justify-between rounded-t">
              <span className="text-xs font-semibold tracking-wide uppercase">Periodos</span>
              {!isViewMode && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPeriodosActionTab('nuevo')}
                    className="px-4 py-1 rounded text-xs font-medium transition-colors bg-white/20 text-white hover:bg-white/30"
                  >
                    + Nuevo
                  </button>
                  <button
                    onClick={() => setPeriodosActionTab(periodosActionTab === 'eliminar' ? null : 'eliminar')}
                    className={`px-4 py-1 rounded text-xs font-medium transition-colors ${
                      periodosActionTab === 'eliminar'
                        ? 'bg-white text-red-600 font-semibold shadow-sm'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>

            {/* Modal de Nuevo Periodo */}
            {periodosActionTab === 'nuevo' && (
              <div className="fixed inset-0 z-[9999] flex items-center justify-center" onClick={() => setPeriodosActionTab(null)}>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
                <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="modal-header-theme px-5 py-3 flex items-center justify-between">
                    <span className="text-sm font-semibold tracking-wide uppercase">Nuevo Periodo</span>
                    <button
                      onClick={() => setPeriodosActionTab(null)}
                      className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                      title="Cerrar"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                    </button>
                  </div>
                  <div className="p-5">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Periodo</label>
                        <select
                          value={selectedPeriodoId || ''}
                          onChange={(e) => {
                            const periodoId = parseInt(e.target.value);
                            const periodo = K_PERIODS.find(p => p.id === periodoId);
                            setSelectedPeriodoId(periodoId);
                            setSelectedPeriodoDescripcion(periodo?.descripcion || '');
                            setSelectedPeriodoDias(periodo?.dias || '');
                          }}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                        >
                          <option value="">Seleccione...</option>
                          {K_PERIODS.map((periodo) => (
                            <option key={periodo.id} value={periodo.id}>{periodo.descripcion}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Núm. Días</label>
                        <input
                          type="number"
                          min="1"
                          value={selectedPeriodoDias}
                          onChange={(e) => setSelectedPeriodoDias(e.target.value ? parseInt(e.target.value) : '')}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Descripción</label>
                        <input
                          type="text"
                          value={selectedPeriodoDescripcion}
                          readOnly
                          placeholder="Se auto-completa al seleccionar"
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-gray-100 text-gray-500 italic"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setPeriodosActionTab(null)}
                        className="px-4 py-1.5 rounded text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAddPeriodo}
                        className="px-5 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium transition-colors shadow-sm"
                      >
                        Agregar Periodo
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tabla de Periodos */}
            <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="table-header-theme">
                  <tr>
                    {periodosActionTab === 'eliminar' && !isViewMode && (
                      <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-20">
                        Acciones
                      </th>
                    )}
                    <th className="text-left px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Periodo</th>
                    <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-28">Núm. Días</th>
                    <th className="text-left px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {periodos.length === 0 ? (
                    <tr>
                      <td colSpan={periodosActionTab === 'eliminar' && !isViewMode ? 4 : 3} className="px-3 py-8 text-center text-gray-400 text-xs">
                        <div className="flex flex-col items-center gap-1">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
                            <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span>No hay períodos agregados</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    periodos.map((periodo, idx) => (
                      <tr key={periodo.id} className={`row-hover-theme transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                        {periodosActionTab === 'eliminar' && !isViewMode && (
                          <td className="text-center px-3 py-1.5 border-b border-gray-200">
                            <button
                              onClick={() => handleDeletePeriodo(periodo.id)}
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                              title="Eliminar período"
                            >
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                              </svg>
                            </button>
                          </td>
                        )}
                        <td className="px-3 py-1.5 border-b border-gray-200 font-medium text-gray-700">{K_PERIODS.find(p => p.id === periodo.periodoId)?.descripcion || periodo.descripcion}</td>
                        <td className="px-3 py-1.5 border-b border-gray-200 text-center">
                          <span className="inline-flex items-center justify-center bg-primary-tint-theme text-primary-theme font-semibold rounded-full px-2.5 py-0.5 min-w-[2rem] text-[11px]">
                            {periodo.dias ?? K_PERIODS.find(p => p.id === periodo.periodoId)?.dias ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 border-b border-gray-200 text-gray-600">{periodo.descripcion}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal de confirmación de eliminación */}
            {showDeletePeriodoModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-white rounded-lg shadow-2xl w-[440px] mx-4 overflow-hidden">
                  <div className="modal-header-theme px-5 py-3">
                    <h3 className="text-sm font-semibold text-white">Confirmar Eliminación</h3>
                  </div>
                  <div className="px-6 py-6 flex items-start gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
                        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800 mb-1">¿Eliminar este período?</p>
                      <p className="text-xs text-gray-500">Esta acción no se puede deshacer. El período será removido de la lista.</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 px-6 py-3 flex justify-end gap-2.5 border-t border-gray-200">
                    <button
                      onClick={() => setShowDeletePeriodoModal(false)}
                      className="px-5 py-1.5 text-xs bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmDeletePeriodo}
                      className="px-5 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-medium transition-colors shadow-sm"
                    >
                      Sí, Eliminar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className={activeTab === 'checklist' ? '' : 'hidden'}>
          <CheckListCaptacionesTab 
            ref={checkListTabRef}
            mode={mode}
            productId={productoId || 'nuevo'}
            initialData={producto?.checkListRegistros}
          />
        </div>

        <div className={activeTab === 'tasaInversion' ? '' : 'hidden'}>
          <TasaInversionTab 
            ref={tasaInversionTabRef}
            mode={mode}
            productId={productoId || 'nuevo'}
            initialData={producto?.tasaInversionRegistros}
            persistToStorage
            periodosDisponibles={periodos}
          />
        </div>

        <div className={activeTab === 'constitucion' ? '' : 'hidden'}>
          <ConstitucionTab 
            ref={constitucionTabRef}
            mode={mode}
            productId={productoId || 'nuevo'}
            initialData={producto?.constitucionRegistros}
            persistToStorage
          />
        </div>

        <div style={{ display: activeTab === 'cargo' ? 'block' : 'none' }}>
          <CargoTab
            ref={cargoTabRef}
            mode={modeCredito}
            productId={productoId || 'nuevo'}
            lineaProducto={formData.lineaProducto}
            sublinea={formData.tipoProducto}
            persistToStorage
            storagePrefix="captacion"
            initialData={producto?.cargoRegistros}
          />
        </div>

        <div className={activeTab === 'comisiones' ? '' : 'hidden'}>
          <ComisionesTab 
            ref={comisionesTabRef}
            mode={mode} 
            productId={productoId || 'nuevo'}
            initialData={Array.isArray(producto?.comisiones) ? producto.comisiones : producto?.comisionesRegistros}
            onDataChange={setComisionesData}
            storagePrefix="captacion"
          />
        </div>

        <div className={activeTab === 'fases' ? '' : 'hidden'}>
          <FasesTab 
            ref={fasesTabRef}
            mode={mode}
            productId={productoId || 'nuevo'}
            initialData={producto?.fasesRegistros}
            persistToStorage
            storagePrefix="captacion"
          />
        </div>

        {/* ═══ Tabs homologados desde Productos Crédito ═══ */}

        {activeTab === 'tasa-referencia' && (
          <div>
            <TasaReferenciaTab mode={modeCredito} productId={productoId || 0} tasasReferencia={tasasReferencia} setTasasReferencia={setTasasReferencia} />
          </div>
        )}

        <div style={{ display: activeTab === 'matriz-tasa-fija' ? 'block' : 'none' }}>
          <MatrizTasaFijaTab ref={matrizTasaFijaRef} mode={modeCredito} productId={productoId || 'nuevo'} periodos={periodos} initialData={producto?.matrizTasaFijaRegistros} persistToStorage />
        </div>

        <div style={{ display: activeTab === 'matriz-tasa-variable' ? 'block' : 'none' }}>
          <MatrizTasaVariableTab ref={matrizTasaVariableRef} mode={modeCredito} productId={productoId || 'nuevo'} tasasReferencia={tasasReferencia} periodos={periodos} initialData={producto?.matrizTasaVariableRegistros} persistToStorage />
        </div>

        <div style={{ display: activeTab === 'sucursal' ? 'block' : 'none' }}>
          <SucursalTab ref={sucursalRef} mode={modeCredito} productId={productoId || 'nuevo'} initialData={producto?.sucursalRegistros} persistToStorage />
        </div>

        <div style={{ display: activeTab === 'expedientes' ? 'block' : 'none' }}>
          <ExpedientesProductoTab ref={expedientesRef} mode={mode} productId={productoId || 'nuevo'} persistToStorage storagePrefix="captacion" initialData={producto?.expedientesRegistros} fases={producto?.fasesRegistros} />
        </div>

        {activeTab === 'acceso-cuenta' && (
          <div>
            <div className="bg-[#E8E8E8] px-3 py-1.5 mb-3 text-xs font-medium text-gray-700 flex items-center justify-between">
              <span>ACCESO A CUENTA — Canales y límites operativos del producto</span>
              <span className="text-[10px] text-gray-500 italic">
                {mode === 'nuevo' ? 'Catálogo default — se guardará con el producto' : `${accesoCuentaRows.length} registro(s) desde BD`}
              </span>
            </div>
            <div className="border border-gray-300">
              <table className="w-full text-xs">
                <thead className="bg-[#E8E8E8]">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">ID</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Tipo de Acceso</th>
                    <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Canal</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Límite Diario</th>
                    <th className="text-right px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Límite Mensual</th>
                    <th className="text-center px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Ops / Día</th>
                    <th className="text-center px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Activo</th>
                  </tr>
                </thead>
                <tbody>
                  {accesoCuentaRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-gray-400 italic">
                        No hay canales de acceso configurados para este producto
                      </td>
                    </tr>
                  ) : (
                    accesoCuentaRows.map((row: any, i: number) => (
                      <tr key={row.id || i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                        <td className="px-3 py-1.5 border-b border-gray-200">{row.id ?? i + 1}</td>
                        <td className="px-3 py-1.5 border-b border-gray-200 font-medium">{row.tipo || '—'}</td>
                        <td className="px-3 py-1.5 border-b border-gray-200">{row.canal || '—'}</td>
                        <td className="px-3 py-1.5 border-b border-gray-200 text-right">{row.limiteDiario || row.ld || '—'}</td>
                        <td className="px-3 py-1.5 border-b border-gray-200 text-right">{row.limiteMensual || row.lm || '—'}</td>
                        <td className="px-3 py-1.5 border-b border-gray-200 text-center">{row.opsDia ?? row.ops ?? '—'}</td>
                        <td className="px-3 py-1.5 border-b border-gray-200 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${row.activo !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
                            {row.activo !== false ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ display: activeTab === 'plantillas' ? 'block' : 'none' }}>
          <PlantillasTab
            ref={plantillasRef}
            mode={modeCredito}
            productId={productoId || 'nuevo'}
            persistToStorage
            storagePrefix="captacion"
            initialData={Array.isArray((producto as any)?.plantillas) ? (producto as any).plantillas : undefined}
          />
        </div>


      </div>
    </div>
  );
}