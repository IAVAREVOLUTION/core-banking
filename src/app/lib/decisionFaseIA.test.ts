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

describe('reclasificación por reglas del sistema', () => {
  it('el caso real: comprobante a nombre de tercero marcado como RECHAZO pasa a ADVERTENCIA', () => {
    const r = decidirFaseIA({
      valido: false,
      motivos: [
        'RECHAZO: Discrepancia crítica en identidad del titular — Comprobante de Domicilio a nombre de GOMEZ BORGES FRANCISCO, pero cliente registrado es Cesar Alejandro Solano',
        'ADVERTENCIA: Comprobante de Domicilio no está a nombre del cliente solicitante (está a nombre de tercero: GOMEZ BORGES FRANCISCO). Según reglas generales, esto es permitido como ADVERTENCIA, pero combinado con la discrepancia de identidad en INE genera rechazo',
        'ADVERTENCIA: RFC en Solicitud (SOEC020830H) no coincide exactamente',
      ],
    });
    expect(r.valido).toBe(true);
    expect(r.motivosOrdenados.every(m => !m.startsWith('RECHAZO'))).toBe(true);
  });
  it('un comprobante vencido sigue siendo RECHAZO', () => {
    const r = decidirFaseIA({ valido: true, motivos: ['RECHAZO: Comprobante de domicilio a nombre de tercero y vencido (más de 3 meses)'] });
    expect(r.valido).toBe(false);
  });
  it('RFC comparado contra la clave de elector de la INE no bloquea', () => {
    const r = decidirFaseIA({ valido: false, motivos: ['RECHAZO: RFC en Solicitud no coincide con RFC extraído de INE (clave de elector SLENC...)'] });
    expect(r.valido).toBe(true);
  });
  it('una INE de otra persona sigue siendo RECHAZO', () => {
    const r = decidirFaseIA({ valido: true, motivos: ['RECHAZO: La INE corresponde a otra persona (JUAN PEREZ)'] });
    expect(r.valido).toBe(false);
  });
  it('documento faltante sigue siendo RECHAZO', () => {
    expect(decidirFaseIA({ valido: true, motivos: ['RECHAZO: Solicitud de Crédito no cargada en el expediente'] }).valido).toBe(false);
  });
});

describe('RFC sin homoclave', () => {
  it('el caso real de la Fase 3 pasa: misma base, sólo cambia la homoclave', () => {
    const r = decidirFaseIA({
      valido: false,
      motivos: [
        'RECHAZO: RFC del documento Constancia de Situación Fiscal (SOEC020830292) NO COINCIDE con RFC extraído de otros documentos (SOEC020830H). Discrepancia crítica en validación fiscal.',
        'RECHAZO: Estructura del RFC en Constancia de Situación Fiscal es inválida. RFC de persona física debe tener 13 caracteres (10 de nombre + 3 de homoclave); SOEC020830292 tiene 12 caracteres.',
        'ADVERTENCIA: Comprobante de Domicilio está a nombre de tercero (GOMEZ BORGES FRANCISCO)',
      ],
    });
    expect(r.valido).toBe(true);
  });
  it('RFC con base distinta sigue siendo RECHAZO', () => {
    const r = decidirFaseIA({ valido: true, motivos: ['RECHAZO: RFC de la Constancia (SOEC020830292) no coincide con el de la Solicitud (PEGJ850315AB1)'] });
    expect(r.valido).toBe(false);
  });
});

describe('RFC igual reportado como distinto', () => {
  it('mismo RFC exacto marcado como RECHAZO no bloquea', () => {
    expect(decidirFaseIA({ valido: false, motivos: ['RECHAZO: El RFC de la Constancia (SOEC020830292) no coincide con el RFC del cliente (SOEC020830292)'] }).valido).toBe(true);
  });
  it('"falta homoclave" no se toma como motivo grave', () => {
    expect(decidirFaseIA({ valido: false, motivos: ['RECHAZO: RFC de la solicitud (SOEC020830) no coincide con la Constancia (SOEC020830292), falta la homoclave'] }).valido).toBe(true);
  });
});

describe('sin doble validación de documentos ya validados', () => {
  const validados = ['Comprobante de Domicilio', 'INE / Identificación Oficial'];
  it('re-evaluar vigencia de un documento ya validado no bloquea', () => {
    const r = decidirFaseIA({ valido: false, motivos: ['OK: INE validada', 'RECHAZO: El comprobante de domicilio no cumple vigencia de 3 meses'] }, validados);
    expect(r.valido).toBe(true);
  });
  it('si el documento NO estaba validado, el rechazo se mantiene', () => {
    const r = decidirFaseIA({ valido: true, motivos: ['RECHAZO: El comprobante de domicilio no cumple vigencia de 3 meses'] }, []);
    expect(r.valido).toBe(false);
  });
  it('un documento faltante sigue bloqueando aunque haya otros validados', () => {
    const r = decidirFaseIA({ valido: true, motivos: ['RECHAZO: Falta la Constancia de Situación Fiscal (formato SAT)'] }, validados);
    expect(r.valido).toBe(false);
  });
  it('una INE de otra persona sigue bloqueando aunque esté validada', () => {
    const r = decidirFaseIA({ valido: true, motivos: ['RECHAZO: La INE / Identificación Oficial corresponde a otra persona'] }, validados);
    expect(r.valido).toBe(false);
  });
});

describe('CURP contra clave de elector', () => {
  it('no bloquea', () => {
    expect(decidirFaseIA({ valido: false, motivos: ['RECHAZO: Discrepancia en CURP extraído (SLENC5020830GH300 en INE vs SOEC020830HCMLNSA9 registrado en sistema)'] }).valido).toBe(true);
  });
});

describe('nombres en otro orden', () => {
  it('el caso real de la Fase 2 pasa: INE equivalente + comprobante de tercero', () => {
    const r = decidirFaseIA({ valido: false, motivos: [
      "RECHAZO: Discrepancia crítica en identidad — INE a nombre de 'SOLANO ENCISO CESAR ALEJANDRO' pero cliente registrado es 'Cesar Alejandro Solano' y Comprobante de Domicilio a nombre de 'GOMEZ BORGES FRANCISCO' (tercera persona)",
      'OK: Solicitud de Crédito cargada y validada por IA',
    ] });
    expect(r.valido).toBe(true);
  });
  it('sólo diferencia de orden no bloquea', () => {
    expect(decidirFaseIA({ valido: false, motivos: ["RECHAZO: El nombre 'SOLANO ENCISO CESAR ALEJANDRO' no coincide con 'Cesar Alejandro Solano'"] }).valido).toBe(true);
  });
  it('INE de otra persona sigue bloqueando', () => {
    expect(decidirFaseIA({ valido: true, motivos: ["RECHAZO: La INE está a nombre de 'JUAN PEREZ LOPEZ' y el cliente es 'Cesar Alejandro Solano'"] }).valido).toBe(false);
  });
  it('INE de otra persona y comprobante de tercero sigue bloqueando', () => {
    expect(decidirFaseIA({ valido: true, motivos: ["RECHAZO: INE a nombre de 'JUAN PEREZ LOPEZ', cliente 'Cesar Alejandro Solano' y Comprobante de Domicilio a nombre de 'GOMEZ BORGES FRANCISCO' (tercera persona)"] }).valido).toBe(false);
  });
});

import { decidirFasePorPresencia, esPromptSoloPresencia } from './decisionFaseIA';

describe('fases de sólo presencia', () => {
  it('reconoce el prompt de sólo presencia', () => {
    expect(esPromptSoloPresencia('En esta fase revisas ÚNICAMENTE que la SOLICITUD esté integrada. NO validas su contenido: eso ya lo hizo...')).toBe(true);
    expect(esPromptSoloPresencia('Valida que el expediente esté completo y que los nombres coincidan')).toBe(false);
  });
  const docs = [
    { tipoDocumento: 'Comprobante de Domicilio', estatus: 'Validado', validadoIA: true },
    { tipoDocumento: 'INE / Identificación Oficial', estatus: 'Validado', validadoIA: true },
    { tipoDocumento: 'Solicitud de Crédito', estatus: 'Validado', validadoIA: true },
    { tipoDocumento: 'Pagaré Firmado', estatus: 'Validado', validadoIA: true },
  ];
  it('el caso real: la IA rechaza por identidad, pero todo está cargado y validado → pasa', () => {
    const ia = decidirFaseIA({ valido: false, motivos: ['RECHAZO: Hay inconsistencia de identidad entre documentos que impide avanzar en la fase'] });
    const r = decidirFasePorPresencia(ia, [{ tipoDocumento: 'Solicitud de Crédito', obligatorio: true }], docs);
    expect(r.valido).toBe(true);
    expect(r.motivosOrdenados.some(m => m.startsWith('RECHAZO'))).toBe(false);
  });
  it('si falta un documento obligatorio de la fase, rechaza y dice cuál', () => {
    const ia = decidirFaseIA({ valido: true, motivos: ['OK: todo bien'] });
    const r = decidirFasePorPresencia(ia, [{ tipoDocumento: 'Reporte de Buró de Crédito', obligatorio: true }], docs);
    expect(r.valido).toBe(false);
    expect(r.motivosOrdenados[0]).toBe('RECHAZO: Reporte de Buró de Crédito no está cargado en KM Digital');
  });
  it('documento cargado pero sin validar', () => {
    const r = decidirFasePorPresencia(decidirFaseIA({ valido: true, motivos: [] }), [{ tipoDocumento: 'Contrato' }],
      [{ tipoDocumento: 'Contrato', estatus: 'Pendiente Validación IA', validadoIA: false }]);
    expect(r.valido).toBe(false);
    expect(r.motivosOrdenados[0]).toMatch(/no ha sido validado/);
  });
});
