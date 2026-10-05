<script setup lang="ts">
import type { ApiProblem } from '~/shared/api/problem'

const props = defineProps<{
  problem: ApiProblem
  /** Mensajes adicionales (por ejemplo, errores de validación sin campo). */
  messages?: string[]
}>()

const description = computed(() => {
  const parts = [props.problem.detail, ...(props.messages ?? [])].filter(Boolean)
  if (props.problem.retryAfter)
    parts.push(`Intenta de nuevo en ${props.problem.retryAfter} segundos.`)
  return parts.join(' ')
})
</script>

<template>
  <UAlert
    color="error"
    variant="subtle"
    icon="i-lucide-circle-alert"
    :title="problem.title"
    :description="description"
    role="alert"
  >
    <template v-if="problem.correlationId" #actions>
      <span class="text-xs text-muted">Referencia: {{ problem.correlationId }}</span>
    </template>
  </UAlert>
</template>
