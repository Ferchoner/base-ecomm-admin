<script setup lang="ts">
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { useProduct } from '~/features/catalog/api'
import ProductPicker from '~/features/catalog/components/ProductPicker.vue'
import { useActiveWarehouse, useStockItems, useStockOfVariant } from '~/features/inventory/api'
import MovementsSlideover from '~/features/inventory/components/MovementsSlideover.vue'
import StockEntryModal from '~/features/inventory/components/StockEntryModal.vue'
import { STOCK_SORT_OPTIONS } from '~/features/inventory/status'
import type { StockItem } from '~/features/inventory/types'
import { useListParams } from '~/shared/api/use-list-params'
import { useSessionStore } from '~/shared/auth/session.store'
import { formatDateTime } from '~/shared/utils/dates'
import { useDebounced } from '~/shared/utils/debounce'

definePageMeta({ title: 'Inventario', permission: 'inventory.read' })

const session = useSessionStore()
const canWrite = computed(() => session.can('inventory.write'))
const canBrowseCatalog = computed(() => session.can('catalog.read'))
const list = useListParams({ filters: ['q', 'availableMax', 'sort'] })
const filters = list.filters

const search = ref(filters.value.q ?? '')
const debouncedSearch = useDebounced(search)
watch(debouncedSearch, (q) => list.setFilter('q', q.trim() || undefined))

// "Disponibles hasta N": el umbral de stock bajo no está documentado, lo escribe el usuario (G-06).
const threshold = ref(filters.value.availableMax ?? '')
const debouncedThreshold = useDebounced(threshold)
watch(debouncedThreshold, (v) => {
  const n = Number(v)
  list.setFilter('availableMax', v !== '' && Number.isInteger(n) && n >= 0 ? String(n) : undefined)
})

const { data, isPending, error, refetch, isFetching } = useStockItems(() => ({
  page: list.page.value,
  pageSize: list.pageSize.value,
  q: filters.value.q,
  availableMax:
    filters.value.availableMax !== undefined ? Number(filters.value.availableMax) : undefined,
  sort: filters.value.sort ?? 'sku',
}))
const { warehouse } = useActiveWarehouse()

// Modal de entrada o ajuste, desde una fila o eligiendo cualquier variante del catálogo.
const entry = reactive<{
  open: boolean
  mode: 'receipt' | 'adjustment'
  variantId: string
  sku: string
  productTitle?: string
  stock: StockItem | null
}>({ open: false, mode: 'receipt', variantId: '', sku: '', stock: null })
function openEntry(item: StockItem, mode: 'receipt' | 'adjustment') {
  Object.assign(entry, {
    open: true,
    mode,
    variantId: item.variantId,
    sku: item.sku,
    productTitle: item.productTitle,
    stock: item,
  })
}

const movementsOpen = ref(false)
const movementsItem = ref<StockItem | null>(null)
function openMovements(item: StockItem) {
  movementsItem.value = item
  movementsOpen.value = true
}

// Entrada de una variante que aún no aparece en el listado (solo aparecen las que ya tuvieron movimientos).
const pickerOpen = ref(false)
const pickedProduct = ref<string>()
const pickedVariant = ref<string>()
const productQuery = useProduct(() => pickedProduct.value ?? '')
const variantOptions = computed(() =>
  (productQuery.data.value?.variants ?? []).map((v) => ({ value: v.id, label: v.sku })),
)
const pickedStock = useStockOfVariant(() => pickedVariant.value)
watch(pickedProduct, () => (pickedVariant.value = undefined))
function continueWithVariant(mode: 'receipt' | 'adjustment') {
  const product = productQuery.data.value
  const variant = product?.variants.find((v) => v.id === pickedVariant.value)
  if (!product || !variant) return
  pickerOpen.value = false
  Object.assign(entry, {
    open: true,
    mode,
    variantId: variant.id,
    sku: variant.sku,
    productTitle: product.title,
    stock: pickedStock.data.value ?? null,
  })
}

function rowActions(item: StockItem): DropdownMenuItem[] {
  return [
    { label: 'Ver movimientos', icon: 'i-lucide-history', onSelect: () => openMovements(item) },
    ...(canWrite.value && warehouse.value
      ? [
          {
            label: 'Registrar entrada',
            icon: 'i-lucide-package-plus',
            onSelect: () => openEntry(item, 'receipt'),
          },
          {
            label: 'Ajustar',
            icon: 'i-lucide-sliders-horizontal',
            onSelect: () => openEntry(item, 'adjustment'),
          },
        ]
      : []),
  ]
}

const columns: TableColumn<StockItem>[] = [
  { accessorKey: 'sku', header: 'SKU' },
  { accessorKey: 'productTitle', header: 'Producto' },
  { accessorKey: 'onHand', header: 'Físicas' },
  { accessorKey: 'reserved', header: 'Apartadas' },
  { accessorKey: 'available', header: 'Disponibles' },
  { accessorKey: 'updatedAt', header: 'Último movimiento' },
  { id: 'actions', header: '' },
]

const hasFilters = computed(() => !!(filters.value.q || filters.value.availableMax))
function clearFilters() {
  search.value = ''
  threshold.value = ''
  list.resetFilters()
}
</script>

<template>
  <div class="space-y-4">
    <InventoryTabs />

    <div class="flex flex-wrap items-end gap-2">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Buscar por SKU o producto"
        aria-label="Buscar existencias"
        class="w-full sm:w-64"
      />
      <UFormField label="Disponibles hasta" class="w-full sm:w-36">
        <UInput
          v-model="threshold"
          type="number"
          min="0"
          inputmode="numeric"
          placeholder="Sin límite"
        />
      </UFormField>
      <USelect
        :model-value="filters.sort ?? 'sku'"
        :items="STOCK_SORT_OPTIONS"
        aria-label="Ordenar"
        class="w-full sm:w-56"
        @update:model-value="(v) => list.setFilter('sort', v === 'sku' ? undefined : (v as string))"
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
      <UButton
        v-if="canWrite && canBrowseCatalog && warehouse"
        icon="i-lucide-package-plus"
        @click="pickerOpen = true"
        >Registrar movimiento</UButton
      >
    </div>

    <QueryState
      :loading="isPending"
      :error="error"
      :empty="data?.data.length === 0"
      empty-title="Sin existencias"
      :empty-description="
        hasFilters
          ? 'Prueba con otros filtros.'
          : 'Aquí aparecen las variantes que ya tuvieron una entrada o un ajuste.'
      "
      @retry="refetch()"
    >
      <UTable
        :data="data?.data ?? []"
        :columns="columns"
        :loading="isFetching"
        class="rounded-md border border-default"
      >
        <template #sku-cell="{ row }">
          <code class="text-xs font-medium">{{ row.original.sku }}</code>
        </template>
        <template #available-cell="{ row }">
          <span :class="['font-semibold', row.original.available <= 0 && 'text-error']">
            {{ row.original.available }}
          </span>
        </template>
        <template #updatedAt-cell="{ row }">{{ formatDateTime(row.original.updatedAt) }}</template>
        <template #actions-cell="{ row }">
          <div class="text-right">
            <UDropdownMenu :items="rowActions(row.original)">
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                :aria-label="`Acciones de ${row.original.sku}`"
              />
            </UDropdownMenu>
          </div>
        </template>
      </UTable>
      <ListPagination class="mt-3" :meta="data?.meta" @update:page="list.setPage" />
    </QueryState>

    <UModal v-model:open="pickerOpen" title="Registrar movimiento" description="Elige la variante.">
      <template #body>
        <div class="space-y-4">
          <UFormField label="Producto">
            <ProductPicker v-model="pickedProduct" />
          </UFormField>
          <UFormField label="Variante">
            <USelect
              v-model="pickedVariant"
              :items="variantOptions"
              :disabled="!pickedProduct || productQuery.isPending.value"
              placeholder="Elige el SKU"
              class="w-full"
            />
          </UFormField>
          <p v-if="pickedVariant && pickedStock.data.value" class="text-sm text-muted">
            Disponibles: {{ pickedStock.data.value.available }} de
            {{ pickedStock.data.value.onHand }} físicas.
          </p>
          <p
            v-else-if="pickedVariant && pickedStock.data.value === null"
            class="text-sm text-muted"
          >
            Esta variante aún no tiene existencias.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            :disabled="!pickedVariant || pickedStock.isPending.value"
            @click="continueWithVariant('adjustment')"
            >Ajustar</UButton
          >
          <UButton
            :disabled="!pickedVariant || pickedStock.isPending.value"
            @click="continueWithVariant('receipt')"
            >Registrar entrada</UButton
          >
        </div>
      </template>
    </UModal>

    <StockEntryModal
      v-if="warehouse"
      v-model:open="entry.open"
      :mode="entry.mode"
      :variant-id="entry.variantId"
      :sku="entry.sku"
      :product-title="entry.productTitle"
      :warehouse-id="warehouse.id"
      :stock="entry.stock"
    />
    <MovementsSlideover v-if="movementsItem" v-model:open="movementsOpen" :item="movementsItem" />
  </div>
</template>
