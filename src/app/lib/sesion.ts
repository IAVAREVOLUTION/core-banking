/**
 * Usuario de la sesión activa, accesible fuera del árbol de React (handlers de
 * subtabs, generadores de documentos). App.tsx lo fija en el login y lo limpia
 * en el logout; el perfil completo sigue viviendo en el estado de App.
 */
let usuarioSesion: string | null = null;

export function setUsuarioSesion(usuario: string | null): void {
  usuarioSesion = usuario;
}

/** Usuario que firma los registros: 'admin', 'demo', … */
export function getUsuarioSesion(): string {
  return usuarioSesion || 'sistema';
}

const PUESTOS: Record<string, string> = {
  admin: 'Administrador',
  demo: 'Usuario Demo',
};

/** Puesto mostrado junto al usuario (p. ej. en Notas). */
export function getPuestoSesion(): string {
  return PUESTOS[getUsuarioSesion()] || 'Sistema';
}
