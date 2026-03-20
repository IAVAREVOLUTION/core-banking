/**
 * CotizacionCreditoForm.tsx  v2.0
 *
 * Formulario institucional para Cotización → Crédito / Línea de Crédito
 * Alineado con spec credito-cotizaciones-module.md §1–§12
 *
 * Subtabs: Datos Generales | Tabla de Amortización
 *
 * Secciones de Datos Generales:
 *   1. Prospecto/Cliente   — §2.1
 *   2. Producto             — §3
 *   3. Plazos y Montos      — §4 (Matriz Tasa Fija)
 *   4. Garantía             — §5
 *   5. Condiciones          — §6, §7, §8
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, X, Building2, AlertTriangle, Shield, Calculator, CalendarDays, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parse, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import type {
  CotizacionCredito,
  CotizacionCreditoData,
  MatrizTasaFijaRow,
  GarantiaProducto,
  SeguroProducto,
  SeguroMatrizRow,
} from './cotizacionCreditoTypes';
import {
  generarNoCotizaCredito,
  calcularPagoPeriodo,
  generarTablaAmortizacionCredito,
  crearCotizacionCreditoVacia,
  validarCotizacionCredito,
  TIPOS_CALCULO_AMORTIZACION,
  TIPOS_TASA,
  FRECUENCIAS_PAGO,
  MOCK_MATRIZ_TASA_FIJA,
  MOCK_GARANTIAS,
  MOCK_SEGUROS,
} from './cotizacionCreditoTypes';
import { useClientesDB } from '../../hooks/useClientesDB';
import { useProductosCredito } from '../../hooks/useProductosCredito';
import { useProductosLineaCreditoDB } from '../../hooks/useProductosLineaCreditoDB';
import { useProductosSeguros } from '../../hooks/useProductosSeguros';
import { CampoInstitucionGobierno } from '../ui/CatalogoInstitucionGobierno';
import type { InstitucionGobiernoSeleccion } from '../ui/CatalogoInstitucionGobierno';

type FormMode = 'create' | 'edit' | 'view';
type LineaProducto = 'Crédito' | 'Línea de Crédito';

interface Props {
  mode: FormMode;
  lineaProducto: LineaProducto;
  cotizacion?: CotizacionCredito;
  onSave: (c: CotizacionCredito) => void;
  onBack: () => void;
  /** Callback para crear Solicitud desde esta Cotización — spec solicitudes-financieras §1 */
  onCrearSolicitud?: (c: CotizacionCredito) => void;
}

const formatMoney = (v: number) => `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

/** Convenio vinculado al producto — asocia institución con producto */
interface ConvenioProducto {
  institucionNombre: string;
  lineaProducto: string;
}

interface ProductoPickerItem {
  id: string;
  claveProducto: string;
  nombreProducto: string;
  tipoProducto: string;
  lineaProducto: string;
  tasaBase: number;
  // Subviews del producto
  matrizTasaFija: MatrizTasaFijaRow[];
  garantias: GarantiaProducto[];
  seguros: SeguroProducto[];
  /** Subvista Convenios — para filtrar por Institución Gobierno + lineaProducto */
  convenios: ConvenioProducto[];
  /** Subvista Amortizaciones — métodos de cálculo con predeterminado */
  amortizaciones?: { metodo: string; predeterminado: boolean }[];
}

/** Mock convenios — asocian instituciones gobierno con productos */
const MOCK_CONVENIOS_CREDITO: Record<string, ConvenioProducto[]> = {
  'PCRE-001': [
    { institucionNombre: 'Secretaría de Educación Pública (SEP)', lineaProducto: 'Crédito' },
    { institucionNombre: 'Secretaría de Hacienda (SHCP)', lineaProducto: 'Crédito' },
    { institucionNombre: 'Instituto de Seguridad y Servicios Sociales (ISSSTE)', lineaProducto: 'Crédito' },
  ],
  'PCRE-002': [
    { institucionNombre: 'Instituto de Seguridad y Servicios Sociales (ISSSTE)', lineaProducto: 'Crédito' },
    { institucionNombre: 'Comisión Federal de Electricidad (CFE)', lineaProducto: 'Crédito' },
  ],
  'PCRE-003': [
    { institucionNombre: 'Comisión Federal de Electricidad (CFE)', lineaProducto: 'Crédito' },
    { institucionNombre: 'Secretaría de Educación Pública (SEP)', lineaProducto: 'Crédito' },
  ],
  'PLDC-001': [
    { institucionNombre: 'Secretaría de Educación Pública (SEP)', lineaProducto: 'Línea de Crédito' },
  ],
  'PLDC-002': [
    { institucionNombre: 'Secretaría de Gobernación (SEGOB)', lineaProducto: 'Línea de Crédito' },
  ],
};

export function CotizacionCreditoForm({ mode, lineaProducto, cotizacion, onSave, onBack, onCrearSolicitud }: Props) {
  const isView = mode === 'view';
  const isCreate = mode === 'create';
  const isLineaCredito = lineaProducto === 'Línea de Crédito';
  const prefix = isLineaCredito ? 'LDC' : 'CRE';

  // ── Hooks reales ──
  const { clientes: clientesDB } = useClientesDB(true);
  const { productos: productosCredito } = useProductosCredito(lineaProducto === 'Crédito');
  const { productos: productosLC } = useProductosLineaCreditoDB(isLineaCredito);

  // ── Productos Seguros (cross-reference con paquetes → matrizTasaFija real) ──
  const { productos: productosSegurosDB } = useProductosSeguros(true);

  // ── Form state — must be declared before memos that reference `data` ──
  const [form, setForm] = useState<CotizacionCredito>(() => {
    if (cotizacion) return JSON.parse(JSON.stringify(cotizacion));
    return { ...crearCotizacionCreditoVacia(generarNoCotizaCredito(prefix as any), lineaProducto), id: crypto.randomUUID() };
  });

  const data = form.data;

  const setData = useCallback((partial: Partial<CotizacionCreditoData>) => {
    setForm(prev => ({ ...prev, data: { ...prev.data, ...partial } }));
  }, []);

  // ── Normalizar clientes ──
  const clienteItems = useMemo(() =>
    clientesDB.length > 0
      ? clientesDB.map(c => ({ id: c.dbUuid, idCliente: c.idCliente, nombreCompleto: c.nombreCompleto }))
      : [
          { id: 'CL-001', idCliente: 'CLI-10001', nombreCompleto: 'María García López' },
          { id: 'CL-002', idCliente: 'CLI-10002', nombreCompleto: 'Roberto Hernández Martínez' },
        ],
  [clientesDB]);

  /**
   * Normalizar productos — incluye subviews (matrizTasaFija, garantías, seguros, convenios)
   * En producción estos vienen del JSONB del producto; mientras tanto: MOCK fallback.
   */
  const allProductoItems: ProductoPickerItem[] = useMemo(() => {
    const srcCredito = productosCredito as any[];
    const srcLC = productosLC as any[];
    const src = isLineaCredito ? srcLC : srcCredito;
    console.log(`[CotizCreditoForm] Productos reales recibidos: ${src.length}`, src.slice(0, 3).map((p: any) => ({ id: p.dbUuid, nombre: p.nombre, clave: p.clave, paquetesLen: Array.isArray(p.paquetes) ? p.paquetes.length : 'N/A' })));
    if (src.length > 0) {
      return src.map((p: any) => {
        const clave = p.clave?.toString() || p.claveProducto || p.idProducto || p.claveEBS || '';
        return {
          id: p.dbUuid || p.identificacion?.toString() || String(p.id),
          claveProducto: clave,
          nombreProducto: p.nombre || p.nombreProducto || '',
          tipoProducto: p.tipoProducto || '',
          lineaProducto: p.lineaProducto || lineaProducto,
          tasaBase: parseFloat(String(p.tasa || p.tasaBase || 0)) || 0,
          // Subviews — leer del producto real o fallback a mock
          matrizTasaFija: Array.isArray(p.matrizTasaFija) && p.matrizTasaFija.length > 0
            ? p.matrizTasaFija.map((m: any, idx: number) => ({
                id: idx + 1,
                periodo: m.periodo || 'Mensual',
                plazoMinimo: m.plazoInicial || m.plazoMinimo || 0,
                plazoMaximo: m.plazoFinal || m.plazoMaximo || 0,
                plazoDefault: m.plazoDefault || m.plazoInicial || 0,
                montoMinimo: m.montoInicial || m.montoMinimo || 0,
                montoMaximo: m.montoFinal || m.montoMaximo || 0,
                montoDefault: m.montoDefault || m.montoInicial || 0,
                moneda: m.moneda || 'MXN',
                tasaMinima: m.tasaMinima || m.tasa || 0,
                tasaMaxima: m.tasaMaxima || m.tasa || 0,
                tasaDefault: m.tasaDefault || m.tasa || 0,
              }))
            : MOCK_MATRIZ_TASA_FIJA,
          garantias: Array.isArray(p.garantias) && p.garantias.length > 0
            ? p.garantias.map((g: any, idx: number) => ({
                id: g.id ?? idx + 1,
                // GarantiaTab guarda como tipo/subtipo; CotizacionCredito espera tipoGarantia/subtipoGarantia
                tipoGarantia: g.tipoGarantia || g.tipo || '',
                subtipoGarantia: g.subtipoGarantia || g.subtipo || '',
                // GarantiaTab guarda aforo como string porcentaje ("100.00" = 100%); CotizacionCredito espera decimal (1.0 = 100%)
                aforo: typeof g.aforo === 'string'
                  ? parseFloat(g.aforo) / 100
                  : (typeof g.aforo === 'number' ? (g.aforo > 10 ? g.aforo / 100 : g.aforo) : 0),
              }))
            : [],
          // Seguros (cross-ref con productosSegurosDB) — filtrar paquetes tipo "Seguro" del subtab Paquetes del producto
          // PaquetesTab guarda: { paqueteProductoId, paqueteProductoNombre, selectBoolean, tipo? }
          // Detección: campo `tipo === 'Seguro'`, o `tipoPaquete === 'Seguro'`, o nombre contiene "Seguro"
          seguros: (() => {
            const paquetes = Array.isArray(p.paquetes) ? p.paquetes : [];
            const seguros = paquetes
              .filter((pk: any) => {
                if (pk.selectBoolean === false) return false;
                const tipo = (pk.tipo || pk.tipoPaquete || '').toLowerCase();
                const nombre = (pk.nombre || pk.paqueteProductoNombre || '').toLowerCase();
                return tipo === 'seguro' || nombre.includes('seguro');
              })
              .map((pk: any, idx: number) => {
                const pkNombre = (pk.nombre || pk.paqueteProductoNombre || '').trim();
                const pkId = pk.paqueteProductoId || pk.productoId || '';

                // 1. Intentar obtener matrizTasaFija embebida en el paquete
                let rawMC: any[] = Array.isArray(pk.montosYCoberturas) ? pk.montosYCoberturas
                  : Array.isArray(pk.matrizTasaFija) ? pk.matrizTasaFija : [];

                // 2. Cross-reference con el Producto Seguro real de BD (por UUID o nombre)
                if (rawMC.length === 0 && productosSegurosDB.length > 0) {
                  const segProd = productosSegurosDB.find((sp: any) =>
                    (sp.dbUuid && sp.dbUuid === pkId) ||
                    (sp.nombre && sp.nombre.trim().toLowerCase() === pkNombre.toLowerCase())
                  );
                  if (segProd && Array.isArray((segProd as any).matrizTasaFija)) {
                    rawMC = (segProd as any).matrizTasaFija;
                    console.log(`[CotizCredito] Cross-ref seguro "${pkNombre}" → matrizTasaFija del Producto Seguro (${rawMC.length} filas)`);
                  }
                }

                // 3. Mapear a SeguroMatrizRow normalizado
                // Tasas: BD guarda como string porcentual ("12" = 12%) → convertir a decimal (0.12)
                const normTasa = (v: any): number => {
                  const n = parseFloat(v ?? 0) || 0;
                  return n > 1 ? n / 100 : n; // >1 implica porcentaje, <=1 ya es decimal
                };
                const montosYCoberturas = rawMC.map((r: any) => ({
                  periodo: r.periodo || 'Mensual',
                  plazoMinimo: parseFloat(r.plazoMinimo ?? r.plazoInicial ?? 0) || 0,
                  plazoMaximo: parseFloat(r.plazoMaximo ?? r.plazoFinal ?? 0) || 0,
                  plazoDefault: parseFloat(r.plazoDefault ?? r.plazoMinimo ?? 0) || 0,
                  montoMinimo: parseFloat(r.montoMinimo ?? r.montoInicial ?? 0) || 0,
                  montoMaximo: parseFloat(r.montoMaximo ?? r.montoFinal ?? 0) || 0,
                  montoDefault: parseFloat(r.montoDefault ?? r.montoSeguro ?? 0) || 0,
                  tasaMinima: normTasa(r.tasaMinima ?? r.tasaSeguro),
                  tasaMaxima: normTasa(r.tasaMaxima ?? r.tasaSeguro),
                  tasaDefault: normTasa(r.tasaDefault ?? r.tasaSeguro),
                }));

                return {
                  id: pk.id ?? idx + 1,
                  nombre: pkNombre,
                  tipo: 'Seguro',
                  montosYCoberturas,
                };
              });
            console.log('[CotizCredito] Producto paquetes raw:', paquetes.length, '→ seguros filtrados:', seguros.length, seguros);
            return seguros;
          })(),
          // Convenios — leer del producto real o fallback a mock
          convenios: Array.isArray(p.convenios) && p.convenios.length > 0
            ? p.convenios
            : (MOCK_CONVENIOS_CREDITO[clave] || []),
          // Amortizaciones — leer del JSONB del producto
          amortizaciones: Array.isArray(p.amortizaciones) && p.amortizaciones.length > 0
            ? p.amortizaciones.map((a: any) => ({
                metodo: a.metodo || '',
                predeterminado: !!a.predeterminado,
              }))
            : undefined,
        };
      });
    }
    // Fallback mock
    const mockCre: ProductoPickerItem[] = [
      { id: 'PC-001', claveProducto: 'PCRE-001', nombreProducto: 'Crédito Personal', tipoProducto: 'Crédito Individual', lineaProducto: 'Crédito', tasaBase: 18, matrizTasaFija: MOCK_MATRIZ_TASA_FIJA, garantias: MOCK_GARANTIAS, seguros: MOCK_SEGUROS, convenios: MOCK_CONVENIOS_CREDITO['PCRE-001'] || [] },
      { id: 'PC-002', claveProducto: 'PCRE-002', nombreProducto: 'Crédito Hipotecario', tipoProducto: 'Crédito Hipotecario', lineaProducto: 'Crédito', tasaBase: 12, matrizTasaFija: MOCK_MATRIZ_TASA_FIJA, garantias: MOCK_GARANTIAS, seguros: MOCK_SEGUROS, convenios: MOCK_CONVENIOS_CREDITO['PCRE-002'] || [] },
      { id: 'PC-003', claveProducto: 'PCRE-003', nombreProducto: 'Crédito Automotriz', tipoProducto: 'Crédito Consumo', lineaProducto: 'Crédito', tasaBase: 15.5, matrizTasaFija: MOCK_MATRIZ_TASA_FIJA, garantias: MOCK_GARANTIAS, seguros: MOCK_SEGUROS, convenios: MOCK_CONVENIOS_CREDITO['PCRE-003'] || [] },
    ];
    const mockLC: ProductoPickerItem[] = [
      { id: 'PL-001', claveProducto: 'PLDC-001', nombreProducto: 'Línea Revolvente Empresarial', tipoProducto: 'Línea Revolvente', lineaProducto: 'Línea de Crédito', tasaBase: 16, matrizTasaFija: MOCK_MATRIZ_TASA_FIJA, garantias: MOCK_GARANTIAS, seguros: MOCK_SEGUROS, convenios: MOCK_CONVENIOS_CREDITO['PLDC-001'] || [] },
      { id: 'PL-002', claveProducto: 'PLDC-002', nombreProducto: 'Línea Simple PyME', tipoProducto: 'Línea Simple', lineaProducto: 'Línea de Crédito', tasaBase: 14, matrizTasaFija: MOCK_MATRIZ_TASA_FIJA, garantias: MOCK_GARANTIAS, seguros: MOCK_SEGUROS, convenios: MOCK_CONVENIOS_CREDITO['PLDC-002'] || [] },
    ];
    return lineaProducto === 'Crédito' ? mockCre : mockLC;
  }, [isLineaCredito, productosCredito, productosLC, lineaProducto, productosSegurosDB]);

  /**
   * §3 — Filtrar productos por Institución Gobierno seleccionada + subvista Convenios.
   * Si no hay institución seleccionada, se muestran todos los productos.
   * Si hay institución, solo se muestran los que tienen un convenio que coincida
   * con la institución Y cuyo lineaProducto sea "Crédito" (o "Línea de Crédito").
   */
  const productoItems: ProductoPickerItem[] = useMemo(() => {
    const instGob = data.institucionGobierno?.trim() || '';
    if (!instGob) return allProductoItems; // sin filtro
    const targetLinea = isLineaCredito ? 'Línea de Crédito' : 'Crédito';
    return allProductoItems.filter(p =>
      p.convenios.some(c =>
        c.institucionNombre.toLowerCase().includes(instGob.toLowerCase())
        && (c.lineaProducto === targetLinea || c.lineaProducto === lineaProducto)
      )
    );
  }, [allProductoItems, data.institucionGobierno, isLineaCredito, lineaProducto]);

  // ── State ──
  const [activeTab, setActiveTab] = useState<'datos-generales' | 'tabla-amortizacion'>('datos-generales');
  const [showClienteModal, setShowClienteModal] = useState(false);
  const [clienteSearch, setClienteSearch] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Producto seleccionado (con sus subviews)
  const [selectedProducto, setSelectedProducto] = useState<ProductoPickerItem | null>(null);
  // Fila de Matriz Tasa Fija seleccionada
  const [selectedMatriz, setSelectedMatriz] = useState<MatrizTasaFijaRow | null>(null);

  // ═══════════════════════════════════════════════════════════════
  // RESTAURAR PRODUCTO Y MATRIZ AL EDITAR/VER
  // Cuando el modo es edit/view y los productos están cargados,
  // busca el producto que corresponde a la cotización guardada y
  // restaura selectedProducto + selectedMatriz para que las subviews
  // (matrizTasaFija, garantías, seguros) se muestren correctamente.
  // ═══════════════════════════════════════════════════════════════
  const restoredProductoRef = useRef(false);
  useEffect(() => {
    if (isCreate || restoredProductoRef.current) return;
    if (allProductoItems.length === 0) return;
    // Buscar producto por producto_id o claveProducto o nombreProducto
    const prodId = form.producto_id;
    const claveProd = data.producto?.claveProducto;
    const nombreProd = data.producto?.nombreProducto;
    const match = allProductoItems.find(p =>
      (prodId && p.id === prodId)
      || (claveProd && p.claveProducto === claveProd)
      || (nombreProd && p.nombreProducto === nombreProd)
    );
    if (match) {
      console.log('[CotizCredito] Restaurando producto en edit/view:', match.claveProducto, match.nombreProducto);
      setSelectedProducto(match);
      // Intentar restaurar la fila de Matriz Tasa Fija que corresponde a los valores guardados
      if (match.matrizTasaFija.length > 0 && data.plazo > 0) {
        const matrizMatch = match.matrizTasaFija.find(r =>
          data.plazo >= r.plazoMinimo && data.plazo <= r.plazoMaximo
          && data.montoSolicitado >= r.montoMinimo && data.montoSolicitado <= r.montoMaximo
        );
        if (matrizMatch) {
          setSelectedMatriz(matrizMatch);
          console.log('[CotizCredito] Restaurando fila de matriz:', matrizMatch);
        }
      }
      restoredProductoRef.current = true;
    }
  }, [isCreate, allProductoItems, form.producto_id, data.producto?.claveProducto, data.producto?.nombreProducto, data.plazo, data.montoSolicitado]);

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

  // ═══════════════════════════════════════════════════════════════
  // AUTO-CÁLCULOS
  // ═══════════════════════════════════════════════════════════════

  // Interés a Pagar + Pago por Periodo
  useEffect(() => {
    if (data.montoSolicitado <= 0 || data.tasaCotizada <= 0 || data.plazo <= 0) return;
    const freq = FRECUENCIAS_PAGO.find(f => f.label === data.periodo);
    const diasP = freq?.dias || 30;
    const pago = calcularPagoPeriodo(data.montoSolicitado, data.tasaCotizada, data.plazo, diasP);
    const interes = pago * data.plazo - data.montoSolicitado;
    const pagoSegPer = data.seguroFinanciado && data.totalSeguro > 0 ? Math.round((data.totalSeguro / data.plazo) * 100) / 100 : 0;
    const total = Math.round((pago + pagoSegPer) * 100) / 100;

    setData({
      pagoPeriodo: Math.round(pago * 100) / 100,
      interesAPagar: Math.round(Math.max(0, interes) * 100) / 100,
      pagoSeguroPeriodo: pagoSegPer,
      pagoTotal: total,
      // Compatibilidad
      pagoMensual: Math.round(pago * 100) / 100,
      interesTotal: Math.round(Math.max(0, interes) * 100) / 100,
      montoTotal: Math.round((data.montoSolicitado + Math.max(0, interes)) * 100) / 100,
    });
  }, [data.montoSolicitado, data.tasaCotizada, data.plazo, data.periodo, data.seguroFinanciado, data.totalSeguro]);

  // Monto Garantía = montoSolicitado × aforo
  useEffect(() => {
    if (data.aforo > 0 && data.montoSolicitado > 0) {
      setData({ montoGarantia: Math.round(data.montoSolicitado * data.aforo * 100) / 100 });
    }
  }, [data.montoSolicitado, data.aforo]);

  // ── Tabla amortización — spec §10 ──
  const tablaAmort = useMemo(() => {
    const segPer = data.seguroFinanciado && data.totalSeguro > 0 && data.plazo > 0
      ? data.totalSeguro / data.plazo
      : 0;
    return generarTablaAmortizacionCredito(
      data.montoSolicitado, data.tasaCotizada, data.plazo,
      data.periodo, data.fechaPrimerPago, data.tipoCalculoAmortizacion, segPer
    );
  }, [data.montoSolicitado, data.tasaCotizada, data.plazo, data.periodo, data.fechaPrimerPago, data.tipoCalculoAmortizacion, data.seguroFinanciado, data.totalSeguro]);

  useEffect(() => {
    setData({ tablaAmortizacion: tablaAmort });
  }, [tablaAmort]);

  // ═══════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════

  /** Mapea el nombre del método de amortización del producto al valor de TIPOS_CALCULO_AMORTIZACION */
  const mapMetodoToTipoCalculo = (metodo: string): string => {
    const m = (metodo || '').toLowerCase();
    if (m.includes('francés') || m.includes('frances') || m.includes('cuota fija')) return 'Francés';
    if (m.includes('alemán') || m.includes('aleman') || m.includes('amortización fija') || m.includes('amortizacion fija')) return 'Alemán';
    if (m.includes('americano') || m.includes('bullet')) return 'Americano';
    if (m.includes('flat') || m.includes('interés global') || m.includes('interes global') || m.includes('simple')) return 'Simple';
    // Fallback: intentar match directo con TIPOS_CALCULO_AMORTIZACION
    const exact = TIPOS_CALCULO_AMORTIZACION.find(t => t.toLowerCase() === m);
    return exact || 'Francés';
  };

  const handleSelectProducto = (prod: ProductoPickerItem) => {
    setSelectedProducto(prod);
    setSelectedMatriz(null); // reset matriz selection

    // §Amortización: obtener el método predeterminado del producto
    let tipoCotizCalculo = 'Francés'; // default si no hay datos
    if (prod.amortizaciones && prod.amortizaciones.length > 0) {
      const predeterminado = prod.amortizaciones.find(a => a.predeterminado);
      if (predeterminado) {
        tipoCotizCalculo = mapMetodoToTipoCalculo(predeterminado.metodo);
      }
    }
    console.log('[CotizCredito] Producto amortizaciones:', prod.amortizaciones, '→ tipoCalculo:', tipoCotizCalculo);

    setData({
      producto: {
        claveProducto: prod.claveProducto,
        nombreProducto: prod.nombreProducto,
        tipoProducto: prod.tipoProducto,
        lineaProducto: prod.lineaProducto,
      },
      moneda: 'MXN',
      // Cálculo de amortización desde el predeterminado del producto
      tipoCalculoAmortizacion: tipoCotizCalculo,
      // Reset matriz fields
      periodo: 'Mensual',
      plazoMinimo: 0, plazoMaximo: 0, plazo: 0,
      montoMinimo: 0, montoMaximo: 0, montoSolicitado: 0,
      tasaMinima: 0, tasaMaxima: 0, tasaCotizada: 0,
      // Reset garantía
      tipoGarantia: '', subtipoGarantia: '', aforo: 0, montoGarantia: 0,
      // Reset seguro
      seguroFinanciado: false, seguroNombre: '', montoSeguro: 0, tasaSeguro: 0, totalSeguro: 0,
    });
    setForm(prev => ({ ...prev, producto_id: prod.id }));
  };

  /** §4 — Seleccionar fila de Matriz Tasa Fija → pick-map */
  const handleSelectMatriz = (row: MatrizTasaFijaRow) => {
    setSelectedMatriz(row);
    setData({
      periodo: row.periodo,
      plazoMinimo: row.plazoMinimo,
      plazoMaximo: row.plazoMaximo,
      plazo: row.plazoDefault,
      montoMinimo: row.montoMinimo,
      montoMaximo: row.montoMaximo,
      montoSolicitado: row.montoDefault,
      tasaMinima: row.tasaMinima,
      tasaMaxima: row.tasaMaxima,
      tasaCotizada: row.tasaDefault,
      moneda: row.moneda,
      frecuenciaPago: row.periodo,
    });
  };

  /** §5 — Seleccionar garantía → pick-map */
  const handleSelectGarantia = (g: GarantiaProducto) => {
    const montoGar = data.montoSolicitado > 0
      ? Math.round(data.montoSolicitado * g.aforo * 100) / 100
      : 0;
    setData({
      tipoGarantia: g.tipoGarantia,
      subtipoGarantia: g.subtipoGarantia,
      aforo: g.aforo,
      montoGarantia: montoGar,
    });
  };

  /** §7 — Seleccionar seguro y encontrar fila filtrada desde Montos y Coberturas */
  const handleSelectSeguro = (seg: SeguroProducto) => {
    // Buscar fila de Montos y Coberturas que haga match con plazo y monto de la cotización
    const matchingRow = seg.montosYCoberturas.find(
      r => data.plazo >= r.plazoMinimo && data.plazo <= r.plazoMaximo
        && data.montoSolicitado >= r.montoMinimo && data.montoSolicitado <= r.montoMaximo
    );
    if (matchingRow) {
      const montoSeg = matchingRow.montoDefault;
      const tasaSeg = matchingRow.tasaDefault;
      const totalSeg = Math.round(montoSeg * (1 + tasaSeg * data.plazo) * 100) / 100;
      setData({
        seguroNombre: seg.nombre,
        montoSeguro: montoSeg,
        tasaSeguro: tasaSeg,
        totalSeguro: totalSeg,
      });
    } else {
      toast.warning('No se encontró registro de Montos y Coberturas para el plazo/monto seleccionado', {
        description: `Plazo: ${data.plazo}, Monto: ${data.montoSolicitado}. Verifique la configuración del Producto Seguro.`,
      });
      setData({
        seguroNombre: seg.nombre,
        montoSeguro: 0,
        tasaSeguro: 0,
        totalSeguro: 0,
      });
    }
  };

  const handleSelectCliente = (cl: { id: string; idCliente: string; nombreCompleto: string }) => {
    setData({ cliente: { claveCliente: cl.idCliente, nombreCompleto: cl.nombreCompleto } });
    setForm(prev => ({ ...prev, cliente_id: cl.id }));
    setShowClienteModal(false);
  };

  /** §10 — Botón COTIZAR */
  const handleCotizar = () => {
    const result = validarCotizacionCredito(form);
    if (!result.valid) {
      setValidationErrors(result.errors);
      toast.error('Errores de validación', { description: `${result.errors.length} error(es)` });
      return;
    }
    setValidationErrors([]);
    // La tabla se genera reactivamente via useMemo, solo cambiar al tab
    setActiveTab('tabla-amortizacion');
    toast.success('Tabla de amortización generada');
  };

  const handleSubmit = () => {
    const result = validarCotizacionCredito(form);
    if (!result.valid) {
      setValidationErrors(result.errors);
      toast.error('Errores de validación', { description: `${result.errors.length} error(es)` });
      return;
    }
    setValidationErrors([]);
    onSave(form);
  };

  // ── Classes ──
  const fieldClass = isView
    ? 'w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded text-gray-700'
    : 'w-full px-3 py-2 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  const readonlyClass = 'w-full px-3 py-2 text-xs bg-gray-100 border border-gray-200 rounded text-gray-500';
  const errorField = 'border-red-400 bg-red-50';

  const tabs = [
    { id: 'datos-generales' as const, label: 'Datos Generales' },
    { id: 'tabla-amortizacion' as const, label: 'Tabla de Amortización' },
  ];

  const filteredClientes = clienteItems.filter(cl => {
    const s = clienteSearch.toLowerCase();
    return cl.idCliente.toLowerCase().includes(s) || cl.nombreCompleto.toLowerCase().includes(s);
  });

  // Subviews del producto seleccionado
  const matrizRows = selectedProducto?.matrizTasaFija || [];
  const garantiaRows = selectedProducto?.garantias || [];

  const seguroRows = (selectedProducto?.seguros || []).filter(s => s.tipo === 'Seguro');

  // Validaciones en tiempo real — spec §9
  const plazoErr = data.plazoMinimo > 0 && data.plazo > 0 && (data.plazo < data.plazoMinimo || data.plazo > data.plazoMaximo);
  const montoErr = data.montoMinimo > 0 && data.montoSolicitado > 0 && (data.montoSolicitado < data.montoMinimo || data.montoSolicitado > data.montoMaximo);
  const tasaErr = data.tasaMinima > 0 && data.tasaCotizada > 0 && (data.tasaCotizada < data.tasaMinima || data.tasaCotizada > data.tasaMaxima);

  const formatDateCalendar = (dateStr: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${d.getDate().toString().padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  return (
    <div className="bg-white min-h-screen">
      {/* ═══ Header ═══ */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <path d="M14 2v6h6" /><path d="M16 13H8M16 17H8M10 9H8" />
            </svg>
            <h2 className="text-lg font-normal text-gray-800">
              {isCreate ? `Nueva Cotización — ${lineaProducto}` : mode === 'edit' ? `Editar Cotización — ${lineaProducto}` : `Ver Cotización — ${lineaProducto}`}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {!isView && (
              <>
                <button onClick={handleCotizar} className="px-5 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 flex items-center gap-1">
                  <Calculator className="w-4 h-4" />COTIZAR
                </button>
                <button onClick={handleSubmit} className="px-5 py-1.5 btn-secondary-theme rounded text-sm font-medium">
                  {isCreate ? 'Crear Cotización' : 'Guardar Cambios'}
                </button>
              </>
            )}
            {/* Botón "Crear Solicitud" — spec solicitudes-financieras §1, R1 */}
            {onCrearSolicitud && cotizacion && (
              <button
                onClick={() => onCrearSolicitud(cotizacion)}
                disabled={cotizacion.estatus_cotiza === 'Aceptada'}
                className={`px-4 py-1.5 rounded text-sm font-medium flex items-center gap-1.5 ${
                  cotizacion.estatus_cotiza === 'Aceptada'
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-[#0E7B1F] text-white hover:bg-[#0A6118]'
                }`}
                title={cotizacion.estatus_cotiza === 'Aceptada' ? 'Cotización ya aceptada — solicitud generada' : 'Crear Solicitud desde esta Cotización'}
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

      {/* ═══ Errores ═══ */}
      {validationErrors.length > 0 && (
        <div className="mx-4 mt-3 border border-red-300 bg-red-50 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-xs font-medium text-red-800">Errores ({validationErrors.length})</span>
          </div>
          <ul className="space-y-1">
            {validationErrors.map((err, i) => <li key={i} className="text-[11px] text-red-700 pl-4">• {err}</li>)}
          </ul>
        </div>
      )}

      {/* ═══ Body ═══ */}
      <div className="px-4 py-3">
        <div className="bg-white border border-gray-300">
          {/* Info principal */}
          <div className="border-l-4 border-primary-theme px-3 py-1.5">
            <span className="text-xs font-medium text-gray-800 uppercase">Información Principal</span>
          </div>
          <div className={`grid grid-cols-1 ${isLineaCredito ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-4 p-4`}>
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-1">ID-COTIZACIÓN</label>
              <input value={form.no_cotiza} disabled className={readonlyClass} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-1">Línea de Producto</label>
              <input value={lineaProducto} disabled className={readonlyClass} />
            </div>
            {isLineaCredito && (
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-1">Tipo de Línea</label>
                <select
                  value={data.tipoLinea || ''}
                  disabled={isView}
                  onChange={e => setData({ tipoLinea: e.target.value as any })}
                  className={fieldClass}
                >
                  <option value="">— Seleccionar —</option>
                  <option value="Fija">Fija</option>
                  <option value="Revolvente">Revolvente</option>
                </select>
              </div>
            )}
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-1">Fecha Cotización</label>
              <input value={new Date(form.fecha_cotiza).toLocaleString('es-MX')} disabled className={readonlyClass} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-600 mb-1">Estatus</label>
              <input value={form.estatus_cotiza} disabled className={readonlyClass} />
            </div>
          </div>

          {/* ═══ Tabs ═══ */}
          <div className="bg-primary-theme border-t border-gray-400">
            <div className="flex items-center overflow-x-auto">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-[10px] whitespace-nowrap border-r border-gray-500/30 ${
                    activeTab === tab.id ? 'bg-secondary-theme text-white font-medium' : 'text-white/90'
                  }`}
                  onMouseEnter={(e) => { if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = 'var(--theme-primary-hover)'; }}
                  onMouseLeave={(e) => { if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = ''; }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ═══════════ TAB: DATOS GENERALES ═══════════ */}
          {activeTab === 'datos-generales' && (
            <div className="p-0">

              {/* ── §2.1 Prospecto/Cliente ── */}
              <div className="border-t border-gray-300">
                <div className="border-l-4 border-primary-theme px-3 py-1.5">
                  <span className="text-xs font-medium text-gray-800 uppercase">Prospecto / Cliente</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                  <div className="flex flex-col">
                    <label className="text-[10px] text-gray-600 mb-1">Clave Cliente</label>
                    <input value={data.cliente.claveCliente} disabled className={readonlyClass} />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] text-gray-600 mb-1">Nombre Completo <span className="text-red-500">*</span></label>
                    <div className="flex gap-1">
                      <input value={data.cliente.nombreCompleto} disabled className={`${readonlyClass} flex-1`} />
                      {!isView && (
                        <button onClick={() => setShowClienteModal(true)} className="px-2 py-1 bg-blue-50 border border-blue-300 rounded text-blue-700 hover:bg-blue-100 text-xs whitespace-nowrap">
                          <Search className="w-3 h-3 inline mr-1" />Buscar
                        </button>
                      )}
                    </div>
                  </div>
                  {/* §1 — Institución Gobierno: modal de búsqueda filtrado por clasificacionCliente = "Gobierno Magisterio" */}
                  <CampoInstitucionGobierno
                    value={data.institucionGobierno || ''}
                    onChange={(value, institucion) => {
                      setData({ institucionGobierno: value });
                      // Al cambiar institución, limpiar producto si ya no aplica
                      if (selectedProducto && value) {
                        const targetLinea = isLineaCredito ? 'Línea de Crédito' : 'Crédito';
                        const match = selectedProducto.convenios.some(c =>
                          c.institucionNombre.toLowerCase().includes(value.toLowerCase())
                          && (c.lineaProducto === targetLinea || c.lineaProducto === lineaProducto)
                        );
                        if (!match) {
                          setSelectedProducto(null);
                          setSelectedMatriz(null);
                          setData({
                            institucionGobierno: value,
                            producto: { claveProducto: '', nombreProducto: '', tipoProducto: '', lineaProducto: lineaProducto },
                          });
                          setForm(prev => ({ ...prev, producto_id: '' }));
                          toast.info('Producto desmarcado — no tiene convenio con la institución seleccionada');
                        }
                      }
                    }}
                    disabled={isView}
                    variant="clientes"
                  />
                </div>
              </div>

              {/* ── §3 Producto — filtrado por Institución Gobierno + Convenios ── */}
              <div className="border-t border-gray-300">
                <div className="border-l-4 border-primary-theme px-3 py-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-800 uppercase">Producto</span>
                  {data.institucionGobierno && (
                    <span className="text-[9px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                      Filtrado por convenio: {data.institucionGobierno} ({productoItems.length} de {allProductoItems.length} productos)
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
                  <div className="flex flex-col md:col-span-2">
                    <label className="text-[10px] text-gray-600 mb-1">Producto <span className="text-red-500">*</span> <span className="text-[9px] text-gray-400">(lineaProducto={lineaProducto})</span></label>
                    <select
                      value={data.producto.claveProducto}
                      disabled={isView}
                      onChange={e => {
                        const prod = productoItems.find(p => p.claveProducto === e.target.value);
                        if (prod) handleSelectProducto(prod);
                      }}
                      className={fieldClass}
                    >
                      <option value="">{productoItems.length === 0 && data.institucionGobierno ? '— Sin productos con convenio para esta institución —' : '— Seleccionar producto —'}</option>
                      {productoItems.map(p => <option key={p.id} value={p.claveProducto}>{p.nombreProducto} ({p.claveProducto})</option>)}
                    </select>
                    {productoItems.length === 0 && data.institucionGobierno && (
                      <span className="text-[9px] text-amber-600 mt-0.5">No hay productos con convenio para "{data.institucionGobierno}". Cambie la institución o déjela vacía para ver todos.</span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] text-gray-600 mb-1">Clave Producto</label>
                    <input value={data.producto.claveProducto} disabled className={readonlyClass} />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] text-gray-600 mb-1">Moneda</label>
                    <input value={data.moneda || 'MXN'} disabled className={readonlyClass} />
                  </div>
                </div>
              </div>

              {/* ── §4 Plazos y Montos (Matriz Tasa Fija) ── */}
              <div className="border-t border-gray-300">
                <div className="border-l-4 border-primary-theme px-3 py-1.5">
                  <span className="text-xs font-medium text-gray-800 uppercase">Plazos y Montos — Matriz Tasa Fija</span>
                </div>
                <div className="p-4 space-y-4">
                  {matrizRows.length > 0 ? (
                    <div className="border border-gray-300 overflow-x-auto max-h-[200px] overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0">
                          <tr className="bg-gray-100 border-b border-gray-300">
                            <th className="px-2 py-2 text-center font-normal text-gray-700">Sel.</th>
                            <th className="px-2 py-2 text-left font-normal text-gray-700">Periodo</th>
                            <th className="px-2 py-2 text-right font-normal text-gray-700">Plazo Mín</th>
                            <th className="px-2 py-2 text-right font-normal text-gray-700">Plazo Máx</th>
                            <th className="px-2 py-2 text-right font-normal text-gray-700">Monto Mín</th>
                            <th className="px-2 py-2 text-right font-normal text-gray-700">Monto Máx</th>
                            <th className="px-2 py-2 text-right font-normal text-gray-700">Tasa Mín %</th>
                            <th className="px-2 py-2 text-right font-normal text-gray-700">Tasa Máx %</th>
                            <th className="px-2 py-2 text-center font-normal text-gray-700">Moneda</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matrizRows.map((row, idx) => (
                            <tr
                              key={row.id}
                              className={`border-b border-gray-200 cursor-pointer transition-colors ${
                                selectedMatriz?.id === row.id ? 'bg-blue-100 ring-1 ring-blue-400' : ''
                              }`}
                              style={selectedMatriz?.id !== row.id ? { backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' } : undefined}
                              onClick={() => !isView && handleSelectMatriz(row)}
                              onMouseEnter={e => { if (selectedMatriz?.id !== row.id) e.currentTarget.style.backgroundColor = '#E8F4F8'; }}
                              onMouseLeave={e => { if (selectedMatriz?.id !== row.id) e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'; }}
                            >
                              <td className="px-2 py-1.5 text-center">
                                {selectedMatriz?.id === row.id
                                  ? <CheckCircle2 className="w-4 h-4 text-blue-600 mx-auto" />
                                  : <span className="w-4 h-4 border border-gray-400 rounded-full block mx-auto" />
                                }
                              </td>
                              <td className="px-2 py-1.5 text-gray-700">{row.periodo}</td>
                              <td className="px-2 py-1.5 text-right text-gray-700">{row.plazoMinimo}</td>
                              <td className="px-2 py-1.5 text-right text-gray-700">{row.plazoMaximo}</td>
                              <td className="px-2 py-1.5 text-right text-gray-700">{formatMoney(row.montoMinimo)}</td>
                              <td className="px-2 py-1.5 text-right text-gray-700">{formatMoney(row.montoMaximo)}</td>
                              <td className="px-2 py-1.5 text-right text-gray-700">{row.tasaMinima}%</td>
                              <td className="px-2 py-1.5 text-right text-gray-700">{row.tasaMaxima}%</td>
                              <td className="px-2 py-1.5 text-center text-gray-700">{row.moneda}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 text-xs py-4">
                      Seleccione un producto para ver la Matriz Tasa Fija
                    </div>
                  )}

                  {/* Campos editables de la Matriz — §4 pick-map */}
                  {selectedMatriz && (
                    <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-3">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span className="text-[10px] font-medium text-blue-800">Fila seleccionada — Periodo: {selectedMatriz.periodo}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Plazo */}
                        <div className="flex flex-col">
                          <label className="text-[10px] text-gray-600 mb-1">
                            Plazo <span className="text-red-500">*</span>
                            <span className="text-gray-400 ml-1">({data.plazoMinimo}–{data.plazoMaximo})</span>
                          </label>
                          <input
                            type="number"
                            value={data.plazo || ''}
                            disabled={isView}
                            min={data.plazoMinimo}
                            max={data.plazoMaximo}
                            onChange={e => setData({ plazo: parseInt(e.target.value) || 0 })}
                            className={`${fieldClass} ${!isView && plazoErr ? errorField : ''}`}
                          />
                          {!isView && plazoErr && (
                            <span className="text-[9px] text-red-600 mt-0.5">Plazo debe estar entre {data.plazoMinimo} y {data.plazoMaximo}</span>
                          )}
                        </div>
                        {/* Monto Solicitado */}
                        <div className="flex flex-col">
                          <label className="text-[10px] text-gray-600 mb-1">
                            Monto Solicitado <span className="text-red-500">*</span>
                            <span className="text-gray-400 ml-1">({formatMoney(data.montoMinimo)}–{formatMoney(data.montoMaximo)})</span>
                          </label>
                          <input
                            type="number"
                            value={data.montoSolicitado || ''}
                            disabled={isView}
                            onChange={e => setData({ montoSolicitado: parseFloat(e.target.value) || 0 })}
                            className={`${fieldClass} ${!isView && montoErr ? errorField : ''}`}
                          />
                          {!isView && montoErr && (
                            <span className="text-[9px] text-red-600 mt-0.5">Monto debe estar entre {formatMoney(data.montoMinimo)} y {formatMoney(data.montoMaximo)}</span>
                          )}
                        </div>
                        {/* Tasa Cotizada */}
                        <div className="flex flex-col">
                          <label className="text-[10px] text-gray-600 mb-1">
                            Tasa Cotizada (%) <span className="text-red-500">*</span>
                            <span className="text-gray-400 ml-1">({data.tasaMinima}%–{data.tasaMaxima}%)</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={data.tasaCotizada || ''}
                            disabled={isView}
                            onChange={e => setData({ tasaCotizada: parseFloat(e.target.value) || 0 })}
                            className={`${fieldClass} ${!isView && tasaErr ? errorField : ''}`}
                          />
                          {!isView && tasaErr && (
                            <span className="text-[9px] text-red-600 mt-0.5">Tasa debe estar entre {data.tasaMinima}% y {data.tasaMaxima}%</span>
                          )}
                        </div>
                      </div>
                      {/* Readonly: periodo, moneda */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex flex-col">
                          <label className="text-[10px] text-gray-600 mb-1">Periodo <span className="text-[9px] text-gray-400">(lectura)</span></label>
                          <input value={data.periodo} disabled className={readonlyClass} />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[10px] text-gray-600 mb-1">Moneda <span className="text-[9px] text-gray-400">(lectura)</span></label>
                          <input value={data.moneda} disabled className={readonlyClass} />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[10px] text-gray-600 mb-1">Tipo Tasa</label>
                          <select value={data.tipoTasa} disabled={isView} onChange={e => setData({ tipoTasa: e.target.value })} className={fieldClass}>
                            {TIPOS_TASA.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── §5 Garantía ── */}
              <div className="border-t border-gray-300">
                <div className="border-l-4 border-primary-theme px-3 py-1.5 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-gray-600" />
                  <span className="text-xs font-medium text-gray-800 uppercase">Garantía</span>
                </div>
                <div className="p-4 space-y-4">
                  {garantiaRows.length > 0 && selectedProducto ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col">
                        <label className="text-[10px] text-gray-600 mb-1">Garantía <span className="text-[9px] text-gray-400">(catálogo del producto)</span></label>
                        <select
                          value={data.tipoGarantia ? `${data.tipoGarantia}|${data.subtipoGarantia}` : ''}
                          disabled={isView}
                          onChange={e => {
                            const [tipo, sub] = e.target.value.split('|');
                            const g = garantiaRows.find(gr => gr.tipoGarantia === tipo && gr.subtipoGarantia === sub);
                            if (g) handleSelectGarantia(g);
                          }}
                          className={fieldClass}
                        >
                          <option value="">— Seleccionar garantía —</option>
                          {garantiaRows.map(g => (
                            <option key={g.id} value={`${g.tipoGarantia}|${g.subtipoGarantia}`}>
                              {g.tipoGarantia} — {g.subtipoGarantia} (Aforo: {(g.aforo * 100).toFixed(0)}%)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col">
                          <label className="text-[10px] text-gray-600 mb-1">Tipo</label>
                          <input value={data.tipoGarantia || '—'} disabled className={readonlyClass} />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[10px] text-gray-600 mb-1">% Aforo</label>
                          <input value={data.aforo ? `${(data.aforo * 100).toFixed(0)}%` : '—'} disabled className={readonlyClass} />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-[10px] text-gray-600 mb-1">Monto Garantía <span className="text-[9px] text-gray-400">(calc)</span></label>
                          <input value={data.montoGarantia ? formatMoney(data.montoGarantia) : '—'} disabled className={readonlyClass} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-400 text-xs py-2">Seleccione un producto para ver garantías disponibles</div>
                  )}
                </div>
              </div>

              {/* ── §6 Cálculo de Amortización ── */}
              <div className="border-t border-gray-300">
                <div className="border-l-4 border-primary-theme px-3 py-1.5">
                  <span className="text-xs font-medium text-gray-800 uppercase">Condiciones del Crédito</span>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Cálculo de Amortización <span className="text-red-500">*</span></label>
                      <select
                        value={data.tipoCalculoAmortizacion}
                        disabled={isView}
                        onChange={e => setData({ tipoCalculoAmortizacion: e.target.value })}
                        className={fieldClass}
                      >
                        {TIPOS_CALCULO_AMORTIZACION.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    {/* §8 Fecha de Primer Pago */}
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">
                        Fecha Primer Pago <span className="text-red-500">*</span>
                      </label>
                      <div className="relative" ref={datePickerRef}>
                        <button
                          type="button"
                          disabled={isView}
                          onClick={() => !isView && setShowDatePicker(prev => !prev)}
                          className={`${fieldClass} text-left flex items-center justify-between cursor-pointer ${
                            !isView && !data.fechaPrimerPago ? 'border-red-400 bg-red-50' : ''
                          }`}
                        >
                          <span className={data.fechaPrimerPago ? 'text-gray-800' : 'text-gray-400'}>
                            {data.fechaPrimerPago
                              ? format(parse(data.fechaPrimerPago, 'yyyy-MM-dd', new Date()), "dd 'de' MMMM 'de' yyyy", { locale: es })
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
                                data.fechaPrimerPago
                                  ? parse(data.fechaPrimerPago, 'yyyy-MM-dd', new Date())
                                  : new Date()
                              }
                              selected={
                                data.fechaPrimerPago
                                  ? parse(data.fechaPrimerPago, 'yyyy-MM-dd', new Date())
                                  : undefined
                              }
                              onSelect={(date) => {
                                if (date && isValid(date)) {
                                  setData({ fechaPrimerPago: format(date, 'yyyy-MM-dd') });
                                }
                                setShowDatePicker(false);
                              }}
                              styles={{
                                caption: { color: 'var(--theme-primary)' },
                                day: { borderRadius: '6px' },
                              }}
                              modifiersStyles={{
                                selected: { backgroundColor: 'var(--theme-primary)', color: 'white' },
                                today: { fontWeight: 'bold', border: '1px solid var(--theme-primary)', borderRadius: '6px' },
                              }}
                            />
                            <div className="border-t border-gray-200 pt-2 mt-1 flex items-center justify-between px-1">
                              <button
                                type="button"
                                onClick={() => { setData({ fechaPrimerPago: format(new Date(), 'yyyy-MM-dd') }); setShowDatePicker(false); }}
                                className="text-[10px] text-blue-600 hover:text-blue-800"
                              >
                                Hoy
                              </button>
                              {data.fechaPrimerPago && (
                                <button
                                  type="button"
                                  onClick={() => { setData({ fechaPrimerPago: '' }); setShowDatePicker(false); }}
                                  className="text-[10px] text-red-500 hover:text-red-700"
                                >
                                  Limpiar
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Descripción</label>
                      <input
                        type="text"
                        value={form.descripcion}
                        disabled={isView}
                        onChange={e => setForm(prev => ({ ...prev, descripcion: e.target.value }))}
                        placeholder="Descripción..."
                        className={fieldClass}
                        maxLength={255}
                      />
                    </div>
                  </div>

                  {/* §7 Seguro Financiado — Montos y Coberturas del Producto Seguro (tabla seleccionable) */}
                  <div className="border-2 border-gray-400 bg-[#FAFBFC]">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#2E5C91] to-[#4A6FA5] px-3 py-1.5 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-white" />
                      <span className="text-[11px] font-semibold text-white uppercase tracking-wider">Seguro Financiado</span>
                      <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
                        <input
                          type="checkbox"
                          checked={data.seguroFinanciado}
                          disabled={isView}
                          onChange={e => {
                            const checked = e.target.checked;
                            setData({
                              seguroFinanciado: checked,
                              ...(checked ? {} : { seguroNombre: '', montoSeguro: 0, tasaSeguro: 0, totalSeguro: 0 }),
                            });
                          }}
                          className="w-3.5 h-3.5 text-white rounded-sm"
                        />
                        <span className="text-[10px] text-white/90 font-medium">Incluir</span>
                      </label>
                    </div>

                    {data.seguroFinanciado && (
                      <div className="p-4 space-y-4">
                        {/* Paso 1: Seleccionar Seguro del catálogo (Paquetes del Producto) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex flex-col">
                            <label className="text-[11px] text-gray-600 mb-1 uppercase tracking-wider font-medium">Seguro <span className="text-[9px] text-gray-400 normal-case tracking-normal">(Paquetes del Producto)</span></label>
                            <select
                              value={data.seguroNombre}
                              disabled={isView}
                              onChange={e => {
                                const nombre = e.target.value;
                                // Solo setear nombre, resetear valores — el usuario debe seleccionar fila de M&C
                                setData({
                                  seguroNombre: nombre,
                                  montoSeguro: 0,
                                  tasaSeguro: 0,
                                  totalSeguro: 0,
                                });
                              }}
                              className={fieldClass}
                            >
                              <option value="">— Seleccionar Seguro —</option>
                              {seguroRows.map(s => <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                            </select>
                          </div>
                          {data.seguroNombre && (() => {
                            const seg = seguroRows.find(s => s.nombre === data.seguroNombre);
                            const mc = seg?.montosYCoberturas || [];
                            return (
                              <div className="flex items-end pb-1">
                                {mc.length > 0 ? (
                                  <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-1 font-medium">
                                    {mc.length} registro(s) en Montos y Coberturas
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-300 px-2 py-1 font-medium">
                                    Sin registros de Montos y Coberturas configurados
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Paso 2: Tabla de Montos y Coberturas — Plazos y Montos del Seguro (pick row) */}
                        {data.seguroNombre && (() => {
                          const seg = seguroRows.find(s => s.nombre === data.seguroNombre);
                          const mcRows = seg?.montosYCoberturas || [];
                          if (mcRows.length === 0) return (
                            <div className="text-[10px] text-gray-500 italic py-2">
                              No hay registros de Montos y Coberturas para este seguro. Configure el subtab "Montos y Coberturas" en el Producto Seguro.
                            </div>
                          );

                          // Determinar cuál fila está seleccionada (por match de montoDefault + tasaDefault)
                          const selectedMCIdx = mcRows.findIndex(
                            r => data.montoSeguro > 0 && r.montoDefault === data.montoSeguro && r.tasaDefault === data.tasaSeguro
                          );

                          return (
                            <div>
                              <p className="text-[11px] text-gray-700 font-medium uppercase tracking-wider mb-1.5">Plazos y Montos del Seguro</p>
                              <div className="overflow-x-auto border-2 border-gray-400">
                                <table className="w-full text-[10px]">
                                  <thead>
                                    <tr className="bg-[#2E5C91] text-white">
                                      <th className="px-2 py-1.5 text-center w-8"></th>
                                      <th className="px-2 py-1.5 text-center">Periodo</th>
                                      <th className="px-2 py-1.5 text-center">Plazo Min</th>
                                      <th className="px-2 py-1.5 text-center">Plazo Max</th>
                                      <th className="px-2 py-1.5 text-center">Plazo Def</th>
                                      <th className="px-2 py-1.5 text-center">Monto Min</th>
                                      <th className="px-2 py-1.5 text-center">Monto Max</th>
                                      <th className="px-2 py-1.5 text-center font-bold">Monto Default</th>
                                      <th className="px-2 py-1.5 text-center">Tasa Min</th>
                                      <th className="px-2 py-1.5 text-center">Tasa Max</th>
                                      <th className="px-2 py-1.5 text-center font-bold">Tasa Default</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {mcRows.map((row, idx) => {
                                      const isSelected = selectedMCIdx === idx;
                                      return (
                                        <tr
                                          key={idx}
                                          className={`border-b border-gray-200 cursor-pointer transition-colors ${
                                            isSelected ? 'bg-blue-100 ring-1 ring-blue-400' : ''
                                          }`}
                                          style={!isSelected ? { backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' } : undefined}
                                          onClick={() => {
                                            if (isView) return;
                                            const montoSeg = row.montoDefault;
                                            const tasaSeg = row.tasaDefault;
                                            const totalSeg = Math.round(montoSeg * (1 + tasaSeg * data.plazo) * 100) / 100;
                                            setData({
                                              montoSeguro: montoSeg,
                                              tasaSeguro: tasaSeg,
                                              totalSeguro: totalSeg,
                                            });
                                          }}
                                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = '#E8F4F8'; }}
                                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'; }}
                                        >
                                          <td className="px-2 py-1.5 text-center">
                                            {isSelected
                                              ? <CheckCircle2 className="w-4 h-4 text-blue-600 mx-auto" />
                                              : <span className="w-4 h-4 border border-gray-400 rounded-full block mx-auto" />
                                            }
                                          </td>
                                          <td className="px-2 py-1.5 text-center">{row.periodo}</td>
                                          <td className="px-2 py-1.5 text-center">{row.plazoMinimo}</td>
                                          <td className="px-2 py-1.5 text-center">{row.plazoMaximo}</td>
                                          <td className="px-2 py-1.5 text-center font-medium">{row.plazoDefault}</td>
                                          <td className="px-2 py-1.5 text-right">{formatMoney(row.montoMinimo)}</td>
                                          <td className="px-2 py-1.5 text-right">{formatMoney(row.montoMaximo)}</td>
                                          <td className="px-2 py-1.5 text-right font-bold text-blue-800">{formatMoney(row.montoDefault)}</td>
                                          <td className="px-2 py-1.5 text-center">{(row.tasaMinima * 100).toFixed(4)}%</td>
                                          <td className="px-2 py-1.5 text-center">{(row.tasaMaxima * 100).toFixed(4)}%</td>
                                          <td className="px-2 py-1.5 text-center font-bold text-blue-800">{(row.tasaDefault * 100).toFixed(4)}%</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Paso 3: Campos mapeados (solo lectura) — aparecen al seleccionar fila */}
                        {data.montoSeguro > 0 && (
                          <div className="bg-blue-50 border border-blue-200 p-3 space-y-3">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle2 className="w-4 h-4 text-blue-600" />
                              <span className="text-[10px] font-medium text-blue-800 uppercase tracking-wider">Valores del Seguro (desde Montos y Coberturas)</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="flex flex-col">
                                <label className="text-[11px] text-gray-600 mb-1 uppercase tracking-wider font-medium">Monto Seguro <span className="text-[9px] text-gray-400 normal-case tracking-normal">(Monto Default)</span></label>
                                <input value={formatMoney(data.montoSeguro)} disabled className={readonlyClass} />
                              </div>
                              <div className="flex flex-col">
                                <label className="text-[11px] text-gray-600 mb-1 uppercase tracking-wider font-medium">Tasa Seguro <span className="text-[9px] text-gray-400 normal-case tracking-normal">(Tasa Default)</span></label>
                                <input value={`${(data.tasaSeguro * 100).toFixed(4)}%`} disabled className={readonlyClass} />
                              </div>
                              <div className="flex flex-col">
                                <label className="text-[11px] text-gray-600 mb-1 uppercase tracking-wider font-medium">Total Seguro <span className="text-[9px] text-gray-400 normal-case tracking-normal">(calc)</span></label>
                                <input value={formatMoney(data.totalSeguro)} disabled className={readonlyClass} />
                                <span className="text-[9px] text-gray-400 mt-0.5">= Monto x (1 + Tasa x Plazo:{data.plazo})</span>
                              </div>
                              <div className="flex flex-col">
                                <label className="text-[11px] text-gray-600 mb-1 uppercase tracking-wider font-medium">Fecha Primer Pago <span className="text-red-500">*</span></label>
                                <input
                                  type="date"
                                  value={data.fechaPrimerPago || ''}
                                  disabled={isView}
                                  onChange={e => setData({ fechaPrimerPago: e.target.value })}
                                  className={fieldClass}
                                />
                                <span className="text-[9px] text-gray-400 mt-0.5">Base para las fechas de pago del seguro</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Campos calculados */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Pago por Periodo <span className="text-[9px] text-gray-400">(calc)</span></label>
                      <input value={data.pagoPeriodo ? formatMoney(data.pagoPeriodo) : '$0.00'} disabled className={readonlyClass} />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Interés a Pagar <span className="text-[9px] text-gray-400">(calc)</span></label>
                      <input value={data.interesAPagar ? formatMoney(data.interesAPagar) : '$0.00'} disabled className={readonlyClass} />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Pago Seguro/Periodo <span className="text-[9px] text-gray-400">(calc)</span></label>
                      <input value={data.pagoSeguroPeriodo ? formatMoney(data.pagoSeguroPeriodo) : '$0.00'} disabled className={readonlyClass} />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-1">Pago Total <span className="text-[9px] text-gray-400">(Periodo + Seguro)</span></label>
                      <input value={data.pagoTotal ? formatMoney(data.pagoTotal) : '$0.00'} disabled className={`${readonlyClass} font-medium`} />
                    </div>
                  </div>

                  {/* Línea de Crédito específicos */}

                </div>
              </div>
            </div>
          )}

          {/* ═══════════ TAB: TABLA AMORTIZACIÓN — spec §10 ═══════════ */}
          {activeTab === 'tabla-amortizacion' && (
            <div className="p-0">
              <div className="border-t border-gray-300">
                <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">TABLA DE AMORTIZACIÓN</span>
                </div>

                {tablaAmort.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-sm">
                    <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>No se ha generado tabla de amortización.</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Complete los campos requeridos y presione <strong>COTIZAR</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="p-4">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                      <div className="bg-blue-50 border border-blue-200 rounded p-3">
                        <span className="text-[10px] text-blue-600">Total Pagos</span>
                        <p className="text-lg text-blue-800">{tablaAmort.length}</p>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded p-3">
                        <span className="text-[10px] text-green-600">Pago por Periodo</span>
                        <p className="text-lg text-green-800">{tablaAmort[0] ? formatMoney(tablaAmort[0].pagoPeriodo) : '—'}</p>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded p-3">
                        <span className="text-[10px] text-amber-600">Interés a Pagar</span>
                        <p className="text-lg text-amber-800">{formatMoney(data.interesAPagar)}</p>
                      </div>
                      <div className="bg-purple-50 border border-purple-200 rounded p-3">
                        <span className="text-[10px] text-purple-600">Pago Total (c/seguro)</span>
                        <p className="text-lg text-purple-800">{formatMoney(tablaAmort.reduce((s, r) => s + r.pagoTotal, 0))}</p>
                      </div>
                      <div className="bg-teal-50 border border-teal-200 rounded p-3">
                        <span className="text-[10px] text-teal-600">Tipo Cálculo</span>
                        <p className="text-sm text-teal-800 font-medium">{data.tipoCalculoAmortizacion}</p>
                      </div>
                    </div>

                    {/* Tabla — spec §10 columnas */}
                    <div className="border border-gray-300 overflow-x-auto max-h-[400px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0">
                          <tr className="bg-gray-100 border-b border-gray-300">
                            <th className="px-2 py-2.5 text-center font-normal text-xs text-gray-700">No</th>
                            <th className="px-2 py-2.5 text-left font-normal text-xs text-gray-700">Fecha Pago</th>
                            <th className="px-2 py-2.5 text-right font-normal text-xs text-gray-700">Saldo Insoluto</th>
                            <th className="px-2 py-2.5 text-right font-normal text-xs text-gray-700">Capital</th>
                            <th className="px-2 py-2.5 text-right font-normal text-xs text-gray-700">Interés</th>
                            <th className="px-2 py-2.5 text-right font-normal text-xs text-gray-700">IVA Interés</th>
                            <th className="px-2 py-2.5 text-right font-normal text-xs text-gray-700">Pago Periodo</th>
                            <th className="px-2 py-2.5 text-right font-normal text-xs text-gray-700">Pago Seguro</th>
                            <th className="px-2 py-2.5 text-right font-normal text-xs text-gray-700 bg-gray-200">Pago Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tablaAmort.map((row, idx) => (
                            <tr
                              key={row.noPago}
                              className="border-b border-gray-200"
                              style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                            >
                              <td className="px-2 py-2 text-xs text-center">{row.noPago}</td>
                              <td className="px-2 py-2 text-xs">{formatDateCalendar(row.fechaPago)}</td>
                              <td className="px-2 py-2 text-xs text-right">{formatMoney(row.saldoInsoluto)}</td>
                              <td className="px-2 py-2 text-xs text-right">{formatMoney(row.pagoCapital)}</td>
                              <td className="px-2 py-2 text-xs text-right">{formatMoney(row.pagoInteres)}</td>
                              <td className="px-2 py-2 text-xs text-right">{formatMoney(row.ivaInteres)}</td>
                              <td className="px-2 py-2 text-xs text-right">{formatMoney(row.pagoPeriodo)}</td>
                              <td className="px-2 py-2 text-xs text-right">{row.pagoSeguro > 0 ? formatMoney(row.pagoSeguro) : '—'}</td>
                              <td className="px-2 py-2 text-xs text-right font-medium bg-gray-50">{formatMoney(row.pagoTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-100 border-t border-gray-300">
                            <td colSpan={3} className="px-2 py-2.5 text-xs font-medium text-right">Totales:</td>
                            <td className="px-2 py-2.5 text-xs font-medium text-right">{formatMoney(tablaAmort.reduce((s, r) => s + r.pagoCapital, 0))}</td>
                            <td className="px-2 py-2.5 text-xs font-medium text-right">{formatMoney(tablaAmort.reduce((s, r) => s + r.pagoInteres, 0))}</td>
                            <td className="px-2 py-2.5 text-xs font-medium text-right">{formatMoney(tablaAmort.reduce((s, r) => s + r.ivaInteres, 0))}</td>
                            <td className="px-2 py-2.5 text-xs font-medium text-right">{formatMoney(tablaAmort.reduce((s, r) => s + r.pagoPeriodo, 0))}</td>
                            <td className="px-2 py-2.5 text-xs font-medium text-right">{formatMoney(tablaAmort.reduce((s, r) => s + r.pagoSeguro, 0))}</td>
                            <td className="px-2 py-2.5 text-xs font-medium text-right bg-gray-200">{formatMoney(tablaAmort.reduce((s, r) => s + r.pagoTotal, 0))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* JSON preview */}
                    <div className="mt-4 bg-gray-50 border border-gray-200 rounded p-3">
                      <details>
                        <summary className="text-[10px] text-gray-500 cursor-pointer">Ver JSON tablaAmortizacion (spec §10)</summary>
                        <pre className="mt-2 text-[10px] text-gray-600 overflow-x-auto max-h-40">
                          {JSON.stringify(tablaAmort.slice(0, 3), null, 2)}
                          {tablaAmort.length > 3 && `\n  // ... ${tablaAmort.length - 3} más`}
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

      {/* ═══ Modal Cliente ═══ */}
      {showClienteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="px-4 py-3 border-b border-gray-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gray-500" />
                <h3 className="text-sm font-medium text-gray-800">Seleccionar Cliente</h3>
              </div>
              <button onClick={() => setShowClienteModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
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
                  {filteredClientes.map((cl, idx) => (
                    <tr
                      key={cl.id}
                      className="border-b border-gray-200 transition-colors"
                      style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#E8F4F8'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'}
                    >
                      <td className="px-3 py-2 text-gray-700">{cl.idCliente}</td>
                      <td className="px-3 py-2 text-gray-700">{cl.nombreCompleto}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => handleSelectCliente(cl)} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-[10px]">
                          Seleccionar
                        </button>
                      </td>
                    </tr>
                  ))}
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
