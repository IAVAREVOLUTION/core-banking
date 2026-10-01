/**
 * SublineaSelectivaTabs.tsx — Originación F2-F4 de una SubLínea de Carta de
 * Crédito SELECTIVA (MD SubLíneas 07).
 *
 *   F2 Evaluación       → acreditado final, operación, exposición, dictamen
 *   F3 Aprobación       → Votación (se reutiliza tal cual) + Resolución mínima
 *   F4 Instrumentación  → datos definitivos de la Carta → LISTA PARA ACTIVACIÓN
 *   F5 Activación       → ActivarSublinea() con los valores AUTORIZADOS (no reevalúa crédito)
 *
 * Igual que la Línea Global (MD 10 §7), el formulario conserva sus subtabs y
 * sólo cambia el contenido. Los datos viven en su propio nodo
 * (`sublinea_originacion`) para no competir con el de Términos.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { loadFromSession, loadFromSavedStore, saveToSession, formatCurrency, parseCurrency } from './solicitudCreditoStore';
import { leerSublinea } from './SublineaCartaCreditoSection';
import { calcularMontoGarantizado } from '../../lib/sublineasCartaCredito';

export const SUBTAB_SUBLINEA_ORIGINACION = 'sublineaOriginacion';

export interface OriginacionSublinea {
  evaluacion: {
    exposicionAcreditado: string;
    nivelRiesgo: string;
    montoRecomendado: string;
    coberturaRecomendada: string;
    dictamen: string;
    observaciones: string;
  };
  resolucion: {
    montoCartaAutorizado: string;
    coberturaAutorizada: string;
    vigencia: string;
    condiciones: string;
    resultado: string;
  };
  instrumentacion: {
    noCarta: string;
    fechaEmision: string;      // yyyy-mm-dd
    fechaVencimiento: string;  // yyyy-mm-dd
    monto: string;
    beneficiario: string;
  };
}

const VACIO: OriginacionSublinea = {
  evaluacion: { exposicionAcreditado: '', nivelRiesgo: '', montoRecomendado: '', coberturaRecomendada: '', dictamen: '', observaciones: '' },
  resolucion: { montoCartaAutorizado: '', coberturaAutorizada: '', vigencia: '', condiciones: '', resultado: '' },
  instrumentacion: { noCarta: '', fechaEmision: '', fechaVencimiento: '', monto: '', beneficiario: '' },
};

export function normalizarOriginacionSublinea(raw: any): OriginacionSublinea {
  const r = raw || {};
  return {
    evaluacion: { ...VACIO.evaluacion, ...(r.evaluacion || {}) },
    resolucion: { ...VACIO.resolucion, ...(r.resolucion || {}) },
    instrumentacion: { ...VACIO.instrumentacion, ...(r.instrumentacion || {}) },
  };
}

export function leerOriginacionSublinea(id: string | number): OriginacionSublinea {
  return normalizarOriginacionSublinea(
    loadFromSession<any>(id, SUBTAB_SUBLINEA_ORIGINACION) ?? loadFromSavedStore<any>(id, SUBTAB_SUBLINEA_ORIGINACION),
  );
}

export const hayOriginacionSublinea = (o: OriginacionSublinea | null | undefined) =>
  !!o && [o.evaluacion, o.resolucion, o.instrumentacion].some(b => Object.values(b).some(v => String(v ?? '').trim()));

const num = (v: unknown) => parseFloat(parseCurrency(String(v ?? '0'))) || 0;
const money = (v: unknown) => (num(v) ? formatCurrency(num(v)) : '—');

// ═══════════════════════════════════════════════════════════════════
// Validaciones por fase (CA-10) — las usa el avance sin montar los subtabs
// ═══════════════════════════════════════════════════════════════════

export function faltantesEvaluacionSublinea(o: OriginacionSublinea): string[] {
  const e = o.evaluacion; const f: string[] = [];
  if (!e.nivelRiesgo) f.push('Nivel de Riesgo');
  if (!e.dictamen) f.push('Dictamen');
  else if (e.dictamen === 'No Favorable') f.push('El Dictamen es No Favorable: la SubLínea no puede continuar');
  if (e.dictamen !== 'No Favorable') {
    if (!(num(e.montoRecomendado) > 0)) f.push('Monto Recomendado');
    if (!(num(e.coberturaRecomendada) > 0)) f.push('Cobertura Recomendada');
  }
  return f;
}

export function faltantesResolucionSublinea(o: OriginacionSublinea, montoCarta: number): string[] {
  const r = o.resolucion; const f: string[] = [];
  if (!r.resultado) f.push('Resultado');
  else if (r.resultado === 'Rechazada') f.push('La Resolución es Rechazada: la SubLínea no puede continuar');
  if (r.resultado !== 'Rechazada') {
    if (!(num(r.montoCartaAutorizado) > 0)) f.push('Monto Carta Autorizado');
    else if (montoCarta > 0 && num(r.montoCartaAutorizado) > montoCarta + 0.005) f.push('Monto Carta Autorizado mayor al Monto de la Carta');
    if (!(num(r.coberturaAutorizada) > 0)) f.push('Cobertura Autorizada');
    if (!r.vigencia) f.push('Vigencia');
  }
  if (r.resultado === 'Autorizada con Condiciones' && !r.condiciones.trim()) f.push('Condiciones');
  return f;
}

export function faltantesInstrumentacionSublinea(o: OriginacionSublinea): string[] {
  const x = o.instrumentacion; const f: string[] = [];
  if (!x.noCarta.trim()) f.push('No. Carta definitivo');
  if (!x.fechaEmision) f.push('Fecha de Emisión');
  if (!x.fechaVencimiento) f.push('Fecha de Vencimiento');
  else if (x.fechaEmision && x.fechaVencimiento <= x.fechaEmision) f.push('Vencimiento posterior a la Emisión');
  if (!(num(x.monto) > 0)) f.push('Monto');
  if (!x.beneficiario.trim()) f.push('Beneficiario');
  return f;
}

/**
 * MD 07 §Fase 5 — la activación usa lo AUTORIZADO e INSTRUMENTADO, no lo
 * solicitado: monto de carta, cobertura, número y fechas definitivas. Devuelve
 * la carta y el monto con los que debe llamarse a ActivarSublinea().
 */
export function cartaParaActivacion(carta: any, o: OriginacionSublinea, montoCartaSolicitado: number) {
  const r = o.resolucion, x = o.instrumentacion;
  const montoCarta = num(x.monto) || num(r.montoCartaAutorizado) || montoCartaSolicitado;
  return {
    montoCarta,
    carta: {
      ...carta,
      noCarta: x.noCarta || carta.noCarta,
      fechaInicio: x.fechaEmision || carta.fechaInicio,
      fechaVencimiento: x.fechaVencimiento || carta.fechaVencimiento,
      porcentajeCobertura: r.coberturaAutorizada || carta.porcentajeCobertura,
      // El elegible no puede exceder la carta autorizada.
      montoElegible: String(Math.min(num(carta.montoElegible) || montoCarta, montoCarta)),
    },
  };
}

// ═══════════════════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════════════════

const ro = 'w-full px-2 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded text-gray-600';
const inp = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5]/30';

function useOriginacion(id: string | number, isRO: boolean, propia: keyof OriginacionSublinea) {
  const [o, setO] = useState<OriginacionSublinea>(() => leerOriginacionSublinea(id));
  const tuvo = useRef(false);
  if (hayOriginacionSublinea(o)) tuvo.current = true;
  useEffect(() => {
    if (isRO || !tuvo.current) return;
    // Sólo la parte propia: los tres subtabs pueden estar montados a la vez.
    const actual = leerOriginacionSublinea(id);
    saveToSession(id, SUBTAB_SUBLINEA_ORIGINACION, { ...actual, [propia]: o[propia] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o, id, isRO]);
  const set = (campo: string, valor: string) => {
    if (isRO) return;
    setO(prev => ({ ...prev, [propia]: { ...(prev[propia] as any), [campo]: valor } }));
  };
  return { o, set };
}

function Titulo({ t }: { t: string }) {
  return <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">{t}</div>;
}
function Faltan({ l, isRO }: { l: string[]; isRO: boolean }) {
  if (isRO || l.length === 0) return null;
  return <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-700">Falta para avanzar de fase: <span className="font-medium">{l.join(' · ')}</span></div>;
}
function Campo({ l, v }: { l: string; v: string }) {
  return <div><label className="block text-xs text-gray-700 mb-1">{l}</label><input type="text" value={v} disabled className={ro} /></div>;
}

interface Props { mode: 'nuevo' | 'editar' | 'ver'; solicitudId: string | number; montoCarta: number }

/** F2 — Evaluación (MD 07). Datos de la carta en consulta + dictamen. */
export function EvaluacionSublineaTab({ mode, solicitudId, montoCarta }: Props) {
  const isRO = mode === 'ver';
  const { o, set } = useOriginacion(solicitudId, isRO, 'evaluacion');
  const carta = useMemo(() => leerSublinea(solicitudId), [solicitudId]);
  const e = o.evaluacion;
  const garantizadoSolicitado = calcularMontoGarantizado({
    montoElegible: carta.montoElegible, porcentajeCobertura: carta.porcentajeCobertura, disponibleLineaGlobal: Number.MAX_SAFE_INTEGER,
  }).montoGarantizado;
  const garantizadoRecomendado = calcularMontoGarantizado({
    montoElegible: Math.min(num(carta.montoElegible) || num(e.montoRecomendado), num(e.montoRecomendado) || Infinity),
    porcentajeCobertura: e.coberturaRecomendada, disponibleLineaGlobal: Number.MAX_SAFE_INTEGER,
  }).montoGarantizado;
  const sel = (campo: string, l: string, ops: string[]) => (
    <div>
      <label className="block text-xs text-gray-700 mb-1">{l} <span className="text-red-500">*</span></label>
      <select value={(e as any)[campo]} disabled={isRO} onChange={ev => set(campo, ev.target.value)} className={isRO ? ro : inp}>
        <option value="">— Seleccionar —</option>{ops.map(x => <option key={x} value={x}>{x}</option>)}
      </select>
    </div>
  );
  const txt = (campo: string, l: string, req = false) => (
    <div>
      <label className="block text-xs text-gray-700 mb-1">{l} {req && <span className="text-red-500">*</span>}</label>
      <input type="text" inputMode="decimal" value={(e as any)[campo]} disabled={isRO}
        onChange={ev => set(campo, ev.target.value.replace(/[^0-9.,]/g, ''))} className={`${isRO ? ro : inp} text-right font-mono`} />
    </div>
  );
  return (
    <div className="border border-gray-200 bg-white p-5">
      <Faltan l={faltantesEvaluacionSublinea(o)} isRO={isRO} />
      <Titulo t="DATOS DE LA OPERACIÓN (de Términos y Condiciones)" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 mb-5">
        <Campo l="Monto Carta" v={money(montoCarta)} />
        <Campo l="Monto Elegible" v={money(carta.montoElegible)} />
        <Campo l="Cobertura Solicitada" v={carta.porcentajeCobertura ? `${carta.porcentajeCobertura}%` : '—'} />
        <Campo l="Monto Garantizado Solicitado" v={money(garantizadoSolicitado)} />
        {txt('exposicionAcreditado', 'Exposición actual Acreditado')}
        {sel('nivelRiesgo', 'Nivel de Riesgo', ['Bajo', 'Medio', 'Alto'])}
      </div>
      <Titulo t="RESULTADO" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
        <Campo l="Monto Solicitado" v={money(montoCarta)} />
        {txt('montoRecomendado', 'Monto Recomendado', e.dictamen !== 'No Favorable')}
        {txt('coberturaRecomendada', 'Cobertura Recomendada (%)', e.dictamen !== 'No Favorable')}
        <Campo l="Monto Garantizado Recomendado" v={money(garantizadoRecomendado)} />
        {sel('dictamen', 'Dictamen', ['Favorable', 'Favorable con Condiciones', 'No Favorable'])}
        <div className="md:col-span-3">
          <label className="block text-xs text-gray-700 mb-1">Observaciones</label>
          <textarea rows={2} value={e.observaciones} disabled={isRO} onChange={ev => set('observaciones', ev.target.value)} className={`${isRO ? ro : inp} resize-y`} />
        </div>
      </div>
    </div>
  );
}

/** F3 — Resolución mínima (MD 07). La Votación se reutiliza en su propio subtab. */
export function ResolucionSublineaTab({ mode, solicitudId, montoCarta }: Props) {
  const isRO = mode === 'ver';
  const { o, set } = useOriginacion(solicitudId, isRO, 'resolucion');
  const r = o.resolucion;
  // Siembra: lo recomendado en F2. Sólo rellena vacíos.
  useEffect(() => {
    if (isRO) return;
    if (!r.montoCartaAutorizado && o.evaluacion.montoRecomendado) set('montoCartaAutorizado', o.evaluacion.montoRecomendado);
    if (!r.coberturaAutorizada && o.evaluacion.coberturaRecomendada) set('coberturaAutorizada', o.evaluacion.coberturaRecomendada);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const garantizado = calcularMontoGarantizado({
    montoElegible: r.montoCartaAutorizado, porcentajeCobertura: r.coberturaAutorizada, disponibleLineaGlobal: Number.MAX_SAFE_INTEGER,
  }).montoGarantizado;
  return (
    <div className="border border-gray-200 bg-white p-5">
      <Faltan l={faltantesResolucionSublinea(o, montoCarta)} isRO={isRO} />
      <Titulo t="RESOLUCIÓN DE LA SUBLÍNEA" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
        <div>
          <label className="block text-xs text-gray-700 mb-1">Monto Carta Autorizado <span className="text-red-500">*</span></label>
          <input type="text" inputMode="decimal" value={r.montoCartaAutorizado} disabled={isRO}
            onChange={e => set('montoCartaAutorizado', e.target.value.replace(/[^0-9.,]/g, ''))} className={`${isRO ? ro : inp} text-right font-mono`} />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Cobertura Autorizada (%) <span className="text-red-500">*</span></label>
          <input type="text" inputMode="decimal" value={r.coberturaAutorizada} disabled={isRO}
            onChange={e => set('coberturaAutorizada', e.target.value.replace(/[^0-9.]/g, ''))} className={`${isRO ? ro : inp} text-right font-mono`} />
        </div>
        <Campo l="Monto Garantizado (estimado)" v={money(garantizado)} />
        <div>
          <label className="block text-xs text-gray-700 mb-1">Vigencia <span className="text-red-500">*</span></label>
          <input type="text" value={r.vigencia} disabled={isRO} placeholder="Ej. 180 días"
            onChange={e => set('vigencia', e.target.value)} className={isRO ? ro : inp} />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Resultado <span className="text-red-500">*</span></label>
          <select value={r.resultado} disabled={isRO} onChange={e => set('resultado', e.target.value)} className={isRO ? ro : inp}>
            <option value="">— Seleccionar —</option>
            {['Autorizada', 'Autorizada con Condiciones', 'Rechazada'].map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
        <div />
        <div className="md:col-span-3">
          <label className="block text-xs text-gray-700 mb-1">Condiciones</label>
          <textarea rows={2} value={r.condiciones} disabled={isRO} onChange={e => set('condiciones', e.target.value)} className={`${isRO ? ro : inp} resize-y`} />
        </div>
      </div>
      <p className="mt-2 text-[10px] text-gray-500">El Monto Garantizado definitivo se recalcula al activar, con el Disponible vigente de la Línea Global.</p>
    </div>
  );
}

/** F4 — Instrumentación: datos definitivos (MD 07). */
export function InstrumentacionSublineaTab({ mode, solicitudId }: Props) {
  const isRO = mode === 'ver';
  const { o, set } = useOriginacion(solicitudId, isRO, 'instrumentacion');
  const x = o.instrumentacion;
  // Siembra: número/fechas provisionales de Términos y monto autorizado de F3.
  useEffect(() => {
    if (isRO) return;
    const c = leerSublinea(solicitudId);
    if (!x.noCarta && c.noCarta) set('noCarta', c.noCarta);
    if (!x.fechaEmision && c.fechaInicio) set('fechaEmision', c.fechaInicio);
    if (!x.fechaVencimiento && c.fechaVencimiento) set('fechaVencimiento', c.fechaVencimiento);
    if (!x.monto && o.resolucion.montoCartaAutorizado) set('monto', o.resolucion.montoCartaAutorizado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const faltan = faltantesInstrumentacionSublinea(o);
  const t = (campo: string, l: string, tipo = 'text') => (
    <div>
      <label className="block text-xs text-gray-700 mb-1">{l} <span className="text-red-500">*</span></label>
      <input type={tipo} value={(x as any)[campo]} disabled={isRO} onChange={e => set(campo, e.target.value)} className={isRO ? ro : inp} />
    </div>
  );
  return (
    <div className="border border-gray-200 bg-white p-5">
      <Faltan l={faltan} isRO={isRO} />
      <Titulo t="DATOS DEFINITIVOS DE LA CARTA" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 mb-4">
        {t('noCarta', 'No. Carta')}
        {t('fechaEmision', 'Fecha Emisión', 'date')}
        {t('fechaVencimiento', 'Fecha Vencimiento', 'date')}
        {t('monto', 'Monto')}
        {t('beneficiario', 'Beneficiario')}
      </div>
      <div className={`px-3 py-2 rounded border text-xs font-medium ${faltan.length === 0 ? 'bg-green-50 border-green-300 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
        Resultado: {faltan.length === 0 ? 'LISTA PARA ACTIVACIÓN' : 'PENDIENTE DE INSTRUMENTAR'}
      </div>
    </div>
  );
}
