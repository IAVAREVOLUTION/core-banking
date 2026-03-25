/**
 * FaseActionsComponent — Barra de acciones de fase.
 *
 * Fuente de verdad: fases[] del producto + faseActualId (del DTO/BD).
 * NO usa hardcoded fase names ni índices calculados manualmente.
 *
 * MODO 'solicitudes' → solo "Enviar de Fase"
 * MODO 'originacion' → todos los botones aplicables (siempre visibles, ignora readOnly)
 *
 * Botones por numero_consecutivo (spec C):
 *  seq 1         → Enviar
 *  seq 2-3       → Enviar + Regresar
 *  seq 4         → Enviar + Regresar + Formalizar Contrato
 *  seq 5         → Enviar + Regresar
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { loadFromSession } from '../solicitudes/solicitudCreditoStore';
import type { SolicitudFormData } from '../solicitudes/solicitudCreditoStore';
import type { FaseProductoItem } from '../../hooks/useFaseConsistency';
import { useFaseConsistency } from '../../hooks/useFaseConsistency';

export type { FaseProductoItem };

interface FaseActionsComponentProps {
  /** Lista de fases del producto — fuente de verdad */
  fases: FaseProductoItem[];
  /** ID de la fase actual (formData.faseId, guardado en BD) */
  faseActualId: string;
  /** Datos del formulario (para mostrar estatus y construir contexto de contrato) */
  formData: SolicitudFormData;
  /** storageId para leer subtabs desde sessionStorage */
  storageId: string | number;
  /** 'solicitudes' → solo Enviar | 'originacion' → todos los botones */
  modo: 'solicitudes' | 'originacion';
  /** Callback de avance de fase — siempre requerido */
  onEnviarFase: () => void;
  /** Callback de regreso de fase (validaciones ya hechas en el llamador) */
  onRegresarFase?: () => void;
  /** Callback de formalizar contrato (Fase 4) */
  onFormalizarContrato?: () => void;
  /** Indica si hay una operación de fase en curso */
  enviandoFase?: boolean;
}

export function FaseActionsComponent({
  fases,
  faseActualId,
  formData,
  storageId,
  modo,
  onEnviarFase,
  onRegresarFase,
  onFormalizarContrato,
  enviandoFase = false,
}: FaseActionsComponentProps) {
  const [contratoModal, setContratoModal] = useState<{
    lineaProducto: string;
    tipoProducto: string;
    noSol: string;
  } | null>(null);

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

  // ── Visibilidad de botones por numero_consecutivo (spec C) ────────────────
  // puedeEnviar: siempre que haya fase siguiente
  const puedeEnviar = !!faseSiguiente;
  // puedeRegresar: siempre que haya fase anterior (seq >= 2)
  const puedeRegresar = !!faseAnterior;
  // puedeFormalizar: solo en seq 4 (Formalización de Cuenta Financiera)
  const puedeFormalizar = seqActual === 4;

  // ── Handlers locales para Formalizar (muestra modal de confirmación) ─────
  const handleFormalizarClick = () => {
    // Cargar datos de términos para construir el contrato
    const terminos: any = loadFromSession<any>(storageId, 'terminos') || {};
    const garantias: any[] = loadFromSession<any[]>(storageId, 'garantias') || [];

    if (onFormalizarContrato) {
      onFormalizarContrato();
    } else {
      // Mostrar modal local si no hay callback externo
      setContratoModal({
        lineaProducto: formData.lineaProducto,
        tipoProducto: formData.tipoProducto,
        noSol: formData.noSol || String(storageId),
      });
      toast.success('Contrato formalizado', {
        description: `Línea: ${formData.lineaProducto} | Producto: ${formData.tipoProducto}`,
      });
    }
  };

  // ── Modo Solicitudes: solo botón Enviar ──────────────────────────────────
  if (modo === 'solicitudes') {
    if (!puedeEnviar) {
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
              <button
                onClick={onEnviarFase}
                disabled={enviandoFase || !isConsistent}
                title={!isConsistent ? 'Corrija la desincronización antes de avanzar' : ''}
                className="px-4 py-1.5 bg-[#10B981] text-white rounded text-xs hover:bg-[#059669] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                {enviandoFase ? 'Enviando...' : 'Enviar de Fase'}
              </button>
            </div>
          </div>
          {faseSiguiente && (
            <div className="mt-1 text-[10px] text-gray-500">
              Siguiente: <span className="font-medium text-gray-700">{faseSiguiente.fase}</span>
            </div>
          )}
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
                  estatus === 'Aprobado'
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
            {/* Enviar de Fase */}
            {puedeEnviar && (
              <button
                onClick={onEnviarFase}
                disabled={enviandoFase}
                className="px-4 py-1.5 bg-[#10B981] text-white rounded text-xs hover:bg-[#059669] flex items-center gap-1.5 disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                {enviandoFase ? 'Procesando...' : 'Enviar de Fase'}
              </button>
            )}

            {/* Regresar de Fase (seq >= 2) */}
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

            {/* Formalizar Contrato (solo seq 4) */}
            {puedeFormalizar && (
              <button
                onClick={handleFormalizarClick}
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
          </div>
        </div>

        {/* Contexto de navegación */}
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-gray-500">
          {faseAnterior && (
            <span>← Anterior: <span className="text-gray-600">{faseAnterior.fase}</span></span>
          )}
          {faseSiguiente && (
            <span>Siguiente →: <span className="text-gray-600">{faseSiguiente.fase}</span></span>
          )}
          {!puedeEnviar && (
            <span className="text-green-600 font-medium">✓ Última fase del flujo</span>
          )}
        </div>
      </div>

      {/* Modal de contrato (solo se muestra si no hay callback externo) */}
      {contratoModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Contrato / Pagaré generado</h3>
            <p className="text-xs text-gray-600 mb-1">
              <strong>Línea:</strong> {contratoModal.lineaProducto}
            </p>
            <p className="text-xs text-gray-600 mb-1">
              <strong>Producto:</strong> {contratoModal.tipoProducto}
            </p>
            <p className="text-xs text-gray-600 mb-4">
              <strong>No. Solicitud:</strong> {contratoModal.noSol}
            </p>
            <button
              onClick={() => setContratoModal(null)}
              className="px-4 py-1.5 bg-[#2E5C91] text-white rounded text-xs hover:bg-[#1E4A75]"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
