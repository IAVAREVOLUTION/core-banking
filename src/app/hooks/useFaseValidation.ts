/**
 * useFaseValidation.ts — Servicio de validación de fases compartido
 *
 * Valida si se puede avanzar o regresar de fase según las reglas de originación.
 * Usado por SolicitudCreditoForm (avance) y OriginacionModule (avance + regreso).
 *
 * Reglas implementadas (spec REGLAS DE ORIGINACIÓN V0.2):
 *  1. Documentos obligatorios: deben existir, tener archivo y estar Validados
 *  2. No deben existir documentos Rechazados o Pendientes en la fase actual
 *  3. Para regresar fase: debe existir una nota creada en los últimos 30 minutos
 *  4. Garantías requeridas según tipo de producto
 *  5. Comités autorizados (todos en estatus Autorizado)
 */
import { useMemo } from 'react';

// ── Tipos públicos ─────────────────────────────────────────────────
export interface DocumentoValidacion {
  tipoDocumento: string;
  estatus: 'Pendiente' | 'Validado' | 'Rechazado' | string;
  faseId?: number;
}

export interface NotaValidacion {
  fecha?: string;
  fechaCreacion?: Date | string;
}

export interface RequisitoFase {
  tipoDocumento: string;
  obligatorio: boolean;
  faseId?: number;
  tipoPersona?: string;
}

export interface ComiteValidacion {
  estatus: 'Pendiente' | 'Autorizado' | 'Rechazado' | string;
}

export interface FaseValidationResult {
  /** Se puede avanzar a la siguiente fase */
  puedeAvanzar: boolean;
  /** Se puede regresar a la fase anterior */
  puedeRegresar: boolean;
  /** Motivos que bloquean el avance */
  motivosAvance: string[];
  /** Motivos que bloquean el regreso */
  motivosRegreso: string[];
  /** Documentos faltantes o sin validar */
  documentosFaltantes: string[];
  /** Documentos rechazados en la fase actual */
  documentosRechazados: string[];
  /** Hay nota reciente (últimos 30 min) para autorizar regreso */
  tieneNotaReciente: boolean;
}

interface UseFaseValidationOptions {
  /** Número de la fase actual (1–7) */
  faseActual: number;
  /** Documentos cargados en Sección 2 del Expediente */
  documentos: DocumentoValidacion[];
  /** Notas de la solicitud */
  notas: NotaValidacion[];
  /** Garantías registradas */
  garantias: any[];
  /** Comités de autorización */
  comites: ComiteValidacion[];
  /** Tipo de persona (filtra requisitos) */
  tipoPersona?: string;
  /** Requisitos documentales de la fase (Sección 1 del Expediente) */
  requisitosFase?: RequisitoFase[];
  /** ¿El tipo de producto requiere garantías? */
  requiereGarantia?: boolean;
  /** ¿El tipo de producto requiere comité? */
  requiereComite?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Parsea una fecha en formato "DD/MM/YYYY HH:MM" o "DD/MM/YYYY HH:MM:SS"
 * a un objeto Date.
 */
function parseFechaStr(fecha: string): Date {
  if (!fecha) return new Date(0);
  const [datePart, timePart = '00:00'] = fecha.trim().split(' ');
  const [d, m, y] = datePart.split('/').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  if (!y || !m || !d) return new Date(0);
  const year = y < 100 ? 2000 + y : y;
  return new Date(year, m - 1, d, h || 0, min || 0);
}

/**
 * Obtiene el objeto Date a partir de una nota (soporta ambos formatos:
 * Solicitudes usa `fecha: string`, Originación usa `fechaCreacion: Date`).
 */
function getNotaDate(n: NotaValidacion): Date {
  if (n.fechaCreacion) {
    return n.fechaCreacion instanceof Date
      ? n.fechaCreacion
      : new Date(n.fechaCreacion);
  }
  if (n.fecha) return parseFechaStr(n.fecha);
  return new Date(0);
}

/**
 * Filtra requisitos según tipo de persona.
 * Si el requisito no especifica persona, aplica a todos.
 */
function filtrarPorPersona(requisitos: RequisitoFase[], tipoPersona: string): RequisitoFase[] {
  if (!tipoPersona) return requisitos;
  const tp = tipoPersona.toLowerCase();
  const isMoral = tp.includes('moral');

  return requisitos.filter(r => {
    if (!r.tipoPersona) return true;
    const persona = r.tipoPersona.toLowerCase();
    if (persona.includes('todo') || persona.includes('all')) return true;
    if (isMoral) return persona.includes('moral');
    return !persona.includes('moral');
  });
}

// ── Hook ───────────────────────────────────────────────────────────
export function useFaseValidation({
  faseActual,
  documentos,
  notas,
  garantias,
  comites,
  tipoPersona = 'Física',
  requisitosFase = [],
  requiereGarantia = false,
  requiereComite = false,
}: UseFaseValidationOptions): FaseValidationResult {

  return useMemo((): FaseValidationResult => {
    const motivosAvance: string[] = [];
    const motivosRegreso: string[] = [];
    const documentosFaltantes: string[] = [];
    const documentosRechazados: string[] = [];

    // ── 1. Documentos obligatorios ──────────────────────────────────
    const requisitosAplicables = filtrarPorPersona(
      requisitosFase.filter(r => r.obligatorio && (r.faseId === undefined || r.faseId === faseActual)),
      tipoPersona,
    );

    for (const req of requisitosAplicables) {
      const docEncontrado = documentos.find(d => d.tipoDocumento === req.tipoDocumento);
      if (!docEncontrado) {
        documentosFaltantes.push(req.tipoDocumento);
      } else if (docEncontrado.estatus !== 'Validado') {
        documentosFaltantes.push(`${req.tipoDocumento} (sin validar)`);
      }
    }

    if (documentosFaltantes.length > 0) {
      motivosAvance.push(
        `Documentos obligatorios pendientes: ${documentosFaltantes.join(', ')}`,
      );
    }

    // ── 2. Documentos rechazados bloquean avance ────────────────────
    const docsRechazados = documentos.filter(
      d => d.estatus === 'Rechazado' && (d.faseId === undefined || d.faseId === faseActual),
    );
    if (docsRechazados.length > 0) {
      docsRechazados.forEach(d => documentosRechazados.push(d.tipoDocumento));
      motivosAvance.push(
        `Documentos rechazados en la fase actual: ${documentosRechazados.join(', ')}`,
      );
    }

    // ── 3. Garantías (si el producto las requiere) ──────────────────
    if (requiereGarantia && garantias.length === 0) {
      motivosAvance.push('El producto requiere al menos una garantía registrada');
    }

    // ── 4. Comités (si el producto los requiere) ────────────────────
    if (requiereComite) {
      const pendientes = comites.filter(c => c.estatus !== 'Autorizado');
      if (pendientes.length > 0) {
        motivosAvance.push(
          `Todos los comités deben estar Autorizados (${pendientes.length} pendientes)`,
        );
      }
    }

    // ── 5. Nota reciente para regresar fase (últimos 30 min) ────────
    const TREINTA_MIN_MS = 30 * 60 * 1000;
    const ahora = Date.now();
    const tieneNotaReciente = notas.some(n => {
      const fecha = getNotaDate(n);
      return ahora - fecha.getTime() < TREINTA_MIN_MS;
    });

    if (faseActual > 1 && !tieneNotaReciente) {
      motivosRegreso.push(
        'Se requiere una nota creada en los últimos 30 minutos para regresar de fase',
      );
    }

    const puedeAvanzar = motivosAvance.length === 0;
    const puedeRegresar = faseActual > 1 && motivosRegreso.length === 0;

    return {
      puedeAvanzar,
      puedeRegresar,
      motivosAvance,
      motivosRegreso,
      documentosFaltantes,
      documentosRechazados,
      tieneNotaReciente,
    };
  }, [
    faseActual,
    documentos,
    notas,
    garantias,
    comites,
    tipoPersona,
    requisitosFase,
    requiereGarantia,
    requiereComite,
  ]);
}
