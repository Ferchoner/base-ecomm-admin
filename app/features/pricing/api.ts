import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { ApiProblem } from '~/shared/api/problem'
import { useApi } from '~/shared/api/use-api'
import type {
  PriceImportSummary,
  PriceList,
  PricePeriod,
  PricePeriodList,
  SetPriceInput,
} from './types'

const BASE = '/v1/admin/pricing/price-lists'

export const pricingKeys = {
  all: ['pricing'] as const,
  lists: () => [...pricingKeys.all, 'price-lists'] as const,
  periods: (listId: string, variantId: string) =>
    [...pricingKeys.all, 'periods', listId, variantId] as const,
}

export function usePriceLists() {
  const api = useApi()
  return useQuery<PriceList[], ApiProblem>({
    queryKey: pricingKeys.lists(),
    queryFn: async ({ signal }) => (await api<{ data: PriceList[] }>(BASE, { signal })).data,
    staleTime: 5 * 60_000,
  })
}

/** Lista que usa la tienda. En el MVP hay una sola, `GENERAL` (ADR-0039). */
export function useDefaultPriceList() {
  const query = usePriceLists()
  const list = computed(
    () => query.data.value?.find((l) => l.isDefault) ?? query.data.value?.[0] ?? null,
  )
  return { ...query, list }
}

export function usePricePeriods(
  listId: MaybeRefOrGetter<string | undefined>,
  variantId: MaybeRefOrGetter<string>,
) {
  const api = useApi()
  return useQuery<PricePeriodList, ApiProblem>({
    queryKey: computed(() => pricingKeys.periods(toValue(listId) ?? '', toValue(variantId))),
    queryFn: ({ signal }) =>
      api<PricePeriodList>(`${BASE}/${toValue(listId)}/variants/${toValue(variantId)}/periods`, {
        signal,
      }),
    enabled: computed(() => !!toValue(listId)),
  })
}

/**
 * Precio vigente de varias variantes: una llamada por variante, porque el producto no trae precio
 * (GAPS G-04). Solo se usa en el detalle de un producto, con pocas variantes.
 */
export function useCurrentPrices(
  listId: MaybeRefOrGetter<string | undefined>,
  variantIds: MaybeRefOrGetter<string[]>,
) {
  const api = useApi()
  return useQueries({
    queries: computed(() =>
      toValue(variantIds).map((variantId) => ({
        queryKey: pricingKeys.periods(toValue(listId) ?? '', variantId),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          api<PricePeriodList>(`${BASE}/${toValue(listId)}/variants/${variantId}/periods`, {
            signal,
          }),
        enabled: !!toValue(listId),
      })),
    ),
  })
}

export function useSetPrice(
  listId: MaybeRefOrGetter<string | undefined>,
  variantId: MaybeRefOrGetter<string>,
) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<PricePeriod, ApiProblem, SetPriceInput>({
    mutationFn: (input) =>
      api<PricePeriod>(`${BASE}/${toValue(listId)}/variants/${toValue(variantId)}/periods`, {
        method: 'POST',
        body: { ...input },
      }),
    onSettled: () =>
      qc.invalidateQueries({
        queryKey: pricingKeys.periods(toValue(listId) ?? '', toValue(variantId)),
      }),
  })
}

export function useCancelScheduledPrice(
  listId: MaybeRefOrGetter<string | undefined>,
  variantId: MaybeRefOrGetter<string>,
) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<undefined, ApiProblem, string>({
    mutationFn: (periodId) =>
      api<undefined>(
        `${BASE}/${toValue(listId)}/variants/${toValue(variantId)}/periods/${periodId}`,
        {
          method: 'DELETE',
        },
      ),
    onSettled: () =>
      qc.invalidateQueries({
        queryKey: pricingKeys.periods(toValue(listId) ?? '', toValue(variantId)),
      }),
  })
}

/** Carga masiva por CSV (API_SPEC §12). Con `dryRun` solo valida; todo o nada. */
export function useImportPrices(listId: MaybeRefOrGetter<string | undefined>) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<PriceImportSummary, ApiProblem, { file: File; dryRun: boolean }>({
    mutationFn: ({ file, dryRun }) => {
      const form = new FormData()
      form.append('file', file)
      return api<PriceImportSummary>(`${BASE}/${toValue(listId)}/imports`, {
        method: 'POST',
        body: form,
        query: { dryRun: dryRun ? 'true' : undefined },
      })
    },
    onSuccess: (summary) => {
      if (!summary.dryRun)
        return qc.invalidateQueries({ queryKey: [...pricingKeys.all, 'periods'] })
    },
  })
}
