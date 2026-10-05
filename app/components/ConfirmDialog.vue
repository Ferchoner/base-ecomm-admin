<script setup lang="ts">
/**
 * Confirmación genérica. Con `reasonLabel`, pide un motivo (las acciones que la API audita con
 * `reason`) y lo devuelve al cerrar. Se abre con `useOverlay().create(ConfirmDialog).open(props)`.
 */
const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    confirmLabel?: string
    color?: 'primary' | 'error' | 'warning'
    reasonLabel?: string
    reasonMaxLength?: number
  }>(),
  {
    description: undefined,
    confirmLabel: 'Confirmar',
    color: 'primary',
    reasonLabel: undefined,
    reasonMaxLength: 500,
  },
)

const emit = defineEmits<{ close: [result: { confirmed: boolean; reason?: string }] }>()

const reason = ref('')
const reasonInvalid = computed(() => !!props.reasonLabel && reason.value.trim() === '')

function confirm() {
  if (reasonInvalid.value) return
  emit('close', { confirmed: true, reason: props.reasonLabel ? reason.value.trim() : undefined })
}
</script>

<template>
  <UModal
    :title="title"
    :description="description"
    :close="false"
    @update:open="(open) => !open && emit('close', { confirmed: false })"
  >
    <template v-if="reasonLabel" #body>
      <UFormField
        :label="reasonLabel"
        required
        help="No escribas datos personales: el motivo queda en la auditoría."
      >
        <UTextarea v-model="reason" :maxlength="reasonMaxLength" autoresize class="w-full" />
      </UFormField>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="emit('close', { confirmed: false })"
          >Cancelar</UButton
        >
        <UButton :color="color" :disabled="reasonInvalid" @click="confirm">{{
          confirmLabel
        }}</UButton>
      </div>
    </template>
  </UModal>
</template>
