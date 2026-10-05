<script setup lang="ts">
import type { ApiProblem } from '~/shared/api/problem'

/** Estados de carga, error y vacío de una consulta; el contenido va en el slot por defecto. */
defineProps<{
  loading: boolean
  error: ApiProblem | null
  empty?: boolean
  emptyTitle?: string
  emptyDescription?: string
}>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="loading" class="space-y-2" aria-busy="true" aria-label="Cargando">
    <USkeleton v-for="n in 5" :key="n" class="h-10 w-full" />
  </div>
  <div v-else-if="error" class="space-y-3">
    <ProblemAlert :problem="error" />
    <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" @click="emit('retry')"
      >Reintentar</UButton
    >
  </div>
  <UEmpty
    v-else-if="empty"
    icon="i-lucide-inbox"
    :title="emptyTitle ?? 'Sin resultados'"
    :description="emptyDescription"
  >
    <template #actions><slot name="empty-actions" /></template>
  </UEmpty>
  <slot v-else />
</template>
