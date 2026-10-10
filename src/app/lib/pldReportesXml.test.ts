import { describe, it, expect } from 'vitest';
import { generarXmlReporte, fechaISO, claveTipo, trimestre } from './pldReportesXml';

describe('pldReportesXml', () => {
  it('arma el XML con encabezado, persona y escapes', () => {
    const xml = generarXmlReporte([{
      folio: 'REP-1', fecha: '22/05/2026', tipo: 'Operación Inusual', monto: 620000,
      persona: { nombre: 'Hierro & Acero <SA>', rfc: 'HAC850101AB1', personalidad: 'Persona Moral' },
    }], { sujetoObligado: 'SOFOM ENR', organoSupervisor: 'CNBV', usuario: 'admin' }, new Date('2026-10-07T12:00:00Z'));
    expect(xml).toContain('<TipoReporte>INUSUAL</TipoReporte>');
    expect(xml).toContain('<FechaOperacion>2026-05-22</FechaOperacion>');
    expect(xml).toContain('Hierro &amp; Acero &lt;SA&gt;');
    expect(xml).toContain('<Persona tipo="PM">');
    expect(xml).not.toContain('<CURP>');
    expect(xml).toContain('<MontoTotal moneda="MXN">620000.00</MontoTotal>');
  });
  it('fechas, tipos y trimestres', () => {
    expect(fechaISO('5/3/2026')).toBe('2026-03-05');
    expect(claveTipo('Operación Relevante')).toEqual({ clave: 'RELEVANTE', periodicidad: 'Trimestral' });
    expect(claveTipo('Operación Interna Preocupante').clave).toBe('INTERNA_PREOCUPANTE');
    const t = trimestre(new Date(2026, 9, 7));
    expect(t.numero).toBe(4);
    expect(t.inicio.getMonth()).toBe(9);
    expect(t.fin.getDate()).toBe(31);
  });
});
