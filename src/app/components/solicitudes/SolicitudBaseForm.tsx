/**
 * SolicitudBaseForm — componente base compartido entre Solicitudes y Originación.
 *
 * REGLA: Originación NO tiene su propio formulario. Usa este componente con readOnly={true}.
 * Solicitudes puede usarlo con readOnly={false} (editable).
 *
 * Props:
 *   solicitudId  — ID de la solicitud (UUID o número legacy)
 *   readOnly     — true → mode='ver' (Originación); false → mode='editar'
 *   onCancel     — callback al cerrar/cancelar
 *   onSave       — callback opcional al guardar (solo en modo editable)
 */
import { SolicitudCreditoForm } from './SolicitudCreditoForm';

interface SolicitudBaseFormProps {
  solicitudId: string | number;
  readOnly?: boolean;
  onCancel: () => void;
  onSave?: (data: any) => void;
  /**
   * 'solicitudes' (default) — solo botón "Enviar de Fase"
   * 'originacion'           — todos los botones de fase, siempre visibles
   */
  modo?: 'solicitudes' | 'originacion';
}

export function SolicitudBaseForm({
  solicitudId,
  readOnly = false,
  onCancel,
  onSave,
  modo = 'solicitudes',
}: SolicitudBaseFormProps) {
  return (
    <SolicitudCreditoForm
      mode={readOnly ? 'ver' : 'editar'}
      solicitudId={solicitudId}
      onCancel={onCancel}
      onSave={onSave}
      modo={modo}
    />
  );
}
