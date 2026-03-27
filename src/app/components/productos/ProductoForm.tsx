import { useState, useEffect, useMemo, useRef } from 'react';
import { Product, FormMode } from '../../types/product';
import {
  lineProducts,
  sublineProducts,
  organizations,
  statusOptions,
  currentUser,
  K_PERIODS,
  K_PHASES,
  K_TAX_TYPES,
} from '../../data/mockData';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { ProductoFormDefaultTab } from './ProductoFormDefaultTab';
import { AvisosTab } from './tabs/AvisosTab';
import { CaptacionTab } from './tabs/CaptacionTab';
import { TasaInversionTab } from './tabs/TasaInversionTab';
import { ConstitucionTab } from './tabs/ConstitucionTab';
import { ComisionesTab } from './tabs/ComisionesTab';
import { FasesTab } from './tabs/FasesTab';
import { GarantiaTab } from './tabs/GarantiaTab';
import { JerarquiaProductosTab } from './tabs/JerarquiaProductosTab';
import { ComiteCreditoTab } from './tabs/ComiteCreditoTab';
import { PeriodicidadTab } from './tabs/PeriodicidadTab';
import { MatrizTasaFijaTab } from './tabs/MatrizTasaFijaTab';
import { TasaReferenciaTab } from './tabs/TasaReferenciaTab';
import { MatrizTasaVariableTab } from './tabs/MatrizTasaVariableTab';
import { PaquetesTab } from './tabs/PaquetesTab';
import { SucursalTab } from './tabs/SucursalTab';
import { CargoTab } from './tabs/CargoTab';
import { PrelacionTab } from './tabs/PrelacionTab';
import { IvaTab } from './tabs/IvaTab';
import { ImpuestosTab } from './tabs/ImpuestosTab';
import { ExentoIvaTab } from './tabs/ExentoIvaTab';
import { CheckListTab } from './tabs/CheckListTab';
import { TabuladorProductosTab } from './tabs/TabuladorProductosTab';
import { ExpedientesProductoTab } from './tabs/ExpedientesProductoTab';
import { RequisitosTab } from './tabs/RequisitosTab';
import { PlantillasTab } from './tabs/PlantillasTab';
import { useProductoPersistence, useProductoTabs } from '../../hooks/useProductoPersistence';
import { syncToJProducts } from '../../hooks/useSyncJProducts';
import { usePuestosTrabajoDB } from '../../hooks/usePuestosTrabajoDB';

// ═══════════════════════════════════════════════════════════════════
// Datos estáticos de subtabs → se usan en render Y en save para J_PRODUCTOS
// ═══════════════════════════════════════════════════════════════════
const AMORTIZACIONES_DATA = [
  { id: 1, metodo: 'Francés (Cuota Fija)', descripcion: 'Cuota constante con amortización creciente e intereses decrecientes', pagoAnticipado: true, tipoCalculo: 'Saldo Insoluto', predeterminado: true },
  { id: 2, metodo: 'Alemán (Amortización Fija)', descripcion: 'Amortización constante con cuota decreciente', pagoAnticipado: true, tipoCalculo: 'Saldo Insoluto', predeterminado: false },
  { id: 3, metodo: 'Americano (Bullet)', descripcion: 'Solo intereses durante el plazo, capital al vencimiento', pagoAnticipado: false, tipoCalculo: 'Monto Original', predeterminado: false },
  { id: 4, metodo: 'Flat (Interés Global)', descripcion: 'Intereses calculados sobre monto original durante todo el plazo', pagoAnticipado: false, tipoCalculo: 'Monto Original', predeterminado: false },
  { id: 5, metodo: 'Libre (Pagos Variables)', descripcion: 'Pagos variables acordados según flujo del acreditado', pagoAnticipado: true, tipoCalculo: 'Saldo Insoluto', predeterminado: false },
];

// EXPEDIENTES_ELECTRONICOS_DATA → movido a ExpedientesProductoTab.tsx

const AUTORIZACION_DATA = [
  { nivel: 1, puesto: 'Ejecutivo de Cuenta', desde: '$1.00', hasta: '$50,000.00', firma: false, activo: true },
  { nivel: 2, puesto: 'Gerente de Sucursal', desde: '$50,001.00', hasta: '$250,000.00', firma: true, activo: true },
  { nivel: 3, puesto: 'Subdirector de Crédito', desde: '$250,001.00', hasta: '$1,000,000.00', firma: true, activo: true },
  { nivel: 4, puesto: 'Director de Crédito', desde: '$1,000,001.00', hasta: '$5,000,000.00', firma: true, activo: true },
  { nivel: 5, puesto: 'Comité de Crédito', desde: '$5,000,001.00', hasta: '$25,000,000.00', firma: true, activo: true },
  { nivel: 6, puesto: 'Consejo de Administración', desde: '$25,000,001.00', hasta: '$999,999,999.00', firma: true, activo: true },
];

const EVENTO_CONTABLE_DATA = [
  { clave: 'EC-001', evento: 'Desembolso de Crédito', cuenta: '1203-01-001', naturaleza: 'Cargo', descripcion: 'Registro de préstamo otorgado al acreditado', automatico: true },
  { clave: 'EC-002', evento: 'Cobro de Capital', cuenta: '1203-01-001', naturaleza: 'Abono', descripcion: 'Aplicación de pago a capital del crédito', automatico: true },
  { clave: 'EC-003', evento: 'Devengamiento de Interés Ordinario', cuenta: '5101-01-001', naturaleza: 'Cargo', descripcion: 'Reconocimiento diario de intereses devengados', automatico: true },
  { clave: 'EC-004', evento: 'Cobro de Interés Ordinario', cuenta: '2101-01-003', naturaleza: 'Abono', descripcion: 'Aplicación de pago de intereses ordinarios', automatico: true },
  { clave: 'EC-005', evento: 'Devengamiento de Interés Moratorio', cuenta: '5102-01-001', naturaleza: 'Cargo', descripcion: 'Reconocimiento de intereses por mora', automatico: true },
  { clave: 'EC-006', evento: 'Cobro de IVA', cuenta: '2105-01-001', naturaleza: 'Abono', descripcion: 'IVA trasladado sobre intereses cobrados', automatico: true },
  { clave: 'EC-007', evento: 'Constitución de Reserva', cuenta: '5201-01-001', naturaleza: 'Cargo', descripcion: 'Provisión de reserva preventiva por calificación', automatico: true },
  { clave: 'EC-008', evento: 'Castigo de Cartera', cuenta: '1203-01-001', naturaleza: 'Abono', descripcion: 'Baja de crédito irrecuperable contra reservas', automatico: false },
  { clave: 'EC-009', evento: 'Cobro de Comisión por Apertura', cuenta: '4201-01-001', naturaleza: 'Abono', descripcion: 'Ingreso por comisión de apertura del crédito', automatico: true },
  { clave: 'EC-010', evento: 'Traspaso a Cartera Vencida', cuenta: '1204-01-001', naturaleza: 'Cargo', descripcion: 'Reclasificación a cartera vencida por días de atraso', automatico: true },
];

interface PeriodoItem {
  id: number;
  periodoId: number;
  descripcion: string;
  dias: number;
}

interface TasaReferenciaItem {
  id: number;
  productId: number;
  tasaReferenciaId: number;
  tasaReferenciaNombre: string;
  moneda: string;
  activo: boolean;
}

interface ProductoFormProps {
  mode: FormMode;
  product?: Product;
  onSave: (product: Product) => void;
  onCancel: () => void;
  nextId: number;
  linea?: string; // 'Seguros' | undefined (default = Crédito)
}

export function ProductoForm({
  mode,
  product,
  onSave,
  onCancel,
  nextId,
  linea,
}: ProductoFormProps) {
  const isView = mode === 'view';
  const isCreate = mode === 'create';

  // CRITICAL: Stable productId constant - same pattern as Captación's `productoId || 0`
  // Must NOT depend on formData state to avoid circular dependencies with tab storageKeys
  const productId = product?.id || nextId;

  // ── Diagnóstico: verificar qué datos trae product de BD al editar ──
  if (product && !isCreate) {
    console.log(`[ProductoForm] EDIT mode — productId=${productId} | dbUuid=${product.dbUuid} | comisiones:`, Array.isArray(product.comisiones) ? `${product.comisiones.length} items` : typeof product.comisiones, '| fases:', Array.isArray(product.fases) ? `${product.fases.length} items` : typeof product.fases, '| expedientesElectronicos:', Array.isArray(product.expedientesElectronicos) ? `${product.expedientesElectronicos.length} items` : typeof product.expedientesElectronicos);
  }

  // Generar datos iniciales
  const getInitialFormData = (): Product => {
    if (product && !isCreate) {
      // Edit/View mode: load product data (persistence hook will merge with persisted data)
      return product;
    }
    if (product && isCreate) {
      // Create mode with temp product: use it as defaults
      return product;
    }
    // Fallback for create mode without temp product
    const selectedOrg = organizations.find(
      (org) => org.name === currentUser.organization
    );
    return {
      id: nextId,
      nombre: '',
      descripcion: '',
      lineaProducto: linea || 'Credito',
      sublineaProducto: '',
      sucursal: '',
      estatus: 'Pendiente',
      fechaRegistro: new Date().toISOString(),
      moneda: '',
      usuarioRegistro: currentUser.name,
      puestoTrabajo: currentUser.workPosition,
      tipoTasa: 'Fija',
      baseCalculo: '360',
      aplicaInteresMoratorio: false,
      descuentoNomina: false,
    };
  };

  // Hook de persistencia para el formulario principal
  const storageKey = `producto_credito_${productId}`;
  const { 
    data: formData, 
    setData: setFormData,
    updateField,
    updateFields, 
    clearPersistedData 
  } = useProductoPersistence<Product>(
    storageKey,
    getInitialFormData()
  );

  // Hook para tabs activos - También persiste el tab activo
  const [activeTab, setActiveTab] = useProductoTabs(storageKey, 'default');

  // NOTA: NO usar useEffect para setFormData(product) — sobreescribe datos persistidos.
  // El hook useProductoPersistence ya maneja la carga inicial correctamente:
  // - Si hay datos en sessionStorage → los usa (merge con initialData)
  // - Si no → usa getInitialFormData() que ya incluye el product

  // Estado para el tab de Periodos - También con persistencia
  const periodosStorageKey = `${storageKey}_periodos`;
  const { 
    data: periodos, 
    setData: setPeriodos 
  } = useProductoPersistence<PeriodoItem[]>(
    periodosStorageKey,
    // Los periodos son 100% manuales: solo se muestran los que el usuario capturó.
    // En Alta: vacío. En Editar/Ver: se restauran desde product.periodos (guardados previamente).
    // Si el producto no tiene periodos guardados, se muestra vacío (sin defaults automáticos).
    Array.isArray(product?.periodos) && product.periodos.length > 0
      ? product.periodos
      : []
  );

  const [periodosActionTab, setPeriodosActionTab] = useState<'nuevo' | 'eliminar' | null>(null);
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null);
  const [selectedPeriodoDescripcion, setSelectedPeriodoDescripcion] = useState('');
  const [selectedPeriodoDias, setSelectedPeriodoDias] = useState<number | ''>('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [periodoToDelete, setPeriodoToDelete] = useState<number | null>(null);

  // Estado para el tab de Tasa Referencia - También con persistencia
  const tasasStorageKey = `${storageKey}_tasas_referencia`;
  const { 
    data: tasasReferencia, 
    setData: setTasasReferencia 
  } = useProductoPersistence<TasaReferenciaItem[]>(
    tasasStorageKey,
    // ══════════════════════════════════════════════════════════════
    // FIX: Tasa Referencia es 100% manual.
    // - En Alta: vacío (sin defaults automáticos).
    // - En Editar/Ver: solo mostrar tasas guardadas (initialData de BD).
    // - Si no hay tasas guardadas: vacío (sin registros de ejemplo).
    // Las tasas de referencia solo deben existir si el usuario las registra manualmente.
    // ══════════════════════════════════════════════════════════════
    Array.isArray(product?.tasasReferencia) && product.tasasReferencia.length > 0
      ? product.tasasReferencia
      : []
  );

  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);

  // === REFS para tabs maestro-detalle (patrón forwardRef + getData) ===
  const matrizTasaFijaRef = useRef<{ getData: () => any[] }>(null);
  const matrizTasaVariableRef = useRef<{ getData: () => any[] }>(null);
  const paquetesRef = useRef<{ getData: () => any[] }>(null);
  const sucursalRef = useRef<{ getData: () => any[] }>(null);
  const cargoRef = useRef<{ getData: () => any[] }>(null);
  const prelacionRef = useRef<{ getData: () => any[] }>(null);
  const fasesRef = useRef<{ getData: () => any[] }>(null);
  const expedientesRef = useRef<{ getData: () => any[] }>(null);
  const garantiasRef = useRef<{ getData: () => any[] }>(null);
  const impuestosRef = useRef<{ getData: () => any[] }>(null);
  const comisionesRef = useRef<{ getData: () => any[] }>(null);
  const requisitosRef = useRef<{ getData: () => any[] }>(null);
  const tabuladorRef = useRef<{ getData: () => any[] }>(null);

  useEffect(() => {
    if (formData.lineaProducto) {
      const line = lineProducts.find((l) => l.name === formData.lineaProducto);
      setSelectedLineId(line?.id || null);
    }
  }, [formData.lineaProducto]);

  const handleChange = (
    field: keyof Product,
    value: string | number | boolean
  ) => {
    if (field === 'lineaProducto') {
      updateFields({
        [field]: value,
        sublineaProducto: '',
      });
      const line = lineProducts.find((l) => l.name === value);
      setSelectedLineId(line?.id || null);
    } else {
      updateField(field, value);
    }
  };

  const handleSubmit = () => {
    if (!isView) {
      // Validar campos requeridos según la especificación
      const requiredFields = [
        { field: 'nombre', label: 'Nombre' },
        { field: 'lineaProducto', label: 'Línea de Producto' },
        { field: 'sublineaProducto', label: 'Sublínea' },
        { field: 'moneda', label: 'Moneda' },
        { field: 'baseCalculo', label: 'Base Cálculo' },
        { field: 'estatus', label: 'Estatus' },
        { field: 'tipoTasa', label: isSeguros ? 'Tipo Cobertura' : 'Tipo Tasa' },
        { field: 'sucursal', label: 'Sucursal' },
      ];

      // Validar que cada campo requerido tenga un valor válido
      const emptyFields = requiredFields.filter(({ field }) => {
        const value = formData[field as keyof Product];
        // Validar que el valor no esté vacío, undefined, null, o sea solo espacios en blanco
        if (value === undefined || value === null || value === '') {
          return true;
        }
        // Si es string, validar que no sea solo espacios en blanco
        if (typeof value === 'string' && value.trim() === '') {
          return true;
        }
        return false;
      });

      if (emptyFields.length > 0) {
        const fieldNames = emptyFields.map(({ label }) => label).join(', ');
        toast.error('Campos requeridos faltantes', {
          description: `Por favor complete los siguientes campos: ${fieldNames}`,
        });
        return;
      }

      // Validar específicamente que Fecha de Registro exista (es autogenerada)
      if (!formData.fechaRegistro) {
        toast.error('Error en el formulario', {
          description: 'La fecha de registro no se ha generado correctamente',
        });
        return;
      }

      // Recolectar datos de todos los tabs (maestro-detalle)
      const productToSave = {
        ...formData,
        // Arrays de detalle recolectados desde refs
        matrizTasaFija: matrizTasaFijaRef.current?.getData() || [],
        matrizTasaVariable: matrizTasaVariableRef.current?.getData() || [],
        paquetes: paquetesRef.current?.getData() || [],
        sucursales: sucursalRef.current?.getData() || [],
        cargos: cargoRef.current?.getData() || [],
        prelacion: prelacionRef.current?.getData() || [],
        fases: fasesRef.current?.getData() || [],
        garantias: garantiasRef.current?.getData() || [],
        impuestos: impuestosRef.current?.getData() || [],
        comisiones: comisionesRef.current?.getData() || [],
        requisitos: requisitosRef.current?.getData() || [],
        tabulador: tabuladorRef.current?.getData() || [],
        // Datos inline (ya en estado de ProductoForm)
        periodos: periodos,
        tasasReferencia: tasasReferencia,
      };

      // ═══════════════════════════════════════════════════════════════
      // Construir JSON para J_PRODUCTOS.data (columna JSONB)
      // Nodo padre: Datos Generales + nodos hijos: subtabs
      // type = 'Credito' (fijo)
      // ═══════════════════════════════════════════════════════════════
      const idProducto = `PR-${String(formData.id || productId).padStart(3, '0')}`;

      const jCreditoData: Record<string, any> = {
        // ── Nodo padre: Datos Generales ──
        idProducto,
        nombre: formData.nombre || '',
        descripcion: formData.descripcion || '',
        lineaProducto: formData.lineaProducto || '',
        sublinea: formData.sublineaProducto || '',
        sucursal: formData.sucursal || '',
        estatus: formData.estatus || '',
        fechaRegistro: formData.fechaRegistro || '',

        // ── Nodos hijos: SubTabs ──
        default: {
          clave: idProducto,
          nombre: formData.nombre || '',
          descripcion: formData.descripcion || '',
          lineaProducto: formData.lineaProducto || '',
          sublinea: formData.sublineaProducto || '',
          sucursal: formData.sucursal || '',
          estatus: formData.estatus || '',
          fechaRegistro: formData.fechaRegistro || '',
          moneda: formData.moneda || '',
          cat: formData.cat ?? null,
          baseCalculo: formData.baseCalculo || '',
          tipoTasa: formData.tipoTasa || '',
          aplicaInteresMoratorio: formData.aplicaInteresMoratorio || false,
          descuentoNomina: formData.descuentoNomina || false,
          usuarioRegistro: formData.usuarioRegistro || '',
          puestoTrabajo: formData.puestoTrabajo || '',
        },
        periodos: periodos,
        matrizTasaFija: matrizTasaFijaRef.current?.getData() || [],
        tasaReferencia: tasasReferencia,
        matrizTasaVariable: matrizTasaVariableRef.current?.getData() || [],
        paquetes: paquetesRef.current?.getData() || [],
        sucursalConfig: sucursalRef.current?.getData() || [],
        cargo: cargoRef.current?.getData() || [],
        prelacionCargos: prelacionRef.current?.getData() || [],
        fases: fasesRef.current?.getData() || [],
        garantias: garantiasRef.current?.getData() || [],
        impuestos: impuestosRef.current?.getData() || [],
        comisiones: comisionesRef.current?.getData() || [],
        requisitos: requisitosRef.current?.getData() || [],
        tabuladorProductos: tabuladorRef.current?.getData() || [],
        amortizaciones: efectivoAmortizaciones,
        expedientesElectronicos: expedientesRef.current?.getData() || [],
        autorizacion: efectivoAutorizacion,
        eventoContable: efectivoEventoContable,
        plantillas: plantillasState,
      };

      // Sincronizar con J_PRODUCTOS (fire-and-forget, no bloquea guardado local)
      const existingDbUuid = product?.dbUuid || null;
      syncToJProducts({
        tipo: isSeguros ? 'Seguro' : 'Credito',
        datos: jCreditoData,
        label: isSeguros ? 'Producto Seguros' : 'Producto Crédito',
        existingId: existingDbUuid,
      });

      onSave(productToSave as Product);
      toast.success('Producto guardado exitosamente');
      // Limpiar TODOS los datos persistidos de tabs del producto
      handleCleanupStorage();
    }
  };

  // Limpieza completa de sessionStorage para este producto
  const handleCleanupStorage = () => {
    clearPersistedData();
    // Limpiar storage de tabs inline (periodos, tasas referencia)
    try { sessionStorage.removeItem(periodosStorageKey); } catch (e) { /* ignore */ }
    try { sessionStorage.removeItem(tasasStorageKey); } catch (e) { /* ignore */ }
    // Limpiar storage de tabs con forwardRef
    const tabStorageKeys = [
      `credito_matriztasafija_${productId}`,
      `credito_matriztasavariable_${productId}`,
      `credito_paquetes_${productId}`,
      `credito_sucursal_${productId}`,
      `credito_cargo_${productId}`,
      `credito_prelacion_${productId}`,
      `credito_fases_${productId}`,
      `credito_garantias_${productId}`,
      `credito_impuestos_${productId}`,
      `credito_tabulador_${productId}`,
      // FIX: Claves faltantes — sin estas, datos stale de sesiones anteriores
      // reaparecían al editar porque useTabPersistence prefiere storage sobre defaultData
      `credito_expedientes_prod_${productId}`,
      `credito_requisitos_${productId}`,
      `credito_comisiones_producto_${productId}`,
    ];
    tabStorageKeys.forEach(key => {
      try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ }
    });
    // Limpiar localStorage de comisiones (ComisionesTab usa localStorage con prefix)
    try { localStorage.removeItem(`credito_comisiones_producto_${productId}`); } catch (e) { /* ignore */ }
    // Limpiar claves de Línea de Crédito y legacy
    try { localStorage.removeItem(`linea_comisiones_producto_${productId}`); } catch (e) { /* ignore */ }
    try { localStorage.removeItem(`comisiones_producto_${productId}`); } catch (e) { /* ignore */ }
  };

  // Cancel con limpieza
  const handleCancelWithCleanup = () => {
    // Siempre limpiar storage al salir del formulario (incluyendo modo View)
    // para evitar datos residuales stale que reaparezcan en futuras aperturas
    handleCleanupStorage();
    onCancel();
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", {
        locale: es,
      });
    } catch {
      return dateString;
    }
  };

  // CRÍTICO: Usar useMemo para evitar filtrados en cada render
  const availableSublines = useMemo(() => {
    return selectedLineId
      ? sublineProducts.filter((sub) => sub.lineId === selectedLineId)
      : [];
  }, [selectedLineId]);

  // Handlers para Periodos
  const handleAddPeriodo = () => {
    if (!selectedPeriodoId) {
      toast.error('Debe seleccionar un período');
      return;
    }
    
    // Verificar si el período ya existe
    const periodoExiste = periodos.some(p => p.periodoId === selectedPeriodoId);
    if (periodoExiste) {
      toast.error('Este período ya ha sido agregado');
      return;
    }

    const diasValue = typeof selectedPeriodoDias === 'number' && selectedPeriodoDias > 0
      ? selectedPeriodoDias
      : K_PERIODS.find(p => p.id === selectedPeriodoId)?.dias || 0;

    const newPeriodo: PeriodoItem = {
      id: Math.max(...periodos.map((p) => p.id), 0) + 1,
      periodoId: selectedPeriodoId,
      descripcion: selectedPeriodoDescripcion,
      dias: diasValue,
    };
    
    setPeriodos((prev) => [...prev, newPeriodo]);
    toast.success('Período agregado exitosamente');
    
    // Limpiar formulario
    setSelectedPeriodoId(null);
    setSelectedPeriodoDescripcion('');
    setSelectedPeriodoDias('');
    setPeriodosActionTab(null);
  };

  const handleDeletePeriodo = (periodoId: number) => {
    setPeriodoToDelete(periodoId);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (periodoToDelete !== null) {
      setPeriodos((prev) => prev.filter((p) => p.id !== periodoToDelete));
      toast.success('Período eliminado exitosamente');
      setShowDeleteModal(false);
      setPeriodoToDelete(null);
    }
  };

  const isSeguros = linea === 'Seguros';

  // Tabs dinámicos según el tipo de producto
  const allTabs = [
    { id: 'default', label: 'Default' },
    // === Tabs homologados (mismo orden que Captación) ===
    { id: 'periodos', label: 'Periodos' },
    { id: 'matriz-tasa-fija', label: 'Matriz tasa fija' },
    { id: 'tasa-referencia', label: 'Tasa referencia' },
    { id: 'matriz-tasa-variable', label: 'Matriz tasa variable' },
    { id: 'fases', label: 'Fases' },
    { id: 'expedientes-electronicos', label: 'Requisitos OK' },
    { id: 'cargo', label: 'Cargo' },
    { id: 'comision', label: 'Comisión' },
    { id: 'sucursal', label: 'Sucursal' },
    // === Tabs específicos de Crédito ===
    { id: 'amortizaciones', label: 'Amortizaciones' },
    { id: 'autorizacion', label: 'Autorización' },
    { id: 'evento-contable', label: 'Evento Contable' },
    { id: 'garantias', label: 'Garantías' },
    { id: 'impuestos', label: 'Impuestos' },
    { id: 'paquetes', label: 'Paquetes' },
    { id: 'plantillas', label: 'Plantillas' },
    { id: 'prelacion', label: 'Prelación de cargos' },
    { id: 'tabulador-productos', label: 'Tabulador de Productos' },
  ];

  // ══════════════════════════════════════════════════════════════
  // Seguros: 15 tabs — orden específico del submódulo Seguros.
  // Eliminados: Tasa Referencia, Matriz Tasa Variable (no aplican a Seguros).
  // "Requisitos" (RequisitosTab) y "Expediente Electrónico" (ExpedientesProductoTab) 
  // son tabs separados. Autorizaciones y Eventos Contables inician vacíos
  // con opción "Cargar Plantilla".
  // ══════════════════════════════════════════════════════════════
  const segurosTabs = [
    { id: 'default', label: 'Default' },
    { id: 'periodos', label: 'Periodos' },
    { id: 'matriz-tasa-fija', label: 'Montos y Coberturas' },
    { id: 'requisitos', label: 'Requisitos' },
    { id: 'paquetes', label: 'Paquetes' },
    { id: 'sucursal', label: 'Sucursales' },
    { id: 'cargo', label: 'Cargos' },
    { id: 'prelacion', label: 'Prelación de Cargo' },
    { id: 'fases', label: 'Fases' },
    { id: 'garantias', label: 'Garantías' },
    { id: 'impuestos', label: 'Impuestos' },
    { id: 'comision', label: 'Comisiones' },
    { id: 'expedientes-electronicos', label: 'Requisitos OK' },
    { id: 'plantillas', label: 'Plantillas' },
    { id: 'autorizacion', label: 'Autorizaciones' },
    { id: 'evento-contable', label: 'Eventos Contables' },
  ];

  const tabs = isSeguros ? segurosTabs : allTabs;

  // ═══════════════════════════════════════════════════════════════
  // Datos efectivos de subtabs estáticos:
  // En Modo Consulta (View), se leen desde el JSONB del producto.
  // En Alta/Editar, se usan las constantes (se guardarán al JSONB).
  // ═══════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════
  // Amortizaciones — Catálogo fijo de métodos de cálculo.
  // - Seguros: siempre muestra los 5 métodos predefinidos (catálogo).
  // - Crédito Alta: vacío (sin registros automáticos).
  // - Crédito Editar/Ver: solo datos guardados en BD. Si no hay → vacío.
  // El usuario solo puede cambiar el "predeterminado" (radio button).
  // ══════════════════════════════════════════════════════════════
  const [amortizacionesState, setAmortizacionesState] = useState(() => {
    if (product?.amortizaciones && product.amortizaciones.length > 0) {
      // Hay datos guardados en BD → usarlos (merge con catálogo para predeterminado)
      const savedMap = new Map(product.amortizaciones.map((r: any) => [r.id, r]));
      return AMORTIZACIONES_DATA.map(row => ({
        ...row,
        predeterminado: savedMap.has(row.id) ? !!(savedMap.get(row.id) as any).predeterminado : row.predeterminado,
      }));
    }
    // Sin datos guardados: vacío hasta que el usuario active "Cargar Catálogo".
    return [];
  });
  const efectivoAmortizaciones = amortizacionesState;
  const handleSetPredeterminado = (id: number) => {
    if (isView) return;
    setAmortizacionesState(prev => prev.map(row => ({ ...row, predeterminado: row.id === id })));
  };
  // efectivoExpedientes → ahora manejado por ExpedientesProductoTab con ref
  // ══════════════════════════════════════════════════════════════
  // FIX: Autorización y Evento Contable — registros 100% manuales para Crédito.
  // - Seguros: siempre pre-poblar con los defaults (por diseño del módulo).
  // - Crédito Alta: vacío (sin defaults automáticos).
  // - Crédito Editar/Ver: solo datos guardados en BD. Si no hay → vacío.
  // ANTES: En Crédito edit sin datos, caía a AUTORIZACION_DATA (6 niveles fantasma)
  //        y EVENTO_CONTABLE_DATA (10 eventos fantasma).
  // AHORA: Si no hay datos guardados, se muestra vacío (sin registros fantasma).
  // Se usan useState para permitir "Cargar Plantilla" desde la UI.
  // ══════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════
  // Autorización y Evento Contable — 100% manuales para TODOS los módulos.
  // - Alta: vacío (sin defaults automáticos).
  // - Editar/Ver: solo datos guardados en BD. Si no hay → vacío.
  // - Opción "Cargar Plantilla" para inicializar datos estándar desde la UI.
  // ══════════════════════════════════════════════════════════════
  const [autorizacionState, setAutorizacionState] = useState<any[]>(() => {
    if (isCreate) return [];
    return product?.autorizacionNiveles && product.autorizacionNiveles.length > 0 ? product.autorizacionNiveles : [];
  });
  const efectivoAutorizacion = autorizacionState;

  const [eventoContableState, setEventoContableState] = useState<any[]>(() => {
    if (isCreate) return [];
    return product?.eventoContable && product.eventoContable.length > 0 ? product.eventoContable : [];
  });
  const efectivoEventoContable = eventoContableState;

  // ── Plantillas (subtab Plantillas — Fase 4 Formalizar Contrato) ──
  const TIPOS_PLANTILLA = ['solicitud', 'contrato', 'pagare', 'minuta'] as const;
  type TipoPlantilla = typeof TIPOS_PLANTILLA[number];
  interface PlantillaItem {
    id: string;
    nombre: string;
    tipo: TipoPlantilla | '';
    archivoBase: string;
    version: string;
    estatus: 'Activo' | 'Inactivo';
  }
  const plantillaVacia = (): PlantillaItem => ({
    id: crypto.randomUUID(),
    nombre: '',
    tipo: '',
    archivoBase: '',
    version: '1.0',
    estatus: 'Activo',
  });
  const [plantillasState, setPlantillasState] = useState<PlantillaItem[]>(() => {
    if (isCreate) return [];
    return Array.isArray(product?.plantillas) && product.plantillas.length > 0 ? product.plantillas : [];
  });

  // Cargar puestos de trabajo desde J_Catalogos (type=PuestoTrabajo)
  const { puestos, loading: loadingPuestos } = usePuestosTrabajoDB();

  return (
    <div className="bg-[#F0F0F0] min-h-screen">
      {/* Header Section */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#4A90E2">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M4 9h16M9 4v16" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">
              {mode === 'create' ? `Alta Productos ${isSeguros ? 'Seguros' : 'Crédito'}` : mode === 'edit' ? `Editar Producto ${isSeguros ? 'Seguros' : 'Crédito'}` : `Ver Producto ${isSeguros ? 'Seguros' : 'Crédito'}`}
            </h2>
            {/* Mostrar idProducto y UUID en modo consulta/editar */}
            {!isCreate && product?.idProducto && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {product.idProducto}
              </span>
            )}
            {!isCreate && product?.dbUuid && (
              <span className="text-[10px] text-gray-400 font-mono bg-gray-50 px-2 py-0.5 rounded" title="UUID en J_PRODUCTOS">
                {product.dbUuid}
              </span>
            )}
            <button className="p-1 ml-2">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2">
                <circle cx="8" cy="8" r="6"/>
                <path d="M13 13l3 3"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-300">
        <div className="flex items-center gap-2">
          {!isView && (
            <button 
              onClick={handleSubmit}
              className="px-5 py-1.5 bg-[#0099CC] text-white rounded text-sm hover:bg-[#0088BB] font-medium"
            >
              Guardar
            </button>
          )}
          <button 
            onClick={handleCancelWithCleanup}
            className="px-5 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700"
          >
            {isView ? 'Volver' : 'Cancelar'}
          </button>
          {/* Indicador de Modo Consulta — solo lectura */}
          {isView && (
            <span className="ml-3 inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7" cy="7" r="6"/>
                <path d="M7 4v3M7 9h.01"/>
              </svg>
              Modo Consulta — Solo lectura
            </span>
          )}
        </div>
      </div>

      {/* Form Content */}
      <div className="px-4 py-4">
        <div className="bg-white border border-gray-300">
          {/* Datos Producto - Siempre visible */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-200 bg-gradient-to-b from-gray-50/60 to-white">
            <div className="flex items-center gap-2.5 bg-[#D9E2F3] px-4 py-2 mb-4 rounded border-l-4 border-[#4A6FA5] shadow-sm">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#4A6FA5" strokeWidth="1.5">
                <rect x="2" y="2" width="12" height="12" rx="2" />
                <path d="M5 6h6M5 8.5h4M5 11h5" />
              </svg>
              <span className="text-sm font-semibold text-[#2E5C91] tracking-wide uppercase">
                Datos del Producto
              </span>
            </div>
            
            <div className="bg-white rounded border border-gray-200 px-4 py-3.5 shadow-sm">
              <ProductoFormDefaultTab
                formData={formData}
                mode={mode}
                handleChange={handleChange}
                showDescuentoNomina={true}
              />
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="bg-primary-theme text-white border-b border-gray-400">
            <div className="flex items-center overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-xs whitespace-nowrap border-r border-gray-500/30 transition-all ${
                    activeTab === tab.id
                      ? 'bg-secondary-theme text-white font-medium'
                      : 'bg-primary-theme text-white/90 hover:bg-[#5A7FB5]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'default' && (
              <div>
                <ProductoFormDefaultTab
                  formData={formData}
                  mode={mode}
                  handleChange={handleChange}
                  showDescuentoNomina={true}
                />
              </div>
            )}

            {activeTab === 'periodos' && (
              <div>
                {/* Header PERIODOS con botones de acción */}
                <div className="section-header-theme px-4 py-2 mb-4 flex items-center justify-between rounded-t">
                  <span className="text-xs font-semibold tracking-wide uppercase">Periodos</span>
                  {!isView && (
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
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
                    {/* Modal */}
                    <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-lg mx-4 overflow-hidden animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                      {/* Header */}
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
                      {/* Body */}
                      <div className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                          {/* Campo Periodo */}
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

                          {/* Campo Núm. Días */}
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
                        {periodosActionTab === 'eliminar' && !isView && (
                          <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-20">
                            Acciones
                          </th>
                        )}
                        <th className="text-left px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide">Periodo</th>
                        <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-28">Núm. Días</th>
                      </tr>
                    </thead>
                    <tbody>
                      {periodos.length === 0 ? (
                        <tr>
                          <td colSpan={periodosActionTab === 'eliminar' && !isView ? 3 : 2} className="px-3 py-8 text-center text-gray-400 text-xs">
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
                            {periodosActionTab === 'eliminar' && !isView && (
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
                            <td className="px-3 py-1.5 border-b border-gray-200 font-medium text-gray-700">{K_PERIODS.find(p => p.id === periodo.periodoId)?.descripcion || ''}</td>
                            <td className="px-3 py-1.5 border-b border-gray-200 text-center">
                              <span className="inline-flex items-center justify-center bg-primary-tint-theme text-primary-theme font-semibold rounded-full px-2.5 py-0.5 min-w-[2rem] text-[11px]">
                                {periodo.dias ?? K_PERIODS.find(p => p.id === periodo.periodoId)?.dias ?? '—'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Modal de confirmación de eliminación */}
                {showDeleteModal && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-2xl w-[440px] mx-4 overflow-hidden">
                      {/* Header del modal */}
                      <div className="modal-header-theme px-5 py-3">
                        <h3 className="text-sm font-semibold text-white">Confirmar Eliminación</h3>
                      </div>
                      {/* Contenido */}
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
                      {/* Footer con botones */}
                      <div className="bg-gray-50 px-6 py-3 flex justify-end gap-2.5 border-t border-gray-200">
                        <button
                          onClick={() => setShowDeleteModal(false)}
                          className="px-5 py-1.5 text-xs bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-50 font-medium transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={confirmDelete}
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

            {activeTab === 'tasa-referencia' && (
              <div>
                <TasaReferenciaTab mode={mode} productId={productId} tasasReferencia={tasasReferencia} setTasasReferencia={setTasasReferencia} />
              </div>
            )}

            {/* === Tabs con forwardRef + persistToStorage: montados siempre con style display para preservar refs y estado === */}
            <div style={{ display: activeTab === 'matriz-tasa-fija' ? 'block' : 'none' }}>
              <MatrizTasaFijaTab ref={matrizTasaFijaRef} mode={mode} productId={productId} periodos={periodos} persistToStorage isSeguros={isSeguros} initialData={Array.isArray(product?.matrizTasaFija) ? product.matrizTasaFija : undefined} />
            </div>

            <div style={{ display: activeTab === 'matriz-tasa-variable' ? 'block' : 'none' }}>
              <MatrizTasaVariableTab ref={matrizTasaVariableRef} mode={mode} productId={productId} tasasReferencia={tasasReferencia} periodos={periodos} persistToStorage initialData={Array.isArray(product?.matrizTasaVariable) ? product.matrizTasaVariable : undefined} />
            </div>

            <div style={{ display: activeTab === 'requisitos' ? 'block' : 'none' }}>
              <RequisitosTab ref={requisitosRef} mode={mode} productId={productId} persistToStorage storagePrefix="credito" initialData={Array.isArray(product?.requisitos) ? product.requisitos : undefined} />
            </div>

            <div style={{ display: activeTab === 'paquetes' ? 'block' : 'none' }}>
              <PaquetesTab ref={paquetesRef} mode={mode} productId={productId} persistToStorage isSeguros={isSeguros} initialData={Array.isArray(product?.paquetes) ? product.paquetes : undefined} />
            </div>

            <div style={{ display: activeTab === 'sucursal' ? 'block' : 'none' }}>
              <SucursalTab ref={sucursalRef} mode={mode} productId={productId} persistToStorage initialData={Array.isArray(product?.sucursales) ? product.sucursales : undefined} />
            </div>

            <div style={{ display: activeTab === 'cargo' ? 'block' : 'none' }}>
              <CargoTab
                ref={cargoRef}
                mode={mode}
                productId={productId}
                lineaProducto={formData.lineaProducto}
                sublinea={formData.sublineaProducto}
                persistToStorage
                initialData={Array.isArray(product?.cargos) ? product.cargos : undefined}
              />
            </div>

            <div style={{ display: activeTab === 'prelacion' ? 'block' : 'none' }}>
              <PrelacionTab ref={prelacionRef} mode={mode} productId={productId} persistToStorage initialData={Array.isArray(product?.prelacion) ? product.prelacion : undefined} />
            </div>

            <div style={{ display: activeTab === 'fases' ? 'block' : 'none' }}>
              <FasesTab ref={fasesRef} mode={mode} productId={productId} persistToStorage storagePrefix="credito" initialData={Array.isArray(product?.fases) ? product.fases : undefined} />
            </div>

            <div style={{ display: activeTab === 'impuestos' ? 'block' : 'none' }}>
              <ImpuestosTab ref={impuestosRef} mode={mode} productId={productId} persistToStorage initialData={Array.isArray(product?.impuestos) ? product.impuestos : undefined} />
            </div>

            <div style={{ display: activeTab === 'comision' ? 'block' : 'none' }}>
              <ComisionesTab
                ref={comisionesRef}
                mode={mode}
                productId={productId}
                initialData={Array.isArray(product?.comisiones) ? product.comisiones : Array.isArray((product as any)?.comision) ? (product as any).comision : undefined}
                cargos={Array.isArray(product?.cargos) ? product.cargos : undefined}
              />
            </div>

            <div style={{ display: activeTab === 'tabulador-productos' ? 'block' : 'none' }}>
              <TabuladorProductosTab ref={tabuladorRef} mode={mode} productId={productId} persistToStorage initialData={Array.isArray(product?.tabulador) ? product.tabulador : undefined} />
            </div>

            {/* === Tabs secundarios que NO son parte del maestro-detalle (renderizado condicional) === */}
            {activeTab === 'aplicar-cobranza' && (
              <div>
                <div className="text-sm text-gray-600">
                  Contenido de Aplicar Cobranza
                </div>
              </div>
            )}

            {activeTab === 'iva-porcentaje' && (
              <div>
                <IvaTab mode={mode} productId={productId} />
              </div>
            )}

            <div style={{ display: activeTab === 'garantias' ? 'block' : 'none' }}>
              <GarantiaTab
                ref={garantiasRef}
                mode={mode}
                productId={productId}
                initialData={product?.garantias}
                persistToStorage
              />
            </div>

            {activeTab === 'jerarquia-productos' && (
              <div>
                <JerarquiaProductosTab mode={mode} productId={productId} />
              </div>
            )}

            {activeTab === 'productos-relacionados' && (
              <div>
                <div className="text-sm text-gray-600">
                  Contenido de Productos relacionados
                </div>
              </div>
            )}

            {activeTab === 'comites-credito' && (
              <div>
                <ComiteCreditoTab mode={mode} productId={productId} />
              </div>
            )}

            {activeTab === 'periodicidad' && (
              <div>
                <PeriodicidadTab key={`periodicidad-tab`} mode={mode} productId={productId} />
              </div>
            )}

            {activeTab === 'matriz-fija' && (
              <div>
                <div className="text-sm text-gray-600">
                  Contenido de Matriz de fija
                </div>
              </div>
            )}

            {activeTab === 'exento-iva' && (
              <div>
                <ExentoIvaTab mode={mode} productId={productId} />
              </div>
            )}

            {activeTab === 'check-list' && (
              <div>
                <CheckListTab mode={mode} productId={productId} />
              </div>
            )}

            {activeTab === 'condiciones-disposicion' && (
              <div>
                <div className="text-sm text-gray-600">
                  Contenido de Condiciones de disposición
                </div>
              </div>
            )}

            {activeTab === 'parametros-calculo-linea' && (
              <div>
                <div className="text-sm text-gray-600">
                  Contenido de Parámetros de Cálculo de Línea
                </div>
              </div>
            )}

            {activeTab === 'gastos-comisiones' && (
              <div>
                <ComisionesTab 
                  mode={mode} 
                  productId={productId}
                  cargos={Array.isArray(product?.cargos) ? product.cargos : undefined}
                  storagePrefix="linea"
                />
              </div>
            )}

            {activeTab === 'evento-contable' && (
              <div>
                <div className="bg-[#E8E8E8] px-3 py-1.5 mb-3 text-xs font-medium text-gray-700 flex items-center justify-between">
                  <span>EVENTOS CONTABLES — Configuración de pólizas automáticas del producto</span>
                  {!isView && efectivoEventoContable.length === 0 && (
                    <button
                      onClick={() => setEventoContableState(EVENTO_CONTABLE_DATA.map(r => ({ ...r })))}
                      className="px-3 py-1 bg-[#4A6FA5] text-white text-[10px] hover:bg-[#3E5C91] rounded font-medium transition-colors"
                    >
                      Cargar Plantilla
                    </button>
                  )}
                </div>
                <div className="border border-gray-300">
                  <table className="w-full text-xs">
                    <thead className="bg-[#E8E8E8]">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Clave</th>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Evento</th>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Cuenta Contable</th>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Naturaleza</th>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Descripción Póliza</th>
                        <th className="text-center px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Automático</th>
                      </tr>
                    </thead>
                    <tbody>
                      {efectivoEventoContable.length === 0 ? (
                        <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500 text-xs">
                          No hay eventos contables configurados.
                          {!isView && <span className="block mt-1 text-blue-600">Use el botón "Cargar Plantilla" para inicializar los eventos estándar.</span>}
                        </td></tr>
                      ) : efectivoEventoContable.map((row: any, i: number) => (
                        <tr key={row.clave ?? i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                          <td className="px-3 py-1.5 border-b border-gray-200 font-medium text-blue-700">{row.clave}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 font-medium">{row.evento}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 font-mono">{row.cuenta}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200"><span className={`px-2 py-0.5 rounded text-[10px] ${row.naturaleza === 'Cargo' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>{row.naturaleza}</span></td>
                          <td className="px-3 py-1.5 border-b border-gray-200">{row.descripcion}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 text-center">{row.automatico ? '✓' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'amortizaciones' && (
              <div>
                <div className="bg-[#E8E8E8] px-3 py-1.5 mb-3 text-xs font-medium text-gray-700 flex items-center justify-between">
                  <span>TABLA DE AMORTIZACIÓN — Métodos de cálculo aplicables al producto</span>
                  {!isView && efectivoAmortizaciones.length === 0 && (
                    <button
                      onClick={() => setAmortizacionesState(AMORTIZACIONES_DATA.map(row => ({ ...row })))}
                      className="px-3 py-1 bg-[#4A6FA5] text-white text-[10px] hover:bg-[#3E5C91] rounded font-medium transition-colors"
                    >
                      Cargar Catálogo
                    </button>
                  )}
                </div>
                <div className="border border-gray-300">
                  <table className="w-full text-xs">
                    <thead className="bg-[#E8E8E8]">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">ID</th>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Método</th>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Descripción</th>
                        <th className="text-center px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Pago Anticipado</th>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Tipo Cálculo</th>
                        <th className="text-center px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Predeterminado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {efectivoAmortizaciones.length === 0 ? (
                        <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500 text-xs">
                          No hay métodos de amortización configurados.
                          {!isView && <span className="block mt-1 text-blue-600">Use el botón "Cargar Catálogo" para inicializar los 5 métodos estándar.</span>}
                        </td></tr>
                      ) : efectivoAmortizaciones.map((row: any, i: number) => (
                        <tr key={row.id ?? i} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                          <td className="px-3 py-1.5 border-b border-gray-200">{row.id}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 font-medium">{row.metodo}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200">{row.descripcion}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 text-center">{row.pagoAnticipado ? '✓' : '—'}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200">{row.tipoCalculo}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 text-center">
                            <input
                              type="radio"
                              name="amort-predeterminado"
                              checked={!!row.predeterminado}
                              onChange={() => handleSetPredeterminado(row.id)}
                              disabled={isView}
                              className="accent-blue-700 cursor-pointer disabled:cursor-default"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: activeTab === 'expedientes-electronicos' ? 'block' : 'none' }}>
              <ExpedientesProductoTab ref={expedientesRef} mode={mode} productId={productId} persistToStorage storagePrefix="credito" initialData={Array.isArray(product?.expedientesElectronicos) ? product.expedientesElectronicos : undefined} fases={Array.isArray(product?.fases) ? product.fases : undefined} />
            </div>

            {/* ═══════════════════════════════════════════════════════════════
                PLANTILLAS — Fase 4 Formalizar Contrato
                Tipos: solicitud | contrato | pagare | minuta
            ═══════════════════════════════════════════════════════════════ */}
            {activeTab === 'plantillas' && (
              <PlantillasTab
                formData={formData}
                updateFormData={updateFormData}
                isView={isView}
              />
            )}

            {activeTab === 'autorizacion' && (
              <div>
                <div className="bg-[#E8E8E8] px-3 py-1.5 mb-3 text-xs font-medium text-gray-700 flex items-center justify-between">
                  <span>Catálogo de Puestos de Trabajo</span>
                </div>
                
                {loadingPuestos ? (
                  <div className="flex items-center justify-center py-8 text-gray-500 text-xs">
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                    </svg>
                    Cargando puestos de trabajo...
                  </div>
                ) : puestos.length === 0 ? (
                  <div className="border border-gray-300 rounded p-6 text-center text-gray-500 text-xs">
                    No hay puestos de trabajo configurados en J_Catalogos (type=PuestoTrabajo).
                  </div>
                ) : (
                  <div className="border border-gray-300">
                    <table className="w-full text-xs">
                      <thead className="bg-[#4A6FA5] text-white">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Puesto</th>
                          <th className="text-left px-3 py-2 font-medium">Nombre</th>
                          <th className="text-right px-3 py-2 font-medium">Monto Desde</th>
                          <th className="text-right px-3 py-2 font-medium">Monto Hasta</th>
                          <th className="text-center px-3 py-2 font-medium">Activo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {puestos.map((puesto, i) => (
                          <tr key={puesto.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                            <td className="px-3 py-2 border-b border-gray-200 font-medium">{puesto.puesto || '—'}</td>
                            <td className="px-3 py-2 border-b border-gray-200">{puesto.nombre || '—'}</td>
                            <td className="px-3 py-2 border-b border-gray-200 text-right">${puesto.montoMinimo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 border-b border-gray-200 text-right">${puesto.montoMaximo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 border-b border-gray-200 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${puesto.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                                {puesto.activo ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                
                <div className="mt-3 text-xs text-gray-500">
                  Total: {puestos.length} puesto(s) de trabajo
                </div>
              </div>
            )}

            {/* Tabs específicos de Productos de Crédito */}
            {activeTab === 'checklist-captaciones' && (
              <div>
                <CaptacionTab mode={mode} productId={productId} />
              </div>
            )}

            {activeTab === 'tasa-inversion' && (
              <div>
                <TasaInversionTab mode={mode} productId={productId} />
              </div>
            )}

            {activeTab === 'constitucion' && (
              <div>
                <ConstitucionTab mode={mode} productId={productId} />
              </div>
            )}

            {activeTab === 'acceso-cuenta' && (
              <div>
                <div className="text-sm text-gray-600">
                  Contenido de Acceso Cuenta
                </div>
              </div>
            )}

            {activeTab === 'tasa-ahorro-vista' && (
              <div>
                <div className="text-sm text-gray-600">
                  Contenido de Tasa ahorro y Vista
                </div>
              </div>
            )}

            {activeTab === 'depositos-garantia' && (
              <div>
                <div className="text-sm text-gray-600">
                  Contenido de Depósitos de Garantía
                </div>
              </div>
            )}

            {/* Tabs específicos de Productos de No Crédito */}
            {activeTab === 'manten-plazo' && (
              <div>
                <div className="text-sm text-gray-600">
                  Contenido de Manten/Plazo
                </div>
              </div>
            )}

            {activeTab === 'tases' && (
              <div>
                <div className="text-sm text-gray-600">
                  Contenido de Tases
                </div>
              </div>
            )}

            {activeTab === 'cargos' && (
              <div>
                <div className="text-sm text-gray-600">
                  Contenido de Cargos
                </div>
              </div>
            )}

            {activeTab === 'avisos' && (
              <div>
                <AvisosTab mode={mode} productId={productId} />
              </div>
            )}

            {activeTab === 'solicitudes-extraordinarias' && (
              <div>
                <div className="text-sm text-gray-600">
                  Contenido de Solicitudes Extraordinarias
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}