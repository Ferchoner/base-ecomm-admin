import type { Page, Schemas } from '~/shared/api/types'

export type AdminPayment = Schemas['AdminPaymentDto']
export type PaymentPage = Page<AdminPayment>
export type PaymentAttempt = Schemas['PaymentAttemptDto']
export type Refund = Schemas['RefundDto']
export type ManualRefundInput = Schemas['ManualRefundDto']
/** Pago tal como viene dentro de `AdminOrder` (API_SPEC §8.9). */
export type OrderPayment = Schemas['AdminOrderPaymentDto']

/** Filtros de `GET /v1/admin/payments` (API_SPEC §16.3). */
export interface PaymentListParams {
  page: number
  pageSize: number
  status?: string
  provider?: string
  orderId?: string
  capturedFrom?: string
  capturedTo?: string
  sort?: string
}
