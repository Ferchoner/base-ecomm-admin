import type { CursorPage, Page, Schemas } from '~/shared/api/types'

export type Warehouse = Schemas['WarehouseDto']
export type WarehouseCreateInput = Schemas['CreateWarehouseDto']
export type WarehouseUpdateInput = Schemas['UpdateWarehouseDto']
export type WarehouseStatus = Warehouse['status']
export type AddressInput = Schemas['AddressInputDto']
export type StockItem = Schemas['StockItemDto']
export type StockItemPage = Page<StockItem>
export type StockMovement = Schemas['StockMovementDto']
export type StockMovementPage = CursorPage<StockMovement>
export type MovementType = StockMovement['type']
export type StockEntry = Schemas['StockEntryDto']
export type ReceiptInput = Schemas['ReceiptDto']
export type AdjustmentReason = Schemas['AdjustmentDto']['reasonCode']
export type AdjustmentInput = Schemas['AdjustmentDto']

/** Filtros de `GET /v1/admin/inventory/stock-items` (API_SPEC §13). */
export interface StockListParams {
  page: number
  pageSize: number
  q?: string
  warehouseId?: string
  availableMax?: number
  sort?: string
}
