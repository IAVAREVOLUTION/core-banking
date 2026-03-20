/**
 * useProductosSeguros.ts
 * Hook para consultar la tabla J_PRODUCTOS filtrada por type = 'Seguro'
 * y mapear los campos del JSONB (data) al tipo Product del frontend.
 *
 * Columnas reales de la tabla:
 *   id   (uuid PK autogenerado)
 *   type (varchar)  — valor: 'Seguro'
 *   data (jsonb)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Product } from '../types/product';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

/** Estructura cruda de un registro devuelto por el servidor */
interface ProductoSeguroRow {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

/**
 * Mapea un registro crudo de J_PRODUCTOS (type='Seguro') a la interfaz Product del frontend.
 * Los campos se extraen del JSONB (columna "data").
 */
function mapRowToProduct(row: ProductoSeguroRow, index: number): Product {
  const d = (row.data || {}) as Record<string, any>;
  const def = (d.default || {}) as Record<string, any>;

  return {
    // PK de J_PRODUCTOS (UUID) para CRUD
    identificacion: row.id,
    dbUuid: row.id,

    // Campos del nodo padre (Datos Generales)
    idProducto: (d.idProducto as string) || '',
    id: index + 1,
    nombre: (d.nombre as string) || (d.nombreProducto as string) || '',
    descripcion: (d.descripcion as string) || '',
    lineaProducto: (d.lineaProducto as string) || 'Seguros',
    sublineaProducto: (d.sublinea as string) || (d.sublineaProducto as string) || '',
    sucursal: (d.sucursal as string) || '',
    estatus: ((d.estatus as string) || 'Pendiente') as Product['estatus'],
    fechaRegistro: (d.fechaRegistro as string) || '',

    // Campos del subtab Default
    moneda: (def.moneda as string) || (d.moneda as string) || 'MXN',
    cat: (def.cat as number) ?? (d.cat as number) ?? undefined,
    tipoTasa: ((def.tipoTasa as string) || (d.tipoTasa as string) || 'Fija') as Product['tipoTasa'],
    baseCalculo: ((def.baseCalculo as string) || (d.baseCalculo as string) || '360') as Product['baseCalculo'],
    aplicaInteresMoratorio: (def.aplicaInteresMoratorio as boolean) ?? (d.aplicaInteresMoratorio as boolean) ?? false,
    descuentoNomina: (def.descuentoNomina as boolean) ?? (d.descuentoNomina as boolean) ?? false,
    usuarioRegistro: (def.usuarioRegistro as string) || (d.usuarioRegistro as string) || '',
    puestoTrabajo: (def.puestoTrabajo as string) || (d.puestoTrabajo as string) || '',

    // Nodos hijos (subtabs)
    periodos: Array.isArray(d.periodos) ? d.periodos : undefined,
    matrizTasaFija: Array.isArray(d.matrizTasaFija) ? d.matrizTasaFija : undefined,
    tasasReferencia: Array.isArray(d.tasaReferencia) ? d.tasaReferencia : undefined,
    matrizTasaVariable: Array.isArray(d.matrizTasaVariable) ? d.matrizTasaVariable : undefined,
    requisitos: Array.isArray(d.requisitos) ? d.requisitos : undefined,
    paquetes: Array.isArray(d.paquetes) ? d.paquetes : undefined,
    sucursales: Array.isArray(d.sucursalConfig) ? d.sucursalConfig : undefined,
    cargos: Array.isArray(d.cargo) ? d.cargo : undefined,
    prelacion: Array.isArray(d.prelacionCargos) ? d.prelacionCargos : undefined,
    fases: Array.isArray(d.fases) ? d.fases : undefined,
    garantias: Array.isArray(d.garantias) ? d.garantias : undefined,
    impuestos: Array.isArray(d.impuestos) ? d.impuestos : undefined,
    comisiones: Array.isArray(d.comisiones) ? d.comisiones : Array.isArray(d.comision) ? d.comision : undefined,
    tabulador: Array.isArray(d.tabuladorProductos) ? d.tabuladorProductos : undefined,
    amortizaciones: Array.isArray(d.amortizaciones) ? d.amortizaciones : undefined,
    expedientesElectronicos: Array.isArray(d.expedientesElectronicos) ? d.expedientesElectronicos : undefined,
    autorizacionNiveles: Array.isArray(d.autorizacion) ? d.autorizacion : undefined,
    eventoContable: Array.isArray(d.eventoContable) ? d.eventoContable : undefined,
  };
}

export function useProductosSeguros(active: boolean) {
  const [productos, setProductos] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);
  const seedDone = useRef(false);

  const fetchProductos = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    // Retry helper con backoff exponencial
    const fetchWithRetry = async (url: string, opts: RequestInit, retries = 3, delay = 800): Promise<Response> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const res = await fetch(url, { ...opts, signal });
          if (res.status >= 500 && attempt < retries) {
            console.warn(`[useProductosSeguros] Intento ${attempt}/${retries} HTTP ${res.status}, reintentando en ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
            continue;
          }
          return res;
        } catch (err) {
          if (signal?.aborted) throw err;
          if (attempt === retries) throw err;
          console.warn(`[useProductosSeguros] Intento ${attempt}/${retries} falló, reintentando en ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
        }
      }
      throw new Error('Unreachable');
    };

    try {
      // ── Seed completo: solo una vez por sesión (fire-and-forget) ──
      if (!seedDone.current) {
        seedDone.current = true;
        fetch(`${API_BASE}/seed-productos-completos`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        }).then(r => r.json()).then(j => {
          console.log('[useProductosSeguros] Seed completo response (async):', j);
        }).catch(seedErr => {
          console.warn('[useProductosSeguros] Seed completo falló (no crítico):', seedErr);
        });
      }

      console.log('[useProductosSeguros] Consultando J_PRODUCTOS type=Seguro...');
      let rows: ProductoSeguroRow[] = [];
      let usedRoute = '';

      // ── Intento 1: Ruta dedicada /productos-seguros ──
      try {
        const res = await fetchWithRetry(`${API_BASE}/productos-seguros`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        }, 1, 500);

        if (signal?.aborted) return;

        if (res.ok) {
          const json = await res.json();
          const allRows: ProductoSeguroRow[] = json.data || [];
          rows = allRows.filter(r => r.type === 'Seguro');
          usedRoute = '/productos-seguros';
          console.log(`[useProductosSeguros] Ruta /productos-seguros — ${allRows.length} total, ${rows.length} type=Seguro`);
        } else {
          console.warn(`[useProductosSeguros] Ruta /productos-seguros respondió HTTP ${res.status}, intentando fallback...`);
        }
      } catch (err) {
        if (signal?.aborted) throw err;
        console.warn('[useProductosSeguros] Ruta /productos-seguros no disponible, intentando fallback...');
      }

      // ── Intento 2: Fallback a /productos (todos) con filtro client-side ──
      if (rows.length === 0 && !usedRoute) {
        console.log('[useProductosSeguros] Fallback: consultando /productos (todos) + filtro client-side...');
        try {
          const res2 = await fetchWithRetry(`${API_BASE}/productos`, {
            headers: { 'Authorization': `Bearer ${publicAnonKey}` },
          });
          if (res2.ok) {
            const json2 = await res2.json();
            const allRows: ProductoSeguroRow[] = json2.data || [];
            rows = allRows.filter(r => r.type === 'Seguro');
            usedRoute = '/productos (filtro client-side type=Seguro)';
            console.log(`[useProductosSeguros] Fallback /productos — ${allRows.length} total, ${rows.length} type=Seguro`);
          }
        } catch (err) {
          if (signal?.aborted) throw err;
          console.warn('[useProductosSeguros] Fallback /productos también falló');
        }
      }

      console.log(`[useProductosSeguros] Ruta usada: ${usedRoute || '(ninguna)'} — ${rows.length} registros finales`);

      if (!signal?.aborted) {
        const mapped = rows.map(mapRowToProduct);
        setProductos(mapped);
      }
    } catch (err) {
      if (signal?.aborted) return;
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[useProductosSeguros] Error:', msg);
      setError(msg);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch automático cuando el tab se activa
  useEffect(() => {
    if (active) {
      const controller = new AbortController();
      fetchProductos(controller.signal);
      hasFetched.current = true;
      return () => controller.abort();
    }
  }, [active, fetchProductos]);

  return { productos, loading, error, refetch: fetchProductos };
}