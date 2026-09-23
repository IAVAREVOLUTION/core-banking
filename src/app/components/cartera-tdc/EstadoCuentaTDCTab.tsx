/**
 * EstadoCuentaTDCTab — ESPECIFICACIÓN 6, pantalla.
 *
 * Captura la Fecha Estado, genera el documento y muestra el historial (§4,
 * §13, §20). Todo lo demás —Cliente, Línea, Producto— sale del contexto de la
 * Cartera TDC abierta (§6): aquí no se vuelve a capturar nada de eso.
 *
 * La pantalla no decide: el periodo, los movimientos y las cifras las resuelve
 * `motorEstadoCuentaTDC` y las persiste `generar_estado_cuenta_tdc`.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  cargarContextoEstadoCuenta,
  cargarHistorialEstadosCuenta,
  generarYGuardarEstadoCuenta,
  urlDocumento,
  type ContextoEstadoCuenta,
  type FilaHistorial,
} from '../../lib/generarEstadoCuentaTDC';
import {
  generarEstadoCuenta,
  fechaEstadoSugerida,
  type ResultadoEstadoCuenta,
} from '../../lib/motorEstadoCuentaTDC';
import { useProductosLineaCreditoDB } from '../../hooks/useProductosLineaCreditoDB';
import { currentUser } from '../../data/mockData';

interface Props {
  /** El id de la Línea — el mismo `cuenta.id` que reciben los otros subtabs. */
  sid: string;
  isRO: boolean;
  producto?: string;
  clienteId?: string;
  cliente?: string;
  numeroLinea?: string;
  limiteAutorizado?: number;
  moneda?: string;
  estatusLinea?: string;
}

const fmt = (n: number, moneda = 'MXN') =>
  (Number(n) || 0).toLocaleString('es-MX', { style: 'currency', currency: moneda || 'MXN' });

const fmtFecha = (iso: string) => {
  const m = String(iso || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};

const fmtFechaHora = (v: string) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? fmtFecha(v) : d.toLocaleString('es-MX');
};

const hoy = () => new Date().toISOString().slice(0, 10);

const th = 'px-3 py-2 text-left text-[11px] font-medium';
const td = 'px-3 py-2 text-xs text-gray-700';
const inp = 'px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:border-primary-theme';

export function EstadoCuentaTDCTab({
  sid, isRO, producto = '', clienteId = '', cliente = '',
  numeroLinea = '', limiteAutorizado = 0, moneda = 'MXN', estatusLinea = '',
}: Props) {
  const { productos } = useProductosLineaCreditoDB(true);

  const productoSel = useMemo(
    () => (productos || []).find((p: any) =>
      [p?.nombre, p?.clave, p?.id].filter(Boolean).some(v => String(v) === String(producto))),
    [productos, producto],
  );

  const [fechaEstado, setFechaEstado] = useState(hoy());
  /**
   * Mientras el usuario no capture una fecha a mano, la pantalla propone la
   * que corresponde: FechaLímitePago + 1 día del último corte ya vencido.
   * En cuanto la toca, su elección manda y no se vuelve a sobrescribir.
   */
  const [fechaTocada, setFechaTocada] = useState(false);
  const [contexto, setContexto] = useState<ContextoEstadoCuenta | null>(null);
  const [historial, setHistorial] = useState<FilaHistorial[]>([]);
  const [cargando, setCargando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [errorCarga, setErrorCarga] = useState('');

  const linea = useMemo(() => ({
    idLinea: String(sid || ''),
    idCliente: clienteId,
    idProducto: productoSel?.id != null ? String(productoSel.id) : undefined,
    numeroLinea,
    limiteAutorizado,
    saldoDisponible: 0,
    moneda,
    estatus: estatusLinea,
  }), [sid, clienteId, productoSel, numeroLinea, limiteAutorizado, moneda, estatusLinea]);

  const recargar = useCallback(async () => {
    if (!sid) return;
    setCargando(true);
    const ctx = await cargarContextoEstadoCuenta({ idLinea: String(sid), idCliente: clienteId, fechaEstado });
    setCargando(false);
    setContexto(ctx);
    setErrorCarga(ctx.ok ? '' : (ctx.error || ''));
    if (ctx.ok) {
      const h = await cargarHistorialEstadosCuenta(String(sid));
      if (h.ok) setHistorial(h.filas);
    }
  }, [sid, clienteId, fechaEstado]);

  // La propuesta se calcula con los avisos ya leídos; por eso va después de
  // la carga y no en el estado inicial.
  useEffect(() => {
    if (fechaTocada || !contexto?.ok) return;
    const sugerida = fechaEstadoSugerida(contexto.avisos, hoy());
    if (sugerida && sugerida !== fechaEstado) setFechaEstado(sugerida);
  }, [contexto, fechaTocada, fechaEstado]);

  useEffect(() => { void recargar(); }, [recargar]);

  /** Vista previa: el mismo motor, sin persistir. */
  const previa: ResultadoEstadoCuenta | null = useMemo(() => {
    if (!contexto?.ok || !fechaEstado) return null;
    return generarEstadoCuenta({
      linea: {
        ...linea,
        limiteAutorizado: contexto.limiteAutorizado ?? linea.limiteAutorizado,
        saldoDisponible: contexto.saldoDisponible ?? 0,
      },
      fechaEstado,
      fechaActual: hoy(),
      avisos: contexto.avisos,
      movimientos: contexto.movimientos,
      pagos: contexto.pagos,
      estadosPrevios: contexto.estadosPrevios,
    });
  }, [contexto, fechaEstado, linea]);

  const generar = async () => {
    // §21.1 — el candado de pantalla. El de verdad está en la base (§21.3).
    if (generando || isRO) return;
    if (!fechaEstado) { toast.error('Debe capturar la Fecha Estado.'); return; }
    if (!contexto?.ok) { toast.error(errorCarga || 'No se pudo leer la información de la Línea.'); return; }

    setGenerando(true);
    const res = await generarYGuardarEstadoCuenta({
      linea,
      fechaEstado,
      cliente,
      producto: productoSel?.nombre || producto,
      usuario: currentUser.name,
      plantillas: (productoSel as any)?.plantillas,
      contexto,
    });
    setGenerando(false);

    if (!res.ok) {
      toast.error('No se generó el Estado de Cuenta', {
        description: res.error || 'Error desconocido.',
        duration: 12000,
      });
      return;
    }

    toast.success('Estado de Cuenta generado', {
      description: `Periodo ${fmtFecha(res.calculo?.fechaInicioPeriodo || '')} – ${fmtFecha(res.calculo?.fechaFinPeriodo || '')}`,
      duration: 8000,
    });
    await recargar();
  };

  const abrirPDF = async (fila: FilaHistorial) => {
    const url = fila.documentoPdf ? await urlDocumento(fila.documentoPdf) : fila.urlDocumento;
    if (!url) { toast.error('Este Estado de Cuenta no tiene PDF asociado.'); return; }
    window.open(url, '_blank', 'noopener');
  };

  const puedeGenerar =
    !isRO && !generando && !cargando && !!fechaEstado && !!contexto?.ok && !!previa?.ok;

  return (
    <div className="space-y-4">
      {/* ── §4 Captura ── */}
      <div className="border border-gray-300">
        <div className="section-header-theme px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-800">ESTADO DE CUENTA</span>
          {!isRO && (
            <button
              onClick={generar}
              disabled={!puedeGenerar}
              className="px-4 py-1.5 btn-secondary-theme rounded text-xs disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
              title="Genera el Estado de Cuenta a la Fecha Estado capturada"
            >
              {generando ? 'Generando…' : cargando ? 'Cargando…' : 'Generar Edo Cuenta'}
            </button>
          )}
        </div>

        <div className="p-3 grid grid-cols-1 md:grid-cols-4 gap-3 bg-white">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Fecha Estado *
              {!fechaTocada && previa?.periodo && (
                <span className="ml-1 text-[10px] text-gray-400">(límite de pago + 1 día)</span>
              )}
            </label>
            <input
              type="date" value={fechaEstado} max={hoy()}
              onChange={e => { setFechaTocada(true); setFechaEstado(e.target.value); }}
              disabled={isRO} className={`${inp} w-full`}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Periodo correspondiente</label>
            <div className="px-2 py-1.5 text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded">
              {previa?.periodo
                ? `${fmtFecha(previa.fechaInicioPeriodo)} – ${fmtFecha(previa.fechaFinPeriodo)}`
                : '—'}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Fecha de Corte</label>
            <div className="px-2 py-1.5 text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded">
              {previa?.periodo ? fmtFecha(previa.fechaCorte) : '—'}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Fecha Límite de Pago</label>
            <div className="px-2 py-1.5 text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded">
              {previa?.periodo ? fmtFecha(previa.fechaLimitePago) : '—'}
            </div>
          </div>
        </div>

        {/* §17 — el motivo por el que no se puede generar, dicho sin rodeos. */}
        {(errorCarga || (previa && !previa.ok)) && !cargando && (
          <div className="px-3 pb-3 text-xs text-red-700">
            {errorCarga || previa?.error}
          </div>
        )}
      </div>

      {/* ── §15 Vista previa del snapshot ── */}
      {previa?.snapshot && previa.periodo && (
        <div className="border border-gray-300">
          <div className="section-header-theme px-3 py-2">
            <span className="text-xs text-gray-800">
              RESUMEN AL CORTE {previa.periodo.folio ? `— ${previa.periodo.folio}` : ''}
            </span>
          </div>
          <div className="p-3 grid grid-cols-2 md:grid-cols-4 gap-3 bg-white">
            {([
              ['Límite Autorizado', fmt(previa.snapshot.limiteAutorizado, moneda)],
              ['Saldo Anterior', fmt(previa.snapshot.saldoAnterior, moneda)],
              ['Cargos del Periodo', fmt(previa.snapshot.cargosPeriodo, moneda)],
              ['Pagos a la Fecha Estado', fmt(previa.snapshot.pagosPeriodo, moneda)],
              ['Saldo al Corte', fmt(previa.snapshot.saldoAlCorte, moneda)],
              ['Consume Línea', fmt(previa.snapshot.saldoConsumeLinea, moneda)],
              ['Crédito Disponible', fmt(previa.snapshot.creditoDisponible, moneda)],
              ['Pago Mínimo', fmt(previa.snapshot.pagoMinimo, moneda)],
              // D2 — cargos del periodo + saldo anterior.
              ['Pago que No Genera Intereses', fmt(previa.snapshot.pagoNoGeneraIntereses, moneda)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k}>
                <div className="text-[11px] text-gray-500">{k}</div>
                <div className="text-sm font-mono text-gray-800">{v}</div>
              </div>
            ))}
          </div>

          <div className="px-3 pb-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-gray-500">
            <span>{previa.movimientosPeriodo.length} movimiento(s) en el periodo</span>
            <span>{previa.pagosConsiderados.length} pago(s) considerado(s)</span>
            <span>{previa.periodo.detalle.length} concepto(s) en el Aviso</span>
            {previa.estadoAnterior && (
              <span>Encadena con el Estado del {fmtFecha(previa.estadoAnterior.fechaEstado)}</span>
            )}
          </div>

          {previa.descuadres.length > 0 && (
            <div className="px-3 pb-3 space-y-1">
              {previa.descuadres.map((d, i) => (
                <div key={i} className="text-xs text-red-700">{d}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── §13 Historial ── */}
      <div className="border border-gray-300 overflow-x-auto">
        <div className="section-header-theme px-3 py-2">
          <span className="text-xs text-gray-800">
            HISTORIAL DE ESTADOS DE CUENTA ({historial.length})
          </span>
        </div>
        <table className="w-full bg-white">
          <thead className="table-header-theme">
            <tr>
              <th className={th}>Fecha Edo.</th>
              <th className={th}>Periodo</th>
              <th className={th}>Corte</th>
              <th className={th}>Generación</th>
              <th className={`${th} text-right`}>Saldo al Corte</th>
              <th className={`${th} text-right`}>Pago Mínimo</th>
              <th className={`${th} text-right`}>No Genera Int.</th>
              <th className={th}>Estatus</th>
              <th className={th}>Usuario</th>
              <th className={th}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {historial.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-4 text-center text-xs text-gray-500">
                {cargando ? 'Cargando…' : 'Esta Línea no tiene Estados de Cuenta generados.'}
              </td></tr>
            )}
            {historial.map(f => (
              <tr key={f.id} className="border-t border-gray-200">
                <td className={td}>{fmtFecha(f.fechaEstado)}</td>
                <td className={td}>{fmtFecha(f.fechaInicioPeriodo)} – {fmtFecha(f.fechaFinPeriodo)}</td>
                <td className={td}>{fmtFecha(f.fechaCorte)}</td>
                <td className={td}>{fmtFechaHora(f.fechaGeneracion)}</td>
                <td className={`${td} text-right font-mono`}>{fmt(f.saldoAlCorte, f.moneda)}</td>
                <td className={`${td} text-right font-mono`}>{fmt(f.pagoMinimo, f.moneda)}</td>
                <td className={`${td} text-right font-mono ${f.pagoNoGeneraInteresesConfigurado ? '' : 'text-gray-400'}`}>
                  {/* Las filas emitidas antes de definirse la fórmula guardaron cero. */}
                  {f.pagoNoGeneraInteresesConfigurado ? fmt(f.pagoNoGeneraIntereses, f.moneda) : 'n/d'}
                </td>
                <td className={td}>
                  <span className={
                    f.estatus === 'GENERADO' ? 'text-green-700'
                    : f.estatus === 'ERROR' ? 'text-red-700' : 'text-gray-600'
                  }>{f.estatus}</span>
                </td>
                <td className={td}>{f.usuario || '—'}</td>
                <td className={td}>
                  <button
                    onClick={() => abrirPDF(f)}
                    disabled={!f.documentoPdf && !f.urlDocumento}
                    className="text-primary-theme hover:underline disabled:text-gray-400 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    Ver PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
