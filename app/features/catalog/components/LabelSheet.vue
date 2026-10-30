<script setup lang="ts">
import { LABEL_FORMATS, ROLL_ROWS_PER_PAGE } from '~/shared/print/formats'
import type { CompactSymbology, LabelFormat } from '~/shared/print/formats'
import { compactText, linearBarcode } from '~/shared/print/symbology'
import { LABELS_PER_LETTER, chunk, expandLabels } from '../labels'
import type { LabelItem } from '../labels'

/**
 * Etiquetas sin precio (D-083): en rollo térmico de 58 mm (lineal, o compactas 2D de dos en dos),
 * adhesivas de 50 × 25 mm con código lineal o de 25 × 15 mm con código 2D (Data Matrix o QR), y
 * hoja carta de 30. En rollo van una tras otra con una línea para cortar; en adhesivas, una por hoja.
 */
const props = defineProps<{
  items: LabelItem[]
  format: LabelFormat
  symbology: CompactSymbology
}>()

const labels = computed(() => expandLabels(props.items))
const pages = computed(() => chunk(labels.value, LABELS_PER_LETTER))
const roll = computed(() => LABEL_FORMATS[props.format].roll)
const rollPages = computed(() =>
  roll.value ? chunk(labels.value, roll.value.perRow * ROLL_ROWS_PER_PAGE) : [],
)
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
            :max-width="62"
            class="h-[13mm]"
          />
          <p class="font-mono text-[7pt] leading-tight">
            {{ linearBarcode(item).text }}<template v-if="item.gtin"> · {{ item.sku }}</template>
          </p>
        </div>
      </div>
    </template>

    <template v-else-if="roll">
      <!-- Los 48 mm imprimibles del rollo de 58 mm; el alto de la hoja lo fija @page. -->
      <div
        v-for="(page, p) in rollPages"
        :key="p"
        :class="[
          'w-[48mm] outline outline-1 outline-gray-300 print:outline-0',
          p < rollPages.length - 1 && 'break-after-page',
        ]"
      >
        <div :class="['grid', roll.perRow === 2 ? 'grid-cols-2' : 'grid-cols-1']">
          <div
            v-for="(item, i) in page"
            :key="i"
            :style="{ height: `${roll.rowMm}mm` }"
            :class="[
              'flex overflow-hidden border-dashed border-black',
              i + roll.perRow < page.length && 'border-b-[0.2mm]',
              roll.perRow === 2 && i % 2 === 0 && i + 1 < page.length && 'border-r-[0.2mm]',
              roll.perRow === 1
                ? 'flex-col items-center justify-center px-[1mm]'
                : 'items-center gap-[1mm] px-[1mm]',
            ]"
          >
            <template v-if="roll.perRow === 1">
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
                :max-width="46"
                class="h-[13mm]"
              />
              <p class="font-mono text-[6.5pt] leading-tight">{{ linearBarcode(item).text }}</p>
            </template>
            <template v-else>
              <BarcodeSvg
                :bcid="symbology"
                :text="compactText(item)"
                class="size-[12mm] shrink-0"
              />
              <p class="min-w-0 font-mono text-[5.5pt] leading-tight break-all">{{ item.sku }}</p>
            </template>
          </div>
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
            :max-width="47"
            class="h-[14mm]"
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
