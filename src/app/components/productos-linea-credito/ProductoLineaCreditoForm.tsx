import { useState, useEffect, useMemo, useRef } from 'react';
import { ProductoLineaCredito, FormModeLineaCredito, GarantiaLineaCredito, JerarquiaProductoLineaCredito, ComiteCreditoLineaCredito, PeriodicidadLineaCredito, FaseLineaCredito, MatrizTasaFijaLineaCredito, IvaPorcentajeLineaCredito, ExentoIvaLineaCredito, CheckListLineaCredito } from '@/app/types/productoLineaCredito';
import {
  lineProducts,
  sublineProducts,
  statusOptions,
  currentUser,
  K_PERIODS,
} from '@/app/data/mockData';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { ProductoLineaCreditoFormDefaultTab } from './ProductoLineaCreditoFormDefaultTab';
import { ProductoLineaCreditoFormDatosProducto } from './ProductoLineaCreditoFormDatosProducto';
import { ComitesCreditoLineaCreditoTab } from './ComitesCreditoLineaCreditoTab';
import { CheckListLineaCreditoTab } from './CheckListLineaCreditoTab';
// ── Tabs reutilizados del módulo Producto Crédito ──
import { MatrizTasaFijaTab } from '../productos/tabs/MatrizTasaFijaTab';
import { TasaReferenciaTab } from '../productos/tabs/TasaReferenciaTab';
import { MatrizTasaVariableTab } from '../productos/tabs/MatrizTasaVariableTab';
import { PaquetesTab } from '../productos/tabs/PaquetesTab';
import { SucursalTab } from '../productos/tabs/SucursalTab';
import { CargoTab } from '../productos/tabs/CargoTab';
import { FasesTab } from '../productos/tabs/FasesTab';
import { GarantiaTab } from '../productos/tabs/GarantiaTab';
import { ComisionesTab } from '../productos/tabs/ComisionesTab';
import { ExpedientesProductoTab } from '../productos/tabs/ExpedientesProductoTab';
import { PlantillasTab } from '../productos/tabs/PlantillasTab';
import { useProductoPersistence, useProductoTabs } from '../../hooks/useProductoPersistence';
import { syncToJProducts } from '../../hooks/useSyncJProducts';

interface ProductoLineaCreditoFormProps {
  mode: FormModeLineaCredito;
  product?: ProductoLineaCredito;
  onSave: (product: ProductoLineaCredito) => void;
  onCancel: () => void;
  nextId: number;
}

export function ProductoLineaCreditoForm({
  mode,
  product,
  onSave,
  onCancel,
  nextId,
}: ProductoLineaCreditoFormProps) {
  const isView = mode === 'view';
  const isCreate = mode === 'create';

  // ID estable del producto (no reactivo)
  const productId = product?.id || nextId;

  // Generar datos iniciales
  const getInitialFormData = (): ProductoLineaCredito => {
    if (product) {
      return product;
    }
    if (isCreate) {
      // Generar clave automáticamente: formato LC-XXXXXX donde X es el ID con padding
      const generatedClave = `LC-${String(nextId).padStart(6, '0')}`;
      
      return {
        id: nextId,
        // Columna izquierda
        nombre: '',
        clave: generatedClave,
        descripcion: '',
        tipoProducto: 'Línea de Crédito',
        subTipo: '',
        sucursal: '',
        nombreEquipoAnalista: '',
        nombreEquipoAnalistaMesa: '',
        // Columna central
        tipoLinea: '',
        montoMinimo: '',
        montoMaximo: '',
        permiteSobregiros: false,
        tipoSobregiro: '',
        montoOPorcentaje: '',
        numDisposicionesAbiertas: '',
        intervaloCleanUp: '',
        verificacionCleanUp: false,
        // Columna derecha
        porcentajeComisionApertura: '',
        plazoMinimoDisposicion: '',
        plazoMaximoDisposicion: '',
        diasGraciaDisposicion: '',
        vigenciaLineaDias: '',
        porcentajeInteresMoratorio: '',
        diasParaRenovacion: '',
        // FIX: Todos los subtabs inician vacíos. Sin registros automáticos.
        // Los registros solo existen si el usuario los captura manualmente.
        garantias: [],
        jerarquias: [],
        comites: [],
        periodicidades: [],
        fases: [],
        matrizTasaFija: [],
        ivaPorcentaje: [],
        exentoIva: [],
        checkList: [],
        // Campos sistema
        lineaProducto: 'Linea Credito',
        sublineaProducto: '',
        fechaRegistro: new Date().toISOString(),
        usuarioRegistro: currentUser.name,
        puestoTrabajo: currentUser.workPosition,
        estatus: 'Activo',
        moneda: 'MXN',
        baseCalculo: '360',
        tipoTasa: 'Fija',
        aplicaInteresMoratorio: true,
        // Campos del tab Default – Características
        formaDisposicion: '',
        renovable: false,
        frecuenciaRevision: '',
        tipoGarantia: '',
        destino: '',
        // Campos del tab Default – Tasas y Comisiones
        tasaOrdinaria: '',
        spread: '',
        factorMoratorio: '',
        comisiones: '',
        iva: '',
        formaDevengo: 'Saldo dispuesto',
        metodoInteres: 'Saldo insoluto',
        periodicidadIntereses: 'Mensual',
        // Datos Complementarios (Grid)
        claveIbs: '',
        vodRowId: '',
        opcionCompra: '',
        porcentajeOpcionCompra: '',
        tasaBase: '',
        calculo: '',
        productoSeg: '',
        referenciaCliente: '',
        referenciaProducto: '',
        rentabilidad: '',
        tasa: '',
      };
    }
    return {} as ProductoLineaCredito;
  };

  // Hook de persistencia para el formulario principal
  const storageKey = `producto_linea_credito_${productId}`;
  const { 
    data: formData, 
    setData: setFormData,
    updateField,
    updateFields, 
    clearPersistedData 
  } = useProductoPersistence<ProductoLineaCredito>(
    storageKey,
    getInitialFormData()
  );

  // Hook para tabs activos - También persiste el tab activo
  const [activeTab, setActiveTab] = useProductoTabs(storageKey, 'default');

  // Cargar datos del producto cuando se está editando o viendo
  useEffect(() => {
    if (product && mode === 'view') {
      // En modo view, SIEMPRE sobreescribir con los datos del producto (no necesita persistencia)
      setFormData(product);
    }
    // En modo edit: NO sobreescribir, confiar en useProductoPersistence que ya cargó
    // desde sessionStorage (si hay WIP) o desde getInitialFormData() (= product)
  }, [product, mode]);

  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);

  useEffect(() => {
    if (formData.lineaProducto) {
      const line = lineProducts.find((l) => l.name === formData.lineaProducto);
      setSelectedLineId(line?.id || null);
    }
  }, [formData.lineaProducto]);

  const handleChange = (
    field: keyof ProductoLineaCredito,
    value: string | number | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (field === 'lineaProducto') {
      setFormData((prev) => ({
        ...prev,
        sublineaProducto: '',
      }));
      const line = lineProducts.find((l) => l.name === value);
      setSelectedLineId(line?.id || null);
    }
  };

  const handleSubmit = async () => {
    if (!isView) {
      // VALIDACIÓN DE CAMPOS REQUERIDOS DEL FORMULARIO "DATOS PRODUCTO"
      const requiredFieldsDatosProducto = [
        { field: 'nombre', label: 'Nombre' },
        { field: 'tipoLinea', label: 'Tipo de Línea' },
        { field: 'subTipo', label: 'Sub Tipo' },
        { field: 'vigenciaLineaDias', label: 'Vigencia de la línea (Días)' },
        { field: 'sucursal', label: 'Sucursales' },
        { field: 'numDisposicionesAbiertas', label: 'Núm. Disposiciones Abiertas' },
      ];

      // VALIDACIÓN DE CAMPOS REQUERIDOS DEL TAB "DEFAULT" - SECCIÓN CARACTERÍSTICAS
      const requiredFieldsCaracteristicas = [
        { field: 'tipoLinea', label: 'Tipo de producto (Características)' },
        { field: 'subTipo', label: 'Segmento' },
        { field: 'moneda', label: 'Moneda' },
        { field: 'vigenciaLineaDias', label: 'Plazo de la línea' },
        { field: 'formaDisposicion', label: 'Forma de disposición' },
        // renovable: excluido — booleano, siempre tiene valor (false por defecto)
        { field: 'frecuenciaRevision', label: 'Frecuencia de revisión' },
        { field: 'tipoGarantia', label: 'Garantía' },
        { field: 'destino', label: 'Destino' },
      ];

      // VALIDACIÓN DE CAMPOS REQUERIDOS DEL TAB "DEFAULT" - SECCIÓN TASAS Y COMISIONES
      const requiredFieldsTasas = [
        { field: 'tipoTasa', label: 'Tipo de tasa' },
        { field: 'baseCalculo', label: 'Base de cálculo' },
        { field: 'tasaOrdinaria', label: 'Tasa ordinaria' },
        { field: 'spread', label: 'Spread' },
        { field: 'factorMoratorio', label: 'Tasa moratoria' },
        { field: 'comisiones', label: 'Comisiones' },
        { field: 'iva', label: 'IVA' },
        // formaDevengo, metodoInteres, periodicidadIntereses: excluidos
        // — la UI siempre pre-llena estos campos con defaults del sistema
        // ('Saldo dispuesto', 'Saldo insoluto', 'Mensual')
      ];

      // Combinar todos los campos requeridos
      const allRequiredFields = [
        ...requiredFieldsDatosProducto,
        ...requiredFieldsCaracteristicas,
        ...requiredFieldsTasas
      ];

      // Agregar validaciones condicionales
      if (formData.permiteSobregiros) {
        allRequiredFields.push(
          { field: 'tipoSobregiro', label: 'Tipo de Sobregiro' },
          { field: 'montoOPorcentaje', label: 'Monto / Porcentaje' }
        );
      }

      // Filtrar campos vacíos (eliminando duplicados por campo)
      const uniqueFields = allRequiredFields.reduce((acc, current) => {
        const exists = acc.find(item => item.field === current.field);
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, [] as typeof allRequiredFields);

      const emptyFields = uniqueFields.filter(({ field }) => {
        const value = formData[field as keyof ProductoLineaCredito];
        if (value === undefined || value === null || value === '') {
          return true;
        }
        if (typeof value === 'string' && value.trim() === '') {
          return true;
        }
        if (typeof value === 'boolean') {
          return false; // Los booleanos siempre tienen valor
        }
        return false;
      });

      if (emptyFields.length > 0) {
        const fieldNames = emptyFields.map(({ label }) => label).join(', ');
        toast.error('Campos requeridos faltantes', {
          description: `Por favor complete los siguientes campos: ${fieldNames}`,
          duration: 8000,
        });
        return;
      }

      if (!formData.fechaRegistro) {
        toast.error('Error en el formulario', {
          description: 'La fecha de registro no se ha generado correctamente',
        });
        return;
      }

      // ═══════════════════════════════════════════════════════════════
      // Sincronizar con public.J_PRODUCTS (Supabase)
      // uuid es AUTOINCREMENTAL — NO se pasa desde el cliente.
      //
      // ESTRUCTURA JSON INSTITUCIONAL PARA J_PRODUCTOS.data:
      //   Nodo padre  → campos planos de Datos Generales
      //   default     → copia de los mismos campos del padre
      //   subtabs     → arrays: garantias, jerarquiaProductos, comitesCredito,
      //                 periodicidad, fases, matrizTasaFija, ivaPorcentaje,
      //                 exentoIVA, checkList, condicionesDisposicion, parametrosCalculo
      // ═══════════════════════════════════════════════════════════════
      {
        // ── A. Nodo padre: Datos Generales (campos planos) ──
        const datosGenerales: Record<string, any> = {
          localId: formData.id,
          nombreProducto: formData.nombre || '',
          claveProducto: formData.clave || '',
          descripcion: formData.descripcion || '',
          tipoProducto: formData.tipoProducto || '',
          subTipo: formData.subTipo || '',
          sucursal: formData.sucursal || '',
          nombreEquipoAnalista: formData.nombreEquipoAnalista || '',
          nombreEquipoAnalistaMesa: formData.nombreEquipoAnalistaMesa || '',
          tipoLinea: formData.tipoLinea || '',
          montoMinimo: formData.montoMinimo || '',
          montoMaximo: formData.montoMaximo || '',
          permiteSobregiros: formData.permiteSobregiros || false,
          tipoSobregiro: formData.tipoSobregiro || '',
          montoOPorcentaje: formData.montoOPorcentaje || '',
          numDisposicionesAbiertas: formData.numDisposicionesAbiertas || '',
          intervaloCleanUp: formData.intervaloCleanUp || '',
          verificacionCleanUp: formData.verificacionCleanUp || false,
          porcentajeComisionApertura: formData.porcentajeComisionApertura || '',
          plazoMinimoDisposicion: formData.plazoMinimoDisposicion || '',
          plazoMaximoDisposicion: formData.plazoMaximoDisposicion || '',
          diasGraciaDisposicion: formData.diasGraciaDisposicion || '',
          vigenciaLineaDias: formData.vigenciaLineaDias || '',
          porcentajeInteresMoratorio: formData.porcentajeInteresMoratorio || '',
          diasParaRenovacion: formData.diasParaRenovacion || '',
          lineaProducto: formData.lineaProducto || '',
          sublineaProducto: formData.sublineaProducto || '',
          fechaRegistro: formData.fechaRegistro || '',
          usuarioRegistro: formData.usuarioRegistro || '',
          puestoTrabajo: formData.puestoTrabajo || '',
          estatus: formData.estatus || 'Activo',
          moneda: formData.moneda || 'MXN',
          baseCalculo: formData.baseCalculo || '360',
          tipoTasa: formData.tipoTasa || 'Fija',
          aplicaInteresMoratorio: formData.aplicaInteresMoratorio ?? true,
          // Campos del tab Default – Características
          formaDisposicion: formData.formaDisposicion || '',
          renovable: formData.renovable ?? false,
          frecuenciaRevision: formData.frecuenciaRevision || '',
          tipoGarantia: formData.tipoGarantia || '',
          destino: formData.destino || '',
          // Campos del tab Default – Tasas y Comisiones
          tasaOrdinaria: formData.tasaOrdinaria || '',
          spread: formData.spread || '',
          factorMoratorio: formData.factorMoratorio || '',
          comisiones: formData.comisiones || '',
          iva: formData.iva || '',
          formaDevengo: formData.formaDevengo || '',
          metodoInteres: formData.metodoInteres || '',
          periodicidadIntereses: formData.periodicidadIntereses || '',
          // Datos Complementarios (Grid)
          claveIBS: formData.claveIbs || '',
          vodRowId: formData.vodRowId || '',
          opcionCompra: formData.opcionCompra || '',
          porcentajeOpcionCompra: formData.porcentajeOpcionCompra ?? '',
          tasaBase: formData.tasaBase || '',
          calculo: formData.calculo || '',
          productoSeguro: formData.productoSeg || '',
          referenciaCliente: formData.referenciaCliente || '',
          referenciaProducto: formData.referenciaProducto || '',
          rentabilidad: formData.rentabilidad ?? '',
          tasa: formData.tasa ?? '',
        };

        // ── B. Nodo default: copia del padre ──
        const defaultNode = { ...datosGenerales };
        delete defaultNode.localId; // localId no va en default

        // ── C. JSON institucional completo ──
        const jLineaCreditoData: Record<string, any> = {
          // Nodo padre (campos planos)
          ...datosGenerales,
          // Nodo default
          default: defaultNode,
          // Nodos hijos (subtabs) — nomenclatura institucional
          // Tabs con forwardRef: recoger datos vía .getData() (fuente de verdad)
          garantias: garantiasRef.current?.getData() || formData.garantias || [],
          matrizTasaFija: matrizTasaFijaRef.current?.getData() || formData.matrizTasaFija || [],
          matrizTasaVariable: matrizTasaVariableRef.current?.getData() || [],
          paquetes: paquetesRef.current?.getData() || [],
          sucursales: sucursalRef.current?.getData() || [],
          cargo: cargoRef.current?.getData() || [],
          fases: fasesRef.current?.getData() || formData.fases || [],
          comisiones: comisionesRef.current?.getData() || [],
          expedientes: expedientesRef.current?.getData() || [],
          periodosRegistros: periodos || [],
          tasasReferenciaRegistros: tasasReferencia || [],
          // Tabs sin forwardRef: datos desde formData
          jerarquiaProductos: formData.jerarquias || [],
          comitesCredito: formData.comites || [],
          periodicidad: formData.periodicidades || [],
          ivaPorcentaje: formData.ivaPorcentaje || [],
          exentoIVA: formData.exentoIva || [],
          checkList: formData.checkList || [],
          condicionesDisposicion: formData.condicionesDisposicion || [],
          parametrosCalculo: formData.parametrosCalculo || [],
          plantillas: plantillasRef.current?.getData() || [],
        };

        const existingDbUuid = product?.dbUuid || null;
        const syncResult = await syncToJProducts({
          tipo: 'ProductoLineaCredito',
          datos: jLineaCreditoData,
          label: 'Producto Línea de Crédito',
          existingId: existingDbUuid,
        });

        // Si el sync devolvió un UUID (INSERT), inyectarlo en formData para que
        // el módulo padre pueda usarlo en futuras operaciones
        if (syncResult && !existingDbUuid) {
          formData.dbUuid = syncResult;
        }
      }

      onSave(formData);
      clearPersistedData();
      // Toast se muestra desde el módulo padre (ProductosLineaCreditoModule)
    }
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

  const availableSublines = useMemo(() => {
    return selectedLineId
      ? sublineProducts.filter((sub) => sub.lineId === selectedLineId)
      : [];
  }, [selectedLineId]);

  // === REFS para tabs maestro-detalle del módulo Crédito (forwardRef + getData) ===
  const matrizTasaFijaRef = useRef<{ getData: () => any[] }>(null);
  const matrizTasaVariableRef = useRef<{ getData: () => any[] }>(null);
  const paquetesRef = useRef<{ getData: () => any[] }>(null);
  const sucursalRef = useRef<{ getData: () => any[] }>(null);
  const cargoRef = useRef<{ getData: () => any[] }>(null);
  const fasesRef = useRef<{ getData: () => any[] }>(null);
  const garantiasRef = useRef<{ getData: () => any[] }>(null);
  const comisionesRef = useRef<{ getData: () => any[] }>(null);
  const expedientesRef = useRef<{ getData: () => any[] }>(null);
  const plantillasRef = useRef<{ getData: () => any[] }>(null);

  // Estado para Tasa Referencia (requerido por MatrizTasaVariableTab)
  interface TasaReferenciaItem {
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
  } = useProductoPersistence<TasaReferenciaItem[]>(
    tasasStorageKey,
    // FIX: Sin registros automáticos. Al editar, datos vienen de BD vía product?.tasasReferenciaRegistros
    Array.isArray(product?.tasasReferenciaRegistros) && product.tasasReferenciaRegistros.length > 0
      ? product.tasasReferenciaRegistros
      : []
  );

  // Estado para Periodos (homologado de Productos Crédito)
  interface PeriodoItemLC {
    id: number;
    periodoId: number;
    descripcion: string;
    dias: number;
  }
  const periodosStorageKey = `${storageKey}_periodos`;
  const {
    data: periodos,
    setData: setPeriodos,
  } = useProductoPersistence<PeriodoItemLC[]>(
    periodosStorageKey,
    // FIX: Sin registros automáticos. Al editar, datos vienen de BD vía product?.periodosRegistros
    Array.isArray(product?.periodosRegistros) && product.periodosRegistros.length > 0
      ? product.periodosRegistros
      : []
  );

  const [periodosActionTab, setPeriodosActionTab] = useState<'nuevo' | 'eliminar' | null>(null);
  const [selectedPeriodoId, setSelectedPeriodoId] = useState<number | null>(null);
  const [selectedPeriodoDescripcion, setSelectedPeriodoDescripcion] = useState('');
  const [selectedPeriodoDias, setSelectedPeriodoDias] = useState<number | ''>('');
  const [showDeletePeriodoModal, setShowDeletePeriodoModal] = useState(false);
  const [periodoToDelete, setPeriodoToDelete] = useState<number | null>(null);

  const handleAddPeriodo = () => {
    if (!selectedPeriodoId) {
      toast.error('Debe seleccionar un período');
      return;
    }
    const periodoExiste = periodos.some((p: any) => p.periodoId === selectedPeriodoId);
    if (periodoExiste) {
      toast.error('Este período ya ha sido agregado');
      return;
    }
    const diasValue = typeof selectedPeriodoDias === 'number'
      ? selectedPeriodoDias
      : K_PERIODS.find(p => p.id === selectedPeriodoId)?.dias || 0;

    const newPeriodo: PeriodoItemLC = {
      id: periodos.length > 0 ? Math.max(...periodos.map((p: any) => p.id), 0) + 1 : 1,
      periodoId: selectedPeriodoId,
      descripcion: selectedPeriodoDescripcion,
      dias: diasValue,
    };
    setPeriodos((prev: any) => [...prev, newPeriodo]);
    toast.success('Período agregado exitosamente');
    setSelectedPeriodoId(null);
    setSelectedPeriodoDescripcion('');
    setSelectedPeriodoDias('');
    setPeriodosActionTab(null);
  };

  const handleDeletePeriodoRequest = (id: number) => {
    setPeriodoToDelete(id);
    setShowDeletePeriodoModal(true);
  };

  const confirmDeletePeriodo = () => {
    if (periodoToDelete !== null) {
      setPeriodos((prev: any) => prev.filter((p: any) => p.id !== periodoToDelete));
      toast.success('Período eliminado exitosamente');
      setShowDeletePeriodoModal(false);
      setPeriodoToDelete(null);
    }
  };

  const tabs = [
    { id: 'default', label: 'Default' },
    // === Tabs homologados desde Producto Crédito (orden idéntico) ===
    { id: 'periodos', label: 'Periodos' },
    { id: 'matriz-tasa-fija', label: 'Matriz Tasa Fija' },
    { id: 'tasa-referencia', label: 'Tasas de Referencia' },
    { id: 'matriz-tasa-variable', label: 'Matriz Tasa Variable' },
    { id: 'fases', label: 'Fases' },
    { id: 'expedientes', label: 'Requisitos OK' },
    { id: 'cargo', label: 'Cargos' },
    { id: 'comisiones', label: 'Comisiones' },
    // === Tabs específicos de Línea de Crédito (mantener sin cambios) ===
    { id: 'comites', label: 'Comité de Crédito' },
    { id: 'condiciones-disposicion', label: 'Condiciones de Disposiciones' },
    { id: 'productos-disposicion', label: 'Productos Disposición' },
    { id: 'parametros-calculo', label: 'Parámetro de Cálculo' },
    { id: 'sucursal', label: 'Sucursal' },
    { id: 'garantias', label: 'Garantías' },
    // === Tabs adicionales ===
    { id: 'checkList', label: 'Check List' },
    { id: 'plantillas', label: 'Plantillas' },
  ];

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
              {mode === 'create' ? 'Alta Productos Línea de Crédito' : mode === 'edit' ? 'Editar Producto Línea de Crédito' : 'Consultar Producto Línea de Crédito'}
            </h2>
            {isView && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Modo Consulta
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
            onClick={onCancel}
            className="px-5 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700"
          >
            {isView ? 'Volver' : 'Cancelar'}
          </button>
        </div>
      </div>

      {/* ═══ Banner Modo Consulta + campos físicos type / id (UUID) ═══ */}
      {isView && (
        <div className="px-6 py-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-6 text-xs text-gray-700">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-gray-500">TYPE (J_PRODUCTOS):</span>
              <span className="font-semibold text-gray-800">ProductoLineaCredito</span>
            </div>
            {product?.dbUuid && (
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-gray-500">ID (UUID):</span>
                <span className="font-mono text-[11px] text-gray-800 bg-white px-1.5 py-0.5 rounded border border-gray-200">{product.dbUuid}</span>
              </div>
            )}
          </div>
          <span className="text-[10px] text-blue-600 italic">Solo lectura — No se permite modificación</span>
        </div>
      )}

      {/* Form Content */}
      <div className="p-[0px]">
        <div className="bg-white border border-gray-300">
          {/* Datos Producto - Siempre visible */}
          <div className="p-4 border-b border-gray-300">
            <div className="bg-[#D9E2F3] px-3 py-1.5 mb-3 text-sm font-medium text-gray-800 border-l-4 border-[#4A6FA5]">
              Datos Producto
            </div>
            
            <ProductoLineaCreditoFormDatosProducto
              formData={formData}
              mode={mode}
              handleChange={handleChange}
            />
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
                <ProductoLineaCreditoFormDefaultTab
                  formData={formData}
                  mode={mode}
                  handleChange={handleChange}
                />
              </div>
            )}

            {activeTab === 'comites' && (
              <div>
                <ComitesCreditoLineaCreditoTab
                  mode={mode}
                  comites={formData.comites || []}
                  onComitesChange={(comites: ComiteCreditoLineaCredito[]) => {
                    setFormData(prev => ({ ...prev, comites }));
                  }}
                />
              </div>
            )}

            {activeTab === 'checkList' && (
              <div>
                <CheckListLineaCreditoTab
                  mode={mode}
                  checkList={formData.checkList || []}
                  onCheckListChange={(checkList: CheckListLineaCredito[]) => {
                    setFormData(prev => ({ ...prev, checkList }));
                  }}
                />
              </div>
            )}

            {activeTab === 'condiciones-disposicion' && (
              <div>
                <div className="bg-[#E8E8E8] px-3 py-1.5 mb-3 text-xs font-medium text-gray-700">
                  CONDICIONES DE DISPOSICIÓN — Reglas y límites para disposiciones de la línea
                </div>
                <div className="border border-gray-300">
                  <table className="w-full text-xs">
                    <thead className="bg-[#E8E8E8]">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">ID</th>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Tipo de Disposición</th>
                        <th className="text-right px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Monto Mínimo</th>
                        <th className="text-right px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Monto Máximo</th>
                        <th className="text-center px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Plazo (días)</th>
                        <th className="text-center px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">% Comisión</th>
                        <th className="text-center px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Req. Autorización</th>
                        <th className="text-center px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Activo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { id: 1, tipo: 'Pagaré Simple', min: '$50,000.00', max: '$5,000,000.00', plazo: '30-360', com: '0.50', req: false, act: true },
                        { id: 2, tipo: 'Carta de Crédito Doméstica', min: '$100,000.00', max: '$10,000,000.00', plazo: '90-180', com: '1.00', req: true, act: true },
                        { id: 3, tipo: 'Línea de Descuento', min: '$25,000.00', max: '$3,000,000.00', plazo: '30-90', com: '0.25', req: false, act: true },
                        { id: 4, tipo: 'Crédito Revolvente', min: '$10,000.00', max: 'Límite de línea', plazo: '1-360', com: '0.00', req: false, act: true },
                        { id: 5, tipo: 'Sobregiro Autorizado', min: '$1,000.00', max: '10% de línea', plazo: '1-30', com: '0.75', req: true, act: true },
                        { id: 6, tipo: 'Carta de Crédito Internacional', min: '$500,000.00', max: '$25,000,000.00', plazo: '60-360', com: '1.50', req: true, act: false },
                      ].map((row, i) => (
                        <tr key={row.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                          <td className="px-3 py-1.5 border-b border-gray-200">{row.id}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 font-medium">{row.tipo}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 text-right">{row.min}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 text-right">{row.max}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 text-center">{row.plazo}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 text-center">{row.com}%</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 text-center">{row.req ? '✓' : '—'}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 text-center"><span className={`px-2 py-0.5 rounded text-[10px] ${row.act ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>{row.act ? 'Activo' : 'Inactivo'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'parametros-calculo' && (
              <div>
                <div className="bg-[#E8E8E8] px-3 py-1.5 mb-3 text-xs font-medium text-gray-700">
                  PARÁMETROS DE CÁLCULO — Variables para determinación de monto y condiciones de línea
                </div>
                <div className="border border-gray-300">
                  <table className="w-full text-xs">
                    <thead className="bg-[#E8E8E8]">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Clave</th>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Parámetro</th>
                        <th className="text-center px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Valor</th>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Tipo</th>
                        <th className="text-left px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Descripción</th>
                        <th className="text-center px-3 py-1.5 font-medium text-gray-700 border-b border-gray-300">Obligatorio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { clave: 'PC-001', param: 'Factor de Aforo', valor: '1.30', tipo: 'Multiplicador', desc: 'Relación valor garantía vs monto de línea (colateral/línea)', obligatorio: true },
                        { clave: 'PC-002', param: 'Cobertura de Servicio de Deuda', valor: '1.20', tipo: 'Ratio', desc: 'Flujo libre / servicio de deuda total del acreditado', obligatorio: true },
                        { clave: 'PC-003', param: 'Capital de Trabajo Neto', valor: '15.00', tipo: 'Porcentaje', desc: '% de ventas anuales para determinar necesidad de línea', obligatorio: true },
                        { clave: 'PC-004', param: 'Límite de Concentración', valor: '10.00', tipo: 'Porcentaje', desc: '% máximo del capital contable como exposición individual', obligatorio: true },
                        { clave: 'PC-005', param: 'Factor de Riesgo Sectorial', valor: '1.00', tipo: 'Multiplicador', desc: 'Ajuste por nivel de riesgo del sector económico', obligatorio: false },
                        { clave: 'PC-006', param: 'Antigüedad Mínima Empresa', valor: '24', tipo: 'Meses', desc: 'Tiempo mínimo de operación del acreditado', obligatorio: true },
                        { clave: 'PC-007', param: 'Score Mínimo Buró', valor: '650', tipo: 'Puntos', desc: 'Puntuación mínima de Buró de Crédito aceptable', obligatorio: true },
                        { clave: 'PC-008', param: 'Razón de Apalancamiento Máximo', valor: '3.50', tipo: 'Ratio', desc: 'Pasivo total / Capital contable máximo permitido', obligatorio: true },
                        { clave: 'PC-009', param: 'Margen Operativo Mínimo', valor: '8.00', tipo: 'Porcentaje', desc: 'Utilidad operativa / ventas netas mínimo requerido', obligatorio: false },
                        { clave: 'PC-010', param: 'Reserva Preventiva', valor: '2.50', tipo: 'Porcentaje', desc: '% de provisión sobre saldo dispuesto por calificación', obligatorio: true },
                      ].map((row, i) => (
                        <tr key={row.clave} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                          <td className="px-3 py-1.5 border-b border-gray-200 font-medium text-blue-700">{row.clave}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 font-medium">{row.param}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 text-center">{row.valor}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200"><span className="px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200">{row.tipo}</span></td>
                          <td className="px-3 py-1.5 border-b border-gray-200">{row.desc}</td>
                          <td className="px-3 py-1.5 border-b border-gray-200 text-center">{row.obligatorio ? <span className="text-red-600">Sí</span> : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═══ Tabs reutilizados del módulo Producto Crédito ═══ */}

            {activeTab === 'periodos' && (
              <div>
                {/* Header PERIODOS con botones de acción */}
                <div className="section-header-theme px-4 py-2 mb-4 flex items-center justify-between rounded-t">
                  <span className="text-xs font-semibold tracking-wide uppercase">Periodos</span>
                  {!isView && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setPeriodosActionTab('nuevo')} className="px-4 py-1 rounded text-xs font-medium transition-colors bg-white/20 text-white hover:bg-white/30">+ Nuevo</button>
                      <button onClick={() => setPeriodosActionTab(periodosActionTab === 'eliminar' ? null : 'eliminar')} className={`px-4 py-1 rounded text-xs font-medium transition-colors ${periodosActionTab === 'eliminar' ? 'bg-white text-red-600 font-semibold shadow-sm' : 'bg-white/20 text-white hover:bg-white/30'}`}>Eliminar</button>
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
                        <button onClick={() => setPeriodosActionTab(null)} className="text-white/80 hover:text-white hover:bg-white/20 rounded-full w-6 h-6 flex items-center justify-center transition-colors" title="Cerrar">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
                        </button>
                      </div>
                      <div className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Periodo</label>
                            <select value={selectedPeriodoId || ''} onChange={(e) => { const pid = parseInt(e.target.value); const p = K_PERIODS.find(pp => pp.id === pid); setSelectedPeriodoId(pid); setSelectedPeriodoDescripcion(p?.descripcion || ''); setSelectedPeriodoDias(p?.dias || ''); }} className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors">
                              <option value="">Seleccione...</option>
                              {K_PERIODS.map((periodo) => (<option key={periodo.id} value={periodo.id}>{periodo.descripcion}</option>))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Núm. Días</label>
                            <input type="number" min="1" value={selectedPeriodoDias} onChange={(e) => setSelectedPeriodoDias(e.target.value ? parseInt(e.target.value) : '')} placeholder="0" className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white focus:border-primary-theme focus:ring-1 ring-primary-theme outline-none transition-colors" />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setPeriodosActionTab(null)} className="px-4 py-1.5 rounded text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors">Cancelar</button>
                          <button onClick={handleAddPeriodo} className="px-5 py-1.5 btn-accent-theme rounded text-xs hover:bg-accent-hover-theme font-medium transition-colors shadow-sm">Agregar Periodo</button>
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
                          <th className="text-center px-3 py-2 font-semibold text-white/90 text-[11px] uppercase tracking-wide w-20">Acciones</th>
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
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300"><path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              <span>No hay períodos agregados</span>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        periodos.map((periodo: any, idx: number) => (
                          <tr key={periodo.id} className={`row-hover-theme transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}`}>
                            {periodosActionTab === 'eliminar' && !isView && (
                              <td className="text-center px-3 py-1.5 border-b border-gray-200">
                                <button onClick={() => handleDeletePeriodoRequest(periodo.id)} className="inline-flex items-center justify-center w-6 h-6 rounded-full text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors" title="Eliminar período">
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>
                                </button>
                              </td>
                            )}
                            <td className="px-3 py-1.5 border-b border-gray-200 font-medium text-gray-700">{K_PERIODS.find(p => p.id === periodo.periodoId)?.descripcion || periodo.descripcion || ''}</td>
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

                {/* Modal confirmación eliminación periodo */}
                {showDeletePeriodoModal && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-white rounded-lg shadow-2xl w-[440px] mx-4 overflow-hidden">
                      <div className="modal-header-theme px-5 py-3"><h3 className="text-sm font-semibold text-white">Confirmar Eliminación</h3></div>
                      <div className="px-6 py-6 flex items-start gap-3">
                        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800 mb-1">¿Eliminar este período?</p>
                          <p className="text-xs text-gray-500">El período será removido de la configuración del producto.</p>
                        </div>
                      </div>
                      <div className="bg-gray-50 px-6 py-3 flex justify-end gap-2.5 border-t border-gray-200">
                        <button onClick={() => { setShowDeletePeriodoModal(false); setPeriodoToDelete(null); }} className="px-5 py-1.5 text-xs bg-white border border-gray-300 rounded text-gray-600 hover:bg-gray-50 font-medium transition-colors">Cancelar</button>
                        <button onClick={confirmDeletePeriodo} className="px-5 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 font-medium transition-colors shadow-sm">Sí, Eliminar</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tasa-referencia' && (
              <div>
                <TasaReferenciaTab mode={mode} productId={productId as number} tasasReferencia={tasasReferencia} setTasasReferencia={setTasasReferencia} />
              </div>
            )}

            {/* Tabs con forwardRef + persistToStorage: montados siempre con style display */}
            <div style={{ display: activeTab === 'matriz-tasa-fija' ? 'block' : 'none' }}>
              <MatrizTasaFijaTab ref={matrizTasaFijaRef} mode={mode} productId={productId} periodos={periodos} initialData={product?.matrizTasaFija} persistToStorage storagePrefix="linea_credito" />
            </div>

            <div style={{ display: activeTab === 'matriz-tasa-variable' ? 'block' : 'none' }}>
              <MatrizTasaVariableTab ref={matrizTasaVariableRef} mode={mode} productId={productId} tasasReferencia={tasasReferencia} periodos={periodos} initialData={product?.matrizTasaVariable} persistToStorage storagePrefix="linea_credito" />
            </div>

            <div style={{ display: activeTab === 'productos-disposicion' ? 'block' : 'none' }}>
              <PaquetesTab ref={paquetesRef} mode={mode} productId={productId} initialData={product?.paquetes} persistToStorage storagePrefix="linea_credito" />
            </div>

            <div style={{ display: activeTab === 'sucursal' ? 'block' : 'none' }}>
              <SucursalTab ref={sucursalRef} mode={mode} productId={productId} initialData={product?.sucursales} persistToStorage storagePrefix="linea_credito" />
            </div>

            <div style={{ display: activeTab === 'fases' ? 'block' : 'none' }}>
              <FasesTab ref={fasesRef} mode={mode} productId={productId} initialData={product?.fases} persistToStorage storagePrefix="linea_credito" />
            </div>

            <div style={{ display: activeTab === 'garantias' ? 'block' : 'none' }}>
              <GarantiaTab ref={garantiasRef} mode={mode} productId={productId} initialData={product?.garantias} persistToStorage storagePrefix="linea_credito" />
            </div>

            <div style={{ display: activeTab === 'comisiones' ? 'block' : 'none' }}>
              <ComisionesTab
                ref={comisionesRef}
                mode={mode}
                productId={productId}
                initialData={product?.comisiones}
                persistToStorage
                storagePrefix="linea_credito"
              />
            </div>

            <div style={{ display: activeTab === 'cargo' ? 'block' : 'none' }}>
              <CargoTab
                ref={cargoRef}
                mode={mode}
                productId={productId}
                lineaProducto={formData.lineaProducto}
                sublinea={formData.sublineaProducto}
                initialData={product?.cargos}
                persistToStorage
                storagePrefix="linea_credito"
              />
            </div>

            <div style={{ display: activeTab === 'expedientes' ? 'block' : 'none' }}>
              <ExpedientesProductoTab
                ref={expedientesRef}
                mode={mode}
                productId={productId}
                persistToStorage
                storagePrefix="linea_credito"
                initialData={product?.expedientes}
                fases={product?.fases}
              />
            </div>

            <div style={{ display: activeTab === 'plantillas' ? 'block' : 'none' }}>
              <PlantillasTab
                ref={plantillasRef}
                mode={mode}
                productId={productId}
                persistToStorage
                storagePrefix="linea_credito"
                initialData={Array.isArray((product as any)?.plantillas) ? (product as any).plantillas : undefined}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}