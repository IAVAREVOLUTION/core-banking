/**
 * Formato único de fechas para mostrar en pantalla: "dd/mm/aaaa" y
 * "dd/mm/aaaa hh:mm:ss". Acepta lo que guarda el sistema: Date, ISO
 * ("aaaa-mm-dd" o con hora), "d/m/aaaa", "dd/mm/aaaa" y timestamps.
 * Si no reconoce el valor lo devuelve tal cual (nunca rompe la pantalla).
 */
const p2 = (n: number) => String(n).padStart(2, '0');

export function aFecha(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
  const s = String(v).trim();
  // dd/mm/aaaa (opcionalmente con hora)
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  // aaaa-mm-dd sin hora: fecha local (evita que el huso horario la mueva un día)
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "dd/mm/aaaa" */
export function formatearFecha(v: unknown): string {
  const d = aFecha(v);
  if (!d) return v == null ? '' : String(v);
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "dd/mm/aaaa hh:mm:ss" */
export function formatearFechaHora(v: unknown): string {
  const d = aFecha(v);
  if (!d) return v == null ? '' : String(v);
  return `${formatearFecha(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
}
