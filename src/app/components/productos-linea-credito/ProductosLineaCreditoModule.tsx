import { useState, useEffect } from 'react';
import { ProductoLineaCredito, FormModeLineaCredito } from '@/app/types/productoLineaCredito';
import { ProductoLineaCreditoList } from './ProductoLineaCreditoList';
import { ProductoLineaCreditoForm } from './ProductoLineaCreditoForm';
import { useProductosLineaCreditoDB } from '@/app/hooks/useProductosLineaCreditoDB';
import { syncToJProducts } from '@/app/hooks/useSyncJProducts';
import { toast } from 'sonner';

interface ProductosLineaCreditoModuleProps {
  onViewChange?: (view: 'list' | 'form') => void;
  onModeChange?: (mode: FormModeLineaCredito) => void;
}

export function ProductosLineaCreditoModule({ onViewChange, onModeChange }: ProductosLineaCreditoModuleProps) {
  const [currentView, setCurrentView] = useState<'list' | 'form'>('list');
  const [formMode, setFormMode] = useState<FormModeLineaCredito>('create');
  const [selectedProduct, setSelectedProduct] = useState<ProductoLineaCredito | undefined>();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Integración con Supabase
  const { productos: dbProducts, loading: dbLoading, error: dbError, refetch: dbRefetch } = useProductosLineaCreditoDB(currentView === 'list');

  // Lista de productos = exclusivamente lo que devuelve la BD
  const products = dbProducts;

  // Notificar cambios al componente padre
  useEffect(() => {
    onViewChange?.(currentView);
  }, [currentView, onViewChange]);

  useEffect(() => {
    onModeChange?.(formMode);
  }, [formMode, onModeChange]);

  const handleNew = () => {
    setFormMode('create');
    setSelectedProduct(undefined);
    setCurrentView('form');
  };

  const handleEdit = (product: ProductoLineaCredito) => {
    setFormMode('edit');
    setSelectedProduct(product);
    setCurrentView('form');
  };

  const handleView = (product: ProductoLineaCredito) => {
    setFormMode('view');
    setSelectedProduct(product);
    setCurrentView('form');
  };

  const handleSave = (product: ProductoLineaCredito) => {
    setIsRefreshing(true);
    
    if (formMode === 'create') {
      toast.success('Producto Linea de Credito creado', {
        description: `El producto "${product.nombre}" ha sido registrado exitosamente.`,
      });
    } else if (formMode === 'edit') {
      toast.success('Producto Linea de Credito actualizado', {
        description: `Los cambios en "${product.nombre}" han sido guardados.`,
      });
    }
    
    setTimeout(() => {
      setIsRefreshing(false);
      setCurrentView('list');
      setSelectedProduct(undefined);
      // Refrescar datos desde Supabase después de guardar
      // El Form ya hace await syncToJProducts, así que la BD ya tiene los datos
      dbRefetch();
    }, 2000);
  };

  const handleCancelWithCleanup = () => {
    // Limpiar datos de persistencia del formulario activo
    const productId = selectedProduct?.id || getNextId();
    const storageKey = `producto_linea_credito_${productId}`;
    try {
      // Limpiar key principal y active_tab
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(`${storageKey}_active_tab`);
    } catch (e) {
      // silently fail
    }
    setCurrentView('list');
    setSelectedProduct(undefined);
  };

  const getNextId = () => {
    return Math.max(...products.map(p => p.id), 0) + 1;
  };

  return (
    <>
      {/* Refresh Overlay */}
      {isRefreshing && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-xl flex flex-col items-center gap-4">
            <div className="animate-spin">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="20" stroke="#E0E0E0" strokeWidth="4"/>
                <path d="M24 4a20 20 0 0115.5 32.4" stroke="var(--theme-primary)" strokeWidth="4" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="text-gray-700 font-medium">Guardando producto...</p>
          </div>
        </div>
      )}

      {currentView === 'list' && (
        <ProductoLineaCreditoList
          onNew={handleNew}
          onEdit={handleEdit}
          onView={handleView}
          products={products}
          loading={dbLoading}
          error={dbError}
          onRefetch={() => dbRefetch()}
        />
      )}

      {currentView === 'form' && (
        <ProductoLineaCreditoForm
          mode={formMode}
          product={selectedProduct}
          onSave={handleSave}
          onCancel={handleCancelWithCleanup}
          nextId={getNextId()}
        />
      )}
    </>
  );
}