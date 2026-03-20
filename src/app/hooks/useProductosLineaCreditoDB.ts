/**
 * useProductosLineaCreditoDB.ts
 *
 * Hook institucional para consultar la tabla J_PRODUCTOS filtrada por:
 *   type = 'ProductoLineaCredito'
 *
 * ══════════════════════════════════════════════════════════════════
 * Tabla:    "EFINANCIANET_DB"."J_PRODUCTOS"
 * Columnas: id (uuid PK autogenerado), type (varchar), data (jsonb)
 * Filtro:   type = 'ProductoLineaCredito'
 * ══════════════════════════════════════════════════════════════════
 *
 * NO existen columnas subtipo ni estatus en la tabla.
 * Esos valores se almacenan DENTRO del jsonb "data".
 *
 * Mapeo institucional al grid (Formulario de Lista Principal):
 *   NOMBRE              ← data.nombreProducto  / datosProducto[0].nombre
 *   CLAVE               ← data.claveProducto   / datosProducto[0].clave
 *   CLAVE IBS           ← data.claveIBS        / datosProducto[0].claveIbs
 *   VOD ROW ID          ← data.vodRowId        / datosProducto[0].vodRowId
 *   TIPO PRODUCTO       ← data.tipoProducto    / datosProducto[0].tipoProducto
 *   ESTATUS             ← data.estatus         / data.default.estatus
 *   OPCIÓN COMPRA       ← data.opcionCompra    / datosProducto[0].opcionCompra
 *   % OPCIÓN COMPRA     ← data.porcentajeOpcionCompra
 *   TASA BASE           ← data.tasaBase        / data.default.tasaBase
 *   CÁLCULO             ← data.calculo
 *   BASE CÁLCULO        ← data.baseCalculo
 *   PRODUCTO SEGU       ← data.productoSeguro  / datosProducto[0].productoSeg
 *   REFERENCIA CLIENTE  ← data.referenciaCliente
 *   REFERENCIA PRODUCTO ← data.referenciaProducto
 *   RENTABILIDAD        ← data.rentabilidad
 *   TASA                ← data.tasa
 *   id (UUID PK)        ← columna id (oculto, para Edit/View/Persistencia)
 *
 * Estrategia de fetch con fallback progresivo (3 niveles):
 *   1. Ruta dedicada /productos-linea-credito (edge function v5+)
 *      ⚠️ DESACTIVADO hasta redespliegue (RUTA_DEDICADA_DISPONIBLE = false)
 *   2. Fallback: /productos (todos) + filtro client-side por type='ProductoLineaCredito'
 *   3. Fallback legacy: /productos?tipo=ProductoLineaCredito
 *   4) Lista vacía — si no hay datos en BD la tabla se muestra vacía
 *      ✅ Mock eliminado
 *
 * El JSONB almacenado por ProductoLineaCreditoForm.tsx tiene esta forma:
 * {
 *   localId,
 *   nombreProducto, claveProducto, ..., (campos planos - Datos Generales)
 *   default: { ...mismos campos del padre... },
 *   garantias: [...],
 *   jerarquiaProductos: [...],    // institucional (legacy: jerarquias)
 *   comitesCredito: [...],        // institucional (legacy: comites)
 *   periodicidad: [...],          // institucional (legacy: periodicidades)
 *   fases: [...],
 *   matrizTasaFija: [...],
 *   ivaPorcentaje: [...],
 *   exentoIVA: [...],             // institucional (legacy: exentoIva)
 *   checkList: [...],
 *   condicionesDisposicion: [...],
 *   parametrosCalculo: [...],
 * }
 *
 * También soporta formato legacy con datosProducto[] para registros anteriores.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { ProductoLineaCredito } from '../types/productoLineaCredito';
// ✅ Mock eliminado — el listado se alimenta exclusivamente de J_PRODUCTOS

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

/** Estructura cruda de un registro devuelto por el servidor */
interface ProductoLineaCreditoRow {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

/**
 * Mapea un registro crudo de J_PRODUCTOS (type='ProductoLineaCredito') a la interfaz
 * ProductoLineaCredito del frontend.
 *
 * Soporta DOS formatos de JSONB:
 *   A. Plano (seed): campos directos — data.nombreProducto, data.claveProducto, etc.
 *   B. Estructurado (guardado desde ProductoLineaCreditoForm): nodo datosProducto + subtabs.
 *
 * En ambos casos se propaga el UUID de la BD como `dbUuid` para que la
 * Liga de Edit pueda ejecutar UPDATE en lugar de INSERT.
 */
function mapRowToProduct(row: ProductoLineaCreditoRow, index: number): ProductoLineaCredito {
  const d = (row.data || {}) as Record<string, any>;

  // datosProducto es un array con un solo elemento (patron del Form)
  const dp = Array.isArray(d.datosProducto) && d.datosProducto.length > 0
    ? d.datosProducto[0]
    : (d as Record<string, any>);

  // El nodo default puede contener campos adicionales
  const def = (d.default || dp.default || {}) as Record<string, any>;

  return {
    // ── PK de J_PRODUCTOS (UUID) — para CRUD ──
    dbUuid: row.id,

    // ── ID local (para compatibilidad con la lista) ──
    id: d.localId ?? (index + 1),

    // ── Columna izquierda ──
    // Soportar ambos formatos: data.nombreProducto (seed) y datosProducto[0].nombre (form)
    nombre: dp.nombreProducto || dp.nombre || d.nombreProducto || '',
    clave: dp.claveProducto || dp.clave || d.claveProducto || '',
    descripcion: dp.descripcion || d.descripcion || '',
    tipoProducto: dp.tipoProducto || d.tipoProducto || 'Línea de Crédito',
    subTipo: dp.subTipo || d.subTipo || '',
    sucursal: dp.sucursal || d.sucursal || '',
    nombreEquipoAnalista: dp.nombreEquipoAnalista || '',
    nombreEquipoAnalistaMesa: dp.nombreEquipoAnalistaMesa || '',

    // ── Columna central ──
    tipoLinea: dp.tipoLinea || '',
    montoMinimo: dp.montoMinimo ?? '',
    montoMaximo: dp.montoMaximo ?? '',
    permiteSobregiros: dp.permiteSobregiros ?? false,
    tipoSobregiro: dp.tipoSobregiro || '',
    montoOPorcentaje: dp.montoOPorcentaje || '',
    numDisposicionesAbiertas: dp.numDisposicionesAbiertas ?? '',
    intervaloCleanUp: dp.intervaloCleanUp ?? '',
    verificacionCleanUp: dp.verificacionCleanUp ?? false,

    // ── Columna derecha ──
    porcentajeComisionApertura: dp.porcentajeComisionApertura ?? '',
    plazoMinimoDisposicion: dp.plazoMinimoDisposicion ?? '',
    plazoMaximoDisposicion: dp.plazoMaximoDisposicion ?? '',
    diasGraciaDisposicion: dp.diasGraciaDisposicion ?? '',
    vigenciaLineaDias: dp.vigenciaLineaDias ?? '',
    porcentajeInteresMoratorio: dp.porcentajeInteresMoratorio ?? '',
    diasParaRenovacion: dp.diasParaRenovacion ?? '',

    // ── Campos para tabla (grid) ──
    // claveIBS con soporte para variantes de capitalización
    claveIbs: dp.claveIBS || dp.claveIbs || d.claveIBS || d.claveIbs || '',
    vodRowId: dp.vodRowId || d.vodRowId || '',
    opcionCompra: dp.opcionCompra || d.opcionCompra || '',
    porcentajeOpcionCompra: dp.porcentajeOpcionCompra ?? d.porcentajeOpcionCompra ?? '',
    tasaBase: dp.tasaBase || def.tasaBase || d.tasaBase || '',
    calculo: dp.calculo || d.calculo || '',
    // productoSeguro (spec) con fallback a productoSeg (form/legacy)
    productoSeg: dp.productoSeguro || dp.productoSeg || d.productoSeguro || d.productoSeg || '',
    referenciaCliente: dp.referenciaCliente || d.referenciaCliente || '',
    referenciaProducto: dp.referenciaProducto || d.referenciaProducto || '',
    rentabilidad: dp.rentabilidad ?? d.rentabilidad ?? '',
    tasa: dp.tasa ?? d.tasa ?? '',

    // ── Campos del sistema ──
    lineaProducto: dp.lineaProducto || 'Linea Credito',
    sublineaProducto: dp.sublineaProducto || dp.subTipo || '',
    estatus: dp.estatus || def.estatus || d.estatus || 'Pendiente',
    fechaRegistro: dp.fechaRegistro || d.fechaRegistro || '',
    moneda: dp.moneda || def.moneda || d.moneda || 'MXN',
    usuarioRegistro: dp.usuarioRegistro || def.usuarioRegistro || '',
    puestoTrabajo: dp.puestoTrabajo || def.puestoTrabajo || '',
    tipoTasa: dp.tipoTasa || def.tipoTasa || 'Fija',
    baseCalculo: dp.baseCalculo || def.baseCalculo || d.baseCalculo || '360',
    aplicaInteresMoratorio: dp.aplicaInteresMoratorio ?? def.aplicaInteresMoratorio ?? false,

    // ── Campos del tab Default ──
    formaDisposicion: def.formaDisposicion || dp.formaDisposicion || '',
    renovable: def.renovable ?? dp.renovable ?? false,
    frecuenciaRevision: def.frecuenciaRevision || dp.frecuenciaRevision || '',
    tipoGarantia: def.tipoGarantia || dp.tipoGarantia || '',
    destino: def.destino || dp.destino || '',
    tasaOrdinaria: def.tasaOrdinaria ?? dp.tasaOrdinaria ?? '',
    spread: def.spread ?? dp.spread ?? '',
    factorMoratorio: def.factorMoratorio ?? dp.factorMoratorio ?? '',
    comisiones: def.comisiones || dp.comisionesTexto || '',
    iva: def.iva ?? dp.iva ?? '',
    formaDevengo: def.formaDevengo || dp.formaDevengo || '',
    metodoInteres: def.metodoInteres || dp.metodoInteres || '',
    periodicidadIntereses: def.periodicidadIntereses || dp.periodicidadIntereses || '',

    // ── Nodos hijos (subtabs) — arrays maestro-detalle ──
    // Soporta AMBAS nomenclaturas:
    //   - Institucional (nueva): jerarquiaProductos, comitesCredito, periodicidad, exentoIVA, condicionesDisposicion, parametrosCalculo
    //   - Legacy (anterior):     jerarquias, comites, periodicidades, exentoIva
    garantias: Array.isArray(d.garantias) ? d.garantias : undefined,
    jerarquias: Array.isArray(d.jerarquiaProductos) ? d.jerarquiaProductos
      : (Array.isArray(d.jerarquias) ? d.jerarquias : undefined),
    comites: Array.isArray(d.comitesCredito) ? d.comitesCredito
      : (Array.isArray(d.comites) ? d.comites : undefined),
    periodicidades: Array.isArray(d.periodicidad) ? d.periodicidad
      : (Array.isArray(d.periodicidades) ? d.periodicidades : undefined),
    fases: Array.isArray(d.fases) ? d.fases : undefined,
    matrizTasaFija: Array.isArray(d.matrizTasaFija) ? d.matrizTasaFija : undefined,
    ivaPorcentaje: Array.isArray(d.ivaPorcentaje) ? d.ivaPorcentaje : undefined,
    exentoIva: Array.isArray(d.exentoIVA) ? d.exentoIVA
      : (Array.isArray(d.exentoIva) ? d.exentoIva : undefined),
    checkList: Array.isArray(d.checkList) ? d.checkList : undefined,
    condicionesDisposicion: Array.isArray(d.condicionesDisposicion) ? d.condicionesDisposicion : undefined,
    parametrosCalculo: Array.isArray(d.parametrosCalculo) ? d.parametrosCalculo : undefined,
    // Paquetes (Productos Disposición) — requerido para cross-ref de Seguros en Cotización
    paquetes: Array.isArray(d.paquetes) ? d.paquetes : undefined,
    // Sucursales, comisiones, matrizTasaVariable
    sucursales: Array.isArray(d.sucursales) ? d.sucursales : undefined,
    cargos: Array.isArray(d.cargo) ? d.cargo : undefined,
    comisionesTab: Array.isArray(d.comisiones) ? d.comisiones : undefined,
    matrizTasaVariable: Array.isArray(d.matrizTasaVariable) ? d.matrizTasaVariable : undefined,
    // Subtabs homologados: periodos, tasas referencia, expedientes/requisitos
    periodosRegistros: Array.isArray(d.periodosRegistros) ? d.periodosRegistros : undefined,
    tasasReferenciaRegistros: Array.isArray(d.tasasReferenciaRegistros) ? d.tasasReferenciaRegistros : undefined,
    expedientes: Array.isArray(d.expedientes) ? d.expedientes : undefined,
  } as ProductoLineaCredito;
}

/**
 * Hook principal — consulta J_PRODUCTOS con filtro institucional:
 *   type = 'ProductoLineaCredito'
 *
 * Implementa estrategia de 4 niveles de fallback progresivo
 * (mismo patrón que useProductosCaptacionDB.ts).
 *
 * @param active - solo fetch cuando el tab de línea de crédito está visible en modo lista
 */
export function useProductosLineaCreditoDB(active: boolean) {
  const [productos, setProductos] = useState<ProductoLineaCredito[]>([]);
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
          console.warn(`[useProductosLineaCreditoDB] Intento ${attempt}/${retries} falló, reintentando en ${delay}ms...`);
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
          console.log('[useProductosLineaCreditoDB] Seed completo response (async):', j);
        }).catch(seedErr => {
          console.warn('[useProductosLineaCreditoDB] Seed completo falló (no crítico):', seedErr);
        });
      }

      // ══════════════════════════════════════════════════════════════
      // ESTRATEGIA DE FETCH con fallback progresivo (4 niveles):
      //
      // 1) /productos-linea-credito → ruta dedicada (edge v5+)
      //    Ejecuta: WHERE type='ProductoLineaCredito'
      //    ⚠️ DESACTIVADO hasta redespliegue
      //
      // 2) /productos (sin filtro) → fallback principal
      //    Filtra client-side por type='ProductoLineaCredito'
      //    También acepta registros con type='LineaCredito' (legacy)
      //
      // 3) /productos?tipo=ProductoLineaCredito → legacy fallback
      //    Para compatibilidad con query param del servidor
      //
      // 4) Lista vacía — si no hay datos en BD la tabla se muestra vacía
      //    ✅ Mock eliminado
      // ══════════════════════════════════════════════════════════════

      let rows: ProductoLineaCreditoRow[] = [];
      let usedRoute = '';

      // ── Intento 1: Ruta dedicada /productos-linea-credito ──
      // ⚠️ DESACTIVADO TEMPORALMENTE: la edge function v5 con esta ruta
      // NO está desplegada aún. Reactivar después del redespliegue
      // cambiando RUTA_DEDICADA_DISPONIBLE a true.
      const RUTA_DEDICADA_DISPONIBLE = false;
      if (RUTA_DEDICADA_DISPONIBLE) {
        console.log('[useProductosLineaCreditoDB] Intentando ruta /productos-linea-credito...');
        try {
          const res1 = await fetchWithRetry(`${API_BASE}/productos-linea-credito`, { headers }, 1, 500);
          if (res1.ok) {
            const json1 = await res1.json();
            if (json1.success && Array.isArray(json1.data)) {
              rows = json1.data;
              usedRoute = '/productos-linea-credito';
              console.log(`[useProductosLineaCreditoDB] ✅ Ruta /productos-linea-credito — ${rows.length} registros (${json1._version || 'sin version'})`);
            }
          } else {
            console.warn(`[useProductosLineaCreditoDB] Ruta /productos-linea-credito respondió HTTP ${res1.status}, intentando fallback...`);
          }
        } catch (err) {
          if (signal?.aborted) throw err;
          console.warn('[useProductosLineaCreditoDB] Ruta /productos-linea-credito no disponible, intentando fallback...');
        }
      }

      // ── Intento 2: Fallback a /productos (todos) con filtro client-side ──
      if (rows.length === 0 && !usedRoute) {
        console.log('[useProductosLineaCreditoDB] Fallback Nivel 2: consultando /productos (todos) + filtro client-side...');
        try {
          const res2 = await fetchWithRetry(`${API_BASE}/productos`, { headers });
          if (res2.ok) {
            const json2 = await res2.json();
            const allRows: ProductoLineaCreditoRow[] = json2.data || [];
            // Filtro client-side: solo registros con type='ProductoLineaCredito' o 'LineaCredito' (legacy)
            const filtered = allRows.filter(
              (r) => r.type === 'ProductoLineaCredito' || r.type === 'LineaCredito'
            );
            console.log(`[useProductosLineaCreditoDB] Fallback /productos — ${allRows.length} total, ${filtered.length} ProductoLineaCredito`);
            if (filtered.length > 0) {
              rows = filtered;
              usedRoute = '/productos (filtro client-side type=ProductoLineaCredito)';
            }
          }
        } catch (err) {
          if (signal?.aborted) throw err;
          console.warn('[useProductosLineaCreditoDB] Fallback /productos también falló');
        }
      }

      // ── Intento 3: Legacy /productos?tipo=ProductoLineaCredito ──
      if (rows.length === 0 && !usedRoute) {
        console.log('[useProductosLineaCreditoDB] Legacy fallback Nivel 3: /productos?tipo=ProductoLineaCredito...');
        try {
          const res3 = await fetchWithRetry(`${API_BASE}/productos?tipo=ProductoLineaCredito`, { headers });
          if (res3.ok) {
            const json3 = await res3.json();
            rows = json3.data || [];
            if (rows.length > 0) {
              usedRoute = '/productos?tipo=ProductoLineaCredito (legacy)';
              console.log(`[useProductosLineaCreditoDB] Legacy fallback — ${rows.length} registros`);
            }
          }
        } catch (err) {
          if (signal?.aborted) throw err;
          console.warn('[useProductosLineaCreditoDB] Legacy fallback /productos?tipo=ProductoLineaCredito también falló');
        }
      }

      // ── Intento 4: Lista vacía — sin datos en la BD ──
      // Cuando ninguna ruta del servidor devuelve registros con
      // type='ProductoLineaCredito', se muestra la tabla vacía.
      // ✅ Mock eliminado — el listado es 100% BD.
      if (rows.length === 0) {
        console.log('[useProductosLineaCreditoDB] 0 registros ProductoLineaCredito en J_PRODUCTOS. Lista vacía (sin mock).');
        if (!signal?.aborted) {
          setProductos([]);
        }
        return;
      }

      console.log(`[useProductosLineaCreditoDB] Ruta usada: ${usedRoute} — ${rows.length} registros finales`);

      if (!signal?.aborted) {
        const mapped = rows.map(mapRowToProduct);
        setProductos(mapped);
      }
    } catch (err) {
      if (signal?.aborted) return;
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[useProductosLineaCreditoDB] Error:', msg);
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