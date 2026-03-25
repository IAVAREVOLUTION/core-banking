/**
 * FaseActionsComponent — Barra de acciones de fase compartida entre Solicitudes y Originación.
 *
 * REGLAS:
 *  - modo='solicitudes'  → muestra SOLO el botón "Enviar de Fase"
 *  - modo='originacion'  → muestra TODOS los botones SIEMPRE (independiente de readOnly)
 *
 * En Originación, los botones especiales (Regresar, Formalizar, Solicitud Activación, Activar Cuenta)
 * usan ejecutarReglasFase para validar; el avance real de fase usa onEnviarFase.
 */
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { loadFromSession } from '../solicitudes/solicitudCreditoStore';
import {
  ejecutarReglasFase,
  type FaseOriginacion,
} from '../originacion/originacionRules';
import type { SolicitudFormData } from '../solicitudes/solicitudCreditoStore';

type AccionFase =
  | 'enviarFase'
  | 'regresarFase'
  | 'formalizarContrato'
  | 'solicitudActivacion'
  | 'activarCuenta';

interface FaseActionsComponentProps {
  formData: SolicitudFormData;
  /** Nombre de la fase actual tal como viene del producto/DB */
  currentFaseNombre?: string;
  /** storageId de la solicitud — se usa para leer notas, garantías, documentos de sessionStorage */
  storageId: string | number;
  modo: 'solicitudes' | 'originacion';
  /** Callback de avance de fase — se usa en ambos modos para "Enviar de Fase" */
  onEnviarFase: () => void;
  /** Si el avance de fase está en proceso (Solicitudes) */
  enviandoFase?: boolean;
}

export function FaseActionsComponent({
  formData,
  currentFaseNombre,
  storageId,
  modo,
  onEnviarFase,
  enviandoFase = false,
}: FaseActionsComponentProps) {
  const [contratoModal, setContratoModal] = useState<{
    lineaProducto: string;
    tipoProducto: string;
    noSol: string;
  } | null>(null);

  const faseActual = (currentFaseNombre || formData.descripcionFase || '') as FaseOriginacion;
  const estatus = formData.estatusSolicitud || '';

  // ── Ejecutar acción en modo Originación ─────────────────────────────────────
  const ejecutarAccionOriginacion = useCallback(
    (accion: AccionFase) => {
      // Cargar datos de las subtabs desde sessionStorage
      const documentosRaw: any[] =
        loadFromSession<any[]>(storageId, 'documentos') || [];
      const notas: any[] = loadFromSession<any[]>(storageId, 'notas') || [];
      const garantias: any[] =
        loadFromSession<any[]>(storageId, 'garantias') || [];
      const comites: any[] =
        loadFromSession<any[]>(storageId, 'comisiones') || [];
      const cargosRaw: any[] =
        loadFromSession<any[]>(storageId, 'cargos') || [];

      const documentos = documentosRaw.map(
        (d: any) => d.tipoDocumento || d.nombre || ''
      );
      const expedientesData = documentosRaw.map((d: any) => ({
        id: d.id || 0,
        tipoDocumento: d.tipoDocumento || '',
        estatus: d.estatus || '',
      }));

      // Determinar tipo de persona
      const nombreCompleto = [
        formData.nombrePersona,
        formData.apellidoPaternoPersona,
        formData.apellidoMaternoPersona,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();
      const tipoPersona: import('../originacion/originacionRules').TipoPersona =
        formData.tipoPersona === 'Moral'
          ? 'Moral'
          : nombreCompleto.includes('S.A.') ||
            nombreCompleto.includes('S.C.') ||
            nombreCompleto.includes('S.A.P.I.')
          ? 'Moral'
          : 'Física';

      // Validación especial Fase 1: documentos presentes y validados
      if (
        faseActual === 'Integración del Expediente' &&
        accion === 'enviarFase'
      ) {
        if (expedientesData.length === 0) {
          toast.warning('Sin documentos en expediente', {
            description: 'Agregue documentos antes de avanzar de fase',
          });
          return;
        }
        const noValidados = expedientesData
          .filter((e) => e.estatus !== 'Validado')
          .map((e) => e.tipoDocumento);
        if (noValidados.length > 0) {
          toast.error('Documentos pendientes de validación IA', {
            description: `Requieren estatus "Validado": ${noValidados.join(', ')}`,
          });
          return;
        }
      }

      const montoAutorizadoNum =
        parseFloat(formData.montoAutorizado || '0') || 0;

      // Leer términos y condiciones para campos adicionales
      const terminos: any =
        loadFromSession<any>(storageId, 'terminos') || {};

      const cargosCtxMapped = cargosRaw.map((c: any) => ({
        cveSubproducto: c.tipoCargo || 'Capital',
        descSubproducto: c.descripcion || c.tipoCargo || 'Capital',
        cantidad: 1,
        monto: c.monto || 0,
        impuesto: 0,
        moneda: 'MXN',
        subTotal: c.monto || 0,
        estatus: c.estatus || 'Pendiente',
      }));

      const context = {
        id: 0,
        estatusSolicitud: formData.estatusSolicitud || '',
        fase: faseActual,
        lineaProducto: (formData.lineaProducto as any) || 'Crédito',
        tipoProducto:
          (formData.tipoProducto as any) || 'Crédito Simple',
        tipoPersona,
        documentos,
        notas,
        garantias,
        comites,
        beneficiarios: [] as any[],
        solicitudActivacion: undefined,
        cargos: cargosCtxMapped,
        requiereGarantia: garantias.length > 0,
        requiereComite: comites.length > 0,
        header: {
          solicitudId: formData.noSol || String(storageId),
          cliente: nombreCompleto,
          noCuenta: formData.noSol || String(storageId),
          tasa: terminos.tasa || '',
          plazo: terminos.plazo || '',
          periodicidad: terminos.frecuencia || '',
          montoAutorizado: montoAutorizadoNum,
          fechaInicio: formData.fechaInicio || '',
          fechaFin: formData.fechaFin || '',
          tipoAmortizacion: terminos.tipoCalculo || '',
          moneda: 'MXN',
        },
      };

      const result = ejecutarReglasFase(context, accion);

      if (!result.accionPermitida) {
        result.motivos.forEach((m) =>
          toast.error('Validación fallida', { description: m })
        );
        if (result.documentosFaltantes?.length) {
          toast.error('Documentos faltantes', {
            description: result.documentosFaltantes.join(', '),
          });
        }
      } else {
        toast.success('Acción ejecutada', {
          description: result.motivos.join(' '),
        });
        // Para "Enviar de Fase" en Originación: después de validar OK, avanzar
        if (accion === 'enviarFase') {
          onEnviarFase();
        }
        // Mostrar modal de contrato/pagaré al formalizar
        if (result.contrato) {
          setContratoModal({
            lineaProducto: formData.lineaProducto,
            tipoProducto: formData.tipoProducto,
            noSol: formData.noSol || String(storageId),
          });
        }
      }
    },
    [faseActual, formData, storageId, onEnviarFase]
  );

  // ── Visibilidad de botones ───────────────────────────────────────────────────
  const puedeEnviar = ![
    'Solicitud de Activación de Cuenta Financiera',
    'Activación de Cuenta Financiera',
  ].includes(faseActual);
  const puedeRegresar = !['Integración del Expediente'].includes(faseActual);
  const puedeFormalizar =
    faseActual === 'Formalización de Cuenta Financiera';
  const puedeSolicitarActivacion =
    faseActual === 'Solicitud de Activación de Cuenta Financiera';
  const puedeActivar =
    faseActual === 'Activación de Cuenta Financiera';

  // ── Modo Solicitudes: solo botón Enviar ─────────────────────────────────────
  if (modo === 'solicitudes') {
    return (
      <div className="bg-[#EBF3FB] border border-[#4A6FA5] rounded px-4 py-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-700">
            <strong>Fase actual:</strong> {faseActual || '—'}
          </span>
          <button
            onClick={onEnviarFase}
            disabled={enviandoFase}
            className="px-4 py-1.5 bg-[#10B981] text-white rounded text-xs hover:bg-[#059669] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            {enviandoFase ? 'Enviando...' : 'Enviar de Fase'}
          </button>
        </div>
      </div>
    );
  }

  // ── Modo Originación: todos los botones (SIEMPRE, sin importar readOnly) ────
  return (
    <>
      <div className="bg-[#EBF3FB] border border-[#4A6FA5] rounded px-4 py-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-700">
              <strong>Fase:</strong> {faseActual || '—'}
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
            {puedeEnviar && (
              <button
                onClick={() => ejecutarAccionOriginacion('enviarFase')}
                className="px-4 py-1.5 bg-[#10B981] text-white rounded text-xs hover:bg-[#059669] flex items-center gap-1.5"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Enviar de Fase
              </button>
            )}
            {puedeRegresar && (
              <button
                onClick={() => ejecutarAccionOriginacion('regresarFase')}
                className="px-4 py-1.5 bg-[#F59E0B] text-white rounded text-xs hover:bg-[#D97706] flex items-center gap-1.5"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Regresar de Fase
              </button>
            )}
            {puedeFormalizar && (
              <button
                onClick={() =>
                  ejecutarAccionOriginacion('formalizarContrato')
                }
                className="px-4 py-1.5 bg-[#7C3AED] text-white rounded text-xs hover:bg-[#6D28D9] flex items-center gap-1.5"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
                Formalizar Contrato
              </button>
            )}
            {puedeSolicitarActivacion && (
              <button
                onClick={() =>
                  ejecutarAccionOriginacion('solicitudActivacion')
                }
                className="px-4 py-1.5 bg-[#2E5C91] text-white rounded text-xs hover:bg-[#1E4A75] flex items-center gap-1.5"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Solicitud Activación
              </button>
            )}
            {puedeActivar && (
              <button
                onClick={() => ejecutarAccionOriginacion('activarCuenta')}
                className="px-4 py-1.5 bg-[#10B981] text-white rounded text-xs hover:bg-[#059669] flex items-center gap-1.5"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Activar Cuenta
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal confirmación de contrato */}
      {contratoModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">
              Contrato / Pagaré generado
            </h3>
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
