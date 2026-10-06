<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { BACKGROUND_NOTICE } from '~/shared/api/query-roots'
import { formatMoney } from '~/shared/utils/money'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useManualRefund } from '../api'
import { manualRefundSchema } from '../schemas'
import type { ManualRefundForm } from '../schemas'
import type { AdminPayment } from '../types'

/** Registrar un reembolso hecho fuera del sistema (API_SPEC §16.5). */
const props = defineProps<{ payment: AdminPayment }>()
const open = defineModel<boolean>('open', { required: true })

const state = reactive<ManualRefundForm>({ reference: '', note: '' })
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const refund = useManualRefund(() => props.payment.id)
const toast = useToast()

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(state, { reference: '', note: '' })
  problem.value = null
})

const disabledHint = computed(() =>
  problem.value?.type === 'manual-payments-disabled'
    ? [
        'El pago en tienda está deshabilitado. Un superadministrador lo habilita en Administración > Pago en tienda.',
      ]
    : [],
)

async function onSubmit(event: FormSubmitEvent<ManualRefundForm>) {
  problem.value = null
  try {
    await refund.mutateAsync({
      reference: event.data.reference,
      version: props.payment.version,
      ...(event.data.note ? { note: event.data.note } : {}),
    })
    notifySuccess(toast, 'Reembolso registrado', BACKGROUND_NOTICE)
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
    title="Registrar reembolso"
    :description="`Pedido ${payment.orderCode} · ${formatMoney(payment.capturedAmount)}`"
  >
    <template #body>
      <UForm
        id="manual-refund-form"
        ref="form"
        :schema="manualRefundSchema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" :messages="disabledHint" />
        <p class="text-sm text-muted">
          Registra que ya devolviste todo lo cobrado fuera del sistema. El stock se reintegra
          aparte, desde el pedido.
        </p>
        <UFormField
          label="Comprobante"
          name="reference"
          required
          help="Por ejemplo, el folio de la devolución en la tienda."
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
        <UButton type="submit" form="manual-refund-form" :loading="refund.isPending.value"
          >Registrar reembolso</UButton
        >
      </div>
    </template>
  </UModal>
</template>
