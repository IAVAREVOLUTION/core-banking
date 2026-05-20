import { useState, useEffect, useCallback } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { Authorization: `Bearer ${publicAnonKey}` };

interface MovimientoData {
  id: number | string;
  fechaHora: string;
  tipo: string;
  concepto: string;
  referencia: string;
  monto: number;
  saldoInicial: number;
  saldoFinal: number;
  fechaRegistro?: string;
}

function parseJsonbField(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, any>;
    if ('0' in obj) {
      try { return JSON.parse(Object.values(obj).join('')); } catch { return {}; }
    }
    return obj;
  }
  return {};
}

function fmtMoney(val: number | string): string {
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
  return `$ ${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtFecha(val: string): string {
  if (!val) return '—';
  // ISO timestamp → dd/mm/yyyy hh:mm
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yy} ${hh}:${min}`;
  }
  return val;
}

interface MovimientosTabProps {
  mode: 'nuevo' | 'editar' | 'ver';
  accountId: number | string | 'new';
}

export function MovimientosTab({ mode, accountId }: MovimientosTabProps) {
  const [movimientos, setMovimientos] = useState<MovimientoData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    if (accountId === 'new' || mode === 'nuevo') return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/cuentas-ahorro/${accountId}/movimientos`, { headers: HDR });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const movs: MovimientoData[] = Array.isArray(json.data) ? json.data : [];
      setMovimientos(movs);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [accountId, mode]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="bg-white">
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">MOVIMIENTOS</span>
        {mode !== 'nuevo' && (
          <button onClick={cargar} disabled={loading}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1.5 5.5A4 4 0 1 0 3 2"/><path d="M1.5 2v3h3" strokeLinecap="round"/>
            </svg>
            Actualizar
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
      )}

      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300">Fecha / Hora</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300">Concepto</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-left border-r border-gray-300">Referencia</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-center border-r border-gray-300">Tipo</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-right border-r border-gray-300">Monto</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-right border-r border-gray-300">Saldo Inicial</th>
              <th className="px-3 py-2 text-xs font-medium text-gray-700 text-right">Saldo Final</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-xs text-gray-400">
                  <svg className="animate-spin h-5 w-5 mx-auto mb-1 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                  </svg>
                  Cargando movimientos...
                </td>
              </tr>
            ) : movimientos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-xs text-gray-400">
                  {mode === 'nuevo' ? 'Los movimientos se registrarán automáticamente' : 'Sin movimientos registrados'}
                </td>
              </tr>
            ) : movimientos.map((m, idx) => (
              <tr key={`${m.id}-${idx}`} className={`border-b border-gray-200 ${idx % 2 === 1 ? 'bg-gray-50' : ''}`}>
                <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300 whitespace-nowrap">
                  {fmtFecha(m.fechaHora || m.fechaRegistro || '')}
                </td>
                <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{m.concepto || '—'}</td>
                <td className="px-3 py-2 text-xs text-gray-700 border-r border-gray-300">{m.referencia || '—'}</td>
                <td className="px-3 py-2 text-xs text-center border-r border-gray-300">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    m.tipo === 'Abono' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>{m.tipo || '—'}</span>
                </td>
                <td className="px-3 py-2 text-xs text-right border-r border-gray-300">
                  <span className={m.tipo === 'Abono' ? 'text-green-700' : 'text-red-700'}>
                    {m.tipo === 'Cargo' ? '-' : ''}{fmtMoney(m.monto)}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-700 text-right border-r border-gray-300">{fmtMoney(m.saldoInicial)}</td>
                <td className="px-3 py-2 text-xs text-gray-700 text-right">{fmtMoney(m.saldoFinal)}</td>
              </tr>
            ))}
          </tbody>
          {movimientos.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 border-t-2 border-gray-300">
                <td colSpan={4} className="px-3 py-2 text-xs text-gray-500">
                  {movimientos.length} movimiento{movimientos.length !== 1 ? 's' : ''}
                </td>
                <td className="px-3 py-2 text-xs text-right font-semibold text-gray-700 border-l border-gray-300" colSpan={3}>
                  Saldo actual: {fmtMoney(movimientos[0]?.saldoFinal ?? 0)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
