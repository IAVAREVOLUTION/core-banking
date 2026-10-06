/**
 * Verificación PLD contra listas de negocio (generada localmente).
 *
 * Revisa al interlocutor contra las listas que usa una entidad financiera en
 * México. El resultado es determinístico por RFC + nombre: la misma persona
 * obtiene siempre el mismo resultado.
 *
 * Cada lista devuelve:
 *   NEGATIVO     — sin coincidencias
 *   COINCIDENCIA — coincidencia parcial (posible homonimia): un analista debe
 *                  descartarla o confirmarla
 *   POSITIVO     — coincidencia confirmada
 *
 * Estatus general (regla CORE: sólo NEGATIVO permite activar):
 *   POSITIVO si alguna lista es POSITIVO; EN REVISIÓN si queda alguna
 *   coincidencia sin resolver; NEGATIVO en otro caso.
 */

export type TipoPersonaPLD = 'PF' | 'PM';
export type ResultadoLista = 'NEGATIVO' | 'COINCIDENCIA' | 'POSITIVO';
export type EstatusPLD = 'NEGATIVO' | 'POSITIVO' | 'EN REVISIÓN';

export interface ListaPLD {
  clave: string;
  nombre: string;
  tipo: 'Externa' | 'Interna';
  fuente: string;
  /** Riesgo si hay coincidencia confirmada. */
  severidad: 'Bloqueo' | 'Alto riesgo' | 'Riesgo medio';
  /** PEP sólo aplica a personas físicas. */
  soloPF?: boolean;
}

export const LISTAS_PLD: readonly ListaPLD[] = [
  { clave: 'LPB', nombre: 'Lista de Personas Bloqueadas (UIF)', tipo: 'Externa', fuente: 'Unidad de Inteligencia Financiera — SHCP', severidad: 'Bloqueo' },
  { clave: 'OFAC', nombre: 'OFAC — Specially Designated Nationals (SDN)', tipo: 'Externa', fuente: 'U.S. Department of the Treasury', severidad: 'Bloqueo' },
  { clave: 'ONU', nombre: 'Lista Consolidada del Consejo de Seguridad de la ONU', tipo: 'Externa', fuente: 'Naciones Unidas', severidad: 'Bloqueo' },
  { clave: 'SAT69B', nombre: 'SAT Art. 69-B — Operaciones simuladas (EFOS)', tipo: 'Externa', fuente: 'Servicio de Administración Tributaria', severidad: 'Alto riesgo' },
  { clave: 'SAT69', nombre: 'SAT Art. 69 — Contribuyentes incumplidos', tipo: 'Externa', fuente: 'Servicio de Administración Tributaria', severidad: 'Riesgo medio' },
  { clave: 'PEP', nombre: 'Personas Políticamente Expuestas (PEP)', tipo: 'Externa', fuente: 'Proveedor de listas PEP', severidad: 'Alto riesgo', soloPF: true },
  { clave: 'INT', nombre: 'Lista interna de personas no deseadas', tipo: 'Interna', fuente: 'Oficial de Cumplimiento', severidad: 'Bloqueo' },
];

export interface CoincidenciaPLD {
  nombreEnLista: string;
  similitud: number; // %
  motivo: string;
  fechaPublicacion: string; // ISO yyyy-mm-dd
  referencia: string;
}

export interface ResolucionPLD {
  decision: 'Descartada (homonimia)' | 'Confirmada';
  justificacion: string;
  usuario: string;
  fecha: string;
}

/** Un registro por lista revisada (compatible con la tabla anterior: nombreLista / tipoLista / estatus). */
export interface RegistroPLD {
  id: number;
  fechaHora: string;
  usuario: string;
  folio?: string;
  claveLista?: string;
  nombreLista: string;
  tipoLista: string;
  severidad?: ListaPLD['severidad'];
  estatus: string;
  coincidencia?: CoincidenciaPLD;
  resolucion?: ResolucionPLD;
}

export interface DatosPLD {
  tipoPersona: TipoPersonaPLD;
  rfc: string;
  nombre: string; // nombre completo o razón social
}

export function validarDatosPLD(d: DatosPLD): string[] {
  const f: string[] = [];
  if (!d.nombre.trim()) f.push(d.tipoPersona === 'PM' ? 'Razón social' : 'Nombre completo');
  if (!d.rfc.trim()) f.push('RFC');
  return f;
}

// ─── Generador determinístico ───────────────────────────────────────────────

function semilla(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function generador(seed: number) {
  let a = seed || 1;
  const sig = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { sig, entero: (min: number, max: number) => Math.floor(sig() * (max - min + 1)) + min };
}

/** Variante del nombre como aparecería en la lista (homónimo). */
function variante(nombre: string, rng: ReturnType<typeof generador>): string {
  const partes = nombre.toUpperCase().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return nombre.toUpperCase();
  const quitarAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const ops = [
    () => partes.map(quitarAcentos).join(' '),
    () => [...partes.slice(0, -1), partes[partes.length - 1].slice(0, -1) + 'S'].join(' '),
    () => partes.length > 2 ? [partes[0], ...partes.slice(2)].join(' ') : partes.join(' ') + ' A.',
    () => partes.map(p => p.replace(/Z/g, 'S').replace(/V/g, 'B')).join(' '),
  ];
  return ops[rng.entero(0, ops.length - 1)]();
}

const MOTIVOS: Record<string, string[]> = {
  LPB: ['Designación por la UIF conforme a la LFPIORPI', 'Resolución de bloqueo por operaciones con recursos de procedencia ilícita'],
  OFAC: ['Designación SDN — programa de narcóticos (SDNTK)', 'Designación SDN — programa de lavado de dinero'],
  ONU: ['Régimen de sanciones del Consejo de Seguridad'],
  SAT69B: ['Publicación definitiva en DOF como EFOS', 'Presunción de operaciones inexistentes'],
  SAT69: ['Créditos fiscales firmes no pagados', 'Contribuyente no localizado'],
  PEP: ['Cargo público federal en los últimos 5 años', 'Familiar de servidor público de alto nivel'],
  INT: ['Antecedente de fraude con la institución', 'Cliente dado de baja por cumplimiento'],
};

function fechaISO(d: Date) { return d.toISOString().slice(0, 10); }
function fechaHoraMx(d: Date) {
  return d.toLocaleString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * Revisa al interlocutor contra todas las listas aplicables. Devuelve un
 * registro por lista con el mismo folio.
 */
export function verificarListasPLD(datos: DatosPLD, usuario: string, ahora: Date = new Date()): RegistroPLD[] {
  const clave = `${datos.rfc.trim().toUpperCase()}|${datos.nombre.trim().toUpperCase()}`;
  const rng = generador(semilla(clave));
  const tirada = rng.sig();
  // Perfil: 84% limpio · 10% homonimia en una lista · 4% SAT positivo · 2% lista de bloqueo
  const listas = LISTAS_PLD.filter(l => !(l.soloPF && datos.tipoPersona === 'PM'));
  let conCoincidencia: string | null = null;
  let confirmada = false;
  if (tirada >= 0.84 && tirada < 0.94) {
    const candidatas = datos.tipoPersona === 'PF' ? ['PEP', 'OFAC', 'SAT69'] : ['SAT69', 'OFAC', 'SAT69B'];
    conCoincidencia = candidatas[rng.entero(0, candidatas.length - 1)];
  } else if (tirada >= 0.94 && tirada < 0.98) {
    conCoincidencia = rng.sig() < 0.5 ? 'SAT69B' : 'SAT69';
    confirmada = true;
  } else if (tirada >= 0.98) {
    conCoincidencia = 'LPB';
    confirmada = true;
  }

  const folio = `PLD-${ahora.getFullYear()}-${String(semilla(clave + ahora.toISOString()) % 1_000_000).padStart(6, '0')}`;
  const fechaHora = fechaHoraMx(ahora);
  return listas.map((l, i) => {
    const base: RegistroPLD = {
      id: ahora.getTime() + i,
      fechaHora,
      usuario,
      folio,
      claveLista: l.clave,
      nombreLista: l.nombre,
      tipoLista: l.tipo,
      severidad: l.severidad,
      estatus: 'NEGATIVO',
    };
    if (l.clave !== conCoincidencia) return base;
    const motivos = MOTIVOS[l.clave] || ['Coincidencia en lista'];
    const publicacion = new Date(ahora.getTime() - rng.entero(30, 2_500) * 86_400_000);
    return {
      ...base,
      estatus: confirmada ? 'POSITIVO' : 'COINCIDENCIA',
      coincidencia: {
        nombreEnLista: confirmada ? datos.nombre.toUpperCase() : variante(datos.nombre, rng),
        similitud: confirmada ? rng.entero(97, 100) : rng.entero(72, 91),
        motivo: motivos[rng.entero(0, motivos.length - 1)],
        fechaPublicacion: fechaISO(publicacion),
        referencia: `${l.clave}-${rng.entero(10_000, 99_999)}`,
      },
    };
  });
}

/** Estatus general a partir de la verificación más reciente (todas las filas con el último folio). */
export function estatusGeneralPLD(registros: RegistroPLD[]): EstatusPLD | null {
  if (!registros.length) return null;
  const ultimo = registros[registros.length - 1];
  const actuales = ultimo.folio ? registros.filter(r => r.folio === ultimo.folio) : [ultimo];
  const est = actuales.map(r => (r.estatus || '').toUpperCase());
  if (est.some(e => e.includes('POSITIVO'))) return 'POSITIVO';
  if (est.some(e => e.includes('COINCIDENCIA') || e.includes('REVISI'))) return 'EN REVISIÓN';
  if (est.every(e => e.includes('NEGATIVO'))) return 'NEGATIVO';
  return 'EN REVISIÓN';
}

export async function verificarListasPLDConLatencia(
  datos: DatosPLD,
  usuario: string,
  alAvanzar?: (paso: string) => void,
): Promise<RegistroPLD[]> {
  const pausa = (ms: number) => new Promise(r => setTimeout(r, ms));
  alAvanzar?.('Normalizando nombre y RFC…');
  await pausa(400 + Math.random() * 300);
  alAvanzar?.('Revisando listas oficiales (UIF, OFAC, ONU, SAT)…');
  await pausa(700 + Math.random() * 600);
  alAvanzar?.('Revisando PEP y lista interna…');
  await pausa(400 + Math.random() * 400);
  return verificarListasPLD(datos, usuario);
}
