/**
 * CuentasBeneficiariasTab.tsx
 *
 * Cuenta(s) beneficiaria(s) de la Solicitud: a dónde se dispersa el dinero.
 *
 * Los registros NO se capturan a mano: se eligen de las **Cuentas Bancarias del
 * cliente** (`useCuentasBancariasDB`), que es donde ya viven banco, CLABE,
 * cuenta, moneda y SWIFT. Capturarlas otra vez aquí abriría la puerta a que la
 * dispersión se hiciera a una cuenta que el expediente del cliente no conoce.
 *
 * Al agregar una cuenta, **Monto Dispersión = Monto Autorizado** de la Solicitud.
 * Es un valor editable —una dispersión puede repartirse entre varias cuentas—
 * pero el pie de la tabla contrasta la suma contra el Monto Autorizado, porque
 * repartir de más o de menos es el error caro de esta pantalla.
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useCuentasBancariasDB, type CuentaBancaria } from '../../hooks/useCuentasBancariasDB';
import {
  loadFromSession, loadFromSavedStore, saveToSession, saveToSavedStore, generateId,
} from './solicitudCreditoStore';
import {
  guardarCuentasBeneficiarias, fetchCuentasBeneficiarias,
} from '../banca-2o-piso/banca2oPisoStore';

export interface CuentaBeneficiaria {
  id: number;
  /** Id de la cuenta bancaria del cliente de la que salió este registro. */
  cuentaBancariaId: string;
  /** Id del cliente (spec: "Id del cliente"). */
  clienteId: string;
  /** Nombre del beneficiario (spec: "nombre del Beneficiario"). */
  beneficiario: string;
  banco: string;
  cuentaClabe: string;
  numeroCuenta: string;
  moneda: string;
  cuentaSwift: string;
  pais: string;
  /** Monto a dispersar a esta cuenta. Se siembra con el Monto Autorizado. */
  montoDispersion: number;
  fechaRegistro: string;
}

const fmt = (n: number) =>
  `$${(Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const parseMonto = (v: unknown): number =>
  parseFloat(String(v ?? '0').replace(/[^0-9.-]/g, '')) || 0;

export function CuentasBeneficiariasTab({
  mode,
  solicitudId,
  clienteId,
  nombreCliente,
  montoAutorizado,
  montoSolicitado,
}: {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: string | number;
  clienteId?: string;
  nombreCliente?: string;
  /** Monto Autorizado de la Solicitud — semilla del Monto Dispersión. */
  montoAutorizado?: string | number;
  /**
   * Respaldo mientras la solicitud no está autorizada. Una solicitud recién
   * creada trae Monto Autorizado en 0 —nadie la ha autorizado todavía—, y
   * `"0.00"` es una cadena truthy: un `||` la daba por buena y el Monto
   * Dispersión salía en cero. La elección se hace por VALOR, no por presencia.
   */
  montoSolicitado?: string | number;
}) {
  const isRO = mode === 'ver';
  // El hook expone la recarga como `refetch` (no `fetchCuentas`).
  const { cuentas, loading, refetch: recargarCuentas } = useCuentasBancariasDB(clienteId || null);

  const [items, setItems] = useState<CuentaBeneficiaria[]>(
    () =>
      loadFromSession<CuentaBeneficiaria[]>(solicitudId, 'cuentasBeneficiarias') ||
      loadFromSavedStore<CuentaBeneficiaria[]>(solicitudId, 'cuentasBeneficiarias') ||
      [],
  );
  const [showModal, setShowModal] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  const persistir = useCallback(async (next: CuentaBeneficiaria[]) => {
    setItems(next);
    saveToSession(solicitudId, 'cuentasBeneficiarias', next);
    saveToSavedStore(solicitudId, 'cuentasBeneficiarias', next);
    // Y a BD: sin esto se perdian al recargar y la liberacion no encontraba a
    // donde dispersar. Si falla se dice, porque el usuario creeria que quedaron
    // guardadas.
    const r = await guardarCuentasBeneficiarias(solicitudId, next);
    if (!r.ok) {
      toast.warning('Las cuentas no se guardaron en base de datos', {
        description: `${r.error}. Se conservan en esta sesion, pero se perderan al recargar.`,
        duration: 12000,
      });
    }
  }, [solicitudId]);

  // Hidratar de BD cuando la sesion viene vacia (p. ej. tras recargar o al
  // abrir la solicitud desde otra maquina).
  useEffect(() => {
    let cancelado = false;
    if (items.length > 0) return;
    (async () => {
      const enBD = await fetchCuentasBeneficiarias(solicitudId);
      if (!cancelado && enBD.length > 0) {
        setItems(enBD as CuentaBeneficiaria[]);
        saveToSession(solicitudId, 'cuentasBeneficiarias', enBD);
        saveToSavedStore(solicitudId, 'cuentasBeneficiarias', enBD);
      }
    })();
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudId]);

  // El Monto Dispersion se siembra con el Monto Autorizado; si la solicitud
  // todavia no esta autorizada (autorizado = 0), se usa el Solicitado y la
  // pantalla dice cual de los dos se tomo, para que nadie disperse creyendo que
  // ya habia una autorizacion detras.
  const montoAutNum = parseMonto(montoAutorizado);
  const montoSolNum = parseMonto(montoSolicitado);
  const montoAut = montoAutNum > 0 ? montoAutNum : montoSolNum;
  const origenMonto = montoAutNum > 0 ? 'Monto Autorizado' : 'Monto Solicitado (aun sin autorizar)';
  const totalDispersion = items.reduce((s, i) => s + (Number(i.montoDispersion) || 0), 0);
  const diferencia = montoAut - totalDispersion;

  useEffect(() => { if (showModal) recargarCuentas(); }, [showModal, recargarCuentas]);

  const disponibles = useMemo(() => {
    const yaAgregadas = new Set(items.map(i => i.cuentaBancariaId));
    const q = busqueda.trim().toLowerCase();
    return cuentas
      .filter(c => !yaAgregadas.has(c.id))
      .filter(c => !q ||
        (c.banco || '').toLowerCase().includes(q) ||
        (c.cuentaClabe || '').toLowerCase().includes(q) ||
        (c.numeroCuenta || '').toLowerCase().includes(q));
  }, [cuentas, items, busqueda]);

  const agregar = (c: CuentaBancaria) => {
    // Sin datos bancarios no hay a dónde dispersar: se avisa en vez de crear un
    // renglón vacío que fallaría hasta el momento del pago.
    if (!c.cuentaClabe && !c.numeroCuenta) {
      toast.error('La cuenta seleccionada no tiene CLABE ni número de cuenta', {
        description: 'Complétela en el expediente del cliente antes de usarla para dispersión.',
        duration: 9000,
      });
      return;
    }
    const nueva: CuentaBeneficiaria = {
      id: generateId(),
      cuentaBancariaId: c.id,
      clienteId: c.clienteId || clienteId || '',
      // El beneficiario lo define la cuenta (se elige de las Personas
      // Relacionadas del cliente). Sólo si la cuenta no lo trae se cae al
      // titular, que era lo que se asumía antes de que ese campo existiera.
      beneficiario: c.beneficiario || nombreCliente || '',
      banco: c.banco || '',
      cuentaClabe: c.cuentaClabe || '',
      numeroCuenta: c.numeroCuenta || '',
      moneda: c.moneda || 'MXN',
      cuentaSwift: c.cuentaSwift || '',
      pais: c.pais || '',
      // Monto Dispersión = Monto Autorizado de la Solicitud.
      montoDispersion: montoAut,
      fechaRegistro: new Date().toLocaleDateString('es-MX'),
    };
    persistir([...items, nueva]);
    setShowModal(false);
    toast.success('Cuenta beneficiaria agregada', {
      description: `${nueva.banco || 'Cuenta'} · ${fmt(nueva.montoDispersion)}`,
    });
  };

  const eliminar = (id: number) => persistir(items.filter(i => i.id !== id));

  const cambiarMonto = (id: number, valor: string) =>
    persistir(items.map(i => (i.id === id ? { ...i, montoDispersion: parseMonto(valor) } : i)));

  const cambiarBeneficiario = (id: number, valor: string) =>
    persistir(items.map(i => (i.id === id ? { ...i, beneficiario: valor } : i)));

  return (
    <div className="bg-white border border-gray-200 p-4">
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">CUENTA(S) BENEFICIARIA(S)</span>
        {!isRO && (
          <button
            onClick={() => { setBusqueda(''); setShowModal(true); }}
            className="px-3 py-1 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] border border-[#3E5C91] rounded"
          >
            + Nuevo
          </button>
        )}
      </div>

      <p className="text-[11px] text-gray-500 mb-3">
        Cuenta bancaria a la que se realizará la dispersión. Se elige del expediente
        de Cuentas Bancarias del cliente.
      </p>

      <div className="border border-gray-300 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#4A6FA5] text-white">
              <th className="px-2 py-2 text-left font-medium">Id Cliente</th>
              <th className="px-2 py-2 text-left font-medium">Beneficiario</th>
              <th className="px-2 py-2 text-left font-medium">Banco</th>
              <th className="px-2 py-2 text-left font-medium">CLABE</th>
              <th className="px-2 py-2 text-left font-medium">No. Cuenta</th>
              <th className="px-2 py-2 text-center font-medium">Moneda</th>
              <th className="px-2 py-2 text-right font-medium">Monto Dispersión</th>
              {!isRO && <th className="px-2 py-2 text-center font-medium w-16">Acc.</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={isRO ? 7 : 8} className="px-3 py-8 text-center text-gray-400 text-xs">
                  Sin cuentas beneficiarias. Use <strong>+ Nuevo</strong> para agregar una.
                </td>
              </tr>
            ) : items.map((i, idx) => (
              <tr key={i.id} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                <td className="px-2 py-1.5 font-mono text-[10px] text-gray-600">
                  {i.clienteId ? `${i.clienteId.substring(0, 8)}…` : '—'}
                </td>
                <td className="px-2 py-1.5">
                  {isRO ? (i.beneficiario || '—') : (
                    <input
                      type="text"
                      value={i.beneficiario}
                      onChange={e => cambiarBeneficiario(i.id, e.target.value)}
                      className="w-full px-1.5 py-1 border border-gray-300 rounded text-xs"
                    />
                  )}
                </td>
                <td className="px-2 py-1.5 text-gray-700">{i.banco || '—'}</td>
                <td className="px-2 py-1.5 font-mono text-gray-700">{i.cuentaClabe || '—'}</td>
                <td className="px-2 py-1.5 font-mono text-gray-700">{i.numeroCuenta || '—'}</td>
                <td className="px-2 py-1.5 text-center text-gray-700">{i.moneda || 'MXN'}</td>
                <td className="px-2 py-1.5 text-right">
                  {isRO ? fmt(i.montoDispersion) : (
                    <input
                      type="text"
                      value={String(i.montoDispersion)}
                      onChange={e => cambiarMonto(i.id, e.target.value)}
                      className="w-32 px-1.5 py-1 border border-gray-300 rounded text-xs text-right font-mono"
                    />
                  )}
                </td>
                {!isRO && (
                  <td className="px-2 py-1.5 text-center">
                    <button onClick={() => eliminar(i.id)} className="text-red-600 hover:text-red-800 text-xs">
                      Eliminar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 border-t border-gray-300 font-medium">
                <td colSpan={6} className="px-2 py-2 text-right text-gray-700">Total a dispersar</td>
                <td className="px-2 py-2 text-right font-mono text-gray-900">{fmt(totalDispersion)}</td>
                {!isRO && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Contraste contra el Monto Autorizado: repartir de más o de menos es el
          error caro de esta pantalla, y no se ve solo. */}
      {items.length > 0 && montoAut > 0 && (
        <div className={`mt-2 px-3 py-2 rounded text-[11px] border ${
          Math.abs(diferencia) < 0.005
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          {origenMonto}: <strong>{fmt(montoAut)}</strong> · Total a dispersar:{' '}
          <strong>{fmt(totalDispersion)}</strong>
          {Math.abs(diferencia) >= 0.005 && (
            <> · <strong>{diferencia > 0 ? 'Faltan' : 'Exceden'} {fmt(Math.abs(diferencia))}</strong></>
          )}
        </div>
      )}

      {/* ── Modal: Cuentas Bancarias del cliente ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded shadow-xl w-full max-w-3xl" onClick={e => e.stopPropagation()}>
            <div className="bg-[#4A6FA5] px-4 py-2.5 flex items-center justify-between rounded-t">
              <h4 className="text-sm font-bold text-white">Cuentas Bancarias del Cliente</h4>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white">✕</button>
            </div>

            <div className="p-4">
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por banco, CLABE o número de cuenta…"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs mb-3"
              />

              {!clienteId ? (
                <div className="px-3 py-6 text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded">
                  La Solicitud no tiene cliente asociado, así que no hay cuentas bancarias que listar.
                </div>
              ) : loading ? (
                <div className="px-3 py-8 text-center text-xs text-gray-400">Cargando cuentas…</div>
              ) : disponibles.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-gray-500">
                  {cuentas.length === 0
                    ? 'El cliente no tiene cuentas bancarias registradas. Captúrelas en su expediente (subtab Cuentas Bancarias).'
                    : 'Todas las cuentas del cliente ya están agregadas.'}
                </div>
              ) : (
                <div className="border border-gray-200 rounded overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0">
                      <tr className="bg-gray-100 border-b border-gray-300">
                        <th className="px-2 py-2 text-left font-medium text-gray-700">Beneficiario</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">Banco</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">CLABE</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">No. Cuenta</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-700">Moneda</th>
                        <th className="px-2 py-2 text-center font-medium text-gray-700 w-24">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disponibles.map((c, idx) => (
                        <tr key={c.id} className={idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="px-2 py-1.5 text-gray-800">{c.beneficiario || <span className="text-gray-400">(sin beneficiario)</span>}</td>
                          <td className="px-2 py-1.5 text-gray-800">{c.banco || '—'}</td>
                          <td className="px-2 py-1.5 font-mono text-gray-700">{c.cuentaClabe || '—'}</td>
                          <td className="px-2 py-1.5 font-mono text-gray-700">{c.numeroCuenta || '—'}</td>
                          <td className="px-2 py-1.5 text-center text-gray-700">{c.moneda || 'MXN'}</td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              onClick={() => agregar(c)}
                              className="px-2 py-1 bg-[#0099CC] text-white rounded text-[10px] hover:bg-[#0088BB]"
                            >
                              Agregar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p className="text-[10px] text-gray-500 mt-3">
                Al agregar, el <strong>Monto Dispersión</strong> se establece en el Monto
                {origenMonto} de la solicitud ({fmt(montoAut)}) y puede ajustarse si la
                dispersión se reparte entre varias cuentas.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
