/**
 * Banca2oPisoDashboard.tsx — REQ-17, vista "Inicio" del módulo.
 *
 * Mismo estándar que `SolicitudesDashboard`: fila de 4 KPIs, registros recientes,
 * distribución por estatus, tendencias y comparativo por producto. A diferencia de
 * aquél, aquí **todas las series salen de los datos reales** de las líneas activas
 * (incluida la evolución mensual, derivada de la fecha de cada solicitud): un módulo
 * de administración no debe mostrar cifras inventadas.
 */
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { fmtMoneyExacto, norm, type LineaCreditoRow } from './banca2oPisoStore';

interface Props {
  rows: LineaCreditoRow[];
  loading: boolean;
  error: string | null;
  onGoToList: () => void;
}

const COLOR_ESTATUS: Record<string, string> = {
  activa: '#10B981',
  autorizada: '#3B82F6',
  'en administracion': '#7C3AED',
};

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Acepta `dd/mm/aaaa` y `aaaa-mm-dd`, que es como llegan las fechas del Core. */
function parseFecha(v?: string): Date | null {
  const s = String(v || '').trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const mx = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mx) {
    const anio = Number(mx[3]) < 100 ? 2000 + Number(mx[3]) : Number(mx[3]);
    return new Date(anio, Number(mx[2]) - 1, Number(mx[1]));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function Banca2oPisoDashboard({ rows, loading, error, onGoToList }: Props) {
  const total = rows.length;
  const montoTotal = rows.reduce((s, r) => s + r.montoAut, 0);
  const conGarantia = rows.filter(r => !!r.idGarantiaCartera).length;
  const conPoliza = rows.filter(r => !!r.polizaContableApertura).length;
  const promedio = total > 0 ? montoTotal / total : 0;
  const pctGarantia = total > 0 ? (conGarantia / total) * 100 : 0;

  // ── Últimas 8 líneas activadas ──
  const recientes = [...rows]
    .sort((a, b) => (parseFecha(b.fechaSol)?.getTime() || 0) - (parseFecha(a.fechaSol)?.getTime() || 0))
    .slice(0, 8);

  // ── Distribución por estatus (real) ──
  const porEstatus: Record<string, number> = {};
  rows.forEach(r => { porEstatus[r.estatus || '—'] = (porEstatus[r.estatus || '—'] || 0) + 1; });
  const distribucionEstatus = Object.entries(porEstatus).map(([estatus, cantidad]) => ({
    estatus, cantidad, color: COLOR_ESTATUS[norm(estatus)] || '#94A3B8',
  }));

  // ── Evolución de los últimos 6 meses, derivada de las fechas reales ──
  const hoy = new Date();
  const evolucion = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1);
    const lineas = rows.filter(r => {
      const f = parseFecha(r.fechaSol);
      return !!f && f.getFullYear() === d.getFullYear() && f.getMonth() === d.getMonth();
    }).length;
    return { mes: MESES[d.getMonth()], lineas };
  });

  // ── Monto por institución de gobierno ──
  const porInstitucion: Record<string, number> = {};
  rows.forEach(r => {
    const k = r.gobierno || 'Sin institución';
    porInstitucion[k] = (porInstitucion[k] || 0) + r.montoAut;
  });
  const institucionData = Object.entries(porInstitucion)
    .map(([institucion, monto]) => ({ institucion, monto }))
    .sort((a, b) => b.monto - a.monto)
    .slice(0, 6);

  // ── Monto por producto ──
  const porProducto: Record<string, number> = {};
  rows.forEach(r => {
    const k = r.productoNombre || 'Sin producto';
    porProducto[k] = (porProducto[k] || 0) + r.montoAut;
  });
  const productoData = Object.entries(porProducto).map(([producto, monto]) => ({ producto, monto }));

  if (error) {
    return (
      <div className="p-6">
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          No se pudo cargar la cartera de 2º piso: {error}
        </div>
      </div>
    );
  }

  if (loading && total === 0) {
    return <div className="p-6 text-sm text-gray-500">Cargando líneas de crédito…</div>;
  }

  if (total === 0) {
    return (
      <div className="p-6">
        <div className="bg-white border border-gray-300 rounded p-8 text-center">
          <p className="text-sm text-gray-700 font-medium">No hay Líneas de Crédito activas</p>
          <p className="text-xs text-gray-600 mt-2 max-w-xl mx-auto">
            Este módulo muestra únicamente cuentas con Línea de Producto = Línea de Crédito y
            estatus Activa, Autorizada o En Administración.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* ══════ 4 KPIs ══════ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Líneas activas</p>
              <p className="text-2xl font-semibold text-gray-900">{total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E5C91" strokeWidth="2">
                <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 14h8" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">Línea de Producto = Línea de Crédito</div>
        </div>

        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Monto autorizado</p>
              <p className="text-2xl font-semibold text-gray-900">{fmtMoneyExacto(montoTotal)}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">Promedio: {fmtMoneyExacto(promedio)}</div>
        </div>

        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Con garantía formalizada</p>
              <p className="text-2xl font-semibold text-gray-900">{pctGarantia.toFixed(1)}%</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">{conGarantia} de {total} con folio en cartera</div>
        </div>

        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Con póliza de apertura</p>
              <p className="text-2xl font-semibold text-gray-900">{conPoliza}</p>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" /><path d="M9 15h6" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">Detonadas al activar la línea</div>
        </div>
      </div>

      {/* ══════ Recientes + Distribución ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Líneas Recientes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimas líneas de crédito activadas</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">No. Cuenta</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Cliente</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Monto autorizado</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-700">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {recientes.map((r, idx) => (
                  <tr key={r.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-3 py-2 text-gray-900 font-medium max-w-[160px] truncate" title={r.noCuenta || r.noSol}>
                      {r.noCuenta || r.noSol || '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate" title={r.cliente}>{r.cliente}</td>
                    <td className="px-3 py-2 text-gray-900">{fmtMoneyExacto(r.montoAut)}</td>
                    <td className="px-3 py-2">
                      <span
                        className="px-2 py-0.5 rounded text-xs"
                        style={{
                          backgroundColor: `${COLOR_ESTATUS[norm(r.estatus)] || '#94A3B8'}1A`,
                          color: COLOR_ESTATUS[norm(r.estatus)] || '#475569',
                        }}
                      >
                        {r.estatus || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-gray-300 flex justify-end">
            <button onClick={onGoToList} className="text-xs text-[#0066CC] hover:underline">
              Ver todas las líneas →
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Distribución por Estatus</h2>
            <p className="text-xs text-gray-600 mt-0.5">Clasificación de las líneas activas</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            <div className="w-full">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={distribucionEstatus}
                    cx="50%" cy="50%" labelLine={false}
                    label={({ estatus, cantidad }) => `${estatus}: ${cantidad}`}
                    outerRadius={80} dataKey="cantidad" nameKey="estatus"
                  >
                    {distribucionEstatus.map(entry => (
                      <Cell key={`cell-${entry.estatus}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {distribucionEstatus.map(item => (
                  <div key={item.estatus} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-700">{item.estatus}: {item.cantidad}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════ Tendencias ══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Evolución de Líneas Activas</h2>
            <p className="text-xs text-gray-600 mt-0.5">Altas de los últimos 6 meses</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={evolucion}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} stroke="#6B7280" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="lineas" stroke="#2E5C91" strokeWidth={2} dot={{ fill: '#2E5C91', r: 4 }} activeDot={{ r: 6 }} name="Líneas" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Monto por Institución de Gobierno</h2>
            <p className="text-xs text-gray-600 mt-0.5">Concentración de la exposición</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={institucionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="institucion" tick={{ fontSize: 10 }} stroke="#6B7280" interval={0} height={50} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 12 }} stroke="#6B7280" />
                <Tooltip formatter={(value) => fmtMoneyExacto(Number(value))} />
                <Bar dataKey="monto" fill="#4A6FA5" radius={[4, 4, 0, 0]} name="Monto autorizado" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ══════ Montos por producto ══════ */}
      <div className="bg-white border border-gray-300 rounded">
        <div className="bg-white border-b border-gray-300 px-4 py-3">
          <h2 className="text-base font-medium text-gray-900">Monto Autorizado por Producto</h2>
          <p className="text-xs text-gray-600 mt-0.5">Comparativo entre los productos de Línea de Crédito</p>
        </div>
        <div className="p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={productoData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="#6B7280" />
              <YAxis dataKey="producto" type="category" tick={{ fontSize: 11 }} stroke="#6B7280" width={180} />
              <Tooltip formatter={(value) => fmtMoneyExacto(Number(value))} />
              <Bar dataKey="monto" fill="#10B981" radius={[0, 4, 4, 0]} name="Monto autorizado" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
