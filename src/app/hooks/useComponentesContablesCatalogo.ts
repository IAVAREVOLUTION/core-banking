/**
 * useComponentesContablesCatalogo.ts — REQ-15
 *
 * Lectura del catálogo de **Componentes Contables** (Configuración → Catálogos
 * Contables → Componentes) para poblar los selects de "Tipo de Cargo" del
 * subtab Cargos del Producto y de la pestaña Cargos de la Solicitud.
 *
 * Es de SOLO LECTURA a propósito: el alta/edición/baja sigue viviendo en
 * `ComponentesContablesSection`, que no se toca. Comparte con esa pantalla el
 * mismo endpoint y la misma clave de cache en sessionStorage, así que si el
 * usuario ya visitó el catálogo, el select se llena de inmediato sin esperar
 * a la red.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

export interface ComponenteContable {
  id: string;
  codigo: string;
  nombre: string;
}

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const ENDPOINT = 'componentes-contables';
/** Misma clave que usa ComponentesContablesSection — cache compartido. */
const STORAGE_KEY = 'config_componentes_contables_v1';
const LOG = '[ComponentesCatalogo]';

/**
 * Valores previos del select de Tipo de Cargo. Se usan sólo si el catálogo no
 * responde y no hay nada en cache, para que el modal nunca quede sin opciones.
 */
export const TIPO_CARGO_FALLBACK = ['IVA', 'CAPITAL', 'INTERÉS'];

const leerCache = (): ComponenteContable[] => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* cache corrupto → se ignora */ }
  return [];
};

export function useComponentesContablesCatalogo() {
  const [componentes, setComponentes] = useState<ComponenteContable[]>(leerCache);
  const [loading, setLoading] = useState(false);
  const pedidoRef = useRef(false);

  const recargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/${ENDPOINT}`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const items: ComponenteContable[] = Array.isArray(json.data) ? json.data : [];
      setComponentes(items);
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* cuota */ }
    } catch (err: any) {
      // Sin red: se conserva lo que haya en cache (o vacío → el select usa el fallback).
      console.log(`${LOG} no se pudo leer el catálogo (${err?.message}) — se usa cache local`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pedidoRef.current) return;
    pedidoRef.current = true;
    recargar();
  }, [recargar]);

  /** Opciones listas para un `<select>`: value = nombre, label = "01 · CAPITAL". */
  const opcionesTipoCargo = componentes.length > 0
    ? componentes.map(c => ({ value: c.nombre, label: c.codigo ? `${c.codigo} · ${c.nombre}` : c.nombre }))
    : TIPO_CARGO_FALLBACK.map(v => ({ value: v, label: v }));

  return { componentes, opcionesTipoCargo, loading, recargar, desdeCatalogo: componentes.length > 0 };
}
