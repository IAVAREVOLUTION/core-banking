import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  SimulacionRow, TerminosCondiciones, EMPTY_TERMINOS,
  saveToSession, loadFromSession, loadFromSavedStore,
  MOCK_SIMULACION, MOCK_TERMINOS, formatCurrency, generarSimulacion, parseCurrency,
} from './solicitudCreditoStore';

interface Props {
  mode: 'nuevo' | 'editar' | 'ver';
  solicitudId: number | string | 'new';
  lineaProducto: string;
}

export function SimulacionTab({ mode, solicitudId, lineaProducto }: Props) {
  const getInit = (): SimulacionRow[] => {
    const s = loadFromSession<SimulacionRow[]>(solicitudId, 'simulacion');
    if (s) return s;
    if (mode === 'nuevo') return [];
    const saved = loadFromSavedStore<SimulacionRow[]>(solicitudId, 'simulacion');
    if (saved) return saved;
    const mock = MOCK_SIMULACION[solicitudId as number];
    return mock ? [...mock] : [];
  };

  const [rows, setRows] = useState<SimulacionRow[]>(getInit);
  const isRO = mode === 'ver';

  useEffect(() => {
    if (!isRO) saveToSession(solicitudId, 'simulacion', rows);
  }, [rows, solicitudId, isRO]);

  const handleGenerar = () => {
    // Load terms from session or saved store
    const terminos =
      loadFromSession<TerminosCondiciones>(solicitudId, 'terminos') ||
      loadFromSavedStore<TerminosCondiciones>(solicitudId, 'terminos') ||
      MOCK_TERMINOS[solicitudId as number] ||
      EMPTY_TERMINOS;

    console.log('[SimulacionTab] handleGenerar — terminos loaded:', JSON.stringify(terminos));
    console.log('[SimulacionTab] solicitudId:', solicitudId, '| session key:', `sol_credito_${solicitudId}_terminos`);

    const monto = parseFloat(parseCurrency(terminos.montoSolicitado || '0'));
    const tasa = parseFloat(String(terminos.tasa || '0').replace(/[^0-9.-]/g, ''));
    const plazo = parseInt(String(terminos.plazo || '0'));
    const frecuencia = terminos.frecuencia || 'Mensual';
    const fechaPrimerPago = terminos.fechaPrimerPago || '';
    const tipoCalculo = terminos.tipoCalculo || 'Francés';
    const seguro = terminos.seguroFinanciado
      ? parseFloat(parseCurrency(terminos.montoSeguro || '0')) / (plazo || 1)
      : 0;

    console.log('[SimulacionTab] Parsed values — monto:', monto, '| tasa:', tasa, '| plazo:', plazo, '| tipoCalculo:', tipoCalculo, '| frecuencia:', frecuencia);

    if (monto <= 0 || tasa <= 0 || plazo <= 0) {
      toast.error('Datos insuficientes', {
        description: `Complete Monto (${monto}), Tasa (${tasa}) y Plazo (${plazo}) en Términos y Condiciones antes de generar.`,
        duration: 4000,
      });
      return;
    }

    const newRows = generarSimulacion(monto, tasa, plazo, frecuencia, fechaPrimerPago, tipoCalculo, seguro);
    setRows(newRows);
    saveToSession(solicitudId, 'simulacion', newRows);
    toast.success('Simulación generada', {
      description: `${newRows.length} pagos calculados (${tipoCalculo})`,
      duration: 3000,
    });
  };

  // Label por tipo de producto
  const tableTitle = lineaProducto === 'Captación'
    ? 'Tabla de Aportaciones'
    : lineaProducto === 'Línea de Crédito'
      ? 'Tabla de Amortización'
      : 'Tabla de Pagos';

  const paymentLabel = lineaProducto === 'Captación' ? 'Aportación' : 'Pago';

  // Totals
  const totalCapital = rows.reduce((s, r) => s + r.pagoCapital, 0);
  const totalInteres = rows.reduce((s, r) => s + r.pagoInteres, 0);
  const totalIVA = rows.reduce((s, r) => s + r.ivaInteres, 0);
  const totalSeguro = rows.reduce((s, r) => s + r.pagoSeguro, 0);
  const totalPago = rows.reduce((s, r) => s + r.pagoTotal, 0);

  return (
    <div className="border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-medium text-gray-800">{tableTitle}</h4>
        {!isRO && (
          <button
            onClick={handleGenerar}
            className="px-4 py-1.5 btn-secondary-theme rounded text-xs flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 1v12M1 7h12" />
            </svg>
            Generar Simulación
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-xs">
          <svg className="mx-auto mb-3" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#ccc" strokeWidth="1.5">
            <rect x="5" y="8" width="30" height="24" rx="2" />
            <path d="M5 14h30M13 8v6M20 8v6M27 8v6" />
          </svg>
          No hay simulación generada. Complete los Términos y Condiciones y presione "Generar Simulación".
        </div>
      ) : (
        <>
          <div className="border border-gray-300 overflow-auto max-h-[400px]">
            <table className="w-full text-xs">
              <thead className="bg-[#2E5C91] text-white sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">N° {paymentLabel}</th>
                  <th className="px-2 py-2 text-left font-medium">Fecha</th>
                  <th className="px-2 py-2 text-right font-medium">Saldo Insoluto</th>
                  <th className="px-2 py-2 text-right font-medium">Capital</th>
                  <th className="px-2 py-2 text-right font-medium">Interés</th>
                  <th className="px-2 py-2 text-right font-medium">IVA</th>
                  <th className="px-2 py-2 text-right font-medium">{paymentLabel} Periodo</th>
                  {totalSeguro > 0 && <th className="px-2 py-2 text-right font-medium">Seguro</th>}
                  <th className="px-2 py-2 text-right font-medium">{paymentLabel} Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr
                    key={r.noPago}
                    className="border-b border-gray-200"
                    style={{ backgroundColor: idx % 2 === 1 ? '#F5F5F5' : '#FFFFFF' }}
                  >
                    <td className="px-2 py-1.5 text-gray-700">{r.noPago}</td>
                    <td className="px-2 py-1.5 text-gray-700">{r.fechaPago}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.saldoInsoluto)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.pagoCapital)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.pagoInteres)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.ivaInteres)}</td>
                    <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.pagoPeriodo)}</td>
                    {totalSeguro > 0 && <td className="px-2 py-1.5 text-right text-gray-700">{formatCurrency(r.pagoSeguro)}</td>}
                    <td className="px-2 py-1.5 text-right font-medium text-gray-800">{formatCurrency(r.pagoTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-400 font-medium">
                  <td className="px-2 py-2 text-gray-800" colSpan={2}>TOTALES</td>
                  <td className="px-2 py-2 text-right text-gray-600">—</td>
                  <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(totalCapital)}</td>
                  <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(totalInteres)}</td>
                  <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(totalIVA)}</td>
                  <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(totalCapital + totalInteres + totalIVA)}</td>
                  {totalSeguro > 0 && <td className="px-2 py-2 text-right text-gray-800">{formatCurrency(totalSeguro)}</td>}
                  <td className="px-2 py-2 text-right text-gray-900 font-bold">{formatCurrency(totalPago)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-3 text-xs text-gray-500 flex items-center gap-4">
            <span>Total {paymentLabel}s: {rows.length}</span>
            <span>Monto Total: {formatCurrency(totalPago)}</span>
          </div>
        </>
      )}
    </div>
  );
}