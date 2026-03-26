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
import type { SolicitudActivacionListItem } from '../components/solicitudes-activacion/solicitudActivacionStore';

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
// D1. FASE 4 — VALIDACIÓN PARA "ENVIAR DE FASE"
// Complementa validarDocumentosFase(): verifica Términos, Garantías y Comités.
// ══════════════════════════════════════════════════════════════════

/**
 * Valida que Términos y Condiciones, Garantías (si aplica) y Comités (si aplica)
 * estén completos antes de avanzar desde Fase 4.
 * Los documentos de la fase ya se validaron mediante validarDocumentosFase().
 */
export function validarFase4Envio(opts: {
  terminos: Record<string, any>;
  garantias: any[];
  comites: any[];
  productoRequiereGarantia: boolean;
  productoRequiereComite: boolean;
}): ValidationResult {
  const errors: string[] = [];

  // 1. Términos y Condiciones completos
  const t = opts.terminos || {};
  const tieneTerminos =
    (t.monto || t.montoSolicitado) &&
    (t.plazo || t.plazoMeses) &&
    (t.tasa || t.tasaAnual);
  if (!tieneTerminos) {
    errors.push('Términos y Condiciones incompletos. Verifique monto, plazo y tasa antes de avanzar.');
  }

  // 2. Garantías (si el producto lo requiere)
  if (opts.productoRequiereGarantia) {
    if (!opts.garantias || opts.garantias.length === 0) {
      errors.push('El producto requiere garantías registradas antes de avanzar de fase.');
    }
  }

  // 3. Comités (si el producto lo requiere)
  if (opts.productoRequiereComite) {
    if (!opts.comites || opts.comites.length === 0) {
      errors.push('El producto requiere comité de autorización antes de avanzar de fase.');
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
// D2. FASE 5 — CONTRATOS Y PAGARÉS
// ══════════════════════════════════════════════════════════════════

/**
 * Valida que existan contratos y pagarés firmados en Sección 2.
 * Por cada documento: debe existir, tener archivo adjunto, no estar rechazado y estar validado.
 */
export function validarContratosYPagares(documentosCargados: DocumentoCargado[]): ValidationResult {
  const errors: string[] = [];

  const pagares = documentosCargados.filter(d => {
    const tipo = (d.tipoDocumento || '').toLowerCase();
    return tipo.includes('pagaré') || tipo.includes('pagare');
  });

  const contratos = documentosCargados.filter(d => {
    const tipo = (d.tipoDocumento || '').toLowerCase();
    return tipo.includes('contrato');
  });

  // ── Pagarés ──────────────────────────────────────────────────────────────
  if (pagares.length === 0) {
    errors.push('No se han cargado pagarés. Cargue y valide el pagaré antes de avanzar.');
  } else {
    for (const d of pagares) {
      if (!d.archivo && !(d as any).url && !(d as any).fileData) {
        errors.push(`Pagaré sin archivo adjunto: "${d.tipoDocumento}". Adjunte el documento firmado.`);
      } else if (d.estatus === 'Rechazado') {
        errors.push(`Pagaré rechazado: "${d.tipoDocumento}". Vuelva a cargar el documento.`);
      } else if (d.estatus !== 'Validado') {
        errors.push(`Pagaré pendiente de validación: "${d.tipoDocumento}"`);
      }
    }
  }

  // ── Contratos ─────────────────────────────────────────────────────────────
  if (contratos.length === 0) {
    errors.push('No se han cargado contratos. Cargue y valide el contrato antes de avanzar.');
  } else {
    for (const d of contratos) {
      if (!d.archivo && !(d as any).url && !(d as any).fileData) {
        errors.push(`Contrato sin archivo adjunto: "${d.tipoDocumento}". Adjunte el documento firmado.`);
      } else if (d.estatus === 'Rechazado') {
        errors.push(`Contrato rechazado: "${d.tipoDocumento}". Vuelva a cargar el documento.`);
      } else if (d.estatus !== 'Validado') {
        errors.push(`Contrato pendiente de validación: "${d.tipoDocumento}"`);
      }
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
// G. VALIDAR RESULTADO DE SOLICITUD DE ACTIVACIÓN (post-cierre modal, Fase 6)
// ══════════════════════════════════════════════════════════════════

/**
 * Valida el item guardado por el módulo externo de Solicitudes de Activación.
 * Originación llama esta función DESPUÉS de que el modal se cierra con datos
 * para decidir si avanza de fase.
 *
 * Reglas (Spec §B.4):
 *  - Solicitud de Activación debe existir
 *  - Estatus debe ser "Pendiente" o "En proceso"
 *  - Monto (si se provee) debe coincidir con el monto de la originación (±$1)
 */
export function validarResultadoActivacion(opts: {
  savedItem: SolicitudActivacionListItem | null | undefined;
  montoEsperado?: number;
}): ValidationResult {
  const errors: string[] = [];
  const s = opts.savedItem;

  if (!s) {
    errors.push('No se encontró la Solicitud de Activación guardada.');
    return { valid: false, errors };
  }

  // Estatus válido: Pendiente o En proceso
  const estatusNorm = (s.estatus || '').toLowerCase().trim();
  const estatusOk   = estatusNorm === 'pendiente' || estatusNorm === 'en proceso';
  if (!estatusOk) {
    errors.push(
      `Solicitud de Activación con estatus inválido: "${s.estatus}". ` +
      'Se esperaba "Pendiente" o "En proceso".'
    );
  }

  // Monto debe coincidir (tolerancia ±$1 para diferencias de redondeo)
  if (opts.montoEsperado !== undefined && opts.montoEsperado > 0 && s.montoTransaccion) {
    const montoAct = parseFloat(String(s.montoTransaccion).replace(/[^0-9.-]/g, '')) || 0;
    if (montoAct > 0 && Math.abs(montoAct - opts.montoEsperado) > 1) {
      errors.push(
        `El monto de la Solicitud de Activación ($${montoAct.toLocaleString('es-MX', { minimumFractionDigits: 2 })}) ` +
        `no coincide con el monto de la originación ($${opts.montoEsperado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}).`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

// ══════════════════════════════════════════════════════════════════
// HELPER — Extraer RequisitoProducto[] del rawData del producto
// Soporta todas las fuentes: expedientesElectronicos, expedientesRegistros,
// expedientes, requisitos — igual que ExpedienteElectronicoTab.tsx
// ══════════════════════════════════════════════════════════════════

/**
 * Extrae y normaliza los requisitos de expediente del rawData del producto.
 * Fusiona expedientesElectronicos + requisitos sin duplicar tipoDocumento.
 * No necesita catalogoDocs (se omite promptIA — no requerido para validación).
 */
export function getRequisitosFromRawData(rawData: Record<string, any> | null | undefined): RequisitoProducto[] {
  if (!rawData) return [];

  // Fuente 1: expedientesElectronicos / expedientesRegistros / expedientes
  const rawExpedientes: any[] =
    Array.isArray(rawData.expedientesElectronicos) ? rawData.expedientesElectronicos
    : Array.isArray(rawData.expedientesRegistros) ? rawData.expedientesRegistros
    : Array.isArray(rawData.expedientes) ? rawData.expedientes
    : [];

  // Fuente 2: requisitos (RequisitosTab)
  const rawRequisitos: any[] = Array.isArray(rawData.requisitos) ? rawData.requisitos : [];

  function parseFaseId(fase?: string | number): number {
    if (typeof fase === 'number') return fase;
    if (!fase) return 1;
    const m = String(fase).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  }

  const mappedExpedientes: RequisitoProducto[] = rawExpedientes.map((r: any, idx: number) => {
    const faseStr = r.fase || 'Fase 1';
    return {
      id: r.id ?? (idx + 1),
      fase: faseStr,
      faseId: r.faseId ?? r.fase_id ?? parseFaseId(faseStr),
      tipoDocumento: r.tipo || r.tipo_documento || r.claveDocumento || `Doc-${idx + 1}`,
      descripcion: r.descripcion || '',
      area: r.area || 'General',
      obligatorio: r.obligatorio ?? true,
      promptIA: r.promptIA || r.prompt_ia || '',
    };
  });

  const seenTypes = new Set(mappedExpedientes.map(r => r.tipoDocumento));

  const mappedRequisitos: RequisitoProducto[] = rawRequisitos
    .filter((r: any) => r.activo !== false)
    .map((r: any, idx: number) => {
      const faseStr = r.fase || 'Fase 1';
      return {
        id: r.id ?? (10000 + idx),
        fase: faseStr,
        faseId: r.faseId ?? r.fase_id ?? parseFaseId(faseStr),
        tipoDocumento: r.requisitoNombre || r.tipoDocumento || r.tipo_documento || `Requisito-${idx + 1}`,
        descripcion: r.descripcion || r.nota || '',
        area: r.area || 'General',
        obligatorio: r.obligatorio ?? true,
        promptIA: r.promptIA || r.prompt_ia || '',
      };
    })
    .filter((r: RequisitoProducto) => !seenTypes.has(r.tipoDocumento));

  return [...mappedExpedientes, ...mappedRequisitos];
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
