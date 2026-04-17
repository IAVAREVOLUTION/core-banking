import { useState, useEffect, useCallback } from 'react';

/**
 * Hook personalizado para persistir datos de productos en sessionStorage
 */

export interface ProductoMaestro {
  id: number | string;
  clave: string;
  nombre: string;
  lineaProducto: string;
  sublineaProducto: string;
  descripcion: string;
  estatus: string;
  moneda: string;
  fechaRegistro?: string;
  usuarioRegistro?: string;
}

export function useProductoPersistence<T extends Record<string, any> | any[]>(
  storageKey: string,
  initialData: T
) {
  // Cargar datos iniciales: primero intentar sessionStorage, sino usar initialData
  const loadInitialData = (): T => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const persistedData = JSON.parse(saved);
        // If initialData is an array, return persisted array directly (don't spread)
        if (Array.isArray(initialData)) {
          return (Array.isArray(persistedData) ? persistedData : initialData) as T;
        }
        return { ...initialData, ...persistedData };
      }
    } catch (error) {
      console.error(`Error loading from ${storageKey}:`, error);
    }
    return initialData;
  };

  const [data, setData] = useState<T>(loadInitialData);

  // ── FIX: Resetear estado cuando cambia el storageKey ──
  // Evita que datos de un producto editado se filtren en un producto nuevo
  // cuando el componente se reutiliza (mismo lugar en el tree de React).
  useEffect(() => {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      try {
        const persistedData = JSON.parse(saved);
        if (Array.isArray(initialData)) {
          setData(Array.isArray(persistedData) ? persistedData : initialData);
        } else {
          setData({ ...initialData, ...persistedData });
        }
      } catch {
        setData(initialData);
      }
    } else {
      // No hay datos persistidos para esta key → usar initialData limpio
      setData(initialData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Guardar en sessionStorage cuando data cambie
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving to ${storageKey}:`, error);
    }
  }, [data, storageKey]);

  // Función para actualizar un campo específico
  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setData(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  // Función para actualizar múltiples campos
  const updateFields = useCallback((updates: Partial<T>) => {
    setData(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  // Función para resetear datos
  const resetData = useCallback(() => {
    setData(initialData);
  }, [initialData]);

  // Función para limpiar datos persistidos
  const clearPersistedData = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(`${storageKey}_active_tab`);
    } catch (error) {
      console.error(`Error clearing ${storageKey}:`, error);
    }
  }, [storageKey]);

  return {
    data,
    setData,
    updateField,
    updateFields,
    resetData,
    clearPersistedData,
  };
}

/**
 * Hook específico para manejar el maestro de productos
 */
export function useProductoMaestro(productoId: number | string, tipoProducto: 'credito' | 'captacion' | 'linea') {
  const storageKey = `producto_maestro_${tipoProducto}`;
  
  const initialMaestro: ProductoMaestro = {
    id: productoId,
    clave: '',
    nombre: '',
    lineaProducto: tipoProducto === 'credito' ? 'Crédito' : tipoProducto === 'captacion' ? 'Captación' : 'Línea de Crédito',
    sublineaProducto: '',
    descripcion: '',
    estatus: 'Activo',
    moneda: 'MXN',
    fechaRegistro: new Date().toISOString(),
    usuarioRegistro: 'Usuario Actual',
  };

  return useProductoPersistence<ProductoMaestro>(storageKey, initialMaestro);
}

/**
 * Hook para manejar tabs activos y navegación
 */
export function useProductoTabs(storageKey: string, defaultTab: string = 'default') {
  const loadInitialTab = (): string => {
    try {
      const saved = sessionStorage.getItem(`${storageKey}_active_tab`);
      return saved || defaultTab;
    } catch {
      return defaultTab;
    }
  };

  const [activeTab, setActiveTab] = useState<string>(loadInitialTab);

  // ── FIX: Resetear tab activo cuando cambia el storageKey ──
  useEffect(() => {
    const saved = sessionStorage.getItem(`${storageKey}_active_tab`);
    setActiveTab(saved || defaultTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    sessionStorage.setItem(`${storageKey}_active_tab`, activeTab);
  }, [activeTab, storageKey]);

  return [activeTab, setActiveTab] as const;
}

// =====================================================================
// DEBUG FLAG: Activar para diagnosticar problemas de persistencia en tabs
// Cambiar a true para ver logs [TAB_PERSIST] en consola
// =====================================================================
const DEBUG_TAB_PERSISTENCE = false;

/**
 * Hook especializado para persistencia de datos en tabs de detalle (arrays).
 * Incluye:
 * - Lazy initialization desde sessionStorage (o localStorage con opción)
 * - Protective re-read en mount (safety net contra fallos de lazy init)
 * - Write-through a storage via useEffect
 * - Debug logging togglable
 * - Soporte para localStorage (ComisionesTab) y sessionStorage (default)
 * 
 * Uso: Reemplaza el patrón inline de storage en los tabs forwardRef.
 */
export function useTabPersistence<T>(
  storageKey: string,
  defaultData: T[],
  options?: { storageType?: 'session' | 'local' }
): {
  data: T[];
  setData: React.Dispatch<React.SetStateAction<T[]>>;
} {
  const storage = options?.storageType === 'local' ? localStorage : sessionStorage;

  const debugLog = (action: string, detail?: any) => {
    if (DEBUG_TAB_PERSISTENCE && storageKey) {
      console.log(`[TAB_PERSIST] [${storageKey}] ${action}`, detail !== undefined ? detail : '');
    }
  };

  // === FASE 1: Lazy initialization (síncrona, en el primer render) ===
  const getInitialData = (): T[] => {
    if (!storageKey) {
      debugLog('SKIP: storageKey is empty');
      return defaultData;
    }
    try {
      const stored = storage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // ── FIX: Si storage tiene [] vacío pero defaultData (initialData de BD) tiene datos,
          // preferir datos de BD y actualizar storage para que quede sincronizado ──
          if (parsed.length === 0 && defaultData.length > 0) {
            debugLog('INIT: Storage vacío pero defaultData tiene datos — prefiriendo defaultData (BD)', {
              storedCount: 0, defaultCount: defaultData.length,
            });
            try { storage.setItem(storageKey, JSON.stringify(defaultData)); } catch (_) { /* ignore */ }
            return defaultData;
          }
          debugLog('INIT: Loaded from storage', { count: parsed.length, type: options?.storageType || 'session' });
          return parsed;
        } else {
          debugLog('INIT: Stored data is not an array, using default');
        }
      } else {
        debugLog('INIT: No data in storage, using default', { defaultCount: defaultData.length });
      }
    } catch (e) {
      debugLog('INIT: Error reading storage', e);
    }
    return defaultData;
  };

  const [data, setData] = useState<T[]>(getInitialData);

  // === FASE 2: Protective re-read on mount ===
  // Safety net: Si el lazy init falló por alguna razón (race condition, StrictMode, etc.),
  // este efecto re-lee storage y actualiza el estado si hay datos almacenados
  // que no se cargaron en el lazy init.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = storage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Solo actualizar si los datos almacenados son diferentes/no-vacíos
          // y el estado actual está vacío (posible fallo del lazy init)
          setData(currentData => {
            if (currentData.length === 0 && parsed.length > 0) {
              debugLog('PROTECTIVE RE-READ: Recovered data from storage!', {
                storedCount: parsed.length,
                currentCount: currentData.length,
              });
              return parsed;
            }
            return currentData;
          });
        }
      }
    } catch (e) {
      debugLog('PROTECTIVE RE-READ: Error', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // === FASE 3: Write-through a storage ===
  useEffect(() => {
    if (!storageKey) return;
    try {
      storage.setItem(storageKey, JSON.stringify(data));
      debugLog('WRITE: Saved to storage', { count: data.length, type: options?.storageType || 'session' });
    } catch (e) {
      debugLog('WRITE: Error saving to storage', e);
    }
  }, [data, storageKey]);

  return { data, setData };
}
