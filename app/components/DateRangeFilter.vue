<script setup lang="ts">
/** Rango de fechas de un listado (`…From`/`…To`, API_SPEC §5.3). Una fecha sola incluye todo el día. */
const props = defineProps<{ from?: string; to?: string; label: string }>()
const emit = defineEmits<{
  'update:from': [string | undefined]
  'update:to': [string | undefined]
}>()

const fields = computed(() => [
  { key: 'from' as const, prefix: 'Desde', value: props.from },
  { key: 'to' as const, prefix: 'Hasta', value: props.to },
])

function update(key: 'from' | 'to', value: unknown) {
  const v = String(value ?? '') || undefined
  if (key === 'from') emit('update:from', v)
  else emit('update:to', v)
}
</script>

<template>
  <div role="group" :aria-label="label" class="flex w-full gap-2 sm:w-auto">
    <UInput
      v-for="f in fields"
      :key="f.key"
      type="date"
      :model-value="f.value ?? ''"
      :aria-label="`${label} ${f.prefix.toLowerCase()}`"
      class="w-full sm:w-44"
      @update:model-value="(v) => update(f.key, v)"
    >
      <template #leading
        ><span class="text-xs text-muted">{{ f.prefix }}</span></template
      >
    </UInput>
  </div>
</template>
