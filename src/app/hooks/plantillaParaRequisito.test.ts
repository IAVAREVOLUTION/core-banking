import { describe, it, expect } from 'vitest';
import { plantillaParaRequisito } from './generarDocumentosFase4';

describe('plantillaParaRequisito', () => {
  it('reconoce los documentos que se generan desde plantilla', () => {
    expect(plantillaParaRequisito('Solicitud de Crédito')).toBe('solicitud');
    expect(plantillaParaRequisito('Contrato Firmado')).toBe('contrato');
    expect(plantillaParaRequisito('Pagaré Firmado')).toBe('pagare');
    expect(plantillaParaRequisito('PAGARE')).toBe('pagare');
  });
  it('los documentos del cliente no se generan', () => {
    for (const t of ['INE / Identificación Oficial', 'Comprobante de Domicilio', 'Acta Constitutiva', 'Constancia de Situación Fiscal', 'Solicitud de Activación']) {
      expect(plantillaParaRequisito(t)).toBeNull();
    }
  });
});
