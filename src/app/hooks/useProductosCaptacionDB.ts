/**
 * useProductosCaptacionDB.ts
 *
 * Hook institucional para consultar la tabla J_PRODUCTOS filtrada por:
 *   type = 'Captación'
 *
 * Columnas REALES de la tabla (solo 3):
 *   id   (uuid PK autogenerado)
 *   type (varchar NOT NULL) → 'Captación'
 *   data (jsonb NULL)       → nodo padre con campos del producto + subtipo + estatus embebidos
 *
 * NO existen columnas subtipo ni estatus en la tabla.
 * Esos valores se almacenan DENTRO del jsonb "data".
 *
 * Mapeo institucional al grid (Formulario de Lista Principal):
 *   CLAVE             ← data.claveProducto
 *   PRODUCTO          ← data.nombreProducto
 *   TIPO DE PRODUCTO  ← data.tipoProducto
 *   LÍNEA DE PRODUCTO ← data.lineaProducto
 *   TIPO TASA         ← data.tipoTasa
 *   ESTATUS           ← data.estatus
 *   CUENTA EJE        ← data.cuentaEje
 *   id (UUID PK)      ← columna id (oculto, para Edit/View/Persistencia)
 *
 * Estrategia de fetch:
 *   1. Intentar ruta dedicada /productos-captacion (edge function v5+)
 *      ⚠️ DESACTIVADO hasta redespliegue (RUTA_DEDICADA_DISPONIBLE = false)
 *   2. Fallback: /productos (todos) + filtro client-side por type='Captación'
 *      (compatible con servidor viejo que solo tiene /productos?tipo=)
 *   3. Fallback: /productos?tipo=Captacion (legacy, por si aún hay
 *      registros con type='Captacion' en vez del nuevo esquema)
 *   4. Sin datos → lista vacía (sin mock data)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Product } from '../types/product';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

/** Estructura cruda de un registro devuelto por el servidor */
interface ProductoCaptacionRow {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

/**
 * Mapea un registro crudo de J_PRODUCTOS a la interfaz Product.
 *
 * Soporta DOS esquemas de JSONB:
 *
 * ESQUEMA NUEVO (institucional):
 *   data.claveProducto, data.nombreProducto, data.tipoProducto,
 *   data.lineaProducto, data.tipoTasa, data.cuentaEje, data.estatus
 *
 * ESQUEMA LEGACY (datos existentes creados por ProductoCaptacionForm):
 *   data.datosGenerales[0].clave, .producto, .tipoProducto, etc.
 *
 * El campo `estatus` se lee del JSONB data (no existe como columna física)
 */
function mapRowToProduct(row: ProductoCaptacionRow, index: number): Product {
  const d = (row.data || {}) as Record<string, any>;

  // ── Nodo "datosGenerales" legacy (array con un solo elemento) ──
  const dg = Array.isArray(d.datosGenerales) && d.datosGenerales.length > 0
    ? d.datosGenerales[0]
    : null;

  // ── Lectores con fallback: campo institucional → legacy → vacío ──
  const claveProducto   = d.claveProducto   || (dg?.clave)         || d.clave         || '';
  const nombreProducto  = d.nombreProducto  || (dg?.producto)      || d.producto      || (dg?.nombre) || d.nombre || '';
  const tipoProducto    = d.tipoProducto    || (dg?.tipoProducto)  || '';
  const lineaProducto   = d.lineaProducto   || (dg?.lineaProducto) || 'Captación';
  const tipoTasa        = d.tipoTasa        || (dg?.tipoTasa)      || 'Fija';
  const cuentaEje       = d.cuentaEje ?? (dg?.cuentaEje) ?? false;

  // ESTATUS: se lee del JSONB data (no existe como columna física)
  const estatus = d.estatus || (dg?.estatus) || 'Pendiente';

  // Tabs anidados (legacy, arrays de un solo elemento) — también soporta objeto directo (seed)
  const extractObj = (val: any) => {
    if (Array.isArray(val) && val.length > 0) return val[0];
    if (val && typeof val === 'object' && !Array.isArray(val)) return val;
    return undefined;
  };
  const cl = extractObj(d.checkListCaptaciones);
  const ti = extractObj(d.tasaInversion);
  const co = extractObj(d.constitucion);
  const cmConfig = extractObj(d.comisionesConfig) || (d.comisiones && !Array.isArray(d.comisiones) ? extractObj(d.comisiones) : undefined);
  const fa = extractObj(d.fases);

  return {
    // ── PK de J_PRODUCTOS (UUID) — para CRUD via Liga de Edit / Liga de View ──
    identificacion: row.id,
    dbUuid: row.id,

    // ── ID local (para compatibilidad con la lista) ──
    id: d.localId ?? (index + 1),

    // ── Campos del grid institucional ──
    nombre: nombreProducto,
    producto: nombreProducto,
    clave: claveProducto,
    tipoProducto: tipoProducto,
    lineaProducto: lineaProducto,
    sublineaProducto: tipoProducto,
    tipoTasa: tipoTasa as Product['tipoTasa'],
    estatus: estatus as Product['estatus'],
    cuentaEje: cuentaEje,

    // ── Otros campos generales ──
    descripcion: d.descripcion || (dg?.descripcion) || '',
    moneda: d.tipoMoneda || (dg?.tipoMoneda) || d.moneda || (dg?.moneda) || 'MXN',
    sucursal: d.sucursal || (dg?.sucursal) || '',
    fechaRegistro: d.fechaRegistro || (dg?.fechaRegistro) || '',
    baseCalculo: (d.baseCalculo || (dg?.baseCalculo) || '360') as Product['baseCalculo'],
    aplicaInteresMoratorio: d.aplicaInteresMoratorio ?? (dg?.aplicaInteresMoratorio) ?? false,
    usuarioRegistro: d.usuarioRegistro || (dg?.usuarioRegistro) || '',
    puestoTrabajo: d.puestoTrabajo || (dg?.puestoTrabajo) || '',

    // ── Campos propios de captación ──
    tasaBase: d.tasaBase || (dg?.tasaBase) || 'Fija',
    generaInteres: d.generaInteres ?? (dg?.generaInteres) ?? false,
    capitalizaIntereses: d.capitalizaIntereses ?? (dg?.capitalizaIntereses) ?? false,
    frecuenciaPagoIntereses: d.frecuenciaPagoIntereses || (dg?.frecuenciaPagoIntereses) || '',
    plazo: d.plazo || (dg?.plazo) || '',
    periodoCorte: d.periodoCorte || (dg?.periodoCorte) || '',
    diasVentana: d.diasVentana || (dg?.diasVentana) || '',
    montoMinimo: d.montoMinimo ?? (dg?.montoMinimo) ?? '',
    montoMaximo: d.montoMaximo ?? (dg?.montoMaximo) ?? '',
    numeroMaximoRenovaciones: d.numeroMaximoRenovaciones || (dg?.numeroMaximoRenovaciones) || '',
    tasaInicial: d.tasaInicial || (dg?.tasaInicial) || '',
    porcentajeIncremento: d.porcentajeIncremento || (dg?.porcentajeIncremento) || '',
    tasaMinima: d.tasaMinima || (dg?.tasaMinima) || '',
    tasaMaxima: d.tasaMaxima || (dg?.tasaMaxima) || '',

    // ── Tab objetos anidados ──
    checkListCaptaciones: cl || undefined,
    tasaInversion: ti || undefined,
    constitucion: co || undefined,
    comisiones: Array.isArray(d.comisiones) ? d.comisiones : (Array.isArray(d.comisionesRegistros) ? d.comisionesRegistros : undefined),
    comisionesConfig: cmConfig || undefined,
    fases: fa || undefined,

    // ── Arrays de registros de tabs (captación-específicos) ──
    checkListCaptacionesRegistros: Array.isArray(d.checkListRegistros) ? d.checkListRegistros
      : (Array.isArray(d.checkListCaptacionesRegistros) ? d.checkListCaptacionesRegistros : undefined),
    tasaInversionRegistros: Array.isArray(d.tasaInversionRegistros) ? d.tasaInversionRegistros : undefined,
    periodosRegistros: Array.isArray(d.periodosRegistros) ? d.periodosRegistros : undefined,
    constitucionRegistros: Array.isArray(d.constitucionRegistros) ? d.constitucionRegistros : undefined,
    comisionesRegistros: Array.isArray(d.comisionesRegistros) ? d.comisionesRegistros : undefined,
    fasesRegistros: Array.isArray(d.fasesRegistros) ? d.fasesRegistros : undefined,
    cargoRegistros: Array.isArray(d.cargoRegistros) ? d.cargoRegistros : undefined,
    checkListRegistros: Array.isArray(d.checkListRegistros) ? d.checkListRegistros : undefined,

    // ── Arrays de registros de tabs homologados (compartidos con Crédito) ──
    matrizTasaFijaRegistros: Array.isArray(d.matrizTasaFijaRegistros) ? d.matrizTasaFijaRegistros : undefined,
    matrizTasaVariableRegistros: Array.isArray(d.matrizTasaVariableRegistros) ? d.matrizTasaVariableRegistros : undefined,
    sucursalRegistros: Array.isArray(d.sucursalRegistros) ? d.sucursalRegistros : undefined,
    expedientesRegistros: Array.isArray(d.expedientesRegistros) ? d.expedientesRegistros : undefined,
    tasasReferenciaRegistros: Array.isArray(d.tasasReferenciaRegistros) ? d.tasasReferenciaRegistros : undefined,

    // ── Acceso Cuenta (array de canales operativos) ──
    accesoCuenta: Array.isArray(d.accesoCuenta) ? d.accesoCuenta : undefined,
  } as Product;
}

/**
 * Hook principal — consulta J_PRODUCTOS con filtro institucional:
 *   type = 'Captación'
 *
 * @param active - solo fetch cuando el subtab de captación está visible en modo lista
 */
export function useProductosCaptacionDB(active: boolean) {
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
          return res;
        } catch (err) {
          if (signal?.aborted) throw err;
          if (attempt === retries) throw err;
          console.warn(`[useProductosCaptacionDB] Intento ${attempt}/${retries} fallo, reintentando en ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
        }
      }
      throw new Error('Unreachable');
    };

    const headers = { 'Authorization': `Bearer ${publicAnonKey}` };

    try {
      // ── Seed completo: solo una vez por sesión (fire-and-forget) ──
      if (!seedDone.current) {
        seedDone.current = true;
        fetch(`${API_BASE}/seed-productos-completos`, {
          headers,
        }).then(r => r.json()).then(j => {
          console.log('[useProductosCaptacionDB] Seed completo response (async):', j);
        }).catch(seedErr => {
          console.warn('[useProductosCaptacionDB] Seed completo falló (no crítico):', seedErr);
        });
      }

      // ══════════════════════════════════════════════════════════════
      // ESTRATEGIA DE FETCH con fallback progresivo:
      //
      // 1) /productos-captacion → ruta dedicada (edge v5+)
      //    Ejecuta: WHERE type='Captación'
      //    Devuelve columnas: id, type, data
      //
      // 2) /productos (sin filtro) → fallback si ruta 1 no existe
      //    Filtra client-side por type='Captación'
      //
      // 3) /productos?tipo=Captacion → legacy fallback
      //    Para registros con type='Captacion' (esquema anterior)
      // ══════════════════════════════════════════════════════════════

      let rows: ProductoCaptacionRow[] = [];
      let usedRoute = '';

      // ── Intento 1: Ruta dedicada /productos-captacion ──
      // ⚠️ DESACTIVADO TEMPORALMENTE: la edge function v5 con esta ruta
      // NO está desplegada aún. Reactivar después del redespliegue
      // cambiando RUTA_DEDICADA_DISPONIBLE a true.
      const RUTA_DEDICADA_DISPONIBLE = false;
      if (RUTA_DEDICADA_DISPONIBLE) {
        console.log('[useProductosCaptacionDB] Intentando ruta /productos-captacion...');
        try {
          const res1 = await fetchWithRetry(`${API_BASE}/productos-captacion`, { headers }, 1, 500);
          if (res1.ok) {
            const json1 = await res1.json();
            if (json1.success && Array.isArray(json1.data)) {
              rows = json1.data;
              usedRoute = '/productos-captacion';
              console.log(`[useProductosCaptacionDB] ✅ Ruta /productos-captacion — ${rows.length} registros (${json1._version || 'sin version'})`);
            }
          } else {
            console.warn(`[useProductosCaptacionDB] Ruta /productos-captacion respondió HTTP ${res1.status}, intentando fallback...`);
          }
        } catch (err) {
          if (signal?.aborted) throw err;
          console.warn('[useProductosCaptacionDB] Ruta /productos-captacion no disponible, intentando fallback...');
        }
      }

      // ── Intento 2: Fallback a /productos (todos) con filtro client-side ──
      if (rows.length === 0 && !usedRoute) {
        console.log('[useProductosCaptacionDB] Fallback: consultando /productos (todos) + filtro client-side...');
        try {
          const res2 = await fetchWithRetry(`${API_BASE}/productos`, { headers });
          if (res2.ok) {
            const json2 = await res2.json();
            const allRows: ProductoCaptacionRow[] = json2.data || [];
            // Filtro client-side: solo productos de Captación
            const captacionRows = allRows.filter((r: ProductoCaptacionRow) => {
              const t = (r.type || '').toLowerCase();
              return t.includes('captaci') || t === 'captacion';
            });
            console.log(`[useProductosCaptacionDB] Fallback /productos — ${allRows.length} total, ${captacionRows.length} de Captación`);
            if (captacionRows.length > 0) {
              rows = captacionRows;
              usedRoute = '/productos (filtrado client-side type=Captación)';
            }
          }
        } catch (err) {
          if (signal?.aborted) throw err;
          console.warn('[useProductosCaptacionDB] Fallback /productos también falló');
        }
      }

      // ── Intento 3: Legacy /productos?tipo=Captacion ──
      if (rows.length === 0 && !usedRoute) {
        console.log('[useProductosCaptacionDB] Legacy fallback: /productos?tipo=Captacion...');
        try {
          const res3 = await fetchWithRetry(`${API_BASE}/productos?tipo=Captacion`, { headers });
          if (res3.ok) {
            const json3 = await res3.json();
            rows = json3.data || [];
            if (rows.length > 0) {
              usedRoute = '/productos?tipo=Captacion (legacy)';
              console.log(`[useProductosCaptacionDB] Legacy fallback — ${rows.length} registros`);
            }
          }
        } catch (err) {
          if (signal?.aborted) throw err;
          console.warn('[useProductosCaptacionDB] Legacy fallback /productos?tipo=Captacion también falló');
        }
      }

      // ── Sin datos: lista vacía (sin mock) ──
      if (rows.length === 0) {
        console.log('[useProductosCaptacionDB] No se encontraron productos de Captación en la BD. Lista vacía.');
        if (!signal?.aborted) {
          setProductos([]);
        }
        return;
      }

      console.log(`[useProductosCaptacionDB] Ruta usada: ${usedRoute} — ${rows.length} registros finales`);

      if (!signal?.aborted) {
        const mapped = rows.map(mapRowToProduct);
        setProductos(mapped);
      }
    } catch (err) {
      if (signal?.aborted) return;
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[useProductosCaptacionDB] Error:', msg);
      setError(msg);
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch automatico cuando el tab se activa, con cleanup
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