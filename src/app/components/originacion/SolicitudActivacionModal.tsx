/**
 * SolicitudActivacionModal — Abre el módulo completo de Solicitudes de Activación
 * en modo "nuevo" con los datos de la Originación pre-cargados.
 *
 * Usa SolicitudActivacionList (el módulo real) con initialNewData para que abra
 * directamente en el formulario de alta con los campos pre-rellenados.
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { SolicitudActivacionList } from '../solicitudes-activacion/SolicitudActivacionList';
import {
  type SolicitudActivacionFormData,
  type SolicitudActivacionListItem,
  EMPTY_FORM,
  getFechaSolicitudNow,
} from '../solicitudes-activacion/solicitudActivacionStore';
import { supabase } from '../../lib/supabaseClient';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface SolicitudActivacionModalProps {
  /** DB UUID de la Originación (FK → solicitud_id en J_SOLICITUDES_ACTIVACION) */
  originacionSolicitudId: string;
  /** Datos de contexto de Originación para pre-rellenar el formulario */
  seed: {
    cliente: string;
    clienteId: string;
    lineaProducto: string;
    tipoProducto?: string;
    montoTransaccion: string;
    moneda: string;
    productoId: string;
    /** Fecha del primer pago/aportación — se usa como Fecha Compromiso */
    fechaCompromiso?: string;
    /** Frecuencia de pago (Mensual, Quincenal, etc.) */
    periodicidad?: string;
    /** CURP o RFC del cliente — pre-rellena Número de Documento */
    numeroDocumento?: string;
    /** Institución de gobierno / institución financiera */
    institucionFinanciera?: string;
  };
  /** Registro existente (si ya hay una Solicitud de Activación para esta originación) */
  existingActivacion?: SolicitudActivacionListItem;
  /** Si true, el modal abre en modo solo lectura */
  readOnly?: boolean;
  /** El usuario cerró el modal sin guardar */
  onClose: () => void;
  /** Guardado exitoso — Originación recibe el item para validar el resultado */
  onSaved: (item: SolicitudActivacionListItem) => void;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

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
   readOnly = false,
   onClose,
   onSaved,
}: SolicitudActivacionModalProps) {
   const isNew = !existingActivacion;


  const [cuentaBancaria,    setCuentaBancaria]    = useState<string>('');
  const [clienteNombreDB,   setClienteNombreDB]   = useState<string>('');
  // Para modo nuevo: esperar hasta que el fetch termine antes de montar el formulario
  const [accountReady, setAccountReady] = useState(!isNew);

  useEffect(() => {
    if (!isNew) { setAccountReady(true); return; }
    if (!seed.clienteId) { setAccountReady(true); return; }

    // Cuenta de ahorro principal del cliente via RPC (schema EFINANCIANET_DB no está expuesto en PostgREST)
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)('get_cuentas_ahorro');
        if (!error && Array.isArray(data)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cuenta = (data as any[]).find((r: any) => r.cliente_id === seed.clienteId);
          if (cuenta?.no_cuenta) setCuentaBancaria(String(cuenta.no_cuenta));
          if (!seed.cliente) {
            const nombre = [cuenta?.cliente_nombre, cuenta?.cliente_ap_paterno, cuenta?.cliente_ap_materno]
              .filter(Boolean).join(' ');
            if (nombre) setClienteNombreDB(nombre);
          }
        }
      } catch { /* continuar sin cuenta */ }
      finally { setAccountReady(true); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed.clienteId, isNew]);

  const monto = parseFloat((seed.montoTransaccion || '0').replace(/[^0-9.-]/g, '')) || 0;

  // Datos pre-rellenos para el formulario nuevo
  const initialNewData: Partial<SolicitudActivacionFormData> | undefined = isNew ? {
    ...EMPTY_FORM,
    solicitudId:         originacionSolicitudId,
    clienteId:           seed.clienteId,
    type:                lineaToTipo(seed.lineaProducto),
    cliente:             seed.cliente || clienteNombreDB,
    fechaSolicitud:      getFechaSolicitudNow(),
    estatus:             'Pendiente',
    montoTransaccion:    seed.montoTransaccion,
    moneda:              seed.moneda,
    cuentaBancaria:      cuentaBancaria,
    detailClaveProducto:   seed.productoId,
    detailMonto:           monto,
    detailSubTotal:        monto,
    lineaProducto:         seed.lineaProducto,
    numeroDocumento:       seed.numeroDocumento || '',
    referencia:            originacionSolicitudId,
    institucionFinanciera: seed.institucionFinanciera || '',
    ...(seed.fechaCompromiso ? { fechaCompromiso: seed.fechaCompromiso } : {}),
    ...(seed.periodicidad    ? { periodicidad: seed.periodicidad }       : {}),
  } : undefined;

  const handleSaved = (item: SolicitudActivacionListItem) => {
    if (!item._fromDB) {
      toast.warning('Solicitud guardada localmente (sin conexión BD)');
    }
    onSaved(item);
  };


  if (!accountReady) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <span className="text-sm text-gray-500">Cargando datos...</span>
      </div>
    );
  }

  // Para Inversión en modo edición: el monto guardado pudo ser 0 (bug anterior).
  // Siempre usar el monto calculado en el seed (= monto_autorizado) para sobreescribir.
  const esInversionSeed = (seed.tipoProducto || '').toLowerCase().includes('invers');
  const seedMontoNum = parseFloat((seed.montoTransaccion || '0').replace(/[^0-9.-]/g, '')) || 0;
  const editItemCorrected = (!isNew && existingActivacion && esInversionSeed && seedMontoNum > 0)
    ? { ...existingActivacion, montoTransaccion: seed.montoTransaccion }
    : existingActivacion;

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      <SolicitudActivacionList
        initialNewData={isNew ? initialNewData : undefined}
        initialEditItem={!isNew ? editItemCorrected : undefined}
        initialReadOnly={readOnly}
        onSavedFromOriginacion={handleSaved}
        onCancelFromOriginacion={onClose}
      />
    </div>
  );
}
