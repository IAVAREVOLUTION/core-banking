import { K_EXTRAORDINARY_REQUESTS } from '@/app/data/mockData';

interface TabSolicitudesExtraordinariasProps {
  mode: 'nuevo' | 'editar' | 'ver';
  creditoId?: number;
}

export function TabSolicitudesExtraordinarias({ mode, creditoId }: TabSolicitudesExtraordinariasProps) {
  const solicitudes = K_EXTRAORDINARY_REQUESTS;

  return (
    <div className="bg-white">
      {/* Fila de Solicitudes Extraordinarias con botones */}
      <div className="flex items-center justify-between bg-[#E8E8E8] px-3 py-1.5 border-b border-gray-300">
        <span className="text-xs font-medium text-gray-700">Solicitudes Extraordinarias</span>
        <div className="flex gap-2">
          <button className="px-4 py-1 text-xs bg-[#2E5C91] text-white rounded hover:bg-[#1e3a5f]">
            Nuevo
          </button>
          <button className="px-4 py-1 text-xs bg-white border border-gray-400 rounded text-gray-700 hover:bg-gray-50">
            Eliminar
          </button>
          <button className="px-4 py-1 text-xs bg-white border border-gray-400 rounded text-gray-700 hover:bg-gray-50">
            Enviar
          </button>
        </div>
      </div>

      {/* Tabla de Solicitudes Extraordinarias */}
      <div className="p-3">
        <table className="w-full text-xs border-collapse border border-gray-300">
          <thead>
            <tr className="bg-[#8B8B8B]">
              <th className="text-left px-3 py-2 font-normal text-white border-r border-gray-400">No. Solicitud</th>
              <th className="text-left px-3 py-2 font-normal text-white border-r border-gray-400">Número de Cliente</th>
              <th className="text-left px-3 py-2 font-normal text-white border-r border-gray-400">Cliente</th>
              <th className="text-left px-3 py-2 font-normal text-white border-r border-gray-400">Número de Cuenta</th>
              <th className="text-left px-3 py-2 font-normal text-white border-r border-gray-400">Producto Financiero</th>
              <th className="text-left px-3 py-2 font-normal text-white border-r border-gray-400">Área que Solicita</th>
              <th className="text-left px-3 py-2 font-normal text-white border-r border-gray-400">Solicitud/Ext</th>
              <th className="text-left px-3 py-2 font-normal text-white border-r border-gray-400">Área que autoriza</th>
              <th className="text-left px-3 py-2 font-normal text-white border-r border-gray-400">Observaciones</th>
              <th className="text-left px-3 py-2 font-normal text-white">Estatus</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {solicitudes.map((solicitud, index) => (
              <tr key={solicitud.id} className="border-b border-gray-300">
                <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{solicitud.requestNumber}</td>
                <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{solicitud.clientNumber}</td>
                <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{solicitud.clientName}</td>
                <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{solicitud.accountNumber}</td>
                <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{solicitud.financialProduct}</td>
                <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{solicitud.requestArea}</td>
                <td className="px-3 py-2 border-r border-gray-300">
                  <select className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700">
                    <option value={solicitud.requestType}>{solicitud.requestType}</option>
                    <option value="Ampliación">Ampliación</option>
                    <option value="Reestructura">Reestructura</option>
                    <option value="Prórroga">Prórroga</option>
                    <option value="Cancelación">Cancelación</option>
                    <option value="Otro">Otro</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{solicitud.authorizationArea}</td>
                <td className="px-3 py-2 text-gray-700 border-r border-gray-300">{solicitud.notes}</td>
                <td className="px-3 py-2">
                  <select className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700">
                    <option value={solicitud.requestStatus}>{solicitud.requestStatus}</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Aprobado">Aprobado</option>
                    <option value="Rechazado">Rechazado</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
