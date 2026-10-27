<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import { useWorkOrders } from '~/features/work-orders/api'
import StaffName from '~/features/work-orders/components/StaffName.vue'
import {
  WORK_ORDER_SORT_OPTIONS,
  WORK_ORDER_STATUS,
  WORK_ORDER_STATUS_OPTIONS,
  equipmentLabel,
  folioNumber,
} from '~/features/work-orders/status'
import type { WorkOrderSummary } from '~/features/work-orders/types'
import { useListParams } from '~/shared/api/use-list-params'
import { useSessionStore } from '~/shared/auth/session.store'
import { formatDateTime } from '~/shared/utils/dates'
import { FOLIO_CODE, fixScannedCode } from '~/shared/scanner/scanned-text'
import { useDebounced } from '~/shared/utils/debounce'

definePageMeta({ title: 'Órdenes de trabajo', permission: 'work-orders.read' })

const list = useListParams({
  filters: ['q', 'status', 'technicianId', 'receivedFrom', 'receivedTo', 'sort'],
})
const filters = list.filters
const session = useSessionStore()
const myId = computed(() => session.account?.id)
const canManage = computed(() => session.can('work-orders.manage'))

const search = ref(filters.value.q ?? '')
watch(search, (v) => (search.value = fixScannedCode(v, FOLIO_CODE)))
const debouncedSearch = useDebounced(search)
/** Al abrir la orden, la búsqueda pendiente ya no debe cambiar la URL (cancelaría la navegación). */
let leaving = false
watch(debouncedSearch, (q) => {
  if (!leaving) void list.setFilter('q', q.trim() || undefined)
})

const { data, isPending, error, refetch, isFetching, isPlaceholderData } = useWorkOrders(() => ({
  page: list.page.value,
  pageSize: list.pageSize.value,
  q: filters.value.q,
  status: filters.value.status,
  technicianId: filters.value.technicianId,
  receivedFrom: filters.value.receivedFrom,
  receivedTo: filters.value.receivedTo,
  sort: filters.value.sort ?? '-receivedAt',
}))

// Enter o el lector con el folio de la nota (Code 128): si coincide exacto, abre la orden.
const openExact = ref<number | null>(null)
async function onSearchEnter() {
  const q = search.value.trim()
  if (!q) return
  await list.setFilter('q', q)
  openExact.value = folioNumber(q)
  void nextTick(openIfExact)
}
function openIfExact() {
  if (!openExact.value || isFetching.value || isPlaceholderData.value || !data.value) return
  const match = data.value.data.filter((w) => folioNumber(w.folio) === openExact.value)
  openExact.value = null
  if (match.length !== 1) return
  leaving = true
  void navigateTo(`/ordenes-trabajo/${match[0]!.id}`)
}
watch([data, isFetching], openIfExact)

const hasFilters = computed(() =>
  Object.entries(filters.value).some(([k, v]) => k !== 'sort' && v !== undefined),
)
function clearFilters() {
  search.value = ''
  list.resetFilters()
}

const columns: TableColumn<WorkOrderSummary>[] = [
  { accessorKey: 'folio', header: 'Folio' },
  { id: 'customer', header: 'Cliente' },
  { id: 'equipment', header: 'Equipo' },
  { accessorKey: 'status', header: 'Estado' },
  { id: 'technician', header: 'Técnico' },
]

function openRow(_: Event, row: TableRow<WorkOrderSummary>) {
  navigateTo(`/ordenes-trabajo/${row.original.id}`)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-2">
      <UInput
        v-model="search"
        icon="i-lucide-scan-barcode"
        placeholder="Folio, teléfono, nombre o serie"
        aria-label="Buscar órdenes de trabajo"
        class="w-full sm:w-72"
        @keydown.enter.prevent="onSearchEnter"
      />
      <USelect
        :model-value="filters.status"
        :items="WORK_ORDER_STATUS_OPTIONS"
        placeholder="Todos los estados"
        aria-label="Filtrar por estado"
        class="w-full sm:w-48"
        @update:model-value="(v) => list.setFilter('status', v as string)"
      />
      <DateRangeFilter
        label="Recibidas"
        :from="filters.receivedFrom"
        :to="filters.receivedTo"
        @update:from="(v) => list.setFilter('receivedFrom', v)"
        @update:to="(v) => list.setFilter('receivedTo', v)"
      />
      <USelect
        :model-value="filters.sort ?? '-receivedAt'"
        :items="WORK_ORDER_SORT_OPTIONS"
        aria-label="Ordenar"
        class="w-full sm:w-52"
        @update:model-value="
          (v) => list.setFilter('sort', v === '-receivedAt' ? undefined : (v as string))
        "
      />
      <USwitch
        v-if="myId"
        :model-value="!!myId && filters.technicianId === myId"
        label="Asignadas a mí"
        @update:model-value="(v) => list.setFilter('technicianId', v ? myId : undefined)"
      />
      <UButton
        v-if="hasFilters"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        @click="clearFilters"
        >Limpiar</UButton
      >
      <div class="flex-1" />
      <UButton v-if="canManage" icon="i-lucide-inbox" to="/ordenes-trabajo/nueva"
        >Recibir equipo</UButton
      >
    </div>

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.data.length === 0"
      empty-title="No hay órdenes de trabajo"
      :empty-description="
        hasFilters
          ? 'Prueba con otros filtros. Una orden con los datos bloqueados solo se encuentra por su folio.'
          : undefined
      "
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
        <template #folio-cell="{ row }">
          <NuxtLink
            :to="`/ordenes-trabajo/${row.original.id}`"
            class="font-mono font-medium hover:underline"
            @click.stop
            >{{ row.original.folio }}</NuxtLink
          >
          <div class="text-xs text-muted">{{ formatDateTime(row.original.receivedAt) }}</div>
        </template>
        <template #customer-cell="{ row }">
          <span v-if="row.original.customerName">{{ row.original.customerName }}</span>
          <span v-else class="text-muted">Datos no disponibles</span>
          <div class="text-xs text-muted">{{ row.original.customerPhone }}</div>
        </template>
        <template #equipment-cell="{ row }">
          {{ equipmentLabel(row.original) }}
          <div v-if="row.original.serialNumber" class="text-xs text-muted">
            Serie {{ row.original.serialNumber }}
          </div>
        </template>
        <template #status-cell="{ row }">
          <StatusBadge :value="row.original.status" :styles="WORK_ORDER_STATUS" />
        </template>
        <template #technician-cell="{ row }">
          <StaffName :id="row.original.technicianId" />
        </template>
      </UTable>
      <ListPagination class="mt-3" :meta="data?.meta" @update:page="list.setPage" />
    </QueryState>
  </div>
</template>
