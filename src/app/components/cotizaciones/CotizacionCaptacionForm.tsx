/**
 * CotizacionCaptacionForm.tsx  v3.0
 *
 * Formulario institucional de Cotización → Captación
 * Alta / Editar / Ver con subtabs:
 *   • Datos Generales (padre)
 *   • Calendario de Aportaciones (subtab, spec §7)
 *
 * v3.0:
 *   - Conectado a useClientesDB (real) para picker de Prospectos/Clientes
 *   - Conectado a useProductosCaptacionDB (real) para picker de Productos
 *   - Fallback a mock si hooks no retornan datos
 *
 * Campos alineados con spec:
 *   data.tasaMinInteres, data.plazoCumplirMontoMinimo, data.periodoCumplirMontoMinimo
 *
 * Validaciones institucionales — spec §4, §6, §9
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, X, Building2, AlertTriangle, Lock, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { format, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import type {
  CotizacionCaptacion,
  CotizacionCaptacionData,
} from './cotizacionCaptacionTypes';
import {
  generarNoCotiza,
  calcularIntereses,
  generarCalendario,
  crearCotizacionVacia,
  validarCotizacionCaptacion,
  FRECUENCIAS,
  computePartialData,
} from './cotizacionCaptacionTypes';
import { useClientesDB } from '../../hooks/useClientesDB';
import { useProductosCaptacionDB } from '../../hooks/useProductosCaptacionDB';

type FormMode = 'create' | 'edit' | 'view';

interface Props {
  mode: FormMode;
  cotizacion?: CotizacionCaptacion;
  onSave: (c: CotizacionCaptacion) => void;
  onBack: () => void;
  /** Callback para crear Solicitud desde esta Cotización — spec solicitudes-financieras §1 */
  onCrearSolicitud?: (c: CotizacionCaptacion) => void;
}

// ── Fallback mock clientes (se usa si useClientesDB retorna vacío) ──
const MOCK_CLIENTES_FALLBACK = [
  { id: 'CL-001', idCliente: 'CLI-10001', nombre: 'María', apellidoPaterno: 'García', apellidoMaterno: 'López' },
  { id: 'CL-002', idCliente: 'CLI-10002', nombre: 'Roberto', apellidoPaterno: 'Hernández', apellidoMaterno: 'Martínez' },
  { id: 'CL-003', idCliente: 'CLI-10003', nombre: 'Constructora del Valle', apellidoPaterno: 'SA de CV', apellidoMaterno: '' },
  { id: 'CL-004', idCliente: 'CLI-10004', nombre: 'Laura', apellidoPaterno: 'Sánchez', apellidoMaterno: 'Ramírez' },
  { id: 'CL-005', idCliente: 'CLI-10005', nombre: 'Fernando', apellidoPaterno: 'Torres', apellidoMaterno: 'Ávila' },
];

// ── Fallback mock productos (se usa si useProductosCaptacionDB retorna vacío) ──
const MOCK_PRODUCTOS_FALLBACK: ProductoPickerItem[] = [
  { id: 'P-001', claveProducto: 'PCAP-001', nombreProducto: 'Ahorro Voluntario', tipoProducto: 'Ahorro', montoMinimo: 5000, periodoCumplirMontoMinimo: 'Mensual', plazoCumplirMontoMinimo: 12, tasaMinInteres: 4.5, matrizTasaFija: [] },
  { id: 'P-002', claveProducto: 'PCAP-002', nombreProducto: 'Aportación Navideña', tipoProducto: 'Aportación', montoMinimo: 10000, periodoCumplirMontoMinimo: 'Quincenal', plazoCumplirMontoMinimo: 24, tasaMinInteres: 5.2, matrizTasaFija: [] },
  { id: 'P-003', claveProducto: 'PCAP-003', nombreProducto: 'Ahorro Infantil', tipoProducto: 'Ahorro', montoMinimo: 1000, periodoCumplirMontoMinimo: 'Semanal', plazoCumplirMontoMinimo: 52, tasaMinInteres: 3.8, matrizTasaFija: [] },
  { id: 'P-004', claveProducto: 'PCAP-004', nombreProducto: 'Aportación Escolar', tipoProducto: 'Aportación', montoMinimo: 25000, periodoCumplirMontoMinimo: 'Catorcenal', plazoCumplirMontoMinimo: 16, tasaMinInteres: 6.0, matrizTasaFija: [] },
  { id: 'P-005', claveProducto: 'PCAP-005', nombreProducto: 'Ahorro a Plazo Fijo', tipoProducto: 'Ahorro', montoMinimo: 50000, periodoCumplirMontoMinimo: 'Mensual', plazoCumplirMontoMinimo: 6, tasaMinInteres: 8.5, matrizTasaFija: [] },
];

/** Normaliza un ClienteDB a la interfaz interna del picker */
interface ClientePickerItem {
  id: string;
  idCliente: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  institucionGobierno?: string;
}

/** Normaliza un Product a la interfaz interna del picker de productos */
interface ProductoPickerItem {
  id: string;
  claveProducto: string;
  nombreProducto: string;
  tipoProducto: string;
  montoMinimo: number;
  periodoCumplirMontoMinimo: string;
  plazoCumplirMontoMinimo: number;
  tasaMinInteres: number;
  matrizTasaFija: MatrizTasaFijaRow[];
  periodosRegistros: Array<{ id: number; periodoId: number; descripcion: string; dias?: number }>;
}

/** Fila de la Matriz de Tasa Fija del producto */
interface MatrizTasaFijaRow {
  id?: number;
  periodo?: string;
  plazoMinimo: number;
  plazoMaximo: number;
  plazoDefault?: number;
  montoMinimo: number;
  montoMaximo: number;
  montoDefault?: number;
  tasaMinima: string;
  tasaMaxima: string;
  tasaDefault: string;
}

const formatMoney = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

const formatDateCalendar = (dateStr: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${d.getDate().toString().padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
};

export function CotizacionCaptacionForm({ mode, cotizacion, onSave, onBack, onCrearSolicitud }: Props) {
  const isView = mode === 'view';
  const isCreate = mode === 'create';

  // ══════════════════════════════════════════════════════════════
  // HOOKS REALES — Clientes y Productos desde Supabase
  // ══════════════════════════════════════════════════════════════
  const { clientes: clientesDB, loading: loadingClientes } = useClientesDB(true);
  const { productos: productosDB, loading: loadingProductos } = useProductosCaptacionDB(true);

  // ── Normalizar clientes de useClientesDB → ClientePickerItem ──
  const clientePickerItems: ClientePickerItem[] = useMemo(() => {
    if (clientesDB.length > 0) {
      return clientesDB.map(c => ({
        id: c.dbUuid,
        idCliente: c.idCliente,
        nombre: c.nombre,
        apellidoPaterno: c.apellidoPaterno,
        apellidoMaterno: c.apellidoMaterno,
        institucionGobierno: c._rawData?.institucionGobierno || '',
      }));
    }
    return MOCK_CLIENTES_FALLBACK;
  }, [clientesDB]);

  // ── Normalizar productos de useProductosCaptacionDB → ProductoPickerItem ──
  const productoPickerItems: ProductoPickerItem[] = useMemo(() => {
    if (productosDB.length > 0) {
      return productosDB
        .filter(p => (p.lineaProducto || '').toLowerCase().includes('captación') || (p.lineaProducto || '').toLowerCase().includes('captacion'))
        .map(p => ({
          id: p.dbUuid || p.identificacion?.toString() || String(p.id),
          claveProducto: p.clave?.toString() || (p as any).claveProducto || '',
          nombreProducto: p.nombre || p.producto || '',
          tipoProducto: p.tipoProducto || '',
          montoMinimo: typeof p.montoMinimo === 'number' ? p.montoMinimo : parseFloat(String(p.montoMinimo)) || 0,
          periodoCumplirMontoMinimo: (p as any).frecuenciaPagoIntereses
            || (Array.isArray((p as any).periodosRegistros) && (p as any).periodosRegistros[0]?.descripcion)
            || (p as any).periodoCorte
            || 'Mensual',
          plazoCumplirMontoMinimo: parseInt(String((p as any).plazo)) || 12,
          tasaMinInteres: parseFloat(String((p as any).tasaMinima || (p as any).tasaInicial)) || 0,
          matrizTasaFija: extractMatrizTasaFija(p),
          periodosRegistros: Array.isArray((p as any).periodosRegistros) ? (p as any).periodosRegistros : [],
        }));
    }
    return MOCK_PRODUCTOS_FALLBACK;
  }, [productosDB]);

  // ── State ──
  const [activeTab, setActiveTab] = useState<'datos-generales' | 'calendario-aportaciones'>('datos-generales');
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // ── Cerrar datepicker al clic fuera ──
  useEffect(() => {
    if (!showDatePicker) return;
    const handler = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDatePicker]);

  const [form, setForm] = useState<CotizacionCaptacion>(() => {
    if (cotizacion) return JSON.parse(JSON.stringify(cotizacion));
    return { ...crearCotizacionVacia(generarNoCotiza()), id: crypto.randomUUID() };
  });

  // ═══════════════════════════════════════════════════════════════
  // EDIT MODE — Tracking original data para Deep Merge
  // Spec cotizacion-edit-logic.md §1–§5
  // Se almacena una copia inmutable de los datos originales
  // para computar el JSON parcial (diff) al guardar.
  // ═══════════════════════════════════════════════════════════════
  const originalDataRef = useRef<CotizacionCaptacionData | null>(
    cotizacion ? JSON.parse(JSON.stringify(cotizacion.data)) : null
  );

  // Número de campos modificados (para indicador visual)
  const changedFieldCount = useMemo(() => {
    if (!originalDataRef.current || mode !== 'edit') return 0;
    const partial = computePartialData(originalDataRef.current, form.data);
    return Object.keys(partial).length;
  }, [form.data, mode]);

  const data = form.data;

  // ── Periodos disponibles para el dropdown (desde el producto seleccionado) ──
  // Usa periodosRegistros del producto; fallback a FRECUENCIAS si no están configurados
  const periodosDropdown = useMemo((): string[] => {
    const prod = productoPickerItems.find(p => p.id === form.producto_id);
    if (prod?.periodosRegistros?.length > 0) {
      return prod.periodosRegistros.map(p => p.descripcion).filter(Boolean);
    }
    return FRECUENCIAS.map(f => f.label);
  }, [form.producto_id, productoPickerItems]);

  // ── Helpers para actualizar ──
  const setData = useCallback((partial: Partial<CotizacionCaptacionData>) => {
    setForm(prev => ({ ...prev, data: { ...prev.data, ...partial } }));
  }, []);

  const setProducto = useCallback((partial: Partial<CotizacionCaptacionData['producto']>) => {
    setForm(prev => ({
      ...prev,
      data: { ...prev.data, producto: { ...prev.data.producto, ...partial } },
    }));
  }, []);

  // ── Recálculo automático de intereses — spec §5 ──
  // InteresesGenerados = MontoCotizado × (TasaInicial / 360) × FrecuenciaCapitalizaIntereses
  useEffect(() => {
    const interes = calcularIntereses(
      data.montoCotizado,
      data.tasaMinInteres,
      data.frecuenciaCapitalizacion
    );
    if (Math.abs(interes - data.interesGeneradoPeriodo) > 0.001) {
      setData({ interesGeneradoPeriodo: Math.round(interes * 100) / 100 });
    }
  }, [data.montoCotizado, data.tasaMinInteres, data.frecuenciaCapitalizacion]);

  // ── Regenerar calendario — spec §7 ──
  const calendario = useMemo(() => {
    if (data.plazoCumplirMontoMinimo > 0 && data.fechaPrimeraAportacion && data.montoCotizado > 0) {
      return generarCalendario(
        data.montoCotizado,
        data.plazoCumplirMontoMinimo,
        data.fechaPrimeraAportacion,
        data.periodoCumplirMontoMinimo || data.frecuenciaCapitalizacion
      );
    }
    return [];
  }, [data.montoCotizado, data.plazoCumplirMontoMinimo, data.fechaPrimeraAportacion, data.periodoCumplirMontoMinimo, data.frecuenciaCapitalizacion]);

  // ── Sync calendario al data ──
  useEffect(() => {
    setData({ calendarioAportaciones: calendario });
  }, [calendario]);

  // ── Producto selection handler — spec §3.5 + §4 ──
  const handleSelectProducto = (prod: ProductoPickerItem) => {
    setProducto({
      claveProducto: prod.claveProducto,
      nombreProducto: prod.nombreProducto,
      tipoProducto: prod.tipoProducto,
      montoMinimo: prod.montoMinimo,
      periodoCumplirMontoMinimo: prod.periodoCumplirMontoMinimo,
      plazoCumplirMontoMinimo: prod.plazoCumplirMontoMinimo,
    });
    setForm(prev => ({ ...prev, producto_id: prod.id }));

    const tipo = prod.tipoProducto.toLowerCase();

    // Reset inversión state when product changes
    setSelectedPlazoIdx(-1);

    if (tipo === 'inversión' || tipo === 'inversion') {
      // Inversión: set monto mínimo, reset tasa (will be set from matriz)
      setData({
        montoCotizado: prod.montoMinimo || 0,
        plazoCumplirMontoMinimo: 0,
        tasaMinInteres: 0,
        periodoCumplirMontoMinimo: '',
        frecuenciaCapitalizacion: prod.periodoCumplirMontoMinimo || 'Mensual',
      });
    } else if (tipo === 'ahorro' || tipo === 'aportación') {
      // Pick map para Ahorro/Aportación — spec §4
      setData({
        montoCotizado: prod.montoMinimo,
        plazoCumplirMontoMinimo: prod.plazoCumplirMontoMinimo,
        periodoCumplirMontoMinimo: prod.periodoCumplirMontoMinimo,
        tasaMinInteres: prod.tasaMinInteres,
        frecuenciaCapitalizacion: prod.periodoCumplirMontoMinimo,
      });
    }
  };

  // ── Cliente selection handler — spec §3.3 ──
  const handleSelectCliente = (cl: ClientePickerItem) => {
    const nombreCompleto = [cl.nombre, cl.apellidoPaterno, cl.apellidoMaterno].filter(Boolean).join(' ');
    setData({
      cliente: { claveCliente: cl.idCliente, nombreCompleto },
      institucionGobierno: cl.institucionGobierno || '',
    });
    setForm(prev => ({ ...prev, cliente_id: cl.id }));

    setShowClienteModal(false);
  };

  // ── Submit con validaciones — spec §9 + inversión ──
  const handleSubmit = () => {
    const errors: string[] = [];

    // Inversión-specific validations
    if (isInversion) {
      const montoCotNum = normalizeNum(data.montoCotizado);
      const montoMinNum = normalizeNum(data.producto.montoMinimo);
      // Solo validar si AMBOS son válidos, mayores a 0, y cotizado < mínimo
      if (montoCotNum !== null && montoCotNum > 0 && montoMinNum !== null && montoMinNum > 0 && montoCotNum < montoMinNum) {
        errors.push(`Monto cotizado (${formatMoney(montoCotNum)}) es menor al monto mínimo del producto (${formatMoney(montoMinNum)})`);
      }
      if (matrizTasaFija.length > 0 && selectedPlazoIdx < 0) {
        errors.push('Debe seleccionar un plazo de la Matriz de Tasa Fija');
      }
      if (selectedPlazoIdx >= 0 && !matchedMatrizRow && data.montoCotizado > 0) {
        errors.push('El monto capturado no corresponde a un rango válido en la fila de la matriz seleccionada');
      }
    }

    const result = validarCotizacionCaptacion(form);
    if (!result.valid) {
      errors.push(...result.errors);
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      toast.error('Errores de validación', { description: `${errors.length} error(es) encontrado(s)` });
      return;
    }
    setValidationErrors([]);
    onSave(form);
  };

  // ── Field classes ──
  const fieldClass = isView
    ? 'w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded text-gray-700'
    : 'w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  const readonlyClass = 'w-full px-3 py-2 text-xs bg-gray-100 border border-gray-200 rounded text-gray-500';

  // ── Tabs definition ──
  const tabs = [
    { id: 'datos-generales' as const, label: 'Datos Generales' },
    { id: 'calendario-aportaciones' as const, label: 'Calendario de Aportaciones' },
  ];

  const filteredClientes = clientePickerItems.filter(cl => {
    const s = clienteSearch.toLowerCase();
    const full = [cl.idCliente, cl.nombre, cl.apellidoPaterno, cl.apellidoMaterno].join(' ').toLowerCase();
    return full.includes(s);
  });

  const totalCalendario = calendario.reduce((s, a) => s + a.monto, 0);

  // Is Ahorro/Aportación?
  const isAhorroAportacion = ['ahorro', 'aportación'].includes(data.producto.tipoProducto.toLowerCase());

  // ══════════════════════════════════════════════════════════════
  // INVERSIÓN — Spec cotizacion-inversion-validation §1–§7
  // ══════════════════════════════════════════════════════════════
  const isInversion = data.producto.tipoProducto.toLowerCase() === 'inversión' || data.producto.tipoProducto.toLowerCase() === 'inversion';

  // Current selected product (full picker item with matrizTasaFija)
  const selectedProducto = useMemo(() => {
    if (!data.producto.claveProducto) return undefined;
    return productoPickerItems.find(p => p.claveProducto === data.producto.claveProducto);
  }, [data.producto.claveProducto, productoPickerItems]);

  const matrizTasaFija = selectedProducto?.matrizTasaFija || [];

  // State: selected plazo row index for inversión
  const [selectedPlazoIdx, setSelectedPlazoIdx] = useState<number>(-1);

  // Unique plazo options from matriz (for dropdown) — spec §4
  const plazosDisponibles = useMemo(() => {
    return matrizTasaFija.map((row, idx) => ({
      idx,
      label: row.plazoMinimo === row.plazoMaximo
        ? `${row.plazoMinimo} días`
        : `${row.plazoMinimo} – ${row.plazoMaximo} días`,
      plazoDefault: row.plazoDefault || row.plazoMinimo,
    }));
  }, [matrizTasaFija]);

  // Auto-calculate tasa from matriz when monto + plazo change — spec §6
  const matchedMatrizRow = useMemo(() => {
    if (!isInversion || matrizTasaFija.length === 0) return null;
    const monto = data.montoCotizado;
    if (selectedPlazoIdx < 0 || selectedPlazoIdx >= matrizTasaFija.length) return null;
    const row = matrizTasaFija[selectedPlazoIdx];
    // Normalize: treat montoMaximo <= montoMinimo as "sin límite" (data entry error tolerance)
    const effectiveMax = (row.montoMaximo > 0 && row.montoMaximo >= row.montoMinimo) ? row.montoMaximo : Infinity;
    if (monto >= row.montoMinimo && monto <= effectiveMax) {
      console.log('[Matriz Match] ✓ STRICT match tasaMinima:', row.tasaMinima);
      return row;
    }
    console.log('[Matriz Match] ✗ NO strict match — monto:', monto, 'range:', row.montoMinimo, '-', effectiveMax);
    return null;
  }, [isInversion, matrizTasaFija, data.montoCotizado, selectedPlazoIdx]);

  // Soft match: selected row regardless of monto (for pre-filling tasa on row click)
  const selectedMatrizRow = useMemo(() => {
    if (!isInversion || matrizTasaFija.length === 0) return null;
    if (selectedPlazoIdx < 0 || selectedPlazoIdx >= matrizTasaFija.length) return null;
    return matrizTasaFija[selectedPlazoIdx];
  }, [isInversion, matrizTasaFija, selectedPlazoIdx]);

  // Auto-set tasa when selected row changes (soft match: fills tasa even before monto is valid)
  useEffect(() => {
    if (!isInversion || !selectedMatrizRow) return;
    const tasaMin = parseFloat(selectedMatrizRow.tasaMinima) || parseFloat(selectedMatrizRow.tasaDefault) || 0;
    console.log('[Matriz Effect] tasaMin:', tasaMin, 'from:', selectedMatrizRow.tasaMinima, '/', selectedMatrizRow.tasaDefault, 'current:', data.tasaMinInteres);
    const updates: Record<string, any> = {};
    if (Math.abs(tasaMin - (data.tasaMinInteres || 0)) > 0.001) {
      updates.tasaMinInteres = tasaMin;
    }
    if (selectedMatrizRow.periodo && selectedMatrizRow.periodo !== data.periodoCumplirMontoMinimo) {
      updates.periodoCumplirMontoMinimo = selectedMatrizRow.periodo;
    }
    if (Object.keys(updates).length > 0) {
      console.log('[Matriz Effect] ✓ Setting:', updates);
      setData(updates);
    }
  }, [selectedMatrizRow, isInversion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Inversión validation: block if monto < montoMinimo from product (con normalización numérica)
  const normalizeNum = (v: number | string | undefined | null): number | null => {
    if (v === undefined || v === null || v === '') return null;
    const cleaned = String(v).replace(/[^0-9.-]/g, '');
    if (cleaned === '' || isNaN(Number(cleaned))) return null;
    return Number(cleaned);
  };
  const montoCotNum = normalizeNum(data.montoCotizado);
  const montoMinNum = normalizeNum(data.producto.montoMinimo);
  const inversionMontoError = isInversion && montoCotNum !== null && montoCotNum > 0 && montoMinNum !== null && montoMinNum > 0 && montoCotNum < montoMinNum;
  // Inversión validation: block if plazo not selected
  const inversionPlazoError = isInversion && matrizTasaFija.length > 0 && selectedPlazoIdx < 0;

  return (
    <div className="bg-white min-h-screen">
      {/* ═══ Header bar ═══ */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M16 13H8M16 17H8M10 9H8" />
            </svg>
            <h2 className="text-lg font-normal text-gray-800">
              {isCreate ? 'Nueva Cotización — Captación' : mode === 'edit' ? 'Editar Cotización — Captación' : 'Ver Cotización — Captación'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!isView && (
              <button onClick={handleSubmit} className="px-5 py-1.5 btn-secondary-theme rounded text-sm font-medium">
                {isCreate ? 'Crear Cotización' : 'Guardar Cambios'}
              </button>
            )}
            {/* Botón "Crear Solicitud" — spec solicitudes-financieras §1, R1 */}
            {onCrearSolicitud && cotizacion && (
              <button
                onClick={() => {
                  console.log('[CaptacionForm] Crear Solicitud clicked, form:', form, 'cotizacion prop:', cotizacion);
                  onCrearSolicitud(form);
                }}
                disabled={form.estatus_cotiza === 'Aceptada'}
                className={`px-4 py-1.5 rounded text-sm font-medium flex items-center gap-1.5 ${
                  form.estatus_cotiza === 'Aceptada'
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#0E7B1F] text-white hover:bg-[#0A6118]'
                }`}
                title={form.estatus_cotiza === 'Aceptada' ? 'Cotización ya aceptada — solicitud generada' : 'Crear Solicitud desde esta Cotización'}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 1v12M1 7h12" /></svg>
                Crear Solicitud
              </button>
            )}
            <button onClick={onBack} className="px-4 py-1.5 border border-gray-400 rounded text-sm hover:bg-gray-50">
              {isView ? 'Cerrar' : 'Cancelar'}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Banner Modo Editar — spec cotizacion-edit-logic.md §5 ═══ */}
      {mode === 'edit' && (
        <div className="mx-4 mt-3 border border-amber-300 bg-amber-50 rounded p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-amber-800">
                <strong>Modo Editar</strong> — ID: <code className="text-[10px] bg-amber-100 px-1 rounded">{form.id?.substring(0, 8)}...</code>
                {' '}| Folio: <code className="text-[10px] bg-amber-100 px-1 rounded">{form.no_cotiza}</code>
              </span>
            </div>
            <div className="flex items-center gap-3">
              {changedFieldCount > 0 && (
                <span className="text-[10px] bg-blue-100 border border-blue-300 text-blue-700 px-2 py-0.5 rounded">
                  {changedFieldCount} campo(s) modificado(s)
                </span>
              )}
              <span className="text-[9px] text-amber-600">
                Deep Merge: data || partial (spec §4)
              </span>
            </div>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-3 text-[9px] text-amber-700">
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> id — inmutable</span>
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> no_cotiza — inmutable</span>
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" /> lineaProducto — inmutable</span>
          </div>
        </div>
      )}

      {/* ═══ Errores de validación ═══ */}
      {validationErrors.length > 0 && (
        <div className="mx-4 mt-3 border border-red-300 bg-red-50 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-xs font-medium text-red-800">Errores de Validación ({validationErrors.length})</span>
          </div>
          <ul className="space-y-1">
            {validationErrors.map((err, i) => (
              <li key={i} className="text-[11px] text-red-700 pl-4">• {err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ═══ Info principal ═══ */}
      <div className="px-4 py-3">
        <div className="bg-white border border-gray-300">
          {/* spec §3.1 — §3.2: ID-COTIZACION, Línea de Producto, Fecha, Estatus */}
          <div className="border-l-4 border-primary-theme px-3 py-1.5">
            <span className="text-xs font-medium text-gray-800 uppercase">Información Principal</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-1">ID-COTIZACIÓN <span className="text-[9px] text-gray-400">(auto, 30 chars)</span></label>
              <input value={form.no_cotiza} disabled className={readonlyClass} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-1">Línea de Producto</label>
              <input value="Captación" disabled className={readonlyClass} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-1">Fecha Cotización</label>
              <input value={new Date(form.fecha_cotiza).toLocaleString('es-MX')} disabled className={readonlyClass} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-1">Estatus</label>
              <input value={form.estatus_cotiza} disabled className={readonlyClass} />
            </div>
          </div>

          {/* ═══ Tabs institucionales (blue stripe) ═══ */}
          <div className="bg-primary-theme border-t border-gray-400">
            <div className="flex items-center overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-[10px] whitespace-nowrap border-r border-gray-500/30 ${
                    activeTab === tab.id
                      ? 'bg-secondary-theme text-white font-medium'
                      : 'text-white/90'
                  }`}
                  style={activeTab !== tab.id ? { transition: 'background-color 0.2s' } : {}}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = 'var(--theme-primary-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = '';
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ═══════════ TAB: DATOS GENERALES ═══════════ */}
          {activeTab === 'datos-generales' && (
            <div className="p-0">
              {/* Sección: Prospecto / Cliente — spec §3.3 */}
              <div className="border-t border-gray-300">
                <div className="border-l-4 border-primary-theme px-3 py-1.5">
                  <span className="text-xs font-medium text-gray-800 uppercase">Prospecto / Cliente</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                  <div className="flex flex-col">
                    <label className="text-[10px] text-gray-600 mb-1">Clave Cliente <span className="text-[9px] text-gray-400">(data.cliente.claveCliente)</span></label>
                    <input value={data.cliente.claveCliente} disabled className={readonlyClass} />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] text-gray-600 mb-1">Nombre Completo <span className="text-red-500">*</span></label>
                    <div className="flex gap-1">
                      <input value={data.cliente.nombreCompleto} disabled className={`${readonlyClass} flex-1`} />
                      {!isView && (
                        <button
                          onClick={() => setShowClienteModal(true)}
                          className="px-2 py-1 bg-blue-50 border border-blue-300 rounded text-blue-700 hover:bg-blue-100 text-xs whitespace-nowrap"
                        >
                          <Search className="w-3 h-3 inline mr-1" />Buscar
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Institución Gobierno — auto-cargado desde data.institucionGobierno del cliente */}
                  <div className="flex flex-col">
                    <label className="text-[10px] text-gray-600 mb-1">Institución Gobierno <span className="text-[9px] text-gray-400">(data.institucionGobierno)</span></label>
                    <input
                      type="text"
                      value={data.institucionGobierno || ''}
                      disabled={isView}
                      onChange={e => setData({ institucionGobierno: e.target.value })}
                      placeholder="Se carga automáticamente al seleccionar un cliente"
                      className={data.institucionGobierno ? fieldClass : `${fieldClass} text-gray-400 italic`}
                    />
                  </div>
                </div>
              </div>

              {/* Sección: Producto — spec §3.5 */}
              <div className="border-t border-gray-300">
                <div className="border-l-4 border-primary-theme px-3 py-1.5">
                  <span className="text-xs font-medium text-gray-800 uppercase">Producto</span>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Producto <span className="text-red-500">*</span> <span className="text-[9px] text-gray-400">(Línea=Captación, Convenios)</span></label>
                      <select
                        value={data.producto.claveProducto}
                        disabled={isView}
                        onChange={e => {
                          const prod = productoPickerItems.find(p => p.claveProducto === e.target.value);
                          if (prod) handleSelectProducto(prod);
                        }}
                        className={fieldClass}
                      >
                        <option value="">— Seleccionar producto —{loadingProductos ? ' (cargando...)' : ''}</option>
                        {productoPickerItems.map(p => (
                          <option key={p.id} value={p.claveProducto}>{p.nombreProducto} ({p.claveProducto})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Clave Producto <span className="text-[9px] text-gray-400">(data.producto.claveProducto)</span></label>
                      <input value={data.producto.claveProducto} disabled className={readonlyClass} />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Tipo Producto <span className="text-[9px] text-gray-400">(data.producto.tipoProducto)</span></label>
                      <input value={data.producto.tipoProducto} disabled className={readonlyClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Monto Mínimo <span className="text-[9px] text-gray-400">(data.producto.montoMinimo)</span></label>
                      <input value={data.producto.montoMinimo ? formatMoney(data.producto.montoMinimo) : '—'} disabled className={readonlyClass} />
                    </div>
                    {/* spec §4.4: Solo lectura */}
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Periodo Cumplir Monto Mínimo <span className="text-[9px] text-gray-400">(solo lectura)</span></label>
                      <input value={data.producto.periodoCumplirMontoMinimo || '—'} disabled className={readonlyClass} />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Plazo Cumplir Monto Mínimo (Producto) <span className="text-[9px] text-gray-400">(solo lectura)</span></label>
                      <input value={data.producto.plazoCumplirMontoMinimo || '—'} disabled className={readonlyClass} />
                    </div>
                  </div>

                  {/* Indicador Ahorro/Aportación */}
                  {isAhorroAportacion && (
                    <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2">
                      <span className="text-[10px] text-blue-700">
                        Producto tipo <strong>{data.producto.tipoProducto}</strong> — se aplican reglas de pick map automático (spec §4)
                      </span>
                    </div>
                  )}

                  {/* Indicador Inversión */}
                  {isInversion && (
                    <div className="bg-purple-50 border border-purple-200 rounded px-3 py-2">
                      <span className="text-[10px] text-purple-700">
                        Producto tipo <strong>Inversión</strong> — se activan campos especiales: Plazo (desde matriz), Monto, Periodo de Aportación y Matriz de Tasa Fija (spec inversión §1)
                      </span>
                      {matrizTasaFija.length > 0 && (
                        <span className="text-[10px] text-purple-600 ml-2">| {matrizTasaFija.length} fila(s) en la matriz</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ═══ Sección: Matriz de Tasa Fija — SOLO Inversión (spec inversión §2) ═══ */}
              {isInversion && matrizTasaFija.length > 0 && (
                <div className="border-t border-gray-300">
                  <div className="border-l-4 border-purple-500 px-3 py-1.5 bg-purple-50">
                    <span className="text-xs font-medium text-purple-800 uppercase">Matriz de Tasa Fija del Producto</span>
                    <span className="text-[9px] text-purple-500 ml-2">({matrizTasaFija.length} fila{matrizTasaFija.length !== 1 ? 's' : ''})</span>
                  </div>
                  <div className="p-4">
                    <div className="border border-gray-300 overflow-x-auto rounded">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#2E5C91] text-white">
                            <th className="px-3 py-2 text-left font-medium">Periodo</th>
                            <th className="px-3 py-2 text-right font-medium">Plazo Mín</th>
                            <th className="px-3 py-2 text-right font-medium">Plazo Máx</th>
                            <th className="px-3 py-2 text-right font-medium">Monto Mín</th>
                            <th className="px-3 py-2 text-right font-medium">Monto Máx</th>
                            <th className="px-3 py-2 text-right font-medium">Tasa Mín (%)</th>
                            <th className="px-3 py-2 text-right font-medium">Tasa Máx (%)</th>
                            <th className="px-3 py-2 text-right font-medium">Tasa Default (%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matrizTasaFija.map((row, idx) => {
                            const isMatch = matchedMatrizRow === row;
                            const isSelected = selectedPlazoIdx === idx;
                            return (
                              <tr
                                key={`mtf-${idx}`}
                                className={`border-b border-gray-200 cursor-pointer transition-colors ${isMatch ? 'bg-green-50' : isSelected ? 'bg-blue-50' : ''}`}
                                style={!isMatch && !isSelected ? { backgroundColor: idx % 2 === 1 ? '#F5F5F5' : '#FFFFFF' } : undefined}
                                onClick={() => {
                                  if (!isView) {
                                    setSelectedPlazoIdx(idx);
                                    setData({ plazoCumplirMontoMinimo: row.plazoDefault || row.plazoMinimo });
                                  }
                                }}
                              >
                                <td className="px-3 py-1.5 text-gray-700">{row.periodo || '—'}</td>
                                <td className="px-3 py-1.5 text-right text-gray-700">{row.plazoMinimo}</td>
                                <td className="px-3 py-1.5 text-right text-gray-700">{row.plazoMaximo}</td>
                                <td className="px-3 py-1.5 text-right text-gray-700">{formatMoney(row.montoMinimo)}</td>
                                <td className="px-3 py-1.5 text-right text-gray-700">{row.montoMaximo > 0 ? formatMoney(row.montoMaximo) : '∞'}</td>
                                <td className="px-3 py-1.5 text-right text-gray-700">{row.tasaMinima}%</td>
                                <td className="px-3 py-1.5 text-right text-gray-700">{row.tasaMaxima}%</td>
                                <td className={`px-3 py-1.5 text-right font-medium ${isMatch ? 'text-green-700' : 'text-gray-800'}`}>
                                  {row.tasaDefault}%
                                  {isMatch && <span className="ml-1 text-green-600 text-[9px]">✓ Aplicada</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {!isView && (
                      <p className="text-[9px] text-gray-500 mt-2">
                        Haga clic en una fila para seleccionar el plazo. La tasa se asigna automáticamente si el monto está dentro del rango.
                      </p>
                    )}
                    {matchedMatrizRow && (
                      <div className="mt-2 bg-green-50 border border-green-200 rounded px-3 py-1.5">
                        <span className="text-[10px] text-green-700">
                          ✓ Tasa asignada desde matriz: <strong>{matchedMatrizRow.tasaDefault}%</strong>
                          {' '}(Plazo: {matchedMatrizRow.plazoMinimo}–{matchedMatrizRow.plazoMaximo} días, Monto: {formatMoney(matchedMatrizRow.montoMinimo)}–{matchedMatrizRow.montoMaximo > 0 ? formatMoney(matchedMatrizRow.montoMaximo) : '∞'})
                        </span>
                      </div>
                    )}
                    {isInversion && selectedPlazoIdx >= 0 && !matchedMatrizRow && data.montoCotizado > 0 && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded px-3 py-1.5">
                        <span className="text-[10px] text-amber-700">
                          ⚠ El monto {formatMoney(data.montoCotizado)} no se encuentra dentro del rango de la fila seleccionada
                          ({formatMoney(matrizTasaFija[selectedPlazoIdx].montoMinimo)} – {matrizTasaFija[selectedPlazoIdx].montoMaximo > 0 ? formatMoney(matrizTasaFija[selectedPlazoIdx].montoMaximo) : '∞'}).
                          Ajuste el monto o seleccione otro plazo.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isInversion && matrizTasaFija.length === 0 && data.producto.claveProducto && (
                <div className="border-t border-gray-300">
                  <div className="border-l-4 border-purple-500 px-3 py-1.5 bg-purple-50">
                    <span className="text-xs font-medium text-purple-800 uppercase">Matriz de Tasa Fija del Producto</span>
                  </div>
                  <div className="p-4 text-center text-gray-500 text-xs">
                    <p>El producto seleccionado no tiene Matriz de Tasa Fija configurada.</p>
                    <p className="text-[9px] text-gray-400 mt-1">Configure la matriz en el módulo de Productos → Captación → Matriz Tasa Fija.</p>
                  </div>
                </div>
              )}

              {/* Sección: Condiciones — spec §4.3, §4.5, §5, §6 */}
              <div className="border-t border-gray-300">
                <div className="border-l-4 border-primary-theme px-3 py-1.5">
                  <span className="text-xs font-medium text-gray-800 uppercase">Condiciones de la Cotización</span>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* spec §4.3: Monto Cotizado >= montoMinimo */}
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">
                        Monto Cotizado <span className="text-red-500">*</span>
                        {data.producto.montoMinimo > 0 && <span className="text-gray-400 ml-1">(mín: {formatMoney(data.producto.montoMinimo)})</span>}
                      </label>
                      <input
                        type="number"
                        value={data.montoCotizado || ''}
                        disabled={isView}
                        min={data.producto.montoMinimo || 0}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setData({ montoCotizado: val });
                        }}
                        className={`${fieldClass} ${
                          !isView && montoCotNum !== null && montoCotNum > 0 && montoMinNum !== null && montoMinNum > 0 && montoCotNum < montoMinNum
                            ? 'border-red-400 bg-red-50'
                            : ''
                        }`}
                      />
                      {!isView && montoCotNum !== null && montoCotNum > 0 && montoMinNum !== null && montoMinNum > 0 && montoCotNum < montoMinNum && (
                        <span className="text-[9px] text-red-600 mt-0.5">Monto debe ser ≥ {formatMoney(montoMinNum)}</span>
                      )}
                    </div>
                    {/* spec §5: Tasa — read-only when inversión (auto from matriz) */}
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">
                        Tasa Min Interés (%) <span className="text-red-500">*</span>
                        {isInversion && selectedMatrizRow && <span className="text-[9px] text-green-600 ml-1">(desde matriz: {selectedMatrizRow.tasaMinima}%)</span>}
                        {!isInversion && <span className="text-[9px] text-gray-400 ml-1">(data.tasaMinInteres)</span>}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={isInversion && selectedMatrizRow ? (parseFloat(selectedMatrizRow.tasaMinima) || data.tasaMinInteres || '') : (data.tasaMinInteres ?? '')}
                        disabled={isView || (isInversion && selectedMatrizRow !== null)}
                        onChange={e => setData({ tasaMinInteres: parseFloat(e.target.value) || 0 })}
                        className={isInversion && selectedMatrizRow ? `${readonlyClass} bg-green-50 border-green-200 text-green-800` : fieldClass}
                      />
                      {isInversion && selectedMatrizRow && (
                        <span className="text-[9px] text-green-600 mt-0.5">Calculada desde Matriz de Tasa Fija (tasaMinima: {selectedMatrizRow.tasaMinima}%)</span>
                      )}
                    </div>
                    {/* Frecuencia */}
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Frecuencia Capitalización <span className="text-red-500">*</span></label>
                      <select
                        value={data.frecuenciaCapitalizacion}
                        disabled={isView}
                        onChange={e => setData({ frecuenciaCapitalizacion: e.target.value })}
                        className={fieldClass}
                      >
                        <option value="">— Seleccionar —</option>
                        {periodosDropdown.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                        {data.frecuenciaCapitalizacion && !periodosDropdown.includes(data.frecuenciaCapitalizacion) && (
                          <option value={data.frecuenciaCapitalizacion}>{data.frecuenciaCapitalizacion}</option>
                        )}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* spec §5: Intereses Generados (calculado) */}
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Interés Generado por Periodo <span className="text-[9px] text-gray-400">(calculado)</span></label>
                      <input
                        value={data.interesGeneradoPeriodo ? formatMoney(data.interesGeneradoPeriodo) : '$0.00'}
                        disabled
                        className={readonlyClass}
                      />
                      <span className="text-[9px] text-gray-400 mt-0.5">= Monto × (Tasa / 360) × Días frecuencia</span>
                    </div>
                    {/* spec §4.5: Plazo — dropdown from matriz when inversión, free number otherwise */}
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">
                        {isInversion ? 'Plazo de Inversión' : 'Plazo Cumplir Monto Mínimo'} <span className="text-red-500">*</span>
                        {!isInversion && data.producto.plazoCumplirMontoMinimo > 0 && <span className="text-gray-400 ml-1">(mín: {data.producto.plazoCumplirMontoMinimo})</span>}
                        {isInversion && <span className="text-[9px] text-purple-500 ml-1">(desde matriz)</span>}
                      </label>
                      {isInversion && plazosDisponibles.length > 0 ? (
                        <>
                          <select
                            value={selectedPlazoIdx}
                            disabled={isView}
                            onChange={e => {
                              const idx = parseInt(e.target.value);
                              setSelectedPlazoIdx(idx);
                              if (idx >= 0 && idx < matrizTasaFija.length) {
                                const row = matrizTasaFija[idx];
                                setData({ plazoCumplirMontoMinimo: row.plazoDefault || row.plazoMinimo });
                              }
                            }}
                            className={`${fieldClass} ${selectedPlazoIdx < 0 && !isView ? 'border-amber-400 bg-amber-50' : ''}`}
                          >
                            <option value={-1}>— Seleccionar plazo —</option>
                            {plazosDisponibles.map(p => (
                              <option key={p.idx} value={p.idx}>{p.label}</option>
                            ))}
                          </select>
                          {selectedPlazoIdx < 0 && !isView && (
                            <span className="text-[9px] text-amber-600 mt-0.5">Seleccione un plazo de la matriz del producto</span>
                          )}
                        </>
                      ) : (
                        <>
                          <input
                            type="number"
                            value={data.plazoCumplirMontoMinimo || ''}
                            disabled={isView}
                            min={data.producto.plazoCumplirMontoMinimo || 0}
                            onChange={e => setData({ plazoCumplirMontoMinimo: parseInt(e.target.value) || 0 })}
                            className={`${fieldClass} ${
                              !isView && Number(data.producto.plazoCumplirMontoMinimo) > 0 && Number(data.plazoCumplirMontoMinimo) < Number(data.producto.plazoCumplirMontoMinimo)
                                ? 'border-red-400 bg-red-50'
                                : ''
                            }`}
                          />
                          {!isView && !isInversion && Number(data.producto.plazoCumplirMontoMinimo) > 0 && Number(data.plazoCumplirMontoMinimo) < Number(data.producto.plazoCumplirMontoMinimo) && (
                            <span className="text-[9px] text-red-600 mt-0.5">Plazo debe ser ≥ {Number(data.producto.plazoCumplirMontoMinimo)}</span>
                          )}
                        </>
                      )}
                    </div>
                    {/* spec §6: Fecha primera aportación, obligatoria si plazo > 0 */}
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">
                        Fecha Primera Aportación
                        {data.plazoCumplirMontoMinimo > 0 && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <div className="relative" ref={datePickerRef}>
                        <button
                          type="button"
                          disabled={isView}
                          onClick={() => !isView && setShowDatePicker(prev => !prev)}
                          className={`${fieldClass} text-left flex items-center justify-between cursor-pointer ${
                            !isView && data.plazoCumplirMontoMinimo > 0 && !data.fechaPrimeraAportacion
                              ? 'border-red-400 bg-red-50'
                              : ''
                          }`}
                        >
                          <span className={data.fechaPrimeraAportacion ? 'text-gray-800' : 'text-gray-400'}>
                            {data.fechaPrimeraAportacion
                              ? format(parse(data.fechaPrimeraAportacion, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM 'de' yyyy", { locale: es })
                              : 'Seleccionar fecha...'}
                          </span>
                          <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
                        </button>

                        {showDatePicker && !isView && (
                          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-300 rounded-lg shadow-xl p-3">
                            <DayPicker
                              mode="single"
                              locale={es}
                              captionLayout="dropdown-buttons"
                              fromYear={2020}
                              toYear={2040}
                              defaultMonth={
                                data.fechaPrimeraAportacion
                                  ? parse(data.fechaPrimeraAportacion, 'yyyy-MM-dd', new Date())
                                  : new Date()
                              }
                              selected={
                                data.fechaPrimeraAportacion
                                  ? parse(data.fechaPrimeraAportacion, 'yyyy-MM-dd', new Date())
                                  : undefined
                              }
                              onSelect={(date) => {
                                if (date && isValid(date)) {
                                  setData({ fechaPrimeraAportacion: format(date, 'yyyy-MM-dd') });
                                }
                                setShowDatePicker(false);
                              }}
                              styles={{
                                caption: { color: 'var(--theme-primary)' },
                                caption_dropdowns: { display: 'flex', gap: '8px', alignItems: 'center' },
                                dropdown_month: {
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #d1d5db',
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                  backgroundColor: '#f9fafb',
                                },
                                dropdown_year: {
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #d1d5db',
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                  backgroundColor: '#f9fafb',
                                },
                                day: { borderRadius: '6px' },
                              }}
                              modifiersStyles={{
                                selected: {
                                  backgroundColor: 'var(--theme-primary)',
                                  color: 'white',
                                },
                                today: {
                                  fontWeight: 'bold',
                                  border: '1px solid var(--theme-primary)',
                                  borderRadius: '6px',
                                },
                              }}
                            />
                            <div className="border-t border-gray-200 pt-2 mt-1 flex items-center justify-between px-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setData({ fechaPrimeraAportacion: format(new Date(), 'yyyy-MM-dd') });
                                  setShowDatePicker(false);
                                }}
                                className="text-[10px] text-blue-600 hover:text-blue-800"
                              >
                                Hoy
                              </button>
                              {data.fechaPrimeraAportacion && (
                                <span className="text-[10px] text-gray-500">
                                  {data.fechaPrimeraAportacion}
                                </span>
                              )}
                              {data.fechaPrimeraAportacion && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setData({ fechaPrimeraAportacion: '' });
                                    setShowDatePicker(false);
                                  }}
                                  className="text-[10px] text-red-500 hover:text-red-700"
                                >
                                  Limpiar
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {!isView && data.plazoCumplirMontoMinimo > 0 && !data.fechaPrimeraAportacion && (
                        <span className="text-[9px] text-red-600 mt-0.5">Obligatorio cuando Plazo &gt; 0</span>
                      )}
                    </div>
                  </div>
                  {/* Periodo Cumplir — top-level data field */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Periodo Cumplir Monto Mínimo {isInversion && selectedMatrizRow?.periodo ? <span className="text-[9px] text-green-600 ml-1">(✓ desde matriz: {selectedMatrizRow.periodo})</span> : <span className="text-[9px] text-gray-400">(data.periodoCumplirMontoMinimo)</span>}</label>
                      <select
                        value={data.periodoCumplirMontoMinimo}
                        disabled={isView}
                        onChange={e => setData({ periodoCumplirMontoMinimo: e.target.value })}
                        className={isView ? readonlyClass : fieldClass}
                      >
                        <option value="">— Seleccionar —</option>
                        {periodosDropdown.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                        {/* Compatibilidad: mostrar valor guardado si no está en los periodos del producto */}
                        {data.periodoCumplirMontoMinimo && !periodosDropdown.includes(data.periodoCumplirMontoMinimo) && (
                          <option value={data.periodoCumplirMontoMinimo}>{data.periodoCumplirMontoMinimo}</option>
                        )}
                      </select>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Descripción</label>
                      <input
                        type="text"
                        value={form.descripcion}
                        disabled={isView}
                        onChange={e => setForm(prev => ({ ...prev, descripcion: e.target.value }))}
                        placeholder="Descripción de la cotización..."
                        className={fieldClass}
                        maxLength={255}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ TAB: CALENDARIO DE APORTACIONES — spec §7 ═══════════ */}
          {activeTab === 'calendario-aportaciones' && (
            <div className="p-0">
              <div className="border-t border-gray-300">
                <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">CALENDARIO DE APORTACIONES</span>
                </div>

                {calendario.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="#CBD5E1" strokeWidth="1.5" className="mx-auto mb-3">
                      <rect x="6" y="10" width="36" height="30" rx="3" />
                      <path d="M6 18h36" />
                      <path d="M16 6v8M32 6v8" />
                    </svg>
                    <p>No se ha generado un calendario de aportaciones.</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Para generar el calendario, complete los campos: <strong>Monto Cotizado</strong>, <strong>Plazo &gt; 0</strong>,
                      <strong> Fecha Primera Aportación</strong> y <strong>Periodo/Frecuencia</strong>.
                    </p>
                    <p className="text-[10px] text-gray-400 mt-2">
                      Condición: data.plazoCumplirMontoMinimo &gt; 0 (spec §7)
                    </p>
                  </div>
                ) : (
                  <div className="p-4">
                    {/* Resumen */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <span className="text-[10px] text-blue-600">Total Aportaciones</span>
                        <p className="text-lg text-blue-800">{calendario.length}</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded p-3">
                        <span className="text-[10px] text-green-600">Monto por Aportación</span>
                        <p className="text-lg text-green-800">{calendario[0] ? formatMoney(calendario[0].monto) : '—'}</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded p-3">
                        <span className="text-[10px] text-amber-600">Periodo</span>
                        <p className="text-lg text-amber-800">{data.periodoCumplirMontoMinimo || data.frecuenciaCapitalizacion}</p>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded p-3">
                        <span className="text-[10px] text-purple-600">Monto Total</span>
                        <p className="text-lg text-purple-800">{formatMoney(totalCalendario)}</p>
                      </div>
                    </div>

                    {/* Tabla institucional — spec §7.3 */}
                    <div className="border border-gray-300 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-100 border-b border-gray-300">
                            <th className="px-3 py-2.5 text-center font-normal text-xs text-gray-700 whitespace-nowrap">No Aportación</th>
                            <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700 whitespace-nowrap">Fecha de Aportación</th>
                            <th className="px-3 py-2.5 text-right font-normal text-xs text-gray-700 whitespace-nowrap">Monto de Aportación</th>
                            <th className="px-3 py-2.5 text-center font-normal text-xs text-gray-700 whitespace-nowrap">Moneda</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calendario.map((row, idx) => (
                            <tr
                              key={row.noAportacion}
                              className="border-b border-gray-200 transition-colors duration-150"
                              style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                            >
                              <td className="px-3 py-2 text-xs text-center text-gray-700">{row.noAportacion}</td>
                              <td className="px-3 py-2 text-xs text-gray-700">{formatDateCalendar(row.fecha)}</td>
                              <td className="px-3 py-2 text-xs text-gray-700 text-right">{formatMoney(row.monto)}</td>
                              <td className="px-3 py-2 text-xs text-gray-700 text-center">{row.moneda}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-100 border-t border-gray-300">
                            <td colSpan={2} className="px-3 py-2.5 text-xs font-medium text-gray-800 text-right">Total:</td>
                            <td className="px-3 py-2.5 text-xs font-medium text-gray-800 text-right">{formatMoney(totalCalendario)}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-700 text-center">MXN</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* JSON preview — spec §7.4 */}
                    <div className="mt-4 bg-gray-50 border border-gray-200 rounded p-3">
                      <details>
                        <summary className="text-[10px] text-gray-500 cursor-pointer">Ver JSON calendarioAportaciones (spec §7.4)</summary>
                        <pre className="mt-2 text-[10px] text-gray-600 overflow-x-auto max-h-40">
                          {JSON.stringify(calendario.slice(0, 3), null, 2)}
                          {calendario.length > 3 && `\n  // ... ${calendario.length - 3} más`}
                        </pre>
                      </details>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* MODAL: Seleccionar Cliente / Prospecto — spec §3.3 */}
      {/* ═══════════════════════════════════════════════ */}
      {showClienteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-500" />
                <h3 className="text-sm font-medium text-gray-800">Seleccionar Prospecto / Cliente</h3>
                <span className="text-[9px] text-gray-400 ml-2">Pick Map: cliente_id, data.cliente.claveCliente, data.cliente.nombreCompleto</span>
              </div>
              <button onClick={() => setShowClienteModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            {/* Search */}
            <div className="px-4 py-2 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={clienteSearch}
                  onChange={e => setClienteSearch(e.target.value)}
                  placeholder="Buscar por clave, nombre..."
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
            </div>
            {/* Table */}
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="bg-gray-100 border-b border-gray-300">
                    <th className="px-3 py-2 text-left font-normal text-gray-700">Clave</th>
                    <th className="px-3 py-2 text-left font-normal text-gray-700">Nombre Completo</th>
                    <th className="px-3 py-2 text-center font-normal text-gray-700">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClientes.map((cl, idx) => {
                    const full = [cl.nombre, cl.apellidoPaterno, cl.apellidoMaterno].filter(Boolean).join(' ');
                    return (
                      <tr
                        key={cl.id}
                        className="border-b border-gray-200 transition-colors"
                        style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                      >
                        <td className="px-3 py-2 text-gray-700">{cl.idCliente}</td>
                        <td className="px-3 py-2 text-gray-700">{full}</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleSelectCliente(cl)}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-[10px]"
                          >
                            Seleccionar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredClientes.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-400">No se encontraron clientes</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function extractMatrizTasaFija(p: any): MatrizTasaFijaRow[] {
  // Captación stores as matrizTasaFijaRegistros, Crédito stores as matrizTasaFija
  const raw = Array.isArray(p.matrizTasaFijaRegistros) ? p.matrizTasaFijaRegistros
    : Array.isArray(p.matrizTasaFija) ? p.matrizTasaFija
    : [];
  return raw.map((row: any) => ({
    id: row.id,
    periodo: row.periodo || '',
    plazoMinimo: parseFloat(row.plazoMinimo) || 0,
    plazoMaximo: parseFloat(row.plazoMaximo) || 0,
    plazoDefault: parseFloat(row.plazoDefault) || 0,
    montoMinimo: parseFloat(row.montoMinimo) || 0,
    montoMaximo: parseFloat(row.montoMaximo) || 0,
    montoDefault: parseFloat(row.montoDefault) || 0,
    tasaMinima: String(row.tasaMinima || '0'),
    tasaMaxima: String(row.tasaMaxima || '0'),
    tasaDefault: String(row.tasaDefault || '0'),
  }));
}