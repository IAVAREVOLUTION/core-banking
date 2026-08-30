/**
 * banca2oPisoStore.ts — REQ-17.
 *
 * Tipos, filtro y hook de datos del módulo Banca 2º Piso. Vive aparte de los
 * componentes para que `CarteraList` pueda importar el filtro sin arrastrar el
 * módulo entero (y sus gráficas) a su bundle.
 */
import { useState, useEffect, useCallback } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { CarteraCredito } from '../cartera/CarteraForm';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9`;
const HDR = { Authorization: `Bearer ${publicAnonKey}` };

export const parseMon = (v: unknown): number =>
  parseFloat(String(v || '0').replace(/[$,\s]/g, '')) || 0;

export const fmtMoney = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 });

export const fmtMoneyExacto = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const norm = (v: unknown) =>
  String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** §Decisión #3 de la HU — qué se considera una línea "activa". */
export const ESTATUS_ACTIVOS_2O_PISO = ['activa', 'autorizada', 'en administracion'];

/**
 * Fila que administra este módulo: Línea de Crédito **y** estatus activo.
 *
 * Se exporta para que `CarteraList` excluya exactamente las mismas filas (§Decisión #2).
 * El criterio incluye el estatus a propósito: así una Línea de Crédito que todavía no
 * está activa sigue siendo visible en Cartera Crédito y ninguna cuenta desaparece de
 * los dos módulos a la vez.
 */
export function esLineaCredito2oPisoRow(lineaProducto: string, estatus: string): boolean {
  const linea = norm(lineaProducto);
  const esLineaCredito = linea.includes('linea') && linea.includes('credito');
  return esLineaCredito && ESTATUS_ACTIVOS_2O_PISO.includes(norm(estatus));
}

export interface LineaCreditoRow extends CarteraCredito {
  /** `data.solicitud.terminos_condiciones._raw` — alimenta la pestaña de Términos. */
  terminosRaw: Record<string, any>;
  productoId?: string;
  faseId?: number;
  descripcionFase?: string;
  tipoPersona?: string;
  curp?: string;
  rfc?: string;
  sucursal?: string;
  idGarantiaCartera?: string;
  polizaContableApertura?: string;
}

export function useLineasCreditoActivas() {
  const [rows, setRows] = useState<LineaCreditoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await window.fetch(`${API_BASE}/solicitudes-credito`, { headers: HDR });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      const mapped: LineaCreditoRow[] = (json.data || [])
        .filter((r: any) => {
          const h = r.data?.solicitud?.header || {};
          return esLineaCredito2oPisoRow(
            r.linea_produc || h.linea_producto || '',
            r.estatus_sol || h.estatus || '',
          );
        })
        .map((r: any) => {
          const h = r.data?.solicitud?.header || {};
          const t = r.data?.solicitud?.terminos_condiciones?._raw || {};
          return {
            id: r.id,
            noSol: r.no_sol || '',
            cliente: [r.cliente_nombre, r.cliente_ap_paterno, r.cliente_ap_materno].filter(Boolean).join(' ') || h.nombre_persona || '—',
            clienteId: r.cliente_id || '',
            productoNombre: r.producto_nombre || h.nombre_producto || '—',
            lineaProducto: r.linea_produc || h.linea_producto || 'Línea de Crédito',
            tipoProducto: r.tipo_produc || h.tipo_producto || '',
            montoAut: parseMon(r.monto_aut),
            montoSol: parseMon(r.monto_sol),
            tasa: t.tasa || h.tasa_autorizada || '',
            plazo: t.plazo || h.plazo_autorizado || '',
            frecuencia: t.frecuencia || '',
            estatus: r.estatus_sol || h.estatus || '',
            noCuenta: r.no_cuenta || '',
            moneda: t.moneda || 'MXN',
            usuario: h.responsable || '',
            gobierno: r.institucion_gobierno || undefined,
            fechaSol: r.fecha_sol || r.fecha_autori || '',
            terminosRaw: t,
            productoId: h.producto_id || r.producto_id || '',
            faseId: Number(h.fase_id) || 0,
            descripcionFase: h.descripcion_fase || '',
            tipoPersona: h.tipo_persona || '',
            curp: h.curp || '',
            rfc: h.rfc || '',
            sucursal: h.sucursal || '',
            idGarantiaCartera: h.id_garantia_cartera || '',
            polizaContableApertura: h.poliza_contable_apertura || '',
          };
        });
      setRows(mapped);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  return { rows, loading, error, refetch: cargar };
}
