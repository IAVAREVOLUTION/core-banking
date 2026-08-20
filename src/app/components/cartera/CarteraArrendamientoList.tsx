/**
 * CarteraArrendamientoList.tsx — Módulo Gestión de Cartera · Arrendamiento
 *
 * Mismo lenguaje visual que CarteraList (Créditos) y CobranzaModule: Inicio con
 * KPIs y gráficas, Lista institucional (barra de vista, filtros, exportación,
 * paginación) y Detalle con encabezado, barra de acciones y tab bar.
 *
 * Lo que cambia son los datos — en lugar de saldo/amortización de crédito
 * muestra los parámetros propios del Arrendamiento — Puro y Financiero (enganche, valor
 * residual, rentas anticipadas, renta del periodo), el calendario de rentas y
 * las facturas del ciclo.
 *
 * Fuente: las mismas solicitudes, filtradas a Arrendamiento (Puro y Financiero). Un contrato
 * queda "Vigente" cuando se cierra la Fase 6 (Liberación y Dispersión).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { crearFacturaArrendamientoCobranza, SUB_TIPO_ARRENDAMIENTO } from '../../hooks/useCarteraDB';
import { esArrendamiento, ESTATUS_FACTURA_LIQUIDADA } from '../solicitudes/solicitudCreditoStore';
import { actualizarCalendarioArrendamientoDB } from '../../hooks/useSolicitudesDB';
import { AvisosVencimientoTab } from './AvisosVencimientoTab';
import { fetchEstatusActivacionMap } from '../../hooks/useSolicitudesActivacionDB';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { Authorization: `Bearer ${publicAnonKey}` };

const parseMon = (v: unknown): number => parseFloat(String(v ?? '0').replace(/[$,\s]/g, '')) || 0;
const fmtMoney = (n: number) =>
  (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });
const fmtMoneyShort = (n: number) =>
  (n || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * true si el producto es Arrendamiento — Puro o Financiero. Compartido con
 * CarteraList para que un contrato no caiga en las dos carteras.
 * Financiero también factura rentas mensuales, así que pertenece a esta cartera.
 */
export function esArrendamientoPuroRow(lineaProducto: string, tipoProducto: string): boolean {
  return esArrendamiento(lineaProducto, tipoProducto);
}

interface RentaCalendario {
  noRenta: number; fechaPago: string; rentaSinIva: number;
  seguro: number; iva: number; pagoPeriodo: number; estatus: string;
  /** id del Aviso de Vencimiento en Cobranza que ampara esta renta. */
  facturaIdCobranza?: string;
}

interface FacturaCartera {
  tipo: string; titulo: string; noFactura: string; contraparte: string;
  estatus: string; total: number; uuid?: string; fechaEmision: string;
  xml?: string; facturaIdCobranza?: string;
}

interface ContratoArrendamiento {
  id: string; noSol: string; cliente: string; clienteId: string;
  productoNombre: string; lineaProducto: string; tipoProducto: string;
  montoSolicitado: number; montoAutorizado: number;
  porcentajeEnganche: string; montoEnganche: number;
  porcentajeValorResidual: string; montoResidual: number;
  rentasAnticipadas: string; plazo: string; tasa: string; frecuencia: string;
  estatusSolicitud: string; estatusCartera: string; fechaSol: string;
  rentaMensual: number; calendario: RentaCalendario[]; facturas: FacturaCartera[];
  /** Rentas del calendario ya cobradas (derivado del estatus real en Cobranza). */
  rentasPagadas: number;
}

// ═══════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════
function useArrendamientos() {
  const [rows, setRows] = useState<ContratoArrendamiento[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await window.fetch(`${API_BASE}/solicitudes-credito`, { headers: HDR });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      // Estatus real de los Avisos de Vencimiento — el pago se aplica en
      // Cobranza y no vuelve solo al calendario guardado en la solicitud.
      const estatusFacturas = new Map<string, string>();
      try {
        const resCob = await window.fetch(
          `${API_BASE}/cartera/cobranza?sub_tipo=${SUB_TIPO_ARRENDAMIENTO}`, { headers: HDR },
        );
        const jsonCob = await resCob.json();
        for (const f of (jsonCob.data || [])) estatusFacturas.set(String(f.id), String(f.estatus));
      } catch { /* sin Cobranza el calendario muestra su estatus guardado */ }

      // Las dos facturas del ciclo viven en módulos distintos: la de Pago
      // Inicial es cuenta por cobrar (Cobranza, mapa de arriba) y la de Compra
      // a Proveedor es cuenta por pagar (Solicitudes de Activación). Sin este
      // segundo mapa la del proveedor se quedaba en el estatus guardado en la
      // solicitud — siempre "Pendiente", aunque ya estuviera pagada.
      const estatusActivacion = await fetchEstatusActivacionMap();

      const mapped: ContratoArrendamiento[] = (json.data || [])
        .filter((r: any) => {
          const h = r.data?.solicitud?.header || {};
          return esArrendamientoPuroRow(
            r.linea_produc || h.linea_producto || '',
            r.tipo_produc || h.tipo_producto || '',
          );
        })
        .map((r: any) => {
          const h = r.data?.solicitud?.header || {};
          const t = r.data?.solicitud?.terminos_condiciones?._raw || {};
          const arr = r.data?.solicitud?.simulacion?.calendario_arrendamiento || {};
          const calendarioRaw: RentaCalendario[] = Array.isArray(arr?.calendario) ? arr.calendario : [];
          // El estatus mostrado sale de Cobranza cuando la renta ya se facturó:
          // 'Pagado' allá ⇒ renta pagada; si sigue pendiente ⇒ 'Facturada'.
          const calendario: RentaCalendario[] = calendarioRaw.map(c => {
            if (!c.facturaIdCobranza) return c;
            const est = estatusFacturas.get(String(c.facturaIdCobranza));
            if (est === 'Pagado') return { ...c, estatus: 'Pagado' };
            return { ...c, estatus: est ? 'Facturada' : c.estatus };
          });
          const facturasRaw: FacturaCartera[] = Array.isArray(r.data?.solicitud?.facturas)
            ? r.data.solicitud.facturas : [];
          // Estatus real de cada factura contra SU módulo. Si el id no está en
          // el mapa (sin conexión, o factura sin registro) se conserva el
          // estatus guardado en vez de degradarlo a "Pendiente".
          const facturas: FacturaCartera[] = facturasRaw.map(f => {
            if (!f.facturaIdCobranza) return f;
            const real = f.tipo === 'COMPRA_PROVEEDOR'
              ? estatusActivacion.get(String(f.facturaIdCobranza))
              : estatusFacturas.get(String(f.facturaIdCobranza));
            if (!real) return f;
            // Ambos módulos usan 'Pagado'; esta vista rotula 'Pagada'.
            return { ...f, estatus: real === 'Pagado' ? 'Pagada' : real };
          });
          const primeraPendiente = calendario.find(c => c.estatus !== 'Pagado') || calendario[0];

          return {
            id: r.id,
            noSol: r.no_sol || '',
            cliente: [r.cliente_nombre, r.cliente_ap_paterno, r.cliente_ap_materno]
              .filter(Boolean).join(' ') || h.nombre_persona || '—',
            clienteId: r.cliente_id || '',
            productoNombre: r.producto_nombre || h.nombre_producto || '—',
            lineaProducto: r.linea_produc || h.linea_producto || '',
            tipoProducto: r.tipo_produc || h.tipo_producto || '',
            montoSolicitado: parseMon(r.monto_sol),
            montoAutorizado: parseMon(r.monto_aut),
            porcentajeEnganche: String(t.porcentajeEnganche || ''),
            montoEnganche: parseMon(t.montoEnganche),
            porcentajeValorResidual: String(t.porcentajeValorResidualSel || ''),
            montoResidual: parseMon(t.montoResidual),
            rentasAnticipadas: String(t.rentasAnticipadas || '0'),
            plazo: String(t.plazo || h.plazo_autorizado || ''),
            tasa: String(t.tasa || h.tasa_autorizada || ''),
            frecuencia: String(t.frecuencia || ''),
            estatusSolicitud: r.estatus_sol || 'Pendiente',
            // Mientras no cierre la Fase 6 el contrato aún no está en cartera.
            estatusCartera: r.estatus_cart || 'En proceso',
            fechaSol: r.fecha_sol || r.fecha_autori || '',
            rentaMensual: primeraPendiente?.pagoPeriodo || 0,
            calendario, facturas,
            rentasPagadas: calendario.filter(c => c.estatus === 'Pagado').length,
          };
        });
      setRows(mapped);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  return { rows, loading, error, refetch: fetchRows };
}

// ═══════════════════════════════════════════════════════════════════
// KPI CARD
// ═══════════════════════════════════════════════════════════════════
function KPICard({ label, value, sub, iconBg, iconColor, icon }: {
  label: string; value: string | number; sub: string;
  iconBg: string; iconColor: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-300 rounded p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
        <div className={`w-12 h-12 ${iconBg} rounded-full flex items-center justify-center`}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">{icon}</svg>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-600">{sub}</div>
    </div>
  );
}

/** Campo de solo lectura — mismo patrón que el Field de CobranzaModule. */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-[52px]">
      <label className="text-[10px] text-gray-600 mb-0.5">{label.toUpperCase()}</label>
      <div className="px-2 py-1 text-xs text-gray-700">{value || '—'}</div>
    </div>
  );
}

const COLORS_CARTERA: Record<string, string> = {
  Vigente: '#10B981', 'En proceso': '#F59E0B', Vencida: '#EF4444',
  Castigada: '#F97316', Reestructurada: '#3B82F6',
};

function claseCartera(estatus: string) {
  return estatus === 'Vigente' ? 'text-green-700 bg-green-50 border-green-200' :
    estatus === 'Vencida' ? 'text-red-700 bg-red-50 border-red-200' :
    estatus === 'Castigada' ? 'text-orange-700 bg-orange-50 border-orange-200' :
    'text-amber-700 bg-amber-50 border-amber-200';
}

function badgeCartera(estatus: string) {
  return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${claseCartera(estatus)}`}>{estatus}</span>;
}

function badgeFactura(estatus: string) {
  // Verde = liquidada. La cuenta por pagar del proveedor puede terminar en
  // 'Autorizada'/'Activada'/'Activo' además de 'Pagada' (catálogo de
  // Solicitudes de Activación) — mismo criterio que el subtab de la solicitud.
  const cls = ESTATUS_FACTURA_LIQUIDADA.includes(estatus as any)
    ? 'text-green-700 bg-green-50 border-green-200'
    : estatus === 'Cancelada' || estatus === 'Rechazada'
      ? 'text-red-700 bg-red-50 border-red-200'
      : 'text-amber-700 bg-amber-50 border-amber-200';
  return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${cls}`}>{estatus}</span>;
}

// ═══════════════════════════════════════════════════════════════════
// INICIO
// ═══════════════════════════════════════════════════════════════════
function DashboardArrendamiento({ rows, loading, error, refetch, onVer }: {
  rows: ContratoArrendamiento[]; loading: boolean; error: string | null;
  refetch: () => void; onVer: (c: ContratoArrendamiento) => void;
}) {
  const kpis = useMemo(() => {
    const total = rows.length;
    const vigentes = rows.filter(r => r.estatusCartera === 'Vigente').length;
    const montoTotal = rows.reduce((s, r) => s + r.montoAutorizado, 0);
    const residual = rows.reduce((s, r) => s + r.montoResidual, 0);
    return { total, vigentes, montoTotal, residual };
  }, [rows]);

  const distribucionEstatus = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach(r => { map[r.estatusCartera] = (map[r.estatusCartera] || 0) + 1; });
    return Object.entries(map).map(([estatus, cantidad]) => ({
      estatus, cantidad, color: COLORS_CARTERA[estatus] || '#9CA3AF',
    }));
  }, [rows]);

  const montoPorProducto = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach(r => {
      const p = r.productoNombre || 'Sin producto';
      map[p] = (map[p] || 0) + r.montoAutorizado;
    });
    return Object.entries(map).map(([producto, monto]) => ({
      producto: producto.length > 18 ? `${producto.slice(0, 18)}…` : producto,
      monto,
    }));
  }, [rows]);

  const recientes = useMemo(() => [...rows].slice(0, 8), [rows]);

  return (
    <div className="p-6 space-y-6 bg-[#F5F5F5] min-h-screen">
      <div className="flex justify-end">
        <button onClick={refetch} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M2 7A5 5 0 1 0 4 3" /><path d="M2 3v4h4" strokeLinecap="round" />
          </svg>
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>

      {error && <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Contratos de Arrendamiento" value={kpis.total} sub="Puro y Financiero"
          iconBg="bg-blue-50" iconColor="#2E5C91"
          icon={<><path d="M3 5a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" /></>} />
        <KPICard label="Vigentes en cartera" value={kpis.vigentes}
          sub={`${kpis.total > 0 ? ((kpis.vigentes / kpis.total) * 100).toFixed(1) : 0}% del total`}
          iconBg="bg-green-50" iconColor="#10B981"
          icon={<><path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>} />
        <KPICard label="Monto Autorizado" value={fmtMoneyShort(kpis.montoTotal)} sub="Suma de contratos"
          iconBg="bg-indigo-50" iconColor="#4F46E5"
          icon={<><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" /></>} />
        <KPICard label="Valor Residual" value={fmtMoneyShort(kpis.residual)} sub="Al final del plazo"
          iconBg="bg-amber-50" iconColor="#D97706"
          icon={<><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 4-6" /></>} />
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 rounded">
          <div className="border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Distribución por Estatus de Cartera</h2>
            <p className="text-xs text-gray-600 mt-0.5">Contratos vigentes vs. en proceso</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            {distribucionEstatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={distribucionEstatus} dataKey="cantidad" nameKey="estatus"
                    cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {distribucionEstatus.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, 'Contratos']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-xs">Sin datos</div>
            )}
          </div>
          <div className="flex items-center justify-center gap-4 pb-4 flex-wrap px-4">
            {distribucionEstatus.map(d => (
              <div key={d.estatus} className="flex items-center gap-1.5 text-xs text-gray-700">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span>{d.estatus} ({d.cantidad})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded">
          <div className="border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Monto Autorizado por Producto</h2>
            <p className="text-xs text-gray-600 mt-0.5">Exposición por producto de arrendamiento</p>
          </div>
          <div className="p-4">
            {montoPorProducto.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={montoPorProducto}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="producto" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [fmtMoney(v), 'Monto']} />
                  <Bar dataKey="monto" fill="#2E5C91" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-400 text-xs">Sin datos</div>
            )}
          </div>
        </div>
      </div>

      {/* Recientes */}
      <div className="bg-white border border-gray-300 rounded">
        <div className="border-b border-gray-300 px-4 py-3">
          <h2 className="text-base font-medium text-gray-900">Contratos Recientes</h2>
          <p className="text-xs text-gray-600 mt-0.5">Últimos arrendamientos registrados</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-300">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-gray-700">No. Sol.</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Cliente</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Producto</th>
                <th className="text-right px-3 py-2 font-medium text-gray-700">Monto Aut.</th>
                <th className="text-right px-3 py-2 font-medium text-gray-700">Residual</th>
                <th className="text-left px-3 py-2 font-medium text-gray-700">Cartera</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">Cargando...</td></tr>
              ) : recientes.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">
                  Sin contratos de Arrendamiento
                </td></tr>
              ) : recientes.map((c, idx) => (
                <tr key={c.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-[#0066CC] cursor-pointer hover:underline font-mono" onClick={() => onVer(c)}>{c.noSol}</td>
                  <td className="px-3 py-2 text-gray-900">{c.cliente}</td>
                  <td className="px-3 py-2 text-gray-600">{c.productoNombre}</td>
                  <td className="px-3 py-2 text-gray-700 text-right">{fmtMoney(c.montoAutorizado)}</td>
                  <td className="px-3 py-2 text-gray-700 text-right">{fmtMoney(c.montoResidual)}</td>
                  <td className="px-3 py-2">{badgeCartera(c.estatusCartera)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// LISTA — patrón institucional (idéntico a CarteraList / CobranzaModule)
// ═══════════════════════════════════════════════════════════════════
function ListScreen({ rows, loading, error, refetch, onVer }: {
  rows: ContratoArrendamiento[]; loading: boolean; error: string | null;
  refetch: () => void; onVer: (c: ContratoArrendamiento) => void;
}) {
  const [search, setSearch] = useState('');
  const [filtroCartera, setFiltroCartera] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  const filtered = useMemo(() => {
    let list = rows;
    if (filtroCartera) list = list.filter(r => r.estatusCartera === filtroCartera);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(r =>
        r.noSol.toLowerCase().includes(q) ||
        r.cliente.toLowerCase().includes(q) ||
        r.productoNombre.toLowerCase().includes(q) ||
        r.estatusCartera.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      const da = new Date(a.fechaSol || 0).getTime();
      const db = new Date(b.fechaSol || 0).getTime();
      return sortOrder === 'desc' ? db - da : da - db;
    });
  }, [rows, search, filtroCartera, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const exportCSV = () => {
    const headers = ['No. Solicitud','Cliente','Producto','Monto Aut.','Enganche','Residual','Plazo','Renta','Rentas Pagadas','Cartera'];
    const lines = filtered.map(c => [
      c.noSol, c.cliente, c.productoNombre, c.montoAutorizado,
      c.montoEnganche, c.montoResidual, c.plazo || '', c.rentaMensual,
      `${c.rentasPagadas}/${c.calendario.length}`, c.estatusCartera,
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = '﻿' + [headers.join(','), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cartera_arrendamiento_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const buildTableHTML = () => {
    const body = filtered.map(c => `
      <tr>
        <td>${c.noSol || '—'}</td>
        <td>${c.cliente || '—'}</td>
        <td>${c.productoNombre || '—'}</td>
        <td style="text-align:right">${fmtMoney(c.montoAutorizado)}</td>
        <td style="text-align:right">${fmtMoney(c.montoEnganche)}</td>
        <td style="text-align:right">${fmtMoney(c.montoResidual)}</td>
        <td style="text-align:center">${c.plazo || '—'}</td>
        <td style="text-align:right">${fmtMoney(c.rentaMensual)}</td>
        <td style="text-align:center">${c.calendario.length ? `${c.rentasPagadas}/${c.calendario.length}` : '—'}</td>
        <td>${c.estatusCartera}</td>
      </tr>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>Cartera de Arrendamiento</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; }
        h2 { font-size: 13px; margin-bottom: 4px; }
        p.meta { font-size: 9px; color: #666; margin-bottom: 12px; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #374151; color: #fff; padding: 5px 8px; text-align: left; font-size: 9px; }
        td { padding: 4px 8px; border-bottom: 1px solid #e5e7eb; }
        tr:nth-child(even) td { background: #f9fafb; }
        @media print { body { margin: 10mm; } }
      </style></head><body>
      <h2>Gestión de Cartera — Arrendamiento</h2>
      <p class="meta">Generado: ${new Date().toLocaleDateString('es-MX', { dateStyle: 'long' })} — ${filtered.length} registro(s)</p>
      <table>
        <thead><tr>
          <th>NO. SOLICITUD</th><th>CLIENTE</th><th>PRODUCTO</th>
          <th>MONTO AUT.</th><th>ENGANCHE</th><th>RESIDUAL</th>
          <th>PLAZO</th><th>RENTA</th><th>RENTAS PAGADAS</th><th>CARTERA</th>
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </body></html>`;
  };

  const imprimir = () => {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(buildTableHTML());
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  return (
    <div className="bg-white min-h-screen">

      {/* ── Header ── */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5">
              <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M8 5V3M16 5V3" />
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Gestión de Cartera — Arrendamiento</h2>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span className="cursor-pointer hover:text-secondary-theme transition-colors">Lista</span>
            <span className="cursor-pointer hover:text-secondary-theme transition-colors">Buscar</span>
          </div>
        </div>
      </div>

      {/* ── Barra de vista ── */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700">Ver</span>
          <div className="relative">
            <select className="px-3 py-1.5 border border-gray-400 rounded text-sm bg-white pr-8 appearance-none min-w-[280px]">
              <option>Vista general de Cartera de Arrendamiento</option>
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="12" viewBox="0 0 12 12" fill="#666">
              <path d="M6 8l-4-4h8z" />
            </svg>
          </div>
          <button onClick={refetch} disabled={loading}
            className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 rounded text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5">
            {loading ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="2">
                <circle cx="7" cy="7" r="5" strokeDasharray="20" strokeDashoffset="10" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#666" strokeWidth="1.5">
                <path d="M1 7a6 6 0 0111.196-3M13 7a6 6 0 01-11.196 3" /><path d="M1 1v3h3M13 13v-3h-3" />
              </svg>
            )}
            Refrescar
          </button>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 font-medium">Estatus</span>
            <div className="relative">
              <select value={filtroCartera} onChange={e => { setFiltroCartera(e.target.value); setPage(1); }}
                className="px-3 py-1 border border-gray-400 rounded text-sm bg-white appearance-none pr-7">
                <option value="">Todos</option>
                <option value="Vigente">Vigente</option>
                <option value="En proceso">En proceso</option>
                <option value="Vencida">Vencida</option>
                <option value="Castigada">Castigada</option>
                <option value="Reestructurada">Reestructurada</option>
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="10" height="10" viewBox="0 0 12 12" fill="#666">
                <path d="M6 8l-4-4h8z" />
              </svg>
            </div>
          </div>
          <input type="text" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por No. Solicitud, cliente, producto..."
            className="px-3 py-1 border border-gray-400 rounded text-sm w-80 transition-all" />
        </div>
      </div>

      {/* ── Exportación / Orden ── */}
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button className="p-1.5 hover:bg-gray-200 rounded transition-colors" title="CSV" onClick={exportCSV}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" fill="#6B7280" /><text x="10" y="13" fontSize="7" fontWeight="bold" textAnchor="middle" fill="white">CSV</text></svg>
            </button>
            <button className="p-1.5 hover:bg-green-100 rounded transition-colors" title="Excel" onClick={exportCSV}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="3" width="14" height="14" rx="2" fill="#1D9F5B" /><path d="M6 3v14M10 3v14M14 3v14M3 7h14M3 11h14M3 15h14" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-red-100 rounded transition-colors" title="PDF" onClick={imprimir}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M5 3h8l4 4v10a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" fill="#D32F2F" /><path d="M13 3v4h4" stroke="white" strokeWidth="1.2" fill="none" /><path d="M7 10h6M7 13h4" stroke="white" strokeWidth="1.2" /></svg>
            </button>
            <button className="p-1.5 hover:bg-blue-100 rounded transition-colors" title="Imprimir" onClick={imprimir}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="5" y="3" width="10" height="3" rx="0.5" fill="#1976D2" /><rect x="3" y="6" width="14" height="7" rx="1" stroke="#1976D2" strokeWidth="1.5" fill="none" /><rect x="5" y="11" width="10" height="6" rx="0.5" fill="#1976D2" /><circle cx="5" cy="8" r="0.8" fill="#1976D2" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              <span>Orden</span>
              <select value={sortOrder} onChange={e => { setSortOrder(e.target.value as 'desc' | 'asc'); setPage(1); }}
                className="px-2 py-1 border border-gray-400 rounded text-sm bg-white pr-6 appearance-none">
                <option value="desc">Descendente</option>
                <option value="asc">Ascendente</option>
              </select>
            </div>
            <span className="font-medium">Total: {filtered.length}</span>
          </div>
        </div>
      </div>

      {error && <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>}

      {/* ── Tabla ── */}
      <div className="px-4 py-4">
        <div className="border border-gray-300 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">Ver</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">NO. SOLICITUD</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">CLIENTE</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">PRODUCTO</th>
                <th className="px-2 py-2.5 text-right font-medium text-xs text-gray-700">MONTO AUT.</th>
                <th className="px-2 py-2.5 text-right font-medium text-xs text-gray-700">ENGANCHE</th>
                <th className="px-2 py-2.5 text-right font-medium text-xs text-gray-700">RESIDUAL</th>
                <th className="px-2 py-2.5 text-center font-medium text-xs text-gray-700">PLAZO</th>
                <th className="px-2 py-2.5 text-right font-medium text-xs text-gray-700">RENTA</th>
                <th className="px-2 py-2.5 text-center font-medium text-xs text-gray-700">RENTAS PAGADAS</th>
                <th className="px-2 py-2.5 text-left font-medium text-xs text-gray-700">CARTERA</th>
              </tr>
            </thead>
            <tbody>
              {loading && pageRows.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-400">
                  <div className="flex items-center justify-center gap-2">
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#666" strokeWidth="2">
                      <circle cx="8" cy="8" r="6" strokeDasharray="24" strokeDashoffset="12" />
                    </svg>
                    Cargando contratos...
                  </div>
                </td></tr>
              ) : pageRows.length === 0 ? (
                <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-500">No se encontraron contratos de Arrendamiento</td></tr>
              ) : pageRows.map((c, idx) => (
                <tr key={c.id}
                  className="border-b border-gray-200 transition-colors duration-150"
                  style={{ backgroundColor: idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#E8F4F8')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = idx % 2 === 1 ? '#EEEEEE' : '#FFFFFF')}
                >
                  <td className="px-2 py-2.5 text-xs whitespace-nowrap">
                    <a href="#" className="text-[#0066CC] hover:underline" onClick={e => { e.preventDefault(); onVer(c); }}>Ver</a>
                  </td>
                  <td className="px-2 py-2.5 text-xs font-mono text-[#0066CC] cursor-pointer hover:underline" onClick={() => onVer(c)}>{c.noSol}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-800 font-medium max-w-[160px] truncate" title={c.cliente}>{c.cliente}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 max-w-[140px] truncate" title={c.productoNombre}>{c.productoNombre}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-800 text-right font-mono">{fmtMoney(c.montoAutorizado)}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 text-right font-mono">{fmtMoney(c.montoEnganche)}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-700 text-right font-mono">{fmtMoney(c.montoResidual)}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-600 text-center">{c.plazo ? `${c.plazo}m` : '—'}</td>
                  <td className="px-2 py-2.5 text-xs text-gray-800 text-right font-mono">{fmtMoney(c.rentaMensual)}</td>
                  <td className="px-2 py-2.5 text-xs text-center">
                    {c.calendario.length === 0 ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${
                        c.rentasPagadas === c.calendario.length
                          ? 'text-green-700 bg-green-50 border-green-200'
                          : c.rentasPagadas > 0
                            ? 'text-blue-700 bg-blue-50 border-blue-200'
                            : 'text-gray-600 bg-gray-50 border-gray-200'
                      }`}>
                        {c.rentasPagadas}/{c.calendario.length}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5 text-xs">{badgeCartera(c.estatusCartera)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Paginación ── */}
      <div className="px-4 py-3 border-t border-gray-300">
        <div className="flex items-center justify-end gap-3">
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={() => setPage(1)} disabled={page === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M13 4L4 9l9 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M9 4L4 9l5 5V4z" /></svg>
          </button>
          <div className="text-sm text-gray-700 min-w-[100px] text-center">
            Página {page} de {totalPages}
          </div>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M5 4l5 5-5 5V4z" /></svg>
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded disabled:opacity-40" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#666" strokeWidth="1.5"><path d="M4 4L13 9l-9 5V4z" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DETALLE — encabezado + barra de acciones + tab bar institucional
// ═══════════════════════════════════════════════════════════════════
const TABS_DETALLE = [
  { id: 'datos',      label: 'Parámetros del Contrato' },
  { id: 'calendario', label: 'Calendario de Rentas' },
  { id: 'avisos',     label: 'Avisos de Vencimiento' },
  { id: 'facturas',   label: 'Facturas' },
] as const;

type TabDetalle = typeof TABS_DETALLE[number]['id'];

function DetalleScreen({ contrato, onBack, onVerXML, onAvisoCreado }: {
  contrato: ContratoArrendamiento;
  onBack: () => void;
  onVerXML: (f: FacturaCartera) => void;
  onAvisoCreado: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabDetalle>('datos');
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [showAvisoModal, setShowAvisoModal] = useState(false);
  const [enviandoAviso, setEnviandoAviso] = useState(false);
  const [formaPago, setFormaPago] = useState('Banca por internet');

  const esPendiente = (r: RentaCalendario) => r.estatus !== 'Pagado' && r.estatus !== 'Facturada';
  const rentasSeleccionadas = contrato.calendario.filter(r => seleccion.has(r.noRenta));
  const totalesSeleccion = rentasSeleccionadas.reduce(
    (a, r) => ({
      renta: a.renta + (r.rentaSinIva || 0),
      seguro: a.seguro + (r.seguro || 0),
      iva: a.iva + (r.iva || 0),
      total: a.total + (r.pagoPeriodo || 0),
    }),
    { renta: 0, seguro: 0, iva: 0, total: 0 },
  );

  const toggle = (r: RentaCalendario) => {
    if (!esPendiente(r)) return;
    setSeleccion(prev => {
      const next = new Set(prev);
      next.has(r.noRenta) ? next.delete(r.noRenta) : next.add(r.noRenta);
      return next;
    });
  };

  const pendientes = contrato.calendario.filter(esPendiente);
  const todasSeleccionadas = pendientes.length > 0 && pendientes.every(r => seleccion.has(r.noRenta));
  const toggleTodas = () => {
    setSeleccion(todasSeleccionadas ? new Set() : new Set(pendientes.map(r => r.noRenta)));
  };

  const crearAviso = async () => {
    if (rentasSeleccionadas.length === 0) { toast.error('Seleccione al menos una renta'); return; }
    setEnviandoAviso(true);
    try {
      const conceptos = [
        { cve: 'RENTA',  desc: 'Renta del periodo', monto: totalesSeleccion.renta },
        { cve: 'SEGURO', desc: 'Seguro',            monto: totalesSeleccion.seguro },
        { cve: 'IVA',    desc: 'IVA',               monto: totalesSeleccion.iva },
      ].filter(c => c.monto > 0);

      const alta = await crearFacturaArrendamientoCobranza({
        solicitud_id: contrato.id,
        cliente: contrato.cliente,
        // El arrendatario le paga a la institución.
        tipo: 'Por Cobrar',
        conceptos,
        total: totalesSeleccion.total,
        fecha_compromiso: rentasSeleccionadas[0]?.fechaPago,
        referencia: contrato.noSol || undefined,
        forma_pago: formaPago,
      });

      if (!alta.ok) {
        toast.error('No se pudo crear el aviso de vencimiento', { description: alta.error, duration: 9000 });
        return;
      }

      // Marcar las rentas como facturadas y ligarlas al aviso — es lo que
      // después permite ver en la lista si ya se pagaron.
      const calendarioActualizado = contrato.calendario.map(r =>
        seleccion.has(r.noRenta)
          ? { ...r, estatus: 'Facturada', facturaIdCobranza: alta.factura_id }
          : r
      );
      const guardado = await actualizarCalendarioArrendamientoDB(contrato.id, calendarioActualizado);
      if (!guardado.ok) {
        toast.warning('Aviso creado, pero no se pudo marcar el calendario', {
          description: guardado.error, duration: 9000,
        });
      } else {
        toast.success('Aviso de vencimiento creado', {
          description: `${alta.no_docto || ''} · ${rentasSeleccionadas.length} renta(s) · ${fmtMoney(totalesSeleccion.total)}. Ya aparece en Cobranza → Facturación — Arrendamiento.`,
          duration: 9000,
        });
      }
      setSeleccion(new Set());
      setShowAvisoModal(false);
      onAvisoCreado();
    } finally {
      setEnviandoAviso(false);
    }
  };

  return (
    <div className="bg-white min-h-screen">

      {/* ── Header ── */}
      <div className="bg-white px-4 py-2.5 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="stroke-accent-theme" strokeWidth="1.5">
              <rect x="2" y="3" width="16" height="12" rx="1.5" /><path d="M6 9l3 3 5-5" />
            </svg>
            <span className="text-sm text-gray-700 font-normal">Ver Contrato de Arrendamiento</span>
            <span className="text-xs text-gray-500 ml-1">— {contrato.cliente}</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button onClick={onBack} className="text-accent-theme hover:underline">Lista</button>
          </div>
        </div>
      </div>

      {/* ── Barra de acciones ── */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-2">
          <button onClick={onBack}
            className="px-5 py-1.5 bg-white border border-gray-400 rounded text-xs hover:bg-gray-50 text-gray-700">
            Cerrar
          </button>
          {badgeCartera(contrato.estatusCartera)}
          <span className="ml-4 text-xs text-gray-500">
            Monto Autorizado: <span className="font-medium text-gray-700">{fmtMoney(contrato.montoAutorizado)}</span>
          </span>
          <span className="text-xs text-gray-500">
            Renta: <span className="font-medium text-gray-700">{fmtMoney(contrato.rentaMensual)}</span>
          </span>
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="px-4 py-3">
        <div className="bg-white border border-gray-300">

          {/* Datos del Contrato — siempre visible */}
          <div className="border-l-4 border-primary-theme px-3 py-1.5">
            <span className="text-xs font-medium text-gray-800 uppercase">Datos del Contrato</span>
          </div>
          <div className="p-3">
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
              <div className="space-y-1.5">
                <Field label="No. Solicitud" value={<span className="font-mono">{contrato.noSol}</span>} />
                <Field label="Cliente" value={contrato.cliente} />
              </div>
              <div className="space-y-1.5">
                <Field label="Producto" value={contrato.productoNombre} />
                <Field label="Fecha de Solicitud" value={contrato.fechaSol} />
              </div>
              <div className="space-y-1.5">
                <Field label="Estatus de Solicitud" value={contrato.estatusSolicitud} />
                <Field label="Estatus de Cartera" value={badgeCartera(contrato.estatusCartera)} />
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="bg-primary-theme border-t border-gray-400">
            <div className="flex items-center overflow-x-auto">
              {TABS_DETALLE.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-[10px] whitespace-nowrap border-r border-gray-500/30 ${
                    activeTab === tab.id ? 'bg-secondary-theme text-white font-medium' : 'text-white/90'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Parámetros */}
          {activeTab === 'datos' && (
            <>
              <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-2 border-t border-gray-300">
                <span className="text-sm font-medium text-gray-800">PARÁMETROS DEL ARRENDAMIENTO</span>
              </div>
              <div className="p-3">
                <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                  <div className="space-y-1.5">
                    <Field label="Monto Solicitado" value={fmtMoney(contrato.montoSolicitado)} />
                    <Field label="Monto Autorizado" value={fmtMoney(contrato.montoAutorizado)} />
                    <Field label="% Enganche" value={contrato.porcentajeEnganche ? `${contrato.porcentajeEnganche}%` : '—'} />
                    <Field label="Monto Enganche" value={fmtMoney(contrato.montoEnganche)} />
                  </div>
                  <div className="space-y-1.5">
                    <Field label="% Valor Residual" value={contrato.porcentajeValorResidual ? `${contrato.porcentajeValorResidual}%` : '—'} />
                    <Field label="Monto Residual" value={fmtMoney(contrato.montoResidual)} />
                    <Field label="Rentas Anticipadas" value={contrato.rentasAnticipadas} />
                    <Field label="Renta del Periodo" value={fmtMoney(contrato.rentaMensual)} />
                  </div>
                  <div className="space-y-1.5">
                    <Field label="Plazo" value={contrato.plazo ? `${contrato.plazo} meses` : '—'} />
                    <Field label="Tasa" value={contrato.tasa ? `${contrato.tasa}%` : '—'} />
                    <Field label="Frecuencia" value={contrato.frecuencia} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Calendario de rentas */}
          {activeTab === 'calendario' && (
            <div className="p-4">
              <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">CALENDARIO DE RENTAS</span>
                <span className="text-xs text-gray-600">
                  {contrato.calendario.length} renta(s) · {pendientes.length} pendiente(s) · {seleccion.size} seleccionada(s)
                </span>
              </div>

              {/* Acción — generar Aviso de Vencimiento con las rentas marcadas */}
              <div className="flex items-center justify-end mb-2">
                <button
                  onClick={() => seleccion.size > 0 ? setShowAvisoModal(true) : toast.error('Seleccione al menos una renta')}
                  disabled={seleccion.size === 0}
                  className="px-3 py-1.5 text-xs font-medium rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 1v6M3 4l3 3 3-3" strokeLinecap="round" /><rect x="1" y="8" width="10" height="3" rx="1" />
                  </svg>
                  Crear Aviso de Vencimiento {seleccion.size > 0 && `(${seleccion.size})`}
                </button>
              </div>

              <div className="border border-gray-300 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
                      <th className="px-2 py-2 text-center w-8">
                        <input type="checkbox" checked={todasSeleccionadas} onChange={toggleTodas}
                          disabled={pendientes.length === 0} className="cursor-pointer disabled:opacity-30" />
                      </th>
                      <th className="px-3 py-2 text-center text-[10px] text-gray-700 font-semibold">NO. RENTA</th>
                      <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold">FECHA</th>
                      <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold">RENTA SIN IVA</th>
                      <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold">SEGURO</th>
                      <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold">IVA</th>
                      <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold">PAGO PERIODO</th>
                      <th className="px-3 py-2 text-center text-[10px] text-gray-700 font-semibold">ESTATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contrato.calendario.length === 0 ? (
                      <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                        El contrato no tiene calendario de rentas guardado.
                      </td></tr>
                    ) : contrato.calendario.map((r, idx) => {
                      const seleccionable = esPendiente(r);
                      const marcada = seleccion.has(r.noRenta);
                      return (
                      <tr key={r.noRenta}
                        onClick={() => toggle(r)}
                        className={`border-b border-gray-200 transition-colors ${
                          marcada ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                        } ${seleccionable ? 'cursor-pointer hover:bg-blue-50/60' : ''}`}
                      >
                        <td className="px-2 py-1.5 text-center">
                          <input type="checkbox" checked={marcada} disabled={!seleccionable}
                            onChange={() => toggle(r)} onClick={e => e.stopPropagation()}
                            className="disabled:opacity-30" />
                        </td>
                        <td className="px-3 py-1.5 text-center">{r.noRenta}</td>
                        <td className="px-3 py-1.5">{r.fechaPago}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{fmtMoney(r.rentaSinIva)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{fmtMoney(r.seguro)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{fmtMoney(r.iva)}</td>
                        <td className="px-3 py-1.5 text-right font-mono font-medium">{fmtMoney(r.pagoPeriodo)}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={`inline-flex px-1.5 py-0.5 text-[9px] border rounded ${
                            r.estatus === 'Pagado'
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {r.estatus === 'Pagado' ? 'Pagada' : r.estatus}
                          </span>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                  {contrato.calendario.length > 0 && (
                    <tfoot>
                      {seleccion.size > 0 && (
                        <tr className="bg-blue-100 border-t border-blue-200 font-medium text-blue-900">
                          <td colSpan={3} className="px-3 py-2 text-right text-[10px] uppercase tracking-wide">Selección:</td>
                          <td className="px-3 py-2 text-right font-mono">{fmtMoney(totalesSeleccion.renta)}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmtMoney(totalesSeleccion.seguro)}</td>
                          <td className="px-3 py-2 text-right font-mono">{fmtMoney(totalesSeleccion.iva)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold">{fmtMoney(totalesSeleccion.total)}</td>
                          <td />
                        </tr>
                      )}
                      <tr className="bg-gray-50 border-t border-gray-300">
                        <td colSpan={6} className="px-3 py-2 text-right font-semibold text-gray-700">TOTAL GENERAL:</td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">
                          {fmtMoney(contrato.calendario.reduce((s, r) => s + (r.pagoPeriodo || 0), 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Avisos de Vencimiento — mismo componente que usa Cartera de Crédito
              (CarteraForm). `useAvisos` consulta /cartera/avisos/:solicitudId,
              que filtra por solicitud y NO por sub_tipo, así que devuelve los
              avisos de arrendamiento sin necesidad de un endpoint aparte. */}
          {activeTab === 'avisos' && (
            <div className="p-4">
              <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-2">
                <span className="text-sm font-medium text-gray-800">AVISOS DE VENCIMIENTO DEL CONTRATO</span>
              </div>
              <AvisosVencimientoTab solicitudId={contrato.id} />
            </div>
          )}

          {/* Facturas */}
          {activeTab === 'facturas' && (
            <div className="p-4">
              <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">FACTURAS DEL CONTRATO</span>
                <span className="text-xs text-gray-600">{contrato.facturas.length} factura(s)</span>
              </div>
              <div className="border border-gray-300 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300">
                      <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold">DOCUMENTO</th>
                      <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold">FOLIO</th>
                      <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold">CONTRAPARTE</th>
                      <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold">FECHA</th>
                      <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold">TOTAL</th>
                      <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold">ESTATUS</th>
                      <th className="px-3 py-2 text-center text-[10px] text-gray-700 font-semibold">CFDI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contrato.facturas.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                        El contrato no tiene facturas registradas.
                      </td></tr>
                    ) : contrato.facturas.map((f, idx) => (
                      <tr key={f.noFactura || idx} className={`border-b border-gray-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-3 py-1.5">{f.titulo}</td>
                        <td className="px-3 py-1.5 font-mono">{f.noFactura}</td>
                        <td className="px-3 py-1.5">{f.contraparte}</td>
                        <td className="px-3 py-1.5">{f.fechaEmision}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{fmtMoney(f.total)}</td>
                        <td className="px-3 py-1.5">{badgeFactura(f.estatus)}</td>
                        <td className="px-3 py-1.5 text-center">
                          {f.xml ? (
                            <button onClick={() => onVerXML(f)}
                              className="px-2 py-0.5 border border-gray-300 rounded text-[10px] hover:bg-gray-100">
                              Ver XML
                            </button>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: Nuevo Aviso de Vencimiento ── */}
      {showAvisoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowAvisoModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-[#2E5C91] rounded-t-xl">
              <div>
                <h4 className="text-sm font-bold text-white">Nuevo Aviso de Vencimiento</h4>
                <p className="text-[11px] text-blue-200 mt-0.5">
                  {seleccion.size} renta{seleccion.size !== 1 ? 's' : ''} · {contrato.noSol}
                </p>
              </div>
              <button onClick={() => setShowAvisoModal(false)} className="text-white/70 hover:text-white">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8" /></svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 grid grid-cols-2 gap-y-1.5 gap-x-6">
                {[
                  ['Renta', totalesSeleccion.renta],
                  ...(totalesSeleccion.seguro > 0 ? [['Seguro', totalesSeleccion.seguro] as [string, number]] : []),
                  ['IVA', totalesSeleccion.iva],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between text-xs">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-medium">{fmtMoney(val as number)}</span>
                  </div>
                ))}
                <div className="col-span-2 flex justify-between text-xs font-bold border-t border-gray-200 pt-1.5 mt-0.5">
                  <span>Total a Cobrar</span>
                  <span className="text-[#2E5C91]">{fmtMoney(totalesSeleccion.total)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Forma de Pago *</label>
                  <select value={formaPago} onChange={e => setFormaPago(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg">
                    <option>Banca por internet</option>
                    <option>En sucursal</option>
                    <option>Transferencia SPEI</option>
                    <option>Depósito en efectivo</option>
                    <option>Cheque</option>
                    <option>Cargo automático</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Fecha Compromiso</label>
                  <input type="text" value={rentasSeleccionadas[0]?.fechaPago || ''} readOnly
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-default" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">No. Solicitud</label>
                  <input type="text" value={contrato.noSol} readOnly
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-default" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Cliente</label>
                  <input type="text" value={contrato.cliente} readOnly
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-default" />
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-2">
              <button onClick={() => setShowAvisoModal(false)}
                className="px-4 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100">
                Cancelar
              </button>
              <button onClick={crearAviso} disabled={enviandoAviso}
                className="px-5 py-1.5 text-xs bg-[#2E5C91] text-white rounded-lg hover:bg-[#245080] disabled:opacity-50 font-medium flex items-center gap-1.5">
                {enviandoAviso ? 'Creando...' : 'Crear Aviso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type ViewState =
  | { type: 'inicio' }
  | { type: 'lista' }
  // Se guarda el id, no el objeto: así al refrescar (p. ej. tras crear un
  // aviso) el detalle toma la versión nueva en vez de un snapshot viejo.
  | { type: 'detalle'; contratoId: string };

// ═══════════════════════════════════════════════════════════════════
// MÓDULO
// ═══════════════════════════════════════════════════════════════════
export function CarteraArrendamientoList() {
  const [view, setView] = useState<ViewState>({ type: 'inicio' });
  const { rows, loading, error, refetch } = useArrendamientos();
  const [xmlAbierto, setXmlAbierto] = useState<FacturaCartera | null>(null);

  const descargarXML = (f: FacturaCartera) => {
    const blob = new Blob([f.xml || ''], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CFDI_${f.noFactura || 'factura'}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const irDetalle = (c: ContratoArrendamiento) => setView({ type: 'detalle', contratoId: c.id });
  const contratoSel = view.type === 'detalle'
    ? rows.find(r => r.id === view.contratoId)
    : undefined;

  return (
    <>
      {/* Sub-navegación institucional */}
      <div className="bg-gray-100 border-b border-gray-300">
        <div className="px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => setView({ type: 'inicio' })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${view.type === 'inicio' ? 'tab-active' : 'tab-inactive'}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 8l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z" /><path d="M6 14v-5h4v5" />
            </svg>
            Inicio
          </button>
          <button
            onClick={() => setView({ type: 'lista' })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${view.type === 'lista' ? 'tab-active' : 'tab-inactive'}`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 4h10M3 8h10M3 12h10" />
            </svg>
            Contratos de Arrendamiento
          </button>
          {view.type === 'detalle' && (
            <button className="flex items-center gap-2 px-3 py-1.5 rounded text-sm tab-active">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 13l8-8 2 2-8 8H3v-2z" />
              </svg>
              Ver Contrato — {contratoSel?.noSol || ''}
            </button>
          )}
        </div>
      </div>

      {view.type === 'inicio' ? (
        <DashboardArrendamiento rows={rows} loading={loading} error={error} refetch={refetch} onVer={irDetalle} />
      ) : view.type === 'lista' ? (
        <ListScreen rows={rows} loading={loading} error={error} refetch={refetch} onVer={irDetalle} />
      ) : contratoSel ? (
        <DetalleScreen
          contrato={contratoSel}
          onBack={() => setView({ type: 'lista' })}
          onVerXML={setXmlAbierto}
          onAvisoCreado={refetch}
        />
      ) : (
        <div className="p-6 bg-[#F5F5F5] min-h-screen text-sm text-gray-500">
          {loading ? 'Cargando contrato...' : 'El contrato ya no está disponible.'}
        </div>
      )}

      {/* Visor del CFDI */}
      {xmlAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="bg-primary-theme px-6 py-4 flex items-center justify-between">
              <h3 className="text-base text-white">CFDI — {xmlAbierto.noFactura}</h3>
              <button onClick={() => setXmlAbierto(null)} className="text-white hover:text-gray-200">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10 8.586L2.929 1.515 1.515 2.929 8.586 10l-7.071 7.071 1.414 1.414L10 11.414l7.071 7.071 1.414-1.414L11.414 10l7.071-7.071-1.414-1.414L10 8.586z" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-3 border-b border-gray-200 grid grid-cols-3 gap-3 text-xs">
              <div><span className="text-gray-500">Emisor:</span> <strong>{xmlAbierto.contraparte}</strong></div>
              <div><span className="text-gray-500">Total:</span> <strong className="font-mono">{fmtMoney(xmlAbierto.total)}</strong></div>
              <div className="col-span-3"><span className="text-gray-500">UUID:</span> <span className="font-mono">{xmlAbierto.uuid || '—'}</span></div>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-[11px] font-mono bg-gray-50 whitespace-pre-wrap break-all">
              {xmlAbierto.xml}
            </pre>
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => { navigator.clipboard?.writeText(xmlAbierto.xml || ''); }}
                className="px-4 py-1.5 border border-gray-300 rounded text-xs bg-white"
              >
                Copiar
              </button>
              <button
                onClick={() => descargarXML(xmlAbierto)}
                className="px-4 py-1.5 rounded text-xs text-white"
                style={{ backgroundColor: '#1E4C81' }}
              >
                Descargar XML
              </button>
              <button onClick={() => setXmlAbierto(null)} className="px-4 py-1.5 border border-gray-300 rounded text-xs bg-white">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
