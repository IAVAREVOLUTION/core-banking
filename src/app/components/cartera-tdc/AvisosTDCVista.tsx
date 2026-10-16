/**
 * AvisosTDCVista — listado y detalle de Avisos de Vencimiento / CxC de TDC.
 *
 * Un solo componente para los dos lugares donde se consultan:
 *   · subtab "Avisos de Vencimiento" de una Línea (filtrado por línea)
 *   · submódulo "Avisos TDC" de Cobranza (todos)
 *
 * Lo que cambia entre ambos es el filtro y el encabezado, no la tabla ni el
 * detalle — duplicar el componente habría hecho que una corrección en el
 * desglose de prelación tuviera que aplicarse dos veces.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { cargarAvisosTDC, estaVencido, type AvisoTDC } from '../../lib/avisosTDC';

interface Props {
  /** Filtra a una Línea. Sin él, muestra todos los avisos. */
  lineaId?: string;
  clienteId?: string;
  /** Compacto: dentro de un subtab. Amplio: como módulo propio. */
  variante?: 'subtab' | 'modulo';
}

const fmt = (n: number) =>
  (Number(n) || 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const COLOR_ESTATUS: Record<string, string> = {
  Pendiente:      'bg-amber-50 text-amber-700 border-amber-200',
  Parcial:        'bg-blue-50 text-blue-700 border-blue-200',
  Pagada:         'bg-green-50 text-green-700 border-green-200',
  Pagado:         'bg-green-50 text-green-700 border-green-200',
  Reclasificada:  'bg-purple-50 text-purple-700 border-purple-200',
  Cancelada:      'bg-gray-100 text-gray-500 border-gray-200',
  Facturada:      'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export function AvisosTDCVista({ lineaId, clienteId, variante = 'subtab' }: Props) {
  const [avisos, setAvisos] = useState<AvisoTDC[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [filtro, setFiltro] = useState('');

  const recargar = useCallback(async () => {
    setCargando(true);
    const res = await cargarAvisosTDC({ lineaId, clienteId });
    setCargando(false);
    if (res.ok) { setAvisos(res.avisos); setError(''); }
    else { setAvisos([]); setError(res.error || ''); }
  }, [lineaId, clienteId]);

  useEffect(() => { void recargar(); }, [recargar]);

  const visibles = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return avisos;
    return avisos.filter(a =>
      a.folio.toLowerCase().includes(q) ||
      a.lineaId.toLowerCase().includes(q) ||
      a.clienteId.toLowerCase().includes(q) ||
      a.estatus.toLowerCase().includes(q));
  }, [avisos, filtro]);

  const totales = useMemo(() => ({
    total:   visibles.reduce((s, a) => s + a.montoTotalPagar, 0),
    saldo:   visibles.reduce((s, a) => s + a.saldoPendiente, 0),
    vencidos: visibles.filter(a => estaVencido(a)).length,
  }), [visibles]);

  const th = 'px-3 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider';
  const td = 'px-3 py-2 text-xs text-gray-700';

  return (
    <div className="space-y-3">
      {/* ── Resumen y búsqueda ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="text-gray-500">
            {visibles.length} aviso{visibles.length !== 1 ? 's' : ''}
          </span>
          <span className="text-gray-500">
            Total <span className="font-mono text-gray-800">{fmt(totales.total)}</span>
          </span>
          <span className="text-gray-500">
            Saldo <span className="font-mono text-gray-800">{fmt(totales.saldo)}</span>
          </span>
          {totales.vencidos > 0 && (
            <span className="text-red-700">
              {totales.vencidos} vencido{totales.vencidos !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {variante === 'modulo' && (
            <input
              value={filtro}
              onChange={e => setFiltro(e.target.value)}
              placeholder="Buscar folio, línea, cliente…"
              className="px-2 py-1.5 text-xs border border-gray-300 rounded bg-white w-60 focus:outline-none focus:ring-2 focus:ring-primary-theme"
            />
          )}
          <button onClick={recargar} className="text-xs text-blue-600 hover:text-blue-800">
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">{error}</div>
      )}

      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className={th}>Folio</th>
              {variante === 'modulo' && <th className={th}>Línea</th>}
              <th className={th}>Periodo</th>
              {/* §17 vs §18 — son dos fechas distintas y se muestran por separado
                  a propósito: confundirlas es el error clásico de este documento. */}
              <th className={th}>F. Documento</th>
              <th className={th}>F. Límite Pago</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={`${th} text-right`}>Mínimo</th>
              <th className={`${th} text-right`}>Pagado</th>
              <th className={`${th} text-right`}>Saldo</th>
              <th className={th}>Estatus</th>
              <th className={th}>Contab.</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibles.length === 0 && (
              <tr>
                <td colSpan={variante === 'modulo' ? 12 : 11} className="px-3 py-6 text-center text-xs text-gray-500">
                  {cargando ? 'Cargando…' : 'No hay avisos de vencimiento. Se generan al ejecutar un Cierre de Corte.'}
                </td>
              </tr>
            )}
            {visibles.map(a => {
              const vencido = estaVencido(a);
              const expandido = abierto === a.id;
              return (
                <>
                  <tr
                    key={a.id}
                    onClick={() => setAbierto(expandido ? null : a.id)}
                    className={`cursor-pointer ${expandido ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className={`${td} font-mono`}>{a.folio}</td>
                    {variante === 'modulo' && (
                      <td className={`${td} font-mono text-gray-500`}>{a.lineaId.slice(0, 8)}…</td>
                    )}
                    <td className={td}>{a.fechaInicio} → {a.fechaFin}</td>
                    <td className={td}>{a.fechaDocumento}</td>
                    <td className={`${td} ${vencido ? 'text-red-700 font-medium' : ''}`}>
                      {a.fechaVencimiento}{vencido ? ' ⚠' : ''}
                    </td>
                    <td className={`${td} text-right font-mono`}>{fmt(a.montoTotalPagar)}</td>
                    <td className={`${td} text-right font-mono`}>{fmt(a.montoMinimoPagar)}</td>
                    <td className={`${td} text-right font-mono`}>{fmt(a.pagoTotal)}</td>
                    <td className={`${td} text-right font-mono ${a.saldoPendiente > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                      {fmt(a.saldoPendiente)}
                    </td>
                    <td className={td}>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] border ${COLOR_ESTATUS[a.estatus] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {a.estatus}
                      </span>
                    </td>
                    <td className={td}>
                      {a.contabilizado
                        ? <span className="text-green-700">Sí</span>
                        : <span className="text-amber-700">Pendiente</span>}
                    </td>
                    <td className={`${td} text-gray-400`}>{expandido ? '▲' : '▼'}</td>
                  </tr>

                  {/* ── Detalle: los conceptos en su orden de prelación ── */}
                  {expandido && (
                    <tr key={`${a.id}-det`}>
                      <td colSpan={variante === 'modulo' ? 12 : 11} className="px-3 py-3 bg-gray-50">
                        <div className="text-[11px] text-gray-500 mb-2">
                          {a.detalle.length} concepto(s) · el orden es el de Prelación congelado al emitir
                          el Aviso, y es el que usa la aplicación de pagos
                        </div>
                        <table className="w-full text-xs bg-white border border-gray-200 rounded">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className={th}>Orden</th>
                              <th className={th}>Clave</th>
                              <th className={th}>Concepto</th>
                              <th className={th}>F. Cargo</th>
                              <th className={th}>Nat.</th>
                              <th className={`${th} text-center`}>bFactura</th>
                              <th className={`${th} text-right`}>Monto</th>
                              <th className={`${th} text-right`}>Pagado</th>
                              <th className={`${th} text-right`}>Saldo</th>
                              <th className={th}>Estatus</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {a.detalle.map(d => (
                              <tr key={d.id}>
                                <td className={`${td} text-center`}>{d.ordenPrelacion}</td>
                                <td className={`${td} font-mono`}>{d.claveConcepto}</td>
                                <td className={td}>{d.nombreConcepto}</td>
                                <td className={td}>{d.fechaCargo}</td>
                                <td className={td}>{d.naturaleza}</td>
                                <td className={`${td} text-center`}>{d.bFactura}</td>
                                <td className={`${td} text-right font-mono`}>{fmt(d.monto)}</td>
                                <td className={`${td} text-right font-mono`}>{fmt(d.pagoTotal)}</td>
                                <td className={`${td} text-right font-mono`}>{fmt(d.saldoPendiente)}</td>
                                <td className={td}>
                                  <span className={
                                    d.estatusPago === 'Pagado' ? 'text-green-700'
                                    : d.estatusPago === 'Parcial' ? 'text-amber-700' : 'text-gray-600'
                                  }>{d.estatusPago}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
