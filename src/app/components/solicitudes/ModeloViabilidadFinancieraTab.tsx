/**
 * ModeloViabilidadFinancieraTab.tsx — REQ-10
 *
 * Acordeón "Modelo y Viabilidad Financiera" de la Solicitud / Originación.
 * Actividad 5 del BPM: Análisis de Grado de Riesgo del producto Garantía
 * Financiera 2o Piso.
 *
 *   Bloque A — Parámetros del amortiguador (fuente de ingreso, fondo de reserva).
 *   Bloque B — Matriz de proyecciones, una fila por año de la emisión bursátil.
 *              DSCR anual = EBITDA ÷ Servicio de Deuda.
 *   Bloque C — Indicadores: DSCR promedio y semáforo de riesgo.
 *   Bloque D — Dictamen técnico (mínimo 200 caracteres).
 *
 * El plazo que dimensiona la matriz es `plazoBonosAnios` (emisión bursátil), que
 * es un concepto DISTINTO de `plazo` (duración del financiamiento) y de la
 * periodicidad de cobro de comisión. Ver REQ-9 §Contexto técnico.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  loadFromSession, loadFromSavedStore, saveToSession, formatCurrency, parseCurrency,
} from './solicitudCreditoStore';

export const SUBTAB_MODELO_VIABILIDAD = 'modeloViabilidad';

/** Catálogo del requerimiento. */
export const CAT_FUENTE_INGRESO = [
  'Peajes/Tarifas',
  'Contraprestación Estatal',
  'Flujos de Agua',
  'Participaciones',
];

/**
 * Umbrales del semáforo. Replican los que ya usa la plantilla institucional
 * "Modelo Financiero Dinámico GPO" (fila «Grado de Riesgo / Semáforo»), para que
 * el sistema y el Excel del área de Riesgos no dictaminen distinto sobre el
 * mismo proyecto. Definen cuándo el Core detiene la operación: no cambiarlos sin
 * acuerdo de Riesgos.
 */
export const DSCR_VERDE = 1.50;
export const DSCR_AMARILLO = 0.75;

/** Longitud mínima del dictamen técnico. */
export const DICTAMEN_MIN_CARACTERES = 200;

export interface FilaProyeccion {
  anio: number;
  /**
   * Numerador del DSCR. La plantilla institucional divide el Flujo de Caja Neto
   * Operativo (después de impuestos), NO el EBITDA: verificado contra su fila
   * «Factor de Cobertura» — 252,787,500 / 462,500,000 = 0.55. Usar EBITDA daría
   * 0.78 y el sistema dictaminaría distinto que el Excel de Riesgos.
   */
  flujoCajaNetoOperativo: string;
  /** Clave anterior; se acepta al leer para no perder lo ya capturado. */
  ebitdaProyectado?: string;
  servicioDeudaBursatil: string;
}

export interface ModeloViabilidadData {
  fuentePrimariaIngreso: string;
  montoFondoReservaFideicomiso: string;
  proyecciones: FilaProyeccion[];
  dictamenRiesgoTexto: string;
  /** Sello del último [Procesar…] — permite saber si los indicadores están vigentes. */
  procesadoEn: string;
}

export const EMPTY_MODELO_VIABILIDAD: ModeloViabilidadData = {
  fuentePrimariaIngreso: '',
  montoFondoReservaFideicomiso: '',
  proyecciones: [],
  dictamenRiesgoTexto: '',
  procesadoEn: '',
};

const num = (v: string | number | undefined | null): number => {
  const n = parseFloat(parseCurrency(String(v ?? '0')));
  return isNaN(n) ? 0 : n;
};

/** DSCR de una fila. `null` cuando no es calculable (servicio de deuda 0/vacío). */
export function dscrDeFila(f: FilaProyeccion): number | null {
  const servicio = num(f.servicioDeudaBursatil);
  if (!servicio) return null;
  return num(f.flujoCajaNetoOperativo ?? f.ebitdaProyectado) / servicio;
}

/**
 * DSCR promedio del proyecto. Promedia SOLO las filas calculables: incluir las
 * que no tienen servicio de deuda metería ceros que no existen y hundiría el
 * indicador artificialmente.
 */
export function dscrPromedio(filas: FilaProyeccion[]): number | null {
  const valores = filas.map(dscrDeFila).filter((v): v is number => v !== null);
  if (valores.length === 0) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

export type Semaforo = 'Verde' | 'Amarillo' | 'Rojo' | 'Sin datos';

export function semaforoDeDscr(promedio: number | null): Semaforo {
  if (promedio === null) return 'Sin datos';
  if (promedio >= DSCR_VERDE) return 'Verde';
  if (promedio >= DSCR_AMARILLO) return 'Amarillo';
  return 'Rojo';
}

/** Lee lo persistido. La usa el formulario para validar sin montar el subtab. */
export function leerModeloViabilidad(solicitudId: string | number): ModeloViabilidadData {
  const g =
    loadFromSession<Partial<ModeloViabilidadData>>(solicitudId, SUBTAB_MODELO_VIABILIDAD) ??
    loadFromSavedStore<Partial<ModeloViabilidadData>>(solicitudId, SUBTAB_MODELO_VIABILIDAD);
  return {
    ...EMPTY_MODELO_VIABILIDAD,
    ...(g || {}),
    proyecciones: Array.isArray(g?.proyecciones)
      ? g!.proyecciones!.map((f: any, i: number) => ({
          anio: f.anio ?? i + 1,
          flujoCajaNetoOperativo: f.flujoCajaNetoOperativo ?? f.ebitdaProyectado ?? '',
          servicioDeudaBursatil: f.servicioDeudaBursatil ?? '',
        }))
      : [],
  };
}

/**
 * Motivos por los que el Análisis de Grado de Riesgo no está listo.
 * El semáforo Rojo bloquea (decisión de negocio 27/08/2026: bloqueo duro).
 */
export function faltantesModeloViabilidad(d: ModeloViabilidadData): string[] {
  const faltan: string[] = [];
  if (!d.fuentePrimariaIngreso.trim()) faltan.push('Fuente Primaria de Ingreso');
  if (!num(d.montoFondoReservaFideicomiso)) faltan.push('Monto Fondo de Reserva');
  if (d.proyecciones.length === 0) {
    faltan.push('Matriz de Proyecciones (sin años)');
  } else {
    const incompletas = d.proyecciones.filter(f => !num(f.flujoCajaNetoOperativo) || !num(f.servicioDeudaBursatil));
    if (incompletas.length > 0) {
      faltan.push(`Matriz de Proyecciones (${incompletas.length} año(s) sin capturar)`);
    }
  }
  const dict = d.dictamenRiesgoTexto.trim();
  if (dict.length < DICTAMEN_MIN_CARACTERES) {
    faltan.push(`Dictamen Técnico (${dict.length}/${DICTAMEN_MIN_CARACTERES} caracteres)`);
  }
  const prom = dscrPromedio(d.proyecciones);
  if (semaforoDeDscr(prom) === 'Rojo') {
    faltan.push(`DSCR promedio ${prom!.toFixed(2)} por debajo del mínimo (${DSCR_AMARILLO.toFixed(2)})`);
  }
  return faltan;
}

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: string | number;
  /** Años de la emisión bursátil — dimensiona la matriz. */
  plazoBonosAnios?: string;
  noSolicitud?: string;
  nombreSolicitante?: string;
  onChange?: (datos: ModeloViabilidadData) => void;
  /** Genera el dictamen y lo adjunta al Expediente. */
  onProcesarDictamen?: (datos: ModeloViabilidadData, resumen: { promedio: number | null; semaforo: Semaforo }) => Promise<void> | void;
}

export function ModeloViabilidadFinancieraTab({
  mode, solicitudId, plazoBonosAnios, noSolicitud, nombreSolicitante, onChange, onProcesarDictamen,
}: Props) {
  const isRO = mode === 'ver';
  const [datos, setDatos] = useState<ModeloViabilidadData>(() => leerModeloViabilidad(solicitudId));
  const [procesando, setProcesando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /** Guarda contra el vaciado inicial — ver REQ-9/REQ-10 §Advertencias. */
  const huboDatosRef = useRef(false);
  const hayAlgo = !!(
    datos.fuentePrimariaIngreso.trim() ||
    datos.montoFondoReservaFideicomiso.trim() ||
    datos.dictamenRiesgoTexto.trim() ||
    datos.proyecciones.some(f => f.flujoCajaNetoOperativo || f.servicioDeudaBursatil)
  );
  if (hayAlgo) huboDatosRef.current = true;

  useEffect(() => {
    if (isRO) return;
    if (!huboDatosRef.current) return;
    saveToSession(solicitudId, SUBTAB_MODELO_VIABILIDAD, datos);
    onChange?.(datos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, solicitudId, isRO]);

  /**
   * Dimensiona la matriz al plazo de bonos CONSERVANDO lo capturado: si el plazo
   * crece se agregan años vacíos al final; si se reduce se recortan los últimos.
   * Regenerarla desde cero borraría trabajo del analista (CA-14).
   */
  const anios = Math.max(0, Math.floor(parseFloat(String(plazoBonosAnios || '0')) || 0));
  useEffect(() => {
    if (isRO || anios <= 0) return;
    setDatos(prev => {
      if (prev.proyecciones.length === anios) return prev;
      const siguiente: FilaProyeccion[] = [];
      for (let i = 0; i < anios; i++) {
        siguiente.push(prev.proyecciones[i] || { anio: i + 1, flujoCajaNetoOperativo: '', servicioDeudaBursatil: '' });
        siguiente[i].anio = i + 1;
      }
      return { ...prev, proyecciones: siguiente };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anios, isRO]);

  const promedio = useMemo(() => dscrPromedio(datos.proyecciones), [datos.proyecciones]);
  const semaforo = semaforoDeDscr(promedio);
  const faltantes = faltantesModeloViabilidad(datos);

  const set = (campo: keyof ModeloViabilidadData, valor: any) => {
    if (isRO) return;
    setDatos(prev => ({ ...prev, [campo]: valor }));
  };

  const setFila = (idx: number, campo: 'flujoCajaNetoOperativo' | 'servicioDeudaBursatil', valor: string) => {
    if (isRO) return;
    const limpio = valor.replace(/[^0-9.]/g, '');
    if (limpio.split('.').length > 2) return;
    setDatos(prev => ({
      ...prev,
      proyecciones: prev.proyecciones.map((f, i) => (i === idx ? { ...f, [campo]: limpio } : f)),
    }));
  };

  /**
   * Exporta con el MISMO layout de la plantilla institucional
   * "Modelo Financiero Dinámico GPO": una hoja, años en COLUMNAS y conceptos en
   * filas. Así lo exportado se puede reimportar sin retoques y es comparable con
   * el Excel que usa el área de Riesgos.
   */
  const exportarExcel = () => {
    const cols = datos.proyecciones.map(f => `Año ${f.anio}`);
    const fila = (concepto: string, valores: (string | number)[]) => {
      const o: Record<string, any> = { 'CONCEPTO / AÑO OPERATIVO': concepto };
      cols.forEach((c, i) => { o[c] = valores[i]; });
      return o;
    };
    const dscrs = datos.proyecciones.map(f => dscrDeFila(f));
    const aoa = [
      fila('PARÁMETROS', []),
      fila('Fuente Primaria de Ingreso', [datos.fuentePrimariaIngreso]),
      fila('Cupo de Reserva GPO Requerido', [num(datos.montoFondoReservaFideicomiso)]),
      fila('Plazo de los Bonos', [datos.proyecciones.length]),
      fila('', []),
      fila('Flujo de Caja Neto Operativo', datos.proyecciones.map(f => num(f.flujoCajaNetoOperativo))),
      fila('Servicio de la Deuda Total', datos.proyecciones.map(f => num(f.servicioDeudaBursatil))),
      fila('Factor de Cobertura (DSCR)', dscrs.map(d => (d === null ? '' : Number(d.toFixed(4))))),
      fila('Grado de Riesgo / Semáforo', dscrs.map(d => semaforoDeDscr(d))),
    ];
    const ws = XLSX.utils.json_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo_Financiero_GPO');
    XLSX.writeFile(wb, `modelo_viabilidad_${noSolicitud || solicitudId}.xlsx`);
    toast.success('Modelo exportado a Excel');
  };

  /**
   * Importa la plantilla institucional. Localiza las filas por su ETIQUETA, no por
   * número: la plantilla real trae bloques de parámetros arriba y el número de fila
   * cambia entre versiones. Sólo se leen los conceptos que el subtab necesita; el
   * resto del modelo (aforo, tarifas, costos) se ignora deliberadamente — aquí no
   * se recalcula el modelo, se consume su resultado.
   */
  const importarExcel = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const filas: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });

      const norm = (v: any) =>
        String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const buscar = (frag: string) => filas.find(f => norm(f[0]).includes(frag));
      const numeros = (f: any[] | undefined) =>
        (f || []).slice(1).map(v => {
          const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
          return isNaN(n) ? null : n;
        });

      const fFlujo = buscar('flujo de caja neto');
      const fServicio = buscar('servicio de la deuda total') || buscar('servicio de la deuda');
      if (!fFlujo || !fServicio) {
        toast.error('El archivo no tiene la estructura esperada', {
          description: 'No se encontraron las filas «Flujo de Caja Neto Operativo» y «Servicio de la Deuda Total».',
          duration: 10000,
        });
        return;
      }

      // La última columna de la plantilla es «Promedio»: no es un año.
      const encabezado = filas.find(f => norm(f[0]).includes('concepto'));
      const idxPromedio = encabezado
        ? encabezado.findIndex((c, i) => i > 0 && norm(c).includes('promedio'))
        : -1;
      const recortar = (arr: (number | null)[]) =>
        idxPromedio > 0 ? arr.slice(0, idxPromedio - 1) : arr;

      const flujos = recortar(numeros(fFlujo));
      const servicios = recortar(numeros(fServicio));
      const n = Math.max(flujos.length, servicios.length);
      if (n === 0) {
        toast.error('El archivo no trae años con datos'); return;
      }

      const nuevas: FilaProyeccion[] = [];
      for (let i = 0; i < n; i++) {
        nuevas.push({
          anio: i + 1,
          flujoCajaNetoOperativo: flujos[i] != null ? String(flujos[i]) : '',
          servicioDeudaBursatil: servicios[i] != null ? String(servicios[i]) : '',
        });
      }

      const fFondo = buscar('cupo de reserva') || buscar('fondo de reserva');
      const fondo = fFondo ? numeros(fFondo)[0] : null;

      const habia = datos.proyecciones.filter(f => f.flujoCajaNetoOperativo || f.servicioDeudaBursatil).length;
      setDatos(prev => ({
        ...prev,
        proyecciones: nuevas,
        montoFondoReservaFideicomiso: fondo != null ? String(fondo) : prev.montoFondoReservaFideicomiso,
      }));

      toast.success('Modelo importado', {
        description: `${n} año(s) cargados${habia > 0 ? ` — se reemplazaron ${habia} año(s) capturados` : ''}` +
          (n !== anios && anios > 0 ? ` · OJO: el Plazo de Bonos de la Solicitud es ${anios}` : ''),
        duration: 9000,
      });
    } catch (err: any) {
      toast.error('No se pudo leer el archivo', { description: err?.message || String(err), duration: 8000 });
    }
  };
  const procesar = async () => {
    const faltan = faltantesModeloViabilidad(datos);
    if (faltan.length > 0) {
      toast.error('No se puede procesar el Grado de Riesgo', {
        description: faltan.join(' · '),
        duration: 10000,
      });
      return;
    }
    setProcesando(true);
    try {
      const sello = new Date().toLocaleString('es-MX');
      setDatos(prev => ({ ...prev, procesadoEn: sello }));
      await onProcesarDictamen?.({ ...datos, procesadoEn: sello }, { promedio, semaforo });
    } finally {
      setProcesando(false);
    }
  };

  const roClass = 'w-full px-2 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded text-gray-600';
  const inputClass = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]';
  const colorSemaforo: Record<Semaforo, string> = {
    'Verde': 'bg-green-100 text-green-800 border-green-300',
    'Amarillo': 'bg-amber-100 text-amber-800 border-amber-300',
    'Rojo': 'bg-red-100 text-red-800 border-red-300',
    'Sin datos': 'bg-gray-100 text-gray-600 border-gray-300',
  };
  const dictLen = datos.dictamenRiesgoTexto.trim().length;

  return (
    <div className="border border-gray-200 bg-white p-5">
      <div className="bg-teal-50 border border-teal-200 rounded px-3 py-2 mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-teal-800">
          <strong>Análisis de Grado de Riesgo</strong> — capture las proyecciones del
          proyecto y el Fondo de Reserva. El sistema calcula la cobertura (DSCR) y
          dictamina el nivel de riesgo técnico.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {!isRO && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) importarExcel(f);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                title="Carga la plantilla Modelo Financiero Dinámico GPO"
                className="px-3 py-1.5 bg-[#4A6FA5] text-white rounded text-xs hover:bg-[#3A5A8A] whitespace-nowrap"
              >
                Importar Excel
              </button>
            </>
          )}
          <button
            onClick={exportarExcel}
            className="px-3 py-1.5 bg-[#1D6F42] text-white rounded text-xs hover:bg-[#175733] whitespace-nowrap"
          >
            Exportar a Excel
          </button>
        </div>
      </div>

      {/* ═══ Bloque A ═══ */}
      <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
        PARÁMETROS DEL AMORTIGUADOR
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 mb-5">
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Fuente Primaria de Ingreso <span className="text-red-500">*</span>
          </label>
          <select
            value={datos.fuentePrimariaIngreso}
            onChange={e => set('fuentePrimariaIngreso', e.target.value)}
            disabled={isRO}
            className={isRO ? roClass : `${inputClass} bg-white`}
          >
            <option value="">— Seleccione —</option>
            {CAT_FUENTE_INGRESO.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Monto Fondo de Reserva del Fideicomiso <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={datos.montoFondoReservaFideicomiso}
            onChange={e => {
              const l = e.target.value.replace(/[^0-9.]/g, '');
              if (l.split('.').length > 2) return;
              set('montoFondoReservaFideicomiso', l);
            }}
            onBlur={() => {
              const n = num(datos.montoFondoReservaFideicomiso);
              set('montoFondoReservaFideicomiso', n ? n.toFixed(2) : '');
            }}
            disabled={isRO}
            placeholder="Ej. 120000000.00"
            className={`${isRO ? roClass : inputClass} text-right font-mono`}
          />
          {num(datos.montoFondoReservaFideicomiso) > 0 && (
            <span className="text-[10px] text-gray-500 mt-0.5 block text-right">
              {formatCurrency(num(datos.montoFondoReservaFideicomiso))}
            </span>
          )}
        </div>
      </div>

      {/* ═══ Bloque B ═══ */}
      <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
        MATRIZ DE PROYECCIONES FINANCIERAS
      </div>
      {anios <= 0 ? (
        <div className="mb-5 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-700">
          No hay <span className="font-medium">Plazo de Bonos (años)</span> heredado de la
          Oportunidad, así que no se puede dimensionar la matriz. Captúrelo en
          Estructura Bursátil de la Oportunidad.
        </div>
      ) : (
        <div className="border border-gray-300 overflow-x-auto mb-5">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-3 py-2 text-left font-normal text-gray-700 w-20">AÑO</th>
                <th className="px-3 py-2 text-right font-normal text-gray-700">FLUJO DE CAJA NETO OPERATIVO</th>
                <th className="px-3 py-2 text-right font-normal text-gray-700">SERVICIO DEUDA BURSÁTIL</th>
                <th className="px-3 py-2 text-right font-normal text-gray-700 w-28">DSCR ANUAL</th>
              </tr>
            </thead>
            <tbody>
              {datos.proyecciones.map((f, i) => {
                const d = dscrDeFila(f);
                return (
                  <tr key={f.anio} className="border-b border-gray-200" style={{ backgroundColor: i % 2 === 1 ? '#F9F9F9' : '#FFFFFF' }}>
                    <td className="px-3 py-1.5 text-gray-700 font-medium">{f.anio}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text" inputMode="decimal"
                        value={f.flujoCajaNetoOperativo}
                        onChange={e => setFila(i, 'flujoCajaNetoOperativo', e.target.value)}
                        disabled={isRO}
                        className={`${isRO ? roClass : inputClass} text-right font-mono`}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="text" inputMode="decimal"
                        value={f.servicioDeudaBursatil}
                        onChange={e => setFila(i, 'servicioDeudaBursatil', e.target.value)}
                        disabled={isRO}
                        className={`${isRO ? roClass : inputClass} text-right font-mono`}
                      />
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono ${
                      d === null ? 'text-gray-400'
                      : d >= DSCR_VERDE ? 'text-green-700'
                      : d >= DSCR_AMARILLO ? 'text-amber-700'
                      : 'text-red-700'
                    }`}>
                      {d === null ? '—' : d.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ Bloque C ═══ */}
      <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
        INDICADORES DE RIESGO INSTITUCIONAL
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 mb-5 items-end">
        <div>
          <label className="block text-xs text-gray-700 mb-1">DSCR Promedio del Proyecto</label>
          <input type="text" value={promedio === null ? '—' : promedio.toFixed(2)} disabled className={`${roClass} text-right font-mono`} />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Semáforo de Riesgo Interno</label>
          <div className={`px-3 py-1.5 rounded border text-xs font-semibold text-center ${colorSemaforo[semaforo]}`}>
            {semaforo}
          </div>
        </div>
        <div className="text-[10px] text-gray-500">
          Verde ≥ {DSCR_VERDE.toFixed(2)} · Amarillo ≥ {DSCR_AMARILLO.toFixed(2)} · Rojo &lt; {DSCR_AMARILLO.toFixed(2)}
          {datos.procesadoEn && <div className="mt-1 text-gray-400">Último proceso: {datos.procesadoEn}</div>}
        </div>
      </div>

      {/* ═══ Bloque D ═══ */}
      <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
        CONCLUSIÓN TÉCNICA
      </div>
      <div>
        <label className="block text-xs text-gray-700 mb-1">
          Dictamen de Riesgo <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={6}
          value={datos.dictamenRiesgoTexto}
          onChange={e => set('dictamenRiesgoTexto', e.target.value)}
          disabled={isRO}
          placeholder="Fundamente el grado de riesgo: comportamiento del DSCR, suficiencia del Fondo de Reserva, sensibilidad de los flujos..."
          className={`${isRO ? roClass : inputClass} resize-y`}
        />
        <div className={`text-[10px] mt-0.5 text-right ${dictLen < DICTAMEN_MIN_CARACTERES ? 'text-amber-600' : 'text-green-600'}`}>
          {dictLen} / {DICTAMEN_MIN_CARACTERES} caracteres mínimos
        </div>
      </div>

      {!isRO && (
        <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
          {faltantes.length > 0 && (
            <span className="text-[11px] text-amber-600 text-right">
              Falta: {faltantes.slice(0, 2).join(' · ')}{faltantes.length > 2 ? ` (+${faltantes.length - 2})` : ''}
            </span>
          )}
          <button
            onClick={procesar}
            disabled={procesando || faltantes.length > 0}
            className="px-5 py-1.5 rounded text-xs font-medium bg-[#0F766E] text-white hover:bg-[#0D5F58] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {procesando ? 'Procesando…' : 'Procesar Grado de Riesgo y Generar Dictamen'}
          </button>
        </div>
      )}
    </div>
  );
}
