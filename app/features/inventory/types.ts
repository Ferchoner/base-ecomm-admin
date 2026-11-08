import type { CursorPage, Page, Schemas } from '~/shared/api/types'

export type Warehouse = Schemas['WarehouseDto']
export type WarehouseCreateInput = Schemas['CreateWarehouseDto']
export type WarehouseUpdateInput = Schemas['UpdateWarehouseDto']
export type WarehouseStatus = Warehouse['status']
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
  /** Exacta o, con `*` al final, por prefijo (ADR-0173). */
  location?: string
  hasLocation?: boolean
  sort?: string
}

/** Ubicación de una existencia (API_SPEC §13, ADR-0173, versión 1.12). */
export type StockLocationInput = Schemas['StockLocationDto']

/** Traslados y préstamos entre almacenes (API_SPEC §13, ADR-0172, versión 1.11). */
export type Transfer = Schemas['TransferDto']
export type TransferLine = Schemas['TransferLineDto']
export type TransferPage = Page<Transfer>
export type TransferKind = Transfer['kind']
export type TransferStatus = Transfer['status']
export type TransferReason = Transfer['reason']
export type TransferCreateInput = Schemas['CreateTransferDto']
export type CloseLoanInput = Schemas['CloseLoanDto']

/** Filtros de `GET /v1/admin/inventory/transfers`. */
export interface TransferListParams {
  page: number
  pageSize: number
  kind?: TransferKind
  status?: TransferStatus
  warehouseId?: string
  overdue?: boolean
}

/** Carga masiva de entradas de mercancía (API_SPEC §13, ADR-0164). */
export type ReceiptImportSummary = Schemas['ReceiptImportSummaryDto']

/** Hojas de conteo (API_SPEC §13, ADR-0173, versión 1.12). */
export type Count = Schemas['CountDto']
export type CountSummary = Schemas['CountSummaryDto']
export type CountLine = Schemas['CountLineDto']
export type CountPage = Page<CountSummary>
export type CountStatus = Count['status']
export type CountOutcome = NonNullable<CountLine['outcome']>
export type CountCreateInput = Schemas['CreateCountDto']
export type CountClass = NonNullable<CountCreateInput['countClass']>
export type CountFilter = Schemas['CountFilterDto']

/** Filtros de `GET /v1/admin/inventory/counts`. */
export interface CountListParams {
  page: number
  pageSize: number
  warehouseId?: string
  status?: CountStatus
}
