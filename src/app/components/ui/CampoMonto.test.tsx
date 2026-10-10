import { describe, it, expect } from 'vitest';
import { agruparMiles, limpiarMonto } from './CampoMonto';

describe('CampoMonto', () => {
  it('agrupa miles respetando la parte decimal tecleada', () => {
    expect(agruparMiles('100000000')).toBe('100,000,000');
    expect(agruparMiles('1234567.5')).toBe('1,234,567.5');
    expect(agruparMiles('1234.')).toBe('1,234.');
    expect(agruparMiles('.5')).toBe('0.5');
    expect(agruparMiles('007')).toBe('7');
    expect(agruparMiles('-2500')).toBe('-2,500');
    expect(agruparMiles('')).toBe('');
  });
  it('limpia lo tecleado: comas, letras, puntos extra y decimales', () => {
    expect(limpiarMonto('1,234,5a6.789')).toBe('123456.78');
    expect(limpiarMonto('$ 12.3.4')).toBe('12.34');
    expect(limpiarMonto('-50')).toBe('50');
    expect(limpiarMonto('-50', 2, true)).toBe('-50');
    expect(limpiarMonto('12.9', 0)).toBe('129');
  });
});

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { CampoMonto } from './CampoMonto';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function teclear(input: HTMLInputElement, texto: string, cursor = texto.length) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  setter.call(input, texto);
  input.setSelectionRange(cursor, cursor);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('CampoMonto en el DOM', () => {
  it('muestra comas al escribir y entrega el valor sin comas', async () => {
    const recibidos: string[] = [];
    function Prueba() {
      const [v, setV] = useState('');
      return <CampoMonto value={v} onChange={e => { recibidos.push(e.target.value); setV(e.target.value); }} />;
    }
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => root.render(<Prueba />));
    const input = div.querySelector('input')!;
    await act(async () => { input.focus(); });
    await act(async () => teclear(input, '1234567'));
    expect(input.value).toBe('1,234,567');
    expect(recibidos[recibidos.length - 1]).toBe('1234567');
    // insertar un dígito en medio conserva el cursor tras el dígito insertado
    await act(async () => teclear(input, '1,2394,567', 5));
    expect(input.value).toBe('12,394,567');
    expect(input.selectionStart).toBe(5); // justo después del 9 insertado
    await act(async () => { input.blur(); });
    expect(input.value).toBe('12,394,567.00');
    root.unmount();
  });
});
