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
import { useState, useMemo, useEffect, useRef } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from 'sonner';
import { useSolicitudesDB, fetchNextNoSol } from '../../hooks/useSolicitudesDB';
import { useProductosLineaCreditoDB } from '../../hooks/useProductosLineaCreditoDB';
import {
  getFechaSolicitudNow, EMPTY_FORM, CAT_FRECUENCIA,
  type SolicitudFormData,
} from '../solicitudes/solicitudCreditoStore';
import { DatePicker } from '../ui/DatePicker';
import { dmyADate, dateAIso, calcularFechaFin } from '../../lib/fechasPlazo';
import { CARTA_COMERCIAL, CARTA_STANDBY } from '../../lib/sublineasCartaCredito';
import {
  fmtMoneyExacto, parseMon, productosDisposicionDe, vincularDisposicion, lineaPadreDe,
  type LineaCreditoRow,
} from './banca2oPisoStore';
import {
  esSubLineaCartaCredito, parametrosSubLinea, ESTADO_ACTIVA, ROL_BENEFICIARIO_CARTA, ROL_ORDENANTE,
  modalidadDe, MODALIDAD_AUTOMATICA,
} from '../../lib/sublineasCartaCredito';
import { activarSublinea, rechazarSublinea } from './sublineasStore';
import { registrarBitacoraFase } from '../../lib/auditoria';
import {
  construirCalendarioComisiones, cobrosEnVigencia, simulacionParaBD, COBROS_POR_ANIO,
} from '../../lib/calendarioComisiones';
import { useClientesDB } from '../../hooks/useClientesDB';
import { productoPorId, liberarSublinea, operacionDe, normalizarSublinea } from './sublineasStore';
import { OperacionSublineaModal } from './OperacionSublineaModal';

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
  // SubLíneas de Carta de Crédito
  Activa: 'bg-green-50 text-green-700 border-green-200',
  Liberada: 'bg-blue-50 text-blue-700 border-blue-200',
  Cerrada: 'bg-gray-100 text-gray-600 border-gray-300',
  Rechazada: 'bg-red-50 text-red-700 border-red-200',
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
  // ── Plazo, vigencia y datos de la Carta (se ven ya llenos en Originación) ──
  const [plazo, setPlazo] = useState('');
  /** Frecuencia de Términos y Condiciones: el periodo con el que se mide el Plazo. */
  const [frecuencia, setFrecuencia] = useState('Mensual');
  const [fechaInicio, setFechaInicio] = useState('');
  const [tipoCarta, setTipoCarta] = useState('');
  const [noCarta, setNoCarta] = useState('');
  const diasPeriodo = CAT_FRECUENCIA.find(f => f.value === frecuencia)?.dias || 30;
  /**
   * Matriz de Tasa Fija del producto de la disposición — mismo mecanismo que el
   * encabezado de la Solicitud: elegir una fila fija Plazo (default de la fila),
   * Tasa (default) y Frecuencia (periodo de la fila), y propone el Monto default
   * si el capturado falta o queda fuera del rango. Sin Matriz, Plazo y
   * Frecuencia se capturan a mano.
   */
  const [showMatriz, setShowMatriz] = useState(false);
  const [filaMatriz, setFilaMatriz] = useState<FilaMatriz | null>(null);
  const [tasa, setTasa] = useState('');
  /**
   * Periodicidad Cobro Comisión — cada cuánto se cobra la comisión sobre el
   * Monto Garantizado. Es el mismo campo de Términos y Condiciones que usa la
   * Cotización (calendario de comisiones); independiente del Plazo/Frecuencia.
   */
  const [periodicidadComision, setPeriodicidadComision] = useState('');
  const plazoNum = parseInt(plazo, 10) || 0;
  const plazoDias = plazoNum * diasPeriodo;
  const fechaFin = calcularFechaFin(fechaInicio, plazoNum, diasPeriodo);
  /** Índice en `beneficiarios` de la parte elegida ('' = ninguna). */
  const [beneficiarioIdx, setBeneficiarioIdx] = useState('');
  /** Ordenante / Acreditado Final — la otra parte obligatoria de la Carta (MD 05). */
  const [ordenanteIdx, setOrdenanteIdx] = useState('');

  // ── Beneficiario: Partes Relacionadas de la Línea Global padre ──
  // Fuente principal: las Partes Relacionadas de la Solicitud de la línea
  // (`data.solicitud.partes_relacionadas`). Si la línea no tiene ninguna, se
  // ofrecen las Personas Relacionadas del cliente (maestro), que es de donde la
  // Solicitud las hereda (MD SubLíneas 05: Persona → Personas Relacionadas →
  // Partes Relacionadas). Las de tipo Beneficiario van primero.
  const { clientes } = useClientesDB(true);
  const { beneficiarios, origenBeneficiarios } = useMemo((): { beneficiarios: Beneficiario[]; origenBeneficiarios: string } => {
    const filaLinea: any = solicitudes.find((s: any) => String(s._dbId || s.id) === String(row.id));
    const partesLinea: any[] = Array.isArray(filaLinea?._data?.solicitud?.partes_relacionadas)
      ? filaLinea._data.solicitud.partes_relacionadas : [];
    const deLinea: Beneficiario[] = partesLinea.map((p: any) => ({
      nombre: String(p?.persona?.nombreCompleto || p?.nombreCompleto || '').trim(),
      rfc: String(p?.persona?.rfc || p?.rfc || ''),
      curp: String(p?.persona?.curp || p?.curp || ''),
      telefono: String(p?.persona?.telefono || p?.telefono || ''),
      email: String(p?.persona?.email || p?.email || ''),
      tipo: String(p?.relacionLegal || p?.tipoRelacion || p?.rolAsignado || ''),
    }));
    const cliente: any = clientes.find(c => String(c.dbUuid) === String(row.clienteId) || String((c as any).idCliente) === String(row.clienteId));
    const delCliente: Beneficiario[] = (Array.isArray(cliente?._rawData?.personasRelacionadas) ? cliente._rawData.personasRelacionadas : [])
      .map((p: any) => ({
        nombre: String(p?.nombreCompleto || p?.nombre || '').trim(),
        rfc: String(p?.rfc || ''), curp: String(p?.curp || ''),
        telefono: String(p?.telefono || ''), email: String(p?.email || p?.correoElectronico || ''),
        tipo: String(p?.tipoRelacion || ''),
      }));
    const usar: Beneficiario[] = deLinea.some(b => b.nombre) ? deLinea : delCliente;
    const esBenef = (t: string) => t.toLowerCase().includes('beneficiario');
    const lista = usar.filter(b => b.nombre).sort((a, b) => Number(esBenef(b.tipo)) - Number(esBenef(a.tipo)));
    return { beneficiarios: lista, origenBeneficiarios: deLinea.some(b => b.nombre) ? 'linea' : (lista.length ? 'cliente' : '') };
  }, [solicitudes, row.id, row.clienteId, clientes]);
  /** MD SubLíneas 09/10 — SubLínea abierta en el modal operativo. */
  const [operando, setOperando] = useState<{ id: string; noSol: string; productoId: string } | null>(null);

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

  /** MD NAFIN 09 — Línea Global operativa (sólo líneas NAFIN liberadas). */
  const lineaGlobal = row.banca2oPiso?.lineaGlobal;
  /** MD SubLíneas 08 — Historial: % Cobertura y Monto Garantizado si el layout lo permite. */
  const sublineaDe = (d: any) => d?._data?.solicitud?.sublinea_carta || null;
  const conSublineas = !!lineaGlobal || disposiciones.some(d => sublineaDe(d));
  /**
   * MD SubLíneas 09 §Vencimiento sin Reclamo — ACTIVA → LIBERADA al vencer.
   * Sin un proceso programado en el servidor, se ejecuta al consultar las
   * disposiciones de la línea: toda carta ACTIVA ya vencida y sin reclamación
   * en curso se libera y su saldo garantizado regresa al Disponible. Cada una
   * se intenta una sola vez por montaje (el servicio relee y es idempotente).
   */
  const intentadas = useRef(new Set<string>());
  useEffect(() => {
    if (loading || cargandoProductos) return;
    const hoy = new Date().toISOString().slice(0, 10);
    const vencidas = disposiciones.filter((d: any) => {
      const c = sublineaDe(d);
      if (!c || c.estatus !== ESTADO_ACTIVA || !c.fechaVencimiento || c.fechaVencimiento >= hoy) return false;
      const id = String(d._dbId || d.id);
      if (intentadas.current.has(id)) return false;
      const enCurso = operacionDe(normalizarSublinea(c)).reclamaciones.some(r => r.estatus !== 'RECHAZADA');
      return !enCurso;
    });
    if (vencidas.length === 0) return;
    (async () => {
      let liberadas = 0;
      for (const d of vencidas) {
        const id = String(d._dbId || d.id);
        intentadas.current.add(id);
        const dd = d as any;
        const prod = productoPorId(productos, dd._productoId || dd.productoId || dd._data?.solicitud?.header?.producto_id);
        const r = await liberarSublinea(id, prod);
        if (r.ok) liberadas++;
      }
      if (liberadas > 0) {
        toast.info(`${liberadas} SubLínea(s) vencida(s) sin reclamo liberada(s)`, {
          description: 'Su saldo garantizado regresó al Disponible de la Línea Global.',
          duration: 9000,
        });
        await refetch();
        onCambio?.();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disposiciones, loading, cargandoProductos]);

  const saldo = row.saldoGarantia;
  const tieneSaldo = typeof saldo === 'number';

  // ── SubLíneas de Carta de Crédito NAFIN (MD 04) ────────────────────────────
  // El renglón del catálogo (`ProductoDisposicion`) sólo trae id y nombre: la
  // configuración vive en el producto completo, así que se resuelve por id.
  const productoElegido = useMemo(
    () => productos.find(p => String(p.id) === String(productoId) || String(p.dbUuid) === String(productoId)),
    [productos, productoId],
  );
  const esSubLinea = esSubLineaCartaCredito(productoElegido);
  const matriz: FilaMatriz[] = useMemo(
    () => (Array.isArray((productoElegido as any)?.matrizTasaFija) ? (productoElegido as any).matrizTasaFija : []),
    [productoElegido],
  );

  /** Aplica una fila de la Matriz — mismo mapeo que la Solicitud (Originación). */
  const aplicarFilaMatriz = (f: FilaMatriz, avisar = true) => {
    const tasaAnual = num(f.tasaMinima ?? f.tasaAplicable);
    const tasaDefault = num(f.tasaDefault) || tasaAnual;
    setPlazo(String(f.plazoDefault || f.plazoMaximo || f.plazoMinimo || ''));
    setTasa(tasaDefault.toFixed(4));
    if (f.periodo) setFrecuencia(String(f.periodo));
    setFilaMatriz(f);
    const montoAct = parseMon(montoSolicitado);
    const fuera = montoAct > 0 && ((num(f.montoMinimo) > 0 && montoAct < num(f.montoMinimo)) || (num(f.montoMaximo) > 0 && montoAct > num(f.montoMaximo)));
    if ((!(montoAct > 0) || fuera) && num(f.montoDefault) > 0) setMontoSolicitado(String(num(f.montoDefault)));
    setShowMatriz(false);
    if (avisar) {
      toast.success('Plazo, tasa y frecuencia aplicados', {
        description: `Plazo ${f.plazoMinimo}–${f.plazoMaximo} · Tasa ${tasaDefault.toFixed(2)}% anual${f.periodo ? ` · ${f.periodo}` : ''}`,
      });
    }
  };

  // Al cambiar de producto se descarta la fila elegida; si su Matriz tiene
  // una sola fila, no hay nada que decidir y se aplica sola.
  useEffect(() => {
    setFilaMatriz(null);
    setTasa('');
    if (showModal && matriz.length === 1) aplicarFilaMatriz(matriz[0], false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productoId, matriz.length, showModal]);

  /** Monto y Plazo dentro del rango de la fila elegida (igual que la Solicitud). */
  const errorMatriz = (() => {
    if (!filaMatriz) return matriz.length > 0 ? 'Seleccione el plazo en la Matriz de Tasa Fija.' : '';
    const m = parseMon(montoSolicitado);
    const mn = num(filaMatriz.montoMinimo), mx = num(filaMatriz.montoMaximo);
    if (m > 0 && ((mn > 0 && m < mn) || (mx > 0 && m > mx))) {
      return `El Monto debe estar entre ${fmtMoneyExacto(mn)} y ${fmtMoneyExacto(mx)} para el plazo elegido.`;
    }
    const pz = parseInt(plazo, 10) || 0;
    if (pz > 0 && (pz < num(filaMatriz.plazoMinimo) || (num(filaMatriz.plazoMaximo) > 0 && pz > num(filaMatriz.plazoMaximo)))) {
      return `El Plazo debe estar entre ${filaMatriz.plazoMinimo} y ${filaMatriz.plazoMaximo}.`;
    }
    return '';
  })();
  const paramsSubLinea = useMemo(
    () => (esSubLinea ? parametrosSubLinea(productoElegido) : null),
    [esSubLinea, productoElegido],
  );

  /**
   * MD 04 §Reglas — la Línea Global debe estar ACTIVA para poder disponer.
   * Sólo aplica cuando el producto lo exige (`requiereLineaGlobalActiva`), que
   * es el default de las SubLíneas; los productos existentes no lo declaran y
   * por tanto conservan su comportamiento (MD 12 §9).
   */
  // El estatus de la Línea Global es el de su nodo operativo (MD NAFIN 09). El
  // de la fila es el de la Solicitud ('En Administración'…), que nunca vale
  // ACTIVA, así que con él toda SubLínea quedaba bloqueada.
  const estatusLineaGlobal = String(row.banca2oPiso?.lineaGlobal?.estatus || row.estatus || '').trim();
  const lineaNoActiva = Boolean(
    paramsSubLinea?.requiereLineaGlobalActiva &&
    estatusLineaGlobal.toUpperCase() !== ESTADO_ACTIVA,
  );

  const abrirModal = () => {
    // CA-10 — no se deja crear con un producto arbitrario: el catálogo del
    // producto es justamente el control de qué se puede disponer (RN-04).
    if (impedimento) {
      toast.error(impedimento.titulo, { description: impedimento.detalle, duration: 9000 });
      return;
    }
    const unico = catalogo.length === 1 ? catalogo[0].id : '';
    setProductoId(unico);
    // CA-11 — el monto se precarga con el saldo de la línea padre.
    //
    // MD 04 §Monto Solicitado — salvo para una Carta de Crédito: ahí el Monto
    // Solicitado es el monto TOTAL DE LA CARTA, que no tiene por qué parecerse
    // al saldo de la línea (la línea se consume sólo por el Monto Garantizado).
    // Precargarlo con el saldo invitaría a capturar la cifra equivocada.
    const unicoEsSubLinea = unico
      ? esSubLineaCartaCredito(productos.find(p => String(p.id) === String(unico) || String(p.dbUuid) === String(unico)))
      : false;
    setMontoSolicitado(tieneSaldo && !unicoEsSubLinea ? String(saldo) : '');
    setDescripcion('');
    setPlazo('');
    setFrecuencia('Mensual');
    setTasa('');
    setFilaMatriz(null);
    setPeriodicidadComision('');
    setFechaInicio(hoyDisplay());
    setTipoCarta('');
    setNoCarta('');
    // Si sólo hay una parte tipo Beneficiario, se propone; el usuario la cambia.
    const soloBenef = beneficiarios.filter(b => b.tipo.toLowerCase().includes('beneficiario'));
    setBeneficiarioIdx(soloBenef.length === 1 ? String(beneficiarios.indexOf(soloBenef[0])) : '');
    const soloOrd = beneficiarios.filter(b => b.tipo.toLowerCase().includes('ordenante'));
    setOrdenanteIdx(soloOrd.length === 1 ? String(beneficiarios.indexOf(soloOrd[0])) : '');
    setShowModal(true);
  };

  const handleGuardar = async () => {
    const prod = catalogo.find(p => p.id === productoId);
    if (!prod) { toast.error('Seleccione el producto de la disposición'); return; }

    const monto = parseMon(montoSolicitado);
    if (!(monto > 0)) { toast.error('El Monto Solicitado debe ser mayor a 0'); return; }

    // ── MD 04 §Reglas — validaciones de SubLínea de Carta de Crédito ──────────
    // Bloquean de verdad, a diferencia del aviso de saldo de abajo: una Línea
    // Global inactiva o un monto fuera del rango configurado son incumplimientos
    // de política, no advertencias. Sólo corren cuando el producto es SubLínea,
    // así que los productos existentes no cambian (MD 12 §9).
    const beneficiario = beneficiarioIdx !== '' ? beneficiarios[Number(beneficiarioIdx)] : undefined;
    const ordenante = ordenanteIdx !== '' ? beneficiarios[Number(ordenanteIdx)] : undefined;
    if (paramsSubLinea && !ordenante) {
      toast.error('Seleccione el Ordenante / Acreditado Final', {
        description: 'Es obligatorio para una SubLínea de Carta de Crédito (MD 05) — sin él no puede activarse.',
        duration: 10000,
      });
      return;
    }
    if (paramsSubLinea && !beneficiario) {
      // MD SubLíneas 05 — la Carta no se activa sin Beneficiario Carta.
      toast.error('Seleccione el Beneficiario de la Carta', {
        description: beneficiarios.length === 0
          ? 'La Línea Global no tiene Partes Relacionadas: captúrelas en la Solicitud de la línea o en Personas → Personas Relacionadas del cliente.'
          : 'Es obligatorio para una SubLínea de Carta de Crédito.',
        duration: 10000,
      });
      return;
    }

    // ── Plazo y vigencia ──
    if (errorMatriz) { toast.error('Matriz de Tasa Fija', { description: errorMatriz, duration: 9000 }); return; }
    if (!(plazoNum > 0)) { toast.error('Capture el Plazo'); return; }
    if (!dmyADate(fechaInicio)) { toast.error('Capture la Fecha de Inicio (dd/mm/aaaa)'); return; }
    if (paramsSubLinea) {
      if (!tipoCarta) { toast.error('Seleccione el Tipo de Carta'); return; }
      // Sin ella la Cotización de la SubLínea no puede armar el calendario.
      if (!periodicidadComision) { toast.error('Seleccione la Periodicidad Cobro Comisión'); return; }
      const { plazoMinimo, plazoMaximo } = paramsSubLinea;
      if ((plazoMinimo > 0 && plazoDias < plazoMinimo) || (plazoMaximo > 0 && plazoDias > plazoMaximo)) {
        toast.error('Plazo fuera del rango del producto', {
          description: `${plazoDias} días; el producto permite ${plazoMinimo || 0} – ${plazoMaximo || '∞'} días.`,
          duration: 10000,
        });
        return;
      }
      // MD SubLíneas 05 — la Carta no puede vencer después que la Línea Global.
      const vencLG = dmyADate(String(lineaGlobal?.fechaVencimiento || ''));
      const finD = dmyADate(fechaFin);
      if (vencLG && finD && finD.getTime() > vencLG.getTime()) {
        toast.error('La Fecha Fin excede la vigencia de la Línea Global', {
          description: `Fin ${fechaFin}; la Línea Global vence el ${lineaGlobal?.fechaVencimiento}.`,
          duration: 10000,
        });
        return;
      }
    }

    if (paramsSubLinea) {
      if (lineaNoActiva) {
        toast.error('No se puede crear la disposición', {
          description: `La Línea Global está en estatus "${estatusLineaGlobal || '—'}" y el producto exige que esté ACTIVA.`,
          duration: 10000,
        });
        return;
      }
      const { montoMinimo, montoMaximo } = paramsSubLinea;
      if (montoMinimo > 0 && monto < montoMinimo) {
        toast.error('Monto fuera del rango del producto', {
          description: `El Monto de la Carta (${fmtMoneyExacto(monto)}) es menor al mínimo configurado (${fmtMoneyExacto(montoMinimo)}).`,
          duration: 10000,
        });
        return;
      }
      if (montoMaximo > 0 && monto > montoMaximo) {
        toast.error('Monto fuera del rango del producto', {
          description: `El Monto de la Carta (${fmtMoneyExacto(monto)}) excede el máximo configurado (${fmtMoneyExacto(montoMaximo)}).`,
          duration: 10000,
        });
        return;
      }
    }
    // §Decisión 4 — se advierte, no se bloquea: mientras el saldo no se descuente
    // al disponer (§Decisión 3), bloquear aquí produciría rechazos falsos.
    //
    // No aplica a una Carta de Crédito: ahí el monto capturado es el de la carta
    // y la línea se consume sólo por el Monto Garantizado (MD 00), que es una
    // fracción. Comparar la carta contra el saldo dispararía la advertencia en
    // operaciones perfectamente válidas.
    if (!paramsSubLinea && tieneSaldo && monto > (saldo as number)) {
      toast.warning('El monto excede el saldo de la garantía', {
        description: `Saldo disponible: ${fmtMoneyExacto(saldo as number)}.`,
        duration: 7000,
      });
    }

    setGuardando(true);
    const primeraFase: any = Array.isArray(productoElegido?.fases) && productoElegido!.fases!.length > 0
      ? [...(productoElegido!.fases as any[])].sort((x: any, y: any) => (parseInt(x?.seq) || 0) - (parseInt(y?.seq) || 0))[0]
      : null;

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
      plazo: String(plazoNum),
      fechaInicio,
      fechaFin,
      tipoPersona: row.tipoPersona || '',
      nombrePersona: row.cliente || '',
      descripcion,
      // §Decisión 5 — cae en Originación como cualquier otra. Una SubLínea nace
      // "En proceso": Originación oculta las "Pendiente" y el MD SubLíneas 04
      // pide poder continuarla desde ahí. La Selectiva arranca en su primera fase.
      estatusSolicitud: paramsSubLinea ? 'En proceso' : 'Pendiente',
      ...(paramsSubLinea && primeraFase ? {
        faseId: String(primeraFase.id ?? primeraFase.seq ?? '1'),
        descripcionFase: primeraFase.fase || '',
      } : {}),
      _clienteId: row.clienteId || '',
      _curp: row.curp || '',
      _rfc: row.rfc || '',
    } as SolicitudFormData & { _clienteId?: string };

    // Partes de la Carta: Beneficiario y Ordenante con el rol que exige su activación.
    const comoParte = (b: Beneficiario, rol: string, id: number) => ({
      id, tipoRelacion: rol, rolAsignado: rol, nombreCompleto: b.nombre, rfc: b.rfc, curp: b.curp,
      telefono: b.telefono, email: b.email, participacion: '', nombreEjecutivo: '',
    });
    const partesDisposicion = [
      ...(beneficiario ? [comoParte(beneficiario, paramsSubLinea ? ROL_BENEFICIARIO_CARTA : (beneficiario.tipo || 'Beneficiario'), 1)] : []),
      ...(ordenante ? [comoParte(ordenante, ROL_ORDENANTE, 2)] : []),
    ];
    // Bloque C con los defaults del producto (cobertura y comisión).
    const coberturaDefault = paramsSubLinea ? String(paramsSubLinea.coberturaDefault || '') : '';
    const comisionDefault = paramsSubLinea ? String(paramsSubLinea.comisionDefault || '') : '';

    const result = await saveSolicitud(form as SolicitudFormData, undefined, {
      terminos: {
        montoSolicitado: String(monto),
        plazo: String(plazoNum),
        frecuencia,
        ...(periodicidadComision ? { periodicidadCobroGpo: periodicidadComision } : {}),
        // Mismo mapeo que la Matriz en la Solicitud: la tasa de la fila elegida.
        ...(tasa ? { tasa, tipoTasa: 'Fija' } : {}),
        fechaInicio,
        fechaFin,
      },
      // Bloque B de la Carta (MD SubLíneas 05) ya capturado desde aquí.
      ...(paramsSubLinea ? {
        sublineaCarta: {
          tipoCarta,
          noCarta,
          moneda: 'MXN',
          fechaInicio: dateAIso(dmyADate(fechaInicio)!),
          fechaVencimiento: fechaFin ? dateAIso(dmyADate(fechaFin)!) : '',
          montoElegible: String(monto),
          porcentajeCobertura: coberturaDefault,
          porcentajeComision: comisionDefault,
          objeto: descripcion,
        },
      } : {}),
      // El beneficiario elegido entra a las Partes Relacionadas de la
      // disposición. En una SubLínea con el rol que exige su activación.
      ...(partesDisposicion.length > 0 ? { partesRelacionadas: partesDisposicion } : {}),
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
        description: `${form.noSol} · ${prod.nombre} · ${fmtMoneyExacto(monto)}${beneficiario ? ` · Beneficiario: ${beneficiario.nombre}` : ''}. Continúe el trámite en ${paramsSubLinea ? 'Originación' : 'Solicitudes'}.`,
        duration: 7000,
      });
    }

    // ── Modalidad de Resolución = Automática (Taller de Producto) ──
    // MD SubLíneas 02 / 06: sin fases. Al guardar se validan las reglas del
    // producto y, si pasa, se ACTIVA: consume de la Línea Global el Monto
    // Garantizado, genera los cargos configurados y deja la Cotización hecha.
    if (vinculo.ok && paramsSubLinea && productoElegido && modalidadDe(productoElegido) === MODALIDAD_AUTOMATICA) {
      await resolverAutomatica({
        sublineaId: result.id,
        noSol: folio,
        montoCarta: monto,
        partes: partesDisposicion,
        carta: {
          tipoCarta, noCarta, moneda: 'MXN',
          fechaInicio: dateAIso(dmyADate(fechaInicio)!),
          fechaVencimiento: fechaFin ? dateAIso(dmyADate(fechaFin)!) : '',
          montoElegible: String(monto),
          porcentajeCobertura: coberturaDefault,
          porcentajeComision: comisionDefault,
          objeto: descripcion,
          estatus: 'BORRADOR',
        },
      });
    }

    setShowModal(false);
    await refetch();
    onCambio?.();
  };

  /**
   * Resolución automática de una SubLínea Automática recién creada. Usa el
   * mismo servicio que el botón "Validar y Activar" de Términos y la Fase 5 de
   * la Selectiva (ActivarSublinea): revalida con la línea leída de la BD.
   */
  const resolverAutomatica = async (p: {
    sublineaId: string; noSol: string; montoCarta: number; partes: any[]; carta: any;
  }) => {
    const idToast = toast.loading('Validando la SubLínea Automática…');
    try {
      const r = await activarSublinea({
        sublineaId: p.sublineaId, noSol: p.noSol, productoHijo: productoElegido, productos,
        carta: p.carta, montoCarta: p.montoCarta, partes: p.partes,
      });
      toast.dismiss(idToast);

      if (r.ok && r.elegible && r.datos) {
        // Cotización automática: Monto Garantizado × % Comisión, por la Periodicidad.
        const cobrosAnio = COBROS_POR_ANIO[periodicidadComision] || 0;
        const rows = construirCalendarioComisiones({
          montoGarantizado: r.datos.montoGarantizado || 0,
          porcentajeComision: parseFloat(String(p.carta.porcentajeComision || '0')) || 0,
          cobrosPorAnio: cobrosAnio,
          totalPeriodos: cobrosEnVigencia(plazoNum, frecuencia, periodicidadComision),
          ancla: fechaInicio,
        });
        const cargosBD = (r.cargos || []).map(c => ({
          tipo_cargo: c.tipoCargo, descripcion: c.descripcion, monto: c.monto,
          fecha_cargo: c.fechaCargo, estatus: c.estatus, notas: c.notas,
        }));
        await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9/solicitudes-credito/${p.sublineaId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estatus_sol: 'Activa',
            monto_aut: p.montoCarta,
            data: { solicitud: {
              ...(rows.length > 0 ? { simulacion: simulacionParaBD(rows) } : {}),
              ...(cargosBD.length > 0 ? { cargos: cargosBD } : {}),
            } },
          }),
        });
        void registrarBitacoraFase(p.sublineaId, {
          fase: 'Resolución automática', estatusAnterior: 'BORRADOR', estatusNuevo: 'ACTIVA', resultado: 'ACTIVADA',
          producto: productoElegido?.nombre,
          validaciones: (r.validacion?.cumplidas || []).map(x => `✓ ${x.etiqueta}`),
          observaciones: `Garantizado ${fmtMoneyExacto(r.datos.montoGarantizado || 0)}; Disponible ${fmtMoneyExacto(r.disponibleNuevo || 0)}.`,
        });
        toast.success('SubLínea ACTIVA (resolución automática)', {
          description: `Garantizado ${fmtMoneyExacto(r.datos.montoGarantizado || 0)} consumido de la Línea Global · Disponible ${fmtMoneyExacto(r.disponibleNuevo || 0)}`
            + ` · ${cargosBD.length} cargo(s) · Cotización: ${rows.length} cobro(s) ${periodicidadComision}.`,
          duration: 12000,
        });
        return;
      }

      if (r.ok && !r.elegible && r.validacion) {
        // MD 06 — se rechaza con el detalle; no pasa a Selectiva (CA-08).
        const rech = await rechazarSublinea(p.sublineaId, { ...p.carta }, r.validacion);
        await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-7e2d13d9/solicitudes-credito/${p.sublineaId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ estatus_sol: 'Rechazada' }),
        });
        void registrarBitacoraFase(p.sublineaId, {
          fase: 'Resolución automática', estatusAnterior: 'BORRADOR', estatusNuevo: rech.datos.estatus, resultado: 'RECHAZADA',
          producto: productoElegido?.nombre,
          validaciones: r.validacion.incumplidas.map(x => `✗ ${x.etiqueta}${x.detalle ? ` — ${x.detalle}` : ''}`),
        });
        toast.error(`SubLínea ${rech.datos.estatus}`, {
          description: r.validacion.incumplidas.map(x => `${x.etiqueta}${x.detalle ? `: ${x.detalle}` : ''}`).join(' · '),
          duration: 15000,
        });
        return;
      }

      toast.error('No se pudo resolver la SubLínea automáticamente', {
        description: `${r.error || 'Error desconocido'}. La Solicitud quedó creada; puede reintentar con "Validar y Activar" en Términos y Condiciones.`,
        duration: 12000,
      });
    } catch (err: any) {
      toast.dismiss(idToast);
      toast.error('No se pudo resolver la SubLínea automáticamente', { description: err?.message || String(err) });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-600">
          {disposiciones.length} disposición{disposiciones.length !== 1 ? 'es' : ''}
          {lineaGlobal ? (
            // MD 04 §Saldo / Disponible — consulta del disponible de la Línea Global.
            <span className="ml-2 text-gray-500">
              · Disponible Línea Global: <strong className="text-gray-700">{fmtMoneyExacto(Number(lineaGlobal.montoDisponible) || 0)}</strong>
              {' '}· Contingente: <strong className="text-gray-700">{fmtMoneyExacto(Number(lineaGlobal.montoContingente) || 0)}</strong>
            </span>
          ) : tieneSaldo && (
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
              {conSublineas && <th className="px-2 py-2 text-right font-medium">% Cobertura</th>}
              {conSublineas && <th className="px-2 py-2 text-right font-medium">Monto Garantizado</th>}
              <th className="px-2 py-2 text-left font-medium">Descripción</th>
              <th className="px-2 py-2 text-center font-medium">Estatus</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={conSublineas ? 10 : 8} className="px-3 py-8 text-center text-gray-400">Cargando...</td></tr>
            ) : disposiciones.length === 0 ? (
              <tr>
                <td colSpan={conSublineas ? 10 : 8} className="px-3 py-10 text-center text-gray-400">
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
                {conSublineas && (
                  <td className="px-2 py-2 text-right text-gray-700">
                    {sublineaDe(d)?.porcentajeCobertura ? `${sublineaDe(d).porcentajeCobertura}%` : '—'}
                  </td>
                )}
                {conSublineas && (
                  <td className="px-2 py-2 text-right text-gray-700">
                    {Number(sublineaDe(d)?.montoGarantizado) > 0 ? fmtMoneyExacto(Number(sublineaDe(d).montoGarantizado)) : '—'}
                  </td>
                )}
                <td className="px-2 py-2 text-gray-600 max-w-[220px] truncate">
                  {d._data?.solicitud?.header?.descripcion || d._descripcion || '—'}
                </td>
                <td className="px-2 py-2 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${ESTATUS_COLOR[d.estatusSolicitud] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {d.estatusSolicitud}
                  </span>
                  {sublineaDe(d)?.estatus && (
                    <div className="mt-0.5 text-[10px] text-teal-700 font-medium">{sublineaDe(d).estatus}</div>
                  )}
                  {/* Sólo una SubLínea ya activada tiene vida operativa (MD 09/10). */}
                  {Number(sublineaDe(d)?.montoGarantizado) > 0 && (
                    <button
                      onClick={() => setOperando({
                        id: String(d._dbId || d.id),
                        noSol: d.noSol || '',
                        productoId: String(d._productoId || d.productoId || d._data?.solicitud?.header?.producto_id || ''),
                      })}
                      className="mt-1 text-[10px] text-blue-600 hover:text-blue-800 underline">
                      Operar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-gray-500 italic">
        Cada disposición es una Solicitud: continúe su trámite desde el módulo de Solicitudes.
      </p>

      {showMatriz && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => setShowMatriz(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-primary-theme text-white px-5 py-3 flex items-center justify-between shrink-0">
              <span className="text-sm font-semibold tracking-wide uppercase">Matriz de Tasa Fija — {productoElegido?.nombre || ''}</span>
              <button onClick={() => setShowMatriz(false)} className="text-white/80 hover:text-white">✕</button>
            </div>
            <div className="p-4 overflow-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-200 border-b border-gray-300 text-[10px] text-gray-700">
                    <th className="px-3 py-2 text-center font-semibold">PLAZO</th>
                    <th className="px-3 py-2 text-center font-semibold">FRECUENCIA</th>
                    <th className="px-3 py-2 text-right font-semibold">MONTO MÍNIMO</th>
                    <th className="px-3 py-2 text-right font-semibold">MONTO MÁXIMO</th>
                    <th className="px-3 py-2 text-right font-semibold">TASA ANUAL</th>
                    <th className="px-3 py-2 text-right font-semibold">TASA MENSUAL</th>
                    <th className="px-3 py-2 text-center font-semibold w-24">ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {matriz.map((f, idx) => {
                    const tasaAnual = num(f.tasaMinima ?? f.tasaAplicable);
                    const elegida = !!filaMatriz && (filaMatriz.id != null && f.id != null
                      ? String(filaMatriz.id) === String(f.id) : filaMatriz === f);
                    return (
                      <tr key={idx} className={elegida ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-1.5 text-center font-medium">{elegida ? '✓ ' : ''}{f.plazoMinimo} – {f.plazoMaximo}</td>
                        <td className="px-3 py-1.5 text-center">{f.periodo || '—'}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{fmtMoneyExacto(num(f.montoMinimo))}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{fmtMoneyExacto(num(f.montoMaximo))}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{tasaAnual.toFixed(2)}%</td>
                        <td className="px-3 py-1.5 text-right font-mono">{(tasaAnual / 12).toFixed(2)}%</td>
                        <td className="px-3 py-1.5 text-center">
                          <button type="button" onClick={() => aplicarFilaMatriz(f)}
                            className={`px-2.5 py-1 rounded text-[10px] font-medium ${elegida ? 'bg-blue-100 text-[#0066CC]' : 'bg-[#0099CC] text-white hover:bg-[#0088BB]'}`}>
                            {elegida ? 'Seleccionada' : 'Seleccionar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[10px] text-gray-500 mt-3">Seleccione el plazo correspondiente al Monto Solicitado.</p>
            </div>
          </div>
        </div>
      )}

      {operando && (
        <OperacionSublineaModal
          sublineaId={operando.id}
          noSol={operando.noSol}
          lineaId={String(row.id)}
          productoHijo={productoPorId(productos, operando.productoId)}
          onClose={() => setOperando(null)}
          onCambio={() => { refetch(); onCambio?.(); }}
        />
      )}

      {/* ── Modal Nueva Disposición (CA-07) ── */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => !guardando && setShowModal(false)}
        >
          <div className="bg-white rounded shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="bg-primary-theme px-4 py-2.5 flex items-center justify-between rounded-t shrink-0">
              <h4 className="text-sm font-bold text-white">Nueva Disposición</h4>
              <button onClick={() => !guardando && setShowModal(false)} className="text-white/70 hover:text-white">✕</button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
              <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2">
                <span className="text-xs font-medium text-gray-800">INFORMACIÓN DE LA DISPOSICIÓN</span>
              </div>

              {/* MD 04 — se avisa ANTES de capturar, no al guardar: si la Línea
                  Global no está activa no hay nada que el usuario pueda hacer
                  en este modal, y dejarlo llenar campos para rechazarlo al
                  final es tiempo perdido. */}
              {lineaNoActiva && (
                <div className="bg-red-50 border-l-4 border-red-400 px-3 py-2 text-[11px] text-red-700">
                  La Línea Global está en estatus <strong>{estatusLineaGlobal || '—'}</strong> y este
                  producto exige que esté <strong>ACTIVA</strong>. No se podrá crear la disposición.
                </div>
              )}

              {paramsSubLinea && !lineaNoActiva && (
                <div className="bg-amber-50 border-l-4 border-amber-400 px-3 py-2 text-[11px] text-amber-800">
                  {modalidadDe(productoElegido) === MODALIDAD_AUTOMATICA && (
                    <><strong>Resolución Automática:</strong> al Guardar se validan las reglas del producto y, si cumple,
                    la SubLínea se activa, consume el Monto Garantizado de la Línea Global, genera sus cargos y su cotización.<br /></>
                  )}
                  El <strong>Monto Solicitado</strong> es el monto total de la Carta de Crédito.
                  La Línea Global se consumirá sólo por el Monto Garantizado, que se calcula
                  en Términos y Condiciones.
                  {paramsSubLinea.montoMaximo > 0 && (
                    <> Rango permitido: {fmtMoneyExacto(paramsSubLinea.montoMinimo)} – {fmtMoneyExacto(paramsSubLinea.montoMaximo)}.</>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3 text-xs">
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

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-gray-600 uppercase tracking-wider">Plazo *</label>
                    {matriz.length > 0 && (
                      <button type="button" onClick={() => setShowMatriz(true)}
                        className="text-[10px] text-[#0066CC] hover:underline">
                        Ver Matriz de Tasa Fija
                      </button>
                    )}
                  </div>
                  <input type="text" inputMode="numeric" value={plazo}
                    onChange={e => setPlazo(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder={matriz.length > 0 ? 'Elija en la Matriz' : 'Ej: 3'}
                    className={`w-full px-2 py-1.5 border rounded text-right font-mono ${errorMatriz && filaMatriz ? 'border-red-400' : 'border-gray-300'}`} />
                  <span className={`text-[10px] ${errorMatriz ? 'text-red-500' : 'text-gray-500'}`}>
                    {errorMatriz
                      || (filaMatriz
                        ? `Matriz: plazo ${filaMatriz.plazoMinimo}–${filaMatriz.plazoMaximo} · tasa ${num(tasa).toFixed(2)}% · ${plazoDias} días`
                        : plazoNum > 0 ? `${plazoDias} días` : 'Plazo × días de la Frecuencia')}
                  </span>
                </div>

                <Campo label="Frecuencia">
                  {filaMatriz?.periodo ? (
                    <input type="text" value={`${frecuencia} (${diasPeriodo} días)`} disabled
                      className="w-full px-2 py-1.5 border border-gray-300 rounded bg-gray-100 text-gray-600" />
                  ) : (
                    <select value={frecuencia} onChange={e => setFrecuencia(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded">
                      {CAT_FRECUENCIA.map(f => (
                        <option key={f.value} value={f.value}>{f.label} ({f.dias} días)</option>
                      ))}
                    </select>
                  )}
                  <span className="text-[10px] text-gray-500">
                    {filaMatriz?.periodo ? 'De la Matriz de Tasa Fija.' : 'Periodo con el que se mide el Plazo.'}
                    {paramsSubLinea && (paramsSubLinea.plazoMinimo > 0 || paramsSubLinea.plazoMaximo > 0)
                      ? ` Producto: ${paramsSubLinea.plazoMinimo || 0} – ${paramsSubLinea.plazoMaximo || '∞'} días.` : ''}
                  </span>
                </Campo>

                <Campo label="Fecha de Inicio *">
                  <DatePicker value={fechaInicio} onChange={(v: string) => setFechaInicio(v)}
                    placeholder="dd/mm/aaaa" className="px-2 py-1.5" />
                </Campo>

                <Campo label="Fecha de Fin">
                  <input type="text" value={fechaFin || '—'} disabled
                    className="w-full px-2 py-1.5 border border-gray-300 rounded bg-gray-100 text-gray-600" />
                  <span className="text-[10px] text-gray-500">
                    Fecha de Inicio + Plazo × días de la Frecuencia
                    {lineaGlobal?.fechaVencimiento ? ` · Línea Global vence ${lineaGlobal.fechaVencimiento}` : ''}
                  </span>
                </Campo>

                <Campo label={`Periodicidad Cobro Comisión${paramsSubLinea ? ' *' : ''}`}>
                  <select value={periodicidadComision} onChange={e => setPeriodicidadComision(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded">
                    <option value="">Seleccione...</option>
                    {PERIODICIDADES_COMISION.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                  <span className="text-[10px] text-gray-500">
                    Cada cuánto se cobra la comisión; independiente del Plazo y la Frecuencia.
                  </span>
                </Campo>

                <Campo label={`Tipo de Carta${paramsSubLinea ? ' *' : ''}`}>
                  <select value={tipoCarta} onChange={e => setTipoCarta(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded">
                    <option value="">Seleccione...</option>
                    {(paramsSubLinea?.tiposCartaPermitidos?.length ? paramsSubLinea.tiposCartaPermitidos : [CARTA_COMERCIAL, CARTA_STANDBY])
                      .map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Campo>

                <Campo label="No. Carta / Referencia">
                  <input type="text" value={noCarta} onChange={e => setNoCarta(e.target.value)}
                    placeholder={paramsSubLinea && !paramsSubLinea.modalidad?.startsWith('Auto') ? 'Provisional hasta Instrumentación' : ''}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded" />
                </Campo>
              </div>

              {/* Ordenante / Acreditado Final — mismo origen que el Beneficiario */}
              {paramsSubLinea && (
                <div className="text-xs">
                  <label className="block text-[10px] text-gray-600 mb-1 uppercase tracking-wider">
                    Ordenante / Acreditado Final <span className="text-red-600">*</span>
                  </label>
                  <select value={ordenanteIdx} onChange={e => setOrdenanteIdx(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded">
                    <option value="">{beneficiarios.length ? 'Seleccione...' : 'Sin Partes Relacionadas'}</option>
                    {beneficiarios.map((b, i) => (
                      <option key={`ord-${b.nombre}-${i}`} value={String(i)}>
                        {b.nombre}{b.tipo ? ` — ${b.tipo}` : ''}{b.rfc ? ` (${b.rfc})` : ''}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-gray-500">Se registra como "{ROL_ORDENANTE}" de la disposición.</span>
                </div>
              )}

              {/* Beneficiario — de las Partes Relacionadas de la Línea Global padre */}
              <div className="text-xs">
                <label className="block text-[10px] text-gray-600 mb-1 uppercase tracking-wider">
                  Beneficiario {paramsSubLinea && <span className="text-red-600">*</span>}
                </label>
                <select value={beneficiarioIdx} onChange={e => setBeneficiarioIdx(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded">
                  <option value="">{beneficiarios.length ? 'Seleccione...' : 'Sin Partes Relacionadas'}</option>
                  {beneficiarios.map((b, i) => (
                    <option key={`${b.nombre}-${i}`} value={String(i)}>
                      {b.nombre}{b.tipo ? ` — ${b.tipo}` : ''}{b.rfc ? ` (${b.rfc})` : ''}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-gray-500">
                  {origenBeneficiarios === 'linea'
                    ? 'Partes Relacionadas de la Línea Global.'
                    : origenBeneficiarios === 'cliente'
                      ? 'La Línea Global no tiene Partes Relacionadas: se muestran las Personas Relacionadas del cliente.'
                      : 'Capture Partes Relacionadas en la Solicitud de la línea o en Personas → Personas Relacionadas.'}
                  {paramsSubLinea ? ' Se registra como "Beneficiario Carta" de la disposición.' : ''}
                </span>
              </div>

              {/* CA-14 */}
              <div className="text-xs">
                <label className="block text-[10px] text-gray-600 mb-1 uppercase tracking-wider">Descripción</label>
                <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3}
                  placeholder="Describa el destino o la justificación de la disposición"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded" />
              </div>
            </div>

            <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2 shrink-0 bg-white rounded-b">
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

/** Mismas periodicidades que el campo de Términos y Condiciones y la Cotización. */
const PERIODICIDADES_COMISION = ['Semanal', 'Catorcenal', 'Quincenal', 'Mensual', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'];

/** Renglón de la Matriz de Tasa Fija del producto (mismos campos que la Solicitud). */
interface FilaMatriz {
  id?: number | string;
  plazoMinimo?: number; plazoMaximo?: number; plazoDefault?: number;
  montoMinimo?: number; montoMaximo?: number; montoDefault?: number;
  tasaMinima?: string; tasaMaxima?: string; tasaDefault?: string; tasaAplicable?: string;
  periodo?: string;
}

const num = (v: unknown) => parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')) || 0;

/** Parte Relacionada ofrecida como Beneficiario de la disposición. */
interface Beneficiario { nombre: string; rfc: string; curp: string; telefono: string; email: string; tipo: string }

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-gray-600 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}
