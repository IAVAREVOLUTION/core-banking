/**
 * DisposicionesTab.tsx — REQ-20 HU-20.2 (CA-05…CA-19).
 *
 * Sustituye el placeholder `DisposicionesPendiente` de REQ-17, que existía
 * porque el sistema no tenía modelo de datos para las disposiciones.
 *
 * La decisión que define este componente (RN-02): **una disposición ES una
 * Solicitud**. No se crea una entidad nueva ni una tabla propia — se da de alta
 * una Solicitud con el mismo `saveSolicitud` que usa el modal de Personas, y se
 * le sella el vínculo a la línea padre en `data.solicitud.disposicionDe`. De ahí
 * salen gratis los dos requisitos del requerimiento: aparece en el módulo de
 * Solicitudes "para continuar" (CA-16) y en esta lista (CA-17).
 *
 * Fuera de alcance por §Decisión 3: disponer NO descuenta el saldo de la línea.
 * Esa es una HU propia (revolvencia) y hacerla a medias aquí produciría un saldo
 * que se desvía en silencio.
 */
import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useSolicitudesDB, fetchNextNoSol } from '../../hooks/useSolicitudesDB';
import { useProductosLineaCreditoDB } from '../../hooks/useProductosLineaCreditoDB';
import {
  getFechaSolicitudNow, EMPTY_FORM,
  type SolicitudFormData,
} from '../solicitudes/solicitudCreditoStore';
import {
  fmtMoneyExacto, parseMon, productosDisposicionDe, vincularDisposicion, lineaPadreDe,
  type LineaCreditoRow,
} from './banca2oPisoStore';

/** CA-08 — dd/mm/aaaa de hoy, mismo formato que el modal de Personas. */
function hoyDisplay(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const ESTATUS_COLOR: Record<string, string> = {
  Pendiente: 'bg-amber-50 text-amber-700 border-amber-200',
  Aprobado: 'bg-green-50 text-green-700 border-green-200',
  Autorizada: 'bg-green-50 text-green-700 border-green-200',
  'En Análisis': 'bg-blue-50 text-blue-700 border-blue-200',
  Rechazado: 'bg-red-50 text-red-700 border-red-200',
  Cancelado: 'bg-gray-100 text-gray-500 border-gray-200',
};

export function DisposicionesTab({
  row,
  onCambio,
}: {
  row: LineaCreditoRow;
  onCambio?: () => void;
}) {
  const { solicitudes, loading, refetch, saveSolicitud } = useSolicitudesDB(true);
  const {
    productos,
    loading: cargandoProductos,
    error: errorProductos,
  } = useProductosLineaCreditoDB(true);

  const [showModal, setShowModal] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [productoId, setProductoId] = useState('');
  const [montoSolicitado, setMontoSolicitado] = useState('');
  const [descripcion, setDescripcion] = useState('');

  // CA-09 — el combo sale del subtab "Productos Disposición" del producto de la
  // línea (`producto.paquetes`), no del catálogo general de productos.
  //
  // Se compara contra `dbUuid` (el UUID de J_PRODUCTOS) y también contra `id`,
  // porque el hook mapea `id` desde `data.localId` — un entero — cuando existe.
  // Una línea sembrada con el id local en vez del UUID no debe quedar sin
  // catálogo por una diferencia de nomenclatura.
  const producto = useMemo(() => {
    const buscado = String(row.productoId || '').trim();
    if (!buscado) return undefined;
    return productos.find(p =>
      String(p.dbUuid || '') === buscado || String(p.id ?? '') === buscado,
    );
  }, [productos, row.productoId]);

  const catalogo = useMemo(() => productosDisposicionDe(producto?.paquetes), [producto]);

  /**
   * Por qué NO se puede abrir el alta todavía, o `null` si sí se puede.
   *
   * Los tres estados —cargando, falló la carga, y de verdad no hay catálogo—
   * producían el mismo mensaje ("no tiene Productos Disposición configurados"),
   * que mandaba al usuario a capturar algo que ya estaba capturado. El catálogo
   * del producto se carga al montar esta pestaña, así que basta con abrirla y
   * pulsar Nuevo de inmediato para caer en el estado "cargando" y leer un
   * diagnóstico falso.
   */
  const impedimento: { titulo: string; detalle: string } | null =
    cargandoProductos
      ? { titulo: 'Cargando el catálogo de productos…', detalle: 'Intente de nuevo en un momento.' }
      : errorProductos
        ? { titulo: 'No se pudo cargar el catálogo de productos', detalle: String(errorProductos) }
        : !row.productoId
          ? {
              titulo: 'La línea no tiene producto asociado',
              detalle: 'Sin producto no hay catálogo de disposición que leer.',
            }
          : !producto
            ? {
                titulo: 'No se encontró el producto de la línea',
                detalle: `producto_id ${row.productoId} no aparece entre los productos de Línea de Crédito.`,
              }
            : catalogo.length === 0
              ? {
                  titulo: 'El producto de la línea no tiene Productos Disposición configurados',
                  detalle: `Captúrelos en el subtab "Productos Disposición" de ${producto.nombre || 'el producto'}.`,
                }
              : null;

  // CA-17 — sólo las disposiciones de ESTA línea.
  const disposiciones = useMemo(
    () => solicitudes.filter(s => lineaPadreDe((s as any)._data) === String(row.id)),
    [solicitudes, row.id],
  );

  const saldo = row.saldoGarantia;
  const tieneSaldo = typeof saldo === 'number';

  const abrirModal = () => {
    // CA-10 — no se deja crear con un producto arbitrario: el catálogo del
    // producto es justamente el control de qué se puede disponer (RN-04).
    if (impedimento) {
      toast.error(impedimento.titulo, { description: impedimento.detalle, duration: 9000 });
      return;
    }
    setProductoId(catalogo.length === 1 ? catalogo[0].id : '');
    // CA-11 — el monto se precarga con el saldo de la línea padre.
    setMontoSolicitado(tieneSaldo ? String(saldo) : '');
    setDescripcion('');
    setShowModal(true);
  };

  const handleGuardar = async () => {
    const prod = catalogo.find(p => p.id === productoId);
    if (!prod) { toast.error('Seleccione el producto de la disposición'); return; }

    const monto = parseMon(montoSolicitado);
    if (!(monto > 0)) { toast.error('El Monto Solicitado debe ser mayor a 0'); return; }
    // §Decisión 4 — se advierte, no se bloquea: mientras el saldo no se descuente
    // al disponer (§Decisión 3), bloquear aquí produciría rechazos falsos.
    if (tieneSaldo && monto > (saldo as number)) {
      toast.warning('El monto excede el saldo de la garantía', {
        description: `Saldo disponible: ${fmtMoneyExacto(saldo as number)}.`,
        duration: 7000,
      });
    }

    setGuardando(true);

    // `no_sol` tiene UNIQUE en la tabla. `consumeNoSol()` lo genera con un
    // contador en memoria que arranca igual en cada sesión, así que colisiona
    // con folios ya guardados y el INSERT revienta. `fetchNextNoSol()` pide el
    // consecutivo real a la BD y sólo cae a un folio con timestamp si no hay
    // conexión — que tampoco choca.
    const folio = await fetchNextNoSol();

    // RN-02 — la disposición ES una Solicitud. Mismo alta que el modal de
    // Personas: cliente y tipo de persona se HEREDAN de la línea (CA-12/CA-13),
    // no se eligen.
    const form: SolicitudFormData & { _clienteId?: string } = {
      ...EMPTY_FORM,
      noSol: folio,
      fechaSolicitud: getFechaSolicitudNow(),
      lineaProducto: prod.lineaProducto || 'Crédito',
      tipoProducto: prod.sublineaProducto || prod.tipo || '',
      productoId: prod.id,
      nombreProducto: prod.nombre,
      montoSolicitado: String(monto),
      tipoPersona: row.tipoPersona || '',
      nombrePersona: row.cliente || '',
      descripcion,
      estatusSolicitud: 'Pendiente', // §Decisión 5 — cae en Originación como cualquier otra
      _clienteId: row.clienteId || '',
      _curp: row.curp || '',
      _rfc: row.rfc || '',
    } as SolicitudFormData & { _clienteId?: string };

    const result = await saveSolicitud(form as SolicitudFormData, undefined, {
      terminos: { montoSolicitado: String(monto) },
    });

    if (!result.ok || !result.id) {
      setGuardando(false);
      toast.error('No se pudo crear la disposición', { description: result.error });
      return;
    }

    // CA-18 — el vínculo va en un PUT aparte porque `formToDBPayload` sólo deja
    // pasar claves conocidas. Si esto falla, la Solicitud YA existe: se dice, en
    // vez de reportar un éxito completo y dejarla huérfana de esta lista.
    const vinculo = await vincularDisposicion(result.id, String(row.id));
    setGuardando(false);

    if (!vinculo.ok) {
      toast.warning('Disposición creada, pero no quedó ligada a la línea', {
        description: `${vinculo.error}. Aparece en Solicitudes, pero no en esta lista hasta que se corrija.`,
        duration: 12000,
      });
    } else {
      toast.success('Disposición creada', {
        description: `${form.noSol} · ${prod.nombre} · ${fmtMoneyExacto(monto)}. Continúe el trámite en Solicitudes.`,
        duration: 7000,
      });
    }

    setShowModal(false);
    await refetch();
    onCambio?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600">
          {disposiciones.length} disposición{disposiciones.length !== 1 ? 'es' : ''}
          {tieneSaldo && (
            <span className="ml-2 text-gray-500">
              · Saldo de la garantía: <strong className="text-gray-700">{fmtMoneyExacto(saldo as number)}</strong>
            </span>
          )}
          {/* El estado del catálogo se ve sin tener que pulsar Nuevo: si algo
              falla, se sabe aquí y no en un toast a destiempo. */}
          <span className="ml-2 text-gray-500">
            · Productos de disposición:{' '}
            {cargandoProductos
              ? <span className="text-gray-400">cargando…</span>
              : catalogo.length > 0
                ? <strong className="text-gray-700">{catalogo.length}</strong>
                : <span className="text-amber-700">ninguno disponible</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="text-xs text-blue-600 hover:text-blue-800">
            Actualizar
          </button>
          <button
            onClick={abrirModal}
            disabled={cargandoProductos}
            title={impedimento ? `${impedimento.titulo} — ${impedimento.detalle}` : 'Crear una disposición sobre esta línea'}
            className="px-3 py-1.5 text-xs font-medium text-white rounded bg-primary-theme hover:opacity-90 disabled:opacity-50"
          >
            {cargandoProductos ? 'Cargando…' : '+ Nuevo'}
          </button>
        </div>
      </div>

      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#2E5C91] text-white">
              <th className="px-2 py-2 text-left font-medium">No. Solicitud</th>
              <th className="px-2 py-2 text-left font-medium">Fecha</th>
              <th className="px-2 py-2 text-left font-medium">Producto</th>
              <th className="px-2 py-2 text-left font-medium">Cliente</th>
              <th className="px-2 py-2 text-right font-medium">Monto Solicitado</th>
              <th className="px-2 py-2 text-right font-medium">Monto Autorizado</th>
              <th className="px-2 py-2 text-left font-medium">Descripción</th>
              <th className="px-2 py-2 text-center font-medium">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-gray-400">Cargando...</td></tr>
            ) : disposiciones.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-gray-400">
                  <p className="text-xs">Sin disposiciones sobre esta línea</p>
                  <p className="text-[11px] mt-1">Use <strong>+ Nuevo</strong> para crear la primera.</p>
                </td>
              </tr>
            ) : disposiciones.map((d: any, idx: number) => (
              <tr key={d._dbId || d.id} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'}`}>
                <td className="px-2 py-2 font-mono text-gray-700">{d.noSol || '—'}</td>
                <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{d.fechaSolicitud || '—'}</td>
                <td className="px-2 py-2 text-gray-700">{d.nombreProducto || '—'}</td>
                <td className="px-2 py-2 text-gray-700">{d.nombreCompleto || row.cliente}</td>
                <td className="px-2 py-2 text-right font-medium text-gray-800">{fmtMoneyExacto(d.montoSolicitado || 0)}</td>
                <td className="px-2 py-2 text-right text-gray-700">
                  {d.montoAutorizado > 0 ? fmtMoneyExacto(d.montoAutorizado) : '—'}
                </td>
                <td className="px-2 py-2 text-gray-600 max-w-[220px] truncate">
                  {d._data?.solicitud?.header?.descripcion || d._descripcion || '—'}
                </td>
                <td className="px-2 py-2 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${ESTATUS_COLOR[d.estatusSolicitud] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {d.estatusSolicitud}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-500 italic">
        Cada disposición es una Solicitud: continúe su trámite desde el módulo de Solicitudes.
      </p>

      {/* ── Modal Nueva Disposición (CA-07) ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => !guardando && setShowModal(false)}
        >
          <div className="bg-white rounded shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="bg-primary-theme px-4 py-2.5 flex items-center justify-between rounded-t">
              <h4 className="text-sm font-bold text-white">Nueva Disposición</h4>
              <button onClick={() => !guardando && setShowModal(false)} className="text-white/70 hover:text-white">✕</button>
            </div>

            <div className="p-4 space-y-3">
              <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE LA DISPOSICIÓN</span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                {/* CA-08 — hoy, no editable */}
                <Campo label="Fecha de Solicitud">
                  <input type="text" value={hoyDisplay()} disabled
                    className="w-full px-2 py-1.5 border border-gray-300 rounded bg-gray-100 text-gray-600" />
                </Campo>

                {/* CA-09 — catálogo del producto de la línea */}
                <Campo label="Producto *">
                  <select value={productoId} onChange={e => setProductoId(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded">
                    <option value="">Seleccione...</option>
                    {catalogo.map(p => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </Campo>

                {/* CA-13 — heredado */}
                <Campo label="Cliente">
                  <input type="text" value={row.cliente} disabled
                    className="w-full px-2 py-1.5 border border-gray-300 rounded bg-gray-100 text-gray-600" />
                </Campo>

                {/* CA-12 — heredado */}
                <Campo label="Tipo de Persona">
                  <input type="text" value={row.tipoPersona || '—'} disabled
                    className="w-full px-2 py-1.5 border border-gray-300 rounded bg-gray-100 text-gray-600" />
                </Campo>

                {/* CA-11 — precargado con el saldo, editable (§Decisión 4) */}
                <Campo label="Monto Solicitado *">
                  <input type="text" value={montoSolicitado}
                    onChange={e => setMontoSolicitado(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-right font-mono" />
                  <span className="text-[10px] text-gray-500">
                    {tieneSaldo
                      ? `Saldo de la garantía: ${fmtMoneyExacto(saldo as number)}${
                          row.saldoGarantiaSembrado ? '' : ' (Monto Garantizado de la línea)'}`
                      : 'La línea no tiene Monto Garantizado capturado en Términos y Condiciones'}
                  </span>
                </Campo>

                <Campo label="Línea / Sublínea">
                  <input type="text"
                    value={catalogo.find(p => p.id === productoId)
                      ? [catalogo.find(p => p.id === productoId)!.lineaProducto,
                         catalogo.find(p => p.id === productoId)!.sublineaProducto].filter(Boolean).join(' / ') || '—'
                      : '—'}
                    disabled
                    className="w-full px-2 py-1.5 border border-gray-300 rounded bg-gray-100 text-gray-600" />
                </Campo>
              </div>

              {/* CA-14 */}
              <div className="text-xs">
                <label className="block text-[10px] text-gray-600 mb-1 uppercase tracking-wider">Descripción</label>
                <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3}
                  placeholder="Describa el destino o la justificación de la disposición"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded" />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} disabled={guardando}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleGuardar} disabled={guardando}
                className="px-3 py-1.5 text-xs font-medium text-white rounded bg-primary-theme hover:opacity-90 disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-gray-600 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
