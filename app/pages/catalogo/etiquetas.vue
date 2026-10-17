<script setup lang="ts">
import { useProduct } from '~/features/catalog/api'
import LabelSheet from '~/features/catalog/components/LabelSheet.vue'
import { MAX_COPIES, MAX_LABELS } from '~/features/catalog/labels'
import type { LabelItem } from '~/features/catalog/labels'
import { variantOptionsLabel } from '~/shared/api/variant-lookup'
import { usePreferencesStore } from '~/shared/preferences/preferences.store'
import { COMPACT_SYMBOLOGIES, LABEL_FORMATS, options, usePrintPage } from '~/shared/print/formats'
import type { CompactSymbology, LabelFormat } from '~/shared/print/formats'
import { linearBarcode, tooLongFor50mm } from '~/shared/print/symbology'
import { useVariantScan } from '~/shared/scanner/use-variant-scan'

definePageMeta({ layout: 'print', title: 'Etiquetas', permission: 'catalog.read' })

const route = useRoute()
const prefs = usePreferencesStore()
const format = ref<LabelFormat>(prefs.labelFormat)
const symbology = ref<CompactSymbology>(prefs.compactSymbology)
const FORMATS = options(LABEL_FORMATS)
const SYMBOLOGIES = options(COMPACT_SYMBOLOGIES)
usePrintPage(
  () => LABEL_FORMATS[format.value].page,
  () => (format.value === 'letter30' ? '12.7mm 4.8mm' : '0'),
)

// La cola vive en la página: no es estado del servidor ni de la sesión.
const items = ref<LabelItem[]>([])
const total = computed(() => items.value.reduce((n, i) => n + (i.copies || 0), 0))

function add(item: Omit<LabelItem, 'copies'>) {
  const existing = items.value.find((i) => i.variantId === item.variantId)
  if (existing) existing.copies = Math.min(MAX_COPIES, existing.copies + 1)
  else items.value.push({ ...item, copies: 1 })
}
function remove(variantId: string) {
  items.value = items.value.filter((i) => i.variantId !== variantId)
}

// "Imprimir etiquetas" desde el producto (todas sus variantes activas) o desde una variante.
const productId = computed(() =>
  typeof route.query.product === 'string' ? route.query.product : '',
)
const product = useProduct(productId)
watch(
  () => product.data.value,
  (p) => {
    if (!p || items.value.length) return
    const only = typeof route.query.variant === 'string' ? route.query.variant : undefined
    for (const v of p.variants)
      if (only ? v.id === only : v.status === 'ACTIVE')
        add({ variantId: v.id, sku: v.sku, gtin: v.gtin, title: p.title, options: v.options })
  },
  { immediate: true },
)

const code = ref('')
const scan = useVariantScan({
  onFound: (v) => {
    add({ variantId: v.id, sku: v.sku, gtin: v.gtin, title: v.product.title, options: v.options })
    code.value = ''
    return { tone: 'success', text: `${v.sku} agregado.` }
  },
})

const longSkus = computed(() =>
  format.value === 'label50x25' ? items.value.filter(tooLongFor50mm).map((i) => i.sku) : [],
)
</script>

<template>
  <div>
    <PrintToolbar
      back="/catalogo/productos"
      back-label="Productos"
      title="Etiquetas"
      :format="format"
      :formats="FORMATS"
      @update:format="(v) => (format = v as LabelFormat)"
    >
      <USelect
        v-if="format === 'label25x15'"
        v-model="symbology"
        :items="SYMBOLOGIES"
        aria-label="Código 2D"
        class="w-full sm:w-36"
      />
    </PrintToolbar>

    <div class="grid gap-4 p-4 lg:grid-cols-[22rem_1fr] print:block print:p-0">
      <UCard class="self-start print:hidden">
        <template #header>
          <h2 class="font-semibold">Variantes</h2>
          <p class="text-sm text-muted">Sin precio: los precios cambian y la etiqueta no.</p>
        </template>
        <div class="space-y-3">
          <UFormField label="Agregar por código" help="Escanea o escribe el SKU o el GTIN.">
            <UInput
              v-model="code"
              icon="i-lucide-scan-barcode"
              autocomplete="off"
              :loading="scan.pending.value"
              class="w-full"
              @keydown.enter.prevent="scan.scan(code)"
            />
          </UFormField>
          <ScanResult
            :feedback="scan.feedback.value"
            :choices="scan.choices.value"
            @choose="scan.choose"
          />
          <p v-if="items.length === 0" class="text-sm text-muted">
            Agrega variantes con el lector o desde un producto ("Imprimir etiquetas").
          </p>
          <ul v-else class="divide-y divide-default rounded-md border border-default">
            <li v-for="item in items" :key="item.variantId" class="flex items-center gap-2 p-2">
              <div class="min-w-0 flex-1 text-sm">
                <code class="text-xs font-medium">{{ item.sku }}</code>
                <div class="truncate text-muted">
                  {{ item.title
                  }}<template v-if="Object.keys(item.options).length">
                    · {{ variantOptionsLabel(item) }}</template
                  >
                </div>
                <div class="text-xs text-muted">{{ linearBarcode(item).name }}</div>
              </div>
              <UInputNumber
                v-model="item.copies"
                :min="1"
                :max="MAX_COPIES"
                :aria-label="`Copias de ${item.sku}`"
                class="w-24"
              />
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                :aria-label="`Quitar ${item.sku}`"
                @click="remove(item.variantId)"
              />
            </li>
          </ul>
          <p v-if="items.length" class="text-sm text-muted">
            {{ total }} {{ total === 1 ? 'etiqueta' : 'etiquetas' }}
            <template v-if="total > MAX_LABELS"
              >; se imprimen las primeras {{ MAX_LABELS }}</template
            >
          </p>
          <UAlert
            v-if="longSkus.length"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="SKU largos para 50 mm"
            :description="`${longSkus.join(', ')}: las barras pueden quedar muy finas. Usa la etiqueta compacta.`"
          />
        </div>
      </UCard>

      <section aria-label="Vista previa" class="overflow-auto print:overflow-visible">
        <LabelSheet
          v-if="items.length"
          :items="items"
          :format="format"
          :symbology="symbology"
          class="w-fit p-2 print:p-0"
        />
      </section>
    </div>
  </div>
</template>
