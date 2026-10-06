import { describe, it, expect, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { aComparable, compararValores, coincideBusqueda, useOrdenTabla } from './ordenTabla';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const ordenar = (xs: unknown[]) => [...xs].sort(compararValores);

describe('compararValores', () => {
  it('ordena fechas DD/MM/AAAA con hora, y lee el año de 4 dígitos (no "20")', () => {
    expect(ordenar(['05/10/2026 15:17:28', '30/09/2026 14:02', '05/10/2026 09:00', '24/08/23']))
      .toEqual(['24/08/23', '30/09/2026 14:02', '05/10/2026 09:00', '05/10/2026 15:17:28']);
  });

  it('ordena fechas ISO', () => {
    expect(ordenar(['2026-10-05', '2025-12-31', '2026-02-28T10:00:00Z']))
      .toEqual(['2025-12-31', '2026-02-28T10:00:00Z', '2026-10-05']);
  });

  it('ordena montos y porcentajes como números', () => {
    expect(ordenar(['$1,250,000.00', '$850,000.00', '$10,800', '$0.00'])).toEqual(['$0.00', '$10,800', '$850,000.00', '$1,250,000.00']);
    expect(ordenar(['12.5%', '3%', '100%'])).toEqual(['3%', '12.5%', '100%']);
  });

  it('usa orden natural en folios y no distingue acentos/mayúsculas', () => {
    expect(ordenar(['PROS-10', 'PROS-9', 'PROS-2'])).toEqual(['PROS-2', 'PROS-9', 'PROS-10']);
    expect(ordenar(['Zacatecas', 'ávila', 'Bernal', 'alvarez'])).toEqual(['alvarez', 'ávila', 'Bernal', 'Zacatecas']);
  });

  it('manda los vacíos al final', () => {
    expect(ordenar(['', 'b', null, 'a', '—', undefined])).toEqual(['a', 'b', '', null, '—', undefined]);
    expect(aComparable('N/A')).toBeNull();
  });
});

describe('coincideBusqueda', () => {
  it('ignora acentos y mayúsculas y exige todas las palabras', () => {
    expect(coincideBusqueda('garcia cdmx', ['María García', 'CDMX'])).toBe(true);
    expect(coincideBusqueda('garcia monterrey', ['María García', 'CDMX'])).toBe(false);
    expect(coincideBusqueda('   ', ['x'])).toBe(true);
  });
});

describe('useOrdenTabla', () => {
  const filas = [
    { id: 'PROS-9', fecha: '30/09/2026 14:02' },
    { id: 'PROS-10', fecha: '05/10/2026 09:00' },
    { id: 'PROS-11', fecha: '05/10/2026 09:00' },
    { id: 'PROS-8', fecha: '' },
  ];
  let estado: ReturnType<typeof useOrdenTabla<(typeof filas)[number]>>;
  function Tabla() {
    estado = useOrdenTabla(filas, {
      id: 'test', columnas: { id: f => f.id, fecha: f => f.fecha },
      porDefecto: { campo: 'fecha', dir: 'desc' }, desempate: f => f.id,
    });
    return null;
  }
  const montar = async () => {
    const root = createRoot(document.createElement('div'));
    await act(async () => root.render(<Tabla />));
    return root;
  };

  beforeEach(() => localStorage.clear());

  it('arranca con lo más reciente primero, desempata por consecutivo y deja sin fecha al final', async () => {
    await montar();
    expect(estado.filas.map(f => f.id)).toEqual(['PROS-11', 'PROS-10', 'PROS-9', 'PROS-8']);
  });

  it('alterna la dirección al ordenar dos veces la misma columna y recuerda la elección', async () => {
    const root = await montar();
    await act(async () => estado.ordenar('id'));
    expect(estado.filas.map(f => f.id)).toEqual(['PROS-8', 'PROS-9', 'PROS-10', 'PROS-11']);
    await act(async () => estado.ordenar('id'));
    expect(estado.dir).toBe('desc');
    await act(async () => root.unmount());
    await montar();
    expect([estado.campo, estado.dir]).toEqual(['id', 'desc']);
  });

  it('th() conserva estilos propios (p. ej. ancho redimensionable)', async () => {
    await montar();
    expect(estado.th('id', { width: '90px' }).style).toMatchObject({ width: '90px', cursor: 'pointer' });
  });
});
