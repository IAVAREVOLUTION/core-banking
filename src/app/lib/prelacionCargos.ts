/**
 * prelacionCargos — la "Prelación de cargos" del Taller de Productos traducida
 * a los conceptos con que se arman los Avisos de Vencimiento.
 *
 * El producto guarda la prelación como texto libre ("Interés Ordinario",
 * "Iva Interés", "CAPITAL"…, elegido del catálogo de Componentes Contables).
 * Los avisos de crédito usan claves fijas en J_FACTURAS_DETALLE
 * (CAPITAL, INTERES, IVA_INT, SEGURO, IVA_SEG). Aquí se cruzan ambos.
 *
 * Se usa en dos momentos:
 *   1. Al GENERAR un aviso: sus líneas se registran en el orden de prelación.
 *   2. Al APLICAR un pago: cada línea se paga en ese mismo orden.
 */

export interface FilaPrelacion {
  ordenAplicacion?: string | number;
  productosCargos?: string;
}

/** Conceptos de un aviso de crédito y su descripción por omisión. */
export const CONCEPTOS_AVISO: Record<string, string> = {
  MORATORIO: 'Interés Moratorio',
  IVA_MORA: 'IVA Interés Moratorio',
  COMISION: 'Comisión',
  IVA_COM: 'IVA Comisión',
  INTERES: 'Interés',
  IVA_INT: 'IVA Interés',
  SEGURO: 'Seguro',
  IVA_SEG: 'IVA Seguro',
  CAPITAL: 'Capital',
};

/**
 * Orden por omisión cuando el producto no configura un concepto:
 * accesorios primero, capital al final (criterio habitual de prelación).
 */
const ORDEN_DEFAULT = ['MORATORIO', 'IVA_MORA', 'COMISION', 'IVA_COM', 'INTERES', 'IVA_INT', 'SEGURO', 'IVA_SEG', 'CAPITAL'];

const norm = (v: unknown) =>
  String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Nombre del Taller ("Iva Interés", "CAPITAL"…) → clave del aviso. */
export function claveConcepto(nombre: string): string {
  const n = norm(nombre);
  if (!n) return '';
  const iva = /\biva\b/.test(n);
  if (n.includes('capital')) return 'CAPITAL';
  if (n.includes('seguro')) return iva ? 'IVA_SEG' : 'SEGURO';
  if (n.includes('moratorio')) return iva ? 'IVA_MORA' : 'MORATORIO';
  if (n.includes('comision')) return iva ? 'IVA_COM' : 'COMISION';
  if (n.includes('interes')) return iva ? 'IVA_INT' : 'INTERES';
  if (iva) return 'IVA_INT'; // "IVA" a secas: en crédito, el IVA del interés
  return n.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 30);
}

/**
 * Prelación del producto → { clave: orden } (1 = se paga primero).
 * Si un concepto aparece dos veces ("Interés Ordinario" e "Interés") manda la
 * primera aparición. Los conceptos que el producto no menciona van después,
 * en el orden por omisión.
 */
export function mapaPrelacion(prelacion: FilaPrelacion[] | null | undefined): Record<string, number> {
  const filas = (Array.isArray(prelacion) ? prelacion : [])
    .map((f, i) => ({ f, i, o: parseFloat(String(f?.ordenAplicacion ?? '')) }))
    .sort((a, b) => {
      const oa = Number.isFinite(a.o) ? a.o : Number.MAX_SAFE_INTEGER;
      const ob = Number.isFinite(b.o) ? b.o : Number.MAX_SAFE_INTEGER;
      return oa !== ob ? oa - ob : a.i - b.i;
    });
  const mapa: Record<string, number> = {};
  let k = 1;
  for (const { f } of filas) {
    const clave = claveConcepto(String(f?.productosCargos || ''));
    if (clave && mapa[clave] === undefined) mapa[clave] = k++;
  }
  for (const clave of ORDEN_DEFAULT) {
    if (mapa[clave] === undefined) mapa[clave] = k++;
  }
  return mapa;
}

/** Orden de prelación de una clave (las desconocidas, al final). */
export function ordenDe(clave: string, mapa: Record<string, number>): number {
  return mapa[clave] ?? 1000;
}

/** Nombre con que el producto llama al concepto (para el detalle del aviso). */
export function nombreEnProducto(clave: string, prelacion: FilaPrelacion[] | null | undefined): string {
  const fila = (Array.isArray(prelacion) ? prelacion : [])
    .find(f => claveConcepto(String(f?.productosCargos || '')) === clave);
  return String(fila?.productosCargos || '').trim() || CONCEPTOS_AVISO[clave] || clave;
}

/**
 * Conceptos de una amortización ordenados por la prelación del producto, en el
 * formato que acepta POST /cartera/facturas (`amortizaciones[].conceptos`).
 * El servidor inserta las líneas en este orden.
 */
export function conceptosAmortizacion(
  amort: { pago_capital?: number; pago_interes?: number; iva_interes?: number; pago_seguro?: number; iva_seguro?: number },
  prelacion: FilaPrelacion[] | null | undefined,
): { cve: string; desc: string; monto: number }[] {
  const mapa = mapaPrelacion(prelacion);
  const base: [string, number][] = [
    ['CAPITAL', Number(amort.pago_capital) || 0],
    ['INTERES', Number(amort.pago_interes) || 0],
    ['IVA_INT', Number(amort.iva_interes) || 0],
    ['SEGURO', Number(amort.pago_seguro) || 0],
    ['IVA_SEG', Number(amort.iva_seguro) || 0],
  ];
  return base
    .filter(([, monto]) => monto > 0)
    .sort((a, b) => ordenDe(a[0], mapa) - ordenDe(b[0], mapa))
    .map(([cve, monto]) => ({ cve, desc: nombreEnProducto(cve, prelacion), monto: Math.round(monto * 100) / 100 }));
}
