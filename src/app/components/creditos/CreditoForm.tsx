import { useState } from 'react';
import { TabAvisos } from './TabAvisos';

interface CreditoFormProps {
  mode: 'nuevo' | 'editar' | 'ver';
  onCancel: () => void;
}

export function CreditoForm({ mode, onCancel }: CreditoFormProps) {
  const [activeTab, setActiveTab] = useState('default');
  const camposEditables = mode !== 'ver';
  const mostrarGuardar = mode !== 'ver';

  const tabs = [
    { id: 'default', label: 'Default' },
    { id: 'montos', label: 'Montos/Plazos' },
    { id: 'tasas', label: 'Tasas' },
    { id: 'amortizaciones', label: 'Amortizaciones' },
    { id: 'expedientes', label: 'Expedientes Electrónicos' },
    { id: 'autorizacion', label: 'Autorización' },
    { id: 'garantias', label: 'Garantías' },
    { id: 'cargos', label: 'Cargos' },
    { id: 'avisos', label: 'Avisos' },
    { id: 'solicitudes', label: 'Solicitudes Extraordinarias' },
  ];

  return (
    <div className="bg-[#F5F5F5] min-h-screen">
      {/* Header con icono y título */}
      <div className="bg-white px-4 py-2.5 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="stroke-accent-theme" strokeWidth="1.5">
              <rect x="2" y="3" width="16" height="14" rx="2"/>
              <path d="M2 8h16"/>
              <path d="M6 3v4M14 3v4"/>
            </svg>
            <span className="text-sm text-gray-700 font-normal">
              {mode === 'nuevo' ? 'Alta Crédito' : mode === 'editar' ? 'Editar Crédito' : 'Ver Crédito'}
            </span>
            <button className="ml-2 p-1">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#999" strokeWidth="2">
                <circle cx="7" cy="7" r="5"/>
                <path d="M11 11l3 3"/>
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <button className="text-accent-theme hover:underline">Lista</button>
            <button className="text-accent-theme hover:underline">Buscar</button>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="px-4 py-2 bg-white border-b border-gray-300">
        <div className="flex items-center gap-2">
          {mostrarGuardar && (
            <button 
              className="px-5 py-1.5 btn-accent-theme text-white rounded text-xs hover:bg-accent-hover-theme font-normal"
            >
              Guardar
            </button>
          )}
          <button 
            onClick={onCancel}
            className="px-5 py-1.5 bg-white border border-gray-400 rounded text-xs hover:bg-gray-50 text-gray-700"
          >
            {mode === 'ver' ? 'Cerrar' : 'Cancelar'}
          </button>
        </div>
      </div>

      {/* Contenido */}
      <div className="px-4 py-3">
        <div className="bg-white border border-gray-300">
          {/* Datos Cliente */}
          <div className="bg-[#E8E8E8] px-3 py-1.5 border-b border-gray-300">
            <span className="text-xs font-medium text-gray-700">Datos Cliente</span>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
              {/* Columna 1 */}
              <div className="space-y-1.5">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">NO. DE CRÉDITO</label>
                  <input 
                    type="text" 
                    value="CRE-001"
                    disabled
                    className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">CLIENTE <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">001-001- Juan Pérez Pérez</div>
                  ) : (
                    <select className="px-2 py-1 text-xs border border-gray-300 rounded">
                      <option>001-001- Juan Pérez Pérez</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Columna 2 */}
              <div className="space-y-1.5">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">FECHA DE CRÉDITO <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">23/05/2025</div>
                  ) : (
                    <div className="relative">
                      <input 
                        type="text"
                        defaultValue="23/05/2025"
                        placeholder="dd/mm/aaaa"
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      />
                      <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" fill="none"/>
                        <path d="M2 6h12M5 3v2M11 3v2"/>
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">EMPRESA FONDEADORA</label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">Crédito maestro</div>
                  ) : (
                    <select className="px-2 py-1 text-xs border border-gray-300 rounded">
                      <option>Crédito maestro</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Columna 3 */}
              <div className="space-y-1.5">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">SUCURSAL <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">CDMX</div>
                  ) : (
                    <select className="px-2 py-1 text-xs border border-gray-300 rounded">
                      <option>CDMX</option>
                    </select>
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">MONTO SOLICITADO <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">$12,000.00</div>
                  ) : (
                    <input 
                      type="text"
                      defaultValue="$12,000.00"
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Datos Producto */}
          <div className="bg-[#E8E8E8] px-3 py-1.5 border-b border-gray-300">
            <span className="text-xs font-medium text-gray-700">Datos Producto</span>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
              {/* Columna 1 */}
              <div className="space-y-1.5">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">LÍNEA PRODUCTO <span className="text-red-600">*</span></label>
                  <select disabled className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600">
                    <option>Crédito</option>
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">SUBLÍNEA <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">Crédito empresarial</div>
                  ) : (
                    <select className="px-2 py-1 text-xs border border-gray-300 rounded">
                      <option>Crédito empresarial</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Columna 2 */}
              <div className="space-y-1.5">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">PRODUCTO <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">Crédito personal</div>
                  ) : (
                    <select className="px-2 py-1 text-xs border border-gray-300 rounded">
                      <option>Crédito personal</option>
                    </select>
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">PERIODO</label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">Mensual</div>
                  ) : (
                    <select className="px-2 py-1 text-xs border border-gray-300 rounded">
                      <option>Mensual</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Columna 3 */}
              <div className="space-y-1.5">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">PLAZOS <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">0-6</div>
                  ) : (
                    <select className="px-2 py-1 text-xs border border-gray-300 rounded">
                      <option>0-6</option>
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* DESTINO DEL CRÉDITO - Ancho completo */}
            <div className="mt-1.5">
              <div className="flex flex-col">
                <label className="text-[10px] text-gray-600 mb-0.5">DESTINO DEL CRÉDITO <span className="text-red-600">*</span></label>
                {!camposEditables ? (
                  <div className="px-2 py-1 text-xs text-gray-700">El destino del crédito sera para la remodelación de la casa del cliente</div>
                ) : (
                  <textarea 
                    rows={3}
                    defaultValue="El destino del crédito sera para la remodelación de la casa del cliente"
                    className="px-2 py-1 text-xs border border-gray-300 rounded resize-none"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Datos Estatus */}
          <div className="bg-[#E8E8E8] px-3 py-1.5 border-b border-gray-300">
            <span className="text-xs font-medium text-gray-700">Datos Estatus</span>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
              {/* Columna 1 */}
              <div className="space-y-1.5">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">ESTATUS DE PAGO <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">Pendiente</div>
                  ) : (
                    <select className="px-2 py-1 text-xs border border-gray-300 rounded">
                      <option>Pendiente</option>
                    </select>
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">ESTATUS DE CARTERA <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">Vigente</div>
                  ) : (
                    <select className="px-2 py-1 text-xs border border-gray-300 rounded">
                      <option>Vigente</option>
                    </select>
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">ESTATUS CRÉDITO <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">Pendiente</div>
                  ) : (
                    <select className="px-2 py-1 text-xs border border-gray-300 rounded">
                      <option>Pendiente</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Columna 2 */}
              <div className="space-y-1.5">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">PLAZO AUTORIZADO</label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">6</div>
                  ) : (
                    <input 
                      type="text"
                      defaultValue="6"
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">MONTO AUTORIZADO</label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">$12,000.00</div>
                  ) : (
                    <input 
                      type="text"
                      defaultValue="$12,000.00"
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">TASA AUTORIZADA</label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700"></div>
                  ) : (
                    <input 
                      type="text"
                      className="px-2 py-1 text-xs border border-gray-300 rounded"
                    />
                  )}
                </div>
              </div>

              {/* Columna 3 */}
              <div className="space-y-1.5">
                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">FECHA INICIO <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">05/06/2025</div>
                  ) : (
                    <div className="relative">
                      <input 
                        type="text"
                        defaultValue="05/06/2025"
                        placeholder="dd/mm/aaaa"
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      />
                      <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" fill="none"/>
                        <path d="M2 6h12M5 3v2M11 3v2"/>
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="text-[10px] text-gray-600 mb-0.5">FECHA FIN <span className="text-red-600">*</span></label>
                  {!camposEditables ? (
                    <div className="px-2 py-1 text-xs text-gray-700">05/07/2025</div>
                  ) : (
                    <div className="relative">
                      <input 
                        type="text"
                        defaultValue="05/07/2025"
                        placeholder="dd/mm/aaaa"
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      />
                      <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="2" y="3" width="12" height="11" rx="1" stroke="currentColor" fill="none"/>
                        <path d="M2 6h12M5 3v2M11 3v2"/>
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="border-t border-gray-300 bg-white">
            <div className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-[11px] font-normal transition-colors border-r border-gray-300 ${
                    activeTab === tab.id
                      ? 'btn-accent-theme text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'default' && (
            <div className="border-t border-gray-300">
              <div className="bg-[#E8E8E8] px-3 py-1.5 border-b border-gray-300">
                <span className="text-xs font-medium text-gray-700">Datos del cliente</span>
              </div>

              <div className="p-3">
                <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                  {/* Columna 1 */}
                  <div className="space-y-1.5">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-0.5">ESTATUS SIC</label>
                      <input 
                        type="text"
                        value="Pendiente"
                        disabled
                        className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-0.5">ESTATUS LISTA NEGRA</label>
                      <input 
                        type="text"
                        disabled
                        className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600"
                      />
                    </div>
                  </div>

                  {/* Columna 2 */}
                  <div className="space-y-1.5">
                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-0.5">ESTATUS DEL CLIENTE</label>
                      <select disabled className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600">
                        <option>Activo</option>
                      </select>
                    </div>

                    <div className="flex flex-col">
                      <label className="text-[10px] text-gray-600 mb-0.5">MONEDA</label>
                      <select disabled className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600">
                        <option>MXN</option>
                      </select>
                    </div>
                  </div>

                  {/* Columna 3 */}
                  <div className="space-y-1.5">
                  </div>
                </div>

                {/* DIRECCIÓN PRINCIPAL - Ancho completo */}
                <div className="mt-1.5">
                  <div className="flex flex-col">
                    <label className="text-[10px] text-gray-600 mb-0.5">DIRECCIÓN PRINCIPAL</label>
                    <textarea 
                      disabled
                      rows={3}
                      defaultValue="Av. Río 432 Col Florencia Del.Benito Juárez CDMX C.P.03810, CDMX"
                      className="px-2 py-1 text-xs border border-gray-300 rounded bg-gray-100 text-gray-600 resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content - Avisos */}
          {activeTab === 'avisos' && (
            <TabAvisos 
              mode={mode} 
              creditoId={1}
            />
          )}

          {/* Otros tabs que no son default ni avisos */}
          {activeTab !== 'default' && activeTab !== 'avisos' && (
            <div className="p-8 text-center text-gray-500 border-t border-gray-300">
              <p className="text-sm">Contenido de {tabs.find(t => t.id === activeTab)?.label}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}