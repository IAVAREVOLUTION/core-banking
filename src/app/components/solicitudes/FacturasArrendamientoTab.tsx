import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  type FacturaArrendamiento, type EstatusFactura, ESTATUS_FACTURA_LIQUIDADA,
  loadFromSession, loadFromSavedStore, saveToSession, saveToSavedStore, formatCurrency,
} from './solicitudCreditoStore';
import { fetchEstatusFacturaCobranza } from '../../hooks/useCarteraDB';
import { fetchEstatusSolicitudActivacion } from '../../hooks/useSolicitudesActivacionDB';

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: number | string | 'new';
  esArrendamientoPuro: boolean;
  facturaInicialGenerada: boolean;
  facturaProveedorGenerada: boolean;
  onGenerarFacturaInicial: () => Promise<void> | void;
  onGenerarFacturaProveedor: () => Promise<void> | void;
}

const TIPO_LABEL: Record<string, string> = {
  DESEMBOLSO_INICIAL: 'Pago Inicial',
  COMPRA_PROVEEDOR: 'Compra a Proveedor',
};

/**
 * Cobranza y Solicitudes de Activación marcan 'Pagado'; el store de la
 * solicitud usa 'Pagada'. Los demás estatus de Activación ('Autorizada',
 * 'Activada', 'Activo', 'Enviada', 'Rechazada') pasan tal cual.
 */
function normalizarEstatusCobranza(estatus: string | undefined): EstatusFactura | undefined {
  if (!estatus) return undefined;
  if (estatus === 'Pagado') return 'Pagada';
  return estatus as EstatusFactura;
}

function BadgeEstatus({ estatus }: { estatus: EstatusFactura }) {
  // Verde = liquidada. La cuenta por pagar del proveedor puede quedar en
  // 'Autorizada'/'Activada'/'Activo' además de 'Pagada' (catálogo de
  // Solicitudes de Activación); todas ésas ya no requieren acción.
  const cls = ESTATUS_FACTURA_LIQUIDADA.includes(estatus)
    ? 'bg-green-100 text-green-700 border-green-200'
    : estatus === 'Cancelada' || estatus === 'Rechazada'
    ? 'bg-red-100 text-red-700 border-red-200'
    : 'bg-amber-100 text-amber-700 border-amber-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      {estatus}
    </span>
  );
}

/**
 * Subtab "Facturas" — Originación → Solicitud.
 *
 * Muestra las facturas del ciclo de Arrendamiento — Puro y Financiero (Pago Inicial en Fase 4,
 * Compra a Proveedor en Fase 5) que ya gestiona SolicitudCreditoForm bajo la key
 * 'facturas' (mismo array que usan FaseActionsComponent y las validaciones de
 * handleEnviarFase). No duplica la generación: reutiliza los handlers del padre
 * para que exista una sola factura por tipo y solicitud — nunca una segunda
 * factura creada solo para "verse" en esta pestaña.
 *
 * El estatus de pago se refresca desde Cobranza al montar (mismo criterio que
 * usan las validaciones de Fase 4/6: la copia local no es la fuente de verdad,
 * Cobranza sí lo es).
 */
export function FacturasArrendamientoTab({
  mode, solicitudId, esArrendamientoPuro,
  facturaInicialGenerada, facturaProveedorGenerada,
  onGenerarFacturaInicial, onGenerarFacturaProveedor,
}: Props) {
  const isRO = mode === 'ver';

  const getInit = (): FacturaArrendamiento[] =>
    loadFromSession<FacturaArrendamiento[]>(solicitudId, 'facturas')
    || loadFromSavedStore<FacturaArrendamiento[]>(solicitudId, 'facturas')
    || [];

  const [facturas, setFacturas] = useState<FacturaArrendamiento[]>(getInit);
  const [refrescando, setRefrescando] = useState(false);
  const [generando, setGenerando] = useState<'inicial' | 'proveedor' | null>(null);
  const [xmlModal, setXmlModal] = useState<FacturaArrendamiento | null>(null);

  const guardar = (nuevas: FacturaArrendamiento[]) => {
    setFacturas(nuevas);
    saveToSession(solicitudId, 'facturas', nuevas);
    saveToSavedStore(solicitudId, 'facturas', nuevas);
  };

  /**
   * Refresca el estatus real de cada factura contra SU módulo de origen.
   *
   * Las dos facturas del ciclo NO viven en el mismo lado, aunque ambas guarden
   * el id en `facturaIdCobranza`:
   *   · DESEMBOLSO_INICIAL → Cobranza (cuenta por cobrar).
   *   · COMPRA_PROVEEDOR   → Solicitudes de Activación (cuenta por pagar).
   * Preguntarle a Cobranza por la del proveedor devolvía "no existe" y la fila
   * se quedaba en "Pendiente" para siempre.
   */
  const refrescarEstatusCobranza = async (base: FacturaArrendamiento[]) => {
    const conCobranza = base.filter(f => !!f.facturaIdCobranza);
    if (conCobranza.length === 0) return;

    setRefrescando(true);
    try {
      const resultados = await Promise.all(
        conCobranza.map(f => (
          f.tipo === 'COMPRA_PROVEEDOR'
            ? fetchEstatusSolicitudActivacion(f.facturaIdCobranza!)
            : fetchEstatusFacturaCobranza(f.facturaIdCobranza!)
        ))
      );
      let huboCambios = false;
      const actualizadas = base.map(f => {
        const idx = conCobranza.findIndex(c => c.id === f.id);
        if (idx === -1) return f;
        const res = resultados[idx];
        if (!res.ok) {
          // Antes fallaba mudo: el estatus se quedaba viejo sin ninguna señal.
          console.warn(
            `[FacturasArrendamiento] No se pudo leer el estatus de ${f.tipo} (${f.noFactura}) ` +
            `en ${f.tipo === 'COMPRA_PROVEEDOR' ? 'Solicitudes de Activación' : 'Cobranza'}:`,
            res.error
          );
          return f;
        }
        const estatusReal = normalizarEstatusCobranza(res.estatus) || f.estatus;
        if (estatusReal !== f.estatus || (res.noDocto && res.noDocto !== f.noFactura)) {
          huboCambios = true;
          return { ...f, estatus: estatusReal, noFactura: res.noDocto || f.noFactura };
        }
        return f;
      });
      if (huboCambios) guardar(actualizadas);
    } finally {
      setRefrescando(false);
    }
  };

  useEffect(() => {
    if (esArrendamientoPuro) refrescarEstatusCobranza(getInit());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [solicitudId, esArrendamientoPuro]);

  // ── Refresco automático del estatus ──
  // Cobranza es la fuente de verdad y el pago se aplica FUERA de esta pantalla.
  // Este subtab vive en un acordeón: se monta una sola vez con el formulario y
  // ya no se vuelve a montar, así que el efecto de arriba corre una única vez —
  // pagar en Cobranza con el formulario abierto dejaba la fila en "Pendiente"
  // para siempre.
  //
  // Se re-consulta al recuperar el foco de la ventana (volver de Cobranza) y en
  // intervalo, pero SÓLO mientras quede alguna factura sin pagar: cuando todas
  // llegan a "Pagada" el polling se apaga solo y no se gastan llamadas.
  const hayPendientes = facturas.some(
    f => !!f.facturaIdCobranza
      && !ESTATUS_FACTURA_LIQUIDADA.includes(f.estatus)
      && f.estatus !== 'Cancelada' && f.estatus !== 'Rechazada'
  );

  useEffect(() => {
    if (!esArrendamientoPuro || !hayPendientes) return;

    const refrescar = () => refrescarEstatusCobranza(getInit());
    const alVolverAlFoco = () => {
      if (document.visibilityState === 'visible') refrescar();
    };

    window.addEventListener('focus', alVolverAlFoco);
    document.addEventListener('visibilitychange', alVolverAlFoco);
    const timer = window.setInterval(refrescar, 30000);

    return () => {
      window.removeEventListener('focus', alVolverAlFoco);
      document.removeEventListener('visibilitychange', alVolverAlFoco);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esArrendamientoPuro, hayPendientes, solicitudId]);

  const handleGenerar = async (tipo: 'inicial' | 'proveedor') => {
    setGenerando(tipo);
    try {
      if (tipo === 'inicial') await onGenerarFacturaInicial();
      else await onGenerarFacturaProveedor();
      // Los handlers del padre ya persisten en session/savedStore — releer.
      const actualizadas = getInit();
      setFacturas(actualizadas);
      await refrescarEstatusCobranza(actualizadas);
    } finally {
      setGenerando(null);
    }
  };

  if (!esArrendamientoPuro) {
    return (
      <div className="p-5 text-center py-12 border border-dashed border-gray-200 rounded-xl bg-gradient-to-b from-gray-50/50 to-white">
        <p className="text-sm text-gray-500 font-medium">Facturación no disponible</p>
        <p className="text-xs text-gray-400 mt-1">Este subtab aplica únicamente a solicitudes de Arrendamiento (Puro o Financiero).</p>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-sm font-semibold text-gray-800">Facturas de la Solicitud</h4>
          <p className="text-[10px] text-gray-400 leading-tight">
            {solicitudId === 'new' ? 'Nueva Solicitud' : `Sol. ${solicitudId}`}
            {refrescando && ' · Actualizando estatus desde Cobranza…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Disponible también en modo lectura: consultar no muta nada. */}
          <button
            onClick={() => refrescarEstatusCobranza(getInit())}
            disabled={refrescando || !facturas.some(f => !!f.facturaIdCobranza)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Volver a consultar el estatus de las facturas en Cobranza"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
              className={refrescando ? 'animate-spin' : undefined}>
              <path d="M10.5 6a4.5 4.5 0 1 1-1.32-3.18" />
              <path d="M10.5 1v3h-3" />
            </svg>
            {refrescando ? 'Actualizando…' : 'Actualizar estatus'}
          </button>
          {!isRO && (
            <>
            <button
              onClick={() => handleGenerar('inicial')}
              disabled={facturaInicialGenerada || generando !== null}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200 shadow-sm bg-[#4A6FA5] text-white hover:bg-[#3A5A8A] disabled:opacity-50 disabled:cursor-not-allowed"
              title={facturaInicialGenerada ? 'La Factura de Pago Inicial ya fue generada' : 'Generar Factura de Pago Inicial'}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 1v10M1 6h10" />
              </svg>
              {generando === 'inicial' ? 'Generando…' : facturaInicialGenerada ? 'Pago Inicial generada' : '+ Generar Factura de Pago Inicial'}
            </button>
            <button
              onClick={() => handleGenerar('proveedor')}
              disabled={facturaProveedorGenerada || generando !== null}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
              title={facturaProveedorGenerada ? 'La Factura del Proveedor ya fue generada' : 'Generar Factura del Proveedor'}
            >
              {generando === 'proveedor' ? 'Generando…' : facturaProveedorGenerada ? 'Proveedor generada' : '+ Generar Factura del Proveedor'}
            </button>
            </>
          )}
        </div>
      </div>

      {facturas.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl bg-gradient-to-b from-gray-50/50 to-white">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gray-100 flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="#C4C9D4" strokeWidth="1.5">
              <path d="M6 4h16v20H6z" /><path d="M10 10h8M10 14h8M10 18h4" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 font-medium mb-1">Sin facturas</p>
          <p className="text-xs text-gray-400">
            {!isRO ? 'Presione "Generar Factura de Pago Inicial" para comenzar.' : 'No se han generado facturas para esta solicitud.'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">No. Factura</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Concepto</th>
                  <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Monto</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Estatus</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Módulo Origen</th>
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {facturas.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-700">{TIPO_LABEL[f.tipo] || f.tipo}</td>
                    <td className="px-3 py-2 font-mono text-gray-800">{f.noFactura || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{f.titulo}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-800">{formatCurrency(f.total)}</td>
                    <td className="px-3 py-2 text-gray-600">{f.fechaEmision || '—'}</td>
                    <td className="px-3 py-2"><BadgeEstatus estatus={f.estatus} /></td>
                    <td className="px-3 py-2 text-gray-500">
                      {f.facturaIdCobranza ? 'Originación / Cobranza' : 'Originación'}
                    </td>
                    <td className="px-3 py-2">
                      {f.xml ? (
                        <button onClick={() => setXmlModal(f)} className="text-[11px] text-[#4A6FA5] hover:underline">
                          Ver XML
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400">Ver</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-100 flex justify-between items-center">
            <span className="text-[10px] text-gray-400">{facturas.length} factura{facturas.length !== 1 ? 's' : ''} registrada{facturas.length !== 1 ? 's' : ''}</span>
            <span className="text-xs font-semibold text-gray-700">
              Total: {formatCurrency(facturas.reduce((s, f) => s + f.total, 0))}
            </span>
          </div>
        </div>
      )}

      {xmlModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setXmlModal(null)}>
          <div className="bg-white shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col border-2 border-gray-400" onClick={e => e.stopPropagation()}>
            <div className="bg-[#2E5C91] px-4 py-2.5 border-b-2 border-gray-400 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">CFDI — {xmlModal.noFactura}</h3>
              <button onClick={() => setXmlModal(null)} className="text-white hover:text-gray-300 font-bold text-lg leading-none">×</button>
            </div>
            <div className="px-4 py-3 overflow-auto bg-white flex-1">
              <pre className="text-[10px] text-gray-700 whitespace-pre-wrap break-all bg-gray-50 border border-gray-200 rounded p-3">{xmlModal.xml}</pre>
            </div>
            <div className="flex gap-2 justify-end px-4 py-3 border-t border-gray-300">
              <button
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(xmlModal.xml || '');
                    toast.success('XML copiado al portapapeles');
                  } catch { toast.error('No se pudo copiar el XML'); }
                }}
                className="px-4 py-1.5 bg-white border border-gray-400 text-gray-700 text-xs rounded hover:bg-gray-50"
              >
                Copiar
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([xmlModal.xml || ''], { type: 'application/xml' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${xmlModal.noFactura || 'cfdi'}.xml`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  setTimeout(() => URL.revokeObjectURL(url), 30_000);
                }}
                className="px-4 py-1.5 bg-[#4A6FA5] text-white text-xs rounded hover:bg-[#3E5C91]"
              >
                Descargar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
