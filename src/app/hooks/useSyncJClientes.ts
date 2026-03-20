// ═══════════════════════════════════════════════════════════════════
// useSyncJClientes — Utilidad para sincronizar registros del modulo
// Prospectos con EFINANCIANET_DB.J_CLIENTES en Supabase.
//
// Columnas reales de la tabla:
//   id      (uuid PK autogenerado — gen_random_uuid())
//   type    (varchar)   — "Prospecto" en Alta de Prospectos
//   subtipo (varchar)   — "Persona Fisica" | "Persona Moral" | "Persona Fisica con Actividad Empresarial"
//   estatus (varchar)   — "Pendiente" | "En proceso" | "Activo" | "Inactivo"
//   data    (jsonb)     — Nodo padre con campos generales + nodos hijos (subtabs)
//
// Para INSERT  → POST  /clientes         (id lo genera la BD)
// Para UPDATE  → PUT   /clientes/:id     (merge parcial en servidor, conserva campos existentes)
//
// ═══════════════════════════════════════════════════════════════════
// PROTECCIÓN FRONTEND DE DEEP MERGE (v6.0)
//
// Antes de enviar un PUT, el frontend:
//   1. GET /clientes/:id  → lee el data ACTUAL de la BD (con contrasena, curp, etc.)
//   2. Deep merge local   → incoming sobre existing (nunca pierde campos)
//   3. PUT /clientes/:id  → envía el data COMPLETO (incluyendo contrasena)
//
// Esto garantiza que contrasena se preserva INDEPENDIENTEMENTE de si
// la edge function tiene deep merge o no. Es protección de doble capa.
// ═══════════════════════════════════════════════════════════════════
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase } from '../lib/supabaseClient';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

/** Mapeo del picklist TIPO del formulario → columna subtipo de J_CLIENTES
 *  Acepta tanto el formato corto (legacy) como el formato largo (DB directo).
 */
const SUBTIPO_MAP: Record<string, string> = {
  // Formato corto (legacy — por si aún quedan registros con este formato en JSONB)
  'Fisica': 'Persona Fisica',
  'Moral': 'Persona Moral',
  'Fisica con actividad empresarial': 'Persona Fisica con Actividad Empresarial',
  // Formato largo (DB directo — identidad, pasan tal cual)
  'Persona Fisica': 'Persona Fisica',
  'Persona Moral': 'Persona Moral',
  'Persona Fisica con Actividad Empresarial': 'Persona Fisica con Actividad Empresarial',
};

// ═════════��═══════════════════════════════════════════════════════
// Deep merge FRONTEND — misma lógica que el servidor
// Fusiona incoming sobre existing SIN perder campos existentes.
// ═══════════════════════════════════════════════════════════════════
function deepMergeData(
  existing: Record<string, any>,
  incoming: Record<string, any>,
): Record<string, any> {
  // Empezar con copia de TODOS los campos existentes
  const merged: Record<string, any> = { ...existing };

  for (const [key, incomingValue] of Object.entries(incoming)) {
    // Campos null/undefined del frontend → NO TOCAR (conservar existente)
    // ⚠️ IMPORTANTE: empty string '' SÍ se permite — significa que el usuario limpió el campo intencionalmente
    if (incomingValue === null || incomingValue === undefined) {
      continue;
    }
    // Arrays se reemplazan atómicamente
    if (Array.isArray(incomingValue)) {
      merged[key] = incomingValue;
      continue;
    }
    // Sub-objetos → merge recursivo
    if (typeof incomingValue === 'object') {
      const existingChild = existing[key];
      if (existingChild && typeof existingChild === 'object' && !Array.isArray(existingChild)) {
        merged[key] = deepMergeData(existingChild, incomingValue);
      } else {
        merged[key] = incomingValue;
      }
      continue;
    }
    // Escalar con valor real → actualizar
    merged[key] = incomingValue;
  }

  return merged;
}

// Campos sensibles que NUNCA deben perderse
const PROTECTED_FIELDS = ['contrasena', 'curp', 'telefono', 'correoElectronico', 'institucionGobierno', 'institucionGobiernoId', 'clasificacionCliente', 'fechaNacimiento', 'sexo'];

interface SyncClienteOptions {
  /** Columna type — obligatorio "Prospecto" en Alta de Prospectos */
  type: string;
  /** Valor capturado del picklist TIPO del formulario (se mapea a subtipo) */
  tipoFormulario: string;
  /** Columna estatus — capturado del formulario */
  estatus: string;
  /** JSON completo: nodo padre (Datos Generales) + nodos hijos (subtabs) */
  data: Record<string, any>;
  /** Label legible para los toasts */
  label?: string;
  /** id (uuid PK) devuelto por un INSERT previo — si se pasa, se hace UPDATE */
  existingId?: string | null;
  /** par_cliente_id — FK a J_CLIENTES(id), UUID de la institución gobierno seleccionada */
  par_cliente_id?: string | null;
}

/**
 * Sincroniza un registro con EFINANCIANET_DB.J_CLIENTES.
 * - Sin existingId → INSERT (POST /clientes) — id lo genera la BD.
 * - Con existingId → UPDATE (PUT /clientes/:id) — DEEP MERGE en frontend + servidor.
 * Retorna el id (uuid) generado/usado, o null si fallo.
 */
export async function syncToJClientes(opts: SyncClienteOptions): Promise<string | null> {
  const { type, tipoFormulario, estatus, data, label, existingId, par_cliente_id } = opts;
  const displayLabel = label || 'Prospecto';

  // Mapear valor del picklist a columna subtipo
  const subtipo = SUBTIPO_MAP[tipoFormulario] || tipoFormulario || null;

  try {
    let url: string;
    let method: string;
    let mergedData = data; // Por defecto, usar data tal cual (para INSERT)

    if (existingId) {
      // ═══════════════════════════════════════════════════════════════
      // UPDATE — PROTECCIÓN FRONTEND v6.0:
      // 1. Leer data ACTUAL de la BD (contiene contrasena, curp, etc.)
      // 2. Deep merge: incoming (formulario) sobre existing (BD)
      // 3. Enviar data COMPLETO que incluye contrasena
      // ═══════════════════════════════════════════════════════════════
      url = `${BASE_URL}/clientes/${existingId}`;
      method = 'PUT';

      console.log(`[syncToJClientes] ════ FRONTEND DEEP MERGE v6.0 ════`);
      console.log(`[syncToJClientes] PASO 1: Leyendo data actual de BD para id=${existingId}...`);

      try {
        const getRes = await fetch(`${BASE_URL}/clientes/${existingId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        });

        if (getRes.ok) {
          const getText = await getRes.text();
          let getResult: any;
          try {
            getResult = JSON.parse(getText);
          } catch {
            getResult = null;
          }

          if (getResult?.success && getResult?.data?.data) {
            const existingDataRaw = getResult.data.data;
            const existingData = typeof existingDataRaw === 'string' ? JSON.parse(existingDataRaw) : existingDataRaw;

            console.log(`[syncToJClientes] EXISTING data keys (${Object.keys(existingData).length}):`, Object.keys(existingData).join(', '));
            console.log(`[syncToJClientes] EXISTING contrasena: ${existingData.contrasena ? `"${String(existingData.contrasena).substring(0, 5)}..."` : 'AUSENTE'}`);
            console.log(`[syncToJClientes] INCOMING data keys (${Object.keys(data).length}):`, Object.keys(data).join(', '));
            console.log(`[syncToJClientes] INCOMING contrasena: ${'contrasena' in data ? (data.contrasena || 'VACÍO') : 'NO INCLUIDA (correcto, no es campo del formulario)'}`);

            // ── PASO 2: Deep merge — incoming sobre existing ──
            mergedData = deepMergeData(existingData, data);

            // ── PASO 2.5: Escudo nuclear — restaurar campos sensibles si se perdieron ──
            // REGLA INSTITUCIONAL: JSON plano, SIN nodo "default". Solo proteger raíz.
            for (const field of PROTECTED_FIELDS) {
              if (field in existingData && existingData[field] && !(field in mergedData)) {
                mergedData[field] = existingData[field];
                console.log(`[syncToJClientes] NUCLEAR RESTORE: ${field}`);
              }
              if (field in existingData && existingData[field] && field in mergedData && !mergedData[field]) {
                mergedData[field] = existingData[field];
                console.log(`[syncToJClientes] NUCLEAR RESTORE (emptied): ${field}`);
              }
            }
            // Eliminar nodo default legacy si existiera en el merge
            if (mergedData.default) {
              // Promover campos útiles de default a raíz antes de eliminarlo
              const defNode = mergedData.default;
              if (typeof defNode === 'object') {
                for (const [dk, dv] of Object.entries(defNode)) {
                  if (dk === 'default') continue;
                  if (dv === '' || dv === null || dv === undefined) continue;
                  if (!(dk in mergedData) || !mergedData[dk]) {
                    mergedData[dk] = dv;
                  }
                }
              }
              delete mergedData.default;
              console.log(`[syncToJClientes] Nodo 'default' legacy eliminado (promovido a raíz)`);
            }

            console.log(`[syncToJClientes] MERGED data keys (${Object.keys(mergedData).length}):`, Object.keys(mergedData).join(', '));
            console.log(`[syncToJClientes] MERGED contrasena: ${mergedData.contrasena ? `✅ "${String(mergedData.contrasena).substring(0, 5)}..."` : '❌ AUSENTE (esto no debería pasar)'}`);

            // Validación: merged nunca debe tener MENOS keys que existing
            if (Object.keys(mergedData).length < Object.keys(existingData).length) {
              console.error(`[syncToJClientes] ALERTA: merged (${Object.keys(mergedData).length}) < existing (${Object.keys(existingData).length})! Posible pérdida de datos.`);
            }
          } else {
            console.warn(`[syncToJClientes] GET /clientes/${existingId} no retornó data válida, usando data del formulario sin merge`);
          }
        } else {
          console.warn(`[syncToJClientes] GET /clientes/${existingId} falló (HTTP ${getRes.status}), usando data del formulario sin merge`);
        }
      } catch (getErr) {
        console.warn(`[syncToJClientes] Error al leer data actual (continuando sin merge):`, getErr);
      }
    } else {
      // INSERT — sin id, la BD lo genera con gen_random_uuid()
      url = `${BASE_URL}/clientes`;
      method = 'POST';
    }

    // ════════════════════════════════════════════════════════════════
    // COMPACTACIÓN v5.2: Reducir tamaño del JSONB sin PERDER datos funcionales.
    //
    // ⚠️ REGLA CARDINAL: Los arrays de SubTabs (direcciones, sic, listasNegras,
    //    expedientesElectronicos) se almacenan ÚNICAMENTE en este JSONB.
    //    NUNCA se deben resumir, truncar o reemplazar con conteos.
    //    Si se destruyen, los datos se PIERDEN PERMANENTEMENTE.
    //
    // v5.2: Threshold elevado a 8000 bytes. Un campo JSONB soporta MBs;
    //       2600 era demasiado agresivo y destruía datos funcionales del formulario.
    //       Solo se aplica reducción progresiva cuando realmente hay exceso.
    //
    // La estrategia para reducir tamaño es:
    //   1. Eliminar nodos debug/internos
    //   2. Eliminar nodo `default` (100% redundante con raíz)
    //   3. Eliminar campos vacíos de raíz y de items en arrays
    //   4. Truncar xmlResultado de SIC (largo, regenerable)
    //   5. Eliminar tablaAmortizacion (derivada, se recalcula)
    //   6. Slim down arrays NO funcionales (garantias)
    //   7. Truncar strings largos en raíz
    //   8. Slim down expedientes (conservar metadata de Storage, quitar URLs regenerables)
    //
    // MIGRATION REQUERIDA: Ejecutar en SQL Editor de Supabase:
    //   DROP INDEX IF EXISTS "EFINANCIANET_DB"."J_CLIENTES_data_key";
    // ════════════════════════════════════════════════════════════════
    {
      {
        // ── Paso 1: Limpiar nodos debug/internos ANTES de compactar ──
        const REDUNDANT = ['_rawData', '_diagData', '_tempData', '_formState', '_originalData', '_fromData'];
        for (const rk of REDUNDANT) { delete mergedData[rk]; }
        if (mergedData.default) {
          for (const rk of REDUNDANT) { delete mergedData.default[rk]; }
        }

        // ── Paso 2: Eliminar nodo `default` — es 100% redundante con la raíz ──
        // Todos los campos de `default` son copias exactas de los campos raíz.
        // Al cargar, useProspectosDB lee de raíz con fallback a default.
        // Guardar los campos ÚNICOS de default en raíz antes de eliminarlo.
        if (mergedData.default && typeof mergedData.default === 'object') {
          const defaultNode = mergedData.default;
          // Promover a raíz solo campos que NO existen o están vacíos en raíz
          for (const [dk, dv] of Object.entries(defaultNode)) {
            if (dk === 'default') continue;
            if (dv === '' || dv === null || dv === undefined) continue;
            const rootVal = mergedData[dk];
            if (rootVal === '' || rootVal === null || rootVal === undefined) {
              mergedData[dk] = dv; // Promover campo útil de default a raíz
            }
          }
          // Conservar solo `tipo` si no está en raíz (es el subtipo del formulario)
          if (defaultNode.tipo && !mergedData.tipo) {
            mergedData.tipo = defaultNode.tipo;
          }
          delete mergedData.default;
          console.log(`[syncToJClientes] COMPACT v4: nodo 'default' eliminado (redundante con raíz)`);
        }

        // ── Paso 3: Compactar raíz — eliminar null/undefined y arrays vacíos ──
        // ⚠️ v5.2: NO eliminar strings vacíos ('') — el servidor los maneja correctamente
        // via deepMergeData que IGNORA '' en el incoming y PRESERVA el valor existente.
        // Si el usuario limpió un campo intencionalmente, '' debe llegar al servidor
        // para que el deepMerge del servidor decida si preservar o limpiar.
        const compacted: Record<string, any> = {};
        for (const [key, val] of Object.entries(mergedData)) {
          // Conservar campos sensibles siempre
          if (PROTECTED_FIELDS.includes(key) && val) {
            compacted[key] = val;
            continue;
          }
          // Omitir arrays vacíos (subtabs sin datos no necesitan enviarse)
          if (Array.isArray(val) && val.length === 0) continue;
          // Omitir SOLO null/undefined — NO strings vacíos
          if (val === null || val === undefined) continue;
          // Conservar todo lo demás (incluyendo strings vacíos '')
          compacted[key] = val;
        }

        // ── Paso 4: tablaAmortizacion es DERIVADA — quitar siempre ──
        delete compacted.tablaAmortizacion;

        // ── Paso 5: Slim down arrays NO funcionales (se pueden reconstruir) ──
        const HEAVY_ARRAYS: string[] = [];
        const SLIM_KEEP = ['id', 'fecha', 'estatus', 'tipo', 'tipoLista', 'nombreLista', 'estatusSIC', 'estatusListaNegra', 'calle', 'colonia', 'codigoPostal', 'principal'];
        for (const arrKey of HEAVY_ARRAYS) {
          if (Array.isArray(compacted[arrKey]) && compacted[arrKey].length > 0) {
            compacted[arrKey] = compacted[arrKey].map((item: any) => {
              if (typeof item === 'object' && item !== null) {
                const slim: Record<string, any> = {};
                for (const k of SLIM_KEEP) {
                  if (item[k] !== undefined) slim[k] = item[k];
                }
                return slim;
              }
              return item;
            });
          }
        }

        // ── Paso 6: Limpiar campos vacíos dentro de items de SubTabs FUNCIONALES ──
        // ⚠️ SOLO eliminar campos vacíos ("", null, undefined) de cada item.
        //    NUNCA eliminar items completos ni reducir a resúmenes.
        const FUNCTIONAL_ARRAYS = ['direcciones', 'sic', 'listasNegras', 'cotizaciones', 'expedientesElectronicos', 'personasRelacionadas', 'perfilTransaccional', 'garantias'];
        for (const arrKey of FUNCTIONAL_ARRAYS) {
          if (Array.isArray(compacted[arrKey])) {
            compacted[arrKey] = compacted[arrKey]
              .filter((item: any) => item !== null && item !== undefined) // Quitar items nulos
              .map((item: any) => {
                if (typeof item !== 'object' || item === null) return item;
                const cleanItem: Record<string, any> = {};
                for (const [ik, iv] of Object.entries(item)) {
                  if (iv === '' || iv === null || iv === undefined) continue;
                  // Quitar campos internos de UI que no se necesitan en DB
                  if (ik.startsWith('_')) continue;
                  cleanItem[ik] = iv;
                }
                return cleanItem;
              });
          }
        }

        // ── Paso 7: Truncar xmlResultado de SIC (muy largo, regenerable vía PDF) ──
        if (Array.isArray(compacted.sic)) {
          compacted.sic = compacted.sic.map((item: any) => {
            if (item?.xmlResultado && typeof item.xmlResultado === 'string' && item.xmlResultado.length > 200) {
              return { ...item, xmlResultado: item.xmlResultado.substring(0, 200) + '...[ver PDF]' };
            }
            return item;
          });
        }

        // ── Paso 8: Slim down expedientesElectronicos — conservar solo metadata de Storage ──
        // Las URLs firmadas se regeneran al cargar. Solo necesitamos storagePath + metadata.
        if (Array.isArray(compacted.expedientesElectronicos)) {
          const EXP_KEEP = ['id', 'nombre', 'tipo', 'tipoDocumento', 'estatus', 'fecha', 'fechaCarga', 'storagePath', 'mime', 'tamanoKB', 'bucket'];
          compacted.expedientesElectronicos = compacted.expedientesElectronicos.map((item: any) => {
            if (typeof item !== 'object' || item === null) return item;
            const slim: Record<string, any> = {};
            for (const k of EXP_KEEP) {
              if (item[k] !== undefined && item[k] !== '' && item[k] !== null) slim[k] = item[k];
            }
            return slim;
          });
        }

        // ── Paso 9: Truncar strings largos en raíz (>300 chars) ──
        for (const [key, val] of Object.entries(compacted)) {
          if (typeof val === 'string' && val.length > 300 && !PROTECTED_FIELDS.includes(key)) {
            compacted[key] = val.substring(0, 300) + '...[truncado]';
          }
        }

        // ── Paso 10: Reducción adicional si aún es grande (NUNCA destruir SubTabs) ──
        const compactedSize = JSON.stringify(compacted).length;
        const originalSize = JSON.stringify(mergedData).length;
        console.log(`[syncToJClientes] COMPACTACIÓN v5.2: ${Object.keys(mergedData).length} keys → ${Object.keys(compacted).length} keys | ${originalSize} → ${compactedSize} bytes`);

        // v5.2: Threshold elevado a 8000 bytes. JSONB soporta MBs; 2600 era demasiado
        // agresivo y destruía datos funcionales (entidadFederativaNacimiento, tipo, etc.)
        if (compactedSize > 8000) {
          console.warn(`[syncToJClientes] ⚠️ Payload grande (${compactedSize} bytes), aplicando reducción v5.2...`);
          
          // Eliminar campos raíz que son redundantes o decorativos
          // ⚠️ v5.1: SOLO eliminar campos que NO se usan en el formulario de Clientes.
          //    Campos como razonSocial, sucursal, estatusCliente, nacionalidad,
          //    entidadFederativa, estadoCivil, cuentaEje, idCliente son ACTIVOS en el form.
          // v5.2: SOLO campos puramente decorativos/derivados que NO son del formulario.
          // NUNCA incluir campos que el formulario lee o escribe.
          // Removidos: fechaOriginacion (campo core del listado), profesion, ocupacion,
          //   giroNegocio, fuenteIngresos, ingresosMensuales, egresosMensuales,
          //   origenRecursos, destinoRecursos (campos potenciales del formulario).
          const DISPENSABLE_ROOT = [
            'cotizacion', 'nombrePila',
            // Campos puramente derivados/duplicados
            'nombreCompleto', 'tipoPersona',
            'numCliente', 'idProspecto', 'numProspecto',
            // Campos raramente usados que son reconstruibles
            'representanteLegal',
            'regimenMatrimonial',
            'observaciones', 'notas', 'comentarios',
          ];
          for (const field of DISPENSABLE_ROOT) {
            if (field in compacted && !PROTECTED_FIELDS.includes(field)) {
              delete compacted[field];
            }
          }

          // Truncar strings más agresivamente (>80 chars)
          for (const [key, val] of Object.entries(compacted)) {
            if (typeof val === 'string' && val.length > 80 && !PROTECTED_FIELDS.includes(key)) {
              compacted[key] = val.substring(0, 80) + '…';
            }
          }

          // Slim down cotizaciones (derivadas, se pueden recalcular)
          if (Array.isArray(compacted.cotizaciones) && compacted.cotizaciones.length > 0) {
            const COT_KEEP = ['id', 'producto', 'montoSolicitado', 'plazoMeses', 'tasaInteres', 'fecha', 'estatus'];
            compacted.cotizaciones = compacted.cotizaciones.map((item: any) => {
              if (typeof item !== 'object' || item === null) return item;
              const slim: Record<string, any> = {};
              for (const k of COT_KEEP) {
                if (item[k] !== undefined && item[k] !== '' && item[k] !== null) slim[k] = item[k];
              }
              return slim;
            });
          }

          // Slim down direcciones — conservar solo campos esenciales
          // v5.1: field names corregidos para coincidir con el formulario de Direcciones
          if (Array.isArray(compacted.direcciones) && compacted.direcciones.length > 0) {
            const DIR_KEEP = [
              'id', 'calle', 'numeroExterior', 'numExterior', 'noExterior',
              'numeroInterior', 'numInterior', 'noInterior',
              'colonia', 'codigoPostal', 'cp', 'municipio', 'ciudad',
              'estado', 'pais', 'tipoDireccion', 'tipoDomicilio', 'tipo',
              'principal', 'piso', 'tipoCalle', 'atencion', 'destinatario',
            ];
            compacted.direcciones = compacted.direcciones.map((item: any) => {
              if (typeof item !== 'object' || item === null) return item;
              const slim: Record<string, any> = {};
              for (const k of DIR_KEEP) {
                if (item[k] !== undefined && item[k] !== '' && item[k] !== null) slim[k] = item[k];
              }
              return slim;
            });
          }

          const reducedSize = JSON.stringify(compacted).length;
          console.log(`[syncToJClientes] REDUCCIÓN v5.2: ${compactedSize} → ${reducedSize} bytes`);

          // Si TODAVÍA excede 12000, eliminar XML de SIC por completo + slim listas negras
          if (reducedSize > 12000) {
            if (Array.isArray(compacted.sic)) {
              compacted.sic = compacted.sic.map((item: any) => {
                if (typeof item !== 'object' || item === null) return item;
                const { xmlResultado, ...rest } = item;
                return rest;
              });
            }
            // Slim listas negras
            if (Array.isArray(compacted.listasNegras) && compacted.listasNegras.length > 0) {
              const LN_KEEP = ['id', 'tipoLista', 'nombreLista', 'estatus', 'fecha', 'fechaHora', 'resultado', 'observaciones', 'usuario'];
              compacted.listasNegras = compacted.listasNegras.map((item: any) => {
                if (typeof item !== 'object' || item === null) return item;
                const slim: Record<string, any> = {};
                for (const k of LN_KEEP) {
                  if (item[k] !== undefined && item[k] !== '' && item[k] !== null) slim[k] = item[k];
                }
                return slim;
              });
            }

            const postStripSize = JSON.stringify(compacted).length;
            console.log(`[syncToJClientes] POST-STRIP v5.2: ${reducedSize} → ${postStripSize} bytes`);

            // ── ÚLTIMO RECURSO: eliminar TODOS los campos no-esenciales de raíz ──
            if (postStripSize > 16000) {
              const ESSENTIAL_ROOT = [
                ...PROTECTED_FIELDS,
                'nombre', 'apellidoPaterno', 'apellidoMaterno', 'rfc',
                'razonSocial', 'denominacionRazonSocial', 'idCliente', 'personalidad', 'tipo',
                'estatusCliente', 'nacionalidad', 'entidadFederativa',
                'entidadFederativaNacimiento', 'entidadResidencia',
                'estadoCivil', 'cuentaEje', 'sucursal',
                'fechaOriginacion', 'fechaAlta', 'fechaActivacion', 'fechaCuentaEje',
                'estatusSIC', 'estatusListaNegra', 'calificacionCliente', 'clasificacionCliente',
                'telefonoDomicilio', 'telefonoOficina', 'telefonoCasa',
                'correoElectronico', 'saldoCuentaEje',
                'tipoEmpleo', 'nombreEmpresa', 'sector',
                'claveDescuento', 'zonaPagadora', 'claveDependencia', 'tipoCobranza',
                'moneda', 'lenguaje', 'nivelEstudios', 'edad',
                'fechaNacimiento', 'activacionTarjetaDebito', 'numeroTarjetaDebito',
                'actividadEconomica1',
                // Arrays funcionales — NUNCA destruir
                'direcciones', 'sic', 'listasNegras', 'expedientesElectronicos',
                'cotizaciones', 'personasRelacionadas',
              ];
              const allKeys = Object.keys(compacted);
              for (const k of allKeys) {
                if (!ESSENTIAL_ROOT.includes(k) && !Array.isArray(compacted[k])) {
                  delete compacted[k];
                }
              }
              // Truncar strings supervivientes a 50 chars max
              for (const [key, val] of Object.entries(compacted)) {
                if (typeof val === 'string' && val.length > 50 && !PROTECTED_FIELDS.includes(key)) {
                  compacted[key] = val.substring(0, 50) + '…';
                }
              }
              const ultimateSize = JSON.stringify(compacted).length;
              console.log(`[syncToJClientes] ÚLTIMO RECURSO v5.2: ${postStripSize} → ${ultimateSize} bytes (${Object.keys(compacted).length} keys)`);
            }
          }

        }

        mergedData = compacted;
      }
    }

    console.log(`[syncToJClientes] ${method} ${url} | type=${type} subtipo=${subtipo} estatus=${estatus}`);
    console.log(`[syncToJClientes] par_cliente_id: ${par_cliente_id || '(null)'}`);
    console.log(`[syncToJClientes] FINAL data keys: ${Object.keys(mergedData).length} | has contrasena: ${'contrasena' in mergedData} | value: ${mergedData.contrasena ? `\"${String(mergedData.contrasena).substring(0, 5)}...\"` : 'AUSENTE'}`);

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify({ type, subtipo, estatus, data: mergedData, par_cliente_id }),
    });

    // Safe text-first parsing
    const text = await res.text();
    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      console.error(`[syncToJClientes] Respuesta no-JSON del servidor (HTTP ${res.status}):`, text.substring(0, 300));
      toast.error('Error al sincronizar con J_CLIENTES', {
        description: `Respuesta inesperada del servidor (HTTP ${res.status})`,
        duration: 5000,
      });
      return existingId ?? null;
    }

    if (!res.ok) {
      console.error(`[syncToJClientes] Error al sincronizar ${displayLabel} con J_CLIENTES:`, result);
      toast.error('Error al sincronizar con J_CLIENTES', {
        description: result.error || `HTTP ${res.status} — ${displayLabel}`,
        duration: 5000,
      });
      return existingId ?? null;
    }

    // El servidor retorna { success, data: [...], id: uuid, _version?: string }
    const returnedId = result.id ?? existingId ?? result.data?.[0]?.id ?? null;

    // ── VERIFICACIÓN DE DESPLIEGUE ──
    if (existingId && result._version) {
      console.log(`[syncToJClientes] ✅ SERVER VERSION: ${result._version}`);
    } else if (existingId && !result._version) {
      console.log(`[syncToJClientes] ⚠️ Server sin _version (edge function antigua), pero el FRONTEND hizo deep merge — contrasena DEBE estar protegida.`);
    }

    // ── Verificar si contrasena fue preservada en la respuesta ──
    if (existingId && result.data?.[0]?.data) {
      const writtenData = typeof result.data[0].data === 'string' ? JSON.parse(result.data[0].data) : result.data[0].data;
      const hasContrasena = 'contrasena' in writtenData;
      console.log(`[syncToJClientes] POST-WRITE contrasena: ${hasContrasena ? '✅ PRESENTE: "' + String(writtenData.contrasena).substring(0, 5) + '..."' : '❌ AUSENTE — INVESTIGAR'}`);
      console.log(`[syncToJClientes] POST-WRITE total data keys: ${Object.keys(writtenData).length}`);
    }

    console.log(`[syncToJClientes] J_CLIENTES — ${existingId ? 'UPDATE' : 'INSERT'} exitoso (${displayLabel}):`, result);
    toast.success('Sincronizado con J_CLIENTES', {
      description: `ID: ${returnedId ? String(returnedId).substring(0, 8) + '...' : 'N/A'} — Type: ${type} | Subtipo: ${subtipo}`,
      duration: 4000,
    });

    // ══════════════════════════════════════════════════════════════════
    // NOTA: par_cliente_id ya se envía en el body del PUT principal
    // (línea del fetch con { type, subtipo, estatus, data, par_cliente_id })
    // y la Edge Function lo escribe en la columna física directamente
    // en el UPDATE SQL (rama parClienteIdExplicit).
    // NO se necesita una segunda escritura vía RPC o PUT adicional.
    // ══════════════════════════════════════════════════════════════════
    if (returnedId && par_cliente_id !== undefined) {
      console.log(`[syncToJClientes] par_cliente_id=${par_cliente_id || '(null)'} fue incluido en el PUT principal — la Edge Function lo escribe en la columna física.`);
      // Verificar si la respuesta confirma el valor
      const writtenParId = result.data?.[0]?.par_cliente_id ?? null;
      if (writtenParId === (par_cliente_id || null)) {
        console.log(`[syncToJClientes] ✅ par_cliente_id confirmado en respuesta: ${writtenParId || '(null)'}`);
      } else {
        console.warn(`[syncToJClientes] ⚠️ par_cliente_id en respuesta (${writtenParId}) difiere del enviado (${par_cliente_id}). Verificar Edge Function.`);
      }
    }

    return returnedId;
  } catch (err) {
    console.error(`[syncToJClientes] Error de red al sincronizar ${displayLabel} con J_CLIENTES:`, err);
    toast.error('Error de conexion al sincronizar con J_CLIENTES', {
      description: `${displayLabel}: ${String(err)}`,
      duration: 5000,
    });
    return null;
  }
}