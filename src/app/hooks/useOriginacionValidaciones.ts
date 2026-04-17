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

  // Docs candidatos: incluye documentos de esta fase y fases anteriores.
  // Un documento puede haberse subido en una fase distinta a la que lo configuró
  // como obligatorio (ej: CSF subida en Fase 1 pero requerida en Fase 3).
  // Se excluyen documentos de fases FUTURAS (faseId > faseSeq).
  // NOTA: faseId puede venir como string "1" o número 1 desde distintas fuentes —
  // usar Number() para normalizar antes de comparar.
  const docsFase = documentosCargados.filter(d => {
    if (d.faseId == null) return true;           // sin faseId → aplica a todas
    const dId = Number(d.faseId);
    return isNaN(dId) || dId === 0 || dId <= faseSeq;
  });

  // Helper: normalización robusta para comparar tipoDocumento (soporta banca móvil)
  const normTipo = (s: string) => (s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const warnings: string[] = [];

  for (const req of reqFase) {
    // Matching case-insensitive + NFD para tolerar diferencias entre plataformas
    const docEncontrado = docsFase.find(d =>
      normTipo(d.tipoDocumento) === normTipo(req.tipoDocumento)
    );

    if (!docEncontrado) {
      errors.push(`Documento obligatorio no cargado: "${req.tipoDocumento}"`);
      continue;
    }
    const tieneArchivo = !!(docEncontrado.archivo || (docEncontrado as any).url || (docEncontrado as any).fileData || (docEncontrado as any).storagePath);
    if (!tieneArchivo) {
      errors.push(`Documento sin archivo adjunto: "${req.tipoDocumento}"`);
      continue;
    }
    if (docEncontrado.estatus === 'Rechazado') {
      errors.push(`Documento rechazado: "${req.tipoDocumento}". Vuelva a cargarlo.`);
      continue;
    }
    // Documento cargado pero sin validar IA → advertencia, NO bloquea el avance de fase.
    // Esto permite avanzar cuando el documento viene de banca móvil o aún no se validó con IA.
    if (docEncontrado.estatus !== 'Validado') {
      warnings.push(`Documento pendiente de validación IA: "${req.tipoDocumento}"`);
    }
  }

  // Documentos rechazados en esta fase (aunque no sean obligatorios) → sí bloquean
  const rechazados = docsFase.filter(d => d.estatus === 'Rechazado').map(d => d.tipoDocumento);
  if (rechazados.length > 0) {
    errors.push(`Documentos rechazados que deben corregirse: ${rechazados.join(', ')}`);
  }

  // Verificar duplicados
  const tipos = docsFase.map(d => normTipo(d.tipoDocumento)).filter(Boolean);
  const dupes = tipos.filter((t, i) => tipos.indexOf(t) !== i);
  if (dupes.length > 0) {
    errors.push(`Documentos duplicados: ${[...new Set(dupes)].join(', ')}`);
  }

  return { valid: errors.length === 0, errors, warnings };
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
  plantillas?: Array<{
    tipoPlantilla: string;
    estatus: 'Activo' | 'Inactivo';
    nombre?: string;
    archivoBase?: string;
  }>;
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

  // 5. Plantillas institucionales — Contrato y Pagaré activos
  if (opts.plantillas) {
    const activas = opts.plantillas.filter(p => p.estatus === 'Activo');
    const tieneContrato = activas.some(p => p.tipoPlantilla === 'contrato');
    const tienePagare = activas.some(p => p.tipoPlantilla === 'pagare');

    if (!tieneContrato) {
      const existeInactiva = opts.plantillas.some(p => p.tipoPlantilla === 'contrato' && p.estatus === 'Inactivo');
      errors.push(existeInactiva
        ? 'Plantilla "Contrato de Operación" existe pero está INACTIVA. Actívela en el subtab Plantillas del producto.'
        : 'No existe plantilla tipo "Contrato de Operación" en el subtab Plantillas del producto.'
      );
    }
    if (!tienePagare) {
      const existeInactiva = opts.plantillas.some(p => p.tipoPlantilla === 'pagare' && p.estatus === 'Inactivo');
      errors.push(existeInactiva
        ? 'Plantilla "Pagaré" existe pero está INACTIVA. Actívela en el subtab Plantillas del producto.'
        : 'No existe plantilla tipo "Pagaré" en el subtab Plantillas del producto.'
      );
    }
  } else {
    errors.push('El subtab Plantillas no existe o no contiene registros en el producto. Configure las plantillas de Contrato y Pagaré.');
  }

  // 6. Acta Constitutiva validada (Persona Moral)
  if (opts.tipoPersona === 'Moral') {
    const actaValidada = opts.documentosCargados.some(d =>
      d.estatus === 'Validado' &&
      (d.tipoDocumento?.toLowerCase().includes('acta constitutiva') ||
       d.tipoDocumento?.toLowerCase().includes('acta_constitutiva'))
    );
    if (!actaValidada) {
      errors.push('Acta Constitutiva: documento obligatorio para Persona Moral, no encontrada con estatus "Validado" en el expediente.');
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
      const aprobada = opts.solicitudesActivacion.some(s => {
        const est = (s.estatus || s.status || s.estatusPago || '').toLowerCase();
        return est === 'enviada' || est === 'pagado';
      });
      if (!aprobada) {
        errors.push(
          'La Solicitud de Activación no tiene estatus "Enviada" o "Pagado". ' +
          'Envíe o confirme el pago antes de activar la cuenta.'
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

  // Estatus válido: Pendiente, En proceso, Enviada, Pagado
  const estatusNorm = (s.estatus || '').toLowerCase().trim();
  const estatusOk   = ['pendiente', 'en proceso', 'enviada', 'pagado'].includes(estatusNorm);
  if (!estatusOk) {
    errors.push(
      `Solicitud de Activación con estatus inválido: "${s.estatus}". ` +
      'Se esperaba "Pendiente", "Enviada" o "Pagado".'
    );
}

  // El montoTransaccion de la activación es siempre el pago de 1 período (primer pago),
  // no el monto total de la solicitud — no se compara contra montoEsperado (monto total).
  if (s.montoTransaccion) {
    const montoAct = parseFloat(String(s.montoTransaccion).replace(/[^0-9.-]/g, '')) || 0;
    if (montoAct <= 0) {
      errors.push('El monto de la Solicitud de Activación debe ser mayor a $0.');
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

  // Fuente 3: fases del producto (para mapear faseId ↔ fase nombre)
  const rawFases: any[] = Array.isArray(rawData.fases) ? rawData.fases : [];

  /** Mapa: nombre fase → seq numérico */
  const faseNameToSeq: Record<string, number> = {};
  for (const f of rawFases) {
    const seq = typeof f.seq === 'number' ? f.seq : parseInt(String(f.seq), 10);
    if (f.fase && !isNaN(seq)) faseNameToSeq[f.fase.toLowerCase().trim()] = seq;
  }

  function parseFaseId(fase?: string | number): number {
    if (typeof fase === 'number') return fase;
    if (!fase) return 1;
    // Primero: buscar en el mapa de fases del producto
    const fromMap = faseNameToSeq[String(fase).toLowerCase().trim()];
    if (fromMap) return fromMap;
    // Fallback: extraer número del string
    const m = String(fase).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 1;
  }

  /** Mapeo de tipos de documento conocidos → faseId correcta (basado en flujo institucional).
   *  Tiene PRIORIDAD sobre el faseId explícito del producto — evita que configuraciones
   *  incorrectas del producto bloqueen el avance de la fase de formalización. */
  const DOC_TYPE_TO_PHASE: Record<string, number> = {
    'contrato firmado': 5,
    'contrato_firmado': 5,
    'contrato firmado por cliente': 5,
    'pagare firmado': 5,
    'pagare_firmado': 5,
    'pagaré firmado': 5,
    'pagare firmado por cliente': 5,
    'pagaré firmado por cliente': 5,
  };

  /**
   * Documentos que SOLO aplican a Persona Moral.
   * Se usan como fallback cuando el rawData no tiene campo tipoPersona.
   */
  const DOC_SOLO_MORAL = new Set([
    'acta constitutiva',
    'poder notarial',
    'rfc empresa',
    'registro ante sat (moral)',
    'estados financieros',
    'balance general',
  ]);

  /** Intenta inferir faseId por tipo de documento si no tiene faseId explícito */
  function inferFaseId(doc: any, parsedFaseId: number): number {
    // 1. Docs firmados siempre van en fase posterior — el mapa tiene prioridad absoluta
    const tipoDoc = String(doc.tipoDocumento || doc.tipo || doc.tipo_documento || '').toLowerCase().trim();
    if (DOC_TYPE_TO_PHASE[tipoDoc]) return DOC_TYPE_TO_PHASE[tipoDoc];
    // 2. Si tiene faseId/fase_id explícito, usarlo
    const explicit = doc.faseId ?? doc.fase_id;
    if (explicit != null) {
      const n = parseInt(String(explicit), 10);
      if (!isNaN(n) && n > 0) return n;
    }
    // 3. Usar el faseId parseado del string de fase
    return parsedFaseId;
  }

  const mappedExpedientes: RequisitoProducto[] = rawExpedientes.map((r: any, idx: number) => {
    const faseStr = r.fase || 'Fase 1';
    const parsedFaseId = parseFaseId(faseStr);
    const faseId = inferFaseId(r, parsedFaseId);
    const tipoDoc = (r.tipoDocumento || r.tipo_documento || r.tipo || r.claveDocumento || '').toLowerCase().trim();
    // Extraer tipoPersona del rawData; si no existe, usar fallback para docs conocidos solo-moral
    const tipoPersonaRaw = r.tipoPersona || r.tipo_persona || r.aplica_persona || r.aplicaPersona || '';
    const tipoPersona = tipoPersonaRaw || (DOC_SOLO_MORAL.has(tipoDoc) ? 'Moral' : '');
    return {
      id: r.id ?? (idx + 1),
      fase: faseStr,
      faseId,
      tipoDocumento: r.tipoDocumento || r.tipo_documento || r.tipo || r.claveDocumento || `Doc-${idx + 1}`,
      descripcion: r.descripcion || '',
      area: r.area || 'General',
      obligatorio: r.obligatorio ?? true,
      promptIA: r.promptIA || r.prompt_ia || '',
      tipoPersona,
    };
  });

  const seenTypes = new Set(mappedExpedientes.map(r => r.tipoDocumento));

  const mappedRequisitos: RequisitoProducto[] = rawRequisitos
    .filter((r: any) => r.activo !== false)
    .map((r: any, idx: number) => {
      const faseStr = r.fase || 'Fase 1';
      const parsedFaseId = parseFaseId(faseStr);
      const faseId = inferFaseId(r, parsedFaseId);
      const tipoDoc = (r.requisitoNombre || r.tipoDocumento || r.tipo_documento || '').toLowerCase().trim();
      const tipoPersonaRaw = r.tipoPersona || r.tipo_persona || r.aplica_persona || r.aplicaPersona || '';
      const tipoPersona = tipoPersonaRaw || (DOC_SOLO_MORAL.has(tipoDoc) ? 'Moral' : '');
      return {
        id: r.id ?? (10000 + idx),
        fase: faseStr,
        faseId,
        tipoDocumento: r.requisitoNombre || r.tipoDocumento || r.tipo_documento || `Requisito-${idx + 1}`,
        descripcion: r.descripcion || r.nota || '',
        area: r.area || 'General',
        obligatorio: r.obligatorio ?? true,
        promptIA: r.promptIA || r.prompt_ia || '',
        tipoPersona,
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

// ══════════════════════════════════════════════════════════════════
// H. VALIDACIÓN POR FASE — CORE bancario
// Valida SOLO documentos obligatorios cuya FaseConfigurada
// coincida EXACTAMENTE con la fase actual de la solicitud.
// ══════════════════════════════════════════════════════════════════

export interface ValidacionFaseResult {
  valido: boolean;
  faltantes: string[];
  pendientesValidacion: string[];
  documentosValidados: string[];
  faseActual: string;
  motivos: string[];
}

/**
 * Valida los documentos obligatorios de la fase actual de la solicitud.
 *
 * REGLA PRINCIPAL:
 * Solo valida documentos cuyo FaseConfigurada coincida EXACTAMENTE
 * con la fase actual. No valida documentos de fases futuras o pasadas.
 *
 * Para cada documento obligatorio de esta fase, verifica:
 * 1. Que esté cargado en el expediente electrónico
 * 2. Que haya sido validado por la IA de documentos
 * 3. Que el tipo coincida con el configurado
 * 4. Que tenga archivo adjunto (legible)
 * 5. Que no esté rechazado
 *
 * @param faseActualSeq     — secuencia de la fase actual (1, 2, 3, 4...)
 * @param faseActualNombre  — nombre legible de la fase (ej: "Integración Expediente")
 * @param requisitos        — documentos configurados en el producto (Sección 1)
 * @param documentosCargados — documentos en el expediente (Sección 2)
 * @param tipoPersona       — tipo de persona del cliente
 */
export function validarDocumentosPorFase(
  faseActualSeq: number,
  faseActualNombre: string,
  requisitos: RequisitoProducto[],
  documentosCargados: DocumentoCargado[],
  tipoPersona: string,
): ValidacionFaseResult {
  console.log(`[validarDocumentosPorFase] tipoPersona recibido: "${tipoPersona}"`);
  const faltantes: string[] = [];
  const pendientesValidacion: string[] = [];
  const documentosValidados: string[] = [];
  const motivos: string[] = [];

  // ── PASO 1: Filtrar DocumentosRequeridosEnEstaFase ──
  // Solo documentos donde FaseConfigurada == FaseActual Y EsObligatorio == true
  const reqDeFase = requisitos.filter(r => {
    const rFaseSeq = typeof r.faseId === 'number' ? r.faseId : (parseInt(String(r.faseId)) || 0);
    if (rFaseSeq !== faseActualSeq) return false;
    if (!r.obligatorio) return false;

    // Filtro por tipo de persona
    const persona = String(r.tipoPersona || (r as any).persona || '').toLowerCase().trim();
    if (!persona || persona.includes('todo') || persona.includes('all')) return true;
    const tp = tipoPersona.toLowerCase();
    console.log(`[validarDocumentosPorFase] "${r.tipoDocumento}" persona="${persona}" tp="${tp}"`);
    // Si el doc es solo para Moral y el cliente es Física → excluir
    if (persona.includes('moral') && !tp.includes('moral')) {
      console.log(`[validarDocumentosPorFase] EXCLUYENDO "${r.tipoDocumento}" - es para Moral, cliente es ${tipoPersona}`);
      return false;
    }
    // Si el doc es solo para Física y el cliente es Moral → excluir
    if ((persona.includes('física') || persona.includes('fisica') || persona.includes('fisic')) && tp.includes('moral')) return false;
    return true;
  });

  // DEBUG: Log de filtrado por fase
  console.log(`[validarFase] ═══ Fase ${faseActualSeq} "${faseActualNombre}" ═══`);
  console.log(`[validarFase] Requisitos totales: ${requisitos.length}`);
  console.log(`[validarFase] Requisitos por fase:`, requisitos.map(r => `"${r.tipoDocumento}" → faseId=${r.faseId} oblig=${r.obligatorio}`));
  console.log(`[validarFase] Requisitos de ESTA fase (${faseActualSeq}): ${reqDeFase.length}`, reqDeFase.map(r => r.tipoDocumento));
  console.log(`[validarFase] Documentos cargados: ${documentosCargados.length}`, documentosCargados.map(d => `"${d.tipoDocumento}" → faseId=${d.faseId} estatus=${d.estatus}`));

  // Si no hay documentos obligatorios para esta fase → válida automáticamente
  if (reqDeFase.length === 0) {
    return {
      valido: true,
      faltantes: [],
      pendientesValidacion: [],
      documentosValidados: [],
      faseActual: faseActualNombre,
      motivos: [`No hay documentos obligatorios configurados para la fase "${faseActualNombre}".`],
    };
  }

  // ── PASO 2: Documentos candidatos para búsqueda ──
  // Se excluyen documentos de fases FUTURAS (faseId > faseActualSeq) para no
  // contar adelantados, pero se aceptan documentos de cualquier fase anterior
  // o sin faseId, ya que un documento puede haberse subido en una fase distinta
  // a la que lo configuró como obligatorio (ej: CSF subida en Fase 1 pero requerida en Fase 3).
  const docsDeFase = documentosCargados.filter(d => {
    if (d.faseId == null) return true; // sin faseId → se incluye para búsqueda
    const dId = Number(d.faseId);
    if (isNaN(dId) || dId === 0) return true; // faseId inválido → se incluye
    return dId <= faseActualSeq; // solo documentos de esta fase o anteriores
  });

  console.log(`[validarFase] Documentos de ESTA fase o anteriores (${faseActualSeq}): ${docsDeFase.length}`, docsDeFase.map(d => d.tipoDocumento));
  console.log(`[validarFase] Documentos excluidos (fase futura):`, documentosCargados.filter(d => !docsDeFase.includes(d)).map(d => `"${d.tipoDocumento}"→faseId=${d.faseId}`));

  // Documentos que se auto-satisfacen por el hecho de existir una solicitud activa
  const DOC_AUTO_VALIDOS = new Set([
    'solicitud de credito',
    'solicitud de crédito',
    'solicitud credito',
    'formulario de solicitud',
    'solicitud',
  ]);

  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // ── PASO 3: Validar cada documento requerido ──
  for (const req of reqDeFase) {
    const nombreDoc = req.tipoDocumento;
    const nombreNorm = normalize(nombreDoc);

    // Documentos auto-generados por el sistema → se consideran válidos automáticamente
    if (DOC_AUTO_VALIDOS.has(nombreNorm)) {
      documentosValidados.push(nombreDoc);
      continue;
    }

    // 1. ¿Está cargado en el expediente? (con normalización de acentos)
    const docCargado = docsDeFase.find(d =>
      normalize(d.tipoDocumento || '') === nombreNorm
    );

    if (!docCargado) {
      faltantes.push(nombreDoc);
      motivos.push(`"${nombreDoc}": no cargado en el expediente electrónico.`);
      continue;
    }

    // 2. ¿Tiene archivo adjunto? (legible)
    const tieneArchivo = !!(docCargado.archivo || (docCargado as any).url || docCargado.fileData || (docCargado as any).storagePath);
    if (!tieneArchivo) {
      faltantes.push(nombreDoc);
      motivos.push(`"${nombreDoc}": cargado pero sin archivo adjunto.`);
      continue;
    }

    // 3. ¿Está rechazado?
    if (docCargado.estatus === 'Rechazado') {
      faltantes.push(nombreDoc);
      motivos.push(`"${nombreDoc}": rechazado. Debe volver a cargarlo.`);
      continue;
    }

    // 4. ¿Fue validado por IA?
    // Documentos de banca móvil y docs recién subidos no tienen validación IA aún.
    // Se registran como pendientes de validación (advertencia) pero NO bloquean el avance de fase.
    if (!docCargado.validadoIA || docCargado.estatus !== 'Validado') {
      pendientesValidacion.push(nombreDoc);
      motivos.push(`"${nombreDoc}": archivo presente pero pendiente de validación IA.`);
      // ✅ No hacemos continue — el documento SÍ cuenta como cubierto
    }

    // ✅ Documento con archivo presente (validado o pendiente de IA)
    documentosValidados.push(nombreDoc);
  }

  // ── Verificar documentos rechazados en esta fase (aunque no sean obligatorios) ──
  const rechazados = docsDeFase.filter(d => d.estatus === 'Rechazado');
  for (const r of rechazados) {
    if (!faltantes.includes(r.tipoDocumento)) {
      faltantes.push(r.tipoDocumento);
      motivos.push(`"${r.tipoDocumento}": rechazado. Debe corregirlo.`);
    }
  }

  // Solo los "faltantes" (sin archivo o rechazados) bloquean el avance.
  // Los "pendientesValidacion" (tienen archivo pero sin IA) son advertencias, no bloquean.
  const valido = faltantes.length === 0;

  return {
    valido,
    faltantes,
    pendientesValidacion,
    documentosValidados,
    faseActual: faseActualNombre,
    motivos,
  };
}
