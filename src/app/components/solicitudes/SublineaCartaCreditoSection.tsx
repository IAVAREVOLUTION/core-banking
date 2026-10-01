/**
 * SublineaCartaCreditoSection.tsx — Términos y Condiciones de una SubLínea de
 * Carta de Crédito NAFIN (MD SubLíneas 05) + resolución Automática (MD 06).
 *
 *   Bloque A — Línea Global (consulta, leída de la línea padre en BD)
 *   Bloque B — Carta de Crédito (captura)
 *   Bloque C — Garantía NAFIN (captura + Monto Garantizado calculado)
 *
 * Se pinta dentro del subtab Términos y Condiciones, arriba del formulario
 * genérico, sólo cuando el producto de la Solicitud es una SubLínea. Las reglas
 * se evalúan en vivo con el mismo motor que usará la activación, para que el
 * analista vea qué falla antes de intentarlo.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { loadFromSession, loadFromSavedStore, saveToSession, formatCurrency } from './solicitudCreditoStore';
import { dmyAIso } from '../../lib/fechasPlazo';
import { useProductosLineaCreditoDB } from '../../hooks/useProductosLineaCreditoDB';
import {
  parametrosSubLinea, modalidadDe, MODALIDAD_AUTOMATICA, ESTADO_ACTIVA, CARTA_COMERCIAL, CARTA_STANDBY, num,
} from '../../lib/sublineasCartaCredito';
import {
  SUBTAB_SUBLINEA, normalizarSublinea, fetchLineaDeSublinea, lineaEnCache, validarActivacion, activarSublinea,
  rechazarSublinea, faltantesCarta, montoGarantizadoEstimado,
  type SublineaCartaData, type LineaPadre, type ResultadoActivacion,
} from '../banca-2o-piso/sublineasStore';

export function leerSublinea(solicitudId: string | number): SublineaCartaData {
  return normalizarSublinea(
    loadFromSession<any>(solicitudId, SUBTAB_SUBLINEA) ?? loadFromSavedStore<any>(solicitudId, SUBTAB_SUBLINEA),
  );
}

export function leerPartes(solicitudId: string | number): any[] {
  return loadFromSession<any[]>(solicitudId, 'partesRelacionadas') ?? loadFromSavedStore<any[]>(solicitudId, 'partesRelacionadas') ?? [];
}

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: string | number;
  productoId?: string;
  noSol?: string;
  /** MD 04 — Monto Solicitado = monto total de la Carta. */
  montoCarta: number;
  /** El formulario aplica el resultado (estatus, cargos) y guarda. */
  onActivacion?: (r: ResultadoActivacion) => void;
  /** Catálogo ya cargado por el formulario — evita volver a pedirlo al reabrir. */
  productosCatalogo?: any[];
  /**
   * Vigencia del encabezado (dd/mm/aaaa). La Fecha Fin se calcula con Plazo ×
   * Frecuencia de Términos; las fechas de la Carta son esas mismas, no otra captura.
   */
  fechaInicioHeader?: string;
  fechaFinHeader?: string;
}

export function SublineaCartaCreditoSection({ mode, solicitudId, productoId, noSol, montoCarta, onActivacion, fechaInicioHeader, fechaFinHeader, productosCatalogo }: Props) {
  const isRO = mode === 'ver';
  // Con catálogo del formulario no se consulta de nuevo (era la demora al reabrir).
  const usarPropio = !(productosCatalogo && productosCatalogo.length > 0);
  const { productos: productosPropios } = useProductosLineaCreditoDB(usarPropio);
  const productos = usarPropio ? productosPropios : productosCatalogo!;
  const productoHijo = useMemo(
    () => productos.find(p => String(p.dbUuid) === String(productoId) || String(p.id) === String(productoId)),
    [productos, productoId],
  );
  const params = useMemo(() => (productoHijo ? parametrosSubLinea(productoHijo) : null), [productoHijo]);
  const esAutomatica = productoHijo ? modalidadDe(productoHijo) === MODALIDAD_AUTOMATICA : false;

  const [carta, setCarta] = useState<SublineaCartaData>(() => leerSublinea(solicitudId));
  // Se pinta al instante con la última lectura y se refresca en segundo plano.
  const [linea, setLinea] = useState<LineaPadre | null>(() => lineaEnCache(String(solicitudId)));
  const [errorLinea, setErrorLinea] = useState('');
  const [procesando, setProcesando] = useState(false);
  const yaSembrado = useRef(false);

  const productoLinea = useMemo(
    () => productos.find(p => String(p.dbUuid) === String(linea?.productoLineaId) || String(p.id) === String(linea?.productoLineaId)),
    [productos, linea],
  );

  // Bloque A — la línea se lee de BD: su disponible pudo cambiar en otra sesión.
  const recargarLinea = async () => {
    if (!solicitudId || solicitudId === 'new') { setErrorLinea('Guarde la Solicitud para consultar la Línea Global.'); return; }
    const r = await fetchLineaDeSublinea(String(solicitudId));
    if (r.ok && r.linea) { setLinea(r.linea); setErrorLinea(''); } else setErrorLinea(r.error || '');
  };
  useEffect(() => { recargarLinea(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [solicitudId]);

  // Defaults del producto (cobertura/comisión default) y de la carta — sólo
  // rellenan vacíos y una sola vez.
  useEffect(() => {
    if (isRO || yaSembrado.current || !params) return;
    yaSembrado.current = true;
    setCarta(prev => ({
      ...prev,
      porcentajeCobertura: prev.porcentajeCobertura || (params.coberturaDefault ? String(params.coberturaDefault) : ''),
      porcentajeComision: prev.porcentajeComision || (params.comisionDefault ? String(params.comisionDefault) : ''),
      montoElegible: prev.montoElegible || (montoCarta > 0 ? String(montoCarta) : ''),
      tipoCarta: prev.tipoCarta || (params.tiposCartaPermitidos.length === 1 ? params.tiposCartaPermitidos[0] : ''),
    }));
  }, [params, isRO, montoCarta]);

  useEffect(() => {
    if (!isRO) saveToSession(solicitudId, SUBTAB_SUBLINEA, carta);
  }, [carta, solicitudId, isRO]);

  // Fechas de la Carta = vigencia del encabezado (Inicio, e Inicio + Plazo × Frecuencia).
  const fechasDelEncabezado = !!(fechaInicioHeader && fechaFinHeader);
  useEffect(() => {
    if (isRO || carta.estatus === ESTADO_ACTIVA) return;
    const ini = dmyAIso(fechaInicioHeader || '');
    const fin = dmyAIso(fechaFinHeader || '');
    if ((ini && ini !== carta.fechaInicio) || (fin && fin !== carta.fechaVencimiento)) {
      setCarta(prev => ({ ...prev, fechaInicio: ini || prev.fechaInicio, fechaVencimiento: fin || prev.fechaVencimiento }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaInicioHeader, fechaFinHeader, isRO]);

  const activa = carta.estatus === ESTADO_ACTIVA;
  const bloqueado = isRO || activa;
  const set = (campo: keyof SublineaCartaData, valor: string) => {
    if (bloqueado) return;
    setCarta(prev => ({ ...prev, [campo]: valor }));
  };

  const lg = linea?.lineaGlobal || null;
  const estimado = montoGarantizadoEstimado(carta, productoHijo, lg?.montoDisponible);
  const validacion = useMemo(() => {
    if (!productoHijo || !linea) return null;
    return validarActivacion({ productoHijo, productoLinea, linea, carta, montoCarta, partes: leerPartes(solicitudId) });
    // Las partes se releen al validar: viven en otro subtab.
  }, [productoHijo, productoLinea, linea, carta, montoCarta, solicitudId]);
  const faltan = faltantesCarta(carta, montoCarta);

  const handleActivar = async () => {
    if (!productoHijo) { toast.error('No se encontró el producto de la SubLínea'); return; }
    if (faltan.length > 0) { toast.error('Faltan datos de la Carta', { description: faltan.join(' · ') }); return; }
    setProcesando(true);
    try {
      const r = await activarSublinea({
        sublineaId: String(solicitudId), noSol: noSol || '', productoHijo, productos,
        carta, montoCarta, partes: leerPartes(solicitudId),
      });
      if (r.ok && !r.elegible && r.validacion) {
        // MD 06 — se rechaza y se muestra el detalle. No pasa a Selectiva (CA-08).
        const rech = await rechazarSublinea(String(solicitudId), carta, r.validacion);
        setCarta(rech.datos);
        toast.error(`SubLínea ${rech.datos.estatus}`, {
          description: r.validacion.incumplidas.map(x => x.etiqueta).join(' · '),
          duration: 12000,
        });
      } else if (r.ok && r.yaActiva) {
        toast.info('La SubLínea ya estaba activa', { description: 'No se volvió a consumir el disponible.' });
      } else if (r.ok && r.datos) {
        setCarta(r.datos);
        toast.success('SubLínea ACTIVA', {
          description: `Contingente ${formatCurrency(r.datos.montoGarantizado || 0)} · Disponible de la Línea Global ${formatCurrency(r.disponibleNuevo || 0)}.`,
          duration: 10000,
        });
      } else {
        toast.error('No se activó la SubLínea', { description: r.error, duration: 12000 });
      }
      onActivacion?.(r);
      await recargarLinea();
    } finally {
      setProcesando(false);
    }
  };

  const ro = 'w-full px-2 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded text-gray-600';
  const inp = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5]/30';
  const cls = bloqueado ? ro : inp;
  const Campo = ({ label, valor }: { label: string; valor: string }) => (
    <div>
      <label className="block text-xs text-gray-700 mb-1">{label}</label>
      <input type="text" value={valor} disabled className={ro} />
    </div>
  );
  const money = (v: unknown) => (num(v) ? formatCurrency(num(v)) : '—');
  const titulo = (t: string) => (
    <div className="bg-teal-50 border-y border-teal-200 px-3 py-1.5">
      <span className="text-[11px] font-medium text-teal-800 uppercase">{t}</span>
    </div>
  );

  return (
    <div className="mb-4 border border-teal-200 rounded overflow-hidden">
      <div className="bg-teal-100 px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-teal-900 uppercase">
          SubLínea Carta de Crédito — {productoHijo ? (esAutomatica ? 'Automática' : 'Selectiva') : '…'}
        </span>
        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-white border border-teal-300 text-teal-800">
          {carta.estatus || 'BORRADOR'}
        </span>
      </div>

      {titulo('Bloque A — Línea Global (consulta)')}
      {errorLinea ? (
        <p className="px-3 py-2 text-[11px] text-amber-700">{errorLinea}</p>
      ) : (
        <div className="grid grid-cols-4 gap-x-4 gap-y-3 p-3">
          <Campo label="No. Línea Global" valor={lg?.noLinea || linea?.noLinea || '—'} />
          <Campo label="Intermediario Financiero" valor={lg?.intermediario || '—'} />
          <Campo label="Producto Línea Global" valor={lg?.producto || productoLinea?.nombre || '—'} />
          <Campo label="Estatus" valor={lg?.estatus || 'Sin liberar'} />
          <Campo label="Monto Autorizado" valor={money(lg?.montoAutorizado)} />
          <Campo label="Monto Disponible" valor={money(lg?.montoDisponible)} />
          <Campo label="Fecha Inicio" valor={lg?.fechaInicio || '—'} />
          <Campo label="Fecha Vencimiento" valor={lg?.fechaVencimiento || '—'} />
        </div>
      )}

      {titulo('Bloque B — Carta de Crédito')}
      <div className="grid grid-cols-3 gap-x-4 gap-y-3 p-3">
        <div>
          <label className="block text-xs text-gray-700 mb-1">Tipo Carta <span className="text-red-500">*</span></label>
          <select value={carta.tipoCarta} disabled={bloqueado} onChange={e => set('tipoCarta', e.target.value)} className={cls}>
            <option value="">— Seleccionar —</option>
            {(params?.tiposCartaPermitidos?.length ? params.tiposCartaPermitidos : [CARTA_COMERCIAL, CARTA_STANDBY])
              .map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">No. Carta / Referencia</label>
          <input type="text" value={carta.noCarta} disabled={bloqueado} onChange={e => set('noCarta', e.target.value)}
            placeholder={esAutomatica ? '' : 'Provisional hasta Instrumentación'} className={cls} />
        </div>
        <Campo label="Monto Carta (= Monto Solicitado)" valor={money(montoCarta)} />
        <div>
          <label className="block text-xs text-gray-700 mb-1">Moneda <span className="text-red-500">*</span></label>
          <select value={carta.moneda} disabled={bloqueado} onChange={e => set('moneda', e.target.value)} className={cls}>
            {(params?.monedasPermitidas?.length ? params.monedasPermitidas : ['MXN', 'USD', 'EUR'])
              .map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Fecha Inicio <span className="text-red-500">*</span></label>
          <input type="date" value={carta.fechaInicio} disabled={bloqueado || fechasDelEncabezado} onChange={e => set('fechaInicio', e.target.value)} className={fechasDelEncabezado ? ro : cls} />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Fecha Vencimiento <span className="text-red-500">*</span></label>
          <input type="date" value={carta.fechaVencimiento} disabled={bloqueado || fechasDelEncabezado} onChange={e => set('fechaVencimiento', e.target.value)} className={fechasDelEncabezado ? ro : cls} />
          {fechasDelEncabezado && <span className="text-[10px] text-gray-500">Fecha Inicio + Plazo × días de la Frecuencia (encabezado y Términos).</span>}
        </div>
        <div className="col-span-3">
          <label className="block text-xs text-gray-700 mb-1">Objeto / Descripción</label>
          <textarea rows={2} value={carta.objeto} disabled={bloqueado} onChange={e => set('objeto', e.target.value)} className={`${cls} resize-y`} />
        </div>
      </div>

      {titulo('Bloque C — Garantía NAFIN')}
      <div className="grid grid-cols-3 gap-x-4 gap-y-3 p-3">
        <div>
          <label className="block text-xs text-gray-700 mb-1">Monto Elegible <span className="text-red-500">*</span></label>
          <input type="text" inputMode="decimal" value={carta.montoElegible} disabled={bloqueado}
            onChange={e => set('montoElegible', e.target.value.replace(/[^0-9.,]/g, ''))} className={`${cls} text-right font-mono`} />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            % Cobertura <span className="text-red-500">*</span>
            {params && params.coberturaMaxima > 0 && <span className="text-gray-400"> ({params.coberturaMinima}–{params.coberturaMaxima}%)</span>}
          </label>
          <input type="text" inputMode="decimal" value={carta.porcentajeCobertura} disabled={bloqueado}
            onChange={e => set('porcentajeCobertura', e.target.value.replace(/[^0-9.]/g, ''))} className={`${cls} text-right font-mono`} />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">% Comisión</label>
          <input type="text" inputMode="decimal" value={carta.porcentajeComision} disabled={bloqueado}
            onChange={e => set('porcentajeComision', e.target.value.replace(/[^0-9.]/g, ''))} className={`${cls} text-right font-mono`} />
        </div>
        <Campo label="Monto Garantizado"
          valor={activa ? money(carta.montoGarantizado) : money(estimado.montoGarantizado)} />
        <Campo label="Monto Contingente" valor={activa ? money(carta.montoContingente) : '— (al activar)'} />
        <Campo label="Modalidad (del producto)" valor={productoHijo ? (esAutomatica ? 'Automática' : 'Selectiva') : '—'} />
        {!activa && estimado.tope !== 'cobertura' && (
          <p className="col-span-3 text-[11px] text-amber-700">
            {estimado.tope === 'maximo-sublinea'
              ? 'El Monto Garantizado quedó topado por el Monto Máximo de SubLínea del producto.'
              : 'El Monto Garantizado quedó topado por el Disponible de la Línea Global.'}
          </p>
        )}
        <p className="col-span-3 text-[10px] text-gray-500">
          Monto Garantizado = MIN(Monto Elegible × % Cobertura, Monto Máximo SubLínea, Disponible Línea Global).
          La Línea Global se consume por este monto al activar, no por el Monto de la Carta.
        </p>
      </div>

      {/* MD 06 §Resultado de validación — cumplidas e incumplidas */}
      {titulo('Validaciones')}
      <div className="p-3">
        {!validacion ? (
          <p className="text-[11px] text-gray-500">Se evaluarán cuando cargue el producto y la Línea Global.</p>
        ) : (
          <ul className="space-y-1">
            {validacion.reglas.map((r, i) => (
              <li key={`${r.clave}-${i}`} className={`text-[11px] ${r.cumple ? 'text-green-700' : 'text-red-700'}`}>
                {r.cumple ? '✓' : '✗'} {r.etiqueta}{!r.cumple && r.detalle ? ` — ${r.detalle}` : ''}
              </li>
            ))}
          </ul>
        )}
        {carta.validacion && !carta.validacion.elegible && (
          <p className="mt-2 text-[11px] text-red-700 font-medium">
            Rechazada el {carta.validacion.fecha.slice(0, 10)}: {carta.validacion.incumplidas.map(x => x.etiqueta).join(' · ')}
          </p>
        )}

        {!isRO && !activa && esAutomatica && (
          <div className="mt-3 flex items-center justify-end gap-3">
            <span className="text-[11px] text-gray-500">Automática: se resuelve por reglas, sin fases.</span>
            <button onClick={handleActivar} disabled={procesando}
              className="px-4 py-1.5 text-xs font-medium text-white rounded bg-primary-theme hover:opacity-90 disabled:opacity-50">
              {procesando ? 'Validando…' : 'Validar y Activar'}
            </button>
          </div>
        )}
        {!activa && !esAutomatica && productoHijo && (
          <p className="mt-3 text-[11px] text-gray-500">
            Selectiva: se activa al autorizar la Fase 5 (Activación); ahí se vuelven a evaluar estas reglas con el disponible vigente.
          </p>
        )}
      </div>
    </div>
  );
}
