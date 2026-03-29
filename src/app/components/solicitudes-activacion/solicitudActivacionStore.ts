/**
 * solicitudActivacionStore.ts
 *
 * Tabla destino: EFINANCIANET_DB."J_SOLICITUDES_ACTIVACION"
 * JOINs: J_CLIENTES (via cliente_id), J_CUENTAS_CORP_CLIENTES (via solicitud_id)
 */

// ═══════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════

export interface SolicitudActivacionFormData {
  // ── DB columns (direct) ──────────────────────────────────────────
  id: string;                      // uuid — siempre read-only
  solicitudId: string;             // FK → J_CUENTAS_CORP_CLIENTES.id
  clienteId: string;               // FK → J_CLIENTES.id — no visible directo
  type: string;                    // → J_SOLICITUDES_ACTIVACION.type
  fechaSolicitud: string;          // YYYY-MM-DD — editable date input
  fechaCompromiso: string;         // YYYY-MM-DD — editable date input
  estatus: string;                 // Pendiente | Cancelado | Pagado

  // ── Read-only fields populated from selected SOLICITUD ───────────
  noSol: string;                   // J_CUENTAS_CORP_CLIENTES.no_sol (display)
  numeroDocumento: string;         // Auto-generated FAC-XXXXXXXXXX
  cliente: string;                 // data.solicitud.header.nombre_cliente
  cuentaBancaria: string;          // J_CUENTAS_CORP_CLIENTES.no_cuenta
  producto: string;                // data.solicitud.header.nombre_producto

  // ── data.header (editables) ───────────────────────────────────────
  formaDePago: string;             // 'Banca por internet' | 'En sucursal'
  institucionFinanciera: string;
  referencia: string;
  montoTransaccion: string;        // read-only, from selected SOLICITUD
  moneda: string;                  // read-only, from selected SOLICITUD
  nota: string;
  usuarioNota: string;

  // ── data.detail (manejado por el tab Detail) ──────────────────────
  detailClaveProducto: string;     // J_CUENTAS_CORP_CLIENTES.producto_id
  detailCantidad: number;          // editable, default 1
  detailMonto: number;             // espejo de montoTransaccion (number)
  detailPctImpuesto: number;       // J_CUENTAS_CORP_CLIENTES...tasa_interes (decimal)
  detailMoneda: string;            // espejo de moneda
  detailSubTotal: number;          // calculado: detailCantidad * detailMonto * (1 + pct)
  detailEstatus: 'Pendiente';      // fijo
}

export interface SolicitudActivacionListItem {
  id: string | number;
  solicitudId: string;
  cliente: string;
  numeroDocumento: string;
  tipo: string;
  fechaSolicitud: string;          // DD/MM/YYYY
  estatus: string;
  montoTransaccion?: string;       // data.header.montoTransaccion || solicitud_monto
  moneda?: string;                 // data.header.moneda || solicitud_moneda
  // Campos extra para reconstrucción del formulario
  _dbId?: string;
  _fromDB?: boolean;
  _raw?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════
// CATÁLOGOS
// ═══════════════════════════════════════════════════════════════════

export const CAT_FORMA_PAGO = [
  { value: 'Banca por internet', label: 'Banca por internet' },
  { value: 'En sucursal',        label: 'En sucursal' },
];

export const CAT_MONEDA = [
  { value: 'MXN', label: 'MXN' },
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
];

// ═══════════════════════════════════════════════════════════════════
// FORM VACÍO
// ═══════════════════════════════════════════════════════════════════

export const EMPTY_FORM: SolicitudActivacionFormData = {
  id: '',
  solicitudId: '',
  clienteId: '',
  type: '',
  fechaSolicitud: '',
  fechaCompromiso: '',
  estatus: 'Pendiente',
  // Read-only fields from selected SOLICITUD
  noSol: '',
  numeroDocumento: '',
  cliente: '',
  cuentaBancaria: '',
  producto: '',
  // data.header
  formaDePago: 'Banca por internet',
  institucionFinanciera: '',
  referencia: '',
  montoTransaccion: '0.00',
  moneda: 'MXN',
  nota: '',
  usuarioNota: '',
  // data.detail
  detailClaveProducto: '',
  detailCantidad: 1,
  detailMonto: 0,
  detailPctImpuesto: 0,
  detailMoneda: 'MXN',
  detailSubTotal: 0,
  detailEstatus: 'Pendiente',
};

// ═══════════════════════════════════════════════════════════════════
// SESSION STORAGE HELPERS
// ═══════════════════════════════════════════════════════════════════

const SS_PREFIX = 'sol_activacion';

export function saveToSession(id: string | number, section: string, data: unknown): void {
  try {
    sessionStorage.setItem(`${SS_PREFIX}_${id}_${section}`, JSON.stringify(data));
  } catch { /* ignore */ }
}

export function loadFromSession<T>(id: string | number, section: string): T | null {
  try {
    const raw = sessionStorage.getItem(`${SS_PREFIX}_${id}_${section}`);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return null;
}

export function clearSession(id: string | number): void {
  try {
    const prefix = `${SS_PREFIX}_${id}_`;
    Object.keys(sessionStorage)
      .filter(k => k.startsWith(prefix))
      .forEach(k => sessionStorage.removeItem(k));
  } catch { /* ignore */ }
}

// ═══════════════════════════════════════════════════════════════════
// DATE HELPERS
// ═══════════════════════════════════════════════════════════════════

export function getFechaSolicitudNow(): string {
  const now  = new Date();
  const dd   = String(now.getDate()).padStart(2, '0');
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh   = String(now.getHours()).padStart(2, '0');
  const min  = String(now.getMinutes()).padStart(2, '0');
  const ss   = String(now.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

// ═══════════════════════════════════════════════════════════════════
// CURRENCY
// ═══════════════════════════════════════════════════════════════════

export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(Number(value))) return '$0.00';
  return `$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseCurrency(value: string): number {
  const n = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}
