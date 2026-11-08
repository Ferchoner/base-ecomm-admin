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
  ReceiptImportSummary,
  CloseLoanInput,
  Count,
  CountCreateInput,
  CountLine,
  CountListParams,
  CountPage,
  ReceiptInput,
  StockItem,
  StockLocationInput,
  StockEntry,
  StockItemPage,
  StockListParams,
  StockMovementPage,
  Transfer,
  TransferCreateInput,
  TransferListParams,
  TransferPage,
  Warehouse,
  WarehouseCreateInput,
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
  transfers: () => [...inventoryKeys.all, 'transfers'] as const,
  transferList: (params: TransferListParams) => [...inventoryKeys.transfers(), params] as const,
  counts: () => [...inventoryKeys.all, 'counts'] as const,
  countList: (params: CountListParams) => [...inventoryKeys.counts(), 'list', params] as const,
  count: (id: string) => [...inventoryKeys.counts(), 'detail', id] as const,
}

export interface MovementFilters {
  type?: string
  from?: string
  to?: string
}

/** Almacenes por prioridad y luego por código (API_SPEC §13, ADR-0160). */
export function useWarehouses(options: { enabled?: MaybeRefOrGetter<boolean> } = {}) {
  const api = useApi()
  return useQuery<Warehouse[], ApiProblem>({
    queryKey: inventoryKeys.warehouses(),
    queryFn: async ({ signal }) =>
      (await api<{ data: Warehouse[] }>(`${BASE}/warehouses`, { signal })).data,
    enabled: computed(() => toValue(options.enabled ?? true)),
  })
}

export function useCreateWarehouse() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<Warehouse, ApiProblem, WarehouseCreateInput>({
    mutationFn: (input) =>
      api<Warehouse>(`${BASE}/warehouses`, { method: 'POST', body: { ...input } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.warehouses() }),
  })
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

/**
 * Desactiva un almacén para siempre (UC-INV-11, ADR-0160). Conserva su stock; deja de vender,
 * reservar y recibir. 409 `resource-in-use` si tiene reservas, o `invalid-state-transition` si es el
 * último activo.
 */
export function useDeactivateWarehouse() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<Warehouse, ApiProblem, string>({
    mutationFn: (id) => api<Warehouse>(`${BASE}/warehouses/${id}/deactivate`, { method: 'POST' }),
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

/** Existencias de una variante en cada almacén (filtro `variantId`); vacío si nunca tuvo movimientos. */
export function useStockOfVariant(variantId: MaybeRefOrGetter<string | undefined>) {
  const api = useApi()
  return useQuery({
    queryKey: computed(() => inventoryKeys.stockByVariant(toValue(variantId) ?? '')),
    queryFn: async ({ signal }) =>
      (
        await api<StockItemPage>(`${BASE}/stock-items`, {
          query: { variantId: toValue(variantId), pageSize: 100 },
          signal,
        })
      ).data,
    enabled: computed(() => !!toValue(variantId)),
  })
}

/**
 * Dónde está cada variante en un almacén (ADR-0173), para las etiquetas: un mapa de variante a
 * ubicación, `null` si no tiene. Una consulta por variante, de cinco en cinco.
 */
export function useStockLocations(
  warehouseId: MaybeRefOrGetter<string | undefined>,
  variantIds: MaybeRefOrGetter<string[]>,
) {
  const api = useApi()
  const ids = computed(() => [...new Set(toValue(variantIds))].sort())
  return useQuery<Map<string, string | null>, ApiProblem>({
    queryKey: computed(() => [
      ...inventoryKeys.stock(),
      'locations',
      toValue(warehouseId),
      ids.value,
    ]),
    queryFn: async ({ signal }) => {
      const found = new Map<string, string | null>()
      const pending = [...ids.value]
      const worker = async () => {
        for (let variantId = pending.shift(); variantId; variantId = pending.shift()) {
          const page = await api<StockItemPage>(`${BASE}/stock-items`, {
            query: { variantId, warehouseId: toValue(warehouseId), pageSize: 1 },
            signal,
          })
          found.set(variantId, page.data[0]?.location ?? null)
        }
      }
      await Promise.all(Array.from({ length: 5 }, worker))
      return found
    },
    enabled: computed(() => !!toValue(warehouseId) && ids.value.length > 0),
    placeholderData: keepPreviousData,
  })
}

/** Movimientos con paginación por cursor (API_SPEC §5.2): `cursor` y `limit`. */
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

/**
 * Registra un traslado o un préstamo (`POST /v1/admin/inventory/transfers`, ADR-0172): las unidades
 * salen del origen y entran al destino en un solo paso, o no se mueve nada. Exige `Idempotency-Key`:
 * quien llama crea una por intento, así que repetir tras un error de red no mueve dos veces.
 */
export function useCreateTransfer() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<Transfer, ApiProblem, { input: TransferCreateInput; idempotencyKey: string }>({
    mutationFn: ({ input, idempotencyKey }) =>
      api<Transfer>(`${BASE}/transfers`, {
        method: 'POST',
        body: { ...input },
        idempotencyKey,
      }),
    onSuccess: () => invalidateAfterTransfer(qc),
  })
}

function invalidateAfterTransfer(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: inventoryKeys.stock() }),
    qc.invalidateQueries({ queryKey: [...inventoryKeys.all, 'movements'] }),
    qc.invalidateQueries({ queryKey: inventoryKeys.transfers() }),
  ])
}

/** Traslados y préstamos, del más reciente al más antiguo (`inventory.read`). */
export function useTransfers(
  params: MaybeRefOrGetter<TransferListParams>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const api = useApi()
  return useQuery<TransferPage, ApiProblem>({
    queryKey: computed(() => inventoryKeys.transferList(toValue(params))),
    queryFn: ({ signal }) =>
      api<TransferPage>(`${BASE}/transfers`, {
        query: { ...toValue(params) },
        signal,
      }),
    placeholderData: keepPreviousData,
    enabled: computed(() => toValue(options.enabled ?? true)),
  })
}

/**
 * Cancela un traslado o un préstamo abierto en sus primeros 10 minutos, con la `version` leída: las
 * unidades regresan al origen. 409 si ya pasó el plazo o el destino ya no las tiene.
 */
export function useCancelTransfer() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<Transfer, ApiProblem, Pick<Transfer, 'id' | 'version'>>({
    mutationFn: ({ id, version }) =>
      api<Transfer>(`${BASE}/transfers/${id}/cancel`, { method: 'POST', body: { version } }),
    onSettled: () => invalidateAfterTransfer(qc),
  })
}

/**
 * Cierra un préstamo con lo que regresó de cada línea (T-164): eso vuelve al origen con un traslado de
 * regreso, y lo demás se queda en el destino.
 */
export function useCloseLoan() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<Transfer, ApiProblem, { id: string; input: CloseLoanInput }>({
    mutationFn: ({ id, input }) =>
      api<Transfer>(`${BASE}/transfers/${id}/close`, { method: 'POST', body: { ...input } }),
    onSettled: () => invalidateAfterTransfer(qc),
  })
}

/**
 * Carga masiva de entradas de mercancía por SKU y código de almacén (API_SPEC §13). Con `dryRun`
 * solo revisa; todo o nada. El mismo archivo no se carga dos veces (409 `duplicate-value`).
 */
export function useImportReceipts() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<ReceiptImportSummary, ApiProblem, { file: File; dryRun: boolean }>({
    mutationFn: ({ file, dryRun }) => {
      const form = new FormData()
      form.append('file', file)
      return api<ReceiptImportSummary>(`${BASE}/receipt-imports`, {
        method: 'POST',
        body: form,
        query: { dryRun: dryRun ? 'true' : undefined },
      })
    },
    onSuccess: (summary) => {
      if (!summary.dryRun) return qc.invalidateQueries({ queryKey: inventoryKeys.stock() })
    },
  })
}

/**
 * Registra o quita la ubicación de una variante en un almacén (`PUT …/locations`, ADR-0173), aunque
 * todavía no tenga unidades ahí. `null` la quita. Responde la existencia.
 */
export function useSetLocation() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<StockItem, ApiProblem, StockLocationInput>({
    mutationFn: (input) =>
      api<StockItem>(`${BASE}/locations`, { method: 'PUT', body: { ...input } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: inventoryKeys.stock() }),
  })
}

/** Hojas de conteo, de la más reciente a la más antigua, sin sus líneas (`inventory.read`). */
export function useCounts(
  params: MaybeRefOrGetter<CountListParams>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const api = useApi()
  return useQuery<CountPage, ApiProblem>({
    queryKey: computed(() => inventoryKeys.countList(toValue(params))),
    queryFn: ({ signal }) =>
      api<CountPage>(`${BASE}/counts`, { query: { ...toValue(params) }, signal }),
    placeholderData: keepPreviousData,
    enabled: computed(() => toValue(options.enabled ?? true)),
  })
}

/** Una hoja con sus líneas; a ciegas (`blind`) para quien no tiene `inventory.write`. */
export function useCount(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery<Count, ApiProblem>({
    queryKey: computed(() => inventoryKeys.count(toValue(id))),
    queryFn: ({ signal }) => api<Count>(`${BASE}/counts/${toValue(id)}`, { signal }),
    enabled: computed(() => !!toValue(id)),
  })
}

/** Abre una hoja con un filtro (UC-INV-18). 409 `variant-in-open-count` si alguna variante ya está en otra. */
export function useOpenCount() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<Count, ApiProblem, CountCreateInput>({
    mutationFn: (input) => api<Count>(`${BASE}/counts`, { method: 'POST', body: { ...input } }),
    onSuccess: (count) => {
      qc.setQueryData(inventoryKeys.count(count.id), count)
      return qc.invalidateQueries({ queryKey: [...inventoryKeys.counts(), 'list'] })
    },
  })
}

/**
 * Captura lo contado de una variante (UC-INV-19). Una variante que no está en la hoja se agrega al
 * final. Sin `version`: varias personas cuentan la misma hoja a la vez.
 */
export function useCaptureCount() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<CountLine, ApiProblem, { id: string; variantId: string; counted: number }>({
    mutationFn: ({ id, variantId, counted }) =>
      api<CountLine>(`${BASE}/counts/${id}/lines/${variantId}`, {
        method: 'PUT',
        body: { counted },
      }),
    // La línea guardada entra de una vez a la hoja, para que el siguiente escaneo sume sobre ella.
    onSuccess: (line, { id }) =>
      qc.setQueryData<Count>(inventoryKeys.count(id), (count) => count && withLine(count, line)),
    onSettled: (_line, _error, { id }) => invalidateCount(qc, id),
  })
}

/** La hoja con una línea guardada: reemplaza la suya o, si es nueva, va al final. */
export function withLine(count: Count, line: CountLine): Count {
  const before = count.lines.find((l) => l.variantId === line.variantId)
  const lines = before
    ? count.lines.map((l) => (l.variantId === line.variantId ? line : l))
    : [...count.lines, line]
  const countedNow = (before?.counted ?? null) === null && line.counted !== null ? 1 : 0
  return {
    ...count,
    lines,
    lineCount: before ? count.lineCount : count.lineCount + 1,
    countedCount: count.countedCount + countedNow,
  }
}

function invalidateCount(qc: ReturnType<typeof useQueryClient>, id: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: inventoryKeys.count(id) }),
    qc.invalidateQueries({ queryKey: [...inventoryKeys.counts(), 'list'] }),
  ])
}

/** Pide volver a contar una línea, con la `version` leída de la hoja. */
export function useRecountLine() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<Count, ApiProblem, { id: string; variantId: string; version: number }>({
    mutationFn: ({ id, variantId, version }) =>
      api<Count>(`${BASE}/counts/${id}/lines/${variantId}/recount`, {
        method: 'POST',
        body: { version },
      }),
    onSuccess: (count) => qc.setQueryData(inventoryKeys.count(count.id), count),
    onSettled: (_count, _error, { id }) => invalidateCount(qc, id),
  })
}

/**
 * Aplica una hoja (UC-INV-20): un ajuste `PHYSICAL_COUNT` por cada línea contada con diferencia. Exige
 * `Idempotency-Key`: quien llama crea una por intento, así que repetir tras un error de red no ajusta
 * dos veces.
 */
export function useApplyCount() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<Count, ApiProblem, { id: string; version: number; idempotencyKey: string }>({
    mutationFn: ({ id, version, idempotencyKey }) =>
      api<Count>(`${BASE}/counts/${id}/apply`, {
        method: 'POST',
        body: { version },
        idempotencyKey,
      }),
    onSuccess: (count) => qc.setQueryData(inventoryKeys.count(count.id), count),
    onSettled: (_count, _error, { id }) =>
      Promise.all([
        invalidateCount(qc, id),
        qc.invalidateQueries({ queryKey: inventoryKeys.stock() }),
        qc.invalidateQueries({ queryKey: [...inventoryKeys.all, 'movements'] }),
      ]),
  })
}

/** Cancela una hoja sin ajustar nada; sus variantes pueden ir en otra. */
export function useCancelCount() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<Count, ApiProblem, { id: string; version: number }>({
    mutationFn: ({ id, version }) =>
      api<Count>(`${BASE}/counts/${id}/cancel`, { method: 'POST', body: { version } }),
    onSuccess: (count) => qc.setQueryData(inventoryKeys.count(count.id), count),
    onSettled: (_count, _error, { id }) => invalidateCount(qc, id),
  })
}
