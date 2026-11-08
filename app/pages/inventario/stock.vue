<script setup lang="ts">
import { useDeviceWarehouse } from '~/shared/device/device-warehouse'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { useProduct } from '~/features/catalog/api'
import ProductPicker from '~/features/catalog/components/ProductPicker.vue'
import { useStockItems, useStockOfVariant, useWarehouses } from '~/features/inventory/api'
import LocationModal from '~/features/inventory/components/LocationModal.vue'
import MovementsSlideover from '~/features/inventory/components/MovementsSlideover.vue'
import StockEntryModal from '~/features/inventory/components/StockEntryModal.vue'
import TransferStockModal from '~/features/inventory/components/TransferStockModal.vue'
import { normalizeLocation, STOCK_SORT_OPTIONS } from '~/features/inventory/status'
import type { StockItem } from '~/features/inventory/types'
import { useListParams } from '~/shared/api/use-list-params'
import { variantOptionsLabel } from '~/shared/api/variant-lookup'
import type { VariantLookup } from '~/shared/api/variant-lookup'
import { useSessionStore } from '~/shared/auth/session.store'
import { usePreferencesStore } from '~/shared/preferences/preferences.store'
import { useVariantScan } from '~/shared/scanner/use-variant-scan'
import { formatDateTime } from '~/shared/utils/dates'
import { useDebounced } from '~/shared/utils/debounce'

definePageMeta({ title: 'Inventario', permission: 'inventory.read' })

const session = useSessionStore()
const canWrite = computed(() => session.can('inventory.write'))
const canTransfer = computed(() => session.can('inventory.transfer'))
const canLocate = computed(() => session.can('inventory.count'))
const canBrowseCatalog = computed(() => session.can('catalog.read'))
const list = useListParams({
  filters: ['q', 'warehouseId', 'availableMax', 'location', 'hasLocation', 'sort'],
})
const filters = list.filters

const search = ref(filters.value.q ?? '')
const debouncedSearch = useDebounced(search)
watch(debouncedSearch, (q) => list.setFilter('q', q.trim() || undefined))

// Ubicación exacta o, con * al final, las que empiezan así (ADR-0173).
const locationText = ref(filters.value.location ?? '')
const debouncedLocation = useDebounced(locationText)
watch(debouncedLocation, (v) => {
  const location = normalizeLocation(v)
  const part = location.endsWith('*') ? location.slice(0, -1).trim() : location
  list.setFilter('location', part !== '' && part.length <= 20 ? location : undefined)
})
const HAS_LOCATION_OPTIONS = [
  { value: 'all', label: 'Con y sin ubicación' },
  { value: 'true', label: 'Con ubicación' },
  { value: 'false', label: 'Sin ubicación' },
]

// "Disponibles hasta N". El atajo "Stock bajo" usa el umbral de cada usuario (G-06, Mi cuenta).
const prefs = usePreferencesStore()
function showLowStock() {
  threshold.value = String(prefs.lowStockThreshold)
}
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
  warehouseId: filters.value.warehouseId,
  availableMax:
    filters.value.availableMax !== undefined ? Number(filters.value.availableMax) : undefined,
  location: filters.value.location,
  hasLocation:
    filters.value.hasLocation === undefined ? undefined : filters.value.hasLocation === 'true',
  sort: filters.value.sort ?? 'sku',
}))
// Varios almacenes (ADR-0160): entradas solo en activos; ajustes en cualquiera.
const { data: warehouses } = useWarehouses()
const warehouseById = computed(() => new Map((warehouses.value ?? []).map((w) => [w.id, w])))
const activeWarehouses = computed(() =>
  (warehouses.value ?? []).filter((w) => w.status === 'ACTIVE'),
)
const warehouseOptions = computed(() =>
  (warehouses.value ?? []).map((w) => ({
    value: w.id,
    label: w.status === 'ACTIVE' ? `${w.name} (${w.code})` : `${w.name} (${w.code}, inactivo)`,
  })),
)
const isActive = (warehouseId: string) => warehouseById.value.get(warehouseId)?.status === 'ACTIVE'
function warehouseName(warehouseId: string) {
  const w = warehouseById.value.get(warehouseId)
  return w ? `${w.name} (${w.code})` : warehouseId
}

// Modal de entrada o ajuste, desde una fila o eligiendo cualquier variante del catálogo.
const entry = reactive<{
  open: boolean
  mode: 'receipt' | 'adjustment'
  variantId: string
  sku: string
  productTitle?: string
  warehouseId: string
  stock: StockItem | null
}>({ open: false, mode: 'receipt', variantId: '', sku: '', warehouseId: '', stock: null })
function openEntry(item: StockItem, mode: 'receipt' | 'adjustment') {
  Object.assign(entry, {
    open: true,
    mode,
    variantId: item.variantId,
    sku: item.sku,
    productTitle: item.productTitle,
    warehouseId: item.warehouseId,
    stock: item,
  })
}

const transferOpen = ref(false)
const transferItem = ref<StockItem | null>(null)
const transferKind = ref<'TRANSFER' | 'LOAN'>('TRANSFER')
function openTransfer(item: StockItem, kind: 'TRANSFER' | 'LOAN') {
  transferItem.value = item
  transferKind.value = kind
  transferOpen.value = true
}

// Ubicación de una existencia, o de una variante que aún no tiene unidades en ese almacén.
const locating = reactive<{
  open: boolean
  variantId: string
  sku: string
  productTitle?: string
  warehouseId: string
  location: string | null
}>({ open: false, variantId: '', sku: '', warehouseId: '', location: null })
function openLocation(
  item: Pick<StockItem, 'variantId' | 'sku' | 'productTitle' | 'warehouseId' | 'location'>,
) {
  Object.assign(locating, { ...item, open: true })
}
// Las ubicaciones que ya existen en ese almacén, para sugerirlas (hasta 100 existencias).
const located = useStockItems(
  () => ({ page: 1, pageSize: 100, warehouseId: locating.warehouseId, hasLocation: true }),
  { enabled: () => locating.open && !!locating.warehouseId },
)
const locationSuggestions = computed(() =>
  [
    ...new Set((located.data.value?.data ?? []).map((s) => s.location).filter((l) => l !== null)),
  ].sort(),
)

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
// El almacén inicial es el del equipo (D-097), salvo que la lista ya esté filtrada por uno.
const device = useDeviceWarehouse()
const pickedWarehouse = ref<string>()
watch(
  [pickerOpen, activeWarehouses],
  () => {
    if (pickerOpen.value && !pickedWarehouse.value)
      pickedWarehouse.value =
        filters.value.warehouseId ??
        (device.initial(activeWarehouses.value.map((w) => w.id)) || undefined)
  },
  { immediate: true },
)
const variantStock = useStockOfVariant(() => pickedVariant.value)
/** Existencia de la variante elegida en el almacén elegido; `null` si nunca tuvo movimientos ahí. */
const pickedStock = computed(() =>
  variantStock.data.value === undefined
    ? undefined
    : (variantStock.data.value.find((s) => s.warehouseId === pickedWarehouse.value) ?? null),
)
watch(pickedProduct, () => (pickedVariant.value = undefined))

// Con el lector o escribiendo el SKU o GTIN exacto se elige la variante sin buscar el producto.
const scanCode = ref('')
const scanned = ref<VariantLookup | null>(null)
const scan = useVariantScan({
  onFound: (v) => {
    scanned.value = v
    pickedVariant.value = v.id
    scanCode.value = ''
    return undefined
  },
})
function clearScanned() {
  scanned.value = null
  pickedVariant.value = undefined
  scan.clear()
}
watch(pickerOpen, (open) => {
  if (open) return
  scanned.value = null
  scanCode.value = ''
  scan.clear()
})

function pickedVariantLabel() {
  const product = productQuery.data.value
  if (scanned.value)
    return { id: scanned.value.id, sku: scanned.value.sku, title: scanned.value.product.title }
  const v = product?.variants.find((x) => x.id === pickedVariant.value)
  return v && product ? { id: v.id, sku: v.sku, title: product.title } : undefined
}

/** La ubicación de la variante elegida, aunque aún no tenga unidades en ese almacén (ADR-0173). */
function locateVariant() {
  const variant = pickedVariantLabel()
  if (!variant || !pickedWarehouse.value) return
  pickerOpen.value = false
  openLocation({
    variantId: variant.id,
    sku: variant.sku,
    productTitle: variant.title,
    warehouseId: pickedWarehouse.value,
    location: pickedStock.value?.location ?? null,
  })
}

function continueWithVariant(mode: 'receipt' | 'adjustment') {
  const product = productQuery.data.value
  const variant = scanned.value
    ? { id: scanned.value.id, sku: scanned.value.sku, title: scanned.value.product.title }
    : (() => {
        const v = product?.variants.find((x) => x.id === pickedVariant.value)
        return v && product ? { id: v.id, sku: v.sku, title: product.title } : undefined
      })()
  if (!variant || !pickedWarehouse.value) return
  pickerOpen.value = false
  Object.assign(entry, {
    open: true,
    mode,
    variantId: variant.id,
    sku: variant.sku,
    productTitle: variant.title,
    warehouseId: pickedWarehouse.value,
    stock: pickedStock.value ?? null,
  })
}

function rowActions(item: StockItem): DropdownMenuItem[] {
  return [
    { label: 'Ver movimientos', icon: 'i-lucide-history', onSelect: () => openMovements(item) },
    ...(canLocate.value
      ? [
          {
            label: item.location ? 'Cambiar ubicación' : 'Poner ubicación',
            icon: 'i-lucide-map-pin',
            onSelect: () => openLocation(item),
          },
        ]
      : []),
    ...(canWrite.value && isActive(item.warehouseId)
      ? [
          {
            label: 'Registrar entrada',
            icon: 'i-lucide-package-plus',
            onSelect: () => openEntry(item, 'receipt'),
          },
        ]
      : []),
    ...(canWrite.value
      ? [
          {
            label: 'Ajustar',
            icon: 'i-lucide-sliders-horizontal',
            onSelect: () => openEntry(item, 'adjustment'),
          },
        ]
      : []),
    ...(canTransfer.value &&
    item.available > 0 &&
    activeWarehouses.value.some((w) => w.id !== item.warehouseId)
      ? [
          {
            label: 'Trasladar a otro almacén',
            icon: 'i-lucide-arrow-right-left',
            onSelect: () => openTransfer(item, 'TRANSFER'),
          },
          {
            label: 'Prestar para mostrar',
            icon: 'i-lucide-hand-helping',
            onSelect: () => openTransfer(item, 'LOAN'),
          },
        ]
      : []),
  ]
}

const columns: TableColumn<StockItem>[] = [
  { accessorKey: 'sku', header: 'SKU' },
  { accessorKey: 'productTitle', header: 'Producto' },
  { id: 'warehouse', header: 'Almacén' },
  { accessorKey: 'location', header: 'Ubicación' },
  { accessorKey: 'onHand', header: 'Físicas' },
  { accessorKey: 'reserved', header: 'Apartadas' },
  { accessorKey: 'available', header: 'Disponibles' },
  { accessorKey: 'updatedAt', header: 'Último movimiento' },
  { id: 'actions', header: '' },
]

const hasFilters = computed(
  () =>
    !!(
      filters.value.q ||
      filters.value.availableMax ||
      filters.value.warehouseId ||
      filters.value.location ||
      filters.value.hasLocation
    ),
)
function clearFilters() {
  search.value = ''
  locationText.value = ''
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
      <USelect
        :model-value="filters.warehouseId"
        :items="warehouseOptions"
        placeholder="Todos los almacenes"
        aria-label="Filtrar por almacén"
        class="w-full sm:w-56"
        @update:model-value="(v) => list.setFilter('warehouseId', v as string)"
      />
      <UInput
        v-model="locationText"
        icon="i-lucide-map-pin"
        placeholder="Ubicación, o A* para A1, A2…"
        aria-label="Filtrar por ubicación"
        class="w-full sm:w-56"
      />
      <USelect
        :model-value="filters.hasLocation ?? 'all'"
        :items="HAS_LOCATION_OPTIONS"
        aria-label="Con o sin ubicación"
        class="w-full sm:w-48"
        @update:model-value="
          (v) => list.setFilter('hasLocation', v === 'all' ? undefined : (v as string))
        "
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
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-triangle-alert"
        :aria-pressed="filters.availableMax === String(prefs.lowStockThreshold)"
        @click="showLowStock"
        >Stock bajo (≤ {{ prefs.lowStockThreshold }})</UButton
      >
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
        v-if="(canWrite || canLocate) && canBrowseCatalog && warehouses?.length"
        icon="i-lucide-package-plus"
        @click="pickerOpen = true"
        >{{ canWrite ? 'Registrar movimiento' : 'Poner ubicación' }}</UButton
      >
      <UButton
        to="/inventario/etiquetas-estante"
        color="neutral"
        variant="outline"
        icon="i-lucide-tag"
        >Etiquetas de estante</UButton
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
        <template #warehouse-cell="{ row }">
          <span class="text-sm">{{ warehouseName(row.original.warehouseId) }}</span>
          <UBadge
            v-if="!isActive(row.original.warehouseId)"
            color="neutral"
            variant="subtle"
            class="ms-1"
            >Inactivo</UBadge
          >
        </template>
        <template #location-cell="{ row }">
          <span v-if="row.original.location" class="font-medium">{{ row.original.location }}</span>
          <span v-else class="text-muted">—</span>
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

    <UModal
      v-model:open="pickerOpen"
      :title="canWrite ? 'Registrar movimiento' : 'Poner ubicación'"
      description="Elige la variante."
    >
      <template #body>
        <div class="space-y-4">
          <div v-if="scanned" class="flex items-center justify-between gap-2 text-sm">
            <div class="min-w-0">
              <code class="text-xs font-medium">{{ scanned.sku }}</code>
              <div class="truncate text-muted">
                {{ scanned.product.title
                }}<template v-if="Object.keys(scanned.options).length">
                  · {{ variantOptionsLabel(scanned) }}</template
                >
              </div>
            </div>
            <UButton color="neutral" variant="ghost" size="sm" @click="clearScanned"
              >Cambiar</UButton
            >
          </div>
          <template v-else>
            <UFormField label="Código" help="Escanea o escribe el SKU o el GTIN y pulsa Enter.">
              <UInput
                v-model="scanCode"
                icon="i-lucide-scan-barcode"
                autocomplete="off"
                autofocus
                :loading="scan.pending.value"
                class="w-full"
                @keydown.enter.prevent="scan.scan(scanCode)"
              />
            </UFormField>
            <ScanResult
              :feedback="scan.feedback.value"
              :choices="scan.choices.value"
              @choose="scan.choose"
            />
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
          </template>
          <UFormField label="Almacén">
            <USelect
              v-model="pickedWarehouse"
              :items="warehouseOptions"
              placeholder="Elige el almacén"
              class="w-full"
            />
          </UFormField>
          <p v-if="pickedVariant && pickedStock" class="text-sm text-muted">
            Disponibles: {{ pickedStock.available }} de {{ pickedStock.onHand }} físicas.
          </p>
          <p v-else-if="pickedVariant && pickedStock === null" class="text-sm text-muted">
            Esta variante aún no tiene existencias en este almacén.
          </p>
          <p v-if="pickedWarehouse && !isActive(pickedWarehouse)" class="text-sm text-muted">
            Un almacén inactivo ya no recibe mercancía; solo admite ajustes.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton
            v-if="canLocate"
            color="neutral"
            variant="ghost"
            icon="i-lucide-map-pin"
            :disabled="!pickedVariant || !pickedWarehouse || variantStock.isPending.value"
            @click="locateVariant"
            >Ubicación</UButton
          >
          <UButton
            v-if="canWrite"
            color="neutral"
            variant="outline"
            :disabled="!pickedVariant || !pickedWarehouse || variantStock.isPending.value"
            @click="continueWithVariant('adjustment')"
            >Ajustar</UButton
          >
          <UButton
            v-if="canWrite"
            :disabled="
              !pickedVariant ||
              !pickedWarehouse ||
              !isActive(pickedWarehouse) ||
              variantStock.isPending.value
            "
            @click="continueWithVariant('receipt')"
            >Registrar entrada</UButton
          >
        </div>
      </template>
    </UModal>

    <StockEntryModal
      v-model:open="entry.open"
      :mode="entry.mode"
      :variant-id="entry.variantId"
      :sku="entry.sku"
      :product-title="entry.productTitle"
      :warehouse-id="entry.warehouseId"
      :warehouse-name="warehouseName(entry.warehouseId)"
      :stock="entry.stock"
    />
    <TransferStockModal
      v-if="transferItem"
      v-model:open="transferOpen"
      :item="transferItem"
      :kind="transferKind"
      :from-name="warehouseName(transferItem.warehouseId)"
      :destinations="activeWarehouses.filter((w) => w.id !== transferItem?.warehouseId)"
    />
    <MovementsSlideover v-if="movementsItem" v-model:open="movementsOpen" :item="movementsItem" />
    <LocationModal
      v-model:open="locating.open"
      :variant-id="locating.variantId"
      :sku="locating.sku"
      :product-title="locating.productTitle"
      :warehouse-id="locating.warehouseId"
      :warehouse-name="warehouseName(locating.warehouseId)"
      :location="locating.location"
      :suggestions="locationSuggestions"
    />
  </div>
</template>
