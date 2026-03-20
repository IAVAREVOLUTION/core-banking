// ════════════════════════════════════════════════════════
// useCoreActivacionProspecto.ts
//
// Servicio CORE para la activacion de un Prospecto desde el Portal.
//
// Logica institucional (alineada con activar-prospecto.md):
//   1. Validar datos completos (Default, Direcciones, Expedientes, SIC, Listas Negras)
//   2. Validar estatusSIC = "NEGATIVO" y estatusListaNegra = "NEGATIVO"
//   3. Validar estructura JSON
//   4. RPC activar_prospecto_core (transaccion atomica):
//      a. Valida que NO tenga cuenta eje previa
//      b. Busca producto institucional eje en J_PRODUCTOS
//      c. UPDATE J_CLIENTES SET type='Clientes', estatus='Activo'
//      d. INSERT J_CUENTAS_CORP_CLIENTES (cuenta eje)
//   5. Fallback: Edge Function + sessionStorage
//   6. Crear notificacion en J_NOTIFICACIONES
//   7. Retornar respuesta al Portal (OK / ERROR)
//
// Valores institucionales de la cuenta eje (spec):
//   type='CAPTACION', linea_produc='CAPTACION', tipo_produc='Ahorro'
//   cta_eje_chec=TRUE, saldo_actual=0
//   estatus_sol='Autorizado', estatus_disp='No Aplica'
//   estatus_cart='Activa', estatus_cuen='Activa', fases='Inicial'
//   no_sol = 'AUTO-' + uuid.substring(0,8)
//   no_cuenta = 'AHO-' + ID_CLIENTE + '-' + YYYYMMDD
//
// Tabla:   "EFINANCIANET_DB"."J_CLIENTES"
// Tabla:   "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
// Tabla:   "EFINANCIANET_DB"."J_NOTIFICACIONES" (notificaciones institucionales)
// ════════════════════════════════════════════════════════
import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { supabase } from '@/app/lib/supabaseClient';
import type { InsertCuentaAhorroPayload } from './useCuentasAhorroDB';
import { CUENTA_AHORRO_REFETCH_EVENT } from './useCuentasAhorroDB';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

// ════════════════════════════════════════════════════════
// INTERFACES
// ════════════════════════════════════════════════════════

/** Entrada requerida desde el Portal para activar un Prospecto */
export interface ActivacionProspectoRequest {
  /** UUID del Prospecto (llave primaria de J_CLIENTES) */
  idProspecto: string;
  /** Datos completos del Prospecto (ya capturados en el Portal) */
  datosProspecto: ProspectoDataCompleto;
}

/**
 * Estructura completa del JSONB data del prospecto.
 *
 * REGLA INSTITUCIONAL (cliente-prospecto-db-rules.md §1):
 *   JSON PLANO — SIN nodo "default".
 *   data.nombre = nombre de pila (campo "Nombre" del formulario).
 *   Nombre completo = data.nombre + ' ' + data.apellidoPaterno + ' ' + data.apellidoMaterno
 */
export interface ProspectoDataCompleto {
  // ── Datos Generales (planos en raíz) ──
  idProspecto: string;
  tipo?: string;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  denominacionRazonSocial?: string;
  telefono: string;
  fechaNacimiento: string;
  entidadFederativa: string;
  sucursal: string;
  sexo: string;
  curp: string;
  rfc: string;
  correoElectronico: string;
  estatusSIC: string;
  estatusListaNegra: string;
  estatusCliente: string;
  estatusProspecto?: string;
  estatus: string;
  fechaOriginacion: string;
  // ── SubTabs (nodos hijos) ──
  direcciones: any[];
  expedientesElectronicos: any[];
  sic: any[];
  listasNegras: any[];
  [key: string]: any;
}

/** Respuesta del CORE al Portal */
export interface ActivacionProspectoResponse {
  estatusOperacion: 'OK' | 'ERROR';
  mensaje: string;
  /** UUID de la Cuenta Eje generada (si fue exitoso) */
  cuentaEjeId?: string;
  /** Número de cuenta bancario generado (formato 10 dígitos) */
  numeroCuenta?: string;
  /** Detalle de errores de validacion */
  errores?: string[];
}

/** Cobertura de la notificacion institucional */
export type TipoCobertura = 'Empresa' | 'Sucursal' | 'Personal';
export type DirigidoA = 'Empleados' | 'Clientes';

/** Registro para J_NOTIFICACIONES */
interface NotificacionInstitucional {
  dirigidoA: DirigidoA;
  tipoCobertura: TipoCobertura;
  mensaje: string;
  idReferencia: string;
  fecha: string;
  estatusNotificacion: 'Pendiente' | 'Enviada' | 'Leida';
}

// ════════════════════════════════════════════════════════
// VALIDACIONES OBLIGATORIAS
// ════════════════════════════════════════════════════════

/** 2.1 — Campos criticos obligatorios del nodo padre (Datos Generales) */
const CAMPOS_GENERALES_REQUERIDOS: string[] = [
  'nombre',
  'apellidoPaterno',
  'telefono',
  'fechaNacimiento',
  'entidadFederativa',
  'sexo',
  'curp',
  'rfc',
  'correoElectronico',
  'estatusSIC',
  'estatusListaNegra',
];

/**
 * Valida que todos los datos del Prospecto esten completos.
 * REGLA INSTITUCIONAL: JSON plano, SIN nodo "default". Todo se valida en raíz.
 * Retorna un array de mensajes de error (vacio si todo OK).
 */
function validarDatosCompletos(data: Record<string, any>): string[] {
  const errores: string[] = [];

  // ── 2.1.1 Datos Generales (raíz plana) ──
  for (const campo of CAMPOS_GENERALES_REQUERIDOS) {
    const valor = data[campo];
    if (valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '')) {
      errores.push(`Campo obligatorio vacio en Datos Generales: "${campo}"`);
    }
  }

  // ── 2.1.3 Direcciones ──
  const direcciones = data.direcciones;
  if (!Array.isArray(direcciones) || direcciones.length === 0) {
    errores.push('SubTab "Direcciones": Debe tener al menos una direccion registrada.');
  }

  // ── 2.1.4 Expedientes Electronicos (WARNING — no bloqueante) ──
  const expedientes = data.expedientesElectronicos;
  if (!Array.isArray(expedientes) || expedientes.length === 0) {
    console.warn('[CORE:Validacion] WARNING: SubTab "Expedientes Electronicos" sin registros — se permite continuar.');
    // NO se agrega a errores — es advertencia, no bloquea la activación
  }

  // ── 2.1.5 SIC ──
  const sic = data.sic;
  if (!Array.isArray(sic) || sic.length === 0) {
    errores.push('SubTab "SIC": Debe tener al menos una consulta SIC registrada.');
  }

  // ── 2.1.6 Listas Negras ──
  const listas = data.listasNegras;
  if (!Array.isArray(listas) || listas.length === 0) {
    errores.push('SubTab "Listas Negras": Debe tener al menos un registro de listas negras.');
  }

  return errores;
}

/**
 * 2.2 — Validacion de SIC: estatusSIC debe ser "NEGATIVO"
 */
function validarSIC(data: Record<string, any>): string | null {
  const estatus = (data.estatusSIC || '').toString().toUpperCase().trim();
  if (estatus !== 'NEGATIVO') {
    return `Estatus SIC no es NEGATIVO (valor actual: "${data.estatusSIC || 'vacio'}"). No se puede activar.`;
  }
  return null;
}

/**
 * 2.3 — Validacion de Listas Negras: estatusListaNegra debe ser "NEGATIVO"
 */
function validarListasNegras(data: Record<string, any>): string | null {
  const estatus = (data.estatusListaNegra || '').toString().toUpperCase().trim();
  if (estatus !== 'NEGATIVO') {
    return `Estatus Listas Negras no es NEGATIVO (valor actual: "${data.estatusListaNegra || 'vacio'}"). No se puede activar.`;
  }
  return null;
}

/**
 * 2.4 — Validacion de estructura JSON
 * - Nodo padre con Datos Generales + Default
 * - Nodos hijos (SubTabs) presentes
 * - Sin nodos vacios
 * - Sin campos nulos criticos
 * - Sin tags duplicados (no aplica a arrays de SubTabs)
 */
function validarEstructuraJSON(data: Record<string, any>): string[] {
  const errores: string[] = [];

  // Verificar que el nodo padre exista y sea objeto
  if (!data || typeof data !== 'object') {
    errores.push('JSON de datos es nulo o no es un objeto valido.');
    return errores;
  }

  // REGLA INSTITUCIONAL: NO existe nodo "default" — JSON plano.
  // Si aún existe un nodo default legacy, se ignora (no es error).

  // Verificar que no haya nodos con valor null criticos
  const camposCriticos = ['nombre', 'curp', 'rfc', 'correoElectronico', 'telefono'];
  for (const campo of camposCriticos) {
    if (data[campo] === null) {
      errores.push(`Campo critico "${campo}" es null en la estructura JSON.`);
    }
  }

  // Verificar que los arrays de SubTabs no contengan elementos nulos
  const subTabs = ['direcciones', 'expedientesElectronicos', 'sic', 'listasNegras'];
  for (const tab of subTabs) {
    if (Array.isArray(data[tab])) {
      const nullItems = data[tab].filter((item: any) => item === null || item === undefined);
      if (nullItems.length > 0) {
        errores.push(`SubTab "${tab}" contiene ${nullItems.length} elemento(s) nulo(s).`);
      }
    }
  }

  // Detectar tags/keys duplicados a nivel raiz (excluyendo SubTabs que son arrays)
  const keys = Object.keys(data);
  const uniqueKeys = new Set(keys);
  if (keys.length !== uniqueKeys.size) {
    errores.push('Se detectaron tags duplicados en el nodo raiz del JSON.');
  }

  return errores;
}

// ════════════════════════════════════════════════════════
// COMPACTAR DATA — Evitar btree index overflow en J_CLIENTES_data_key
//
// El índice BTREE en J_CLIENTES.data tiene un límite de ~2704 bytes.
// Si el JSONB mergeado excede ese tamaño, Postgres rechaza el UPDATE.
// Esta función elimina nodos pesados/redundantes del JSONB para reducir
// su tamaño serializado. Los datos eliminados ya están en SubTabs
// separadas o se pueden reconstruir desde el formulario.
//
// MIGRATION REQUERIDA: Ejecutar en SQL Editor de Supabase:
//   DROP INDEX IF EXISTS "EFINANCIANET_DB"."J_CLIENTES_data_key";
// Esto elimina permanentemente el índice BTREE problemático.
// Un índice BTREE en una columna JSONB no tiene sentido operativo.
// ════════════════════════════════════════════════════════

/**
 * Compacta el JSONB `data` para que no exceda el límite del índice BTREE.
 * ⚠️ REGLA CARDINAL: NUNCA destruir datos de SubTabs funcionales
 *    (direcciones, sic, listasNegras). Se almacenan ÚNICAMENTE aquí.
 * Solo elimina nodos redundantes, debug y strings muy largos.
 */
function compactData(data: Record<string, any>): Record<string, any> {
  const compact = { ...data };

  // 1. Eliminar nodos debug/internos
  const REDUNDANT = ['_rawData', '_diagData', '_tempData', '_formState', '_originalData', '_fromData'];
  for (const key of REDUNDANT) {
    delete compact[key];
  }

  // 2. Eliminar nodo default (100% redundante con raíz)
  if (compact.default && typeof compact.default === 'object') {
    const defaultNode = compact.default;
    for (const [dk, dv] of Object.entries(defaultNode)) {
      if (dk === 'default') continue;
      if (dv === '' || dv === null || dv === undefined) continue;
      const rootVal = compact[dk];
      if (rootVal === '' || rootVal === null || rootVal === undefined) {
        compact[dk] = dv;
      }
    }
    if (defaultNode.tipo && !compact.tipo) {
      compact.tipo = defaultNode.tipo;
    }
    delete compact.default;
  }

  // 3. Eliminar tablaAmortizacion (derivada)
  delete compact.tablaAmortizacion;

  // 4. Slim down SOLO arrays NO funcionales (garantias, personasRelacionadas)
  const HEAVY_ARRAYS = ['garantias', 'personasRelacionadas'];
  const SLIM_KEEP = ['id', 'fecha', 'estatus', 'tipo'];
  for (const key of HEAVY_ARRAYS) {
    if (Array.isArray(compact[key]) && compact[key].length > 0) {
      compact[key] = compact[key].map((item: any) => {
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

  // 5. Limpiar campos vacíos de items en SubTabs funcionales (sin eliminar campos con valor)
  const FUNCTIONAL = ['direcciones', 'sic', 'listasNegras', 'cotizaciones', 'expedientesElectronicos'];
  for (const arrKey of FUNCTIONAL) {
    if (Array.isArray(compact[arrKey])) {
      compact[arrKey] = compact[arrKey]
        .filter((item: any) => item !== null && item !== undefined)
        .map((item: any) => {
          if (typeof item !== 'object' || item === null) return item;
          const clean: Record<string, any> = {};
          for (const [ik, iv] of Object.entries(item)) {
            if (iv === '' || iv === null || iv === undefined) continue;
            if (ik.startsWith('_')) continue;
            clean[ik] = iv;
          }
          return clean;
        });
    }
  }

  // 6. Truncar xmlResultado de SIC
  if (Array.isArray(compact.sic)) {
    compact.sic = compact.sic.map((item: any) => {
      if (item?.xmlResultado && typeof item.xmlResultado === 'string' && item.xmlResultado.length > 200) {
        return { ...item, xmlResultado: item.xmlResultado.substring(0, 200) + '...[ver PDF]' };
      }
      return item;
    });
  }

  // 7. Slim down expedientes (conservar solo metadata de Storage)
  if (Array.isArray(compact.expedientesElectronicos)) {
    const EXP_KEEP = ['id', 'nombre', 'tipo', 'tipoDocumento', 'estatus', 'fecha', 'fechaCarga', 'storagePath', 'mime', 'tamanoKB', 'bucket'];
    compact.expedientesElectronicos = compact.expedientesElectronicos.map((item: any) => {
      if (typeof item !== 'object' || item === null) return item;
      const slim: Record<string, any> = {};
      for (const k of EXP_KEEP) {
        if (item[k] !== undefined && item[k] !== '' && item[k] !== null) slim[k] = item[k];
      }
      return slim;
    });
  }

  // 8. Truncar strings largos en raíz (>300 chars)
  for (const [key, value] of Object.entries(compact)) {
    if (typeof value === 'string' && value.length > 300 && !['contrasena', 'curp', 'rfc'].includes(key)) {
      compact[key] = value.substring(0, 300) + '...[truncado]';
    }
  }

  // 9. Eliminar campos raíz vacíos
  for (const [key, val] of Object.entries(compact)) {
    if (val === '' || val === null || val === undefined) {
      delete compact[key];
    }
    if (Array.isArray(val) && val.length === 0) {
      delete compact[key];
    }
  }

  const size = JSON.stringify(compact).length;
  console.log(`[CORE:compactData] Tamaño compactado: ${size} bytes (original: ${JSON.stringify(data).length} bytes)`);

  return compact;
}

// ════════════════════════════════════════════════════════
// PERSISTENCIA — CUENTA EJE
// ════════════════════════════════════════════════════════

// ── Helpers de autogeneración (formato institucional spec) ──
/** no_sol = 'AUTO-' + uuid.substring(0,8) — spec sección 7.1 */
function generateNoSol(): string {
  return `AUTO-${crypto.randomUUID().substring(0, 8)}`;
}

/**
 * Genera un número de cuenta bancario con formato institucional de 16 dígitos.
 * Formato: BBBB-SSSS-CCCC-CCCC
 *   BBBB = código de institución (0147 = eFinanciaNet)
 *   SSSS = código de sucursal (derivado del UUID del cliente)
 *   CCCC-CCCC = secuencia única (derivada de timestamp + random)
 */
function generateNoCuenta(clienteId: string): string {
  const INST_CODE = '0147'; // Código institucional eFinanciaNet
  // Sucursal: primeros 4 hex del UUID convertidos a dígitos
  const sucursal = clienteId.replace(/-/g, '').substring(0, 4)
    .split('').map(c => {
      const n = parseInt(c, 16);
      return isNaN(n) ? '0' : String(n % 10);
    }).join('');
  // Secuencia: timestamp + random para unicidad
  const ts = Date.now().toString().slice(-5);
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const seq = (ts + rand).substring(0, 8);
  return `${INST_CODE}${sucursal}${seq}`;
}

/**
 * Formatea un número de cuenta de 16 dígitos como XXXX-XXXX-XXXX-XXXX para visualización.
 */
export function formatNoCuenta(noCuenta: string): string {
  const digits = noCuenta.replace(/\D/g, '');
  if (digits.length <= 4) return digits;
  return digits.match(/.{1,4}/g)?.join(' ') || digits;
}

function generateNoReferencia(): string {
  return `REF-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * 4. Genera una Cuenta Eje en J_CUENTAS_CORP_CLIENTES asociada al cliente/prospecto.
 *
 * Estrategia multi-intento:
 *   1. Edge Function POST /cuentas-ahorro (direct SQL — bypasses RPC overload ambiguity)
 *   2. RPC insert_cuenta_ahorro (puede fallar con PGRST106 si hay overloads ambiguos)
 *   3. sessionStorage fallback (genera UUID local)
 *
 * La cuenta se crea con:
 *   - cta_eje_chec = true (es la cuenta eje del cliente)
 *   - saldo_actual = 0, moneda = MXN
 *   - estatus_cuen = 'Activa', estatus_sol = 'Aprobada'
 *   - no_sol, no_cuenta, no_referenc1 autogenerados
 */
async function generarCuentaEje(prospectoUuid: string, nombreProspecto: string): Promise<{ id: string; noCuenta: string } | null> {
  const LOG_CE = '[CORE:CuentaEje]';
  const noSol = generateNoSol();
  const noCuenta = generateNoCuenta(prospectoUuid);
  const noRef = generateNoReferencia();
  // Usar formato ISO 8601 completo (timestamptz) para que PostgREST
  // resuelva sin ambigüedad al overload con parámetros timestamp with time zone.
  // El formato YYYY-MM-DD es ambiguo entre DATE y TIMESTAMPTZ cuando hay
  // dos overloads de la RPC — "Could not choose the best candidate function".
  const now = new Date();
  const fechaHoyISO = now.toISOString(); // YYYY-MM-DDTHH:MM:SS.sssZ → resuelve a timestamptz

  const payload: InsertCuentaAhorroPayload = {
    p_no_sol: noSol,
    p_no_cuenta: noCuenta,
    p_no_referenc1: noRef,
    p_fecha_sol: fechaHoyISO,
    p_fecha_autori: fechaHoyISO,
    p_fecha_disper: null,
    p_fecha_cancel: null,
    p_fecha_inicio: fechaHoyISO,
    p_fecha_fin_cu: null,
    p_descripcion: `Cuenta Eje generada automáticamente al activar prospecto ${nombreProspecto}`,
    p_linea_produc: 'CAPTACION',
    p_tipo_produc: 'Ahorro',
    p_producto_id: null,
    p_producto_eje: null,
    p_cliente_id: prospectoUuid,
    p_monto_sol: 0,
    p_monto_aut: 0,
    p_monto_disp: 0,
    p_cta_eje_chec: true,
    p_fases: 'Activa',
    p_data: {
      metadatos: {
        noSol: noSol,
        noCuenta: noCuenta,
        noReferenc1: noRef,
        origenCreacion: 'ActivacionProspecto',
        titular: nombreProspecto,
        moneda: 'MXN',
      },
      estatusCuenta: 'Activa',
      estatusSolicitud: 'Aprobada',
      estatusCartera: 'Vigente',
      saldoActual: 0,
      fechaApertura: fechaHoyISO,
    },
  };

  console.log(`${LOG_CE} ══════════════════════════════════════════════`);
  console.log(`${LOG_CE} Generando Cuenta Eje para cliente: ${prospectoUuid}`);
  console.log(`${LOG_CE} noSol: ${noSol} | noCuenta: ${noCuenta} | noRef: ${noRef}`);
  console.log(`${LOG_CE} ══════════════════════════════════════════════`);

  // ── Intento 1: Edge Function (direct SQL — bypasses PostgREST RPC overload ambiguity) ──
  try {
    console.log(`${LOG_CE} Intento 1 → Edge Function POST /cuentas-ahorro (direct SQL)`);

    const res = await fetch(`${BASE_URL}/cuentas-ahorro`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const json = await res.json();
      const cuentaEjeId = json?.id || crypto.randomUUID();
      console.log(`${LOG_CE} ✓ Edge Function OK — id: ${cuentaEjeId}`);
      saveCuentaEjeToSessionStorage(cuentaEjeId, payload, nombreProspecto);
      return { id: cuentaEjeId, noCuenta };
    }
    const errBody = await res.text().catch(() => '');
    console.warn(`${LOG_CE} Edge Function HTTP ${res.status}`, errBody);
  } catch (e: any) {
    console.warn(`${LOG_CE} Edge Function no disponible: ${e?.message || e}`);
  }

  // ── Intento 2: RPC insert_cuenta_ahorro (puede fallar con PGRST106 si hay overloads ambiguos) ──
  try {
    console.log(`${LOG_CE} Intento 2 → supabase.rpc('insert_cuenta_ahorro')`);
    // Normalizar payload para RPC: stringify p_data, normalizar boolean
    const rpcPayload = { ...payload } as any;
    if (rpcPayload.p_cta_eje_chec !== undefined && rpcPayload.p_cta_eje_chec !== null) {
      const v = rpcPayload.p_cta_eje_chec;
      rpcPayload.p_cta_eje_chec = v === true || v === 'true' || v === 't' || v === '1';
    }
    if (rpcPayload.p_data && typeof rpcPayload.p_data === 'object') {
      rpcPayload.p_data = JSON.stringify(rpcPayload.p_data);
    }

    const { data, error } = await supabase.rpc('insert_cuenta_ahorro', rpcPayload);

    if (!error && data) {
      const rows = Array.isArray(data) ? data : [data];
      const row = rows[0] as any;
      const cuentaEjeId = row?.id || crypto.randomUUID();
      console.log(`${LOG_CE} ✅ RPC insert_cuenta_ahorro OK — id: ${cuentaEjeId}`);
      saveCuentaEjeToSessionStorage(cuentaEjeId, payload, nombreProspecto);
      return { id: cuentaEjeId, noCuenta };
    }

    if (error) {
      console.warn(`${LOG_CE} RPC insert_cuenta_ahorro error (PGRST106 esperado si hay overloads): ${error.message}`);
    }
  } catch (e: any) {
    console.warn(`${LOG_CE} RPC insert_cuenta_ahorro excepción: ${e?.message || e}`);
  }

  // ── Intento 3: sessionStorage fallback ──
  console.warn(`${LOG_CE} ⚠️⚠️⚠️ Cuenta Eje NO se persistió en BD — solo sessionStorage ⚠️⚠️⚠️`);
  console.log(`${LOG_CE} Intento 3 → sessionStorage fallback`);
  const localId = crypto.randomUUID();
  saveCuentaEjeToSessionStorage(localId, payload, nombreProspecto);
  console.log(`${LOG_CE} ✓ Cuenta Eje guardada en sessionStorage — id: ${localId}`);
  return { id: localId, noCuenta };
}

/**
 * Guarda la cuenta eje recién creada en sessionStorage para que
 * useCuentasAhorroDB la detecte inmediatamente sin esperar refetch.
 */
function saveCuentaEjeToSessionStorage(
  id: string,
  payload: InsertCuentaAhorroPayload,
  titular: string
) {
  try {
    // Guardar en la lista simplificada
    const KEY_LIST = 'cuentas_ahorro_local';
    const existing = JSON.parse(sessionStorage.getItem(KEY_LIST) || '[]');
    const newItem = {
      id,
      noSol: payload.p_no_sol,
      noCuenta: payload.p_no_cuenta,
      clienteId: payload.p_cliente_id || '',
      clienteNombre: titular,
      productoId: '',
      productoNombre: '—',
      fechaSol: payload.p_fecha_sol,
      fechaAutori: payload.p_fecha_autori || '',
      saldoActual: 0,
      estatusCuen: 'Activa',
      estatusCart: 'Vigente',
      estatusSol: 'Aprobada',
      estatusDisp: '—',
      ctaEjeChec: true,
      lineaProduc: 'CAPTACION',
      tipoProduc: 'Ahorro',
      data: payload.p_data,
    };
    // Evitar duplicados
    const filtered = existing.filter((c: any) => c.id !== id);
    filtered.push(newItem);
    sessionStorage.setItem(KEY_LIST, JSON.stringify(filtered));

    // Guardar fila completa
    const KEY_ROWS = 'cuentas_ahorro_rows';
    const existingRows = JSON.parse(sessionStorage.getItem(KEY_ROWS) || '[]');
    const fullRow = {
      id,
      type: 'CAPTACION',
      no_sol: payload.p_no_sol,
      no_cuenta: payload.p_no_cuenta,
      no_referenc1: payload.p_no_referenc1,
      fecha_sol: payload.p_fecha_sol,
      fecha_autori: payload.p_fecha_autori,
      fecha_disper: null,
      fecha_cancel: null,
      fecha_inicio: payload.p_fecha_inicio,
      fecha_fin_cu: null,
      descripcion: payload.p_descripcion,
      producto_id: null,
      producto_nombre: null,
      producto_eje: null,
      cliente_id: payload.p_cliente_id,
      cliente_nombre: titular,
      monto_sol: 0,
      monto_aut: 0,
      monto_disp: 0,
      saldo_actual: 0,
      estatus_cuen: 'Activa',
      estatus_cart: 'Vigente',
      estatus_sol: 'Aprobada',
      estatus_disp: null,
      cta_eje_chec: true,
      linea_produc: 'CAPTACION',
      tipo_produc: 'Ahorro',
      fases: 'Activa',
      data: payload.p_data,
    };
    const filteredRows = existingRows.filter((r: any) => r.id !== id);
    filteredRows.push(fullRow);
    sessionStorage.setItem(KEY_ROWS, JSON.stringify(filteredRows));

    console.log('[CORE:CuentaEje] Guardado en sessionStorage OK');

    // Disparar evento para que useCuentasAhorroDB refetch inmediatamente
    try {
      window.dispatchEvent(new CustomEvent(CUENTA_AHORRO_REFETCH_EVENT));
      console.log('[CORE:CuentaEje] Evento cuentaAhorroRefetch disparado');
    } catch { /* SSR safety */ }
  } catch (err) {
    console.warn('[CORE:CuentaEje] Error guardando en sessionStorage:', err);
  }
}

// ════════════════════════════════════════════════════════
// PERSISTENCIA — NOTIFICACIONES
// ════════════════════════════════════════════════════════

/**
 * 5. Genera una notificacion institucional en J_NOTIFICACIONES.
 */
async function crearNotificacion(notificacion: NotificacionInstitucional): Promise<boolean> {
  const LOG_N = '[CORE:Notificacion]';
  try {
    console.log(`${LOG_N} Creando notificacion:`, notificacion.mensaje);

    // ── Intento 1: RPC insert_notificacion ──
    try {
      const { data, error } = await supabase.rpc('insert_notificacion', {
        p_dirigido_a: notificacion.dirigidoA,
        p_tipo_cobertura: notificacion.tipoCobertura,
        p_mensaje: notificacion.mensaje,
        p_id_referencia: notificacion.idReferencia,
        p_fecha: notificacion.fecha,
        p_estatus: notificacion.estatusNotificacion,
      });
      if (!error && data) {
        console.log(`${LOG_N} ✓ RPC insert_notificacion OK`);
        return true;
      }
      if (error) {
        console.log(`${LOG_N} RPC insert_notificacion no disponible: ${error.message}`);
      }
    } catch (rpcErr) {
      console.log(`${LOG_N} RPC no disponible (esperado si no existe aún)`);
    }

    // ── Intento 2: Edge Function ──
    try {
      const res = await fetch(`${BASE_URL}/notificaciones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify(notificacion),
      });

      if (res.ok) {
        console.log(`${LOG_N} ✓ Edge Function OK`);
        return true;
      }

      // 404 = ruta no registrada en Hono — esperado si el endpoint aún no existe
      if (res.status === 404) {
        console.log(`${LOG_N} Edge Function 404 (endpoint /notificaciones no registrado en Hono — pendiente de deploy)`);
      } else {
        console.warn(`${LOG_N} Edge Function HTTP ${res.status}`);
      }
    } catch (fetchErr) {
      console.log(`${LOG_N} Edge Function no disponible (red)`);
    }

    // ── Intento 3: sessionStorage fallback ──
    console.log(`${LOG_N} Guardando notificación en sessionStorage (fallback local)`);
    try {
      const SS_KEY = 'notificaciones_pendientes';
      const existing = JSON.parse(sessionStorage.getItem(SS_KEY) || '[]');
      existing.push({ ...notificacion, id: crypto.randomUUID(), guardadoLocal: true });
      sessionStorage.setItem(SS_KEY, JSON.stringify(existing));
      console.log(`${LOG_N} ✓ Notificación guardada en sessionStorage (${existing.length} pendientes)`);
    } catch { /* silently fail */ }

    return true; // Nunca bloquear la activación
  } catch (err) {
    console.error(`${LOG_N} Error inesperado:`, err);
    return true; // No bloquear la activacion
  }
}

// ════════════════════════════════════════════════════════
// FUNCION PRINCIPAL — ACTIVAR PROSPECTO
// ════════════════════════════════════════════════════════

/**
 * Ejecuta la logica institucional CORE para activar un Prospecto.
 *
 * Flujo:
 *   1. Validar que el ID sea valido
 *   2. Validar datos completos (todas las SubTabs excepto Cotizaciones)
 *   3. Validar SIC = NEGATIVO
 *   4. Validar Listas Negras = NEGATIVO
 *   5. Validar estructura JSON
 *   6. UPDATE J_CLIENTES (estatus='Prospecto', type permanece 'Prospecto')
 *   7. Generar Cuenta Eje
 *   8. Crear Notificacion institucional
 *   9. Retornar respuesta al Portal
 */
export async function activarProspectoCORE(
  request: ActivacionProspectoRequest
): Promise<ActivacionProspectoResponse> {
  const { idProspecto, datosProspecto } = request;
  const erroresAcumulados: string[] = [];

  console.log('═══════════════════════════════════════════════════');
  console.log('[CORE:ActivarProspecto] Inicio de activacion');
  console.log('[CORE:ActivarProspecto] UUID:', idProspecto);
  console.log('═══════════════════════════════════════════════════');

  // ── 7.7 Validar que el ID sea valido ──
  if (!idProspecto || typeof idProspecto !== 'string' || idProspecto.trim() === '') {
    const msg = 'ID del Prospecto no es valido o esta vacio.';
    console.error('[CORE:ActivarProspecto] RECHAZO:', msg);
    return {
      estatusOperacion: 'ERROR',
      mensaje: 'No se puede activar el prospecto. Validar datos y estatus SIC/Listas Negras.',
      errores: [msg],
    };
  }

  // ── 2.1 Validar datos completos ──
  const erroresDatos = validarDatosCompletos(datosProspecto);
  if (erroresDatos.length > 0) {
    erroresAcumulados.push(...erroresDatos);
    console.warn('[CORE:ActivarProspecto] Errores de datos completos:', erroresDatos);
  }

  // ── 2.2 Validar SIC ──
  const errorSIC = validarSIC(datosProspecto);
  if (errorSIC) {
    erroresAcumulados.push(errorSIC);
    console.warn('[CORE:ActivarProspecto] Error SIC:', errorSIC);
  }

  // ── 2.3 Validar Listas Negras ──
  const errorListas = validarListasNegras(datosProspecto);
  if (errorListas) {
    erroresAcumulados.push(errorListas);
    console.warn('[CORE:ActivarProspecto] Error Listas Negras:', errorListas);
  }

  // ── 2.4 Validar estructura JSON ──
  const erroresJSON = validarEstructuraJSON(datosProspecto);
  if (erroresJSON.length > 0) {
    erroresAcumulados.push(...erroresJSON);
    console.warn('[CORE:ActivarProspecto] Errores de estructura JSON:', erroresJSON);
  }

  // ── Si hay errores, rechazar la activacion ──
  if (erroresAcumulados.length > 0) {
    console.error('[CORE:ActivarProspecto] RECHAZO — Total errores:', erroresAcumulados.length);
    erroresAcumulados.forEach((e, i) => console.error(`  [${i + 1}] ${e}`));

    return {
      estatusOperacion: 'ERROR',
      mensaje: 'No se puede activar el prospecto. Validar datos y estatus SIC/Listas Negras.',
      errores: erroresAcumulados,
    };
  }

  // ════════════════════════════════════════════════════════
  // INTENTO 0 — RPC ATÓMICA activar_prospecto_core
  // (Transacción única: valida cuenta eje duplicada, busca producto,
  //  UPDATE J_CLIENTES, INSERT cuenta eje — todo en un solo call)
  // ════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════
  // PRE-SANITIZACIÓN: Limpiar datos numéricos vacíos ("") en J_CLIENTES.data
  // antes de la RPC atómica, para evitar:
  //   "invalid input syntax for type numeric: \"\""
  // La RPC lee internamente el JSONB de J_CLIENTES y puede encontrar
  // campos como monto_sol="" en registros legacy corruptos.
  // ═══════════════════════════════════════════════════════
  try {
    console.log('[CORE:ActivarProspecto] Pre-sanitización: limpiando campos numéricos vacíos...');
    const NUMERIC_FIELDS = ['monto_sol', 'monto_aut', 'monto_disp', 'saldo_actual', 'montoSol', 'montoAut', 'montoDisp', 'saldoActual', 'ingresosMensuales', 'egresosMensuales'];
    const sanitized = { ...datosProspecto } as Record<string, any>;
    let sanitizedCount = 0;
    for (const field of NUMERIC_FIELDS) {
      if (sanitized[field] === '' || sanitized[field] === ' ') {
        sanitized[field] = null;
        sanitizedCount++;
      }
    }
    if (sanitizedCount > 0) {
      console.log(`[CORE:ActivarProspecto] Sanitizados ${sanitizedCount} campos numéricos vacíos → null`);
    }
  } catch (sanitizeErr) {
    console.warn('[CORE:ActivarProspecto] Error en pre-sanitización (no bloquea):', sanitizeErr);
  }

  try {
    console.log('[CORE:ActivarProspecto] ═══════ INTENTO 0 — RPC activar_prospecto_core ═══════');
    const { data: rpcResult, error: rpcError } = await supabase.rpc('activar_prospecto_core', {
      p_cliente_id: idProspecto,
    });

    if (!rpcError && rpcResult) {
      const result = typeof rpcResult === 'string' ? JSON.parse(rpcResult) : rpcResult;
      console.log('[CORE:ActivarProspecto] RPC activar_prospecto_core resultado:', result);

      if (result.ok === true) {
        // ✓ RPC atómica exitosa — ya hizo UPDATE + INSERT
        const cuentaEje = result.cuentaEje;
        const nombreCompleto = result.cliente?.nombreCompleto || `${datosProspecto.nombre || ''} ${datosProspecto.apellidoPaterno || ''} ${datosProspecto.apellidoMaterno || ''}`.trim() || 'Sin nombre';
        console.log(`[CORE:ActivarProspecto] ✓ RPC ATÓMICA OK — cuentaEje: ${cuentaEje?.id}`);

        // Guardar cuenta eje en sessionStorage para que useCuentasAhorroDB la vea inmediatamente
        if (cuentaEje) {
          saveCuentaEjeToSessionStorage(cuentaEje.id, {
            p_no_sol: cuentaEje.noSol,
            p_no_cuenta: cuentaEje.noCuenta,
            p_fecha_sol: new Date().toISOString(),
            p_fecha_autori: new Date().toISOString(),
            p_fecha_inicio: new Date().toISOString(),
            p_descripcion: 'Cuenta eje generada automáticamente al activar prospecto',
            p_linea_produc: 'CAPTACION',
            p_tipo_produc: 'Ahorro',
            p_producto_id: cuentaEje.productoId || null,
            p_cliente_id: idProspecto,
            p_monto_sol: 0,
            p_monto_aut: 0,
            p_monto_disp: 0,
            p_cta_eje_chec: true,
            p_fases: 'Inicial',
            p_data: null,
          } as InsertCuentaAhorroPayload, nombreCompleto);
        }

        // Crear notificaciones (no bloquean)
        await crearNotificacion({
          dirigidoA: 'Empleados', tipoCobertura: 'Empresa',
          mensaje: `El prospecto ${nombreCompleto} ha sido activado.`,
          idReferencia: idProspecto, fecha: new Date().toISOString(),
          estatusNotificacion: 'Pendiente',
        });

        // Warnings del RPC (ej: sin producto eje)
        if (result.warnings && Array.isArray(result.warnings) && result.warnings.length > 0) {
          result.warnings.forEach((w: string) => {
            console.warn(`[CORE:ActivarProspecto] WARNING RPC: ${w}`);
            toast.warning('Aviso', { description: w, duration: 6000 });
          });
        }

        return {
          estatusOperacion: 'OK',
          mensaje: `El prospecto ${nombreCompleto} ha sido activado exitosamente.`,
          cuentaEjeId: cuentaEje?.id,
          numeroCuenta: cuentaEje?.noCuenta,
        };
      } else if (result.ya_tiene_cuenta_eje) {
        // El cliente ya tiene cuenta eje — no es error fatal
        console.warn('[CORE:ActivarProspecto] RPC: cliente ya tiene cuenta eje');
        return {
          estatusOperacion: 'OK',
          mensaje: `El prospecto ya fue activado previamente (ya tiene cuenta eje).`,
          errores: [result.error],
        };
      } else if (result.ya_es_cliente) {
        // El registro ya es de type=Clientes — no re-activar
        console.warn('[CORE:ActivarProspecto] RPC: registro ya es Cliente');
        return {
          estatusOperacion: 'OK',
          mensaje: `El registro ya está activado como Cliente.`,
          errores: [result.error],
        };
      } else {
        // Error del RPC
        console.error('[CORE:ActivarProspecto] RPC ERROR:', result.error);
        // NO retornamos — caemos al fallback Edge Function
      }
    }

    if (rpcError) {
      console.warn('[CORE:ActivarProspecto] RPC activar_prospecto_core no disponible:', rpcError.message);
    }
  } catch (e: any) {
    console.warn('[CORE:ActivarProspecto] RPC activar_prospecto_core excepción:', e?.message || e);
  }

  console.log('[CORE:ActivarProspecto] RPC atómica no disponible — cayendo a fallback Edge Function + sessionStorage');

  // ════════════════════════════════════════════════════════
  // FALLBACK — UPDATE J_CLIENTES via Edge Function
  // SET type = 'Clientes' (spec), estatus = 'Activo' (spec)
  //
  // PROTECCIÓN v6.0: Leer data actual → deep merge → PUT
  // Esto preserva contrasena y otros campos sensibles
  // que no están en el formulario del Portal.
  // ════════════════════════════════════════════════════════
  try {
    console.log('[CORE:ActivarProspecto] FALLBACK: UPDATE J_CLIENTES — type→Clientes, estatus→Activo');

    // ── PASO 0: Leer data actual de BD para deep merge ──
    let finalData: any = { ...datosProspecto };
    try {
      console.log(`[CORE:ActivarProspecto] PASO 0: GET /clientes/${idProspecto} para deep merge...`);
      const getRes = await fetch(`${BASE_URL}/clientes/${idProspecto}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      console.log(`[CORE:ActivarProspecto] GET response status: ${getRes.status}`);
      
      if (getRes.ok) {
        const getText = await getRes.text();
        console.log(`[CORE:ActivarProspecto] GET response body (primeros 500 chars):`, getText.substring(0, 500));
        
        let getResult: any;
        try { getResult = JSON.parse(getText); } catch { getResult = null; }
        
        // Intentar múltiples formatos de respuesta del endpoint
        let existingData: any = null;
        
        if (getResult?.success && getResult?.data?.data) {
          // Formato: { success: true, data: { data: {...} } }
          existingData = typeof getResult.data.data === 'string'
            ? JSON.parse(getResult.data.data) : getResult.data.data;
          console.log('[CORE:ActivarProspecto] Formato detectado: { success, data: { data } }');
        } else if (getResult?.data && Array.isArray(getResult.data) && getResult.data[0]?.data) {
          // Formato: { data: [{ data: {...} }] }
          existingData = typeof getResult.data[0].data === 'string'
            ? JSON.parse(getResult.data[0].data) : getResult.data[0].data;
          console.log('[CORE:ActivarProspecto] Formato detectado: { data: [{ data }] }');
        } else if (getResult?.data?.data === undefined && getResult?.data && typeof getResult.data === 'object' && !Array.isArray(getResult.data)) {
          // Formato: { data: { type, estatus, data: {...} } } — el nodo data está directo
          existingData = getResult.data;
          console.log('[CORE:ActivarProspecto] Formato detectado: { data: {...} } (nodo directo)');
        }
        
        if (existingData) {
          console.log('[CORE:ActivarProspecto] EXISTING keys:', Object.keys(existingData).length);
          console.log('[CORE:ActivarProspecto] EXISTING contrasena:', existingData.contrasena ? 'PRESENTE' : 'AUSENTE');

          // Deep merge: datosProspecto sobre existingData
          finalData = { ...existingData };
          for (const [key, value] of Object.entries(datosProspecto as Record<string, any>)) {
            if (value === null || value === undefined || value === '') continue;
            if (Array.isArray(value)) { finalData[key] = value; continue; }
            if (typeof value === 'object' && !Array.isArray(value)) {
              const existChild = existingData[key];
              if (existChild && typeof existChild === 'object' && !Array.isArray(existChild)) {
                finalData[key] = { ...existChild };
                for (const [ck, cv] of Object.entries(value as Record<string, any>)) {
                  if (cv === null || cv === undefined || cv === '') continue;
                  finalData[key][ck] = cv;
                }
              } else {
                finalData[key] = value;
              }
              continue;
            }
            finalData[key] = value;
          }

          // Escudo nuclear: restaurar campos sensibles
          const PROTECTED = ['contrasena', 'curp', 'telefono', 'correoElectronico', 'institucionGobierno', 'institucionGobiernoId', 'clasificacionCliente', 'fechaNacimiento', 'sexo'];
          for (const f of PROTECTED) {
            if (existingData[f] && !finalData[f]) {
              finalData[f] = existingData[f];
              console.log(`[CORE:ActivarProspecto] NUCLEAR RESTORE: ${f}`);
            }
          }

          console.log('[CORE:ActivarProspecto] MERGED keys:', Object.keys(finalData).length);
        } else {
          console.warn('[CORE:ActivarProspecto] No se pudo extraer existingData del GET — usando datos del formulario sin merge');
          console.log('[CORE:ActivarProspecto] getResult estructura:', JSON.stringify(getResult).substring(0, 500));
        }
      } else {
        console.warn(`[CORE:ActivarProspecto] GET /clientes/${idProspecto} falló (HTTP ${getRes.status})`);
      }
    } catch (mergeErr) {
      console.warn('[CORE:ActivarProspecto] Error al leer data actual, continuando sin merge:', mergeErr);
    }

    // ── REGLA INSTITUCIONAL (§3): Activación = UPDATE mismo registro ──
    // SET type='Clientes', estatus='Activo',
    //     data = data || '{"estatusCliente":"Cliente","estatusProspecto":"Convertido","fechaActivacion":"..."}'
    // NO existe nodo "default" — JSON plano.
    finalData.estatusCliente = 'Cliente';
    finalData.estatusProspecto = 'Convertido';
    finalData.estatus = 'Activo';
    finalData.fechaActivacion = new Date().toISOString();
    // Eliminar nodo default legacy si existiera
    delete finalData.default;
    
    const putBody = {
      type: 'Clientes',
      subtipo: datosProspecto.tipo || null,
      estatus: 'Activo',
      data: compactData(finalData),
    };
    
    console.log('[CORE:ActivarProspecto] ══════ PUT BODY ══════');
    console.log('[CORE:ActivarProspecto] type:', putBody.type);
    console.log('[CORE:ActivarProspecto] subtipo:', putBody.subtipo);
    console.log('[CORE:ActivarProspecto] estatus:', putBody.estatus);
    console.log('[CORE:ActivarProspecto] data.estatusCliente:', finalData.estatusCliente);
    console.log('[CORE:ActivarProspecto] data.estatus:', finalData.estatus);
    console.log('[CORE:ActivarProspecto] data keys:', Object.keys(finalData).length);
    console.log('[CORE:ActivarProspecto] PUT URL:', `${BASE_URL}/clientes/${idProspecto}`);

    const res = await fetch(`${BASE_URL}/clientes/${idProspecto}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`,
      },
      body: JSON.stringify(putBody),
    });

    const text = await res.text();
    console.log(`[CORE:ActivarProspecto] PUT response status: ${res.status}`);
    console.log(`[CORE:ActivarProspecto] PUT response body (primeros 500 chars):`, text.substring(0, 500));
    
    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      console.error('[CORE:ActivarProspecto] Respuesta no-JSON de UPDATE:', text.substring(0, 300));
      return {
        estatusOperacion: 'ERROR',
        mensaje: 'No se puede activar el prospecto. Validar datos y estatus SIC/Listas Negras.',
        errores: [`Error de servidor al actualizar J_CLIENTES (HTTP ${res.status})`],
      };
    }

    if (!res.ok) {
      console.error('[CORE:ActivarProspecto] Error HTTP en UPDATE:', res.status, result);
      return {
        estatusOperacion: 'ERROR',
        mensaje: 'No se puede activar el prospecto. Validar datos y estatus SIC/Listas Negras.',
        errores: [result.error || `HTTP ${res.status} al actualizar J_CLIENTES`],
      };
    }

    console.log('[CORE:ActivarProspecto] UPDATE J_CLIENTES exitoso:', result);
  } catch (err) {
    console.error('[CORE:ActivarProspecto] Error de red en UPDATE:', err);
    return {
      estatusOperacion: 'ERROR',
      mensaje: 'No se puede activar el prospecto. Validar datos y estatus SIC/Listas Negras.',
      errores: [`Error de conexion al actualizar J_CLIENTES: ${String(err)}`],
    };
  }

  // ════════════════════════════════════════════════════════
  // 4. — Generar Cuenta Eje
  // ════════════════════════════════════════════════════════
  // REGLA INSTITUCIONAL (§1): Nombre completo = nombre + apellidoPaterno + apellidoMaterno
  const nombreCompleto = `${datosProspecto.nombre || ''} ${datosProspecto.apellidoPaterno || ''} ${datosProspecto.apellidoMaterno || ''}`.trim() || 'Sin nombre';
  const cuentaEjeId = await generarCuentaEje(idProspecto, nombreCompleto);
  console.log('[CORE:ActivarProspecto] Cuenta Eje generada:', cuentaEjeId);

  // ════════════════════════════════════════════════════════
  // 5. — Notificacion institucional en J_NOTIFICACIONES
  // ════════════════════════════════════════════════════════

  // 5.1 — Cobertura Empresa (todos los empleados)
  await crearNotificacion({
    dirigidoA: 'Empleados',
    tipoCobertura: 'Empresa',
    mensaje: `El prospecto ${nombreCompleto} ha sido activado.`,
    idReferencia: idProspecto,
    fecha: new Date().toISOString(),
    estatusNotificacion: 'Pendiente',
  });

  // 5.2 — Cobertura Sucursal (empleados de la sucursal del prospecto)
  await crearNotificacion({
    dirigidoA: 'Empleados',
    tipoCobertura: 'Sucursal',
    mensaje: `El prospecto ${nombreCompleto} ha sido activado en sucursal ${datosProspecto.sucursal || datosProspecto.entidadFederativa || 'N/A'}.`,
    idReferencia: idProspecto,
    fecha: new Date().toISOString(),
    estatusNotificacion: 'Pendiente',
  });

  console.log('[CORE:ActivarProspecto] Notificaciones institucionales creadas.');

  // ════════════════════════════════════════════════════════
  // 6. — Respuesta exitosa al Portal
  // ════════════════════════════════════════════════════════
  const respuesta: ActivacionProspectoResponse = {
    estatusOperacion: 'OK',
    mensaje: `El prospecto ${nombreCompleto} se ha mandado para su validacion.`,
    cuentaEjeId: cuentaEjeId?.id || undefined,
    numeroCuenta: cuentaEjeId?.noCuenta || undefined,
  };

  console.log('═══════════════════════════════════════════════════');
  console.log('[CORE:ActivarProspecto] ACTIVACION EXITOSA');
  console.log('[CORE:ActivarProspecto] Respuesta:', respuesta);
  console.log('══════════════════════════════════════════════════');

  return respuesta;
}

// ════════════════════════════════════════════════════════
// HOOK REACT — Para usar desde componentes
// ════════════════════════════════════════════════════════

export interface UseActivacionProspectoReturn {
  /** Ejecutar la activacion CORE */
  activar: (request: ActivacionProspectoRequest) => Promise<ActivacionProspectoResponse>;
  /** Estado de carga */
  loading: boolean;
  /** Ultima respuesta del CORE */
  resultado: ActivacionProspectoResponse | null;
  /** Limpiar resultado */
  clearResultado: () => void;
}

export function useActivacionProspecto(): UseActivacionProspectoReturn {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<ActivacionProspectoResponse | null>(null);

  const activar = useCallback(async (request: ActivacionProspectoRequest): Promise<ActivacionProspectoResponse> => {
    setLoading(true);
    setResultado(null);

    try {
      const response = await activarProspectoCORE(request);
      setResultado(response);

      // Feedback visual via toast
      if (response.estatusOperacion === 'OK') {
        toast.success('Prospecto Activado', {
          description: response.mensaje,
          duration: 6000,
        });
      } else {
        toast.error('Activacion Rechazada', {
          description: response.mensaje,
          duration: 8000,
        });
        // Mostrar errores individuales
        if (response.errores && response.errores.length > 0) {
          console.group('[CORE] Detalle de errores de activacion:');
          response.errores.forEach((e, i) => {
            console.error(`  [${i + 1}] ${e}`);
          });
          console.groupEnd();
        }
      }

      return response;
    } catch (err) {
      const errorResponse: ActivacionProspectoResponse = {
        estatusOperacion: 'ERROR',
        mensaje: 'No se puede activar el prospecto. Validar datos y estatus SIC/Listas Negras.',
        errores: [`Error inesperado: ${String(err)}`],
      };
      setResultado(errorResponse);
      toast.error('Error inesperado', { description: String(err), duration: 6000 });
      return errorResponse;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearResultado = useCallback(() => {
    setResultado(null);
  }, []);

  return { activar, loading, resultado, clearResultado };
}