/**
 * ResolucionFinalCICTab.tsx — REQ-12
 *
 * Acordeón "Resolución Final CIC" de la Solicitud / Originación. Actividad 6.2 del
 * BPM: Autorización del Comité Interno de Crédito.
 *
 *   Resumen Ejecutivo — SOLO LECTURA de los votos ya capturados por REQ-11
 *     (VotacionCPCTab). No se recaptura nada: se reusan leerVotacionCPC() y
 *     conteoVotosCPC() tal cual.
 *   Registro Legal — Número de Acta CIC, Fecha de Sesión CIC, Estatus de la
 *     Solicitud (Aprobada por CIC / Rechazada Definitivamente).
 *   [Emitir Oficio de Autorización y Bloquear Cupo] — hace DOS cosas separadas,
 *     declaradas así en la UI para no fingir una que no ocurre:
 *       1. Genera el Oficio (PDF) y lo adjunta al Expediente — siempre funciona.
 *       2. Intenta reservar el monto contra el límite GLOBAL de la línea GPO vía
 *          el RPC atómico `reservar_cupo_gpo` (migración
 *          supabase/migrations/create_rpc_bloqueo_cupo_gpo.sql). Si esa migración
 *          no se ha corrido en el proyecto de Supabase, el RPC no existe y el
 *          intento falla con un mensaje claro — no se simula un bloqueo que no
 *          está pasando de verdad.
 */
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  loadFromSession, loadFromSavedStore, saveToSession, formatCurrency, parseCurrency,
} from './solicitudCreditoStore';
import {
  leerVotacionCPC, conteoVotosCPC, CAT_DECISION_VOTO, type VotoCPC,
} from './VotacionCPCTab';

export const SUBTAB_RESOLUCION_CIC = 'resolucionCIC';

export type EstatusResolucionCIC = 'Aprobada por CIC' | 'Rechazada Definitivamente';

export const CAT_ESTATUS_RESOLUCION_CIC: { value: EstatusResolucionCIC; label: string }[] = [
  { value: 'Aprobada por CIC', label: 'Aprobada por CIC' },
  { value: 'Rechazada Definitivamente', label: 'Rechazada Definitivamente' },
];

export interface ResolucionCICData {
  numeroActaCIC: string;
  fechaSesionCIC: string;
  estatusResolucionCIC: EstatusResolucionCIC | '';
  /** Resultado del último intento de reserva — null si nunca se intentó. */
  cupoReservado: boolean | null;
  cupoMensaje: string;
  /** Sello del último [Emitir Oficio…] exitoso. */
  emitidoEn: string;
}

export const EMPTY_RESOLUCION_CIC: ResolucionCICData = {
  numeroActaCIC: '',
  fechaSesionCIC: '',
  estatusResolucionCIC: '',
  cupoReservado: null,
  cupoMensaje: '',
  emitidoEn: '',
};

export function leerResolucionCIC(solicitudId: string | number): ResolucionCICData {
  const g =
    loadFromSession<Partial<ResolucionCICData>>(solicitudId, SUBTAB_RESOLUCION_CIC) ??
    loadFromSavedStore<Partial<ResolucionCICData>>(solicitudId, SUBTAB_RESOLUCION_CIC);
  return { ...EMPTY_RESOLUCION_CIC, ...(g || {}) };
}

/**
 * Motivos por los que la Resolución Final del CIC no está completa.
 * Si el estatus es "Aprobada por CIC" y el cupo NO se reservó, se considera
 * incompleta: no tiene sentido dejar avanzar una aprobación cuyo bloqueo de
 * capacidad falló — es justo lo que el requerimiento pide impedir.
 */
export function faltantesResolucionCIC(d: ResolucionCICData): string[] {
  const faltan: string[] = [];
  if (!d.numeroActaCIC.trim()) faltan.push('Número de Acta CIC');
  if (!d.fechaSesionCIC.trim()) faltan.push('Fecha de Sesión CIC');
  if (!d.estatusResolucionCIC) faltan.push('Estatus de la Solicitud (CIC)');
  if (d.estatusResolucionCIC === 'Aprobada por CIC' && d.cupoReservado === false) {
    faltan.push(`Bloqueo de cupo no confirmado (${d.cupoMensaje || 'sin reservar'})`);
  }
  if (d.estatusResolucionCIC && d.cupoReservado === null) {
    faltan.push('Falta presionar "Emitir Oficio de Autorización y Bloquear Cupo"');
  }
  return faltan;
}

export interface EmitirOficioPayload {
  registroLegal: { numeroActaCIC: string; fechaSesionCIC: string; estatusResolucion: EstatusResolucionCIC };
  montoOperacion: number;
  votos: { votante: string; decision: string; comentarios: string; firmaToken: string }[];
}

export interface EmitirOficioResultado {
  cupoReservado: boolean;
  cupoMensaje: string;
}

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: string | number;
  onChange?: (datos: ResolucionCICData) => void;
  /**
   * El subtab arma el payload (Registro Legal + monto + votos ya conocidos) y
   * el formulario padre hace el trabajo que necesita el cliente de Supabase:
   * intentar el RPC atómico `reservar_cupo_gpo` y generar/adjuntar el Oficio
   * al Expediente — mismo reparto de responsabilidades que
   * `onProcesarDictamen` en ModeloViabilidadFinancieraTab.
   */
  onEmitirOficio?: (payload: EmitirOficioPayload) => Promise<EmitirOficioResultado> | EmitirOficioResultado;
}

const num = (v: string | number | undefined | null): number => {
  const n = parseFloat(parseCurrency(String(v ?? '0')));
  return isNaN(n) ? 0 : n;
};

export function ResolucionFinalCICTab({
  mode, solicitudId, onChange, onEmitirOficio,
}: Props) {
  const isRO = mode === 'ver';
  const [datos, setDatos] = useState<ResolucionCICData>(() => leerResolucionCIC(solicitudId));
  const [emitiendo, setEmitiendo] = useState(false);

  const huboDatosRef = useRef(false);
  const hayAlgo = !!(datos.numeroActaCIC.trim() || datos.fechaSesionCIC.trim() || datos.estatusResolucionCIC);
  if (hayAlgo) huboDatosRef.current = true;

  useEffect(() => {
    if (isRO) return;
    if (!huboDatosRef.current) return;
    saveToSession(solicitudId, SUBTAB_RESOLUCION_CIC, datos);
    onChange?.(datos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, solicitudId, isRO]);

  // ── Resumen Ejecutivo — solo lectura de REQ-11 ──
  const votacion = leerVotacionCPC(solicitudId);
  const conteo = conteoVotosCPC(votacion.votos);

  // ── Monto de la operación — heredado, mismo origen que REQ-9/REQ-10 ──
  const terminos: any = loadFromSession<any>(solicitudId, 'terminos') ?? loadFromSavedStore<any>(solicitudId, 'terminos') ?? {};
  const montoOperacion = num(terminos.montoGarantizadoGpo || terminos.montoEmisionProyectado);

  const set = (campo: keyof ResolucionCICData, valor: any) => {
    if (isRO) return;
    setDatos(prev => ({ ...prev, [campo]: valor, cupoReservado: null, cupoMensaje: '' }));
  };

  const emitirOficio = async () => {
    if (!datos.numeroActaCIC.trim() || !datos.fechaSesionCIC.trim() || !datos.estatusResolucionCIC) {
      toast.error('Complete el Registro Legal antes de emitir el Oficio', {
        description: 'Número de Acta, Fecha de Sesión y Estatus son obligatorios.',
      });
      return;
    }

    setEmitiendo(true);
    try {
      const votosParaOficio = votacion.votos.map((v: VotoCPC) => ({
        votante: v.votante,
        decision: CAT_DECISION_VOTO.find(d => d.value === v.decision)?.label || v.decision,
        comentarios: v.comentarios,
        firmaToken: v.firmaToken,
      }));

      const resultado = await onEmitirOficio?.({
        registroLegal: {
          numeroActaCIC: datos.numeroActaCIC,
          fechaSesionCIC: datos.fechaSesionCIC,
          estatusResolucion: datos.estatusResolucionCIC as EstatusResolucionCIC,
        },
        montoOperacion,
        votos: votosParaOficio,
      });

      const sello = new Date().toLocaleString('es-MX');
      setDatos(prev => ({
        ...prev,
        cupoReservado: resultado?.cupoReservado ?? null,
        cupoMensaje: resultado?.cupoMensaje || '',
        emitidoEn: sello,
      }));
    } catch (err: any) {
      toast.error('Error al emitir el Oficio', { description: err?.message || String(err), duration: 8000 });
    } finally {
      setEmitiendo(false);
    }
  };

  const roClass = 'w-full px-2 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded text-gray-600';
  const inputClass = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]';
  const faltantes = faltantesResolucionCIC(datos);

  return (
    <div className="border border-gray-200 bg-white p-5">
      <div className="bg-teal-50 border border-teal-200 rounded px-3 py-2 mb-4">
        <p className="text-xs text-teal-800">
          <strong>Autorización del Comité Interno de Crédito</strong> — revise el
          resultado del CPC, registre la resolución legal del CIC y emita el oficio.
        </p>
      </div>

      {/* ═══ Resumen Ejecutivo — solo lectura ═══ */}
      <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
        RESUMEN EJECUTIVO — VOTACIÓN DEL CPC
      </div>

      {votacion.votos.length === 0 ? (
        <div className="mb-5 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-700">
          No hay votos registrados en el Comité de Prepago y Crédito todavía. Capture la
          votación en el acordeón <span className="font-medium">Votación CPC</span> antes
          de resolver aquí.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {CAT_DECISION_VOTO.map(d => (
              <div key={d.value} className="px-3 py-1.5 rounded border border-gray-200 bg-gray-50 text-center">
                <div className="text-base font-semibold text-gray-800">{(conteo as any)[d.value]}</div>
                <div className="text-[10px] text-gray-500">{d.label}</div>
              </div>
            ))}
          </div>
          <div className="border border-gray-300 overflow-x-auto mb-5">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="px-3 py-2 text-left font-normal text-gray-700">VOTANTE</th>
                  <th className="px-3 py-2 text-center font-normal text-gray-700">DECISIÓN</th>
                  <th className="px-3 py-2 text-left font-normal text-gray-700">COMENTARIOS</th>
                  <th className="px-3 py-2 text-left font-normal text-gray-700">FOLIO DE FIRMA</th>
                </tr>
              </thead>
              <tbody>
                {votacion.votos.map((v, i) => (
                  <tr key={v.id} className="border-b border-gray-200" style={{ backgroundColor: i % 2 === 1 ? '#F9F9F9' : '#FFFFFF' }}>
                    <td className="px-3 py-1.5 text-gray-700 font-medium">{v.votante}</td>
                    <td className="px-3 py-1.5 text-center">{CAT_DECISION_VOTO.find(d => d.value === v.decision)?.label}</td>
                    <td className="px-3 py-1.5 text-gray-600">{v.comentarios.slice(0, 70)}{v.comentarios.length > 70 ? '…' : ''}</td>
                    <td className="px-3 py-1.5 text-gray-400 font-mono whitespace-nowrap">{v.firmaToken || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ═══ Registro Legal ═══ */}
      <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
        REGISTRO LEGAL
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 mb-5">
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Número de Acta CIC <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={datos.numeroActaCIC}
            onChange={e => set('numeroActaCIC', e.target.value)}
            disabled={isRO}
            placeholder="Ej. ACTA-CIC-2026-042"
            className={isRO ? roClass : inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Fecha de Sesión CIC <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={datos.fechaSesionCIC}
            onChange={e => set('fechaSesionCIC', e.target.value)}
            disabled={isRO}
            className={isRO ? roClass : inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Estatus de la Solicitud <span className="text-red-500">*</span>
          </label>
          <select
            value={datos.estatusResolucionCIC}
            onChange={e => set('estatusResolucionCIC', e.target.value as EstatusResolucionCIC)}
            disabled={isRO}
            className={isRO ? roClass : `${inputClass} bg-white`}
          >
            <option value="">— Seleccione —</option>
            {CAT_ESTATUS_RESOLUCION_CIC.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {montoOperacion > 0 && (
        <p className="text-[10px] text-gray-500 mb-4">
          Monto de la operación a bloquear si se aprueba: <span className="font-medium">{formatCurrency(montoOperacion)}</span>
        </p>
      )}

      {datos.emitidoEn && (
        <div className={`mb-4 px-3 py-2 rounded border text-[11px] ${datos.cupoReservado ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
          <strong>Último oficio:</strong> {datos.emitidoEn} — {datos.cupoMensaje}
        </div>
      )}

      {!isRO && (
        <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
          {faltantes.length > 0 && (
            <span className="text-[11px] text-amber-600 text-right">
              Falta: {faltantes.slice(0, 2).join(' · ')}{faltantes.length > 2 ? ` (+${faltantes.length - 2})` : ''}
            </span>
          )}
          <button
            onClick={emitirOficio}
            disabled={emitiendo}
            className="px-5 py-1.5 rounded text-xs font-medium bg-[#0F766E] text-white hover:bg-[#0D5F58] disabled:opacity-60 whitespace-nowrap"
          >
            {emitiendo ? 'Emitiendo…' : 'Emitir Oficio de Autorización y Bloquear Cupo'}
          </button>
        </div>
      )}
    </div>
  );
}
