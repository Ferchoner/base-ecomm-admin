<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useCancelOrder } from '../api'
import { cancelSchema } from '../schemas'
import type { CancelForm } from '../schemas'
import { cancelStartsRefund } from '../status'
import type { AdminOrder } from '../types'

/** Cancelar una orden (API_SPEC §15.7). */
const props = defineProps<{ order: AdminOrder; canRestock: boolean }>()
const open = defineModel<boolean>('open', { required: true })

const state = reactive<CancelForm>({ reason: '', restock: false })
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const cancel = useCancelOrder(() => props.order.id)
const toast = useToast()

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(state, { reason: '', restock: false })
  problem.value = null
})

// `restock` solo en PAID y con `inventory.write` (ADR-0052).
const offerRestock = computed(() => props.order.status === 'PAID' && props.canRestock)
const refund = computed(() => cancelStartsRefund(props.order.status))

async function onSubmit(event: FormSubmitEvent<CancelForm>) {
  problem.value = null
  try {
    await cancel.mutateAsync({
      reason: event.data.reason,
      version: props.order.version,
      ...(offerRestock.value && event.data.restock ? { restock: true } : {}),
    })
    notifySuccess(
      toast,
      'Pedido cancelado',
      refund.value ? 'Se inició el reembolso total del pago.' : undefined,
    )
    open.value = false
  } catch (e) {
    const p = e as ApiProblem
    if (p.type === 'version-conflict') {
      notifyProblem(toast, p)
      open.value = false
      return
    }
    const { fieldErrors, otherMessages } = problemFieldErrors(p, ['reason'])
    form.value?.setErrors(fieldErrors)
    if (fieldErrors.length === 0 || otherMessages.length > 0) problem.value = p
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="`Cancelar el pedido ${order.publicCode}`">
    <template #body>
      <UForm
        id="cancel-order-form"
        ref="form"
        :schema="cancelSchema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" />
        <UAlert
          v-if="refund"
          color="warning"
          variant="subtle"
          icon="i-lucide-undo-2"
          title="Se inicia el reembolso total"
          description="El pedido ya está pagado: al cancelarlo se inicia el reembolso de todo lo cobrado y se cancela su envío."
        />
        <p v-else class="text-sm text-muted">
          Se libera el stock apartado y se cancela el pago iniciado.
        </p>
        <UFormField label="Motivo" name="reason" required help="Hasta 500 caracteres.">
          <UTextarea v-model="state.reason" :maxlength="500" autoresize class="w-full" />
        </UFormField>
        <UCheckbox
          v-if="offerRestock"
          v-model="state.restock"
          name="restock"
          label="Reintegrar todas las unidades al inventario"
          description="Vuelven a estar disponibles para la venta."
        />
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Volver</UButton>
        <UButton
          type="submit"
          form="cancel-order-form"
          color="error"
          :loading="cancel.isPending.value"
          >Cancelar pedido</UButton
        >
      </div>
    </template>
  </UModal>
</template>
