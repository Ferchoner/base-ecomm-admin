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
export type WarehouseOption = Schemas['WarehouseDto']
export type ManualPaymentSettings = Schemas['PaymentSettingsDto']

// Pedidos en la tienda física (API_SPEC §15.7, UC-ORD-12 a 14, ADR-0161).
export type StaffQuoteInput = Schemas['StaffQuoteDto']
export type StaffOrderInput = Schemas['PlaceStaffOrderDto']
export type StaffOrderLine = Schemas['StaffOrderLineDto']
export type OrderFulfillment = NonNullable<StaffQuoteInput['fulfillment']>
export type StaffQuote = Schemas['CheckoutQuoteDto']
export type StaffQuoteLine = Schemas['CheckoutQuoteLineDto']
/** Existencias por almacén para elegir variantes (`GET …/inventory/stock-items`, `inventory.read`). */
export type SellableStock = Schemas['StockItemDto']
/** Cliente registrado a nombre de quien se coloca el pedido (`customers.read`). */
export type BuyerCustomer = Schemas['AdminCustomerDto']
export type BuyerAddress = Schemas['AddressDto']
export type ManualPaymentMethod = NonNullable<ManualCaptureInput['method']>
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
