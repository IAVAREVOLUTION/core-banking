/**
 * REQ-13 — Detonación Contable y Traspaso a Cartera (Fin del BPM).
 *
 * Al completar la última fase de una Solicitud de Garantía Financiera 2o Piso, genera
 * el folio oficial de garantía en cartera y la póliza contable de apertura, usando el
 * mecanismo REAL ya existente del módulo Pólizas Contables (`gl-journal` /
 * `J_GL_JOURNAL_ENCABEZADO`) — no se inventa infraestructura nueva, sólo se llama
 * automáticamente lo que hoy sólo se captura a mano desde PolizaContableForm.tsx.
 *
 * REQ-16 — esa póliza deja de ser un asiento global sin desglose. Si el producto tiene
 * capturada la guía contabilizadora `APERTURA_LINEA` en su subtab Motor Contable, el
 * detalle se arma desde esa guía: cada fila aporta dos partidas (débito y crédito sobre
 * sus cuentas GL) y el importe sale de los **Cargos de la Solicitud** que REQ-15 generó
 * en Fase 4 — el puente es el componente contable, que ambos toman del mismo catálogo.
 * Sin guía configurada se conserva exactamente el comportamiento anterior.
 *
 * Pendiente de negocio (REQ-13 §Decisión #2): `account_id` en `J_GL_JOURNAL_ENCABEZADO`
 * es UUID CON LLAVE FORÁNEA a `J_CUENTAS_CORP_CLIENTES` — no admite un código de cuenta
 * contable legible ni un UUID inventado (verificado: un UUID nulo revienta con
 * `J_GL_JOURNAL_ENCABEZADO_account_id_fkey`). Mientras Contabilidad no confirme la
 * cuenta de "cuentas de orden" que corresponde a garantías GPO contingentes, se apunta
 * a una fila que sí existe: la cuenta creada para esta Solicitud si la hay, y si no, la
 * propia Solicitud (que vive en esa misma tabla). La aclaración de que es provisional
 * viaja en `data.nota`, porque la columna en sí no admite texto. Las cuentas GL reales
 * de la guía viven en el detalle, así que REQ-16 convive con este pendiente sin
 * agravarlo.
 */
import { GL_JOURNAL_URL, GL_HEADERS } from './usePolizasContablesDB';

export const EVENT_CODE_APERTURA_GARANTIA_GPO = 'APERTURA_GARANTIA_GPO';
/** REQ-16 — guía contabilizadora que se busca en el Motor Contable del producto. */
export const EVENT_CODE_APERTURA_LINEA = 'APERTURA_LINEA';

/** `GPO-{AAAA}-####` — folio no correlativo (sin tabla de contador dedicada, ver REQ-13 §Decisión #4). */
export function generarIdGarantiaCartera(): string {
  const anio = new Date().getFullYear();
  const secuencial = String(Math.floor(Math.random() * 9000) + 1000);
  return `GPO-${anio}-${secuencial}`;
}

/** `POL-CONT-#####` — folio legible para mostrar en pantalla; el id real de la fila vive en `data.folio_display`. */
function generarFolioPolizaDisplay(): string {
  const rand = String(Math.floor(Math.random() * 90000) + 10000);
  return `POL-CONT-${rand}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// REQ-16 — Guía contabilizadora → partidas de la póliza
// ─────────────────────────────────────────────────────────────────────────────

const norm = (v: unknown) =>
  String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Partida del tab Detalle de la póliza. Mismo shape que captura a mano
 * `PolizaContableForm` (`data.Detalle`), para que el módulo Pólizas Contables la lea
 * sin ningún cambio: aquí `debito`/`credito` son IMPORTES y la cuenta va aparte.
 */
export interface PartidaPoliza {
  cuenta_contable_id: string;
  cuenta_contable_gl: string;
  cuenta_contable_nombre: string;
  debito: string;
  credito: string;
  componente_id: string;
  componente_codigo: string;
  componente_nombre: string;
}

/** Cargo de la Solicitud reducido a lo que la póliza necesita (REQ-15). */
export interface CargoParaPoliza {
  tipoCargo: string;
  monto: number;
}

/**
 * Filas del Motor Contable del producto que pertenecen a una guía.
 *
 * En el Motor Contable `debito` y `credito` son CUENTAS del catálogo
 * (`{ id, cuenta_gl, nombre }`), no importes; `evento` es `{ id, codigo, evento }`.
 * Se compara contra `codigo` y contra el nombre del evento, sin acentos, porque el
 * catálogo lo captura el usuario.
 */
export function leerGuiaContabilizadora(
  motorContable: any[] | undefined | null,
  evento: string = EVENT_CODE_APERTURA_LINEA,
): any[] {
  if (!Array.isArray(motorContable)) return [];
  const buscado = norm(evento);
  return motorContable.filter(fila => {
    const ev = fila?.evento;
    if (!ev) return false;
    return norm(ev.codigo) === buscado || norm(ev.evento) === buscado || norm(ev.nombre) === buscado;
  });
}

export interface DetallePolizaArmado {
  detalle: PartidaPoliza[];
  totalDebito: number;
  totalCredito: number;
  /** Componentes de la guía que no tienen Cargo con importe en la Solicitud. */
  componentesSinCargo: string[];
}

/**
 * Cruza la guía con los Cargos de la Solicitud por componente contable.
 *
 * Cada fila de la guía con importe produce DOS partidas: el débito sobre su cuenta de
 * débito y el crédito sobre la de crédito. Una fila sin Cargo que la respalde se omite
 * (una partida en cero no aporta nada al asiento) y se reporta al llamador.
 */
export function construirDetallePoliza(
  guia: any[],
  cargos: CargoParaPoliza[],
): DetallePolizaArmado {
  const importePorComponente = new Map<string, number>();
  for (const c of cargos || []) {
    const clave = norm(c?.tipoCargo);
    if (!clave) continue;
    importePorComponente.set(clave, (importePorComponente.get(clave) || 0) + (Number(c?.monto) || 0));
  }

  const detalle: PartidaPoliza[] = [];
  const componentesSinCargo: string[] = [];
  let totalDebito = 0;
  let totalCredito = 0;

  for (const fila of guia) {
    const comp = fila?.componente || {};
    const importe =
      importePorComponente.get(norm(comp.nombre)) ??
      importePorComponente.get(norm(comp.codigo)) ??
      0;

    if (!(importe > 0)) {
      componentesSinCargo.push(String(comp.nombre || comp.codigo || '—'));
      continue;
    }

    const identidadComponente = {
      componente_id: String(comp.id || ''),
      componente_codigo: String(comp.codigo || ''),
      componente_nombre: String(comp.nombre || ''),
    };
    const ctaDebito = fila?.debito || {};
    const ctaCredito = fila?.credito || {};

    detalle.push({
      cuenta_contable_id: String(ctaDebito.id || ''),
      cuenta_contable_gl: String(ctaDebito.cuenta_gl || ''),
      cuenta_contable_nombre: String(ctaDebito.nombre || ''),
      debito: importe.toFixed(2),
      credito: '',
      ...identidadComponente,
    });
    detalle.push({
      cuenta_contable_id: String(ctaCredito.id || ''),
      cuenta_contable_gl: String(ctaCredito.cuenta_gl || ''),
      cuenta_contable_nombre: String(ctaCredito.nombre || ''),
      debito: '',
      credito: importe.toFixed(2),
      ...identidadComponente,
    });

    totalDebito += importe;
    totalCredito += importe;
  }

  return { detalle, totalDebito, totalCredito, componentesSinCargo };
}

export interface DatosFormalizacionGPO {
  solicitudId: string;
  noSol: string;
  productoId: string;
  montoGarantizado: number;
  /** `id` de la cuenta ya creada para esta Solicitud (crearCuentaDesdeSolicitudDB) — ver nota de §Decisión #2 arriba. */
  cuentaVinculadaId?: string;
  /** REQ-16 — `data.motorContable` del producto de la Solicitud. */
  motorContable?: any[];
  /** REQ-16 — Cargos de la Solicitud (REQ-15); aportan el importe de cada partida. */
  cargos?: CargoParaPoliza[];
}

export interface ResultadoFormalizacionGPO {
  ok: boolean;
  idGarantiaCartera?: string;
  polizaContableApertura?: string;
  error?: string;
  /** Evento con el que quedó la póliza: la guía si existía, el de REQ-13 si no. */
  eventCode?: string;
  /** Número de partidas del detalle (0 = póliza sin desglose). */
  partidas?: number;
  /** Por qué no se usó la guía, o qué componentes quedaron fuera del detalle. */
  avisoGuia?: string;
}

/**
 * Crea la póliza contable de apertura (POST real a /gl-journal, visible de inmediato
 * en el módulo Pólizas Contables sin cambios ahí) y devuelve los dos folios que pide
 * la pantalla de éxito del requerimiento.
 *
 * RN (REQ-16): es UNA sola póliza. Con guía capturada cambia su contenido —evento,
 * detalle y totales—; sin guía, se mantiene el asiento global de REQ-13. Nunca se
 * emiten dos.
 */
export async function formalizarGarantiaGPO(
  datos: DatosFormalizacionGPO,
): Promise<ResultadoFormalizacionGPO> {
  const idGarantiaCartera = generarIdGarantiaCartera();
  const folioPoliza = generarFolioPolizaDisplay();
  const hoy = new Date().toISOString().split('T')[0];

  // ── REQ-16: ¿hay guía APERTURA_LINEA en el Motor Contable del producto? ──
  const guia = leerGuiaContabilizadora(datos.motorContable);
  let eventCode = EVENT_CODE_APERTURA_GARANTIA_GPO;
  let detalle: PartidaPoliza[] = [];
  let totalDebito = datos.montoGarantizado;
  let totalCredito = datos.montoGarantizado;
  let avisoGuia: string | undefined;

  if (guia.length === 0) {
    avisoGuia =
      `El producto no tiene la guía "${EVENT_CODE_APERTURA_LINEA}" en su subtab Motor Contable: ` +
      'la póliza se generó sin desglose por componente.';
  } else {
    const armado = construirDetallePoliza(guia, datos.cargos || []);
    if (armado.detalle.length === 0) {
      avisoGuia =
        `La guía "${EVENT_CODE_APERTURA_LINEA}" existe, pero ningún componente tiene un Cargo con ` +
        'importe en la Solicitud: la póliza se generó sin desglose.';
    } else if (Math.abs(armado.totalDebito - armado.totalCredito) > 0.005) {
      // Un asiento descuadrado en producción es peor que uno ausente.
      return {
        ok: false,
        error:
          `La póliza no cuadra: débito ${armado.totalDebito.toFixed(2)} vs crédito ` +
          `${armado.totalCredito.toFixed(2)}. No se generó.`,
      };
    } else {
      eventCode = EVENT_CODE_APERTURA_LINEA;
      detalle = armado.detalle;
      totalDebito = armado.totalDebito;
      totalCredito = armado.totalCredito;
      if (armado.componentesSinCargo.length > 0) {
        avisoGuia =
          'Componentes de la guía sin Cargo en la Solicitud (omitidos del detalle): ' +
          armado.componentesSinCargo.join(', ') + '.';
      }
    }
  }

  try {
    const res = await fetch(GL_JOURNAL_URL, {
      method: 'POST',
      headers: GL_HEADERS,
      body: JSON.stringify({
        journal_date: hoy,
        producto_id: datos.productoId,
        event_code: eventCode,
        account_id: datos.cuentaVinculadaId || datos.solicitudId,
        currency: 'MXN',
        total_debit: totalDebito,
        total_credit: totalCredito,
        status: 'Creada',
        data: {
          evento: eventCode === EVENT_CODE_APERTURA_LINEA
            ? 'Apertura de Línea — Garantía Financiera 2o Piso'
            : 'Apertura de Garantía Financiera 2o Piso',
          solicitud_id: datos.solicitudId,
          no_sol: datos.noSol,
          id_garantia_cartera: idGarantiaCartera,
          folio_display: folioPoliza,
          nota: 'Cuenta contable provisional — pendiente de confirmar con Contabilidad (REQ-13 §Decisión #2).',
          Detalle: detalle,
        },
      }),
    });
    const json = await res.json().catch(() => ({}) as any);
    if (!res.ok) {
      return { ok: false, error: json?.error || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      idGarantiaCartera,
      polizaContableApertura: folioPoliza,
      eventCode,
      partidas: detalle.length,
      avisoGuia,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
}
