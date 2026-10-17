<script setup lang="ts">
import { notifySuccess } from '~/shared/api/feedback'
import { useSessionStore } from '~/shared/auth/session.store'
import { usePreferencesStore } from '~/shared/preferences/preferences.store'

const prefs = usePreferencesStore()
const session = useSessionStore()
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

function onScanSound(value: boolean) {
  prefs.setScanSound(value)
  notifySuccess(toast, 'Preferencia guardada')
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">Preferencias</h2>
      <p class="text-sm text-muted">Se guardan en este navegador, solo para tu usuario.</p>
    </template>
    <form
      v-if="session.can('inventory.read')"
      class="mb-4 flex flex-wrap items-end gap-2"
      @submit.prevent="save"
    >
      <UFormField
        label="Umbral de stock bajo"
        help="Una variante con estas unidades disponibles o menos se considera stock bajo."
        :error="valid ? undefined : 'Escribe un número entero de 0 en adelante.'"
      >
        <UInputNumber v-model="threshold" :min="0" class="w-40" />
      </UFormField>
      <UButton type="submit" :disabled="!valid">Guardar</UButton>
    </form>
    <USwitch
      :model-value="prefs.scanSound"
      label="Sonido al escanear"
      description="Un tono corto cuando el lector encuentra el código y otro grave cuando no."
      @update:model-value="onScanSound"
    />
  </UCard>
</template>
