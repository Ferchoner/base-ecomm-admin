import type { Page, Schemas } from '~/shared/api/types'

/** Entrega de un evento de dominio a un manejador (API_SPEC §22, ADR-0150). */
export type EventDelivery = Schemas['EventDeliveryDto']
export type EventDeliveryStatus = EventDelivery['status']
export type EventDeliveryPage = Page<EventDelivery>

/** Filtros de `GET /v1/admin/event-deliveries` (API_SPEC §22.1). */
export interface EventDeliveryListParams {
  page: number
  pageSize: number
  status?: string
  eventType?: string
  handler?: string
  sort?: string
}

/** `POST /v1/admin/event-deliveries/retry` (API_SPEC §22.3). */
export type RetryDeliveriesInput = Schemas['RetryDeliveriesDto']
export type RetriedDeliveries = Schemas['RetriedDeliveriesDto']
