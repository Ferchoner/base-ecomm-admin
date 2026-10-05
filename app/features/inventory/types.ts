import type { CursorPage, Page, Schemas } from '~/shared/api/types'

export type Warehouse = Schemas['WarehouseDto']
export type WarehouseUpdateInput = Schemas['UpdateWarehouseDto']
export type AddressInput = Schemas['AddressInputDto']
export type StockItem = Schemas['StockItemDto']
export type StockItemPage = Page<StockItem>
export type StockMovement = Schemas['StockMovementDto']
export type StockMovementPage = CursorPage<StockMovement>
export type MovementType = StockMovement['type']
export type StockEntry = Schemas['StockEntryDto']
export type ReceiptInput = Schemas['ReceiptDto']
export type AdjustmentReason = Schemas['AdjustmentDto']['reasonCode']

/**
 * `AdjustmentDto` en openapi/v1.json no declara `quantity`, pero API_SPEC §13 lo exige (entero con
 * signo, distinto de 0). Por prioridad de fuentes se agrega aquí (GAPS G-11).
 */
export type AdjustmentInput = Schemas['AdjustmentDto'] & { quantity: number }

/** Filtros de `GET /v1/admin/inventory/stock-items` (API_SPEC §13). */
export interface StockListParams {
  page: number
  pageSize: number
  q?: string
  availableMax?: number
  sort?: string
}
