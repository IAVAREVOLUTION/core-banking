/**
 * Módulos del sistema y visibilidad por usuario.
 *
 * - PERMISO (qué módulos puede usar cada usuario) sigue en LoginScreen:
 *   admin = todos, demo = MODULOS_DEMO.
 * - VISIBILIDAD (qué módulos quiere ver en menú e Inicio) se configura en
 *   Configuración → Módulos visibles. Ocultar un módulo no quita el permiso;
 *   sólo lo saca del menú y de los Accesos para no saturar la pantalla.
 *
 * Se guarda en este navegador (localStorage) mientras no exista una tabla de
 * usuarios real.
 */
import { useEffect, useState } from 'react';
import { MODULOS_DEMO } from '@/app/components/LoginScreen';

export interface ModuloSistema { id: string; label: string }

/** Catálogo de módulos en el orden del menú. */
export const CATALOGO_MODULOS: ModuloSistema[] = [
  { id: 'configuracion', label: 'Configuración' },
  { id: 'productos', label: 'Productos' },
  { id: 'garantias', label: 'Bienes' },
  { id: 'prospectos', label: 'Tipo Interlocutor' },
  { id: 'clientes', label: 'Personas' },
  { id: 'oportunidades', label: 'Oportunidades' },
  { id: 'cotizaciones', label: 'Cotizaciones' },
  { id: 'cuentas-ahorro', label: 'Cuentas ahorro' },
  { id: 'solicitudes-creditos', label: 'Solicitudes' },
  { id: 'solicitudes-activacion', label: 'Sol. Activación' },
  { id: 'originacion', label: 'Originación' },
  { id: 'creditos', label: 'Créditos' },
  { id: 'inversiones', label: 'Inversiones' },
  { id: 'pld', label: 'PLD' },
  { id: 'pagos-referenciados', label: 'Pagos Referenciados' },
  { id: 'casos-cobranza', label: 'Casos de Cobranza' },
  { id: 'cobranza', label: 'Cobranza' },
  { id: 'avisos-vencimiento', label: 'Avisos de Vencimiento' },
  { id: 'banca-2o-piso', label: 'Banca 2º Piso' },
  { id: 'cartera-credito', label: 'Cartera de Crédito 2º Piso' },
  { id: 'cartera-credito-individual', label: 'Cartera Crédito Individual' },
  { id: 'cartera-arrendamiento', label: 'Cartera Arrendamiento' },
  { id: 'cartera-inversion', label: 'Cartera inversión' },
  { id: 'cartera-ahorro', label: 'Cartera ahorro' },
  { id: 'ejec-reportes', label: 'Ejec. Reportes Regulatorios' },
  { id: 'polizas-contables', label: 'Pólizas Contables' },
  { id: 'gestion-riesgos', label: 'Gestión de Riesgos' },
  { id: 'une', label: 'UNE — Quejas y Reclamaciones' },
];

/** Agrupación por área (Inicio y Configuración la comparten). */
export const GRUPOS_MODULOS: { id: string; titulo: string; descripcion: string; modulos: string[] }[] = [
  { id: 'comercial', titulo: 'Comercial', descripcion: 'Interlocutores, personas y oportunidades',
    modulos: ['prospectos', 'clientes', 'oportunidades', 'cotizaciones'] },
  { id: 'originacion', titulo: 'Originación de Crédito', descripcion: 'Solicitudes, activaciones y créditos',
    modulos: ['solicitudes-creditos', 'solicitudes-activacion', 'originacion', 'creditos'] },
  { id: 'captacion', titulo: 'Captación', descripcion: 'Cuentas de ahorro e inversiones',
    modulos: ['cuentas-ahorro', 'inversiones'] },
  { id: 'cartera', titulo: 'Cartera', descripcion: 'Administración de cartera y Banca 2º Piso',
    modulos: ['banca-2o-piso', 'cartera-credito', 'cartera-credito-individual', 'cartera-arrendamiento', 'cartera-inversion', 'cartera-ahorro'] },
  { id: 'cobranza', titulo: 'Cobranza', descripcion: 'Cobranza, avisos y pagos',
    modulos: ['cobranza', 'casos-cobranza', 'avisos-vencimiento', 'pagos-referenciados'] },
  { id: 'cumplimiento', titulo: 'Cumplimiento y Riesgos', descripcion: 'PLD, riesgos, reportes y UNE',
    modulos: ['pld', 'gestion-riesgos', 'ejec-reportes', 'une'] },
  { id: 'contabilidad', titulo: 'Contabilidad', descripcion: 'Pólizas contables',
    modulos: ['polizas-contables'] },
  { id: 'configuracion', titulo: 'Configuración', descripcion: 'Parámetros, productos y bienes',
    modulos: ['configuracion', 'productos', 'garantias'] },
];

/** Usuarios del sistema y su permiso (sin lista = todos). */
export const USUARIOS_SISTEMA: { usuario: string; nombre: string; permitidos?: string[] }[] = [
  { usuario: 'admin', nombre: 'Administrador' },
  { usuario: 'demo', nombre: 'Usuario Demo', permitidos: MODULOS_DEMO },
];

/** Configuración nunca se oculta: es donde se vuelve a mostrar lo oculto. */
export const MODULOS_SIEMPRE_VISIBLES = ['configuracion'];

const clave = (usuario: string) => `modulos-ocultos:${(usuario || 'admin').toLowerCase()}`;
const EVENTO = 'modulos-visibles-cambio';

export function leerModulosOcultos(usuario: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(clave(usuario)) || '[]');
    return Array.isArray(v) ? v.filter(id => !MODULOS_SIEMPRE_VISIBLES.includes(id)) : [];
  } catch {
    return [];
  }
}

export function guardarModulosOcultos(usuario: string, ocultos: string[]): void {
  try {
    localStorage.setItem(clave(usuario), JSON.stringify(ocultos.filter(id => !MODULOS_SIEMPRE_VISIBLES.includes(id))));
  } catch { /* sin almacenamiento: no se persiste */ }
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { usuario } }));
}

/** Módulos ocultos del usuario; se actualiza al guardar en Configuración. */
export function useModulosOcultos(usuario: string): string[] {
  const [ocultos, setOcultos] = useState<string[]>(() => leerModulosOcultos(usuario));
  useEffect(() => {
    const recargar = () => setOcultos(leerModulosOcultos(usuario));
    recargar();
    window.addEventListener(EVENTO, recargar);
    window.addEventListener('storage', recargar);
    return () => {
      window.removeEventListener(EVENTO, recargar);
      window.removeEventListener('storage', recargar);
    };
  }, [usuario]);
  return ocultos;
}
