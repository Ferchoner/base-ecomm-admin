import type { Page, Schemas } from '~/shared/api/types'

export type AdminOrder = Schemas['AdminOrderDto']
export type AdminOrderSummary = Schemas['AdminOrderSummaryDto']
export type OrderPage = Page<AdminOrderSummary>
export type OrderLine = Schemas['AdminOrderLineDto']
export type StatusHistoryEntry = Schemas['StatusHistoryEntryDto']
export type CancelOrderInput = Schemas['CancelOrderDto']
export type ManualCaptureInput = Schemas['ManualCaptureDto']
export type RestockInput = Schemas['RestockOrderDto']
export type RestockReason = RestockInput['reasonCode']
export type RestockResult = Schemas['RestockDto']
export type BlockedOrderData = Schemas['BlockedOrderDataDto']
export type RestockWarehouse = Schemas['WarehouseDto']
export type ReorderResult = Schemas['ReorderDto']

/** Filtros de `GET /v1/admin/orders` (API_SPEC §15.7). */
export interface OrderListParams {
  page: number
  pageSize: number
  q?: string
  status?: string
  customerId?: string
  guest?: boolean
  hasPendingRefund?: boolean
  placedFrom?: string
  placedTo?: string
  channel?: string
  placedBy?: string
  sort?: string
}

/** Línea del 409 `restock-not-allowed` (API_SPEC §15.7, T-161). */
export interface RestockConflictLine {
  orderLineId: string
  sold: number
  restocked: number
  requested: number
}
