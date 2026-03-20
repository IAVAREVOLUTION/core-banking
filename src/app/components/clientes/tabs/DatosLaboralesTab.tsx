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

interface DatosLaboralesTabProps {
  formData: Partial<Cliente>;
  updateFormData: (field: string, value: any) => void;
  isView: boolean;
}

export function DatosLaboralesTab({ formData, updateFormData, isView }: DatosLaboralesTabProps) {
  return (
    <div className="space-y-6">
      {/* Información Laboral */}
      <div>
        <h3 className="text-lg font-semibold text-[#3C3C3C] mb-4 pb-2 border-b border-[#E0E0E0]">
          Información Laboral
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tipoEmpleado" className="text-[#3C3C3C]">
              Tipo de Empleado
            </Label>
            <Select
              value={formData.tipoEmpleado}
              onValueChange={(value) => updateFormData('tipoEmpleado', value)}
              disabled={isView}
            >
              <SelectTrigger className="border-[#E0E0E0] focus:border-[#2E5C91]">
                <SelectValue placeholder="Seleccione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Empleado">Empleado</SelectItem>
                <SelectItem value="Independiente">Independiente</SelectItem>
                <SelectItem value="Empresario">Empresario</SelectItem>
                <SelectItem value="Jubilado">Jubilado</SelectItem>
                <SelectItem value="Estudiante">Estudiante</SelectItem>
                <SelectItem value="Otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombreEmpresaTrabajo" className="text-[#3C3C3C]">
              Nombre de la Empresa
            </Label>
            <Input
              id="nombreEmpresaTrabajo"
              value={formData.nombreEmpresaTrabajo || ''}
              onChange={(e) => updateFormData('nombreEmpresaTrabajo', e.target.value)}
              disabled={isView}
              className="border-[#E0E0E0] focus:border-[#2E5C91]"
              placeholder="Empresa donde labora"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="puestoDesempena" className="text-[#3C3C3C]">
              Puesto que Desempeña
            </Label>
            <Input
              id="puestoDesempena"
              value={formData.puestoDesempena || ''}
              onChange={(e) => updateFormData('puestoDesempena', e.target.value)}
              disabled={isView}
              className="border-[#E0E0E0] focus:border-[#2E5C91]"
              placeholder="Cargo o posición"
            />
          </div>
        </div>
      </div>

      {/* Ingresos */}
      <div>
        <h3 className="text-lg font-semibold text-[#3C3C3C] mb-4 pb-2 border-b border-[#E0E0E0]">
          Ingresos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ingresosMensuales" className="text-[#3C3C3C]">
              Ingresos Mensuales
            </Label>
            <Input
              id="ingresosMensuales"
              type="number"
              value={formData.ingresosMensuales || ''}
              onChange={(e) => updateFormData('ingresosMensuales', parseFloat(e.target.value) || 0)}
              disabled={isView}
              className="border-[#E0E0E0] focus:border-[#2E5C91]"
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="otrosIngresos" className="text-[#3C3C3C]">
              Otros Ingresos
            </Label>
            <Input
              id="otrosIngresos"
              type="number"
              value={formData.otrosIngresos || ''}
              onChange={(e) => updateFormData('otrosIngresos', parseFloat(e.target.value) || 0)}
              disabled={isView}
              className="border-[#E0E0E0] focus:border-[#2E5C91]"
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalIngresos" className="text-[#3C3C3C]">
              Total de Ingresos
            </Label>
            <Input
              id="totalIngresos"
              value={(formData.ingresosMensuales || 0) + (formData.otrosIngresos || 0)}
              disabled
              className="bg-[#F5F5F7] border-[#E0E0E0] font-semibold"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
