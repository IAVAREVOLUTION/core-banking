import { useState } from 'react';
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
import { Plus, Trash2 } from 'lucide-react';
import { Product } from '../../../types/product';

export function PlantillasTab({ formData, updateFormData, isView }: {
  formData: Partial<Product>;
  updateFormData: (field: string, value: any) => void;
  isView: boolean;
}) {
  const plantillas = (formData.plantillas as any[]) || [];
  const [showForm, setShowForm] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: '', tipo: '', archivoBase: '', version: '1.0', estatus: 'Activo' });

  const handleAdd = () => {
    setEditIdx(null);
    setForm({ nombre: '', tipo: '', archivoBase: '', version: '1.0', estatus: 'Activo' });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.nombre.trim() || !form.tipo) {
      alert('Nombre y Tipo son obligatorios');
      return;
    }
    let updated = [...plantillas];
    if (editIdx !== null) {
      updated[editIdx] = { ...updated[editIdx], ...form };
    } else {
      updated.push({ id: `p-${Date.now()}`, ...form });
    }
    updateFormData('plantillas', updated);
    setShowForm(false);
  };

  const handleDelete = (idx: number) => {
    if (confirm('¿Eliminar plantilla?')) {
      updateFormData('plantillas', plantillas.filter((_, i) => i !== idx));
    }
  };

  const handleEdit = (idx: number) => {
    setEditIdx(idx);
    setForm(plantillas[idx]);
    setShowForm(true);
  };

  const tiposPresentes = plantillas.filter(p => p.estatus === 'Activo').map(p => p.tipo);
  const ok = tiposPresentes.includes('contrato') && tiposPresentes.includes('pagare');

  return (
    <div className="p-4 space-y-4">
      {/* Estado de requeridos */}
      <div className={`p-3 rounded border ${ok ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
        <p className="text-xs font-semibold">Fase 4 — Formalizar Contrato</p>
        <p className="text-xs mt-1">
          {ok ? '✓ Configuración completa' : '✗ Falta Contrato o Pagaré'}
        </p>
      </div>

      {/* Botón agregar */}
      {!isView && (
        <Button
          onClick={handleAdd}
          disabled={showForm}
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
        >
          <Plus className="w-4 h-4" /> Nueva Plantilla
        </Button>
      )}

      {/* Formulario */}
      {showForm && (
        <div className="border border-gray-300 rounded p-3 bg-gray-50 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs">Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="h-6 text-xs"
                placeholder="Contrato 2024"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger className="h-6 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solicitud">Solicitud</SelectItem>
                  <SelectItem value="contrato">Contrato</SelectItem>
                  <SelectItem value="pagare">Pagaré</SelectItem>
                  <SelectItem value="minuta">Minuta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs">Archivo</Label>
              <Input
                value={form.archivoBase}
                onChange={(e) => setForm({ ...form, archivoBase: e.target.value })}
                className="h-6 text-xs"
                placeholder="plantilla.pdf"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Versión</Label>
              <Input
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                className="h-6 text-xs"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs">Estatus</Label>
              <Select value={form.estatus} onValueChange={(v) => setForm({ ...form, estatus: v })}>
                <SelectTrigger className="h-6 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Activo">Activo</SelectItem>
                  <SelectItem value="Inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-1 justify-end">
            <Button onClick={() => setShowForm(false)} variant="outline" size="sm" className="h-6 text-xs">
              Cancelar
            </Button>
            <Button onClick={handleSave} size="sm" className="h-6 text-xs bg-blue-600 text-white">
              Guardar
            </Button>
          </div>
        </div>
      )}

      {/* Listado */}
      {plantillas.length > 0 ? (
        <div className="space-y-1.5">
          {plantillas.map((p, idx) => (
            <div key={idx} className="border border-gray-200 rounded p-2 flex justify-between items-center bg-white">
              <div className="flex-1 text-xs">
                <p className="font-medium">{p.nombre}</p>
                <p className="text-gray-600">
                  Tipo: {p.tipo} | Versión: {p.version} | {p.estatus}
                </p>
                {p.archivoBase && <p className="text-gray-500">📄 {p.archivoBase}</p>}
              </div>
              {!isView && (
                <div className="flex gap-1">
                  <Button
                    onClick={() => handleEdit(idx)}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                  >
                    Editar
                  </Button>
                  <Button
                    onClick={() => handleDelete(idx)}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-xs text-gray-500 border border-dashed rounded">
          No hay plantillas. {!isView && 'Haz clic en "Nueva Plantilla"'}
        </div>
      )}
    </div>
  );
}
