import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` };

interface MovimientosProps {
  onBack: () => void;
  mode: 'nuevo' | 'editar' | 'ver';
  clienteId?: string | number;
  saldoCuentaEje?: string;
  onSaldoChange?: (nuevoSaldo: string) => void;
}

interface Movimiento {
  id: string | number;
  fechaHora: string;
  fechaRegistro?: string;
  tipo: string;
  concepto: string;
  referencia?: string;
  monto: number;
  saldoInicial?: number;
  saldoFinal?: number;
  estatus?: string;
}

function fmtMoney(n: number) {
  return `$ ${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseMoney(val: string): number {
  return parseFloat(String(val || '0').replace(/[^0-9.-]/g, '')) || 0;
}

function fmtDate(s: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('es-MX'); } catch { return s; }
}

export function Movimientos({ mode, clienteId, saldoCuentaEje, onSaldoChange }: MovimientosProps) {
  const isView = mode === 'ver';
  const cid = String(clienteId || '');

  const [cuentaEjeId,  setCuentaEjeId]  = useState<string | null>(null);
  const [movimientos,  setMovimientos]  = useState<Movimiento[]>([]);
  const [saldoActual,  setSaldoActual]  = useState<number>(parseMoney(saldoCuentaEje || '0'));
  const [loading,      setLoading]      = useState(false);
  const [showModal,    setShowModal]    = useState(false);
  const [enviando,     setEnviando]     = useState(false);

  const [tipo,         setTipo]         = useState('Abono');
  const [concepto,     setConcepto]     = useState('');
  const [referencia,   setReferencia]   = useState('');
  const [monto,        setMonto]        = useState('');

  // 1. Buscar cuenta eje del cliente
  const cargarCuentaEje = useCallback(async () => {
    if (!cid) return;
    try {
      const res = await fetch(`${API_BASE}/cuentas-ahorro`, { headers: HDR });
      if (!res.ok) return;
      const json = await res.json();
      const rows: any[] = Array.isArray(json) ? json : (json.data || []);
      const eje = rows.find(r => (r.cliente_id || r.cliente_id_eff) === cid && (r.cta_eje_chec === true || r.cta_eje_chec === 'true' || r.cta_eje_chec === 't'));
      if (eje) setCuentaEjeId(eje.id);
    } catch { /* silencioso */ }
  }, [cid]);

  // 2. Cargar movimientos de la cuenta eje
  const cargar = useCallback(async (cuentaId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/cuentas-ahorro/${cuentaId}/movimientos`, { headers: HDR });
      if (!res.ok) return;
      const json = await res.json();
      const movs: Movimiento[] = (json.data || []).map((m: any) => ({
        id:          m.id || crypto.randomUUID(),
        fechaHora:   m.fechaHora || m.fechaRegistro || m.created_at || '',
        tipo:        m.tipo || m.tipoMovimiento || '—',
        concepto:    m.concepto || m.origenCreacion || '—',
        referencia:  m.referencia || '',
        monto:       parseFloat(m.monto) || 0,
        saldoInicial: parseFloat(m.saldoInicial) || 0,
        saldoFinal:   parseFloat(m.saldoFinal) || 0,
        estatus:     m.estatus || '',
      }));
      setMovimientos(movs);
      if (json.saldo_actual != null) setSaldoActual(parseFloat(json.saldo_actual) || 0);
    } catch { /* silencioso */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargarCuentaEje(); }, [cargarCuentaEje]);
  useEffect(() => { if (cuentaEjeId) cargar(cuentaEjeId); }, [cuentaEjeId, cargar]);

  const handleGuardar = async () => {
    const montoNum = parseMoney(monto);
    if (!concepto.trim()) { toast.error('El concepto es obligatorio'); return; }
    if (montoNum <= 0)     { toast.error('El monto debe ser mayor a 0'); return; }

    setEnviando(true);
    try {
      const body: Record<string, unknown> = {
        movimiento: { tipo, concepto, referencia, monto: montoNum, estatus: 'Aplicado' },
        saldo_nuevo: tipo === 'Abono' ? saldoActual + montoNum : saldoActual - montoNum,
      };
      if (cuentaEjeId) body.cuenta_id = cuentaEjeId;
      else             body.cliente_id = cid;

      const res = await fetch(`${API_BASE}/cuentas-ahorro/movimiento`, {
        method: 'PATCH', headers: HDR, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      const nuevoSaldo = tipo === 'Abono' ? saldoActual + montoNum : saldoActual - montoNum;
      setSaldoActual(nuevoSaldo);
      onSaldoChange?.(nuevoSaldo.toFixed(2));
      setShowModal(false);
      setMonto(''); setConcepto(''); setReferencia(''); setTipo('Abono');
      toast.success('Movimiento registrado');
      if (cuentaEjeId) cargar(cuentaEjeId);
    } catch (e: any) {
      toast.error('Error al registrar movimiento', { description: e.message });
    } finally {
      setEnviando(false);
    }
  };

  const saldoFinalPreview = tipo === 'Abono'
    ? saldoActual + parseMoney(monto)
    : saldoActual - parseMoney(monto);

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-800">MOVIMIENTOS</span>
          {cuentaEjeId && (
            <span className="text-[10px] text-gray-400">Cuenta Eje: {cuentaEjeId.slice(0, 8)}…</span>
          )}
          {!cuentaEjeId && !loading && (
            <span className="text-[10px] text-amber-600">Sin cuenta eje vinculada</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-700">
            Saldo: <span className="text-[#2E5C91]">{fmtMoney(saldoActual)}</span>
          </span>
          <button
            onClick={() => { if (cuentaEjeId) cargar(cuentaEjeId); else cargarCuentaEje(); }}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1.5 5.5A4 4 0 1 0 3 2"/><path d="M1.5 2v3h3" strokeLinecap="round"/>
            </svg>
          </button>
          {!isView && (
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1 bg-primary-theme text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91]"
            >
              Nuevo
            </button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="border border-gray-300">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-400 bg-[#D9E2F3]">
              <th className="px-3 py-2 text-left font-medium text-gray-800 border-r border-gray-300">Fecha y Hora</th>
              <th className="px-3 py-2 text-left font-medium text-gray-800 border-r border-gray-300">Tipo</th>
              <th className="px-3 py-2 text-left font-medium text-gray-800 border-r border-gray-300">Concepto</th>
              <th className="px-3 py-2 text-left font-medium text-gray-800 border-r border-gray-300">Referencia</th>
              <th className="px-3 py-2 text-right font-medium text-gray-800 border-r border-gray-300">Monto</th>
              <th className="px-3 py-2 text-right font-medium text-gray-800 border-r border-gray-300">Saldo Inicial</th>
              <th className="px-3 py-2 text-right font-medium text-gray-800">Saldo Final</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-xs text-gray-400">
                  <svg className="animate-spin h-4 w-4 mx-auto mb-1 text-[#4A6FA5]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="6" cy="6" r="5" strokeOpacity="0.25"/><path d="M6 1a5 5 0 0 1 5 5" strokeLinecap="round"/>
                  </svg>
                  Cargando movimientos...
                </td>
              </tr>
            ) : movimientos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-xs text-gray-500">
                  {cuentaEjeId
                    ? 'Sin movimientos registrados en esta cuenta.'
                    : 'No se encontró cuenta eje para este cliente.'}
                </td>
              </tr>
            ) : movimientos.map((m, idx) => (
              <tr key={m.id} className={`border-b border-gray-200 ${idx % 2 === 1 ? 'bg-gray-50' : ''}`}>
                <td className="px-3 py-2 border-r border-gray-200 whitespace-nowrap">{fmtDate(m.fechaHora)}</td>
                <td className="px-3 py-2 border-r border-gray-200">
                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    m.tipo === 'Abono' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>{m.tipo}</span>
                </td>
                <td className="px-3 py-2 border-r border-gray-200 text-gray-700">{m.concepto}</td>
                <td className="px-3 py-2 border-r border-gray-200 text-gray-500">{m.referencia || '—'}</td>
                <td className={`px-3 py-2 border-r border-gray-200 text-right font-medium ${
                  m.tipo === 'Abono' ? 'text-green-700' : 'text-red-700'
                }`}>{fmtMoney(m.monto)}</td>
                <td className="px-3 py-2 border-r border-gray-200 text-right text-gray-600">{fmtMoney(m.saldoInicial ?? 0)}</td>
                <td className="px-3 py-2 text-right font-medium text-gray-800">{fmtMoney(m.saldoFinal ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal nuevo movimiento */}
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
              {/* Saldo actual */}
              <div className="bg-gray-50 border border-gray-200 rounded p-3 flex justify-between text-xs">
                <span className="text-gray-500">Saldo actual cuenta eje</span>
                <span className="font-semibold text-[#2E5C91]">{fmtMoney(saldoActual)}</span>
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
                  placeholder="Ej: Apertura, Dispersión crédito..."
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Referencia</label>
                <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)}
                  placeholder="No. solicitud, folio..."
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded" />
              </div>

              {/* Preview saldo final */}
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
