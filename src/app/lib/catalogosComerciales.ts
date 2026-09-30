/**
 * catalogosComerciales.ts — catálogos compartidos del ciclo comercial
 * (Prospecto → Oportunidad → Solicitud).
 *
 * Nace para quitar una duplicación viva: `CAT_SECTOR_INFRAESTRUCTURA` estaba
 * copiado carácter por carácter en `ProspectoForm.tsx` y en `OportunidadForm.tsx`
 * —el segundo hasta lo declaraba con el comentario "Mismo catálogo del subtab
 * Perfil de Prospecto"—, así que agregar un valor obligaba a tocar dos archivos
 * y olvidarse de uno dejaba los combos desalineados entre pantallas.
 */

/**
 * Sector de la operación.
 *
 * ── Por qué la etiqueta dice "Sector" y la clave sigue diciendo "infraestructura"
 * El campo nació para Garantía Financiera 2º Piso de BANOBRAS, donde toda
 * operación era obra pública, y la clave del dato es `sectorInfraestructura`.
 * Esa clave NO se renombra: la leen 16 archivos, viaja en el JSONB de
 * Prospectos, Oportunidades y Solicitudes ya guardados, y además es una de las
 * señales con las que `esGPOForm` (SolicitudCreditoForm) reconoce una Solicitud
 * de 2º Piso. Renombrarla rompería registros históricos y la detección del
 * producto a cambio de nada visible.
 *
 * Lo que sí cambia es la ETIQUETA, que pasa a ser sólo "Sector": el catálogo ya
 * no describe únicamente infraestructura.
 *
 * `Comercio Internacional` entra por las Cartas de Crédito: garantizan
 * operaciones de compraventa internacional a través de un intermediario
 * financiero, que no son un sector de obra.
 */
export const CAT_SECTOR = [
  'Transporte/Carreteras',
  'Energía',
  'Agua/Medio Ambiente',
  'Social/Urbano',
  'Comercio Internacional',
] as const;

/** Etiqueta visible del campo. Un solo lugar para que no vuelva a divergir. */
export const LABEL_SECTOR = 'Sector';
