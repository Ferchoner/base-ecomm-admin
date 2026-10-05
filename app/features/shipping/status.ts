import { SHIPMENT_STATUS } from '~/shared/status/sales'
import type { ShipmentStatus } from '~/shared/status/sales'

export const SHIPMENT_SORT_OPTIONS = [
  { value: 'createdAt', label: 'Más antiguos primero' },
  { value: '-createdAt', label: 'Más recientes primero' },
  { value: '-dispatchedAt', label: 'Despachados recientemente' },
  { value: 'dispatchedAt', label: 'Despachados hace más tiempo' },
]

/** Sin `status`, la API lista solo los PENDING (UC-SHI-08). "Todos" envía todos los valores. */
export const ALL_SHIPMENT_STATUSES = 'ALL'
export const SHIPMENT_STATUS_FILTER = [
  ...(Object.keys(SHIPMENT_STATUS) as ShipmentStatus[]).map((value) => ({
    value: value as string,
    label: SHIPMENT_STATUS[value].label,
  })),
  { value: ALL_SHIPMENT_STATUSES, label: 'Todos los estados' },
]

/** Valor de `status` que se envía a la API a partir del filtro de la URL. */
export function shipmentStatusQuery(filter: string | undefined): string {
  if (filter === ALL_SHIPMENT_STATUSES) return Object.keys(SHIPMENT_STATUS).join(',')
  return filter ?? 'PENDING'
}

/**
 * Transiciones documentadas (API_SPEC §17, ADR-0141). Solo deciden qué botón se ofrece; si la API
 * rechaza la acción, se muestra su 409.
 */
export const SHIPMENT_ACTIONS = {
  dispatch: ['PENDING'],
  deliver: ['DISPATCHED'],
  deliveryFailure: ['DISPATCHED'],
  return: ['DELIVERY_FAILED'],
} as const satisfies Record<string, readonly ShipmentStatus[]>

export type ShipmentAction = keyof typeof SHIPMENT_ACTIONS

export function canRunShipment(action: ShipmentAction, status: string): boolean {
  return (SHIPMENT_ACTIONS[action] as readonly string[]).includes(status)
}

/** Paquetería y guía: en PENDING y DISPATCHED, salvo en una entrega propia (API_SPEC §17). */
export function canEditTracking(shipment: { status: string; ownDelivery: boolean }): boolean {
  if (shipment.status === 'PENDING') return true
  return shipment.status === 'DISPATCHED' && !shipment.ownDelivery
}
