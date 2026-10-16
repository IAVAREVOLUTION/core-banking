import { describe, it, expect } from 'vitest';
import type { ArchivoAdjuntoOportunidad } from '../components/cotizaciones/cotizacionCreditoTypes';
import { normalizarVersiones, documentosConVersiones, agregarVersion, vigenteDeTipo, siguienteVersion } from './versionesKmOportunidad';

const doc = (id: string, tipo: string, fecha: string, extra: Partial<ArchivoAdjuntoOportunidad> = {}): ArchivoAdjuntoOportunidad => ({
  id, nombre: `${id}.pdf`, tipo, url: '', storagePath: '', tamanoKB: 1, fecha, usuario: 'demo', enStorage: true, ...extra,
});

describe('versionesKmOportunidad', () => {
  it('agrupa las Cartas Oferta anteriores al versionado como versiones', () => {
    const lista = [
      doc('a', 'Carta Oferta', '2026-10-16T10:00:00Z'),
      doc('b', 'Carta Oferta', '2026-10-16T11:00:00Z'),
      doc('c', 'Estados Financieros', '2026-10-16T09:00:00Z'),
    ];
    const n = normalizarVersiones(lista);
    expect(n.find(x => x.id === 'a')).toMatchObject({ version: '1.0', versionRaiz: 'a' });
    expect(n.find(x => x.id === 'b')).toMatchObject({ version: '2.0', versionRaiz: 'a' });
    expect(n.find(x => x.id === 'c')).toMatchObject({ version: '1.0', versionRaiz: 'c' });
    const grupos = documentosConVersiones(lista);
    expect(grupos).toHaveLength(2);
    expect(grupos[0].map(x => x.id)).toEqual(['b', 'a']);
  });

  it('una nueva versión conserva el historial y queda como vigente', () => {
    let lista = agregarVersion([], doc('f1', 'Carta Oferta Firmada', '2026-10-16T10:00:00Z'));
    lista = agregarVersion(lista, doc('f2', 'Carta Oferta Firmada', '2026-10-16T12:00:00Z'), lista[0]);
    expect(lista).toHaveLength(2);
    expect(lista[1]).toMatchObject({ version: '2.0', versionRaiz: 'f1', versionDe: 'f1' });
    expect(vigenteDeTipo(lista, 'Carta Oferta Firmada')?.id).toBe('f2');
    expect(siguienteVersion(lista, lista[0])).toBe('3.0');
  });

  it('documentos distintos no se mezclan', () => {
    const lista = agregarVersion(
      agregarVersion([], doc('x', 'Otro', '2026-10-16T10:00:00Z')),
      doc('y', 'Otro', '2026-10-16T11:00:00Z'),
    );
    expect(documentosConVersiones(lista)).toHaveLength(2);
  });
});
