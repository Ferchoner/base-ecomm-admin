import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { MaybeRefOrGetter } from 'vue'
import type { ApiProblem } from '~/shared/api/problem'
import { QUERY_ROOT, invalidateRoots } from '~/shared/api/query-roots'
import { useApi } from '~/shared/api/use-api'
import type {
  AdminPayment,
  ManualRefundInput,
  PaymentListParams,
  PaymentPage,
  PaymentSettings,
  PaymentSettingsInput,
} from './types'

const BASE = '/v1/admin/payments'

export const paymentKeys = {
  all: [QUERY_ROOT.payments] as const,
  list: (params: PaymentListParams) => [...paymentKeys.all, 'list', params] as const,
  detail: (id: string) => [...paymentKeys.all, 'detail', id] as const,
  settings: () => [...paymentKeys.all, 'settings'] as const,
}

const SETTINGS = '/v1/admin/payment-settings'

/** Si el pago manual en tienda está habilitado (API_SPEC §16.6, ADR-0162). Se lee con `orders.read`. */
export function usePaymentSettings() {
  const api = useApi()
  return useQuery<PaymentSettings, ApiProblem>({
    queryKey: paymentKeys.settings(),
    queryFn: ({ signal }) => api<PaymentSettings>(SETTINGS, { signal }),
  })
}

/** Habilita o deshabilita el pago manual; solo con `payments.configure` (superadministrador). */
export function useUpdatePaymentSettings() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<PaymentSettings, ApiProblem, PaymentSettingsInput>({
    mutationFn: (input) => api<PaymentSettings>(SETTINGS, { method: 'PUT', body: { ...input } }),
    onSuccess: (settings) => qc.setQueryData(paymentKeys.settings(), settings),
    onError: (error) => {
      if (error.type === 'version-conflict')
        void qc.invalidateQueries({ queryKey: paymentKeys.settings() })
    },
  })
}

export function usePayments(params: MaybeRefOrGetter<PaymentListParams>) {
  const api = useApi()
  return useQuery<PaymentPage, ApiProblem>({
    queryKey: computed(() => paymentKeys.list(toValue(params))),
    queryFn: ({ signal }) => api<PaymentPage>(BASE, { query: { ...toValue(params) }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function usePayment(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  return useQuery<AdminPayment, ApiProblem>({
    queryKey: computed(() => paymentKeys.detail(toValue(id))),
    queryFn: ({ signal }) => api<AdminPayment>(`${BASE}/${toValue(id)}`, { signal }),
    enabled: computed(() => !!toValue(id)),
  })
}

/** Completa el reembolso pendiente; la orden pasa a REFUNDED en segundo plano (API_SPEC §16.5). */
export function useManualRefund(id: MaybeRefOrGetter<string>) {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation<AdminPayment, ApiProblem, ManualRefundInput>({
    mutationFn: (input) =>
      api<AdminPayment>(`${BASE}/${toValue(id)}/refunds/manual`, {
        method: 'POST',
        body: { ...input },
      }),
    onSuccess: (payment) => {
      qc.setQueryData(paymentKeys.detail(payment.id), payment)
      invalidateRoots(qc, [QUERY_ROOT.payments, QUERY_ROOT.orders], [QUERY_ROOT.orders])
    },
    onError: (error) => {
      if (error.type === 'version-conflict')
        void qc.invalidateQueries({ queryKey: paymentKeys.detail(toValue(id)) })
    },
  })
}
