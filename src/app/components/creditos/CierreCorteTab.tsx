/**
 * CierreCorteTab — REQ-27. Submódulo Cierre de Corte de la Línea de Crédito.
 *
 * Propone el periodo desde el Día de Corte configurado, muestra los Cargos que
 * entrarían, los ordena por Prelación y genera la CxC con su detalle.
 *
 * ── Dónde sale cada dato ─────────────────────────────────────────────────
 *   Día de corte, días para pago, pago mínimo → subtab "Reglas de Pago y Corte
 *   TDC" del producto, con respaldo en las Condiciones de la Tarjeta de la
 *   Solicitud cuando existan (§Decisión 2: manda lo pactado en la instancia).
 *   Prelación → "Orden de aplicación de pagos" de las Reglas TDC y, si no está,
 *   el subtab "Prelación de cargos" del producto (§Decisión 3).
 *
 * ── Qué NO hace ──────────────────────────────────────────────────────────
 * No calcula nada: todo viene de
 * [motorCierreCorteTDC](../../lib/motorCierreCorteTDC.ts), que es puro y
 * testeable. Aquí sólo se resuelve la configuración, se pinta el resultado y
 * se persiste. La transacción real vive en
 * `supabase/migrations/create_rpc_cierre_corte_tdc.sql`.
 */
import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import {
  ejecutarCierreCorte,
  calcularPeriodoCorte,
  type CargoLinea,
  type ConfigCorte,
  type RenglonPrelacion,
  type ResultadoCierre,
} from '../../lib/motorCierreCorteTDC';
import { useProductosLineaCreditoDB } from '../../hooks/useProductosLineaCreditoDB';
import { esTarjetaCredito } from '../solicitudes/solicitudCreditoStore';
import { saveToSession, loadFromSession, loadFromSavedStore, generateId } from './creditoStore';
import { cargarCargosLinea, aplicarCierreCorteTDC } from '../../lib/aplicarCierreCorteTDC';
import { contabilizarCorte } from '../../lib/contabilizarEventoTDC';

interface Props {
  /**
   * Identificador de la Línea. En Cartera TDC es el id de la cuenta (uuid);
   * el store interpola la llave, así que acepta ambas formas.
   */
  sid: any;
  mode: string;
  isRO: boolean;
  producto?: string;
  sublinea?: string;
  clienteId?: string;
  noCredito?: string;
}

const fmt = (n: number) =>
  `$${(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Cierre ya ejecutado, para la bitácora local del subtab. */
interface CierreRegistrado {
  id: number;
  folio: string;
  fechaInicio: string;
  fechaFin: string;
  fechaVencimiento: string;
  cargos: number;
  total: number;
  minimo: number;
  fechaProceso: string;
}

export function CierreCorteTab({ sid, mode, isRO, producto = '', sublinea = '', clienteId = '', noCredito = '' }: Props) {
  const { productos } = useProductosLineaCreditoDB(true);

  const productoSel = useMemo(
    () => productos.find(p =>
      String(p.nombre).toLowerCase() === String(producto).toLowerCase() ||
      String(p.clave).toLowerCase() === String(producto).toLowerCase() ||
      String(p.id) === String(producto)),
    [productos, producto],
  );

  const esTDC = esTarjetaCredito(sublinea, producto, productoSel?.nombre, (productoSel as any)?.subTipo);

  // ── Configuración (§Decisión 2): instancia sobre producto ──
  const config: ConfigCorte = useMemo(() => {
    const reglas: any = (productoSel as any)?.reglasPagoCorteTDC || {};
    const cond: any =
      loadFromSession<any>(sid, 'condicionesTarjeta') ??
      loadFromSavedStore<any>(sid, 'condicionesTarjeta') ??
      {};
    const num = (v: any) => { const n = parseFloat(String(v ?? '').replace(/[,%$\s]/g, '')); return isNaN(n) ? 0 : n; };
    return {
      diaCorte: num(cond.diaCorte) || num(reglas.diaCorte),
      diasParaPago: num(cond.diasParaPago) || num(reglas.diasFechaLimitePago),
      ajusteDiaInhabil: reglas.ajusteDiaInhabil || '',
      pagoMinimoMetodo: cond.pagoMinimoMetodo || reglas.pagoMinimoMetodo || '',
      pagoMinimoPorcentaje: num(cond.pagoMinimoPorcentaje) || num(reglas.pagoMinimoPorcentajeBase),
      pagoMinimoMonto: num(cond.pagoMinimoMonto) || num(reglas.pagoMinimoMontoAbsoluto),
      pagoMinimoAgregarSaldoVencido: !!reglas.pagoMinimoAgregarSaldoVencido,
      pagoMinimoConceptos: Array.isArray(reglas.pagoMinimoConceptos) ? reglas.pagoMinimoConceptos : [],
    };
  }, [productoSel, sid]);

  // ── Prelación (§Decisión 3): la de TDC primero, la del producto como respaldo ──
  const prelacion: RenglonPrelacion[] = useMemo(() => {
    const reglas: any = (productoSel as any)?.reglasPagoCorteTDC || {};
    const ordenTDC = Array.isArray(reglas.ordenAplicacionPagos) ? reglas.ordenAplicacionPagos : [];
    const prod = Array.isArray((productoSel as any)?.prelacionCargos) ? (productoSel as any).prelacionCargos : [];

    // Las DOS fuentes se FUSIONAN; antes la de TDC, cuando existía, hacía que
    // la otra se ignorara por completo. Y no son equivalentes: la de TDC suele
    // listar los conceptos genéricos (IVA, Comisiones, CAPITAL) mientras que
    // "Prelación de cargos" del producto tiene además los específicos
    // ("IVA de la Comisión (16%)", "Compra"). Con el corte anterior, cortar
    // fallaba con "concepto no configurado" señalando algo que el usuario SÍ
    // tenía capturado — sólo que en la tabla que no se estaba leyendo.
    const porConcepto = new Map<string, RenglonPrelacion>();

    // 1. Base: el catálogo completo del producto.
    for (const p of prod) {
      const concepto = String(p?.productosCargos ?? '').trim();
      if (!concepto) continue;
      porConcepto.set(concepto.toLowerCase(), {
        orden: parseInt(String(p.ordenAplicacion), 10) || 0,
        concepto,
      });
    }

    // 2. Encima: el orden de TDC, que es la configuración específica de este
    //    tipo de producto y por eso gana sobre la genérica.
    for (const o of ordenTDC) {
      const concepto = String(o?.concepto ?? '').trim();
      if (!concepto) continue;
      porConcepto.set(concepto.toLowerCase(), { orden: Number(o.seq) || 0, concepto });
    }

    return [...porConcepto.values()];
  }, [productoSel]);

  /**
   * Cargos de la línea leídos del store de sesión.
   * Es el respaldo: la fuente real es J_CARGOS_LINEA (ver `cargosBD`), donde la
   * ESPECIFICACIÓN 2 los deja. El store sólo sirve para ver el periodo cuando
   * la base no responde — y en ese caso el cierre no se puede persistir.
   */
  const cargosSesion: CargoLinea[] = useMemo(() => {
    const raw =
      loadFromSession<any[]>(sid, 'cargosLinea') ??
      loadFromSavedStore<any[]>(sid, 'cargosLinea') ??
      [];
    return (raw || []).map((c: any) => ({
      id: c.id,
      clave: c.clave || '',
      nombre: c.nombre || c.concepto || '',
      naturaleza: c.naturaleza === 'Abono' ? 'Abono' : 'Cargo',
      monto: Number(c.monto) || 0,
      fecha: c.fecha || '',
      bFactura: c.bFactura === 'S' ? 'S' : 'N',
      bCargo: c.bCargo ?? 'S',
      estatus: c.estatus || 'Pendiente',
      movimientoId: c.movimientoId,
      cxcId: c.cxcId ?? null,
    }));
  }, [sid]);

  // ── Fuente real: J_CARGOS_LINEA ──
  const [cargosBD, setCargosBD] = useState<CargoLinea[] | null>(null);
  const [errorCargos, setErrorCargos] = useState<string>('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!sid || !esTDC) return;
    let vivo = true;
    setCargando(true);
    cargarCargosLinea(String(sid)).then(res => {
      if (!vivo) return;
      setCargando(false);
      if (res.desdeBD) { setCargosBD(res.cargos); setErrorCargos(''); }
      else { setCargosBD(null); setErrorCargos(res.error || ''); }
    });
    return () => { vivo = false; };
  }, [sid, esTDC]);

  /** Los de la base cuando hay; si no, los de sesión sólo para ver. */
  const cargos: CargoLinea[] = cargosBD ?? cargosSesion;
  const puedePersistir = cargosBD !== null;

  // ── Periodo propuesto (CA-08/CA-09) ──
  const propuesto = useMemo(
    () => (config.diaCorte > 0 ? calcularPeriodoCorte(config.diaCorte) : { fechaInicio: '', fechaFin: '' }),
    [config.diaCorte],
  );
  const [fechaInicio, setFechaInicio] = useState(propuesto.fechaInicio);
  const [fechaFin, setFechaFin] = useState(propuesto.fechaFin);
  useEffect(() => {
    setFechaInicio(propuesto.fechaInicio);
    setFechaFin(propuesto.fechaFin);
  }, [propuesto.fechaInicio, propuesto.fechaFin]);

  const [cierres, setCierres] = useState<CierreRegistrado[]>(
    () => loadFromSession<CierreRegistrado[]>(sid, 'cierresCorte')
      || (mode !== 'nuevo' ? loadFromSavedStore<CierreRegistrado[]>(sid, 'cierresCorte') : null)
      || [],
  );
  useEffect(() => { if (!isRO) saveToSession(sid, 'cierresCorte', cierres); }, [cierres, sid, isRO]);

  const linea = {
    idLineaCredito: String(sid),
    idCliente: clienteId,
    idSolicitud: noCredito || String(sid),
    idProducto: String((productoSel as any)?.dbUuid || productoSel?.id || producto || ''),
    claveProducto: productoSel?.clave,
    nombreCliente: '',
    moneda: 'MXN',
  };

  /** Simulación: el motor sin persistir, para ver el documento antes de emitirlo. */
  const vistaPrevia: ResultadoCierre | null = useMemo(() => {
    if (!fechaInicio || !fechaFin) return null;
    return ejecutarCierreCorte({ linea, config, cargos, prelacion, fechaInicio, fechaFin });
  }, [fechaInicio, fechaFin, cargos, prelacion, config, linea.idProducto]); // eslint-disable-line react-hooks/exhaustive-deps

  const [procesando, setProcesando] = useState(false);

  const ejecutar = async () => {
    if (isRO) { toast.warning('Modo solo lectura'); return; }
    if (procesando) return;

    const r = ejecutarCierreCorte({ linea, config, cargos, prelacion, fechaInicio, fechaFin });

    if (!r.ok) {
      toast.error('No se pudo generar el Cierre de Corte', { description: r.error, duration: 10000 });
      return;
    }

    // Idempotencia aplicativa (CA-41): un periodo, un cierre. La defensa real
    // es el índice único del RPC; esto sólo evita el viaje.
    if (cierres.some(c => c.fechaInicio === r.periodo.fechaInicio && c.fechaFin === r.periodo.fechaFin)) {
      toast.error('Este periodo ya tiene un cierre generado', {
        description: `Periodo ${r.periodo.fechaInicio} a ${r.periodo.fechaFin}.`,
      });
      return;
    }

    // §36/§37/§38 — CxC + Detalle + cambio de estatus, una sola transacción.
    // Sin los cargos de la base no hay nada que persistir: los ids del store de
    // sesión no existen en J_CARGOS_LINEA.
    if (!puedePersistir) {
      toast.error('No se puede generar el cierre sin conexión a los cargos', {
        description: errorCargos || 'No se pudieron leer los cargos de la línea desde la base de datos.',
        duration: 12000,
      });
      return;
    }

    setProcesando(true);
    const res = await aplicarCierreCorteTDC({
      resultado: r,
      idLineaCredito: String(sid),
      idCliente: clienteId || undefined,
      idSolicitud: String(sid),
      idProducto: linea.idProducto,
    });
    setProcesando(false);

    if (!res.ok) {
      // §37 — rollback completo: los cargos siguen en Pendiente.
      toast.error('No se generó el Cierre de Corte', { description: res.error, duration: 12000 });
      return;
    }

    const folio = res.folio || `CXC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(cierres.length + 1).padStart(5, '0')}`;

    // ── §66/§83 — ESPECIFICACIÓN 5: contabilizar el corte ──
    // §19: la fecha contable es la FechaDocumento, que §17 fijó = FechaFin.
    // Los componentes salen del Detalle de la CxC (§20), no de los movimientos.
    if (res.cxcId) {
      const contab = await contabilizarCorte({
        ctx: {
          guia: (productoSel as any)?.motorContable,
          productoId: String((productoSel as any)?.dbUuid || productoSel?.id || ''),
          claveProducto: productoSel?.clave,
          nombreProducto: productoSel?.nombre,
          clienteId, lineaId: String(sid),
          correlationId: `corte|${res.cxcId}`,
        },
        idCxC: res.cxcId,
        detalle: r.detalle.map(d => ({
          id: String(d.idCargo),
          claveConcepto: d.claveConcepto,
          nombreConcepto: d.nombreConcepto,
          monto: d.monto,
        })),
        montoTotalPagar: r.montoTotalPagar,
        fechaDocumento: r.fechaDocumento,
      });

      if (!contab.ok) {
        // §83 — la CxC quedó válida pero SIN póliza. No se oculta: se dice,
        // y como la contabilización es idempotente se puede reintentar.
        toast.error('El corte se generó pero NO quedó contabilizado', {
          description: (contab.error || '') + ' La CxC existe; vuelva a generar el cierre para contabilizarla.',
          duration: 15000,
        });
      } else if (contab.persistido && !contab.yaEstaba) {
        toast.success(`Póliza contable ${contab.numeroPoliza} generada`, {
          description: `Debe ${contab.poliza.totalDebe.toFixed(2)} = Haber ${contab.poliza.totalHaber.toFixed(2)} · ${contab.poliza.partidas.length} partidas.`,
          duration: 8000,
        });
      }
    }

    // Refrescar desde la base: los cargos ya quedaron en Procesado allá.
    cargarCargosLinea(String(sid)).then(x => { if (x.desdeBD) setCargosBD(x.cargos); });

    setCierres(prev => [...prev, {
      id: generateId(),
      folio,
      fechaInicio: r.periodo.fechaInicio,
      fechaFin: r.periodo.fechaFin,
      fechaVencimiento: r.fechaVencimiento,
      cargos: r.cantidadCargos,
      total: r.montoTotalPagar,
      minimo: r.montoMinimoPagar,
      fechaProceso: new Date().toLocaleString('es-MX'),
    }]);

    // §30/§31 — el cambio Pendiente → Procesado lo hizo el RPC dentro de la
    // misma transacción, después de crear la CxC y su Detalle. Aquí sólo se
    // refleja en el store de sesión para que la vista no quede desfasada.
    const procesados = new Set(r.cargosProcesados.map(String));
    const actualizados = (loadFromSession<any[]>(sid, 'cargosLinea') || []).map((c: any) =>
      procesados.has(String(c.id)) ? { ...c, estatus: 'Procesado', cxcId: res.cxcId || folio } : c);
    saveToSession(sid, 'cargosLinea', actualizados);

    r.advertencias.forEach(a => toast.warning(a));
    toast.success('Cierre procesado correctamente', {
      description:
        `CxC ${folio} · ${r.cantidadCargos} cargo(s) · Total ${fmt(r.montoTotalPagar)} · ` +
        `Mínimo ${fmt(r.montoMinimoPagar)} · Vence ${r.fechaVencimiento}`,
      duration: 9000,
    });
  };

  const inp = 'px-2 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-primary-theme';
  const th = 'px-2 py-2 text-xs text-gray-700 text-left border-r border-gray-300';
  const td = 'px-2 py-1.5 text-xs border-r border-gray-200 text-gray-700';

  if (!esTDC) {
    return (
      <div className="border border-gray-300 bg-white p-6 text-center text-xs text-gray-500">
        El Cierre de Corte aplica sólo a productos de <b>Tarjeta de Crédito</b>.
        Esta línea usa <b>{producto || 'un producto sin identificar'}</b>.
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-1.5">
          <span className="text-xs text-gray-800">CIERRE DE CORTE</span>
        </div>
        {!isRO && !cargando && !puedePersistir && (
          <span className="text-xs text-red-700 mr-3">
            Sin cargos de la base — el cierre no se puede generar
          </span>
        )}
        {!isRO && (
          <button
            onClick={ejecutar}
            disabled={!vistaPrevia?.ok || procesando || cargando}
            className="px-4 py-1.5 btn-secondary-theme rounded text-xs disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            {procesando ? 'Procesando…' : cargando ? 'Cargando cargos…' : 'Generar Cierre de Corte'}
          </button>
        )}
      </div>

      {/* Periodo */}
      <div className="border border-gray-300 bg-white p-3 mb-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Día de corte</label>
            <div className="px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded text-gray-700">
              {config.diaCorte || '— sin configurar —'}
            </div>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Fecha Inicio</label>
            <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} disabled={isRO} className={`${inp} w-full`} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Fecha Fin (corte)</label>
            <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} disabled={isRO} className={`${inp} w-full`} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-gray-500 mb-1">Días para pago</label>
            <div className="px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded text-gray-700">
              {config.diasParaPago || '— sin configurar —'}
            </div>
          </div>
        </div>
        {config.diaCorte === 0 && (
          <p className="text-[11px] text-amber-700 mt-2">
            El producto no tiene <b>Día de corte</b> configurado en <i>Reglas de Pago y Corte TDC</i>;
            el periodo no se puede proponer solo.
          </p>
        )}
      </div>

      {/* Vista previa del documento */}
      {vistaPrevia && !vistaPrevia.ok && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 text-xs text-amber-800 mb-3">
          <b>{vistaPrevia.pasoFallido}</b> — {vistaPrevia.error}
        </div>
      )}

      {vistaPrevia?.ok && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-gray-300 border border-gray-300 mb-3">
            {[
              ['Cargos', String(vistaPrevia.cantidadCargos)],
              ['Fecha documento', vistaPrevia.fechaDocumento],
              ['Fecha límite de pago', vistaPrevia.fechaVencimiento],
              ['Monto total a pagar', fmt(vistaPrevia.montoTotalPagar)],
              ['Monto mínimo a pagar', fmt(vistaPrevia.montoMinimoPagar)],
            ].map(([k, v]) => (
              <div key={k} className="bg-white px-3 py-2">
                <div className="text-[10px] uppercase tracking-wide text-gray-500">{k}</div>
                <div className="text-xs font-mono text-gray-800">{v}</div>
              </div>
            ))}
          </div>

          <div className="border border-gray-300 bg-white overflow-x-auto mb-4">
            <table className="w-full border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className={th}>Orden</th>
                  <th className={th}>Clave</th>
                  <th className={th}>Concepto</th>
                  <th className={th}>Fecha</th>
                  <th className={th}>Naturaleza</th>
                  <th className="px-2 py-2 text-xs text-gray-700 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {vistaPrevia.detalle.map((d, i) => (
                  <tr key={String(d.idCargo)} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-[#F9F9F9]'}`}>
                    <td className={`${td} font-mono text-center`}>{d.ordenPrelacion}</td>
                    <td className={`${td} font-mono`}>{d.claveConcepto}</td>
                    <td className={td}>{d.nombreConcepto}</td>
                    <td className={`${td} font-mono`}>{d.fechaCargo}</td>
                    <td className={td}>{d.naturaleza}</td>
                    <td className="px-2 py-1.5 text-xs text-right font-mono text-gray-700">{fmt(d.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-gray-500 italic mb-4">
            El orden proviene de la Prelación configurada en el producto y se conserva en el detalle
            de la CxC: es el que usará la aplicación de pagos.
          </p>
        </>
      )}

      {/* Bitácora */}
      <div className="bg-primary-tint-theme border-l-4 border-primary-theme px-3 py-1.5 mb-2">
        <span className="text-xs text-gray-800">CIERRES GENERADOS</span>
      </div>
      <div className="border border-gray-300 bg-white overflow-x-auto">
        <table className="w-full border-collapse min-w-[820px]">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300">
              <th className={th}>Folio CxC</th>
              <th className={th}>Periodo</th>
              <th className={th}>Fecha límite</th>
              <th className={th}>Cargos</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Total</th>
              <th className="px-2 py-2 text-xs text-gray-700 text-right border-r border-gray-300">Mínimo</th>
              <th className={th}>Procesado</th>
            </tr>
          </thead>
          <tbody>
            {cierres.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-xs text-gray-400">Sin cierres generados</td></tr>
            ) : cierres.map(c => (
              <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className={`${td} font-mono`}>{c.folio}</td>
                <td className={`${td} font-mono`}>{c.fechaInicio} → {c.fechaFin}</td>
                <td className={`${td} font-mono`}>{c.fechaVencimiento}</td>
                <td className={`${td} text-center`}>{c.cargos}</td>
                <td className={`${td} text-right font-mono`}>{fmt(c.total)}</td>
                <td className={`${td} text-right font-mono`}>{fmt(c.minimo)}</td>
                <td className={td}>{c.fechaProceso}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
