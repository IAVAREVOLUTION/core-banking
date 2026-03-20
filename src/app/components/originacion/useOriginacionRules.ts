import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  ejecutarReglasFase,
  OriginacionContext,
  ReglaValidacionResult,
  FaseOriginacion,
} from './originacionRules';
import { OriginacionFormData } from './originacionStore';

export type AccionFase = 'enviarFase' | 'regresarFase' | 'formalizarContrato' | 'solicitudActivacion' | 'activarCuenta';

export interface UseOriginacionRulesProps {
  formData: OriginacionFormData;
  documentos: string[];
  notas: { id: number; fechaCreacion: Date; usuario: string; contenido: string }[];
  garantias: { id: number; tipo: string; valorNominal: number; estatus: string }[];
  comites: { autoridad: string; estatus: string }[];
  beneficiarios: { id: number; nombre: string; firma: boolean }[];
  solicitudActivacion?: { estatusPago: string; monto: number };
  onActualizarFase: (nuevaFase: FaseOriginacion) => void;
  onActualizarEstatus: (estatus: string) => void;
  onActualizarEstatusCuenta: (estatus: string) => void;
  onActualizarEstatusPago: (estatus: string) => void;
  onActualizarEstatusCartera: (estatus: string) => void;
  onGenerarContrato: () => void;
  onCrearCuenta: (tipo: 'CuentaporPagar' | 'CuentaporCobrar') => void;
}

export function useOriginacionRules({
  formData,
  documentos,
  notas,
  garantias,
  comites,
  beneficiarios,
  solicitudActivacion,
  onActualizarFase,
  onActualizarEstatus,
  onActualizarEstatusCuenta,
  onActualizarEstatusPago,
  onActualizarEstatusCartera,
  onGenerarContrato,
  onCrearCuenta,
}: UseOriginacionRulesProps) {
  const getContext = useCallback((): OriginacionContext => {
    const tipoPersona = formData.cliente.includes('S.A.') || formData.cliente.includes('S. de R.L.') || formData.cliente.includes('S.C.') ? 'Moral' : 'Física';

    return {
      id: 0,
      estatusSolicitud: formData.estatus,
      fase: formData.subEstatus as FaseOriginacion,
      lineaProducto: formData.lineaProducto as 'Crédito' | 'Captación' | 'Línea de Crédito',
      tipoProducto: formData.producto as 'Crédito Simple' | 'Crédito Revolvente' | 'Línea de Crédito',
      tipoPersona,
      documentos,
      notas,
      garantias,
      comites,
      beneficiarios,
      solicitudActivacion,
      header: {
        cliente: formData.cliente,
        noCuenta: formData.noOriginacion,
        tasa: formData.tasaAutorizada,
        plazo: formData.plazos,
        periodicidad: formData.periodo,
        montoAutorizado: parseFloat(formData.montoAutorizado) || 0,
        fechaInicio: formData.fechaInicio,
        fechaFin: formData.fechaFin,
        tipoAmortizacion: formData.tipoAmortizacion,
      },
    };
  }, [formData, documentos, notas, garantias, comites, beneficiarios, solicitudActivacion]);

  const ejecutarAccion = useCallback((accion: AccionFase): ReglaValidacionResult => {
    const context = getContext();
    const result = ejecutarReglasFase(context, accion);

    if (!result.accionPermitida) {
      result.motivos.forEach(motivo => toast.error('Validación fallida', { description: motivo }));
    } else {
      toast.success('Acción ejecutada', { description: result.motivos.join(' ') });

      if (result.faseDestino && result.faseDestino !== result.fase) {
        onActualizarFase(result.faseDestino);
      }

      result.actualizaciones.forEach(update => {
        if (update.estatusSolicitud) onActualizarEstatus(update.estatusSolicitud);
        if (update.estatusCuenta) onActualizarEstatusCuenta(update.estatusCuenta);
        if (update.estatusPago) onActualizarEstatusPago(update.estatusPago);
        if (update.estatusCartera) onActualizarEstatusCartera(update.estatusCartera);
      });

      if (result.contrato) {
        onGenerarContrato();
      }

      if (result.cuenta) {
        onCrearCuenta(result.cuenta.tipo);
      }
    }

    return result;
  }, [getContext, onActualizarFase, onActualizarEstatus, onActualizarEstatusCuenta, onActualizarEstatusPago, onActualizarEstatusCartera, onGenerarContrato, onCrearCuenta]);

  const puedeEnviarFase = useCallback((): boolean => {
    const fase = formData.subEstatus as FaseOriginacion;
    return fase !== 'Activación de Cuenta Financiera' || formData.estatus !== 'Pendiente';
  }, [formData.subEstatus, formData.estatus]);

  const puedeRegresarFase = useCallback((): boolean => {
    const fase = formData.subEstatus as FaseOriginacion;
    const fasesSinRegresar: FaseOriginacion[] = ['Integración del Expediente'];
    return !fasesSinRegresar.includes(fase) && formData.estatus !== 'Pendiente';
  }, [formData.subEstatus, formData.estatus]);

  const puedeFormalizar = useCallback((): boolean => {
    return formData.subEstatus === 'Formalización de Cuenta Financiera' && formData.estatus !== 'Pendiente';
  }, [formData.subEstatus, formData.estatus]);

  const puedeSolicitarActivacion = useCallback((): boolean => {
    return formData.subEstatus === 'Solicitud de Activación de Cuenta Financiera' && formData.estatus !== 'Pendiente';
  }, [formData.subEstatus, formData.estatus]);

  const puedeActivar = useCallback((): boolean => {
    return formData.subEstatus === 'Activación de Cuenta Financiera' && formData.estatus !== 'Pendiente';
  }, [formData.subEstatus, formData.estatus]);

  return {
    ejecutarAccion,
    puedeEnviarFase,
    puedeRegresarFase,
    puedeFormalizar,
    puedeSolicitarActivacion,
    puedeActivar,
    getContext,
  };
}
