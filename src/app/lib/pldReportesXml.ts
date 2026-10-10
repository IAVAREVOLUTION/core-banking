/**
 * Reportes PLD en XML (descarga individual o por periodo).
 *
 * Estructura institucional del CORE: encabezado del sujeto obligado, periodo,
 * tipo de reporte y una operación por registro con los datos completos de la
 * persona (nombre, RFC, CURP, personalidad). Sirve como insumo para la carga
 * en el sistema de la autoridad; no sustituye el formato oficial vigente.
 */

export interface PersonaReporte { nombre: string; rfc?: string; curp?: string; personalidad?: string; sucursal?: string }

export interface OperacionReporte {
  folio: string;
  fecha: string;          // dd/mm/aaaa o ISO
  tipo: string;           // Operación Relevante | Inusual | Interna Preocupante | 24 horas
  persona: PersonaReporte;
  monto: number;
  moneda?: string;
  estatus?: string;
  descripcion?: string;
}

export interface EncabezadoReporte {
  sujetoObligado: string;
  organoSupervisor: string;
  usuario: string;
  periodoInicio?: string;
  periodoFin?: string;
}

const esc = (v: unknown) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** dd/mm/aaaa → aaaa-mm-dd (ISO); ISO se deja igual. */
export function fechaISO(v: string): string {
  const s = String(v || '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s.slice(0, 10);
}

export const montoNumero = (v: unknown) => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** Clave del tipo de reporte y su periodicidad. */
export function claveTipo(tipo: string): { clave: string; periodicidad: string } {
  const t = tipo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (t.includes('relevante')) return { clave: 'RELEVANTE', periodicidad: 'Trimestral' };
  if (t.includes('preocupante') || t.includes('interna')) return { clave: 'INTERNA_PREOCUPANTE', periodicidad: 'Por evento' };
  if (t.includes('24')) return { clave: 'VEINTICUATRO_HORAS', periodicidad: 'Por evento' };
  return { clave: 'INUSUAL', periodicidad: 'Por evento' };
}

const tipoPersona = (p?: string) => (/moral/i.test(p || '') ? 'PM' : 'PF');

export function generarXmlReporte(ops: OperacionReporte[], enc: EncabezadoReporte, generado: Date = new Date()): string {
  const tipos = [...new Set(ops.map(o => claveTipo(o.tipo).clave))];
  const total = ops.reduce((s, o) => s + (o.monto || 0), 0);
  const operaciones = ops.map((o, i) => {
    const { clave } = claveTipo(o.tipo);
    const p = o.persona;
    return `    <Operacion consecutivo="${i + 1}">
      <Folio>${esc(o.folio)}</Folio>
      <TipoReporte>${clave}</TipoReporte>
      <FechaOperacion>${esc(fechaISO(o.fecha))}</FechaOperacion>
      <Monto moneda="${esc(o.moneda || 'MXN')}">${(o.monto || 0).toFixed(2)}</Monto>
      <Persona tipo="${tipoPersona(p.personalidad)}">
        <Nombre>${esc(p.nombre)}</Nombre>
        <RFC>${esc(p.rfc || '')}</RFC>${tipoPersona(p.personalidad) === 'PF' ? `\n        <CURP>${esc(p.curp || '')}</CURP>` : ''}
        <Sucursal>${esc(p.sucursal || '')}</Sucursal>
      </Persona>
      <Estatus>${esc(o.estatus || '')}</Estatus>${o.descripcion ? `\n      <Descripcion>${esc(o.descripcion)}</Descripcion>` : ''}
    </Operacion>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ReportePLD version="1.0">
  <Encabezado>
    <SujetoObligado>${esc(enc.sujetoObligado)}</SujetoObligado>
    <OrganoSupervisor>${esc(enc.organoSupervisor)}</OrganoSupervisor>
    <TiposReporte>${tipos.join(',')}</TiposReporte>${enc.periodoInicio ? `\n    <PeriodoInicio>${esc(fechaISO(enc.periodoInicio))}</PeriodoInicio>` : ''}${enc.periodoFin ? `\n    <PeriodoFin>${esc(fechaISO(enc.periodoFin))}</PeriodoFin>` : ''}
    <FechaGeneracion>${generado.toISOString()}</FechaGeneracion>
    <GeneradoPor>${esc(enc.usuario)}</GeneradoPor>
    <TotalOperaciones>${ops.length}</TotalOperaciones>
    <MontoTotal moneda="MXN">${total.toFixed(2)}</MontoTotal>
  </Encabezado>
  <Operaciones>
${operaciones}
  </Operaciones>
</ReportePLD>
`;
}

export function descargarXml(nombreArchivo: string, xml: string) {
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo.endsWith('.xml') ? nombreArchivo : `${nombreArchivo}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Trimestre (1–4) y su rango para el reporte de operaciones relevantes. */
export function trimestre(fecha: Date): { anio: number; numero: number; inicio: Date; fin: Date } {
  const numero = Math.floor(fecha.getMonth() / 3) + 1;
  const inicio = new Date(fecha.getFullYear(), (numero - 1) * 3, 1);
  const fin = new Date(fecha.getFullYear(), numero * 3, 0);
  return { anio: fecha.getFullYear(), numero, inicio, fin };
}
