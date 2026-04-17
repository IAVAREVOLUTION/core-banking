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
  solicitudId: string;             // FK → J_CUENTAS_CORP_CLIENTES.id — read-only
  clienteId: string;               // FK → J_CLIENTES.id — read-only (no visible directo)
  type: string;                    // → J_SOLICITUDES_ACTIVACION.type
  fechaSolicitud: string;          // DD/MM/YYYY HH:MM:SS — read-only display
  fechaCompromiso: string;         // DD/MM/YYYY → J_SOLICITUDES_ACTIVACION.fecha_compromiso
  /** Periodicidad del producto — usada para derivar fechaCompromiso */
  periodicidad?: string;
  /** Línea del producto referenciado: "Crédito" | "Captación" | "Línea de Crédito" */
  lineaProducto?: string;
  /** Marca interna: true cuando el guardado proviene del botón "Activar" (Pagado → Enviada) */
  _fromActivar?: boolean;
  estatus: string;                 // fijo 'Pendiente' — read-only

  // ── JOIN-sourced read-only display fields ────────────────────────
  numeroDocumento: string;         // J_CLIENTES.data.curp
  cliente: string;                 // J_CLIENTES nombre + apellidos
  cuentaBancaria: string;          // J_CUENTAS_CORP_CLIENTES.no_cuenta

  // ── data.header (editables) ───────────────────────────────────────
  formaDePago: string;             // 'Banca por internet' | 'En sucursal'
  institucionFinanciera: string;
  referencia: string;
  montoTransaccion: string;        // pre-poblado de J_CUENTAS_CORP_CLIENTES
  moneda: string;                  // pre-poblado de J_CUENTAS_CORP_CLIENTES
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
  /** Marca interna: true cuando el guardado proviene del botón "Activar" (Pagado → Enviada) */
  _fromActivar?: boolean;
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
  periodicidad: '',
  estatus: 'Pendiente',
  // JOIN read-only
  numeroDocumento: '',
  cliente: '',
  cuentaBancaria: '',
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

/**
 * Calcula la fecha del primer pago sumando un período a la fecha de inicio.
 * Reglas: mensual=+1 mes, quincenal=+15 días, catorcenal=+14 días,
 *         semanal=+7 días, trimestral=+3 meses, semestral=+6 meses, anual=+1 año.
 *
 * @param fechaInicio  — DD/MM/YYYY o YYYY-MM-DD
 * @param frecuencia   — valor de CAT_FRECUENCIA (Mensual, Quincenal, Semanal, etc.)
 * @returns DD/MM/YYYY o '' si la fecha no es parseable
 */
export function calcularFechaPrimerPago(fechaInicio: string, frecuencia: string): string {
  if (!fechaInicio) return '';

  // Parsear DD/MM/YYYY o YYYY-MM-DD
  let d: Date | null = null;
  const slash = fechaInicio.split('/');
  if (slash.length === 3 && slash[0].length === 2) {
    d = new Date(parseInt(slash[2]), parseInt(slash[1]) - 1, parseInt(slash[0]));
  } else {
    const iso = fechaInicio.split('-');
    if (iso.length === 3 && iso[0].length === 4) {
      d = new Date(parseInt(iso[0]), parseInt(iso[1]) - 1, parseInt(iso[2]));
    }
  }
  if (!d || isNaN(d.getTime())) return '';

  const f = (frecuencia || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if      (f.includes('semana'))   d.setDate(d.getDate() + 7);
  else if (f.includes('catorce'))  d.setDate(d.getDate() + 14);
  else if (f.includes('quincen'))  d.setDate(d.getDate() + 15);
  else if (f.includes('trimest'))  d.setMonth(d.getMonth() + 3);
  else if (f.includes('semest'))   d.setMonth(d.getMonth() + 6);
  else if (f.includes('anual'))    d.setFullYear(d.getFullYear() + 1);
  else /* mensual o default */     d.setMonth(d.getMonth() + 1);

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
