/**
 * useCatalogoDocumentosDB.ts
 *
 * Hook que consulta J_CATALOGOS (type='Documento') y devuelve la lista
 * de tipos de documento activos para poblar dropdowns.
 *
 * Estrategia: Edge Function /catalogos/documentos → sessionStorage fallback → hardcoded fallback
 */
import { useState, useEffect, useRef } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const STORAGE_KEY = 'catalogo_documentos_nombres_v1';

/** Fallback si la API no responde y no hay cache */
const FALLBACK_TIPOS = [
  'Credencial de elector',
  'Pasaporte',
  'Licencia de conducir',
  'Cartilla militar',
  'Visa',
  'Tarjeta de residencia',
  'Cédula de ciudadanía',
  'Registro Federal de Contribuyentes (RFC)',
  'Comprobante de domicilio',
  'Estado de cuenta bancario',
  'Documento de propiedad',
  'Acta constitutiva',
  'Poder notarial',
  'Comprobante de ingresos',
  'Certificado de nacimiento',
  'Certificado de matrimonio',
  'Certificado de defunción',
  'Otro',
];

export function useCatalogoDocumentosDB() {
  const [tiposDocumento, setTiposDocumento] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    const cached = (() => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as string[];
      } catch { /* */ }
      return null;
    })();

    // Siempre ir a la DB — el catálogo puede cambiar frecuentemente
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* */ }

    fetch(`${API_BASE}/catalogos/documentos`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
    })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(json => {
        const rows: any[] = json.data || [];
        const nombres = rows
          .filter(r => r.data?.activo !== false)
          .map(r => (r.data?.nombre || '').trim())
          .filter(Boolean);
        if (nombres.length > 0) {
          setTiposDocumento(nombres);
        } else {
          setTiposDocumento(FALLBACK_TIPOS);
        }
      })
      .catch(err => {
        console.warn('[useCatalogoDocumentosDB] Error al cargar catálogo:', err);
        if (!cached || cached.length === 0) setTiposDocumento(FALLBACK_TIPOS);
      })
      .finally(() => setLoading(false));
  }, []);

  return { tiposDocumento, loading };
}