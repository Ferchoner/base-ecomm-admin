<script setup lang="ts">
import { useDebounced } from '~/shared/utils/debounce'
import { useProducts } from '../api'

/**
 * Buscador de productos por título o SKU. Lo usan otras secciones (precios, inventario) para
 * llegar a las variantes, porque solo el catálogo las lista (GAPS G-04).
 */
const model = defineModel<string | undefined>()
defineProps<{ placeholder?: string }>()

const search = ref('')
const query = useDebounced(search)
const { data, isFetching } = useProducts(() => ({
  page: 1,
  pageSize: 20,
  sort: 'title',
  q: query.value.trim() || undefined,
}))
const items = computed(() =>
  (data.value?.data ?? []).map((p) => ({
    value: p.id,
    label: p.title,
    description: p.variants.map((v) => v.sku).join(', ') || 'Sin variantes',
  })),
)
</script>

<template>
  <USelectMenu
    v-model="model"
    v-model:search-term="search"
    :items="items"
    value-key="value"
    label-key="label"
    description-key="description"
    ignore-filter
    :loading="isFetching"
    :placeholder="placeholder ?? 'Buscar producto por título o SKU'"
    :search-input="{ placeholder: 'Título o SKU' }"
    class="w-full"
  />
</template>
