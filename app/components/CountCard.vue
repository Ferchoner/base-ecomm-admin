<script setup lang="ts">
/**
 * Conteo del tablero: `meta.totalItems` de un listado filtrado (DECISIONS D-P04, GAPS G-03). Toda la
 * tarjeta enlaza al listado con el mismo filtro.
 */
const props = defineProps<{
  label: string
  to: string
  icon: string
  total: number | undefined
  loading: boolean
  failed: boolean
  /** Color del número cuando hay pendientes. */
  color?: 'warning' | 'error' | 'info'
}>()

const accessibleName = computed(() => {
  if (props.loading) return `${props.label}: cargando`
  if (props.failed || props.total === undefined) return `${props.label}: no se pudo consultar`
  return `${props.label}: ${props.total}`
})
const tone = computed(() =>
  props.total
    ? { warning: 'text-warning', error: 'text-error', info: 'text-info' }[props.color ?? 'warning']
    : 'text-muted',
)
</script>

<template>
  <NuxtLink
    :to="to"
    :aria-label="accessibleName"
    class="block rounded-lg border border-default p-4 transition hover:bg-elevated/50 focus-visible:outline-2 focus-visible:outline-primary"
  >
    <div class="flex items-center gap-2 text-sm text-muted">
      <UIcon :name="icon" class="size-4" />
      <span>{{ label }}</span>
    </div>
    <USkeleton v-if="loading" class="mt-2 h-8 w-16" />
    <p v-else-if="failed || total === undefined" class="mt-2 text-sm text-error">
      No se pudo consultar
    </p>
    <p v-else :class="['mt-1 text-3xl font-semibold tabular-nums', tone]">{{ total }}</p>
  </NuxtLink>
</template>
