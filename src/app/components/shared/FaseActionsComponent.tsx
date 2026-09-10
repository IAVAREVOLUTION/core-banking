/**
 * FaseActionsComponent — Barra de acciones de fase.
 *
 * Fuente de verdad: fases[] del producto + faseActualId (del DTO/BD).
 * NO usa hardcoded fase names ni índices calculados manualmente.
 *
 * MODO 'solicitudes' → solo "Enviar de Fase"
 * MODO 'originacion' → todos los botones aplicables (siempre visibles, ignora readOnly)
 *
 * Botones por nombre de fase (fuente de verdad exclusiva — sin fallback por seq):
 *  seq 1                          → Imprimir Solicitud + Enviar
 *  nombre contiene "formaliz"     → Enviar + Formalizar Contrato + Regresar
 *  nombre contiene "activac"             → Solicitud de Activación + Regresar
 *  nombre contiene "activac"+"financiera" → Enviar (ejecuta promptIA) + Regresar
 *  nombre contiene "activar cuen"         → Activar Cuenta + Regresar
 *  resto                          → Enviar + Regresar
 */
import type { SolicitudFormData } from '../solicitudes/solicitudCreditoStore';
import type { FaseProductoItem } from '../../hooks/useFaseConsistency';
import { useFaseConsistency } from '../../hooks/useFaseConsistency';

export type { FaseProductoItem };

interface FaseActionsComponentProps {
  /** Lista de fases del producto — fuente de verdad */
  fases: FaseProductoItem[];
  /** ID de la fase actual (formData.faseId, guardado en BD) */
  faseActualId: string;
  /** Datos del formulario */
  formData: SolicitudFormData;
  /** storageId para leer subtabs desde sessionStorage */
  storageId: string | number;
  /** 'solicitudes' → solo Enviar | 'originacion' → todos los botones */
  modo: 'solicitudes' | 'originacion';
  /** Avanzar fase (fases 1-5) */
  onEnviarFase: () => void;
  /** Regresar fase (requiere nota ≤30 min — validado en el llamador) */
  onRegresarFase?: () => void;
  /** Generar Solicitud (Fase 2) */
  onGenerarSolicitud?: () => void;
  /** Formalizar Contrato (Fase 4) */
  onFormalizarContrato?: () => void;
  /**
   * Generar el Pagare desde la plantilla del producto. Se ofrece en lugar de
   * "Generar Documentos" cuando el producto no emite contrato: la fase
   * "Formalizacion de Pagare" contiene "formaliz", asi que activaba el boton de
   * formalizacion de CONTRATO, que no es lo que ese producto produce.
   */
  onGenerarPagare?: () => void;
  /** Solicitud de Activación (Fase 6) */
  onSolicitudActivacion?: () => void;
  /** Activar Cuenta (Fase 7) */
  onActivarCuenta?: () => void;
  /**
   * Indica si el botón "Activar Cuenta" está habilitado.
   * false → se muestra deshabilitado + banner "La Solicitud de Activación no está pagada."
   * Si se omite (undefined) → habilitado por defecto.
   */
  canActivarCuenta?: boolean;
  /** Indica si hay una operación de fase en curso */
  enviandoFase?: boolean;
  /**
   * Plantillas del producto. Se usa para no ofrecer "Imprimir Solicitud" en
   * productos que no emiten ese documento (p. ej. Garantía Financiera 2o Piso,
   * que solo tiene Carta Oferta y Contrato GPO).
   */
  plantillasProducto?: { tipoPlantilla?: string; estatus?: string }[];
  /** Solicitud de Activación existente (para fase 3+) */
  existingActivacion?: { id: string; estatus: string } | null;
  /** Generar Factura de Pago Inicial — Arrendamiento Puro, fase "Recaudación Inicial y Compra" */
  onGenerarFacturaInicial?: () => void;
  /** Generar Factura del Proveedor (CFDI) — Arrendamiento Puro, fase "Recepción del Activo y Cierre" */
  onGenerarFacturaProveedor?: () => void;
  /** true si el producto es Arrendamiento Puro — habilita los botones de factura */
  esArrendamientoPuro?: boolean;
  /** true si la factura de la fase ya fue generada (evita duplicar) */
  facturaInicialGenerada?: boolean;
  facturaProveedorGenerada?: boolean;
}

export function FaseActionsComponent({
  fases,
  faseActualId,
  formData,
  modo,
  onEnviarFase,
  onRegresarFase,
  onGenerarSolicitud,
  onFormalizarContrato,
  onGenerarPagare,
  onSolicitudActivacion,
  onActivarCuenta,
  canActivarCuenta,
  enviandoFase = false,
  plantillasProducto,
  existingActivacion,
  onGenerarFacturaInicial,
  onGenerarFacturaProveedor,
  esArrendamientoPuro = false,
  facturaInicialGenerada = false,
  facturaProveedorGenerada = false,
}: FaseActionsComponentProps) {
  // ── Fuente de verdad ─────────────────────────────────────────────────────
  const { faseActualReal, seqActual, faseSiguiente, faseAnterior, isConsistent, inconsistencias } =
    useFaseConsistency({ fases, faseActualId });

  const estatus = formData.estatusSolicitud || '';

  // ── Consistencia: advertencia visual si hay desinc ───────────────────────
  const inconsistencyBanner = !isConsistent && (
    <div className="bg-yellow-50 border border-yellow-300 rounded px-3 py-2 mb-2 text-xs text-yellow-800">
      <strong>⚠ Desincronización detectada</strong>
      <ul className="mt-1 list-disc ml-4 space-y-0.5">
        {inconsistencias.map((msg, i) => (
          <li key={i}>{msg}</li>
        ))}
      </ul>
    </div>
  );

  // ── Helpers de nombre de fase ─────────────────────────────────────────────
  const faseNombre = (faseActualReal?.fase || formData.descripcionFase || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  /** true si el nombre de la fase contiene alguna de las palabras clave */
  const faseContiene = (...keywords: string[]) =>
    keywords.some(k => faseNombre.includes(k));

  // ── Visibilidad de botones — detección exclusivamente por nombre de fase ──
  // "Solicitud de Activación" — nombre contiene "solicitud" + "activac" (NO "activar cuenta")
  const puedeSolicitudActivacion =
    faseContiene('solicitud') && faseContiene('activac') && !faseContiene('activar cuenta', 'activar_cuenta');

  // "Activar cuenta y finalizar" — solo para Línea de Crédito en fase "Activación Cuenta Financiera"
  const lpLower = (formData.lineaProducto || '').toLowerCase();
  const esLineaCredito = lpLower.includes('nea') && lpLower.includes('cr');
  const esCuentaFinanciera = esLineaCredito && faseContiene('activac');
  /** Actividad 7.1 del BPM GPO (Fase 4) — mismo botón de "Enviar de Fase", sólo cambia la etiqueta. */
  const esValidacionClausulasFiduciarias = faseContiene('clausulas fiduciarias', 'clausula fiduciaria');

  // Fase de activación pura — solo si NO es "Activación Cuenta Financiera" ni similar
  // Excluir fases que contengan "cuenta" o "financier" porque esas son activaciones directas
  const puedeVerActivacion =
    !puedeSolicitudActivacion &&
    !esCuentaFinanciera &&
    faseContiene('activac') &&
    !faseContiene('activar cuenta', 'activar_cuenta') &&
    !faseContiene('cuenta', 'financier');

  // "Activar Cuenta" — nombre contiene "activar cuenta"
  const puedeActivarCuenta = faseContiene('activar cuenta', 'activar_cuenta');

  // "Formalizar Contrato" — nombre contiene "formaliz" (no cualquier mención de "contrato")
  const emitePlantilla = (tipo: string) =>
    !Array.isArray(plantillasProducto)
    || plantillasProducto.length === 0
    || plantillasProducto.some(pl => pl?.tipoPlantilla === tipo && pl?.estatus === 'Activo');

  const enFaseFormalizacion = faseContiene('formaliz');
  // El producto que no emite contrato no debe ver "Generar Documentos"; si emite
  // pagare, la accion de esa fase es generar el pagare.
  const puedeFormalizar = enFaseFormalizacion && emitePlantilla('contrato');
  const puedeGenerarPagare =
    enFaseFormalizacion && !emitePlantilla('contrato') && emitePlantilla('pagare');

  // "Imprimir Solicitud" — primera fase Y que el producto emita ese documento.
  // Antes bastaba con `seqActual === 1`, asi que aparecia en cualquier producto
  // cuya fase 1 fuera otra cosa (en GPO es "Admision y Captura del Ecosistema",
  // que no imprime solicitud alguna). Se decide por lo que el producto declara.
  const tienePlantillaSolicitud =
    !Array.isArray(plantillasProducto)
    || plantillasProducto.length === 0   // sin dato: comportamiento previo
    || plantillasProducto.some(pl => pl?.tipoPlantilla === 'solicitud' && pl?.estatus === 'Activo');
  const puedeGenerarSolicitud = seqActual === 1 && tienePlantillaSolicitud;

  // "Activación Cuenta Financiera" ya finalizada cuando estatus = Autorizada/Aprobado
  const cuentaFinancieraYaFinalizada =
    esCuentaFinanciera && (estatus === 'Autorizada' || estatus === 'Aprobado');

  // Facturas de Arrendamiento Puro — se detectan por nombre de fase, igual que
  // el resto de los botones, para no depender del número consecutivo.
  const puedeFacturaInicial =
    esArrendamientoPuro && !facturaInicialGenerada &&
    faseContiene('recaudacion') && faseContiene('compra');
  const puedeFacturaProveedor =
    esArrendamientoPuro && !facturaProveedorGenerada &&
    faseContiene('recepcion') && faseContiene('activo');

  // Última fase del flujo (sin fase siguiente) que aún no se ha cerrado.
  // Sin esto el botón desaparecía al llegar al final y el proceso no se podía
  // terminar: puedeEnviar exigía faseSiguiente.
  const procesoYaCerrado = estatus === 'Autorizada' || estatus === 'Aprobado';
  const esCierreDeProceso = !faseSiguiente && !esCuentaFinanciera && !procesoYaCerrado;

  // "Enviar de Fase" — incluye "Activación Cuenta Financiera" solo si aún no está finalizada
  const puedeEnviar =
    (!!faseSiguiente || (esCuentaFinanciera && !cuentaFinancieraYaFinalizada) || esCierreDeProceso) &&
    !puedeSolicitudActivacion &&
    !puedeVerActivacion &&
    !puedeActivarCuenta;


  /**
   * El flujo ya no admite avanzar: es un estado TERMINAL, no uno "en proceso".
   * Se usa para que la barra deje de verse igual que una fase en curso y para
   * degradar "Regresar de Fase", que aquí es una correccion y no el camino
   * principal — presentarla como accion primaria invita a deshacer un cierre.
   */
  const flujoCerrado = !puedeEnviar && !puedeSolicitudActivacion && !puedeActivarCuenta;
  /** Para decir "2 de 2" en vez de "#2": un numero sin escala no informa avance. */
  const totalFases = Array.isArray(fases) ? fases.length : 0;

  // Todas las fases con anterior
  const puedeRegresar = !!faseAnterior;

  // ── Modo Solicitudes: Enviar + Imprimir Solicitud + Formalizar + Activación + Activar ─────
  if (modo === 'solicitudes') {
    // Activación Cuenta Financiera ya completada → panel de flujo finalizado
    if (cuentaFinancieraYaFinalizada) {
      return (
        <div className="bg-green-50 border border-green-300 rounded px-4 py-3 mb-4 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="text-sm text-green-800">
            Flujo finalizado — <strong>{faseActualReal?.fase || formData.descripcionFase || '—'}</strong>
            {estatus && <span className="ml-2 px-1.5 py-0.5 bg-green-200 text-green-900 rounded text-xs">{estatus}</span>}
          </span>
        </div>
      );
    }

    const tieneAccion = puedeEnviar || puedeGenerarSolicitud || puedeFormalizar || puedeSolicitudActivacion || puedeVerActivacion || puedeActivarCuenta;
    if (!tieneAccion) {
      return (
        <div className="bg-green-50 border border-green-300 rounded px-4 py-3 mb-4 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="text-sm text-green-800">
            Solicitud en última fase: <strong>{faseActualReal?.fase || formData.descripcionFase || '—'}</strong>
          </span>
        </div>
      );
    }

    return (
      <>
        {inconsistencyBanner}
        <div className={`rounded px-4 py-3 mb-4 border ${flujoCerrado ? 'bg-[#F0FDF4] border-[#16A34A]' : 'bg-[#EBF3FB] border-[#4A6FA5]'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-700">
              <strong>Fase actual:</strong>{' '}
              {faseActualReal?.fase || formData.descripcionFase || '—'}
              {seqActual > 0 && (
                <span className="ml-1 text-gray-400">(#{seqActual})</span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {/* ── Fase 1: Imprimir Solicitud ── */}
              {puedeGenerarSolicitud && (
                <button
                  onClick={onGenerarSolicitud}
                  disabled={enviandoFase || !onGenerarSolicitud}
                  className="px-4 py-1.5 bg-[#0369A1] text-white rounded text-xs hover:bg-[#075985] flex items-center gap-1.5 disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                  Imprimir Solicitud
                </button>
              )}
              {/* ── Fase Solicitud de Activación: crear/editar ── */}
              {puedeSolicitudActivacion && (
                <button
                  onClick={onSolicitudActivacion}
                  disabled={enviandoFase || !onSolicitudActivacion}
                  className="px-4 py-1.5 bg-[#2E5C91] text-white rounded text-xs hover:bg-[#1E4A75] flex items-center gap-1.5 disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4" />
                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
                  </svg>
                  {enviandoFase ? 'Procesando...' : existingActivacion ? 'Ver Solicitud de Activación' : 'Solicitud de Activación'}
                </button>
              )}
              {/* ── Fase Activación (sin "solicitud"): abrir formulario para activar ── */}
              {puedeVerActivacion && (
                <button
                  onClick={onSolicitudActivacion}
                  disabled={enviandoFase || !onSolicitudActivacion}
                  className="px-4 py-1.5 bg-[#2E5C91] text-white rounded text-xs hover:bg-[#1E4A75] flex items-center gap-1.5 disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 12l2 2 4-4" />
                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
                  </svg>
                  {enviandoFase ? 'Procesando...' : existingActivacion ? 'Solicitud de Activación' : 'Solicitud de Activación'}
                </button>
              )}
              {/* ── Activar Cuenta ── */}
              {puedeActivarCuenta && (
                <button
                  onClick={onActivarCuenta}
                  disabled={enviandoFase || !onActivarCuenta || canActivarCuenta === false}
                  title={canActivarCuenta === false ? 'La Solicitud de Activación debe estar Enviada o Pagada.' : undefined}
                  className="px-4 py-1.5 bg-[#059669] text-white rounded text-xs hover:bg-[#047857] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z" />
                    <path d="M8 12l3 3 5-5" />
                  </svg>
                  {enviandoFase ? 'Activando...' : 'Activar Cuenta'}
                </button>
              )}
              {/* ── Fase Formalización: Generar Documentos ── */}
              {puedeFormalizar && (
                <button
                  onClick={onFormalizarContrato}
                  disabled={enviandoFase || !onFormalizarContrato}
                  className="px-4 py-1.5 bg-[#7C3AED] text-white rounded text-xs hover:bg-[#6D28D9] flex items-center gap-1.5 disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                  {enviandoFase ? 'Generando...' : 'Generar Documentos'}
                </button>
              )}
              {/* ── Fase Formalizacion de Pagare: generar el Pagare ── */}
              {puedeGenerarPagare && onGenerarPagare && (
                <button
                  onClick={onGenerarPagare}
                  disabled={enviandoFase}
                  className="px-4 py-1.5 bg-[#0F766E] text-white rounded text-xs hover:bg-[#0D5F58] flex items-center gap-1.5 disabled:opacity-50"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6M8 13h8" />
                  </svg>
                  {enviandoFase ? 'Generando...' : 'Generar Pagaré'}
                </button>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Modo Originación: Activación Cuenta Financiera ya completada → panel verde ──
  if (cuentaFinancieraYaFinalizada) {
    return (
      <>
        {inconsistencyBanner}
        <div className="bg-green-50 border border-green-300 rounded px-4 py-3 mb-4 flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span className="text-sm text-green-800">
            Flujo finalizado — <strong>{faseActualReal?.fase || formData.descripcionFase || '—'}</strong>
            {estatus && <span className="ml-2 px-1.5 py-0.5 bg-green-200 text-green-900 rounded text-xs">{estatus}</span>}
          </span>
        </div>
      </>
    );
  }


  // ── Modo Originación: todos los botones, siempre visibles ────────────────
  return (
    <>
      {inconsistencyBanner}

      <div className={`rounded px-4 py-3 mb-4 border ${flujoCerrado ? 'bg-[#F0FDF4] border-[#16A34A]' : 'bg-[#EBF3FB] border-[#4A6FA5]'}`}>
        {/* Fila info + botones */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Icono de estado: un cierre se reconoce antes de leer nada. */}
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              flujoCerrado ? 'bg-[#16A34A] text-white' : 'bg-[#4A6FA5] text-white'
            }`}>
              {flujoCerrado ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
                </svg>
              )}
            </div>

            <div className="min-w-0">
              {/* Titular: en estado terminal manda el RESULTADO; en curso, la fase. */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-semibold ${flujoCerrado ? 'text-green-800' : 'text-gray-800'}`}>
                  {flujoCerrado ? 'Proceso completado' : (faseActualReal?.fase || formData.descripcionFase || '—')}
                </span>
                {estatus && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      estatus === 'Aprobado' || estatus === 'Autorizada'
                        ? 'bg-green-100 text-green-800'
                        : estatus === 'En Proceso' || estatus === 'En proceso'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {estatus}
                  </span>
                )}
              </div>

              {/* Subtitulo: avance real ("2 de 2") en vez de un "#2" sin escala. */}
              <div className="text-[11px] text-gray-600 mt-0.5">
                {flujoCerrado
                  ? <>Última fase: <span className="text-gray-800">{faseActualReal?.fase || formData.descripcionFase || '—'}</span></>
                  : <>Fase</>}
                {totalFases > 0 && seqActual > 0 && (
                  <span className={flujoCerrado ? 'ml-1 text-gray-500' : 'ml-1 text-gray-700'}>
                    {flujoCerrado ? `(${seqActual} de ${totalFases})` : `${seqActual} de ${totalFases}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* ── Arrendamiento Puro · Fase "Recaudación Inicial y Compra" ── */}
            {puedeFacturaInicial && onGenerarFacturaInicial && (
              <button
                onClick={onGenerarFacturaInicial}
                disabled={enviandoFase}
                title="Genera la factura del pago inicial y la registra en Avisos de Vencimiento"
                className="px-4 py-1.5 bg-[#B45309] text-white rounded text-xs hover:bg-[#92400E] flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 3h12l4 4v14H4z" />
                  <path d="M8 11h8M8 15h5" />
                </svg>
                Generar Factura de Pago Inicial
              </button>
            )}

            {/* ── Arrendamiento Puro · Fase "Recepción del Activo y Cierre" ── */}
            {puedeFacturaProveedor && onGenerarFacturaProveedor && (
              <button
                onClick={onGenerarFacturaProveedor}
                disabled={enviandoFase}
                title="Genera el CFDI del proveedor del bien y crea la cuenta por pagar"
                className="px-4 py-1.5 bg-[#7C3AED] text-white rounded text-xs hover:bg-[#6D28D9] flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 3h12l4 4v14H4z" />
                  <path d="M9 13l2 2 4-4" />
                </svg>
                Generar Factura del Proveedor
              </button>
            )}

            {/* ── Fases 1-5: Enviar de Fase ── */}
            {puedeEnviar && (
              <button
                onClick={onEnviarFase}
                disabled={enviandoFase}
                className="px-4 py-1.5 bg-[#10B981] text-white rounded text-xs hover:bg-[#059669] flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                {enviandoFase
                  ? 'Procesando...'
                  : esCuentaFinanciera
                    ? 'Activar cuenta y finalizar'
                    : esCierreDeProceso
                      ? 'Cerrar proceso'
                      : esValidacionClausulasFiduciarias
                        ? 'Ejecutar Formalización Legal y Cierre de Solicitud'
                        : 'Enviar de Fase'}
              </button>
            )}

            {/* ── Fase Solicitud de Activación: crear/editar ── */}
            {puedeSolicitudActivacion && (
              <button
                onClick={onSolicitudActivacion}
                disabled={enviandoFase || !onSolicitudActivacion}
                className="px-4 py-1.5 bg-[#2E5C91] text-white rounded text-xs hover:bg-[#1E4A75] flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4" />
                  <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" />
                </svg>
                {enviandoFase ? 'Procesando...' : existingActivacion ? 'Ver Solicitud de Activación' : 'Solicitud de Activación'}
              </button>
            )}

            {/* ── Fase Activación (sin "solicitud"): ver + completar si ya está Pagado ── */}
            {puedeVerActivacion && (() => {
              const activEst = (existingActivacion?.estatus || '').toLowerCase().trim();
              const yaPagado = activEst === 'pagado';
              return (
                <>
                  <button
                    onClick={onSolicitudActivacion}
                    disabled={!onSolicitudActivacion}
                    className="px-4 py-1.5 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Ver Solicitud de Activación
                  </button>
                </>
              );
            })()}

            {/* ── Activar Cuenta ── */}
            {puedeActivarCuenta && (
              <button
                onClick={onActivarCuenta}
                disabled={enviandoFase || !onActivarCuenta || canActivarCuenta === false}
                title={canActivarCuenta === false ? 'La Solicitud de Activación debe estar Enviada o Pagada.' : undefined}
                className="px-4 py-1.5 bg-[#059669] text-white rounded text-xs hover:bg-[#047857] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z" />
                  <path d="M8 12l3 3 5-5" />
                </svg>
                {enviandoFase ? 'Activando...' : 'Activar Cuenta'}
              </button>
            )}

            {/* ── Fase 2: Generar Solicitud ── */}
            {puedeGenerarSolicitud && (
              <button
                onClick={onGenerarSolicitud}
                disabled={enviandoFase || !onGenerarSolicitud}
                className="px-4 py-1.5 bg-[#0369A1] text-white rounded text-xs hover:bg-[#075985] flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
                Imprimir Solicitud
              </button>
            )}

            {/* ── Fases 4: Formalizar Contrato ── */}
            {puedeFormalizar && (
              <button
                onClick={onFormalizarContrato}
                disabled={enviandoFase}
                className="px-4 py-1.5 bg-[#7C3AED] text-white rounded text-xs hover:bg-[#6D28D9] flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
                Formalizar Contrato
              </button>
            )}

            {/* ── Regresar de Fase (seq >= 2) ── */}
            {puedeRegresar && (
              <button
                onClick={onRegresarFase}
                disabled={enviandoFase}
                className={`px-4 py-1.5 rounded text-xs flex items-center gap-1.5 disabled:opacity-50 ${flujoCerrado ? 'bg-white border border-gray-400 text-gray-700 hover:bg-gray-50' : 'bg-[#F59E0B] text-white hover:bg-[#D97706]'}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Regresar de Fase
              </button>
            )}
          </div>
        </div>

        {/* Contexto de navegación — separado del titular por una línea, para que
            deje de leerse como una continuación del nombre de la fase. */}
        <div className={`mt-2.5 pt-2 border-t flex items-center gap-x-4 gap-y-1 flex-wrap text-[11px] text-gray-500 ${
          flujoCerrado ? 'border-green-200' : 'border-[#4A6FA5]/20'
        }`}>
          {faseAnterior && !flujoCerrado && (
            <span>← Anterior: <span className="text-gray-600">{faseAnterior.fase}</span></span>
          )}
          {faseSiguiente && seqActual <= 5 && (
            <span>Siguiente →: <span className="text-gray-600">{faseSiguiente.fase}</span></span>
          )}
          {seqActual === 6 && !esCuentaFinanciera && (
            <span className="text-blue-600 font-medium">Abra el módulo de Solicitud de Activación para crear o editar la solicitud</span>
          )}
          {esCuentaFinanciera && !cuentaFinancieraYaFinalizada && (
            <span className="text-blue-600 font-medium">Presione "Activar cuenta y finalizar" para autorizar y cerrar el flujo</span>
          )}
          {seqActual === 7 && canActivarCuenta !== false && (
            <span className="text-green-600 font-medium">Última fase — Activación de cuenta</span>
          )}
          {seqActual === 7 && canActivarCuenta === false && (
            <span className="text-red-600 font-medium">⚠ La Solicitud de Activación no está pagada.</span>
          )}
          {flujoCerrado && (
            <span className="text-green-700 font-medium">Todas las fases concluidas</span>
          )}
          {/* El cierre suele dejar trabajo en otro modulo; decirlo aqui evita
              que el usuario se quede mirando una pantalla sin siguiente paso. */}
          {flujoCerrado && (
            <span className="inline-flex items-center gap-1.5 text-gray-600">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Si el flujo generó una dispersión, continúela en <strong className="text-gray-800">Sol. Activación</strong>
            </span>
          )}
        </div>
      </div>
    </>
  );
}
