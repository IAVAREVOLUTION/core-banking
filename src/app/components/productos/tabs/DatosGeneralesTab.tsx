import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Checkbox } from '../../ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Product } from '../../../types/product';

interface DatosGeneralesTabProps {
  formData: Partial<Product>;
  updateFormData: (field: string, value: any) => void;
  isView: boolean;
}

export function DatosGeneralesTab({ formData, updateFormData, isView }: DatosGeneralesTabProps) {
  return (
    <div className="space-y-1.5">
      {/* Información Básica */}
      <div>
        <h3 className="text-xs font-semibold text-[#3C3C3C] mb-1 pb-0.5 border-b border-[#E0E0E0]">
          Información Básica
        </h3>
        <div className="grid grid-cols-4 gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="id" className="text-xs text-[#3C3C3C] w-20 flex-shrink-0">
              ID Producto
            </Label>
            <Input
              id="id"
              value={formData.id || ''}
              disabled
              className="bg-[#F5F5F7] border-[#E0E0E0] h-6 text-xs flex-1 px-2 py-0"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="fechaRegistro" className="text-xs text-[#3C3C3C] w-24 flex-shrink-0">
              Fecha <span className="text-[#C62828]">*</span>
            </Label>
            <Input
              id="fechaRegistro"
              type="date"
              value={formData.fechaRegistro?.split('T')[0] || ''}
              onChange={(e) => updateFormData('fechaRegistro', e.target.value)}
              disabled={isView}
              className="border-[#E0E0E0] focus:border-[#2E5C91] h-6 text-xs flex-1 px-2 py-0"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="nombre" className="text-xs text-[#3C3C3C] w-16 flex-shrink-0">
              Nombre <span className="text-[#C62828]">*</span>
            </Label>
            <Input
              id="nombre"
              value={formData.nombre || ''}
              onChange={(e) => updateFormData('nombre', e.target.value)}
              disabled={isView}
              className="border-[#E0E0E0] focus:border-[#2E5C91] h-6 text-xs flex-1 px-2 py-0"
              placeholder="Nombre del producto"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="descripcion" className="text-xs text-[#3C3C3C] w-20 flex-shrink-0">
              Descripción <span className="text-[#C62828]">*</span>
            </Label>
            <Input
              id="descripcion"
              value={formData.descripcion || ''}
              onChange={(e) => updateFormData('descripcion', e.target.value)}
              disabled={isView}
              className="border-[#E0E0E0] focus:border-[#2E5C91] h-6 text-xs flex-1 px-2 py-0"
              placeholder="Descripción"
            />
          </div>
        </div>
      </div>

      {/* Clasificación */}
      <div>
        <h3 className="text-xs font-semibold text-[#3C3C3C] mb-1 pb-0.5 border-b border-[#E0E0E0]">
          Clasificación
        </h3>
        <div className="grid grid-cols-5 gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="lineaProducto" className="text-xs text-[#3C3C3C] w-16 flex-shrink-0">
              Línea <span className="text-[#C62828]">*</span>
            </Label>
            <Select
              value={formData.lineaProducto}
              onValueChange={(value) => updateFormData('lineaProducto', value)}
              disabled={isView}
            >
              <SelectTrigger className="border-[#E0E0E0] focus:border-[#2E5C91] h-6 text-xs flex-1">
                <SelectValue placeholder="Seleccione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Captación">Captación</SelectItem>
                <SelectItem value="Colocación">Colocación</SelectItem>
                <SelectItem value="Servicios">Servicios</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="sublineaProducto" className="text-xs text-[#3C3C3C] w-16 flex-shrink-0">
              Sublínea <span className="text-[#C62828]">*</span>
            </Label>
            <Select
              value={formData.sublineaProducto}
              onValueChange={(value) => updateFormData('sublineaProducto', value)}
              disabled={isView || !formData.lineaProducto}
            >
              <SelectTrigger className="border-[#E0E0E0] focus:border-[#2E5C91] h-6 text-xs flex-1">
                <SelectValue placeholder="Seleccione..." />
              </SelectTrigger>
              <SelectContent>
                {formData.lineaProducto === 'Captación' && (
                  <>
                    <SelectItem value="Ahorro">Ahorro</SelectItem>
                    <SelectItem value="Inversión">Inversión</SelectItem>
                    <SelectItem value="Plazo Fijo">Plazo Fijo</SelectItem>
                  </>
                )}
                {formData.lineaProducto === 'Colocación' && (
                  <>
                    <SelectItem value="Crédito Hipotecario">Crédito Hipotecario</SelectItem>
                    <SelectItem value="Crédito Automotriz">Crédito Automotriz</SelectItem>
                    <SelectItem value="Crédito Personal">Crédito Personal</SelectItem>
                    <SelectItem value="Crédito Empresarial">Crédito Empresarial</SelectItem>
                  </>
                )}
                {formData.lineaProducto === 'Servicios' && (
                  <>
                    <SelectItem value="Tarjeta de Débito">Tarjeta de Débito</SelectItem>
                    <SelectItem value="Tarjeta de Crédito">Tarjeta de Crédito</SelectItem>
                    <SelectItem value="Banca en Línea">Banca en Línea</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="moneda" className="text-xs text-[#3C3C3C] w-16 flex-shrink-0">
              Moneda <span className="text-[#C62828]">*</span>
            </Label>
            <Select
              value={formData.moneda}
              onValueChange={(value) => updateFormData('moneda', value)}
              disabled={isView}
            >
              <SelectTrigger className="border-[#E0E0E0] focus:border-[#2E5C91] h-6 text-xs flex-1">
                <SelectValue placeholder="Seleccione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MXN">MXN</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="estatus" className="text-xs text-[#3C3C3C] w-16 flex-shrink-0">
              Estatus <span className="text-[#C62828]">*</span>
            </Label>
            <Select
              value={formData.estatus}
              onValueChange={(value) => updateFormData('estatus', value)}
              disabled={isView}
            >
              <SelectTrigger className="border-[#E0E0E0] focus:border-[#2E5C91] h-6 text-xs flex-1">
                <SelectValue placeholder="Seleccione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Activo">Activo</SelectItem>
                <SelectItem value="Inactivo">Inactivo</SelectItem>
                <SelectItem value="Pendiente">Pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="sucursal" className="text-xs text-[#3C3C3C] w-16 flex-shrink-0">
              Sucursal
            </Label>
            <Input
              id="sucursal"
              value={formData.sucursal || ''}
              disabled
              className="bg-[#F5F5F7] border-[#E0E0E0] h-6 text-xs flex-1 px-2 py-0"
            />
          </div>
        </div>
      </div>

      {/* Configuración de Tasas */}
      <div>
        <h3 className="text-xs font-semibold text-[#3C3C3C] mb-1 pb-0.5 border-b border-[#E0E0E0]">
          Configuración de Tasas
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="tipoTasa" className="text-xs text-[#3C3C3C] w-28 flex-shrink-0">
              Tipo de Tasa
            </Label>
            <Select
              value={formData.tipoTasa}
              onValueChange={(value) => updateFormData('tipoTasa', value)}
              disabled={isView}
            >
              <SelectTrigger className="border-[#E0E0E0] focus:border-[#2E5C91] h-6 text-xs flex-1">
                <SelectValue placeholder="Seleccione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Fija">Fija</SelectItem>
                <SelectItem value="Variable">Variable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="baseCalculo" className="text-xs text-[#3C3C3C] w-28 flex-shrink-0">
              Base Cálculo <span className="text-[#C62828]">*</span>
            </Label>
            <Select
              value={formData.baseCalculo}
              onValueChange={(value) => updateFormData('baseCalculo', value)}
              disabled={isView}
            >
              <SelectTrigger className="border-[#E0E0E0] focus:border-[#2E5C91] h-6 text-xs flex-1">
                <SelectValue placeholder="Seleccione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="360">360 días</SelectItem>
                <SelectItem value="180">180 días</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="cat" className="text-xs text-[#3C3C3C] w-28 flex-shrink-0">
              CAT (%)
            </Label>
            <Input
              id="cat"
              type="number"
              step="0.01"
              value={formData.cat || ''}
              onChange={(e) => updateFormData('cat', parseFloat(e.target.value) || 0)}
              disabled={isView}
              className="border-[#E0E0E0] focus:border-[#2E5C91] h-6 text-xs flex-1 px-2 py-0"
              placeholder="0.00"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="saldoMinimoPromedio" className="text-xs text-[#3C3C3C] w-28 flex-shrink-0">
              Saldo Mínimo
            </Label>
            <Input
              id="saldoMinimoPromedio"
              type="number"
              step="0.01"
              value={formData.saldoMinimoPromedio || ''}
              onChange={(e) => updateFormData('saldoMinimoPromedio', parseFloat(e.target.value) || 0)}
              disabled={isView}
              className="border-[#E0E0E0] focus:border-[#2E5C91] h-6 text-xs flex-1 px-2 py-0"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Interés Moratorio */}
      <div>
        <h3 className="text-xs font-semibold text-[#3C3C3C] mb-1 pb-0.5 border-b border-[#E0E0E0]">
          Interés Moratorio
        </h3>
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="aplicaInteresMoratorio"
              checked={formData.aplicaInteresMoratorio || false}
              onCheckedChange={(checked) => updateFormData('aplicaInteresMoratorio', checked)}
              disabled={isView}
              className="h-3.5 w-3.5"
            />
            <Label
              htmlFor="aplicaInteresMoratorio"
              className="text-xs text-[#3C3C3C] cursor-pointer"
            >
              Aplica Interés Moratorio
            </Label>
          </div>

          {formData.aplicaInteresMoratorio && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 pl-5">
              <div className="flex items-center gap-2">
                <Label htmlFor="numeroVecesMoratorio" className="text-xs text-[#3C3C3C] w-32 flex-shrink-0">
                  Núm. Veces
                </Label>
                <Input
                  id="numeroVecesMoratorio"
                  type="number"
                  value={formData.numeroVecesMoratorio || ''}
                  onChange={(e) => updateFormData('numeroVecesMoratorio', parseInt(e.target.value) || 0)}
                  disabled={isView}
                  className="border-[#E0E0E0] focus:border-[#2E5C91] h-6 text-xs flex-1 px-2 py-0"
                  placeholder="2"
                />
              </div>

              <div className="flex items-center gap-2">
                <Label htmlFor="aplicaMoraAPartir" className="text-xs text-[#3C3C3C] w-32 flex-shrink-0">
                  Mora a partir (días)
                </Label>
                <Input
                  id="aplicaMoraAPartir"
                  type="number"
                  value={formData.aplicaMoraAPartir || ''}
                  onChange={(e) => updateFormData('aplicaMoraAPartir', parseInt(e.target.value) || 0)}
                  disabled={isView}
                  className="border-[#E0E0E0] focus:border-[#2E5C91] h-6 text-xs flex-1 px-2 py-0"
                  placeholder="3"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Información del Sistema */}
      <div>
        <h3 className="text-xs font-semibold text-[#3C3C3C] mb-1 pb-0.5 border-b border-[#E0E0E0]">
          Información del Sistema
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="usuarioRegistro" className="text-xs text-[#3C3C3C] w-28 flex-shrink-0">
              Usuario
            </Label>
            <Input
              id="usuarioRegistro"
              value={formData.usuarioRegistro || ''}
              disabled
              className="bg-[#F5F5F7] border-[#E0E0E0] h-6 text-xs flex-1 px-2 py-0"
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="puestoTrabajo" className="text-xs text-[#3C3C3C] w-28 flex-shrink-0">
              Puesto
            </Label>
            <Input
              id="puestoTrabajo"
              value={formData.puestoTrabajo || ''}
              disabled
              className="bg-[#F5F5F7] border-[#E0E0E0] h-6 text-xs flex-1 px-2 py-0"
            />
          </div>
        </div>
      </div>
    </div>
  );
}