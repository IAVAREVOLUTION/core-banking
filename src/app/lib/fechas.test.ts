import { describe, it, expect } from 'vitest';
import { formatearFecha, formatearFechaHora } from './fechas';

describe('fechas', () => {
  it('normaliza los formatos que guarda el sistema a dd/mm/aaaa', () => {
    expect(formatearFecha('2026-10-08')).toBe('08/10/2026');
    expect(formatearFecha('8/10/2026')).toBe('08/10/2026');
    expect(formatearFecha('08/10/2026 14:05:09')).toBe('08/10/2026');
    expect(formatearFecha(new Date(2026, 0, 5))).toBe('05/01/2026');
    expect(formatearFecha('')).toBe('');
    expect(formatearFecha('Sin fecha')).toBe('Sin fecha');
  });
  it('fecha y hora', () => {
    expect(formatearFechaHora(new Date(2026, 9, 8, 9, 5, 3))).toBe('08/10/2026 09:05:03');
  });
});
