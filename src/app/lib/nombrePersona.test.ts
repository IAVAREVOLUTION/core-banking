import { describe, it, expect } from 'vitest';
import { nombrePersona, esPersonaMoral } from './nombrePersona';

describe('nombrePersona', () => {
  it('Persona Moral ignora apellidos viejos y usa la razón social', () => {
    const p = { nombre: 'Gobierno NAYARIT', apellidoPaterno: 'Solan', apellidoMaterno: 'Enciso', denominacionRazonSocial: 'Gobierno NAYARIT', personalidad: 'Persona Moral' };
    expect(nombrePersona(p)).toBe('Gobierno NAYARIT');
    expect(nombrePersona({ nombre: 'X SA', apellidoPaterno: 'Y' }, 'Persona Moral')).toBe('X SA');
  });
  it('Persona Física concatena nombre y apellidos', () => {
    expect(nombrePersona({ nombre: 'Ana', apellidoPaterno: 'Gómez', apellidoMaterno: '', personalidad: 'Persona Fisica' })).toBe('Ana Gómez');
    expect(esPersonaMoral({ personalidad: 'Física' })).toBe(false);
  });
});
