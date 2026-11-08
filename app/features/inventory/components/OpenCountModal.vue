<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiProblem } from '~/shared/api/problem'
import { useOpenCount } from '../api'
import { openCountSchema } from '../schemas'
import type { OpenCountForm } from '../schemas'
import { COUNT_CLASS_OPTIONS, normalizeLocation } from '../status'
import type { Count, CountClass } from '../types'

/**
 * Abrir una hoja de conteo (UC-INV-18, ADR-0173) en un almacén, con una ubicación (o un prefijo como
 * `A*`), una categoría, una clase, o varios a la vez. Toma las variantes con existencia o ubicación ahí.
 */
const props = defineProps<{
  warehouses: { value: string; label: string }[]
  /** Las categorías, ya con su ruta, porque una feature no importa a otra. */
  categories: { value: string; label: string }[]
  warehouseId?: string
}>()
const emit = defineEmits<{ opened: [count: Count] }>()
const open = defineModel<boolean>('open', { required: true })

const state = reactive<OpenCountForm>({ warehouseId: '', location: '', note: '' })
const problem = ref<ApiProblem | null>(null)
const openCount = useOpenCount()

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    Object.assign(state, {
      warehouseId: props.warehouseId ?? '',
      location: '',
      categoryId: undefined,
      countClass: undefined,
      note: '',
    })
    problem.value = null
  },
  { immediate: true },
)

/** Las hojas abiertas que ya tienen alguna de las variantes (409 `variant-in-open-count`). */
const busy = computed(() => {
  if (problem.value?.type !== 'variant-in-open-count') return []
  const lines = (problem.value.extensions.lines ?? []) as { countId: string; folio: string }[]
  const byId = new Map(lines.map((l) => [l.countId, { ...l, variants: 0 }]))
  for (const l of lines) byId.get(l.countId)!.variants++
  return [...byId.values()]
})

async function onSubmit(event: FormSubmitEvent<OpenCountForm>) {
  problem.value = null
  const location = normalizeLocation(event.data.location)
  try {
    const count = await openCount.mutateAsync({
      warehouseId: event.data.warehouseId,
      ...(location && { location }),
      ...(event.data.categoryId && { categoryId: event.data.categoryId }),
      ...(event.data.countClass && { countClass: event.data.countClass as CountClass }),
      note: event.data.note?.trim() || null,
    })
    open.value = false
    emit('opened', count)
  } catch (e) {
    problem.value = e as ApiProblem
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Abrir una hoja de conteo"
    description="Toma lo que hay, o tiene ubicación, en ese almacén y cumple con todo lo que indiques."
  >
    <template #body>
      <UForm
        id="open-count-form"
        :schema="openCountSchema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <div v-if="busy.length" role="alert" class="space-y-1 rounded-md bg-elevated p-3 text-sm">
          <p class="font-medium text-error">
            Algunos productos ya están en otra hoja abierta de este almacén.
          </p>
          <p>Termina o cancela esa hoja, o abre esta con otro filtro.</p>
          <ul>
            <li v-for="b in busy" :key="b.countId">
              <ULink :to="`/inventario/conteos/${b.countId}`" class="font-medium">{{
                b.folio
              }}</ULink>
              · {{ b.variants }} {{ b.variants === 1 ? 'producto' : 'productos' }}
            </li>
          </ul>
        </div>
        <ProblemAlert v-else-if="problem" :problem="problem" />
        <UFormField label="Almacén" name="warehouseId" required>
          <USelect
            v-model="state.warehouseId"
            :items="warehouses"
            placeholder="Elige el almacén"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Ubicación"
          name="location"
          help="Exacta, como A1, o con * al final para todas las que empiezan así: A* toma A1, A2…"
        >
          <UInput v-model="state.location" autocomplete="off" class="w-full" />
        </UFormField>
        <UFormField
          label="Categoría"
          name="categoryId"
          help="Solo los productos que están en ella."
        >
          <USelect
            v-model="state.categoryId"
            :items="categories"
            placeholder="Cualquier categoría"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Clase" name="countClass" help="La C incluye a los productos sin clase.">
          <USelect
            v-model="state.countClass"
            :items="COUNT_CLASS_OPTIONS"
            placeholder="Cualquier clase"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Nota" name="note">
          <UTextarea v-model="state.note" :rows="2" class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
        <UButton type="submit" form="open-count-form" :loading="openCount.isPending.value"
          >Abrir la hoja</UButton
        >
      </div>
    </template>
  </UModal>
</template>
