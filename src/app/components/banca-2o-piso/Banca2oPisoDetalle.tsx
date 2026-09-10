/**
 * Banca2oPisoDetalle.tsx — REQ-17, detalle de una Línea de Crédito activa.
 *
 * Mismo formato institucional que `CarteraForm`: cabecera con flecha de regreso,
 * estatus y marca de sólo lectura; barra de chips con los datos clave de la cuenta;
 * sub-tabs sobre `bg-primary-theme` con el activo en `bg-secondary-theme`; y contenido
 * sobre lienzo gris, cada pestaña dentro de su caja blanca.
 *
 * Las cinco subpestañas del requerimiento. Cuatro se ensamblan con componentes que ya
 * existen (no se duplican); Disposiciones queda declarada como pendiente porque el
 * sistema todavía no tiene modelo de datos para ella (§Decisión #1 de la HU).
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { DefaultTab } from '../cartera/DefaultTab';
import { SolicitudesExtTab } from '../cartera/SolicitudesExtTab';
import { ExpedienteElectronicoTab } from '../solicitudes/ExpedienteElectronicoTab';
import { AvisosVencimientoTab } from '../cartera/AvisosVencimientoTab';
import { CalendarioComisionesTab } from './CalendarioComisionesTab';
import { EnvioPrelacionTab } from './EnvioPrelacionTab';
import { DisposicionesTab } from './DisposicionesTab';
import {
  fmtMoneyExacto, parseMon, guardarBanca2oPiso,
  SUB_ESTATUS_2O_PISO, type SubEstatus2oPiso, type LineaCreditoRow,
} from './banca2oPisoStore';
import { loadFromSession, loadFromSavedStore } from '../solicitudes/solicitudCreditoStore';

const TABS = [
  { id: 'default', label: 'Default' },
  { id: 'terminos', label: 'Términos y Condiciones' },
  { id: 'expediente', label: 'Expediente Electrónico' },
  { id: 'cargos', label: 'Cargos' },
  { id: 'solicitudes-ext', label: 'Solicitudes Extraordinarias' },
  { id: 'disposiciones', label: 'Disposiciones' },
  // ── REQ-18 ──
  { id: 'calendario-comisiones', label: 'Calendario de Comisiones' },
  { id: 'avisos-vencimiento', label: 'Avisos de Vencimiento' },
  { id: 'envio-prelacion', label: 'Envío Prelación' },
];

const ESTATUS_COLOR: Record<string, string> = {
  Pendiente: 'bg-amber-100 text-amber-800',
  Autorizada: 'bg-green-100 text-green-800',
  Activa: 'bg-green-100 text-green-800',
  'En Administración': 'bg-purple-100 text-purple-800',
  Rechazada: 'bg-red-100 text-red-800',
  Cancelada: 'bg-gray-100 text-gray-600',
  Finiquitado: 'bg-blue-100 text-blue-800',
};

export function Banca2oPisoDetalle({
  row,
  onBack,
  onCambio,
}: {
  row: LineaCreditoRow;
  onBack: () => void;
  /** Refresca la lista tras persistir cambios de REQ-18. */
  onCambio?: () => void;
}) {
  const [activeTab, setActiveTab] = useState('default');

  const chips = [
    { label: 'Cliente', value: row.cliente },
    { label: 'Inst. Gobierno', value: row.gobierno || '—' },
    { label: 'Producto', value: row.productoNombre },
    { label: 'Línea', value: row.lineaProducto },
    { label: 'Monto Aut.', value: fmtMoneyExacto(row.montoAut) },
    { label: 'Tasa', value: row.tasa ? `${row.tasa}%` : '—' },
    { label: 'Plazo', value: row.plazo || '—' },
    { label: 'No. Cuenta', value: row.noCuenta || '—' },
    { label: 'Moneda', value: row.moneda || 'MXN' },
    { label: 'Garantía', value: row.idGarantiaCartera || '—' },
  ];

  return (
    <div className="bg-white min-h-screen">

      {/* ── Header institucional ── */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-gray-400 hover:text-gray-700 p-1" title="Volver al listado">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M11 4L6 9l5 5" />
              </svg>
            </button>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#666" strokeWidth="1.5">
              <rect x="3" y="4" width="16" height="14" rx="2" /><path d="M3 8h16M7 13h8" />
            </svg>
            <h2 className="text-lg font-normal text-gray-800">
              Ver Línea de Crédito — {row.noCuenta || row.noSol}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${ESTATUS_COLOR[row.estatus] || 'bg-gray-100 text-gray-600'}`}>
              {row.estatus || '—'}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-500 border border-gray-200">
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="4.5" cy="3" r="2" /><path d="M1 8c0-1.9 1.6-3.5 3.5-3.5S8 6.1 8 8" />
              </svg>
              Solo lectura
            </span>
          </div>
        </div>
      </div>

      {/* ── Datos clave de la cuenta ── */}
      <div className="px-4 py-2.5 bg-[#F0F2F5] border-b border-gray-300">
        <div className="flex flex-wrap gap-x-8 gap-y-1.5">
          {chips.map(chip => (
            <div key={chip.label} className="flex flex-col">
              <span className="text-[9px] text-gray-400 uppercase tracking-wide">{chip.label}</span>
              <span className="text-xs text-gray-800 font-medium">{chip.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sub-tabs estilo institucional ── */}
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
          <>
            <DefaultTab credito={row} />
            {/* REQ-18 CA-14/CA-15/CA-16 — §Decisión 2: el Sub-Status se renderiza
                AQUÍ y no dentro de DefaultTab, que está compartido con Cartera
                Crédito y Arrendamiento; meterlo allá lo filtraría a carteras
                donde no aplica. */}
            <SubEstatusLinea row={row} onCambio={onCambio} />
          </>
        )}

        {activeTab === 'terminos' && (
          <div className="bg-white border border-gray-300 p-4">
            <TerminosLineaCreditoTab row={row} />
          </div>
        )}

        {activeTab === 'expediente' && (
          <div className="bg-white border border-gray-300 p-4">
            <ExpedienteElectronicoTab
              mode="ver"
              solicitudId={row.id}
              faseIdActual={row.faseId ?? 0}
              productoId={row.productoId}
              nombreSolicitante={row.cliente}
              curpCliente={row.curp}
              rfcCliente={row.rfc}
              tipoPersona={row.tipoPersona}
              lineaProducto={row.lineaProducto}
              descripcionFase={row.descripcionFase}
              soloArchivos
            />
          </div>
        )}

        {activeTab === 'cargos' && (
          <div className="bg-white border border-gray-300 p-4">
            <CargosLineaTab row={row} />
          </div>
        )}

        {activeTab === 'solicitudes-ext' && (
          <div className="bg-white border border-gray-300 p-4">
            <SolicitudesExtTab solicitudId={row.id} usuario={row.usuario} />
          </div>
        )}

        {/* REQ-20 — sustituye el placeholder de REQ-17: la disposición ya tiene
            modelo de datos, y es el de una Solicitud (RN-02). */}
        {activeTab === 'disposiciones' && (
          <div className="bg-white border border-gray-300 p-4">
            <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3">
              <span className="text-sm font-medium text-gray-800">DISPOSICIONES DE LA LÍNEA</span>
            </div>
            <DisposicionesTab row={row} onCambio={onCambio} />
          </div>
        )}

        {/* ═══ REQ-18 ═══ */}
        {activeTab === 'calendario-comisiones' && (
          <div className="bg-white border border-gray-300 p-4">
            <CalendarioComisionesTab row={row} onCambio={onCambio} />
          </div>
        )}

        {/* Mismo componente compartido que usan Cartera de Crédito, Arrendamiento
            y Cuentas de Ahorro. `useAvisos` consulta /cartera/avisos/:solicitudId,
            que filtra por solicitud y NO por sub_tipo, así que devuelve los avisos
            de comisión GPO sin necesidad de un endpoint aparte. */}
        {activeTab === 'avisos-vencimiento' && (
          <div className="bg-white border border-gray-300 p-4">
            <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-2">
              <span className="text-sm font-medium text-gray-800">AVISOS DE VENCIMIENTO DE LA LÍNEA</span>
            </div>
            <AvisosVencimientoTab solicitudId={row.id} />
          </div>
        )}

        {activeTab === 'envio-prelacion' && (
          <div className="bg-white border border-gray-300 p-4">
            <EnvioPrelacionTab row={row} onCambio={onCambio} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// REQ-18 CA-14…CA-16 — Sub-Status de operación de la línea
// ═══════════════════════════════════════════════════════════════════

function SubEstatusLinea({ row, onCambio }: { row: LineaCreditoRow; onCambio?: () => void }) {
  const [valor, setValor] = useState<SubEstatus2oPiso>(row.banca2oPiso.subEstatus || 'Operación Normal');
  const [guardando, setGuardando] = useState(false);

  const handleChange = async (nuevo: SubEstatus2oPiso) => {
    if (nuevo === valor) return;
    const anterior = valor;
    setValor(nuevo);          // optimista: la UI responde de inmediato
    setGuardando(true);
    const r = await guardarBanca2oPiso(row.id, { subEstatus: nuevo });
    setGuardando(false);

    if (!r.ok) {
      setValor(anterior);     // si no se guardó, no se finge que sí (CA-16)
      toast.error('No se pudo cambiar el Sub-Status', { description: r.error, duration: 8000 });
      return;
    }
    row.banca2oPiso.subEstatus = nuevo; // que Envío Prelación lo vea sin recargar
    onCambio?.();
    toast.success(`Sub-Status: ${nuevo}`, {
      description: nuevo === 'Botón de Pánico'
        ? 'La próxima Prelación usará el escenario de pánico (pendiente de Disposiciones).'
        : 'La próxima Prelación usará la cascada de Operación Normal.',
      duration: 5000,
    });
  };

  const esPanico = valor === 'Botón de Pánico';

  return (
    <div className="bg-white border border-gray-300 mt-4">
      <div className="border-l-4 border-primary-theme px-3 py-1.5 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-800 uppercase">Operación de la Línea</span>
      </div>
      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col">
          <label className="text-[10px] text-gray-600 mb-0.5 uppercase">Sub-Status</label>
          <select
            value={valor}
            disabled={guardando}
            onChange={e => handleChange(e.target.value as SubEstatus2oPiso)}
            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-[#4A6FA5] disabled:bg-gray-100"
          >
            {SUB_ESTATUS_2O_PISO.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span className="text-[9px] text-gray-400 mt-0.5">
            {guardando ? 'Guardando…' : 'Determina qué cascada usa Envío Prelación (RN-06/RN-07).'}
          </span>
        </div>
        <div className="md:col-span-2 flex items-start">
          <div className={`w-full px-3 py-2 rounded border text-[11px] ${
            esPanico ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
          }`}>
            {esPanico
              ? <><strong>Botón de Pánico.</strong> La prelación se instruye con la cascada de recuperación. Pendiente: requiere el Saldo de los Créditos Simples de Disposiciones.</>
              : <><strong>Operación Normal.</strong> La prelación paga la comisión por garantía con la suma de los Avisos de Vencimiento pendientes.</>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CARGOS — sólo lectura, leídos de la BD
// ═══════════════════════════════════════════════════════════════════
/**
 * Muestra `data.solicitud.cargos` de la línea. NO se reusa `SolicitudCargosTab`
 * porque aquél lee de sessionStorage —que sólo se llena al abrir la Solicitud en el
 * formulario de originación— y este módulo puede abrirse sin haber pasado por ahí.
 */
function CargosLineaTab({ row }: { row: LineaCreditoRow }) {
  // Fallback a sesión activa por ID o No. de Solicitud si row.cargos está vacío
  const sessionCargos = (typeof window !== 'undefined' && (!row.cargos || row.cargos.length === 0))
    ? (loadFromSession<any[]>(row.id, 'cargos') ||
       loadFromSavedStore<any[]>(row.id, 'cargos') ||
       (row.noSol ? (loadFromSession<any[]>(row.noSol, 'cargos') || loadFromSavedStore<any[]>(row.noSol, 'cargos')) : null) ||
       (row.noCuenta ? (loadFromSession<any[]>(row.noCuenta, 'cargos') || loadFromSavedStore<any[]>(row.noCuenta, 'cargos')) : null))
    : null;

  const rawList = (row.cargos && row.cargos.length > 0)
    ? row.cargos
    : (Array.isArray(sessionCargos) ? sessionCargos : []);

  const cargos = rawList.map((c: any) => ({
    tipoCargo: String(c?.tipoCargo ?? c?.tipo_cargo ?? c?.tipoComision ?? c?.tipo_comision ?? ''),
    descripcion: String(c?.descripcion ?? c?.tipo_comision ?? c?.tipoComision ?? ''),
    monto: parseMon(c?.monto ?? c?.montoCalculado ?? 0),
    fechaCargo: String(c?.fechaCargo ?? c?.fecha_cargo ?? c?.fecha ?? ''),
    estatus: String(c?.estatus ?? 'Pendiente'),
    notas: String(c?.notas ?? ''),
  }));
  const total = cargos.reduce((s, c) => s + (c.monto || 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-sm font-medium text-gray-800">Cargos de la Línea</h4>
          <p className="text-[11px] text-gray-500">
            {row.noCuenta || row.noSol} · {cargos.length} cargo{cargos.length !== 1 ? 's' : ''} registrado{cargos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <span className="text-xs text-gray-700 font-medium">Total: {fmtMoneyExacto(total)}</span>
      </div>

      {cargos.length === 0 ? (
        <div className="border border-dashed border-gray-300 rounded p-8 text-center">
          <p className="text-sm text-gray-700 font-medium">Sin cargos</p>
          <p className="text-xs text-gray-500 mt-1 max-w-xl mx-auto">
            Esta línea no tiene cargos guardados en base de datos. Los cargos se generan al
            ejecutar la Formalización Legal de la Fase 4 y viajan con la Solicitud; un cargo
            capturado a mano en el formulario sólo existe en esa sesión hasta que la
            Solicitud se guarda.
          </p>
        </div>
      ) : (
        <div className="border border-gray-300 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-300">
                <th className="px-3 py-2 text-left font-medium text-gray-700">TIPO CARGO</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">DESCRIPCIÓN</th>
                <th className="px-3 py-2 text-right font-medium text-gray-700">MONTO</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">FECHA CARGO</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">ESTATUS</th>
                <th className="px-3 py-2 text-left font-medium text-gray-700">NOTAS</th>
              </tr>
            </thead>
            <tbody>
              {cargos.map((c, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 1 ? '#EEEEEE' : '#FFFFFF' }} className="border-b border-gray-200">
                  <td className="px-3 py-2 text-gray-800">{c.tipoCargo || '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{c.descripcion || '—'}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-800">{fmtMoneyExacto(c.monto)}</td>
                  <td className="px-3 py-2 text-gray-700">{c.fechaCargo || '—'}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex px-2 py-0.5 rounded text-[10px] border text-amber-700 bg-amber-50 border-amber-200">
                      {c.estatus || 'Pendiente'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 max-w-[280px] truncate" title={c.notas}>{c.notas || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-gray-500 italic mt-3">
        Vista de sólo lectura. Los cargos se capturan en la Solicitud de origen.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TÉRMINOS Y CONDICIONES — sólo lectura (§Decisión #4)
// ═══════════════════════════════════════════════════════════════════
function TerminosLineaCreditoTab({ row }: { row: LineaCreditoRow }) {
  const t = row.terminosRaw || {};
  const val = (v: unknown) => {
    const s = String(v ?? '').trim();
    return s === '' ? '—' : s;
  };
  const money = (v: unknown) => {
    const n = parseMon(v);
    return n === 0 ? '—' : fmtMoneyExacto(n);
  };

  // Las líneas de 2o Piso capturan el plazo en AÑOS, no en meses (ver DefaultTab).
  const esAnual = /anual/i.test(String(t.frecuencia || row.frecuencia || ''));
  const plazoNum = String(t.plazo || row.plazo || '').trim();
  const plazoTxt = plazoNum ? `${plazoNum} ${esAnual ? 'años' : 'meses'}` : '—';

  const generales: Array<[string, string]> = [
    ['Monto solicitado', money(t.montoSolicitado || row.montoSol)],
    ['Monto autorizado', money(t.montoAutorizado || row.montoAut)],
    ['Moneda', val(t.moneda || row.moneda)],
    ['Plazo', plazoTxt],
    ['Frecuencia', val(t.frecuencia || row.frecuencia)],
    ['Tasa', val(t.tasa || row.tasa)],
    ['Tipo de tasa', val(t.tipoTasa)],
    ['Tipo de cálculo', val(t.tipoCalculo)],
    ['Fecha de inicio', val(t.fechaInicio)],
    ['Fecha de primer pago', val(t.fechaPrimerPago)],
  ];

  // Bloque 2o Piso — sólo se pinta si la Solicitud trae esos campos (REQ-8/REQ-14).
  const gpo: Array<[string, string]> = [
    ['Sector de infraestructura', val(t.sectorInfraestructura)],
    ['Monto de emisión proyectado', money(t.montoEmisionProyectado)],
    ['Plazo de los bonos (años)', val(t.plazoBonosAnios)],
    ['% de cobertura GPO', t.porcentajeCoberturaGpo ? `${t.porcentajeCoberturaGpo}%` : '—'],
    ['Monto garantizado GPO', money(t.montoGarantizadoGpo)],
    // REQ-20 CA-01/CA-02 — saldo vigente de la garantía, columna `saldo_actual`.
    // CA-03: ausente se muestra '—', no $0.00 (cero es garantía agotada).
    // Si la cifra es el respaldo del Monto Garantizado (línea autorizada antes de
    // que existiera la siembra), se dice: no es lo mismo un saldo registrado que
    // uno deducido, y quien lo lee para cobrar necesita saber la diferencia.
    ['Saldo Monto Garantía', typeof row.saldoGarantia === 'number'
      ? `${fmtMoneyExacto(row.saldoGarantia)}${row.saldoGarantiaSembrado ? '' : ' (según Monto Garantizado — sin registrar en la línea)'}`
      : '—'],
    ['Tasa de comisión anual', t.tasaComisionAnualPactada ? `${t.tasaComisionAnualPactada}%` : '—'],
    ['Periodicidad de cobro', val(t.periodicidadCobroGpo)],
  ];
  const tieneGPO = gpo.some(([, v]) => v !== '—');

  return (
    <div className="space-y-4">
      <Bloque titulo="Condiciones de la línea" filas={generales} />
      {tieneGPO && <Bloque titulo="Garantía Financiera 2o Piso" filas={gpo} />}
      {(row.idGarantiaCartera || row.polizaContableApertura) && (
        <Bloque
          titulo="Formalización"
          filas={[
            ['Folio de garantía en cartera', val(row.idGarantiaCartera)],
            ['Póliza contable de apertura', val(row.polizaContableApertura)],
          ]}
        />
      )}
      <p className="text-[11px] text-gray-500 italic">
        Vista de sólo lectura. Los términos se capturan en la Solicitud de origen.
      </p>
    </div>
  );
}

function Bloque({ titulo, filas }: { titulo: string; filas: Array<[string, string]> }) {
  return (
    <div className="border border-gray-300">
      <div className="bg-[#4A6FA5] text-white px-3 py-1.5 text-xs font-medium">{titulo}</div>
      <table className="w-full text-xs">
        <tbody className="divide-y divide-gray-200">
          {filas.map(([label, valor]) => (
            <tr key={label}>
              <td className="px-3 py-2 bg-gray-50 text-gray-600 w-1/3 border-r border-gray-200">{label}</td>
              <td className="px-3 py-2 text-gray-800">{valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

