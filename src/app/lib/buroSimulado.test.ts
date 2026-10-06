import { describe, it, expect } from 'vitest';
import { generarReporteBuro, validarDatosConsulta, reporteBuroAXml, type DatosConsultaBuro } from './buroSimulado';

const AUT = { medio: 'Firma autógrafa' as const, fecha: '2026-10-01' };
const PF: DatosConsultaBuro = { tipoPersona: 'PF', rfc: 'GOMA850101AB1', nombre: 'Ana', apellidoPaterno: 'Gómez', fechaNacimiento: '1985-01-01', direccion: 'Girasol 20' };
const FECHA = new Date('2026-10-06T12:00:00Z');

/** RFCs de persona física sintéticos para muestrear perfiles. */
const rfcs = Array.from({ length: 400 }, (_, i) => `ABCD${String(800101 + i).padStart(6, '0')}X${String(i % 100).padStart(2, '0')}`);

describe('buroSimulado', () => {
  it('es determinístico por RFC', () => {
    const a = generarReporteBuro(PF, AUT, FECHA);
    const b = generarReporteBuro(PF, AUT, FECHA);
    expect(b.cuentas).toEqual(a.cuentas);
    expect(b.score).toEqual(a.score);
    expect(b.resultado).toBe(a.resultado);
  });

  it('produce perfiles variados con ambos resultados', () => {
    const rs = rfcs.map(rfc => generarReporteBuro({ ...PF, rfc }, AUT, FECHA));
    const pos = rs.filter(r => r.resultado === 'POSITIVO').length;
    expect(pos).toBeGreaterThan(20);
    expect(pos).toBeLessThan(200);
    expect(rs.some(r => r.sinHistorial)).toBe(true);
    const scores = rs.map(r => r.score.valor).filter((v): v is number => v !== null);
    expect(Math.min(...scores)).toBeGreaterThanOrEqual(456);
    expect(Math.max(...scores)).toBeLessThanOrEqual(760);
    expect(new Set(scores).size).toBeGreaterThan(50);
  });

  it('marca POSITIVO cuando hay atrasos de 30 días o más', () => {
    for (const rfc of rfcs) {
      const r = generarReporteBuro({ ...PF, rfc }, AUT, FECHA);
      const grave = r.cuentas.some(c => /[3-7]/.test(c.historico) || ['03', '04', '05', '06', '07', '97'].includes(c.mop));
      if (grave) expect(r.resultado).toBe('POSITIVO');
      if (r.sinHistorial) expect(r.score.valor).toBeNull();
    }
  });

  it('el resumen cuadra con las cuentas', () => {
    const r = generarReporteBuro(PF, AUT, FECHA);
    const abiertas = r.cuentas.filter(c => !c.fechaCierre);
    expect(r.resumen.cuentasAbiertas).toBe(abiertas.length);
    expect(r.resumen.saldoActual).toBe(abiertas.reduce((s, c) => s + c.saldoActual, 0));
  });

  it('persona moral usa razón social, montos empresariales y Score PyME', () => {
    const r = generarReporteBuro({ tipoPersona: 'PM', rfc: 'GJA850101AB1', razonSocial: 'Gobierno Jalisco', direccion: 'Av. Juárez 1' }, AUT, FECHA);
    expect(r.consultado.nombre).toBe('GOBIERNO JALISCO');
    expect(r.score.nombre).toBe('Score PyME');
    expect(r.consultado.curp).toBeUndefined();
  });

  it('valida los datos mínimos según el tipo de persona', () => {
    expect(validarDatosConsulta(PF)).toEqual([]);
    expect(validarDatosConsulta({ tipoPersona: 'PM', rfc: 'GOMA850101AB1', razonSocial: 'X', direccion: 'Y' })[0]).toMatch(/persona moral de 12 caracteres \(tiene 13\)/);
    expect(validarDatosConsulta({ tipoPersona: 'PM', rfc: 'SOEC0802739L', razonSocial: 'Gobierno Nayarit', direccion: 'Girasol 20' })).toEqual([]);
    expect(validarDatosConsulta({ tipoPersona: 'PF', rfc: '' })).toEqual(['RFC', 'Nombre', 'Apellido paterno', 'Fecha de nacimiento', 'Domicilio']);
  });

  it('el XML escapa caracteres especiales', () => {
    const xml = reporteBuroAXml(generarReporteBuro({ tipoPersona: 'PM', rfc: 'ABC850101AB1', razonSocial: 'Hierro & Acero <SA>', direccion: 'x' }, AUT, FECHA));
    expect(xml).toContain('HIERRO &amp; ACERO &lt;SA&gt;');
  });
});
