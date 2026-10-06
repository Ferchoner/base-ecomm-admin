import type { OrderStatus } from '~/shared/status/sales'
import type { AdminOrder, RestockReason } from './types'

export const ORDER_SORT_OPTIONS = [
  { value: '-placedAt', label: 'Más recientes' },
  { value: 'placedAt', label: 'Más antiguos' },
  { value: '-grandTotal', label: 'Total: mayor a menor' },
  { value: 'grandTotal', label: 'Total: menor a mayor' },
  { value: '-orderNumber', label: 'Número: mayor a menor' },
  { value: 'orderNumber', label: 'Número: menor a mayor' },
]

export const GUEST_OPTIONS = [
  { value: 'false', label: 'Solo clientes' },
  { value: 'true', label: 'Solo invitados' },
]

/** `channel` de `GET /v1/admin/orders` (API_SPEC §15.7, ADR-0161). */
export const CHANNEL_OPTIONS = [
  { value: 'ONLINE', label: 'En línea' },
  { value: 'STORE', label: 'En tienda' },
]

/**
 * Estados desde los que la API documenta cada acción (API_SPEC §15.7, §16.4, §14.3). Solo deciden
 * qué botón se ofrece; si la API la rechaza, se muestra su 409.
 */
export const ORDER_ACTIONS = {
  cancel: ['PENDING_PAYMENT', 'PAID', 'AWAITING_MANUAL_FULFILLMENT'],
  manualCapture: ['PENDING_PAYMENT', 'EXPIRED'],
  retryFulfillment: ['AWAITING_MANUAL_FULFILLMENT'],
  reorder: ['CANCELLED', 'REFUNDED'],
} as const satisfies Record<string, readonly OrderStatus[]>

export type OrderAction = keyof typeof ORDER_ACTIONS

export function canRun(action: OrderAction, status: string): boolean {
  return (ORDER_ACTIONS[action] as readonly string[]).includes(status)
}

/** Cancelar desde PAID o AWAITING_MANUAL_FULFILLMENT inicia el reembolso total (ADR-0051). */
export function cancelStartsRefund(status: string): boolean {
  return status === 'PAID' || status === 'AWAITING_MANUAL_FULFILLMENT'
}

/**
 * Motivo del reintegro que la orden admite (API_SPEC §15.7): cancelada o reembolsada con el stock
 * confirmado (tuvo pago), o con el envío devuelto. `null` si no admite ninguno.
 */
export function restockReason(order: AdminOrder): RestockReason | null {
  if (order.shipment?.status === 'RETURNED') return 'SHIPMENT_RETURNED'
  if ((order.status === 'CANCELLED' || order.status === 'REFUNDED') && order.paidAt)
    return 'ORDER_CANCELLED'
  return null
}

export const RESTOCK_REASON_LABEL: Record<RestockReason, string> = {
  ORDER_CANCELLED: 'Orden cancelada',
  SHIPMENT_RETURNED: 'Envío devuelto',
}
