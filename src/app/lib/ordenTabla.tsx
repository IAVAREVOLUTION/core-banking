/**
 * Orden uniforme para las tablas de registros.
 *
 *   const orden = useOrdenTabla(filtrados, {
 *     id: 'prospectos',                                   // recuerda la elección
 *     columnas: { fecha: p => p.fechaOriginacion, nombre: p => p.nombre },
 *     porDefecto: { campo: 'fecha', dir: 'desc' },        // más recientes primero
 *     desempate: p => p.idProspecto,                      // consecutivo
 *   });
 *   …orden.filas…                                         // en lugar de `filtrados`
 *   <th className="…" {...orden.th('nombre')}>NOMBRE{orden.flecha('nombre')}</th>
 *
 * Compara según lo que el valor parece ser: fechas (DD/MM/AAAA[ HH:MM[:SS]],
 * ISO), montos y porcentajes ("$1,234.50", "12.5%"), números, y texto con
 * orden natural ("PROS-9" < "PROS-10"). Los vacíos siempre van al final.
 */
import { useMemo, useState, type AriaAttributes, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';

export type DirOrden = 'asc' | 'desc';

const normalizar = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * Búsqueda de las tablas: sin distinguir mayúsculas ni acentos, por varias
 * palabras (todas deben aparecer, en cualquier columna). "garcia cdmx" encuentra
 * a "García" de la sucursal "CDMX".
 */
export function coincideBusqueda(texto: string, valores: unknown[]): boolean {
  const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return true;
  const pajar = valores.map(normalizar).join(' | ');
  return palabras.every(p => pajar.includes(p));
}
type Comparable = { t: 0; v: number } | { t: 1; v: string } | null;

const RE_DMY = /^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/;
const RE_ISO = /^\d{4}-\d{2}-\d{2}/;
const RE_NUM = /^[-+]?\$?\s*-?[\d,]*\.?\d+\s*%?$/;

export function aComparable(v: unknown): Comparable {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? { t: 0, v } : null;
  if (typeof v === 'boolean') return { t: 0, v: v ? 1 : 0 };
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : { t: 0, v: v.getTime() };
  const s = String(v).trim();
  if (!s || s === '—' || s === '-' || s === 'N/A') return null;
  const dmy = s.match(RE_DMY);
  if (dmy) {
    const [, d, m, y, h = '0', mi = '0', se = '0'] = dmy;
    const anio = y.length === 2 ? 2000 + Number(y) : Number(y);
    return { t: 0, v: new Date(anio, Number(m) - 1, Number(d), Number(h), Number(mi), Number(se)).getTime() };
  }
  if (RE_ISO.test(s)) {
    const ms = Date.parse(s.length === 10 ? `${s}T00:00:00` : s);
    if (!Number.isNaN(ms)) return { t: 0, v: ms };
  }
  if (RE_NUM.test(s)) {
    const n = Number(s.replace(/[$,%\s]/g, ''));
    if (Number.isFinite(n)) return { t: 0, v: n };
  }
  return { t: 1, v: s };
}

const colador = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

/** Compara dos valores en orden ascendente; los vacíos van al final. */
export function compararValores(a: unknown, b: unknown): number {
  const x = aComparable(a);
  const y = aComparable(b);
  if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
  if (x.t === 0 && y.t === 0) return x.v - y.v;
  if (x.t !== y.t) return x.t - y.t; // números/fechas antes que texto
  return colador.compare(String(x.v), String(y.v));
}

interface Opciones<T> {
  /** Identificador para recordar el orden elegido (localStorage). */
  id: string;
  /** Valor ordenable de cada columna. */
  columnas: Record<string, (fila: T) => unknown>;
  /** Orden inicial; normalmente la fecha de alta, descendente. */
  porDefecto: { campo: string; dir: DirOrden };
  /** Criterio de desempate (p. ej. consecutivo); se aplica en la misma dirección. */
  desempate?: (fila: T) => unknown;
  /** Se llama al cambiar el orden (p. ej. para volver a la página 1). */
  alCambiar?: () => void;
}

function leerGuardado(id: string): { campo: string; dir: DirOrden } | null {
  try {
    const raw = localStorage.getItem(`orden-tabla:${id}`);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v.campo === 'string' && (v.dir === 'asc' || v.dir === 'desc') ? v : null;
  } catch { return null; }
}

export function useOrdenTabla<T>(filas: T[], op: Opciones<T>) {
  const [orden, setOrden] = useState(() => {
    const g = leerGuardado(op.id);
    return g && op.columnas[g.campo] ? g : op.porDefecto;
  });

  const ordenadas = useMemo(() => {
    const valor = op.columnas[orden.campo];
    if (!valor) return filas;
    const signo = orden.dir === 'asc' ? 1 : -1;
    const desempate = op.desempate;
    // Orden estable: a igualdad, se conserva el orden original.
    return filas
      .map((f, i) => ({ f, i }))
      .sort((A, B) => {
        const va = valor(A.f), vb = valor(B.f);
        // Los vacíos van al final en ambas direcciones.
        const ca = aComparable(va), cb = aComparable(vb);
        if (ca === null || cb === null) {
          if (ca !== cb) return ca === null ? 1 : -1;
        } else {
          const c = compararValores(va, vb);
          if (c !== 0) return signo * c;
        }
        if (desempate) {
          const d = compararValores(desempate(A.f), desempate(B.f));
          if (d !== 0) return signo * d;
        }
        return A.i - B.i;
      })
      .map(x => x.f);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, orden.campo, orden.dir]);

  const fijar = (campo: string, dir: DirOrden) => {
    const nuevo = { campo, dir };
    try { localStorage.setItem(`orden-tabla:${op.id}`, JSON.stringify(nuevo)); } catch { /* sin storage */ }
    setOrden(nuevo);
    op.alCambiar?.();
  };

  /** Clic en un encabezado: otra columna empieza ascendente; la misma alterna. */
  const ordenar = (campo: string) =>
    fijar(campo, orden.campo === campo ? (orden.dir === 'asc' ? 'desc' : 'asc') : 'asc');

  const ESTILO_TH: CSSProperties = { cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };

  /** Props para el <th>: clic para ordenar, accesible por teclado. `estilo` se combina (p. ej. anchos). */
  const th = (campo: string, estilo?: CSSProperties) => ({
    onClick: () => ordenar(campo),
    onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ordenar(campo); } },
    tabIndex: 0,
    role: 'columnheader',
    'aria-sort': (orden.campo === campo ? (orden.dir === 'asc' ? 'ascending' : 'descending') : 'none') as AriaAttributes['aria-sort'],
    title: 'Ordenar por esta columna',
    style: { ...estilo, ...ESTILO_TH },
  });

  /** Indicador ▲/▼ junto al título de la columna. */
  const flecha = (campo: string): ReactNode => {
    const activo = orden.campo === campo;
    return (
      <span aria-hidden="true" style={{ display: 'inline-flex', flexDirection: 'column', marginLeft: 4, verticalAlign: 'middle', lineHeight: 0, gap: 1 }}>
        <svg width="7" height="5" viewBox="0 0 8 5" style={{ opacity: activo && orden.dir === 'asc' ? 1 : 0.3 }}><path d="M4 0l4 5H0z" fill="currentColor" /></svg>
        <svg width="7" height="5" viewBox="0 0 8 5" style={{ opacity: activo && orden.dir === 'desc' ? 1 : 0.3 }}><path d="M4 5L0 0h8z" fill="currentColor" /></svg>
      </span>
    );
  };

  /** Volver al orden por defecto (más recientes primero). */
  const restablecer = () => {
    try { localStorage.removeItem(`orden-tabla:${op.id}`); } catch { /* sin storage */ }
    setOrden(op.porDefecto);
    op.alCambiar?.();
  };

  return { filas: ordenadas, campo: orden.campo, dir: orden.dir, ordenar, fijar, th, flecha, restablecer };
}
