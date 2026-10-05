import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { ApiProblem } from '~/shared/api/problem'
import { QUERY_ROOT, invalidateRoots } from '~/shared/api/query-roots'
import { useApi } from '~/shared/api/use-api'
import type {
  AdminCustomer,
  CustomerAnonymization,
  CustomerListParams,
  CustomerPage,
  GuestAnonymization,
  GuestAnonymizationInput,
} from './types'

const BASE = '/v1/admin/identity'

export const customerKeys = {
  all: [QUERY_ROOT.customers] as const,
  list: (params: CustomerListParams) => [...customerKeys.all, 'list', params] as const,
  detail: (id: string) => [...customerKeys.all, 'detail', id] as const,
}

export function useCustomers(params: MaybeRefOrGetter<CustomerListParams>) {
  const api = useApi()
  return useQuery<CustomerPage, ApiProblem>({
    queryKey: computed(() => customerKeys.list(toValue(params))),
    queryFn: ({ signal }) =>
      api<CustomerPage>(`${BASE}/customers`, { query: { ...toValue(params) }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useCustomer(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery<AdminCustomer, ApiProblem>({
    queryKey: computed(() => customerKeys.detail(toValue(id))),
    queryFn: ({ signal }) => api<AdminCustomer>(`${BASE}/customers/${toValue(id)}`, { signal }),
    enabled: computed(() => !!toValue(id)),
  })
}

/** Suspender o reactivar (API_SPEC §9.18): responden el cliente. */
export function useCustomerStatus(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<
    AdminCustomer,
    ApiProblem,
    { action: 'suspend' | 'reactivate'; reason: string; version: number }
  >({
    mutationFn: ({ action, ...body }) =>
      api<AdminCustomer>(`${BASE}/customers/${toValue(id)}/${action}`, { method: 'POST', body }),
    onSuccess: (customer) => {
      qc.setQueryData(customerKeys.detail(customer.id), customer)
      invalidateRoots(qc, [QUERY_ROOT.customers])
    },
    onError: (error) => {
      if (error.type === 'version-conflict')
        void qc.invalidateQueries({ queryKey: customerKeys.detail(toValue(id)) })
    },
  })
}

/** Irreversible; también anonimiza sus pedidos y envíos (API_SPEC §9.18, ADR-0145). */
export function useAnonymizeCustomer(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<CustomerAnonymization, ApiProblem, { reason: string; version: number }>({
    mutationFn: (body) =>
      api<CustomerAnonymization>(`${BASE}/customers/${toValue(id)}/anonymize`, {
        method: 'POST',
        body,
      }),
    onSuccess: () =>
      invalidateRoots(qc, [QUERY_ROOT.customers, QUERY_ROOT.orders, QUERY_ROOT.shipping]),
    onError: (error) => {
      if (error.type === 'version-conflict')
        void qc.invalidateQueries({ queryKey: customerKeys.detail(toValue(id)) })
    },
  })
}

export function useAnonymizeGuest() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<GuestAnonymization, ApiProblem, GuestAnonymizationInput>({
    mutationFn: (body) =>
      api<GuestAnonymization>(`${BASE}/guest-anonymizations`, {
        method: 'POST',
        body: { ...body },
      }),
    onSuccess: () => invalidateRoots(qc, [QUERY_ROOT.orders, QUERY_ROOT.shipping]),
  })
}
