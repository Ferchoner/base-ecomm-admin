import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { ApiProblem } from '~/shared/api/problem'
import { QUERY_ROOT, invalidateRoots } from '~/shared/api/query-roots'
import { useApi } from '~/shared/api/use-api'
import type {
  AdminOrder,
  BlockedOrderData,
  CancelOrderInput,
  ManualCaptureInput,
  OrderListParams,
  OrderPage,
  ReorderResult,
  RestockInput,
  RestockResult,
  RestockWarehouse,
  ManualPaymentSettings,
} from './types'

const BASE = '/v1/admin/orders'

export const orderKeys = {
  all: [QUERY_ROOT.orders] as const,
  list: (params: OrderListParams) => [...orderKeys.all, 'list', params] as const,
  detail: (id: string) => [...orderKeys.all, 'detail', id] as const,
}

export function useOrders(
  params: MaybeRefOrGetter<OrderListParams>,
  options: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  const api = useApi()
  return useQuery<OrderPage, ApiProblem>({
    queryKey: computed(() => orderKeys.list(toValue(params))),
    queryFn: ({ signal }) => api<OrderPage>(BASE, { query: { ...toValue(params) }, signal }),
    placeholderData: keepPreviousData,
    enabled: computed(() => toValue(options.enabled ?? true)),
  })
}

export function useOrder(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery<AdminOrder, ApiProblem>({
    queryKey: computed(() => orderKeys.detail(toValue(id))),
    queryFn: ({ signal }) => api<AdminOrder>(`${BASE}/${toValue(id)}`, { signal }),
    enabled: computed(() => !!toValue(id)),
  })
}

/**
 * Acciones que responden la orden. La respuesta se guarda en el detalle; cancelar cambia además el
 * pago y el envío en la misma operación (API_SPEC §2.5), y el pago manual los cambia después.
 */
function useOrderMutation<V>(
  fn: (vars: V) => Promise<AdminOrder>,
  options: { background?: boolean } = {},
) {
  const qc = useQueryClient()
  return useMutation<AdminOrder, ApiProblem, V>({
    mutationFn: fn,
    onSuccess: (order) => {
      qc.setQueryData(orderKeys.detail(order.id), order)
      invalidateRoots(
        qc,
        [QUERY_ROOT.orders, QUERY_ROOT.payments, QUERY_ROOT.shipping],
        options.background ? [QUERY_ROOT.orders, QUERY_ROOT.shipping] : [],
      )
    },
    onError: (error, _vars) => {
      if (error.type === 'version-conflict') void qc.invalidateQueries({ queryKey: orderKeys.all })
    },
  })
}

export function useCancelOrder(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useOrderMutation((input: CancelOrderInput) =>
    api<AdminOrder>(`${BASE}/${toValue(id)}/cancel`, { method: 'POST', body: { ...input } }),
  )
}

export function useRetryFulfillment(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useOrderMutation((version: number) =>
    api<AdminOrder>(`${BASE}/${toValue(id)}/retry-fulfillment`, {
      method: 'POST',
      body: { version },
    }),
  )
}

/** Registra el pago en tienda (API_SPEC §16.4); la orden cambia en segundo plano. */
export function useManualCapture(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useOrderMutation(
    (input: ManualCaptureInput) =>
      api<AdminOrder>(`${BASE}/${toValue(id)}/manual-capture`, {
        method: 'POST',
        body: { ...input },
      }),
    { background: true },
  )
}

/** La orden no cambia; el comprador recibe las líneas en su carrito (API_SPEC §14.3). */
export function useReorder(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useMutation<ReorderResult, ApiProblem, undefined>({
    mutationFn: () => api<ReorderResult>(`${BASE}/${toValue(id)}/reorder`, { method: 'POST' }),
  })
}

/**
 * Reintegro de stock (API_SPEC §15.7). Exige `Idempotency-Key`: quien llama conserva la misma llave
 * mientras el usuario reintenta la misma solicitud.
 */
export function useRestock(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<RestockResult, ApiProblem, { input: RestockInput; idempotencyKey: string }>({
    mutationFn: ({ input, idempotencyKey }) =>
      api<RestockResult>(`${BASE}/${toValue(id)}/restocks`, {
        method: 'POST',
        body: { ...input },
        idempotencyKey,
      }),
    onSuccess: () => invalidateRoots(qc, [QUERY_ROOT.inventory]),
  })
}

/**
 * Si el pago manual está habilitado (API_SPEC §16.6, ADR-0162). Comparte la llave de la feature de
 * pagos (`['payments', 'settings']`), que devuelve los mismos datos.
 */
export function useManualPaymentSettings(enabled: MaybeRefOrGetter<boolean>) {
  const api = useApi()
  return useQuery<ManualPaymentSettings, ApiProblem>({
    queryKey: [QUERY_ROOT.payments, 'settings'],
    queryFn: ({ signal }) => api<ManualPaymentSettings>('/v1/admin/payment-settings', { signal }),
    enabled: computed(() => toValue(enabled)),
  })
}

/**
 * Almacenes a los que puede volver un reintegro (API_SPEC §15.7, ADR-0160). Comparte la llave del
 * listado de Inventario (`['inventory', 'warehouses']`), que devuelve los mismos datos.
 */
export function useRestockWarehouses(enabled: MaybeRefOrGetter<boolean>) {
  const api = useApi()
  return useQuery<RestockWarehouse[], ApiProblem>({
    queryKey: [QUERY_ROOT.inventory, 'warehouses'],
    queryFn: async ({ signal }) =>
      (await api<{ data: RestockWarehouse[] }>('/v1/admin/inventory/warehouses', { signal })).data,
    enabled: computed(() => toValue(enabled)),
  })
}

/**
 * Datos personales de una orden bloqueada (API_SPEC §15.7). Se auditan con el motivo: no se guardan
 * en cache y quien los muestra los descarta al cerrar.
 */
export function useBlockedData(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useMutation<BlockedOrderData, ApiProblem, string>({
    mutationFn: (reason) =>
      api<BlockedOrderData>(`${BASE}/${toValue(id)}/blocked-data`, {
        method: 'POST',
        body: { reason },
      }),
  })
}
