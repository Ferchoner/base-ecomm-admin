<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { formatMoney } from '~/shared/utils/money'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useChangeWorkOrderStatus } from '../api'
import { statusChangeSchema, toStatusInput } from '../schemas'
import type { StatusChangeForm } from '../schemas'
import { WORK_ORDER_STATUS, nextStatuses } from '../status'
import type { WorkOrder, WorkOrderStatus } from '../types'

/**
 * Cambiar el estado por su acción (API_SPEC §25.6): hacia adelante, aunque salte pasos, o cancelar
 * con una nota. La nota queda en el historial y en la auditoría, sin datos personales.
 */
const props = defineProps<{ workOrder: WorkOrder; initial?: WorkOrderStatus }>()
const open = defineModel<boolean>('open', { required: true })

const options = computed(() =>
  nextStatuses(props.workOrder.status).map((value): { value: string; label: string } => ({
    value,
    label: WORK_ORDER_STATUS[value].label,
  })),
)
const state = reactive<StatusChangeForm>({ status: '', note: '' })
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const messages = ref<string[]>([])
const change = useChangeWorkOrderStatus(() => props.workOrder.id)
const toast = useToast()

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(state, { status: props.initial ?? options.value[0]?.value ?? '', note: '' })
  problem.value = null
  messages.value = []
})

const closing = computed(() => state.status === 'DELIVERED' || state.status === 'CANCELLED')

async function onSubmit(event: FormSubmitEvent<StatusChangeForm>) {
  problem.value = null
  messages.value = []
  try {
    const saved = await change.mutateAsync(toStatusInput(event.data, props.workOrder.version))
    notifySuccess(toast, `Orden ${saved.folio}: ${WORK_ORDER_STATUS[saved.status].label}`)
    open.value = false
  } catch (e) {
    const p = e as ApiProblem
    if (p.type === 'version-conflict') {
      notifyProblem(toast, p)
      open.value = false
      return
    }
    const { fieldErrors, otherMessages } = problemFieldErrors(p, ['status', 'note'])
    form.value?.setErrors(fieldErrors)
    messages.value = otherMessages
    if (p.type === 'invalid-state-transition') {
      const current = WORK_ORDER_STATUS[p.extensions.currentStatus as WorkOrderStatus]
      messages.value.push(
        current
          ? `La orden ya está en ${current.label.toLowerCase()}: recarga para ver a qué estado puede pasar.`
          : 'La orden ya no puede pasar a ese estado.',
      )
    }
    if (fieldErrors.length === 0 || messages.value.length > 0) problem.value = p
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="`Cambiar el estado de ${workOrder.folio}`">
    <template #body>
      <UForm
        id="work-order-status-form"
        ref="form"
        :schema="statusChangeSchema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" :messages="messages" />
        <UFormField label="Nuevo estado" name="status" required>
          <USelect v-model="state.status" :items="options" class="w-full" />
        </UFormField>
        <UAlert
          v-if="state.status === 'DELIVERED' && workOrder.unpaidTotal.amount > 0"
          color="warning"
          variant="subtle"
          icon="i-lucide-hand-coins"
          title="Tiene ventas por cobrar"
          :description="`Faltan ${formatMoney(workOrder.unpaidTotal)}. Entregar no exige el pago, pero revisa antes de entregar.`"
        />
        <p v-if="closing" class="text-sm text-muted">
          Es un estado final: después ya no cambian sus datos, su estado ni sus ventas.
        </p>
        <UFormField
          label="Nota"
          name="note"
          :required="state.status === 'CANCELLED'"
          :help="
            state.status === 'CANCELLED'
              ? 'Por qué se cancela. Queda en el historial, sin datos personales.'
              : 'Opcional. Queda en el historial, sin datos personales.'
          "
        >
          <UTextarea v-model="state.note" :maxlength="500" autoresize class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Volver</UButton>
        <UButton
          type="submit"
          form="work-order-status-form"
          :color="state.status === 'CANCELLED' ? 'error' : 'primary'"
          :loading="change.isPending.value"
          >{{ state.status === 'CANCELLED' ? 'Cancelar la orden' : 'Cambiar estado' }}</UButton
        >
      </div>
    </template>
  </UModal>
</template>
