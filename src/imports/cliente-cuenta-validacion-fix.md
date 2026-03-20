Objetivo
Evitar que, al editar un cliente, el sistema dispare la validación:

“La cuenta XXXX ya está asignada a otro cliente”

cuando no se está asignando ninguna cuenta, solo editando datos personales.

1. Problema institucional detectado
El módulo Cliente está ejecutando la validación:

Código
validarCuentaAsignada(no_cuenta)
en momentos donde no corresponde, específicamente:

Al abrir el formulario de Editar.

Al guardar cambios que NO tienen relación con cuentas.

Al cargar datos del cliente.

Al reconstruir el JSON.

Además, la validación está mal implementada porque:

No excluye la cuenta del propio cliente.

No valida si el campo no_cuenta realmente cambió.

No valida si el módulo actual es el de Cuentas de Ahorro.

No valida si el usuario está editando datos personales y no cuentas.

2. Regla institucional correcta para validar cuentas
La validación de unicidad de cuentas solo debe ejecutarse cuando:

El usuario está en el módulo Cuentas de Ahorro

El usuario presiona Guardar en una cuenta

El campo no_cuenta fue modificado

La cuenta pertenece a un cliente distinto

3. Validación correcta que debe implementarse
3.1 Validar solo si el campo cambió
js
if (no_cuenta_nuevo !== no_cuenta_original) {
    ejecutarValidacion = true;
}
3.2 Validar solo en el módulo Cuentas de Ahorro
js
if (moduloActual === 'Cuentas de Ahorro') {
    ejecutarValidacion = true;
}
3.3 Validar excluyendo la cuenta del mismo cliente
sql
SELECT cliente_id
FROM "EFINANCIANET_DB"."J_CUENTAS_CORP_CLIENTES"
WHERE no_cuenta = '<NO_CUENTA>'
  AND cliente_id <> '<ID_CLIENTE_ACTUAL>';
Si devuelve un registro → la cuenta está asignada a otro cliente  
Si devuelve cero → la cuenta es válida

4. Reglas institucionales obligatorias para el módulo Cliente
4.1 El módulo Cliente NO debe validar cuentas
El módulo Cliente:

No asigna cuentas

No edita cuentas

No crea cuentas

No debe ejecutar validaciones de unicidad de cuentas

4.2 El formulario Cliente solo debe trabajar con:
Campos físicos: type, subtipo, estatus

JSON data completo

Arrays: direcciones, SIC, listas negras, expedientes

4.3 El módulo Cliente NO debe consultar J_CUENTAS_CORP_CLIENTES
excepto para mostrar el subtab de cuentas.

5. Corrección institucional del flujo
❌ Flujo actual (incorrecto)
Abres Editar Cliente

El sistema carga datos

El sistema detecta no_cuenta en algún lado del JSON

Ejecuta validación de unicidad

Encuentra que la cuenta pertenece a otro cliente

Muestra el mensaje aunque NO estás asignando cuentas

✔ Flujo corregido (institucional)
Abres Editar Cliente

El sistema carga datos desde data

NO ejecuta validación de cuentas

Guardas cambios

NO ejecuta validación de cuentas

Solo actualiza data con MERGE JSON

6. Mensaje institucional que debe mostrarse SOLO en Cuentas de Ahorro
Si el usuario intenta asignar una cuenta que ya pertenece a otro cliente:

Código
La cuenta <NO_CUENTA> ya está asignada a: <NOMBRE_CLIENTE> (ID: <ID_CLIENTE>)
Pero nunca en el módulo Cliente.

7. Resultado esperado
Después de aplicar este prompt:

Ya NO aparecerá la notificación al editar un cliente.

La validación solo se ejecutará en el módulo correcto.

El módulo Cliente dejará de consultar cuentas innecesariamente.

El formulario Cliente cargará y guardará sin errores.

No se bloquearán ediciones por validaciones ajenas.