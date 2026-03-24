/**
 * SolicitudActivacionDetailTab.tsx
 *
 * Sub-tab "Detail" — fila única pre-poblada desde JOINs.
 *
 * Clave Producto  → J_CUENTAS_CORP_CLIENTES.producto_id          (read-only)
 * Cantidad        → editable (default 1)
 * Monto           → igual a Monto Transacción                     (read-only)
 * % Impuesto      → J_CUENTAS_CORP_CLIENTES...tasa_interes        (read-only)
 * Moneda          → igual a Moneda del header                     (read-only)
 * Sub Total       → Cantidad × Monto × (1 + % Impuesto)          (calculado)
 * Estatus         → fijo "Pendiente"
 *
 * Storage: los campos sin columna explícita → data.detail
 */

interface SolicitudActivacionDetailTabProps {
  storageId: string | number;   // reservado — la persistencia ocurre en el padre
  isRO: boolean;
  claveProducto: string;
  monto: number;
  pctImpuesto: number;          // decimal, ej. 0.16 = 16 %
  moneda: string;
  cantidad: number;
  onCantidadChange: (n: number) => void;
}

const fmt = (n: number) =>
  `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pctFmt = (n: number) => `${(n * 100).toFixed(2)} %`;

export function SolicitudActivacionDetailTab({
  isRO,
  claveProducto,
  monto,
  pctImpuesto,
  moneda,
  cantidad,
  onCantidadChange,
}: SolicitudActivacionDetailTabProps) {
  const subTotal = cantidad * monto * (1 + pctImpuesto);

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
        <span className="text-xs text-gray-500">1 línea</span>
      </div>

      <div className="border border-gray-300">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr
              className="border-b border-gray-400"
              style={{ backgroundColor: 'var(--theme-table-header, #F3F4F6)' }}
            >
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
            <tr className="border-b border-gray-200">
              {/* Clave Producto — read-only */}
              <td className="px-3 py-2 border-r border-gray-200 font-medium text-gray-800">
                {claveProducto || <span className="text-gray-400 italic">Sin clave</span>}
              </td>

              {/* Cantidad — editable */}
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

              {/* Monto — read-only */}
              <td className="px-3 py-2 border-r border-gray-200 text-right text-gray-700">
                {fmt(monto)}
              </td>

              {/* % Impuesto — read-only */}
              <td className="px-3 py-2 border-r border-gray-200 text-right text-gray-700">
                {pctFmt(pctImpuesto)}
              </td>

              {/* Moneda — read-only */}
              <td className="px-3 py-2 border-r border-gray-200 text-gray-700">
                {moneda || 'MXN'}
              </td>

              {/* Sub Total — calculado */}
              <td className="px-3 py-2 border-r border-gray-200 text-right font-semibold text-gray-900">
                {fmt(subTotal)}
              </td>

              {/* Estatus — fijo */}
              <td className="px-3 py-2">
                <span className="inline-flex px-2 py-0.5 rounded text-[10px] border text-amber-700 bg-amber-50 border-amber-200">
                  Pendiente
                </span>
              </td>
            </tr>
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-gray-400 bg-gray-50">
              <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-gray-800">
                TOTAL GENERAL:
              </td>
              <td className="px-3 py-2 text-right text-xs font-bold text-gray-900">
                {fmt(subTotal)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-2 text-[10px] text-gray-400">
        Sub Total = Cantidad × Monto × (1 + % Impuesto)
      </p>
    </div>
  );
}
