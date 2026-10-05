<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import { usePayments } from '~/features/payments/api'
import { PAYMENT_SORT_OPTIONS } from '~/features/payments/status'
import type { AdminPayment } from '~/features/payments/types'
import { useListParams } from '~/shared/api/use-list-params'
import { PAYMENT_PROVIDER, PAYMENT_STATUS, statusOptions } from '~/shared/status/sales'
import { formatDateTime } from '~/shared/utils/dates'
import { formatMoney } from '~/shared/utils/money'

definePageMeta({ title: 'Pagos', permission: 'orders.read' })

const list = useListParams({
  filters: ['status', 'provider', 'orderId', 'capturedFrom', 'capturedTo', 'sort'],
})
const filters = list.filters

const { data, isPending, error, refetch, isFetching } = usePayments(() => ({
  page: list.page.value,
  pageSize: list.pageSize.value,
  status: filters.value.status,
  provider: filters.value.provider,
  orderId: filters.value.orderId,
  capturedFrom: filters.value.capturedFrom,
  capturedTo: filters.value.capturedTo,
  sort: filters.value.sort ?? '-createdAt',
}))

const STATUS_OPTIONS = statusOptions(PAYMENT_STATUS)
const PROVIDER_OPTIONS = Object.entries(PAYMENT_PROVIDER).map(([value, label]) => ({
  value,
  label,
}))
const hasFilters = computed(() =>
  Object.entries(filters.value).some(([k, v]) => k !== 'sort' && v !== undefined),
)

const columns: TableColumn<AdminPayment>[] = [
  { accessorKey: 'orderCode', header: 'Pedido' },
  { accessorKey: 'provider', header: 'Medio' },
  { accessorKey: 'status', header: 'Estado' },
  { id: 'amount', header: 'Monto', meta: { class: { th: 'text-right', td: 'text-right' } } },
  {
    id: 'refunded',
    header: 'Reembolsado',
    meta: { class: { th: 'text-right', td: 'text-right' } },
  },
  { accessorKey: 'capturedAt', header: 'Cobrado' },
  { accessorKey: 'createdAt', header: 'Iniciado' },
]

function openRow(_: Event, row: TableRow<AdminPayment>) {
  navigateTo(`/pagos/${row.original.id}`)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-2">
      <USelect
        :model-value="filters.status"
        :items="STATUS_OPTIONS"
        placeholder="Todos los estados"
        aria-label="Filtrar por estado"
        class="w-full sm:w-44"
        @update:model-value="(v) => list.setFilter('status', v as string)"
      />
      <USelect
        :model-value="filters.provider"
        :items="PROVIDER_OPTIONS"
        placeholder="Todos los medios"
        aria-label="Filtrar por medio de pago"
        class="w-full sm:w-40"
        @update:model-value="(v) => list.setFilter('provider', v as string)"
      />
      <DateRangeFilter
        label="Cobrados"
        :from="filters.capturedFrom"
        :to="filters.capturedTo"
        @update:from="(v) => list.setFilter('capturedFrom', v)"
        @update:to="(v) => list.setFilter('capturedTo', v)"
      />
      <USelect
        :model-value="filters.sort ?? '-createdAt'"
        :items="PAYMENT_SORT_OPTIONS"
        aria-label="Ordenar"
        class="w-full sm:w-52"
        @update:model-value="
          (v) => list.setFilter('sort', v === '-createdAt' ? undefined : (v as string))
        "
      />
      <UButton
        v-if="hasFilters"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        @click="list.resetFilters()"
        >Limpiar</UButton
      >
    </div>

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.data.length === 0"
      empty-title="No hay pagos"
      :empty-description="hasFilters ? 'Prueba con otros filtros.' : undefined"
      @retry="refetch()"
    >
      <UTable
        :data="data?.data ?? []"
        :columns="columns"
        :loading="isFetching"
        class="rounded-md border border-default"
        :ui="{ tr: 'cursor-pointer' }"
        @select="openRow"
      >
        <template #orderCode-cell="{ row }">
          <NuxtLink
            :to="`/pagos/${row.original.id}`"
            class="font-medium hover:underline"
            @click.stop
            >{{ row.original.orderCode }}</NuxtLink
          >
        </template>
        <template #provider-cell="{ row }">{{
          PAYMENT_PROVIDER[row.original.provider] ?? row.original.provider
        }}</template>
        <template #status-cell="{ row }">
          <StatusBadge :value="row.original.status" :styles="PAYMENT_STATUS" />
        </template>
        <template #amount-cell="{ row }">{{ formatMoney(row.original.amount) }}</template>
        <template #refunded-cell="{ row }">{{ formatMoney(row.original.refundedAmount) }}</template>
        <template #capturedAt-cell="{ row }">{{
          formatDateTime(row.original.capturedAt)
        }}</template>
        <template #createdAt-cell="{ row }">{{ formatDateTime(row.original.createdAt) }}</template>
      </UTable>
      <ListPagination class="mt-3" :meta="data?.meta" @update:page="list.setPage" />
    </QueryState>
  </div>
</template>
