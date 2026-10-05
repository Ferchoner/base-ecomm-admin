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

/** Pesos escritos en un formulario: enteros o con hasta 2 decimales (`599`, `549.9`). */
export const PESOS_PATTERN = /^\d+(\.\d{1,2})?$/

/** Pesos escritos (`599.5`) → centavos, sin errores de coma flotante. */
export function pesosTextToCents(text: string): number {
  const [int, dec = ''] = text.trim().split('.')
  return Number(int) * 100 + Number(dec.padEnd(2, '0'))
}

/** Centavos → pesos para un campo de formulario (`59950` → `599.50`, `59900` → `599`). */
export function centsToPesosText(cents: number): string {
  const pesos = Math.floor(cents / 100)
  const rest = cents % 100
  return rest === 0 ? String(pesos) : `${pesos}.${String(rest).padStart(2, '0')}`
}
