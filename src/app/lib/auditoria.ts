/**
 * auditoria.ts — usuario de la sesión y bitácora de fases de una Solicitud.
 *
 * MD NAFIN Línea Global 10 §8 y SubLíneas 12 §7: registrar usuario, fecha/hora,
 * fase, estatus anterior/nuevo, observaciones y resultado de validaciones.
 * Hasta ahora el avance de fase sólo actualizaba la fase: no quedaba quién ni
 * qué se validó.
 */
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { currentUser } from '../data/mockData';

const CLAVE_USUARIO = 'core_usuario_sesion';

/** La fija el Login; el resto de la app la lee sin depender del estado de App. */
export function fijarUsuarioSesion(usuario: string) {
  try { sessionStorage.setItem(CLAVE_USUARIO, usuario); } catch { /* sin almacenamiento */ }
}

export function usuarioActual(): string {
  try {
    const u = sessionStorage.getItem(CLAVE_USUARIO);
    if (u) return u;
  } catch { /* sin almacenamiento */ }
  return currentUser.name;
}

export interface EntradaBitacoraFase {
  fecha: string;
  usuario: string;
  fase: string;
  faseSiguiente?: string;
  estatusAnterior?: string;
  estatusNuevo?: string;
  /** AUTORIZADA | BLOQUEADA | ACTIVADA … */
  resultado: string;
  validaciones: string[];
  observaciones?: string;
  producto?: string;
  lineaGlobalId?: string;
}

const API = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { Authorization: `Bearer ${publicAnonKey}` };

/**
 * Agrega una entrada a `data.solicitud.bitacoraFases`. Se relee el arreglo de
 * la BD porque el servidor reemplaza los arreglos al mezclar el JSONB. Nunca
 * bloquea el flujo: la auditoría que falla se reporta en consola.
 */
export async function registrarBitacoraFase(solicitudId: string, entrada: Omit<EntradaBitacoraFase, 'fecha' | 'usuario'>) {
  if (!/^[0-9a-f-]{36}$/i.test(String(solicitudId))) return;
  try {
    const res = await fetch(`${API}/solicitudes-credito`, { headers: HDR });
    const filas: any[] = (await res.json()).data || [];
    const fila = filas.find(r => String(r.id) === String(solicitudId));
    let d = fila?.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
    const previas: EntradaBitacoraFase[] = Array.isArray(d?.solicitud?.bitacoraFases) ? d.solicitud.bitacoraFases : [];
    const nueva: EntradaBitacoraFase = { fecha: new Date().toISOString(), usuario: usuarioActual(), ...entrada };
    await fetch(`${API}/solicitudes-credito/${solicitudId}`, {
      method: 'PUT',
      headers: { ...HDR, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { solicitud: { bitacoraFases: [...previas, nueva] } } }),
    });
  } catch (e) {
    console.warn('[auditoria] No se registró la bitácora de fase:', e);
  }
}
