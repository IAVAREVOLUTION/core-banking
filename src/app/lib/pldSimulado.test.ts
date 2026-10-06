import { describe, it, expect } from 'vitest';
import { verificarListasPLD, estatusGeneralPLD, validarDatosPLD, LISTAS_PLD, type RegistroPLD } from './pldSimulado';

const F = new Date('2026-10-06T12:00:00Z');
const muestra = Array.from({ length: 500 }, (_, i) => ({ tipoPersona: 'PF' as const, rfc: `ABCD8001${String(i).padStart(2, '0')}X${i % 10}A`, nombre: `PERSONA ${i} GÓMEZ` }));

describe('pldSimulado', () => {
  it('revisa todas las listas aplicables con un mismo folio', () => {
    const pf = verificarListasPLD(muestra[0], 'admin', F);
    expect(pf).toHaveLength(LISTAS_PLD.length);
    expect(new Set(pf.map(r => r.folio)).size).toBe(1);
    const pm = verificarListasPLD({ tipoPersona: 'PM', rfc: 'GNA850101AB1', nombre: 'Gobierno Nayarit' }, 'admin', F);
    expect(pm.some(r => r.claveLista === 'PEP')).toBe(false);
  });

  it('es determinístico y produce los tres resultados en una muestra', () => {
    expect(verificarListasPLD(muestra[3], 'a', F).map(r => r.estatus)).toEqual(verificarListasPLD(muestra[3], 'a', F).map(r => r.estatus));
    const generales = muestra.map(d => estatusGeneralPLD(verificarListasPLD(d, 'a', F)));
    const n = (e: string) => generales.filter(g => g === e).length;
    expect(n('NEGATIVO')).toBeGreaterThan(350);
    expect(n('EN REVISIÓN')).toBeGreaterThan(20);
    expect(n('POSITIVO')).toBeGreaterThan(5);
  });

  it('el estatus general usa sólo la verificación más reciente y respeta resoluciones', () => {
    const vieja: RegistroPLD[] = [{ id: 1, fechaHora: '', usuario: '', folio: 'A', nombreLista: 'x', tipoLista: 'Externa', estatus: 'COINCIDENCIA' }];
    const nueva: RegistroPLD[] = [{ id: 2, fechaHora: '', usuario: '', folio: 'B', nombreLista: 'x', tipoLista: 'Externa', estatus: 'NEGATIVO' }];
    expect(estatusGeneralPLD([...vieja, ...nueva])).toBe('NEGATIVO');
    expect(estatusGeneralPLD(vieja)).toBe('EN REVISIÓN');
    expect(estatusGeneralPLD([{ ...vieja[0], estatus: 'POSITIVO' }])).toBe('POSITIVO');
    expect(estatusGeneralPLD([])).toBeNull();
  });

  it('pide nombre y RFC', () => {
    expect(validarDatosPLD({ tipoPersona: 'PM', rfc: '', nombre: '' })).toEqual(['Razón social', 'RFC']);
  });
});
