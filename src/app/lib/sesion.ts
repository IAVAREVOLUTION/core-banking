/**
 * Usuario de la sesión activa, accesible fuera del árbol de React (handlers de
 * subtabs, generadores de documentos). App.tsx lo fija en el login y lo limpia
 * en el logout; el perfil completo sigue viviendo en el estado de App.
 */
let usuarioSesion: string | null = null;

/**
 * Copia en sessionStorage: la variable de módulo se pierde si el módulo se
 * vuelve a cargar (recarga en caliente) mientras la sesión sigue abierta, y
 * entonces DEMO dejaba de reconocerse (veía subtabs que tiene ocultos).
 */
const CLAVE_SESION = 'usuario_sesion';

export function setUsuarioSesion(usuario: string | null): void {
  usuarioSesion = usuario;
  try {
    if (usuario) sessionStorage.setItem(CLAVE_SESION, usuario);
    else sessionStorage.removeItem(CLAVE_SESION);
  } catch { /* sin sessionStorage: queda sólo en memoria */ }
}

/** Usuario que firma los registros: 'admin', 'demo', … */
export function getUsuarioSesion(): string {
  if (!usuarioSesion) {
    try { usuarioSesion = sessionStorage.getItem(CLAVE_SESION); } catch { /* ignore */ }
  }
  return usuarioSesion || 'sistema';
}

const PUESTOS: Record<string, string> = {
  admin: 'Administrador',
  demo: 'Usuario Demo',
};

/** Subtabs de Solicitud y Originación que NO ve el usuario DEMO (sólo interfaz). */
const SUBTABS_OCULTOS_DEMO = ['default', 'comites', 'comisiones', 'fases'];

/** ¿El usuario de la sesión puede ver este subtab de Solicitud / Originación? */
export function subtabVisible(id: string): boolean {
  return !(getUsuarioSesion() === 'demo' && SUBTABS_OCULTOS_DEMO.includes(id));
}

/** Puesto mostrado junto al usuario (p. ej. en Notas). */
export function getPuestoSesion(): string {
  return PUESTOS[getUsuarioSesion()] || 'Sistema';
}
