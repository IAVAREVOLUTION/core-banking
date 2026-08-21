/**
 * SolicitudActivacionDetailTab.tsx
 *
 * Sub-tab "Detail" — desglose de la solicitud en Capital + IVA.
 *
 * `monto` es el importe TOTAL de la operación (el monto autorizado) y
 * `pctImpuesto` la tasa de IVA. De ahí se derivan las dos líneas:
 *
 *   Capital = Monto × (1 − % IVA)
 *   IVA     = Monto × % IVA
 *   Total   = Capital + IVA = Monto
 *
 * Clave Producto  → J_CUENTAS_CORP_CLIENTES.producto_id          (read-only)
 * Cantidad        → editable (default 1)
 * Moneda          → igual a Moneda del header                     (read-only)
 * Estatus         → fijo "Pendiente"
 *
 * Storage: los campos sin columna explícita → data.detail
 */

interface SolicitudActivacionDetailTabProps {
  storageId: string | number;   // reservado — la persistencia ocurre en el padre
  isRO: boolean;
  claveProducto: string;
  /** Importe total de la operación (monto autorizado), IVA incluido. */
  monto: number;
  pctImpuesto: number;          // decimal, ej. 0.16 = 16 %
  moneda: string;
  cantidad: number;
  onCantidadChange: (n: number) => void;
}

import { IVA_FACTURA } from '../solicitudes/solicitudCreditoStore';

const fmt = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pctFmt = (n: number) => `${(n * 100).toFixed(2)} %`;

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Una línea del Detail — es también la unidad que se contabiliza. */
export interface LineaDetalleSolicitud {
  /** TIPO PRODUCTO — naturaleza de la línea. */
  tipo: 'CAPITAL' | 'IVA';
  /** CLAVE PRODUCTO — el componente que busca el Motor Contable. */
  claveProducto: string;
  cantidad: number;
  monto: number;
  /** Decimal, ej. 0.16 = 16 %. */
  pctImpuesto: number;
  subTotal: number;
}

/**
 * Desglosa la solicitud en las líneas del Detail.
 *
 * Única fuente de verdad: la tabla de este tab y los componentes que se envían
 * a Generación Contable salen de aquí, para que la póliza contabilice
 * exactamente lo que muestra el Detail (un componente por clave de producto,
 * con el sub total de su línea).
 */
export function calcularLineasDetalle({
  claveProducto,
  monto,
  pctImpuesto,
  cantidad,
}: {
  claveProducto: string;
  monto: number;
  pctImpuesto: number;
  cantidad: number;
}): LineaDetalleSolicitud[] {
  // El desglose Capital/IVA aplica a la cuenta por pagar del proveedor de
  // Arrendamiento. En crédito/captación este campo transporta la tasa de
  // interés (no IVA), así que ahí se conserva la línea única de siempre.
  const esArrendamiento = claveProducto === 'ARRENDAMIENTO_PROVEEDOR';

  if (!esArrendamiento) {
    return [{
      tipo: 'CAPITAL',
      claveProducto,
      cantidad,
      monto,
      pctImpuesto,
      subTotal: redondear(cantidad * monto * (1 + pctImpuesto)),
    }];
  }

  // Registros creados antes de guardarse la tasa quedaron en 0: sin este
  // respaldo el IVA se mostraría en $0.00.
  const tasaIva = pctImpuesto || IVA_FACTURA;

  // Capital = Monto × (1 − % IVA)   ·   IVA = Monto × % IVA
  return [
    {
      tipo: 'CAPITAL',
      claveProducto,
      cantidad,
      monto,
      pctImpuesto: 1 - tasaIva,
      subTotal: redondear(cantidad * monto * (1 - tasaIva)),
    },
    {
      tipo: 'IVA',
      claveProducto: 'IVA',
      cantidad,
      monto,
      pctImpuesto: tasaIva,
      subTotal: redondear(cantidad * monto * tasaIva),
    },
  ];
}

export function SolicitudActivacionDetailTab({
  isRO,
  claveProducto,
  monto,
  pctImpuesto,
  moneda,
  cantidad,
  onCantidadChange,
}: SolicitudActivacionDetailTabProps) {
  const lineas = calcularLineasDetalle({ claveProducto, monto, pctImpuesto, cantidad });
  const [lineaCapital, lineaIva] = lineas;
  const totalGeneral = redondear(lineas.reduce((acc, l) => acc + l.subTotal, 0));

  const handleCantidadChange = (raw: string) => {
    if (isRO) return;
    const n = parseFloat(raw);
    onCantidadChange(isNaN(n) || n < 0 ? 0 : n);
  };

  return (
    <div>
      {/* Section header */}
      <div className="bg-blue-50 border-l-4 border-primary-theme px-3 py-2 mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-800">DETALLE DE SOLICITUD</span>
        <span className="text-xs text-gray-500">{lineas.length === 1 ? '1 línea' : `${lineas.length} líneas`}</span>
      </div>

      <div className="border border-gray-300">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr
              className="border-b border-gray-400"
              style={{ backgroundColor: 'var(--theme-table-header, #F3F4F6)' }}
            >
              <th className="px-3 py-2 text-left  font-medium text-xs text-gray-800 border-r border-gray-300">TIPO PRODUCTO</th>
              <th className="px-3 py-2 text-left  font-medium text-xs text-gray-800 border-r border-gray-300">CLAVE PRODUCTO</th>
              <th className="px-3 py-2 text-right font-medium text-xs text-gray-800 border-r border-gray-300 w-28">CANTIDAD</th>
              <th className="px-3 py-2 text-right font-medium text-xs text-gray-800 border-r border-gray-300">MONTO</th>
              <th className="px-3 py-2 text-right font-medium text-xs text-gray-800 border-r border-gray-300">% IMPUESTO</th>
              <th className="px-3 py-2 text-left  font-medium text-xs text-gray-800 border-r border-gray-300 w-20">MONEDA</th>
              <th className="px-3 py-2 text-right font-medium text-xs text-gray-800 border-r border-gray-300">SUB TOTAL</th>
              <th className="px-3 py-2 text-left  font-medium text-xs text-gray-800">ESTATUS</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {/* ── Capital = Monto × (1 − % IVA) ── */}
            <tr className="border-b border-gray-200">
              <td className="px-3 py-2 border-r border-gray-200 font-medium text-gray-800">
                {lineaCapital.tipo}
              </td>

              <td className="px-3 py-2 border-r border-gray-200 font-medium text-gray-800">
                {lineaCapital.claveProducto || <span className="text-gray-400 italic">Sin clave</span>}
              </td>

              {/* Cantidad — editable (aplica a ambas líneas) */}
              <td className="px-3 py-2 border-r border-gray-200 text-right">
                {isRO ? (
                  <span className="text-gray-700">{cantidad.toLocaleString('es-MX')}</span>
                ) : (
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={cantidad}
                    onChange={e => handleCantidadChange(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-right bg-white"
                  />
                )}
              </td>

              <td className="px-3 py-2 border-r border-gray-200 text-right text-gray-700">
                {fmt(monto)}
              </td>

              <td className="px-3 py-2 border-r border-gray-200 text-right text-gray-700">
                {pctFmt(lineaCapital.pctImpuesto)}
              </td>

              <td className="px-3 py-2 border-r border-gray-200 text-gray-700">
                {moneda || 'MXN'}
              </td>

              <td className="px-3 py-2 border-r border-gray-200 text-right font-semibold text-gray-900">
                {fmt(lineaCapital.subTotal)}
              </td>

              <td className="px-3 py-2">
                <span className="inline-flex px-2 py-0.5 rounded text-[10px] border text-amber-700 bg-amber-50 border-amber-200">
                  Pendiente
                </span>
              </td>
            </tr>

            {/* ── IVA = Monto × % IVA — sólo en el desglose de arrendamiento ── */}
            {lineaIva && (
              <tr className="border-b border-gray-200">
                <td className="px-3 py-2 border-r border-gray-200 font-medium text-gray-800">
                  {lineaIva.tipo}
                </td>

                <td className="px-3 py-2 border-r border-gray-200 font-medium text-gray-800">
                  {lineaIva.claveProducto}
                </td>

                <td className="px-3 py-2 border-r border-gray-200 text-right text-gray-700">
                  {cantidad.toLocaleString('es-MX')}
                </td>

                <td className="px-3 py-2 border-r border-gray-200 text-right text-gray-700">
                  {fmt(monto)}
                </td>

                <td className="px-3 py-2 border-r border-gray-200 text-right text-gray-700">
                  {pctFmt(lineaIva.pctImpuesto)}
                </td>

                <td className="px-3 py-2 border-r border-gray-200 text-gray-700">
                  {moneda || 'MXN'}
                </td>

                <td className="px-3 py-2 border-r border-gray-200 text-right font-semibold text-gray-900">
                  {fmt(lineaIva.subTotal)}
                </td>

                <td className="px-3 py-2">
                  <span className="inline-flex px-2 py-0.5 rounded text-[10px] border text-amber-700 bg-amber-50 border-amber-200">
                    Pendiente
                  </span>
                </td>
              </tr>
            )}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-gray-400 bg-gray-50">
              <td colSpan={6} className="px-3 py-2 text-right text-xs font-semibold text-gray-800">
                TOTAL GENERAL:
              </td>
              <td className="px-3 py-2 text-right text-xs font-bold text-gray-900">
                {fmt(totalGeneral)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-2 text-[10px] text-gray-400">
        {lineaIva
          ? 'Capital = Cantidad × Monto × (1 − % IVA) · IVA = Cantidad × Monto × % IVA'
          : 'Sub Total = Cantidad × Monto × (1 + % Impuesto)'}
      </p>
    </div>
  );
}
