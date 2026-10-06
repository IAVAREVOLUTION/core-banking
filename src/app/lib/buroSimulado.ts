/**
 * Simulador de consulta a Buró de Crédito (ambiente de pruebas).
 *
 * No hay conexión real con la SIC: el reporte se genera de forma
 * determinística a partir del RFC, así que la misma persona obtiene
 * siempre el mismo historial (como en un buró real) y personas
 * distintas obtienen perfiles distintos: sin historial, buen pagador,
 * atrasos leves o atrasos graves.
 *
 * El resultado sigue la regla CORE ya existente:
 *   NEGATIVO = sin registros negativos (apto para activar)
 *   POSITIVO = con registros negativos
 */

export type TipoPersonaBuro = 'PF' | 'PM';
export type ResultadoBuro = 'NEGATIVO' | 'POSITIVO';

export interface DatosConsultaBuro {
  tipoPersona: TipoPersonaBuro;
  rfc: string;
  /** PF: nombre(s) y apellidos; PM: razón social. */
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  razonSocial?: string;
  curp?: string;
  fechaNacimiento?: string;
  direccion?: string;
}

export interface AutorizacionBuro {
  medio: 'Firma autógrafa' | 'Firma electrónica avanzada' | 'NIP';
  fecha: string; // ISO yyyy-mm-dd
}

export interface CuentaBuro {
  otorgante: string;
  tipoCuenta: 'Revolvente' | 'Pagos fijos' | 'Hipoteca' | 'Sin límite preestablecido';
  tipoCredito: string;
  fechaApertura: string;
  fechaUltimoPago: string;
  fechaCierre?: string;
  limite: number;
  saldoActual: number;
  saldoVencido: number;
  /** Manera de pago actual (01 al corriente … 97 quebranto). */
  mop: string;
  /** Últimos 24 meses, el más reciente primero. 1 = al corriente, 2..7 = atraso, - = sin información. */
  historico: string;
}

export interface ConsultaPreviaBuro {
  fecha: string;
  otorgante: string;
  tipoCredito: string;
  importe: number;
}

export interface ReporteBuro {
  version: 1;
  simulado: true;
  folio: string;
  fechaConsulta: string; // ISO
  tipoPersona: TipoPersonaBuro;
  producto: string;
  consultado: { nombre: string; rfc: string; curp?: string; fechaNacimiento?: string; direccion?: string };
  autorizacion: AutorizacionBuro;
  score: {
    nombre: string;
    valor: number | null;
    rango: [number, number];
    nivel: 'Excelente' | 'Bueno' | 'Regular' | 'Bajo' | 'No calculable';
    razones: string[];
  };
  resumen: {
    cuentasAbiertas: number;
    cuentasCerradas: number;
    limiteTotal: number;
    saldoActual: number;
    saldoVencido: number;
    peorMop: string;
    cuentasConAtraso: number;
    consultas12m: number;
  };
  cuentas: CuentaBuro[];
  consultas: ConsultaPreviaBuro[];
  alertas: string[];
  sinHistorial: boolean;
  resultado: ResultadoBuro;
  motivoResultado: string;
}

export const MOP_DESCRIPCION: Record<string, string> = {
  '00': 'Cuenta muy reciente para calificarse',
  '01': 'Al corriente',
  '02': 'Atraso de 1 a 29 días',
  '03': 'Atraso de 30 a 59 días',
  '04': 'Atraso de 60 a 89 días',
  '05': 'Atraso de 90 a 119 días',
  '06': 'Atraso de 120 a 149 días',
  '07': 'Atraso de 150 días o más',
  '96': 'Cuenta con monto pendiente al cierre',
  '97': 'Cuenta con quebranto',
};

// ─── Validación ──────────────────────────────────────────────────────────────

const RFC_PF = /^[A-ZÑ&0-9]{13}$/;
const RFC_PM = /^[A-ZÑ&0-9]{12}$/;

/** Datos mínimos que exige el buró para localizar el expediente. */
export function validarDatosConsulta(d: DatosConsultaBuro): string[] {
  const faltan: string[] = [];
  const rfc = (d.rfc || '').trim().toUpperCase();
  if (!rfc) faltan.push('RFC');
  else if (!(d.tipoPersona === 'PM' ? RFC_PM : RFC_PF).test(rfc)) {
    faltan.push(d.tipoPersona === 'PM' ? `RFC de persona moral de 12 caracteres (tiene ${rfc.length})` : `RFC de persona física de 13 caracteres (tiene ${rfc.length})`);
  }
  if (d.tipoPersona === 'PM') {
    if (!d.razonSocial?.trim()) faltan.push('Razón social');
  } else {
    if (!d.nombre?.trim()) faltan.push('Nombre');
    if (!d.apellidoPaterno?.trim()) faltan.push('Apellido paterno');
    if (!d.fechaNacimiento?.trim()) faltan.push('Fecha de nacimiento');
  }
  if (!d.direccion?.trim()) faltan.push('Domicilio');
  return faltan;
}

// ─── Generador determinístico ───────────────────────────────────────────────

function semilla(texto: string): number {
  // FNV-1a de 32 bits
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function generador(seed: number) {
  let a = seed || 1;
  // mulberry32
  const sig = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    sig,
    entero: (min: number, max: number) => Math.floor(sig() * (max - min + 1)) + min,
    elegir: <T,>(xs: readonly T[]): T => xs[Math.floor(sig() * xs.length)],
    redondear: (n: number, a = 100) => Math.round(n / a) * a,
  };
}

const OTORGANTES_PF: readonly string[] = ['BANCO', 'BANCO', 'BANCO', 'TIENDA DEPARTAMENTAL', 'SOFOM E.R.', 'SOFOM E.N.R.', 'COMPAÑÍA TELEFÓNICA', 'AUTOFINANCIAMIENTO', 'UNIÓN DE CRÉDITO'] as const;
const OTORGANTES_PM: readonly string[] = ['BANCO', 'BANCO', 'BANCO DE DESARROLLO', 'ARRENDADORA FINANCIERA', 'SOFOM E.N.R.', 'UNIÓN DE CRÉDITO', 'EMPRESA DE FACTORAJE'] as const;

interface ProductoBuro { tipoCredito: string; tipoCuenta: CuentaBuro['tipoCuenta']; min: number; max: number }

const PRODUCTOS_PF: readonly ProductoBuro[] = [
  { tipoCredito: 'Tarjeta de crédito', tipoCuenta: 'Revolvente', min: 8_000, max: 120_000 },
  { tipoCredito: 'Tarjeta de crédito', tipoCuenta: 'Revolvente', min: 5_000, max: 60_000 },
  { tipoCredito: 'Préstamo personal', tipoCuenta: 'Pagos fijos', min: 20_000, max: 250_000 },
  { tipoCredito: 'Crédito de nómina', tipoCuenta: 'Pagos fijos', min: 15_000, max: 180_000 },
  { tipoCredito: 'Crédito automotriz', tipoCuenta: 'Pagos fijos', min: 150_000, max: 650_000 },
  { tipoCredito: 'Crédito hipotecario', tipoCuenta: 'Hipoteca', min: 800_000, max: 4_500_000 },
  { tipoCredito: 'Servicio de telefonía', tipoCuenta: 'Sin límite preestablecido', min: 0, max: 0 },
];

const PRODUCTOS_PM: readonly ProductoBuro[] = [
  { tipoCredito: 'Línea de crédito revolvente', tipoCuenta: 'Revolvente', min: 2_000_000, max: 60_000_000 },
  { tipoCredito: 'Crédito simple', tipoCuenta: 'Pagos fijos', min: 5_000_000, max: 250_000_000 },
  { tipoCredito: 'Arrendamiento financiero', tipoCuenta: 'Pagos fijos', min: 1_000_000, max: 40_000_000 },
  { tipoCredito: 'Factoraje', tipoCuenta: 'Revolvente', min: 1_000_000, max: 30_000_000 },
  { tipoCredito: 'Crédito refaccionario', tipoCuenta: 'Pagos fijos', min: 3_000_000, max: 80_000_000 },
  { tipoCredito: 'Crédito de habilitación o avío', tipoCuenta: 'Pagos fijos', min: 2_000_000, max: 50_000_000 },
];

type Perfil = 'sinHistorial' | 'bueno' | 'leve' | 'grave';

function fechaISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function mesesAtras(base: Date, meses: number, dia = 1): Date {
  return new Date(base.getFullYear(), base.getMonth() - meses, Math.min(dia, 28));
}

/** Construye un histórico de 24 meses a partir del perfil (más reciente primero). */
function historico(rng: ReturnType<typeof generador>, perfil: Perfil, mesesVida: number, atrasoActual: number): string {
  const n = Math.min(24, Math.max(1, mesesVida));
  const xs: string[] = [];
  for (let i = 0; i < n; i++) {
    let v = 1;
    if (perfil === 'leve' && rng.sig() < 0.12) v = 2;
    if (perfil === 'grave') {
      const r = rng.sig();
      v = r < 0.15 ? 2 : r < 0.25 ? 3 : r < 0.3 ? 4 : 1;
    }
    xs.push(String(v));
  }
  if (atrasoActual > 1) xs[0] = String(atrasoActual);
  return xs.join('') + '-'.repeat(24 - n);
}

export function generarReporteBuro(
  datos: DatosConsultaBuro,
  autorizacion: AutorizacionBuro,
  ahora: Date = new Date(),
): ReporteBuro {
  const pm = datos.tipoPersona === 'PM';
  const rfc = datos.rfc.trim().toUpperCase();
  const rng = generador(semilla(rfc));
  // Las consultas previas dependen también del día, para que no sean idénticas siempre.
  const rngDia = generador(semilla(rfc + fechaISO(ahora)));

  const tirada = rng.sig();
  const perfil: Perfil = tirada < 0.08 ? 'sinHistorial' : tirada < 0.68 ? 'bueno' : tirada < 0.88 ? 'leve' : 'grave';

  const catalogo = pm ? PRODUCTOS_PM : PRODUCTOS_PF;
  const otorgantes = pm ? OTORGANTES_PM : OTORGANTES_PF;
  const cuentas: CuentaBuro[] = [];

  if (perfil !== 'sinHistorial') {
    const total = pm ? rng.entero(2, 7) : rng.entero(2, 9);
    for (let i = 0; i < total; i++) {
      const prod = rng.elegir(catalogo);
      const antig = rng.entero(4, 96); // meses
      const apertura = mesesAtras(ahora, antig, rng.entero(1, 28));
      const cerrada = antig > 18 && rng.sig() < 0.35;
      const sinLimite = prod.tipoCuenta === 'Sin límite preestablecido';
      const limite = sinLimite ? 0 : rng.redondear(rng.entero(prod.min, prod.max), pm ? 10_000 : 500);
      const uso = prod.tipoCuenta === 'Revolvente' ? rng.sig() * (perfil === 'bueno' ? 0.6 : 0.95) : Math.max(0, 1 - antig / 120);
      let saldo = cerrada ? 0 : sinLimite ? rng.redondear(rng.entero(300, 1_500), 10) : rng.redondear(limite * uso, pm ? 1_000 : 100);

      // Atraso actual según perfil (sólo cuentas abiertas)
      let atraso = 1;
      if (!cerrada && perfil === 'leve' && rng.sig() < 0.35) atraso = 2;
      if (!cerrada && perfil === 'grave' && rng.sig() < 0.55) atraso = rng.elegir([3, 4, 5, 7]);
      let mop = '0' + atraso;
      if (antig <= 4) mop = '00';
      if (cerrada && perfil === 'grave' && rng.sig() < 0.25) { mop = '97'; saldo = 0; }

      const vencido = atraso > 1 && !cerrada ? rng.redondear(saldo * Math.min(0.9, 0.05 * atraso + rng.sig() * 0.1), pm ? 1_000 : 10) : 0;
      const ultimoPago = cerrada ? mesesAtras(ahora, rng.entero(3, 18), 15) : mesesAtras(ahora, atraso > 2 ? atraso - 1 : 0, rng.entero(1, 28));

      cuentas.push({
        otorgante: rng.elegir(otorgantes),
        tipoCuenta: prod.tipoCuenta,
        tipoCredito: prod.tipoCredito,
        fechaApertura: fechaISO(apertura),
        fechaUltimoPago: fechaISO(ultimoPago),
        fechaCierre: cerrada ? fechaISO(ultimoPago) : undefined,
        limite,
        saldoActual: saldo,
        saldoVencido: vencido,
        mop,
        historico: historico(rng, perfil, cerrada ? Math.max(1, antig - 12) : antig, atraso),
      });
    }
    cuentas.sort((a, b) => (a.fechaCierre ? 1 : 0) - (b.fechaCierre ? 1 : 0) || b.fechaApertura.localeCompare(a.fechaApertura));
  }

  // Consultas de otros otorgantes en los últimos 24 meses
  const nConsultas = perfil === 'sinHistorial' ? rngDia.entero(0, 1) : perfil === 'grave' ? rngDia.entero(4, 11) : rngDia.entero(0, 6);
  const consultas: ConsultaPreviaBuro[] = Array.from({ length: nConsultas }, () => {
    const prod = rngDia.elegir(catalogo);
    const d = new Date(ahora.getTime() - rngDia.entero(3, 720) * 86_400_000);
    return {
      fecha: fechaISO(d),
      otorgante: rngDia.elegir(otorgantes),
      tipoCredito: prod.tipoCredito,
      importe: prod.max ? rngDia.redondear(rngDia.entero(prod.min, prod.max), pm ? 10_000 : 1_000) : 0,
    };
  }).sort((a, b) => b.fecha.localeCompare(a.fecha));

  // Resumen
  const abiertas = cuentas.filter(c => !c.fechaCierre);
  const mopNum = (m: string) => (m === '00' ? 0 : Number(m));
  const peor = cuentas.reduce((p, c) => Math.max(p, mopNum(c.mop), ...c.historico.split('').filter(x => x !== '-').map(Number)), 0);
  const peorMop = peor === 0 ? (cuentas.length ? '01' : '--') : peor >= 96 ? String(peor) : '0' + Math.min(peor, 7);
  const hace12 = fechaISO(mesesAtras(ahora, 12, ahora.getDate()));
  const resumen = {
    cuentasAbiertas: abiertas.length,
    cuentasCerradas: cuentas.length - abiertas.length,
    limiteTotal: abiertas.reduce((s, c) => s + c.limite, 0),
    saldoActual: abiertas.reduce((s, c) => s + c.saldoActual, 0),
    saldoVencido: abiertas.reduce((s, c) => s + c.saldoVencido, 0),
    peorMop,
    cuentasConAtraso: cuentas.filter(c => mopNum(c.mop) >= 2 || /[2-7]/.test(c.historico)).length,
    consultas12m: consultas.filter(c => c.fecha >= hace12).length,
  };

  // Score
  const rango: [number, number] = pm ? [400, 800] : [456, 760];
  const razones: string[] = [];
  let valor: number | null = null;
  if (perfil !== 'sinHistorial' && cuentas.length) {
    const revolv = abiertas.filter(c => c.tipoCuenta === 'Revolvente' && c.limite > 0);
    const util = revolv.length ? revolv.reduce((s, c) => s + c.saldoActual, 0) / revolv.reduce((s, c) => s + c.limite, 0) : 0.3;
    const antigMax = Math.max(...cuentas.map(c => (ahora.getTime() - new Date(c.fechaApertura).getTime()) / (30 * 86_400_000)));
    let s = rango[0] + (rango[1] - rango[0]) * 0.72;
    s -= (peor >= 96 ? 6 : Math.max(0, peor - 1)) * 38;
    s -= Math.max(0, util - 0.3) * 120;
    s -= Math.max(0, resumen.consultas12m - 3) * 9;
    s += Math.min(48, antigMax) * 1.1;
    s += (rng.sig() - 0.5) * 30;
    valor = Math.round(Math.min(rango[1], Math.max(rango[0], s)));

    if (peor >= 3) razones.push('Atrasos de 30 días o más en el historial de pagos');
    else if (peor === 2) razones.push('Atrasos menores a 30 días en el historial de pagos');
    if (util > 0.6) razones.push('Alta utilización de líneas de crédito revolventes');
    if (resumen.consultas12m > 4) razones.push('Número elevado de consultas en los últimos 12 meses');
    if (antigMax < 24) razones.push('Historial crediticio con poca antigüedad');
    if (resumen.saldoVencido > 0) razones.push('Saldo vencido en cuentas abiertas');
    if (!razones.length) razones.push('Buen comportamiento de pago en todas las cuentas');
  } else {
    razones.push('Sin cuentas suficientes para calcular el score');
  }
  const pct = valor === null ? 0 : (valor - rango[0]) / (rango[1] - rango[0]);
  const nivel: ReporteBuro['score']['nivel'] = valor === null ? 'No calculable' : pct >= 0.75 ? 'Excelente' : pct >= 0.55 ? 'Bueno' : pct >= 0.35 ? 'Regular' : 'Bajo';

  // Alertas de prevención (raras)
  const alertas: string[] = [];
  if (rng.sig() < 0.04) alertas.push('El domicilio consultado está asociado a múltiples expedientes');
  if (!pm && datos.curp && datos.curp.trim().length !== 18) alertas.push('La CURP proporcionada no tiene un formato válido');

  // Resultado (regla CORE: NEGATIVO = sin registros negativos)
  const negativos = peor >= 3 || (resumen.saldoVencido > 0 && peor >= 2) || alertas.length > 0;
  const resultado: ResultadoBuro = negativos ? 'POSITIVO' : 'NEGATIVO';
  const motivoResultado = perfil === 'sinHistorial'
    ? 'Sin historial crediticio: no hay registros negativos'
    : negativos
      ? `Registros negativos: peor MOP ${peorMop} (${MOP_DESCRIPCION[peorMop] || 'atraso'})${alertas.length ? ' y alertas de prevención' : ''}`
      : peor === 2
        ? 'Sin registros negativos (atrasos menores a 30 días ya regularizados)'
        : 'Sin registros negativos: cuentas al corriente';

  const nombre = pm
    ? (datos.razonSocial || '').trim().toUpperCase()
    : [datos.nombre, datos.apellidoPaterno, datos.apellidoMaterno].filter(Boolean).join(' ').trim().toUpperCase();

  return {
    version: 1,
    simulado: true,
    folio: String(1_000_000_000 + (semilla(rfc + ahora.toISOString()) % 9_000_000_000)).padStart(10, '0'),
    fechaConsulta: ahora.toISOString(),
    tipoPersona: datos.tipoPersona,
    producto: pm ? 'Reporte de Crédito Empresarial + Score PyME' : 'Reporte de Crédito Especial + BC Score',
    consultado: {
      nombre,
      rfc,
      curp: pm ? undefined : datos.curp?.trim().toUpperCase() || undefined,
      fechaNacimiento: pm ? undefined : datos.fechaNacimiento || undefined,
      direccion: datos.direccion?.trim() || undefined,
    },
    autorizacion,
    score: { nombre: pm ? 'Score PyME' : 'BC Score', valor, rango, nivel, razones },
    resumen,
    cuentas,
    consultas,
    alertas,
    sinHistorial: perfil === 'sinHistorial',
    resultado,
    motivoResultado,
  };
}

// ─── Exportación XML ─────────────────────────────────────────────────────────

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function reporteBuroAXml(r: ReporteBuro): string {
  const cuentas = r.cuentas.map(c => `    <Cuenta>
      <Otorgante>${esc(c.otorgante)}</Otorgante>
      <TipoCuenta>${esc(c.tipoCuenta)}</TipoCuenta>
      <TipoCredito>${esc(c.tipoCredito)}</TipoCredito>
      <FechaApertura>${c.fechaApertura}</FechaApertura>
      <FechaUltimoPago>${c.fechaUltimoPago}</FechaUltimoPago>${c.fechaCierre ? `\n      <FechaCierre>${c.fechaCierre}</FechaCierre>` : ''}
      <LimiteCredito>${c.limite.toFixed(2)}</LimiteCredito>
      <SaldoActual>${c.saldoActual.toFixed(2)}</SaldoActual>
      <SaldoVencido>${c.saldoVencido.toFixed(2)}</SaldoVencido>
      <MOP>${c.mop}</MOP>
      <HistoricoPagos>${c.historico}</HistoricoPagos>
    </Cuenta>`).join('\n');
  const consultas = r.consultas.map(c => `    <Consulta>
      <Fecha>${c.fecha}</Fecha>
      <Otorgante>${esc(c.otorgante)}</Otorgante>
      <TipoCredito>${esc(c.tipoCredito)}</TipoCredito>
      <Importe>${c.importe.toFixed(2)}</Importe>
    </Consulta>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ReporteBuro version="${r.version}">
  <Encabezado>
    <Folio>${r.folio}</Folio>
    <FechaConsulta>${r.fechaConsulta}</FechaConsulta>
    <TipoPersona>${r.tipoPersona}</TipoPersona>
    <Producto>${esc(r.producto)}</Producto>
    <Autorizacion medio="${esc(r.autorizacion.medio)}" fecha="${r.autorizacion.fecha}"/>
  </Encabezado>
  <Consultado>
    <Nombre>${esc(r.consultado.nombre)}</Nombre>
    <RFC>${esc(r.consultado.rfc)}</RFC>${r.consultado.curp ? `\n    <CURP>${esc(r.consultado.curp)}</CURP>` : ''}${r.consultado.fechaNacimiento ? `\n    <FechaNacimiento>${esc(r.consultado.fechaNacimiento)}</FechaNacimiento>` : ''}${r.consultado.direccion ? `\n    <Domicilio>${esc(r.consultado.direccion)}</Domicilio>` : ''}
  </Consultado>
  <Score nombre="${esc(r.score.nombre)}" rangoMin="${r.score.rango[0]}" rangoMax="${r.score.rango[1]}">
    <Valor>${r.score.valor ?? 'NO CALCULABLE'}</Valor>
    <Nivel>${r.score.nivel}</Nivel>
${r.score.razones.map(x => `    <Razon>${esc(x)}</Razon>`).join('\n')}
  </Score>
  <Resumen>
    <CuentasAbiertas>${r.resumen.cuentasAbiertas}</CuentasAbiertas>
    <CuentasCerradas>${r.resumen.cuentasCerradas}</CuentasCerradas>
    <LimiteTotal>${r.resumen.limiteTotal.toFixed(2)}</LimiteTotal>
    <SaldoActual>${r.resumen.saldoActual.toFixed(2)}</SaldoActual>
    <SaldoVencido>${r.resumen.saldoVencido.toFixed(2)}</SaldoVencido>
    <PeorMOP>${r.resumen.peorMop}</PeorMOP>
    <ConsultasUltimos12Meses>${r.resumen.consultas12m}</ConsultasUltimos12Meses>
  </Resumen>
  <Cuentas>
${cuentas}
  </Cuentas>
  <Consultas>
${consultas}
  </Consultas>
  <Alertas>${r.alertas.map(a => `\n    <Alerta>${esc(a)}</Alerta>`).join('')}
  </Alertas>
  <Resultado estatus="${r.resultado}">${esc(r.motivoResultado)}</Resultado>
</ReporteBuro>`;
}

/** Simula la latencia de la SIC (1.5–3 s) y devuelve el reporte. */
export async function consultarBuroSimulado(
  datos: DatosConsultaBuro,
  autorizacion: AutorizacionBuro,
  alAvanzar?: (paso: string) => void,
): Promise<ReporteBuro> {
  const pausa = (ms: number) => new Promise(r => setTimeout(r, ms));
  alAvanzar?.('Conectando con la Sociedad de Información Crediticia…');
  await pausa(500 + Math.random() * 400);
  alAvanzar?.('Validando autorización y datos del consultado…');
  await pausa(500 + Math.random() * 500);
  alAvanzar?.('Recibiendo reporte de crédito…');
  await pausa(500 + Math.random() * 800);
  return generarReporteBuro(datos, autorizacion);
}
