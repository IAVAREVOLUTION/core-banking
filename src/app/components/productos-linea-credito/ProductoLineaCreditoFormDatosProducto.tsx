import { ProductoLineaCredito, FormModeLineaCredito } from '@/app/types/productoLineaCredito';

interface ProductoLineaCreditoFormDatosProductoProps {
  formData: ProductoLineaCredito;
  mode: FormModeLineaCredito;
  handleChange: (field: keyof ProductoLineaCredito, value: string | number | boolean) => void;
}

export function ProductoLineaCreditoFormDatosProducto({
  formData,
  mode,
  handleChange,
}: ProductoLineaCreditoFormDatosProductoProps) {
  const isView = mode === 'view';

  const viewFieldClass = 'w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-transparent rounded text-gray-800 cursor-default';
  const inputClass = 'w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:border-[#4A6FA5] focus:ring-1 focus:ring-[#4A6FA5]/20 outline-none transition-colors';
  const labelClass = 'block text-[11px] font-medium text-gray-600 mb-1';
  const requiredStar = <span className="text-red-500 ml-0.5">*</span>;

  return (
    <div className="space-y-5">
      {/* ═══ Sección 1: Identificación del Producto ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4A6FA5]" />
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Identificación del Producto</span>
        </div>
        <div className="grid grid-cols-4 gap-x-4 gap-y-3">
          {/* Clave */}
          <div>
            <label className={labelClass}>Clave {requiredStar}</label>
            <div className="w-full px-2.5 py-1.5 text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded font-mono">
              {formData.clave || '(Autogenerada)'}
            </div>
          </div>

          {/* Nombre */}
          <div>
            <label className={labelClass}>Nombre {requiredStar}</label>
            {isView ? (
              <div className={viewFieldClass}>{formData.nombre}</div>
            ) : (
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => handleChange('nombre', e.target.value)}
                className={inputClass}
                placeholder="Nombre del producto"
              />
            )}
          </div>

          {/* Línea de Producto */}
          <div>
            <label className={labelClass}>Línea de Producto {requiredStar}</label>
            <div className="w-full px-2.5 py-1.5 text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded">
              Línea de Crédito
            </div>
          </div>

          {/* Tipo Línea */}
          <div>
            <label className={labelClass}>Tipo Línea {requiredStar}</label>
            {isView ? (
              <div className={viewFieldClass}>{formData.tipoLinea}</div>
            ) : (
              <select
                value={formData.tipoLinea}
                onChange={(e) => handleChange('tipoLinea', e.target.value)}
                className={inputClass}
              >
                <option value="">Seleccione...</option>
                <option value="Fija">Fija</option>
                <option value="Revolvente">Revolvente</option>
              </select>
            )}
          </div>
        </div>

        {/* Segunda fila de identificación */}
        <div className="grid grid-cols-4 gap-x-4 gap-y-3 mt-3">
          {/* Tipo (SubTipo) */}
          <div>
            <label className={labelClass}>Tipo {requiredStar}</label>
            {isView ? (
              <div className={viewFieldClass}>{formData.subTipo}</div>
            ) : (
              <select
                value={formData.subTipo}
                onChange={(e) => handleChange('subTipo', e.target.value)}
                className={inputClass}
              >
                <option value="">Seleccione...</option>
                <option value="Cuenta Corriente">Cuenta Corriente</option>
                <option value="Quirografario">Quirografario</option>
                <option value="Simple">Simple</option>
                <option value="Arrendamiento">Arrendamiento</option>
              </select>
            )}
          </div>

          {/* Sucursales */}
          <div>
            <label className={labelClass}>Sucursales {requiredStar}</label>
            {isView ? (
              <div className={viewFieldClass}>{formData.sucursal}</div>
            ) : (
              <select
                value={formData.sucursal}
                onChange={(e) => handleChange('sucursal', e.target.value)}
                className={inputClass}
              >
                <option value="">Seleccione...</option>
                <option value="Ciudad de México">Ciudad de México</option>
                <option value="Guadalajara">Guadalajara</option>
                <option value="Monterrey">Monterrey</option>
                <option value="Toluca">Toluca</option>
                <option value="Querétaro">Querétaro</option>
              </select>
            )}
          </div>

          {/* Tasa Base */}
          <div>
            <label className={labelClass}>Tasa Base</label>
            {isView ? (
              <div className={viewFieldClass}>{formData.tasaBase || '—'}</div>
            ) : (
              <select
                value={formData.tasaBase || ''}
                onChange={(e) => handleChange('tasaBase', e.target.value)}
                className={inputClass}
              >
                <option value="">Seleccione...</option>
                <option value="TIIE 28">TIIE 28</option>
                <option value="TIIE 91">TIIE 91</option>
                <option value="TIIE 182">TIIE 182</option>
                <option value="SOFR">SOFR</option>
                <option value="Fija">Fija</option>
              </select>
            )}
          </div>

          {/* Descripción */}
          <div>
            <label className={labelClass}>Descripción</label>
            {isView ? (
              <div className={viewFieldClass}>{formData.descripcion}</div>
            ) : (
              <textarea
                value={formData.descripcion}
                onChange={(e) => handleChange('descripcion', e.target.value)}
                className={`${inputClass} resize-none`}
                rows={1}
                placeholder="Descripción breve del producto"
              />
            )}
          </div>
        </div>
      </div>

      {/* ═══ Sección 2: Vigencia y Plazos ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4A6FA5]" />
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Vigencia y Plazos</span>
        </div>
        <div className="grid grid-cols-4 gap-x-4 gap-y-3">
          {/* Vigencia de la línea (Días) */}
          <div>
            <label className={labelClass}>Vigencia de la línea (Días) {requiredStar}</label>
            {isView ? (
              <div className={viewFieldClass}>{formData.vigenciaLineaDias}</div>
            ) : (
              <input
                type="number"
                value={formData.vigenciaLineaDias}
                onChange={(e) => handleChange('vigenciaLineaDias', e.target.value)}
                className={inputClass}
                placeholder="Ej: 360"
              />
            )}
          </div>

          {/* Días para Renovación */}
          <div>
            <label className={labelClass}>Días para Renovación</label>
            {isView ? (
              <div className={viewFieldClass}>{formData.diasParaRenovacion}</div>
            ) : (
              <input
                type="number"
                value={formData.diasParaRenovacion}
                onChange={(e) => handleChange('diasParaRenovacion', e.target.value)}
                className={inputClass}
                placeholder="Ej: 30"
              />
            )}
          </div>

          {/* Núm. Disposiciones Abiertas */}
          <div>
            <label className={labelClass}>Núm. Disposiciones Abiertas {requiredStar}</label>
            {isView ? (
              <div className={viewFieldClass}>{formData.numDisposicionesAbiertas}</div>
            ) : (
              <input
                type="number"
                value={formData.numDisposicionesAbiertas}
                onChange={(e) => handleChange('numDisposicionesAbiertas', e.target.value)}
                className={inputClass}
                placeholder="Ej: 5"
              />
            )}
          </div>

          {/* Intervalo de CleanUp */}
          <div>
            <label className={labelClass}>Intervalo de CleanUp</label>
            {isView ? (
              <div className={viewFieldClass}>{formData.intervaloCleanUp}</div>
            ) : (
              <input
                type="number"
                value={formData.intervaloCleanUp}
                onChange={(e) => handleChange('intervaloCleanUp', e.target.value)}
                className={inputClass}
                placeholder="Días"
              />
            )}
          </div>
        </div>
      </div>

      {/* ═══ Sección 3: Sobregiros ═══ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4A6FA5]" />
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Sobregiros y Control</span>
        </div>
        <div className="grid grid-cols-4 gap-x-4 gap-y-3">
          {/* Permite Sobregiros */}
          <div>
            <label className={labelClass}>Permite Sobregiros</label>
            {isView ? (
              <div className={viewFieldClass}>{formData.permiteSobregiros ? 'Sí' : 'No'}</div>
            ) : (
              <div className="flex items-center gap-2 h-[30px]">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.permiteSobregiros}
                    onChange={(e) => handleChange('permiteSobregiros', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-[18px] bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-[14px] after:w-[14px] after:transition-all peer-checked:bg-[#4A6FA5]"></div>
                </label>
                <span className="text-xs text-gray-600">{formData.permiteSobregiros ? 'Sí' : 'No'}</span>
              </div>
            )}
          </div>

          {/* Tipo de Sobregiro */}
          <div>
            <label className={labelClass}>
              Tipo de Sobregiro {formData.permiteSobregiros && requiredStar}
            </label>
            {isView ? (
              <div className={viewFieldClass}>{formData.tipoSobregiro}</div>
            ) : (
              <select
                value={formData.tipoSobregiro}
                onChange={(e) => handleChange('tipoSobregiro', e.target.value)}
                disabled={!formData.permiteSobregiros}
                className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-400`}
              >
                <option value="">Seleccione...</option>
                <option value="Monto">Monto</option>
                <option value="Porcentaje">Porcentaje</option>
              </select>
            )}
          </div>

          {/* Monto / Porcentaje */}
          <div>
            <label className={labelClass}>
              {formData.tipoSobregiro === 'Porcentaje' ? 'Porcentaje (%)' : 'Monto'} {formData.permiteSobregiros && requiredStar}
            </label>
            {isView ? (
              <div className={viewFieldClass}>
                {formData.montoOPorcentaje}{formData.tipoSobregiro === 'Porcentaje' ? '%' : ''}
              </div>
            ) : (
              <input
                type="number"
                step="0.01"
                value={formData.montoOPorcentaje}
                onChange={(e) => handleChange('montoOPorcentaje', e.target.value)}
                disabled={!formData.permiteSobregiros}
                className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-400`}
                placeholder={formData.tipoSobregiro === 'Porcentaje' ? 'Ej: 10.5' : 'Ej: 50000'}
              />
            )}
          </div>

          {/* Verificación de CleanUp */}
          <div>
            <label className={labelClass}>Verificación de CleanUp</label>
            {isView ? (
              <div className={viewFieldClass}>{formData.verificacionCleanUp ? 'Sí' : 'No'}</div>
            ) : (
              <div className="flex items-center gap-2 h-[30px]">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.verificacionCleanUp}
                    onChange={(e) => handleChange('verificacionCleanUp', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-[18px] bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-[14px] after:w-[14px] after:transition-all peer-checked:bg-[#4A6FA5]"></div>
                </label>
                <span className="text-xs text-gray-600">{formData.verificacionCleanUp ? 'Sí' : 'No'}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
