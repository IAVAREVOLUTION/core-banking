import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, Calendar } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { mockPeriodos, Periodo } from '../../../data/mockData';
import { toast } from 'sonner';

interface PeriodosSubmoduloProps {
  productoId?: number;
  productoNombre?: string;
  lineaProducto?: string;
  sublineaProducto?: string;
  onBack: () => void;
  isView: boolean;
}

export function PeriodosSubmodulo({
  productoId,
  productoNombre,
  lineaProducto,
  sublineaProducto,
  onBack,
  isView,
}: PeriodosSubmoduloProps) {
  const [periodos, setPeriodos] = useState<Periodo[]>(
    mockPeriodos.filter((p) => p.productoId === productoId)
  );
  const [nuevoPeriodo, setNuevoPeriodo] = useState<Partial<Periodo>>({
    productoId,
    periodo: '',
    descripcion: '',
  });

  const handleAgregar = () => {
    if (!nuevoPeriodo.periodo || !nuevoPeriodo.descripcion) {
      toast.error('Campos obligatorios', {
        description: 'Debe completar todos los campos marcados con *',
      });
      return;
    }

    const newId = Math.max(...periodos.map((p) => p.id), 0) + 1;
    const periodoToAdd: Periodo = {
      id: newId,
      productoId: productoId!,
      periodo: nuevoPeriodo.periodo!,
      descripcion: nuevoPeriodo.descripcion!,
    };

    setPeriodos([...periodos, periodoToAdd]);
    setNuevoPeriodo({ productoId, periodo: '', descripcion: '' });
    
    toast.success('Periodo agregado', {
      description: `El periodo "${periodoToAdd.periodo}" ha sido agregado correctamente.`,
    });
  };

  const handleEliminar = (id: number) => {
    const periodo = periodos.find((p) => p.id === id);
    if (confirm(`¿Está seguro de eliminar el periodo "${periodo?.periodo}"?`)) {
      setPeriodos(periodos.filter((p) => p.id !== id));
      toast.success('Periodo eliminado');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-[#3C3C3C] hover:text-[#2E5C91] hover:bg-[#F5F5F7]"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#2E5C91] bg-opacity-10 rounded-lg flex items-center justify-center">
            <Calendar className="h-5 w-5 text-[#2E5C91]" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#3C3C3C]">
              Periodos del Producto
            </h3>
            <p className="text-sm text-[#9E9E9E]">
              Configurar periodos de pago o capitalización
            </p>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[#9E9E9E]">
        <span>Productos</span>
        <span>/</span>
        <span>Alta</span>
        <span>/</span>
        <span className="text-[#3C3C3C]">Periodos</span>
      </div>

      {/* Card Resumen del Producto */}
      <div className="bg-[#F5F5F7] border border-[#E0E0E0] rounded-lg p-4">
        <h4 className="text-sm font-semibold text-[#3C3C3C] mb-3">
          Indicador Maestro
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-[#9E9E9E]">ID Producto</p>
            <p className="text-sm font-semibold text-[#3C3C3C]">{productoId || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-[#9E9E9E]">Nombre</p>
            <p className="text-sm font-semibold text-[#3C3C3C]">{productoNombre || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-[#9E9E9E]">Línea</p>
            <p className="text-sm font-semibold text-[#3C3C3C]">{lineaProducto || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-[#9E9E9E]">Sublínea</p>
            <p className="text-sm font-semibold text-[#3C3C3C]">{sublineaProducto || 'N/A'}</p>
          </div>
        </div>
      </div>

      {/* Formulario de Alta */}
      {!isView && (
        <div className="bg-white border border-[#E0E0E0] rounded-lg shadow-sm p-6">
          <h4 className="text-md font-semibold text-[#3C3C3C] mb-4 pb-2 border-b border-[#E0E0E0]">
            Formulario de Alta de Periodo
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="periodo" className="text-[#3C3C3C]">
                Periodo <span className="text-[#C62828]">*</span>
              </Label>
              <Select
                value={nuevoPeriodo.periodo}
                onValueChange={(value) =>
                  setNuevoPeriodo({ ...nuevoPeriodo, periodo: value })
                }
              >
                <SelectTrigger className="border-[#E0E0E0] focus:border-[#2E5C91]">
                  <SelectValue placeholder="Seleccione periodo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Diario">Diario</SelectItem>
                  <SelectItem value="Semanal">Semanal</SelectItem>
                  <SelectItem value="Quincenal">Quincenal</SelectItem>
                  <SelectItem value="Mensual">Mensual</SelectItem>
                  <SelectItem value="Bimestral">Bimestral</SelectItem>
                  <SelectItem value="Trimestral">Trimestral</SelectItem>
                  <SelectItem value="Semestral">Semestral</SelectItem>
                  <SelectItem value="Anual">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion" className="text-[#3C3C3C]">
                Descripción <span className="text-[#C62828]">*</span>
              </Label>
              <Input
                id="descripcion"
                value={nuevoPeriodo.descripcion}
                onChange={(e) =>
                  setNuevoPeriodo({ ...nuevoPeriodo, descripcion: e.target.value })
                }
                className="border-[#E0E0E0] focus:border-[#2E5C91]"
                placeholder="Descripción del periodo"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() =>
                setNuevoPeriodo({ productoId, periodo: '', descripcion: '' })
              }
              className="border-[#9E9E9E] text-[#3C3C3C]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleAgregar}
              className="gap-2 bg-[#2E5C91] hover:bg-[#4A76A8] text-white"
            >
              <Plus className="h-4 w-4" />
              Guardar
            </Button>
          </div>
        </div>
      )}

      {/* Tabla de Periodos */}
      <div className="bg-white border border-[#E0E0E0] rounded-lg shadow-sm overflow-hidden">
        <div className="bg-[#F5F5F7] px-6 py-3 border-b border-[#E0E0E0]">
          <h4 className="text-sm font-semibold text-[#3C3C3C]">
            Periodos Asociados
          </h4>
        </div>
        <table className="w-full">
          <thead className="bg-[#F5F5F7] border-b border-[#E0E0E0]">
            <tr>
              {!isView && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#3C3C3C] uppercase w-24">
                  Acciones
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#3C3C3C] uppercase">
                Periodo
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#3C3C3C] uppercase">
                Descripción
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E0E0E0]">
            {periodos.length === 0 ? (
              <tr>
                <td
                  colSpan={isView ? 2 : 3}
                  className="px-4 py-8 text-center text-[#9E9E9E]"
                >
                  No hay periodos registrados para este producto
                </td>
              </tr>
            ) : (
              periodos.map((periodo) => (
                <tr key={periodo.id} className="hover:bg-[#F5F5F7]">
                  {!isView && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleEliminar(periodo.id)}
                        className="text-[#C62828] hover:text-[#D32F2F]"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm font-medium text-[#3C3C3C]">
                    {periodo.periodo}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#9E9E9E]">
                    {periodo.descripcion}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
