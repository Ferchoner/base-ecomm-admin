import type { Money } from '~/shared/api/types'

const formatters = new Map<string, Intl.NumberFormat>()

function formatter(currency: string): Intl.NumberFormat {
  let f = formatters.get(currency)
  if (!f) {
    f = new Intl.NumberFormat('es-MX', { style: 'currency', currency })
    formatters.set(currency, f)
  }
  return f
}

/** `Money` de la API (centavos enteros, API_SPEC §8.1) → `$1,299.00`. */
export function formatMoney(money: Money | null | undefined): string {
  if (!money) return '—'
  return formatter(money.currency).format(money.amount / 100)
}

/** Pesos escritos por el usuario (`1299.5`) → centavos enteros para las solicitudes. */
export function pesosToCents(pesos: number): number {
  return Math.round(pesos * 100)
}
