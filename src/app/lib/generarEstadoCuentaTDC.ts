/**
 * generarEstadoCuentaTDC — ESPECIFICACIÓN 6, la capa que toca el mundo.
 *
 * El motor (`motorEstadoCuentaTDC`) decide QUÉ entra al documento; aquí se lee
 * de la base, se arma el PDF desde la plantilla del producto y se persiste.
 *
 * ── D1 de REQ-31: el PDF primero, la fila después ────────────────────────
 * §22 prohíbe un `GENERADO` sin PDF válido. El pipeline de Carta Oferta
 * degrada a un blob URL local cuando Storage falla — eso muere al recargar la
 * página, así que aquí NO se acepta: si el archivo no llegó a Storage, se
 * aborta y no se registra nada. Subir primero y registrar después deja, en el
 * peor caso, un PDF huérfano en el bucket; al revés dejaría un documento
 * fantasma en el historial, que es lo que §22 prohíbe.
 */
import { supabase } from './supabaseClient';
import { projectId } from '/utils/supabase/info';
import { decodificarArchivoData, htmlToPdfBlobUrl } from '../hooks/generarDocumentosFase4';
import { cargarAvisosTDC } from './avisosTDC';
import {
  generarEstadoCuenta,
  construirDatosEstadoCuenta,
  sustituirPlaceholders,
  aISO,
  type AvisoPeriodo,
  type DatosLinea,
  type EstadoCuentaPrevio,
  type MovimientoPeriodo,
  type PagoAplicado,
  type ResultadoEstadoCuenta,
} from './motorEstadoCuentaTDC';
import type { PlantillaInstitucional } from '../types/product';

/** El mismo bucket que ya usan la Carta Oferta y el kit legal de Fase 4. */
const BUCKET = 'make-7e2d13d9-expedientes-electronicos-prospectos';

export class EstadoCuentaError extends Error {
  codigo: string;
  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.codigo = codigo;
  }
}

const num = (v: unknown): number => Number(v) || 0;
const fecha = (v: unknown): string => String(v ?? '').slice(0, 10);

// ─────────────────────────────────────────────────────────────────────────
// Lectura del contexto (§12 pasos 4 a 8)
// ─────────────────────────────────────────────────────────────────────────

export interface ContextoEstadoCuenta {
  ok: boolean;
  error?: string;
  avisos: AvisoPeriodo[];
  movimientos: MovimientoPeriodo[];
  pagos: PagoAplicado[];
  estadosPrevios: EstadoCuentaPrevio[];
  limiteAutorizado?: number;
  saldoDisponible?: number;
}

/** Una fila del historial, tal como la pinta el grid de §13. */
export interface FilaHistorial {
  id: string;
  fechaEstado: string;
  fechaInicioPeriodo: string;
  fechaFinPeriodo: string;
  fechaCorte: string;
  fechaLimitePago: string;
  fechaGeneracion: string;
  saldoAlCorte: number;
  pagoMinimo: number;
  pagoNoGeneraIntereses: number;
  pagoNoGeneraInteresesConfigurado: boolean;
  limiteAutorizado: number;
  creditoDisponible: number;
  estatus: string;
  usuario: string;
  folioAviso: string;
  documentoPdf: string;
  urlDocumento: string;
  moneda: string;
}

export async function cargarHistorialEstadosCuenta(
  idLinea: string,
): Promise<{ ok: boolean; filas: FilaHistorial[]; error?: string }> {
  if (!idLinea) return { ok: false, filas: [], error: 'No se recibió la Línea de Crédito.' };
  try {
    const { data, error } = await supabase.rpc('obtener_estados_cuenta', { p_linea_id: idLinea });
    if (error) return { ok: false, filas: [], error: traducirError(error.message || String(error)) };

    const filas: any[] = Array.isArray(data) ? data : [];
    return {
      ok: true,
      filas: filas.map(f => ({
        id: String(f.id),
        fechaEstado: fecha(f.fecha_estado),
        fechaInicioPeriodo: fecha(f.fecha_inicio_periodo),
        fechaFinPeriodo: fecha(f.fecha_fin_periodo),
        fechaCorte: fecha(f.fecha_corte),
        fechaLimitePago: fecha(f.fecha_limite_pago),
        fechaGeneracion: String(f.fecha_generacion || ''),
        saldoAlCorte: num(f.saldo_al_corte),
        pagoMinimo: num(f.pago_minimo),
        pagoNoGeneraIntereses: num(f.pago_no_genera_intereses),
        pagoNoGeneraInteresesConfigurado: f.pago_no_genera_intereses_configurado === true,
        limiteAutorizado: num(f.limite_autorizado),
        creditoDisponible: num(f.credito_disponible),
        estatus: f.estatus || 'GENERADO',
        usuario: f.usuario_generacion || '',
        folioAviso: f.folio_aviso || '',
        documentoPdf: f.id_documento_pdf || '',
        urlDocumento: f.url_documento || '',
        moneda: f.moneda || 'MXN',
      })),
    };
  } catch (e: any) {
    return { ok: false, filas: [], error: traducirError(e?.message || 'Error al leer el historial.') };
  }
}

/**
 * Reúne todo lo que el motor necesita. Reutiliza `cargarAvisosTDC` (ESPEC 3)
 * y `obtener_cargos_linea` (ESPEC 3) sin modificarlos; los dos lectores
 * nuevos — pagos por línea y saldo de la línea — viven en la migración de
 * esta especificación.
 */
export async function cargarContextoEstadoCuenta(params: {
  idLinea: string;
  idCliente?: string;
  fechaEstado: string;
}): Promise<ContextoEstadoCuenta> {
  const vacio: ContextoEstadoCuenta = {
    ok: false, avisos: [], movimientos: [], pagos: [], estadosPrevios: [],
  };
  if (!params.idLinea) return { ...vacio, error: 'No se recibió la Línea de Crédito.' };

  try {
    const [resAvisos, resCargos, resPagos, resSaldo, resHist] = await Promise.all([
      cargarAvisosTDC({ lineaId: params.idLinea }),
      supabase.rpc('obtener_cargos_linea', {
        p_linea_id: params.idLinea, p_fecha_inicio: null, p_fecha_fin: null,
      }),
      supabase.rpc('obtener_pagos_aplicados_linea', {
        p_linea_id: params.idLinea, p_fecha_hasta: aISO(params.fechaEstado) || null,
      }),
      supabase.rpc('obtener_saldo_linea', { p_linea_id: params.idLinea }),
      cargarHistorialEstadosCuenta(params.idLinea),
    ]);

    if (!resAvisos.ok) return { ...vacio, error: resAvisos.error };
    if (resCargos.error) return { ...vacio, error: traducirError(resCargos.error.message) };
    if (resPagos.error) return { ...vacio, error: traducirError(resPagos.error.message) };

    const saldo = Array.isArray(resSaldo.data) ? resSaldo.data[0] : resSaldo.data;

    return {
      ok: true,
      avisos: resAvisos.avisos.map(a => ({
        id: a.id,
        folio: a.folio,
        fechaInicio: a.fechaInicio,
        fechaFin: a.fechaFin,
        fechaDocumento: a.fechaDocumento,
        fechaVencimiento: a.fechaVencimiento,
        montoTotalPagar: a.montoTotalPagar,
        montoMinimoPagar: a.montoMinimoPagar,
        pagoTotal: a.pagoTotal,
        saldoPendiente: a.saldoPendiente,
        cantidadCargos: a.cantidadCargos,
        moneda: a.moneda,
        estatus: a.estatus,
        detalle: a.detalle.map(d => ({
          id: d.id,
          claveConcepto: d.claveConcepto,
          nombreConcepto: d.nombreConcepto,
          monto: d.monto,
          pagoTotal: d.pagoTotal,
          saldoPendiente: d.saldoPendiente,
          ordenPrelacion: d.ordenPrelacion,
          estatusPago: d.estatusPago,
        })),
      })),
      movimientos: (Array.isArray(resCargos.data) ? resCargos.data : []).map((c: any) => ({
        id: String(c.id),
        clave: c.clave || '',
        nombre: c.nombre || '',
        naturaleza: c.naturaleza || 'Cargo',
        monto: num(c.monto),
        fecha: fecha(c.fecha),
      })),
      pagos: (Array.isArray(resPagos.data) ? resPagos.data : []).map((p: any) => ({
        id: String(p.id),
        idCxC: p.cxc_id || undefined,
        idProceso: p.proceso_id || undefined,
        referencia: p.referencia || '',
        montoAplicado: num(p.monto_aplicado),
        fechaPago: fecha(p.fecha_pago),
        estatus: p.estatus || 'Aplicado',
      })),
      estadosPrevios: resHist.filas.map(f => ({
        id: f.id,
        fechaEstado: f.fechaEstado,
        fechaCorte: f.fechaCorte,
        saldoAlCorte: f.saldoAlCorte,
        estatus: f.estatus,
      })),
      limiteAutorizado: saldo?.monto_autorizado != null ? num(saldo.monto_autorizado) : undefined,
      saldoDisponible: saldo?.saldo_disponible != null ? num(saldo.saldo_disponible) : undefined,
    };
  } catch (e: any) {
    return { ...vacio, error: traducirError(e?.message || 'Error al leer la información de la Línea.') };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// §11 / §12 pasos 11-12 — plantilla y PDF
// ─────────────────────────────────────────────────────────────────────────

/** CA-24 — plantilla activa tipo 'estado-cuenta' del producto de la línea. */
export function buscarPlantillaEstadoCuenta(
  plantillas: PlantillaInstitucional[] | undefined | null,
): PlantillaInstitucional | null {
  if (!Array.isArray(plantillas) || plantillas.length === 0) return null;
  return (
    plantillas.find(p => p.tipoPlantilla === 'estado-cuenta' && p.estatus === 'Activo' && p.archivoData) ||
    plantillas.find(p => p.tipoPlantilla === 'estado-cuenta' && p.estatus === 'Activo') ||
    null
  );
}

function dataUriAFile(dataUri: string, nombre: string): File {
  const [head, b64 = ''] = dataUri.split(',');
  const mime = head.match(/:(.*?);/)?.[1] || 'application/pdf';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], nombre, { type: mime });
}

/**
 * D1 — sube a Storage o falla. Sin degradación a blob local: un blob URL no
 * sobrevive a un refresh y §22 exige un PDF de verdad.
 */
async function subirPDF(dataUri: string, nombre: string, idLinea: string): Promise<{
  path: string;
  url: string;
}> {
  const file = dataUriAFile(dataUri, nombre);
  const path = `estados-cuenta/${idLinea || 'sin-linea'}/${nombre}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' });

  if (error || !data?.path) {
    throw new EstadoCuentaError(
      'PDF_NO_GUARDADO',
      'El PDF no se pudo guardar en el repositorio de documentos, así que el Estado de Cuenta no se registró. ' +
      `Vuelva a intentarlo. Detalle: ${error?.message || 'respuesta vacía de Storage'}`,
    );
  }

  let url = `https://${projectId}.supabase.co/storage/v1/object/public/${BUCKET}/${data.path}`;
  try {
    const { data: firmada } = await supabase.storage.from(BUCKET).createSignedUrl(data.path, 3600);
    if (firmada?.signedUrl) url = firmada.signedUrl;
  } catch { /* la pública sirve */ }

  return { path: data.path, url };
}

/**
 * Elimina un Estado de Cuenta para poder regenerarlo — la acción explícita
 * que §16 deja abierta.
 *
 * El RPC se niega si el documento ya disparó la reclasificación de ESPEC 9:
 * borrarlo dejaría avisos cerrados y cargos de Saldo Anterior sin el documento
 * que los respalda.
 *
 * El PDF se borra DESPUÉS de que la fila desapareció. Al revés, un fallo al
 * eliminar la fila dejaría un 'GENERADO' apuntando a un archivo inexistente,
 * que es justo lo que §22 prohíbe.
 */
export async function eliminarEstadoCuenta(
  idEstado: string,
  usuario?: string,
): Promise<{ ok: boolean; mensaje?: string; error?: string }> {
  if (!idEstado) return { ok: false, error: 'No se recibió el Estado de Cuenta.' };
  try {
    const { data, error } = await supabase.rpc('eliminar_estado_cuenta', {
      p_estado_id: idEstado,
      p_usuario: usuario || 'Sistema',
    });
    if (error) return { ok: false, error: traducirError(error.message || String(error)) };

    const fila = Array.isArray(data) ? data[0] : data;
    if (!fila?.ok) return { ok: false, error: fila?.mensaje || 'No se eliminó el Estado de Cuenta.' };

    // Huérfano en el bucket es inofensivo; fila sin PDF, no. Por eso el
    // archivo se borra al final y su fallo no invalida la eliminación.
    if (fila.documento_pdf) {
      try {
        await supabase.storage.from(BUCKET).remove([String(fila.documento_pdf)]);
      } catch {
        console.warn('[estadoCuenta] La fila se eliminó pero el PDF quedó en Storage:', fila.documento_pdf);
      }
    }

    return { ok: true, mensaje: fila.mensaje };
  } catch (e: any) {
    return { ok: false, error: traducirError(e?.message || 'Error al eliminar el Estado de Cuenta.') };
  }
}

/** Una URL fresca para abrir un PDF ya guardado (§13 columna Acción). */
export async function urlDocumento(path: string): Promise<string | null> {
  if (!path) return null;
  try {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    if (data?.signedUrl) return data.signedUrl;
  } catch { /* cae a la pública */ }
  return `https://${projectId}.supabase.co/storage/v1/object/public/${BUCKET}/${path}`;
}

// ─────────────────────────────────────────────────────────────────────────
// §12 — el proceso completo
// ─────────────────────────────────────────────────────────────────────────

export interface ParamsGeneracion {
  linea: DatosLinea;
  fechaEstado: string;
  cliente?: string;
  producto?: string;
  usuario?: string;
  plantillas?: PlantillaInstitucional[] | null;
  contexto: ContextoEstadoCuenta;
}

export interface ResultadoGeneracion {
  ok: boolean;
  error?: string;
  codigoError?: string;
  estadoId?: string;
  urlDocumento?: string;
  documentoPdf?: string;
  /** Lo que decidió el motor; sirve para pintar la vista previa aunque falle. */
  calculo: ResultadoEstadoCuenta | null;
}

/** El detalle que se congela en J_ESTADOS_CUENTA_DETALLE. */
function armarDetalle(r: ResultadoEstadoCuenta): any[] {
  const filas: any[] = [];
  let orden = 0;

  for (const m of r.movimientosPeriodo) {
    filas.push({
      tipo: 'MOVIMIENTO', orden: orden++, clave: m.clave, nombre: m.nombre || '',
      naturaleza: m.naturaleza, monto: m.monto, fecha: m.fecha, origenId: m.id,
    });
  }
  orden = 0;
  for (const p of r.pagosConsiderados) {
    filas.push({
      tipo: 'PAGO', orden: orden++, referencia: p.referencia || '',
      monto: p.montoAplicado, fecha: p.fechaPago, origenId: p.id,
    });
  }
  for (const d of r.periodo?.detalle || []) {
    const pagado = Number(d.pagoTotal || 0);
    filas.push({
      tipo: 'CONCEPTO', orden: d.ordenPrelacion ?? 0, clave: d.claveConcepto,
      nombre: d.nombreConcepto, monto: d.monto, pagado,
      saldo: d.saldoPendiente != null ? d.saldoPendiente : Number(d.monto || 0) - pagado,
      origenId: d.id,
    });
  }
  return filas;
}

export async function generarYGuardarEstadoCuenta(
  params: ParamsGeneracion,
): Promise<ResultadoGeneracion> {
  const { linea, contexto } = params;
  const fechaEstado = aISO(params.fechaEstado);
  const correlationId = `edocta|${linea.idLinea}|${fechaEstado}`;

  // ── §12 pasos 1 a 10 — todo lo que puede fallar sin efectos ──
  const calculo = generarEstadoCuenta({
    linea: {
      ...linea,
      limiteAutorizado: contexto.limiteAutorizado ?? linea.limiteAutorizado,
      saldoDisponible: contexto.saldoDisponible ?? linea.saldoDisponible,
    },
    fechaEstado,
    fechaActual: new Date().toISOString().slice(0, 10),
    avisos: contexto.avisos,
    movimientos: contexto.movimientos,
    pagos: contexto.pagos,
    estadosPrevios: contexto.estadosPrevios,
  });

  if (!calculo.ok || !calculo.periodo || !calculo.snapshot) {
    await auditarError(linea, fechaEstado, params.usuario, calculo.codigoError, calculo.error, correlationId);
    return { ok: false, error: calculo.error, codigoError: calculo.codigoError, calculo };
  }

  // ── §12 paso 11 — la plantilla ──
  const plantilla = buscarPlantillaEstadoCuenta(params.plantillas);
  if (!plantilla) {
    const msg =
      'El producto de esta Línea no tiene una plantilla de Estado de Cuenta configurada. ' +
      'Agréguela en Productos → Línea de Crédito → subpestaña Plantillas, con tipo ' +
      '"Estado de Cuenta" y estatus Activo.';
    await auditarError(linea, fechaEstado, params.usuario, 'SIN_PLANTILLA', msg, correlationId);
    return { ok: false, error: msg, codigoError: 'SIN_PLANTILLA', calculo };
  }
  if (!plantilla.archivoData) {
    const msg = `La plantilla "${plantilla.nombre}" está registrada pero no tiene archivo base cargado. ` +
      'Súbalo en la subpestaña Plantillas del producto.';
    await auditarError(linea, fechaEstado, params.usuario, 'SIN_PLANTILLA', msg, correlationId);
    return { ok: false, error: msg, codigoError: 'SIN_PLANTILLA', calculo };
  }

  try {
    // ── §12 paso 12 — render y PDF ──
    const datos = construirDatosEstadoCuenta(calculo, linea, {
      cliente: params.cliente,
      producto: params.producto,
      usuario: params.usuario,
      fechaGeneracion: new Date().toLocaleString('es-MX'),
    });
    const html = sustituirPlaceholders(decodificarArchivoData(plantilla.archivoData), datos);
    // El Estado de Cuenta es el único documento del sistema que crece con los
    // datos: seis movimientos ya lo llevan a dos páginas. Sin paginado por
    // fronteras, el corte cae a media tabla.
    const dataUri = await htmlToPdfBlobUrl(html, 'datauri', { paginadoInteligente: true });

    // ── §12 paso 13 — Storage. D1: aquí se falla o se sube, no hay término medio.
    const sello = new Date().toISOString().replace(/[:.]/g, '-');
    const folio = (linea.numeroLinea || linea.idLinea || 'LINEA').replace(/[^a-zA-Z0-9._-]/g, '_');
    const { path, url } = await subirPDF(dataUri, `Estado_Cuenta_${folio}_${fechaEstado}_${sello}.pdf`, linea.idLinea);

    // ── §12 pasos 14 — la transacción ──
    const s = calculo.snapshot;
    const { data, error } = await supabase.rpc('generar_estado_cuenta_tdc', {
      p_linea_id: linea.idLinea,
      p_cliente_id: linea.idCliente || null,
      p_producto_id: linea.idProducto || null,
      p_cxc_id: calculo.periodo.id,
      p_folio_aviso: calculo.periodo.folio || null,
      p_fecha_inicio_periodo: calculo.fechaInicioPeriodo || null,
      p_fecha_fin_periodo: calculo.fechaFinPeriodo || null,
      p_fecha_corte: calculo.fechaCorte || null,
      p_fecha_limite_pago: calculo.fechaLimitePago || null,
      p_fecha_estado: fechaEstado,
      p_limite_autorizado: s.limiteAutorizado,
      p_saldo_anterior: s.saldoAnterior,
      p_cargos_periodo: s.cargosPeriodo,
      p_pagos_periodo: s.pagosPeriodo,
      p_saldo_al_corte: s.saldoAlCorte,
      p_saldo_consume_linea: s.saldoConsumeLinea,
      p_credito_disponible: s.creditoDisponible,
      p_pago_minimo: s.pagoMinimo,
      p_pago_no_genera_int: s.pagoNoGeneraIntereses,
      p_pago_no_genera_conf: s.pagoNoGeneraInteresesConfigurado,
      p_id_documento_pdf: path,
      p_url_documento: url,
      p_plantilla_nombre: plantilla.nombre,
      p_plantilla_version: plantilla.version || '',
      p_moneda: linea.moneda || calculo.periodo.moneda || 'MXN',
      p_usuario: params.usuario || 'Sistema',
      p_correlation_id: correlationId,
      p_detalle: armarDetalle(calculo),
    });

    if (error) {
      const msg = traducirError(error.message || String(error));
      await auditarError(linea, fechaEstado, params.usuario, 'TRANSACCION', msg, correlationId);
      return { ok: false, error: msg, codigoError: 'TRANSACCION', calculo };
    }

    const fila = Array.isArray(data) ? data[0] : data;
    if (!fila?.ok) {
      // §16 — el duplicado que sólo la base pudo ver (dos clics simultáneos).
      return {
        ok: false,
        error: fila?.mensaje || 'No se generó el Estado de Cuenta.',
        codigoError: 'DUPLICADO',
        estadoId: fila?.estado_id,
        calculo,
      };
    }

    return {
      ok: true,
      estadoId: fila.estado_id,
      urlDocumento: url,
      documentoPdf: path,
      calculo,
    };
  } catch (e: any) {
    const codigo = e instanceof EstadoCuentaError ? e.codigo : 'PDF';
    const msg = e?.message || 'No se pudo generar el PDF del Estado de Cuenta.';
    await auditarError(linea, fechaEstado, params.usuario, codigo, msg, correlationId);
    return { ok: false, error: msg, codigoError: codigo, calculo };
  }
}

/** §19 — el fallo también se audita, y nunca ocupa la combinación de §16. */
async function auditarError(
  linea: DatosLinea,
  fechaEstado: string,
  usuario: string | undefined,
  codigo: string | undefined,
  mensaje: string | undefined,
  correlationId: string,
): Promise<void> {
  try {
    await supabase.rpc('registrar_error_estado_cuenta', {
      p_linea_id: linea.idLinea,
      p_cliente_id: linea.idCliente || null,
      p_fecha_estado: fechaEstado || null,
      p_usuario: usuario || 'Sistema',
      p_codigo_error: codigo || 'ERROR',
      p_mensaje_error: (mensaje || '').slice(0, 2000),
      p_correlation_id: correlationId,
    });
  } catch {
    // La auditoría no puede tumbar el flujo: el error real ya se le informó
    // al usuario y se reporta por consola para no perderlo.
    console.warn('[estadoCuenta] No se pudo registrar la auditoría del fallo.');
  }
}

/** Traduce los errores crudos de PostgREST a algo accionable. */
export function traducirError(msg: string): string {
  const m = String(msg || '');
  if (/PGRST202|Could not find the function/i.test(m)) {
    return 'Las funciones del Estado de Cuenta no existen en la base. Ejecute ' +
           'supabase/migrations/create_rpc_estado_cuenta_tdc.sql (ESPECIFICACIÓN 6).';
  }
  if (/eliminar_estado_cuenta/i.test(m)) {
    return 'La función de eliminación no existe en la base. Ejecute ' +
           'supabase/migrations/create_rpc_eliminar_estado_cuenta.sql.';
  }
  if (/ux_edocta_linea_fecha|duplicate key/i.test(m)) {
    return 'Ya existe un Estado de Cuenta generado para esa Fecha Estado.';
  }
  if (/chk_edocta_generado_con_pdf/i.test(m)) {
    return 'No se puede registrar un Estado de Cuenta sin su PDF.';
  }
  if (/J_SALDOS_LINEA|J_APLICACIONES_PAGO_CXC|relation .* does not exist/i.test(m)) {
    return 'Faltan tablas de las especificaciones previas. Ejecute las migraciones de TDC en orden.';
  }
  return m;
}
