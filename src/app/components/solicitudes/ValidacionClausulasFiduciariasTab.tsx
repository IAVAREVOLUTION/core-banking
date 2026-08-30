/**
 * ValidacionClausulasFiduciariasTab.tsx — Actividad 7.1 del BPM: "Confección y
 * Validación de Cláusulas Fiduciarias" (Fase 4, "Validación de Cláusulas
 * Fiduciarias"). Último subtab antes del cierre automático de la Solicitud
 * (Actividad 7.2 — ver formalizacionCarteraGPO.ts, se dispara solo al ENTRAR a
 * Fase 5, no desde aquí).
 *
 * Mismo patrón de persistencia "nunca guardar lo que este montaje no produjo"
 * usado en el resto de subtabs GPO (Estructura2oPiso, ModeloViabilidad,
 * ResolucionCIC).
 */
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import { projectId } from '/utils/supabase/info';
import { loadFromSession, loadFromSavedStore, saveToSession } from './solicitudCreditoStore';

export const SUBTAB_VALIDACION_CLAUSULAS = 'validacionClausulas';
const BUCKET_EXPEDIENTES = 'make-7e2d13d9-expedientes-electronicos-prospectos';

export interface ArchivoContratoGPO {
  nombre: string;
  url: string;
  storagePath: string;
  mime: string;
  tamanoKB: number;
}

export interface ValidacionClausulasData {
  cuentaClabeFideicomiso: string;
  fechaFirmaContratos: string;
  clausula41AgotamientoFondoReserva: boolean;
  clausula72CascadaPagosPreferencial: boolean;
  contratoArchivo: ArchivoContratoGPO | null;
}

export const EMPTY_VALIDACION_CLAUSULAS: ValidacionClausulasData = {
  cuentaClabeFideicomiso: '',
  fechaFirmaContratos: '',
  clausula41AgotamientoFondoReserva: false,
  clausula72CascadaPagosPreferencial: false,
  contratoArchivo: null,
};

export function leerValidacionClausulas(solicitudId: string | number): ValidacionClausulasData {
  const g =
    loadFromSession<Partial<ValidacionClausulasData>>(solicitudId, SUBTAB_VALIDACION_CLAUSULAS) ??
    loadFromSavedStore<Partial<ValidacionClausulasData>>(solicitudId, SUBTAB_VALIDACION_CLAUSULAS);
  return { ...EMPTY_VALIDACION_CLAUSULAS, ...(g || {}) };
}

export function faltantesValidacionClausulas(d: ValidacionClausulasData): string[] {
  const faltan: string[] = [];
  if (!/^\d{18}$/.test(d.cuentaClabeFideicomiso.trim())) {
    faltan.push('Cuenta CLABE del Fideicomiso (18 dígitos)');
  }
  if (!d.fechaFirmaContratos.trim()) faltan.push('Fecha de Firma de Contratos');
  if (!d.clausula41AgotamientoFondoReserva) faltan.push('Cláusula 4.1 — Agotamiento del Fondo de Reserva');
  if (!d.clausula72CascadaPagosPreferencial) faltan.push('Cláusula 7.2 — Cascada de Pagos Preferencial');
  if (!d.contratoArchivo) faltan.push('Contrato GPO Firmado (PDF)');
  return faltan;
}

async function subirContratoGPO(file: File, solicitudId: string): Promise<ArchivoContratoGPO | null> {
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `expedientes-electronicos/solicitudes/${solicitudId}/${timestamp}_${safeName}`;
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_EXPEDIENTES)
      .upload(storagePath, file, { cacheControl: '3600', upsert: false, contentType: file.type || 'application/pdf' });
    if (error || !data?.path) {
      console.warn('[ValidacionClausulas] subida a Storage falló:', error?.message);
      return null;
    }
    let url = `https://${projectId}.supabase.co/storage/v1/object/public/${BUCKET_EXPEDIENTES}/${data.path}`;
    try {
      const { data: signedData } = await supabase.storage.from(BUCKET_EXPEDIENTES).createSignedUrl(data.path, 3600);
      if (signedData?.signedUrl) url = signedData.signedUrl;
    } catch { /* usa la URL pública */ }
    return { nombre: file.name, url, storagePath: data.path, mime: file.type || 'application/pdf', tamanoKB: Math.round(file.size / 1024) };
  } catch (err: any) {
    console.warn('[ValidacionClausulas] excepción subiendo Storage:', err?.message);
    return null;
  }
}

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: string | number;
  onChange?: (datos: ValidacionClausulasData) => void;
}

export function ValidacionClausulasFiduciariasTab({ mode, solicitudId, onChange }: Props) {
  const isRO = mode === 'ver';
  const [datos, setDatos] = useState<ValidacionClausulasData>(() => leerValidacionClausulas(solicitudId));
  const [subiendo, setSubiendo] = useState(false);

  const huboDatosRef = useRef(false);
  const hayAlgo = !!(datos.cuentaClabeFideicomiso.trim() || datos.fechaFirmaContratos.trim() ||
    datos.clausula41AgotamientoFondoReserva || datos.clausula72CascadaPagosPreferencial || datos.contratoArchivo);
  if (hayAlgo) huboDatosRef.current = true;

  useEffect(() => {
    if (isRO) return;
    if (!huboDatosRef.current) return;
    saveToSession(solicitudId, SUBTAB_VALIDACION_CLAUSULAS, datos);
    onChange?.(datos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, solicitudId, isRO]);

  const set = <K extends keyof ValidacionClausulasData>(campo: K, valor: ValidacionClausulasData[K]) => {
    if (isRO) return;
    setDatos(prev => ({ ...prev, [campo]: valor }));
  };

  const handleArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isRO) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('El contrato debe ser un archivo PDF');
      return;
    }
    setSubiendo(true);
    try {
      const subido = await subirContratoGPO(file, String(solicitudId));
      if (subido) {
        set('contratoArchivo', subido);
        toast.success('Contrato GPO cargado', { description: subido.nombre, duration: 5000 });
      } else {
        toast.error('No se pudo subir el contrato', { description: 'Intente de nuevo — revise su conexión.' });
      }
    } finally {
      setSubiendo(false);
    }
  };

  const claveEnPantalla = (v: string) => v.replace(/\D/g, '').slice(0, 18);
  const roClass = 'w-full px-2 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded text-gray-600';
  const inputClass = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]';
  const faltantes = faltantesValidacionClausulas(datos);

  return (
    <div className="border border-gray-200 bg-white p-5">
      <div className="bg-teal-50 border border-teal-200 rounded px-3 py-2 mb-4">
        <p className="text-xs text-teal-800">
          <strong>Validación de Cláusulas Fiduciarias</strong> — última verificación
          jurídica antes de formalizar y cerrar la Solicitud.
        </p>
      </div>

      {/* ═══ Bloque A ═══ */}
      <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
        CAPTURA Y MAPEO OPERATIVO
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 mb-5">
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Cuenta CLABE del Fideicomiso (Ingresos) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={datos.cuentaClabeFideicomiso}
            onChange={e => set('cuentaClabeFideicomiso', claveEnPantalla(e.target.value))}
            disabled={isRO}
            placeholder="18 dígitos"
            maxLength={18}
            className={`${isRO ? roClass : inputClass} font-mono`}
          />
          <span className="text-[10px] text-gray-400 mt-0.5 block">
            Cuenta donde el proyecto depositará la recaudación de casetas/tarifas.
          </span>
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Fecha de Firma de Contratos <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={datos.fechaFirmaContratos}
            onChange={e => set('fechaFirmaContratos', e.target.value)}
            disabled={isRO}
            className={isRO ? roClass : inputClass}
          />
        </div>
      </div>

      {/* ═══ Bloque B — checklist ═══ */}
      <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
        CHECKLIST HOMOLOGADO DE CLÁUSULAS BLINDADAS
      </div>
      <div className="space-y-2 mb-5">
        <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={datos.clausula41AgotamientoFondoReserva}
            onChange={e => set('clausula41AgotamientoFondoReserva', e.target.checked)}
            disabled={isRO}
            className="mt-0.5"
          />
          <span>
            <strong>Cláusula 4.1 — Agotamiento del Fondo de Reserva:</strong> el Fiduciario
            acepta que usará todo el fondo de reserva antes de poder cobrar la GPO de
            BanObras.
          </span>
        </label>
        <label className="flex items-start gap-2 text-xs text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={datos.clausula72CascadaPagosPreferencial}
            onChange={e => set('clausula72CascadaPagosPreferencial', e.target.checked)}
            disabled={isRO}
            className="mt-0.5"
          />
          <span>
            <strong>Cláusula 7.2 — Cascada de Pagos Preferencial:</strong> el emisor acepta
            que, si se ejerce la GPO, BanObras se posiciona en el 1er lugar de cobro de
            flujos futuros.
          </span>
        </label>
      </div>

      {/* ═══ Bloque C — archivo legal ═══ */}
      <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
        ARCHIVO LEGAL
      </div>
      <div className="mb-5">
        <label className="block text-xs text-gray-700 mb-1">
          Contrato GPO Firmado (PDF notariado) <span className="text-red-500">*</span>
        </label>
        {datos.contratoArchivo ? (
          <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded">
            <a href={datos.contratoArchivo.url} target="_blank" rel="noreferrer" className="text-xs text-green-800 underline truncate">
              {datos.contratoArchivo.nombre} ({datos.contratoArchivo.tamanoKB} KB)
            </a>
            {!isRO && (
              <button onClick={() => set('contratoArchivo', null)} className="text-[11px] text-red-600 hover:underline ml-3 whitespace-nowrap">
                Quitar
              </button>
            )}
          </div>
        ) : (
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleArchivo}
            disabled={isRO || subiendo}
            className="w-full text-xs text-gray-600 file:mr-3 file:px-3 file:py-1.5 file:rounded file:border-0 file:bg-[#4A6FA5] file:text-white file:text-xs hover:file:bg-[#3d5c87]"
          />
        )}
        {subiendo && <span className="text-[10px] text-gray-400 mt-1 block">Subiendo…</span>}
      </div>

      {!isRO && faltantes.length > 0 && (
        <div className="pt-3 border-t border-gray-200 text-right">
          <span className="text-[11px] text-amber-600">
            Falta: {faltantes.slice(0, 3).join(' · ')}{faltantes.length > 3 ? ` (+${faltantes.length - 3})` : ''}
          </span>
        </div>
      )}
    </div>
  );
}
