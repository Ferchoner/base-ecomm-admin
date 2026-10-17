import type { Page, Schemas } from '~/shared/api/types'

// Órdenes de trabajo (API_SPEC §25, ADR-0165 a ADR-0167).
export type WorkOrder = Schemas['WorkOrderDto']
export type WorkOrderSummary = Schemas['WorkOrderSummaryDto']
export type WorkOrderPage = Page<WorkOrderSummary>
export type WorkOrderStatus = WorkOrder['status']
export type WorkOrderHistoryEntry = Schemas['WorkOrderStatusEntryDto']
export type LinkedSale = Schemas['LinkedSaleDto']
export type ReceiveWorkOrderInput = Schemas['ReceiveWorkOrderDto']
export type UpdateWorkOrderInput = Schemas['UpdateWorkOrderDto']
export type ChangeWorkOrderStatusInput = Schemas['ChangeWorkOrderStatusDto']
export type BlockedWorkOrderData = Schemas['BlockedWorkOrderDataDto']
export type ServiceNote = Schemas['ServiceNoteDto']
export type StaffUser = Schemas['StaffUserDto']
export type CustomerOption = Schemas['AdminCustomerDto']
export type StoreSale = Schemas['AdminOrderSummaryDto']
export type WarehouseOption = Schemas['WarehouseDto']

/** Filtros de `GET /v1/admin/work-orders` (API_SPEC §25.3). */
export interface WorkOrderListParams {
  page: number
  pageSize: number
  q?: string
  status?: string
  warehouseId?: string
  technicianId?: string
  receivedFrom?: string
  receivedTo?: string
  sort?: string
}
