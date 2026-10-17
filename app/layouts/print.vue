<script setup lang="ts">
/**
 * Páginas de impresión (PLAN_API_1.7 §3.2): sin menú; la barra de cada página se oculta al imprimir
 * y el documento sale en negro sobre blanco, también con el tema oscuro.
 */
const route = useRoute()
useHead({ title: computed(() => route.meta.title ?? 'Imprimir') })
</script>

<template>
  <div class="min-h-screen bg-muted print:min-h-0 print:bg-white">
    <slot />
  </div>
</template>
