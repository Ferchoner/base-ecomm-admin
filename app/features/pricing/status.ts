import type { StatusStyle } from '~/components/StatusBadge.vue'
import type { PricePeriodState } from './types'

export const PERIOD_STATE: Record<PricePeriodState, StatusStyle> = {
  CURRENT: { label: 'Vigente', color: 'success' },
  SCHEDULED: { label: 'Programado', color: 'info' },
  PAST: { label: 'Anterior', color: 'neutral' },
}
