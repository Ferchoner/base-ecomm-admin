import type { StatusStyle } from '~/components/StatusBadge.vue'
import type { EventDeliveryStatus } from './types'

/** API_SPEC §22.1: PENDING mientras le quedan intentos, DELIVERED al entregarse, FAILED tras 8. */
export const DELIVERY_STATUS: Record<EventDeliveryStatus, StatusStyle> = {
  PENDING: { label: 'Pendiente', color: 'warning' },
  DELIVERED: { label: 'Entregada', color: 'success' },
  FAILED: { label: 'Fallida', color: 'error' },
}

/** Intentos que hace el sistema antes de marcar una entrega como fallida (API_SPEC §22). */
export const MAX_ATTEMPTS = 8

/** Sin `status`, la API lista solo las FAILED (API_SPEC §22.1). "Todos" envía todos los valores. */
export const ALL_DELIVERY_STATUSES = 'ALL'
export const DELIVERY_STATUS_FILTER = [
  { value: 'FAILED', label: 'Fallidas' },
  { value: 'PENDING', label: 'Pendientes' },
  { value: 'DELIVERED', label: 'Entregadas' },
  { value: ALL_DELIVERY_STATUSES, label: 'Todos los estados' },
]

export function deliveryStatusQuery(filter: string | undefined): string {
  if (filter === ALL_DELIVERY_STATUSES) return Object.keys(DELIVERY_STATUS).join(',')
  return filter ?? 'FAILED'
}

/** Orden por `occurredAt` (defecto `-occurredAt`) o `nextAttemptAt` (API_SPEC §22.1). */
export const DELIVERY_SORT_OPTIONS = [
  { value: '-occurredAt', label: 'Más recientes primero' },
  { value: 'occurredAt', label: 'Más antiguos primero' },
  { value: 'nextAttemptAt', label: 'Próximo intento primero' },
  { value: '-nextAttemptAt', label: 'Próximo intento al final' },
]

/** Solo una entrega FAILED se puede reintentar (API_SPEC §22.2). */
export function canRetryDelivery(status: string): boolean {
  return status === 'FAILED'
}

/** Texto que explica a qué entregas afecta el reintento masivo con los filtros dados. */
export function bulkRetryScope({ eventType, handler }: { eventType?: string; handler?: string }) {
  if (eventType && handler)
    return `las fallidas del evento ${eventType} con el manejador ${handler}`
  if (eventType) return `las fallidas del evento ${eventType}`
  if (handler) return `las fallidas del manejador ${handler}`
  return 'todas las entregas fallidas'
}

/**
 * Fecha relevante según el estado: la entrega, el próximo intento de una PENDING, o ninguna en una
 * FAILED, que ya no se reintenta sola (API_SPEC §22.1).
 */
export function deliveryMoment(d: {
  status: string
  deliveredAt: string | null
  nextAttemptAt: string | null
}): { label: string; at: string | null } {
  if (d.status === 'DELIVERED') return { label: 'Entregada', at: d.deliveredAt }
  if (d.status === 'PENDING') return { label: 'Próximo intento', at: d.nextAttemptAt }
  return { label: 'Próximo intento', at: null }
}
