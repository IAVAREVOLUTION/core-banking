import { describe, it, expect } from 'vitest';
import { decidirFaseIA } from './decisionFaseIA';

describe('decidirFaseIA', () => {
  it('aprueba con sólo OK y ADVERTENCIA aunque la IA diga false', () => {
    const r = decidirFaseIA({ valido: false, motivos: ['OK: INE vigente', 'OK: nombre coincide', 'ADVERTENCIA: comprobante a nombre de tercero'], faltantes: ['comprobante'] });
    expect(r.valido).toBe(true);
    expect(r.faltantes).toEqual([]);
    expect(r.motivosOrdenados[0]).toMatch(/^ADVERTENCIA/);
  });
  it('rechaza si hay algún RECHAZO y lo pone primero', () => {
    const r = decidirFaseIA({ valido: true, motivos: ['OK: INE', 'RECHAZO: falta acta'] });
    expect(r.valido).toBe(false);
    expect(r.motivosOrdenados[0]).toBe('RECHAZO: falta acta');
  });
  it('sin etiquetas respeta la decisión de la IA', () => {
    expect(decidirFaseIA({ valido: false, motivos: ['Falta INE'] }).valido).toBe(false);
    expect(decidirFaseIA({ valido: true, motivos: [] }).valido).toBe(true);
  });
});
