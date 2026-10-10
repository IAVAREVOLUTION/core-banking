/**
 * MovimientosLineaTab — REQ-26 HU-26.0 … HU-26.6.
 *
 * Subpestaña Movimientos de la Línea de Crédito. Al dar de alta un movimiento
 * corre el prewrite de [motorMovimientosTDC](../../lib/motorMovimientosTDC.ts):
 *
 *   1. Valida la clave contra Cargos Permitidos del producto (ESPEC 1).
 *   2. Si pasa, deriva comisiones, cash back y calendario MSI/MCI (ESPEC 2 §1).
 *   3. Resuelve cada concepto contra Afectación de la línea (§2) y aplica
 *      saldo disponible y cargos (§3).
 *
 * ── Transaccionalidad ────────────────────────────────────────────────────
 * El motor no escribe nada: devuelve el conjunto completo de efectos o un
 * error. Este componente sólo persiste cuando el motor devolvió `ok`, y lo
 * hace en una sola pasada — si el motor falla, no se escribe ni el movimiento.
 * La transacción real de base de datos vive en el RPC
 * `supabase/migrations/create_rpc_movimiento_tdc.sql`; esta pantalla es el
 * disparador por interfaz gráfica del mismo contrato (CA-03).
 */
import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import {
  ejecutarMovimientoTDC,
  claveEstaPermitida,
  money,
  type MovimientoEntrada,
  type ResultadoMotor,
} from '../../lib/motorMovimientosTDC';
import { aplicarMovimientoTDC } from '../../lib/aplicarMovimientoTDC';
import { useProductosLineaCreditoDB } from '../../hooks/useProductosLineaCreditoDB';
import { useComponentesContablesCatalogo } from '../../hooks/useComponentesContablesCatalogo';
import { esTarjetaCredito } from '../solicitudes/solicitudCreditoStore';
import { saveToSession, loadFromSession, loadFromSavedStore, generateId } from './creditoStore';

export interface MovimientoLinea {
  id: number;
  clave: string;
  concepto: string;
  descripcion: string;
  monto: number;
  fecha: string;
  naturaleza: 'Cargo' | 'Abono';
  /** Efectos derivados, para poder auditar qué generó el movimiento. */
  efectos: number;
  consumido: number;
}

interface Props {
  /**
   * Identificador de la Línea. En Cartera TDC es el id de la cuenta (uuid);
   * el store interpola la llave, así que acepta ambas formas.
   */
  sid: any;
  mode: string;
  isRO: boolean;
  /** Producto de la Línea — nombre o clave, como lo guarda el Crédito. */
  producto?: string;
  sublinea?: string;
  /** Monto autorizado de la línea; base del saldo disponible. */
  montoAutorizado?: string;
  clienteId?: string;
}

const hoyISO = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) =>
  `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function MovimientosLineaTab({
  sid, mode, isRO, producto = '', sublinea = '', montoAutorizado = '0', clienteId = '',
}: Props) {
  const { productos } = useProductosLineaCreditoDB(true);
  const { componentes } = useComponentesContablesCatalogo();

  const [items, setItems] = useState<MovimientoLinea[]>(
    () =>
      loadFromSession<MovimientoLinea[]>(sid, 'movimientosLinea') ||
      (mode !== 'nuevo' ? loadFromSavedStore<MovimientoLinea[]>(sid, 'movimientosLinea') : null) ||
      []
  );
  useEffect(() => {
    if (!isRO) saveToSession(sid, 'movimientosLinea', items);
  }, [items, sid, isRO]);

  // ── Producto de la Línea ──
  const productoSel = useMemo(
    () =>
      productos.find(
        p =>
          String(p.nombre).toLowerCase() === String(producto).toLowerCase() ||
          String(p.clave).toLowerCase() === String(producto).toLowerCase() ||
          String(p.id) === String(producto)
      ),
    [productos, producto]
  );

  const esTDC = esTarjetaCredito(sublinea, producto, productoSel?.nombre, (productoSel as any)?.subTipo);

  const cfg = useMemo(
    () => ({
      claveProducto: productoSel?.clave || '',
      nombreProducto: productoSel?.nombre || String(producto || ''),
      cargosPermitidos: Array.isArray((productoSel as any)?.cargos) ? (productoSel as any).cargos : [],
      promComisImpuestos: Array.isArray((productoSel as any)?.promComisImpuestos) ? (productoSel as any).promComisImpuestos : [],
      afectacionLinea: Array.isArray((productoSel as any)?.afectacionLinea) ? (productoSel as any).afectacionLinea : [],
    }),
    [productoSel, producto]
  );

  const catalogo = useMemo(() => componentes.map(c => ({ codigo: c.codigo, nombre: c.nombre })), [componentes]);

  /** Sólo los conceptos que el producto autoriza — evita teclear claves inválidas. */
  const clavesPermitidas = useMemo(
    () => catalogo.filter(c => claveEstaPermitida(c.codigo, cfg.cargosPermitidos, catalogo)),
    [catalogo, cfg.cargosPermitidos]
  );

  const autorizado = parseFloat(String(montoAutorizado).replace(/[,$\s]/g, '')) || 0;
  const consumido = money(items.reduce((a, m) => a + (m.consumido || 0), 0));
  const saldoDisponible = money(autorizado - consumido);

  // ── Alta ──
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState<MovimientoEntrada>({ clave: '', descripcion: '', monto: 0, fecha: hoyISO() });
  const [preview, setPreview] = useState<ResultadoMotor | null>(null);
  const [detalle, setDetalle] = useState<ResultadoMotor | null>(null);

  const abrirNuevo = () => {
    if (isRO) { toast.warning('Modo solo lectura'); return; }
    setDraft({ clave: '', descripcion: '', monto: 0, fecha: hoyISO() });
    setPreview(null);
    setShowModal(true);
  };

  /** Corre el motor sin escribir — deja ver los efectos antes de confirmar. */
  const simular = (m: MovimientoEntrada) =>
    ejecutarMovimientoTDC({
      movimiento: m,
      producto: { ...cfg, idLineaCredito: String(sid) },
      catalogo,
      saldoDisponible,
      idCliente: clienteId,
      // Vista previa: no se consulta la Cuenta EJE en cada tecleo; al confirmar
      // se resuelve de verdad por la relación del modelo (§1.1.2).
      idCuentaEje: clienteId ? 'preview' : null,
    });

  const onCambio = (m: MovimientoEntrada) => {
    setDraft(m);
    setPreview(m.clave && m.monto > 0 ? simular(m) : null);
  };

  const [aplicando, setAplicando] = useState(false);

  const confirmar = async () => {
    if (!draft.clave) { toast.error('Seleccione la clave del movimiento'); return; }
    if (!(draft.monto > 0)) { toast.error('El monto debe ser mayor a cero'); return; }

    setAplicando(true);
    // §4/§6 — se espera el resultado de la transacción ANTES de dar por bueno
    // el movimiento. Nada de fire-and-forget.
    const res = await aplicarMovimientoTDC({
      movimiento: draft,
      producto: cfg,
      catalogo,
      saldoDisponible,
      montoAutorizado: autorizado,
      idLineaCredito: String(sid),
      idCliente: clienteId,
    });
    setAplicando(false);

    // ESPEC 1 §1.2 / §2.2 — se cancela la creación, no queda registro parcial.
    if (!res.ok) {
      toast.error('Movimiento rechazado', {
        description: `${res.pasoFallido ? `[${res.pasoFallido}] ` : ''}${res.error}`,
        duration: 12000,
      });
      return;
    }
    const r = res.motor;

    const concepto = catalogo.find(c => c.codigo === draft.clave)?.nombre || draft.clave;
    const propio = r.efectosLinea.find(e => e.origen === 'movimiento');

    setItems(prev => [
      ...prev,
      {
        id: generateId(),
        clave: draft.clave,
        concepto,
        descripcion: draft.descripcion,
        monto: money(draft.monto),
        fecha: draft.fecha,
        naturaleza: propio?.naturaleza || 'Cargo',
        efectos: r.efectosLinea.length,
        consumido: r.totalConsumido,
      },
    ]);

    // REQ-27 — los Cargos con bCargo='S' quedan Pendientes para el Cierre de Corte.
    // Sin esto el corte no tendría de dónde tomar los conceptos a facturar.
    const previos = loadFromSession<any[]>(sid, 'cargosLinea')
      || loadFromSavedStore<any[]>(sid, 'cargosLinea')
      || [];
    const nuevos = r.cargosACrear.map((e, i) => ({
      id: `${Date.now()}-${i}`,
      clave: e.clave,
      nombre: e.nombre,
      naturaleza: e.naturaleza,
      monto: e.monto,
      fecha: e.fecha,
      bFactura: e.bFactura,
      bCargo: e.bCargo,
      estatus: 'Pendiente',
      cxcId: null,
      origen: e.origen,
    }));
    if (nuevos.length > 0) saveToSession(sid, 'cargosLinea', [...previos, ...nuevos]);

    // El subtab "Cargos" ya NO se alimenta desde aquí: lo DERIVA de
    // `cargosLinea` al abrirse (ver SolicitudCargosTab.cargosLineaTDC). Empujarlo
    // desde este punto dejaba dos copias que podían divergir, y cualquier
    // reescritura posterior de `cargos` borraba la proyección sin dejar rastro.
    r.advertencias.forEach(a => toast.warning(a));
    if (!res.persistido) {
      toast.warning('Guardado sólo en esta sesión', {
        description: 'La transacción de base de datos no se ejecutó; el movimiento no es aún permanente.',
        duration: 8000,
      });
    }
    toast.success('Movimiento aplicado', {
      description:
        `${r.efectosLinea.length} concepto(s) · consumido ${fmt(r.totalConsumido)} · ` +
        `disponible ${fmt(r.saldoDisponibleFinal)}` +
        (r.calendario.length ? ` · ${r.esMCI ? 'MCI' : 'MSI'} ${r.calendario.length} renglones` : ''),
      duration: 7000,
    });
    setShowModal(false);
  };

  const th = 'px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300';
  const td = 'px-2 py-1.5 text-xs border-r border-gray-200';
  const inp = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary-theme';

  if (!esTDC) {
    return (
      <div className="border border-gray-300 bg-white p-6 text-center text-xs text-gray-500">
        El prewrite de Movimientos aplica sólo a productos de <b>Tarjeta de Crédito</b>.
        Esta línea usa <b>{producto || 'un producto sin identificar'}</b>.
      </div>
    );
  }

  return (
    <>
      {/* Encabezado con el estado de la línea */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-1.5">
          <span className="text-xs text-gray-800">MOVIMIENTOS DE LA LÍNEA</span>
        </div>
        {!isRO && (
          <button onClick={abrirNuevo} className="px-4 py-1.5 btn-secondary-theme rounded text-xs">
            Nuevo movimiento
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-300 border border-gray-300 mb-3">
        {[
          ['Monto autorizado', fmt(autorizado)],
          ['Consumido', fmt(consumido)],
          ['Saldo disponible', fmt(saldoDisponible)],
        ].map(([k, v]) => (
          <div key={k} className="bg-white px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">{k}</div>
            <div className={`text-sm font-mono ${k === 'Saldo disponible' && saldoDisponible < 0 ? 'text-red-600' : 'text-gray-800'}`}>{v}</div>
          </div>
        ))}
      </div>

      {!productoSel && (
        <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
          No se encontró el producto <b>{producto || '—'}</b> en el catálogo, así que no hay configuración
          contra la cual validar. Los movimientos se rechazarán hasta resolverlo.
        </div>
      )}

      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full border-collapse min-w-[860px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className={th}>Clave</th>
              <th className={th}>Concepto</th>
              <th className={th}>Descripción</th>
              <th className={`${th} text-right`}>Monto</th>
              <th className={th}>Fecha</th>
              <th className={th}>Naturaleza</th>
              <th className={`${th} text-right`}>Consumido</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-center w-20">Efectos</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-gray-400">Sin movimientos</td>
              </tr>
            ) : (
              items.map(m => (
                <tr key={m.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className={`${td} font-mono`}>{m.clave}</td>
                  <td className={td}>{m.concepto}</td>
                  <td className={td}>{m.descripcion || '—'}</td>
                  <td className={`${td} text-right font-mono`}>{fmt(m.monto)}</td>
                  <td className={`${td} font-mono`}>{m.fecha}</td>
                  <td className={td}>{m.naturaleza}</td>
                  <td className={`${td} text-right font-mono`}>{fmt(m.consumido)}</td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => setDetalle(simular({ clave: m.clave, descripcion: m.descripcion, monto: m.monto, fecha: m.fecha }))}
                      className="text-[#0066CC] hover:underline text-xs"
                    >
                      {m.efectos}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowModal(false)}>
          <div className="bg-white shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={e => e.stopPropagation()}>
            <div className="bg-[#2E5C91] px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Nuevo Movimiento de la Línea</h3>
              <button onClick={() => setShowModal(false)} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
            </div>

            <div className="px-6 py-4 overflow-auto">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Clave del movimiento <span className="text-red-600">*</span></label>
                  <select value={draft.clave} onChange={e => onCambio({ ...draft, clave: e.target.value })} className={inp}>
                    <option value="">Seleccione...</option>
                    {clavesPermitidas.map(c => (
                      <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-gray-500 italic">
                    {clavesPermitidas.length > 0
                      ? `${clavesPermitidas.length} concepto(s) en Cargos Permitidos del producto`
                      : 'El producto no tiene Cargos Permitidos configurados'}
                  </span>
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Fecha</label>
                  <input type="date" value={draft.fecha} onChange={e => onCambio({ ...draft, fecha: e.target.value })} className={inp} />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Monto <span className="text-red-600">*</span></label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draft.monto || ''}
                    onChange={e => onCambio({ ...draft, monto: parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0 })}
                    placeholder="0.00"
                    className={`${inp} text-right font-mono`}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-700 mb-1 font-medium">Descripción</label>
                  <input type="text" maxLength={120} value={draft.descripcion} onChange={e => onCambio({ ...draft, descripcion: e.target.value })} className={inp} />
                </div>
              </div>

              {preview && <EfectosPreview r={preview} />}
            </div>

            <div className="flex gap-2 justify-end px-6 py-3 border-t border-gray-300">
              <button onClick={() => setShowModal(false)} className="px-4 py-1.5 bg-gray-500 text-white text-xs hover:bg-gray-600">Cancelar</button>
              <button
                onClick={confirmar}
                disabled={aplicando || (!!preview && !preview.ok)}
                className="px-4 py-1.5 bg-[#4A6FA5] text-white text-xs hover:bg-[#3E5C91] disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {aplicando ? 'Aplicando…' : 'Aplicar movimiento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDetalle(null)}>
          <div className="bg-white shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={e => e.stopPropagation()}>
            <div className="bg-[#2E5C91] px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">Efectos del movimiento</h3>
              <button onClick={() => setDetalle(null)} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
            </div>
            <div className="px-6 py-4 overflow-auto"><EfectosPreview r={detalle} /></div>
          </div>
        </div>
      )}
    </>
  );
}

/** Desglose de lo que el motor produjo — lo mismo que persistiría la transacción. */
function EfectosPreview({ r }: { r: ResultadoMotor }) {
  const fmtM = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const th = 'px-2 py-1.5 text-[10px] uppercase tracking-wide text-gray-500 text-left border-b border-gray-300';
  const td = 'px-2 py-1.5 text-xs border-b border-gray-100';

  if (!r.ok) {
    return (
      <div className="px-3 py-2 bg-red-50 border border-red-200 text-xs text-red-800">
        <b>Rechazado — {r.pasoFallido}</b>
        <div className="mt-1">{r.error}</div>
      </div>
    );
  }

  const ETIQUETA: Record<string, string> = {
    movimiento: 'Movimiento', comision: 'Comisión', 'iva-comision': 'IVA de comisión',
    'cash-back': 'Cash Back', 'msi-mci': 'Calendario',
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-300 border border-gray-300">
        {[
          ['Conceptos', String(r.efectosLinea.length)],
          ['Consume línea', fmtM(r.totalConsumido)],
          ['Disponible final', fmtM(r.saldoDisponibleFinal)],
          ['Calendario', r.calendario.length ? `${r.esMCI ? 'MCI' : 'MSI'} · ${r.calendario.length}` : '—'],
        ].map(([k, v]) => (
          <div key={k} className="bg-white px-2 py-1.5">
            <div className="text-[10px] uppercase tracking-wide text-gray-500">{k}</div>
            <div className="text-xs font-mono text-gray-800">{v}</div>
          </div>
        ))}
      </div>

      <div className="border border-gray-300 overflow-x-auto">
        <table className="w-full border-collapse min-w-[620px]">
          <thead><tr className="bg-gray-50">
            <th className={th}>Origen</th><th className={th}>Clave</th><th className={th}>Concepto</th>
            <th className={`${th} text-right`}>Monto</th><th className={th}>Nat.</th>
            <th className={th}>Consume</th><th className={th}>bCargo</th><th className={th}>bFactura</th>
          </tr></thead>
          <tbody>
            {r.efectosLinea.map((e, i) => (
              <tr key={i}>
                <td className={td}>{ETIQUETA[e.origen] || e.origen}</td>
                <td className={`${td} font-mono`}>{e.clave}</td>
                <td className={td}>{e.nombre}</td>
                <td className={`${td} text-right font-mono`}>{fmtM(e.monto)}</td>
                <td className={td}>{e.naturaleza}</td>
                <td className={td}>{e.consumeLineaDisponible}</td>
                <td className={td}>{e.bCargo}</td>
                <td className={td}>{e.bFactura}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {r.efectosCuentaEje.length > 0 && (
        <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
          <b>Cuenta Eje del cliente:</b>{' '}
          {r.efectosCuentaEje.map(c => `${c.naturaleza} ${fmtM(c.monto)} (${c.efectoEnSaldo > 0 ? 'suma' : 'resta'} al saldo)`).join(' · ')}
        </div>
      )}

      {r.calendario.length > 0 && (
        <details className="border border-gray-300">
          <summary className="px-3 py-2 text-xs cursor-pointer bg-gray-50">
            Calendario {r.esMCI ? 'MCI' : 'MSI'} — {r.calendario.length} renglones
          </summary>
          <div className="overflow-x-auto max-h-64">
            <table className="w-full border-collapse min-w-[460px]">
              <thead><tr className="bg-gray-50">
                <th className={th}>#</th><th className={th}>Fecha</th><th className={th}>Clave</th>
                <th className={th}>Concepto</th><th className={`${th} text-right`}>Monto</th>
              </tr></thead>
              <tbody>
                {r.calendario.map((c, i) => (
                  <tr key={i}>
                    <td className={`${td} font-mono`}>{c.periodo}</td>
                    <td className={`${td} font-mono`}>{c.fecha}</td>
                    <td className={`${td} font-mono`}>{c.clave || '—'}</td>
                    <td className={td}>{c.concepto}</td>
                    <td className={`${td} text-right font-mono`}>{fmtM(c.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {r.advertencias.length > 0 && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
          {r.advertencias.map((a, i) => <div key={i}>{a}</div>)}
        </div>
      )}
    </div>
  );
}
