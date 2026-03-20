import { useState } from 'react';

interface Direccion {
  id: number;
  tipo: string;
  calle: string;
  numeroExterior: string;
  numeroInterior: string;
  colonia: string;
  codigoPostal: string;
  ciudad: string;
  estado: string;
  pais: string;
  direccionCompleta: string;
}

interface ClienteDireccionFormProps {
  onBack: () => void;
}

export function ClienteDireccionForm({ onBack }: ClienteDireccionFormProps) {
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [activeTab, setActiveTab] = useState('direcciones');

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'personas-relacionadas', label: 'Personas Relacionadas' },
    { id: 'direcciones', label: 'Direcciones' },
    { id: 'expedientes', label: 'Expedientes Electrónicos' },
    { id: 'sic', label: 'SIC' },
    { id: 'listas-negras', label: 'Listas Negras' },
    { id: 'kyc', label: 'KYC' },
    { id: 'garantias', label: 'Garantías' },
    { id: 'perfil-transaccional', label: 'Perfil Transaccional' },
    { id: 'cuentas-ahorro', label: 'Cuenta de Ahorro' },
    { id: 'solicitudes', label: 'Solicitudes de Crédito' },
    { id: 'creditos', label: 'Créditos' },
    { id: 'inversiones', label: 'Inversiones' },
    { id: 'movimientos', label: 'Movimientos' },
    { id: 'avisos', label: 'Avisos' },
    { id: 'auditoria', label: 'Auditoría' },
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Header Section */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#3B82F6">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.5-7 8-7s8 3 8 7"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Alta Cliente</h2>
            <button className="p-1 ml-2">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2">
                <circle cx="8" cy="8" r="6"/>
                <path d="M13 13l3 3"/>
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <span>Lista</span>
            <span>Buscar</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-300">
        <div className="flex items-center gap-2">
          <button className="px-5 py-1.5 btn-secondary-theme rounded text-sm font-medium">
            Guardar
          </button>
          <button onClick={onBack} className="px-5 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700">
            Cancelar
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div className="px-4 py-4 bg-[#F5F5F5]">
        <div className="bg-white border border-gray-300 p-4">
          {/* Información Principal Section */}
          <div className="mb-4">
            <div className="bg-primary-tint-theme px-3 py-2 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
              Información Principal
            </div>
            <div className="grid grid-cols-3 gap-x-6 gap-y-2.5">
              {/* Column 1 */}
              <div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-32 flex-shrink-0 text-gray-700">ID CLIENTE *</label>
                    <input type="text" value="CLI-001-CLI-006" disabled className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-32 flex-shrink-0 text-gray-700">PERSONALIDAD *</label>
                    <select className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" disabled>
                      <option>Física</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-32 flex-shrink-0 text-gray-700">RFC</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-32 flex-shrink-0 text-gray-700">NOMBRE *</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-32 flex-shrink-0 text-gray-700">APELLIDO PATERNO *</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-32 flex-shrink-0 text-gray-700">APELLIDO MATERNO</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-32 flex-shrink-0 text-gray-700">RFC</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-32 flex-shrink-0 text-gray-700">CURP</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-32 flex-shrink-0 text-gray-700">FECHA DE NACIMIENTO *</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-32 flex-shrink-0 text-gray-700">EDAD</label>
                    <input type="text" disabled className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-32 flex-shrink-0 text-gray-700">(GENERO/NACIONALIDAD)</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                </div>
              </div>

              {/* Column 2 */}
              <div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">PAÍS</label>
                    <select className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                      <option>MÉXICO</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">ATENCIÓN</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">RECEPTOR</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">TIPO DE VIA</label>
                    <select className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                      <option value="">Seleccione...</option>
                      <option>Calle</option>
                      <option>Avenida</option>
                      <option>Boulevard</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">CALLE</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">NUM. EXTERIOR</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">PISO</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">NUM. INTERIOR</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">COLONIA</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">DELEGACIÓN/MUNICIPIO</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">CODIGO POSTAL</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                </div>
              </div>

              {/* Column 3 */}
              <div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">CUENTA EJE</label>
                    <input type="text" disabled className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">SUCURSAL</label>
                    <input type="text" disabled value="MATRIZ (01)" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">FECHA DE ACTIVACION *</label>
                    <input type="text" disabled className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">ESTATUS *</label>
                    <input type="text" disabled value="ACTIVO" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">ESTATUS CUENTA MORA *</label>
                    <input type="text" disabled className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">CIUDAD</label>
                    <input type="text" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">ESTADO</label>
                    <select className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                      <option value="">Seleccione...</option>
                      <option>Ciudad de México</option>
                      <option>Estado de México</option>
                      <option>Jalisco</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">ESTATUS SIC *</label>
                    <input type="text" disabled value="POSITIVO" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">ESTATUS LISTA NEGRA *</label>
                    <input type="text" disabled value="POSITIVO" className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-36 flex-shrink-0 text-gray-700">CALIFICACIÓN DEL CLIENTE *</label>
                    <select className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded">
                      <option value="">Seleccione...</option>
                      <option>Bronce</option>
                      <option>Plata</option>
                      <option>Oro</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Dirección Principal (Read Only) */}
            <div className="mt-3">
              <div className="flex items-start gap-2">
                <label className="text-xs w-32 flex-shrink-0 text-gray-700 pt-1">DIRECCIÓN PRINCIPAL</label>
                <textarea disabled className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600 h-16 resize-none"></textarea>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="bg-primary-theme text-white border-y border-gray-400 -mx-4 mb-4">
            <div className="px-4 flex items-center overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-xs whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'bg-[#6B8AB8] text-white font-medium'
                      : 'text-white/90 hover:text-white hover:bg-[#5A7A95]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabla de Direcciones */}
          <div className="mt-4">
            <div className="border border-gray-300 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#E8E8E8] border-b border-gray-300">
                    <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">Editar</th>
                    <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">Ver</th>
                    <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">Tipo de Dirección</th>
                    <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">Dirección Principal</th>
                    <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">Ciudad</th>
                    <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">Estado</th>
                    <th className="px-3 py-2.5 text-left font-normal text-xs text-gray-700">País</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {direcciones.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-gray-500 text-xs">
                        No hay direcciones registradas
                      </td>
                    </tr>
                  ) : (
                    direcciones.map((direccion) => (
                      <tr key={direccion.id} className="border-b border-gray-200">
                        <td className="px-3 py-2.5 text-xs">
                          <a href="#" className="text-[#0066CC] hover:underline">Editar</a>
                        </td>
                        <td className="px-3 py-2.5 text-xs">
                          <a href="#" className="text-[#0066CC] hover:underline">Ver</a>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-700">{direccion.tipo}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-700">{direccion.direccionCompleta}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-700">{direccion.ciudad}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-700">{direccion.estado}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-700">{direccion.pais}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}