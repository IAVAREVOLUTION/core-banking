/**
 * AplicacionPagosTab — Cartera de Crédito Individual.
 *
 * Portado de la rama Producto-TDC-FINAL (creditos/AplicacionPagosTab). Captura
 * el pago, muestra la vista previa de cómo se distribuirá y lo aplica.
 *
 * La pantalla NO decide nada: el reparto lo calcula `motorAplicacionPagos` con
 * la "Prelación de cargos" del producto, y lo persiste el servidor en una
 * transacción (`aplicarPagoCredito`).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from '@/app/lib/notificaciones';
import { CampoMonto } from '@/app/components/ui/CampoMonto';
import { DatePicker } from '@/app/components/ui/DatePicker';
import { formatearFecha } from '@/app/lib/fechas';
import { aplicarPago, type DocumentoCxC, type ResultadoAplicacionPago } from '@/app/lib/motorAplicacionPagos';
import { mapaPrelacion, nombreEnProducto, type FilaPrelacion } from '@/app/lib/prelacionCargos';
import {
  cargarPrelacionProducto, cargarAvisosPagables, cuentaEjeConSaldo, aplicarPagoCredito,
  generarReferenciaPago, referenciasUsadas,
} from '@/app/lib/aplicacionPagosCartera';

interface Props {
  solicitudId: string;
  clienteId?: string;
  productoId?: string;
  noSol?: string;
  isRO: boolean;
}

const fmt = (n: number) => (Number(n) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function AplicacionPagosTab({ solicitudId, clienteId = '', productoId = '', noSol = '', isRO }: Props) {
  // Folio del pago: se genera solo (único por pago); se puede reemplazar por la
  // referencia bancaria, siempre que no se haya usado antes en este crédito.
  const [referencia, setReferencia] = useState(() => generarReferenciaPago(noSol));
  const [usadas, setUsadas] = useState<Set<string>>(new Set());
  const [monto, setMonto] = useState('');
  const [fechaPago, setFechaPago] = useState(hoyISO());

  const [prelacion, setPrelacion] = useState<FilaPrelacion[]>([]);
  const [documentos, setDocumentos] = useState<DocumentoCxC[]>([]);
  const [eje, setEje] = useState<{ id: string | null; noCuenta: string; saldo: number }>({ id: null, noCuenta: '', saldo: 0 });
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');
  const [aplicando, setAplicando] = useState(false);
  const [ultimo, setUltimo] = useState<ResultadoAplicacionPago | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    const pre = await cargarPrelacionProducto(productoId);
    const [av, cta, refs] = await Promise.all([
      cargarAvisosPagables(solicitudId, pre), cuentaEjeConSaldo(clienteId), referenciasUsadas(solicitudId),
    ]);
    setCargando(false);
    setUsadas(refs);
    setPrelacion(pre);
    setEje(cta);
    setDocumentos(av.documentos);
    setErrorCarga(av.ok ? '' : (av.error || 'No se pudieron leer los avisos.'));
  }, [solicitudId, clienteId, productoId]);

  useEffect(() => { void recargar(); }, [recargar]);

  const montoNum = parseFloat(String(monto).replace(/[,$\s]/g, '')) || 0;

  // Vista previa: el mismo motor, sin persistir.
  const previa: ResultadoAplicacionPago | null = useMemo(() => (
    (montoNum > 0 || eje.saldo > 0) && documentos.length > 0
      ? aplicarPago({ montoPago: montoNum, saldoEjeAnterior: eje.saldo, documentos, idCuentaEje: eje.id, idCliente: clienteId, idPagoReferenciado: referencia.trim() })
      : null
  ), [montoNum, eje, documentos, clienteId, referencia]);

  const ordenConfigurado = useMemo(() => {
    const m = mapaPrelacion(prelacion);
    return Object.entries(m).sort((a, b) => a[1] - b[1]).map(([k]) => nombreEnProducto(k, prelacion));
  }, [prelacion]);

  const refNorm = referencia.trim().toLowerCase();
  const errorReferencia = !refNorm
    ? 'La referencia es obligatoria.'
    : refNorm.length < 4
      ? 'La referencia debe tener al menos 4 caracteres.'
      : usadas.has(refNorm)
        ? 'Esta referencia ya se aplicó a este crédito. Use otra (o genere una nueva).'
        : '';

  const aplicar = async () => {
    if (isRO) { toast.warning('Modo solo lectura'); return; }
    if (aplicando) return;
    if (errorReferencia) { toast.error(errorReferencia); return; }
    if (!(montoNum > 0) && !(eje.saldo > 0)) { toast.error('Capture el monto del pago'); return; }

    setAplicando(true);
    const res = await aplicarPagoCredito({
      solicitudId, clienteId, productoId, noSol,
      referencia: referencia.trim(), montoPago: montoNum, fechaPago,
    });
    setAplicando(false);

    if (!res.ok) {
      toast.error('No se aplicó el pago', { description: res.error, duration: 12000 });
      return;
    }
    setUltimo(res.motor);
    await recargar();
    setMonto('');
    setReferencia(generarReferenciaPago(noSol)); // el siguiente pago lleva folio nuevo
    if (res.yaAplicado) { toast.info('Este pago ya se había aplicado; no se duplicó.'); return; }

    const m = res.motor;
    toast.success('Aplicación de pago realizada correctamente', {
      description:
        `Recibido ${fmt(m.montoPagoRecibido)} · Aplicado ${fmt(m.montoTotalAplicado)} · ` +
        `Remanente en EJE ${fmt(m.saldoRemanenteEje)} · ${m.cxcAfectadas} aviso(s) · ${m.lineasAfectadas} concepto(s)`,
      duration: 10000,
    });
  };

  const inp = 'px-2 py-1.5 text-xs border border-gray-300 rounded bg-white';
  const th = 'px-2 py-2 text-xs text-white text-left border-r border-white/20 font-medium';
  const td = 'px-2 py-1.5 text-xs border-r border-gray-200 text-gray-700';
  const cab = 'bg-[color:var(--theme-secondary)]';
  const seccion = 'px-3 py-2 bg-gray-100 border-b border-gray-300 text-xs font-medium text-gray-800';

  const resumen = ultimo || previa;

  return (
    <div className="space-y-4">
      {/* ── Captura ── */}
      <div className="border border-gray-300 bg-white">
        <div className={`${seccion} flex items-center justify-between`}>
          <span>APLICACIÓN DE PAGOS</span>
          {!isRO && (
            <button
              onClick={aplicar}
              disabled={aplicando || cargando || !eje.id || !!errorReferencia || !(montoNum > 0 || eje.saldo > 0)}
              className="px-4 py-1.5 rounded text-xs text-white bg-[color:var(--theme-action)] hover:bg-[color:var(--theme-action-hover)] disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {aplicando ? 'Aplicando…' : cargando ? 'Cargando…' : 'Aplicar Pago'}
            </button>
          )}
        </div>

        <div className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Referencia del Pago *</label>
            <div className="flex gap-1">
              <input value={referencia} onChange={e => setReferencia(e.target.value.toUpperCase())} disabled={isRO}
                className={`${inp} w-full font-mono ${errorReferencia ? 'border-red-400 bg-red-50' : ''}`}
                placeholder="PAG-…" aria-invalid={!!errorReferencia} />
              {!isRO && (
                <button type="button" title="Generar una referencia nueva" aria-label="Generar una referencia nueva"
                  onClick={() => setReferencia(generarReferenciaPago(noSol))}
                  className="px-2 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50">↻</button>
              )}
            </div>
            {errorReferencia
              ? <span className="text-[10px] text-red-600">{errorReferencia}</span>
              : <span className="text-[10px] text-gray-400">Generada automáticamente; puede usar la referencia bancaria.</span>}
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Monto del Pago</label>
            <CampoMonto value={monto} onChange={e => setMonto(e.target.value)} disabled={isRO} className={`${inp} w-full text-right font-mono`} />
            <span className="text-[10px] text-gray-400">En 0 aplica sólo el saldo de la Cuenta EJE.</span>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Fecha del Pago</label>
            <DatePicker formato="iso" value={fechaPago} onChange={(v: string) => setFechaPago(v)} disabled={isRO} className="text-xs" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Saldo en Cuenta EJE</label>
            <div className="px-2 py-1.5 text-xs font-mono text-gray-800 bg-gray-50 border border-gray-200 rounded">
              {eje.id ? fmt(eje.saldo) : 'Sin Cuenta EJE'}
            </div>
            {eje.noCuenta && <span className="text-[10px] text-gray-400 font-mono">{eje.noCuenta}</span>}
          </div>
        </div>

        <div className="px-3 pb-3 text-[11px] text-gray-500">
          Prelación del producto: {ordenConfigurado.join(' → ')}
          {prelacion.length === 0 && <span className="text-amber-700"> (el producto no tiene "Prelación de cargos"; se usa el orden por omisión)</span>}
        </div>

        {eje.id && eje.saldo < 0 && !cargando && (
          <div className="px-3 pb-3 text-xs text-amber-700">
            La Cuenta EJE tiene saldo negativo ({fmt(eje.saldo)}): el pago primero cubre ese saldo y sólo el excedente se aplica a los avisos.
          </div>
        )}

        {(errorCarga || (!eje.id && !cargando)) && (
          <div className="px-3 pb-3 text-xs text-red-700">
            {errorCarga || 'El cliente no tiene una Cuenta EJE válida: no se puede aplicar el pago.'}
          </div>
        )}
      </div>

      {/* ── Resultado / vista previa ── */}
      {resumen && resumen.ok && (
        <div className="border border-gray-300 bg-white">
          <div className={seccion}>{ultimo ? 'RESULTADO DE LA APLICACIÓN' : 'VISTA PREVIA — así se distribuirá'}</div>
          <div className="p-3 grid grid-cols-2 md:grid-cols-5 gap-3">
            {([
              ['Pago recibido', fmt(resumen.montoPagoRecibido)],
              ['Disponible (EJE + pago)', fmt(resumen.montoDisponibleInicial)],
              ['Monto aplicado', fmt(resumen.montoTotalAplicado)],
              ['Remanente en EJE', fmt(resumen.saldoRemanenteEje)],
              ['Avisos / conceptos', `${resumen.cxcAfectadas} / ${resumen.lineasAfectadas}`],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k}>
                <div className="text-[11px] text-gray-500">{k}</div>
                <div className="text-sm font-mono text-gray-800">{v}</div>
              </div>
            ))}
          </div>
          {resumen.descuadres.length > 0 && (
            <div className="px-3 pb-3 space-y-1">
              {resumen.descuadres.map((d, i) => <div key={i} className="text-xs text-red-700">{d}</div>)}
            </div>
          )}
        </div>
      )}

      {/* ── Distribución línea por línea ── */}
      {resumen && resumen.ok && resumen.aplicacionesDetalle.length > 0 && (
        <div className="border border-gray-300 overflow-x-auto bg-white">
          <div className={seccion}>DISTRIBUCIÓN POR CONCEPTO</div>
          <table className="w-full">
            <thead className={cab}>
              <tr>
                <th className={th}>Aviso</th>
                <th className={`${th} text-center`}>Orden</th>
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
                  <tr key={`${a.idCxC}-${a.idDetalle}`} className="border-t border-gray-200">
                    <td className={`${td} font-mono`}>{doc?.folio || a.idCxC}</td>
                    <td className={`${td} text-center`}>{a.ordenPrelacion}</td>
                    <td className={td}>{a.nombreConcepto}</td>
                    <td className={`${td} text-right font-mono`}>{fmt(a.saldoAnterior)}</td>
                    <td className={`${td} text-right font-mono`}>{fmt(a.montoAplicado)}</td>
                    <td className={`${td} text-right font-mono`}>{fmt(a.saldoPosterior)}</td>
                    <td className={td}>
                      <span className={a.estatusPagoNuevo === 'Pagado' ? 'text-green-700' : a.estatusPagoNuevo === 'Parcial' ? 'text-amber-700' : 'text-gray-600'}>
                        {a.estatusPagoNuevo}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Avisos pendientes del crédito ── */}
      <div className="border border-gray-300 overflow-x-auto bg-white">
        <div className={`${seccion} flex items-center justify-between`}>
          <span>AVISOS DE VENCIMIENTO PENDIENTES ({documentos.length})</span>
          <button onClick={() => void recargar()} className="text-xs text-[color:var(--theme-link)] hover:underline">Actualizar</button>
        </div>
        <table className="w-full">
          <thead className={cab}>
            <tr>
              <th className={th}>Folio</th>
              <th className={th}>Vencimiento</th>
              <th className={th}>Conceptos (en orden de prelación)</th>
              <th className={`${th} text-right`}>Total a pagar</th>
              <th className={`${th} text-right`}>Pagado</th>
              <th className={`${th} text-right`}>Saldo</th>
              <th className={th}>Estatus</th>
            </tr>
          </thead>
          <tbody>
            {documentos.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-4 text-center text-xs text-gray-500">
                {cargando ? 'Cargando…' : 'El crédito no tiene avisos pendientes de pago.'}
              </td></tr>
            )}
            {[...documentos].sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento)).map(d => (
              <tr key={d.id} className="border-t border-gray-200">
                <td className={`${td} font-mono`}>{d.folio || d.id}</td>
                <td className={td}>{formatearFecha(d.fechaVencimiento)}</td>
                <td className={`${td} text-[11px]`}>
                  {[...d.detalle].sort((x, y) => x.ordenPrelacion - y.ordenPrelacion)
                    .map(x => `${x.nombreConcepto} ${fmt(x.monto - x.pagoTotal)}`).join(' · ')}
                </td>
                <td className={`${td} text-right font-mono`}>{fmt(d.montoTotalPagar)}</td>
                <td className={`${td} text-right font-mono`}>{fmt(d.pagoTotal)}</td>
                <td className={`${td} text-right font-mono`}>{fmt(d.montoTotalPagar - d.pagoTotal)}</td>
                <td className={td}>{d.pagoTotal > 0 ? 'Parcial' : d.estatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
