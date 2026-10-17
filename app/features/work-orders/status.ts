import type { StatusStyle } from '~/components/StatusBadge.vue'
import type { WorkOrderStatus } from './types'

/** API_SPEC §25.1, §25.6. */
export const WORK_ORDER_STATUS: Record<WorkOrderStatus, StatusStyle> = {
  RECEIVED: { label: 'Recibida', color: 'info' },
  DIAGNOSED: { label: 'Diagnosticada', color: 'secondary' },
  IN_REPAIR: { label: 'En reparación', color: 'warning' },
  READY: { label: 'Lista para entregar', color: 'success' },
  DELIVERED: { label: 'Entregada', color: 'neutral' },
  CANCELLED: { label: 'Cancelada', color: 'error' },
}

export const WORK_ORDER_STATUS_OPTIONS = (Object.keys(WORK_ORDER_STATUS) as WorkOrderStatus[]).map(
  (value): { value: string; label: string } => ({ value, label: WORK_ORDER_STATUS[value].label }),
)

/** Solo hacia adelante, aunque salte pasos; nunca regresa (API_SPEC §25.6). */
const FLOW: WorkOrderStatus[] = ['RECEIVED', 'DIAGNOSED', 'IN_REPAIR', 'READY', 'DELIVERED']

export function isClosed(status: WorkOrderStatus): boolean {
  return status === 'DELIVERED' || status === 'CANCELLED'
}

/** Los estados a los que puede pasar: los de adelante y cancelar, mientras esté abierta. */
export function nextStatuses(status: WorkOrderStatus): WorkOrderStatus[] {
  if (isClosed(status)) return []
  return [...FLOW.slice(FLOW.indexOf(status) + 1), 'CANCELLED']
}

export const WORK_ORDER_SORT_OPTIONS = [
  { value: '-receivedAt', label: 'Más recientes primero' },
  { value: 'receivedAt', label: 'Más antiguas primero' },
  { value: '-folio', label: 'Folio (mayor a menor)' },
  { value: 'folio', label: 'Folio (menor a mayor)' },
]

/** "Equipo: Laptop Lenovo ThinkPad T14". */
export function equipmentLabel(w: {
  equipmentType: string
  equipmentBrand: string | null
  equipmentModel: string | null
}): string {
  return [w.equipmentType, w.equipmentBrand, w.equipmentModel].filter(Boolean).join(' ')
}

/** Mensaje de `sale-not-linkable` según el estado de la venta (API_SPEC §25.7). */
export function saleNotLinkableMessage(saleStatus: unknown): string {
  const map: Record<string, string> = {
    EXPIRED: 'La venta venció sin pagarse: no se puede ligar.',
    CANCELLED: 'La venta está cancelada: no se puede ligar.',
    REFUNDED: 'La venta se reembolsó: no se puede ligar.',
  }
  return map[String(saleStatus)] ?? 'Esa venta no se puede ligar.'
}

/** Número del folio, si el texto lo es: `OT-000123`, `ot-123` o `123` (API_SPEC §25.3). */
export function folioNumber(text: string): number | null {
  const m = /^(?:ot-?)?0*(\d{1,10})$/i.exec(text.trim())
  return m ? Number(m[1]) : null
}
