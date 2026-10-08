import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { toast } from '@/app/lib/notificaciones';
import { useOrdenTabla, coincideBusqueda } from '@/app/lib/ordenTabla';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { formatearFecha } from '@/app/lib/fechas';
import { DatePicker, dmyAIso } from '@/app/components/ui/DatePicker';
import { CampoMonto } from '@/app/components/ui/CampoMonto';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` };

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════
interface PagoReferenciado {
  id: number;
  banco: string;
  cuenta: string;
  referencia: string;
  fecha: string;
  importe: number;
  identificado: boolean;
  procesado: boolean;
  observaciones: string;
  descripcion: string;
  concepto: string;
  moneda: string;
  tipoPago: string;
  // Resueltos al identificar
  cuentaDbId?: string;       // UUID de J_CUENTAS_CORP_CLIENTES
  clienteId?: string;        // UUID de J_CLIENTES
  clienteNombre?: string;
  tipoCuenta?: 'aportacion' | 'credito'; // determina ABONO o CARGO
  saldoActual?: number;
  noCuenta?: string;
}

interface CuentaDB {
  id: string;
  no_cuenta: string | null;
  no_referenc1: string | null;
  no_sol: string | null;
  cliente_id: string | null;
  cliente_id_eff?: string | null;
  cta_eje_chec?: boolean | string | null;
  cliente_nombre: string | null;
  saldo_actual: number | string | null;
  linea_produc: string | null;
  tipo_produc: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
function fmt(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Número desde lo que guarde la BD: 1500, "1500.00", "$1,500.00", "-$50,000.00". */
function aNumero(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function esCaptacion(row: CuentaDB): boolean {
  const lp = (row.linea_produc || '').toLowerCase();
  const tp = (row.tipo_produc || '').toLowerCase();
  return lp.includes('captaci') || tp.includes('ahorro') || tp.includes('aportaci');
}

// Genera archivo CSV y dispara descarga
function descargarCSV(pagos: PagoReferenciado[]) {
  const cols = ['Banco','Cuenta','Referencia','Concepto','Fecha','Importe','Identificado','Procesado','Observaciones','Descripcion','Moneda','Tipo Pago'];
  const rows = pagos.map(p => [
    p.banco, p.cuenta, p.referencia, p.concepto, p.fecha, p.importe,
    p.identificado ? 'Sí' : 'No', p.procesado ? 'Sí' : 'No',
    p.observaciones, p.descripcion, p.moneda, p.tipoPago,
  ]);
  const csv = [cols, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'pagos-referenciados.csv'; a.click();
}

// ═══════════════════════════════════════════════════════════════════
// HOOK — Carga cuentas de la DB para resolver referencias
// ═══════════════════════════════════════════════════════════════════
function useCuentasDB() {
  const [cuentas, setCuentas] = useState<CuentaDB[]>([]);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/cuentas-ahorro`, { headers: HDR });
      if (!r.ok) return;
      const j = await r.json();
      const rows: CuentaDB[] = Array.isArray(j) ? j : (j.data || []);
      setCuentas(rows);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  return { cuentas, loading, recargar: cargar };
}

const esCuentaEje = (c: CuentaDB) => c.cta_eje_chec === true || c.cta_eje_chec === 'true' || c.cta_eje_chec === 't';
const clienteDe = (c: CuentaDB) => c.cliente_id || c.cliente_id_eff || null;

/**
 * Referencia → Persona → su cuenta EJE.
 * La referencia puede ser la de cualquier cuenta de la persona (no. referencia,
 * no. solicitud o no. cuenta); con ella se identifica a la persona y se toma
 * la cuenta EJE de esa persona, que es donde se registra el pago.
 */
function resolverCuentaEje(ref: string, cuentas: CuentaDB[]): CuentaDB | undefined {
  const c = resolverReferencia(ref, cuentas);
  if (!c) return undefined;
  if (esCuentaEje(c)) return c;
  const cli = clienteDe(c);
  return cli ? cuentas.find(x => clienteDe(x) === cli && esCuentaEje(x)) : undefined;
}

// Resuelve una referencia contra la lista de cuentas
function resolverReferencia(ref: string, cuentas: CuentaDB[]): CuentaDB | undefined {
  const r = ref.trim().toLowerCase();
  return cuentas.find(c =>
    (c.no_referenc1 || '').toLowerCase() === r ||
    (c.no_sol       || '').toLowerCase() === r ||
    (c.no_cuenta    || '').toLowerCase() === r
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export function PagosReferenciadosModule() {
  const [pagos, setPagos]           = useState<PagoReferenciado[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [aplicando, setAplicando]   = useState(false);
  const itemsPerPage = 10;

  const tableRef    = useRef<HTMLDivElement>(null);
  const searchRef   = useRef<HTMLInputElement>(null);

  const { cuentas, loading: loadingCuentas, recargar } = useCuentasDB();

  // ── Alta manual de un pago referenciado ──
  const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const NUEVO_VACIO = { banco: 'BBVA', referencia: '', concepto: '', fecha: hoyISO(), importe: '', tipoPago: 'SPEI', moneda: 'MXN', observaciones: '' };
  const [showNuevo, setShowNuevo] = useState(false);
  const [nuevo, setNuevo] = useState(NUEVO_VACIO);
  const cuentaNuevo = useMemo(
    () => (nuevo.referencia.trim() ? resolverReferencia(nuevo.referencia, cuentas) : undefined),
    [nuevo.referencia, cuentas],
  );
  const abrirNuevo = () => { setNuevo({ ...NUEVO_VACIO, fecha: hoyISO() }); setShowNuevo(true); };
  const handleGuardarNuevo = () => {
    const importe = aNumero(nuevo.importe);
    if (!nuevo.referencia.trim()) { toast.error('La referencia es obligatoria'); return; }
    if (!nuevo.concepto.trim())   { toast.error('El concepto es obligatorio'); return; }
    if (!nuevo.fecha)             { toast.error('La fecha es obligatoria'); return; }
    if (importe <= 0)             { toast.error('El importe debe ser mayor a 0'); return; }
    const c = cuentaNuevo;
    const esCapt = c ? esCaptacion(c) : false;
    const pago: PagoReferenciado = {
      id: Date.now(),
      banco: nuevo.banco,
      cuenta: c?.no_cuenta || '',
      referencia: nuevo.referencia.trim(),
      fecha: formatearFecha(nuevo.fecha),
      importe,
      identificado: !!c,
      procesado: false,
      observaciones: nuevo.observaciones.trim() || 'Alta manual',
      descripcion: 'Pago referenciado (manual)',
      concepto: nuevo.concepto.trim(),
      moneda: nuevo.moneda,
      tipoPago: nuevo.tipoPago,
      ...(c ? {
        cuentaDbId: c.id,
        clienteId: c.cliente_id || undefined,
        clienteNombre: c.cliente_nombre || undefined,
        tipoCuenta: esCapt ? 'aportacion' as const : 'credito' as const,
        saldoActual: c.saldo_actual != null ? aNumero(c.saldo_actual) : undefined,
        noCuenta: c.no_cuenta || undefined,
      } : {}),
    };
    setPagos(prev => [pago, ...prev]);
    setShowNuevo(false);
    setCurrentPage(1);
    if (c) toast.success('Pago registrado', { description: `Identificado: ${c.cliente_nombre || c.no_cuenta || c.id}` });
    else   toast.warning('Pago registrado sin identificar', { description: 'La referencia no coincide con ninguna cuenta; no se podrá aplicar a cobranza.' });
  };

  // ── Cargar pagos desde bancos (simulación con referencias reales de la DB) ──
  const handleCargarPagos = () => {
    if (cuentas.length === 0) { toast.error('Cargando cuentas, intente en un momento...'); return; }
    const bancos = ['BBVA', 'BANAMEX', 'BANORTE', 'HSBC', 'SANTANDER'];
    const tipos  = ['Transferencia', 'SPEI', 'Depósito', 'Cheque'];
    const nuevos: PagoReferenciado[] = cuentas.slice(0, 10).map((c, i) => {
      const ref    = c.no_referenc1 || c.no_sol || c.no_cuenta || `REF-${i + 1}`;
      const esCapt = esCaptacion(c);
      return {
        id: Date.now() + i,
        banco:     bancos[i % bancos.length],
        cuenta:    `CTA-EJE-${String(i + 1).padStart(3, '0')}`,
        referencia: ref,
        fecha:     formatearFecha(new Date(Date.now() - i * 86400000 * 2)),
        importe:   esCapt ? [500, 1000, 2500, 750, 1500, 3000, 800, 1200, 600, 2000][i % 10]
                           : [3500, 5000, 8000, 12000, 6500, 9000, 4500, 7000, 11000, 5500][i % 10],
        identificado:  true,
        procesado:     false,
        moneda:        'MXN',
        tipoPago:      tipos[i % tipos.length],
        observaciones: 'Banco en línea',
        descripcion:   'Pago referenciado',
        concepto:      esCapt ? 'Pago aportación referenciada' : 'Pago crédito referenciado',
        cuentaDbId:    c.id,
        clienteId:     c.cliente_id || undefined,
        clienteNombre: c.cliente_nombre || undefined,
        tipoCuenta:    esCapt ? 'aportacion' : 'credito',
        saldoActual:   c.saldo_actual != null ? aNumero(c.saldo_actual) : undefined,
        noCuenta:      c.no_cuenta || undefined,
      };
    });
    setPagos(prev => [...nuevos, ...prev]);
    toast.success(`${nuevos.length} pagos cargados desde bancos`, {
      description: `${nuevos.filter(p => p.identificado).length} identificados automáticamente`,
    });
    setCurrentPage(1);
  };

  // ── Aplicar Cobranza ──
  // Procesa TODOS los pagos con PROCESADO = N. Por cada uno: Referencia → Persona →
  // cuenta EJE. Si la encuentra registra un Abono en sus Movimientos
  // (Monto = Importe, Fecha Operación = Fecha, Concepto, Referencia) e IDENTIFICADO = Y;
  // si no, IDENTIFICADO = N. En ambos casos PROCESADO = Y. "Fecha y Hora" del
  // movimiento la pone el servidor (momento del registro).
  const handleAplicarCobranza = async () => {
    const pendientes = pagos.filter(p => !p.procesado);
    if (pendientes.length === 0) { toast.info('No hay pagos pendientes de procesar'); return; }
    setAplicando(true);
    let registrados = 0, noIdentificados = 0, errores = 0;
    // Saldo vigente por cuenta EJE: varios pagos a la misma cuenta se encadenan.
    const saldos = new Map<string, number>();

    for (const pago of pendientes) {
      const eje = resolverCuentaEje(pago.referencia, cuentas);
      if (!eje) {
        noIdentificados++;
        setPagos(prev => prev.map(p => p.id === pago.id ? { ...p, identificado: false, procesado: true } : p));
        continue;
      }
      const saldoBase = saldos.has(eje.id) ? saldos.get(eje.id)! : aNumero(eje.saldo_actual);
      const saldoNuevo = saldoBase + pago.importe; // Abono: el pago entra a la cuenta EJE
      const movimiento = {
        tipo:           'Abono',
        concepto:       pago.concepto || 'Pago referenciado',
        referencia:     pago.referencia,
        monto:          pago.importe,
        fechaOperacion: dmyAIso(pago.fecha) || pago.fecha,
        banco:          pago.banco,
        moneda:         pago.moneda,
        forma_pago:     pago.tipoPago,
        origenCreacion: 'Pagos Referenciados',
        estatus:        'Aplicado',
      };
      try {
        const res = await fetch(`${API_BASE}/cuentas-ahorro/movimiento`, {
          method: 'PATCH',
          headers: HDR,
          body: JSON.stringify({ cuenta_id: eje.id, movimiento, saldo_nuevo: saldoNuevo }),
        });
        if (!res.ok) {
          errores++;
          const j = await res.json().catch(() => ({}));
          console.warn('Error aplicando pago:', j);
          continue; // queda PROCESADO = N para reintentar
        }
        saldos.set(eje.id, saldoNuevo);
        registrados++;
        setPagos(prev => prev.map(p => p.id === pago.id ? {
          ...p,
          identificado: true,
          procesado: true,
          cuentaDbId: eje.id,
          clienteId: clienteDe(eje) || p.clienteId,
          clienteNombre: eje.cliente_nombre || p.clienteNombre,
          noCuenta: eje.no_cuenta || p.noCuenta,
          saldoActual: saldoNuevo,
        } : p));
      } catch (e: any) {
        errores++;
        console.warn('Excepción aplicando pago:', e?.message);
      }
    }

    setAplicando(false);
    recargar();

    const partes = [
      registrados ? `${registrados} abono(s) registrados en la cuenta EJE` : '',
      noIdentificados ? `${noIdentificados} sin identificar` : '',
      errores ? `${errores} con error (quedan pendientes)` : '',
    ].filter(Boolean).join(' · ');
    if (errores && !registrados) toast.error('No se pudo aplicar la cobranza', { description: partes });
    else if (noIdentificados || errores) toast.warning('Cobranza aplicada con observaciones', { description: partes });
    else toast.success('Cobranza aplicada', { description: partes });
  };

  // ── Filtrado y ordenamiento ──
  const filteredSinOrden = useMemo(() => {
    let list = pagos;
    if (filtroEstatus === 'Identificados')    list = list.filter(p => p.identificado);
    if (filtroEstatus === 'No Identificados') list = list.filter(p => !p.identificado);
    if (filtroEstatus === 'Procesados')       list = list.filter(p => p.procesado);
    if (filtroEstatus === 'Pendientes')       list = list.filter(p => p.identificado && !p.procesado);
    return list.filter(p => coincideBusqueda(searchTerm, [
      p.banco, p.referencia, p.cuenta, p.noCuenta, p.clienteNombre, p.fecha, fmt(p.importe), p.descripcion, p.concepto,
    ]));
  }, [pagos, searchTerm, filtroEstatus]);

  // Más recientes primero (fecha del pago; a igual fecha, el registro más nuevo).
  const orden = useOrdenTabla(filteredSinOrden, {
    id: 'pagos-referenciados',
    columnas: {
      banco: p => p.banco,
      referencia: p => p.referencia,
      concepto: p => p.concepto,
      cliente: p => p.clienteNombre || p.cuenta,
      tipo: p => p.tipoCuenta,
      fecha: p => p.fecha,
      importe: p => p.importe,
      saldo: p => p.saldoActual,
      identificado: p => p.identificado,
      procesado: p => p.procesado,
    },
    porDefecto: { campo: 'fecha', dir: 'desc' },
    desempate: p => p.id,
    alCambiar: () => setCurrentPage(1),
  });
  const filtered = orden.filas;

  const totalPages   = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paged        = filtered.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);
  const nPendientes  = pagos.filter(p => !p.procesado).length;

  return (
    <div className="bg-white min-h-screen">

      {/* Header */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 10h20M6 16h4M14 16h4"/>
            </svg>
            <h2 className="text-lg text-gray-800">Pagos Referenciados</h2>
            {loadingCuentas && <span className="text-xs text-gray-400">Cargando cuentas...</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={abrirNuevo}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[color:var(--theme-primary)] text-white text-sm rounded hover:bg-[color:var(--theme-primary-hover)]"
              style={{ fontWeight: 500 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M7 2v10M2 7h10" strokeLinecap="round"/>
              </svg>
              Nuevo
            </button>
            <button
              onClick={handleCargarPagos}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-sm rounded hover:bg-gray-50"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 10v2h10v-2M7 2v7M4 6l3 3 3-3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Cargar pagos desde bancos
            </button>
            <button
              onClick={handleAplicarCobranza}
              disabled={nPendientes === 0 || aplicando}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[color:var(--theme-action)] text-white text-sm rounded hover:bg-[color:var(--theme-action-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ fontWeight: 500 }}
            >
              {aplicando ? (
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="6" cy="6" r="5" strokeOpacity="0.25"/><path d="M6 1a5 5 0 0 1 5 5" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 7h10M8 4l4 3-4 3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              Aplicar Cobranza{nPendientes > 0 ? ` (${nPendientes})` : ''}
            </button>
          </div>
        </div>
      </div>

      {/* Ver bar */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[240px]">
              <option>Vista general de Pagos Referenciados</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666"><path d="M6 8l-4-4h8z"/></svg>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700" style={{ fontWeight: 500 }}>Filtros</span>
            <select
              value={filtroEstatus}
              onChange={e => { setFiltroEstatus(e.target.value); setCurrentPage(1); }}
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white"
            >
              <option value="Todos">Todos</option>
              <option value="Identificados">Identificados</option>
              <option value="No Identificados">No Identificados</option>
              <option value="Pendientes">Pendientes (por aplicar)</option>
              <option value="Procesados">Procesados</option>
            </select>
          </div>
          <input
            ref={searchRef}
            type="text"
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar por banco, referencia, cliente..."
            className="px-3 py-1 border border-gray-400 rounded text-sm w-72"
          />
        </div>
      </div>

      {/* Barra de exportación + orden */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => descargarCSV(filtered)} title="CSV"
              className="p-1.5 hover:bg-gray-200 rounded">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280"/>
                <text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text>
              </svg>
            </button>
            <button onClick={() => toast.info('Exportando a Excel...')} title="Excel"
              className="p-1.5 hover:bg-green-100 rounded">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B"/>
                <path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2"/>
              </svg>
            </button>
            <button onClick={() => toast.info('Generando PDF...')} title="PDF"
              className="p-1.5 hover:bg-red-100 rounded">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F"/>
                <path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none"/>
                <path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2"/>
              </svg>
            </button>
            <button onClick={() => window.print()} title="Imprimir"
              className="p-1.5 hover:bg-blue-100 rounded">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="5" y="3" width="10" height="3" fill="#1976D2"/>
                <rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none"/>
                <rect x="5" y="11" width="10" height="6" fill="#1976D2"/>
                <circle cx="5" cy="8" r="0.8" fill="#1976D2"/>
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span className="text-xs">Orden</span>
              <select value={orden.dir} onChange={e => orden.fijar(orden.campo, e.target.value as 'desc' | 'asc')}
                className="px-2 py-1 border border-gray-400 rounded text-xs bg-white">
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </div>
            <span className="text-xs">Total: {filtered.length}</span>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Página anterior" title="Página anterior" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}
                className="p-0.5 text-[color:var(--theme-action)] disabled:opacity-40">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3L5 8l5 5V3z"/></svg>
              </button>
              <button type="button" aria-label="Página siguiente" title="Página siguiente" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}
                className="p-0.5 text-[color:var(--theme-action)] disabled:opacity-40">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="px-4 py-4" ref={tableRef}>
        <div className="border border-gray-300 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                <th className="px-3 py-2.5 text-left text-[10px] text-gray-700 border-r border-gray-300" {...orden.th('banco', { fontWeight: 600 })}>BANCO{orden.flecha('banco')}</th>
                <th className="px-3 py-2.5 text-left text-[10px] text-gray-700 border-r border-gray-300" {...orden.th('referencia', { fontWeight: 600 })}>REFERENCIA{orden.flecha('referencia')}</th>
                <th className="px-3 py-2.5 text-left text-[10px] text-gray-700 border-r border-gray-300" {...orden.th('concepto', { fontWeight: 600 })}>CONCEPTO{orden.flecha('concepto')}</th>
                <th className="px-3 py-2.5 text-left text-[10px] text-gray-700 border-r border-gray-300" {...orden.th('cliente', { fontWeight: 600 })}>CLIENTE / CUENTA{orden.flecha('cliente')}</th>
                <th className="px-3 py-2.5 text-left text-[10px] text-gray-700 border-r border-gray-300" {...orden.th('tipo', { fontWeight: 600 })}>TIPO{orden.flecha('tipo')}</th>
                <th className="px-3 py-2.5 text-left text-[10px] text-gray-700 border-r border-gray-300" {...orden.th('fecha', { fontWeight: 600 })}>FECHA{orden.flecha('fecha')}</th>
                <th className="px-3 py-2.5 text-right text-[10px] text-gray-700 border-r border-gray-300" {...orden.th('importe', { fontWeight: 600 })}>IMPORTE{orden.flecha('importe')}</th>
                <th className="px-3 py-2.5 text-right text-[10px] text-gray-700 border-r border-gray-300" {...orden.th('saldo', { fontWeight: 600 })}>SALDO ACTUAL{orden.flecha('saldo')}</th>
                <th className="px-3 py-2.5 text-center text-[10px] text-gray-700 border-r border-gray-300" {...orden.th('identificado', { fontWeight: 600 })}>IDENTIFICADO{orden.flecha('identificado')}</th>
                <th className="px-3 py-2.5 text-center text-[10px] text-gray-700 border-r border-gray-300" style={{ fontWeight: 600 }}>MOVIMIENTO</th>
                <th className="px-3 py-2.5 text-center text-[10px] text-gray-700" {...orden.th('procesado', { fontWeight: 600 })}>PROCESADO{orden.flecha('procesado')}</th>
              </tr>
            </thead>
            <tbody>
              {pagos.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#D0D0D0" strokeWidth="1.5">
                        <rect x="4" y="8" width="32" height="24" rx="3"/><path d="M4 16h32M12 24h6M24 24h4"/>
                      </svg>
                      <span>Sin pagos cargados. Use "Cargar pagos desde bancos" para importar o "Nuevo" para capturar uno.</span>
                    </div>
                  </td>
                </tr>
              ) : paged.map((pago, idx) => {
                const esAbono  = pago.tipoCuenta === 'aportacion';
                const esCredito= pago.tipoCuenta === 'credito';
                return (
                  <tr
                    key={pago.id}
                    className="border-b border-gray-200"
                    style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E8F4F8'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'; }}
                  >
                    <td className="px-3 py-2 border-r border-gray-200" style={{ fontWeight: 500 }}>{pago.banco}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-[color:var(--theme-link)] font-mono">{pago.referencia}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-gray-700">{pago.concepto || '—'}</td>
                    <td className="px-3 py-2 border-r border-gray-200">
                      {pago.clienteNombre ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{pago.clienteNombre}</div>
                          <div className="text-[10px] text-gray-400">{pago.noCuenta || pago.cuenta}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">No identificado</span>
                      )}
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200">
                      {pago.tipoCuenta ? (
                        <span className={`px-1.5 py-0.5 text-[9px] border ${
                          esAbono  ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          esCredito? 'bg-orange-50 text-orange-700 border-orange-200' :
                                     'bg-gray-50 text-gray-500 border-gray-200'
                        }`}>
                          {esAbono ? 'Aportación' : 'Crédito'}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200">{pago.fecha}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-right font-mono"
                        style={{ color: esAbono ? '#0E7B1F' : esCredito ? '#D32F2F' : '#374151' }}>
                      {fmt(pago.importe)}
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200 text-right font-mono text-gray-600">
                      {pago.saldoActual !== undefined ? fmt(pago.saldoActual) : '—'}
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200 text-center">
                      {pago.procesado
                        ? (pago.identificado
                            ? <span className="px-1.5 py-0.5 text-[9px] border bg-green-50 text-green-700 border-green-200" title="Identificado">Y</span>
                            : <span className="px-1.5 py-0.5 text-[9px] border bg-red-50 text-red-700 border-red-200" title="No identificado">N</span>)
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200 text-center">
                      {(!pago.procesado || pago.identificado) && (
                        <span className="px-1.5 py-0.5 text-[9px] border bg-green-50 text-green-700 border-green-200">ABONO</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {pago.procesado
                        ? <span className="px-1.5 py-0.5 text-[9px] border bg-green-50 text-green-700 border-green-200">Y</span>
                        : <span className="px-1.5 py-0.5 text-[9px] border bg-gray-50 text-gray-500 border-gray-200">N</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      <div className="px-4 py-3 border-t border-gray-300 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {nPendientes} pendientes de procesar •{' '}
          {pagos.filter(p => p.procesado).length} procesados
        </div>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Primera página" title="Primera página" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#666" strokeWidth="1.5"><path d="M11 3L3 8l8 5V3z"/></svg>
          </button>
          <button type="button" aria-label="Página anterior" title="Página anterior" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}
            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 3L4 8l5 5V3z"/></svg>
          </button>
          <span className="text-sm text-gray-700">Página {currentPage} de {totalPages}</span>
          <button type="button" aria-label="Página siguiente" title="Página siguiente" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}
            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 3l5 5-5 5V3z"/></svg>
          </button>
          <button type="button" aria-label="Última página" title="Última página" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#666" strokeWidth="1.5"><path d="M3 3l8 5-8 5V3z"/></svg>
          </button>
        </div>
      </div>

      {/* Modal alta manual */}
      {showNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowNuevo(false)}>
          <div className="bg-white rounded shadow-xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-primary-theme px-5 py-3.5 flex items-center justify-between rounded-t">
              <h3 className="text-sm font-medium text-white">Nuevo Pago Referenciado</h3>
              <button type="button" aria-label="Cerrar" title="Cerrar" onClick={() => setShowNuevo(false)} className="text-white/70 hover:text-white">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8"/></svg>
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Banco *</label>
                  <select value={nuevo.banco} onChange={e => setNuevo(p => ({ ...p, banco: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded">
                    {['BBVA', 'BANAMEX', 'BANORTE', 'HSBC', 'SANTANDER', 'SCOTIABANK', 'INBURSA', 'BANREGIO', 'OTRO'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Fecha *</label>
                  <DatePicker formato="iso" value={nuevo.fecha} onChange={(v: string) => setNuevo(p => ({ ...p, fecha: v }))} className="text-xs" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Referencia *</label>
                <input type="text" value={nuevo.referencia} onChange={e => setNuevo(p => ({ ...p, referencia: e.target.value }))}
                  placeholder="No. referencia, no. solicitud o no. cuenta" className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded font-mono" />
                {nuevo.referencia.trim() && (
                  cuentaNuevo ? (
                    <p className="text-[10px] text-green-700 mt-1">
                      Identificado: <span className="font-medium">{cuentaNuevo.cliente_nombre || 'Sin nombre'}</span>
                      {(() => {
                        const eje = resolverCuentaEje(nuevo.referencia, cuentas);
                        return eje
                          ? <> · al aplicar, Abono en cuenta EJE <span className="font-mono">{eje.no_cuenta || eje.id.slice(0, 8)}</span></>
                          : <span className="text-amber-600"> · la persona no tiene cuenta EJE: al aplicar quedará IDENTIFICADO = N</span>;
                      })()}
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-600 mt-1">No coincide con ninguna cuenta: quedará como no identificado.</p>
                  )
                )}
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Concepto *</label>
                <input type="text" value={nuevo.concepto} onChange={e => setNuevo(p => ({ ...p, concepto: e.target.value }))}
                  placeholder="Ej: Pago mensualidad, Aportación..." className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Importe *</label>
                  <CampoMonto value={nuevo.importe} onChange={e => setNuevo(p => ({ ...p, importe: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Tipo de pago</label>
                  <select value={nuevo.tipoPago} onChange={e => setNuevo(p => ({ ...p, tipoPago: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded">
                    {['SPEI', 'Transferencia', 'Depósito', 'Cheque'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Moneda</label>
                  <select value={nuevo.moneda} onChange={e => setNuevo(p => ({ ...p, moneda: e.target.value }))} className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded">
                    <option>MXN</option>
                    <option>USD</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Observaciones</label>
                <input type="text" value={nuevo.observaciones} onChange={e => setNuevo(p => ({ ...p, observaciones: e.target.value }))}
                  placeholder="Opcional" className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
              </div>
            </div>

            <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex justify-end gap-2 rounded-b">
              <button onClick={() => setShowNuevo(false)}
                className="px-4 py-1.5 text-xs border border-gray-200 rounded text-gray-600 hover:bg-gray-100">
                Cancelar
              </button>
              <button onClick={handleGuardarNuevo}
                className="px-5 py-1.5 text-xs bg-primary-theme text-white rounded hover:opacity-90 font-medium">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
