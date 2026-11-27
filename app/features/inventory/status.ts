import type { StatusStyle } from '~/components/StatusBadge.vue'
import type {
  AdjustmentReason,
  CountFilter,
  CountOutcome,
  CountStatus,
  MovementType,
  StockMovement,
  Transfer,
  TransferReason,
  TransferStatus,
  WarehouseStatus,
} from './types'

export const WAREHOUSE_STATUS: Record<WarehouseStatus, StatusStyle> = {
  ACTIVE: { label: 'Activo', color: 'success' },
  INACTIVE: { label: 'Inactivo', color: 'neutral' },
}

export const MOVEMENT_TYPE: Record<MovementType, StatusStyle> = {
  RECEIPT: { label: 'Entrada', color: 'success' },
  ADJUSTMENT: { label: 'Ajuste', color: 'warning' },
  SALE: { label: 'Venta', color: 'info' },
  RESTOCK: { label: 'Reintegro', color: 'secondary' },
  TRANSFER: { label: 'Traslado', color: 'primary' },
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
  WAREHOUSE_TRANSFER: 'Transferencia entre almacenes',
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

/** Estado de un traslado o un préstamo (ADR-0172). Un préstamo abierto y vencido se marca aparte. */
export const TRANSFER_STATUS: Record<TransferStatus, StatusStyle> = {
  COMPLETED: { label: 'Hecho', color: 'success' },
  OPEN: { label: 'Prestado', color: 'info' },
  CLOSED: { label: 'Cerrado', color: 'neutral' },
  CANCELLED: { label: 'Cancelado', color: 'neutral' },
}

export const OVERDUE_STYLE: StatusStyle = { label: 'Vencido', color: 'error' }

/** El estado que se muestra: un préstamo abierto pasada su hora de regreso, como vencido. */
export function transferStatusStyle(t: Pick<Transfer, 'status' | 'overdue'>): StatusStyle {
  return t.overdue ? OVERDUE_STYLE : TRANSFER_STATUS[t.status]
}

export const TRANSFER_REASON: Record<TransferReason, string> = {
  SALE: 'Para venderlo',
  RESTOCK: 'Para surtir',
  OTHER: 'Otro',
  SHOW: 'Para mostrar',
  LOAN_RETURN: 'Regreso de un préstamo',
}

/** Motivos de un traslado que elige el staff; un préstamo siempre es `SHOW`. */
export const TRANSFER_REASON_OPTIONS = (['SALE', 'RESTOCK', 'OTHER'] as const).map((value) => ({
  value,
  label: TRANSFER_REASON[value],
}))

/** Cuánto dura un préstamo (ADR-0172): de 5 minutos a 24 horas; el backoffice propone 1 hora. */
export const LOAN_MINUTES = { min: 5, max: 24 * 60, default: 60 } as const

export const LOAN_DURATION_OPTIONS = [
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 240, label: '4 horas' },
  { value: 24 * 60, label: 'Hasta mañana a esta hora' },
]

/** Un traslado o préstamo se cancela en sus primeros 10 minutos (`cancellableUntil`). */
export function canCancelNow(t: Pick<Transfer, 'cancellableUntil'>, now = Date.now()): boolean {
  return t.cancellableUntil !== null && Date.parse(t.cancellableUntil) >= now
}

export const STOCK_SORT_OPTIONS = [
  { value: 'sku', label: 'SKU (A–Z)' },
  { value: 'available', label: 'Menos disponibles primero' },
  { value: '-available', label: 'Más disponibles primero' },
  { value: '-updatedAt', label: 'Movidos recientemente' },
]

/** Estado de una hoja de conteo (ADR-0173). */
export const COUNT_STATUS: Record<CountStatus, StatusStyle> = {
  OPEN: { label: 'Abierta', color: 'info' },
  APPLIED: { label: 'Aplicada', color: 'success' },
  CANCELLED: { label: 'Cancelada', color: 'neutral' },
}

/** Lo que hizo aplicar la hoja con cada línea. */
export const COUNT_OUTCOME: Record<CountOutcome, StatusStyle> = {
  ADJUSTED: { label: 'Ajustada', color: 'warning' },
  NO_DIFFERENCE: { label: 'Sin diferencia', color: 'success' },
  NOT_COUNTED: { label: 'Sin contar', color: 'neutral' },
  SKIPPED_RESERVED: { label: 'No aplicada: apartadas', color: 'error' },
}

/** Clases para contar (ADR-0173): A cada semana, B cada mes, C cada trimestre; sin clase cuenta como C. */
export { COUNT_CLASS_OPTIONS } from '~/shared/status/count-class'

/** Con qué se abrió una hoja, en palabras. */
export function countFilterLabel(
  filter: CountFilter,
  categoryName: (id: string) => string = (id) => id,
): string {
  if (filter.variantIds)
    return `${filter.variantIds.length} ${filter.variantIds.length === 1 ? 'variante elegida' : 'variantes elegidas'}`
  return [
    filter.location &&
      (filter.location.endsWith('*')
        ? `Ubicaciones ${filter.location.slice(0, -1)}…`
        : `Ubicación ${filter.location}`),
    filter.categoryId && `Categoría ${categoryName(filter.categoryId)}`,
    filter.countClass && `Clase ${filter.countClass}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** La ubicación como la guarda la API (ADR-0173): sin espacios de sobra y en mayúsculas. */
export function normalizeLocation(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toUpperCase()
}

/** Parte una lista en grupos de `size`, como las hojas carta de etiquetas. */
export function chunkList<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/**
 * Las ubicaciones para etiquetas de estante, una por renglón o separadas por comas: normalizadas,
 * sin repetir ni vacías, de 1 a 20 caracteres, y en orden.
 */
export function parseLocations(text: string): { valid: string[]; invalid: string[] } {
  const all = [
    ...new Set(
      text
        .split(/[\n,]/)
        .map(normalizeLocation)
        .filter((l) => l !== ''),
    ),
  ]
  return {
    valid: all
      .filter((l) => l.length <= 20)
      .sort((a, b) => a.localeCompare(b, 'es', { numeric: true })),
    invalid: all.filter((l) => l.length > 20),
  }
}
