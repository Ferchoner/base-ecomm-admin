<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { BACKGROUND_NOTICE } from '~/shared/api/query-roots'
import { formatMoney } from '~/shared/utils/money'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useManualCapture } from '../api'
import { manualCaptureSchema } from '../schemas'
import type { ManualCaptureForm } from '../schemas'
import type { AdminOrder } from '../types'

/** Registrar el pago en tienda de una orden (API_SPEC §16.4). */
const props = defineProps<{ order: AdminOrder }>()
const open = defineModel<boolean>('open', { required: true })

const state = reactive<ManualCaptureForm>({ reference: '', note: '' })
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const capture = useManualCapture(() => props.order.id)
const toast = useToast()

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(state, { reference: '', note: '' })
  problem.value = null
})

// La API no expone si el pago manual está habilitado (GAPS G-02): se explica su 403.
const disabledHint = computed(() =>
  problem.value?.type === 'manual-payments-disabled'
    ? ['El pago manual está deshabilitado en la API. Un superadministrador debe activarlo.']
    : [],
)

async function onSubmit(event: FormSubmitEvent<ManualCaptureForm>) {
  problem.value = null
  try {
    await capture.mutateAsync({
      reference: event.data.reference,
      ...(event.data.note ? { note: event.data.note } : {}),
    })
    notifySuccess(toast, 'Pago registrado', BACKGROUND_NOTICE)
    open.value = false
  } catch (e) {
    const p = e as ApiProblem
    if (p.type === 'version-conflict') {
      notifyProblem(toast, p)
      open.value = false
      return
    }
    const { fieldErrors, otherMessages } = problemFieldErrors(p, ['reference', 'note'])
    form.value?.setErrors(fieldErrors)
    if (fieldErrors.length === 0 || otherMessages.length > 0) problem.value = p
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Registrar pago en tienda"
    :description="`Pedido ${order.publicCode} · ${formatMoney(order.grandTotal)}`"
  >
    <template #body>
      <UForm
        id="manual-capture-form"
        ref="form"
        :schema="manualCaptureSchema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" :messages="disabledHint" />
        <p class="text-sm text-muted">Se registra el cobro por el total del pedido.</p>
        <UFormField
          label="Comprobante"
          name="reference"
          required
          help="Por ejemplo, el número de ticket de la tienda."
        >
          <UInput v-model="state.reference" :maxlength="100" class="w-full" />
        </UFormField>
        <UFormField label="Nota" name="note" help="Opcional. Queda en la auditoría.">
          <UTextarea v-model="state.note" :maxlength="500" autoresize class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
        <UButton type="submit" form="manual-capture-form" :loading="capture.isPending.value"
          >Registrar pago</UButton
        >
      </div>
    </template>
  </UModal>
</template>
