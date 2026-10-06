<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import { useWarehouses } from '~/features/inventory/api'
import { useShipments } from '~/features/shipping/api'
import {
  SHIPMENT_SORT_OPTIONS,
  SHIPMENT_STATUS_FILTER,
  shipmentStatusQuery,
} from '~/features/shipping/status'
import type { AdminShipment } from '~/features/shipping/types'
import { useListParams } from '~/shared/api/use-list-params'
import { useSessionStore } from '~/shared/auth/session.store'
import { SHIPMENT_STATUS } from '~/shared/status/sales'
import { formatDateTime } from '~/shared/utils/dates'
import { useDebounced } from '~/shared/utils/debounce'

definePageMeta({ title: 'Envíos', permission: 'shipping.manage' })

const list = useListParams({
  filters: ['q', 'status', 'orderId', 'warehouseId', 'createdFrom', 'createdTo', 'sort'],
})
const filters = list.filters

const search = ref(filters.value.q ?? '')
const debouncedSearch = useDebounced(search)
watch(debouncedSearch, (q) => list.setFilter('q', q.trim() || undefined))

const { data, isPending, error, refetch, isFetching } = useShipments(() => ({
  page: list.page.value,
  pageSize: list.pageSize.value,
  q: filters.value.q,
  status: shipmentStatusQuery(filters.value.status),
  orderId: filters.value.orderId,
  warehouseId: filters.value.warehouseId,
  createdFrom: filters.value.createdFrom,
  createdTo: filters.value.createdTo,
  sort: filters.value.sort ?? 'createdAt',
}))

// Almacén de salida (ADR-0160). Los nombres requieren `inventory.read`; sin él no hay filtro.
const session = useSessionStore()
const { data: warehouses } = useWarehouses({ enabled: () => session.can('inventory.read') })
const warehouseOptions = computed(() =>
  (warehouses.value ?? []).map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
)
function warehouseCode(id: string) {
  return warehouses.value?.find((w) => w.id === id)?.code ?? null
}

const hasFilters = computed(() =>
  Object.entries(filters.value).some(([k, v]) => k !== 'sort' && v !== undefined),
)
function clearFilters() {
  search.value = ''
  list.resetFilters()
}

const columns: TableColumn<AdminShipment>[] = [
  { accessorKey: 'orderCode', header: 'Pedido' },
  { accessorKey: 'status', header: 'Estado' },
  { id: 'destination', header: 'Destino' },
  { id: 'warehouse', header: 'Sale de' },
  { id: 'items', header: 'Piezas' },
  { id: 'tracking', header: 'Guía' },
  { accessorKey: 'createdAt', header: 'Creado' },
]

function openRow(_: Event, row: TableRow<AdminShipment>) {
  navigateTo(`/envios/${row.original.id}`)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-2">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Código del pedido o guía"
        aria-label="Buscar envíos"
        class="w-full sm:w-64"
      />
      <USelect
        :model-value="filters.status ?? 'PENDING'"
        :items="SHIPMENT_STATUS_FILTER"
        aria-label="Filtrar por estado"
        class="w-full sm:w-44"
        @update:model-value="
          (v) => list.setFilter('status', v === 'PENDING' ? undefined : (v as string))
        "
      />
      <USelect
        v-if="warehouseOptions.length > 1"
        :model-value="filters.warehouseId"
        :items="warehouseOptions"
        placeholder="Todos los almacenes"
        aria-label="Filtrar por almacén"
        class="w-full sm:w-56"
        @update:model-value="(v) => list.setFilter('warehouseId', v as string)"
      />
      <DateRangeFilter
        label="Creados"
        :from="filters.createdFrom"
        :to="filters.createdTo"
        @update:from="(v) => list.setFilter('createdFrom', v)"
        @update:to="(v) => list.setFilter('createdTo', v)"
      />
      <USelect
        :model-value="filters.sort ?? 'createdAt'"
        :items="SHIPMENT_SORT_OPTIONS"
        aria-label="Ordenar"
        class="w-full sm:w-56"
        @update:model-value="
          (v) => list.setFilter('sort', v === 'createdAt' ? undefined : (v as string))
        "
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

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.data.length === 0"
      :empty-title="filters.status ? 'No hay envíos' : 'No hay envíos por despachar'"
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
            :to="`/envios/${row.original.id}`"
            class="font-medium hover:underline"
            @click.stop
            >{{ row.original.orderCode }}</NuxtLink
          >
        </template>
        <template #status-cell="{ row }">
          <StatusBadge :value="row.original.status" :styles="SHIPMENT_STATUS" />
        </template>
        <template #destination-cell="{ row }">
          {{ row.original.destination.municipalityName }}, {{ row.original.destination.stateName }}
          <div class="text-xs text-muted">C.P. {{ row.original.destination.postalCode }}</div>
        </template>
        <template #warehouse-cell="{ row }">
          <code class="text-xs">{{
            warehouseCode(row.original.warehouseId) ?? row.original.warehouseId.slice(0, 8)
          }}</code>
        </template>
        <template #items-cell="{ row }">{{
          row.original.items.reduce((sum, i) => sum + i.quantity, 0)
        }}</template>
        <template #tracking-cell="{ row }">
          <span v-if="row.original.ownDelivery">Entrega propia</span>
          <span v-else-if="row.original.trackingNumber"
            >{{ row.original.carrierName }} · {{ row.original.trackingNumber }}</span
          >
          <span v-else class="text-muted">Sin guía</span>
        </template>
        <template #createdAt-cell="{ row }">{{ formatDateTime(row.original.createdAt) }}</template>
      </UTable>
      <ListPagination class="mt-3" :meta="data?.meta" @update:page="list.setPage" />
    </QueryState>
  </div>
</template>
