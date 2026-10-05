<script setup lang="ts">
/** Pares etiqueta–valor de una ficha de detalle. `mono` muestra IDs y códigos en monoespaciado. */
defineProps<{
  items: Array<{ label: string; value: string | number | null | undefined; mono?: boolean }>
}>()
</script>

<template>
  <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
    <template v-for="item in items" :key="item.label">
      <dt class="text-muted">{{ item.label }}</dt>
      <dd :class="item.mono ? 'font-mono text-xs break-all' : undefined">
        {{ item.value ?? '—' }}
      </dd>
    </template>
  </dl>
</template>
