<script setup lang="ts">
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { useRetryDelivery } from '../api'

/** Reintenta una entrega FAILED (API_SPEC §22.2). Un 409 explica que ya no estaba fallida. */
const props = defineProps<{ deliveryId: string; size?: 'xs' | 'sm' | 'md' }>()
const emit = defineEmits<{ retried: [] }>()

const retry = useRetryDelivery()
const toast = useToast()

async function run() {
  try {
    await retry.mutateAsync(props.deliveryId)
    notifySuccess(toast, 'Entrega reactivada', 'El sistema la reintenta en el siguiente minuto.')
    emit('retried')
  } catch (e) {
    notifyProblem(toast, e)
  }
}
</script>

<template>
  <UButton
    :size="size ?? 'sm'"
    color="neutral"
    variant="outline"
    icon="i-lucide-rotate-ccw"
    :loading="retry.isPending.value"
    @click.stop="run"
    >Reintentar</UButton
  >
</template>
