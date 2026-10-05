<script setup lang="ts">
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useConfirm } from '~/shared/ui/use-confirm'
import { useProductAction } from '../api'
import type { ProductAction } from '../api'
import { PRODUCT_ACTIONS } from '../status'
import type { Product } from '../types'

const props = defineProps<{ product: Product }>()

const action = useProductAction(() => props.product.id)
const confirm = useConfirm()
const toast = useToast()
const running = ref<ProductAction | null>(null)

const hasActiveVariant = computed(() => props.product.variants.some((v) => v.status === 'ACTIVE'))
const available = computed(() =>
  (Object.keys(PRODUCT_ACTIONS) as ProductAction[]).filter((a) =>
    PRODUCT_ACTIONS[a].includes(props.product.status),
  ),
)

const COPY: Record<
  ProductAction,
  { label: string; icon: string; done: string; color: 'primary' | 'neutral' | 'warning' }
> = {
  publish: {
    label: 'Publicar',
    icon: 'i-lucide-send',
    done: 'Producto publicado',
    color: 'primary',
  },
  archive: {
    label: 'Archivar',
    icon: 'i-lucide-archive',
    done: 'Producto archivado',
    color: 'neutral',
  },
  reactivate: {
    label: 'Reactivar como borrador',
    icon: 'i-lucide-rotate-ccw',
    done: 'Producto reactivado como borrador',
    color: 'neutral',
  },
}

async function run(kind: ProductAction) {
  const p = props.product
  if (kind === 'publish') {
    const ok = await confirm({
      title: `¿Publicar "${p.title}"?`,
      description: p.firstPublishedAt
        ? 'Vuelve a mostrarse en la tienda si tiene alguna variante activa con precio vigente.'
        : 'Después de la primera publicación ya no se pueden cambiar el slug, los SKU ni las opciones de las variantes.',
      confirmLabel: 'Publicar',
    })
    if (!ok) return
  }
  if (kind === 'archive') {
    const ok = await confirm({
      title: `¿Archivar "${p.title}"?`,
      description: 'Sale de la tienda y ya no se puede editar hasta reactivarlo como borrador.',
      confirmLabel: 'Archivar',
      color: 'warning',
    })
    if (!ok) return
  }
  running.value = kind
  try {
    await action.mutateAsync({ action: kind, version: p.version })
    notifySuccess(toast, COPY[kind].done)
  } catch (e) {
    notifyProblem(toast, e)
  } finally {
    running.value = null
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <UButton
      v-for="kind in available"
      :key="kind"
      :icon="COPY[kind].icon"
      :color="COPY[kind].color"
      :variant="kind === 'publish' ? 'solid' : 'outline'"
      :loading="running === kind"
      :disabled="running !== null && running !== kind"
      @click="run(kind)"
    >
      {{ COPY[kind].label }}
    </UButton>
    <span v-if="available.includes('publish') && !hasActiveVariant" class="text-sm text-muted">
      Para publicar necesita al menos una variante activa.
    </span>
  </div>
</template>
