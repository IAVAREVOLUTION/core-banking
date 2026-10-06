/**
 * Nombre a mostrar de una persona (cliente / tipo interlocutor).
 *
 * Persona Moral: su nombre es la razón social; los apellidos se IGNORAN.
 * En BD pueden quedar apellidos viejos (capturados cuando la personería era
 * física) que el guardado parcial no puede limpiar, porque los vacíos se
 * ignoran al hacer merge. Por eso todo lector debe usar esta función en vez
 * de concatenar nombre + apellidos a ciegas.
 */
type Campos = Record<string, unknown> | null | undefined;

const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

export function esPersonaMoral(p: Campos, subtipo?: string | null): boolean {
  const candidatos = [subtipo, p?.subtipo, p?.personalidad, p?.tipoPersonaJuridica, p?.personeria, p?.tipo];
  return candidatos.some(v => /moral/i.test(txt(v)));
}

export function nombrePersona(p: Campos, subtipo?: string | null): string {
  if (!p) return '';
  const razon = txt(p.denominacionRazonSocial) || txt(p.razonSocial);
  if (esPersonaMoral(p, subtipo)) return razon || txt(p.nombre) || txt(p.nombreCompleto);
  const completo = [p.nombre, p.apellidoPaterno, p.apellidoMaterno].map(txt).filter(Boolean).join(' ');
  return completo || razon || txt(p.nombreCompleto);
}
