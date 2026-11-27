<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { useSetLocation } from '../api'
import { locationSchema } from '../schemas'
import type { LocationForm } from '../schemas'
import { normalizeLocation } from '../status'

/**
 * Dónde está una variante en un almacén (UC-INV-17, ADR-0173): un texto libre como `A1`, `VITRINA 1`
 * o `BODEGA`, que se guarda en mayúsculas. Vacío la quita. Sirve aunque todavía no haya unidades.
 */
const props = defineProps<{
  variantId: string
  sku: string
  productTitle?: string
  warehouseId: string
  warehouseName: string
  location: string | null
  /** Ubicaciones que ya existen en el almacén, para no escribir `A1` y `A-1`. */
  suggestions?: string[]
}>()
const open = defineModel<boolean>('open', { required: true })

const state = reactive<LocationForm>({ location: '' })
const problem = ref<ApiProblem | null>(null)
const set = useSetLocation()
const toast = useToast()

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    state.location = props.location ?? ''
    problem.value = null
  },
  { immediate: true },
)

const normalized = computed(() => normalizeLocation(state.location))
const matches = computed(() =>
  (props.suggestions ?? [])
    .filter(
      (s) => s !== normalized.value && (normalized.value === '' || s.startsWith(normalized.value)),
    )
    .slice(0, 8),
)

async function onSubmit(event: FormSubmitEvent<LocationForm>) {
  problem.value = null
  const location = normalizeLocation(event.data.location)
  try {
    await set.mutateAsync({
      variantId: props.variantId,
      warehouseId: props.warehouseId,
      location: location === '' ? null : location,
    })
    notifySuccess(
      toast,
      location === '' ? `${props.sku} sin ubicación` : `${props.sku} en ${location}`,
      props.warehouseName,
    )
    open.value = false
  } catch (e) {
    problem.value = e as ApiProblem
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`Ubicación de ${sku}`"
    :description="[productTitle, warehouseName].filter(Boolean).join(' · ')"
  >
    <template #body>
      <UForm
        id="location-form"
        :schema="locationSchema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" />
        <UFormField
          name="location"
          label="Ubicación"
          help="Hasta 20 caracteres, como A1, VITRINA 1 o BODEGA. Déjala vacía para quitarla."
        >
          <UInput v-model="state.location" autocomplete="off" autofocus class="w-full" />
        </UFormField>
        <div v-if="matches.length" class="flex flex-wrap gap-1" aria-label="Ubicaciones existentes">
          <UButton
            v-for="m in matches"
            :key="m"
            size="xs"
            color="neutral"
            variant="soft"
            @click="state.location = m"
            >{{ m }}</UButton
          >
        </div>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
        <UButton type="submit" form="location-form" :loading="set.isPending.value">Guardar</UButton>
      </div>
    </template>
  </UModal>
</template>
