import { Product, FormMode } from '../../types/product';
import { organizations } from '../../data/mockData';

interface ProductoFormDefaultTabProps {
  formData: Product;
  mode: FormMode;
  handleChange: (field: keyof Product, value: string | number | boolean) => void;
  showDescuentoNomina?: boolean;
}

// ── Estilos reutilizables ──
const inputBase = 'w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/40 focus:border-[#4A6FA5] transition-colors';
const inputDisabled = 'w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded bg-gray-50 text-gray-500 cursor-not-allowed';
const selectBase = 'w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#4A6FA5]/40 focus:border-[#4A6FA5] transition-colors';
const viewText = 'w-full px-2.5 py-1.5 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded';

const Lbl = ({ children, req }: { children: string; req?: boolean }) => (
  <label className="block text-[11px] font-medium text-gray-600 mb-1 uppercase tracking-wide">
    {children}{req && <span className="text-red-500 ml-0.5">*</span>}
  </label>
);

export function ProductoFormDefaultTab({ formData, mode, handleChange, showDescuentoNomina = false }: ProductoFormDefaultTabProps) {
  const isView = mode === 'view';
  const isCredito = formData.lineaProducto === 'Credito' || formData.lineaProducto === 'Crédito';
  const isSeguros = (formData.lineaProducto || '').toLowerCase().includes('seguro');

  const generarClave = () => {
    const numero = formData.id ? String(formData.id).padStart(3, '0') : '005';
    return `PR-${numero}`;
  };

  if (!isCredito && !isSeguros) {
    // Para productos de Captación
    return (
      <div className="grid grid-cols-3 gap-x-5 gap-y-4">
        <div>
          <Lbl req>Nombre</Lbl>
          {isView ? (
            <div className={viewText}>{formData.nombre}</div>
          ) : (
            <input type="text" value={formData.nombre} onChange={(e) => handleChange('nombre', e.target.value)} className={inputBase} />
          )}
        </div>
        <div>
          <Lbl>Descripción</Lbl>
          {isView ? (
            <div className={viewText}>{formData.descripcion}</div>
          ) : (
            <textarea value={formData.descripcion} onChange={(e) => handleChange('descripcion', e.target.value)} className={`${inputBase} resize-none`} rows={1} />
          )}
        </div>
        <div>
          <Lbl req>Sucursales</Lbl>
          {isView ? (
            <div className={viewText}>{formData.sucursal}</div>
          ) : (
            <select value={formData.sucursal} onChange={(e) => handleChange('sucursal', e.target.value)} className={selectBase}>
              {organizations.map((org) => (
                <option key={org.id} value={org.name}>{org.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  }

  // ── Productos de Crédito / Seguros ──
  return (
    <div className="space-y-4">
      {/* Fila 1: Clave, Nombre, Línea de Producto */}
      <div className="grid grid-cols-3 gap-x-5">
        <div>
          <Lbl>Clave</Lbl>
          <input type="text" value={generarClave()} disabled className={inputDisabled} />
        </div>
        <div>
          <Lbl req>Nombre</Lbl>
          {isView ? (
            <div className={viewText}>{formData.nombre}</div>
          ) : (
            <input type="text" value={formData.nombre} onChange={(e) => handleChange('nombre', e.target.value)} className={inputBase} />
          )}
        </div>
        <div>
          <Lbl req>Línea de Producto</Lbl>
          <input type="text" value={formData.lineaProducto || (isSeguros ? 'Seguros' : 'Credito')} disabled className={inputDisabled} />
        </div>
      </div>

      {/* Fila 2: Sublínea, Descripción, Fecha de Registro */}
      <div className="grid grid-cols-3 gap-x-5">
        <div>
          <Lbl req>Sublínea</Lbl>
          {isView ? (
            <div className={viewText}>{formData.sublineaProducto}</div>
          ) : (
            <select value={formData.sublineaProducto || ''} onChange={(e) => handleChange('sublineaProducto', e.target.value)} className={selectBase}>
              <option value="">Seleccionar...</option>
              {(() => {
                const opcionesSeguros = [
                  'Seguro Vida', 'Seguro Daños', 'Seguro Desempleo',
                  'Seguro Automotriz', 'Seguro Hipotecario', 'Seguro Colectivo',
                ];
                const opcionesCredito = [
                  'Crédito Empleado', 'Créditos Personales', 'Préstamos para viviendas',
                  'Préstamos para vehículos', 'Créditos empresariales',
                ];
                const opciones = isSeguros ? opcionesSeguros : opcionesCredito;
                const currentVal = formData.sublineaProducto || '';
                // Si el valor actual de la BD no está en las opciones predefinidas, agregarlo al inicio
                const showCurrent = currentVal && !opciones.includes(currentVal);
                return (
                  <>
                    {showCurrent && (
                      <option value={currentVal}>{currentVal}</option>
                    )}
                    {opciones.map(op => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </>
                );
              })()}
            </select>
          )}
        </div>
        <div>
          <Lbl>Descripción</Lbl>
          {isView ? (
            <div className={viewText}>{formData.descripcion}</div>
          ) : (
            <textarea value={formData.descripcion || ''} onChange={(e) => handleChange('descripcion', e.target.value)} className={`${inputBase} resize-none`} rows={1} />
          )}
        </div>
        <div>
          <Lbl req>Fecha de Registro</Lbl>
          <input type="date" value={formData.fechaRegistro ? new Date(formData.fechaRegistro).toISOString().split('T')[0] : ''} disabled className={inputDisabled} />
        </div>
      </div>

      {/* Fila 3: Moneda, CAT, Base Cálculo */}
      <div className="grid grid-cols-3 gap-x-5">
        <div>
          <Lbl req>Moneda</Lbl>
          {isView ? (
            <div className={viewText}>{formData.moneda}</div>
          ) : (
            <select value={formData.moneda || ''} onChange={(e) => handleChange('moneda', e.target.value)} className={selectBase}>
              <option value="">Seleccionar...</option>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="CAD">CAD</option>
              <option value="GBP">GBP</option>
              <option value="CAT">CAT</option>
            </select>
          )}
        </div>
        <div>
          <Lbl>CAT</Lbl>
          {isView ? (
            <div className={viewText}>
              {formData.cat !== undefined && formData.cat !== null ? formData.cat : ''}
            </div>
          ) : (
            <input type="number" value={formData.cat || ''} onChange={(e) => handleChange('cat', parseFloat(e.target.value) || 0)} className={inputBase} step="0.01" />
          )}
        </div>
        <div>
          <Lbl req>Base Cálculo</Lbl>
          {isView ? (
            <div className={viewText}>{formData.baseCalculo}</div>
          ) : (
            <select value={formData.baseCalculo || ''} onChange={(e) => handleChange('baseCalculo', e.target.value)} className={selectBase}>
              <option value="">Seleccionar...</option>
              <option value="360">360</option>
              <option value="180">180</option>
            </select>
          )}
        </div>
      </div>

      {/* Fila 4: Estatus, Tipo Tasa, Sucursal */}
      <div className="grid grid-cols-3 gap-x-5">
        <div>
          <Lbl req>Estatus</Lbl>
          {isView ? (
            <div className={viewText}>{formData.estatus}</div>
          ) : (
            <select value={formData.estatus || ''} onChange={(e) => handleChange('estatus', e.target.value)} className={selectBase}>
              <option value="">Seleccionar...</option>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
              <option value="Pendiente">Pendiente</option>
            </select>
          )}
        </div>
        <div>
          <Lbl req>{isSeguros ? 'Tipo Cobertura' : 'Tipo Tasa'}</Lbl>
          {isView ? (
            <div className={viewText}>{formData.tipoTasa}</div>
          ) : (
            <select value={formData.tipoTasa || ''} onChange={(e) => handleChange('tipoTasa', e.target.value)} className={selectBase}>
              <option value="">Seleccionar...</option>
              {isSeguros ? (
                <>
                  <option value="Limitada">Limitada</option>
                  <option value="Total">Total</option>
                </>
              ) : (
                <>
                  <option value="Fija">Fija</option>
                  <option value="Variable">Variable</option>
                </>
              )}
            </select>
          )}
        </div>
        <div>
          <Lbl req>Sucursal</Lbl>
          {isView ? (
            <div className={viewText}>{formData.sucursal}</div>
          ) : (
            <select value={formData.sucursal || ''} onChange={(e) => handleChange('sucursal', e.target.value)} className={selectBase}>
              <option value="">Seleccionar...</option>
              <option value="Ciudad de México">Ciudad de México</option>
              <option value="Guadalajara">Guadalajara</option>
              <option value="Monterrey">Monterrey</option>
              <option value="Toluca">Toluca</option>
              <option value="Querétaro">Querétaro</option>
            </select>
          )}
        </div>
      </div>

      {/* Fila 5: Descuento en Nómina */}
      {showDescuentoNomina && (
        <div className="grid grid-cols-3 gap-x-5 pt-1">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="descuentoNomina"
              checked={formData.descuentoNomina || false}
              onChange={isView ? undefined : (e) => handleChange('descuentoNomina', e.target.checked)}
              disabled={isView}
              className={`w-4 h-4 rounded border-gray-300 text-[#4A6FA5] focus:ring-[#4A6FA5]/40 ${isView ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            />
            <label htmlFor="descuentoNomina" className={`text-xs text-gray-700 ${isView ? '' : 'cursor-pointer'}`}>
              Descuento en Nómina
            </label>
          </div>
        </div>
      )}
    </div>
  );
}