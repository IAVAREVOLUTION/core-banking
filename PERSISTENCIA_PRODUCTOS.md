# Implementación de Persistencia en Módulos de Productos

## 🎯 Objetivo
Implementar un sistema de persistencia completo usando el patrón maestro-detalle para los tres módulos de productos (Crédito, Captación y Línea de Crédito) que mantenga el estado al navegar entre pantallas y tabs.

## 📋 Patrón Maestro-Detalle

### Maestro (Información Principal)
- **Clave** del producto
- **Nombre** del producto
- **Línea de producto** (Crédito/Captación/Línea de Crédito)
- **Sublínea/Tipo** de producto
- **Descripción**
- **Estatus**
- **Moneda**

### Detalle (Tabs Específicos)
Cada tab mantiene su propia información especializada:
- **Default**: Datos generales del formulario
- **Check List**: Requisitos y validaciones
- **Tasas**: Configuración de tasas de interés
- **Comisiones**: Estructura de comisiones
- **Fases**: Fases del producto
- **Constitución**: Datos de constitución
- Y otros tabs específicos por tipo de producto

## 🔧 Implementación Técnica

### 1. Hook de Persistencia (`useProductoPersistence`)

```typescript
// Ubicación: /src/app/hooks/useProductoPersistence.ts

export function useProductoPersistence<T>(
  storageKey: string,
  initialData: T,
  productoId?: number | string
)
```

**Características:**
- ✅ Persistencia automática en `sessionStorage`
- ✅ Carga automática de datos al montar componente
- ✅ Actualización reactiva de campos individuales
- ✅ Actualización por lotes de múltiples campos
- ✅ Limpieza de datos al guardar/cancelar

**Funciones retornadas:**
- `data`: Estado actual del formulario
- `setData`: Setter completo del estado
- `updateField`: Actualizar un campo específico
- `updateFields`: Actualizar múltiples campos
- `resetData`: Resetear a valores iniciales
- `clearPersistedData`: Limpiar datos persistidos

### 2. Hook de Tabs Activos (`useProductoTabs`)

```typescript
export function useProductoTabs(
  storageKey: string, 
  defaultTab: string = 'default'
)
```

**Características:**
- ✅ Persiste el tab activo en `sessionStorage`
- ✅ Restaura el tab activo al volver a la pantalla
- ✅ Sincronización automática con el estado

### 3. Estructura de Storage

#### Producto Captación
```javascript
// Key pattern: producto_captacion_{id}
sessionStorage.setItem('producto_captacion_nuevo', JSON.stringify({
  clave: 'PC-003',
  producto: 'Ahorro Mi Futuro',
  tipoProducto: 'Ahorro',
  lineaProducto: 'Captación',
  descripcion: 'Producto de ahorro con tasa preferencial',
  estatus: 'Activo',
  tasaBase: 'Fija',
  tipoTasa: 'Fija',
  capitalizaIntereses: true,
  frecuenciaPagoIntereses: 'Mensual',
  plazo: '12',
  periodoCorte: '30',
  tipoMoneda: 'MXN',
  diasVentana: '5',
  montoMinimo: '1000',
  montoMaximo: '100000',
  numeroMaximoRenovaciones: '3',
  tasaInicial: '5.5',
  porcentajeIncremento: '0.5',
  tasaMinima: '4.0',
  tasaMaxima: '7.0'
}));

// Tab activo
sessionStorage.setItem('producto_captacion_nuevo_active_tab', 'tasaInversion');
```

#### Producto Crédito
```javascript
// Key pattern: producto_credito_{id}
sessionStorage.setItem('producto_credito_1', JSON.stringify({
  // Datos maestros
  nombre: 'Crédito Personal Plus',
  lineaProducto: 'Crédito',
  sublineaProducto: 'Personal',
  // Datos específicos
  ...
}));
```

#### Producto Línea de Crédito
```javascript
// Key pattern: producto_linea_{id}
sessionStorage.setItem('producto_linea_2', JSON.stringify({
  // Datos maestros
  nombre: 'Línea Revolvente Empresarial',
  lineaProducto: 'Línea de Crédito',
  // Datos específicos
  ...
}));
```

## 🎨 Flujo de Trabajo

### Escenario 1: Crear Nuevo Producto
1. Usuario hace clic en "Nuevo" → Se genera `productoId = 'nuevo'`
2. `useProductoPersistence` crea entrada en sessionStorage
3. Usuario llena campos → **Se guardan automáticamente**
4. Usuario cambia de tab → **Tab activo se persiste**
5. Usuario navega a otra pantalla → **Datos permanecen**
6. Usuario regresa → **Todo se restaura exactamente como lo dejó**
7. Usuario guarda → **Se limpia sessionStorage** con `clearPersistedData()`

### Escenario 2: Editar Producto Existente
1. Usuario selecciona producto ID=5
2. `useProductoPersistence` carga datos con key `producto_captacion_5`
3. Hook carga datos persistidos O datos del producto original
4. Usuario modifica campos → **Cambios se guardan automáticamente**
5. Usuario navega entre tabs → **Estado se mantiene**
6. Usuario guarda → Datos se envían y se limpia persistencia

### Escenario 3: Ver Producto (Modo Solo Lectura)
1. Usuario abre producto en modo vista
2. Todos los campos están deshabilitados
3. No se permite modificación pero sí navegación entre tabs
4. Tab activo se persiste para mejor UX

## 📊 Ventajas del Patrón Implementado

### 1. **Persistencia Transparente**
```typescript
// Antes (sin persistencia):
const [formData, setFormData] = useState(initialData);
// Los datos se pierden al navegar

// Ahora (con persistencia):
const { data: formData, updateField } = useProductoPersistence(key, initialData);
// Los datos persisten automáticamente
```

### 2. **API Intuitiva**
```typescript
// Actualizar un campo
updateField('producto', 'Nuevo Nombre');

// Actualizar múltiples campos
updateFields({
  producto: 'Nuevo Nombre',
  descripcion: 'Nueva descripción',
  estatus: 'Activo'
});

// Limpiar al guardar
handleSave() {
  onSave(formData);
  clearPersistedData(); // Limpia sessionStorage
}
```

### 3. **Separación de Responsabilidades**
- **Hook**: Maneja lógica de persistencia
- **Componente**: Se enfoca en UI y validación
- **SessionStorage**: Almacenamiento automático

### 4. **Performance Optimizado**
- Solo se guardan datos cuando cambian (useEffect con dependencias)
- Carga perezosa de datos persistidos
- No bloquea el hilo principal

## 🔄 Ciclo de Vida de los Datos

```
┌─────────────────────────────────────────────────────────────┐
│  1. INICIO                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Usuario abre formulario (nuevo/editar/ver)            │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   ▼                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ useProductoPersistence carga datos:                   │  │
│  │  - Si hay en sessionStorage → Cargar                  │  │
│  │  - Si no → Usar initialData                           │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   ▼                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 2. USO                                                │  │
│  │  - Usuario modifica campos                            │  │
│  │  - updateField() guarda en estado                     │  │
│  │  - useEffect detecta cambio                           │  │
│  │  - Guarda automáticamente en sessionStorage           │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   ▼                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Usuario cambia de tab                                 │  │
│  │  - useProductoTabs persiste tab activo                │  │
│  │  - Datos del formulario ya están guardados            │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   ▼                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Usuario navega a otro módulo                          │  │
│  │  - Datos permanecen en sessionStorage                 │  │
│  │  - No se pierde nada                                  │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   ▼                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Usuario regresa al formulario                         │  │
│  │  - useProductoPersistence carga datos guardados       │  │
│  │  - useProductoTabs restaura tab activo                │  │
│  │  - Todo vuelve exactamente como estaba                │  │
│  └────────────────┬─────────────────────────────────────┘  │
│                   ▼                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 3. FINALIZACIÓN                                       │  │
│  │  Usuario hace clic en "Guardar":                      │  │
│  │   - Validar datos                                     │  │
│  │   - Enviar a onSave()                                 │  │
│  │   - clearPersistedData() limpia sessionStorage        │  │
│  │                                                        │  │
│  │  Usuario hace clic en "Cancelar":                     │  │
│  │   - clearPersistedData() limpia sessionStorage        │  │
│  │   - onCancel() cierra formulario                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## ✅ Estado de Implementación

### Producto Captación
- ✅ Hook de persistencia integrado
- ✅ Todos los campos del formulario persisten
- ✅ Tab activo se persiste
- ✅ Navegación sin pérdida de datos
- ✅ Limpieza automática al guardar/cancelar

### Producto Crédito
- ⏳ Pendiente (aplicar mismo patrón)

### Producto Línea de Crédito
- ⏳ Pendiente (aplicar mismo patrón)

## 🚀 Próximos Pasos

1. **Aplicar a Producto Crédito**
   - Importar `useProductoPersistence` y `useProductoTabs`
   - Definir interface de datos
   - Reemplazar useState con hooks de persistencia

2. **Aplicar a Producto Línea de Crédito**
   - Mismo proceso que Producto Crédito

3. **Extender a Tabs Específicos**
   - Cada tab puede tener su propio hook de persistencia
   - Key pattern: `producto_{tipo}_{id}_tab_{tabName}`

4. **Testing**
   - Probar navegación entre módulos
   - Verificar persistencia en todos los escenarios
   - Validar limpieza de datos

## 📝 Ejemplo de Uso Completo

```typescript
// En ProductoCaptacionForm.tsx

import { useProductoPersistence, useProductoTabs } from '../../hooks/useProductoPersistence';

export function ProductoCaptacionForm({ mode, productoId, onSave, onCancel }) {
  // 1. Definir datos iniciales
  const initialFormData = {
    clave: generarClave(),
    producto: '',
    tipoProducto: '',
    // ... más campos
  };

  // 2. Hook de persistencia
  const storageKey = `producto_captacion_${productoId || 'nuevo'}`;
  const { 
    data: formData, 
    updateField, 
    updateFields, 
    clearPersistedData 
  } = useProductoPersistence(storageKey, initialFormData);

  // 3. Hook de tabs
  const [activeTab, setActiveTab] = useProductoTabs(storageKey, 'default');

  // 4. Handler de cambios
  const handleInputChange = (field, value) => {
    if (!isViewMode) {
      updateField(field, value); // ← Guarda automáticamente
    }
  };

  // 5. Handler de guardar
  const handleSave = () => {
    // Validar...
    onSave(formData);
    clearPersistedData(); // ← Limpia sessionStorage
  };

  // 6. Uso en JSX
  return (
    <input
      value={formData.producto}
      onChange={(e) => handleInputChange('producto', e.target.value)}
    />
  );
}
```

## 🎯 Resultado Final

Con esta implementación, el sistema de Core Banking ahora tiene:

✅ **Persistencia automática** de todos los datos ingresados  
✅ **Patrón maestro-detalle** claro y mantenible  
✅ **Navegación sin pérdida** de información  
✅ **Restauración completa** del estado al regresar  
✅ **API limpia** y fácil de usar  
✅ **Escalable** a los tres módulos de productos  
✅ **Performance óptimo** con actualizaciones reactivas
