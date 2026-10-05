import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { ApiProblem } from '~/shared/api/problem'
import { QUERY_ROOT, invalidateRoots } from '~/shared/api/query-roots'
import { useApi } from '~/shared/api/use-api'
import type { AdminShipment, ShipmentListParams, ShipmentPage, TrackingInput } from './types'

const BASE = '/v1/admin/shipping/shipments'

export const shipmentKeys = {
  all: [QUERY_ROOT.shipping, 'shipments'] as const,
  list: (params: ShipmentListParams) => [...shipmentKeys.all, 'list', params] as const,
  detail: (id: string) => [...shipmentKeys.all, 'detail', id] as const,
}

export function useShipments(params: MaybeRefOrGetter<ShipmentListParams>) {
  const api = useApi()
  return useQuery<ShipmentPage, ApiProblem>({
    queryKey: computed(() => shipmentKeys.list(toValue(params))),
    queryFn: ({ signal }) => api<ShipmentPage>(BASE, { query: { ...toValue(params) }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useShipment(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery<AdminShipment, ApiProblem>({
    queryKey: computed(() => shipmentKeys.detail(toValue(id))),
    queryFn: ({ signal }) => api<AdminShipment>(`${BASE}/${toValue(id)}`, { signal }),
    enabled: computed(() => !!toValue(id)),
  })
}

export type ShipmentTransition =
  | { action: 'dispatch'; ownDelivery: boolean; version: number }
  | { action: 'deliver'; version: number }
  | { action: 'delivery-failure'; note: string | null; version: number }
  | { action: 'return'; note: string | null; version: number }

/**
 * Cambios del envío. Despachar y entregar cambian la orden en segundo plano (API_SPEC §2.5), así que
 * los pedidos se vuelven a consultar después.
 */
function useShipmentMutation<V>(
  id: MaybeRefOrGetter<string>,
  fn: (vars: V) => Promise<AdminShipment>,
) {
  const qc = useQueryClient()
  return useMutation<AdminShipment, ApiProblem, V>({
    mutationFn: fn,
    onSuccess: (shipment) => {
      qc.setQueryData(shipmentKeys.detail(shipment.id), shipment)
      invalidateRoots(qc, [QUERY_ROOT.shipping, QUERY_ROOT.orders], [QUERY_ROOT.orders])
    },
    onError: (error) => {
      if (error.type === 'version-conflict')
        void qc.invalidateQueries({ queryKey: shipmentKeys.detail(toValue(id)) })
    },
  })
}

export function useUpdateTracking(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useShipmentMutation(id, (input: TrackingInput) =>
    api<AdminShipment>(`${BASE}/${toValue(id)}`, { method: 'PATCH', body: { ...input } }),
  )
}

export function useShipmentTransition(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useShipmentMutation(id, ({ action, ...body }: ShipmentTransition) =>
    api<AdminShipment>(`${BASE}/${toValue(id)}/${action}`, { method: 'POST', body }),
  )
}
