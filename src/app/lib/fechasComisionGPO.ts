/**
 * fechasComisionGPO.ts — fechas de cobro de la comisión de Garantía Financiera
 * 2º Piso. Compartido por los tres puntos que generan el mismo calendario:
 * el Cierre Comercial de la Oportunidad, la Cotización de la Solicitud y el
 * Calendario de Comisiones de Banca 2º Piso.
 *
 * Corrige dos defectos que tenían las tres implementaciones por separado:
 *
 *  1. **Ancla movible.** Cada una arrancaba en `new Date()`, así que las fechas
 *     dependían del día en que alguien picara el botón: recotizar al día
 *     siguiente recorría todo el calendario. Ahora se ancla a una fecha de
 *     inicio explícita (la de la línea/emisión) y sólo cae a "hoy" si no hay.
 *
 *  2. **Desbordamiento de fin de mes.** Sumaban meses de forma iterativa sobre
 *     el resultado anterior con `new Date(y, m + n, d)`. Partiendo de un 31 de
 *     agosto, "31 de noviembre" no existe y JavaScript lo rueda al 1 de
 *     diciembre; a partir de ahí el día queda pegado en 01 y, en mensual, la
 *     fecha se va corriendo mes con mes. Aquí cada periodo se calcula desde el
 *     ancla original (no encadenado, así no se acumula el error) y el día se
 *     recorta al último del mes destino cuando no existe.
 */

/** Último día del mes (1-12) de un año dado. */
function ultimoDiaDelMes(anio: number, mesIndice0: number): number {
  return new Date(anio, mesIndice0 + 1, 0).getDate();
}

/**
 * Suma `meses` a una fecha conservando el día de cobro.
 *
 * Si el día no existe en el mes destino (31 → abril, 30 → febrero) se recorta
 * al último día de ese mes, en vez de rodar al mes siguiente. Así un cobro
 * pactado "el 31" cae 30-abr y 28-feb, y vuelve a 31 cuando el mes lo permite.
 */
export function sumarMesesConservandoDia(base: Date, meses: number): Date {
  const anio = base.getFullYear();
  const mes = base.getMonth() + meses;
  const diaDeseado = base.getDate();
  const anioDestino = anio + Math.floor(mes / 12);
  const mesDestino = ((mes % 12) + 12) % 12;
  const dia = Math.min(diaDeseado, ultimoDiaDelMes(anioDestino, mesDestino));
  return new Date(anioDestino, mesDestino, dia);
}

/** Parsea 'YYYY-MM-DD' o 'DD/MM/YYYY' a Date local. `null` si no es válida. */
export function parseFechaAncla(valor?: string | null): Date | null {
  if (!valor) return null;
  const s = String(valor).trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  const libre = new Date(s);
  return isNaN(libre.getTime()) ? null : libre;
}

/** Date → 'YYYY-MM-DD' en hora local (evita el corrimiento de `toISOString`). */
export function aISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Fechas de cobro de la comisión.
 *
 * @param totalPeriodos   cuántos cobros generar
 * @param periodosPorAnio 12 mensual · 4 trimestral · 2 semestral · 1 anual
 * @param fechaInicio     inicio de la línea/emisión. Si falta, se usa hoy.
 * @returns               fechas 'YYYY-MM-DD'; el primer cobro vence un periodo
 *                        DESPUÉS del inicio (la comisión se devenga y luego se
 *                        cobra), no el mismo día del arranque.
 */
export function fechasCobroComision(
  totalPeriodos: number,
  periodosPorAnio: number,
  fechaInicio?: string | null,
): string[] {
  if (totalPeriodos <= 0 || periodosPorAnio <= 0) return [];
  const ancla = parseFechaAncla(fechaInicio) ?? new Date();
  const mesesPorPeriodo = 12 / periodosPorAnio;

  const fechas: string[] = [];
  for (let i = 1; i <= totalPeriodos; i++) {
    // Desde el ancla original en cada vuelta — encadenar acumularía el recorte.
    fechas.push(aISO(sumarMesesConservandoDia(ancla, mesesPorPeriodo * i)));
  }
  return fechas;
}
