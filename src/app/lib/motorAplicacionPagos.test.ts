import { describe, it, expect } from 'vitest';
import { aplicarPago, type DocumentoCxC } from './motorAplicacionPagos';
import { mapaPrelacion, claveConcepto, conceptosAmortizacion } from './prelacionCargos';

// Prelación como la del Taller (captura de pantalla del producto).
const PRELACION = [
  { ordenAplicacion: '1', productosCargos: 'Interés Moratorio' },
  { ordenAplicacion: '2', productosCargos: 'Interés Ordinario' },
  { ordenAplicacion: '3', productosCargos: 'Iva Interés' },
  { ordenAplicacion: '4', productosCargos: 'IVA Seguro' },
  { ordenAplicacion: '5', productosCargos: 'Seguro' },
  { ordenAplicacion: '6', productosCargos: 'Interés' },
  { ordenAplicacion: '7', productosCargos: 'IVA' },
  { ordenAplicacion: '8', productosCargos: 'CAPITAL' },
];

describe('prelacionCargos', () => {
  it('traduce los nombres del Taller a las claves del aviso', () => {
    expect(claveConcepto('Interés Ordinario')).toBe('INTERES');
    expect(claveConcepto('Iva Interés')).toBe('IVA_INT');
    expect(claveConcepto('IVA Seguro')).toBe('IVA_SEG');
    expect(claveConcepto('CAPITAL')).toBe('CAPITAL');
    expect(claveConcepto('Interés Moratorio')).toBe('MORATORIO');
  });
  it('respeta el orden del producto; la primera aparición manda', () => {
    const m = mapaPrelacion(PRELACION);
    expect(m.MORATORIO).toBe(1);
    expect(m.INTERES).toBe(2);
    expect(m.IVA_INT).toBe(3);
    expect(m.IVA_SEG).toBe(4);
    expect(m.SEGURO).toBe(5);
    expect(m.CAPITAL).toBe(6);
  });
  it('ordena por ordenAplicacion aunque la lista venga desordenada', () => {
    const m = mapaPrelacion([{ ordenAplicacion: '2', productosCargos: 'Capital' }, { ordenAplicacion: '1', productosCargos: 'Seguro' }]);
    expect(m.SEGURO).toBeLessThan(m.CAPITAL);
  });
  it('genera las líneas del aviso en orden de prelación', () => {
    const c = conceptosAmortizacion({ pago_capital: 800, pago_interes: 100, iva_interes: 16, pago_seguro: 50, iva_seguro: 8 }, PRELACION);
    expect(c.map(x => x.cve)).toEqual(['INTERES', 'IVA_INT', 'IVA_SEG', 'SEGURO', 'CAPITAL']);
    expect(c[0].desc).toBe('Interés Ordinario');
  });
});

const aviso = (id: string, venc: string, lineas: [string, number, number][]): DocumentoCxC => ({
  id, folio: id, idContrato: 'CRED-1', fechaVencimiento: venc, fechaDocumento: venc,
  montoTotalPagar: lineas.reduce((s, l) => s + l[1], 0), pagoTotal: 0,
  detalle: lineas.map(([cve, monto, orden], i) => ({ id: `${id}-${i}`, claveConcepto: cve, nombreConcepto: cve, monto, pagoTotal: 0, ordenPrelacion: orden })),
});

describe('motorAplicacionPagos', () => {
  const docs = [
    aviso('B', '2026-11-08', [['CAPITAL', 800, 6], ['INTERES', 100, 2]]),
    aviso('A', '2026-10-08', [['CAPITAL', 800, 6], ['INTERES', 100, 2], ['IVA_INT', 16, 3]]),
  ];

  it('paga primero el aviso más antiguo y, dentro, por prelación', () => {
    const r = aplicarPago({ montoPago: 150, saldoEjeAnterior: 0, documentos: docs, idCuentaEje: 'eje' });
    expect(r.ok).toBe(true);
    expect(r.aplicacionesDetalle.map(a => [a.idCxC, a.claveConcepto, a.montoAplicado])).toEqual([
      ['A', 'INTERES', 100], ['A', 'IVA_INT', 16], ['A', 'CAPITAL', 34],
    ]);
    expect(r.saldoRemanenteEje).toBe(0);
    expect(r.descuadres).toEqual([]);
  });

  it('el excedente queda en la Cuenta EJE', () => {
    const r = aplicarPago({ montoPago: 2000, saldoEjeAnterior: 0, documentos: docs, idCuentaEje: 'eje' });
    expect(r.montoTotalAplicado).toBe(1816);
    expect(r.saldoRemanenteEje).toBe(184);
    expect(r.aplicacionesCxC.every(c => c.estatusNuevo === 'Pagado')).toBe(true);
  });

  it('aplica sólo el saldo de la EJE cuando el pago es 0', () => {
    const r = aplicarPago({ montoPago: 0, saldoEjeAnterior: 100, documentos: docs, idCuentaEje: 'eje' });
    expect(r.ok).toBe(true);
    expect(r.montoTotalAplicado).toBe(100);
  });

  it('sin Cuenta EJE no aplica nada', () => {
    const r = aplicarPago({ montoPago: 100, saldoEjeAnterior: 0, documentos: docs, idCuentaEje: null });
    expect(r.ok).toBe(false);
  });
});
