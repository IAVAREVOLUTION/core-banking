/**
 * LineaGlobalNafinTabs.tsx — Originación de la Línea Global de Garantías NAFIN.
 *
 * MD NAFIN 04-09. La Solicitud NAFIN recorre el MISMO motor de fases que la
 * Garantía Financiera 2o Piso BANOBRAS (MD 10 §3); lo que cambia es qué se
 * captura en cada pantalla. Siguiendo MD 10 §7 ("Componente Base +
 * Configuración por Producto"), el formulario conserva los mismos subtabs
 * (mismo id, misma posición) y sólo cambia su contenido cuando la Solicitud es
 * de Línea Global:
 *
 *   estructura2oPiso   → Estructura Operativa de la Línea Global   (Fase 1)
 *   modeloViabilidad   → Evaluación Financiera y de Riesgo         (Fase 2)
 *   votacionCPC        → Votación (se reutiliza + resumen NAFIN)   (Fase 3)
 *   resolucionCIC      → Resolución Final de la Línea Global       (Fase 3)
 *   validacionClausulas→ Validación de Formalización               (Fase 4)
 *
 * Los datos NAFIN viven en su propio nodo (`lineaGlobalNafin`) para no mezclar
 * su forma con los nodos BANOBRAS: una Solicitud BANOBRAS no cambia (MD 10 §2).
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  loadFromSession, loadFromSavedStore, saveToSession, formatCurrency, parseCurrency,
} from './solicitudCreditoStore';
import { esLineaGlobalCartaCredito, esSubLineaCartaCredito } from '../../lib/sublineasCartaCredito';
import { DatePicker } from '@/app/components/ui/DatePicker';
import { fetchIntermediarioDeCliente } from '../../lib/intermediarioNafin';
import {
  calcularDictamen, resolverParametrosEvaluacion, type ParametrosEvaluacionIF,
} from '../../lib/evaluacionIntermediario';
import type { DatosActaComiteCPC } from '../../hooks/generarDocumentosFase4';

// ═══════════════════════════════════════════════════════════════════
// Identificación (MD 10 §1)
// ═══════════════════════════════════════════════════════════════════

/**
 * El producto en la Solicitud llega como JSON crudo de J_PRODUCTOS: `destino`
 * vive en `default` o en `datosProducto[0]`, no en la raíz. Se aplana a la
 * forma que espera `esLineaGlobalCartaCredito` (la de Taller de Producto).
 */
function aplanarProductoRaw(raw: any): any {
  if (!raw) return null;
  const dp = Array.isArray(raw.datosProducto) && raw.datosProducto.length > 0 ? raw.datosProducto[0] : raw;
  const def = raw.default || dp?.default || {};
  return {
    ...raw,
    destino: def.destino || dp?.destino || raw.destino,
    tipoOperacion: def.tipoOperacion || dp?.tipoOperacion || raw.tipoOperacion,
    modalidadResolucion: def.modalidadResolucion || dp?.modalidadResolucion || raw.modalidadResolucion,
    paquetes: raw.paquetes,
  };
}

/**
 * ¿La Solicitud es de Línea Global NAFIN? Única fuente de verdad para el
 * formulario y sus subtabs. Si el producto aún no carga, basta con que la
 * Solicitud traiga los datos NAFIN heredados de la Oportunidad.
 */
/** MD SubLíneas 12 §2 — ¿la Solicitud es una SubLínea de Carta de Crédito (producto hijo)? */
export function esSolicitudSublinea(productoRaw: any): boolean {
  return esSubLineaCartaCredito(aplanarProductoRaw(productoRaw));
}

export function esSolicitudLineaGlobalNafin(productoRaw: any, terminos: any): boolean {
  if (esLineaGlobalCartaCredito(aplanarProductoRaw(productoRaw))) return true;
  const t = terminos || {};
  return !!(t.programa || t.modalidadLinea || t.numeroIntermediarioNafin);
}

/**
 * MD NAFIN 03 — el Intermediario se obtiene del maestro Persona/Cliente. Los
 * Términos traen la copia heredada de la Oportunidad; si el cliente está
 * clasificado como Intermediario Financiero, sus datos actuales mandan (p. ej.
 * un estatus que pasó a Suspendido después del Cierre Comercial).
 */
export async function terminosConIntermediarioMaestro(terminos: any, clienteId?: string): Promise<any> {
  const maestro = clienteId ? await fetchIntermediarioDeCliente(clienteId) : null;
  if (!maestro) return terminos || {};
  const vivos = Object.fromEntries(Object.entries(maestro).filter(([, v]) => String(v || '').trim()));
  return { ...(terminos || {}), ...vivos };
}

// ═══════════════════════════════════════════════════════════════════
// Modelo de datos
// ═══════════════════════════════════════════════════════════════════

/** Clave del subtab en sessionStorage y de `allSubtabs`. */
export const SUBTAB_LINEA_GLOBAL_NAFIN = 'lineaGlobalNafin';

export interface EvaluacionNafin {
  capitalContable: string;
  carteraTotal: string;
  carteraVencida: string;
  capitalizacion: string;
  liquidez: string;
  coberturaReservas: string;
  roe: string;
  exposicionNafin: string;
  calificacion: string;
  nivelRiesgo: string;
  montoRecomendado: string;
  dictamen: string;
  observaciones: string;
  condiciones: string;
  /** 'true' cuando el analista ajustó el dictamen calculado. */
  ajusteManual?: string;
}

/** Campos que propone el cálculo (MD 06) — editarlos los marca como ajuste manual. */
const CAMPOS_DICTAMEN: (keyof EvaluacionNafin)[] = ['calificacion', 'nivelRiesgo', 'dictamen', 'montoRecomendado', 'condiciones', 'observaciones'];

export interface ResolucionNafin {
  numeroActa: string;
  fechaSesion: string;
  montoAutorizado: string;
  fechaInicio: string;
  fechaVencimiento: string;
  resolucion: string;
  condiciones: string;
}

export interface FormalizacionNafin {
  numeroContrato: string;
  fechaFirma: string;
  representanteIF: string;
  representanteNafin: string;
}

export interface LineaGlobalNafinData {
  notasEstructura: string;
  evaluacion: EvaluacionNafin;
  resolucion: ResolucionNafin;
  formalizacion: FormalizacionNafin;
}

const EMPTY_EVALUACION: EvaluacionNafin = {
  capitalContable: '', carteraTotal: '', carteraVencida: '', capitalizacion: '', liquidez: '',
  coberturaReservas: '', roe: '', exposicionNafin: '', calificacion: '', nivelRiesgo: '',
  montoRecomendado: '', dictamen: '', observaciones: '', condiciones: '',
};
const EMPTY_RESOLUCION: ResolucionNafin = {
  numeroActa: '', fechaSesion: '', montoAutorizado: '', fechaInicio: '', fechaVencimiento: '',
  resolucion: '', condiciones: '',
};
const EMPTY_FORMALIZACION: FormalizacionNafin = {
  numeroContrato: '', fechaFirma: '', representanteIF: '', representanteNafin: '',
};
export const EMPTY_LINEA_GLOBAL_NAFIN: LineaGlobalNafinData = {
  notasEstructura: '',
  evaluacion: EMPTY_EVALUACION,
  resolucion: EMPTY_RESOLUCION,
  formalizacion: EMPTY_FORMALIZACION,
};

export const DICTAMEN_FAVORABLE = 'Favorable';
export const DICTAMEN_CONDICIONADO = 'Favorable con Condiciones';
export const DICTAMEN_NO_FAVORABLE = 'No Favorable';
export const RESOLUCION_AUTORIZADA = 'Autorizada';
export const RESOLUCION_CONDICIONADA = 'Autorizada con Condiciones';
export const RESOLUCION_RECHAZADA = 'Rechazada';

/** Normaliza lo guardado (sesión o BD) a la forma completa. */
export function normalizarLineaGlobalNafin(raw: any): LineaGlobalNafinData {
  const r = raw || {};
  return {
    notasEstructura: r.notasEstructura || '',
    evaluacion: { ...EMPTY_EVALUACION, ...(r.evaluacion || {}) },
    resolucion: { ...EMPTY_RESOLUCION, ...(r.resolucion || {}) },
    formalizacion: { ...EMPTY_FORMALIZACION, ...(r.formalizacion || {}) },
  };
}

export function leerLineaGlobalNafin(solicitudId: string | number): LineaGlobalNafinData {
  return normalizarLineaGlobalNafin(
    loadFromSession<any>(solicitudId, SUBTAB_LINEA_GLOBAL_NAFIN) ??
    loadFromSavedStore<any>(solicitudId, SUBTAB_LINEA_GLOBAL_NAFIN),
  );
}

/** ¿Tiene algo capturado? Un nodo vacío no debe viajar ni pisar la BD. */
export function hayDatosLineaGlobalNafin(d: LineaGlobalNafinData | undefined | null): boolean {
  if (!d) return false;
  const alguno = (o: Record<string, any>) => Object.values(o).some(v => String(v ?? '').trim());
  return !!String(d.notasEstructura || '').trim()
    || alguno(d.evaluacion || {}) || alguno(d.resolucion || {}) || alguno(d.formalizacion || {});
}

function leerTerminos(solicitudId: string | number): any {
  return loadFromSession<any>(solicitudId, 'terminos') ?? loadFromSavedStore<any>(solicitudId, 'terminos') ?? {};
}

const num = (v: unknown) => parseFloat(parseCurrency(String(v ?? '0'))) || 0;
const money = (v: unknown) => (num(v) ? formatCurrency(num(v)) : '—');
const txt = (v: unknown) => (String(v ?? '').trim() || '—');
const si = (b: unknown) => (b === true || b === 'true' ? 'Sí' : 'No');
const revolvente = (t: any) => (t.tipoLineaGlobal ? (t.tipoLineaGlobal === 'Revolvente' ? 'Sí' : 'No') : '—');

/** dd/mm/aaaa + N años → dd/mm/aaaa. '' si la fecha no es válida. */
export function sumarAnios(fechaDMY: string, anios: number): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(fechaDMY || '').trim());
  if (!m || !(anios > 0)) return '';
  const d = new Date(Number(m[3]) + anios, Number(m[2]) - 1, Number(m[1]));
  // 29/02 + N años sin bisiesto: JS lo lleva a 01/03; se queda en fin de febrero.
  if (d.getMonth() !== Number(m[2]) - 1) d.setDate(0);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** dd/mm/aaaa → número comparable (aaaammdd); 0 si no es válida. */
function fechaComparable(fechaDMY: string): number {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(fechaDMY || '').trim());
  return m ? Number(`${m[3]}${m[2]}${m[1]}`) : 0;
}

// ═══════════════════════════════════════════════════════════════════
// Validaciones por fase — las usa el avance de fase sin montar los subtabs
// ═══════════════════════════════════════════════════════════════════

/** Fase 1 — Términos + Estructura Operativa de la Línea Global (MD 05). */
export function faltantesFase1Nafin(terminos: any): string[] {
  const t = terminos || {};
  const f: string[] = [];
  if (!(num(t.montoEmisionProyectado || t.montoSolicitado) > 0)) f.push('Monto Solicitado');
  if (!t.moneda) f.push('Moneda');
  if (!t.fechaInicioLinea) f.push('Fecha Inicio');
  if (!t.fechaVencimientoLinea) f.push('Fecha Vencimiento');
  else if (fechaComparable(t.fechaVencimientoLinea) <= fechaComparable(t.fechaInicioLinea)) {
    f.push('Fecha Vencimiento posterior a la Fecha Inicio');
  }
  if (!t.programa) f.push('Programa');
  if (!t.modalidadLinea) f.push('Modalidad');
  if (!t.tipoLineaGlobal) f.push('Tipo de Línea (Revolvente / No Revolvente)');
  if (!(num(t.porcentajeCoberturaGpo) > 0)) f.push('Cobertura Máxima %');
  if (!(num(t.montoMaximoSublinea) > 0)) f.push('Monto Máximo por SubLínea');
  if (!t.permiteCartaComercial && !t.permiteCartaStandby) f.push('Operaciones permitidas (al menos un tipo de Carta)');
  // MD 01 — la regla de vigencia se revalida aquí: el estatus pudo cambiar
  // entre el Cierre Comercial y la integración del expediente.
  if (t.estatusIntermediarioNafin && t.estatusIntermediarioNafin !== 'Vigente') {
    f.push('El Intermediario Financiero no se encuentra vigente en NAFIN');
  } else if (!t.numeroIntermediarioNafin) {
    f.push('No. Intermediario NAFIN');
  }
  return f;
}

/** Fase 2 — Evaluación Financiera y de Riesgo (MD 06). */
export function faltantesFase2Nafin(d: LineaGlobalNafinData): string[] {
  const e = d.evaluacion;
  const f: string[] = [];
  if (!(num(e.capitalContable) > 0)) f.push('Capital Contable');
  if (!(num(e.carteraTotal) > 0)) f.push('Cartera Total');
  if (String(e.carteraVencida ?? '').trim() === '') f.push('Cartera Vencida');
  if (!e.calificacion) f.push('Calificación');
  if (!e.nivelRiesgo) f.push('Nivel de Riesgo');
  if (!(num(e.montoRecomendado) > 0) && e.dictamen !== DICTAMEN_NO_FAVORABLE) f.push('Monto Recomendado');
  if (!e.dictamen) f.push('Dictamen');
  else if (e.dictamen === DICTAMEN_NO_FAVORABLE) f.push('El Dictamen es No Favorable: la Línea Global no puede continuar');
  else if (e.dictamen === DICTAMEN_CONDICIONADO && !e.condiciones.trim()) f.push('Condiciones / Mitigantes');
  return f;
}

/** Fase 3 — Resolución Final (MD 07). La votación se valida aparte (motor actual). */
export function faltantesFase3Nafin(d: LineaGlobalNafinData, terminos: any): string[] {
  const r = d.resolucion;
  const f: string[] = [];
  const autorizado = num(r.montoAutorizado);
  const solicitado = num((terminos || {}).montoEmisionProyectado || (terminos || {}).montoSolicitado);
  if (!r.resolucion) f.push('Resolución');
  else if (r.resolucion === RESOLUCION_RECHAZADA) f.push('La Resolución es Rechazada: la Línea Global no puede continuar');
  if (r.resolucion !== RESOLUCION_RECHAZADA) {
    if (!(autorizado > 0)) f.push('Monto Autorizado');
    else if (solicitado > 0 && autorizado > solicitado) f.push('Monto Autorizado mayor al Monto Solicitado');
  }
  if (r.resolucion === RESOLUCION_CONDICIONADA && !r.condiciones.trim()) f.push('Condiciones');
  if (!r.fechaInicio) f.push('Fecha Inicio');
  if (!r.fechaVencimiento) f.push('Fecha Vencimiento');
  else if (fechaComparable(r.fechaVencimiento) <= fechaComparable(r.fechaInicio)) {
    f.push('Fecha Vencimiento posterior a la Fecha Inicio');
  }
  return f;
}

/** Fase 4 — Validación de Formalización (MD 08). El checklist es el Expediente. */
export function faltantesFase4Nafin(d: LineaGlobalNafinData): string[] {
  const x = d.formalizacion;
  const f: string[] = [];
  if (!x.numeroContrato.trim()) f.push('No. Contrato / Convenio');
  if (!x.fechaFirma) f.push('Fecha de Firma');
  if (!x.representanteIF.trim()) f.push('Representante IF');
  if (!x.representanteNafin.trim()) f.push('Representante NAFIN');
  return f;
}

/**
 * ¿De qué fase NAFIN se está saliendo? Por NOMBRE, igual que el resto de las
 * compuertas 2o Piso: el faseId de estos productos no es correlativo. Los
 * nombres son los del MD (Promoción e Integración, Evaluación, Aprobación,
 * Instrumentación); si el administrador los nombra distinto, la compuerta no
 * dispara — el mismo comportamiento que ya tienen las compuertas BANOBRAS.
 */
export function faseNafinDe(nombreFase: string): 1 | 2 | 3 | 4 | null {
  const n = String(nombreFase || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (n.includes('instrumentacion') || n.includes('formalizacion')) return 4;
  // El producto de la BD nombra la Fase 3 "Autorización", no "Aprobación".
  if (n.includes('aprobacion') || n.includes('autorizacion') || n.includes('comite')) return 3;
  if (n.includes('evaluacion')) return 2;
  if (n.includes('integracion') || n.includes('promocion')) return 1;
  return null;
}

/** ¿El nombre de fase es la Liberación / Activación de la línea? */
export function esFaseLiberacionNafin(nombreFase: string): boolean {
  const n = String(nombreFase || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return n.includes('liberacion') || n.includes('activacion');
}

/**
 * MD 09 — nodo de la Línea Global operativa que se escribe al liberar.
 * `MontoDisponible = MontoAutorizado`; todo lo demás arranca en cero. Las
 * SubLíneas (fuera de alcance aquí) consumirán el disponible al activarse.
 */
export interface LineaGlobalOperativa {
  noLinea: string;
  producto: string;
  intermediario: string;
  numeroIntermediarioNafin: string;
  montoAutorizado: number;
  montoUtilizado: number;
  montoContingente: number;
  montoDisponible: number;
  montoReclamado: number;
  montoPagado: number;
  moneda: string;
  modalidad: string;
  revolvente: boolean;
  coberturaMaxima: number;
  montoMaximoSublinea: number;
  fechaInicio: string;
  fechaVencimiento: string;
  estatus: 'ACTIVA';
  fechaLiberacion: string;
}

export function construirLineaGlobalOperativa(params: {
  noSol: string;
  producto: string;
  intermediario: string;
  terminos: any;
  nafin: LineaGlobalNafinData;
}): LineaGlobalOperativa {
  const t = params.terminos || {};
  const r = params.nafin.resolucion;
  const autorizado = num(r.montoAutorizado);
  return {
    noLinea: params.noSol,
    producto: params.producto,
    intermediario: params.intermediario,
    numeroIntermediarioNafin: t.numeroIntermediarioNafin || '',
    montoAutorizado: autorizado,
    montoUtilizado: 0,
    montoContingente: 0,
    montoDisponible: autorizado,
    montoReclamado: 0,
    montoPagado: 0,
    moneda: t.moneda || 'MXN',
    modalidad: t.modalidadLinea || '',
    revolvente: t.tipoLineaGlobal === 'Revolvente',
    coberturaMaxima: num(t.porcentajeCoberturaGpo),
    montoMaximoSublinea: num(t.montoMaximoSublinea),
    fechaInicio: r.fechaInicio || t.fechaInicioLinea || '',
    fechaVencimiento: r.fechaVencimiento || t.fechaVencimientoLinea || '',
    estatus: 'ACTIVA',
    fechaLiberacion: new Date().toISOString(),
  };
}

// ═══════════════════════════════════════════════════════════════════
// UI compartida
// ═══════════════════════════════════════════════════════════════════

const roClass = 'w-full px-2 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded text-gray-600';
const inputClass = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]';

function Titulo({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
      {children}
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-teal-50 border border-teal-200 rounded px-3 py-2 mb-4">
      <p className="text-xs text-teal-800">{children}</p>
    </div>
  );
}

function Faltantes({ lista, isRO }: { lista: string[]; isRO: boolean }) {
  if (isRO || lista.length === 0) return null;
  return (
    <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-700">
      Falta para avanzar de fase: <span className="font-medium">{lista.join(' · ')}</span>
    </div>
  );
}

function Campo({ label, valor, mono }: { label: string; valor: string; mono?: boolean }) {
  return (
    <div>
      <label className="block text-xs text-gray-700 mb-1">{label}</label>
      <input type="text" value={valor} disabled className={`${roClass} ${mono ? 'text-right font-mono' : ''}`} />
    </div>
  );
}

/**
 * Estado del nodo NAFIN compartido por los subtabs. Mismo blindaje que
 * Estructura Operativa: no se escribe en sesión hasta que el montaje tuvo
 * datos, para que un objeto vacío inicial no pise lo guardado.
 */
function useLineaGlobalNafin(
  solicitudId: string | number,
  isRO: boolean,
  /** Parte del nodo que ESTE subtab captura; las demás sólo se leen. */
  propia: keyof LineaGlobalNafinData,
  onChange?: (d: LineaGlobalNafinData) => void,
) {
  const [datos, setDatos] = useState<LineaGlobalNafinData>(() => leerLineaGlobalNafin(solicitudId));
  const huboDatosRef = useRef(false);
  if (hayDatosLineaGlobalNafin(datos)) huboDatosRef.current = true;

  useEffect(() => {
    if (isRO || !huboDatosRef.current) return;
    // Sólo se escribe la parte propia sobre lo que haya en sesión: varios
    // subtabs NAFIN pueden estar montados a la vez y cada uno trae una copia
    // del nodo de cuando se montó.
    const actual = leerLineaGlobalNafin(solicitudId);
    const nuevo = { ...actual, [propia]: datos[propia] };
    saveToSession(solicitudId, SUBTAB_LINEA_GLOBAL_NAFIN, nuevo);
    onChange?.(nuevo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, solicitudId, isRO]);

  return [datos, setDatos] as const;
}

interface BaseProps {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: string | number;
  intermediario?: string;
  onChange?: (d: LineaGlobalNafinData) => void;
}

// ═══════════════════════════════════════════════════════════════════
// Fase 1 — Estructura Operativa de la Línea Global (MD 05 §2)
// ═══════════════════════════════════════════════════════════════════

export function EstructuraLineaGlobalNafinTab({ mode, solicitudId, intermediario, clienteId, onChange }: BaseProps & { clienteId?: string }) {
  const isRO = mode === 'ver';
  const [datos, setDatos] = useLineaGlobalNafin(solicitudId, isRO, 'notasEstructura', onChange);
  const terminosHeredados = useMemo(() => leerTerminos(solicitudId), [solicitudId]);
  // MD 03 — el Bloque A se consulta del maestro Persona/Cliente.
  const [t, setT] = useState<any>(terminosHeredados);
  const [delMaestro, setDelMaestro] = useState(false);
  useEffect(() => {
    let vivo = true;
    terminosConIntermediarioMaestro(terminosHeredados, clienteId).then(r => {
      if (!vivo) return;
      setT(r);
      setDelMaestro(r !== terminosHeredados);
    });
    return () => { vivo = false; };
  }, [terminosHeredados, clienteId]);
  const faltan = faltantesFase1Nafin(t);

  return (
    <div className="border border-gray-200 bg-white p-5">
      <Aviso>
        <strong>Promoción e Integración</strong> — la estructura de la Línea Global se hereda de la
        Oportunidad y de Términos y Condiciones. Para corregir un dato, edítelo en su origen; aquí
        es de consulta.
      </Aviso>
      <Faltantes lista={faltan} isRO={isRO} />

      <Titulo>BLOQUE A — INTERMEDIARIO{delMaestro ? ' (maestro Persona/Cliente)' : ''}</Titulo>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 mb-5">
        <Campo label="Intermediario Financiero" valor={txt(intermediario)} />
        <Campo label="No. Intermediario NAFIN" valor={txt(t.numeroIntermediarioNafin)} />
        <Campo label="Tipo de Intermediario" valor={txt(t.tipoIntermediario)} />
        <Campo label="Estatus NAFIN" valor={txt(t.estatusIntermediarioNafin)} />
        <Campo label="Programa" valor={txt(t.programa)} />
        <Campo label="Modalidad" valor={txt(t.modalidadLinea)} />
      </div>

      <Titulo>BLOQUE B — ESTRUCTURA DE LÍNEA</Titulo>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 mb-5">
        <Campo label="Monto Solicitado" valor={money(t.montoEmisionProyectado || t.montoSolicitado)} mono />
        <Campo label="Monto Máximo por SubLínea" valor={money(t.montoMaximoSublinea)} mono />
        <Campo label="Cobertura Máxima" valor={t.porcentajeCoberturaGpo ? `${t.porcentajeCoberturaGpo}%` : '—'} mono />
        <Campo label="Revolvente" valor={revolvente(t)} />
        {/* MD 05 — regla inicial: PermiteSobregiro = NO. */}
        <Campo label="Sobregiro" valor="No" />
        <Campo label="Vigencia" valor={`${txt(t.fechaInicioLinea)} → ${txt(t.fechaVencimientoLinea)}`} />
      </div>

      <Titulo>BLOQUE C — OPERACIONES PERMITIDAS</Titulo>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 mb-5">
        <Campo label="Carta de Crédito Comercial" valor={si(t.permiteCartaComercial)} />
        <Campo label="Carta de Crédito Standby" valor={si(t.permiteCartaStandby)} />
      </div>

      <div>
        <label className="block text-xs text-gray-700 mb-1">Notas</label>
        <textarea
          rows={3}
          value={datos.notasEstructura}
          onChange={e => setDatos(prev => ({ ...prev, notasEstructura: e.target.value }))}
          disabled={isRO}
          placeholder="Observaciones sobre la estructura de la Línea Global..."
          className={`${isRO ? roClass : inputClass} resize-y`}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Fase 2 — Evaluación Financiera y de Riesgo (MD 06)
// ═══════════════════════════════════════════════════════════════════

export function EvaluacionRiesgoNafinTab({ mode, solicitudId, intermediario, onChange, parametrosProducto, onGenerarActa }: BaseProps & {
  /** `parametrosEvaluacionIF` del producto (Taller), si existe (MD 06). */
  parametrosProducto?: Partial<ParametrosEvaluacionIF> | null;
  /** Genera el Acta de Sesión del Comité CPC y la adjunta al Expediente. */
  onGenerarActa?: (acta: DatosActaComiteCPC) => Promise<boolean>;
}) {
  const isRO = mode === 'ver';
  const [datos, setDatos] = useLineaGlobalNafin(solicitudId, isRO, 'evaluacion', onChange);
  const t = useMemo(() => leerTerminos(solicitudId), [solicitudId]);
  const e = datos.evaluacion;
  const ajusteManual = e.ajusteManual === 'true';
  const set = (campo: keyof EvaluacionNafin, valor: string) => {
    if (isRO) return;
    // Tocar un campo del dictamen lo saca del cálculo automático: el analista
    // asume ese ajuste.
    const esDictamen = CAMPOS_DICTAMEN.includes(campo);
    setDatos(prev => ({
      ...prev,
      evaluacion: { ...prev.evaluacion, [campo]: valor, ...(esDictamen ? { ajusteManual: 'true' } : {}) },
    }));
  };

  // Índice de Morosidad = Cartera Vencida / Cartera Total. Derivado: no se captura.
  const morosidad = num(e.carteraTotal) > 0 ? (num(e.carteraVencida) / num(e.carteraTotal)) * 100 : 0;
  const parametros = useMemo(() => resolverParametrosEvaluacion(parametrosProducto), [parametrosProducto]);
  const montoSolicitado = t.montoEmisionProyectado || t.montoSolicitado;
  const calculo = useMemo(
    () => calcularDictamen({ ...e, montoSolicitado }, parametros),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [e.capitalContable, e.carteraTotal, e.carteraVencida, e.capitalizacion, e.liquidez, e.coberturaReservas, e.roe, e.exposicionNafin, montoSolicitado, parametros],
  );

  // MD 06 — el dictamen se calcula de la Información Financiera mientras el
  // analista no lo haya ajustado a mano.
  useEffect(() => {
    if (isRO || ajusteManual || !calculo.calculable) return;
    const propuesto: Partial<EvaluacionNafin> = {
      calificacion: calculo.calificacion,
      nivelRiesgo: calculo.nivelRiesgo,
      dictamen: calculo.dictamen,
      montoRecomendado: calculo.montoRecomendado > 0 ? calculo.montoRecomendado.toFixed(2) : '0',
      condiciones: calculo.condiciones,
      observaciones: calculo.observaciones,
    };
    const cambia = (Object.keys(propuesto) as (keyof EvaluacionNafin)[]).some(k => (e[k] || '') !== (propuesto[k] || ''));
    if (cambia) setDatos(prev => ({ ...prev, evaluacion: { ...prev.evaluacion, ...propuesto } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculo, ajusteManual, isRO]);

  const recalcular = () => {
    if (isRO) return;
    setDatos(prev => ({ ...prev, evaluacion: { ...prev.evaluacion, ajusteManual: '' } }));
  };

  const faltan = faltantesFase2Nafin(datos);

  // ── Acta de Sesión del Comité CPC ──
  // Se arma con lo que hay en pantalla al momento de pulsar: si el dictamen se
  // ajusta después, se vuelve a generar y reemplaza a la anterior.
  const [generandoActa, setGenerandoActa] = useState(false);
  const fmt = (v: unknown) => (num(v) ? formatCurrency(num(v)) : '—');
  const generarActa = async () => {
    if (!onGenerarActa || generandoActa) return;
    setGenerandoActa(true);
    try {
      await onGenerarActa({
        intermediario: intermediario || '',
        numeroIntermediarioNafin: t.numeroIntermediarioNafin || '',
        tipoIntermediario: t.tipoIntermediario || '',
        montoSolicitado: num(montoSolicitado),
        moneda: t.moneda || 'MXN',
        modalidad: t.modalidadLinea || '',
        programa: t.programa || '',
        informacionFinanciera: [
          ['Capital Contable', fmt(e.capitalContable)],
          ['Cartera Total', fmt(e.carteraTotal)],
          ['Cartera Vencida', fmt(e.carteraVencida)],
          ['Índice de Morosidad', num(e.carteraTotal) > 0 ? `${morosidad.toFixed(2)}%` : '—'],
          ['Capitalización', e.capitalizacion ? `${e.capitalizacion}%` : '—'],
          ['Liquidez', e.liquidez ? `${e.liquidez}%` : '—'],
          ['Cobertura de Reservas', e.coberturaReservas ? `${e.coberturaReservas}%` : '—'],
          ['ROE', e.roe ? `${e.roe}%` : '—'],
          ['Exposición actual con NAFIN', fmt(e.exposicionNafin)],
        ],
        indicadores: calculo.indicadores,
        puntaje: calculo.calculable ? calculo.puntaje : null,
        calificacion: e.calificacion,
        nivelRiesgo: e.nivelRiesgo,
        dictamen: e.dictamen,
        montoRecomendado: num(e.montoRecomendado),
        capacidad: calculo.calculable ? calculo.capacidad : null,
        observaciones: e.observaciones || '',
        condiciones: e.condiciones || '',
        ajusteManual,
      });
    } finally {
      setGenerandoActa(false);
    }
  };

  const monto = (campo: keyof EvaluacionNafin, label: string, req = false) => (
    <div>
      <label className="block text-xs text-gray-700 mb-1">{label} {req && <span className="text-red-500">*</span>}</label>
      <input type="text" inputMode="decimal" value={e[campo]} disabled={isRO}
        onChange={ev => set(campo, ev.target.value.replace(/[^0-9.,]/g, ''))}
        className={`${isRO ? roClass : inputClass} text-right font-mono`} />
    </div>
  );
  const pct = (campo: keyof EvaluacionNafin, label: string) => (
    <div>
      <label className="block text-xs text-gray-700 mb-1">{label} <span className="text-red-500">*</span></label>
      <div className="relative">
        <input type="text" inputMode="decimal" value={e[campo]} disabled={isRO}
          onChange={ev => set(campo, ev.target.value.replace(/[^0-9.-]/g, ''))}
          className={`${isRO ? roClass : inputClass} text-right font-mono pr-6`} />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 pointer-events-none">%</span>
      </div>
    </div>
  );
  const select = (campo: keyof EvaluacionNafin, label: string, opciones: string[]) => (
    <div>
      <label className="block text-xs text-gray-700 mb-1">{label} <span className="text-red-500">*</span></label>
      <select value={e[campo]} disabled={isRO} onChange={ev => set(campo, ev.target.value)}
        className={isRO ? roClass : inputClass}>
        <option value="">— Seleccionar —</option>
        {opciones.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="border border-gray-200 bg-white p-5">
      <Aviso>
        <strong>Evaluación Financiera y de Riesgo del Intermediario</strong> — {txt(intermediario)}. El dictamen
        se calcula con la Información Financiera capturada y los parámetros
        {parametrosProducto ? ' configurados en el producto' : ' por defecto del sistema (el producto no tiene parámetros propios)'};
        el analista puede ajustarlo.
      </Aviso>
      <Faltantes lista={faltan} isRO={isRO} />

      <Titulo>INFORMACIÓN FINANCIERA DEL INTERMEDIARIO</Titulo>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 mb-5">
        {monto('capitalContable', 'Capital Contable', true)}
        {monto('carteraTotal', 'Cartera Total', true)}
        {monto('carteraVencida', 'Cartera Vencida', true)}
        <Campo label="Índice de Morosidad" valor={num(e.carteraTotal) > 0 ? `${morosidad.toFixed(2)}%` : '—'} mono />
        {pct('capitalizacion', 'Capitalización')}
        {pct('liquidez', 'Liquidez')}
        {pct('coberturaReservas', 'Cobertura de Reservas')}
        {pct('roe', 'ROE')}
        {monto('exposicionNafin', 'Exposición actual con NAFIN')}
      </div>

      {/* Desglose del cálculo: el comité debe poder ver por qué salió ese dictamen. */}
      <Titulo>CÁLCULO DEL DICTAMEN</Titulo>
      {!calculo.calculable ? (
        <p className="mb-5 text-[11px] text-amber-700">Para calcular capture: {calculo.faltantes.join(' · ')}.</p>
      ) : (
        <div className="mb-5">
          <table className="w-full text-xs border border-gray-200">
            <thead>
              <tr className="bg-gray-50 text-gray-600">
                <th className="px-2 py-1.5 text-left font-medium">Indicador</th>
                <th className="px-2 py-1.5 text-right font-medium">Valor</th>
                <th className="px-2 py-1.5 text-left font-medium">Umbral alcanzado</th>
                <th className="px-2 py-1.5 text-center font-medium">Puntos (0-3)</th>
              </tr>
            </thead>
            <tbody>
              {calculo.indicadores.map(i => (
                <tr key={i.indicador} className="border-t border-gray-100">
                  <td className="px-2 py-1">{i.indicador}</td>
                  <td className="px-2 py-1 text-right font-mono">{i.valor}</td>
                  <td className="px-2 py-1 text-gray-500">{i.criterio}</td>
                  <td className={`px-2 py-1 text-center font-medium ${(i.puntos ?? 0) >= 2 ? 'text-green-700' : (i.puntos ?? 0) === 1 ? 'text-amber-700' : 'text-red-700'}`}>{i.puntos}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-300 bg-gray-50 font-medium">
                <td className="px-2 py-1" colSpan={3}>Puntaje ponderado</td>
                <td className="px-2 py-1 text-center">{calculo.puntaje.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-gray-500">
            Capacidad del Intermediario = Capital Contable × {parametros.multiploCapital} − Exposición actual con NAFIN = {money(calculo.capacidad)}.
            Monto Recomendado = MIN(Solicitado, Capacidad) × factor por nivel de riesgo (Bajo {parametros.factorRiesgo.Bajo * 100}%,
            Medio {parametros.factorRiesgo.Medio * 100}%, Alto {parametros.factorRiesgo.Alto * 100}%).
          </p>
        </div>
      )}

      <Titulo>DICTAMEN</Titulo>
      {calculo.calculable && (
        <div className={`mb-3 px-3 py-2 rounded border text-[11px] flex items-center justify-between ${ajusteManual ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
          <span>
            {ajusteManual
              ? 'Dictamen ajustado manualmente por el analista: ya no se recalcula al cambiar la información financiera.'
              : 'Dictamen calculado automáticamente; se actualiza al cambiar la información financiera.'}
          </span>
          {ajusteManual && !isRO && (
            <button onClick={recalcular} className="px-2 py-1 text-[11px] font-medium text-white rounded bg-primary-theme hover:opacity-90">
              Recalcular
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
        <div>
          <label className="block text-xs text-gray-700 mb-1">Calificación <span className="text-red-500">*</span></label>
          <input type="text" value={e.calificacion} disabled={isRO} placeholder="Ej. AA (interna)"
            onChange={ev => set('calificacion', ev.target.value)} className={isRO ? roClass : inputClass} />
        </div>
        {select('nivelRiesgo', 'Nivel de Riesgo', ['Bajo', 'Medio', 'Alto'])}
        {select('dictamen', 'Dictamen', [DICTAMEN_FAVORABLE, DICTAMEN_CONDICIONADO, DICTAMEN_NO_FAVORABLE])}
        <Campo label="Monto Solicitado" valor={money(montoSolicitado)} mono />
        {monto('montoRecomendado', 'Monto Recomendado', e.dictamen !== DICTAMEN_NO_FAVORABLE)}
        <Campo label="Capacidad del Intermediario" valor={calculo.calculable ? money(calculo.capacidad) : '—'} mono />
        <div className="md:col-span-3">
          <label className="block text-xs text-gray-700 mb-1">Observaciones</label>
          <textarea rows={4} value={e.observaciones} disabled={isRO}
            onChange={ev => set('observaciones', ev.target.value)}
            className={`${isRO ? roClass : inputClass} resize-y`} />
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs text-gray-700 mb-1">
            Condiciones / Mitigantes {e.dictamen === DICTAMEN_CONDICIONADO && <span className="text-red-500">*</span>}
          </label>
          <textarea rows={3} value={e.condiciones} disabled={isRO}
            onChange={ev => set('condiciones', ev.target.value)}
            className={`${isRO ? roClass : inputClass} resize-y`} />
        </div>
      </div>

      {onGenerarActa && !isRO && (
        <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
          <span className="text-[11px] text-gray-500">
            {faltan.length > 0
              ? 'Complete el dictamen para generar el Acta.'
              : 'Se adjunta al Expediente Electrónico de esta fase; si ya existe, se reemplaza por la nueva versión.'}
          </span>
          <button onClick={generarActa} disabled={generandoActa || faltan.length > 0}
            className="px-4 py-1.5 text-xs font-medium text-white rounded bg-primary-theme hover:opacity-90 disabled:opacity-50">
            {generandoActa ? 'Generando…' : 'Generar Minuta de Sesión de Riesgo'}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Fase 3 — Resumen para la Votación y Resolución Final (MD 07)
// ═══════════════════════════════════════════════════════════════════

/** Datos NAFIN que la Votación muestra arriba de su panel (MD 07 §Votación). */
export function ResumenVotacionNafin({ solicitudId, intermediario, producto }: {
  solicitudId: string | number; intermediario?: string; producto?: string;
}) {
  const t = leerTerminos(solicitudId);
  const e = leerLineaGlobalNafin(solicitudId).evaluacion;
  return (
    <div className="mb-5">
      <Titulo>LÍNEA GLOBAL NAFIN — DATOS PARA EL VOTO</Titulo>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-x-4 gap-y-3">
        <Campo label="Intermediario" valor={txt(intermediario)} />
        <Campo label="Producto" valor={txt(producto)} />
        <Campo label="Modalidad" valor={txt(t.modalidadLinea)} />
        <Campo label="Calificación" valor={txt(e.calificacion)} />
        <Campo label="Monto Solicitado" valor={money(t.montoEmisionProyectado || t.montoSolicitado)} mono />
        <Campo label="Monto Recomendado" valor={money(e.montoRecomendado)} mono />
        <Campo label="Dictamen de Riesgo" valor={txt(e.dictamen)} />
        <Campo label="Nivel de Riesgo" valor={txt(e.nivelRiesgo)} />
      </div>
    </div>
  );
}

export function ResolucionLineaGlobalNafinTab({ mode, solicitudId, onChange }: BaseProps) {
  const isRO = mode === 'ver';
  const [datos, setDatos] = useLineaGlobalNafin(solicitudId, isRO, 'resolucion', onChange);
  const t = useMemo(() => leerTerminos(solicitudId), [solicitudId]);
  const r = datos.resolucion;
  const set = (campo: keyof ResolucionNafin, valor: string) => {
    if (isRO) return;
    setDatos(prev => ({ ...prev, resolucion: { ...prev.resolucion, [campo]: valor } }));
  };

  // Siembra única: Monto Autorizado ← Recomendado, fechas ← Términos. Sólo
  // rellena vacíos — nunca pisa lo que el comité ya capturó.
  useEffect(() => {
    if (isRO) return;
    const patch: Partial<ResolucionNafin> = {};
    if (!r.montoAutorizado && datos.evaluacion.montoRecomendado) patch.montoAutorizado = datos.evaluacion.montoRecomendado;
    if (!r.fechaInicio && t.fechaInicioLinea) patch.fechaInicio = t.fechaInicioLinea;
    if (!r.fechaVencimiento && t.fechaVencimientoLinea) patch.fechaVencimiento = t.fechaVencimientoLinea;
    if (Object.keys(patch).length > 0) setDatos(prev => ({ ...prev, resolucion: { ...prev.resolucion, ...patch } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vigencia = (() => {
    const a = fechaComparable(r.fechaInicio), b = fechaComparable(r.fechaVencimiento);
    if (!a || !b || b <= a) return '—';
    const anios = Math.floor(b / 10000) - Math.floor(a / 10000);
    return `${anios} año(s)`;
  })();
  const faltan = faltantesFase3Nafin(datos, t);

  return (
    <div className="border border-gray-200 bg-white p-5">
      <Aviso>
        <strong>Resolución Final de la Línea Global</strong> — registra lo que autorizó la instancia
        autorizadora. El Monto Autorizado será el Disponible inicial de la línea al liberarla.
      </Aviso>
      <Faltantes lista={faltan} isRO={isRO} />

      <Titulo>REGISTRO DE LA SESIÓN</Titulo>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 mb-5">
        <div>
          <label className="block text-xs text-gray-700 mb-1">No. de Acta</label>
          <input type="text" value={r.numeroActa} disabled={isRO}
            onChange={e => set('numeroActa', e.target.value)} className={isRO ? roClass : inputClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Fecha de Sesión</label>
          <DatePicker value={r.fechaSesion} onChange={(v: string) => set('fechaSesion', v)}
            disabled={isRO} placeholder="dd/mm/aaaa" className="px-2 py-1.5" />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Resolución <span className="text-red-500">*</span></label>
          <select value={r.resolucion} disabled={isRO} onChange={e => set('resolucion', e.target.value)}
            className={isRO ? roClass : inputClass}>
            <option value="">— Seleccionar —</option>
            {[RESOLUCION_AUTORIZADA, RESOLUCION_CONDICIONADA, RESOLUCION_RECHAZADA].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <Titulo>CONDICIONES AUTORIZADAS</Titulo>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
        <Campo label="Monto Solicitado" valor={money(t.montoEmisionProyectado || t.montoSolicitado)} mono />
        <Campo label="Monto Recomendado" valor={money(datos.evaluacion.montoRecomendado)} mono />
        <div>
          <label className="block text-xs text-gray-700 mb-1">Monto Autorizado <span className="text-red-500">*</span></label>
          <input type="text" inputMode="decimal" value={r.montoAutorizado} disabled={isRO}
            onChange={e => set('montoAutorizado', e.target.value.replace(/[^0-9.,]/g, ''))}
            className={`${isRO ? roClass : inputClass} text-right font-mono`} />
        </div>
        <Campo label="Moneda" valor={txt(t.moneda)} />
        <div>
          <label className="block text-xs text-gray-700 mb-1">Fecha Inicio <span className="text-red-500">*</span></label>
          <DatePicker value={r.fechaInicio} onChange={(v: string) => set('fechaInicio', v)}
            disabled={isRO} placeholder="dd/mm/aaaa" className="px-2 py-1.5" />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Fecha Vencimiento <span className="text-red-500">*</span></label>
          <DatePicker value={r.fechaVencimiento} onChange={(v: string) => set('fechaVencimiento', v)}
            disabled={isRO} placeholder="dd/mm/aaaa" className="px-2 py-1.5" />
        </div>
        <Campo label="Vigencia" valor={vigencia} />
        <Campo label="Modalidad" valor={txt(t.modalidadLinea)} />
        <Campo label="Cobertura Máxima" valor={t.porcentajeCoberturaGpo ? `${t.porcentajeCoberturaGpo}%` : '—'} mono />
        <Campo label="Monto Máximo por SubLínea" valor={money(t.montoMaximoSublinea)} mono />
        <Campo label="Revolvente" valor={revolvente(t)} />
        <div />
        <div className="md:col-span-3">
          <label className="block text-xs text-gray-700 mb-1">
            Condiciones {r.resolucion === RESOLUCION_CONDICIONADA && <span className="text-red-500">*</span>}
          </label>
          <textarea rows={3} value={r.condiciones} disabled={isRO}
            onChange={e => set('condiciones', e.target.value)}
            className={`${isRO ? roClass : inputClass} resize-y`} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Fase 4 — Validación de Formalización (MD 08)
// ═══════════════════════════════════════════════════════════════════

export function FormalizacionNafinTab({ mode, solicitudId, intermediario, onChange }: BaseProps) {
  const isRO = mode === 'ver';
  const [datos, setDatos] = useLineaGlobalNafin(solicitudId, isRO, 'formalizacion', onChange);
  const x = datos.formalizacion;
  const r = datos.resolucion;
  const set = (campo: keyof FormalizacionNafin, valor: string) => {
    if (isRO) return;
    setDatos(prev => ({ ...prev, formalizacion: { ...prev.formalizacion, [campo]: valor } }));
  };
  const faltan = faltantesFase4Nafin(datos);
  const lista = faltan.length === 0;

  const texto = (campo: keyof FormalizacionNafin, label: string) => (
    <div>
      <label className="block text-xs text-gray-700 mb-1">{label} <span className="text-red-500">*</span></label>
      <input type="text" value={x[campo]} disabled={isRO}
        onChange={e => set(campo, e.target.value)} className={isRO ? roClass : inputClass} />
    </div>
  );

  return (
    <div className="border border-gray-200 bg-white p-5">
      <Aviso>
        <strong>Validación de Formalización</strong> — datos del Contrato / Convenio con el
        Intermediario. El checklist documental (contrato firmado, poderes, acuerdo de autorización,
        condiciones precedentes) se valida con los requisitos de esta fase en el Expediente
        Electrónico, configurados en Taller de Producto.
      </Aviso>
      <Faltantes lista={faltan} isRO={isRO} />

      <Titulo>DATOS DE FORMALIZACIÓN</Titulo>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 mb-5">
        {texto('numeroContrato', 'No. Contrato / Convenio')}
        <Campo label="Intermediario" valor={txt(intermediario)} />
        <Campo label="Monto Autorizado" valor={money(r.montoAutorizado)} mono />
        <div>
          <label className="block text-xs text-gray-700 mb-1">Fecha de Firma <span className="text-red-500">*</span></label>
          <DatePicker value={x.fechaFirma} onChange={(v: string) => set('fechaFirma', v)}
            disabled={isRO} placeholder="dd/mm/aaaa" className="px-2 py-1.5" />
        </div>
        <Campo label="Fecha Inicio" valor={txt(r.fechaInicio)} />
        <Campo label="Fecha Vencimiento" valor={txt(r.fechaVencimiento)} />
        {texto('representanteIF', 'Representante IF')}
        {texto('representanteNafin', 'Representante NAFIN')}
      </div>

      <div className={`px-3 py-2 rounded border text-xs font-medium ${
        lista ? 'bg-green-50 border-green-300 text-green-800' : 'bg-gray-50 border-gray-200 text-gray-500'
      }`}>
        Resultado: {lista ? 'LISTA PARA LIBERACIÓN' : 'PENDIENTE DE FORMALIZAR'}
      </div>
    </div>
  );
}
