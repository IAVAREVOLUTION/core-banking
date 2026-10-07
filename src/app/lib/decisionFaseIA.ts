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

const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Reglas de negocio que el modelo no siempre respeta: se aplican aquí de forma
 * determinista reclasificando un RECHAZO como ADVERTENCIA cuando su ÚNICA razón es
 *  - que el comprobante de domicilio está a nombre de un tercero, o
 *  - comparar el RFC contra la INE / clave de elector (la INE no contiene RFC), o
 *  - diferencias sólo en la homoclave del RFC (no se exige; se compara la base).
 * Si el mismo motivo menciona vencimiento, ilegibilidad o emisor inválido, sigue siendo RECHAZO.
 */
/** Nombres entre comillas que cita un motivo ('…', "…", “…”). */
function nombresCitados(m: string): string[] {
  const out: string[] = [];
  for (const r of m.matchAll(/['"“‘]([A-Za-zÁÉÍÓÚÜÑáéíóúüñ. ]{5,80})['"”’]/g)) out.push(r[1].trim());
  return out;
}
const tokensNombre = (n: string) => sinAcentos(n).replace(/[^a-z ]/g, ' ').split(/\s+/).filter(w => w.length > 1);
/** Misma persona: los tokens del nombre corto están todos en el largo (sin importar el orden). */
export function nombresEquivalentes(a: string, b: string): boolean {
  const ta = tokensNombre(a), tb = tokensNombre(b);
  const [corto, largo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return corto.length >= 2 && corto.every(w => largo.includes(w));
}

export function reclasificarMotivo(m: string): string {
  if (!/^\s*[-•·]?\s*RECHAZO\s*:/i.test(m)) return m;
  const t = sinAcentos(m);
  const graves = /(vencid|vigencia|antiguedad|ilegible|no legible|emisor|falsific|alterad|no cargad|falta|faltante)/;
  const comprobanteTercero = /comprobante de domicilio/.test(t)
    && /(tercero|a nombre de|titular|no coincide|no esta a nombre|discrepancia)/.test(t)
    && !graves.test(t)
    && !/\bine\b|identificacion oficial|pasaporte/.test(t.replace(/combinado con[^.]*$/, ''));
  // RFC: si todas las variantes citadas comparten la misma base (sin homoclave),
  // o el motivo sólo se queja de la homoclave/longitud, no es rechazo.
  const rfcs = (m.toUpperCase().match(/\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{0,3}\b/g) || []);
  const baseRfc = (r: string) => r.match(/^[A-ZÑ&]{3,4}\d{6}/)?.[0] || r;
  const mismaBase = rfcs.length > 0 && new Set(rfcs.map(baseRfc)).size === 1;
  // "falta la homoclave" no es un motivo grave: se quita antes de evaluar.
  const tSinHomoclave = t.replace(/(falta|faltan|sin|incomplet\w*)[^.;]{0,30}homoclave/g, '');
  const soloHomoclave = /\brfc\b/.test(t) && !graves.test(tSinHomoclave)
    && (mismaBase || (/(homoclave|caracteres|estructura|longitud)/.test(t) && rfcs.length <= 1));
  const rfcContraIne = /\b(rfc|curp)\b/.test(t) &&/(clave de elector|\bine\b|identificacion oficial)/.test(t) && !graves.test(t);
  // Nombres: "SOLANO ENCISO CESAR ALEJANDRO" y "Cesar Alejandro Solano" son la misma
  // persona (otro orden, falta el materno). Si los únicos nombres "distintos" que cita
  // el motivo son equivalentes, o el único realmente distinto es el titular del
  // comprobante de domicilio (tercero permitido), no es rechazo.
  const nombres = nombresCitados(m);
  const distintos = nombres.filter(n => !nombres.some(o => o !== n && nombresEquivalentes(n, o)));
  const discrepanciaNombres = nombres.length >= 2 && /(identidad|nombre|coincide|discrepancia|titular)/.test(t) && !graves.test(t)
    && (distintos.length === 0
      || (/comprobante de domicilio/.test(t) && /tercer/.test(t) && distintos.length <= 1));
  if (comprobanteTercero || rfcContraIne || soloHomoclave || discrepanciaNombres) {
    return m.replace(/^\s*[-•·]?\s*RECHAZO\s*:/i, 'ADVERTENCIA:') + ' (reclasificado por regla del sistema)';
  }
  return m;
}

/** Palabras de la re-validación de CONTENIDO de un documento (lo que ya revisó la validación individual). */
const CONTENIDO_DOC = /(legib|vigen|vencid|antiguedad|emisor|emitid|autentic|oficial|sello|firma|formato|elemento|tipo de documento|documento incorrecto|calidad|resolucion|recortad|borros|incomplet)/;
/** Lo que nunca se perdona aunque el documento esté validado. */
const SIEMPRE_RECHAZO = /(no cargad|falta|faltante|sin archivo|no existe|no se encontr|rechazad|pendiente de validacion|otra persona|corresponde a otr)/;

/**
 * Si un RECHAZO sólo re-evalúa el contenido de documentos que YA pasaron su
 * validación individual con IA, se reclasifica como ADVERTENCIA (evita la
 * doble validación). La faltante de documentos y las identidades de otra
 * persona siguen siendo rechazo.
 */
export function relajarRevalidacion(m: string, docsValidados: string[]): string {
  if (!docsValidados.length || !/^\s*[-•·]?\s*RECHAZO\s*:/i.test(m)) return m;
  const t = sinAcentos(m);
  if (SIEMPRE_RECHAZO.test(t) || !CONTENIDO_DOC.test(t)) return m;
  const mencionaValidado = docsValidados.some(tipo => {
    const k = sinAcentos(tipo).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!k) return false;
    if (t.includes(k)) return true;
    // Coincidencia por palabras clave del tipo (p. ej. "comprobante" + "domicilio")
    const palabras = k.split(' ').filter(w => w.length > 3);
    return palabras.length > 0 && palabras.every(w => t.includes(w));
  });
  if (!mencionaValidado) return m;
  return m.replace(/^\s*[-•·]?\s*RECHAZO\s*:/i, 'ADVERTENCIA:') + ' (documento ya validado individualmente por IA)';
}

export function decidirFaseIA<T extends ResultadoFaseIA>(r: T, docsValidados: string[] = []): T & { decisionPorEtiquetas: boolean; motivosOrdenados: string[] } {
  const motivos = (Array.isArray(r.motivos) ? r.motivos : []).map(String)
    .map(reclasificarMotivo)
    .map(m => relajarRevalidacion(m, docsValidados));
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
    motivos,
    valido: !hayRechazo,
    // Sin rechazos, los "faltantes" que haya puesto el modelo no bloquean.
    faltantes: hayRechazo ? r.faltantes : [],
    decisionPorEtiquetas: true,
    motivosOrdenados,
  };
}

/**
 * Reglas comunes que se agregan al prompt de TODAS las fases. Evita que cada
 * prompt de fase (configurado en el producto) tenga que repetirlas y corrige
 * errores frecuentes del modelo: comparar nombres por orden exacto, rechazar
 * comprobantes a nombre de terceros y confundir la clave de elector con el RFC.
 */
export const REGLAS_GENERALES_FASE_IA = `=== REGLAS GENERALES DEL CORE (aplican a todas las fases y PREVALECEN sobre cualquier instrucción anterior que las contradiga) ===

ALCANCE DE LA FASE:
- Si el prompt de la fase dice que NO valides el contenido de los documentos (sólo que estén cargados
  y validados por IA), entonces NO compares nombres, CURP, RFC, vigencias ni titulares: limítate a
  presencia y estatus de validación. Las reglas de comparación de abajo sólo aplican a fases que sí
  revisan contenido.

DOCUMENTOS YA VALIDADOS (NO DUPLICAR LA VALIDACIÓN):
- Un documento marcado "✓ VALIDADO POR IA" ya pasó su validación individual: se da por bueno su
  CONTENIDO (que sea el tipo correcto, legible, vigente, emitido por quien corresponde, con sus
  elementos obligatorios). NO lo vuelvas a evaluar ni lo rechaces por esos motivos.
- Para esos documentos sólo verifica, si la fase lo requiere, que estén presentes y que sus datos sean
  congruentes con el cliente y con los demás documentos (aplicando las reglas de abajo).
- Reporta cada documento validado como "OK: <tipo> validado por IA".

COMPARACIÓN DE NOMBRES:
- Compara nombres ignorando mayúsculas/minúsculas, acentos y el ORDEN de nombres y apellidos.
  "Cesar Alejandro Solano" y "SOLANO ENCISO CESAR ALEJANDRO" son la MISMA persona.
- Hay coincidencia si el primer nombre y el apellido paterno coinciden, aunque falte el segundo
  nombre o el apellido materno en alguno de los dos. Eso NO es discrepancia.
- La Identificación Oficial (INE / pasaporte) DEBE corresponder al cliente; si es otra persona, es RECHAZO.

COMPROBANTE DE DOMICILIO:
- Puede estar a nombre de un tercero (familiar, cónyuge, arrendador). Eso es ADVERTENCIA, NUNCA RECHAZO.
- Sí es RECHAZO si es ilegible, de un emisor no válido o con más de 3 meses de antigüedad.

RFC, CURP Y CLAVE DE ELECTOR:
- La INE NO contiene RFC. La "clave de elector" de la INE (18 caracteres, p. ej. "SLENCS02083009H300")
  NO es RFC ni CURP: NUNCA compares el RFC contra la clave de elector.
- Tampoco compares la CURP del sistema contra la clave de elector: son identificadores distintos.
  Sólo compara la CURP contra un campo rotulado "CURP" en el documento.
- El RFC de persona física son los primeros 10 caracteres de la CURP más 3 de homoclave. Compara el RFC
  sólo contra la CURP o contra otro documento que muestre el RFC (constancia de situación fiscal, solicitud).
- Si no hay un documento con el que comparar el RFC, no lo marques como discrepancia.
- NO se exige la HOMOCLAVE. Compara el RFC SÓLO por su base: los primeros 10 caracteres en persona física
  (4 letras + 6 dígitos de fecha) o los primeros 9 en persona moral (3 letras + 6 dígitos).
  "SOEC020830", "SOEC020830H" y "SOEC020830292" son el MISMO RFC: eso es OK.
- Un RFC sin homoclave o con homoclave incompleta NO es motivo de rechazo; a lo sumo una ADVERTENCIA.
- Sólo es RECHAZO si la BASE del RFC (letras + fecha) es distinta entre documentos.

FORMATO DE "motivos" (OBLIGATORIO) — cada motivo inicia con una etiqueta:
- "OK: ..."          → validado correctamente.
- "ADVERTENCIA: ..." → observación que NO impide avanzar.
- "RECHAZO: ..."     → incumplimiento que SÍ impide avanzar (documento obligatorio faltante,
                       identificación de otra persona, documento vencido o ilegible, datos incompletos).
- "valido" es false SÓLO si hay al menos un motivo "RECHAZO:". "OK:" y "ADVERTENCIA:" nunca cuentan como rechazo.
- No uses otras etiquetas como "DISCREPANCIA CRÍTICA"; clasifica cada hallazgo como OK, ADVERTENCIA o RECHAZO.`;

/**
 * ¿El prompt de la fase es de "sólo presencia"? (no valida contenido; sólo que
 * los documentos estén cargados y validados por IA en KM Digital).
 */
export function esPromptSoloPresencia(prompt: string | undefined | null): boolean {
  const t = sinAcentos(String(prompt || ''));
  return /no valid\w* (su |el )?contenido/.test(t)
    || /(solo|unicamente) (que )?(este|esten) (cargad|integrad)/.test(t);
}

const normDoc = (s: string) => sinAcentos(String(s || '')).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** El documento cargado cubre el requisito (mismo nombre, o uno contiene al otro). */
export function documentoCubreRequisito(tipoDoc: string, tipoReq: string): boolean {
  const a = normDoc(tipoDoc), b = normDoc(tipoReq);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Decisión determinista para fases de "sólo presencia": pasa si cada documento
 * obligatorio de la fase está cargado y validado por IA. Los motivos de la IA
 * se conservan como información (OK/ADVERTENCIA), pero no deciden.
 */
export function decidirFasePorPresencia<T extends ResultadoFaseIA>(
  r: T & { motivosOrdenados: string[] },
  requisitos: { tipoDocumento: string; obligatorio?: boolean }[],
  documentos: { tipoDocumento?: string; estatus?: string; validadoIA?: boolean }[],
): T & { motivosOrdenados: string[]; decisionPorPresencia: true } {
  const faltantes: string[] = [];
  const motivos: string[] = [];
  for (const req of requisitos.filter(x => x.obligatorio !== false)) {
    const candidatos = documentos.filter(d => documentoCubreRequisito(d.tipoDocumento || '', req.tipoDocumento));
    if (candidatos.some(d => d.validadoIA && d.estatus === 'Validado')) {
      motivos.push(`OK: ${req.tipoDocumento} cargado y validado por IA`);
    } else if (candidatos.length === 0) {
      faltantes.push(req.tipoDocumento);
      motivos.push(`RECHAZO: ${req.tipoDocumento} no está cargado en KM Digital`);
    } else if (candidatos.some(d => d.estatus === 'Rechazado')) {
      faltantes.push(req.tipoDocumento);
      motivos.push(`RECHAZO: ${req.tipoDocumento} fue rechazado en su validación individual`);
    } else {
      faltantes.push(req.tipoDocumento);
      motivos.push(`RECHAZO: ${req.tipoDocumento} está cargado pero no ha sido validado por IA`);
    }
  }
  // Observaciones de la IA: sólo como información (los RECHAZO de contenido no aplican en esta fase).
  const notasIA = r.motivosOrdenados
    .filter(m => !/^\s*[-•·]?\s*OK\s*:/i.test(m))
    .map(m => m.replace(/^\s*[-•·]?\s*RECHAZO\s*:/i, 'ADVERTENCIA:') + (/^\s*[-•·]?\s*RECHAZO/i.test(m) ? ' (la fase sólo revisa presencia; no bloquea)' : ''));
  const motivosOrdenados = [
    ...motivos.filter(m => m.startsWith('RECHAZO')),
    ...notasIA,
    ...motivos.filter(m => m.startsWith('OK')),
  ];
  return { ...r, valido: faltantes.length === 0, faltantes, motivos: motivosOrdenados, motivosOrdenados, decisionPorPresencia: true };
}
