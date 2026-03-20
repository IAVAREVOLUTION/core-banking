import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Cliente } from '../../../data/mockClientesData';
import { Building2, TrendingUp, Wallet } from 'lucide-react';

interface InformacionFinancieraTabProps {
  formData: Partial<Cliente>;
  updateFormData: (field: string, value: any) => void;
  isView: boolean;
}

export function InformacionFinancieraTab({ formData, updateFormData, isView }: InformacionFinancieraTabProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Resumen Financiero */}
      <div>
        <h3 className="text-lg font-semibold text-[#3C3C3C] mb-4 pb-2 border-b border-[#E0E0E0]">
          Resumen Financiero
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Cuenta Eje */}
          <div className="bg-[#F5F5F7] rounded-lg p-4 border border-[#E0E0E0]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#2E5C91] rounded-lg flex items-center justify-center">
                <Wallet className="h-5 w-5 text-white" strokeWidth={2} />
              </div>
              <div>
                <p className="text-xs text-[#9E9E9E]">Cuenta Eje</p>
                <p className="text-sm font-semibold text-[#3C3C3C] font-mono">
                  {formData.cuentaEje || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Saldo */}
          <div className="bg-[#F5F5F7] rounded-lg p-4 border border-[#E0E0E0]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#4CAF50] rounded-lg flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-white" strokeWidth={2} />
              </div>
              <div>
                <p className="text-xs text-[#9E9E9E]">Saldo Actual</p>
                <p className="text-sm font-semibold text-[#3C3C3C]">
                  {formatCurrency(formData.saldo || 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Calificación */}
          <div className="bg-[#F5F5F7] rounded-lg p-4 border border-[#E0E0E0]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#F9A825] rounded-lg flex items-center justify-center">
                <Building2 className="h-5 w-5 text-white" strokeWidth={2} />
              </div>
              <div>
                <p className="text-xs text-[#9E9E9E]">Calificación</p>
                <p className="text-sm font-semibold text-[#3C3C3C]">
                  {formData.calificacionCliente || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Información de Cuenta */}
      <div>
        <h3 className="text-lg font-semibold text-[#3C3C3C] mb-4 pb-2 border-b border-[#E0E0E0]">
          Información de Cuenta
        </h3>
        <div className="bg-white border border-[#E0E0E0] rounded-lg p-4">
          <p className="text-sm text-[#9E9E9E] mb-4">
            Para ver información detallada de productos financieros, utilice los submódulos:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="border border-[#E0E0E0] rounded-lg p-3 hover:border-[#2E5C91] transition-colors cursor-pointer">
              <p className="text-sm font-semibold text-[#3C3C3C]">Cuenta de Ahorro</p>
              <p className="text-xs text-[#9E9E9E] mt-1">Ver cuentas asociadas</p>
            </div>
            <div className="border border-[#E0E0E0] rounded-lg p-3 hover:border-[#2E5C91] transition-colors cursor-pointer">
              <p className="text-sm font-semibold text-[#3C3C3C]">Créditos</p>
              <p className="text-xs text-[#9E9E9E] mt-1">Historial crediticio</p>
            </div>
            <div className="border border-[#E0E0E0] rounded-lg p-3 hover:border-[#2E5C91] transition-colors cursor-pointer">
              <p className="text-sm font-semibold text-[#3C3C3C]">Inversiones</p>
              <p className="text-xs text-[#9E9E9E] mt-1">Portafolio de inversiones</p>
            </div>
          </div>
        </div>
      </div>

      {/* Nota informativa */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Nota:</strong> La información financiera completa del cliente se administra a través de los submódulos específicos. 
          Utilice la pestaña "Submódulos" para acceder a información detallada de cuentas, créditos, inversiones y movimientos.
        </p>
      </div>
    </div>
  );
}
