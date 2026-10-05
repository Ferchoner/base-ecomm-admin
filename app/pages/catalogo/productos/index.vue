<script setup lang="ts">
import type { TableColumn, TableRow } from '@nuxt/ui'
import { useBrands, useCategoryTree, useProducts } from '~/features/catalog/api'
import {
  PRODUCT_SORT_OPTIONS,
  PRODUCT_STATUS,
  PRODUCT_STATUS_OPTIONS,
  STORE_VISIBILITY,
} from '~/features/catalog/status'
import { flattenTree } from '~/features/catalog/tree'
import type { Product } from '~/features/catalog/types'
import { useListParams } from '~/shared/api/use-list-params'
import { useSessionStore } from '~/shared/auth/session.store'
import { formatDateTime } from '~/shared/utils/dates'
import { useDebounced } from '~/shared/utils/debounce'

definePageMeta({ title: 'Productos', permission: 'catalog.read' })

const session = useSessionStore()
const canWrite = computed(() => session.can('catalog.write'))
const list = useListParams({ filters: ['q', 'status', 'brandId', 'categoryId', 'sort'] })
const filters = list.filters

const search = ref(filters.value.q ?? '')
const debouncedSearch = useDebounced(search)
watch(debouncedSearch, (q) => list.setFilter('q', q.trim() || undefined))

const { data, isPending, error, refetch, isFetching } = useProducts(() => ({
  page: list.page.value,
  pageSize: list.pageSize.value,
  q: filters.value.q,
  status: filters.value.status,
  brandId: filters.value.brandId,
  categoryId: filters.value.categoryId,
  sort: filters.value.sort ?? '-updatedAt',
}))

// Filtros de marca y categoría: incluyen inactivas, porque un producto puede conservarlas.
const brandSearch = ref('')
const brandQuery = useDebounced(brandSearch)
const { data: brands } = useBrands(() => ({
  page: 1,
  pageSize: 50,
  sort: 'name',
  q: brandQuery.value.trim() || undefined,
}))
const brandOptions = computed(() =>
  (brands.value?.data ?? []).map((b) => ({ value: b.id, label: b.name })),
)
const { data: tree } = useCategoryTree()
const categoryOptions = computed(() =>
  flattenTree(tree.value ?? []).map(({ node, path }) => ({
    value: node.id,
    label: path.join(' › '),
  })),
)

const hasFilters = computed(
  () =>
    !!(
      filters.value.q ||
      filters.value.status ||
      filters.value.brandId ||
      filters.value.categoryId
    ),
)
function clearFilters() {
  search.value = ''
  list.resetFilters()
}

const columns: TableColumn<Product>[] = [
  { id: 'image', header: '' },
  { accessorKey: 'title', header: 'Producto' },
  { id: 'brand', header: 'Marca' },
  { accessorKey: 'status', header: 'Estado' },
  { accessorKey: 'storeVisibility', header: 'Tienda' },
  { id: 'variants', header: 'Variantes' },
  { accessorKey: 'updatedAt', header: 'Modificado' },
]

function mainImage(p: Product) {
  return [...p.images].sort((a, b) => a.position - b.position)[0]
}

function openRow(_: Event, row: TableRow<Product>) {
  navigateTo(`/catalogo/productos/${row.original.id}`)
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-end gap-2">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Buscar por título o SKU"
        aria-label="Buscar productos"
        class="w-full sm:w-64"
      />
      <USelect
        :model-value="filters.status"
        :items="PRODUCT_STATUS_OPTIONS"
        placeholder="Todos los estados"
        aria-label="Filtrar por estado"
        class="w-full sm:w-40"
        @update:model-value="(v) => list.setFilter('status', v as string)"
      />
      <USelectMenu
        v-model:search-term="brandSearch"
        :model-value="filters.brandId"
        :items="brandOptions"
        value-key="value"
        label-key="label"
        ignore-filter
        placeholder="Todas las marcas"
        aria-label="Filtrar por marca"
        class="w-full sm:w-44"
        @update:model-value="(v: string) => list.setFilter('brandId', v)"
      />
      <USelectMenu
        :model-value="filters.categoryId"
        :items="categoryOptions"
        value-key="value"
        label-key="label"
        placeholder="Todas las categorías"
        aria-label="Filtrar por categoría"
        class="w-full sm:w-52"
        @update:model-value="(v: string) => list.setFilter('categoryId', v)"
      />
      <USelect
        :model-value="filters.sort ?? '-updatedAt'"
        :items="PRODUCT_SORT_OPTIONS"
        aria-label="Ordenar"
        class="w-full sm:w-56"
        @update:model-value="
          (v) => list.setFilter('sort', v === '-updatedAt' ? undefined : (v as string))
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
      <div class="flex-1" />
      <UButton v-if="canWrite" icon="i-lucide-plus" to="/catalogo/productos/nuevo"
        >Nuevo producto</UButton
      >
    </div>

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.data.length === 0"
      empty-title="No hay productos"
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
        <template #image-cell="{ row }">
          <img
            v-if="mainImage(row.original)"
            :src="mainImage(row.original)!.url"
            alt=""
            loading="lazy"
            class="size-10 rounded object-cover"
          />
          <div v-else class="flex size-10 items-center justify-center rounded bg-elevated">
            <UIcon name="i-lucide-image-off" class="size-4 text-muted" />
          </div>
        </template>
        <template #title-cell="{ row }">
          <NuxtLink
            :to="`/catalogo/productos/${row.original.id}`"
            class="font-medium hover:underline"
            @click.stop
          >
            {{ row.original.title }}
          </NuxtLink>
          <div class="text-xs text-muted">{{ row.original.slug }}</div>
        </template>
        <template #brand-cell="{ row }">{{ row.original.brand?.name ?? '—' }}</template>
        <template #status-cell="{ row }">
          <StatusBadge :value="row.original.status" :styles="PRODUCT_STATUS" />
        </template>
        <template #storeVisibility-cell="{ row }">
          <StatusBadge :value="row.original.storeVisibility" :styles="STORE_VISIBILITY" />
        </template>
        <template #variants-cell="{ row }">{{ row.original.variants.length }}</template>
        <template #updatedAt-cell="{ row }">{{ formatDateTime(row.original.updatedAt) }}</template>
      </UTable>
      <ListPagination class="mt-3" :meta="data?.meta" @update:page="list.setPage" />
    </QueryState>
  </div>
</template>
