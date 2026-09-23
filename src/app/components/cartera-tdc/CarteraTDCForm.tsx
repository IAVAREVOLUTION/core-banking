/**
 * CarteraTDCForm — detalle de una cuenta de Cartera TDC.
 *
 * Una Línea de Crédito de Tarjeta no pasa por Solicitud de Activación: al
 * liberarse queda operando directamente. Por eso su administración vive aquí y
 * no en Cartera de Crédito ni en Banca 2º Piso, con el mismo criterio que ya
 * separa Arrendamiento y 2º Piso: una cuenta se administra en un solo módulo.
 *
 * Subtabs:
 *   Default                 — resumen de la cuenta
 *   Términos y Condiciones  — el MISMO componente que la Solicitud/Originación
 *   Expedientes             — el mismo Expediente Electrónico de la Solicitud
 *   Cargos                  — los cargos de la Solicitud
 *   Avisos de Vencimiento   — los de Cartera
 *   Movimientos             — réplica del de Personas, sin saldo inicial/final
 */
import { useState, useEffect, useMemo } from 'react';
// Dos almacenes distintos, con prefijos distintos — y cada dato vive en uno solo:
//   `sol_credito_<id>_…`  → lo que leen los subtabs de la Solicitud (Términos).
//   `credito_<id>_…`      → lo que escriben los subtabs del Crédito (cargosLinea).
// Se importan con alias porque confundirlos guarda o lee en una llave que nadie
// más toca, y el síntoma es "no se guardó" sin ningún error.
import { saveToSession, loadFromSession } from '../solicitudes/solicitudCreditoStore';
import {
  saveToSession as saveCredito,
  loadFromSession as loadCredito,
  loadFromSavedStore as loadCreditoGuardado,
} from '../creditos/creditoStore';
import { toast } from 'sonner';
import { sincronizarCargosLinea } from '../../lib/sincronizarCargosLinea';
import { cargarCargosLinea } from '../../lib/aplicarCierreCorteTDC';
import { TerminosCondicionesTab } from '../solicitudes/TerminosCondicionesTab';
import { ExpedienteElectronicoTab } from '../solicitudes/ExpedienteElectronicoTab';
import { SolicitudCargosTab } from '../solicitudes/SolicitudCargosTab';
import { AvisosVencimientoTab } from '../cartera/AvisosVencimientoTab';
import { AvisosTDCVista } from './AvisosTDCVista';
import { TarjetaCreditoTab } from './TarjetaCreditoTab';
import { MovimientosCuentaEjeTab } from './MovimientosCuentaEjeTab';
import { EstadoCuentaTDCTab } from './EstadoCuentaTDCTab';
import { MovimientosLineaTab } from '../creditos/MovimientosLineaTab';
import { CierreCorteTab } from '../creditos/CierreCorteTab';
import { AplicacionPagosTab } from '../creditos/AplicacionPagosTab';
import { CondicionesTarjetaTab } from '../solicitudes/tabs/CondicionesTarjetaTab';
import { DatosFinancierosTab } from '../solicitudes/tabs/DatosFinancierosTab';
import { useProductosCatalogoDB } from '../../hooks/useProductosCatalogoDB';

/**
 * `DatePicker` parsea partiendo por "/": sólo entiende DD/MM/YYYY.
 *
 * En BD las fechas de Términos conviven en DOS formatos dentro del MISMO
 * objeto — `fechaInicio: "30/09/2026"` junto a `fechaFin: "2026-10-30"` —
 * según qué pantalla las escribió. La ISO llega al control, no parsea, y el
 * campo se pinta vacío aunque el dato exista.
 */
function aFechaDatePicker(v: unknown): string {
  const t = String(v ?? '').trim();
  if (!t) return '';
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);       // 2026-10-30
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const dmy = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);    // 30/09/2026
  if (dmy) return t;
  return t;   // cualquier otra cosa se deja intacta: no adivinar
}

/** Campos de Términos que se normalizan como fecha. */
const CAMPOS_FECHA = ['fechaInicio', 'fechaFin', 'fechaPrimerPago', 'fechaPrimeraAportacion'];

const vacio = (x: unknown): boolean =>
  x === undefined || x === null || x === '' || x === '0';

export interface CuentaTDC {
  /** solicitud_id — J_CUENTAS_CORP_CLIENTES.id */
  id: string;
  noSol: string;
  cliente: string;
  clienteId?: string;
  productoNombre: string;
  productoId?: string;
  lineaProducto: string;
  tipoProducto?: string;
  montoAut: number;
  montoSol: number;
  tasa?: string;
  plazo?: string;
  frecuencia?: string;
  estatus: string;
  noCuenta?: string;
  moneda?: string;
  fechaSol?: string;
  /**
   * `data.solicitud.terminos_condiciones._raw` — los Términos tal como los
   * dejó la Solicitud. Sin esto el subtab nace vacío: `TerminosCondicionesTab`
   * se hidrata de sessionStorage por id, y el id de esta cuenta nunca tuvo
   * nada guardado en ESTE navegador.
   */
  terminos?: Record<string, any>;
}

interface Props {
  cuenta: CuentaTDC;
  mode: 'ver' | 'editar';
  onBack: () => void;
}

const TABS = [
  { id: 'default', label: 'Default' },
  { id: 'terminos', label: 'Términos y Condiciones' },
  { id: 'tarjeta', label: 'Tarjeta de Crédito' },
  { id: 'expedientes', label: 'Expedientes' },
  { id: 'cargos', label: 'Cargos' },
  { id: 'avisos', label: 'Avisos de Vencimiento' },
  { id: 'movimientos', label: 'Movimientos' },
  // Operación de la línea viva: los movimientos que la afectan y su corte.
  { id: 'movimientos-linea', label: 'Movimientos de la Línea' },
  { id: 'cierre-corte', label: 'Cierre de Corte' },
  { id: 'aplicacion-pagos', label: 'Aplicación de Pagos' },
  { id: 'estado-cuenta', label: 'Estado de Cuenta' },
];

const ESTATUS_COLOR: Record<string, string> = {
  Activa: 'bg-green-100 text-green-800',
  Autorizada: 'bg-green-100 text-green-800',
  Pendiente: 'bg-amber-100 text-amber-800',
  Cancelada: 'bg-gray-100 text-gray-600',
  Finiquitado: 'bg-blue-100 text-blue-800',
};

const fmtMoney = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

export function CarteraTDCForm({ cuenta, mode, onBack }: Props) {
  const [activeTab, setActiveTab] = useState('default');
  const isRO = mode === 'ver';
  const modoSubtab = isRO ? 'ver' : 'editar';

  const { productos } = useProductosCatalogoDB(true);
  const productoSel = productos.find(
    p => p.id === cuenta.productoId || p.nombreProducto === cuenta.productoNombre
  );

  // ── Hidratar Términos desde la Solicitud ──
  // `TerminosCondicionesTab` se hidrata de sessionStorage por id. Esta cuenta se
  // abre por primera vez en este navegador, así que no hay nada bajo su id y el
  // formulario nacía vacío aunque la Solicitud sí tuviera los datos en BD.
  //
  // Se siembra ANTES de montar el subtab, no vía prop `cotizacionTerminos`,
  // porque esa ruta se bloquea en dos casos que aquí son la norma: no aplica en
  // modo sólo lectura, y se descarta cuando ya existe cualquier cosa en sesión
  // — incluido el esqueleto vacío que deja la primera visita.
  useEffect(() => {
    const t = cuenta.terminos;
    if (!cuenta.id || !t || Object.keys(t).length === 0) return;

    const sesion = (loadFromSession<Record<string, any>>(cuenta.id, 'terminos') || {}) as Record<string, any>;

    // Merge POR CAMPO, no todo-o-nada: una visita anterior ya dejó guardados
    // plazo y monto (que el subtab siembra desde el encabezado), así que un
    // guard de "¿está vacía la sesión?" nunca se cumple y las fechas — que sí
    // faltan — no se rellenan jamás. Lo editado gana campo a campo; la
    // Solicitud sólo llena los huecos.
    const merged: Record<string, any> = { ...sesion };
    let cambio = false;

    for (const [k, v] of Object.entries(t)) {
      const valor = CAMPOS_FECHA.includes(k) ? aFechaDatePicker(v) : v;
      if (vacio(valor)) continue;
      if (!vacio(sesion[k])) continue;      // lo que el usuario ya tiene, manda
      merged[k] = valor;
      cambio = true;
    }

    // Normalizar también las fechas que YA estuvieran en sesión en ISO: si no,
    // siguen sin pintarse aunque el valor esté ahí.
    for (const k of CAMPOS_FECHA) {
      if (vacio(sesion[k])) continue;
      const norm = aFechaDatePicker(sesion[k]);
      if (norm !== sesion[k]) { merged[k] = norm; cambio = true; }
    }

    // El encabezado de la cuenta manda sobre lo que quedara en la Solicitud:
    // es el importe con el que la línea opera hoy.
    const montoAut = String(cuenta.montoAut || t.montoAutorizado || '');
    if (montoAut && merged.montoAutorizado !== montoAut) { merged.montoAutorizado = montoAut; cambio = true; }

    if (cambio) saveToSession(cuenta.id, 'terminos', merged);
  }, [cuenta.id, cuenta.terminos, cuenta.montoAut, cuenta.montoSol, cuenta.moneda]);

  // ── Cargos generados por los Movimientos de la Línea ──
  // Se releen cada vez que se entra al subtab Cargos: `activeTab` está en las
  // dependencias a propósito, porque el subtab Movimientos escribe en
  // sessionStorage y un cambio ahí no dispara ningún render aquí.
  // `revisionCargos` fuerza la relectura tras eliminar uno.
  const [revisionCargos, setRevisionCargos] = useState(0);
  const [guardandoCargos, setGuardandoCargos] = useState(false);

  // Los Cargos que ya existen en la base mandan sobre el espejo de sesión: sólo
  // ahí se refleja el estatus real, y un cargo cortado tiene que verse
  // 'Aplicado' aunque la sesión lo recuerde 'Pendiente'.
  const [cargosBD, setCargosBD] = useState<any[] | null>(null);
  const [eliminandoCargo, setEliminandoCargo] = useState(false);

  useEffect(() => {
    if (activeTab !== 'cargos' || !cuenta.id) return;
    let vivo = true;
    cargarCargosLinea(String(cuenta.id)).then(res => {
      if (!vivo) return;
      setCargosBD(res.desdeBD ? res.cargos : null);
    });
    return () => { vivo = false; };
  }, [activeTab, cuenta.id, revisionCargos]);

  /**
   * Cuánto de la línea se ha dispuesto. Se suma de los Movimientos, que es
   * donde vive el dato: cada uno guarda cuánto consumió según la Afectación
   * de la Línea del producto.
   */
  const consumidoDeLaLinea = useMemo(() => {
    if (activeTab !== 'tarjeta' || !cuenta.id) return 0;
    const movs =
      loadCredito<any[]>(cuenta.id, 'movimientosLinea') ??
      loadCreditoGuardado<any[]>(cuenta.id, 'movimientosLinea') ??
      [];
    return (movs || []).reduce((a: number, m: any) => a + (Number(m?.consumido) || 0), 0);
  }, [activeTab, cuenta.id]);

  const cargosDeLaLinea = useMemo(() => {
    if (activeTab !== 'cargos' || !cuenta.id) return undefined;
    // De la base cuando responde; si no, el espejo de sesión para no dejar la
    // pantalla en blanco. `cargosLinea` lo escribe MovimientosLineaTab con el
    // store del CRÉDITO.
    const raw = cargosBD ?? (
      loadCredito<any[]>(cuenta.id, 'cargosLinea') ??
      loadCreditoGuardado<any[]>(cuenta.id, 'cargosLinea') ??
      []);
    return (raw || []).map((c: any) => ({
      id: c.id,
      clave: String(c.clave ?? ''),
      nombre: String(c.nombre ?? c.concepto ?? ''),
      descripcion: c.descripcion,
      naturaleza: c.naturaleza,
      monto: Number(c.monto) || 0,
      fecha: String(c.fecha ?? ''),
      bFactura: c.bFactura,
      bCargo: c.bCargo,
      estatus: c.estatus,
      cxcId: c.cxcId ?? null,
    }));
  }, [activeTab, cuenta.id, revisionCargos, cargosBD]);

  /**
   * Elimina un cargo de la Línea — en la BASE, de inmediato.
   *
   * Antes sólo quitaba el renglón del espejo de sesión y esperaba a "Guardar
   * Línea". No funcionaba: el grid se pinta de `cargosBD`, así que la fila
   * seguía ahí y parecía que el botón no hacía nada.
   *
   * Se reutiliza `sincronizar_cargos_linea` en vez de un DELETE nuevo porque
   * ese RPC ya trae las protecciones: no toca un cargo 'Procesado' ni uno
   * ligado a una CxC, y devuelve cuántos protegió para poder decirlo.
   */
  const eliminarCargoDeLinea = async (origenId: string) => {
    if (!cuenta.id || !origenId || eliminandoCargo) return;

    const enSesion = () =>
      loadCredito<any[]>(cuenta.id, 'cargosLinea') ??
      loadCreditoGuardado<any[]>(cuenta.id, 'cargosLinea') ??
      [];

    // Sin lectura de la base NO se sincroniza: mandar la lista de sesión
    // borraría de J_CARGOS_LINEA todo lo que esa lista no contenga.
    if (cargosBD === null) {
      saveCredito(cuenta.id, 'cargosLinea', enSesion().filter(c => String(c.id) !== String(origenId)));
      setRevisionCargos(n => n + 1);
      toast.warning('Eliminado sólo en pantalla', {
        description: 'No se pudo leer la base. Presione "Guardar Línea" cuando haya conexión.',
        duration: 10000,
      });
      return;
    }

    const restantes = cargosBD.filter(c => String(c.id) !== String(origenId));
    saveCredito(cuenta.id, 'cargosLinea', restantes);

    setEliminandoCargo(true);
    const res = await sincronizarCargosLinea({
      idLineaCredito: String(cuenta.id),
      cargos: restantes as any[],
    });
    setEliminandoCargo(false);
    setRevisionCargos(n => n + 1);

    if (!res.ok) {
      toast.error('No se eliminó el cargo', { description: res.error, duration: 12000 });
      return;
    }
    if (res.protegidos) {
      toast.warning(res.mensaje || 'El cargo no se pudo eliminar', { duration: 12000 });
      return;
    }
    toast.success('Cargo eliminado de la base');
  };

  /** Botón "Guardar Línea" — lleva los cargos de la sesión a J_CARGOS_LINEA. */
  const guardarLinea = async () => {
    if (guardandoCargos || !cuenta.id) return;
    setGuardandoCargos(true);
    const actuales =
      loadCredito<any[]>(cuenta.id, 'cargosLinea') ??
      loadCreditoGuardado<any[]>(cuenta.id, 'cargosLinea') ??
      [];
    const res = await sincronizarCargosLinea({
      idLineaCredito: String(cuenta.id),
      cargos: actuales as any[],
    });
    setGuardandoCargos(false);

    if (!res.ok) {
      toast.error('No se guardaron los cargos', { description: res.error, duration: 12000 });
      return;
    }
    // Si algo quedó protegido, el mensaje del RPC lo explica; no se oculta.
    const detalle =
      `${res.conservados ?? 0} conservado(s) · ${res.eliminados ?? 0} eliminado(s)` +
      `${res.creados ? ` · ${res.creados} nuevo(s)` : ''}`;
    if (res.protegidos) {
      toast.warning(res.mensaje || 'Cargos guardados con reservas', { description: detalle, duration: 12000 });
    } else {
      toast.success('Línea guardada', { description: detalle, duration: 7000 });
    }
    setRevisionCargos(n => n + 1);
  };

  return (
    <div className="bg-white min-h-screen">
      {/* ── Header ── */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-gray-400 hover:text-gray-700 p-1" title="Volver">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M11 4L6 9l5 5" />
              </svg>
            </button>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#666" strokeWidth="1.5">
              <rect x="2" y="5" width="18" height="12" rx="2" /><path d="M2 9h18" />
            </svg>
            <h2 className="text-lg font-normal text-gray-800">
              {isRO ? 'Ver Cuenta TDC' : 'Editar Cuenta TDC'} — {cuenta.noSol}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Guardar a nivel LÍNEA: lleva a la base los cargos que se
                editaron o eliminaron en el subtab, que hasta aquí sólo vivían
                en la sesión. No aparece en modo sólo lectura. */}
            {!isRO && (
              <button
                onClick={guardarLinea}
                disabled={guardandoCargos}
                className="px-4 py-1.5 btn-secondary-theme rounded text-xs disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed"
                title="Persiste los Cargos de esta Línea en la base de datos"
              >
                {guardandoCargos ? 'Guardando…' : 'Guardar Línea'}
              </button>
            )}
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${ESTATUS_COLOR[cuenta.estatus] || 'bg-gray-100 text-gray-600'}`}>
              {cuenta.estatus}
            </span>
            {isRO && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500 border border-gray-200">
                Solo lectura
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Datos clave ── */}
      <div className="px-4 py-2.5 bg-[#F0F2F5] border-b border-gray-300">
        <div className="flex flex-wrap gap-x-8 gap-y-1.5">
          {[
            { label: 'Cliente', value: cuenta.cliente },
            { label: 'Producto', value: cuenta.productoNombre },
            { label: 'Tipo', value: cuenta.tipoProducto || '—' },
            { label: 'Límite Aut.', value: fmtMoney(cuenta.montoAut) },
            { label: 'Tasa', value: cuenta.tasa ? `${cuenta.tasa}%` : '—' },
            { label: 'No. Cuenta', value: cuenta.noCuenta || '—' },
            { label: 'Moneda', value: cuenta.moneda || 'MXN' },
          ].map(chip => (
            <div key={chip.label} className="flex flex-col">
              <span className="text-[9px] text-gray-400 uppercase tracking-wide">{chip.label}</span>
              <span className="text-xs text-gray-800 font-medium">{chip.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Subtabs ── */}
      <div className="bg-primary-theme text-white border-b border-gray-400">
        <div className="px-4 flex items-center overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'bg-secondary-theme text-white font-medium' : 'text-white/90 hover:bg-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenido ── */}
      <div className="px-4 py-4 bg-[#F5F5F5]">
        {activeTab === 'default' && (
          <div className="bg-white border border-gray-300 p-4">
            <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-4">
              <span className="text-sm font-medium text-gray-800">DATOS DE LA CUENTA</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-3">
              {[
                ['No. Solicitud', cuenta.noSol],
                ['No. Cuenta', cuenta.noCuenta || '—'],
                ['Cliente', cuenta.cliente],
                ['Producto', cuenta.productoNombre],
                ['Línea de Producto', cuenta.lineaProducto],
                ['Tipo de Producto', cuenta.tipoProducto || '—'],
                ['Límite Autorizado', fmtMoney(cuenta.montoAut)],
                ['Monto Solicitado', fmtMoney(cuenta.montoSol)],
                ['Tasa', cuenta.tasa ? `${cuenta.tasa}%` : '—'],
                ['Frecuencia', cuenta.frecuencia || '—'],
                ['Moneda', cuenta.moneda || 'MXN'],
                ['Fecha Solicitud', cuenta.fechaSol || '—'],
                ['Estatus', cuenta.estatus],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wide">{k}</span>
                  <span className="text-xs text-gray-800 px-2 py-1 bg-gray-50 border border-gray-200 rounded">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Datos Financieros del solicitante — el mismo acordeón de la Solicitud */}
        {activeTab === 'default' && (
          <div className="mt-3">
            <DatosFinancierosTab mode={modoSubtab} solicitudId={cuenta.id} />
          </div>
        )}

        {activeTab === 'terminos' && (
          <div className="bg-white border border-gray-300 p-4">
            <TerminosCondicionesTab
              mode={modoSubtab}
              solicitudId={cuenta.id}
              lineaProducto={cuenta.lineaProducto}
              tipoProducto={cuenta.tipoProducto}
              productoSeleccionado={productoSel}
              montoSolicitadoHeader={String(cuenta.montoSol || '')}
            />
          </div>
        )}

        {/* Condiciones de la Tarjeta — sustituyen a Bien, Seguro Financiado y la
            nota de amortización, que no aplican a una tarjeta revolvente. */}
        {activeTab === 'terminos' && (
          <div className="mt-3">
            <CondicionesTarjetaTab
              mode={modoSubtab}
              solicitudId={cuenta.id}
              reglaTDC={
                (productoSel as any)?.rawData?.reglasPagoCorteTDC &&
                typeof (productoSel as any).rawData.reglasPagoCorteTDC === 'object'
                  ? (productoSel as any).rawData.reglasPagoCorteTDC
                  : undefined
              }
              tasaMoratoriaProducto={String(
                (productoSel as any)?.rawData?.porcentajeInteresMoratorio ??
                (productoSel as any)?.rawData?.factorMoratorio ??
                ''
              )}
            />
          </div>
        )}

        {activeTab === 'tarjeta' && (
          <div className="bg-white border border-gray-300 p-4">
            <TarjetaCreditoTab
              sid={cuenta.id}
              isRO={isRO}
              titular={cuenta.cliente}
              limiteAutorizado={cuenta.montoAut}
              // Lo consumido sale de los Movimientos de la Línea, que es la
              // única fuente que sabe cuánto de la línea se ha dispuesto.
              consumido={consumidoDeLaLinea}
              reglaTDC={
                (productoSel as any)?.rawData?.reglasPagoCorteTDC &&
                typeof (productoSel as any).rawData.reglasPagoCorteTDC === 'object'
                  ? (productoSel as any).rawData.reglasPagoCorteTDC
                  : undefined
              }
              productoNombre={cuenta.productoNombre}
            />
          </div>
        )}

        {activeTab === 'expedientes' && (
          <div className="bg-white border border-gray-300 p-4">
            <ExpedienteElectronicoTab
              mode="ver"
              solicitudId={cuenta.id}
              faseIdActual={1}
              productoId={cuenta.productoId || cuenta.productoNombre}
              nombreSolicitante={cuenta.cliente}
            />
          </div>
        )}

        {activeTab === 'cargos' && (
          <div className="bg-white border border-gray-300 p-4">
            <SolicitudCargosTab
              mode={modoSubtab}
              solicitudId={cuenta.id}
              lineaProducto={cuenta.lineaProducto}
              tipoProducto={cuenta.tipoProducto}
              // Los Cargos que generaron los Movimientos de la Línea. Se leen
              // aquí, al montar el subtab, para que siempre reflejen el estado
              // actual de `cargosLinea` en vez de depender de que el subtab de
              // Movimientos los haya empujado en su momento.
              cargosLineaTDC={cargosDeLaLinea}
              onEliminarCargoLinea={eliminarCargoDeLinea}
            />
          </div>
        )}

        {activeTab === 'avisos' && (
          <div className="bg-white border border-gray-300 p-4 space-y-6">
            {/* Los Avisos de esta Línea salen del Cierre de Corte (J_CXC_LINEA).
                Van primero porque son los propios de la Tarjeta. */}
            <div>
              <div className="section-header-theme px-3 py-2 mb-3">
                <span className="text-xs text-gray-800">AVISOS DE VENCIMIENTO — TARJETA DE CRÉDITO</span>
              </div>
              <AvisosTDCVista lineaId={cuenta.id} clienteId={cuenta.clienteId} variante="subtab" />
            </div>

            {/* Los de Cobranza genérica (J_FACTURAS) siguen visibles: una misma
                cuenta puede tener ambos y ocultarlos escondería deuda real. */}
            <div>
              <div className="section-header-theme px-3 py-2 mb-3">
                <span className="text-xs text-gray-800">AVISOS DE COBRANZA GENERAL</span>
              </div>
              <AvisosVencimientoTab solicitudId={cuenta.id} />
            </div>
          </div>
        )}

        {activeTab === 'movimientos-linea' && (
          <div className="bg-white border border-gray-300 p-4">
            <MovimientosLineaTab
              sid={cuenta.id}
              mode={isRO ? 'ver' : 'editar'}
              isRO={isRO}
              producto={cuenta.productoNombre}
              sublinea={cuenta.tipoProducto}
              montoAutorizado={String(cuenta.montoAut || '')}
              clienteId={cuenta.clienteId}
            />
          </div>
        )}

        {activeTab === 'cierre-corte' && (
          <div className="bg-white border border-gray-300 p-4">
            <CierreCorteTab
              sid={cuenta.id}
              mode={isRO ? 'ver' : 'editar'}
              isRO={isRO}
              producto={cuenta.productoNombre}
              sublinea={cuenta.tipoProducto}
              clienteId={cuenta.clienteId}
              noCredito={cuenta.noSol}
            />
          </div>
        )}

        {activeTab === 'aplicacion-pagos' && (
          <div className="bg-white border border-gray-300 p-4">
            <AplicacionPagosTab
              sid={cuenta.id}
              mode={isRO ? 'ver' : 'editar'}
              isRO={isRO}
              producto={cuenta.productoNombre}
              sublinea={cuenta.tipoProducto}
              clienteId={cuenta.clienteId}
            />
          </div>
        )}

        {/* §6 — la pantalla toma Línea, Cliente y Producto del contexto abierto. */}
        {activeTab === 'estado-cuenta' && (
          <div className="bg-white border border-gray-300 p-4">
            <EstadoCuentaTDCTab
              sid={cuenta.id}
              isRO={isRO}
              producto={cuenta.productoNombre}
              clienteId={cuenta.clienteId}
              cliente={cuenta.cliente}
              numeroLinea={cuenta.noCuenta || cuenta.noSol}
              limiteAutorizado={cuenta.montoAut}
              moneda={cuenta.moneda || 'MXN'}
              estatusLinea={cuenta.estatus}
            />
          </div>
        )}

        {activeTab === 'movimientos' && (
          <div className="bg-white border border-gray-300 p-4">
            <MovimientosCuentaEjeTab
              mode={modoSubtab}
              clienteId={cuenta.clienteId}
              referenciaCuenta={cuenta.noCuenta ? `Cuenta ${cuenta.noCuenta}` : undefined}
            />
          </div>
        )}
      </div>
    </div>
  );
}
