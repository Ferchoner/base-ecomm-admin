<script setup lang="ts">
import { chunkList } from '../status'

/**
 * Etiquetas de estante (ADR-0173): la ubicación en grande y el almacén, para pegarla donde va el
 * producto. Sin código: la ubicación puede llevar espacios, como `VITRINA 1`.
 */
const props = defineProps<{
  locations: string[]
  warehouseName: string
  format: 'label50x25' | 'roll58' | 'letter30'
}>()

const pages = computed(() => chunkList(props.locations, 30))
const size = (location: string, base: number) =>
  `${Math.max(10, Math.min(base, Math.floor((base * 6) / Math.max(location.length, 1))))}pt`
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
          v-for="location in page"
          :key="location"
          class="flex h-[25.4mm] w-[66.7mm] flex-col items-center justify-center overflow-hidden px-[2mm] outline outline-1 outline-dashed outline-gray-300 print:outline-0"
        >
          <p class="font-bold leading-none" :style="{ fontSize: size(location, 40) }">
            {{ location }}
          </p>
          <p class="mt-1 text-[8pt]">{{ warehouseName }}</p>
        </div>
      </div>
    </template>
    <div v-else :class="format === 'roll58' ? 'w-[48mm]' : 'flex flex-wrap gap-2 print:block'">
      <div
        v-for="(location, i) in locations"
        :key="location"
        :class="[
          'flex flex-col items-center justify-center overflow-hidden px-[1.5mm]',
          format === 'roll58'
            ? [
                'h-[22mm] w-[48mm]',
                i < locations.length - 1 && 'border-b-[0.2mm] border-dashed border-black',
              ]
            : 'h-[25mm] w-[50mm] outline outline-1 outline-dashed outline-gray-300 break-after-page print:outline-0',
        ]"
      >
        <p class="font-bold leading-none" :style="{ fontSize: size(location, 36) }">
          {{ location }}
        </p>
        <p class="mt-1 text-[7pt]">{{ warehouseName }}</p>
      </div>
    </div>
  </div>
</template>
