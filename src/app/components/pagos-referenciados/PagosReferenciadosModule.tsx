import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

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
  cliente_nombre: string | null;
  saldo_actual: number | null;
  linea_produc: string | null;
  tipo_produc: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
function fmt(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function esCaptacion(row: CuentaDB): boolean {
  const lp = (row.linea_produc || '').toLowerCase();
  const tp = (row.tipo_produc || '').toLowerCase();
  return lp.includes('captaci') || tp.includes('ahorro') || tp.includes('aportaci');
}

// Genera archivo CSV y dispara descarga
function descargarCSV(pagos: PagoReferenciado[]) {
  const cols = ['Banco','Cuenta','Referencia','Fecha','Importe','Identificado','Procesado','Observaciones','Descripcion','Moneda','Tipo Pago'];
  const rows = pagos.map(p => [
    p.banco, p.cuenta, p.referencia, p.fecha, p.importe,
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
  const [sortOrder, setSortOrder]   = useState<'desc' | 'asc'>('desc');
  const [filtroEstatus, setFiltroEstatus] = useState('Todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [aplicando, setAplicando]   = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const itemsPerPage = 10;

  const tableRef    = useRef<HTMLDivElement>(null);
  const searchRef   = useRef<HTMLInputElement>(null);

  const { cuentas, loading: loadingCuentas, recargar } = useCuentasDB();

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
        fecha:     new Date(Date.now() - i * 86400000 * 2).toLocaleDateString('es-MX'),
        importe:   esCapt ? [500, 1000, 2500, 750, 1500, 3000, 800, 1200, 600, 2000][i % 10]
                           : [3500, 5000, 8000, 12000, 6500, 9000, 4500, 7000, 11000, 5500][i % 10],
        identificado:  true,
        procesado:     false,
        moneda:        'MXN',
        tipoPago:      tipos[i % tipos.length],
        observaciones: 'Banco en línea',
        descripcion:   'Pago referenciado',
        cuentaDbId:    c.id,
        clienteId:     c.cliente_id || undefined,
        clienteNombre: c.cliente_nombre || undefined,
        tipoCuenta:    esCapt ? 'aportacion' : 'credito',
        saldoActual:   c.saldo_actual ?? undefined,
        noCuenta:      c.no_cuenta || undefined,
      };
    });
    setPagos(prev => [...nuevos, ...prev]);
    toast.success(`${nuevos.length} pagos cargados desde bancos`, {
      description: `${nuevos.filter(p => p.identificado).length} identificados automáticamente`,
    });
    setCurrentPage(1);
  };

  // ── Toggle selección ──
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };
  const toggleSelectAll = () => {
    const pendientes = paged.filter(p => p.identificado && !p.procesado).map(p => p.id);
    const todosSelec = pendientes.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const s = new Set(prev);
      if (todosSelec) { pendientes.forEach(id => s.delete(id)); }
      else            { pendientes.forEach(id => s.add(id)); }
      return s;
    });
  };

  // ── Aplicar Cobranza ──
  const handleAplicarCobranza = async () => {
    const seleccionados = pagos.filter(p => selectedIds.has(p.id) && p.identificado && !p.procesado);
    if (seleccionados.length === 0) {
      toast.error('Seleccione pagos identificados y no procesados');
      return;
    }
    setAplicando(true);
    let ok = 0; let err = 0;

    for (const pago of seleccionados) {
      if (!pago.cuentaDbId || !pago.clienteId) { err++; continue; }

      const esAportacion = pago.tipoCuenta === 'aportacion';
      const saldoBase    = pago.saldoActual ?? 0;
      const saldoNuevo   = esAportacion
        ? saldoBase + pago.importe   // ABONO → suma
        : saldoBase - pago.importe;  // CARGO → resta

      const movimiento = {
        fecha:       pago.fecha,
        tipo:        esAportacion ? 'Abono' : 'Cargo',
        sub_tipo:    esAportacion ? 'Aportacion' : 'Amortizacion',
        concepto:    esAportacion ? 'Pago aportación referenciada' : 'Pago crédito referenciado',
        referencia:  pago.referencia,
        banco:       pago.banco,
        monto:       pago.importe,
        moneda:      pago.moneda,
        forma_pago:  pago.tipoPago,
      };

      try {
        const res = await fetch(`${API_BASE}/cuentas-ahorro/movimiento`, {
          method: 'PATCH',
          headers: HDR,
          body: JSON.stringify({
            cuenta_id:   pago.cuentaDbId,
            movimiento,
            saldo_nuevo: saldoNuevo,
          }),
        });
        if (res.ok) {
          ok++;
          setPagos(prev => prev.map(p =>
            p.id === pago.id
              ? { ...p, procesado: true, saldoActual: saldoNuevo }
              : p
          ));
        } else {
          err++;
          const j = await res.json().catch(() => ({}));
          console.warn('Error aplicando pago:', j);
        }
      } catch (e: any) {
        err++;
        console.warn('Excepción aplicando pago:', e?.message);
      }
    }

    setAplicando(false);
    setSelectedIds(new Set());
    recargar();

    if (ok > 0 && err === 0)  toast.success(`${ok} pago(s) aplicados correctamente`);
    else if (ok > 0)          toast.success(`${ok} aplicados`, { description: `${err} con error` });
    else                      toast.error(`Error al aplicar ${err} pago(s)`);
  };

  // ── Filtrado y ordenamiento ──
  const filtered = useMemo(() => {
    let list = pagos;
    if (filtroEstatus === 'Identificados')    list = list.filter(p => p.identificado);
    if (filtroEstatus === 'No Identificados') list = list.filter(p => !p.identificado);
    if (filtroEstatus === 'Procesados')       list = list.filter(p => p.procesado);
    if (filtroEstatus === 'Pendientes')       list = list.filter(p => p.identificado && !p.procesado);
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(p =>
        p.banco.toLowerCase().includes(s) ||
        p.referencia.toLowerCase().includes(s) ||
        p.cuenta.toLowerCase().includes(s) ||
        (p.clienteNombre || '').toLowerCase().includes(s) ||
        fmt(p.importe).includes(s)
      );
    }
    return [...list].sort((a, b) => {
      const pa = a.fecha.split('/'); const pb = b.fecha.split('/');
      const da = new Date(+pa[2], +pa[1]-1, +pa[0]).getTime();
      const db = new Date(+pb[2], +pb[1]-1, +pb[0]).getTime();
      return sortOrder === 'desc' ? db - da : da - db;
    });
  }, [pagos, searchTerm, sortOrder, filtroEstatus]);

  const totalPages   = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paged        = filtered.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);
  const pendientesSel = paged.filter(p => p.identificado && !p.procesado);
  const todosSelec    = pendientesSel.length > 0 && pendientesSel.every(p => selectedIds.has(p.id));
  const nSelec        = pagos.filter(p => selectedIds.has(p.id)).length;

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
              disabled={nSelec === 0 || aplicando}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#0099CC] text-white text-sm rounded hover:bg-[#0088BB] disabled:opacity-40 disabled:cursor-not-allowed"
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
              Aplicar Cobranza{nSelec > 0 ? ` (${nSelec})` : ''}
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
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value as 'desc' | 'asc')}
                className="px-2 py-1 border border-gray-400 rounded text-xs bg-white">
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </div>
            <span className="text-xs">Total: {filtered.length}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}
                className="p-0.5 text-[#0099CC] disabled:opacity-40">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3L5 8l5 5V3z"/></svg>
              </button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}
                className="p-0.5 text-[#0099CC] disabled:opacity-40">
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
                <th className="px-2 py-2.5 w-8 border-r border-gray-300">
                  <input type="checkbox" checked={todosSelec} onChange={toggleSelectAll}
                    className="w-3 h-3 accent-[#0099CC]" title="Seleccionar todos pendientes"/>
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] text-gray-700 border-r border-gray-300" style={{ fontWeight: 600 }}>BANCO</th>
                <th className="px-3 py-2.5 text-left text-[10px] text-gray-700 border-r border-gray-300" style={{ fontWeight: 600 }}>REFERENCIA</th>
                <th className="px-3 py-2.5 text-left text-[10px] text-gray-700 border-r border-gray-300" style={{ fontWeight: 600 }}>CLIENTE / CUENTA</th>
                <th className="px-3 py-2.5 text-left text-[10px] text-gray-700 border-r border-gray-300" style={{ fontWeight: 600 }}>TIPO</th>
                <th className="px-3 py-2.5 text-left text-[10px] text-gray-700 border-r border-gray-300" style={{ fontWeight: 600 }}>FECHA</th>
                <th className="px-3 py-2.5 text-right text-[10px] text-gray-700 border-r border-gray-300" style={{ fontWeight: 600 }}>IMPORTE</th>
                <th className="px-3 py-2.5 text-right text-[10px] text-gray-700 border-r border-gray-300" style={{ fontWeight: 600 }}>SALDO ACTUAL</th>
                <th className="px-3 py-2.5 text-center text-[10px] text-gray-700 border-r border-gray-300" style={{ fontWeight: 600 }}>IDENTIFICADO</th>
                <th className="px-3 py-2.5 text-center text-[10px] text-gray-700 border-r border-gray-300" style={{ fontWeight: 600 }}>MOVIMIENTO</th>
                <th className="px-3 py-2.5 text-center text-[10px] text-gray-700" style={{ fontWeight: 600 }}>PROCESADO</th>
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
                      <span>Sin pagos cargados. Use "Cargar pagos desde bancos" para importar.</span>
                    </div>
                  </td>
                </tr>
              ) : paged.map((pago, idx) => {
                const esSel    = selectedIds.has(pago.id);
                const esAbono  = pago.tipoCuenta === 'aportacion';
                const esCredito= pago.tipoCuenta === 'credito';
                const canSel   = pago.identificado && !pago.procesado;
                return (
                  <tr
                    key={pago.id}
                    className="border-b border-gray-200 cursor-pointer"
                    style={{ backgroundColor: esSel ? '#E8F4F8' : idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                    onMouseEnter={e => { if (!esSel) e.currentTarget.style.backgroundColor = '#E8F4F8'; }}
                    onMouseLeave={e => { if (!esSel) e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF'; }}
                    onClick={() => canSel && toggleSelect(pago.id)}
                  >
                    <td className="px-2 py-2 text-center border-r border-gray-200">
                      {canSel && (
                        <input type="checkbox" checked={esSel} onChange={() => toggleSelect(pago.id)}
                          onClick={e => e.stopPropagation()} className="w-3 h-3 accent-[#0099CC]"/>
                      )}
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200" style={{ fontWeight: 500 }}>{pago.banco}</td>
                    <td className="px-3 py-2 border-r border-gray-200 text-[#0066CC] font-mono">{pago.referencia}</td>
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
                      {pago.identificado
                        ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline-block"><path d="M2.5 7l3 3 6-6" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 border-r border-gray-200 text-center">
                      {pago.identificado && !pago.procesado && (
                        <span className={`px-1.5 py-0.5 text-[9px] border ${
                          esAbono  ? 'bg-green-50 text-green-700 border-green-200' :
                                     'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {esAbono ? 'ABONO' : 'CARGO'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {pago.procesado
                        ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline-block"><path d="M2.5 7l3 3 6-6" stroke="#2E7D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : <span className="text-gray-300">—</span>}
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
          {pagos.filter(p => p.identificado && !p.procesado).length} pendientes de aplicar •{' '}
          {pagos.filter(p => p.procesado).length} procesados
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#666" strokeWidth="1.5"><path d="M11 3L3 8l8 5V3z"/></svg>
          </button>
          <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}
            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 3L4 8l5 5V3z"/></svg>
          </button>
          <span className="text-sm text-gray-700">Página {currentPage} de {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}
            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 3l5 5-5 5V3z"/></svg>
          </button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
            className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#666" strokeWidth="1.5"><path d="M3 3l8 5-8 5V3z"/></svg>
          </button>
        </div>
      </div>

    </div>
  );
}
