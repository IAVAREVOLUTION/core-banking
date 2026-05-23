/**
 * DefaultTab.tsx — Términos y Condiciones del crédito
 * Diseño institucional idéntico al módulo Solicitudes
 */
import type { CarteraCredito } from './CarteraForm';

const fmtMoney = (n: number) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2 });

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="bg-primary-tint-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
      {title}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | number; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 w-44 flex-shrink-0">{label}</span>
      <span className={`text-xs text-gray-800 font-medium flex-1 ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

interface Props {
  credito: CarteraCredito;
}

export function DefaultTab({ credito }: Props) {
  const isCredito = (credito.lineaProducto || '').toLowerCase().includes('créd') ||
                    (credito.lineaProducto || '').toLowerCase().includes('cred');

  return (
    <div className="bg-white border border-gray-300 p-4 space-y-6">

      {/* ── Identificación ── */}
      <div>
        <SectionHeader title="Identificación del Crédito" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <Field label="No. Solicitud"         value={credito.noSol}           mono />
            <Field label="No. Cuenta"            value={credito.noCuenta}        mono />
            <Field label="Línea de Producto"     value={credito.lineaProducto} />
            <Field label="Tipo de Producto"      value={credito.tipoProducto} />
            <Field label="Estatus"               value={credito.estatus} />
          </div>
          <div>
            <Field label="Producto"              value={credito.productoNombre} />
            <Field label="Cliente"               value={credito.cliente} />
            <Field label="Institución Gobierno"  value={credito.gobierno} />
            <Field label="Moneda"                value={credito.moneda || 'MXN'} />
            <Field label="Responsable"           value={credito.usuario} />
          </div>
        </div>
      </div>

      {/* ── Términos y Condiciones ── */}
      <div>
        <SectionHeader title="Términos y Condiciones" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <Field label="Monto Autorizado"   value={fmtMoney(credito.montoAut)} />
            <Field label="Monto Solicitado"   value={fmtMoney(credito.montoSol)} />
            <Field label="Tasa de Interés"    value={credito.tasa ? `${credito.tasa}%` : undefined} />
          </div>
          <div>
            <Field label="Plazo"              value={credito.plazo ? `${credito.plazo} meses` : undefined} />
            <Field label="Frecuencia de Pago" value={credito.frecuencia} />
            <Field label="Moneda"             value={credito.moneda || 'MXN'} />
          </div>
        </div>
      </div>

      {/* ── Resumen financiero ── */}
      <div>
        <SectionHeader title={isCredito ? 'Resumen del Crédito' : 'Resumen de la Captación'} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Monto Autorizado', value: fmtMoney(credito.montoAut), color: 'text-blue-700' },
            { label: 'Tasa Anual',       value: credito.tasa ? `${credito.tasa}%` : '—', color: 'text-purple-700' },
            { label: 'Plazo',            value: credito.plazo ? `${credito.plazo} meses` : '—', color: 'text-amber-700' },
            { label: 'Frecuencia',       value: credito.frecuencia || '—', color: 'text-green-700' },
          ].map(kpi => (
            <div key={kpi.label} className="bg-gray-50 border border-gray-200 rounded p-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{kpi.label}</p>
              <p className={`text-base font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
