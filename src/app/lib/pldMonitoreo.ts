/**
 * Motor de monitoreo PLD sobre datos reales del sistema.
 *
 * Revisa los movimientos de las cuentas (J_CUENTAS_CORP_CLIENTES.data.movimientos)
 * y las verificaciones de listas de las personas, con los Parámetros del módulo
 * PLD, y propone alertas. No escribe nada: el oficial revisa y decide cuáles
 * se generan.
 *
 * Reglas (enfoque basado en riesgo):
 *  R1 Operación relevante: operación EN EFECTIVO ≥ umbral en USD × tipo de cambio.
 *  R2 Monto fuera de perfil: monto > máximo por tipo de persona (física/moral).
 *  R3 Fraccionamiento: ≥ 3 abonos del mismo cliente en ≤ 5 días, cada uno bajo
 *     el umbral R1, cuya suma lo alcanza.
 *  R4 Desviación: monto del último mes > promedio de meses previos × (1 + % desviación).
 *  R5 Listas: persona con coincidencia confirmada o en revisión en su verificación PLD.
 */
import { repararDataSolicitud } from './repararDataSolicitud';

export type TipoAlertaPLD = 'Relevante' | 'Inusual' | 'Preocupante';

export interface ParametrosMonitoreo {
  montoMaxOperacionUSD: number;
  montoMaxPersonaFisica: number;
  montoMaxPersonaMoral: number;
  porcentajeDesviacion: number;
  tipoCambioUSD: number;
  aplicaPersonaFisica: boolean;
  aplicaPersonaMoral: boolean;
}

export interface MovimientoPLD {
  id: string;
  cuentaId: string;
  noCuenta: string;
  clienteId: string;
  cliente: string;
  rfc: string;
  esMoral: boolean;
  tipo: string;        // Abono | Cargo
  concepto: string;
  /** Forma de pago, si el movimiento la trae (efectivo, transferencia…). */
  medio: string;
  monto: number;
  fecha: Date;
}

/** Operaciones originadas por la institución (no por el cliente): no son materia de estas reglas. */
const INSTITUCIONAL = /(apertura de cuenta|disposici[oó]n|desembolso|dispersi[oó]n|reverso|ajuste contable|cancelaci[oó]n)/i;
/** Operación en efectivo: la "operación relevante" de la regulación es en efectivo. */
const EN_EFECTIVO = /(efectivo|ventanilla|cash)/i;
export const esOperacionDelCliente = (m: MovimientoPLD) => !INSTITUCIONAL.test(m.concepto);
export const esEnEfectivo = (m: MovimientoPLD) => EN_EFECTIVO.test(`${m.medio} ${m.concepto}`);

export interface AlertaPropuesta {
  /** Identificador estable de la detección (evita duplicar alertas ya generadas). */
  clave: string;
  regla: 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
  nombreRegla: string;
  tipoAlerta: TipoAlertaPLD;
  clienteId: string;
  cliente: string;
  rfc: string;
  monto: number;
  fecha: Date;
  descripcion: string;
  movimientos: string[];
}

export const NOMBRE_REGLA: Record<AlertaPropuesta['regla'], string> = {
  R1: 'Operación relevante (efectivo)',
  R2: 'Monto fuera del perfil por tipo de persona',
  R3: 'Posible fraccionamiento',
  R4: 'Desviación del comportamiento histórico',
  R5: 'Coincidencia en listas',
};

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const dinero = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });
const fechaCorta = (d: Date) => d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function parametrosDesde(p: Record<string, any>): ParametrosMonitoreo {
  return {
    montoMaxOperacionUSD: num(p.montoMaxOperacionUSD) || 7500,
    montoMaxPersonaFisica: num(p.montoMaxPersonaFisica) || 500000,
    montoMaxPersonaMoral: num(p.montoMaxPersonaMoral) || 5000000,
    porcentajeDesviacion: num(p.porcentajeDesviacion) || 50,
    tipoCambioUSD: num(p.tipoCambioUSD) || 18.5,
    aplicaPersonaFisica: String(p.aplicaPersonaFisica ?? 'Sí').toLowerCase().startsWith('s'),
    aplicaPersonaMoral: String(p.aplicaPersonaMoral ?? 'Sí').toLowerCase().startsWith('s'),
  };
}

/**
 * Extrae los movimientos aplicados de las filas de cuentas/solicitudes.
 * La cuenta EJE replica cada movimiento de la cuenta origen: se descartan los
 * duplicados (mismo cliente, tipo y monto con menos de 5 s de diferencia).
 */
export function extraerMovimientos(filas: any[]): MovimientoPLD[] {
  const lista: MovimientoPLD[] = [];
  for (const r of filas) {
    const d = repararDataSolicitud(r?.data);
    const movs = Array.isArray(d?.movimientos) ? d.movimientos : [];
    if (!movs.length || !r?.cliente_id) continue;
    const esMoral = /moral/i.test(String(r.cliente_subtipo || ''));
    // Persona Moral: sin apellidos viejos que hayan quedado guardados.
    const cliente = (esMoral ? String(r.cliente_nombre || '') : [r.cliente_nombre, r.cliente_ap_paterno, r.cliente_ap_materno].filter(Boolean).join(' ')).trim() || 'Sin nombre';
    for (const m of movs) {
      const estatus = String(m?.estatus || 'Aplicado').toLowerCase();
      if (estatus.includes('cancel') || estatus.includes('rechaz')) continue;
      const monto = Math.abs(num(m?.monto));
      const f = new Date(m?.fechaHora || m?.fechaRegistro || m?.fecha || '');
      if (!monto || Number.isNaN(f.getTime())) continue;
      lista.push({
        id: String(m?.id || `${r.id}-${f.getTime()}`),
        cuentaId: String(r.id),
        noCuenta: String(r.no_cuenta || r.no_sol || ''),
        clienteId: String(r.cliente_id),
        cliente,
        rfc: String(r.cliente_rfc || ''),
        esMoral,
        tipo: String(m?.tipo || ''),
        concepto: String(m?.concepto || ''),
        medio: String(m?.medio || m?.formaPago || m?.forma_pago || ''),
        monto,
        fecha: f,
      });
    }
  }
  lista.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  const unicos: MovimientoPLD[] = [];
  for (const m of lista) {
    const dup = unicos.find(u => u.clienteId === m.clienteId && u.tipo === m.tipo && u.monto === m.monto
      && Math.abs(u.fecha.getTime() - m.fecha.getTime()) < 5000);
    if (!dup) unicos.push(m);
  }
  return unicos;
}

export interface PersonaListas { clienteId: string; cliente: string; rfc: string; estatus: string; detalle: string }

export function monitorear(
  movimientos: MovimientoPLD[],
  p: ParametrosMonitoreo,
  personasEnListas: PersonaListas[] = [],
  ahora: Date = new Date(),
): AlertaPropuesta[] {
  const out: AlertaPropuesta[] = [];
  const umbralRelevante = p.montoMaxOperacionUSD * p.tipoCambioUSD;
  // Sólo operaciones del cliente (no disposiciones/aperturas de la institución).
  const aplica = (m: MovimientoPLD) => esOperacionDelCliente(m) && (m.esMoral ? p.aplicaPersonaMoral : p.aplicaPersonaFisica);

  for (const m of movimientos) {
    if (!aplica(m)) continue;
    if (esEnEfectivo(m) && m.monto >= umbralRelevante) {
      out.push({
        clave: `R1:${m.id}`, regla: 'R1', nombreRegla: NOMBRE_REGLA.R1, tipoAlerta: 'Relevante',
        clienteId: m.clienteId, cliente: m.cliente, rfc: m.rfc, monto: m.monto, fecha: m.fecha, movimientos: [m.id],
        descripcion: `${m.tipo} en efectivo de ${dinero(m.monto)} (${m.concepto}) en la cuenta ${m.noCuenta}: iguala o supera el umbral de USD ${p.montoMaxOperacionUSD.toLocaleString('es-MX')} (${dinero(umbralRelevante)} al TC ${p.tipoCambioUSD}).`,
      });
    }
    const maxPersona = m.esMoral ? p.montoMaxPersonaMoral : p.montoMaxPersonaFisica;
    if (m.monto > maxPersona) {
      out.push({
        clave: `R2:${m.id}`, regla: 'R2', nombreRegla: NOMBRE_REGLA.R2, tipoAlerta: 'Inusual',
        clienteId: m.clienteId, cliente: m.cliente, rfc: m.rfc, monto: m.monto, fecha: m.fecha, movimientos: [m.id],
        descripcion: `${m.tipo} de ${dinero(m.monto)} supera el máximo de ${dinero(maxPersona)} para persona ${m.esMoral ? 'moral' : 'física'}.`,
      });
    }
  }

  // R3 — fraccionamiento (abonos bajo el umbral que juntos lo alcanzan en 5 días)
  const porCliente = new Map<string, MovimientoPLD[]>();
  for (const m of movimientos) {
    if (!aplica(m)) continue;
    if (!porCliente.has(m.clienteId)) porCliente.set(m.clienteId, []);
    porCliente.get(m.clienteId)!.push(m);
  }
  const VENTANA = 5 * 86_400_000;
  for (const movs of porCliente.values()) {
    const abonos = movs.filter(m => /abono|dep[oó]sito/i.test(m.tipo) && m.monto < umbralRelevante);
    const usados = new Set<string>();
    for (let i = 0; i < abonos.length; i++) {
      if (usados.has(abonos[i].id)) continue;
      const grupo = abonos.filter(a => !usados.has(a.id) && a.fecha >= abonos[i].fecha && a.fecha.getTime() - abonos[i].fecha.getTime() <= VENTANA);
      const suma = grupo.reduce((s, a) => s + a.monto, 0);
      if (grupo.length >= 3 && suma >= umbralRelevante) {
        grupo.forEach(a => usados.add(a.id));
        const m0 = grupo[0];
        out.push({
          clave: `R3:${grupo.map(g => g.id).join('+')}`, regla: 'R3', nombreRegla: NOMBRE_REGLA.R3, tipoAlerta: 'Inusual',
          clienteId: m0.clienteId, cliente: m0.cliente, rfc: m0.rfc, monto: suma, fecha: grupo[grupo.length - 1].fecha,
          movimientos: grupo.map(g => g.id),
          descripcion: `${grupo.length} abonos entre ${fechaCorta(grupo[0].fecha)} y ${fechaCorta(grupo[grupo.length - 1].fecha)}, cada uno bajo el umbral relevante, suman ${dinero(suma)} (umbral ${dinero(umbralRelevante)}).`,
        });
      }
    }
  }

  // R4 — desviación del promedio mensual (requiere al menos 2 meses previos)
  const mesDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const mesActual = mesDe(ahora);
  for (const movs of porCliente.values()) {
    const porMes = new Map<string, number>();
    for (const m of movs) porMes.set(mesDe(m.fecha), (porMes.get(mesDe(m.fecha)) || 0) + m.monto);
    const previos = [...porMes.entries()].filter(([k]) => k < mesActual).map(([, v]) => v);
    const actual = porMes.get(mesActual) || 0;
    if (previos.length >= 2 && actual > 0) {
      const promedio = previos.reduce((s, v) => s + v, 0) / previos.length;
      const limite = promedio * (1 + p.porcentajeDesviacion / 100);
      if (actual > limite) {
        const m0 = movs[0];
        out.push({
          clave: `R4:${m0.clienteId}:${mesActual}`, regla: 'R4', nombreRegla: NOMBRE_REGLA.R4, tipoAlerta: 'Inusual',
          clienteId: m0.clienteId, cliente: m0.cliente, rfc: m0.rfc, monto: actual, fecha: ahora,
          movimientos: movs.filter(m => mesDe(m.fecha) === mesActual).map(m => m.id),
          descripcion: `Operado en ${mesActual}: ${dinero(actual)}; promedio de ${previos.length} meses previos ${dinero(promedio)} (+${Math.round((actual / promedio - 1) * 100)}%, límite +${p.porcentajeDesviacion}%).`,
        });
      }
    }
  }

  // R5 — personas con coincidencia en listas
  for (const x of personasEnListas) {
    out.push({
      clave: `R5:${x.clienteId}:${x.estatus}`, regla: 'R5', nombreRegla: NOMBRE_REGLA.R5,
      tipoAlerta: x.estatus === 'POSITIVO' ? 'Preocupante' : 'Inusual',
      clienteId: x.clienteId, cliente: x.cliente, rfc: x.rfc, monto: 0, fecha: ahora, movimientos: [],
      descripcion: `Verificación PLD con estatus ${x.estatus}${x.detalle ? `: ${x.detalle}` : ''}.`,
    });
  }

  return out.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
}

/** Personas con verificación PLD POSITIVO o EN REVISIÓN (datos de Personas / Tipo Interlocutor). */
export function personasConCoincidencias(filasClientes: any[]): PersonaListas[] {
  const out: PersonaListas[] = [];
  for (const r of filasClientes) {
    const d = repararDataSolicitud(r?.data);
    const def = d?.default || {};
    const estatus = String(d?.estatusListaNegra || def?.estatusListaNegra || '').toUpperCase();
    if (!estatus.includes('POSITIVO') && !estatus.includes('REVISI')) continue;
    const lista = (Array.isArray(d?.listasNegras) ? d.listasNegras : []).filter((l: any) => /POSITIVO|COINCIDENCIA/i.test(String(l?.estatus || '')));
    const nombre = d?.denominacionRazonSocial || d?.razonSocial
      || [d?.nombre, d?.apellidoPaterno, d?.apellidoMaterno].filter(Boolean).join(' ') || 'Sin nombre';
    out.push({
      clienteId: String(r.id),
      cliente: String(nombre),
      rfc: String(d?.rfc || def?.rfc || ''),
      estatus: estatus.includes('POSITIVO') ? 'POSITIVO' : 'EN REVISIÓN',
      detalle: lista.map((l: any) => l.nombreLista).filter(Boolean).slice(0, 3).join(', '),
    });
  }
  return out;
}

/** Marca que se guarda en la descripción de la alerta para no volver a proponerla. */
export const marcaClave = (clave: string) => `[ref:${clave}]`;
