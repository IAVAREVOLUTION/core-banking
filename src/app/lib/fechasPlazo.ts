/**
 * fechasPlazo.ts — Fecha Fin a partir de Fecha Inicio, Plazo y Frecuencia.
 *
 * La Frecuencia de Términos y Condiciones es el PERIODO con el que se mide el
 * Plazo: Fecha Fin = Fecha Inicio + Plazo × días del periodo (catálogo
 * CAT_FRECUENCIA: Semanal 7, Catorcenal 14, Quincenal 15, Mensual 30,
 * Trimestral 90, Semestral 180, Anual 360). Lo usan el alta de la disposición
 * y la Solicitud, para que ambas den la misma fecha.
 */
import { CAT_FRECUENCIA } from '../components/solicitudes/solicitudCreditoStore';

/** dd/mm/aaaa → Date a mediodía (no cruza de día por zona horaria). */
export function dmyADate(v: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const dateADmy = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

export const dateAIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** dd/mm/aaaa → yyyy-mm-dd ('' si no es fecha). */
export function dmyAIso(v: string): string {
  const d = dmyADate(v);
  return d ? dateAIso(d) : '';
}

/** Días del periodo de una Frecuencia del catálogo (0 si no se reconoce). */
export function diasDeFrecuencia(frecuencia: string): number {
  const f = String(frecuencia || '').trim().toLowerCase();
  return CAT_FRECUENCIA.find(x => x.value.toLowerCase() === f)?.dias || 0;
}

/** Fecha Fin = Fecha Inicio + Plazo × Días del Periodo. '' si falta un dato. */
export function calcularFechaFin(fechaInicioDmy: string, plazo: number, diasPeriodo: number): string {
  const ini = dmyADate(fechaInicioDmy);
  if (!ini || !(plazo > 0) || !(diasPeriodo > 0)) return '';
  return dateADmy(new Date(ini.getTime() + plazo * diasPeriodo * 86_400_000));
}
