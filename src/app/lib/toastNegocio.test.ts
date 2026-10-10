import { describe, it, expect } from 'vitest';
import { limpiarMensaje } from './toastNegocio';

describe('limpiarMensaje — avisos sin detalles internos de la BD', () => {
  it.each([
    ['Sincronizado con J_PRODUCTOS', 'Sincronizado'],
    ['"Juan" ha sido registrada en J_CLIENTES.', '"Juan" ha sido registrada.'],
    ['ID: 19710b2d... — Type: Credito', ''],
    ['Documento 3fa85f64-5717-4562-b3fc-2c963f66afa6 cargado', 'Documento cargado'],
    ['Este registro no tiene UUID de J_CLIENTES.', 'Este registro no tiene identificador.'],
    ['Producto guardado exitosamente', 'Producto guardado exitosamente'],
  ])('%s → %s', (entrada, esperado) => {
    expect(limpiarMensaje(entrada)).toBe(esperado);
  });

  it('convierte errores crudos del servidor en un mensaje entendible', () => {
    expect(limpiarMensaje('permission denied for table J_CLIENTES')).toMatch(/^Ocurrió un error en el servidor/);
    expect(limpiarMensaje('duplicate key value violates unique constraint')).toMatch(/^Ocurrió un error en el servidor/);
  });
});

import { quitarModeloIA } from './toastNegocio';
describe('sin mencionar el modelo de IA', () => {
  it('quita el modelo de notas y avisos', () => {
    expect(quitarModeloIA('IA: Validado (98%) · claude:claude-haiku-4-5-20251001')).toBe('IA: Validado (98%)');
    expect(quitarModeloIA('Solicitud de Crédito · 95% · 🤖 claude:claude-haiku-4-5-20251001')).toBe('Solicitud de Crédito · 95%');
    expect(quitarModeloIA('Validado · openai/gpt-4o-mini')).toBe('Validado');
    expect(quitarModeloIA('Comprobante de Domicilio')).toBe('Comprobante de Domicilio');
  });
  it('limpiarMensaje también lo quita', () => {
    expect(limpiarMensaje('Solicitud de Crédito · 95% · 🤖 claude:claude-haiku-4-5-20251001')).toBe('Solicitud de Crédito · 95%');
  });
});
