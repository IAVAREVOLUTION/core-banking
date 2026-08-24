/**
 * cartaOfertaPDF.ts
 *
 * Generación de la Carta Oferta de una Oportunidad — HU-CRM-10.
 *
 *   CA-02  Toma la plantilla tipo 'carta-oferta' del Producto seleccionado.
 *   CA-03  Inyecta los datos vigentes de la Oportunidad en la plantilla.
 *   CA-06  Sin plantilla configurada, falla con un error explícito.
 *   RN-02  Los valores se leen al momento de generar, no de un caché.
 *
 * Reusa el pipeline HTML→PDF que ya existe para el kit legal de Fase 4
 * (`htmlToPdfBlobUrl`, `decodificarArchivoData`), y la misma convención de
 * subida a Storage con degradación a blob URL local.
 */
import { supabase } from '@/app/lib/supabaseClient';
import { projectId } from '/utils/supabase/info';
import { decodificarArchivoData, htmlToPdfBlobUrl } from '@/app/hooks/generarDocumentosFase4';
import type { PlantillaInstitucional } from '@/app/types/product';
import type { CotizacionCredito } from '../cotizaciones/cotizacionCreditoTypes';

const BUCKET_EXPEDIENTES = 'make-7e2d13d9-expedientes-electronicos-prospectos';

export class CartaOfertaError extends Error {}

const fmtMoney = (v: number) =>
  `$${v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toNum = (v: unknown): number => {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};

/**
 * Placeholders disponibles en la plantilla HTML.
 * Se aceptan las formas {{CLAVE}} y {CLAVE}.
 */
export function construirDatosCartaOferta(o: CotizacionCredito): Record<string, string> {
  const d = o.data as any;

  const montoEmision = toNum(d.montoEmision) || toNum(d.montoInversion) || toNum(d.montoSolicitado);
  const pctCobertura = toNum(d.coberturaGPOPorcentaje);
  const pctComision = toNum(d.comisionGPOPorcentaje);
  const montoGarantizado = montoEmision * (pctCobertura / 100);
  const ingresoAnual = montoGarantizado * (pctComision / 100);

  return {
    ID_OPORTUNIDAD: o.no_cotiza || '',
    FECHA: new Date().toLocaleDateString('es-MX'),
    FECHA_HORA: new Date().toLocaleString('es-MX'),
    ESTATUS: o.estatus_cotiza || '',
    CLIENTE_EMISOR: d.cliente?.nombreCompleto || '',
    CLAVE_CLIENTE: d.cliente?.claveCliente || '',
    INSTITUCION_GOBIERNO: d.institucionGobierno || '',
    SECTOR: d.sectorInfraestructura || '',
    DESCRIPCION_OBRA: d.descripcionObra || '',
    TIPO_FINANCIAMIENTO: d.tipoFinanciamiento || '',
    PRODUCTO: d.producto?.nombreProducto || '',
    MONEDA: d.monedaInversion || d.moneda || 'MXN',
    MONTO_INVERSION: fmtMoney(toNum(d.montoInversion)),
    MONTO_EMISION: fmtMoney(montoEmision),
    PLAZO_BONOS: String(d.plazoBonosAnios ?? ''),
    TASA_BONOS: d.tasaBonosAnios ? `${d.tasaBonosAnios}%` : '',
    PORCENTAJE_COBERTURA_GPO: pctCobertura ? `${pctCobertura}%` : '',
    MONTO_MAXIMO_GARANTIZADO: fmtMoney(montoGarantizado),
    TASA_COMISION_ANUAL: pctComision ? `${pctComision}%` : '',
    PERIODICIDAD_COBRO: d.periodicidadCobroComision || '',
    INGRESO_ANUAL_COMISIONES: fmtMoney(ingresoAnual),
  };
}

/** Sustituye {{CLAVE}} y {CLAVE}. Lo no reconocido se deja intacto. */
export function sustituirPlaceholdersCarta(html: string, datos: Record<string, string>): string {
  let out = html;
  for (const [clave, valor] of Object.entries(datos)) {
    out = out
      .replace(new RegExp(`\\{\\{\\s*${clave}\\s*\\}\\}`, 'g'), valor)
      .replace(new RegExp(`\\{\\s*${clave}\\s*\\}`, 'g'), valor);
  }
  return out;
}

/** CA-02 — plantilla activa tipo 'carta-oferta' del producto. */
export function buscarPlantillaCartaOferta(
  plantillas: PlantillaInstitucional[] | undefined | null,
): PlantillaInstitucional | null {
  if (!Array.isArray(plantillas) || plantillas.length === 0) return null;
  return (
    plantillas.find(p => p.tipoPlantilla === 'carta-oferta' && p.estatus === 'Activo' && p.archivoData) ||
    plantillas.find(p => p.tipoPlantilla === 'carta-oferta' && p.estatus === 'Activo') ||
    null
  );
}

export interface CartaOfertaGenerada {
  /** data URI del PDF — sirve para el visor y para subir a Storage. */
  dataUri: string;
  nombreArchivo: string;
  plantillaNombre: string;
  plantillaVersion: string;
}

/**
 * CA-03 — genera el PDF de la Carta Oferta.
 * @throws CartaOfertaError si no hay plantilla utilizable (CA-06).
 */
export async function generarCartaOferta(
  oportunidad: CotizacionCredito,
  plantillas: PlantillaInstitucional[] | undefined | null,
): Promise<CartaOfertaGenerada> {
  const plantilla = buscarPlantillaCartaOferta(plantillas);

  if (!plantilla) {
    throw new CartaOfertaError(
      'El producto seleccionado no tiene una plantilla de Carta Oferta configurada. ' +
      'Agréguela en Productos → Línea de Crédito → subpestaña Plantillas, con tipo "Carta Oferta" y estatus Activo.',
    );
  }

  if (!plantilla.archivoData) {
    throw new CartaOfertaError(
      `La plantilla "${plantilla.nombre}" está registrada pero no tiene archivo base cargado. ` +
      'Súbalo en la subpestaña Plantillas del producto.',
    );
  }

  const datos = construirDatosCartaOferta(oportunidad);
  const htmlBase = decodificarArchivoData(plantilla.archivoData);
  const html = sustituirPlaceholdersCarta(htmlBase, datos);

  const dataUri = await htmlToPdfBlobUrl(html, 'datauri');

  const folio = (oportunidad.no_cotiza || 'OPORTUNIDAD').replace(/[^a-zA-Z0-9._-]/g, '_');
  const sello = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    dataUri,
    // RN-03 — el sello de tiempo evita colisión con generaciones previas.
    nombreArchivo: `Carta_Oferta_${folio}_${sello}.pdf`,
    plantillaNombre: plantilla.nombre,
    plantillaVersion: plantilla.version || '',
  };
}

function dataUriToFile(dataUri: string, filename: string): File {
  const [head, b64 = ''] = dataUri.split(',');
  const mime = head.match(/:(.*?);/)?.[1] || 'application/pdf';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

export interface SubidaCartaOferta {
  url: string;
  storagePath: string;
  tamanoKB: number;
  /** false = no se pudo subir; la URL es un blob local que muere al recargar. */
  enStorage: boolean;
}

/**
 * CA-04 — sube el PDF a Storage. Si falla, degrada a blob URL local para no
 * perder el documento recién generado (misma estrategia que el kit legal).
 */
export async function subirCartaOferta(
  dataUri: string,
  nombreArchivo: string,
  oportunidadId: string,
): Promise<SubidaCartaOferta> {
  const file = dataUriToFile(dataUri, nombreArchivo);
  const storagePath = `oportunidades/${oportunidadId || 'sin-id'}/${nombreArchivo}`;

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .upload(storagePath, file, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' });

    if (!error && data?.path) {
      let url = `https://${projectId}.supabase.co/storage/v1/object/public/${BUCKET_EXPEDIENTES}/${data.path}`;
      try {
        const { data: signed } = await supabase.storage
          .from(BUCKET_EXPEDIENTES)
          .createSignedUrl(data.path, 3600);
        if (signed?.signedUrl) url = signed.signedUrl;
      } catch { /* se queda con la pública */ }

      return { url, storagePath: data.path, tamanoKB: Math.round(file.size / 1024), enStorage: true };
    }
    console.warn('[cartaOfertaPDF] Upload rechazado por Storage:', error?.message);
  } catch (err) {
    console.warn('[cartaOfertaPDF] Upload falló:', err);
  }

  return {
    url: URL.createObjectURL(file),
    storagePath,
    tamanoKB: Math.round(file.size / 1024),
    enStorage: false,
  };
}
