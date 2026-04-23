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
  /** Solicitud de Activación existente (para fase 3+) */
  existingActivacion?: { id: string; estatus: string } | null;
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
  onSolicitudActivacion,
  onActivarCuenta,
  canActivarCuenta,
  enviandoFase = false,
  existingActivacion,
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

  // "Activación Cuenta Financiera" — fase IA de Línea de Crédito que ejecuta promptIA sin modal de activación
  const esCuentaFinanciera =
    faseContiene('activac') && faseContiene('cuenta') && faseContiene('financiera');

  // Fase de activación pura (sin "solicitud" ni "cuenta financiera") — muestra botón "Ver Solicitud de Activación"
  const puedeVerActivacion =
    !puedeSolicitudActivacion &&
    !esCuentaFinanciera &&
    faseContiene('activac') &&
    !faseContiene('activar cuenta', 'activar_cuenta');

  // "Activar Cuenta" — nombre contiene "activar cuenta"
  const puedeActivarCuenta = faseContiene('activar cuenta', 'activar_cuenta');

  // "Formalizar Contrato" — nombre contiene "formaliz" (no cualquier mención de "contrato")
  const puedeFormalizar = faseContiene('formaliz');

  // "Imprimir Solicitud" — solo fase 1 (primera fase del producto)
  const puedeGenerarSolicitud = seqActual === 1;

  // "Activación Cuenta Financiera" ya finalizada cuando estatus = Autorizada/Aprobado
  const cuentaFinancieraYaFinalizada =
    esCuentaFinanciera && (estatus === 'Autorizada' || estatus === 'Aprobado');

  // "Enviar de Fase" — incluye "Activación Cuenta Financiera" solo si aún no está finalizada
  const puedeEnviar =
    (!!faseSiguiente || (esCuentaFinanciera && !cuentaFinancieraYaFinalizada)) &&
    !puedeSolicitudActivacion &&
    !puedeVerActivacion &&
    !puedeActivarCuenta;

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
        <div className="bg-[#EBF3FB] border border-[#4A6FA5] rounded px-4 py-3 mb-4">
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

      <div className="bg-[#EBF3FB] border border-[#4A6FA5] rounded px-4 py-3 mb-4">
        {/* Fila info + botones */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-700">
              <strong>Fase:</strong>{' '}
              {faseActualReal?.fase || formData.descripcionFase || '—'}
              {seqActual > 0 && (
                <span className="ml-1 text-gray-400">(#{seqActual})</span>
              )}
            </span>
            {estatus && (
              <span
                className={`px-2 py-0.5 rounded text-xs ${
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

          <div className="flex items-center gap-2 flex-wrap justify-end">
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
                {enviandoFase ? 'Procesando...' : esCuentaFinanciera ? 'Activar cuenta y finalizar' : 'Enviar de Fase'}
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
                className="px-4 py-1.5 bg-[#F59E0B] text-white rounded text-xs hover:bg-[#D97706] flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Regresar de Fase
              </button>
            )}
          </div>
        </div>

        {/* Contexto de navegación */}
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-gray-500">
          {faseAnterior && (
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
          {!puedeEnviar && !puedeSolicitudActivacion && !puedeActivarCuenta && (
            <span className="text-green-600 font-medium">✓ Última fase del flujo</span>
          )}
        </div>
      </div>
    </>
  );
}
