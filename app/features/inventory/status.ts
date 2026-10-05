import type { StatusStyle } from '~/components/StatusBadge.vue'
import type { AdjustmentReason, MovementType, StockMovement } from './types'

export const MOVEMENT_TYPE: Record<MovementType, StatusStyle> = {
  RECEIPT: { label: 'Entrada', color: 'success' },
  ADJUSTMENT: { label: 'Ajuste', color: 'warning' },
  SALE: { label: 'Venta', color: 'info' },
  RESTOCK: { label: 'Reintegro', color: 'secondary' },
}

export const MOVEMENT_TYPE_OPTIONS = (Object.keys(MOVEMENT_TYPE) as MovementType[]).map(
  (value) => ({
    value: value as string,
    label: MOVEMENT_TYPE[value].label,
  }),
)

type Reason = NonNullable<StockMovement['reasonCode']>

/** Motivos de ajuste y de reintegro (StockMovementDto.reasonCode). */
export const REASON_LABEL: Record<Reason, string> = {
  PHYSICAL_COUNT: 'Conteo físico',
  DAMAGED: 'Dañado',
  LOSS_OR_THEFT: 'Pérdida o robo',
  INTERNAL_USE: 'Uso interno',
  DATA_ENTRY_ERROR: 'Error de captura',
  OTHER: 'Otro',
  ORDER_CANCELLED: 'Orden cancelada',
  SHIPMENT_RETURNED: 'Envío devuelto',
}

/** Motivos que solo restan unidades (API_SPEC §13, `reasonDirection`). */
export const DECREASE_ONLY: readonly AdjustmentReason[] = [
  'DAMAGED',
  'LOSS_OR_THEFT',
  'INTERNAL_USE',
]

export const ADJUSTMENT_REASONS: AdjustmentReason[] = [
  'PHYSICAL_COUNT',
  'DAMAGED',
  'LOSS_OR_THEFT',
  'INTERNAL_USE',
  'DATA_ENTRY_ERROR',
  'OTHER',
]

export const STOCK_SORT_OPTIONS = [
  { value: 'sku', label: 'SKU (A–Z)' },
  { value: 'available', label: 'Menos disponibles primero' },
  { value: '-available', label: 'Más disponibles primero' },
  { value: '-updatedAt', label: 'Movidos recientemente' },
]
