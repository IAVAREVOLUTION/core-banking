/**
 * Control de versiones del KM Digital de la Oportunidad — mismo esquema que el
 * KM de la Solicitud (solicitudCreditoStore: versionDoc / raizVersion /
 * siguienteVersion / documentosVigentes), adaptado a ids de texto.
 *
 * Cada documento es un grupo de registros con la misma raíz; la versión más
 * alta es la vigente y las demás son historial. Nunca se sobrescribe un
 * registro: una nueva versión es un registro nuevo.
 */
import type { ArchivoAdjuntoOportunidad } from '../components/cotizaciones/cotizacionCreditoTypes';

/**
 * Documentos que son UNO solo aunque se carguen varias veces. Los registros
 * anteriores al versionado (sin `versionRaiz`) de estos tipos se agrupan como
 * versiones del mismo documento al mostrarse — sin modificar lo guardado.
 */
const TIPOS_DOCUMENTO_UNICO = ['Carta Oferta', 'Carta Oferta Firmada'];

const numVersion = (a: ArchivoAdjuntoOportunidad): number => parseFloat(a.version || '1') || 1;
const fechaMs = (a: ArchivoAdjuntoOportunidad): number => new Date(a.fecha).getTime() || 0;

/**
 * Completa versión y raíz en los registros anteriores al versionado. Los
 * registros ya versionados no se tocan.
 */
export function normalizarVersiones(lista: ArchivoAdjuntoOportunidad[]): ArchivoAdjuntoOportunidad[] {
  const legadoPorTipo = new Map<string, ArchivoAdjuntoOportunidad[]>();
  for (const a of lista) {
    if (!a.versionRaiz && TIPOS_DOCUMENTO_UNICO.includes(a.tipo)) {
      legadoPorTipo.set(a.tipo, [...(legadoPorTipo.get(a.tipo) || []), a]);
    }
  }
  const asignado = new Map<string, { version: string; versionRaiz: string }>();
  for (const grupo of legadoPorTipo.values()) {
    const orden = [...grupo].sort((x, y) => fechaMs(x) - fechaMs(y));
    orden.forEach((a, i) => asignado.set(a.id, { version: `${i + 1}.0`, versionRaiz: orden[0].id }));
  }
  return lista.map(a => {
    const leg = asignado.get(a.id);
    if (leg) return { ...a, ...leg };
    return { ...a, version: a.version || '1.0', versionRaiz: a.versionRaiz || a.id };
  });
}

export const raizDe = (a: ArchivoAdjuntoOportunidad): string => a.versionRaiz || a.id;

/** Siguiente número de versión del documento al que pertenece `a`. */
export function siguienteVersion(lista: ArchivoAdjuntoOportunidad[], a: ArchivoAdjuntoOportunidad): string {
  const norm = normalizarVersiones(lista);
  const raiz = raizDe(norm.find(x => x.id === a.id) || a);
  const max = norm.filter(x => raizDe(x) === raiz).reduce((m, x) => Math.max(m, numVersion(x)), 0);
  return `${Math.floor(max) + 1}.0`;
}

/** Documentos agrupados por raíz: [vigente, ...anteriores] (de la más nueva a la más vieja). */
export function documentosConVersiones(lista: ArchivoAdjuntoOportunidad[]): ArchivoAdjuntoOportunidad[][] {
  const grupos = new Map<string, ArchivoAdjuntoOportunidad[]>();
  for (const a of normalizarVersiones(lista)) {
    grupos.set(raizDe(a), [...(grupos.get(raizDe(a)) || []), a]);
  }
  return [...grupos.values()]
    .map(g => g.sort((x, y) => numVersion(y) - numVersion(x) || fechaMs(y) - fechaMs(x)))
    // El documento con actividad más reciente primero.
    .sort((x, y) => fechaMs(y[0]) - fechaMs(x[0]));
}

/** Versión vigente (la más alta) de cada documento. */
export function documentosVigentes(lista: ArchivoAdjuntoOportunidad[]): ArchivoAdjuntoOportunidad[] {
  return documentosConVersiones(lista).map(g => g[0]);
}

/** Vigente del documento de un tipo (p. ej. la Carta Oferta actual), si existe. */
export function vigenteDeTipo(lista: ArchivoAdjuntoOportunidad[], tipo: string): ArchivoAdjuntoOportunidad | undefined {
  return documentosVigentes(lista).filter(a => a.tipo === tipo).sort((x, y) => fechaMs(y) - fechaMs(x))[0];
}

/**
 * Prepara un registro nuevo como siguiente versión de `origen`, o como v1.0 si
 * no hay origen. Devuelve la lista completa normalizada con el registro nuevo.
 */
export function agregarVersion(
  lista: ArchivoAdjuntoOportunidad[],
  nuevo: ArchivoAdjuntoOportunidad,
  origen?: ArchivoAdjuntoOportunidad,
): ArchivoAdjuntoOportunidad[] {
  const norm = normalizarVersiones(lista);
  const base = origen ? norm.find(x => x.id === origen.id) || origen : undefined;
  const registro: ArchivoAdjuntoOportunidad = base
    ? { ...nuevo, version: siguienteVersion(norm, base), versionRaiz: raizDe(base), versionDe: base.id }
    : { ...nuevo, version: '1.0', versionRaiz: nuevo.id };
  return [...norm, { ...registro, fechaActualizacion: registro.fechaActualizacion || registro.fecha }];
}
