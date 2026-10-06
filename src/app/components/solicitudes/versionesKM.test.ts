import { describe, it, expect } from 'vitest';
import {
  siguienteVersion, documentosVigentes, versionToDB, versionFromDB, fechaHoraActual,
  type DocumentoCargado,
} from './solicitudCreditoStore';

const doc = (o: Partial<DocumentoCargado>): DocumentoCargado => ({
  id: 1, fecha: '01/10/2026 10:00:00', usuario: 'admin', tipoDocumento: 'INE', archivo: 'ine.pdf',
  tipoArchivo: 'PDF', nota: '', area: '', fase: 'Fase 1', faseId: 1, estatus: 'Validado', validadoIA: true,
  url: 'u', storagePath: 'p', ...o,
});

describe('REQ-03 · versiones del KM Digital', () => {
  it('la siguiente versión de un registro previo (sin versión) es 2.0', () => {
    const a = doc({});
    expect(siguienteVersion([a], a)).toBe('2.0');
  });

  it('clonar desde una versión vieja toma el siguiente número libre', () => {
    const v1 = doc({ id: 1 });
    const v2 = doc({ id: 2, version: '2.0', versionRaiz: 1 });
    expect(siguienteVersion([v1, v2], v1)).toBe('3.0');
  });

  it('sólo cuenta la versión más alta; un clon sin archivo actualizado cuenta como no cargado', () => {
    const v1 = doc({ id: 1 });
    const v2 = doc({ id: 2, version: '2.0', versionRaiz: 1, archivoPendiente: true });
    const otro = doc({ id: 3, tipoDocumento: 'RFC' });
    const vig = documentosVigentes([v1, v2, otro]);
    expect(vig.map(d => d.id)).toEqual([2, 3]);
    expect(vig[0]).toMatchObject({ archivo: '', url: undefined, storagePath: undefined });
  });

  it('ida y vuelta a la BD conserva los campos; registros previos quedan como 1.0', () => {
    const v2 = doc({ id: 2, version: '2.0', versionRaiz: 1, versionDe: 1, fechaActualizacion: '05/10/2026 15:17:28' });
    expect(versionFromDB({ fecha_creacion: v2.fecha, ...versionToDB(v2) })).toEqual({
      version: '2.0', fechaActualizacion: '05/10/2026 15:17:28', versionDe: 1, versionRaiz: 1, archivoPendiente: false,
    });
    expect(versionFromDB({ fecha_creacion: '01/01/2026 09:00' })).toMatchObject({ version: '1.0', fechaActualizacion: '01/01/2026 09:00' });
  });

  it('la fecha incluye segundos', () => {
    expect(fechaHoraActual(new Date(2026, 9, 5, 9, 3, 7))).toBe('05/10/2026 09:03:07');
  });
});
