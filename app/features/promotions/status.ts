import type { StatusStyle } from '~/components/StatusBadge.vue'
import { formatMoney } from '~/shared/utils/money'
import type {
  PromotionChannel,
  PromotionStatus,
  PromotionSummary,
  PromotionTargetType,
} from './types'

/** Estado calculado al consultar (API_SPEC §26.1). */
export const PROMOTION_STATUS: Record<PromotionStatus, StatusStyle> = {
  SCHEDULED: { label: 'Programada', color: 'info' },
  ACTIVE: { label: 'Vigente', color: 'success' },
  ENDED: { label: 'Terminada', color: 'neutral' },
}

export const PROMOTION_STATUS_OPTIONS = (Object.keys(PROMOTION_STATUS) as PromotionStatus[]).map(
  (value) => ({ value: value as string, label: PROMOTION_STATUS[value].label }),
)

export const PROMOTION_CHANNEL: Record<PromotionChannel, string> = {
  ONLINE: 'En línea',
  STORE: 'Tienda física',
}

export const CHANNEL_OPTIONS = (Object.keys(PROMOTION_CHANNEL) as PromotionChannel[]).map(
  (value) => ({ value: value as string, label: PROMOTION_CHANNEL[value] }),
)

export const KIND_OPTIONS = [
  { value: 'AUTOMATIC', label: 'Automáticas' },
  { value: 'COUPON', label: 'Cupones' },
]

export const APPLIES_TO_OPTIONS = [
  { value: 'ORDER', label: 'Toda la compra' },
  { value: 'ITEMS', label: 'Ciertos productos' },
]

export const PROMOTION_SORT_OPTIONS = [
  { value: '-startsAt', label: 'Inicio: más recientes' },
  { value: 'startsAt', label: 'Inicio: más antiguas' },
  { value: 'name', label: 'Nombre (A–Z)' },
  { value: '-name', label: 'Nombre (Z–A)' },
]

export const TARGET_TYPE: Record<PromotionTargetType, string> = {
  PRODUCT: 'Producto',
  CATEGORY: 'Categoría',
  BRAND: 'Marca',
}

/** "10%" o "$100.00", con la compra mínima si la hay. */
export function discountLabel(p: Pick<PromotionSummary, 'percentage' | 'amountOff'>): string {
  if (p.percentage !== null) return `${p.percentage}%`
  return p.amountOff ? formatMoney(p.amountOff) : '—'
}

export function usesLabel(p: Pick<PromotionSummary, 'code' | 'uses' | 'usageLimit'>): string {
  if (!p.code) return '—'
  return p.usageLimit !== null ? `${p.uses} de ${p.usageLimit}` : String(p.uses)
}

/**
 * Qué se puede editar según el estado (API_SPEC §26.5): antes de su inicio, todo; ya iniciada, solo
 * el nombre, el fin y el límite de usos; terminada, nada. Solo decide la interfaz; la API valida.
 */
export type PromotionField =
  | 'name'
  | 'discount'
  | 'targets'
  | 'channels'
  | 'minimumSubtotal'
  | 'startsAt'
  | 'endsAt'
  | 'code'
  | 'usageLimit'
  | 'oncePerCustomer'

export function editableFields(status: PromotionStatus | undefined): Set<PromotionField> {
  if (status === 'ENDED') return new Set()
  if (status === 'ACTIVE') return new Set(['name', 'endsAt', 'usageLimit'])
  return new Set([
    'name',
    'discount',
    'targets',
    'channels',
    'minimumSubtotal',
    'startsAt',
    'endsAt',
    'code',
    'usageLimit',
    'oncePerCustomer',
  ])
}
