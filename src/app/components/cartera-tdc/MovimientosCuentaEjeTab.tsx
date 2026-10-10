/**
 * MovimientosCuentaEjeTab — Cartera TDC.
 *
 * Réplica del subtab Movimientos que vive bajo Personas
 * ([clientes/Movimientos.tsx](../clientes/Movimientos.tsx)): mismos endpoints,
 * misma cuenta eje, mismos datos. La única diferencia pedida es que aquí NO se
 * muestran **Saldo Inicial** ni **Saldo Final** por renglón — en la cartera de
 * la tarjeta interesa el movimiento, no la reconstrucción del saldo paso a
 * paso, que ya se ve en el encabezado.
 *
 * Se mantiene como componente aparte en vez de agregar una bandera al de
 * Personas para no arriesgar esa pantalla, que es la fuente de verdad del
 * saldo del cliente.
 */
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` };

interface Movimiento {
  id: string | number;
  fechaHora: string;
  tipo: string;
  concepto: string;
  referencia?: string;
  monto: number;
  estatus?: string;
}

interface Props {
  mode: 'ver' | 'editar';
  /** Cliente dueño de la cuenta eje. */
  clienteId?: string;
  /** Etiqueta del contexto — número de cuenta o folio de la línea. */
  referenciaCuenta?: string;
}

const fmtMoney = (n: number) => `$ ${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const parseMoney = (v: string) => parseFloat(String(v || '0').replace(/[^0-9.-]/g, '')) || 0;
const fmtDate = (s: string) => {
  if (!s) return '—';
  try { return new Date(s).toLocaleString('es-MX'); } catch { return s; }
};

export function MovimientosCuentaEjeTab({ mode, clienteId, referenciaCuenta }: Props) {
  const isView = mode === 'ver';
  const cid = String(clienteId || '');

  const [cuentaEjeId, setCuentaEjeId] = useState<string | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [saldoActual, setSaldoActual] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [tipo, setTipo] = useState('Abono');
  const [concepto, setConcepto] = useState('');
  const [referencia, setReferencia] = useState('');
  const [monto, setMonto] = useState('');

  const cargarCuentaEje = useCallback(async () => {
    if (!cid) return;
    try {
      const res = await fetch(`${API_BASE}/cuentas-ahorro`, { headers: HDR });
      if (!res.ok) return;
      const json = await res.json();
      const rows: any[] = Array.isArray(json) ? json : (json.data || []);
      const eje = rows.find(
        r => (r.cliente_id || r.cliente_id_eff) === cid &&
             (r.cta_eje_chec === true || r.cta_eje_chec === 'true' || r.cta_eje_chec === 't')
      );
      if (eje) setCuentaEjeId(eje.id);
    } catch { /* silencioso — igual que el de Personas */ }
  }, [cid]);

  const cargar = useCallback(async (cuentaId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/cuentas-ahorro/${cuentaId}/movimientos`, { headers: HDR });
      if (!res.ok) return;
      const json = await res.json();
      const movs: Movimiento[] = (json.data || []).map((m: any) => ({
        id: m.id || crypto.randomUUID(),
        fechaHora: m.fechaHora || m.fechaRegistro || m.created_at || '',
        tipo: m.tipo || m.tipoMovimiento || '—',
        concepto: m.concepto || m.origenCreacion || '—',
        referencia: m.referencia || '',
        monto: parseFloat(m.monto) || 0,
        estatus: m.estatus || '',
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
    if (montoNum <= 0) { toast.error('El monto debe ser mayor a 0'); return; }

    setEnviando(true);
    try {
      const saldoNuevo = tipo === 'Abono' ? saldoActual + montoNum : saldoActual - montoNum;
      const body: Record<string, unknown> = {
        movimiento: { tipo, concepto, referencia, monto: montoNum, estatus: 'Aplicado' },
        saldo_nuevo: saldoNuevo,
      };
      if (cuentaEjeId) body.cuenta_id = cuentaEjeId;
      else body.cliente_id = cid;

      const res = await fetch(`${API_BASE}/cuentas-ahorro/movimiento`, {
        method: 'PATCH', headers: HDR, body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      setSaldoActual(saldoNuevo);
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

  const th = 'px-3 py-2 text-left font-medium text-gray-800 border-r border-gray-300';
  const td = 'px-3 py-2 border-r border-gray-200 text-gray-700';
  const inp = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary-theme';

  return (
    <div className="bg-white">
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-800">MOVIMIENTOS</span>
          {cuentaEjeId && <span className="text-[10px] text-gray-400">Cuenta Eje: {cuentaEjeId.slice(0, 8)}…</span>}
          {referenciaCuenta && <span className="text-[10px] text-gray-400">{referenciaCuenta}</span>}
          {!cuentaEjeId && !loading && <span className="text-[10px] text-amber-600">Sin cuenta eje vinculada</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-gray-700">
            Saldo: <span className="text-[#2E5C91]">{fmtMoney(saldoActual)}</span>
          </span>
          <button
            onClick={() => { if (cuentaEjeId) cargar(cuentaEjeId); else cargarCuentaEje(); }}
            title="Actualizar"
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1.5 5.5A4 4 0 1 0 3 2" /><path d="M1.5 2v3h3" strokeLinecap="round" />
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

      <div className="border border-gray-300 overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-gray-400 bg-[#D9E2F3]">
              <th className={th}>Fecha y Hora</th>
              <th className={th}>Tipo</th>
              <th className={th}>Concepto</th>
              <th className={th}>Referencia</th>
              <th className="px-3 py-2 text-right font-medium text-gray-800 border-r border-gray-300">Monto</th>
              <th className="px-3 py-2 text-left font-medium text-gray-800">Estatus</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-xs text-gray-400">
                  <svg className="animate-spin h-4 w-4 mx-auto mb-1 text-[#4A6FA5]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="6" cy="6" r="5" strokeOpacity="0.25" /><path d="M6 1a5 5 0 0 1 5 5" strokeLinecap="round" />
                  </svg>
                  Cargando movimientos...
                </td>
              </tr>
            ) : movimientos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-xs text-gray-500">
                  {cuentaEjeId
                    ? 'Sin movimientos registrados en esta cuenta.'
                    : 'El cliente no tiene cuenta eje vinculada.'}
                </td>
              </tr>
            ) : (
              movimientos.map((m, i) => (
                <tr key={m.id} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'}`}>
                  <td className={td}>{fmtDate(m.fechaHora)}</td>
                  <td className={td}>
                    <span className={m.tipo === 'Abono' ? 'text-emerald-700' : 'text-gray-700'}>{m.tipo}</span>
                  </td>
                  <td className={td}>{m.concepto}</td>
                  <td className={td}>{m.referencia || '—'}</td>
                  <td className={`${td} text-right font-mono`}>{fmtMoney(m.monto)}</td>
                  <td className="px-3 py-2 text-gray-700">{m.estatus || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white shadow-2xl max-w-lg w-full border-2 border-gray-400" onClick={e => e.stopPropagation()}>
            <div className="bg-[#2E5C91] px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Nuevo Movimiento</h3>
              <button onClick={() => setShowModal(false)} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Tipo</label>
                  <select value={tipo} onChange={e => setTipo(e.target.value)} className={inp}>
                    <option value="Abono">Abono</option>
                    <option value="Cargo">Cargo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Monto <span className="text-red-600">*</span></label>
                  <input
                    type="text" inputMode="decimal" value={monto}
                    onChange={e => setMonto(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00" className={`${inp} text-right font-mono`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Concepto <span className="text-red-600">*</span></label>
                <input type="text" maxLength={120} value={concepto} onChange={e => setConcepto(e.target.value)} className={inp} />
              </div>
              <div>
                <label className="block text-xs text-gray-700 mb-1">Referencia</label>
                <input type="text" maxLength={60} value={referencia} onChange={e => setReferencia(e.target.value)} className={inp} />
              </div>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 text-xs text-gray-700">
                Saldo resultante:{' '}
                <b className="font-mono">
                  {fmtMoney(tipo === 'Abono' ? saldoActual + parseMoney(monto) : saldoActual - parseMoney(monto))}
                </b>
              </div>
            </div>
            <div className="flex gap-2 justify-end px-6 py-3 border-t border-gray-300">
              <button onClick={() => setShowModal(false)} className="px-4 py-1.5 bg-gray-500 text-white text-xs hover:bg-gray-600">Cancelar</button>
              <button
                onClick={handleGuardar}
                disabled={enviando}
                className="px-4 py-1.5 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] disabled:bg-gray-400"
              >
                {enviando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
