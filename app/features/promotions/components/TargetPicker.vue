<script setup lang="ts">
import { useDebounced } from '~/shared/utils/debounce'
import { useTargetOptions } from '../api'
import { TARGET_TYPE } from '../status'
import type { PromotionTargetType, TargetOption } from '../types'

/**
 * Productos, categorías y marcas a los que aplica la promoción (API_SPEC §26.2): hasta 100, cada uno
 * una vez. Vacía, la promoción aplica a toda la compra. Una categoría incluye sus subcategorías.
 */
const model = defineModel<TargetOption[]>({ required: true })
defineProps<{ disabled?: boolean }>()

const MAX = 100
const type = ref<PromotionTargetType>('PRODUCT')
const TYPE_OPTIONS = (Object.keys(TARGET_TYPE) as PromotionTargetType[]).map((value) => ({
  value,
  label: TARGET_TYPE[value],
}))
const search = ref('')
const query = useDebounced(search)
const options = useTargetOptions(type, query)
const items = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (options.data.value ?? [])
    .filter((o) => type.value !== 'CATEGORY' || !q || o.name.toLowerCase().includes(q))
    .filter((o) => !model.value.some((t) => t.type === o.type && t.id === o.id))
    .map((o) => ({ value: o.id, label: o.name }))
})

function add(id: string | undefined) {
  const option = options.data.value?.find((o) => o.id === id)
  if (!option || model.value.length >= MAX) return
  model.value = [...model.value, option]
  search.value = ''
}
function remove(target: TargetOption) {
  model.value = model.value.filter((t) => !(t.type === target.type && t.id === target.id))
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="!disabled" class="flex flex-wrap gap-2">
      <USelect
        v-model="type"
        :items="TYPE_OPTIONS"
        aria-label="Tipo de destino"
        class="w-full sm:w-36"
      />
      <USelectMenu
        v-model:search-term="search"
        :model-value="undefined"
        :items="items"
        value-key="value"
        label-key="label"
        ignore-filter
        :loading="options.isFetching.value"
        :placeholder="`Agregar ${TARGET_TYPE[type].toLowerCase()}`"
        :search-input="{ placeholder: 'Buscar' }"
        :disabled="model.length >= MAX"
        class="w-full sm:flex-1"
        @update:model-value="add"
      />
    </div>
    <p v-if="model.length === 0" class="text-sm text-muted">
      Sin productos, categorías ni marcas: aplica a toda la compra.
    </p>
    <ul v-else class="flex flex-wrap gap-2" aria-label="A qué aplica">
      <li v-for="t in model" :key="`${t.type}-${t.id}`">
        <UBadge color="neutral" variant="subtle" size="lg" class="gap-1">
          <span class="text-muted">{{ TARGET_TYPE[t.type] }}:</span> {{ t.name }}
          <UButton
            v-if="!disabled"
            icon="i-lucide-x"
            color="neutral"
            variant="link"
            size="xs"
            class="p-0"
            :aria-label="`Quitar ${t.name}`"
            @click="remove(t)"
          />
        </UBadge>
      </li>
    </ul>
  </div>
</template>
