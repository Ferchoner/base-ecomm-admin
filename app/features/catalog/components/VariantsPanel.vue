<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useConfirm } from '~/shared/ui/use-confirm'
import { useVariantAction } from '../api'
import { VARIANT_STATUS } from '../status'
import type { Product, Variant } from '../types'
import VariantFormModal from './VariantFormModal.vue'

const props = defineProps<{ product: Product; canWrite: boolean }>()

const editable = computed(() => props.canWrite && props.product.status !== 'ARCHIVED')
const formOpen = ref(false)
const editing = ref<Variant | null>(null)
function openForm(variant: Variant | null) {
  editing.value = variant
  formOpen.value = true
}

const action = useVariantAction(() => props.product.id)
const confirm = useConfirm()
const toast = useToast()

async function toggle(variant: Variant) {
  const kind = variant.status === 'DISCONTINUED' ? 'reactivate' : 'discontinue'
  if (kind === 'discontinue') {
    const ok = await confirm({
      title: `¿Descontinuar ${variant.sku}?`,
      description: 'Deja de venderse en la tienda. Se puede reactivar después.',
      confirmLabel: 'Descontinuar',
      color: 'warning',
    })
    if (!ok) return
  }
  try {
    await action.mutateAsync({
      variantId: variant.id,
      action: kind,
      version: props.product.version,
    })
    notifySuccess(toast, kind === 'discontinue' ? 'Variante descontinuada' : 'Variante reactivada')
  } catch (e) {
    notifyProblem(toast, e)
  }
}

function options(v: Variant) {
  const entries = Object.entries(v.options)
  return entries.length ? entries.map(([k, val]) => `${k}: ${val}`).join(' · ') : '—'
}

function measures(v: Variant) {
  const dims = [v.lengthCm, v.widthCm, v.heightCm]
  const parts: string[] = []
  if (v.weightGrams !== null) parts.push(`${v.weightGrams} g`)
  if (dims.some((d) => d !== null)) parts.push(`${dims.map((d) => d ?? '—').join(' × ')} cm`)
  return parts.join(' · ') || '—'
}

const columns = computed<TableColumn<Variant>[]>(() => [
  { accessorKey: 'sku', header: 'SKU' },
  { id: 'options', header: 'Opciones' },
  { id: 'measures', header: 'Peso y medidas' },
  { accessorKey: 'status', header: 'Estado' },
  ...(editable.value ? [{ id: 'actions', header: '' }] : []),
])
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm text-muted">
        El precio y el stock de cada variante se administran en Precios e Inventario.
      </p>
      <UButton v-if="editable" icon="i-lucide-plus" @click="openForm(null)">Nueva variante</UButton>
    </div>

    <UEmpty
      v-if="product.variants.length === 0"
      icon="i-lucide-layers"
      title="Sin variantes"
      description="Un producto necesita al menos una variante activa para publicarse."
    />
    <UTable
      v-else
      :data="product.variants"
      :columns="columns"
      class="rounded-md border border-default"
    >
      <template #sku-cell="{ row }">
        <code class="text-xs font-medium">{{ row.original.sku }}</code>
      </template>
      <template #options-cell="{ row }">{{ options(row.original) }}</template>
      <template #measures-cell="{ row }">{{ measures(row.original) }}</template>
      <template #status-cell="{ row }">
        <StatusBadge :value="row.original.status" :styles="VARIANT_STATUS" />
      </template>
      <template #actions-cell="{ row }">
        <div class="flex justify-end gap-1">
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            :aria-label="`Editar ${row.original.sku}`"
            @click="openForm(row.original)"
          />
          <UButton
            :icon="
              row.original.status === 'DISCONTINUED'
                ? 'i-lucide-rotate-ccw'
                : 'i-lucide-circle-pause'
            "
            color="neutral"
            variant="ghost"
            :aria-label="`${row.original.status === 'DISCONTINUED' ? 'Reactivar' : 'Descontinuar'} ${row.original.sku}`"
            @click="toggle(row.original)"
          />
        </div>
      </template>
    </UTable>

    <VariantFormModal v-model:open="formOpen" :product="product" :variant="editing" />
  </div>
</template>
