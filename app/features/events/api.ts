import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { ApiProblem } from '~/shared/api/problem'
import { useApi } from '~/shared/api/use-api'
import type {
  EventDeliveryListParams,
  EventDeliveryPage,
  RetriedDeliveries,
  RetryDeliveriesInput,
} from './types'

const BASE = '/v1/admin/event-deliveries'

export const deliveryKeys = {
  all: ['events', 'deliveries'] as const,
  list: (params: EventDeliveryListParams) => [...deliveryKeys.all, 'list', params] as const,
}

export function useEventDeliveries(
  params: MaybeRefOrGetter<EventDeliveryListParams>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const api = useApi()
  return useQuery<EventDeliveryPage, ApiProblem>({
    queryKey: computed(() => deliveryKeys.list(toValue(params))),
    queryFn: ({ signal }) =>
      api<EventDeliveryPage>(BASE, { query: { ...toValue(params) }, signal }),
    placeholderData: keepPreviousData,
    enabled: computed(() => toValue(options.enabled ?? true)),
  })
}

/**
 * Reintentar devuelve la entrega a PENDING con 0 intentos; el job la toma en el siguiente minuto
 * (API_SPEC §22.2). Responde 202 sin cuerpo, así que se vuelve a consultar la lista.
 */
export function useRetryDelivery() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<undefined, ApiProblem, string>({
    mutationFn: (id) => api<undefined>(`${BASE}/${id}/retry`, { method: 'POST' }),
    onSettled: () => qc.invalidateQueries({ queryKey: deliveryKeys.all }),
  })
}

/** Reintenta todas las FAILED de un tipo de evento o manejador, o todas (API_SPEC §22.3). */
export function useRetryDeliveries() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<RetriedDeliveries, ApiProblem, RetryDeliveriesInput>({
    mutationFn: (input) =>
      api<RetriedDeliveries>(`${BASE}/retry`, { method: 'POST', body: { ...input } }),
    onSettled: () => qc.invalidateQueries({ queryKey: deliveryKeys.all }),
  })
}
