<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useCategoryTree } from '~/features/catalog/api'
import { flattenTree } from '~/features/catalog/tree'
import { useCounts, useWarehouses } from '~/features/inventory/api'
import OpenCountModal from '~/features/inventory/components/OpenCountModal.vue'
import { COUNT_STATUS, countFilterLabel } from '~/features/inventory/status'
import type { Count, CountStatus, CountSummary } from '~/features/inventory/types'
import { useListParams } from '~/shared/api/use-list-params'
import { useSessionStore } from '~/shared/auth/session.store'
import { useDeviceWarehouse } from '~/shared/device/device-warehouse'
import { formatDateTime } from '~/shared/utils/dates'

definePageMeta({ title: 'Conteos', permission: 'inventory.read' })

/**
 * Hojas de conteo (UC-INV-18 a 20, ADR-0173): se abren por ubicación, categoría o clase; quien cuenta
 * captura sin ver lo esperado, y quien revisa aplica los ajustes de una vez o cancela la hoja.
 */
const session = useSessionStore()
const canOpen = computed(() => session.can('inventory.write'))
const list = useListParams({ filters: ['warehouseId', 'status'] })
const filters = list.filters

// Lo normal es ver las abiertas, que son las que hay que contar.
const status = computed(() => (filters.value.status ?? 'OPEN') as CountStatus | 'all')
const STATUS_OPTIONS = [
  ...(Object.keys(COUNT_STATUS) as CountStatus[]).map((value) => ({
    value: value as string,
    label: `${COUNT_STATUS[value].label}s`,
  })),
  { value: 'all', label: 'Todas' },
]
const params = computed(() => ({
  page: list.page.value,
  pageSize: list.pageSize.value,
  warehouseId: filters.value.warehouseId,
  status: status.value === 'all' ? undefined : status.value,
}))
const { data, isPending, error, refetch, isFetching } = useCounts(params)

const { data: warehouses } = useWarehouses()
const warehouseOptions = computed(() =>
  (warehouses.value ?? []).map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
)
const activeWarehouseOptions = computed(() =>
  (warehouses.value ?? [])
    .filter((w) => w.status === 'ACTIVE')
    .map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
)
function warehouseName(id: string) {
  return warehouses.value?.find((w) => w.id === id)?.name ?? id
}

// Las categorías solo se leen con permiso de catálogo; sin él, la hoja dice "una categoría".
const tree = useCategoryTree(undefined, { enabled: () => session.can('catalog.read') })
const categories = computed(() =>
  flattenTree(tree.data.value ?? []).map(({ node, path }) => ({
    value: node.id,
    label: path.join(' › '),
  })),
)
function categoryName(id: string) {
  return categories.value.find((c) => c.value === id)?.label ?? 'elegida'
}

const deviceWarehouse = useDeviceWarehouse()
const opening = ref(false)
function opened(count: Count) {
  void navigateTo(`/inventario/conteos/${count.id}`)
}

const columns: TableColumn<CountSummary>[] = [
  { accessorKey: 'folio', header: 'Folio' },
  { id: 'warehouse', header: 'Almacén' },
  { id: 'filter', header: 'Qué se cuenta' },
  { id: 'progress', header: 'Contadas' },
  { id: 'status', header: 'Estado' },
  { accessorKey: 'createdAt', header: 'Abierta' },
]

const hasFilters = computed(() => !!(filters.value.warehouseId || filters.value.status))
</script>

<template>
  <div class="space-y-4">
    <InventoryTabs />

    <div class="flex flex-wrap items-start justify-between gap-3">
      <p class="max-w-3xl text-sm text-muted">
        Una hoja junta lo que hay que contar en un almacén. Quien cuenta no ve cuántas espera el
        sistema; al revisarla se ve la diferencia, se pide recontar lo que no cuadra y se aplica de
        una vez. Lo que no se contó no se ajusta.
      </p>
      <UButton v-if="canOpen" icon="i-lucide-clipboard-list" @click="opening = true"
        >Abrir una hoja</UButton
      >
    </div>

    <div class="flex flex-wrap items-end gap-2">
      <USelect
        :model-value="status"
        :items="STATUS_OPTIONS"
        aria-label="Filtrar por estado"
        class="w-full sm:w-48"
        @update:model-value="
          (v) => list.setFilter('status', v === 'OPEN' ? undefined : (v as string))
        "
      />
      <USelect
        :model-value="filters.warehouseId"
        :items="warehouseOptions"
        placeholder="Todos los almacenes"
        aria-label="Filtrar por almacén"
        class="w-full sm:w-56"
        @update:model-value="(v) => list.setFilter('warehouseId', v as string)"
      />
      <UButton
        v-if="hasFilters"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        @click="list.setFilters({ warehouseId: undefined, status: undefined })"
        >Limpiar</UButton
      >
    </div>

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.data.length === 0"
      :empty-title="status === 'OPEN' ? 'Sin hojas abiertas' : 'Sin hojas'"
      :empty-description="
        status === 'OPEN'
          ? canOpen
            ? 'Abre una para contar una ubicación, una categoría o una clase.'
            : 'Cuando abran una para contar, aparece aquí.'
          : 'Prueba con otros filtros.'
      "
      @retry="refetch()"
    >
      <UTable
        :data="data?.data ?? []"
        :columns="columns"
        :loading="isFetching"
        class="rounded-md border border-default"
      >
        <template #folio-cell="{ row }">
          <ULink :to="`/inventario/conteos/${row.original.id}`" class="font-medium">
            <code class="text-xs">{{ row.original.folio }}</code>
          </ULink>
        </template>
        <template #warehouse-cell="{ row }">{{ warehouseName(row.original.warehouseId) }}</template>
        <template #filter-cell="{ row }">
          <span class="text-sm">{{ countFilterLabel(row.original.filter, categoryName) }}</span>
          <p v-if="row.original.note" class="text-xs text-muted">{{ row.original.note }}</p>
        </template>
        <template #progress-cell="{ row }">
          <span class="tabular-nums"
            >{{ row.original.countedCount }} de {{ row.original.lineCount }}</span
          >
        </template>
        <template #status-cell="{ row }">
          <StatusBadge :value="row.original.status" :styles="COUNT_STATUS" />
        </template>
        <template #createdAt-cell="{ row }">{{ formatDateTime(row.original.createdAt) }}</template>
      </UTable>
      <ListPagination class="mt-3" :meta="data?.meta" @update:page="list.setPage" />
    </QueryState>

    <OpenCountModal
      v-model:open="opening"
      :warehouses="activeWarehouseOptions"
      :categories="categories"
      :warehouse-id="filters.warehouseId ?? deviceWarehouse.warehouseId.value ?? undefined"
      @opened="opened"
    />
  </div>
</template>
