import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook personalizado para persistir datos de clientes en sessionStorage
 * Asegura que todos los datos estén vinculados al ID del cliente
 */

export interface ClientePersistenceOptions {
  clienteId: string | number;
  subtab?: string;
}

/**
 * Hook principal para persistir datos de clientes
 * @param storageKey - Clave base para el almacenamiento (ej: 'cliente_123')
 * @param initialData - Datos iniciales del formulario
 * @returns Objeto con data, setters y funciones de utilidad
 */
export function useClientePersistence<T extends Record<string, any>>(
  storageKey: string,
  initialData: T
) {
  // Keep initialData in a ref so setData callback is stable
  const initialDataRef = useRef(initialData);
  initialDataRef.current = initialData;

  // Cargar datos iniciales: primero intentar sessionStorage, sino usar initialData
  const loadInitialData = (): T => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const persistedData = JSON.parse(saved);
        // Si los datos son un array, retornar directamente sin hacer spread de objeto
        if (Array.isArray(persistedData)) {
          return persistedData as T;
        }
        // Filtrar valores undefined del persistedData para no sobrescribir defaults
        const cleanedData: any = {};
        Object.keys(persistedData).forEach(key => {
          if (persistedData[key] !== undefined) {
            cleanedData[key] = persistedData[key];
          }
        });
        return { ...initialData, ...cleanedData };
      }
    } catch (error) {
      console.error(`Error loading from ${storageKey}:`, error);
    }
    return initialData;
  };

  const [data, setDataRaw] = useState<T>(loadInitialData);

  // Guardar en sessionStorage cuando data cambie
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(data));
    } catch (error) {
      console.error(`Error saving to ${storageKey}:`, error);
    }
  }, [data, storageKey]);

  // Wrapper: stable via useCallback + ref for initialData.
  // Merges with initialData to prevent undefined fields (controlled-to-uncontrolled).
  const setData = useCallback((valueOrUpdater: T | ((prev: T) => T)) => {
    setDataRaw(prev => {
      const newData = typeof valueOrUpdater === 'function'
        ? (valueOrUpdater as (prev: T) => T)(prev)
        : valueOrUpdater;
      // For arrays, check if content actually changed to avoid unnecessary re-renders
      if (Array.isArray(newData)) {
        if (Array.isArray(prev) && prev.length === newData.length) {
          // Quick reference check first
          if (prev === newData) return prev;
          // For empty arrays, avoid re-render
          if (prev.length === 0 && newData.length === 0) return prev;
        }
        return newData;
      }
      // For objects, merge with initialData defaults so no field is undefined
      const merged = { ...initialDataRef.current, ...newData };
      // Avoid unnecessary re-renders: if all values are the same, return prev
      if (prev && !Array.isArray(prev)) {
        const prevKeys = Object.keys(prev);
        const mergedKeys = Object.keys(merged as any);
        if (prevKeys.length === mergedKeys.length &&
            mergedKeys.every(k => (prev as any)[k] === (merged as any)[k])) {
          return prev; // No change — return same reference
        }
      }
      return merged;
    });
  }, []); // Stable: uses ref for initialData

  // Función para actualizar un campo específico
  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setDataRaw(prev => {
      if (prev[field] === value) return prev; // No change
      return { ...prev, [field]: value };
    });
  }, []);

  // Función para actualizar múltiples campos — with shallow equality check
  const updateFields = useCallback((updates: Partial<T>) => {
    setDataRaw(prev => {
      // Check if any value actually changed
      const keys = Object.keys(updates) as (keyof T)[];
      const hasChange = keys.some(k => prev[k] !== updates[k]);
      if (!hasChange) return prev; // No change — same reference
      return { ...prev, ...updates };
    });
  }, []);

  // Función para resetear datos
  const resetData = useCallback(() => {
    setDataRaw(initialData);
  }, []); // Vacío para evitar dependencia de initialData que cambia

  // Función para limpiar datos persistidos
  const clearPersistedData = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
      sessionStorage.removeItem(`${storageKey}_active_tab`);
      
      // Limpiar también todos los subtabs asociados
      const subtabKeys = [
        '_direcciones', '_direcciones_list',
        '_expedientes', '_expedientes_list',
        '_sic', '_sic_list',
        '_kyc', '_kyc_list',
        '_perfil_transaccional', '_perfil_transaccional_list',
        '_archivos', '_archivos_list',
        '_garantias', '_garantias_list',
        '_cuenta_ahorro', '_cuenta_ahorro_list',
        '_solicitudes', '_solicitudes_list',
        '_creditos', '_creditos_list',
        '_inversiones', '_inversiones_list',
        '_movimientos', '_movimientos_list',
        '_avisos', '_avisos_list',
        '_auditoria', '_auditoria_list',
        '_convenios', '_convenios_list',
        '_cobranza_normal', '_cobranza_normal_list',
        '_cobranza_acumulativa', '_cobranza_acumulativa_list',
        '_estado_cuenta', '_estado_cuenta_creditos', '_estado_cuenta_pagos',
        '_calendario', '_calendario_list',
        '_personas_relacionadas', '_personas_relacionadas_list',
        '_listas_negras', '_listas_negras_list',
      ];
      
      subtabKeys.forEach(suffix => {
        try {
          sessionStorage.removeItem(`${storageKey}${suffix}`);
        } catch (e) {
          // Ignorar errores individuales
        }
      });
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
 * Hook para manejar tabs activos y navegación en clientes
 */
export function useClienteTabs(storageKey: string, defaultTab: string = 'datos-personales') {
  const loadInitialTab = (): string => {
    try {
      const saved = sessionStorage.getItem(`${storageKey}_active_tab`);
      return saved || defaultTab;
    } catch {
      return defaultTab;
    }
  };

  const [activeTab, setActiveTab] = useState<string>(loadInitialTab);

  useEffect(() => {
    sessionStorage.setItem(`${storageKey}_active_tab`, activeTab);
  }, [activeTab, storageKey]);

  return [activeTab, setActiveTab] as const;
}

/**
 * Hook para persistir datos de subtabs específicos
 * Vincula automáticamente los datos al ID del cliente
 */
export function useClienteSubtabPersistence<T extends Record<string, any>>(
  clienteId: string | number,
  subtabName: string,
  initialData: T
) {
  const storageKey = `cliente_${clienteId}_${subtabName}`;
  return useClientePersistence<T>(storageKey, initialData);
}

/**
 * Hook para manejar múltiples registros de un subtab (tablas, listas, etc.)
 * Por ejemplo: direcciones, garantías, archivos adjuntos
 */
export function useClienteSubtabList<T extends { id: number | string }>(
  clienteId: string | number,
  subtabName: string,
  initialItems: T[] = []
) {
  const storageKey = `cliente_${clienteId}_${subtabName}_list`;
  
  const { data, setData, clearPersistedData } = useClientePersistence<T[]>(
    storageKey,
    initialItems
  );

  // Garantizar que items siempre sea un array (protección contra datos corruptos)
  const items = Array.isArray(data) ? data : initialItems;
  const setItems = useCallback((val: T[] | ((prev: T[]) => T[])) => {
    if (typeof val === 'function') {
      setData(prev => {
        const safePrev = Array.isArray(prev) ? prev : initialItems;
        return val(safePrev);
      });
    } else {
      setData(val);
    }
  }, [setData, initialItems]);

  // Agregar un item
  const addItem = useCallback((item: T) => {
    setItems(prev => [...prev, item]);
  }, [setItems]);

  // Actualizar un item por ID
  const updateItem = useCallback((id: number | string, updates: Partial<T>) => {
    setItems(prev => 
      prev.map(item => item.id === id ? { ...item, ...updates } : item)
    );
  }, [setItems]);

  // Eliminar un item por ID
  const removeItem = useCallback((id: number | string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, [setItems]);

  // Limpiar todos los items
  const clearItems = useCallback(() => {
    setItems([]);
  }, [setItems]);

  return {
    items,
    setItems,
    addItem,
    updateItem,
    removeItem,
    clearItems,
    clearPersistedData,
  };
}

/**
 * Utilidad para limpiar todos los datos de un cliente específico
 */
export function clearAllClienteData(clienteId: string | number) {
  const baseKey = `cliente_${clienteId}`;
  // Prefijo para datos de cuentas de ahorro asociadas al cliente
  // Las cuentas usan entityId = `cta_${clienteId}_${cuentaId}`, generando
  // claves como `cliente_cta_${clienteId}_${cuentaId}_xxx`
  const cuentaPrefix = `cliente_cta_${clienteId}_`;
  
  try {
    // Obtener todas las claves de sessionStorage
    const keys = Object.keys(sessionStorage);
    
    // Filtrar y eliminar solo las claves relacionadas con este cliente
    // IMPORTANTE: Usar coincidencia exacta o con separador '_' para evitar
    // que clienteId "1" borre datos de clienteId "10", "11", etc.
    keys.forEach(key => {
      if (key === baseKey || key.startsWith(baseKey + '_') || key.startsWith(cuentaPrefix)) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error(`Error clearing all data for cliente ${clienteId}:`, error);
  }
}

/**
 * Utilidad para cargar datos de un cliente desde sessionStorage
 */
export function loadClienteData<T>(clienteId: string | number, defaultData?: T): T | null {
  const storageKey = `cliente_${clienteId}`;
  
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error(`Error loading cliente data for ${clienteId}:`, error);
  }
  
  return defaultData || null;
}