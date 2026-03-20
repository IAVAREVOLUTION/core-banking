import { ProductoLineaCredito, FormModeLineaCredito } from '@/app/types/productoLineaCredito';
import { useState } from 'react';

interface ProductoLineaCreditoFormDefaultTabProps {
  formData: ProductoLineaCredito;
  mode: FormModeLineaCredito;
  handleChange: (field: keyof ProductoLineaCredito, value: string | number | boolean) => void;
}

export function ProductoLineaCreditoFormDefaultTab({
  formData,
  mode,
  handleChange,
}: ProductoLineaCreditoFormDefaultTabProps) {
  const isView = mode === 'view';
  const isEditable = mode === 'edit' || mode === 'create';

  // ═══════════════════════════════════════════════════════════
  // Estilos institucionales Modo Consulta (solo lectura visual)
  // ═══════════════════════════════════════════════════════════
  const viewFieldClass = 'flex-1 px-2 py-1 text-xs bg-gray-50 border border-transparent rounded text-gray-800 cursor-default';
  // Campos compartidos con Datos Producto: siempre solo lectura en DefaultTab
  const sharedFieldClass = 'flex-1 px-2 py-1 text-xs bg-amber-50 border border-amber-200 rounded text-gray-800 cursor-default';
  const sharedFieldHint = <span className="text-[9px] text-amber-600 ml-1" title="Se edita en la sección Datos Producto">(↑ Datos Producto)</span>;

  const [openSections, setOpenSections] = useState<{ [key: string]: boolean }>({
    caracteristicas: true,
    tasas: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="space-y-6 p-4">
      {/* SECCIÓN 1: CARACTERÍSTICAS DEL PRODUCTO */}
      <div>
        <h3 
          className="text-sm font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300 flex items-center justify-between cursor-pointer hover:bg-gray-50 px-2 py-1 -mx-2"
          onClick={() => toggleSection('caracteristicas')}
        >
          <span>Características del Producto</span>
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 16 16" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            className={`transition-transform duration-200 ${openSections.caracteristicas ? 'rotate-180' : ''}`}
          >
            <path d="M4 6l4 4 4-4"/>
          </svg>
        </h3>
        
        {openSections.caracteristicas && (
          <div className="space-y-3">
            {/* Fila 1: Tipo de producto, Segmento */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Tipo de producto <span className="text-red-600">*</span> {sharedFieldHint}
                </label>
                <div className={isView ? viewFieldClass : sharedFieldClass}>{formData.tipoLinea || '—'}</div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Segmento <span className="text-red-600">*</span> {sharedFieldHint}
                </label>
                <div className={isView ? viewFieldClass : sharedFieldClass}>{formData.subTipo || '—'}</div>
              </div>
            </div>

            {/* Fila 2: Moneda, Monto mínimo */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Moneda <span className="text-red-600">*</span> {sharedFieldHint}
                </label>
                <div className={isView ? viewFieldClass : sharedFieldClass}>{formData.moneda || 'MXN'}</div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Monto mínimo <span className="text-red-600">*</span> {sharedFieldHint}
                </label>
                <div className={isView ? viewFieldClass : sharedFieldClass}>
                  {formData.montoMinimo ? `$${Number(formData.montoMinimo).toLocaleString('es-MX')}` : '—'}
                </div>
              </div>
            </div>

            {/* Fila 3: Monto máximo, Plazo de la línea */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Monto máximo <span className="text-red-600">*</span> {sharedFieldHint}
                </label>
                <div className={isView ? viewFieldClass : sharedFieldClass}>
                  {formData.montoMaximo ? `$${Number(formData.montoMaximo).toLocaleString('es-MX')}` : '—'}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Plazo de la línea <span className="text-red-600">*</span> {sharedFieldHint}
                </label>
                <div className={isView ? viewFieldClass : sharedFieldClass}>
                  {formData.vigenciaLineaDias ? `${formData.vigenciaLineaDias} días` : '—'}
                </div>
              </div>
            </div>

            {/* Fila 4: Forma de disposición, Renovable */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Forma de disposición <span className="text-red-600">*</span>
                </label>
                {isView ? (
                  <div className={viewFieldClass}>{formData.formaDisposicion || 'No definido'}</div>
                ) : (
                  <select 
                    value={formData.formaDisposicion || ''}
                    onChange={(e) => handleChange('formaDisposicion', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Seleccione...</option>
                    <option value="Parcial">Parcial</option>
                    <option value="Total">Total</option>
                  </select>
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Renovable <span className="text-red-600">*</span>
                </label>
                {isView ? (
                  <div className={viewFieldClass}>{formData.renovable ? 'Sí' : 'No'}</div>
                ) : (
                  <select 
                    value={formData.renovable ? 'Si' : 'No'}
                    onChange={(e) => handleChange('renovable', e.target.value === 'Si')}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Seleccione...</option>
                    <option value="Si">Sí</option>
                    <option value="No">No</option>
                  </select>
                )}
              </div>
            </div>

            {/* Fila 5: Frecuencia de revisión, Garantía */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Frecuencia de revisión <span className="text-red-600">*</span>
                </label>
                {isView ? (
                  <div className={viewFieldClass}>{formData.frecuenciaRevision || 'No definido'}</div>
                ) : (
                  <select 
                    value={formData.frecuenciaRevision || ''}
                    onChange={(e) => handleChange('frecuenciaRevision', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Seleccione...</option>
                    <option value="Mensual">Mensual</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Anual">Anual</option>
                  </select>
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Garantía <span className="text-red-600">*</span>
                </label>
                {isView ? (
                  <div className={viewFieldClass}>{formData.tipoGarantia || 'No definido'}</div>
                ) : (
                  <select 
                    value={formData.tipoGarantia || ''}
                    onChange={(e) => handleChange('tipoGarantia', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Seleccione...</option>
                    <option value="Quirografaria">Quirografaria</option>
                    <option value="Prendaria">Prendaria</option>
                    <option value="Hipotecaria">Hipotecaria</option>
                  </select>
                )}
              </div>
            </div>

            {/* Fila 6: Destino */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Destino <span className="text-red-600">*</span>
                </label>
                {isView ? (
                  <div className={viewFieldClass}>{formData.destino || 'No definido'}</div>
                ) : (
                  <select 
                    value={formData.destino || ''}
                    onChange={(e) => handleChange('destino', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Seleccione...</option>
                    <option value="Capital de trabajo">Capital de trabajo</option>
                    <option value="Libre">Libre</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECCIÓN 2: TASAS Y COMISIONES */}
      <div>
        <h3 
          className="text-sm font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-300 flex items-center justify-between cursor-pointer hover:bg-gray-50 px-2 py-1 -mx-2"
          onClick={() => toggleSection('tasas')}
        >
          <span>Tasas y Comisiones</span>
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 16 16" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            className={`transition-transform duration-200 ${openSections.tasas ? 'rotate-180' : ''}`}
          >
            <path d="M4 6l4 4 4-4"/>
          </svg>
        </h3>
        
        {openSections.tasas && (
          <div className="space-y-3">
            {/* Fila 1: Tipo de tasa, Base de cálculo */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Tipo de tasa <span className="text-red-600">*</span>
                </label>
                {isView ? (
                  <div className={viewFieldClass}>{formData.tipoTasa || 'No definido'}</div>
                ) : (
                  <select 
                    value={formData.tipoTasa || ''}
                    onChange={(e) => handleChange('tipoTasa', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Seleccione...</option>
                    <option value="Fija">Fija</option>
                    <option value="Variable">Variable</option>
                  </select>
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Base de cálculo <span className="text-red-600">*</span>
                </label>
                {isView ? (
                  <div className={viewFieldClass}>{formData.baseCalculo || 'No definido'}</div>
                ) : (
                  <select 
                    value={formData.baseCalculo || ''}
                    onChange={(e) => handleChange('baseCalculo', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Seleccione...</option>
                    <option value="360">360</option>
                    <option value="365">365</option>
                  </select>
                )}
              </div>
            </div>

            {/* Fila 2: Tasa ordinaria, Spread */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Tasa ordinaria (% anual) <span className="text-red-600">*</span>
                </label>
                {isView ? (
                  <div className={viewFieldClass}>{formData.tasaOrdinaria}%</div>
                ) : (
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.tasaOrdinaria || ''}
                    onChange={(e) => handleChange('tasaOrdinaria', e.target.value)}
                    placeholder="Ej. 12.5"
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                  />
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Spread (+ puntos) <span className="text-red-600">*</span>
                </label>
                {isView ? (
                  <div className={viewFieldClass}>+{formData.spread} puntos</div>
                ) : (
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.spread || ''}
                    onChange={(e) => handleChange('spread', e.target.value)}
                    placeholder="Ej. 2.5"
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                  />
                )}
              </div>
            </div>

            {/* Fila 3: Tasa moratoria, Comisiones */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Tasa moratoria (factor) <span className="text-red-600">*</span>
                </label>
                {isView ? (
                  <div className={viewFieldClass}>
                    Ordinaria × {formData.factorMoratorio || 1}
                  </div>
                ) : (
                  <input 
                    type="number" 
                    step="0.1"
                    value={formData.factorMoratorio || ''}
                    onChange={(e) => handleChange('factorMoratorio', e.target.value)}
                    placeholder="Ej. 1.5"
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                  />
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Comisiones <span className="text-red-600">*</span>
                </label>
                {isView ? (
                  <div className={viewFieldClass}>{formData.comisiones || 'No definido'}</div>
                ) : (
                  <input 
                    type="text" 
                    value={formData.comisiones || ''}
                    onChange={(e) => handleChange('comisiones', e.target.value)}
                    placeholder="Ej. Apertura, anualidad, disposición"
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                  />
                )}
              </div>
            </div>

            {/* Fila 4: IVA, Forma de devengo */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  IVA (%) <span className="text-red-600">*</span>
                </label>
                {isView ? (
                  <div className={viewFieldClass}>{formData.iva}%</div>
                ) : (
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.iva || ''}
                    onChange={(e) => handleChange('iva', e.target.value)}
                    placeholder="Ej. 16"
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                  />
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Forma de devengo <span className="text-red-600">*</span>
                </label>
                {isView ? (
                  <div className={viewFieldClass}>{formData.formaDevengo || 'Saldo dispuesto'}</div>
                ) : (
                  <input 
                    type="text" 
                    value={formData.formaDevengo || 'Saldo dispuesto'}
                    onChange={(e) => handleChange('formaDevengo', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                  />
                )}
              </div>
            </div>

            {/* Fila 5: Método de interés, Periodicidad de intereses */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Método de interés <span className="text-red-600">*</span>
                </label>
                {isView ? (
                  <div className={viewFieldClass}>{formData.metodoInteres || 'Saldo insoluto'}</div>
                ) : (
                  <input 
                    type="text" 
                    value={formData.metodoInteres || 'Saldo insoluto'}
                    onChange={(e) => handleChange('metodoInteres', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500" 
                  />
                )}
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs text-gray-700 w-48 flex-shrink-0">
                  Periodicidad de intereses <span className="text-red-600">*</span>
                </label>
                {isView ? (
                  <div className={viewFieldClass}>{formData.periodicidadIntereses || 'Mensual'}</div>
                ) : (
                  <select 
                    value={formData.periodicidadIntereses || 'Mensual'}
                    onChange={(e) => handleChange('periodicidadIntereses', e.target.value)}
                    className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Mensual">Mensual</option>
                    <option value="Trimestral">Trimestral</option>
                    <option value="Semestral">Semestral</option>
                    <option value="Anual">Anual</option>
                  </select>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}