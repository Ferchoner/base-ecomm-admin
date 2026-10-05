<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { useProduct } from '~/features/catalog/api'
import ProductPicker from '~/features/catalog/components/ProductPicker.vue'
import { VARIANT_STATUS } from '~/features/catalog/status'
import type { Variant } from '~/features/catalog/types'
import { useCurrentPrices, useDefaultPriceList } from '~/features/pricing/api'
import PriceImportCard from '~/features/pricing/components/PriceImportCard.vue'
import VariantPriceSlideover from '~/features/pricing/components/VariantPriceSlideover.vue'
import { useSessionStore } from '~/shared/auth/session.store'
import { formatMoney } from '~/shared/utils/money'

definePageMeta({ title: 'Precios', permission: 'pricing.read' })

const session = useSessionStore()
const canWrite = computed(() => session.can('pricing.write'))
// Las variantes solo se listan en el catálogo: sin `catalog.read` no se puede elegir una (GAPS G-12).
const canBrowse = computed(() => session.can('catalog.read'))

const route = useRoute()
const router = useRouter()
const productId = computed({
  get: () => (typeof route.query.product === 'string' ? route.query.product : undefined),
  set: (id) => router.replace({ query: { ...route.query, product: id } }),
})

const {
  list,
  isPending: listPending,
  error: listError,
  refetch: refetchList,
} = useDefaultPriceList()
const productQuery = useProduct(() => productId.value ?? '')
const product = computed(() => (productId.value ? productQuery.data.value : undefined))
const variants = computed(() => product.value?.variants ?? [])
const prices = useCurrentPrices(
  () => list.value?.id,
  () => variants.value.map((v) => v.id),
)
function currentPrice(index: number) {
  const q = prices.value[index]
  if (!q || q.isPending) return '…'
  if (q.error) return 'Error'
  return q.data?.current ? formatMoney(q.data.current.amount) : 'Sin precio'
}
function scheduledCount(index: number) {
  return prices.value[index]?.data?.data.filter((p) => p.state === 'SCHEDULED').length ?? 0
}

const columns: TableColumn<Variant>[] = [
  { accessorKey: 'sku', header: 'SKU' },
  { id: 'options', header: 'Opciones' },
  { accessorKey: 'status', header: 'Estado' },
  { id: 'price', header: 'Precio vigente' },
  { id: 'actions', header: '' },
]

const selected = ref<Variant | null>(null)
const slideoverOpen = ref(false)
function openVariant(variant: Variant) {
  selected.value = variant
  slideoverOpen.value = true
}
</script>

<template>
  <div class="space-y-6">
    <QueryState :loading="listPending" :error="listError" @retry="refetchList()">
      <UAlert
        v-if="list && list.taxesIncluded"
        color="neutral"
        variant="subtle"
        icon="i-lucide-info"
        :title="list.name"
        description="Los montos incluyen IVA. La tienda usa esta lista para todas las ventas."
      />

      <section aria-labelledby="variant-prices" class="mt-4 space-y-3">
        <h2 id="variant-prices" class="font-semibold">Precio por variante</h2>
        <UAlert
          v-if="!canBrowse"
          color="warning"
          variant="subtle"
          icon="i-lucide-lock"
          title="Necesitas permiso de catálogo"
          description="Para elegir un producto hace falta el permiso catalog.read. Puedes cambiar precios con la importación CSV, que usa el SKU."
        />
        <template v-else>
          <ProductPicker v-model="productId" class="sm:max-w-md" />
          <QueryState
            v-if="productId"
            :loading="productQuery.isPending.value"
            :error="productQuery.error.value"
            :empty="variants.length === 0"
            empty-title="Este producto no tiene variantes"
            @retry="productQuery.refetch()"
          >
            <UTable :data="variants" :columns="columns" class="rounded-md border border-default">
              <template #sku-cell="{ row }">
                <code class="text-xs font-medium">{{ row.original.sku }}</code>
              </template>
              <template #options-cell="{ row }">
                {{
                  Object.entries(row.original.options)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ') || '—'
                }}
              </template>
              <template #status-cell="{ row }">
                <StatusBadge :value="row.original.status" :styles="VARIANT_STATUS" />
              </template>
              <template #price-cell="{ row }">
                <span class="font-medium">{{ currentPrice(row.index) }}</span>
                <UBadge
                  v-if="scheduledCount(row.index)"
                  class="ms-2"
                  color="info"
                  variant="subtle"
                  size="sm"
                >
                  {{ scheduledCount(row.index) }} programado{{
                    scheduledCount(row.index) > 1 ? 's' : ''
                  }}
                </UBadge>
              </template>
              <template #actions-cell="{ row }">
                <div class="text-right">
                  <UButton
                    size="sm"
                    color="neutral"
                    variant="outline"
                    @click="openVariant(row.original)"
                  >
                    {{ canWrite ? 'Cambiar precio' : 'Ver precios' }}
                  </UButton>
                </div>
              </template>
            </UTable>
          </QueryState>
        </template>
      </section>

      <PriceImportCard v-if="canWrite && list" class="mt-6" :list-id="list.id" />

      <VariantPriceSlideover
        v-if="selected && list"
        v-model:open="slideoverOpen"
        :list-id="list.id"
        :variant-id="selected.id"
        :title="selected.sku"
        :can-write="canWrite"
      />
    </QueryState>
  </div>
</template>
