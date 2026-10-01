/**
 * OperacionSublineaModal.tsx — vida de una SubLínea de Carta de Crédito
 * después de activarse (MD SubLíneas 09 y 10), operada desde
 * Banca 2º Piso → Línea Global → Disposiciones.
 *
 *   ACTIVA ─┬─ vence sin reclamo ──────────────► LIBERADA (restituye disponible)
 *           └─ Reclamación ► RECLAMADA ► EN_ANALISIS ─┬─ RECHAZADA (vuelve a ACTIVA)
 *                                                     └─ PROCEDENTE ► Pago ► PAGADA
 *   PAGADA ► Recuperaciones ► EN_RECUPERACION ► Cierre (con o sin castigo) ► CERRADA
 *
 * Cada operación la ejecuta `sublineasStore` con relectura de la línea, rollback
 * y su póliza del MD 11. Esta pantalla sólo captura y muestra.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ESTADO_ACTIVA } from '../../lib/sublineasCartaCredito';
import { fetchCuentasBeneficiarias, fmtMoneyExacto, parseMon } from './banca2oPisoStore';
import {
  fetchLineaDeSublinea, operacionDe, resumenCierre, montoMaximoReclamable,
  liberarSublinea, registrarReclamacion, resolverReclamacion, pagarGarantia,
  registrarRecuperacion, cerrarSublinea,
  ESTADO_RECLAMADA, ESTADO_EN_ANALISIS, ESTADO_PROCEDENTE, ESTADO_PAGADA, ESTADO_EN_RECUPERACION,
  type SublineaCartaData,
} from './sublineasStore';

interface Props {
  sublineaId: string;
  noSol: string;
  lineaId: string;
  productoHijo: any;
  onClose: () => void;
  onCambio: () => void;
}

const hoy = () => new Date().toISOString().slice(0, 10);

export function OperacionSublineaModal({ sublineaId, noSol, lineaId, productoHijo, onClose, onCambio }: Props) {
  const [carta, setCarta] = useState<SublineaCartaData | null>(null);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [cuentas, setCuentas] = useState<any[]>([]);

  // Formularios
  const [rec, setRec] = useState({ fecha: hoy(), montoIncumplido: '', saldoElegible: '', montoReclamado: '', documentacion: '' });
  const [proc, setProc] = useState<Record<string, string>>({});
  const [pago, setPago] = useState({ reclamacionId: '', montoPagado: '', fechaPago: hoy(), cuentaBeneficiaria: '' });
  const [recup, setRecup] = useState({ fecha: hoy(), montoRecuperado: '', origen: '', porcentajeNafin: '' });
  const [castigar, setCastigar] = useState(false);
  /** Confirmación de la liberación anticipada (modal propio, no window.prompt). */
  const [confirmarLiberacion, setConfirmarLiberacion] = useState(false);
  const [motivoLiberacion, setMotivoLiberacion] = useState('Carta no utilizada');

  const cargar = async () => {
    const r = await fetchLineaDeSublinea(sublineaId);
    if (r.ok && r.sublinea) { setCarta(r.sublinea); setError(''); } else setError(r.error || 'No se pudo leer la SubLínea');
  };
  useEffect(() => {
    cargar();
    // MD 10 — el pago va al Intermediario Financiero por SUS cuentas: las de la Línea Global.
    fetchCuentasBeneficiarias(lineaId).then(setCuentas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sublineaId, lineaId]);

  const ejecutar = async (nombre: string, fn: () => Promise<{ ok: boolean; datos?: SublineaCartaData; error?: string }>) => {
    setTrabajando(true);
    try {
      const r = await fn();
      if (r.ok && r.datos) {
        setCarta(r.datos);
        toast.success(nombre, { description: `Estatus ${r.datos.estatus}.` });
        onCambio();
      } else {
        toast.error(`No se pudo: ${nombre}`, { description: r.error, duration: 12000 });
      }
    } finally {
      setTrabajando(false);
    }
  };

  if (!carta) {
    return (
      <Marco titulo={`SubLínea ${noSol}`} onClose={onClose}>
        <p className="p-4 text-xs text-gray-500">{error || 'Cargando…'}</p>
      </Marco>
    );
  }

  const op = operacionDe(carta);
  const resumen = resumenCierre(carta);
  const vencida = !!carta.fechaVencimiento && carta.fechaVencimiento <= hoy();
  const maxReclamable = montoMaximoReclamable(parseMon(rec.saldoElegible), carta.porcentajeCobertura, op.saldoGarantizado);
  const procedentes = op.reclamaciones.filter(r => r.estatus === ESTADO_PROCEDENTE);
  const inp = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded';
  const btn = 'px-3 py-1.5 text-xs font-medium text-white rounded bg-primary-theme hover:opacity-90 disabled:opacity-50';

  return (
    <Marco titulo={`SubLínea ${noSol} — ${carta.estatus}`} onClose={onClose}>
      <div className="p-4 space-y-4 text-xs">
        <Seccion titulo="Resumen">
          <div className="grid grid-cols-4 gap-3">
            <Dato l="Monto Garantizado" v={fmtMoneyExacto(resumen.montoGarantizado)} />
            <Dato l="Saldo Garantizado vigente" v={fmtMoneyExacto(op.saldoGarantizado)} />
            <Dato l="% Cobertura" v={`${carta.porcentajeCobertura || '—'}%`} />
            <Dato l="Vencimiento Carta" v={carta.fechaVencimiento || '—'} />
            <Dato l="Monto Reclamado" v={fmtMoneyExacto(resumen.reclamado)} />
            <Dato l="Monto Pagado" v={fmtMoneyExacto(resumen.pagado)} />
            <Dato l="Monto Recuperado (NAFIN)" v={fmtMoneyExacto(resumen.recuperado)} />
            <Dato l="Monto Castigado" v={fmtMoneyExacto(resumen.castigado)} />
            <Dato l="Saldo Pendiente" v={fmtMoneyExacto(resumen.saldoPendiente)} />
          </div>
        </Seccion>

        {/* MD 09 — Vencimiento sin reclamo */}
        {carta.estatus === ESTADO_ACTIVA && (
          <Seccion titulo="Vencimiento sin reclamo">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">
                {vencida
                  ? `La Carta venció el ${carta.fechaVencimiento}. Liberar restituye ${fmtMoneyExacto(op.saldoGarantizado)} al Disponible de la Línea Global.`
                  : `La Carta vence el ${carta.fechaVencimiento || '—'}. Puede liberarse anticipadamente si no se utilizará: restituye ${fmtMoneyExacto(op.saldoGarantizado)} al Disponible de la Línea Global.`}
              </span>
              <button className={btn} disabled={trabajando}
                onClick={() => {
                  // Antes del vencimiento se pide confirmación y motivo en un
                  // modal; la liberación anticipada queda señalada en la bitácora.
                  if (vencida) {
                    ejecutar('SubLínea liberada', () => liberarSublinea(sublineaId, productoHijo));
                  } else {
                    setMotivoLiberacion('Carta no utilizada');
                    setConfirmarLiberacion(true);
                  }
                }}>
                {vencida ? 'Liberar' : 'Liberar anticipadamente'}
              </button>
            </div>
          </Seccion>
        )}

        {/* MD 09 — Reclamación */}
        {carta.estatus === ESTADO_ACTIVA && (
          <Seccion titulo="Registrar Reclamación">
            <div className="grid grid-cols-3 gap-3">
              <Input l="Fecha" type="date" v={rec.fecha} on={v => setRec({ ...rec, fecha: v })} cls={inp} />
              <Input l="Monto Incumplido" v={rec.montoIncumplido} on={v => setRec({ ...rec, montoIncumplido: v })} cls={inp} />
              <Input l="Saldo Elegible" v={rec.saldoElegible} on={v => setRec({ ...rec, saldoElegible: v })} cls={inp} />
              <Dato l="Monto Máximo Reclamable" v={fmtMoneyExacto(maxReclamable)} />
              <Input l="Monto Reclamado" v={rec.montoReclamado} on={v => setRec({ ...rec, montoReclamado: v })} cls={inp} />
              <Input l="Documentación" v={rec.documentacion} on={v => setRec({ ...rec, documentacion: v })} cls={inp} />
            </div>
            <p className="mt-1 text-[10px] text-gray-500">Máximo Reclamable = MIN(Saldo Elegible × % Cobertura, Saldo Garantizado).</p>
            <div className="mt-2 flex justify-end">
              <button className={btn} disabled={trabajando}
                onClick={() => ejecutar('Reclamación registrada', () => registrarReclamacion(sublineaId, productoHijo, {
                  fecha: rec.fecha, montoIncumplido: parseMon(rec.montoIncumplido), saldoElegible: parseMon(rec.saldoElegible),
                  montoReclamado: parseMon(rec.montoReclamado), documentacion: rec.documentacion,
                }))}>
                Registrar Reclamación
              </button>
            </div>
          </Seccion>
        )}

        {op.reclamaciones.length > 0 && (
          <Seccion titulo="Reclamaciones">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-1">No.</th><th>Fecha</th><th className="text-right">Reclamado</th>
                  <th className="text-right">Máx.</th><th className="text-right">Procedente</th>
                  <th className="text-right">Pagado</th><th>Estatus</th><th />
                </tr>
              </thead>
              <tbody>
                {op.reclamaciones.map(r => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="py-1 font-mono">{r.noReclamacion}</td>
                    <td>{r.fecha}</td>
                    <td className="text-right">{fmtMoneyExacto(r.montoReclamado)}</td>
                    <td className="text-right">{fmtMoneyExacto(r.montoMaximoReclamable)}</td>
                    <td className="text-right">{r.montoProcedente ? fmtMoneyExacto(r.montoProcedente) : '—'}</td>
                    <td className="text-right">{r.montoPagado ? fmtMoneyExacto(r.montoPagado) : '—'}</td>
                    <td>{r.estatus}</td>
                    <td className="text-right whitespace-nowrap">
                      {r.estatus === ESTADO_RECLAMADA && (
                        <button className="text-blue-600 mr-2" disabled={trabajando}
                          onClick={() => ejecutar('Reclamación en análisis', () => resolverReclamacion(sublineaId, productoHijo, r.id, 'analizar'))}>
                          Analizar
                        </button>
                      )}
                      {r.estatus === ESTADO_EN_ANALISIS && (
                        <>
                          <input className="w-24 px-1 py-0.5 border border-gray-300 rounded mr-1" placeholder="Procedente"
                            value={proc[r.id] ?? String(r.montoReclamado)} onChange={e => setProc({ ...proc, [r.id]: e.target.value })} />
                          <button className="text-green-700 mr-2" disabled={trabajando}
                            onClick={() => ejecutar('Reclamación procedente', () => resolverReclamacion(sublineaId, productoHijo, r.id, 'procedente',
                              { montoProcedente: parseMon(proc[r.id] ?? r.montoReclamado) }))}>
                            Procedente
                          </button>
                        </>
                      )}
                      {[ESTADO_RECLAMADA, ESTADO_EN_ANALISIS].includes(r.estatus) && (
                        <button className="text-red-600" disabled={trabajando}
                          onClick={() => ejecutar('Reclamación rechazada', () => resolverReclamacion(sublineaId, productoHijo, r.id, 'rechazar'))}>
                          Rechazar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Seccion>
        )}

        {/* MD 10 — Pago de Garantía: NAFIN → Intermediario Financiero */}
        {procedentes.length > 0 && (
          <Seccion titulo="Pago de Garantía (NAFIN → Intermediario Financiero)">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] text-gray-600 mb-1">Reclamación</label>
                <select className={inp} value={pago.reclamacionId} onChange={e => setPago({ ...pago, reclamacionId: e.target.value })}>
                  <option value="">— Seleccionar —</option>
                  {procedentes.map(r => <option key={r.id} value={r.id}>{r.noReclamacion} · {fmtMoneyExacto(r.montoProcedente || 0)}</option>)}
                </select>
              </div>
              <Input l="Monto Pagado" v={pago.montoPagado} on={v => setPago({ ...pago, montoPagado: v })} cls={inp} />
              <Input l="Fecha Pago" type="date" v={pago.fechaPago} on={v => setPago({ ...pago, fechaPago: v })} cls={inp} />
              <div>
                <label className="block text-[10px] text-gray-600 mb-1">Cuenta Beneficiaria del IF</label>
                <select className={inp} value={pago.cuentaBeneficiaria} onChange={e => setPago({ ...pago, cuentaBeneficiaria: e.target.value })}>
                  <option value="">— Seleccionar —</option>
                  {cuentas.map((c: any, i: number) => {
                    const id = c.cuentaClabe || c.numeroCuenta || String(c.id ?? i);
                    return <option key={id} value={id}>{c.banco || 'Banco'} · {c.cuentaClabe || c.numeroCuenta}</option>;
                  })}
                </select>
              </div>
            </div>
            {cuentas.length === 0 && (
              <p className="mt-1 text-[11px] text-amber-700">
                La Línea Global no tiene Cuenta(s) Beneficiaria(s): captúrelas en la Solicitud de la línea antes de pagar.
              </p>
            )}
            <div className="mt-2 flex justify-end">
              <button className={btn} disabled={trabajando}
                onClick={() => ejecutar('Garantía pagada', () => pagarGarantia(sublineaId, productoHijo, pago.reclamacionId, {
                  montoPagado: parseMon(pago.montoPagado), fechaPago: pago.fechaPago, cuentaBeneficiaria: pago.cuentaBeneficiaria,
                }))}>
                Registrar Pago
              </button>
            </div>
          </Seccion>
        )}

        {/* MD 10 — Recuperación y Cierre */}
        {[ESTADO_PAGADA, ESTADO_EN_RECUPERACION].includes(carta.estatus) && (
          <>
            <Seccion titulo="Recuperación">
              <div className="grid grid-cols-4 gap-3">
                <Input l="Fecha" type="date" v={recup.fecha} on={v => setRecup({ ...recup, fecha: v })} cls={inp} />
                <Input l="Monto Recuperado" v={recup.montoRecuperado} on={v => setRecup({ ...recup, montoRecuperado: v })} cls={inp} />
                <Input l="Origen" v={recup.origen} on={v => setRecup({ ...recup, origen: v })} cls={inp} />
                <Input l="% que corresponde a NAFIN" v={recup.porcentajeNafin}
                  on={v => setRecup({ ...recup, porcentajeNafin: v })} cls={inp} />
              </div>
              <p className="mt-1 text-[10px] text-gray-500">
                La distribución NAFIN / IF se captura por recuperación (no se asume 50/50). Referencia: la cobertura pactada fue {carta.porcentajeCobertura || '—'}%.
              </p>
              <div className="mt-2 flex justify-end">
                <button className={btn} disabled={trabajando}
                  onClick={() => ejecutar('Recuperación registrada', () => registrarRecuperacion(sublineaId, productoHijo, {
                    fecha: recup.fecha, montoRecuperado: parseMon(recup.montoRecuperado), origen: recup.origen,
                    porcentajeNafin: parseMon(recup.porcentajeNafin),
                  }))}>
                  Registrar Recuperación
                </button>
              </div>
              {op.recuperaciones.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-[11px] text-gray-700">
                  {op.recuperaciones.map(x => (
                    <li key={x.id}>{x.fecha} · {x.origen || '—'} · {fmtMoneyExacto(x.montoRecuperado)} (NAFIN {fmtMoneyExacto(x.montoNafin)} · IF {fmtMoneyExacto(x.montoIF)})</li>
                  ))}
                </ul>
              )}
            </Seccion>

            <Seccion titulo="Cierre">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-gray-700">
                  <input type="checkbox" checked={castigar} onChange={e => setCastigar(e.target.checked)} />
                  Castigar el saldo pendiente ({fmtMoneyExacto(resumen.saldoPendiente)}) — no genera cuenta por cobrar al Intermediario
                </label>
                <button className={btn} disabled={trabajando || (resumen.saldoPendiente > 0.005 && !castigar)}
                  onClick={() => ejecutar('SubLínea cerrada', () => cerrarSublinea(sublineaId, productoHijo, castigar))}>
                  Cerrar
                </button>
              </div>
            </Seccion>
          </>
        )}

        {op.bitacora.length > 0 && (
          <Seccion titulo="Bitácora">
            <ul className="space-y-0.5 text-[11px] text-gray-600">
              {op.bitacora.map((b, i) => (
                <li key={i}>
                  {b.fecha.slice(0, 16).replace('T', ' ')} · {b.usuario || '—'} · {b.evento} · {b.estatusAnterior} → {b.estatusNuevo} · {b.detalle}
                  {b.poliza ? ` · Póliza ${b.poliza}` : ''}
                </li>
              ))}
            </ul>
          </Seccion>
        )}
      </div>
      {confirmarLiberacion && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => setConfirmarLiberacion(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="bg-primary-theme px-4 py-2.5 flex items-center justify-between rounded-t">
              <h4 className="text-sm font-bold text-white">Liberación anticipada de la Carta</h4>
              <button onClick={() => setConfirmarLiberacion(false)} className="text-white/70 hover:text-white">✕</button>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="bg-amber-50 border-l-4 border-amber-400 px-3 py-2 text-amber-800">
                La Carta vence el <strong>{carta.fechaVencimiento || '—'}</strong>. Liberarla ahora restituye
                <strong> {fmtMoneyExacto(op.saldoGarantizado)}</strong> al Disponible de la Línea Global y la deja
                <strong> LIBERADA</strong>. No se puede deshacer.
              </div>
              <div>
                <label className="block text-[10px] text-gray-600 mb-1 uppercase tracking-wider">
                  Motivo <span className="text-red-600">*</span>
                </label>
                <input type="text" value={motivoLiberacion} autoFocus
                  onChange={e => setMotivoLiberacion(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded" />
                <span className="text-[10px] text-gray-500">Queda registrado en la bitácora de la SubLínea.</span>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setConfirmarLiberacion(false)}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50">
                Cancelar
              </button>
              <button disabled={!motivoLiberacion.trim() || trabajando} className={btn}
                onClick={() => {
                  const motivo = motivoLiberacion.trim();
                  setConfirmarLiberacion(false);
                  ejecutar('SubLínea liberada anticipadamente', () => liberarSublinea(sublineaId, productoHijo, motivo));
                }}>
                Liberar anticipadamente
              </button>
            </div>
          </div>
        </div>
      )}
    </Marco>
  );
}

function Marco({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="bg-primary-theme px-4 py-2.5 flex items-center justify-between rounded-t sticky top-0">
          <h4 className="text-sm font-bold text-white">{titulo}</h4>
          <button onClick={onClose} className="text-white/70 hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded">
      <div className="bg-gray-50 border-b border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-700 uppercase">{titulo}</div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function Dato({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] text-gray-500">{l}</div>
      <div className="font-medium text-gray-800">{v}</div>
    </div>
  );
}

function Input({ l, v, on, cls, type = 'text' }: { l: string; v: string; on: (v: string) => void; cls: string; type?: string }) {
  return (
    <div>
      <label className="block text-[10px] text-gray-600 mb-1">{l}</label>
      <input type={type} value={v} onChange={e => on(e.target.value)} className={cls} />
    </div>
  );
}
