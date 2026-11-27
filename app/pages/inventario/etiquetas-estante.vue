<script setup lang="ts">
import { useStockItems, useWarehouses } from '~/features/inventory/api'
import ShelfLabelSheet from '~/features/inventory/components/ShelfLabelSheet.vue'
import { parseLocations } from '~/features/inventory/status'
import { useDeviceWarehouse } from '~/shared/device/device-warehouse'
import { LABEL_FORMATS, labelPageSize, usePrintPage } from '~/shared/print/formats'

definePageMeta({ layout: 'print', title: 'Etiquetas de estante', permission: 'inventory.read' })

/** Etiquetas para pegar en cada ubicación de un almacén (ADR-0173). */
type ShelfFormat = 'label50x25' | 'roll58' | 'letter30'
const FORMATS = (['label50x25', 'roll58', 'letter30'] as const).map((value) => ({
  value,
  label: LABEL_FORMATS[value].label.replace(', código de barras', ''),
}))
const format = ref<ShelfFormat>('label50x25')

const { data: warehouses } = useWarehouses()
const device = useDeviceWarehouse()
const warehouseId = ref<string | undefined>(device.warehouseId.value ?? undefined)
watch(warehouses, (list) => {
  if (!warehouseId.value && list?.length) warehouseId.value = list[0]!.id
})
const warehouseOptions = computed(() =>
  (warehouses.value ?? []).map((w) => ({ value: w.id, label: w.name })),
)
const warehouseName = computed(
  () => warehouses.value?.find((w) => w.id === warehouseId.value)?.name ?? '',
)

const text = ref('')
const parsed = computed(() => parseLocations(text.value))
usePrintPage(
  () => labelPageSize(format.value, parsed.value.valid.length),
  () => (format.value === 'letter30' ? '12.7mm 4.8mm' : '0'),
)

// Las ubicaciones que ya se usan en ese almacén (de las primeras 100 existencias con ubicación).
const located = useStockItems(
  () => ({ page: 1, pageSize: 100, warehouseId: warehouseId.value, hasLocation: true }),
  { enabled: () => !!warehouseId.value },
)
const inUse = computed(() => [
  ...new Set((located.data.value?.data ?? []).map((s) => s.location).filter((l) => l !== null)),
])
function addInUse() {
  text.value = [...new Set([...parsed.value.valid, ...inUse.value])].join('\n')
}
</script>

<template>
  <div>
    <PrintToolbar
      back="/inventario/stock"
      back-label="Existencias"
      title="Etiquetas de estante"
      :format="format"
      :formats="FORMATS"
      @update:format="(v) => (format = v as ShelfFormat)"
    />
    <div class="grid gap-4 p-4 lg:grid-cols-[22rem_1fr] print:block print:p-0">
      <UCard class="self-start print:hidden">
        <div class="space-y-3">
          <UFormField label="Almacén">
            <USelect v-model="warehouseId" :items="warehouseOptions" class="w-full" />
          </UFormField>
          <UFormField
            label="Ubicaciones"
            help="Una por renglón o separadas por comas, hasta 20 caracteres cada una."
          >
            <UTextarea
              v-model="text"
              :rows="8"
              class="w-full"
              placeholder="A1&#10;A2&#10;VITRINA 1"
            />
          </UFormField>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-map-pin"
            :disabled="inUse.length === 0"
            :loading="located.isFetching.value"
            @click="addInUse"
            >Agregar las que ya se usan ({{ inUse.length }})</UButton
          >
          <p class="text-sm text-muted">
            {{ parsed.valid.length }}
            {{ parsed.valid.length === 1 ? 'etiqueta' : 'etiquetas' }}
          </p>
          <UAlert
            v-if="parsed.invalid.length"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Más de 20 caracteres"
            :description="`${parsed.invalid.join(', ')}: no se imprimen.`"
          />
        </div>
      </UCard>
      <section aria-label="Vista previa" class="overflow-auto print:overflow-visible">
        <ShelfLabelSheet
          v-if="parsed.valid.length"
          :locations="parsed.valid"
          :warehouse-name="warehouseName"
          :format="format"
          class="w-fit p-2 print:p-0"
        />
      </section>
    </div>
  </div>
</template>
