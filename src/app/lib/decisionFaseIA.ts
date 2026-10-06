/**
 * Decisión de la validación IA de fase cuando los motivos vienen etiquetados.
 *
 * El prompt de la fase pide que cada motivo empiece con "OK:", "ADVERTENCIA:"
 * o "RECHAZO:" y que "valido" sea false sólo si hay algún RECHAZO. Los modelos
 * pequeños no siempre respetan esa regla (devuelven valido:false con puros OK y
 * ADVERTENCIA), así que aquí se aplica de forma determinista.
 *
 * Si los motivos NO vienen etiquetados (prompts anteriores), se respeta el
 * "valido" de la IA tal cual.
 */
export interface ResultadoFaseIA {
  valido?: boolean;
  motivos?: unknown[];
  faltantes?: unknown[];
  [k: string]: unknown;
}

const ETIQUETA = /^\s*[-•·]?\s*(OK|ADVERTENCIA|RECHAZO)\s*:/i;
const esRechazo = (m: string) => /^\s*[-•·]?\s*RECHAZO\s*:/i.test(m);
const esAdvertencia = (m: string) => /^\s*[-•·]?\s*ADVERTENCIA\s*:/i.test(m);

export function decidirFaseIA<T extends ResultadoFaseIA>(r: T): T & { decisionPorEtiquetas: boolean; motivosOrdenados: string[] } {
  const motivos = (Array.isArray(r.motivos) ? r.motivos : []).map(String);
  const etiquetados = motivos.length > 0 && motivos.every(m => ETIQUETA.test(m));
  // Rechazos primero, luego advertencias, luego OK — para mostrar lo relevante.
  const motivosOrdenados = [
    ...motivos.filter(esRechazo),
    ...motivos.filter(esAdvertencia),
    ...motivos.filter(m => !esRechazo(m) && !esAdvertencia(m)),
  ];
  if (!etiquetados) return { ...r, decisionPorEtiquetas: false, motivosOrdenados };
  const hayRechazo = motivos.some(esRechazo);
  return {
    ...r,
    valido: !hayRechazo,
    // Sin rechazos, los "faltantes" que haya puesto el modelo no bloquean.
    faltantes: hayRechazo ? r.faltantes : [],
    decisionPorEtiquetas: true,
    motivosOrdenados,
  };
}
