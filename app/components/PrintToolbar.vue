<script setup lang="ts">
/**
 * Barra de una página de impresión: volver, elegir papel y abrir el diálogo del sistema. No sale en
 * la hoja impresa.
 */
defineProps<{
  back: string
  backLabel: string
  title: string
  format: string
  formats: Array<{ value: string; label: string }>
}>()
defineEmits<{ 'update:format': [value: string] }>()

function print() {
  window.print()
}
</script>

<template>
  <div
    class="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-default bg-default p-3 print:hidden"
  >
    <UButton :to="back" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm">{{
      backLabel
    }}</UButton>
    <h1 class="font-semibold">{{ title }}</h1>
    <div class="flex-1" />
    <slot />
    <USelect
      :model-value="format"
      :items="formats"
      aria-label="Papel"
      class="w-full sm:w-56"
      @update:model-value="(v) => $emit('update:format', v as string)"
    />
    <UButton icon="i-lucide-printer" @click="print">Imprimir</UButton>
  </div>
</template>
