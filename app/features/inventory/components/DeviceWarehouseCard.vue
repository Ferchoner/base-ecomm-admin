<script setup lang="ts">
import { notifySuccess } from '~/shared/api/feedback'
import { useDeviceWarehouse } from '~/shared/device/device-warehouse'
import { useConfirm } from '~/shared/ui/use-confirm'
import { useWarehouses } from '../api'

/**
 * El local de este equipo (DECISIONS D-097): vender, registrar entradas y el corte de caja empiezan
 * con él. Se guarda en este navegador para todas las cuentas; cambiarlo pide confirmación.
 */
const device = useDeviceWarehouse()
const warehouses = useWarehouses()
const confirm = useConfirm()
const toast = useToast()

const NONE = '__none__'
const active = computed(() => (warehouses.data.value ?? []).filter((w) => w.status === 'ACTIVE'))
const options = computed(() => [
  { value: NONE, label: 'Sin local (se elige en cada pantalla)' },
  ...active.value.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
])
const current = computed(() =>
  (warehouses.data.value ?? []).find((w) => w.id === device.warehouseId.value),
)
const inactive = computed(() => !!current.value && current.value.status !== 'ACTIVE')

async function onChange(value: string) {
  const next = value === NONE ? null : value
  if (next === device.warehouseId.value) return
  const label = next ? options.value.find((o) => o.value === next)?.label : 'ninguno'
  const ok = await confirm({
    title: '¿Cambiar el local de este equipo?',
    description: `Las ventas, las entradas y el corte de caja de este equipo empezarán en ${label}. Cámbialo solo si el equipo se movió de local.`,
    confirmLabel: 'Cambiar local',
    color: 'warning',
  })
  if (!ok) return
  device.set(next)
  notifySuccess(toast, 'Local de este equipo guardado')
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">Local de este equipo</h2>
      <p class="text-sm text-muted">
        Se guarda en este navegador para todas las cuentas que lo usan, no en tu usuario.
      </p>
    </template>
    <UFormField
      label="Local"
      help="Vender en tienda, registrar entradas y el corte de caja empiezan con este almacén."
    >
      <USelect
        :model-value="device.warehouseId.value ?? NONE"
        :items="options"
        :loading="warehouses.isPending.value"
        aria-label="Local de este equipo"
        class="w-full sm:w-80"
        @update:model-value="onChange"
      />
    </UFormField>
    <UAlert
      v-if="inactive"
      class="mt-3"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="El local de este equipo está desactivado"
      description="Elige otro: mientras tanto cada pantalla empieza con el primer almacén activo."
    />
  </UCard>
</template>
