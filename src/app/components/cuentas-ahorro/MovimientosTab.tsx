import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` };

function parseMoney(val: string): number {
  return parseFloat(String(val || '0').replace(/[^0-9.-]/g, '')) || 0;
}

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
  const n = typeof val === 'number' ? val : Number.parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
  return `$ ${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtFecha(val: string): string {
  if (!val) return '—';
  const d = new Date(val);
  if (!Number.isNaN(d.getTime())) {
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
  readonly mode: 'nuevo' | 'editar' | 'ver';
  readonly accountId: number | string;
}

export function MovimientosTab({ mode, accountId }: MovimientosTabProps) {
  const [movimientos, setMovimientos] = useState<MovimientoData[]>([]);
  const [saldoActual, setSaldoActual] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [tipo, setTipo] = useState('Abono');
  const [concepto, setConcepto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [monto, setMonto] = useState('');

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
      // saldo_actual viene ahora directamente de la columna física
      if (json.saldo_actual !== undefined) {
        setSaldoActual(Number.parseFloat(String(json.saldo_actual).replace(/[^0-9.-]/g, '')) || 0);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [accountId, mode]);

  useEffect(() => { cargar(); }, [cargar]);

  const handleGuardar = async () => {
    const montoNum = parseMoney(monto);
    if (!concepto.trim()) { toast.error('El concepto es obligatorio'); return; }
    if (montoNum <= 0)     { toast.error('El monto debe ser mayor a 0'); return; }
    if (accountId === 'new' || mode === 'nuevo') { toast.error('Guarde la cuenta antes de registrar movimientos'); return; }
    setEnviando(true);
    try {
      const saldo = saldoActual ?? 0;
      const saldo_nuevo = tipo === 'Abono' ? saldo + montoNum : saldo - montoNum;
      const res = await fetch(`${API_BASE}/cuentas-ahorro/movimiento`, {
        method: 'PATCH',
        headers: HDR,
        body: JSON.stringify({
          cuenta_id: String(accountId),
          movimiento: { tipo, concepto, referencia, monto: montoNum, estatus: 'Aplicado' },
          saldo_nuevo,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      toast.success('Movimiento registrado');
      setShowModal(false);
      setMonto(''); setConcepto(''); setReferencia(''); setTipo('Abono');
      cargar();
    } catch (e: any) {
      toast.error('Error al registrar movimiento', { description: e.message });
    } finally {
      setEnviando(false);
    }
  };

  const saldoFinalPreview = (() => {
    const s = saldoActual ?? 0;
    const m = parseMoney(monto);
    return tipo === 'Abono' ? s + m : s - m;
  })();

  const emptyMsg = mode === 'nuevo' ? 'Los movimientos se registrarán automáticamente' : 'Sin movimientos registrados';

  return (
    <div className="bg-white">
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-800">MOVIMIENTOS</span>
          {saldoActual !== null && (
            <span className="text-[11px] font-semibold text-gray-700">
              Saldo: <span className="text-[#2E5C91]">{fmtMoney(saldoActual)}</span>
            </span>
          )}
        </div>
        {mode !== 'nuevo' && (
          <div className="flex items-center gap-2">
            <button onClick={cargar} disabled={loading}
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M1.5 5.5A4 4 0 1 0 3 2"/><path d="M1.5 2v3h3" strokeLinecap="round"/>
              </svg>
              Actualizar
            </button>
            {mode === 'editar' && (
              <button
                onClick={() => setShowModal(true)}
                className="px-3 py-1 bg-primary-theme text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91]"
              >
                Nuevo
              </button>
            )}
          </div>
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
                  {emptyMsg}
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
                  {movimientos.length} movimiento{movimientos.length === 1 ? '' : 's'}
                </td>
                <td className="px-3 py-2 text-xs text-right font-semibold text-gray-700 border-l border-gray-300" colSpan={3}>
                  Saldo actual: {fmtMoney(saldoActual ?? movimientos[0]?.saldoFinal ?? 0)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded shadow-xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-primary-theme px-5 py-3.5 flex items-center justify-between rounded-t">
              <h3 className="text-sm font-medium text-white">Nuevo Movimiento</h3>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="bg-gray-50 border border-gray-200 rounded p-3 flex justify-between text-xs">
                <span className="text-gray-500">Saldo actual</span>
                <span className="font-semibold text-[#2E5C91]">{fmtMoney(saldoActual ?? 0)}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Tipo *</label>
                  <select value={tipo} onChange={e => setTipo(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded">
                    <option>Abono</option>
                    <option>Cargo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Monto *</label>
                  <input type="text" value={monto} onChange={e => setMonto(e.target.value)}
                    placeholder="$ 0.00"
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Concepto *</label>
                <input type="text" value={concepto} onChange={e => setConcepto(e.target.value)}
                  placeholder="Ej: Depósito, Retiro..."
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Referencia</label>
                <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)}
                  placeholder="No. solicitud, folio..."
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
              </div>
              {parseMoney(monto) > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded p-2.5 flex justify-between text-xs">
                  <span className="text-blue-600">Saldo resultante</span>
                  <span className={`font-bold ${saldoFinalPreview < 0 ? 'text-red-600' : 'text-blue-800'}`}>
                    {fmtMoney(saldoFinalPreview)}
                  </span>
                </div>
              )}
            </div>
            <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex justify-end gap-2 rounded-b">
              <button onClick={() => setShowModal(false)}
                className="px-4 py-1.5 text-xs border border-gray-200 rounded text-gray-600 hover:bg-gray-100">
                Cancelar
              </button>
              <button onClick={handleGuardar} disabled={enviando}
                className="px-5 py-1.5 text-xs bg-primary-theme text-white rounded hover:opacity-90 disabled:opacity-50 font-medium flex items-center gap-1.5">
                {enviando && <svg className="animate-spin h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6" cy="6" r="5" strokeOpacity="0.25"/><path d="M6 1a5 5 0 0 1 5 5" strokeLinecap="round"/></svg>}
                {enviando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
