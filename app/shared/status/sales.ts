import type { StatusStyle } from '~/components/StatusBadge.vue'
import type { Schemas } from '~/shared/api/types'

// Estados del contrato que se muestran en varias features (pedidos, pagos y envíos). Solo etiquetas:
// las transiciones las decide cada feature. Un valor nuevo se muestra crudo (StatusBadge).

export type OrderStatus = Schemas['AdminOrderDto']['status']
export type PaymentStatus = Schemas['AdminPaymentDto']['status']
export type PaymentProvider = Schemas['AdminPaymentDto']['provider']
export type RefundStatus = Schemas['RefundDto']['status']
export type ShipmentStatus = Schemas['AdminShipmentDto']['status']
export type OrderChannel = Schemas['AdminOrderDto']['channel']
export type OrderFulfillment = Schemas['AdminOrderDto']['fulfillment']

/** API_SPEC §8.8, §15.7. */
export const ORDER_STATUS: Record<OrderStatus, StatusStyle> = {
  PENDING_PAYMENT: { label: 'Por cobrar', color: 'warning' },
  PAID: { label: 'Pagado', color: 'info' },
  AWAITING_MANUAL_FULFILLMENT: { label: 'Esperando surtido', color: 'error' },
  SHIPPED: { label: 'Enviado', color: 'primary' },
  DELIVERED: { label: 'Entregado', color: 'success' },
  CANCELLED: { label: 'Cancelado', color: 'neutral' },
  EXPIRED: { label: 'Vencido', color: 'neutral' },
  REFUNDED: { label: 'Reembolsado', color: 'secondary' },
}

/** Dónde se colocó la orden (API_SPEC §8.9, ADR-0161). */
export const ORDER_CHANNEL: Record<OrderChannel, StatusStyle> = {
  ONLINE: { label: 'En línea', color: 'neutral' },
  STORE: { label: 'En tienda', color: 'primary' },
}

/** Cómo se entrega la orden (API_SPEC §8.8, ADR-0161). */
export const ORDER_FULFILLMENT: Record<OrderFulfillment, string> = {
  SHIPPING: 'Envío a domicilio',
  IN_STORE: 'Entrega en tienda',
}

/** API_SPEC §16.3. */
export const PAYMENT_STATUS: Record<PaymentStatus, StatusStyle> = {
  PENDING: { label: 'Pendiente', color: 'warning' },
  REQUIRES_ACTION: { label: 'Requiere acción', color: 'warning' },
  AUTHORIZED: { label: 'Autorizado', color: 'info' },
  CAPTURED: { label: 'Cobrado', color: 'success' },
  FAILED: { label: 'Fallido', color: 'error' },
  CANCELLED: { label: 'Cancelado', color: 'neutral' },
  PARTIALLY_REFUNDED: { label: 'Reembolso parcial', color: 'secondary' },
  REFUNDED: { label: 'Reembolsado', color: 'secondary' },
}

export const PAYMENT_PROVIDER: Record<PaymentProvider, string> = {
  MANUAL: 'En tienda',
  PAYPAL: 'PayPal',
}

/** Cómo cobró la tienda un pago manual (API_SPEC §16.4, ADR-0161). */
export const PAYMENT_METHOD: Record<NonNullable<Schemas['PaymentAttemptDto']['method']>, string> = {
  CASH: 'Efectivo',
  CARD_TERMINAL: 'Terminal bancaria',
  TRANSFER: 'Transferencia',
}

export const REFUND_STATUS: Record<RefundStatus, StatusStyle> = {
  PENDING: { label: 'Reembolso pendiente', color: 'warning' },
  COMPLETED: { label: 'Reembolso completado', color: 'success' },
  FAILED: { label: 'Reembolso fallido', color: 'error' },
}

/** API_SPEC §17 (ADR-0140). */
export const SHIPMENT_STATUS: Record<ShipmentStatus, StatusStyle> = {
  PENDING: { label: 'Por despachar', color: 'warning' },
  DISPATCHED: { label: 'En camino', color: 'info' },
  DELIVERED: { label: 'Entregado', color: 'success' },
  DELIVERY_FAILED: { label: 'Entrega fallida', color: 'error' },
  RETURNED: { label: 'Devuelto', color: 'secondary' },
  CANCELLED: { label: 'Cancelado', color: 'neutral' },
}

export function statusOptions<K extends string>(styles: Record<K, StatusStyle>) {
  return (Object.keys(styles) as K[]).map((value) => ({
    value: value as string,
    label: styles[value].label,
  }))
}
