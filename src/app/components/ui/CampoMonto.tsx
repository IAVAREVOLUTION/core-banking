/**
 * Campo de monto con separador de miles en vivo ("1,250,000.50").
 *
 * Sustituye a <input type="number"> en campos de dinero: muestra las comas
 * mientras se escribe (conservando la posición del cursor) y entrega al
 * onChange el valor SIN comas ("1250000.50"), así los handlers existentes
 * (parseFloat(e.target.value), etc.) siguen funcionando igual.
 */
import { useLayoutEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import type React from 'react';

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'defaultValue'>;
export interface CampoMontoProps extends Base {
  value: string | number | null | undefined;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Decimales permitidos y mostrados al salir del campo (default 2). */
  decimales?: number;
  permitirNegativos?: boolean;
}

/** "1234567.5" → "1,234,567.5" (respeta lo tecleado en la parte decimal). */
export function agruparMiles(raw: string): string {
  if (!raw) return '';
  const neg = raw.startsWith('-');
  const sinSigno = neg ? raw.slice(1) : raw;
  const [ent, dec] = sinSigno.split('.');
  const entero = (ent || '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + (entero || (dec !== undefined ? '0' : '')) + (dec !== undefined ? '.' + dec : '');
}

/** Limpia lo tecleado y devuelve el valor numérico en texto, sin comas. */
export function limpiarMonto(texto: string, decimales = 2, permitirNegativos = false): string {
  let t = texto.replace(/[^0-9.-]/g, '');
  const neg = permitirNegativos && t.startsWith('-');
  t = t.replace(/-/g, '');
  if (decimales === 0) t = t.replace(/\./g, '');
  const i = t.indexOf('.');
  if (i >= 0) t = t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '').slice(0, decimales);
  return (neg ? '-' : '') + t;
}

function aTexto(v: CampoMontoProps['value']): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[$,\s]/g, '');
}

function formatoFijo(raw: string, decimales: number): string {
  if (raw === '' || raw === '-') return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return n.toLocaleString('en-US', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
}

export function CampoMonto({ value, onChange, onFocus, onBlur, decimales = 2, permitirNegativos = false, className, ...resto }: CampoMontoProps) {
  const ref = useRef<HTMLInputElement>(null);
  const [enfocado, setEnfocado] = useState(false);
  const [texto, setTexto] = useState('');
  const cursor = useRef<number | null>(null);

  const raw = aTexto(value);
  const mostrado = enfocado ? texto : formatoFijo(raw, decimales);

  useLayoutEffect(() => {
    if (cursor.current !== null && ref.current && document.activeElement === ref.current) {
      ref.current.setSelectionRange(cursor.current, cursor.current);
      cursor.current = null;
    }
  });

  const emitir = (valor: string, original: React.SyntheticEvent<HTMLInputElement>, cb?: (e: any) => void) => {
    if (!cb) return;
    const destino = { value: valor, name: resto.name, id: resto.id, type: 'text' };
    cb({
      ...original,
      target: destino,
      currentTarget: destino,
      preventDefault: () => original.preventDefault(),
      stopPropagation: () => original.stopPropagation(),
      persist: () => undefined,
    });
  };

  return (
    <input
      {...resto}
      ref={ref}
      type="text"
      inputMode={decimales > 0 ? 'decimal' : 'numeric'}
      className={`${className || ''} text-right`.trim()}
      value={mostrado}
      onFocus={e => {
        setEnfocado(true);
        const inicial = agruparMiles(raw);
        setTexto(inicial);
        // Con 0 o vacío, seleccionar para que lo tecleado reemplace (evita "05").
        // Sólo si aún no se ha tecleado nada: el rAF puede llegar después de la primera tecla.
        if (Number(raw || 0) === 0) {
          requestAnimationFrame(() => {
            if (ref.current && document.activeElement === ref.current && ref.current.value === inicial) ref.current.select();
          });
        }
        onFocus?.(e);
      }}
      onChange={e => {
        const tecleado = e.target.value;
        const pos = e.target.selectionStart ?? tecleado.length;
        // Cuántos caracteres significativos (dígitos, punto, signo) hay antes del cursor
        const significativos = tecleado.slice(0, pos).replace(/[^0-9.-]/g, '').length;
        const limpio = limpiarMonto(tecleado, decimales, permitirNegativos);
        const agrupado = agruparMiles(limpio);
        let k = 0, nuevaPos = 0;
        while (nuevaPos < agrupado.length && k < significativos) {
          if (/[0-9.-]/.test(agrupado[nuevaPos])) k++;
          nuevaPos++;
        }
        cursor.current = nuevaPos;
        setTexto(agrupado);
        emitir(limpio, e, onChange);
      }}
      onBlur={e => {
        setEnfocado(false);
        // Lo tecleado (sin comas): hay campos que sólo guardan el valor al salir.
        emitir(limpiarMonto(texto, decimales, permitirNegativos), e, onBlur);
      }}
    />
  );
}
