<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import { useOrders } from '~/features/orders/api'
import { CHANNEL_OPTIONS, GUEST_OPTIONS, ORDER_SORT_OPTIONS } from '~/features/orders/status'
import type { AdminOrderSummary } from '~/features/orders/types'
import { useListParams } from '~/shared/api/use-list-params'
import { useSessionStore } from '~/shared/auth/session.store'
import {
  ORDER_CHANNEL,
  ORDER_STATUS,
  PAYMENT_STATUS,
  SHIPMENT_STATUS,
  statusOptions,
} from '~/shared/status/sales'
import { formatDateTime } from '~/shared/utils/dates'
import { useDebounced } from '~/shared/utils/debounce'
import { formatMoney } from '~/shared/utils/money'

definePageMeta({ title: 'Pedidos', permission: 'orders.read' })

const list = useListParams({
  filters: [
    'q',
    'status',
    'guest',
    'hasPendingRefund',
    'customerId',
    'placedFrom',
    'placedTo',
    'channel',
    'placedBy',
    'sort',
  ],
})
const filters = list.filters
const session = useSessionStore()
const myId = computed(() => session.account?.id)

const search = ref(filters.value.q ?? '')
const debouncedSearch = useDebounced(search)
watch(debouncedSearch, (q) => list.setFilter('q', q.trim() || undefined))

const { data, isPending, error, refetch, isFetching } = useOrders(() => ({
  page: list.page.value,
  pageSize: list.pageSize.value,
  q: filters.value.q,
  status: filters.value.status,
  customerId: filters.value.customerId,
  guest: filters.value.guest === undefined ? undefined : filters.value.guest === 'true',
  hasPendingRefund: filters.value.hasPendingRefund === 'true' ? true : undefined,
  placedFrom: filters.value.placedFrom,
  placedTo: filters.value.placedTo,
  channel: filters.value.channel,
  placedBy: filters.value.placedBy,
  sort: filters.value.sort ?? '-placedAt',
}))

const STATUS_OPTIONS = statusOptions(ORDER_STATUS)
const hasFilters = computed(() =>
  Object.entries(filters.value).some(([k, v]) => k !== 'sort' && v !== undefined),
)
function clearFilters() {
  search.value = ''
  list.resetFilters()
}

const columns: TableColumn<AdminOrderSummary>[] = [
  { accessorKey: 'publicCode', header: 'Pedido' },
  { accessorKey: 'placedAt', header: 'Fecha' },
  { id: 'contact', header: 'Contacto' },
  { accessorKey: 'status', header: 'Estado' },
  { id: 'payment', header: 'Pago' },
  { id: 'shipment', header: 'Envío' },
  { id: 'total', header: 'Total', meta: { class: { th: 'text-right', td: 'text-right' } } },
]

function contact(o: AdminOrderSummary) {
  if (o.anonymizedAt) return 'Anonimizado'
  if (o.blockedAt) return 'Datos bloqueados'
  // Venta de mostrador sin datos del comprador (API_SPEC §8.8, ADR-0161).
  return o.contactEmail ?? 'Sin datos'
}

function openRow(_: Event, row: TableRow<AdminOrderSummary>) {
  navigateTo(`/pedidos/${row.original.id}`)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-2">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Número, código o email"
        aria-label="Buscar pedidos"
        class="w-full sm:w-64"
      />
      <USelect
        :model-value="filters.status"
        :items="STATUS_OPTIONS"
        placeholder="Todos los estados"
        aria-label="Filtrar por estado"
        class="w-full sm:w-44"
        @update:model-value="(v) => list.setFilter('status', v as string)"
      />
      <USelect
        :model-value="filters.guest"
        :items="GUEST_OPTIONS"
        placeholder="Clientes e invitados"
        aria-label="Filtrar por comprador"
        class="w-full sm:w-44"
        @update:model-value="(v) => list.setFilter('guest', v as string)"
      />
      <USelect
        :model-value="filters.channel"
        :items="CHANNEL_OPTIONS"
        placeholder="Todos los canales"
        aria-label="Filtrar por canal"
        class="w-full sm:w-44"
        @update:model-value="(v) => list.setFilter('channel', v as string)"
      />
      <DateRangeFilter
        label="Colocados"
        :from="filters.placedFrom"
        :to="filters.placedTo"
        @update:from="(v) => list.setFilter('placedFrom', v)"
        @update:to="(v) => list.setFilter('placedTo', v)"
      />
      <USelect
        :model-value="filters.sort ?? '-placedAt'"
        :items="ORDER_SORT_OPTIONS"
        aria-label="Ordenar"
        class="w-full sm:w-52"
        @update:model-value="
          (v) => list.setFilter('sort', v === '-placedAt' ? undefined : (v as string))
        "
      />
      <USwitch
        :model-value="filters.hasPendingRefund === 'true'"
        label="Reembolso pendiente"
        @update:model-value="(v) => list.setFilter('hasPendingRefund', v ? 'true' : undefined)"
      />
      <USwitch
        v-if="myId"
        :model-value="!!myId && filters.placedBy === myId"
        label="Mis ventas en tienda"
        @update:model-value="(v) => list.setFilter('placedBy', v ? myId : undefined)"
      />
      <UButton
        v-if="hasFilters"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        @click="clearFilters"
        >Limpiar</UButton
      >
    </div>
    <UAlert
      v-if="filters.placedBy && filters.placedBy !== myId"
      color="info"
      variant="subtle"
      icon="i-lucide-store"
      title="Pedidos que colocó un miembro del staff en la tienda"
      :actions="[
        {
          label: 'Ver todos',
          color: 'neutral',
          variant: 'outline',
          onClick: () => list.setFilter('placedBy', undefined),
        },
      ]"
    />
    <UAlert
      v-if="filters.customerId"
      color="info"
      variant="subtle"
      icon="i-lucide-user"
      title="Pedidos de un cliente"
      :actions="[
        {
          label: 'Ver todos',
          color: 'neutral',
          variant: 'outline',
          onClick: () => list.setFilter('customerId', undefined),
        },
      ]"
    />

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.data.length === 0"
      empty-title="No hay pedidos"
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
        <template #publicCode-cell="{ row }">
          <NuxtLink
            :to="`/pedidos/${row.original.id}`"
            class="font-medium hover:underline"
            @click.stop
            >{{ row.original.publicCode }}</NuxtLink
          >
          <div class="flex items-center gap-1 text-xs text-muted">
            N.º {{ row.original.orderNumber }}
            <StatusBadge
              v-if="row.original.channel === 'STORE'"
              :value="row.original.channel"
              :styles="ORDER_CHANNEL"
              size="sm"
            />
          </div>
        </template>
        <template #placedAt-cell="{ row }">{{ formatDateTime(row.original.placedAt) }}</template>
        <template #contact-cell="{ row }">
          <span :class="{ 'text-muted': !row.original.contactEmail }">{{
            contact(row.original)
          }}</span>
          <div class="text-xs text-muted">
            {{ row.original.customerId ? 'Cliente' : 'Invitado' }}
          </div>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge :value="row.original.status" :styles="ORDER_STATUS" />
        </template>
        <template #payment-cell="{ row }">
          <StatusBadge
            v-if="row.original.payment"
            :value="row.original.payment.status"
            :styles="PAYMENT_STATUS"
          />
          <span v-else class="text-muted">—</span>
        </template>
        <template #shipment-cell="{ row }">
          <StatusBadge
            v-if="row.original.shipment"
            :value="row.original.shipment.status"
            :styles="SHIPMENT_STATUS"
          />
          <span v-else class="text-muted">{{
            row.original.fulfillment === 'IN_STORE' ? 'En tienda' : '—'
          }}</span>
        </template>
        <template #total-cell="{ row }">{{ formatMoney(row.original.grandTotal) }}</template>
      </UTable>
      <ListPagination class="mt-3" :meta="data?.meta" @update:page="list.setPage" />
    </QueryState>
  </div>
</template>
