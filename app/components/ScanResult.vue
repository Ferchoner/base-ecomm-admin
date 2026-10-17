<script setup lang="ts">
import { variantOptionsLabel } from '~/shared/api/variant-lookup'
import type { VariantLookup } from '~/shared/api/variant-lookup'
import type { ScanFeedback } from '~/shared/scanner/use-variant-scan'

/** Resultado de un escaneo: aviso y, si el código coincide con varias variantes, cuál elegir. */
defineProps<{ feedback: ScanFeedback | null; choices: VariantLookup[] }>()
defineEmits<{ choose: [variant: VariantLookup] }>()

const COLOR = { success: 'success', info: 'info', warning: 'warning', error: 'error' } as const
const ICON = {
  success: 'i-lucide-circle-check',
  info: 'i-lucide-scan-barcode',
  warning: 'i-lucide-triangle-alert',
  error: 'i-lucide-circle-x',
} as const
const PRODUCT_STATUS: Record<string, string> = {
  DRAFT: 'borrador',
  PUBLISHED: 'publicado',
  ARCHIVED: 'archivado',
}
</script>

<template>
  <div role="status" aria-live="polite" class="space-y-2 empty:hidden">
    <UAlert
      v-if="feedback"
      :color="COLOR[feedback.tone]"
      :icon="ICON[feedback.tone]"
      variant="subtle"
      :title="feedback.text"
      :ui="{ title: 'font-normal' }"
    />
    <ul
      v-if="choices.length"
      class="divide-y divide-default rounded-md border border-default"
      aria-label="Variantes con ese código"
    >
      <li v-for="v in choices" :key="v.id">
        <button
          type="button"
          class="w-full p-2 text-left text-sm hover:bg-elevated"
          @click="$emit('choose', v)"
        >
          <code class="text-xs font-medium">{{ v.sku }}</code>
          <span class="ms-1">{{ v.product.title }}</span>
          <span class="block text-xs text-muted">
            {{ v.matchedBy === 'GTIN' ? `GTIN ${v.gtin}` : 'Por SKU'
            }}<template v-if="Object.keys(v.options).length">
              · {{ variantOptionsLabel(v) }}</template
            >
            · {{ v.status === 'ACTIVE' ? 'activa' : 'descontinuada' }} · producto
            {{ PRODUCT_STATUS[v.product.status] ?? v.product.status }}
          </span>
        </button>
      </li>
    </ul>
  </div>
</template>
