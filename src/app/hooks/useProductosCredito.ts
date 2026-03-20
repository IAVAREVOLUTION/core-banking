/**
 * useProductosCredito.ts
 * Hook para consultar la tabla J_PRODUCTOS filtrada por type = 'Credito'
 * y mapear los campos del JSONB (data) al tipo Product del frontend.
 *
 * Columnas reales de la tabla:
 *   id   (uuid PK autogenerado)
 *   type (varchar)
 *   data (jsonb)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Product } from '../types/product';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

/** Estructura cruda de un registro devuelto por el servidor (columnas reales de la BD) */
interface ProductoCreditoRow {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

/**
 * Mapea un registro crudo de J_PRODUCTOS a la interfaz Product del frontend.
 * Los campos del producto se extraen del JSONB (columna "data").
 *
 * Soporta dos formatos de JSONB:
 *   A. Plano (ej. seed PR-001): campos directos sin nodos hijos.
 *   B. Estructurado (guardado desde ProductoForm): nodo padre + subtabs como nodos hijos.
 *
 * En ambos casos se propaga el UUID de la BD como `dbUuid` para
 * que la Liga de Edit pueda ejecutar UPDATE en lugar de INSERT.
 */
function mapRowToProduct(row: ProductoCreditoRow, index: number): Product {
  const d = (row.data || {}) as Record<string, any>;

  // El nodo "default" puede contener campos adicionales (moneda, cat, etc.)
  // que no están en el nodo padre. Priorizar default si existe.
  const def = (d.default || {}) as Record<string, any>;

  return {
    // ── PK de J_PRODUCTOS (UUID) — para CRUD ──
    identificacion: row.id,
    dbUuid: row.id,

    // ── Campos del nodo padre (Datos Generales) ──
    idProducto: (d.idProducto as string) || '',
    id: index + 1,
    nombre: (d.nombre as string) || '',
    descripcion: (d.descripcion as string) || '',
    lineaProducto: (d.lineaProducto as string) || '',
    sublineaProducto: (d.sublinea as string) || '',
    sucursal: (d.sucursal as string) || '',
    estatus: ((d.estatus as string) || 'Pendiente') as Product['estatus'],
    fechaRegistro: (d.fechaRegistro as string) || '',

    // ── Campos del subtab Default (pueden estar en def o en d directo) ──
    moneda: (def.moneda as string) || (d.moneda as string) || 'MXN',
    cat: (def.cat as number) ?? (d.cat as number) ?? undefined,
    tipoTasa: ((def.tipoTasa as string) || (d.tipoTasa as string) || 'Fija') as Product['tipoTasa'],
    baseCalculo: ((def.baseCalculo as string) || (d.baseCalculo as string) || '360') as Product['baseCalculo'],
    aplicaInteresMoratorio: (def.aplicaInteresMoratorio as boolean) ?? (d.aplicaInteresMoratorio as boolean) ?? false,
    descuentoNomina: (def.descuentoNomina as boolean) ?? (d.descuentoNomina as boolean) ?? false,
    usuarioRegistro: (def.usuarioRegistro as string) || (d.usuarioRegistro as string) || '',
    puestoTrabajo: (def.puestoTrabajo as string) || (d.puestoTrabajo as string) || '',

    // ── Nodos hijos (subtabs) — arrays de detalle maestro-detalle ──
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

    // ── Nodos hijos estáticos (se guardan/leen del JSONB para Modo Consulta) ──
    amortizaciones: Array.isArray(d.amortizaciones) ? d.amortizaciones : undefined,
    expedientesElectronicos: Array.isArray(d.expedientesElectronicos) ? d.expedientesElectronicos : undefined,
    autorizacionNiveles: Array.isArray(d.autorizacion) ? d.autorizacion : undefined,
    eventoContable: Array.isArray(d.eventoContable) ? d.eventoContable : undefined,
  };
}

export function useProductosCredito(active: boolean) {
  const [productos, setProductos] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetched = useRef(false);
  const seedDone = useRef(false);

  const fetchProductos = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    // ── Retry helper con backoff exponencial ──
    const fetchWithRetry = async (url: string, opts: RequestInit, retries = 3, delay = 800): Promise<Response> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const res = await fetch(url, { ...opts, signal });
          // Reintentar en errores 5xx (ej. connection pool exhaustion) salvo último intento
          if (res.status >= 500 && attempt < retries) {
            console.warn(`[useProductosCredito] Intento ${attempt}/${retries} HTTP ${res.status}, reintentando en ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
            continue;
          }
          return res;
        } catch (err) {
          if (signal?.aborted) throw err; // No reintentar si se canceló
          if (attempt === retries) throw err;
          console.warn(`[useProductosCredito] Intento ${attempt}/${retries} falló, reintentando en ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2; // Backoff exponencial
        }
      }
      throw new Error('Unreachable');
    };

    try {
      // ── Seed: solo una vez por sesión (fire-and-forget, no bloquea) ──
      if (!seedDone.current) {
        seedDone.current = true;
        // Seed original + seed completo en paralelo
        fetch(`${API_BASE}/seed-credito`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        }).then(r => r.json()).then(j => {
          console.log('[useProductosCredito] Seed response (async):', j);
        }).catch(seedErr => {
          console.warn('[useProductosCredito] Seed falló (no crítico, async):', seedErr);
        });
        fetch(`${API_BASE}/seed-productos-completos`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        }).then(r => r.json()).then(j => {
          console.log('[useProductosCredito] Seed completo response (async):', j);
        }).catch(seedErr => {
          console.warn('[useProductosCredito] Seed completo falló (no crítico, async):', seedErr);
        });
      }

      console.log('[useProductosCredito] Consultando J_PRODUCTOS type=Credito...');
      const res = await fetchWithRetry(`${API_BASE}/productos-credito`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      });

      if (signal?.aborted) return;

      // Read response as text first for safe parsing
      const text = await res.text();
      console.log('[useProductosCredito] Response status:', res.status, '| body length:', text.length);

      let json: any;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        console.error('[useProductosCredito] No se pudo parsear JSON. Respuesta cruda (primeros 500 chars):', text.substring(0, 500));
        throw new Error(`Respuesta del servidor no es JSON válido (HTTP ${res.status}). Contenido: ${text.substring(0, 200)}`);
      }

      if (!res.ok) {
        const errMsg = json.error || `HTTP ${res.status}: Error al consultar productos crédito`;
        console.error('[useProductosCredito] Error respuesta servidor:', errMsg);
        throw new Error(errMsg);
      }

      const allRows: ProductoCreditoRow[] = json.data || [];
      // Filtro de seguridad client-side: solo type='Credito'
      const rows = allRows.filter(r => r.type === 'Credito');
      console.log(`[useProductosCredito] ${allRows.length} registros recibidos, ${rows.length} con type=Credito`);

      if (!signal?.aborted) {
        const mapped = rows.map(mapRowToProduct);
        setProductos(mapped);
      }
    } catch (err) {
      if (signal?.aborted) return; // Ignorar errores de fetch cancelado
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[useProductosCredito] Error:', msg);
      setError(msg);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch automático cuando el tab se activa, con cleanup
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