<script setup lang="ts">
import { useProduct } from '~/features/catalog/api'
import ImagesPanel from '~/features/catalog/components/ImagesPanel.vue'
import ProductForm from '~/features/catalog/components/ProductForm.vue'
import ProductStatusActions from '~/features/catalog/components/ProductStatusActions.vue'
import VariantsPanel from '~/features/catalog/components/VariantsPanel.vue'
import { PRODUCT_STATUS, STORE_VISIBILITY } from '~/features/catalog/status'
import { useSessionStore } from '~/shared/auth/session.store'
import { formatDateTime } from '~/shared/utils/dates'

definePageMeta({ title: 'Producto', permission: 'catalog.read' })

const route = useRoute()
const router = useRouter()
const id = computed(() => String(route.params.id))
const session = useSessionStore()
const canWrite = computed(() => session.can('catalog.write'))

const { data: product, isPending, error, refetch } = useProduct(id)

const TABS = [
  { label: 'Datos', value: 'datos', icon: 'i-lucide-file-text' },
  { label: 'Variantes', value: 'variantes', icon: 'i-lucide-layers' },
  { label: 'Imágenes', value: 'imagenes', icon: 'i-lucide-image' },
]
const tab = computed({
  get: () => (TABS.some((t) => t.value === route.query.tab) ? String(route.query.tab) : 'datos'),
  set: (value: string) =>
    router.replace({ query: { ...route.query, tab: value === 'datos' ? undefined : value } }),
})

const archived = computed(() => product.value?.status === 'ARCHIVED')
</script>

<template>
  <div class="space-y-4">
    <UButton
      to="/catalogo/productos"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      size="sm"
      >Productos</UButton
    >

    <QueryState :loading="isPending" :error="error" @retry="refetch()">
      <template v-if="product">
        <header class="flex flex-wrap items-start justify-between gap-3">
          <div class="space-y-1">
            <h2 class="text-xl font-semibold">{{ product.title }}</h2>
            <div class="flex flex-wrap items-center gap-2">
              <StatusBadge :value="product.status" :styles="PRODUCT_STATUS" />
              <StatusBadge :value="product.storeVisibility" :styles="STORE_VISIBILITY" />
              <span class="text-xs text-muted"
                >Modificado {{ formatDateTime(product.updatedAt) }}</span
              >
            </div>
          </div>
          <ProductStatusActions v-if="canWrite" :product="product" />
        </header>

        <UAlert
          v-if="archived"
          color="neutral"
          variant="subtle"
          icon="i-lucide-archive"
          title="Producto archivado"
          description="No se puede editar ni cambiar sus variantes o imágenes. Reactívalo como borrador para editarlo."
        />
        <UAlert
          v-else-if="product.storeVisibility === 'HIDDEN_NO_PRICE'"
          color="warning"
          variant="subtle"
          icon="i-lucide-eye-off"
          title="Publicado pero oculto en la tienda"
          description="Ninguna variante activa tiene precio vigente. Asigna un precio en Precios."
        />

        <UTabs v-model="tab" :items="TABS" :content="false" class="w-full" />

        <div v-if="tab === 'datos'" class="grid gap-6 lg:grid-cols-[1fr_16rem]">
          <ProductForm :product="product" :disabled="!canWrite || archived" />
          <dl class="space-y-2 text-sm">
            <div>
              <dt class="text-muted">Creado</dt>
              <dd>{{ formatDateTime(product.createdAt) }}</dd>
            </div>
            <div>
              <dt class="text-muted">Primera publicación</dt>
              <dd>
                {{ product.firstPublishedAt ? formatDateTime(product.firstPublishedAt) : '—' }}
              </dd>
            </div>
            <div>
              <dt class="text-muted">Publicado</dt>
              <dd>{{ product.publishedAt ? formatDateTime(product.publishedAt) : '—' }}</dd>
            </div>
            <div v-if="product.archivedAt">
              <dt class="text-muted">Archivado</dt>
              <dd>{{ formatDateTime(product.archivedAt) }}</dd>
            </div>
            <div>
              <dt class="text-muted">Versión</dt>
              <dd>{{ product.version }}</dd>
            </div>
          </dl>
        </div>
        <VariantsPanel v-else-if="tab === 'variantes'" :product="product" :can-write="canWrite" />
        <ImagesPanel v-else :product="product" :can-write="canWrite" />
      </template>
    </QueryState>
  </div>
</template>
