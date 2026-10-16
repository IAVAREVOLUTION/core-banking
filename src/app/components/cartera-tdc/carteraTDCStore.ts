/**
 * carteraTDCStore — criterio único para decidir qué cuenta pertenece a Cartera TDC.
 *
 * Vive aparte del módulo para que Cartera de Crédito pueda importarlo y
 * EXCLUIR estas cuentas sin crear un ciclo de imports. Es el mismo patrón que
 * ya usan `esArrendamientoPuroRow` y `esLineaCredito2oPisoRow`: una cuenta se
 * administra en un solo módulo, nunca en dos.
 */
import { esTarjetaCredito } from '../solicitudes/solicitudCreditoStore';

/**
 * true si la fila de J_CUENTAS_CORP_CLIENTES corresponde a una Tarjeta de
 * Crédito. Se revisan tipo de producto y nombre porque las Solicitudes creadas
 * desde Cierre Comercial guardan un `tipo_producto` genérico.
 */
export function esCuentaTDCRow(
  lineaProducto?: string,
  tipoProducto?: string,
  nombreProducto?: string,
): boolean {
  return esTarjetaCredito(tipoProducto, nombreProducto, lineaProducto);
}
