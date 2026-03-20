import { useState } from 'react';
import { Product, FormMode } from '../types/product';
import {
  lineProducts,
  sublineProducts,
  organizations,
  statusOptions,
  currentUser,
} from '../data/mockData';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { GarantiaTab } from './productos/tabs/GarantiaTab';
import { JerarquiaProductosTab } from './productos/tabs/JerarquiaProductosTab';
import { ComiteCreditoTab } from './productos/tabs/ComiteCreditoTab';
import { PeriodicidadTab } from './productos/tabs/PeriodicidadTab';
import { FasesTab } from './productos/tabs/FasesTab';
import { MatrizTasaFijaTab } from './productos/tabs/MatrizTasaFijaTab';
import { IvaTab } from './productos/tabs/IvaTab';
import { ExentoIvaTab } from './productos/tabs/ExentoIvaTab';
import { CheckListTab } from './productos/tabs/CheckListTab';

interface ProductFormProps {
  mode: FormMode;
  product?: Product;
  onSave: (product: Product) => void;
  onCancel: () => void;
  nextId: number;
}

export function ProductForm({
  mode,
  product,
  onSave,
  onCancel,
  nextId,
}: ProductFormProps) {
  const isView = mode === 'view';
  const isCreate = mode === 'create';

  const [activeTab, setActiveTab] = useState('default');

  // Estado del formulario
  const [formData, setFormData] = useState<Product>(() => {
    if (isCreate) {
      const selectedOrg = organizations.find(
        (org) => org.name === currentUser.organization
      );
      return {
        id: nextId,
        name: '',
        description: '',
        lineProduct: '',
        sublineProduct: '',
        organization: currentUser.organization,
        status: 'Pendiente',
        createdDate: new Date().toISOString(),
        currency: selectedOrg?.currency || 'MXN',
        registeredBy: currentUser.name,
        workPosition: currentUser.workPosition,
      };
    }
    return product || ({} as Product);
  });

  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);

  const handleChange = (
    field: keyof Product,
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    if (field === 'lineProduct') {
      setFormData((prev) => ({
        ...prev,
        sublineProduct: '',
      }));
      const line = lineProducts.find((l) => l.name === value);
      setSelectedLineId(line?.id || null);
    }

    if (field === 'organization') {
      const org = organizations.find((o) => o.name === value);
      if (org) {
        setFormData((prev) => ({
          ...prev,
          currency: org.currency,
        }));
      }
    }
  };

  const handleSubmit = () => {
    if (!isView) {
      onSave(formData);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", {
        locale: es,
      });
    } catch {
      return dateString;
    }
  };

  const availableSublines = selectedLineId
    ? sublineProducts.filter((sub) => sub.lineId === selectedLineId)
    : [];

  const tabs = [
    { id: 'default', label: 'Default' },
    { id: 'aplicar-cobranza', label: 'Aplicar Cobranza' },
    { id: 'iva', label: 'IVA %' },
    { id: 'garantias', label: 'Garantías' },
    { id: 'jerarquia-productos', label: 'Jerarquía de Productos' },
    { id: 'productos-relacionados', label: 'Productos relacionados' },
    { id: 'comites-credito', label: 'Comites de crédito' },
    { id: 'periodicidad', label: 'Periodicidad' },
    { id: 'fases', label: 'Fases' },
    { id: 'matriz-tasas', label: 'Matriz de tasas' },
    { id: 'exento-iva', label: 'Exento IVA' },
    { id: 'checklist', label: 'Check List' },
    { id: 'condiciones-disposicion', label: 'Condiciones de disposición' },
    { id: 'parametros-calculo', label: 'Parámetros de Cálculo de Línea' },
    { id: 'gastos-comisiones', label: 'Gastos/Comisiones' },
    { id: 'evento-contable', label: 'Evento Contable' },
    { id: 'seguimiento', label: 'Seguimiento' },
    { id: 'catalogo-evento', label: 'Catálogo Evento Contable' },
  ];

  return (
    <div className="bg-[#F0F0F0] min-h-screen">
      {/* Header Section */}
      <div className="bg-white px-4 py-3 border-b border-gray-300">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#4A90E2">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <path d="M4 9h16M9 4v16" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
            <h2 className="text-lg font-normal text-gray-800">Alta Producto Crédito</h2>
            <button className="p-1 ml-2">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#999" strokeWidth="2">
                <circle cx="8" cy="8" r="6"/>
                <path d="M13 13l3 3"/>
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-700">
            <button className="hover:text-gray-900">Lista</button>
            <button className="hover:text-gray-900">Buscar</button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-300">
        <div className="flex items-center gap-2">
          <button 
            onClick={handleSubmit}
            className="px-5 py-1.5 btn-secondary-theme text-xs rounded font-medium"
          >
            Guardar
          </button>
          <button 
            onClick={onCancel}
            className="px-5 py-1.5 bg-white border border-gray-400 rounded text-sm hover:bg-gray-50 text-gray-700"
          >
            Cancelar
          </button>
        </div>
      </div>

      {/* Form Content */}
      <div className="px-4 py-4">
        <div className="bg-white border border-gray-300">
          {/* Datos Producto - Siempre visible */}
          <div className="p-4 border-b border-gray-300">
            <div className="bg-primary-tint-theme px-3 py-1.5 mb-3 text-sm font-medium text-gray-800 border-l-4 border-primary-theme">
              Datos Producto
            </div>
            
            <div className="grid grid-cols-3 gap-x-6 gap-y-1">
              {/* Columna 1 */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Nombre <span className="text-black">*</span></label>
                  {isView ? (
                    <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">{formData.name}</div>
                  ) : (
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded" 
                      required
                    />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Tipo Producto <span className="text-black">*</span></label>
                  {isView ? (
                    <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">Crédito</div>
                  ) : (
                    <select className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded" required>
                      <option value="">Seleccione...</option>
                      <option value="Crédito">Crédito</option>
                      <option value="Captación">Captación</option>
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Sucursales</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">{formData.organization}</div>
                  ) : (
                    <select className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded">
                      <option value="">Seleccione...</option>
                      {organizations.map((org) => (
                        <option key={org.name} value={org.name}>{org.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Línea Producto</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">{formData.lineProduct}</div>
                  ) : (
                    <select 
                      value={formData.lineProduct}
                      onChange={(e) => handleChange('lineProduct', e.target.value)}
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    >
                      <option value="">Seleccione...</option>
                      {lineProducts.map((line) => (
                        <option key={line.id} value={line.name}>{line.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Monto mínimo</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    disabled={isView}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Permite Sobregiros</label>
                  <input type="checkbox" className="w-4 h-4" disabled={isView} />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Monto / Porcentaje</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    disabled={isView}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Intervalo de CleanUp</label>
                  <input 
                    type="number"
                    className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    disabled={isView}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">% Comisión apertura</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    disabled={isView}
                  />
                </div>
              </div>

              {/* Columna 2 */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Clave <span className="text-black">*</span></label>
                  {isView ? (
                    <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">{formData.id}</div>
                  ) : (
                    <input 
                      type="number"
                      value={formData.id}
                      onChange={(e) => handleChange('id', parseInt(e.target.value))}
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded" 
                      required
                    />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Sub Tipo</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">{formData.sublineProduct}</div>
                  ) : (
                    <select 
                      value={formData.sublineProduct}
                      onChange={(e) => handleChange('sublineProduct', e.target.value)}
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    >
                      <option value="">Seleccione...</option>
                      {availableSublines.map((subline) => (
                        <option key={subline.id} value={subline.name}>{subline.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Nombre Equipo de Analista</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">Equipo A</div>
                  ) : (
                    <select className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded">
                      <option value="">Seleccione...</option>
                      <option value="Equipo A">Equipo A</option>
                      <option value="Equipo B">Equipo B</option>
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Tipo de línea</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">Revolvente</div>
                  ) : (
                    <select className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded">
                      <option value="">Seleccione...</option>
                      <option value="Revolvente">Revolvente</option>
                      <option value="Simple">Simple</option>
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Monto máximo</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    disabled={isView}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Tipo de Sobregiro</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">Porcentaje</div>
                  ) : (
                    <select className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded">
                      <option value="">Seleccione...</option>
                      <option value="Monto">Monto</option>
                      <option value="Porcentaje">Porcentaje</option>
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Núm. Disposiciones Abiertas</label>
                  <input 
                    type="number"
                    className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    disabled={isView}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Verificación de CleanUp</label>
                  <input type="checkbox" className="w-4 h-4" disabled={isView} />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Plazo mínimo disposición</label>
                  <input 
                    type="number"
                    className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    disabled={isView}
                  />
                </div>
              </div>

              {/* Columna 3 */}
              <div className="space-y-1">
                <div className="flex items-start gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700 pt-1">Descripción</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">{formData.description}</div>
                  ) : (
                    <textarea 
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      rows={2}
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded resize-none"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Nombre Equipo de Analista de Mesa</label>
                  {isView ? (
                    <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">Mesa 1</div>
                  ) : (
                    <select className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded">
                      <option value="">Seleccione...</option>
                      <option value="Mesa 1">Mesa 1</option>
                      <option value="Mesa 2">Mesa 2</option>
                    </select>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Plazo máximo disposición</label>
                  <input 
                    type="number"
                    className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    disabled={isView}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Días de gracia disposición</label>
                  <input 
                    type="number"
                    className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    disabled={isView}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Vigencia de la línea (Días)</label>
                  <input 
                    type="number"
                    className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    disabled={isView}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">% Interés moratorio</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    disabled={isView}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-40 flex-shrink-0 text-gray-700">Días para Renovación</label>
                  <input 
                    type="number"
                    className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                    disabled={isView}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="bg-primary-theme text-white border-b border-gray-400">
            <div className="flex items-center overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-xs whitespace-nowrap transition-colors border-r border-gray-500/30 ${
                    activeTab === tab.id
                      ? 'bg-secondary-theme text-white font-medium'
                      : 'text-white/90'
                  }`}
                  style={activeTab !== tab.id ? { transition: 'background-color 0.2s' } : {}}
                  onMouseEnter={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.backgroundColor = 'var(--theme-primary-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeTab !== tab.id) {
                      e.currentTarget.style.backgroundColor = '';
                    }
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-4">
            {activeTab === 'default' && (
              <div className="grid grid-cols-3 gap-x-6 gap-y-1">
                {/* Columna 1 */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Nombre <span className="text-black">*</span></label>
                    {isView ? (
                      <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">{formData.name}</div>
                    ) : (
                      <input 
                        type="text" 
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded" 
                        required
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Tipo Producto <span className="text-black">*</span></label>
                    {isView ? (
                      <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">Crédito</div>
                    ) : (
                      <select className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded" required>
                        <option value="">Seleccione...</option>
                        <option value="Crédito">Crédito</option>
                        <option value="Captación">Captación</option>
                      </select>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Sucursales</label>
                    {isView ? (
                      <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">{formData.organization}</div>
                    ) : (
                      <select className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded">
                        <option value="">Seleccione...</option>
                        {organizations.map((org) => (
                          <option key={org.name} value={org.name}>{org.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Línea Producto</label>
                    {isView ? (
                      <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">{formData.lineProduct}</div>
                    ) : (
                      <select 
                        value={formData.lineProduct}
                        onChange={(e) => handleChange('lineProduct', e.target.value)}
                        className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                      >
                        <option value="">Seleccione...</option>
                        {lineProducts.map((line) => (
                          <option key={line.id} value={line.name}>{line.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Monto mínimo</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                      disabled={isView}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Permite Sobregiros</label>
                    <input type="checkbox" className="w-4 h-4" disabled={isView} />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Monto / Porcentaje</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                      disabled={isView}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Intervalo de CleanUp</label>
                    <input 
                      type="number"
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                      disabled={isView}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">% Comisión apertura</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                      disabled={isView}
                    />
                  </div>
                </div>

                {/* Columna 2 */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Clave <span className="text-black">*</span></label>
                    {isView ? (
                      <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">{formData.id}</div>
                    ) : (
                      <input 
                        type="number"
                        value={formData.id}
                        onChange={(e) => handleChange('id', parseInt(e.target.value))}
                        className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded" 
                        required
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Sub Tipo</label>
                    {isView ? (
                      <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">{formData.sublineProduct}</div>
                    ) : (
                      <select 
                        value={formData.sublineProduct}
                        onChange={(e) => handleChange('sublineProduct', e.target.value)}
                        className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                      >
                        <option value="">Seleccione...</option>
                        {availableSublines.map((subline) => (
                          <option key={subline.id} value={subline.name}>{subline.name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Nombre Equipo de Analista</label>
                    {isView ? (
                      <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">Equipo A</div>
                    ) : (
                      <select className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded">
                        <option value="">Seleccione...</option>
                        <option value="Equipo A">Equipo A</option>
                        <option value="Equipo B">Equipo B</option>
                      </select>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Tipo de línea</label>
                    {isView ? (
                      <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">Revolvente</div>
                    ) : (
                      <select className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded">
                        <option value="">Seleccione...</option>
                        <option value="Revolvente">Revolvente</option>
                        <option value="Simple">Simple</option>
                      </select>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Monto máximo</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                      disabled={isView}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Tipo de Sobregiro</label>
                    {isView ? (
                      <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">Porcentaje</div>
                    ) : (
                      <select className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded">
                        <option value="">Seleccione...</option>
                        <option value="Monto">Monto</option>
                        <option value="Porcentaje">Porcentaje</option>
                      </select>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Núm. Disposiciones Abiertas</label>
                    <input 
                      type="number"
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                      disabled={isView}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Verificación de CleanUp</label>
                    <input type="checkbox" className="w-4 h-4" disabled={isView} />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Plazo mínimo disposición</label>
                    <input 
                      type="number"
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                      disabled={isView}
                    />
                  </div>
                </div>

                {/* Columna 3 */}
                <div className="space-y-1">
                  <div className="flex items-start gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700 pt-1">Descripción</label>
                    {isView ? (
                      <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">{formData.description}</div>
                    ) : (
                      <textarea 
                        value={formData.description}
                        onChange={(e) => handleChange('description', e.target.value)}
                        rows={2}
                        className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded resize-none"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Nombre Equipo de Analista de Mesa</label>
                    {isView ? (
                      <div className="flex-1 px-2 py-0.5 text-xs text-gray-700">Mesa 1</div>
                    ) : (
                      <select className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded">
                        <option value="">Seleccione...</option>
                        <option value="Mesa 1">Mesa 1</option>
                        <option value="Mesa 2">Mesa 2</option>
                      </select>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Plazo máximo disposición</label>
                    <input 
                      type="number"
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                      disabled={isView}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Días de gracia disposición</label>
                    <input 
                      type="number"
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                      disabled={isView}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Vigencia de la línea (Días)</label>
                    <input 
                      type="number"
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                      disabled={isView}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">% Interés moratorio</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                      disabled={isView}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs w-40 flex-shrink-0 text-gray-700">Días para Renovación</label>
                    <input 
                      type="number"
                      className="flex-1 px-2 py-0.5 text-xs border border-gray-300 rounded"
                      disabled={isView}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'aplicar-cobranza' && (
              <div className="text-center py-8 text-gray-500">
                <p>Contenido del tab "Aplicar Cobranza" en desarrollo</p>
              </div>
            )}

            {activeTab === 'iva' && (
              <IvaTab mode={mode === 'view' ? 'ver' : mode === 'create' ? 'nuevo' : 'editar'} />
            )}

            {activeTab === 'garantias' && (
              <GarantiaTab mode={mode === 'view' ? 'ver' : mode === 'create' ? 'nuevo' : 'editar'} />
            )}

            {activeTab === 'jerarquia-productos' && (
              <JerarquiaProductosTab mode={mode === 'view' ? 'ver' : mode === 'create' ? 'nuevo' : 'editar'} />
            )}

            {activeTab === 'productos-relacionados' && (
              <div className="text-center py-8 text-gray-500">
                <p>Contenido del tab "Productos relacionados" en desarrollo</p>
              </div>
            )}

            {activeTab === 'comites-credito' && (
              <ComiteCreditoTab mode={mode === 'view' ? 'ver' : mode === 'create' ? 'nuevo' : 'editar'} />
            )}

            {activeTab === 'periodicidad' && (
              <PeriodicidadTab key={`periodicidad-tab-linea`} mode={mode === 'view' ? 'ver' : mode === 'create' ? 'nuevo' : 'editar'} productId={formData.id} />
            )}

            {activeTab === 'fases' && (
              <FasesTab mode={mode === 'view' ? 'ver' : mode === 'create' ? 'nuevo' : 'editar'} />
            )}

            {activeTab === 'matriz-tasas' && (
              <MatrizTasaFijaTab mode={mode === 'view' ? 'ver' : mode === 'create' ? 'nuevo' : 'editar'} />
            )}

            {activeTab === 'exento-iva' && (
              <ExentoIvaTab mode={mode === 'view' ? 'ver' : mode === 'create' ? 'nuevo' : 'editar'} />
            )}

            {activeTab === 'checklist' && (
              <CheckListTab mode={mode === 'view' ? 'ver' : mode === 'create' ? 'nuevo' : 'editar'} />
            )}

            {activeTab === 'condiciones-disposicion' && (
              <div className="text-center py-8 text-gray-500">
                <p>Contenido del tab "Condiciones de disposición" en desarrollo</p>
              </div>
            )}

            {activeTab === 'parametros-calculo' && (
              <div className="text-center py-8 text-gray-500">
                <p>Contenido del tab "Parámetros de Cálculo de Línea" en desarrollo</p>
              </div>
            )}

            {activeTab === 'gastos-comisiones' && (
              <div className="text-center py-8 text-gray-500">
                <p>Contenido del tab "Gastos/Comisiones" en desarrollo</p>
              </div>
            )}

            {activeTab === 'evento-contable' && (
              <div className="text-center py-8 text-gray-500">
                <p>Contenido del tab "Evento Contable" en desarrollo</p>
              </div>
            )}

            {activeTab === 'seguimiento' && (
              <div className="text-center py-8 text-gray-500">
                <p>Contenido del tab "Seguimiento" en desarrollo</p>
              </div>
            )}

            {activeTab === 'catalogo-evento' && (
              <div className="text-center py-8 text-gray-500">
                <p>Contenido del tab "Catálogo Evento Contable" en desarrollo</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}