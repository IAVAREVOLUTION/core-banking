/**
 * AplicacionPagosTab — ESPECIFICACIÓN 4, pantalla.
 *
 * Captura el Pago Referenciado, muestra la vista previa de cómo se distribuirá
 * (§55) y lo aplica en una sola transacción.
 *
 * La pantalla NO decide nada: el reparto lo calcula `motorAplicacionPagosTDC` y
 * lo persiste `aplicar_pago_referenciado`. Aquí sólo se captura, se muestra y
 * se espera el resultado (§52: sin fire-and-forget).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  cargarCxCPagables,
  saldoCuentaEje,
  aplicarPagoReferenciado,
} from '../../lib/aplicarPagoReferenciado';
import { aplicarPago, type DocumentoCxC, type ResultadoAplicacionPago } from '../../lib/motorAplicacionPagosTDC';
import { esTarjetaCredito } from '../solicitudes/solicitudCreditoStore';
import { contabilizarAplicacionPagos } from '../../lib/contabilizarEventoTDC';
import { useProductosLineaCreditoDB } from '../../hooks/useProductosLineaCreditoDB';

interface Props {
  sid: string;
  mode: 'ver' | 'editar';
  isRO: boolean;
  producto?: string;
  sublinea?: string;
  clienteId?: string;
}

const fmt = (n: number) =>
  (Number(n) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const hoy = () => new Date().toISOString().slice(0, 10);

export function AplicacionPagosTab({ sid, isRO, producto = '', sublinea = '', clienteId = '' }: Props) {
  const esTDC = esTarjetaCredito(producto, sublinea);

  // La Guía Contabilizadora del producto — §2. Sin ella no hay póliza posible.
  const { productos } = useProductosLineaCreditoDB(true);
  const productoSel = useMemo(
    () => (productos || []).find((p: any) =>
      [p?.nombre, p?.clave, p?.id].filter(Boolean).some(v => String(v) === String(producto))),
    [productos, producto],
  );

  const [referencia, setReferencia] = useState('');
  const [monto, setMonto] = useState('');
  const [fechaPago, setFechaPago] = useState(hoy());

  const [documentos, setDocumentos] = useState<DocumentoCxC[]>([]);
  const [saldoEje, setSaldoEje] = useState(0);
  const [idEje, setIdEje] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [aplicando, setAplicando] = useState(false);
  const [ultimo, setUltimo] = useState<ResultadoAplicacionPago | null>(null);

  const recargar = useCallback(async () => {
    if (!clienteId || !esTDC) return;
    setCargando(true);
    const [cxc, eje] = await Promise.all([cargarCxCPagables(clienteId), saldoCuentaEje(clienteId)]);
    setCargando(false);
    setIdEje(eje.id);
    setSaldoEje(eje.saldo);
    if (cxc.desdeBD) { setDocumentos(cxc.documentos); setErrorCarga(''); }
    else { setDocumentos([]); setErrorCarga(cxc.error || ''); }
  }, [clienteId, esTDC]);

  useEffect(() => { void recargar(); }, [recargar]);

  const montoNum = parseFloat(String(monto).replace(/[,$\s]/g, '')) || 0;

  // Vista previa: el mismo motor, sin persistir (§55).
  const previa: ResultadoAplicacionPago | null =
    montoNum > 0
      ? aplicarPago({
          montoPago: montoNum,
          saldoEjeAnterior: saldoEje,
          documentos,
          idCuentaEje: idEje,
          idCliente: clienteId,
          idPagoReferenciado: referencia.trim(),
        })
      : null;

  const aplicar = async () => {
    if (isRO) { toast.warning('Modo solo lectura'); return; }
    if (aplicando) return;
    if (!referencia.trim()) { toast.error('Capture la referencia del pago'); return; }
    if (!(montoNum > 0)) { toast.error('El monto del pago debe ser mayor a cero'); return; }

    setAplicando(true);
    const res = await aplicarPagoReferenciado({
      // §45 — la referencia identifica el pago; dos envíos con la misma no duplican.
      idPagoReferenciado: referencia.trim(),
      referenciaPago: referencia.trim(),
      idCliente: clienteId,
      montoPago: montoNum,
      fechaPago,
    });
    setAplicando(false);

    if (!res.ok) {
      toast.error('No se aplicó el pago', { description: res.error, duration: 12000 });
      return;
    }

    setUltimo(res.motor);

    // ── §67/§84 — ESPECIFICACIÓN 5: contabilizar lo REALMENTE aplicado ──
    // §28: nunca el monto del Pago Referenciado. Si parte quedó en la Cuenta
    // EJE, ese remanente no se contabiliza como pago de ningún concepto.
    if (res.persistido && res.procesoId && res.motor.aplicacionesDetalle.length > 0) {
      const contab = await contabilizarAplicacionPagos({
        ctx: {
          guia: (productoSel as any)?.motorContable,
          productoId: String((productoSel as any)?.dbUuid || productoSel?.id || ''),
          claveProducto: productoSel?.clave,
          nombreProducto: productoSel?.nombre,
          clienteId, lineaId: String(sid),
          correlationId: `pago|${res.procesoId}`,
        },
        idProcesoAplicacion: res.procesoId,
        aplicaciones: res.motor.aplicacionesDetalle.map(a => ({
          id: a.idDetalle,
          idCxC: a.idCxC,
          claveConcepto: a.claveConcepto,
          nombreConcepto: a.nombreConcepto,
          montoAplicado: a.montoAplicado,
        })),
        fechaAplicacion: fechaPago,
      });

      if (!contab.ok) {
        // §84 — el pago quedó aplicado pero SIN póliza. Se dice tal cual.
        toast.error('El pago se aplicó pero NO quedó contabilizado', {
          description: contab.error,
          duration: 15000,
        });
      } else if (contab.persistido && !contab.yaEstaba) {
        toast.success(`Póliza contable ${contab.numeroPoliza} generada`, {
          description: `Se contabilizaron ${fmt(contab.poliza.montoContabilizado)} — sólo lo aplicado, no el pago completo.`,
          duration: 8000,
        });
      }
    }

    await recargar();
    setMonto('');

    const m = res.motor;
    toast.success('Aplicación de pago realizada correctamente', {
      description:
        `Recibido ${fmt(m.montoPagoRecibido)} · Aplicado ${fmt(m.montoTotalAplicado)} · ` +
        `Remanente en EJE ${fmt(m.saldoRemanenteEje)} · ` +
        `${m.cxcAfectadas} aviso(s) · ${m.lineasAfectadas} concepto(s) · ${m.contratosAfectados} contrato(s)`,
      duration: 10000,
    });
  };

  const inp = 'px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary-theme';
  const th = 'px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300';
  const td = 'px-2 py-1.5 text-xs border-r border-gray-200 text-gray-700';

  if (!esTDC) {
    return (
      <div className="border border-gray-300 bg-white p-6 text-center text-xs text-gray-500">
        La Aplicación de Pagos aplica sólo a productos de <b>Tarjeta de Crédito</b>.
      </div>
    );
  }

  const resumen = ultimo || previa;

  return (
    <div className="space-y-4">
      {/* ── Captura ── */}
      <div className="border border-gray-300">
        <div className="section-header-theme px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-800">APLICACIÓN DE PAGOS</span>
          {!isRO && (
            <button
              onClick={aplicar}
              disabled={aplicando || cargando || !(montoNum > 0) || !idEje}
              className="px-4 py-1.5 btn-secondary-theme rounded text-xs disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {aplicando ? 'Aplicando…' : cargando ? 'Cargando…' : 'Aplicar Pago'}
            </button>
          )}
        </div>

        <div className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3 bg-white">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Referencia del Pago *</label>
            <input value={referencia} onChange={e => setReferencia(e.target.value)}
                   disabled={isRO} className={`${inp} w-full`} placeholder="REF-000123" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Monto del Pago *</label>
            <input value={monto} onChange={e => setMonto(e.target.value)} inputMode="decimal"
                   disabled={isRO} className={`${inp} w-full text-right font-mono`} placeholder="0.00" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Fecha del Pago</label>
            <input type="date" value={fechaPago} onChange={e => setFechaPago(e.target.value)}
                   disabled={isRO} className={`${inp} w-full`} />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Saldo en Cuenta EJE</label>
            <div className="px-2 py-1.5 text-xs font-mono text-gray-800 bg-gray-50 border border-gray-200 rounded">
              {idEje ? fmt(saldoEje) : 'Sin Cuenta EJE'}
            </div>
          </div>
        </div>

        {(errorCarga || !idEje) && !cargando && (
          <div className="px-3 pb-3 text-xs text-red-700">
            {errorCarga || 'El cliente no tiene una Cuenta EJE válida: no se puede aplicar el pago.'}
          </div>
        )}
      </div>

      {/* ── §55 Resultado / vista previa ── */}
      {resumen && resumen.ok && (
        <div className="border border-gray-300">
          <div className="section-header-theme px-3 py-2">
            <span className="text-xs text-gray-800">
              {ultimo ? 'RESULTADO DE LA APLICACIÓN' : 'VISTA PREVIA — así se distribuirá'}
            </span>
          </div>
          <div className="p-3 grid grid-cols-2 md:grid-cols-6 gap-3 bg-white">
            {([
              ['Pago recibido', fmt(resumen.montoPagoRecibido)],
              ['Monto aplicado', fmt(resumen.montoTotalAplicado)],
              ['Remanente en EJE', fmt(resumen.saldoRemanenteEje)],
              ['Avisos afectados', String(resumen.cxcAfectadas)],
              ['Conceptos afectados', String(resumen.lineasAfectadas)],
              ['Contratos afectados', String(resumen.contratosAfectados)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k}>
                <div className="text-[11px] text-gray-500">{k}</div>
                <div className="text-sm font-mono text-gray-800">{v}</div>
              </div>
            ))}
          </div>

          {resumen.descuadres.length > 0 && (
            <div className="px-3 pb-3 space-y-1">
              {resumen.descuadres.map((d, i) => (
                <div key={i} className="text-xs text-red-700">{d}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Distribución línea por línea (§23) ── */}
      {resumen && resumen.ok && resumen.aplicacionesDetalle.length > 0 && (
        <div className="border border-gray-300 overflow-x-auto">
          <div className="section-header-theme px-3 py-2">
            <span className="text-xs text-gray-800">DISTRIBUCIÓN POR CONCEPTO</span>
          </div>
          <table className="w-full bg-white">
            <thead className="table-header-theme">
              <tr>
                <th className={th}>Aviso</th>
                <th className={th}>Orden</th>
                <th className={th}>Concepto</th>
                <th className={`${th} text-right`}>Saldo anterior</th>
                <th className={`${th} text-right`}>Aplicado</th>
                <th className={`${th} text-right`}>Saldo posterior</th>
                <th className={th}>Estatus</th>
              </tr>
            </thead>
            <tbody>
              {resumen.aplicacionesDetalle.map(a => {
                const doc = resumen.aplicacionesCxC.find(c => c.idCxC === a.idCxC);
                return (
                  <tr key={a.idDetalle} className="border-t border-gray-200">
                    <td className={td}>{doc?.folio || a.idCxC.slice(0, 8)}</td>
                    <td className={`${td} text-center`}>{a.ordenPrelacion}</td>
                    <td className={td}>{a.claveConcepto} — {a.nombreConcepto}</td>
                    <td className={`${td} text-right font-mono`}>{fmt(a.saldoAnterior)}</td>
                    <td className={`${td} text-right font-mono`}>{fmt(a.montoAplicado)}</td>
                    <td className={`${td} text-right font-mono`}>{fmt(a.saldoPosterior)}</td>
                    <td className={td}>
                      <span className={
                        a.estatusPagoNuevo === 'Pagado' ? 'text-green-700'
                        : a.estatusPagoNuevo === 'Parcial' ? 'text-amber-700' : 'text-gray-600'
                      }>{a.estatusPagoNuevo}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── §36 Abonos por contrato ── */}
      {resumen && resumen.ok && resumen.abonosPorContrato.length > 0 && (
        <div className="border border-gray-300 overflow-x-auto">
          <div className="section-header-theme px-3 py-2">
            <span className="text-xs text-gray-800">ABONOS POR CONTRATO</span>
          </div>
          <table className="w-full bg-white">
            <thead className="table-header-theme">
              <tr>
                <th className={th}>Contrato</th>
                <th className={`${th} text-right`}>Monto abonado</th>
              </tr>
            </thead>
            <tbody>
              {resumen.abonosPorContrato.map(a => (
                <tr key={a.idContrato} className="border-t border-gray-200">
                  <td className={td}>{a.idContrato}</td>
                  <td className={`${td} text-right font-mono`}>{fmt(a.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CxC pendientes del cliente (§6) ── */}
      <div className="border border-gray-300 overflow-x-auto">
        <div className="section-header-theme px-3 py-2">
          <span className="text-xs text-gray-800">
            AVISOS DE VENCIMIENTO PENDIENTES ({documentos.length})
          </span>
        </div>
        <table className="w-full bg-white">
          <thead className="table-header-theme">
            <tr>
              <th className={th}>Folio</th>
              <th className={th}>Contrato</th>
              <th className={th}>Vencimiento</th>
              <th className={`${th} text-right`}>Total a pagar</th>
              <th className={`${th} text-right`}>Pagado</th>
              <th className={`${th} text-right`}>Saldo</th>
              <th className={th}>Estatus</th>
            </tr>
          </thead>
          <tbody>
            {documentos.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-4 text-center text-xs text-gray-500">
                {cargando ? 'Cargando…' : 'El cliente no tiene avisos pendientes de pago.'}
              </td></tr>
            )}
            {documentos.map(d => (
              <tr key={d.id} className="border-t border-gray-200">
                <td className={td}>{d.folio || d.id.slice(0, 8)}</td>
                <td className={td}>{d.idContrato}</td>
                <td className={td}>{d.fechaVencimiento}</td>
                <td className={`${td} text-right font-mono`}>{fmt(d.montoTotalPagar)}</td>
                <td className={`${td} text-right font-mono`}>{fmt(d.pagoTotal)}</td>
                <td className={`${td} text-right font-mono`}>{fmt(d.montoTotalPagar - d.pagoTotal)}</td>
                <td className={td}>{d.estatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
