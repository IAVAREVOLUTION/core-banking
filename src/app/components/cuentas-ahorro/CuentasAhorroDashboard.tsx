import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useCuentasAhorroDB, CuentaAhorroListItem } from '../../hooks/useCuentasAhorroDB';

interface CuentasAhorroDashboardProps {
  onNew?: () => void;
  onEdit?: (id: number | string) => void;
  onView?: (id: number | string) => void;
}

export function CuentasAhorroDashboard({ onNew, onEdit, onView }: CuentasAhorroDashboardProps) {
  const { cuentas, loading, backendStatus } = useCuentasAhorroDB();

  // ── Helpers ──
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '—';
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return '—';
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="p-6 bg-[#F5F5F5] min-h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2E5C91] mx-auto" />
          <p className="text-sm text-gray-600">Cargando dashboard de cuentas de ahorro...</p>
        </div>
      </div>
    );
  }

  // ── KPIs calculados desde datos reales ──
  const totalCuentas = cuentas.length;
  const saldoTotal = cuentas.reduce((sum, c) => sum + (c.saldoActual || 0), 0);
  const cuentasEje = cuentas.filter(c => c.ctaEjeChec && c.ctaEjeChec !== '—' && c.ctaEjeChec !== '').length;
  const saldoPromedio = totalCuentas > 0 ? saldoTotal / totalCuentas : 0;

  // Cuentas recientes (últimas 8 por fecha_sol)
  const cuentasRecientes = [...cuentas]
    .sort((a, b) => {
      const dateA = a.fechaSol ? new Date(a.fechaSol).getTime() : 0;
      const dateB = b.fechaSol ? new Date(b.fechaSol).getTime() : 0;
      return dateB - dateA;
    })
    .slice(0, 8);

  // Distribución por estatus de cuenta
  const distribucionEstatus = (() => {
    const map = new Map<string, number>();
    cuentas.forEach(c => {
      const key = c.estatusCuen || 'Sin estatus';
      map.set(key, (map.get(key) || 0) + 1);
    });
    const colores: Record<string, string> = {
      'Activa': '#10B981',
      'Pendiente': '#F59E0B',
      'Cancelada': '#EF4444',
      'Vencida': '#8B5CF6',
      'Sin estatus': '#94A3B8',
    };
    return Array.from(map.entries()).map(([estatus, cantidad]) => ({
      name: estatus,
      tipo: estatus,
      cantidad,
      color: colores[estatus] || '#6B7280',
    }));
  })();

  // Distribución por producto (producto_eje o productoNombre)
  const distribucionProducto = (() => {
    const map = new Map<string, number>();
    cuentas.forEach(c => {
      const key = c.productoNombre && c.productoNombre !== '—' ? c.productoNombre : 'Sin producto';
      map.set(key, (map.get(key) || 0) + 1);
    });
    const colores = ['#2E5C91', '#4A6FA5', '#6B8FC5', '#8BADD6', '#A3C4E9'];
    return Array.from(map.entries()).map(([producto, cantidad], idx) => ({
      name: producto,
      tipo: producto,
      cantidad,
      color: colores[idx % colores.length],
    }));
  })();

  // Saldos por rango
  const saldosPorRango = [
    { name: '$0-5K', rango: '$0 - $5,000', cuentas: cuentas.filter(c => (c.saldoActual || 0) >= 0 && (c.saldoActual || 0) <= 5000).length },
    { name: '$5K-50K', rango: '$5,001 - $50,000', cuentas: cuentas.filter(c => (c.saldoActual || 0) > 5000 && (c.saldoActual || 0) <= 50000).length },
    { name: '$50K-200K', rango: '$50,001 - $200,000', cuentas: cuentas.filter(c => (c.saldoActual || 0) > 50000 && (c.saldoActual || 0) <= 200000).length },
    { name: '>$200K', rango: 'Más de $200,000', cuentas: cuentas.filter(c => (c.saldoActual || 0) > 200000).length },
  ];

  // Nuevas cuentas por mes (agrupado dinámicamente desde datos reales)
  const nuevasCuentasPorMes = (() => {
    const meses: Record<string, number> = {};
    const nombresCortos = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    cuentas.forEach(c => {
      if (!c.fechaSol) return;
      try {
        const d = new Date(c.fechaSol);
        if (isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
        const label = `${nombresCortos[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
        meses[key] = (meses[key] || 0) + 1;
        // store label for later
        if (!(meses as any)[`_label_${key}`]) (meses as any)[`_label_${key}`] = label;
      } catch { /* skip */ }
    });
    // Sort by key and take last 6 months
    return Object.keys(meses)
      .filter(k => !k.startsWith('_label_'))
      .sort()
      .slice(-6)
      .map(k => ({
        name: (meses as any)[`_label_${k}`] || k,
        mes: (meses as any)[`_label_${k}`] || k,
        cuentas: meses[k],
      }));
  })();

  // Cuentas Eje vs Regulares
  const distribucionCuentasEje = [
    { tipo: 'Cuenta Eje', cantidad: cuentasEje, color: '#10B981' },
    { tipo: 'Cuenta Regular', cantidad: Math.max(0, totalCuentas - cuentasEje), color: '#94A3B8' },
  ];

  // ── Badge de conexión ──
  const statusBadge = backendStatus === 'connected'
    ? { label: 'Supabase RPC', color: 'bg-green-100 text-green-700' }
    : backendStatus === 'pending-deploy'
    ? { label: 'Pendiente deploy', color: 'bg-yellow-100 text-yellow-700' }
    : { label: 'Solo local', color: 'bg-gray-100 text-gray-600' };

  return (
    <div className="p-6 space-y-6 bg-[#F5F5F5] min-h-full overflow-y-auto">

      {/* Badge de estado de conexión */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge.color}`}>
            {statusBadge.label}
          </span>
          <span className="text-xs text-gray-500">
            {totalCuentas} registro{totalCuentas !== 1 ? 's' : ''} desde J_CUENTAS_CORP_CLIENTES
          </span>
        </div>
        {onNew && (
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2E5C91] text-white text-sm rounded hover:bg-[#244A75] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 1v12M1 7h12"/>
            </svg>
            Nueva Cuenta
          </button>
        )}
      </div>

      {/* ── Tarjetas KPI ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

        {/* Total Cuentas */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Total de Cuentas</p>
              <p className="text-2xl font-semibold text-gray-900">{totalCuentas}</p>
            </div>
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E5C91" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M7 15h0M2 9.5h20"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Filtro: CAPTACION / Ahorro
          </div>
        </div>

        {/* Saldo Total */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Saldo Total</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(saldoTotal)}</p>
            </div>
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Suma de saldo_actual
          </div>
        </div>

        {/* Saldo Promedio */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Saldo Promedio</p>
              <p className="text-2xl font-semibold text-gray-900">{formatCurrency(saldoPromedio)}</p>
            </div>
            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4A6FA5" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            Promedio por cuenta
          </div>
        </div>

        {/* Cuentas Eje */}
        <div className="bg-white border border-gray-300 rounded p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 mb-1">Cuentas Eje</p>
              <p className="text-2xl font-semibold text-gray-900">{cuentasEje}</p>
            </div>
            <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600">
            {totalCuentas > 0 ? ((cuentasEje / totalCuentas) * 100).toFixed(1) : '0.0'}% del total
          </div>
        </div>
      </div>

      {/* ── Registros Recientes y Distribución ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Registros Recientes */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Registros Recientes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Últimas cuentas de ahorro desde Supabase</p>
          </div>
          {cuentasRecientes.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">
              No hay cuentas de ahorro registradas.
              {onNew && (
                <button onClick={onNew} className="block mx-auto mt-3 text-[#2E5C91] underline text-xs">
                  Crear primera cuenta
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-300">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">N° Cuenta</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Cliente</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Saldo</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Estatus</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-700">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentasRecientes.map((cuenta, idx) => (
                    <tr
                      key={cuenta.id}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} cursor-pointer hover:bg-blue-50 transition-colors`}
                      onClick={() => onView?.(cuenta.id)}
                    >
                      <td className="px-3 py-2 text-[#2E5C91] font-medium">{cuenta.noCuenta || '—'}</td>
                      <td className="px-3 py-2 text-gray-700 max-w-[160px] truncate">{cuenta.clienteNombre}</td>
                      <td className="px-3 py-2 text-gray-900 font-medium">{formatCurrency(cuenta.saldoActual)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${
                          cuenta.estatusCuen === 'Activa' ? 'bg-green-100 text-green-700' :
                          cuenta.estatusCuen === 'Pendiente' ? 'bg-yellow-100 text-yellow-700' :
                          cuenta.estatusCuen === 'Cancelada' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {cuenta.estatusCuen}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{formatDate(cuenta.fechaSol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Distribución por Estatus */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Distribución por Estatus</h2>
            <p className="text-xs text-gray-600 mt-0.5">Clasificación de cuentas por estatus_cuen</p>
          </div>
          <div className="p-4 flex items-center justify-center">
            {distribucionEstatus.length === 0 ? (
              <p className="text-sm text-gray-500">Sin datos</p>
            ) : (
              <div className="w-full">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={distribucionEstatus}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ cantidad }) => `${cantidad}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="cantidad"
                      nameKey="tipo"
                    >
                      {distribucionEstatus.map((entry, index) => (
                        <Cell key={`cell-est-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {distribucionEstatus.map((item) => (
                    <div key={item.tipo} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-700 flex-1">{item.tipo}</span>
                      <span className="text-xs text-gray-900 font-medium">{item.cantidad}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Gráficas KPI ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Nuevas Cuentas por Mes */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Nuevas Cuentas por Mes</h2>
            <p className="text-xs text-gray-600 mt-0.5">Apertura de cuentas (datos reales)</p>
          </div>
          <div className="p-4">
            {nuevasCuentasPorMes.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-16">Sin datos de fechas</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={nuevasCuentasPorMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="#6B7280" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#6B7280" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                    formatter={(value: any) => [value, 'Cuentas']}
                  />
                  <Bar dataKey="cuentas" fill="#2E5C91" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Saldos por Rango */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Saldos por Rango</h2>
            <p className="text-xs text-gray-600 mt-0.5">Distribución de cuentas por nivel de saldo</p>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={saldosPorRango} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#6B7280" allowDecimals={false} />
                <YAxis dataKey="rango" type="category" tick={{ fontSize: 11 }} stroke="#6B7280" width={120} />
                <Tooltip
                  contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                  formatter={(value: any) => [value, 'Cuentas']}
                />
                <Bar dataKey="cuentas" fill="#4A6FA5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cuentas Eje vs Regulares */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Cuentas Eje vs Regulares</h2>
            <p className="text-xs text-gray-600 mt-0.5">Clasificación por cta_eje_chec</p>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              {distribucionCuentasEje.map((item) => (
                <div key={item.tipo} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-700 font-medium">{item.tipo}</span>
                    <span className="text-gray-900">
                      {item.cantidad} cuentas ({totalCuentas > 0 ? ((item.cantidad / totalCuentas) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="h-2.5 rounded-full transition-all"
                      style={{
                        width: totalCuentas > 0 ? `${(item.cantidad / totalCuentas) * 100}%` : '0%',
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Distribución por Producto */}
        <div className="bg-white border border-gray-300 rounded">
          <div className="bg-white border-b border-gray-300 px-4 py-3">
            <h2 className="text-base font-medium text-gray-900">Distribución por Producto</h2>
            <p className="text-xs text-gray-600 mt-0.5">Clasificación por producto_eje</p>
          </div>
          <div className="p-4">
            {distribucionProducto.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-16">Sin datos</p>
            ) : (
              <div className="w-full">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={distribucionProducto}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ cantidad }) => `${cantidad}`}
                      outerRadius={70}
                      fill="#8884d8"
                      dataKey="cantidad"
                      nameKey="tipo"
                    >
                      {distribucionProducto.map((entry, index) => (
                        <Cell key={`cell-prod-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1.5">
                  {distribucionProducto.map((item) => (
                    <div key={item.tipo} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-700 flex-1 truncate">{item.tipo}</span>
                      <span className="text-xs text-gray-900 font-medium">{item.cantidad}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}