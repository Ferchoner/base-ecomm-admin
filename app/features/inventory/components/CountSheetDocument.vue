<script setup lang="ts">
import { formatDateTime } from '~/shared/utils/dates'
import type { Count } from '../types'

/**
 * La hoja de conteo para contar en papel (ADR-0173): por ubicación y SKU, con un espacio para lo
 * contado y nunca lo esperado, aunque quien imprime lo pueda ver. Lo contado se captura después.
 */
defineProps<{
  count: Count
  warehouseName: string
  filterLabel: string
  format: 'letter' | 'thermal80'
}>()
</script>

<template>
  <article
    class="text-black"
    :class="format === 'letter' ? 'w-[190mm] text-[11px]' : 'w-[72mm] text-[10px]'"
  >
    <header class="mb-2 space-y-0.5">
      <h1 class="text-base font-bold">Hoja de conteo {{ count.folio }}</h1>
      <p>{{ warehouseName }} · {{ filterLabel }}</p>
      <p>Abierta {{ formatDateTime(count.createdAt) }} · {{ count.lineCount }} líneas</p>
      <p v-if="count.note">{{ count.note }}</p>
      <p>
        Cuenta lo que ves en cada ubicación y anota el total. Lo que no esté en la hoja, al final.
      </p>
    </header>

    <table class="w-full border-collapse">
      <thead>
        <tr class="border-b border-black text-left">
          <th class="py-1 pr-2">Ubicación</th>
          <th class="py-1 pr-2">SKU</th>
          <th v-if="format === 'letter'" class="py-1 pr-2">Producto</th>
          <th class="w-[22mm] py-1">Contadas</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="line in count.lines"
          :key="line.variantId"
          class="break-inside-avoid border-b border-gray-400"
        >
          <td class="py-1.5 pr-2 align-top font-semibold">{{ line.location ?? '—' }}</td>
          <td class="py-1.5 pr-2 align-top">
            <span class="font-mono">{{ line.sku }}</span>
            <div v-if="format !== 'letter'">{{ line.productTitle }}</div>
          </td>
          <td v-if="format === 'letter'" class="py-1.5 pr-2 align-top">{{ line.productTitle }}</td>
          <td class="py-1.5 align-top"><div class="h-5 border border-black" /></td>
        </tr>
        <tr v-for="n in 5" :key="`extra-${n}`" class="break-inside-avoid border-b border-gray-400">
          <td class="py-1.5 pr-2"><div class="h-5" /></td>
          <td class="py-1.5 pr-2" />
          <td v-if="format === 'letter'" class="py-1.5 pr-2" />
          <td class="py-1.5"><div class="h-5 border border-black" /></td>
        </tr>
      </tbody>
    </table>

    <footer class="mt-4 grid grid-cols-2 gap-4">
      <p class="border-t border-black pt-1">Contó</p>
      <p class="border-t border-black pt-1">Fecha y hora</p>
    </footer>
  </article>
</template>
