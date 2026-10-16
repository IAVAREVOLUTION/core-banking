/**
 * personaJuridica — fuente ÚNICA para decidir si una persona es Física o Moral.
 *
 * La BD guarda el mismo concepto con varios valores ("Moral", "Persona Moral",
 * "Física", "Persona Fisica", "Dependencia Publica"…) y cada pantalla lo
 * comparaba a su manera, así que una misma persona salía Moral en un módulo y
 * Física en otro. Aquí se NORMALIZA AL LEER: los datos existentes no se tocan.
 *
 * Regla institucional (la misma del formulario de Prospectos): sólo Persona
 * Física y PFAE son personas físicas; cualquier otra personería (Moral,
 * Dependencia Pública, Fideicomiso, Consorcio…) es un ente colectivo = Moral.
 */
export type TipoPersona = 'Física' | 'Moral';

const norm = (v: unknown): string =>
  String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const FISICAS = new Set([
  'fisica', 'persona fisica', 'pf',
  'persona fisica con actividad empresarial', 'pfae', 'fisica con actividad empresarial',
]);

/**
 * Valor de personería (cualquier variante) → 'Física' | 'Moral'.
 * Vacío o desconocido → `null` (no se sabe; el llamador decide el respaldo).
 */
export function tipoPersonaDe(valor: unknown): TipoPersona | null {
  const t = norm(valor);
  if (!t) return null;
  if (FISICAS.has(t)) return 'Física';
  if (t.includes('fisica') && !t.includes('moral')) return 'Física';
  // Personerías colectivas conocidas. Cualquier otro texto (p. ej. el tipo de
  // registro "Clientes"/"Prospectos") NO es una personería: se devuelve null.
  if (/moral|dependencia|fideicomiso|consorcio|gobierno|sociedad|asociacion|juridica|^pm$/.test(t)) return 'Moral';
  return null;
}

/** ¿Es Persona Moral (o ente colectivo)? Vacío ⇒ false (se asume Física, como el Alta). */
export function esPersonaMoral(valor: unknown): boolean {
  return tipoPersonaDe(valor) === 'Moral';
}

/**
 * Tipo de persona de un registro, revisando en orden los campos donde el
 * sistema lo ha guardado. El primero con valor manda.
 */
export function tipoPersonaDeRegistro(r: Record<string, any> | null | undefined): TipoPersona | null {
  if (!r) return null;
  const candidatos = [
    r.tipoPersona, r.tipo_persona, r.personalidad, r.tipo, r.subtipo, r.cliente_subtipo, r._tipoPersona,
  ];
  for (const c of candidatos) {
    const t = tipoPersonaDe(c);
    if (t) return t;
  }
  return null;
}

/**
 * Tipo de persona efectivo: el del CLIENTE manda (fuente de verdad); lo
 * guardado en la solicitud/cotización sólo es respaldo.
 */
export function tipoPersonaEfectivo(
  delCliente: unknown,
  guardado?: unknown,
): TipoPersona | null {
  return tipoPersonaDe(delCliente) ?? tipoPersonaDe(guardado);
}

/** Nombre a mostrar: Razón Social en Moral; nombre + apellidos en Física. */
export function nombrePersona(
  r: Record<string, any> | null | undefined,
  tipo?: TipoPersona | null,
): string {
  if (!r) return '';
  const t = tipo ?? tipoPersonaDeRegistro(r);
  const razon = String(r.denominacionRazonSocial || r.razonSocial || r.razon_social || '').trim();
  if (t === 'Moral') {
    return razon || String(r.nombrePersona || r.nombre || r.nombreCompleto || '').trim();
  }
  const partes = [
    r.nombrePersona ?? r.nombre,
    r.apellidoPaternoPersona ?? r.apellidoPaterno,
    r.apellidoMaternoPersona ?? r.apellidoMaterno,
  ].map(v => String(v ?? '').trim()).filter(Boolean);
  return partes.join(' ') || razon || String(r.nombreCompleto || '').trim();
}
