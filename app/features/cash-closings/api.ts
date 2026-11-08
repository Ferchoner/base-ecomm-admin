import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { ApiProblem } from '~/shared/api/problem'
import { QUERY_ROOT } from '~/shared/api/query-roots'
import { useApi } from '~/shared/api/use-api'
import type {
  CashClosing,
  CashClosingListParams,
  CashClosingPage,
  CashSummary,
  CloseCashInput,
} from './types'

const BASE = '/v1/admin/cash-closings'

export const cashKeys = {
  all: [QUERY_ROOT.cashClosings] as const,
  summary: (warehouseId: string, date: string) =>
    [...cashKeys.all, 'summary', warehouseId, date] as const,
  list: (params: CashClosingListParams) => [...cashKeys.all, 'list', params] as const,
  detail: (id: string) => [...cashKeys.all, 'detail', id] as const,
}

/**
 * El corte de un local en un día (UC-ORD-16, API_SPEC §15.9). La API lo calcula al consultar, así que
 * se vuelve a pedir al volver a la pestaña: los cobros del mostrador lo cambian.
 */
export function useCashSummary(params: MaybeRefOrGetter<{ warehouseId: string; date: string }>) {
  const api = useApi()
  return useQuery<CashSummary, ApiProblem>({
    queryKey: computed(() => cashKeys.summary(toValue(params).warehouseId, toValue(params).date)),
    queryFn: ({ signal }) =>
      api<CashSummary>(`${BASE}/summary`, { query: toValue(params), signal }),
    enabled: computed(() => !!toValue(params).warehouseId && !!toValue(params).date),
    refetchOnWindowFocus: true,
  })
}

export function useCashClosings(params: MaybeRefOrGetter<CashClosingListParams>) {
  const api = useApi()
  return useQuery<CashClosingPage, ApiProblem>({
    queryKey: computed(() => cashKeys.list(toValue(params))),
    queryFn: ({ signal }) => api<CashClosingPage>(BASE, { query: { ...toValue(params) }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useCashClosing(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery<CashClosing, ApiProblem>({
    queryKey: computed(() => cashKeys.detail(toValue(id))),
    queryFn: ({ signal }) => api<CashClosing>(`${BASE}/${toValue(id)}`, { signal }),
    enabled: computed(() => !!toValue(id)),
  })
}

/** Cierra la caja (UC-ORD-17). Sin reintentos: un cierre es uno por local y día. */
export function useCloseCash() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<CashClosing, ApiProblem, CloseCashInput>({
    mutationFn: (input) => api<CashClosing>(BASE, { method: 'POST', body: input }),
    onSuccess: (closing) => {
      qc.setQueryData(cashKeys.detail(closing.id), closing)
      void qc.invalidateQueries({ queryKey: cashKeys.all })
    },
    onError: (error) => {
      // Otro equipo cerró el día primero: se muestra su cierre.
      if (error.type === 'duplicate-value') void qc.invalidateQueries({ queryKey: cashKeys.all })
    },
  })
}
