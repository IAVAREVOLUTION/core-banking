import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { repararDataSolicitud, fusionar } from './repararDataSolicitud';

describe('repararDataSolicitud', () => {
  it('decodifica texto JSON doble', () => {
    const doble = JSON.stringify(JSON.stringify({ solicitud: { header: { no_sol: 'X' } } }));
    expect(repararDataSolicitud(doble).solicitud.header.no_sol).toBe('X');
  });
  it('desenvuelve la llave "0" anidada y conserva los datos de documentos', () => {
    const original = { solicitud: { expediente_electronico: { documentos: [
      { id: 1, tipo_documento: 'INE', fecha_creacion: '01/10/2026 10:00:00', archivo_adjunto: 'ine.pdf', estatus: 'Pendiente' },
    ] } } };
    const corrupto = {
      0: JSON.stringify({ 0: JSON.stringify(original) }),
      1: { solicitud: { header: { fase_id: '5' } } },
      solicitud: { expediente_electronico: { documentos: [
        { id: 1, tipo_documento: null, fecha_creacion: null, archivo_adjunto: null, estatus: 'Validado', nota: 'IA ok' },
      ] } },
    };
    const r = repararDataSolicitud(corrupto);
    const doc = r.solicitud.expediente_electronico.documentos[0];
    expect(doc).toMatchObject({ tipo_documento: 'INE', fecha_creacion: '01/10/2026 10:00:00', archivo_adjunto: 'ine.pdf', estatus: 'Validado', nota: 'IA ok' });
    expect(r.solicitud.header.fase_id).toBe('5');
    expect(Object.keys(r).some(k => /^\d+$/.test(k))).toBe(false);
  });
  it('un vacío no borra un dato, pero un valor nuevo sí lo reemplaza', () => {
    expect(fusionar({ a: 1, b: 'x' }, { a: null, b: 'y' })).toEqual({ a: 1, b: 'y' });
  });
  it('data sana no cambia', () => {
    const d = { solicitud: { header: { no_sol: 'S' } } };
    expect(repararDataSolicitud(d)).toEqual(d);
  });
  const real = 'C:/Users/CSolanoE/AppData/Local/Temp/claude/c--Users-CSolanoE-Documents-Documentos-CORE-Sistema-de-Banca-Productos/d8859dec-5921-49e9-a1ef-fb99d2bd5f05/scratchpad/sols.json';
  it.runIf(existsSync(real))('caso real ec86bff9: los documentos recuperan tipo, fecha y archivo', () => {
    const rows = JSON.parse(readFileSync(real, 'utf-8')).data;
    const row = rows.find((x: any) => String(x.id).startsWith('ec86bff9'));
    const docs = repararDataSolicitud(row.data).solicitud.expediente_electronico.documentos;
    const conTipo = docs.filter((d: any) => d.tipo_documento).length;
    console.log('docs', docs.length, 'con tipo', conTipo, 'ejemplo', docs[0].tipo_documento, docs[0].fecha_creacion, docs[0].archivo_adjunto);
    expect(conTipo).toBeGreaterThan(0);
  });
});
