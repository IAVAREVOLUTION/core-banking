import { describe, it, expect } from 'vitest';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DatePicker, isoADmy, dmyAIso } from './DatePicker';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('DatePicker — conversiones', () => {
  it('ISO ↔ dd/mm/aaaa', () => {
    expect(isoADmy('2026-10-08')).toBe('08/10/2026');
    expect(isoADmy('2026-10-08T15:00:00Z')).toBe('08/10/2026');
    expect(isoADmy('')).toBe('');
    expect(dmyAIso('08/10/2026')).toBe('2026-10-08');
    expect(dmyAIso('31/02/2026')).toBe(''); // fecha inexistente
    expect(dmyAIso('8/10/2026')).toBe('');
  });
});

function teclear(input: HTMLInputElement, texto: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, texto);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('DatePicker formato ISO', () => {
  it('muestra dd/mm/aaaa y entrega aaaa-mm-dd sólo con fecha completa', async () => {
    const recibidos: string[] = [];
    function Prueba() {
      const [v, setV] = useState('2026-03-05');
      return <DatePicker formato="iso" value={v} onChange={x => { recibidos.push(x); setV(x); }} />;
    }
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => root.render(<Prueba />));
    const input = div.querySelector('input')!;
    expect(input.value).toBe('05/03/2026');
    await act(async () => { input.focus(); });
    await act(async () => teclear(input, '12/0'));
    expect(recibidos).toEqual([]); // incompleta: no se entrega
    await act(async () => teclear(input, '12/04/2026'));
    expect(recibidos).toEqual(['2026-04-12']);
    root.unmount();
  });
});
