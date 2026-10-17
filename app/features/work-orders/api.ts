import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { ApiProblem } from '~/shared/api/problem'
import { QUERY_ROOT } from '~/shared/api/query-roots'
import type { Page } from '~/shared/api/types'
import { useApi } from '~/shared/api/use-api'
import type {
  BlockedWorkOrderData,
  ChangeWorkOrderStatusInput,
  CustomerOption,
  ReceiveWorkOrderInput,
  ServiceNote,
  StaffUser,
  StoreSale,
  UpdateWorkOrderInput,
  WarehouseOption,
  WorkOrder,
  WorkOrderListParams,
  WorkOrderPage,
} from './types'

const BASE = '/v1/admin/work-orders'

export const workOrderKeys = {
  all: ['work-orders'] as const,
  list: (params: WorkOrderListParams) => [...workOrderKeys.all, 'list', params] as const,
  detail: (id: string) => [...workOrderKeys.all, 'detail', id] as const,
  note: (id: string) => [...workOrderKeys.all, 'service-note', id] as const,
}

export function useWorkOrders(params: MaybeRefOrGetter<WorkOrderListParams>) {
  const api = useApi()
  return useQuery<WorkOrderPage, ApiProblem>({
    queryKey: computed(() => workOrderKeys.list(toValue(params))),
    queryFn: ({ signal }) => api<WorkOrderPage>(BASE, { query: { ...toValue(params) }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useWorkOrder(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery<WorkOrder, ApiProblem>({
    queryKey: computed(() => workOrderKeys.detail(toValue(id))),
    queryFn: ({ signal }) => api<WorkOrder>(`${BASE}/${toValue(id)}`, { signal }),
    enabled: computed(() => !!toValue(id)),
  })
}

/** Datos de la nota de servicio: la orden, la tienda y las condiciones (§25.9). */
export function useServiceNote(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery<ServiceNote, ApiProblem>({
    queryKey: computed(() => workOrderKeys.note(toValue(id))),
    queryFn: ({ signal }) => api<ServiceNote>(`${BASE}/${toValue(id)}/service-note`, { signal }),
    enabled: computed(() => !!toValue(id)),
  })
}

function useWorkOrderMutation<V>(fn: (vars: V) => Promise<WorkOrder>) {
  const qc = useQueryClient()
  return useMutation<WorkOrder, ApiProblem, V>({
    mutationFn: fn,
    onSuccess: (w) => {
      qc.setQueryData(workOrderKeys.detail(w.id), w)
      void qc.invalidateQueries({ queryKey: workOrderKeys.note(w.id) })
      return qc.invalidateQueries({ queryKey: [...workOrderKeys.all, 'list'] })
    },
    // Con otra versión se recarga lo actual: nunca se reenvía sola con la nueva (API_SPEC §2.3).
    onError: (e) => {
      if (e.type === 'version-conflict') void qc.invalidateQueries({ queryKey: workOrderKeys.all })
    },
  })
}

/**
 * Recibir un equipo (§25.2). Exige `Idempotency-Key`: quien llama la conserva mientras el usuario
 * reintenta el mismo formulario, para que un doble envío no cree ni imprima dos folios.
 */
export function useReceiveWorkOrder() {
  const api = useApi()
  return useWorkOrderMutation(
    ({ input, idempotencyKey }: { input: ReceiveWorkOrderInput; idempotencyKey: string }) =>
      api<WorkOrder>(BASE, { method: 'POST', body: { ...input }, idempotencyKey }),
  )
}

export function useUpdateWorkOrder(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useWorkOrderMutation((input: UpdateWorkOrderInput) =>
    api<WorkOrder>(`${BASE}/${toValue(id)}`, { method: 'PATCH', body: { ...input } }),
  )
}

/** Cambiar el estado por su acción, nunca por PATCH (§25.6). */
export function useChangeWorkOrderStatus(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useWorkOrderMutation((input: ChangeWorkOrderStatusInput) =>
    api<WorkOrder>(`${BASE}/${toValue(id)}/status`, { method: 'POST', body: { ...input } }),
  )
}

export function useLinkSale(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useWorkOrderMutation(({ orderId, version }: { orderId: string; version: number }) =>
    api<WorkOrder>(`${BASE}/${toValue(id)}/sales`, {
      method: 'POST',
      body: { orderId, version },
    }),
  )
}

export function useUnlinkSale(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useWorkOrderMutation(({ orderId, version }: { orderId: string; version: number }) =>
    api<WorkOrder>(`${BASE}/${toValue(id)}/sales/${orderId}`, {
      method: 'DELETE',
      query: { version },
    }),
  )
}

/** Datos bloqueados (§25.11): se auditan con el motivo y no se guardan en la cache. */
export function useWorkOrderBlockedData(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useMutation<BlockedWorkOrderData, ApiProblem, string>({
    mutationFn: (reason) =>
      api<BlockedWorkOrderData>(`${BASE}/${toValue(id)}/blocked-data`, {
        method: 'POST',
        body: { reason },
      }),
  })
}

/** Anonimizar la orden de un cliente sin cuenta (§25.12, `customers.manage`). Irreversible. */
export function useAnonymizeWorkOrder(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useWorkOrderMutation((reason: string) =>
    api<WorkOrder>(`${BASE}/${toValue(id)}/anonymize`, { method: 'POST', body: { reason } }),
  )
}

// ── Datos de otros contextos, con llaves propias (D-P17: la feature no importa a otras) ──

/** Almacenes para recibir el equipo (`inventory.read`); solo activos reciben. */
export function useWarehouses(enabled: MaybeRefOrGetter<boolean> = true) {
  const api = useApi()
  return useQuery<WarehouseOption[], ApiProblem>({
    queryKey: [QUERY_ROOT.inventory, 'warehouses', 'work-orders'],
    queryFn: async ({ signal }) =>
      (await api<{ data: WarehouseOption[] }>('/v1/admin/inventory/warehouses', { signal })).data,
    enabled: computed(() => toValue(enabled)),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Técnicos (GAPS G-23, D-085): la API no tiene una lista de técnicos; listar al staff exige
 * `staff.manage`. Quien lo tiene elige entre el staff activo; quien no, solo "Asignármela".
 */
export function useTechnicianSearch(
  q: MaybeRefOrGetter<string>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  const api = useApi()
  return useQuery<Page<StaffUser>, ApiProblem>({
    queryKey: computed(() => [QUERY_ROOT.staff, 'technicians', toValue(q)]),
    queryFn: ({ signal }) =>
      api<Page<StaffUser>>('/v1/admin/identity/staff', {
        query: { status: 'ACTIVE', q: toValue(q).trim() || undefined, pageSize: 20 },
        signal,
      }),
    enabled: computed(() => toValue(enabled)),
    placeholderData: keepPreviousData,
  })
}

/** Nombre de una cuenta de staff (`staff.manage`), para el técnico y el historial. */
export function useStaffMember(
  id: MaybeRefOrGetter<string | null>,
  enabled: MaybeRefOrGetter<boolean>,
) {
  const api = useApi()
  return useQuery<StaffUser, ApiProblem>({
    queryKey: computed(() => [QUERY_ROOT.staff, 'detail', toValue(id)]),
    queryFn: ({ signal }) => api<StaffUser>(`/v1/admin/identity/staff/${toValue(id)}`, { signal }),
    enabled: computed(() => !!toValue(id) && toValue(enabled)),
    staleTime: 5 * 60 * 1000,
  })
}

/** Clientes registrados activos para ligar la orden (`customers.read`, opcional). */
export function useCustomerSearch(q: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery<Page<CustomerOption>, ApiProblem>({
    queryKey: computed(() => [QUERY_ROOT.customers, 'work-order-customers', toValue(q)]),
    queryFn: ({ signal }) =>
      api<Page<CustomerOption>>('/v1/admin/identity/customers', {
        query: { q: toValue(q).trim(), status: 'ACTIVE', pageSize: 10 },
        signal,
      }),
    enabled: computed(() => toValue(q).trim().length >= 2),
    placeholderData: keepPreviousData,
  })
}

/** Ventas de la tienda física por su código, para ligarlas (`orders.read`, §25.7). */
export function useStoreSaleSearch(code: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery<Page<StoreSale>, ApiProblem>({
    queryKey: computed(() => [QUERY_ROOT.orders, 'work-order-sales', toValue(code)]),
    queryFn: ({ signal }) =>
      api<Page<StoreSale>>('/v1/admin/orders', {
        query: { q: toValue(code).trim(), channel: 'STORE', pageSize: 5 },
        signal,
      }),
    enabled: computed(() => toValue(code).trim().length >= 4),
  })
}
