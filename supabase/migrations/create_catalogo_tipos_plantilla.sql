-- =============================================================================
-- Catálogo de Tipos de Plantilla — Configuración → Tipos de Plantilla
--
-- Hasta ahora los tipos vivían en una constante de TypeScript
-- (TIPO_PLANTILLA_CATALOGO en src/app/types/product.ts). Esta tabla los vuelve
-- datos, igual que J_CATALOGO_COMPONENTES hizo con los componentes contables.
--
-- ── La distinción que hace que esto sea seguro ───────────────────────────
-- `es_sistema` marca los tipos que el CÓDIGO consume por su clave literal:
--
--     'contrato' y 'pagare'   → kit legal de Fase 4
--     'carta-oferta'          → Oportunidades → Generar Carta Oferta
--     'contrato-gpo'          → Formalización Legal GPO
--     'estado-cuenta'         → Cartera TDC → Estado de Cuenta (REQ-31)
--
-- Cambiarles la clave o borrarlos rompe un flujo en producción. Por eso la
-- UI no permite ninguna de las dos cosas sobre un tipo de sistema: se puede
-- cambiar su etiqueta, su ícono y su color, nada más.
--
-- Un tipo NUEVO creado aquí sirve para clasificar y archivar plantillas, pero
-- ningún proceso lo generará automáticamente hasta que se programe: eso es
-- inevitable, porque generar un documento exige saber qué datos lleva.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "EFINANCIANET_DB"."J_CATALOGO_TIPOS_PLANTILLA" (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- La clave con la que el código y las plantillas ya guardadas se refieren
  -- al tipo. Es el identificador real: estable, en minúsculas y con guiones.
  clave        text NOT NULL UNIQUE,
  nombre       text NOT NULL,
  descripcion  text,
  -- Nombre del icono de lucide-react (p. ej. 'FileSignature'), no un emoji.
  icono        text,
  color        text,
  activo       boolean NOT NULL DEFAULT true,
  -- true = lo consume un proceso del sistema; la clave queda bloqueada.
  es_sistema   boolean NOT NULL DEFAULT false,
  orden        integer NOT NULL DEFAULT 100,
  creado_en    timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_tipos_plantilla_clave
    CHECK (clave ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE INDEX IF NOT EXISTS idx_tipos_plantilla_activo
  ON "EFINANCIANET_DB"."J_CATALOGO_TIPOS_PLANTILLA" (activo, orden);

-- =============================================================================
-- Semilla — exactamente los siete tipos que hoy existen en la constante.
--
-- ON CONFLICT DO NOTHING para que correr el script dos veces sea inofensivo y
-- para no pisar cambios de etiqueta que el usuario haya hecho en Configuración.
-- =============================================================================
INSERT INTO "EFINANCIANET_DB"."J_CATALOGO_TIPOS_PLANTILLA"
  (clave, nombre, descripcion, icono, color, es_sistema, orden)
VALUES
  ('solicitud', 'Solicitud de Crédito',
   'Formato de solicitud formal del producto financiero por parte del cliente',
   'ClipboardList', '#2196F3', true, 10),

  ('contrato', 'Contrato de Operación',
   'Instrumento legal que formaliza la relación jurídica entre la institución y el cliente',
   'FileSignature', '#4CAF50', true, 20),

  ('pagare', 'Pagare',
   'Título de crédito que ampara la obligación de pago a favor de la institución',
   'Banknote', '#FF9800', true, 30),

  ('minuta', 'Minuta de Acuerdos',
   'Registro formal de acuerdos, términos y condiciones pactados entre las partes',
   'FileText', '#9C27B0', true, 40),

  ('carta-oferta', 'Carta Oferta',
   'Propuesta comercial formal con la estructura bursátil y la cotización de comisiones de la Oportunidad',
   'Mail', '#0099CC', true, 50),

  ('contrato-gpo', 'Contrato de Garantía de Pago Oportuno',
   'Instrumento que documenta la garantía financiera de segundo piso sobre la emisión bursátil',
   'ShieldCheck', '#7C3AED', true, 60),

  ('estado-cuenta', 'Estado de Cuenta',
   'Documento periódico con el corte, los movimientos y los pagos de la Línea de Crédito',
   'Receipt', '#0EA5E9', true, 70)
ON CONFLICT (clave) DO NOTHING;

-- Si una corrida anterior sembró EMOJIS en `icono`, se convierten al nombre
-- del icono de lucide-react equivalente. La aplicación ya normaliza al leer,
-- así que esto es sólo para dejar limpio el dato almacenado.
UPDATE "EFINANCIANET_DB"."J_CATALOGO_TIPOS_PLANTILLA" SET icono = CASE icono
    WHEN '📋' THEN 'ClipboardList'
    WHEN '📄' THEN 'FileSignature'
    WHEN '📝' THEN 'Banknote'
    WHEN '📑' THEN 'FileText'
    WHEN '📨' THEN 'Mail'
    WHEN '🛡️' THEN 'ShieldCheck'
    WHEN '🛡'   THEN 'ShieldCheck'
    WHEN '🧾' THEN 'Receipt'
    ELSE icono
  END
 WHERE icono IS NOT NULL AND icono !~ '^[A-Za-z]+$';

-- Si el script se corrió antes de que existiera 'estado-cuenta', esto lo
-- agrega sin tocar el resto.
UPDATE "EFINANCIANET_DB"."J_CATALOGO_TIPOS_PLANTILLA"
   SET es_sistema = true
 WHERE clave IN ('solicitud','contrato','pagare','minuta','carta-oferta','contrato-gpo','estado-cuenta')
   AND es_sistema = false;

-- =============================================================================
-- NOTAS
--
-- 1. El acceso desde la aplicación pasa por la Edge Function
--    make-server-7e2d13d9, ruta /tipos-plantilla — mismo patrón que
--    /componentes-contables. No hace falta RPC ni GRANT: la función usa la
--    conexión de servicio.
--
-- 2. Comprobación de integridad: ninguna plantilla ya guardada debería
--    apuntar a una clave inexistente. Las plantillas viven en el JSONB del
--    producto, así que la consulta es sobre `data`:
--
--      SELECT DISTINCT p->>'tipoPlantilla' AS clave_huerfana
--        FROM "EFINANCIANET_DB"."J_PRODUCTOS" pr,
--             jsonb_array_elements(COALESCE(pr.data->'plantillas','[]'::jsonb)) p
--       WHERE p->>'tipoPlantilla' NOT IN (
--             SELECT clave FROM "EFINANCIANET_DB"."J_CATALOGO_TIPOS_PLANTILLA");
--
--    Debe devolver cero filas. Si devuelve alguna, ese tipo se borró del
--    catálogo teniendo plantillas que lo usaban.
-- =============================================================================
