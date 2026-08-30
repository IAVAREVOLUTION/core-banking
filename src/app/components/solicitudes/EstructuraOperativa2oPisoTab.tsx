/**
 * EstructuraOperativa2oPisoTab.tsx — REQ-9
 *
 * Acordeón "Estructura Operativa de 2o Piso" del formulario de Solicitud / Originación.
 * Corresponde a la Actividad 4 del BPM ("Admisión y Captura del Ecosistema") del producto
 * Garantía Financiera 2o Piso.
 *
 *   Bloque A — Datos heredados del CRM, solo lectura. No hay campos nuevos: todos ya
 *              existen y ya se persisten (ver REQ-9 §Contexto técnico). En particular el
 *              Monto Máximo Contingente NO se recalcula aquí — la Oportunidad ya lo fijó
 *              aplicando el tope de cobertura.
 *   Bloque B — Estructura operativa: Fiduciario, número de fideicomiso, Representante
 *              Común y Notas. Los dos primeros se eligen de las Partes Relacionadas del
 *              Emisor (tipos "Fiduciario" y "Beneficiario Legal"); si no hay ninguna
 *              capturada, se puede buscar en el catálogo general de clientes.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  loadFromSession, loadFromSavedStore, saveToSession, formatCurrency, parseCurrency,
} from './solicitudCreditoStore';
import { useClientesDB } from '../../hooks/useClientesDB';

/**
 * Tipos de relación que alimentan cada buscador.
 *
 * Deben coincidir EXACTAMENTE con el catálogo del subtab "Personas Relacionadas"
 * del módulo Personas (TIPOS_RELACION en PersonasRelacionadas.tsx): el filtro
 * compara el texto tal cual. Ahí el fideicomiso se llama "Fideicomiso".
 */
export const REL_FIDUCIARIO = 'Fideicomiso';
export const REL_BENEFICIARIO_LEGAL = 'Beneficiario Legal';

/** Clave del subtab en sessionStorage y en el nodo de BD. */
export const SUBTAB_ESTRUCTURA_2O_PISO = 'estructura2oPiso';

export interface Estructura2oPisoData {
  institucionFiduciaria: string;
  institucionFiduciariaId: string;
  numeroFideicomisoFuentePago: string;
  representanteComun: string;
  representanteComunId: string;
  notasEstructura2oPiso: string;
}

export const EMPTY_ESTRUCTURA_2O_PISO: Estructura2oPisoData = {
  institucionFiduciaria: '',
  institucionFiduciariaId: '',
  numeroFideicomisoFuentePago: '',
  representanteComun: '',
  representanteComunId: '',
  notasEstructura2oPiso: '',
};

/** Campos obligatorios del Bloque B, con su etiqueta para los avisos. */
export const CAMPOS_OBLIGATORIOS_2O_PISO: { campo: keyof Estructura2oPisoData; etiqueta: string }[] = [
  { campo: 'institucionFiduciaria', etiqueta: 'Institución Fiduciaria' },
  { campo: 'numeroFideicomisoFuentePago', etiqueta: 'Número de Fideicomiso de Fuente de Pago' },
  { campo: 'representanteComun', etiqueta: 'Representante Común de Tenedores' },
];

/**
 * Lee la estructura persistida. La usa también el formulario para validar el avance de
 * fase sin tener que montar este subtab.
 */
export function leerEstructura2oPiso(solicitudId: string | number): Estructura2oPisoData {
  const guardada =
    loadFromSession<Partial<Estructura2oPisoData>>(solicitudId, SUBTAB_ESTRUCTURA_2O_PISO) ??
    loadFromSavedStore<Partial<Estructura2oPisoData>>(solicitudId, SUBTAB_ESTRUCTURA_2O_PISO);
  return { ...EMPTY_ESTRUCTURA_2O_PISO, ...(guardada || {}) };
}

/** Devuelve las etiquetas de los campos obligatorios que faltan. */
export function faltantesEstructura2oPiso(datos: Estructura2oPisoData): string[] {
  return CAMPOS_OBLIGATORIOS_2O_PISO
    .filter(c => !String(datos[c.campo] || '').trim())
    .map(c => c.etiqueta);
}

interface ParteRelacionada {
  tipoRelacion?: string;
  nombreCompleto?: string;
  nombre?: string;
  personaId?: string;
  clienteId?: string;
  rfc?: string;
}

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: string | number;
  /** Bloque A — heredados, solo lectura. */
  folioSolicitudLOS?: string;
  folioOrigenCRM?: string;
  acreditadoEmisor?: string;
  /** UUID del cliente Emisor — de ahí salen sus Personas Relacionadas. */
  clienteId?: string;
  /** Notifica al formulario para que valide el avance sin montar este subtab. */
  onChange?: (datos: Estructura2oPisoData) => void;
}

export function EstructuraOperativa2oPisoTab({
  mode, solicitudId, folioSolicitudLOS, folioOrigenCRM, acreditadoEmisor, clienteId, onChange,
}: Props) {
  const isRO = mode === 'ver';

  const [datos, setDatos] = useState<Estructura2oPisoData>(() => leerEstructura2oPiso(solicitudId));
  const [modalAbierto, setModalAbierto] = useState<null | 'fiduciario' | 'representante'>(null);
  const [filtroModal, setFiltroModal] = useState('');

  /**
   * ¿Este montaje llegó a tener datos? Mismo blindaje que el Expediente Electrónico:
   * el efecto de guardado corre también en el primer render, y sin esta guarda un
   * objeto vacío inicial pisaría en sesión lo que ya estaba guardado.
   */
  const huboDatosRef = useRef(false);
  const hayAlgo = Object.values(datos).some(v => String(v || '').trim());
  if (hayAlgo) huboDatosRef.current = true;

  useEffect(() => {
    if (isRO) return;
    if (!huboDatosRef.current) return;
    saveToSession(solicitudId, SUBTAB_ESTRUCTURA_2O_PISO, datos);
    onChange?.(datos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, solicitudId, isRO]);

  // ── Bloque A — heredados de Términos y Condiciones (los escribió la Oportunidad) ──
  const terminos = useMemo<any>(() => (
    loadFromSession<any>(solicitudId, 'terminos') ??
    loadFromSavedStore<any>(solicitudId, 'terminos') ??
    {}
  ), [solicitudId]);

  const money = (v: any) => {
    const n = parseFloat(parseCurrency(String(v ?? '0')));
    // formatCurrency ya incluye el símbolo de moneda — anteponerle otro "$"
    // producía "$2,500,000,000.00".
    return !n || isNaN(n) ? '—' : formatCurrency(n);
  };

  // ── Personas Relacionadas del Emisor, para precargar los buscadores ──
  //
  // La fuente es el CLIENTE, no la Solicitud: el usuario las captura en
  // Personas → Personas Relacionadas, y viven en J_CLIENTES.data.personasRelacionadas.
  // Leer sólo el subtab de la Solicitud dejaba los buscadores siempre vacíos.
  // Como respaldo se conservan las partes capturadas en la propia Solicitud.
  const { clientes } = useClientesDB(true);
  const partes = useMemo<ParteRelacionada[]>(() => {
    const delCliente = (() => {
      if (!clienteId) return [];
      const c = clientes.find(x => String(x.dbUuid) === String(clienteId) || String(x.idCliente) === String(clienteId));
      const arr = (c as any)?._rawData?.personasRelacionadas;
      return Array.isArray(arr) ? arr : [];
    })();
    const deLaSolicitud =
      loadFromSession<ParteRelacionada[]>(solicitudId, 'partesRelacionadas') ??
      loadFromSavedStore<ParteRelacionada[]>(solicitudId, 'partesRelacionadas') ??
      [];
    return [...delCliente, ...deLaSolicitud];
  }, [clienteId, clientes, solicitudId]);

  const candidatos = (tipo: string) => partes.filter(
    p => (p.tipoRelacion || '').trim().toLowerCase() === tipo.toLowerCase(),
  );
  // El cliente guarda `nombreCompleto`; la Solicitud usaba `nombre`. Se aceptan
  // ambos para no depender de qué origen alimentó la lista.
  const nombreDeParte = (p: ParteRelacionada) =>
    p.nombreCompleto || p.nombre || (p as any).nombrePersona || '';

  const set = (campo: keyof Estructura2oPisoData, valor: string) => {
    if (isRO) return;
    setDatos(prev => ({ ...prev, [campo]: valor }));
  };

  const elegirParte = (destino: 'fiduciario' | 'representante', p: ParteRelacionada) => {
    const id = p.personaId || p.clienteId || '';
    if (destino === 'fiduciario') {
      setDatos(prev => ({ ...prev, institucionFiduciaria: nombreDeParte(p), institucionFiduciariaId: id }));
    } else {
      setDatos(prev => ({ ...prev, representanteComun: nombreDeParte(p), representanteComunId: id }));
    }
  };

  const roClass = 'w-full px-2 py-1.5 text-xs bg-gray-100 border border-gray-200 rounded text-gray-600';
  const inputClass = 'w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]';

  const faltantes = faltantesEstructura2oPiso(datos);

  /**
   * Buscador con precarga desde Partes Relacionadas + salida al catálogo.
   *
   * Es una FUNCIÓN que devuelve JSX, no un componente anidado. Declarado como
   * componente dentro del render, React le asigna una identidad nueva en cada
   * render y lo desmonta/remonta con cada tecla o selección — se pierde el foco
   * al escribir y la primera selección no llegaba a aplicarse.
   */
  const renderBuscador = ({ destino, tipo, valor, etiqueta }: {
    destino: 'fiduciario' | 'representante';
    tipo: string;
    valor: string;
    etiqueta: string;
  }) => {
    const lista = candidatos(tipo);
    return (
      <div>
        <label className="block text-xs text-gray-700 mb-1">
          {etiqueta} <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <input type="text" value={valor} readOnly placeholder="Sin seleccionar"
            className={`${roClass} flex-1`} />
          {!isRO && (
            <button
              onClick={() => setModalAbierto(destino)}
              className="px-3 py-1.5 bg-[#4A6FA5] text-white rounded text-xs hover:bg-[#3A5A8A] whitespace-nowrap"
            >
              Buscar
            </button>
          )}
        </div>
        {/*
          Sin lista de chips en línea: la selección ocurre en el buscador, que ya
          está acotado al tipo. Sólo se conserva el aviso de que no hay ninguna,
          porque explica por qué el buscador saldría vacío.
        */}
        {!isRO && lista.length === 0 && (
            <p className="mt-1.5 text-[10px] text-amber-600">
              El Emisor no tiene Personas Relacionadas con tipo «{tipo}». Captúrelas en
              <span className="font-medium"> Personas → Personas Relacionadas</span> del
            cliente, o use Buscar.
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="border border-gray-200 bg-white p-5">
      <div className="bg-teal-50 border border-teal-200 rounded px-3 py-2 mb-4">
        <p className="text-xs text-teal-800">
          <strong>Admisión y Captura del Ecosistema</strong> — complete la estructura
          operativa de Segundo Piso: Fiduciario, fideicomiso de fuente de pago y
          Representante Común de los tenedores.
        </p>
      </div>

      {/* ═══ Bloque A — heredados del CRM (solo lectura) ═══ */}
      <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
        DATOS HEREDADOS DEL CRM
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 mb-5">
        <div>
          <label className="block text-xs text-gray-700 mb-1">Folio Solicitud LOS</label>
          <input type="text" value={folioSolicitudLOS || '—'} disabled className={roClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Folio de Origen CRM</label>
          <input type="text" value={folioOrigenCRM || '—'} disabled className={roClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Acreditado Final / Emisor</label>
          <input type="text" value={acreditadoEmisor || '—'} disabled className={roClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Monto de Emisión Proyectado</label>
          <input type="text" value={money(terminos.montoEmisionProyectado)} disabled className={`${roClass} text-right font-mono`} />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Porcentaje de Cobertura GPO</label>
          <input type="text" value={terminos.porcentajeCoberturaGpo ? `${terminos.porcentajeCoberturaGpo}%` : '—'} disabled className={`${roClass} text-right font-mono`} />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Monto Máximo Contingente (Exposición)</label>
          <input type="text" value={money(terminos.montoGarantizadoGpo)} disabled className={`${roClass} text-right font-mono`} />
          <span className="text-[10px] text-gray-400 mt-0.5 block">
            Emisión × Cobertura. Lo fija la Oportunidad; aquí no se recalcula.
          </span>
        </div>
      </div>

      {/* ═══ Bloque B — captura ═══ */}
      <div className="bg-primary-light-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
        ESTRUCTURA OPERATIVA DE 2o PISO
      </div>

      {!isRO && faltantes.length > 0 && (
        <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-700">
          Falta capturar: <span className="font-medium">{faltantes.join(' · ')}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
        {renderBuscador({
          destino: 'fiduciario',
          tipo: REL_FIDUCIARIO,
          valor: datos.institucionFiduciaria,
          etiqueta: 'Institución Fiduciaria',
        })}
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Número de Fideicomiso de Fuente de Pago <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={datos.numeroFideicomisoFuentePago}
            onChange={e => set('numeroFideicomisoFuentePago', e.target.value)}
            disabled={isRO}
            placeholder="Ej. F/482910"
            className={isRO ? roClass : inputClass}
          />
        </div>
        {renderBuscador({
          destino: 'representante',
          tipo: REL_BENEFICIARIO_LEGAL,
          valor: datos.representanteComun,
          etiqueta: 'Representante Común de Tenedores',
        })}
      </div>

      <div className="mt-4">
        <label className="block text-xs text-gray-700 mb-1">Notas</label>
        <textarea
          rows={4}
          value={datos.notasEstructura2oPiso}
          onChange={e => set('notasEstructura2oPiso', e.target.value)}
          disabled={isRO}
          placeholder="Observaciones sobre la estructura operativa..."
          className={`${isRO ? roClass : inputClass} resize-y`}
        />
      </div>

      {/*
        Buscador acotado. Deliberadamente NO usa el catálogo general de clientes:
        sólo lista las Personas Relacionadas del Emisor cuyo tipo corresponde al
        campo (Fideicomiso o Beneficiario Legal). Traer los 21 clientes obligaba
        a elegir a mano uno que quizá ni siquiera tiene esa relación con el Emisor.
      */}
      {modalAbierto !== null && (() => {
        const tipo = modalAbierto === 'fiduciario' ? REL_FIDUCIARIO : REL_BENEFICIARIO_LEGAL;
        const lista = candidatos(tipo).filter(pr => {
          const q = filtroModal.trim().toLowerCase();
          if (!q) return true;
          return `${nombreDeParte(pr)} ${pr.rfc || ''}`.toLowerCase().includes(q);
        });
        const cerrar = () => { setModalAbierto(null); setFiltroModal(''); };
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={cerrar}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[80vh] overflow-hidden border border-gray-200/50 flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#4A6FA5] to-[#607698]">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {modalAbierto === 'fiduciario' ? 'Institución Fiduciaria' : 'Representante Común de Tenedores'}
                  </h3>
                  <p className="text-[11px] text-white/80">
                    Personas Relacionadas del Emisor con tipo «{tipo}» — {lista.length} disponible(s)
                  </p>
                </div>
                <button onClick={cerrar} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20">✕</button>
              </div>

              <div className="px-5 py-3 border-b border-gray-100">
                <input
                  type="text"
                  value={filtroModal}
                  onChange={e => setFiltroModal(e.target.value)}
                  placeholder="Buscar por nombre o RFC..."
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#4A6FA5]/30 focus:border-[#4A6FA5]"
                />
              </div>

              <div className="overflow-y-auto flex-1">
                {lista.length === 0 ? (
                  <div className="px-5 py-8 text-center text-xs text-gray-500">
                    El Emisor no tiene Personas Relacionadas con tipo «{tipo}».
                    <div className="mt-1 text-[11px] text-gray-400">
                      Captúrelas en Personas → Personas Relacionadas del cliente.
                    </div>
                  </div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">Nombre</th>
                        <th className="px-4 py-2 text-left text-[11px] font-semibold text-gray-500 uppercase">RFC</th>
                        <th className="px-4 py-2 text-center text-[11px] font-semibold text-gray-500 uppercase">Tipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lista.map((pr, i) => (
                        <tr
                          key={`${nombreDeParte(pr)}-${i}`}
                          onClick={() => { elegirParte(modalAbierto, pr); cerrar(); }}
                          className="cursor-pointer hover:bg-blue-50"
                        >
                          <td className="px-4 py-2.5 font-medium text-gray-700">{nombreDeParte(pr)}</td>
                          <td className="px-4 py-2.5 text-gray-500 font-mono">{pr.rfc || '—'}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">{pr.tipoRelacion}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50 flex justify-end">
                <button onClick={cerrar} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
