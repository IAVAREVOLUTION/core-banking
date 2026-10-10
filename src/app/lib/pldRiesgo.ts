/**
 * Calificación de riesgo PLD (enfoque basado en riesgo) con los datos reales
 * de la persona. Mantiene los 5 factores y ponderaciones del módulo:
 *   Actividad económica 25% · Residencia 15% · Nacionalidad 15%
 *   Tipo de persona 20% · PEP / listas 25%
 * Total ≥ 70 Alto · ≥ 40 Medio · menor Bajo.
 *
 * Cada factor devuelve su valor (0–100) y el motivo, para que el oficial vea
 * por qué salió así y pueda ajustarlo.
 */
import { repararDataSolicitud } from './repararDataSolicitud';

export type FactorRiesgo = 'actividadEconomica' | 'residencia' | 'nacionalidad' | 'tipoPersona' | 'pepListasNegras';
export const PONDERACION: Record<FactorRiesgo, number> = {
  actividadEconomica: 0.25, residencia: 0.15, nacionalidad: 0.15, tipoPersona: 0.20, pepListasNegras: 0.25,
};

export interface ResultadoRiesgo {
  factores: Record<FactorRiesgo, { valor: number; motivo: string }>;
  total: number;
  nivel: 'Alto' | 'Medio' | 'Bajo';
}

const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Actividades de mayor exposición a lavado de dinero (actividades vulnerables y afines). */
const ACTIVIDAD_ALTA = /(cambio de divisas|casa de cambio|centro cambiario|transmisor de dinero|remesas|joyer|metales preciosos|piedras preciosas|relojes|inmobiliari|bienes raices|desarrollo inmobiliario|juegos|apuestas|sorteos|casino|automotr|agencia de autos|vehiculos|blindaje|obras de arte|antiguedades|prestamista|empeno|casa de empeno|activos virtuales|cripto|notari|correduria publica|donataria|asociacion civil|sin fines de lucro|tarjetas de servicio|vales|monederos)/;
const ACTIVIDAD_MEDIA = /(comercio|importa|exporta|construccion|transporte|gasolin|restaurante|bar |hotel|servicios financieros|sofom|consultor|profesional independiente|agricola|ganader)/;
const GOBIERNO = /(gobierno|secretaria|ayuntamiento|municipio|estado de|dependencia|organismo|instituto|ministerio|poder (ejecutivo|legislativo|judicial))/;

/** Jurisdicciones con llamado a la acción del GAFI (lista negra). */
const PAIS_ALTO = /(corea del norte|norcorea|iran|myanmar|birmania)/;
/** Jurisdicciones bajo vigilancia reforzada (lista gris; cambia cada año, revisar). */
const PAIS_MEDIO = /(siria|yemen|sudan del sur|haiti|nigeria|sudafrica|venezuela|panama|islas caiman|monaco)/;

export function calcularRiesgo(rawData: unknown, personalidad?: string): ResultadoRiesgo {
  const d = repararDataSolicitud(rawData) as Record<string, any>;
  const def = (d.default || {}) as Record<string, any>;
  const g = (...k: string[]) => { for (const x of k) { const v = d[x] ?? def[x]; if (v != null && v !== '') return v; } return ''; };

  const nombre = norm(g('denominacionRazonSocial', 'razonSocial', 'nombre'));
  const pers = norm(personalidad || g('personalidad', 'subtipo', 'tipo'));
  const esMoral = pers.includes('moral');
  const esPFAE = pers.includes('actividad') || pers === 'pfae';

  // 1) Actividad económica
  const actividadTxt = norm([g('actividadEconomica', 'giroEmpresa', 'giro', 'ocupacion', 'profesion', 'sectorInfraestructura', 'clasificacionCliente')].join(' '));
  let actividad: { valor: number; motivo: string };
  if (ACTIVIDAD_ALTA.test(actividadTxt)) actividad = { valor: 90, motivo: `Actividad de alta exposición: ${actividadTxt.slice(0, 60)}` };
  else if (GOBIERNO.test(`${actividadTxt} ${nombre}`)) actividad = { valor: 40, motivo: 'Entidad o dependencia de gobierno' };
  else if (ACTIVIDAD_MEDIA.test(actividadTxt)) actividad = { valor: 50, motivo: `Actividad de exposición media: ${actividadTxt.slice(0, 60)}` };
  else if (actividadTxt) actividad = { valor: 20, motivo: `Actividad sin factores de riesgo: ${actividadTxt.slice(0, 60)}` };
  else actividad = { valor: 50, motivo: 'Sin actividad económica registrada (se asume riesgo medio)' };

  // 2) Residencia
  const pais = norm(g('paisResidencia', 'pais', 'direccionPais'));
  const entidad = String(g('entidadResidencia', 'entidadFederativa', 'direccionEstado', 'estado') || '');
  let residencia: { valor: number; motivo: string };
  if (pais && PAIS_ALTO.test(pais)) residencia = { valor: 100, motivo: `Residencia en jurisdicción de alto riesgo (GAFI): ${pais}` };
  else if (pais && PAIS_MEDIO.test(pais)) residencia = { valor: 70, motivo: `Residencia en jurisdicción bajo vigilancia: ${pais}` };
  else if (pais && !/mexic/.test(pais)) residencia = { valor: 50, motivo: `Residencia en el extranjero: ${pais}` };
  else if (entidad || /mexic/.test(pais)) residencia = { valor: 10, motivo: `Residencia en México${entidad ? ` (${entidad})` : ''}` };
  else residencia = { valor: 40, motivo: 'Sin residencia registrada' };

  // 3) Nacionalidad
  const nac = norm(g('nacionalidad', 'paisNacionalidad', 'paisConstitucion'));
  let nacionalidad: { valor: number; motivo: string };
  if (nac && PAIS_ALTO.test(nac)) nacionalidad = { valor: 100, motivo: `Nacionalidad de jurisdicción de alto riesgo (GAFI): ${nac}` };
  else if (nac && PAIS_MEDIO.test(nac)) nacionalidad = { valor: 70, motivo: `Nacionalidad de jurisdicción bajo vigilancia: ${nac}` };
  else if (nac && !/mexic/.test(nac)) nacionalidad = { valor: 50, motivo: `Nacionalidad extranjera: ${nac}` };
  else if (nac) nacionalidad = { valor: 10, motivo: 'Nacionalidad mexicana' };
  else nacionalidad = { valor: esMoral ? 10 : 30, motivo: esMoral ? 'Persona moral mexicana (sin nacionalidad capturada)' : 'Sin nacionalidad registrada' };

  // 4) Tipo de persona
  const tipoPersona = esMoral
    ? (GOBIERNO.test(nombre) ? { valor: 30, motivo: 'Persona moral de derecho público' } : { valor: 60, motivo: 'Persona moral (estructura de propiedad y beneficiario final a verificar)' })
    : esPFAE ? { valor: 40, motivo: 'Persona física con actividad empresarial' } : { valor: 20, motivo: 'Persona física' };

  // 5) PEP / listas
  const estLN = norm(g('estatusListaNegra'));
  const esPEP = [g('esPEP', 'pep', 'personaPoliticamenteExpuesta'), g('conyugeFamiliarPEP')].some(v => v === true || /^(si|sí|true)$/i.test(String(v)));
  let pep: { valor: number; motivo: string };
  if (estLN.includes('positivo')) pep = { valor: 100, motivo: 'Coincidencia confirmada en listas (verificación PLD POSITIVO)' };
  else if (estLN.includes('revisi')) pep = { valor: 70, motivo: 'Coincidencia en listas pendiente de resolver (EN REVISIÓN)' };
  else if (esPEP) pep = { valor: 80, motivo: 'Persona Políticamente Expuesta o familiar de PEP' };
  else if (estLN.includes('negativo')) pep = { valor: 0, motivo: 'Verificación PLD sin coincidencias' };
  else pep = { valor: 40, motivo: 'Sin verificación PLD registrada' };

  const factores = { actividadEconomica: actividad, residencia, nacionalidad, tipoPersona, pepListasNegras: pep };
  const total = Math.round((Object.keys(PONDERACION) as FactorRiesgo[])
    .reduce((s, k) => s + factores[k].valor * PONDERACION[k], 0) * 100) / 100;
  // Coincidencia confirmada en listas: riesgo alto aunque el promedio salga menor.
  const nivel: ResultadoRiesgo['nivel'] = pep.valor === 100 || total >= 70 ? 'Alto' : total >= 40 ? 'Medio' : 'Bajo';
  return { factores, total, nivel };
}
