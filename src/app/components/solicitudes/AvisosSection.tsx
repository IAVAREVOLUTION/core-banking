import { useState } from 'react';

interface AvisoData {
  id: number;
  fechaEmision: string;
  numeroReferencia: string;
  tipo: 'Pagar' | 'Cobrar';
  montoTotal: string;
  pagoTotal: string;
  saldo: string;
  estatus: string;
  condicionPago: string;
  observaciones: string;
  fechaVencimiento: string;
}

export function AvisosSection() {
  const [filtroTipo, setFiltroTipo] = useState<'Todos' | 'Pagar' | 'Cobrar'>('Todos');
  const [avisos] = useState<AvisoData[]>([
    {
      id: 1,
      fechaEmision: '08/01/2025',
      numeroReferencia: '1686519844',
      tipo: 'Cobrar',
      montoTotal: '$100',
      pagoTotal: '$0.00',
      saldo: '$0',
      estatus: 'Pendiente',
      condicionPago: 'Cobro a través de cuenta eje',
      observaciones: 'Sin Observaciones',
      fechaVencimiento: '08/01/2025'
    },
    {
      id: 2,
      fechaEmision: '15/12/2024',
      numeroReferencia: '1686519802',
      tipo: 'Cobrar',
      montoTotal: '$5,000.00',
      pagoTotal: '$5,000.00',
      saldo: '$0.00',
      estatus: 'Pagado',
      condicionPago: 'Cobro a través de cuenta eje',
      observaciones: 'Pago completado en tiempo',
      fechaVencimiento: '15/01/2025'
    },
    {
      id: 3,
      fechaEmision: '01/12/2024',
      numeroReferencia: '1686519756',
      tipo: 'Pagar',
      montoTotal: '$2,500.00',
      pagoTotal: '$1,000.00',
      saldo: '$1,500.00',
      estatus: 'Vencido',
      condicionPago: 'Pago a través de cuenta eje',
      observaciones: 'Requiere seguimiento',
      fechaVencimiento: '01/01/2025'
    },
    {
      id: 4,
      fechaEmision: '10/01/2025',
      numeroReferencia: '1686519890',
      tipo: 'Cobrar',
      montoTotal: '$3,200.00',
      pagoTotal: '$0.00',
      saldo: '$3,200.00',
      estatus: 'Pendiente',
      condicionPago: 'Cobro a través de cuenta eje',
      observaciones: 'Primer aviso',
      fechaVencimiento: '10/02/2025'
    },
    {
      id: 5,
      fechaEmision: '20/01/2025',
      numeroReferencia: '1686519901',
      tipo: 'Pagar',
      montoTotal: '$1,800.00',
      pagoTotal: '$0.00',
      saldo: '$1,800.00',
      estatus: 'Pendiente',
      condicionPago: 'Pago a proveedor',
      observaciones: 'Pago de servicios',
      fechaVencimiento: '20/02/2025'
    },
    {
      id: 6,
      fechaEmision: '05/01/2025',
      numeroReferencia: '1686519723',
      tipo: 'Pagar',
      montoTotal: '$4,500.00',
      pagoTotal: '$4,500.00',
      saldo: '$0.00',
      estatus: 'Pagado',
      condicionPago: 'Pago a proveedor',
      observaciones: 'Liquidado',
      fechaVencimiento: '05/02/2025'
    }
  ]);

  // Filtrar avisos según el tipo seleccionado
  const avisosFiltrados = avisos.filter(aviso => {
    if (filtroTipo === 'Todos') return true;
    return aviso.tipo === filtroTipo;
  });

  return (
    <div className="bg-white">
      {/* Encabezado con título */}
      <div className="flex items-center justify-between mb-3 px-3 pt-3">
        <span className="text-sm font-medium text-gray-800">AVISOS</span>
      </div>

      {/* Filtro por tipo de aviso */}
      <div className="px-3 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <label className="text-xs font-medium text-gray-700 whitespace-nowrap">Filtrar por tipo:</label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as 'Todos' | 'Pagar' | 'Cobrar')}
            className="px-2 py-1 border border-gray-300 text-xs rounded focus:outline-none focus:border-gray-400 bg-white"
          >
            <option value="Todos">Todos</option>
            <option value="Pagar">Por pagar</option>
            <option value="Cobrar">Por cobrar</option>
          </select>
          <span className="text-xs text-gray-600">
            ({avisosFiltrados.length} de {avisos.length})
          </span>
        </div>
      </div>

      {/* Tabla principal */}
      <div className="px-3 pb-3">
        <div className="border border-gray-300 overflow-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#D0D0D0]">
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300 whitespace-nowrap">
                  Fecha de Emisión
                </th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300 whitespace-nowrap">
                  Número de Referencia
                </th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300 whitespace-nowrap">
                  Monto Total
                </th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300 whitespace-nowrap">
                  Pago Total
                </th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300 whitespace-nowrap">
                  Saldo
                </th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300 whitespace-nowrap">
                  Estatus
                </th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300 whitespace-nowrap">
                  Condición de Pago
                </th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 border-r border-gray-300 whitespace-nowrap">
                  Observaciones
                </th>
                <th className="px-3 py-2 text-left font-medium text-xs text-gray-800 whitespace-nowrap">
                  Fecha de Vencimiento
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {avisosFiltrados.map((aviso) => (
                <tr key={aviso.id} className="border-b border-gray-300">
                  {/* Fecha de Emisión */}
                  <td className="px-3 py-2 border-r border-gray-300">
                    <div className="text-xs text-gray-700 px-2 py-1">
                      {aviso.fechaEmision}
                    </div>
                  </td>

                  {/* Número de Referencia */}
                  <td className="px-3 py-2 border-r border-gray-300">
                    <div className="text-xs text-gray-700 px-2 py-1">
                      {aviso.numeroReferencia}
                    </div>
                  </td>

                  {/* Monto Total */}
                  <td className="px-3 py-2 border-r border-gray-300">
                    <div className="text-xs text-gray-700 px-2 py-1">
                      {aviso.montoTotal}
                    </div>
                  </td>

                  {/* Pago Total */}
                  <td className="px-3 py-2 border-r border-gray-300">
                    <div className="text-xs text-gray-700 px-2 py-1">
                      {aviso.pagoTotal}
                    </div>
                  </td>

                  {/* Saldo */}
                  <td className="px-3 py-2 border-r border-gray-300">
                    <div className="text-xs text-gray-700 px-2 py-1">
                      {aviso.saldo}
                    </div>
                  </td>

                  {/* Estatus */}
                  <td className="px-3 py-2 border-r border-gray-300">
                    <div className="text-xs text-gray-700 px-2 py-1">
                      {aviso.estatus}
                    </div>
                  </td>

                  {/* Condición de Pago */}
                  <td className="px-3 py-2 border-r border-gray-300">
                    <div className="text-xs text-gray-700 px-2 py-1">
                      {aviso.condicionPago}
                    </div>
                  </td>

                  {/* Observaciones */}
                  <td className="px-3 py-2 border-r border-gray-300">
                    <div className="text-xs text-gray-700 px-2 py-1">
                      {aviso.observaciones}
                    </div>
                  </td>

                  {/* Fecha de Vencimiento */}
                  <td className="px-3 py-2">
                    <div className="text-xs text-gray-700 px-2 py-1">
                      {aviso.fechaVencimiento}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}