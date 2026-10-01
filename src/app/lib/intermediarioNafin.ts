/**
 * intermediarioNafin.ts — Intermediario Financiero NAFIN en el maestro
 * Persona/Cliente (MD NAFIN 01 y 03).
 *
 * Prospecto y Cliente son la MISMA fila de J_CLIENTES (el Prospecto se
 * convierte a Cliente cambiando `type`), así que los datos del Intermediario se
 * capturan una sola vez en `data` y de ahí los leen la Oportunidad y la
 * Solicitud de Línea Global. MD 03: "no se crea una entidad paralela de
 * cliente exclusivamente para NAFIN".
 *
 * La clasificación reutiliza el campo existente `clasificacionCliente` (MD 10
 * §Componentes: reutilizar antes que crear) con el valor
 * `Intermediario Financiero`.
 */
import { projectId, publicAnonKey } from '/utils/supabase/info';

export const CLASIFICACION_INTERMEDIARIO = 'Intermediario Financiero';

export const CAT_TIPO_INTERMEDIARIO = ['Banco', 'SOFOM', 'SOFIPO', 'Unión de Crédito', 'Otro'];
export const ESTATUS_NAFIN_VIGENTE = 'Vigente';
export const CAT_ESTATUS_NAFIN = [ESTATUS_NAFIN_VIGENTE, 'Suspendido', 'En incorporación'];

/** MD 01 — mensaje exacto de bloqueo. */
export const MSG_IF_NO_VIGENTE =
  'No es posible solicitar una Línea Global. El Intermediario Financiero no se encuentra vigente en NAFIN.';

export interface DatosIntermediarioNafin {
  tipoIntermediario: string;
  numeroIntermediarioNafin: string;
  estatusIntermediarioNafin: string;
  fechaIncorporacionNafin: string;
}

export const CAMPOS_INTERMEDIARIO_NAFIN: (keyof DatosIntermediarioNafin)[] = [
  'tipoIntermediario',
  'numeroIntermediarioNafin',
  'estatusIntermediarioNafin',
  'fechaIncorporacionNafin',
];

const norm = (v: unknown) =>
  String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function esIntermediarioFinanciero(clasificacion: unknown): boolean {
  return norm(clasificacion) === norm(CLASIFICACION_INTERMEDIARIO);
}

/**
 * Datos del Intermediario de un JSONB de J_CLIENTES. `null` si el cliente no
 * está clasificado como Intermediario Financiero: en ese caso no hay maestro
 * que respetar y quien llama conserva su comportamiento anterior.
 */
export function intermediarioDeCliente(data: any): DatosIntermediarioNafin | null {
  const d = data || {};
  const def = d.default || {};
  const g = (k: string) => String(d[k] ?? def[k] ?? '').trim();
  if (!esIntermediarioFinanciero(g('clasificacionCliente'))) return null;
  return {
    tipoIntermediario: g('tipoIntermediario'),
    numeroIntermediarioNafin: g('numeroIntermediarioNafin'),
    estatusIntermediarioNafin: g('estatusIntermediarioNafin'),
    fechaIncorporacionNafin: g('fechaIncorporacionNafin'),
  };
}

/** Campos obligatorios del Intermediario (para los avisos de captura). */
export function faltantesIntermediario(d: Partial<DatosIntermediarioNafin>): string[] {
  const f: string[] = [];
  if (!d.tipoIntermediario) f.push('Tipo de Intermediario');
  if (!d.estatusIntermediarioNafin) f.push('Estatus NAFIN');
  return f;
}

// ═══════════════════════════════════════════════════════════════════
// Acceso a J_CLIENTES
// ═══════════════════════════════════════════════════════════════════

const API = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { Authorization: `Bearer ${publicAnonKey}` };

/** Todas las filas de J_CLIENTES (Prospectos y Clientes), sin duplicar. */
async function fetchFilasClientes(): Promise<any[]> {
  const vistas = new Map<string, any>();
  for (const ep of ['/clientes-prospectos', '/clientes-lista-todos']) {
    try {
      const res = await fetch(`${API}${ep}`, { headers: HDR });
      if (!res.ok) continue;
      for (const r of ((await res.json()).data || []) as any[]) {
        if (r?.id && !vistas.has(String(r.id))) vistas.set(String(r.id), r);
      }
    } catch { /* siguiente endpoint */ }
  }
  return [...vistas.values()];
}

const dataDe = (r: any) => {
  let d = r?.data;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = {}; } }
  return d || {};
};

/** Formato del consecutivo: IF-00001, IF-00002… */
export function formatearNoIntermediario(n: number): string {
  return `IF-${String(n).padStart(5, '0')}`;
}

/** Mayor sufijo numérico de una lista de números de Intermediario. */
export function maxNoIntermediario(valores: unknown[]): number {
  return valores.reduce<number>((acc, v) => {
    const m = /(\d+)\s*$/.exec(String(v ?? ''));
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
}

/**
 * Siguiente No. Intermediario NAFIN. El consecutivo es del MAESTRO: se calcula
 * sobre todos los clientes y, si se pasan, sobre números ya usados en otros
 * registros (p. ej. Oportunidades numeradas antes de que existiera el maestro),
 * para no repetir uno que ya circula.
 *
 * Igual que el folio de Oportunidad, se calcula en el navegador: dos altas
 * simultáneas pueden recibir el mismo número hasta que exista una secuencia en BD.
 */
export async function fetchSiguienteNoIntermediarioNafin(otrosUsados: unknown[] = []): Promise<string> {
  const filas = await fetchFilasClientes();
  const usados = [...filas.map(r => dataDe(r).numeroIntermediarioNafin), ...otrosUsados];
  return formatearNoIntermediario(maxNoIntermediario(usados) + 1);
}

/** Datos del Intermediario del cliente indicado, leídos de la BD. */
export async function fetchIntermediarioDeCliente(clienteId: string): Promise<DatosIntermediarioNafin | null> {
  if (!clienteId) return null;
  const filas = await fetchFilasClientes();
  const fila = filas.find(r => String(r.id) === String(clienteId) || dataDe(r)?.authUserId === clienteId);
  return fila ? intermediarioDeCliente(dataDe(fila)) : null;
}
