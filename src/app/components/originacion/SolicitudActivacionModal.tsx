/**
 * SolicitudActivacionModal — Overlay de pantalla completa que integra
 * SolicitudActivacionForm desde el flujo de Originación (Fase 6).
 *
 * Originación NO duplica lógica del módulo de Solicitudes de Activación.
 * Este componente SOLO:
 *  1. Pre-rellena los datos del formulario externo con datos de Originación
 *  2. Renderiza el formulario del módulo externo (SolicitudActivacionForm)
 *  3. Persiste via useSolicitudesActivacionDB (mismo hook que el módulo externo)
 *  4. Comunica el resultado a Originación vía callbacks (onSaved / onClose)
 */
import { useEffect } from 'react';
import { toast } from 'sonner';
import { SolicitudActivacionForm } from '../solicitudes-activacion/SolicitudActivacionForm';
import {
  type SolicitudActivacionFormData,
  type SolicitudActivacionListItem,
  EMPTY_FORM,
  saveToSession as saveActivSession,
  clearSession as clearActivSession,
  getFechaSolicitudNow,
} from '../solicitudes-activacion/solicitudActivacionStore';
import { useSolicitudesActivacionDB } from '../../hooks/useSolicitudesActivacionDB';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface SolicitudActivacionModalProps {
  /** DB UUID de la Originación (FK → solicitud_id en J_SOLICITUDES_ACTIVACION) */
  originacionSolicitudId: string;
  /** Datos de contexto de Originación para pre-rellenar el formulario */
  seed: {
    cliente: string;
    lineaProducto: string;
    montoTransaccion: string;
    moneda: string;
    productoId: string;
  };
  /** Registro existente (si ya hay una Solicitud de Activación para esta originación) */
  existingActivacion?: SolicitudActivacionListItem;
  /** El usuario cerró el modal sin guardar */
  onClose: () => void;
  /** Guardado exitoso — Originación recibe el item para validar el resultado */
  onSaved: (item: SolicitudActivacionListItem) => void;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Convierte lineaProducto al tipo de solicitud (Por Pagar / Por Cobrar) */
function lineaToTipo(linea: string): string {
  const n = linea.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (n.includes('captacion')) return 'Por Cobrar';
  return 'Por Pagar';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SolicitudActivacionModal({
  originacionSolicitudId,
  seed,
  existingActivacion,
  onClose,
  onSaved,
}: SolicitudActivacionModalProps) {
  // Usar el mismo hook que el módulo externo — sin duplicar lógica de persistencia
  const { saveSolicitudActivacion } = useSolicitudesActivacionDB(false);

  const isNew       = !existingActivacion;
  const storageKey  = isNew
    ? 'new'
    : String(existingActivacion!._dbId || existingActivacion!.id);

  // ── Pre-rellenar sesión con datos de Originación (solo para registros nuevos) ──
  useEffect(() => {
    if (!isNew) return;
    clearActivSession('new');
    const monto = parseFloat(seed.montoTransaccion.replace(/[^0-9.-]/g, '')) || 0;
    const seedForm: SolicitudActivacionFormData = {
      ...EMPTY_FORM,
      solicitudId:         originacionSolicitudId,
      type:                lineaToTipo(seed.lineaProducto),
      cliente:             seed.cliente,
      fechaSolicitud:      getFechaSolicitudNow(),
      estatus:             'Pendiente',
      montoTransaccion:    seed.montoTransaccion,
      moneda:              seed.moneda,
      detailClaveProducto: seed.productoId,
      detailMonto:         monto,
      detailSubTotal:      monto,
    };
    saveActivSession('new', 'form', seedForm);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guardar: delega completamente al hook externo ──────────────────────────
  const handleSave = async (data: SolicitudActivacionFormData) => {
    const dbId   = isNew ? undefined : String(existingActivacion!._dbId || existingActivacion!.id);
    const result = await saveSolicitudActivacion(data, dbId);

    const savedItem: SolicitudActivacionListItem = {
      id:              result.id || existingActivacion?.id || String(Date.now()),
      solicitudId:     data.solicitudId,
      cliente:         data.cliente,
      numeroDocumento: data.numeroDocumento,
      tipo:            data.type,
      fechaSolicitud:  (data.fechaSolicitud || '').split(' ')[0],
      estatus:         data.estatus || 'Pendiente',
      montoTransaccion: data.montoTransaccion,
      moneda:          data.moneda,
      _dbId:           result.id || String(existingActivacion?._dbId || ''),
      _fromDB:         result.ok,
    };

    if (!result.ok) {
      toast.warning('Solicitud guardada localmente (sin conexión BD)', {
        description: result.error,
      });
    }

    // Siempre notificar a Originación (online u offline) para que valide el resultado
    onSaved(savedItem);
  };

  // ── Render: overlay de pantalla completa ──────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      <SolicitudActivacionForm
        key={storageKey}
        mode={isNew ? 'nuevo' : 'editar'}
        solicitudId={isNew ? undefined : storageKey as string}
        onCancel={onClose}
        onSave={handleSave}
      />
    </div>
  );
}
