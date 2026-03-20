import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Cliente } from '../../../data/mockClientesData';

interface DatosContactoTabProps {
  formData: Partial<Cliente>;
  updateFormData: (field: string, value: any) => void;
  isView: boolean;
}

export function DatosContactoTab({ formData, updateFormData, isView }: DatosContactoTabProps) {
  if (isView) {
    // Vista de solo lectura - texto plano sin fondos
    return (
      <div className="space-y-6 p-4">
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-x-8 gap-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">TELÉFONO DOMICILIO</label>
              <div className="flex-1 text-xs text-gray-700">{formData.telefonoDomicilio || ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">TELÉFONO OFICINA</label>
              <div className="flex-1 text-xs text-gray-700">{formData.telefonoOficina || ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">CELULAR <span className="text-red-600">*</span></label>
              <div className="flex-1 text-xs text-gray-700">{formData.celular || ''}</div>
            </div>
            
            <div className="flex items-center gap-2 col-span-3">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">CORREO ELECTRÓNICO <span className="text-red-600">*</span></label>
              <div className="flex-1 text-xs text-gray-700">{formData.correoElectronico || ''}</div>
            </div>
            
            <div className="flex items-center gap-2 col-span-3">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">DIRECCIÓN PRINCIPAL</label>
              <div className="flex-1 text-xs text-gray-700">{formData.direccionPrincipal || ''}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Modo edición/creación
  return (
    <div className="space-y-6">
      {/* Información de Contacto */}
      <div>
        <h3 className="text-lg font-semibold text-[#3C3C3C] mb-4 pb-2 border-b border-[#E0E0E0]">
          Información de Contacto
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="telefonoDomicilio" className="text-[#3C3C3C]">
              Teléfono Domicilio
            </Label>
            {isView ? (
              <div className="px-3 py-2 text-sm text-gray-700">{formData.telefonoDomicilio || ''}</div>
            ) : (
              <Input
                id="telefonoDomicilio"
                type="tel"
                value={formData.telefonoDomicilio || ''}
                onChange={(e) => updateFormData('telefonoDomicilio', e.target.value)}
                className="border-[#E0E0E0] focus:border-[#2E5C91]"
                placeholder="5555-1234"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefonoOficina" className="text-[#3C3C3C]">
              Teléfono Oficina
            </Label>
            {isView ? (
              <div className="px-3 py-2 text-sm text-gray-700">{formData.telefonoOficina || ''}</div>
            ) : (
              <Input
                id="telefonoOficina"
                type="tel"
                value={formData.telefonoOficina || ''}
                onChange={(e) => updateFormData('telefonoOficina', e.target.value)}
                className="border-[#E0E0E0] focus:border-[#2E5C91]"
                placeholder="5555-5678"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="celular" className="text-[#3C3C3C]">
              Celular <span className="text-[#C62828]">*</span>
            </Label>
            {isView ? (
              <div className="px-3 py-2 text-sm text-gray-700">{formData.celular || ''}</div>
            ) : (
              <Input
                id="celular"
                type="tel"
                value={formData.celular || ''}
                onChange={(e) => updateFormData('celular', e.target.value)}
                className="border-[#E0E0E0] focus:border-[#2E5C91]"
                placeholder="5512345678"
              />
            )}
          </div>
        </div>
      </div>

      {/* Correo Electrónico */}
      <div>
        <h3 className="text-lg font-semibold text-[#3C3C3C] mb-4 pb-2 border-b border-[#E0E0E0]">
          Correo Electrónico
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="correoElectronico" className="text-[#3C3C3C]">
              Correo Electrónico <span className="text-[#C62828]">*</span>
            </Label>
            {isView ? (
              <div className="px-3 py-2 text-sm text-gray-700">{formData.correoElectronico || ''}</div>
            ) : (
              <Input
                id="correoElectronico"
                type="email"
                value={formData.correoElectronico || ''}
                onChange={(e) => updateFormData('correoElectronico', e.target.value)}
                className="border-[#E0E0E0] focus:border-[#2E5C91]"
                placeholder="correo@ejemplo.com"
              />
            )}
          </div>
        </div>
      </div>

      {/* Dirección */}
      <div>
        <h3 className="text-lg font-semibold text-[#3C3C3C] mb-4 pb-2 border-b border-[#E0E0E0]">
          Dirección Principal
        </h3>
        <div className="space-y-2">
          <Label htmlFor="direccionPrincipal" className="text-[#3C3C3C]">
            Dirección Completa
          </Label>
          {isView ? (
            <div className="px-3 py-2 text-sm text-gray-700 min-h-[80px]">{formData.direccionPrincipal || ''}</div>
          ) : (
            <textarea
              id="direccionPrincipal"
              value={formData.direccionPrincipal || ''}
              onChange={(e) => updateFormData('direccionPrincipal', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-[#E0E0E0] rounded-md focus:border-[#2E5C91] focus:outline-none focus:ring-1 focus:ring-[#2E5C91] resize-none"
              placeholder="Calle, número, colonia, ciudad, estado, código postal"
              rows={3}
            />
          )}
        </div>
      </div>
    </div>
  );
}