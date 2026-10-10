import { describe, it, expect } from 'vitest';
import { extraerMovimientos, monitorear, parametrosDesde, personasConCoincidencias } from './pldMonitoreo';

const P = parametrosDesde({ montoMaxOperacionUSD: '10,000', montoMaxPersonaFisica: '500,000', montoMaxPersonaMoral: '5,000,000', porcentajeDesviacion: '50', tipoCambioUSD: '18.50' });
const fila = (movs: any[], extra: Record<string, any> = {}) => ({
  id: 'c1', cliente_id: 'cli-1', cliente_nombre: 'Ana', cliente_ap_paterno: 'Gómez', cliente_rfc: 'GOMA850101AB1',
  cliente_subtipo: 'Persona Fisica', no_cuenta: '001', data: JSON.stringify({ movimientos: movs }), ...extra,
});

describe('pldMonitoreo', () => {
  it('descarta la réplica en la cuenta EJE', () => {
    const t = '2026-10-06T17:11:19.046Z';
    const movs = extraerMovimientos([
      fila([{ id: 'mov-1', tipo: 'Abono', monto: 1000, fechaHora: t }]),
      fila([{ id: 'eje-1', tipo: 'Abono', monto: 1000, fechaRegistro: '2026-10-06T17:11:19.416Z' }], { id: 'c2' }),
    ]);
    expect(movs).toHaveLength(1);
  });
  it('R1 relevante y R2 fuera de perfil', () => {
    const movs = extraerMovimientos([fila([{ id: 'm1', tipo: 'Abono', concepto: 'Depósito en efectivo en ventanilla', monto: 600000, fechaHora: '2026-09-01T10:00:00Z' }])]);
    const reglas = monitorear(movs, P).map(a => a.regla);
    expect(reglas).toContain('R1'); // 600,000 ≥ 185,000
    expect(reglas).toContain('R2'); // 600,000 > 500,000
  });
  it('una transferencia grande no es relevante (no es efectivo) y las disposiciones se excluyen', () => {
    const movs = extraerMovimientos([fila([
      { id: 't1', tipo: 'Abono', concepto: 'Pago por transferencia SPEI', monto: 300000, fechaHora: '2026-09-01T10:00:00Z' },
      { id: 'd1', tipo: 'Cargo', concepto: 'Apertura de cuenta - Disposición inicial', monto: 100000000, fechaHora: '2026-09-02T10:00:00Z' },
    ])]);
    expect(monitorear(movs, P)).toHaveLength(0);
  });
  it('R3 fraccionamiento', () => {
    const movs = extraerMovimientos([fila([
      { id: 'a', tipo: 'Abono', monto: 90000, fechaHora: '2026-09-01T10:00:00Z' },
      { id: 'b', tipo: 'Abono', monto: 80000, fechaHora: '2026-09-02T10:00:00Z' },
      { id: 'c', tipo: 'Abono', monto: 70000, fechaHora: '2026-09-04T10:00:00Z' },
    ])]);
    const r3 = monitorear(movs, P).filter(a => a.regla === 'R3');
    expect(r3).toHaveLength(1);
    expect(r3[0].monto).toBe(240000);
  });
  it('R4 desviación del promedio mensual', () => {
    const movs = extraerMovimientos([fila([
      { id: 'x1', tipo: 'Abono', monto: 10000, fechaHora: '2026-07-10T10:00:00Z' },
      { id: 'x2', tipo: 'Abono', monto: 10000, fechaHora: '2026-08-10T10:00:00Z' },
      { id: 'x3', tipo: 'Abono', monto: 40000, fechaHora: '2026-10-02T10:00:00Z' },
    ])]);
    const r4 = monitorear(movs, P, [], new Date('2026-10-07T12:00:00Z')).filter(a => a.regla === 'R4');
    expect(r4).toHaveLength(1);
  });
  it('R5 personas en listas', () => {
    const personas = personasConCoincidencias([
      { id: 'p1', data: { nombre: 'Juan', apellidoPaterno: 'Pérez', estatusListaNegra: 'POSITIVO', listasNegras: [{ nombreLista: 'OFAC', estatus: 'POSITIVO' }] } },
      { id: 'p2', data: { nombre: 'Luis', estatusListaNegra: 'NEGATIVO' } },
    ]);
    expect(personas).toHaveLength(1);
    const a = monitorear([], P, personas);
    expect(a[0].tipoAlerta).toBe('Preocupante');
  });
});
