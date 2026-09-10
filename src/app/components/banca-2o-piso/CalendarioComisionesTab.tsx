/**
 * CalendarioComisionesTab.tsx — REQ-18 HU-18.1 + HU-18.2 (CA-01…CA-13).
 *
 * Calcado del **Calendario de Rentas** de Cartera de Arrendamiento
 * ([CarteraArrendamientoList.tsx](../cartera/CarteraArrendamientoList.tsx), tab
 * 'calendario'): la selección con checkbox y el botón "Crear Aviso de
 * Vencimiento" viven en ESTA pestaña, no en una aparte. La pestaña "Avisos de
 * Vencimiento" sólo lista los avisos ya generados, con el mismo componente
 * compartido `AvisosVencimientoTab`.
 *
 * Comisiones de la garantía a lo largo de TODO el plazo (§Decisión 1, opción a).
 * No es amortización: la garantía no abona capital (RN-01), así que el Monto
 * Garantizado se mantiene constante y cada periodo sólo devenga comisión + IVA.
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { crearAvisoVencimiento, type Amortizacion } from '../../hooks/useCarteraDB';
import {
  fmtMoneyExacto, parseMon, generarCalendarioComisiones, faltantesComisionGPO,
  parametrosComisionGPO, guardarBanca2oPiso, SUB_TIPO_COMISION_GPO,
  extraerCalendarioComisiones,
  type LineaCreditoRow, type ComisionProgramada,
} from './banca2oPisoStore';
import { loadFromSession, loadFromSavedStore } from '../solicitudes/solicitudCreditoStore';
import { useProductosLineaCreditoDB } from '../../hooks/useProductosLineaCreditoDB';
// REQ-21 HU-21.1 — los conceptos del Aviso salen del catálogo de Cargos del
// producto, no de literales: tienen que coincidir con el componente contable.
import { conceptosAvisoComision, construirConceptosAviso } from '../../lib/cargosProductoGPO';

const FORMAS_PAGO = [
  'Transferencia SPEI', 'Banca por internet', 'En sucursal',
  'Depósito en efectivo', 'Cheque', 'Cargo automático',
];

/** Sólo las Pendientes se pueden avisar; las demás ya se cobraron (CA-12). */
const esPendiente = (r: ComisionProgramada) => r.estatus === 'Pendiente';

export function CalendarioComisionesTab({
  row,
  onCambio,
}: {
  row: LineaCreditoRow;
  onCambio?: () => void;
}) {
  // REQ-21 CA-04 — el producto aporta el catálogo de Cargos (nombres de los
  // conceptos) y el Motor Contable (respaldo para saber cuáles son del Aviso).
  const { productos } = useProductosLineaCreditoDB(true);
  const productoLinea = useMemo(() => {
    const buscado = String(row.productoId || '').trim();
    if (!buscado) return undefined;
    return productos.find(p => String(p.dbUuid || '') === buscado || String(p.id ?? '') === buscado);
  }, [productos, row.productoId]);

  const conceptosProducto = useMemo(
    () => conceptosAvisoComision(
      (productoLinea as any)?.cargos,
      (productoLinea as any)?.motorContable,
    ),
    [productoLinea],
  );

  const getInitialRows = useCallback((): ComisionProgramada[] => {
    if (row.banca2oPiso.calendarioComisiones && row.banca2oPiso.calendarioComisiones.length > 0) {
      return row.banca2oPiso.calendarioComisiones;
    }
    // Extraer con respaldo a sesión y origen
    const extraidas = extraerCalendarioComisiones(
      row.banca2oPiso,
      row.terminosRaw,
      undefined,
      row.id,
      row.noSol,
    );
    if (extraidas.length > 0) return extraidas;

    if (typeof window !== 'undefined') {
      const s = (row.id ? (loadFromSession<any[]>(row.id, 'simulacion') || loadFromSavedStore<any[]>(row.id, 'simulacion') || loadFromSession<any[]>(row.id, 'calendarioComisiones') || loadFromSavedStore<any[]>(row.id, 'calendarioComisiones')) : null) ||
        (row.noSol ? (loadFromSession<any[]>(row.noSol, 'simulacion') || loadFromSavedStore<any[]>(row.noSol, 'simulacion') || loadFromSession<any[]>(row.noSol, 'calendarioComisiones') || loadFromSavedStore<any[]>(row.noSol, 'calendarioComisiones')) : null);
      if (Array.isArray(s) && s.length > 0) {
        return s.map((r, i) => ({
          noPago: Number(r.noPago ?? r.no_pago ?? r.noAportacion ?? r.no_aportacion ?? i + 1),
          fechaPago: String(r.fechaPago ?? r.fecha_pago ?? r.fecha ?? ''),
          comision: parseMon(r.comision ?? r.pagoInteres ?? r.pago_interes ?? r.pagoPeriodo ?? r.pago_periodo ?? r.monto ?? 0),
          iva: parseMon(r.iva ?? r.ivaInteres ?? r.iva_interes ?? 0),
          total: parseMon(r.total ?? r.pagoTotal ?? r.pago_total ?? 0),
          estatus: String(r.estatus || 'Pendiente'),
          avisoId: r.avisoId ?? r.aviso_id ?? undefined,
        }));
      }
    }
    return [];
  }, [row]);

  const [rows, setRows] = useState<ComisionProgramada[]>(getInitialRows);

  useEffect(() => {
    setRows(getInitialRows());
  }, [getInitialRows]);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [generando, setGenerando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [showAvisoModal, setShowAvisoModal] = useState(false);

  const [formaPago, setFormaPago] = useState(FORMAS_PAGO[0]);
  const [fechaCompromiso, setFechaCompromiso] = useState('');
  const [institucion, setInstitucion] = useState('eFinancianet');
  const [cuentaBancaria, setCuentaBancaria] = useState(row.noCuenta || '');
  const [referencia, setReferencia] = useState(row.noSol || '');

  const faltantes = useMemo(() => faltantesComisionGPO(row), [row]);
  const params = useMemo(() => parametrosComisionGPO(row), [row]);

  const pendientes = useMemo(() => rows.filter(esPendiente), [rows]);
  const seleccionadas = useMemo(() => rows.filter(r => seleccion.has(r.noPago)), [rows, seleccion]);
  const todasSeleccionadas = pendientes.length > 0 && seleccion.size === pendientes.length;

  const totalesSeleccion = useMemo(() => seleccionadas.reduce(
    (a, r) => ({ comision: a.comision + r.comision, iva: a.iva + r.iva, total: a.total + r.total }),
    { comision: 0, iva: 0, total: 0 },
  ), [seleccionadas]);

  const toggle = (r: ComisionProgramada) => {
    if (!esPendiente(r)) return;
    setSeleccion(prev => {
      const n = new Set(prev);
      if (n.has(r.noPago)) n.delete(r.noPago); else n.add(r.noPago);
      return n;
    });
  };

  const toggleTodas = () => {
    setSeleccion(todasSeleccionadas ? new Set() : new Set(pendientes.map(r => r.noPago)));
  };

  // ── Generar / regenerar el calendario ──
  const handleGenerar = async () => {
    if (faltantes.length > 0) {
      toast.error('No se puede generar el calendario', { description: `Falta capturar: ${faltantes.join(', ')}.`, duration: 6000 });
      return;
    }
    const yaProcesadas = rows.filter(r => !esPendiente(r)).length;
    if (yaProcesadas > 0 && !window.confirm(
      `El calendario ya tiene ${yaProcesadas} comisión(es) avisadas o pagadas.\n\n` +
      `Regenerarlo las va a reiniciar a "Pendiente". ¿Continuar?`,
    )) return;

    setGenerando(true);
    const nuevo = generarCalendarioComisiones(row);
    const r = await guardarBanca2oPiso(row.id, { calendarioComisiones: nuevo });
    setGenerando(false);

    if (!r.ok) {
      toast.error('No se pudo guardar el calendario', { description: r.error, duration: 8000 });
      return;
    }
    setRows(nuevo);
    setSeleccion(new Set());
    onCambio?.();
    toast.success('Calendario de comisiones generado', {
      description: `${nuevo.length} periodo(s) · ${params.periodicidad} · ${params.plazoAnios} año(s)`,
      duration: 4000,
    });
  };

  // ── Crear el Aviso de Vencimiento con las comisiones marcadas (CA-08…CA-13) ──
  const handleCrearAviso = async () => {
    // REQ-21 §Decisión 2 — sin los conceptos del producto NO se emite el aviso.
    // Uno con nombres genéricos se cobra pero no cruza con el componente
    // contable, así que quedaría imposible de contabilizar: es peor que no
    // emitirlo.
    if (!conceptosProducto) {
      toast.error('El producto no tiene configurados los conceptos del Aviso', {
        description:
          'Capture en su subtab Cargos los conceptos de Comisión GPO e IVA Comisión GPO ' +
          '(o márquelos con el momento "Aviso de vencimiento — Comisión").',
        duration: 12000,
      });
      return;
    }

    setEnviando(true);

    // Mapeo comisión → Amortizacion, que es el shape que ya espera el backend
    // compartido de la cartera. RN-01: la comisión viaja como `pago_interes` y
    // el Monto Garantizado como `saldo_insoluto` constante.
    //
    // REQ-21 CA-01/CA-05 — además viajan `conceptos`, y con eso el backend deja
    // de armar el desglose de crédito (Capital / Interés / IVA Interés / Seguro)
    // y usa exactamente estos dos renglones.
    const amortizaciones = seleccionadas.map((r): Amortizacion => ({
      id: `${row.id}-com-${r.noPago}`,
      solicitud_id: row.id,
      no_pago: r.noPago,
      fecha_pago: r.fechaPago,
      saldo_insoluto: params.montoGarantizado,
      pago_capital: 0,
      pago_interes: r.comision,
      iva_interes: r.iva,
      pago_seguro: 0,
      iva_seguro: 0,
      pago_total: r.total,
      estatus: r.estatus,
      conceptos: construirConceptosAviso(conceptosProducto, r.comision, r.iva),
    }));

    const result = await crearAvisoVencimiento({
      solicitud_id: row.id,
      amortizaciones,
      sub_tipo: SUB_TIPO_COMISION_GPO,
      cliente: row.cliente,
      forma_pago: formaPago,
      fecha_compromiso: fechaCompromiso || undefined,
      moneda: row.moneda || 'MXN',
      institucion_financiera: institucion || undefined,
      cuenta_bancaria: cuentaBancaria || undefined,
      referencia: referencia || undefined,
    });

    if (!result.ok) {
      setEnviando(false);
      toast.error('Error al crear el aviso', { description: result.error, duration: 8000 });
      return;
    }

    const folio = result.factura_id || '';
    const actualizadas = rows.map(r =>
      seleccion.has(r.noPago) ? { ...r, estatus: 'Facturada', avisoId: folio } : r,
    );
    const guardado = await guardarBanca2oPiso(row.id, { calendarioComisiones: actualizadas });
    setEnviando(false);

    if (!guardado.ok) {
      // El aviso YA existe en el backend y no se puede deshacer desde aquí;
      // es más honesto avisarlo que reportar un éxito completo.
      toast.warning('Aviso creado, pero no se pudo actualizar el calendario', {
        description: `${guardado.error}. Refresque y verifique antes de volver a avisar estas comisiones.`,
        duration: 12000,
      });
    } else {
      toast.success('Aviso de vencimiento creado', {
        description: `Folio ${folio.substring(0, 8)}… · ${seleccion.size} comisión(es) · ${fmtMoneyExacto(totalesSeleccion.total)}`,
        duration: 5000,
      });
    }

    setRows(actualizadas);
    setSeleccion(new Set());
    setShowAvisoModal(false);
    onCambio?.();
  };

  const totalGeneral = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div>
      {/* ── Encabezado de sección — mismo formato que Calendario de Rentas ── */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-2 flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-medium text-gray-800">CALENDARIO DE COMISIONES</span>
        <span className="text-xs text-gray-600">
          {rows.length} comisión(es) · {pendientes.length} pendiente(s) · {seleccion.size} seleccionada(s)
        </span>
      </div>

      {/* Parámetros de origen — de dónde sale el cálculo */}
      <div className="px-3 py-1.5 mb-2 text-[11px] text-gray-500">
        Monto Garantizado {fmtMoneyExacto(params.montoGarantizado)} · Tasa {params.tasaAnual || '—'}% anual ·
        {' '}{params.periodicidad || 'sin periodicidad'} · Plazo {params.plazoAnios || '—'} año(s)
      </div>

      {/* CA-06 — decir QUÉ falta, no una tabla en blanco */}
      {faltantes.length > 0 && (
        <div className="mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800">
          No se puede calcular la comisión de esta línea: falta <strong>{faltantes.join(', ')}</strong>.
          Se captura en el Cierre Comercial de la Oportunidad y se hereda a Términos y Condiciones.
        </div>
      )}

      {/* ── Acciones ── */}
      <div className="flex items-center justify-end gap-2 mb-2">
        <button
          onClick={handleGenerar}
          disabled={generando}
          title="Recalcula el calendario completo con los datos de Términos y Condiciones"
          className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6.5 1v5.5L9 9" strokeLinecap="round" strokeLinejoin="round" /><circle cx="6.5" cy="6.5" r="5.5" />
          </svg>
          {generando ? 'Generando…' : rows.length > 0 ? 'Regenerar Calendario' : 'Generar Calendario'}
        </button>
        <button
          onClick={() => seleccion.size > 0 ? setShowAvisoModal(true) : toast.error('Seleccione al menos una comisión')}
          disabled={seleccion.size === 0}
          className="px-3 py-1.5 text-xs font-medium rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 1v6M3 4l3 3 3-3" strokeLinecap="round" /><rect x="1" y="8" width="10" height="3" rx="1" />
          </svg>
          Crear Aviso de Vencimiento {seleccion.size > 0 && `(${seleccion.size})`}
        </button>
      </div>

      {/* ── Tabla ── */}
      <div className="border border-gray-300 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ backgroundColor: '#D0D0D0' }} className="border-b border-gray-300">
              <th className="px-2 py-2 text-center w-8">
                <input type="checkbox" checked={todasSeleccionadas} onChange={toggleTodas}
                  disabled={pendientes.length === 0} className="cursor-pointer disabled:opacity-30" />
              </th>
              <th className="px-3 py-2 text-center text-[10px] text-gray-700 font-semibold">NO. COMISIÓN</th>
              <th className="px-3 py-2 text-left text-[10px] text-gray-700 font-semibold">FECHA</th>
              <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold">COMISIÓN DEL PERIODO</th>
              <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold">IVA DEL PERIODO</th>
              <th className="px-3 py-2 text-right text-[10px] text-gray-700 font-semibold">TOTAL</th>
              <th className="px-3 py-2 text-center text-[10px] text-gray-700 font-semibold">ESTATUS</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                No se encontró cotización o calendario de comisiones guardado para esta solicitud. Presione <strong>Generar Calendario</strong> si desea calcularlo ahora.
              </td></tr>
            ) : rows.map((r, idx) => {
              const seleccionable = esPendiente(r);
              const marcada = seleccion.has(r.noPago);
              return (
                <tr key={r.noPago}
                  onClick={() => toggle(r)}
                  className={`border-b border-gray-200 transition-colors ${
                    marcada ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  } ${seleccionable ? 'cursor-pointer hover:bg-blue-50/60' : ''}`}
                >
                  <td className="px-2 py-1.5 text-center">
                    <input type="checkbox" checked={marcada} disabled={!seleccionable}
                      onChange={() => toggle(r)} onClick={e => e.stopPropagation()}
                      className="disabled:opacity-30" />
                  </td>
                  <td className="px-3 py-1.5 text-center">{r.noPago}</td>
                  <td className="px-3 py-1.5">{r.fechaPago}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtMoneyExacto(r.comision)}</td>
                  <td className="px-3 py-1.5 text-right font-mono">{fmtMoneyExacto(r.iva)}</td>
                  <td className="px-3 py-1.5 text-right font-mono font-medium">{fmtMoneyExacto(r.total)}</td>
                  <td className="px-3 py-1.5 text-center">
                    <span className={`inline-flex px-1.5 py-0.5 text-[9px] border rounded ${
                      r.estatus === 'Pagada'
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {r.estatus}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              {seleccion.size > 0 && (
                <tr className="bg-blue-100 border-t border-blue-200 font-medium text-blue-900">
                  <td colSpan={3} className="px-3 py-2 text-right text-[10px] uppercase tracking-wide">Selección:</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoneyExacto(totalesSeleccion.comision)}</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtMoneyExacto(totalesSeleccion.iva)}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{fmtMoneyExacto(totalesSeleccion.total)}</td>
                  <td />
                </tr>
              )}
              <tr className="bg-gray-50 border-t border-gray-300">
                <td colSpan={5} className="px-3 py-2 text-right font-semibold text-gray-700">TOTAL GENERAL:</td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-gray-900">{fmtMoneyExacto(totalGeneral)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── Modal Aviso de Vencimiento ── */}
      {showAvisoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !enviando && setShowAvisoModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-gray-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#2E5C91] rounded-t-xl">
              <div>
                <h4 className="text-sm font-bold text-white">Nuevo Aviso de Vencimiento</h4>
                <p className="text-[11px] text-blue-200 mt-0.5">
                  {seleccion.size} comisión{seleccion.size !== 1 ? 'es' : ''} GPO · {row.moneda || 'MXN'}
                </p>
              </div>
              <button onClick={() => !enviando && setShowAvisoModal(false)} className="text-white/70 hover:text-white">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l8 8M11 3l-8 8" /></svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1.5">
                {[['Comisión', totalesSeleccion.comision], ['IVA', totalesSeleccion.iva]].map(([l, v]) => (
                  <div key={l as string} className="flex justify-between text-xs">
                    <span className="text-gray-500">{l}</span>
                    <span className="font-medium font-mono">{fmtMoneyExacto(v as number)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-bold border-t border-gray-200 pt-1.5">
                  <span>Total a Cobrar</span>
                  <span className="text-[#2E5C91] font-mono">{fmtMoneyExacto(totalesSeleccion.total)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Cliente</label>
                  <input value={row.cliente} disabled className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-100 text-gray-600" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Forma de Pago *</label>
                  <select value={formaPago} onChange={e => setFormaPago(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg">
                    {FORMAS_PAGO.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Fecha Compromiso</label>
                  <input type="date" value={fechaCompromiso} onChange={e => setFechaCompromiso(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Institución Financiera</label>
                  <input value={institucion} onChange={e => setInstitucion(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Cuenta Bancaria</label>
                  <input value={cuentaBancaria} onChange={e => setCuentaBancaria(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-600 mb-1 uppercase tracking-wide">Referencia</label>
                  <input value={referencia} onChange={e => setReferencia(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg" />
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowAvisoModal(false)} disabled={enviando} className="px-4 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleCrearAviso} disabled={enviando} className={`px-4 py-1.5 text-xs rounded-lg ${enviando ? 'bg-gray-300 text-gray-500' : 'btn-secondary-theme'}`}>
                {enviando ? 'Generando…' : 'Crear Aviso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
