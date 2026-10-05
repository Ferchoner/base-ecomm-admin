<script setup lang="ts">
import { notifySuccess } from '~/shared/api/feedback'
import { usePreferencesStore } from '~/shared/preferences/preferences.store'

const prefs = usePreferencesStore()
const toast = useToast()
const threshold = ref<number | undefined>(prefs.lowStockThreshold)
watch(
  () => prefs.lowStockThreshold,
  (v) => (threshold.value = v),
)
const valid = computed(
  () => threshold.value !== undefined && Number.isInteger(threshold.value) && threshold.value >= 0,
)

function save() {
  if (!valid.value) return
  prefs.setLowStockThreshold(threshold.value!)
  notifySuccess(toast, 'Preferencia guardada')
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">Preferencias</h2>
      <p class="text-sm text-muted">Se guardan en este navegador, solo para tu usuario.</p>
    </template>
    <form class="flex flex-wrap items-end gap-2" @submit.prevent="save">
      <UFormField
        label="Umbral de stock bajo"
        help="Una variante con estas unidades disponibles o menos se considera stock bajo."
        :error="valid ? undefined : 'Escribe un número entero de 0 en adelante.'"
      >
        <UInputNumber v-model="threshold" :min="0" class="w-40" />
      </UFormField>
      <UButton type="submit" :disabled="!valid">Guardar</UButton>
    </form>
  </UCard>
</template>
