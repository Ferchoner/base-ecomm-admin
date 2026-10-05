import type { Page, Schemas } from '~/shared/api/types'

export type AdminShipment = Schemas['AdminShipmentDto']
export type ShipmentPage = Page<AdminShipment>
export type ShipmentItem = Schemas['ShipmentItemDto']
/** Envío tal como viene dentro de `AdminOrder` (API_SPEC §8.9). */
export type OrderShipment = Schemas['AdminOrderShipmentDto']

/**
 * `PATCH …/shipments/{id}` (API_SPEC §17): las dos en texto, o las dos en `null` para quitarlas de
 * un envío PENDING (ADR-0141).
 */
export interface TrackingInput {
  carrierName: string | null
  trackingNumber: string | null
  version: number
}

/** Filtros de `GET /v1/admin/shipping/shipments` (API_SPEC §17). */
export interface ShipmentListParams {
  page: number
  pageSize: number
  status?: string
  orderId?: string
  q?: string
  createdFrom?: string
  createdTo?: string
  sort?: string
}
