<script setup lang="ts">
/** Pares etiqueta–valor de una ficha de detalle. */
defineProps<{ items: Array<{ label: string; value: string | number | null | undefined }> }>()
</script>

<template>
  <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
    <template v-for="item in items" :key="item.label">
      <dt class="text-muted">{{ item.label }}</dt>
      <dd>{{ item.value ?? '—' }}</dd>
    </template>
  </dl>
</template>
