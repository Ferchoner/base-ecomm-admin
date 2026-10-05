import type { QueryClient } from '@tanstack/vue-query'

/**
 * Raíz de las llaves de TanStack Query de cada feature. Una feature no importa a otra (D-P17), pero
 * algunas acciones cambian datos de otro contexto (cancelar un pedido inicia su reembolso y cancela
 * su envío), así que se invalidan por raíz.
 */
export const QUERY_ROOT = {
  orders: 'orders',
  payments: 'payments',
  shipping: 'shipping',
  inventory: 'inventory',
} as const

export type QueryRoot = (typeof QUERY_ROOT)[keyof typeof QUERY_ROOT]

/** Espera antes de volver a consultar lo que cambia en segundo plano. */
export const BACKGROUND_REFETCH_MS = 2500

export const BACKGROUND_NOTICE = 'El estado del pedido puede tardar unos segundos en actualizarse.'

/**
 * Invalida ahora las raíces que la respuesta ya refleja y, tras un momento, las que cambian por un
 * evento en segundo plano (API_SPEC §2.5): nunca se supone el estado final.
 */
export function invalidateRoots(
  qc: QueryClient,
  now: readonly QueryRoot[],
  later: readonly QueryRoot[] = [],
) {
  for (const root of now) void qc.invalidateQueries({ queryKey: [root] })
  if (later.length === 0) return
  setTimeout(() => {
    for (const root of later) void qc.invalidateQueries({ queryKey: [root] })
  }, BACKGROUND_REFETCH_MS)
}
