En “Nuevo Producto Crédito”, cuáles subtabs deben aparecer vacíos y cuáles NO.

⭐ Subtabs que DEBEN estar VACÍOS al crear un “Nuevo Producto Crédito”
Estos subtabs siempre deben iniciar completamente en blanco, porque un producto nuevo no tiene configuraciones, matrices, reglas, garantías, ni documentos asociados.

🟦 Deben estar VACÍOS:
Descuento en Nómina  
(No hay configuración previa para un producto nuevo)

Periodos  
(No existen periodos hasta que el usuario los agregue)

Matriz tasa fija  
(Debe estar 100% vacía — sin filas)

Tasa referencia  
(Vacía — no hay tasas asociadas aún)

Matriz tasa variable  
(Vacía — sin registros)

Requisitos  
(Vacío — no hay documentos requeridos todavía)

Paquetes  
(Vacío — no hay seguros ni servicios asociados)

Sucursal  
(Vacío — no hay sucursales asignadas al producto)

Cargo  
(Vacío — no hay cargos configurados)

Prelación de cargos  
(Vacío — no existe orden de cargos aún)

Fases  
(Vacío — no hay fases operativas definidas)

Garantías  
(Vacío — no hay garantías asociadas)

Impuestos  
(Vacío — no hay reglas fiscales configuradas)

Comisión  
(Vacío — no hay comisiones definidas)

Tabulador de Productos  
(Vacío — no hay tabuladores cargados)

Amortizaciones  
(Vacío — no hay tablas de amortización predefinidas)

Expedientes Electrónicos  
(Vacío — no hay documentos asociados a un producto nuevo)

Autorización  
(Vacío — no hay flujos de autorización configurados)

Evento Contable  
(Vacío — no hay reglas contables asociadas)

⭐ Subtabs que NO deben estar vacíos
Solo dos subtabs deben tener información desde el inicio:

🟩 NO deben estar vacíos:
Default  
Este subtab es el formulario principal y sí debe tener valores default, como:

Línea de Producto = Crédito

Estatus = Pendiente

Fecha Registro = hoy

Base Cálculo = 360

Tipo Tasa = Fija (si aplica)

Descuento en Nómina  
Este subtab no debe estar vacío si el producto tiene un checkbox o configuración default.
Si no tiene defaults → entonces sí debe estar vacío.

(Depende de tu configuración actual, pero normalmente trae al menos el checkbox.)