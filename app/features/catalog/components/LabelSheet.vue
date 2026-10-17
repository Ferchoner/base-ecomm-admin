<script setup lang="ts">
import type { CompactSymbology, LabelFormat } from '~/shared/print/formats'
import { compactText, linearBarcode } from '~/shared/print/symbology'
import { LABELS_PER_LETTER, chunk, expandLabels } from '../labels'
import type { LabelItem } from '../labels'

/**
 * Etiquetas sin precio (D-083): 50 × 25 mm con código lineal, compactas de 25 × 15 mm con código
 * 2D (Data Matrix o QR) y hoja carta de 30. Una etiqueta por hoja en las térmicas.
 */
const props = defineProps<{
  items: LabelItem[]
  format: LabelFormat
  symbology: CompactSymbology
}>()

const labels = computed(() => expandLabels(props.items))
const pages = computed(() => chunk(labels.value, LABELS_PER_LETTER))
const options = (o: Record<string, string>) => Object.values(o).join(' / ')
</script>

<template>
  <div class="bg-white text-black">
    <template v-if="format === 'letter30'">
      <div
        v-for="(page, p) in pages"
        :key="p"
        class="grid w-[206mm] grid-cols-3 gap-x-[3mm] break-after-page"
      >
        <div
          v-for="(item, i) in page"
          :key="i"
          class="flex h-[25.4mm] w-[66.7mm] flex-col items-center justify-center overflow-hidden px-[2mm] outline outline-1 outline-dashed outline-gray-300 print:outline-0"
        >
          <p class="w-full truncate text-center text-[8pt] leading-tight">
            {{ item.title
            }}<template v-if="Object.keys(item.options).length">
              · {{ options(item.options) }}</template
            >
          </p>
          <BarcodeSvg
            :bcid="linearBarcode(item).bcid"
            :text="linearBarcode(item).text"
            :height="10"
            class="h-[13mm] w-full"
          />
          <p class="font-mono text-[7pt] leading-tight">
            {{ linearBarcode(item).text }}<template v-if="item.gtin"> · {{ item.sku }}</template>
          </p>
        </div>
      </div>
    </template>

    <div v-else class="flex flex-wrap gap-2 print:block">
      <div
        v-for="(item, i) in labels"
        :key="i"
        :class="[
          'flex overflow-hidden outline outline-1 outline-dashed outline-gray-300 break-after-page print:outline-0',
          format === 'label50x25'
            ? 'h-[25mm] w-[50mm] flex-col items-center justify-center px-[1.5mm]'
            : 'h-[15mm] w-[25mm] items-center gap-[1mm] px-[1mm]',
        ]"
      >
        <template v-if="format === 'label50x25'">
          <p class="w-full truncate text-center text-[7pt] leading-tight">
            {{ item.title
            }}<template v-if="Object.keys(item.options).length">
              · {{ options(item.options) }}</template
            >
          </p>
          <BarcodeSvg
            :bcid="linearBarcode(item).bcid"
            :text="linearBarcode(item).text"
            :height="10"
            class="h-[14mm] w-full"
          />
          <p class="font-mono text-[6.5pt] leading-tight">{{ linearBarcode(item).text }}</p>
        </template>
        <template v-else>
          <BarcodeSvg :bcid="symbology" :text="compactText(item)" class="size-[12mm] shrink-0" />
          <p class="min-w-0 font-mono text-[5pt] leading-tight break-all">{{ item.sku }}</p>
        </template>
      </div>
    </div>
  </div>
</template>
