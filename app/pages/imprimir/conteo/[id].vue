<script setup lang="ts">
import { useCategoryTree } from '~/features/catalog/api'
import { flattenTree } from '~/features/catalog/tree'
import { useCount, useWarehouses } from '~/features/inventory/api'
import CountSheetDocument from '~/features/inventory/components/CountSheetDocument.vue'
import { countFilterLabel } from '~/features/inventory/status'
import { useSessionStore } from '~/shared/auth/session.store'
import { DOCUMENT_FORMATS, usePrintPage } from '~/shared/print/formats'

definePageMeta({ layout: 'print', title: 'Imprimir hoja de conteo', permission: 'inventory.read' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const count = useCount(id)
const { data: warehouses } = useWarehouses()
const session = useSessionStore()
const tree = useCategoryTree(undefined, { enabled: () => session.can('catalog.read') })

// Carta para una hoja larga; 80 mm para una ubicación con pocos productos.
type SheetFormat = 'letter' | 'thermal80'
const format = ref<SheetFormat>('letter')
const FORMATS = (['letter', 'thermal80'] as const).map((value) => ({
  value,
  label: DOCUMENT_FORMATS[value].label,
}))
usePrintPage(
  () => DOCUMENT_FORMATS[format.value].page,
  () => (format.value === 'letter' ? '12mm' : '2mm'),
)

const warehouseName = computed(
  () => warehouses.value?.find((w) => w.id === count.data.value?.warehouseId)?.name ?? '',
)
const filterLabel = computed(() => {
  if (!count.data.value) return ''
  const categories = flattenTree(tree.data.value ?? [])
  return countFilterLabel(
    count.data.value.filter,
    (categoryId) => categories.find((c) => c.node.id === categoryId)?.path.join(' › ') ?? 'elegida',
  )
})
</script>

<template>
  <div>
    <PrintToolbar
      :format="format"
      :back="`/inventario/conteos/${id}`"
      back-label="Hoja de conteo"
      title="Hoja de conteo"
      :formats="FORMATS"
      @update:format="(v) => (format = v as SheetFormat)"
    />
    <div class="p-4 print:p-0">
      <QueryState
        :loading="count.isPending.value"
        :error="count.error.value"
        @retry="count.refetch()"
      >
        <div
          v-if="count.data.value"
          class="mx-auto w-fit bg-white p-4 shadow print:p-0 print:shadow-none"
        >
          <CountSheetDocument
            :count="count.data.value"
            :warehouse-name="warehouseName"
            :filter-label="filterLabel"
            :format="format"
          />
        </div>
      </QueryState>
    </div>
  </div>
</template>
