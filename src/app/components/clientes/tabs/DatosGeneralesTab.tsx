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

interface DatosGeneralesTabProps {
  formData: Partial<Cliente>;
  updateFormData: (field: string, value: any) => void;
  isView: boolean;
}

export function DatosGeneralesTab({ formData, updateFormData, isView }: DatosGeneralesTabProps) {
  const isPersonaMoral = formData.personalidad === 'Moral';

  if (isView) {
    // Vista de solo lectura - texto plano sin fondos
    return (
      <div className="space-y-6 p-4">
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-x-8 gap-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">PERSONALIDAD <span className="text-red-600">*</span></label>
              <div className="flex-1 text-xs text-gray-700">{formData.personalidad || ''}</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs w-48 flex-shrink-0 text-gray-700">MONEDA <span className="text-red-600">*</span></label>
              <div className="flex-1 text-xs text-gray-700">{formData.moneda || ''}</div>
            </div>
            <div></div>

            {isPersonaMoral ? (
              <>
                <div className="flex items-center gap-2 col-span-2">
                  <label className="text-xs w-48 flex-shrink-0 text-gray-700">DENOMINACIÓN O RAZÓN SOCIAL <span className="text-red-600">*</span></label>
                  <div className="flex-1 text-xs text-gray-700">{formData.nombreEmpresa || ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-48 flex-shrink-0 text-gray-700">RFC <span className="text-red-600">*</span></label>
                  <div className="flex-1 text-xs text-gray-700">{formData.rfc || ''}</div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-48 flex-shrink-0 text-gray-700">NOMBRE(S) <span className="text-red-600">*</span></label>
                  <div className="flex-1 text-xs text-gray-700">{formData.nombre || ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-48 flex-shrink-0 text-gray-700">APELLIDO PATERNO <span className="text-red-600">*</span></label>
                  <div className="flex-1 text-xs text-gray-700">{formData.apellidoPaterno || ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-48 flex-shrink-0 text-gray-700">APELLIDO MATERNO <span className="text-red-600">*</span></label>
                  <div className="flex-1 text-xs text-gray-700">{formData.apellidoMaterno || ''}</div>
                </div>
                
                <div className="flex items-center gap-2">
                  <label className="text-xs w-48 flex-shrink-0 text-gray-700">FECHA DE NACIMIENTO <span className="text-red-600">*</span></label>
                  <div className="flex-1 text-xs text-gray-700">{formData.fechaNacimiento?.split('T')[0] || ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-48 flex-shrink-0 text-gray-700">EDAD</label>
                  <div className="flex-1 text-xs text-gray-700">{formData.edad || ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-48 flex-shrink-0 text-gray-700">SEXO <span className="text-red-600">*</span></label>
                  <div className="flex-1 text-xs text-gray-700">{formData.sexo || ''}</div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-48 flex-shrink-0 text-gray-700">ESTADO CIVIL</label>
                  <div className="flex-1 text-xs text-gray-700">{formData.estadoCivil || ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-48 flex-shrink-0 text-gray-700">ENTIDAD FEDERATIVA DE NACIMIENTO</label>
                  <div className="flex-1 text-xs text-gray-700">{formData.entidadNacimiento || ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-48 flex-shrink-0 text-gray-700">NIVEL DE ESTUDIOS</label>
                  <div className="flex-1 text-xs text-gray-700">{formData.nivelEstudios || ''}</div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs w-48 flex-shrink-0 text-gray-700">RFC</label>
                  <div className="flex-1 text-xs text-gray-700">{formData.rfc || ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs w-48 flex-shrink-0 text-gray-700">CURP</label>
                  <div className="flex-1 text-xs text-gray-700">{formData.curp || ''}</div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Modo edición/creación
  return (
    <div className="space-y-6">
      {/* Configuración Básica */}
      <div>
        <h3 className="text-lg font-semibold text-[#3C3C3C] mb-4 pb-2 border-b border-[#E0E0E0]">
          Configuración Básica
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="personalidad" className="text-[#3C3C3C]">
              Personalidad <span className="text-[#C62828]">*</span>
            </Label>
            {isView ? (
              <div className="px-3 py-2 text-sm text-gray-700">{formData.personalidad || ''}</div>
            ) : (
              <Select
                value={formData.personalidad}
                onValueChange={(value) => updateFormData('personalidad', value)}
              >
                <SelectTrigger className="border-[#E0E0E0] focus:border-[#2E5C91]">
                  <SelectValue placeholder="Seleccione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Física">Persona Física</SelectItem>
                  <SelectItem value="Moral">Persona Moral</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="moneda" className="text-[#3C3C3C]">
              Moneda <span className="text-[#C62828]">*</span>
            </Label>
            {isView ? (
              <div className="px-3 py-2 text-sm text-gray-700">{formData.moneda || ''}</div>
            ) : (
              <Select
                value={formData.moneda}
                onValueChange={(value) => updateFormData('moneda', value)}
              >
                <SelectTrigger className="border-[#E0E0E0] focus:border-[#2E5C91]">
                  <SelectValue placeholder="Seleccione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MXN">MXN - Peso Mexicano</SelectItem>
                  <SelectItem value="USD">USD - Dólar Americano</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Datos de la Persona / Empresa */}
      <div>
        <h3 className="text-lg font-semibold text-[#3C3C3C] mb-4 pb-2 border-b border-[#E0E0E0]">
          {isPersonaMoral ? 'Datos de la Empresa' : 'Datos Personales'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isPersonaMoral ? (
            <>
              <div className="lg:col-span-2 space-y-2">
                <Label htmlFor="nombreEmpresa" className="text-[#3C3C3C]">
                  Denominación o Razón Social <span className="text-[#C62828]">*</span>
                </Label>
                {isView ? (
                  <div className="px-3 py-2 text-sm text-gray-700">{formData.nombreEmpresa || ''}</div>
                ) : (
                  <Input
                    id="nombreEmpresa"
                    value={formData.nombreEmpresa || ''}
                    onChange={(e) => updateFormData('nombreEmpresa', e.target.value)}
                    className="border-[#E0E0E0] focus:border-[#2E5C91]"
                    placeholder="Nombre completo de la empresa"
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="rfc" className="text-[#3C3C3C]">
                  RFC <span className="text-[#C62828]">*</span>
                </Label>
                {isView ? (
                  <div className="px-3 py-2 text-sm text-gray-700">{formData.rfc || ''}</div>
                ) : (
                  <Input
                    id="rfc"
                    value={formData.rfc || ''}
                    onChange={(e) => updateFormData('rfc', e.target.value)}
                    className="border-[#E0E0E0] focus:border-[#2E5C91]"
                    placeholder="RFC de la empresa"
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="nombre" className="text-[#3C3C3C]">
                  Nombre(s) <span className="text-[#C62828]">*</span>
                </Label>
                {isView ? (
                  <div className="px-3 py-2 text-sm text-gray-700">{formData.nombre || ''}</div>
                ) : (
                  <Input
                    id="nombre"
                    value={formData.nombre || ''}
                    onChange={(e) => updateFormData('nombre', e.target.value)}
                    className="border-[#E0E0E0] focus:border-[#2E5C91]"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="apellidoPaterno" className="text-[#3C3C3C]">
                  Apellido Paterno <span className="text-[#C62828]">*</span>
                </Label>
                {isView ? (
                  <div className="px-3 py-2 text-sm text-gray-700">{formData.apellidoPaterno || ''}</div>
                ) : (
                  <Input
                    id="apellidoPaterno"
                    value={formData.apellidoPaterno || ''}
                    onChange={(e) => updateFormData('apellidoPaterno', e.target.value)}
                    className="border-[#E0E0E0] focus:border-[#2E5C91]"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="apellidoMaterno" className="text-[#3C3C3C]">
                  Apellido Materno <span className="text-[#C62828]">*</span>
                </Label>
                {isView ? (
                  <div className="px-3 py-2 text-sm text-gray-700">{formData.apellidoMaterno || ''}</div>
                ) : (
                  <Input
                    id="apellidoMaterno"
                    value={formData.apellidoMaterno || ''}
                    onChange={(e) => updateFormData('apellidoMaterno', e.target.value)}
                    className="border-[#E0E0E0] focus:border-[#2E5C91]"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fechaNacimiento" className="text-[#3C3C3C]">
                  Fecha de Nacimiento <span className="text-[#C62828]">*</span>
                </Label>
                {isView ? (
                  <div className="px-3 py-2 text-sm text-gray-700">{formData.fechaNacimiento?.split('T')[0] || ''}</div>
                ) : (
                  <Input
                    id="fechaNacimiento"
                    type="date"
                    value={formData.fechaNacimiento?.split('T')[0] || ''}
                    onChange={(e) => updateFormData('fechaNacimiento', e.target.value)}
                    className="border-[#E0E0E0] focus:border-[#2E5C91]"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edad" className="text-[#3C3C3C]">
                  Edad
                </Label>
                <Input
                  id="edad"
                  value={formData.edad || ''}
                  disabled
                  className="bg-[#F5F5F7] border-[#E0E0E0]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sexo" className="text-[#3C3C3C]">
                  Sexo <span className="text-[#C62828]">*</span>
                </Label>
                {isView ? (
                  <div className="px-3 py-2 text-sm text-gray-700">{formData.sexo || ''}</div>
                ) : (
                  <Select
                    value={formData.sexo}
                    onValueChange={(value) => updateFormData('sexo', value)}
                  >
                    <SelectTrigger className="border-[#E0E0E0] focus:border-[#2E5C91]">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Masculino">Masculino</SelectItem>
                      <SelectItem value="Femenino">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="estadoCivil" className="text-[#3C3C3C]">
                  Estado Civil
                </Label>
                {isView ? (
                  <div className="px-3 py-2 text-sm text-gray-700">{formData.estadoCivil || ''}</div>
                ) : (
                  <Select
                    value={formData.estadoCivil}
                    onValueChange={(value) => updateFormData('estadoCivil', value)}
                  >
                    <SelectTrigger className="border-[#E0E0E0] focus:border-[#2E5C91]">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Soltero">Soltero(a)</SelectItem>
                      <SelectItem value="Casado">Casado(a)</SelectItem>
                      <SelectItem value="Divorciado">Divorciado(a)</SelectItem>
                      <SelectItem value="Viudo">Viudo(a)</SelectItem>
                      <SelectItem value="Unión Libre">Unión Libre</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="entidadNacimiento" className="text-[#3C3C3C]">
                  Entidad Federativa de Nacimiento
                </Label>
                {isView ? (
                  <div className="px-3 py-2 text-sm text-gray-700">{formData.entidadNacimiento || ''}</div>
                ) : (
                  <Input
                    id="entidadNacimiento"
                    value={formData.entidadNacimiento || ''}
                    onChange={(e) => updateFormData('entidadNacimiento', e.target.value)}
                    className="border-[#E0E0E0] focus:border-[#2E5C91]"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="nivelEstudios" className="text-[#3C3C3C]">
                  Nivel de Estudios
                </Label>
                {isView ? (
                  <div className="px-3 py-2 text-sm text-gray-700">{formData.nivelEstudios || ''}</div>
                ) : (
                  <Select
                    value={formData.nivelEstudios}
                    onValueChange={(value) => updateFormData('nivelEstudios', value)}
                  >
                    <SelectTrigger className="border-[#E0E0E0] focus:border-[#2E5C91]">
                      <SelectValue placeholder="Seleccione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Primaria">Primaria</SelectItem>
                      <SelectItem value="Secundaria">Secundaria</SelectItem>
                      <SelectItem value="Preparatoria">Preparatoria</SelectItem>
                      <SelectItem value="Licenciatura">Licenciatura</SelectItem>
                      <SelectItem value="Maestría">Maestría</SelectItem>
                      <SelectItem value="Doctorado">Doctorado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rfc" className="text-[#3C3C3C]">
                  RFC <span className="text-[#C62828]">*</span>
                </Label>
                {isView ? (
                  <div className="px-3 py-2 text-sm text-gray-700">{formData.rfc || ''}</div>
                ) : (
                  <Input
                    id="rfc"
                    value={formData.rfc || ''}
                    onChange={(e) => updateFormData('rfc', e.target.value)}
                    className="border-[#E0E0E0] focus:border-[#2E5C91]"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="curp" className="text-[#3C3C3C]">
                  CURP <span className="text-[#C62828]">*</span>
                </Label>
                {isView ? (
                  <div className="px-3 py-2 text-sm text-gray-700">{formData.curp || ''}</div>
                ) : (
                  <Input
                    id="curp"
                    value={formData.curp || ''}
                    onChange={(e) => updateFormData('curp', e.target.value)}
                    className="border-[#E0E0E0] focus:border-[#2E5C91]"
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Información del Sistema */}
      <div>
        <h3 className="text-lg font-semibold text-[#3C3C3C] mb-4 pb-2 border-b border-[#E0E0E0]">
          Información del Sistema
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sucursal" className="text-[#3C3C3C]">
              Sucursal
            </Label>
            <Input
              id="sucursal"
              value={formData.sucursal || ''}
              disabled
              className="bg-[#F5F5F7] border-[#E0E0E0]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="estatusCliente" className="text-[#3C3C3C]">
              Estatus del Cliente
            </Label>
            <Input
              id="estatusCliente"
              value={formData.estatusCliente || ''}
              disabled
              className="bg-[#F5F5F7] border-[#E0E0E0]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="calificacionCliente" className="text-[#3C3C3C]">
              Calificación
            </Label>
            <Input
              id="calificacionCliente"
              value={formData.calificacionCliente || ''}
              disabled
              className="bg-[#F5F5F7] border-[#E0E0E0]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="usuarioRegistro" className="text-[#3C3C3C]">
              Usuario que Registró
            </Label>
            <Input
              id="usuarioRegistro"
              value={formData.usuarioRegistro || ''}
              disabled
              className="bg-[#F5F5F7] border-[#E0E0E0]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="estatusSIC" className="text-[#3C3C3C]">
              Estatus SIC
            </Label>
            <Input
              id="estatusSIC"
              value={formData.estatusSIC || ''}
              disabled
              className="bg-[#F5F5F7] border-[#E0E0E0]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="estatusListaNegra" className="text-[#3C3C3C]">
              Estatus Lista Negra
            </Label>
            <Input
              id="estatusListaNegra"
              value={formData.estatusListaNegra || ''}
              disabled
              className="bg-[#F5F5F7] border-[#E0E0E0]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cuentaEje" className="text-[#3C3C3C]">
              Cuenta Eje
            </Label>
            <Input
              id="cuentaEje"
              value={formData.cuentaEje || ''}
              disabled
              className="bg-[#F5F5F7] border-[#E0E0E0] font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="saldo" className="text-[#3C3C3C]">
              Saldo
            </Label>
            <Input
              id="saldo"
              value={formData.saldo?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) || '$0.00'}
              disabled
              className="bg-[#F5F5F7] border-[#E0E0E0]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}