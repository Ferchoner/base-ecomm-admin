import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { ApiProblem } from '~/shared/api/problem'
import { useApi } from '~/shared/api/use-api'
import type {
  AdjustmentInput,
  ReceiptInput,
  StockEntry,
  StockItemPage,
  StockListParams,
  StockMovementPage,
  Warehouse,
  WarehouseUpdateInput,
} from './types'

const BASE = '/v1/admin/inventory'

export const inventoryKeys = {
  all: ['inventory'] as const,
  warehouses: () => [...inventoryKeys.all, 'warehouses'] as const,
  stock: () => [...inventoryKeys.all, 'stock'] as const,
  stockList: (params: StockListParams) => [...inventoryKeys.stock(), params] as const,
  stockByVariant: (variantId: string) => [...inventoryKeys.stock(), 'variant', variantId] as const,
  movements: (stockItemId: string, filters: MovementFilters) =>
    [...inventoryKeys.all, 'movements', stockItemId, filters] as const,
}

export interface MovementFilters {
  type?: string
  from?: string
  to?: string
}

export function useWarehouses() {
  const api = useApi()
  return useQuery<Warehouse[], ApiProblem>({
    queryKey: inventoryKeys.warehouses(),
    queryFn: async ({ signal }) =>
      (await api<{ data: Warehouse[] }>(`${BASE}/warehouses`, { signal })).data,
  })
}

/** En el MVP hay un solo almacén, el activo; entradas y ajustes lo exigen (API_SPEC §13, ADR-0081). */
export function useActiveWarehouse() {
  const query = useWarehouses()
  const warehouse = computed(() => query.data.value?.find((w) => w.status === 'ACTIVE') ?? null)
  return { ...query, warehouse }
}

export function useUpdateWarehouse() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<Warehouse, ApiProblem, { id: string; input: WarehouseUpdateInput }>({
    mutationFn: ({ id, input }) =>
      api<Warehouse>(`${BASE}/warehouses/${id}`, { method: 'PATCH', body: { ...input } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.warehouses() }),
  })
}

export function useStockItems(
  params: MaybeRefOrGetter<StockListParams>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const api = useApi()
  return useQuery<StockItemPage, ApiProblem>({
    queryKey: computed(() => inventoryKeys.stockList(toValue(params))),
    queryFn: ({ signal }) =>
      api<StockItemPage>(`${BASE}/stock-items`, { query: { ...toValue(params) }, signal }),
    placeholderData: keepPreviousData,
    enabled: computed(() => toValue(options.enabled ?? true)),
  })
}

/** Existencia de una variante (filtro `variantId`); `null` si nunca tuvo entradas ni ajustes. */
export function useStockOfVariant(variantId: MaybeRefOrGetter<string | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => inventoryKeys.stockByVariant(toValue(variantId) ?? '')),
    queryFn: async ({ signal }) =>
      (
        await api<StockItemPage>(`${BASE}/stock-items`, {
          query: { variantId: toValue(variantId) },
          signal,
        })
      ).data[0] ?? null,
    enabled: computed(() => !!toValue(variantId)),
  })
}

/** Movimientos con paginación por cursor (API_SPEC §5.2): `cursor` y `limit` (G-10). */
export function useStockMovements(
  stockItemId: MaybeRefOrGetter<string>,
  filters: MaybeRefOrGetter<MovementFilters>,
) {
  const api = useApi()
  return useInfiniteQuery<StockMovementPage, ApiProblem>({
    queryKey: computed(() => inventoryKeys.movements(toValue(stockItemId), toValue(filters))),
    queryFn: ({ pageParam, signal }) =>
      api<StockMovementPage>(`${BASE}/stock-items/${toValue(stockItemId)}/movements`, {
        query: { ...toValue(filters), limit: 50, cursor: pageParam as string | undefined },
        signal,
      }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta.nextCursor ?? undefined,
  })
}

/**
 * Entradas y ajustes responden el stock item y el movimiento. No se reintentan: repetir una
 * entrada sumaría unidades dos veces (la API no pide `Idempotency-Key` aquí, API_SPEC §4).
 */
function useStockEntry<V extends object>(path: 'receipts' | 'adjustments') {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<StockEntry, ApiProblem, V>({
    mutationFn: (input) =>
      api<StockEntry>(`${BASE}/${path}`, {
        method: 'POST',
        body: { ...input } as Record<string, unknown>,
      }),
    onSuccess: (entry) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: inventoryKeys.stock() }),
        qc.invalidateQueries({ queryKey: [...inventoryKeys.all, 'movements', entry.stockItem.id] }),
      ]),
  })
}

export const useCreateReceipt = () => useStockEntry<ReceiptInput>('receipts')
export const useCreateAdjustment = () => useStockEntry<AdjustmentInput>('adjustments')
