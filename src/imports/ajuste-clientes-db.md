Ajusta el backend (Edge Function) y el hook useClientesDB para que coincidan con lo que espera ClientesList.tsx.

1️⃣ Endpoint único

Crear o corregir el endpoint:

/clientes-lista-todos

Debe:

Consultar la tabla: "EFINANCIANET_DB"."J_CLIENTES"

Seleccionar columnas:
id, type, subtipo, estatus, data

NO aplicar ningún filtro por type en el servidor

NO usar .eq("type"), .filter(), .in() ni query params

SQL lógico:

SELECT id, type, subtipo, estatus, data
FROM "EFINANCIANET_DB"."J_CLIENTES";
2️⃣ Respuesta del endpoint

Debe devolver:

{
  "data": [...],
  "_endpoint": "clientes-lista-todos",
  "_version": "v1",
  "_diagnostico": {
    "tabla": "EFINANCIANET_DB.J_CLIENTES",
    "filtros": "NINGUNO",
    "totalRegistros": 0
  }
}
3️⃣ Hook useClientesDB

Debe:

Consumir SOLO:
/clientes-lista-todos

Eliminar cualquier fallback a:
/clientes-only, /clientes-prospectos, /clientes-lista

Aplicar filtro SOLO en frontend:

registros.filter(r => r.type === "Cliente")
4️⃣ Mapeo a ClienteDB

Convertir cada registro en:

{
  dbUuid: row.id,
  tipo: row.type,
  subtipo: row.subtipo,
  estatus: row.estatus,
  idCliente: row.data.idCliente ?? row.data.idProspecto ?? "",
  nombreCompleto: `${row.data.nombre ?? ""} ${row.data.apellidoPaterno ?? ""} ${row.data.apellidoMaterno ?? ""}`.trim(),
  curp: row.data.curp ?? "",
  rfc: row.data.rfc ?? "",
  telefono: row.data.telefono ?? "",
  correoElectronico: row.data.correoElectronico ?? "",
  fechaOriginacion: row.data.fechaOriginacion ?? ""
}
5️⃣ Diagnóstico

El hook debe exponer:

totalRegistrosServidor

totalRegistrosCliente

conteosPorType

endpointName = "clientes-lista-todos"

Para que el panel de diagnóstico de ClientesList.tsx funcione sin errores.

❗ Regla crítica:

El backend NO debe filtrar por type

El frontend es el único responsable de:

type === "Cliente"