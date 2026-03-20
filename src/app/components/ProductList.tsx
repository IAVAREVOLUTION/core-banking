import { useState, useMemo } from 'react';
import { Edit, Eye, Plus } from 'lucide-react';
import { Product, FormMode } from '../types/product';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ProductListProps {
  products: Product[];
  onNew: () => void;
  onEdit: (product: Product) => void;
  onView: (product: Product) => void;
}

export function ProductList({ products, onNew, onEdit, onView }: ProductListProps) {
  // Ordenamiento por defecto DESC por FECHA_REGISTRO
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const dateA = new Date(a.createdDate).getTime();
      const dateB = new Date(b.createdDate).getTime();
      return dateB - dateA; // DESC
    });
  }, [products]);

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: es });
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Activo':
        return 'bg-green-100 text-green-800';
      case 'Pendiente':
        return 'bg-yellow-100 text-yellow-800';
      case 'En Revisión':
        return 'bg-blue-100 text-blue-800';
      case 'Inactivo':
        return 'bg-gray-100 text-gray-800';
      case 'Suspendido':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Productos</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestión de productos bancarios
          </p>
        </div>
        <Button onClick={onNew} className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Nuevo Producto
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[80px]">Editar</TableHead>
              <TableHead className="w-[80px]">Ver</TableHead>
              <TableHead className="w-[100px]">Id Producto</TableHead>
              <TableHead className="min-w-[200px]">Nombre</TableHead>
              <TableHead className="min-w-[250px]">Descripción</TableHead>
              <TableHead>Línea Producto</TableHead>
              <TableHead>Sublínea</TableHead>
              <TableHead>Sucursal</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead className="min-w-[150px]">Fecha Registro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                  No hay productos registrados
                </TableCell>
              </TableRow>
            ) : (
              sortedProducts.map((product) => (
                <TableRow key={product.id} className="hover:bg-gray-50">
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(product)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit className="h-4 w-4 text-blue-600" />
                      <span className="sr-only">Editar</span>
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(product)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4 text-gray-600" />
                      <span className="sr-only">Ver</span>
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">{product.id}</TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {product.description}
                  </TableCell>
                  <TableCell>{product.lineProduct}</TableCell>
                  <TableCell>{product.sublineProduct}</TableCell>
                  <TableCell>{product.organization}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                        product.status
                      )}`}
                    >
                      {product.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(product.createdDate)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer info */}
      <div className="flex justify-between items-center text-sm text-gray-500">
        <p>Total de productos: {sortedProducts.length}</p>
        <p>Ordenado por: Fecha de Registro (Más reciente primero)</p>
      </div>
    </div>
  );
}