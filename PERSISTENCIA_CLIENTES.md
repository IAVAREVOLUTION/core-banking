# 📋 Sistema de Persistencia de Datos - Módulo de Clientes

## ✅ Implementación Completada

Se ha implementado un sistema completo de persistencia para el módulo de Clientes que cumple con todos los requisitos especificados.

---

## 🔹 CARACTERÍSTICAS IMPLEMENTADAS

### 1. **Hook de Persistencia Personalizado**
- **Archivo**: `/src/app/hooks/useClientePersistence.ts`
- **Funcionalidad**: Maneja automáticamente la persistencia de datos en `sessionStorage`

#### Hooks disponibles:

```typescript
// Hook principal para datos del cliente
useClientePersistence<T>(storageKey, initialData)

// Hook para tabs activos
useClienteTabs(storageKey, defaultTab)

// Hook para listas de subtabs (direcciones, garantías, etc.)
useClienteSubtabList<T>(clienteId, subtabName, initialItems)

// Hook para subtabs individuales
useClienteSubtabPersistence<T>(clienteId, subtabName, initialData)
```

---

### 2. **Vinculación con ID del Cliente**
Todos los datos están vinculados al ID del cliente mediante claves únicas:

```typescript
const clienteId = cliente?.idCliente || `temp_${Date.now()}`;
const storageKey = `cliente_${clienteId}`;
```

**Estructura de almacenamiento**:
- `cliente_123` - Datos principales del cliente
- `cliente_123_active_tab` - Tab activo
- `cliente_123_direcciones_list` - Lista de direcciones
- `cliente_123_listas_negras_list` - Listas negras
- `cliente_123_personas_relacionadas_list` - Personas relacionadas

---

### 3. **Persistencia Durante Navegación**
Los datos se mantienen durante toda la sesión mientras el usuario:
- ✅ Cambia entre tabs
- ✅ Cambia entre subtabs
- ✅ Navega a otros módulos y regresa
- ✅ Edita campos en cualquier sección

---

### 4. **Limpieza de Datos**
El sistema limpia automáticamente los datos cuando:

#### **Al guardar un nuevo cliente**:
```typescript
if (mode === 'nuevo') {
  clearFormData();
  clearAllClienteData(clienteId);
}
```

#### **Al cambiar de cliente**:
```typescript
useEffect(() => {
  const currentStoredId = sessionStorage.getItem('current_cliente_id');
  if (currentStoredId && currentStoredId !== clienteId) {
    clearAllClienteData(currentStoredId);
  }
  sessionStorage.setItem('current_cliente_id', clienteId);
}, [clienteId]);
```

---

### 5. **Datos Implementados con Persistencia**

#### **Formulario Principal** (`formData`):
- ✅ Datos personales (nombre, apellidos, RFC, CURP, etc.)
- ✅ Datos de contacto (teléfonos, correo, dirección)
- ✅ Datos financieros (cuenta eje, saldo, tarjeta de débito)
- ✅ Datos laborales (empresa, puesto, ingresos)
- ✅ Datos institucionales (sucursal, estatus, calificación)

#### **Subtabs con Persistencia**:
- ✅ **Direcciones**: Lista completa de direcciones del cliente
- ✅ **Listas Negras**: Historial de listas negras
- ✅ **Personas Relacionadas**: Familiares y relaciones del cliente

#### **Tab Activo**:
- ✅ Se recuerda el último tab visitado al regresar al cliente

---

## 🔹 FUNCIONES ACTUALIZADAS

### **Actualización de Campos**
Antes:
```typescript
setFormData(prev => ({ ...prev, [field]: value }));
```

Ahora:
```typescript
updateFormField(field, value);
```

### **Actualización Múltiple**
Antes:
```typescript
setFormData(prev => ({ ...prev, ...updates }));
```

Ahora:
```typescript
updateFormFields(updates);
```

---

## 🔹 SEPARACIÓN POR REGISTRO

### **Cada cliente tiene sus propios datos**
- ✅ No se mezclan datos entre clientes diferentes
- ✅ Los datos solo se muestran para el cliente correspondiente
- ✅ Al cambiar de cliente, se cargan sus datos específicos

### **Ejemplo de Separación**:
```
Cliente 1 (ID: 123):
  ├─ cliente_123
  ├─ cliente_123_direcciones_list
  └─ cliente_123_active_tab

Cliente 2 (ID: 456):
  ├─ cliente_456
  ├─ cliente_456_direcciones_list
  └─ cliente_456_active_tab
```

---

## 🔹 SEGURIDAD Y ALMACENAMIENTO

### **SessionStorage**
- ✅ Los datos persisten solo durante la sesión del navegador
- ✅ Se eliminan automáticamente al cerrar la pestaña/navegador
- ✅ No se comparten entre pestañas diferentes
- ✅ No persisten después del cierre del navegador

### **Validación de Datos**
- ✅ Los datos se validan antes de guardarse
- ✅ Se manejan errores de lectura/escritura
- ✅ Se protege contra datos corruptos con try-catch

---

## 🔹 INTEGRACIÓN CON SUBTABS

Para integrar persistencia en nuevos subtabs:

### **Ejemplo: Subtab de Archivos Adjuntos**
```typescript
// En el componente que usa el subtab
const { 
  items: archivos, 
  setItems: setArchivos,
  addItem: addArchivo,
  removeItem: removeArchivo
} = useClienteSubtabList<ArchivoType>(
  clienteId, 
  'archivos_adjuntos', 
  []
);

// Pasar los datos al componente hijo
<ArchivosAdjuntos 
  archivos={archivos}
  onAddArchivo={addArchivo}
  onRemoveArchivo={removeArchivo}
/>
```

---

## 🔹 MANTENIMIENTO

### **Agregar Nuevo Campo al Formulario**
1. Agregar el campo a la interfaz `FormData`
2. Agregar el valor inicial en `getInitialFormData()`
3. El hook de persistencia lo manejará automáticamente

### **Agregar Nuevo Subtab con Persistencia**
1. Usar `useClienteSubtabPersistence` o `useClienteSubtabList`
2. Pasar `clienteId` y nombre único del subtab
3. Proporcionar datos iniciales

### **Debugging**
Para ver todos los datos almacenados en sessionStorage:
```javascript
// En la consola del navegador
Object.keys(sessionStorage).forEach(key => {
  if (key.startsWith('cliente_')) {
    console.log(key, sessionStorage.getItem(key));
  }
});
```

---

## 🔹 VENTAJAS DEL SISTEMA

1. **✅ Automático**: No requiere llamadas manuales a sessionStorage
2. **✅ Reactivo**: Los cambios se guardan inmediatamente
3. **✅ Consistente**: Todos los subtabs usan el mismo patrón
4. **✅ Escalable**: Fácil agregar nuevos campos o subtabs
5. **✅ Seguro**: Manejo robusto de errores
6. **✅ Limpio**: Datos se limpian automáticamente cuando corresponde

---

## 🔹 COMPATIBILIDAD

- ✅ Compatible con modo "nuevo", "editar" y "ver"
- ✅ Compatible con navegación entre módulos
- ✅ Compatible con todos los navegadores modernos
- ✅ No interfiere con otros módulos del sistema

---

## 📌 CONCLUSIÓN

El sistema de persistencia está completamente implementado y funcional. Todos los datos capturados en el módulo de Clientes y sus subtabs se mantienen durante la navegación y están correctamente vinculados al ID del registro principal.

**Estado**: ✅ **COMPLETADO**
**Última actualización**: Febrero 2026
