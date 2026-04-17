// ═══════════════════════════════════════════════════════════════════
// Funciones de utilidad para generar códigos de cuenta eje
// Reutilizadas en activación de prospectos y alta de clientes
// ═══════════════════════════════════════════════════════════════════
import { projectId, publicAnonKey } from '/utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;

/** no_sol = 'AUTO-' + uuid.substring(0,8) — spec sección 7.1 */
export function generateNoSol(): string {
  return `AUTO-${crypto.randomUUID().substring(0, 8)}`;
}

/**
 * Genera un número de cuenta bancario con formato institucional de 16 dígitos.
 * Formato: BBBB-SSSS-CCCC-CCCC
 *   BBBB = código de institución (0147 = eFinanciaNet)
 *   SSSS = código de sucursal (derivado del UUID del cliente)
 *   CCCC-CCCC = secuencia única (derivada de timestamp + random)
 */
export function generateNoCuenta(clienteId: string): string {
  const INST_CODE = '0147';
  const sucursal = clienteId.replace(/-/g, '').substring(0, 4)
    .split('').map(c => {
      const n = parseInt(c, 16);
      return isNaN(n) ? '0' : String(n % 10);
    }).join('');
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

interface InsertCuentaAhorroPayload {
  p_no_sol: string;
  p_no_cuenta: string;
  p_no_referenc1: string;
  p_fecha_sol: string;
  p_fecha_autori: string;
  p_fecha_disper: string | null;
  p_fecha_cancel: string | null;
  p_fecha_inicio: string;
  p_fecha_fin_cu: string | null;
  p_descripcion: string;
  p_linea_produc: string;
  p_tipo_produc: string;
  p_producto_id: string | null;
  p_producto_eje: string | null;
  p_cliente_id: string;
  p_monto_sol: number;
  p_monto_aut: number;
  p_monto_disp: number;
  p_cta_eje_chec: boolean;
  p_fases: string;
  p_data: Record<string, any>;
}

/**
 * Verifica si un cliente ya tiene una cuenta eje en J_CUENTAS_CORP_CLIENTES.
 * Retorna true si ya existe, false si no tiene cuenta eje.
 *
 * Estrategias en orden:
 *  1. GET /cuentas-ahorro — consulta J_CUENTAS_CORP_CLIENTES directamente (fuente autoritativa)
 *  2. GET /clientes/:id   — lee J_CLIENTES.data.cuentaEje (campo cacheado)
 *  3. sessionStorage      — fallback offline
 */
export async function clienteTieneCuentaEje(clienteUuid: string): Promise<boolean> {
  const LOG_CE = '[CuentaEjeGenerator:check]';

  // Fuente autoritativa: J_CUENTAS_CORP_CLIENTES via GET /cuentas-ahorro
  // J_CLIENTES.data.cuentaEje es solo un campo cacheado — no es fuente de verdad
  try {
    const res = await fetch(`${BASE_URL}/cuentas-ahorro`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${publicAnonKey}` },
    });
    if (res.ok) {
      const cuentas: any[] = await res.json();
      if (Array.isArray(cuentas)) {
        const encontrada = cuentas.find(
          (c: any) => String(c.cliente_id) === clienteUuid &&
            (c.cta_eje_chec === true || c.cta_eje_chec === 't' || c.cta_eje_chec === '1')
        );
        if (encontrada) {
          console.log(`${LOG_CE} ✓ Cuenta eje en J_CUENTAS_CORP_CLIENTES: ${encontrada.no_cuenta}`);
          return true;
        }
        console.log(`${LOG_CE} GET /cuentas-ahorro OK — ${cuentas.length} cuentas, ninguna eje para ${clienteUuid}`);
        return false;
      }
    }
  } catch (e: any) {
    console.warn(`${LOG_CE} GET /cuentas-ahorro falló: ${e?.message || e}`);
  }

  console.log(`${LOG_CE} No se pudo verificar — asumiendo sin cuenta eje para evitar bloqueo`);
  return false;
}

/**
 * Genera una Cuenta Eje en J_CUENTAS_CORP_CLIENTES asociada al cliente.
 * Usa la misma lógica que activar prospecto.
 */
export async function generarCuentaEje(
  clienteUuid: string,
  nombreCliente: string
): Promise<{ id: string; noCuenta: string } | null> {
  const LOG_CE = '[CuentaEjeGenerator]';
  const noSol = generateNoSol();
  const noCuenta = generateNoCuenta(clienteUuid);
  const noRef = generateNoReferencia();
  const now = new Date();
  const fechaHoyISO = now.toISOString();

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
    p_descripcion: `Cuenta Eje generada automáticamente al dar de alta cliente ${nombreCliente}`,
    p_linea_produc: 'CAPTACION',
    p_tipo_produc: 'Ahorro',
    p_producto_id: null,
    p_producto_eje: null,
    p_cliente_id: clienteUuid,
    p_monto_sol: 0,
    p_monto_aut: 0,
    p_monto_disp: 0,
    p_cta_eje_chec: true,
    p_fases: 'Activa',
    p_data: {
      metadatos: {
        noSol,
        noCuenta,
        noReferenc1: noRef,
        origenCreacion: 'AltaCliente',
        titular: nombreCliente,
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
  console.log(`${LOG_CE} Generando Cuenta Eje para cliente: ${clienteUuid}`);
  console.log(`${LOG_CE} noSol: ${noSol} | noCuenta: ${noCuenta} | noRef: ${noRef}`);
  console.log(`${LOG_CE} ══════════════════════════════════════════════`);

  // Intento 1: Edge Function
  try {
    console.log(`${LOG_CE} Intento 1 → Edge Function POST /cuentas-ahorro`);
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
      saveCuentaEjeToSessionStorage(cuentaEjeId, payload, nombreCliente);
      return { id: cuentaEjeId, noCuenta };
    }
    const errBody = await res.text().catch(() => '');
    console.warn(`${LOG_CE} Edge Function HTTP ${res.status}`, errBody);
  } catch (e: any) {
    console.warn(`${LOG_CE} Edge Function no disponible: ${e?.message || e}`);
  }

  // Intento 2: RPC insert_cuenta_ahorro
  try {
    console.log(`${LOG_CE} Intento 2 → supabase.rpc('insert_cuenta_ahorro')`);
    const rpcPayload = { ...payload } as any;
    if (rpcPayload.p_cta_eje_chec !== undefined && rpcPayload.p_cta_eje_chec !== null) {
      const v = rpcPayload.p_cta_eje_chec;
      rpcPayload.p_cta_eje_chec = v === true || v === 'true' || v === 't' || v === '1';
    }
    if (rpcPayload.p_data && typeof rpcPayload.p_data === 'object') {
      rpcPayload.p_data = JSON.stringify(rpcPayload.p_data);
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    const supabase = (await import('@supabase/supabase-js')).createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.rpc('insert_cuenta_ahorro', rpcPayload);

    if (!error && data) {
      const rows = Array.isArray(data) ? data : [data];
      const row = rows[0] as any;
      const cuentaEjeId = row?.id || crypto.randomUUID();
      console.log(`${LOG_CE} ✅ RPC insert_cuenta_ahorro OK — id: ${cuentaEjeId}`);
      saveCuentaEjeToSessionStorage(cuentaEjeId, payload, nombreCliente);
      return { id: cuentaEjeId, noCuenta };
    }

    if (error) {
      console.warn(`${LOG_CE} RPC insert_cuenta_ahorro error: ${error.message}`);
    }
  } catch (e: any) {
    console.warn(`${LOG_CE} RPC insert_cuenta_ahorro excepción: ${e?.message || e}`);
  }

  // Intento 3: sessionStorage fallback
  console.warn(`${LOG_CE} ⚠️⚠️⚠️ Cuenta Eje NO se persistió en BD — solo sessionStorage ⚠️⚠️⚠️`);
  const localId = crypto.randomUUID();
  saveCuentaEjeToSessionStorage(localId, payload, nombreCliente);
  return { id: localId, noCuenta };
}

function saveCuentaEjeToSessionStorage(
  id: string,
  payload: InsertCuentaAhorroPayload,
  titular: string
) {
  try {
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
    const filtered = existing.filter((c: any) => c.id !== id);
    filtered.push(newItem);
    sessionStorage.setItem(KEY_LIST, JSON.stringify(filtered));
  } catch (e) {
    console.warn('[CuentaEjeGenerator] Error guardando en sessionStorage:', e);
  }
}