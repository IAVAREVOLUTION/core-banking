import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { toast as rt } from 'react-toastify';
import { toast, Toaster } from './notificaciones';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const espera = (ms: number) => new Promise(r => setTimeout(r, ms));

describe('notificaciones', () => {
  it('un "cargando" cerrado no reaparece aunque haya muchos avisos en pantalla', async () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    await act(async () => root.render(<Toaster />));
    await act(async () => {
      for (let i = 0; i < 6; i++) toast.success(`Aviso ${i}`);
    });
    let id: any;
    await act(async () => { id = toast.loading('Renderizando PDF para validación IA...'); });
    await act(async () => { await espera(50); });
    expect(rt.isActive(id)).toBe(true); // se muestra de inmediato, no queda en cola
    await act(async () => { toast.dismiss(id); await espera(50); });
    expect(rt.isActive(id)).toBe(false);
    root.unmount();
  });
});
