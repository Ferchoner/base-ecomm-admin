<script setup lang="ts">
export interface StatusStyle {
  label: string
  color: 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error' | 'neutral'
}

const props = defineProps<{ value: string; styles: Record<string, StatusStyle> }>()

// La API puede agregar valores (API_SPEC §2.1): uno desconocido se muestra tal cual, en neutro.
const style = computed<StatusStyle>(
  () => props.styles[props.value] ?? { label: props.value, color: 'neutral' },
)
</script>

<template>
  <UBadge :color="style.color" variant="subtle">{{ style.label }}</UBadge>
</template>
