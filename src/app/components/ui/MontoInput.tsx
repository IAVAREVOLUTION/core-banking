/**
 * MontoInput — campo de captura de montos con separador de miles.
 *
 * Reemplazo directo de `<input type="number">` / `<input type="text">` en los
 * campos de dinero: acepta las mismas props que un <input>.
 *
 *  · Fuera de foco muestra el monto con comas: 100000.00 → "100,000.00".
 *  · Al entrar a editar muestra el número limpio, sin comas.
 *  · Al teclear, `e.target.value` llega SIN comas (sólo dígitos, un punto y
 *    signo), así que los `onChange` existentes —`parseFloat(e.target.value)`,
 *    `+e.target.value`, etc.— siguen funcionando igual.
 *
 * El formato es SÓLO de presentación: el estado de cada pantalla conserva el
 * número sin comas. Varios guardados leen los montos con `parseFloat` directo
 * y "100,000.00" se volvería 100.
 *
 * Respeta los decimales que trae el valor: "100000.00" → "100,000.00",
 * "100000" → "100,000".
 */
import { forwardRef, useState, type ElementType, type InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value'> & {
  value: string | number | null | undefined;
  /** Input a renderizar — p. ej. el <Input> de ui/input para conservar su estilo. */
  componente?: ElementType;
};

/** Quita todo lo que no sea número: comas, "$", espacios, letras. */
export function limpiarMonto(v: string): string {
  const s = v.replace(/[^0-9.-]/g, '');
  const neg = s.startsWith('-') ? '-' : '';
  const [ent, ...dec] = s.replace(/-/g, '').split('.');
  return neg + ent + (dec.length ? '.' + dec.join('') : '');
}

/** "100000.5" → "100,000.5". Si no es número, lo devuelve tal cual. */
export function formatearMiles(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const raw = String(v).trim();
  if (raw === '') return '';
  const limpio = limpiarMonto(raw);
  const n = Number(limpio);
  if (limpio === '' || limpio === '-' || !Number.isFinite(n)) return raw;
  const decimales = Math.min(6, (limpio.split('.')[1] || '').length);
  return n.toLocaleString('es-MX', { minimumFractionDigits: decimales, maximumFractionDigits: Math.max(decimales, 2) });
}

export const MontoInput = forwardRef<HTMLInputElement, Props>(function MontoInput(
  { value, onChange, onFocus, onBlur, componente: Componente = 'input', step: _step, min: _min, max: _max, ...rest },
  ref,
) {
  const [foco, setFoco] = useState(false);
  const raw = value === null || value === undefined ? '' : String(value);

  return (
    <Componente
      {...rest}
      ref={ref}
      type="text"
      inputMode="decimal"
      value={foco ? raw : formatearMiles(raw)}
      onFocus={(e: React.FocusEvent<HTMLInputElement>) => { setFoco(true); onFocus?.(e); }}
      onBlur={(e: React.FocusEvent<HTMLInputElement>) => { setFoco(false); onBlur?.(e); }}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
        const limpio = limpiarMonto(e.target.value);
        if (limpio !== e.target.value) e.target.value = limpio;
        onChange?.(e);
      }}
    />
  );
});
