import { describe, it, expect } from 'vitest';
import { tipoPersonaDe, esPersonaMoral, tipoPersonaDeRegistro, tipoPersonaEfectivo, nombrePersona } from './personaJuridica';

describe('personaJuridica', () => {
  it('normaliza todas las variantes guardadas en la BD', () => {
    for (const v of ['Moral', 'Persona Moral', 'persona moral', 'Dependencia Publica', 'Dependencia Pública', 'Fideicomiso', 'Consorcio']) {
      expect(tipoPersonaDe(v)).toBe('Moral');
    }
    for (const v of ['Física', 'Fisica', 'Persona Física', 'Persona Fisica', 'Persona Fisica con Actividad Empresarial', 'PFAE']) {
      expect(tipoPersonaDe(v)).toBe('Física');
    }
    expect(tipoPersonaDe('')).toBeNull();
    // El tipo de registro no es una personería
    expect(tipoPersonaDe('Clientes')).toBeNull();
    expect(tipoPersonaDe('Prospectos')).toBeNull();
    expect(tipoPersonaDe(null)).toBeNull();
  });
  it('esPersonaMoral: vacío se asume Física', () => {
    expect(esPersonaMoral('Persona Moral')).toBe(true);
    expect(esPersonaMoral('')).toBe(false);
  });
  it('el cliente manda sobre lo guardado en la solicitud', () => {
    expect(tipoPersonaEfectivo('Persona Moral', 'Física')).toBe('Moral');
    expect(tipoPersonaEfectivo('', 'Moral')).toBe('Moral');
    expect(tipoPersonaEfectivo(undefined, undefined)).toBeNull();
  });
  it('lee el tipo de cualquiera de los campos usados', () => {
    expect(tipoPersonaDeRegistro({ subtipo: 'Persona Moral' })).toBe('Moral');
    expect(tipoPersonaDeRegistro({ personalidad: 'Física' })).toBe('Física');
    expect(tipoPersonaDeRegistro({ tipo_persona: 'Moral', subtipo: 'Física' })).toBe('Moral');
  });
  it('nombre: razón social en Moral, nombre completo en Física', () => {
    expect(nombrePersona({ tipo: 'Moral', denominacionRazonSocial: 'Gobierno Zacatecas', nombre: 'César' })).toBe('Gobierno Zacatecas');
    expect(nombrePersona({ tipo: 'Moral', nombrePersona: 'Aguascalientes' })).toBe('Aguascalientes');
    expect(nombrePersona({ tipoPersona: 'Física', nombrePersona: 'César', apellidoPaternoPersona: 'Solano', apellidoMaternoPersona: 'Enciso' })).toBe('César Solano Enciso');
  });
});
