import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { Cliente } from '../../../data/mockClientesData';

interface ClasificacionRiesgoTabProps {
  formData: Partial<Cliente>;
  updateFormData: (field: string, value: any) => void;
  isView: boolean;
}

export function ClasificacionRiesgoTab({ formData, updateFormData, isView }: ClasificacionRiesgoTabProps) {
  if (isView) {
    // Vista de solo lectura - texto plano sin fondos
    return (
      <div className="space-y-6 p-4">
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-x-8 gap-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">SECTOR <span className="text-red-600">*</span></label>
              <div className="flex-1 text-xs text-gray-700">{formData.sector || ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">TIPO DE GIRO</label>
              <div className="flex-1 text-xs text-gray-700">{formData.tipoGiro || ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">TIPO DE INDUSTRIA</label>
              <div className="flex-1 text-xs text-gray-700">{formData.tipoIndustria || ''}</div>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">GIRO DE EMPRESA</label>
              <div className="flex-1 text-xs text-gray-700">{formData.giroEmpresa || ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">ACTIVIDAD ECONÓMICA</label>
              <div className="flex-1 text-xs text-gray-700">{formData.actividadEconomica || ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">SECTOR CNBV</label>
              <div className="flex-1 text-xs text-gray-700">{formData.sectorCNBV || ''}</div>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">TAMAÑO DE EMPRESA</label>
              <div className="flex-1 text-xs text-gray-700">{formData.tamanoEmpresa || ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">NÚMERO DE EMPLEADOS</label>
              <div className="flex-1 text-xs text-gray-700">{formData.numeroEmpleados || ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">NÚMERO DE SUCURSALES</label>
              <div className="flex-1 text-xs text-gray-700">{formData.numeroSucursales || ''}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Modo edición/creación
  return (
    <div className="space-y-6">
      {/* Clasificación Principal */}
      <div>
        <h3 className="text-lg font-semibold text-[#3C3C3C] mb-4 pb-2 border-b border-[#E0E0E0]">
          Clasificación Principal
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sector" className="text-[#3C3C3C]">
              Sector <span className="text-[#C62828]">*</span>
            </Label>
            {isView ? (
              <div className="px-3 py-2 text-sm text-gray-700">{formData.sector || ''}</div>
            ) : (
              <Select
                value={formData.sector}
                onValueChange={(value) => updateFormData('sector', value)}
              >
                <SelectTrigger className="border-[#E0E0E0] focus:border-[#2E5C91]">
                  <SelectValue placeholder="Seleccione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Privado">Sector Privado</SelectItem>
                  <SelectItem value="Público">Sector Público</SelectItem>
                  <SelectItem value="Social">Sector Social</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipoGiro" className="text-[#3C3C3C]">
              Tipo de Giro
            </Label>
            {isView ? (
              <div className="px-3 py-2 text-sm text-gray-700">{formData.tipoGiro || ''}</div>
            ) : (
              <Input
                id="tipoGiro"
                value={formData.tipoGiro || ''}
                onChange={(e) => updateFormData('tipoGiro', e.target.value)}
                className="border-[#E0E0E0] focus:border-[#2E5C91]"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipoIndustria" className="text-[#3C3C3C]">
              Tipo de Industria
            </Label>
            {isView ? (
              <div className="px-3 py-2 text-sm text-gray-700">{formData.tipoIndustria || ''}</div>
            ) : (
              <Input
                id="tipoIndustria"
                value={formData.tipoIndustria || ''}
                onChange={(e) => updateFormData('tipoIndustria', e.target.value)}
                className="border-[#E0E0E0] focus:border-[#2E5C91]"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="giroEmpresa" className="text-[#3C3C3C]">
              Giro de Empresa
            </Label>
            {isView ? (
              <div className="px-3 py-2 text-sm text-gray-700">{formData.giroEmpresa || ''}</div>
            ) : (
              <Input
                id="giroEmpresa"
                value={formData.giroEmpresa || ''}
                onChange={(e) => updateFormData('giroEmpresa', e.target.value)}
                className="border-[#E0E0E0] focus:border-[#2E5C91]"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="actividadEconomica" className="text-[#3C3C3C]">
              Actividad Económica
            </Label>
            {isView ? (
              <div className="px-3 py-2 text-sm text-gray-700">{formData.actividadEconomica || ''}</div>
            ) : (
              <Input
                id="actividadEconomica"
                value={formData.actividadEconomica || ''}
                onChange={(e) => updateFormData('actividadEconomica', e.target.value)}
                className="border-[#E0E0E0] focus:border-[#2E5C91]"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sectorCNBV" className="text-[#3C3C3C]">
              Sector CNBV
            </Label>
            {isView ? (
              <div className="px-3 py-2 text-sm text-gray-700">{formData.sectorCNBV || ''}</div>
            ) : (
              <Input
                id="sectorCNBV"
                value={formData.sectorCNBV || ''}
                onChange={(e) => updateFormData('sectorCNBV', e.target.value)}
                className="border-[#E0E0E0] focus:border-[#2E5C91]"
              />
            )}
          </div>
        </div>
      </div>

      {/* Características de la Empresa */}
      <div>
        <h3 className="text-lg font-semibold text-[#3C3C3C] mb-4 pb-2 border-b border-[#E0E0E0]">
          Características de la Empresa
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tamanoEmpresa" className="text-[#3C3C3C]">
              Tamaño de Empresa
            </Label>
            {isView ? (
              <div className="px-3 py-2 text-sm text-gray-700">{formData.tamanoEmpresa || ''}</div>
            ) : (
              <Select
                value={formData.tamanoEmpresa}
                onValueChange={(value) => updateFormData('tamanoEmpresa', value)}
              >
                <SelectTrigger className="border-[#E0E0E0] focus:border-[#2E5C91]">
                  <SelectValue placeholder="Seleccione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Micro">Micro (0-10 empleados)</SelectItem>
                  <SelectItem value="Pequeña">Pequeña (11-50 empleados)</SelectItem>
                  <SelectItem value="Mediana">Mediana (51-250 empleados)</SelectItem>
                  <SelectItem value="Grande">Grande (+250 empleados)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="numeroEmpleados" className="text-[#3C3C3C]">
              Número de Empleados
            </Label>
            {isView ? (
              <div className="px-3 py-2 text-sm text-gray-700">{formData.numeroEmpleados || ''}</div>
            ) : (
              <Input
                id="numeroEmpleados"
                type="number"
                value={formData.numeroEmpleados || ''}
                onChange={(e) => updateFormData('numeroEmpleados', parseInt(e.target.value) || 0)}
                className="border-[#E0E0E0] focus:border-[#2E5C91]"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="numeroSucursales" className="text-[#3C3C3C]">
              Número de Sucursales
            </Label>
            {isView ? (
              <div className="px-3 py-2 text-sm text-gray-700">{formData.numeroSucursales || ''}</div>
            ) : (
              <Input
                id="numeroSucursales"
                type="number"
                value={formData.numeroSucursales || ''}
                onChange={(e) => updateFormData('numeroSucursales', parseInt(e.target.value) || 0)}
                className="border-[#E0E0E0] focus:border-[#2E5C91]"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}