import type { StatusStyle } from '~/components/StatusBadge.vue'
import type { CustomerStatus } from './types'

export const CUSTOMER_STATUS: Record<CustomerStatus, StatusStyle> = {
  ACTIVE: { label: 'Activo', color: 'success' },
  SUSPENDED: { label: 'Suspendido', color: 'warning' },
  ANONYMIZED: { label: 'Anonimizado', color: 'neutral' },
}

export const CUSTOMER_STATUS_OPTIONS = (Object.keys(CUSTOMER_STATUS) as CustomerStatus[]).map(
  (value) => ({ value: value as string, label: CUSTOMER_STATUS[value].label }),
)

export const EMAIL_VERIFIED_OPTIONS = [
  { value: 'true', label: 'Email verificado' },
  { value: 'false', label: 'Email sin verificar' },
]

export const CUSTOMER_SORT_OPTIONS = [
  { value: '-createdAt', label: 'Registro más reciente' },
  { value: 'createdAt', label: 'Registro más antiguo' },
  { value: 'email', label: 'Email (A-Z)' },
  { value: '-lastLoginAt', label: 'Último acceso reciente' },
]

/** Transiciones documentadas (API_SPEC §9.18). Las cuentas anonimizadas no cambian (ADR-0076). */
export const CUSTOMER_ACTIONS = {
  suspend: ['ACTIVE'],
  reactivate: ['SUSPENDED'],
  anonymize: ['ACTIVE', 'SUSPENDED'],
} as const satisfies Record<string, readonly CustomerStatus[]>

export function canRunCustomer(action: keyof typeof CUSTOMER_ACTIONS, status: string): boolean {
  return (CUSTOMER_ACTIONS[action] as readonly string[]).includes(status)
}

/** Nombre visible; en una cuenta anonimizada no queda ninguno. */
export function customerName(c: Pick<AdminCustomerLike, 'firstNames' | 'lastNames'>): string {
  return [c.firstNames, c.lastNames].filter(Boolean).join(' ') || 'Sin nombre'
}
interface AdminCustomerLike {
  firstNames: string | null
  lastNames: string | null
}
