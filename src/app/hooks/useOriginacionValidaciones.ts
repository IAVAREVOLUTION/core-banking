/**
 * useOriginacionValidaciones — Motor de validación para el módulo de Originación.
 *
 * Implementa las reglas de las secciones B–F del documento oficial:
 *  B. Validaciones documentales (todas las fases)
 *  C. Validación de nota reciente (Regresar)
 *  D. Validaciones por fase (1–5)
 *  E. Fase 6 — Solicitud de Activación
 *  F. Fase 7 — Activación de Cuenta
 *
 * Fuente de verdad:
 *  solicitud.producto.fases[]        → fases válidas
 *  solicitud.faseActual              → fase actual
 *  solicitud.expediente.seccion1     → documentos obligatorios (RequisitoProducto[])
 *  solicitud.expediente.seccion2     → documentos cargados (DocumentoCargado[])
 *  solicitud.notas                   → notas (Nota[])
 */

import type { DocumentoCargado, RequisitoProducto, Nota } from '../components/solicitudes/solicitudCreditoStore';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

// ══════════════════════════════════════════════════════════════════
// B. VALIDACIONES DOCUMENTALES GENERALES
// Aplican en TODAS las fases antes de avanzar.
// ══════════════════════════════════════════════════════════════════

/**
 * Valida que los documentos obligatorios de una fase estén cargados y validados.
 * Sección 1 = requisitos (qué debe haber).
 * Sección 2 = documentos cargados (lo que hay).
 */
export function validarDocumentosFase(
  documentosCargados: DocumentoCargado[],
  requisitos: RequisitoProducto[],
  faseSeq: number,
  tipoPersona: string,
): ValidationResult {
  const errors: string[] = [];

  // Filtrar requisitos obligatorios de la fase actual por tipo de persona
  const reqFase = requisitos.filter(r => {
    const rFaseSeq = typeof r.faseId === 'number' ? r.faseId : (parseInt(String(r.faseId)) || 1);
    if (rFaseSeq !== faseSeq) return false;
    if (!r.obligatorio) return false;
    const persona = String((r as any).tipoPersona || (r as any).persona || '').toLowerCase();
    if (!persona || persona.includes('todo') || persona.includes('all') || persona === '') return true;
    const tp = tipoPersona.toLowerCase();
    if (tp.includes('moral') && !persona.includes('moral')) return false;
    if (!tp.includes('moral') && persona.includes('moral')) return false;
    return true;
  });

  if (reqFase.length === 0) return { valid: true, errors: [] };

  // Docs de la fase actual (por faseId o sin fase)
  const docsFase = documentosCargados.filter(d =>
    d.faseId === faseSeq || d.faseId === 0 || !d.faseId
  );

  for (const req of reqFase) {
    const docEncontrado = docsFase.find(d =>
      (d.tipoDocumento || '').toLowerCase() === (req.tipoDocumento || '').toLowerCase()
    );

    if (!docEncontrado) {
      errors.push(`Documento obligatorio no cargado: "${req.tipoDocumento}"`);
      continue;
    }
    if (!docEncontrado.archivo && !docEncontrado.url && !docEncontrado.fileData) {
      errors.push(`Documento sin archivo adjunto: "${req.tipoDocumento}"`);
      continue;
    }
    if (docEncontrado.estatus === 'Rechazado') {
      errors.push(`Documento rechazado: "${req.tipoDocumento}". Vuelva a cargarlo.`);
      continue;
    }
    if (docEncontrado.estatus === 'Pendiente' || docEncontrado.estatus !== 'Validado') {
      errors.push(`Documento pendiente de validación: "${req.tipoDocumento}"`);
    }
  }

  // Verificar documentos rechazados o pendientes en esta fase (aunque no sean obligatorios)
  const rechazados = docsFase.filter(d => d.estatus === 'Rechazado').map(d => d.tipoDocumento);
  if (rechazados.length > 0) {
    errors.push(`Documentos rechazados que deben corregirse: ${rechazados.join(', ')}`);
  }

  // Verificar duplicados
  const tipos = docsFase.map(d => (d.tipoDocumento || '').toLowerCase()).filter(Boolean);
  const dupes = tipos.filter((t, i) => tipos.indexOf(t) !== i);
  if (dupes.length > 0) {
    errors.push(`Documentos duplicados: ${[...new Set(dupes)].join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

// ══════════════════════════════════════════════════════════════════
// C. VALIDACIÓN DE NOTA RECIENTE
// Requisito para REGRESAR de fase en cualquier etapa.
// ══════════════════════════════════════════════════════════════════

/**
 * Devuelve true si existe al menos una nota creada en los últimos 30 minutos.
 */
export function validarNotaReciente(notas: Nota[]): boolean {
  if (!Array.isArray(notas) || notas.length === 0) return false;
  const ahora = Date.now();
  const TREINTA_MIN_MS = 30 * 60 * 1000;
  return notas.some(n => {
    if (!n.fechaCreacion) return false;
    try {
      const t = new Date(n.fechaCreacion).getTime();
      return !isNaN(t) && ahora - t <= TREINTA_MIN_MS;
    } catch {
      return false;
    }
  });
}

// ══════════════════════════════════════════════════════════════════
// D. FASE 4 — FORMALIZAR CONTRATO
// ══════════════════════════════════════════════════════════════════

export function validarFormalizarContrato(opts: {
  documentosCargados: DocumentoCargado[];
  requisitos: RequisitoProducto[];
  fasesAnterioresSeq: number[];  // [1, 2, 3] para validar docs de fases anteriores
  tipoPersona: string;
  terminos: Record<string, any>;
  garantias: any[];
  comites: any[];
  productoRequiereGarantia: boolean;
  productoRequiereComite: boolean;
}): ValidationResult {
  const errors: string[] = [];

  // 1. Documentos de TODAS las fases anteriores
  for (const seq of opts.fasesAnterioresSeq) {
    const res = validarDocumentosFase(
      opts.documentosCargados,
      opts.requisitos,
      seq,
      opts.tipoPersona,
    );
    for (const e of res.errors) {
      errors.push(`Fase ${seq}: ${e}`);
    }
  }

  // 2. Términos y Condiciones completos
  const t = opts.terminos || {};
  const tieneTerminos =
    (t.monto || t.montoSolicitado) &&
    (t.plazo || t.plazoMeses) &&
    (t.tasa || t.tasaAnual);
  if (!tieneTerminos) {
    errors.push('Términos y Condiciones incompletos. Verifique monto, plazo y tasa.');
  }

  // 3. Garantías (si el producto lo requiere)
  if (opts.productoRequiereGarantia) {
    if (!opts.garantias || opts.garantias.length === 0) {
      errors.push('El producto requiere garantías. Registre al menos una garantía.');
    }
  }

  // 4. Comités (si el producto lo requiere)
  if (opts.productoRequiereComite) {
    if (!opts.comites || opts.comites.length === 0) {
      errors.push('El producto requiere comité de autorización.');
    } else {
      const autorizado = opts.comites.some(c =>
        (c.estatus || c.status || '').toLowerCase() === 'autorizado'
      );
      if (!autorizado) {
        errors.push('El comité de autorización no tiene estatus "Autorizado".');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ══════════════════════════════════════════════════════════════════
// D. FASE 5 — CONTRATOS Y PAGARÉS
// ══════════════════════════════════════════════════════════════════

export function validarContratosYPagares(documentosCargados: DocumentoCargado[]): ValidationResult {
  const errors: string[] = [];

  const pagares = documentosCargados.filter(d => {
    const tipo = (d.tipoDocumento || '').toLowerCase();
    return tipo.includes('pagaré') || tipo.includes('pagare') || tipo.includes('pagaré');
  });

  const contratos = documentosCargados.filter(d => {
    const tipo = (d.tipoDocumento || '').toLowerCase();
    return tipo.includes('contrato');
  });

  if (pagares.length === 0) {
    errors.push('No se han cargado pagarés. Cargue y valide el pagaré antes de avanzar.');
  } else {
    const noValidados = pagares.filter(d => d.estatus !== 'Validado');
    if (noValidados.length > 0) {
      errors.push(`Pagaré(s) sin validar: ${noValidados.map(d => d.tipoDocumento).join(', ')}`);
    }
  }

  if (contratos.length === 0) {
    errors.push('No se han cargado contratos. Cargue y valide el contrato antes de avanzar.');
  } else {
    const noValidados = contratos.filter(d => d.estatus !== 'Validado');
    if (noValidados.length > 0) {
      errors.push(`Contrato(s) sin validar: ${noValidados.map(d => d.tipoDocumento).join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ══════════════════════════════════════════════════════════════════
// E. FASE 6 — SOLICITUD DE ACTIVACIÓN
// Validaciones varían según la Línea de Producto.
// ══════════════════════════════════════════════════════════════════

export function validarFase6(opts: {
  lineaProducto: string;
  garantias: any[];
  comites: any[];
  cargos: any[];
  montoGarantiaRequerido: number;
  productoRequiereGarantia: boolean;
  productoRequiereComite: boolean;
}): ValidationResult {
  const errors: string[] = [];
  const linea = (opts.lineaProducto || '').toLowerCase();
  const isLineaCredito =
    linea.includes('línea de crédito') ||
    linea.includes('linea de credito') ||
    (linea.includes('línea') && linea.includes('créd')) ||
    (linea.includes('linea') && linea.includes('cred'));
  const isCaptacion =
    linea.includes('captación') || linea.includes('captacion');
  // Crédito simple = NO es línea de crédito y NO es captación
  const isCredito = !isLineaCredito && !isCaptacion;

  if (isCredito || isLineaCredito) {
    // a) Garantías
    if (opts.productoRequiereGarantia) {
      if (!opts.garantias || opts.garantias.length === 0) {
        errors.push('Se requieren garantías registradas para procesar la solicitud de activación.');
      } else if (opts.montoGarantiaRequerido > 0) {
        const montoTotal = opts.garantias.reduce((sum, g) => {
          const monto = parseFloat(
            String(g.monto || g.valorGarantia || g.valor || 0).replace(/[^0-9.-]/g, '')
          ) || 0;
          return sum + monto;
        }, 0);
        if (montoTotal < opts.montoGarantiaRequerido) {
          errors.push(
            `Monto de garantías insuficiente. Requerido: $${opts.montoGarantiaRequerido.toLocaleString('es-MX', { minimumFractionDigits: 2 })}. ` +
            `Registrado: $${montoTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}.`
          );
        }
      }
    }

    // b) Comités
    if (opts.productoRequiereComite) {
      if (!opts.comites || opts.comites.length === 0) {
        errors.push('Se requiere un registro de comité de autorización.');
      } else {
        const autorizado = opts.comites.some(c =>
          (c.estatus || c.status || '').toLowerCase() === 'autorizado'
        );
        if (!autorizado) {
          errors.push('El comité de autorización no tiene estatus "Autorizado".');
        }
      }
    }
  }

  // c) Cargos — debe existir el subproducto "Capital" para crear la cuenta
  if (isCredito || isCaptacion) {
    if (!opts.cargos || opts.cargos.length === 0) {
      errors.push('No hay cargos registrados. Se requiere el cargo de Capital para crear la cuenta.');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ══════════════════════════════════════════════════════════════════
// F. FASE 7 — ACTIVACIÓN DE CUENTA
// ══════════════════════════════════════════════════════════════════

export function validarFase7(opts: {
  lineaProducto: string;
  solicitudesActivacion: any[];
}): ValidationResult {
  const errors: string[] = [];
  const linea = (opts.lineaProducto || '').toLowerCase();
  const isLineaCredito =
    linea.includes('línea de crédito') ||
    linea.includes('linea de credito') ||
    (linea.includes('línea') && linea.includes('créd')) ||
    (linea.includes('linea') && linea.includes('cred'));

  if (!isLineaCredito) {
    // Crédito y Captación: requieren Solicitud de Activación con estatus "Pagado"
    if (!opts.solicitudesActivacion || opts.solicitudesActivacion.length === 0) {
      errors.push(
        'No existe una Solicitud de Activación registrada. ' +
        'Cree y pague la solicitud de activación antes de activar la cuenta.'
      );
    } else {
      const pagada = opts.solicitudesActivacion.some(s =>
        (s.estatus || s.status || s.estatusPago || '').toLowerCase() === 'pagado'
      );
      if (!pagada) {
        errors.push(
          'La Solicitud de Activación no tiene estatus "Pagado". ' +
          'Confirme el pago antes de activar la cuenta.'
        );
      }
    }
  }
  // Línea de Crédito: no requiere validación de Solicitudes de Activación

  return { valid: errors.length === 0, errors };
}

// ══════════════════════════════════════════════════════════════════
// HELPER — Determinar si el producto requiere garantía/comité
// Lee del rawData del producto
// ══════════════════════════════════════════════════════════════════

export function leerRequisitosProducto(rawData: Record<string, any> | null | undefined): {
  requiereGarantia: boolean;
  requiereComite: boolean;
  montoGarantia: number;
} {
  if (!rawData) return { requiereGarantia: false, requiereComite: false, montoGarantia: 0 };

  const requiereGarantia =
    rawData.requiereGarantia === true ||
    rawData.requiere_garantia === true ||
    rawData.tieneGarantia === true ||
    String(rawData.garantia || '').toLowerCase() === 'sí' ||
    String(rawData.garantia || '').toLowerCase() === 'si';

  const requiereComite =
    rawData.requiereComite === true ||
    rawData.requiere_comite === true ||
    rawData.tieneComite === true ||
    String(rawData.comite || '').toLowerCase() === 'sí' ||
    String(rawData.comite || '').toLowerCase() === 'si';

  const montoGarantia =
    parseFloat(String(rawData.montoGarantia || rawData.monto_garantia || 0).replace(/[^0-9.-]/g, '')) || 0;

  return { requiereGarantia, requiereComite, montoGarantia };
}
