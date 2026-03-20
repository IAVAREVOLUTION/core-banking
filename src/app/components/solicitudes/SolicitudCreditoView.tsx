import { SolicitudCredito } from '@/types/solicitudCredito';

interface SolicitudCreditoViewProps {
  solicitud: SolicitudCredito;
}

export function SolicitudCreditoView({ solicitud }: SolicitudCreditoViewProps) {
  return (
    <div className="space-y-3">
      {/* Información Principal */}
      <div>
        <div className="bg-[#E7E7E7] px-3 py-2.5 mb-2">
          <span className="text-xs font-medium text-gray-800">Información Principal</span>
        </div>

        <div className="grid grid-cols-3 gap-x-8 gap-y-3 bg-[#F5F5F5] p-4">
          {/* Columna 1 */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">ID Cliente *</label>
              <div className="text-xs text-gray-900">{solicitud.id || '-'}</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Personalidad *</label>
              <div className="text-xs text-gray-900">Persona Física</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Nombre *</label>
              <div className="text-xs text-gray-900">{solicitud.cliente?.split(' - ')[1]?.split(' ')[0] || 'Juan'}</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Apellido Paterno *</label>
              <div className="text-xs text-gray-900">{solicitud.cliente?.split(' - ')[1]?.split(' ')[1] || 'Pérez'}</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Apellido Materno</label>
              <div className="text-xs text-gray-900">{solicitud.cliente?.split(' - ')[1]?.split(' ')[2] || 'Pérez'}</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Fecha Nacimiento *</label>
              <div className="text-xs text-gray-900">26/06/1985</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">RFC *</label>
              <div className="text-xs text-gray-900">PEPJ850628J97</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Entidad Nacimiento *</label>
              <div className="text-xs text-gray-900">Ciudad de México</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">CURP</label>
              <div className="text-xs text-gray-900">PEPJ850628HDF89N09</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Edad</label>
              <div className="text-xs text-gray-900">39</div>
            </div>
          </div>

          {/* Columna 2 */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Sexo *</label>
              <div className="text-xs text-gray-900">Masculino</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Estado Civil *</label>
              <div className="text-xs text-gray-900">Casado</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">RFC</label>
              <div className="text-xs text-gray-900">PEPJ850628J97</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Entidad / Federativa de Nacimiento *</label>
              <div className="text-xs text-gray-900">Ciudad de México</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Nivel de Estudios</label>
              <div className="text-xs text-gray-900">Licenciatura</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Nacionalidad</label>
              <div className="text-xs text-gray-900">Mexicana</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Lenguaje</label>
              <div className="text-xs text-gray-900">Español</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Moneda</label>
              <div className="text-xs text-gray-900">MXN</div>
            </div>
          </div>

          {/* Columna 3 */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Sucursal *</label>
              <div className="text-xs text-gray-900">{solicitud.sucursal || 'Querétaro'}</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Fecha Cuenta_E.R *</label>
              <div className="text-xs text-gray-900">{solicitud.fechaSolicitud || '24/08/23 8:12:05 PM'}</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Fecha de Alta_Va</label>
              <div className="text-xs text-gray-900">24/08/23</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Estatus SIC *</label>
              <div className="text-xs text-gray-900">Positivo</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Estatus Lista_Negra *</label>
              <div className="text-xs text-gray-900">Positivo</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">(Estatus del Cliente) *</label>
              <div className="text-xs text-gray-900">Activo</div>
            </div>

            <div>
              <label className="block text-[10px] text-gray-600 mb-0.5 uppercase">Calificación del Cliente *</label>
              <div className="text-xs text-gray-900">Oro</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
