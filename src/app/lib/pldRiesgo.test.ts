import { describe, it, expect } from 'vitest';
import { calcularRiesgo } from './pldRiesgo';

describe('pldRiesgo', () => {
  it('persona física mexicana sin coincidencias → Bajo', () => {
    const r = calcularRiesgo({ nombre: 'Ana', nacionalidad: 'Mexicana', entidadFederativa: 'Jalisco', ocupacion: 'Docente', estatusListaNegra: 'NEGATIVO' }, 'Persona Fisica');
    expect(r.nivel).toBe('Bajo');
    expect(r.factores.pepListasNegras.valor).toBe(0);
  });
  it('coincidencia confirmada en listas → Alto aunque lo demás sea bajo', () => {
    const r = calcularRiesgo({ nombre: 'Ana', nacionalidad: 'Mexicana', entidadFederativa: 'Jalisco', ocupacion: 'Docente', estatusListaNegra: 'POSITIVO' }, 'Persona Fisica');
    expect(r.nivel).toBe('Alto');
  });
  it('actividad vulnerable + extranjero → riesgo alto en esos factores', () => {
    const r = calcularRiesgo({ giroEmpresa: 'Casa de cambio', nacionalidad: 'Venezolana', paisResidencia: 'Venezuela', estatusListaNegra: 'NEGATIVO' }, 'Persona Moral');
    expect(r.factores.actividadEconomica.valor).toBe(90);
    expect(r.factores.residencia.valor).toBe(70);
    expect(r.nivel).not.toBe('Bajo');
  });
  it('dependencia de gobierno', () => {
    const r = calcularRiesgo({ denominacionRazonSocial: 'Gobierno Puebla', estatusListaNegra: 'NEGATIVO' }, 'Persona Moral');
    expect(r.factores.actividadEconomica.motivo).toMatch(/gobierno/i);
    expect(r.factores.tipoPersona.valor).toBe(30);
  });
  it('lee data guardada como texto JSON', () => {
    const r = calcularRiesgo(JSON.stringify({ esPEP: true, estatusListaNegra: '' }), 'Persona Fisica');
    expect(r.factores.pepListasNegras.valor).toBe(80);
  });
});
