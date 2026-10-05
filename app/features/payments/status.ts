import type { AdminPayment } from './types'

export const PAYMENT_SORT_OPTIONS = [
  { value: '-createdAt', label: 'Más recientes' },
  { value: 'createdAt', label: 'Más antiguos' },
  { value: '-amount', label: 'Monto: mayor a menor' },
  { value: 'amount', label: 'Monto: menor a mayor' },
]

/**
 * El reembolso manual solo aplica a pagos MANUAL con un reembolso pendiente (API_SPEC §16.5). Solo
 * decide si se ofrece el botón; la API responde 409 si no procede.
 */
export function canRegisterManualRefund(payment: AdminPayment): boolean {
  return payment.provider === 'MANUAL' && payment.refunds.some((r) => r.status === 'PENDING')
}
