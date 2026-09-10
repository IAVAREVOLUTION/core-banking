/**
 * Derivaciones del Home a partir de datos REALES (J_CLIENTES / J_CUENTAS_CORP_CLIENTES).
 *
 * Regla que gobierna este archivo: **no se inventa nada**. Cada serie que se
 * publica aqui sale de un campo que existe en la base. Donde el sistema todavia
 * no captura el dato (cobranza real vs esperada, calificacion de riesgo,
 * antiguedad de saldos), NO se simula: se publica en su lugar una medida que si
 * es real y responde una pregunta parecida. Por eso las graficas cambiaron de
 * titulo — el titulo describe lo que de verdad se esta midiendo.
 */

export interface SolicitudRealLike {
  id?: any; noSol?: string; nombreCompleto?: string;
  tipoProducto?: string; nombreProducto?: string; fechaSolicitud?: string;
  montoSolicitado?: number; montoAutorizado?: number;
  sucursal?: string; faseDescripcion?: string; estatusSolicitud?: string;
}

export interface ClienteRealLike {
  dbUuid?: string; idCliente?: string; nombreCompleto?: string;
  tipo?: string; personalidad?: string; estatus?: string;
  fechaOriginacion?: string; fechaAlta?: string; sucursal?: string;
}

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

/** Acepta 'DD/MM/YYYY', 'DD/MM/YY' e ISO. Devuelve null si no es fecha. */
export function parseFecha(v: unknown): Date | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const anio = y.length === 2 ? 2000 + Number(y) : Number(y);
    const f = new Date(anio, Number(m) - 1, Number(d));
    return isNaN(f.getTime()) ? null : f;
  }
  const iso = new Date(s);
  return isNaN(iso.getTime()) ? null : iso;
}

export function fechaCorta(v: unknown): string {
  const f = parseFecha(v);
  if (!f) return String(v ?? '') || '—';
  const dd = String(f.getDate()).padStart(2, '0');
  const mm = String(f.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${String(f.getFullYear()).slice(-2)}`;
}

export function money(n: number): string {
  return '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Estatus/fases que ya NO estan en tramite. */
// Verificado contra los 119 registros reales de J_CUENTAS_CORP_CLIENTES:
// Autorizada(61) En proceso(23) Pendiente(7) Vigente(5) Aprobada por CIC(1)
// En Administracion(1) En Analisis(1) Finiquitado(1).
const CERRADAS = ['autorizad', 'liberad', 'cancelad', 'rechazad', 'desembols',
                  'formaliz', 'vigente', 'finiquit', 'administrac'];
export function estaEnTramite(s: SolicitudRealLike): boolean {
  const e = `${s.estatusSolicitud || ''} ${s.faseDescripcion || ''}`.toLowerCase();
  if (!e.trim()) return true;
  return !CERRADAS.some(c => e.includes(c));
}
export function estaColocada(s: SolicitudRealLike): boolean {
  const e = (s.estatusSolicitud || '').toLowerCase();
  return (Number(s.montoAutorizado) || 0) > 0
    && (e.includes('autorizad') || e.includes('liberad') || e.includes('desembols')
        || e.includes('vigente') || e.includes('administrac'));
}

function porFechaDesc<T>(arr: T[], campo: (x: T) => unknown): T[] {
  return [...arr].sort((a, b) => {
    const fa = parseFecha(campo(a))?.getTime() ?? 0;
    const fb = parseFecha(campo(b))?.getTime() ?? 0;
    return fb - fa;
  });
}

export function clientesRecientes(clientes: ClienteRealLike[], n = 5) {
  // Verificado en produccion: hay clientes con fechaOriginacion nula; se cae a fechaAlta.
  return porFechaDesc(clientes || [], c => c.fechaOriginacion || c.fechaAlta).slice(0, n);
}

/** Dias transcurridos desde la solicitud; sirve de senal de atencion REAL. */
export function diasEnTramite(s: SolicitudRealLike, hoy = new Date()): number | null {
  const f = parseFecha(s.fechaSolicitud);
  if (!f) return null;
  return Math.max(0, Math.floor((hoy.getTime() - f.getTime()) / 86400000));
}

/**
 * La "prioridad" NO es un campo capturado: se deriva de la antiguedad. Se
 * declara asi en la interfaz para que nadie la confunda con una clasificacion
 * de riesgo del analista.
 */
export function prioridadPorAntiguedad(dias: number | null): 'Alta' | 'Media' | 'Baja' {
  if (dias == null) return 'Baja';
  if (dias >= 30) return 'Alta';
  if (dias >= 10) return 'Media';
  return 'Baja';
}

export function solicitudesPendientes(sols: SolicitudRealLike[], n = 5) {
  return porFechaDesc((sols || []).filter(estaEnTramite), s => s.fechaSolicitud).slice(0, n);
}

export function creditosRecientes(sols: SolicitudRealLike[], n = 5) {
  return porFechaDesc((sols || []).filter(estaColocada), s => s.fechaSolicitud).slice(0, n);
}

/** Colocacion real: suma de monto autorizado por mes, ultimos `meses`. */
export function serieColocacion(sols: SolicitudRealLike[], meses = 6, hoy = new Date()) {
  const cubos: { mes: string; monto: number; solicitado: number; clave: string }[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    cubos.push({ mes: MESES[d.getMonth()], clave: `${d.getFullYear()}-${d.getMonth()}`, monto: 0, solicitado: 0 });
  }
  const idx = new Map(cubos.map(c => [c.clave, c]));
  for (const s of sols || []) {
    const f = parseFecha(s.fechaSolicitud);
    if (!f) continue;
    const c = idx.get(`${f.getFullYear()}-${f.getMonth()}`);
    if (!c) continue;
    c.monto += Number(s.montoAutorizado) || 0;
    c.solicitado += Number(s.montoSolicitado) || 0;
  }
  return cubos.map(({ mes, monto, solicitado }) => ({ mes, monto, solicitado }));
}

/** Distribucion real por estatus de solicitud (reemplaza la antiguedad simulada). */
const COLORES = ['#2E5C91', '#4A7FB5', '#10B981', '#F59E0B', '#EF4444', '#991B1B', '#6B7280'];
export function distribucionPorEstatus(sols: SolicitudRealLike[]) {
  const cuenta = new Map<string, number>();
  for (const s of sols || []) {
    const k = (s.estatusSolicitud || '').trim() || 'Sin estatus';
    cuenta.set(k, (cuenta.get(k) || 0) + 1);
  }
  const total = (sols || []).length || 1;
  return [...cuenta.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([categoria, n], i) => ({
      categoria, valor: Math.round((n / total) * 100), cantidad: n, color: COLORES[i % COLORES.length],
    }));
}

/** Cartera real por tipo de producto (reemplaza la calificacion de riesgo simulada). */
export function carteraPorProducto(sols: SolicitudRealLike[], n = 5) {
  const suma = new Map<string, number>();
  for (const s of (sols || []).filter(estaColocada)) {
    const k = (s.tipoProducto || s.nombreProducto || '').trim() || 'Sin producto';
    suma.set(k, (suma.get(k) || 0) + (Number(s.montoAutorizado) || 0));
  }
  const total = [...suma.values()].reduce((a, b) => a + b, 0) || 1;
  return [...suma.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([nivel, monto]) => ({ nivel, monto, porcentaje: Math.round((monto / total) * 100) }));
}

/** Evita que un renglon con monto real se lea como 0%. */
export function pct(p: number, monto?: number): string {
  if (p === 0 && (monto || 0) > 0) return '<1%';
  return p + '%';
}

/** Escala legible para el eje de las graficas de monto. */
export function montoEje(n: number): string {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e9) return '$' + (v / 1e9).toFixed(1) + ' MMD';
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1) + ' M';
  if (Math.abs(v) >= 1e3) return '$' + Math.round(v / 1e3) + ' K';
  return '$' + Math.round(v);
}

export interface InsightReal { tipo: 'alerta' | 'tendencia' | 'oportunidad'; titulo: string; descripcion: string; prioridad: string; }

/** Senales calculadas sobre los datos reales; si no hay base, no se emite nada. */
export function insightsReales(sols: SolicitudRealLike[], clientes: ClienteRealLike[], hoy = new Date()): InsightReal[] {
  const out: InsightReal[] = [];

  // El mes en curso puede ir apenas empezado: comparar contra el ultimo mes con
  // movimiento evita el falso "bajo 100%" los primeros dias de cada mes.
  const s3 = serieColocacion(sols, 3, hoy);
  const hayMesEnCurso = s3[2] && s3[2].monto > 0;
  const previo = hayMesEnCurso ? s3[1] : s3[0];
  const actual = hayMesEnCurso ? s3[2] : s3[1];
  if (previo && actual && previo.monto > 0) {
    const varPct = ((actual.monto - previo.monto) / previo.monto) * 100;
    if (Math.abs(varPct) >= 1) {
      const sube = varPct >= 0;
      out.push({
        tipo: sube ? 'tendencia' : 'alerta',
        titulo: sube ? 'Colocacion en crecimiento' : 'Colocacion a la baja',
        // Con bases muy chicas el porcentaje se dispara y deja de informar
        // (600,554 veces es cierto y no dice nada): ahi se reportan las cifras
        // secas, sin pretender que exista una tendencia comparable.
        descripcion: Math.abs(varPct) > 500
          ? actual.mes + ' cerro con ' + money(actual.monto) + ' de monto autorizado, '
            + (sube ? 'muy por encima de ' : 'muy por debajo de ') + previo.mes
            + ' (' + money(previo.monto) + '). Son ordenes de magnitud distintos.'
          : 'El monto autorizado de ' + actual.mes + (sube ? ' subio ' : ' bajo ')
            + Math.abs(varPct).toFixed(0) + '% contra ' + previo.mes
            + ' (' + money(actual.monto) + ' vs ' + money(previo.monto) + ').',
        prioridad: sube ? 'baja' : 'alta',
      });
    }
  }

  const estancadas = (sols || []).filter(function (s) {
    return estaEnTramite(s) && (diasEnTramite(s, hoy) || 0) >= 30;
  });
  if (estancadas.length > 0) {
    const masVieja = Math.max.apply(null, estancadas.map(function (s) { return diasEnTramite(s, hoy) || 0; }));
    out.push({
      tipo: 'alerta',
      titulo: estancadas.length + ' solicitud(es) con mas de 30 dias',
      descripcion: 'Siguen en tramite sin cerrar. La mas antigua lleva ' + masVieja + ' dias.',
      prioridad: 'alta',
    });
  }

  const cartera = carteraPorProducto(sols, 1);
  if (cartera.length > 0 && cartera[0].porcentaje >= 40) {
    out.push({
      tipo: 'oportunidad',
      titulo: 'Concentracion en ' + cartera[0].nivel,
      descripcion: 'Representa el ' + cartera[0].porcentaje + '% de la cartera colocada ('
        + money(cartera[0].monto) + '). Conviene revisar la diversificacion.',
      prioridad: 'media',
    });
  }

  const total = (sols || []).length;
  const colocadas = (sols || []).filter(estaColocada).length;
  if (total >= 5) {
    const tasa = Math.round((colocadas / total) * 100);
    out.push({
      tipo: tasa >= 50 ? 'oportunidad' : 'tendencia',
      titulo: 'Tasa de colocacion ' + tasa + '%',
      descripcion: colocadas + ' de ' + total + ' solicitudes llegaron a monto autorizado. '
        + 'Clientes registrados: ' + (clientes || []).length + '.',
      prioridad: 'baja',
    });
  }

  return out;
}
