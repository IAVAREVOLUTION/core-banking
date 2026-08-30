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
import { DefaultTab } from '../cartera/DefaultTab';
import { SolicitudesExtTab } from '../cartera/SolicitudesExtTab';
import { ExpedienteElectronicoTab } from '../solicitudes/ExpedienteElectronicoTab';
import { fmtMoneyExacto, parseMon, type LineaCreditoRow } from './banca2oPisoStore';

const TABS = [
  { id: 'default', label: 'Default' },
  { id: 'terminos', label: 'Términos y Condiciones' },
  { id: 'expediente', label: 'Expediente Electrónico' },
  { id: 'solicitudes-ext', label: 'Solicitudes Extraordinarias' },
  { id: 'disposiciones', label: 'Disposiciones' },
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

export function Banca2oPisoDetalle({ row, onBack }: { row: LineaCreditoRow; onBack: () => void }) {
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
        {activeTab === 'default' && <DefaultTab credito={row} />}

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
            />
          </div>
        )}

        {activeTab === 'solicitudes-ext' && (
          <div className="bg-white border border-gray-300 p-4">
            <SolicitudesExtTab solicitudId={row.id} usuario={row.usuario} />
          </div>
        )}

        {activeTab === 'disposiciones' && (
          <div className="bg-white border border-gray-300 p-4">
            <DisposicionesPendiente />
          </div>
        )}
      </div>
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

  const generales: Array<[string, string]> = [
    ['Monto solicitado', money(t.montoSolicitado || row.montoSol)],
    ['Monto autorizado', money(t.montoAutorizado || row.montoAut)],
    ['Moneda', val(t.moneda || row.moneda)],
    ['Plazo', val(t.plazo || row.plazo)],
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

// ═══════════════════════════════════════════════════════════════════
// DISPOSICIONES — pendiente de definición (§Decisión #1)
// ═══════════════════════════════════════════════════════════════════
function DisposicionesPendiente() {
  return (
    <div className="border border-amber-300 bg-amber-50 rounded p-6">
      <div className="flex items-start gap-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" className="mt-0.5 shrink-0">
          <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" strokeLinecap="round" />
        </svg>
        <div className="text-xs text-amber-900 leading-relaxed">
          <p className="font-semibold mb-1">Disposiciones — pendiente de definición funcional</p>
          <p>
            El sistema no tiene todavía un modelo de datos para las disposiciones ejercidas sobre una
            línea: lo único que existe hoy es la configuración a nivel producto
            (<em>Condiciones de Disposición</em> y <em>Productos Disposición</em>).
          </p>
          <p className="mt-2">
            Para habilitar esta pestaña hace falta definir qué campos tiene una disposición
            (fecha, monto, plazo, tasa, destino, estatus), si consume el saldo disponible de la línea,
            si genera su propia tabla de amortización y si detona póliza contable.
            Ver <strong>REQ-17 §Decisiones #1</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
