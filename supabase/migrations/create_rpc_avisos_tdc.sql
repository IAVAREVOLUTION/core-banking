-- =============================================================================
-- RPC: obtener_avisos_tdc — consulta de Avisos de Vencimiento / CxC de TDC
--
-- `obtener_cxc_pagables` (ESPECIFICACIÓN 4) sirve para APLICAR pagos: filtra
-- por cliente y descarta lo ya pagado, porque el motor sólo necesita lo que
-- puede recibir dinero. Para CONSULTAR hace falta lo contrario: todas las CxC,
-- en cualquier estatus, filtrables por línea o por cliente.
--
-- Por eso es una función aparte y no un parámetro más de aquélla: mezclar los
-- dos usos terminaría con un filtro mal puesto dejando entrar a la aplicación
-- de pagos documentos ya pagados o reclasificados.
--
-- ORDEN DE DESPLIEGUE: después de create_rpc_aplicacion_pagos_tdc.sql
-- (necesita las columnas pago_total / saldo_pendiente que aquélla agrega).
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'EFINANCIANET_DB'
       AND table_name   = 'J_CXC_LINEA'
       AND column_name  = 'pago_total'
  ) THEN
    RAISE EXCEPTION
      'Falta ejecutar create_rpc_aplicacion_pagos_tdc.sql (ESPECIFICACIÓN 4), que agrega pago_total y saldo_pendiente a J_CXC_LINEA.';
  END IF;
END $$;

-- =============================================================================
-- Columnas de estado contable — creadas aquí a propósito
--
-- `contabilizado` y `poliza_id` las agrega create_rpc_contabilidad_tdc.sql
-- (ESPECIFICACIÓN 5). Pero CONSULTAR los avisos no debería exigir que la
-- contabilidad esté desplegada: son dos cosas independientes, y mientras se
-- prueba el flujo operativo la contabilización está apagada.
--
-- Se crean con IF NOT EXISTS y la MISMA definición que usa aquella migración,
-- así que correr cualquiera de las dos en cualquier orden da el mismo
-- resultado. Sin esto, este script falla con 42703 cuando ESPEC 5 no se ha
-- ejecutado.
-- =============================================================================
ALTER TABLE "EFINANCIANET_DB"."J_CXC_LINEA"
  ADD COLUMN IF NOT EXISTS contabilizado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS poliza_id     uuid;

DROP FUNCTION IF EXISTS public.obtener_avisos_tdc(text, text);

CREATE OR REPLACE FUNCTION public.obtener_avisos_tdc(
  -- Ambos opcionales: sin filtros devuelve todos los avisos (módulo Cobranza);
  -- con línea, los de esa Línea de Crédito (subtab de Cartera TDC).
  p_linea_id   text DEFAULT NULL,
  p_cliente_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid, folio text, linea_id text, cliente_id text, solicitud_id text,
  producto_id text, fecha_inicio date, fecha_fin date,
  fecha_documento date, fecha_vencimiento date,
  monto_total_pagar numeric, monto_minimo_pagar numeric,
  pago_total numeric, saldo_pendiente numeric,
  cantidad_cargos integer, moneda text, estatus text,
  fecha_ultimo_pago date, contabilizado boolean, poliza_id uuid,
  creado_en timestamptz, detalle jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = "EFINANCIANET_DB", public
AS $$
  SELECT x.id, x.folio, x.linea_id, x.cliente_id, x.solicitud_id,
         x.producto_id, x.fecha_inicio, x.fecha_fin,
         x.fecha_documento, x.fecha_vencimiento,
         x.monto_total_pagar, x.monto_minimo_pagar,
         COALESCE(x.pago_total, 0),
         -- Derivado, no confiado: una fila vieja puede tener saldo_pendiente
         -- NULL, y mostrarlo vacío haría parecer que no se debe nada.
         COALESCE(x.saldo_pendiente, x.monto_total_pagar - COALESCE(x.pago_total, 0)),
         x.cantidad_cargos, x.moneda, x.estatus,
         x.fecha_ultimo_pago, COALESCE(x.contabilizado, false), x.poliza_id,
         x.creado_en,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
                    'id',             d.id,
                    'claveConcepto',  d.clave_concepto,
                    'nombreConcepto', d.nombre_concepto,
                    'monto',          d.monto,
                    'pagoTotal',      COALESCE(d.pago_total, 0),
                    'saldoPendiente', COALESCE(d.saldo_pendiente, d.monto - COALESCE(d.pago_total, 0)),
                    'fechaCargo',     d.fecha_cargo,
                    'naturaleza',     d.naturaleza,
                    'ordenPrelacion', d.orden_prelacion,
                    'bFactura',       d.b_factura,
                    'estatusPago',    COALESCE(d.estatus_pago, 'Pendiente'),
                    'cargoId',        d.cargo_id)
                  ORDER BY d.orden_prelacion, d.id)
             FROM "EFINANCIANET_DB"."J_CXC_LINEA_DETALLE" d
            WHERE d.cxc_id = x.id
         ), '[]'::jsonb)
    FROM "EFINANCIANET_DB"."J_CXC_LINEA" x
   WHERE (p_linea_id   IS NULL OR p_linea_id   = '' OR x.linea_id   = p_linea_id)
     AND (p_cliente_id IS NULL OR p_cliente_id = '' OR x.cliente_id = p_cliente_id)
   ORDER BY x.fecha_vencimiento DESC, x.creado_en DESC;
$$;

GRANT EXECUTE ON FUNCTION public.obtener_avisos_tdc(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.obtener_avisos_tdc(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.obtener_avisos_tdc(text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
