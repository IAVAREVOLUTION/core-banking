interface TabAvisosProps {
  mode: 'nuevo' | 'editar' | 'ver';
  creditoId?: number;
}

export function TabAvisos({ mode, creditoId }: TabAvisosProps) {
  // Datos mock exactos según la imagen
  const avisos = [
    {
      fechaEmision: '09/09/2022',
      numeroReferencia: '549845104854',
      montoTotal: '$500',
      pagoTotal: '$300',
      saldo: '$0',
      estatus: 'Pendiente',
      condicionPago: 'Cobro a través de cuenta eje',
      periodo: 'Semanal',
      observaciones: 'Sin Observaciones',
      fechaVencimiento: '03/10/2022',
    }
  ];

  return (
    <div className="bg-white">
      {/* Subtítulo Avisos */}
      <div className="bg-[#E8E8E8] px-3 py-1.5 border-b border-gray-300">
        <span className="text-xs font-medium text-gray-700">Avisos</span>
      </div>

      {/* Tabla de Avisos */}
      <div className="p-3">
        <div className="border border-gray-300">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-white border-b border-gray-300">
                <th className="text-left px-3 py-2 font-normal text-gray-700 border-r border-gray-300">Fecha emisión</th>
                <th className="text-left px-3 py-2 font-normal text-gray-700 border-r border-gray-300">Número de Referencia</th>
                <th className="text-left px-3 py-2 font-normal text-gray-700 border-r border-gray-300">Monto total</th>
                <th className="text-left px-3 py-2 font-normal text-gray-700 border-r border-gray-300">Pago total</th>
                <th className="text-left px-3 py-2 font-normal text-gray-700 border-r border-gray-300">Saldo</th>
                <th className="text-left px-3 py-2 font-normal text-gray-700 border-r border-gray-300">Estatus</th>
                <th className="text-left px-3 py-2 font-normal text-gray-700 border-r border-gray-300">Condición de Pago</th>
                <th className="text-left px-3 py-2 font-normal text-gray-700 border-r border-gray-300">Periodo</th>
                <th className="text-left px-3 py-2 font-normal text-gray-700 border-r border-gray-300">Observaciones</th>
                <th className="text-left px-3 py-2 font-normal text-gray-700">Fecha vencimiento</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {avisos.map((aviso, index) => (
                <tr key={index} className="border-b border-gray-300">
                  <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{aviso.fechaEmision}</td>
                  <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{aviso.numeroReferencia}</td>
                  <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{aviso.montoTotal}</td>
                  <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{aviso.pagoTotal}</td>
                  <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{aviso.saldo}</td>
                  <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{aviso.estatus}</td>
                  <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{aviso.condicionPago}</td>
                  <td className="px-3 py-2 border-r border-gray-300">
                    <select className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700">
                      <option>{aviso.periodo}</option>
                      <option>Diario</option>
                      <option>Quincenal</option>
                      <option>Mensual</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{aviso.observaciones}</td>
                  <td className="px-3 py-2 text-gray-700">{aviso.fechaVencimiento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
