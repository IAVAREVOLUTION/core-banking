-- =============================================================================
-- SEED: Línea Global de Garantías NAFIN + sus dos SubLíneas de Carta de Crédito
--
-- Da de alta los tres productos que los MD 00/02/03 describen, ya cableados
-- entre sí: la Línea Global lista a las dos SubLíneas en su subtab "Productos
-- Disposición" (`paquetes`), que es lo que alimenta el combo de Nueva
-- Disposición (CA-01).
--
-- Son DATOS, no esquema: no crea ni altera tablas. Cada producto es una fila de
-- J_PRODUCTOS (id uuid, type text, data jsonb) con type='ProductoLineaCredito',
-- exactamente como las escribe el formulario vía syncToJProducts.
--
-- IDEMPOTENTE: los UUID son fijos y el INSERT hace ON CONFLICT DO UPDATE, así
-- que se puede volver a correr para reconfigurar sin duplicar. Eso también es lo
-- que permite que la Línea Global apunte a las SubLíneas por id sin dos pasos.
--
-- OJO con la cobertura máxima: se deja en 50%. El trigger `trg_validar_cobertura_gpo`
-- está VIVO en esta base y rechaza cualquier cobertura > 50 que pase por
-- J_COTIZACIONES. Para usar 70% hay que ajustar ese trigger primero; mientras
-- tanto, 50 es el techo que no rompe nada.
--
-- HOW TO DEPLOY: paste into Supabase → SQL Editor → Run
-- =============================================================================

-- ── 1. SubLínea Carta de Crédito AUTOMÁTICA ──────────────────────────────────
-- Sin fases: la modalidad se DERIVA de eso (MD 12 §3). `modalidadResolucion`
-- va sólo como respaldo informativo.
INSERT INTO "EFINANCIANET_DB"."J_PRODUCTOS" (id, type, data)
VALUES (
  'a1f00000-0000-4000-8000-000000000002',
  'ProductoLineaCredito',
  jsonb_build_object(
    'localId', 9002,
    'nombreProducto', 'SubLínea Carta de Crédito Automática',
    'claveProducto',  'SUBLC-AUT',
    'descripcion',    'Disposición de Línea Global NAFIN por Carta de Crédito, resuelta por reglas automáticas.',
    'tipoProducto',   'Línea de Crédito',
    'lineaProducto',  'Línea de Crédito',
    'subTipo',        'Global',
    'sublineaProducto','Global',
    'tipoLinea',      'No Revolvente',
    'sucursal',       'Ciudad de México',
    'estatus',        'Activo',
    'moneda',         'MXN',
    'fechaRegistro',  to_char(now(), 'YYYY-MM-DD'),

    -- Campos nuevos del MD 01
    'naturalezaFinanciera',       'Contingente',
    'tipoCartaPermitida',         'Ambas',
    'modalidadResolucion',        'Automatica',
    'productoPadreRequerido',     true,
    'requiereLineaGlobalActiva',  true,
    'consumeDisponibleAlActivar', true,
    'monedasPermitidas',          jsonb_build_array('MXN', 'USD'),

    -- Campos reutilizados (MD 01 §Prioridad 1)
    'destino',                'Carta de Crédito',
    'permiteSobregiros',      false,
    'montoMinimo',            '1000000',
    'montoMaximo',            '50000000',
    'plazoMinimoDisposicion', '30',
    'plazoMaximoDisposicion', '360',
    'vigenciaLineaDias',      '360',
    'numDisposicionesAbiertas','10',

    -- Sin fases => Automática
    'fases', '[]'::jsonb,

    'cobertura2oPiso', jsonb_build_array(jsonb_build_object(
      'id', 1, 'productId', 9002,
      'porcentajeMinCobertura', 20, 'porcentajeDefaultCobertura', 50, 'porcentajeMaxCobertura', 50,
      'sobreCobertura', 'Saldo Garantizado',
      'porcentajeMinComision', 1, 'porcentajeDefaultComision', 2, 'porcentajeMaxComision', 3,
      'sobreComision', 'Saldo Garantizado'
    )),

    'cargo', '[]'::jsonb,
    'expedientes', '[]'::jsonb,
    'paquetes', '[]'::jsonb
  )
)
ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, data = EXCLUDED.data;


-- ── 2. SubLínea Carta de Crédito SELECTIVA ───────────────────────────────────
-- Las 5 fases del MD 03 con 2 requisitos cada una (MD 03 §Requisitos, CA-03).
INSERT INTO "EFINANCIANET_DB"."J_PRODUCTOS" (id, type, data)
VALUES (
  'a1f00000-0000-4000-8000-000000000003',
  'ProductoLineaCredito',
  jsonb_build_object(
    'localId', 9003,
    'nombreProducto', 'SubLínea Carta de Crédito Selectiva',
    'claveProducto',  'SUBLC-SEL',
    'descripcion',    'Disposición de Línea Global NAFIN por Carta de Crédito, con Originación individual de 5 fases.',
    'tipoProducto',   'Línea de Crédito',
    'lineaProducto',  'Línea de Crédito',
    'subTipo',        'Global',
    'sublineaProducto','Global',
    'tipoLinea',      'No Revolvente',
    'sucursal',       'Ciudad de México',
    'estatus',        'Activo',
    'moneda',         'MXN',
    'fechaRegistro',  to_char(now(), 'YYYY-MM-DD'),

    'naturalezaFinanciera',       'Contingente',
    'tipoCartaPermitida',         'Ambas',
    'modalidadResolucion',        'Selectiva',
    'productoPadreRequerido',     true,
    'requiereLineaGlobalActiva',  true,
    'consumeDisponibleAlActivar', true,
    'monedasPermitidas',          jsonb_build_array('MXN', 'USD'),

    'destino',                'Carta de Crédito',
    'permiteSobregiros',      false,
    'montoMinimo',            '1000000',
    'montoMaximo',            '50000000',
    'plazoMinimoDisposicion', '30',
    'plazoMaximoDisposicion', '360',
    'vigenciaLineaDias',      '360',
    'numDisposicionesAbiertas','10',

    -- Las 5 fases exactas del MD 03. Se incluye `seq` además de `numeroFase`
    -- porque el motor de fases de la Solicitud lee `seq` para ordenar.
    'fases', jsonb_build_array(
      jsonb_build_object('id',1,'fase','Integración de Expediente','numeroFase',1,'seq',1,'posicion','1','area','Promoción'),
      jsonb_build_object('id',2,'fase','Evaluación',               'numeroFase',2,'seq',2,'posicion','2','area','Riesgos'),
      jsonb_build_object('id',3,'fase','Aprobación',               'numeroFase',3,'seq',3,'posicion','3','area','Comité'),
      jsonb_build_object('id',4,'fase','Instrumentación',          'numeroFase',4,'seq',4,'posicion','4','area','Jurídico'),
      jsonb_build_object('id',5,'fase','Activación',               'numeroFase',5,'seq',5,'posicion','5','area','Operaciones')
    ),

    'cobertura2oPiso', jsonb_build_array(jsonb_build_object(
      'id', 1, 'productId', 9003,
      'porcentajeMinCobertura', 20, 'porcentajeDefaultCobertura', 50, 'porcentajeMaxCobertura', 50,
      'sobreCobertura', 'Saldo Garantizado',
      'porcentajeMinComision', 1, 'porcentajeDefaultComision', 2, 'porcentajeMaxComision', 3,
      'sobreComision', 'Saldo Garantizado'
    )),

    -- Requisitos OK: 2 por fase (MD 03). `claveDocumento` queda vacío a
    -- propósito — si el documento existe en J_CATALOGOS, conviene reasignarlo
    -- desde la UI para que herede su promptIA.
    'expedientes', jsonb_build_array(
      jsonb_build_object('id',1,'tipo','Documento','claveDocumento','','descripcion','Solicitud / Información de Carta de Crédito','obligatorio',true,'persona','Ambas','fase','Integración de Expediente','formato','PDF','area','Promoción','promptIA',''),
      jsonb_build_object('id',2,'tipo','Documento','claveDocumento','','descripcion','Información del Acreditado Final','obligatorio',true,'persona','Ambas','fase','Integración de Expediente','formato','PDF','area','Promoción','promptIA',''),
      jsonb_build_object('id',3,'tipo','Documento','claveDocumento','','descripcion','Información Financiera del Acreditado Final','obligatorio',true,'persona','Ambas','fase','Evaluación','formato','PDF','area','Riesgos','promptIA',''),
      jsonb_build_object('id',4,'tipo','Documento','claveDocumento','','descripcion','Dictamen de Riesgo','obligatorio',true,'persona','Ambas','fase','Evaluación','formato','PDF','area','Riesgos','promptIA',''),
      jsonb_build_object('id',5,'tipo','Documento','claveDocumento','','descripcion','Resolución de Autorización','obligatorio',true,'persona','Ambas','fase','Aprobación','formato','PDF','area','Comité','promptIA',''),
      jsonb_build_object('id',6,'tipo','Documento','claveDocumento','','descripcion','Condiciones Autorizadas','obligatorio',true,'persona','Ambas','fase','Aprobación','formato','PDF','area','Comité','promptIA',''),
      jsonb_build_object('id',7,'tipo','Documento','claveDocumento','','descripcion','Carta de Crédito Definitiva','obligatorio',true,'persona','Ambas','fase','Instrumentación','formato','PDF','area','Jurídico','promptIA',''),
      jsonb_build_object('id',8,'tipo','Documento','claveDocumento','','descripcion','Documento / Convenio de Formalización','obligatorio',true,'persona','Ambas','fase','Instrumentación','formato','PDF','area','Jurídico','promptIA',''),
      jsonb_build_object('id',9,'tipo','Documento','claveDocumento','','descripcion','Condiciones Precedentes Cumplidas','obligatorio',true,'persona','Ambas','fase','Activación','formato','PDF','area','Operaciones','promptIA',''),
      jsonb_build_object('id',10,'tipo','Documento','claveDocumento','','descripcion','Disponible Suficiente en Línea Global','obligatorio',true,'persona','Ambas','fase','Activación','formato','PDF','area','Operaciones','promptIA','')
    ),

    'cargo', '[]'::jsonb,
    'paquetes', '[]'::jsonb
  )
)
ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, data = EXCLUDED.data;


-- ── 3. LÍNEA GLOBAL DE GARANTÍAS NAFIN (producto padre) ──────────────────────
-- `paquetes` es el subtab "Productos Disposición": es lo que `productosDisposicionDe()`
-- lee para llenar el combo de Nueva Disposición. `selectBoolean=true` marca la
-- casilla "Sel", que es la que manda (§Decisión 1a).
--
-- NO lleva naturalezaFinanciera='Contingente': la Línea Global es el padre, no
-- una SubLínea, y marcarla así haría que `esSubLineaCartaCredito()` la confunda.
INSERT INTO "EFINANCIANET_DB"."J_PRODUCTOS" (id, type, data)
VALUES (
  'a1f00000-0000-4000-8000-000000000001',
  'ProductoLineaCredito',
  jsonb_build_object(
    'localId', 9001,
    'nombreProducto', 'Línea Global de Garantías NAFIN',
    'claveProducto',  'LG-NAFIN-001',
    'descripcion',    'Línea Global de Garantías para Intermediarios Financieros — Programa Garantía para Carta de Crédito.',
    'tipoProducto',   'Línea de Crédito',
    'lineaProducto',  'Línea de Crédito',
    'subTipo',        'Global',
    'sublineaProducto','Global',
    'tipoLinea',      'Revolvente',
    'sucursal',       'Ciudad de México',
    'estatus',        'Activo',
    'moneda',         'MXN',
    'fechaRegistro',  to_char(now(), 'YYYY-MM-DD'),

    'destino',                'Carta de Crédito',
    'permiteSobregiros',      false,
    'montoMinimo',            '10000000',
    'montoMaximo',            '400000000',
    'plazoMinimoDisposicion', '30',
    'plazoMaximoDisposicion', '1800',
    'vigenciaLineaDias',      '1800',
    'numDisposicionesAbiertas','50',

    -- Productos Disposición → las dos SubLíneas. `paqueteProductoId` es el UUID
    -- del hijo en J_PRODUCTOS, que es por donde la pantalla resuelve su config.
    'paquetes', jsonb_build_array(
      jsonb_build_object(
        'id', 1,
        'paqueteProductoId',   'a1f00000-0000-4000-8000-000000000002',
        'paqueteProductoNombre','SubLínea Carta de Crédito Automática',
        'lineaProducto', 'Línea de Crédito',
        'sublineaProducto', 'Global',
        'tipo', 'Carta de Crédito',
        'selectBoolean', true
      ),
      jsonb_build_object(
        'id', 2,
        'paqueteProductoId',   'a1f00000-0000-4000-8000-000000000003',
        'paqueteProductoNombre','SubLínea Carta de Crédito Selectiva',
        'lineaProducto', 'Línea de Crédito',
        'sublineaProducto', 'Global',
        'tipo', 'Carta de Crédito',
        'selectBoolean', true
      )
    ),

    'cobertura2oPiso', jsonb_build_array(jsonb_build_object(
      'id', 1, 'productId', 9001,
      'porcentajeMinCobertura', 20, 'porcentajeDefaultCobertura', 50, 'porcentajeMaxCobertura', 50,
      'sobreCobertura', 'Saldo Garantizado',
      'porcentajeMinComision', 1, 'porcentajeDefaultComision', 2, 'porcentajeMaxComision', 3,
      'sobreComision', 'Saldo Garantizado'
    )),

    'fases', '[]'::jsonb,
    'cargo', '[]'::jsonb,
    'expedientes', '[]'::jsonb
  )
)
ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, data = EXCLUDED.data;


-- ── Verificación ─────────────────────────────────────────────────────────────
SELECT data->>'claveProducto'                                  AS clave,
       data->>'nombreProducto'                                 AS nombre,
       data->>'naturalezaFinanciera'                           AS naturaleza,
       data->>'destino'                                        AS destino,
       jsonb_array_length(COALESCE(data->'fases','[]'::jsonb))       AS fases,
       jsonb_array_length(COALESCE(data->'expedientes','[]'::jsonb)) AS requisitos,
       jsonb_array_length(COALESCE(data->'paquetes','[]'::jsonb))    AS prods_disposicion
  FROM "EFINANCIANET_DB"."J_PRODUCTOS"
 WHERE data->>'claveProducto' IN ('LG-NAFIN-001','SUBLC-AUT','SUBLC-SEL')
 ORDER BY clave;
