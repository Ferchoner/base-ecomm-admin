<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { notifySuccess } from '~/shared/api/feedback'
import type { ApiProblem } from '~/shared/api/problem'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useAnonymizeGuest } from '../api'
import { guestAnonymizationSchema } from '../schemas'
import type { GuestAnonymizationForm } from '../schemas'

/**
 * Anonimizar las órdenes de invitado de un email (API_SPEC §9.18, ADR-0067). El código de un pedido
 * suyo prueba la solicitud; las órdenes de una cuenta con el mismo email no cambian.
 */
const open = defineModel<boolean>('open', { required: true })

const state = reactive<{
  contactEmail: string
  publicCode: string
  reason: string
  acknowledged: boolean
}>({ contactEmail: '', publicCode: '', reason: '', acknowledged: false })
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const anonymize = useAnonymizeGuest()
const toast = useToast()

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(state, { contactEmail: '', publicCode: '', reason: '', acknowledged: false })
  problem.value = null
})

const hints = computed(() => {
  if (problem.value?.type === 'not-found')
    return ['El email y el código no corresponden a un pedido de invitado.']
  if (problem.value?.type === 'active-orders-exist')
    return ['Tiene pedidos sin concluir. Espera a que se entreguen, venzan o se reembolsen.']
  return []
})

async function onSubmit(event: FormSubmitEvent<GuestAnonymizationForm>) {
  problem.value = null
  const { contactEmail, publicCode, reason } = event.data
  try {
    const result = await anonymize.mutateAsync({ contactEmail, publicCode, reason })
    notifySuccess(
      toast,
      'Pedidos de invitado anonimizados',
      `Se anonimizaron ${result.anonymizedOrderCount} pedidos.`,
    )
    open.value = false
  } catch (e) {
    const p = e as ApiProblem
    const { fieldErrors, otherMessages } = problemFieldErrors(p, [
      'contactEmail',
      'publicCode',
      'reason',
    ])
    form.value?.setErrors(fieldErrors)
    if (fieldErrors.length === 0 || otherMessages.length > 0) problem.value = p
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Anonimizar pedidos de invitado">
    <template #body>
      <UForm
        id="guest-anonymization-form"
        ref="form"
        :schema="guestAnonymizationSchema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" :messages="hints" />
        <p class="text-sm text-muted">
          Se borran para siempre el email y los datos de entrega de todos los pedidos de invitado
          con ese email.
        </p>
        <UFormField label="Email de contacto" name="contactEmail" required>
          <UInput v-model="state.contactEmail" type="email" autocomplete="off" class="w-full" />
        </UFormField>
        <UFormField
          label="Código de un pedido"
          name="publicCode"
          required
          help="Cualquier pedido de invitado de ese email, por ejemplo K7M4-Q9XA."
        >
          <UInput v-model="state.publicCode" :maxlength="100" class="w-full" />
        </UFormField>
        <UFormField
          label="Motivo"
          name="reason"
          required
          help="Referencia de la solicitud ARCO, hasta 250 caracteres."
        >
          <UTextarea v-model="state.reason" :maxlength="250" autoresize class="w-full" />
        </UFormField>
        <UFormField name="acknowledged">
          <UCheckbox v-model="state.acknowledged" label="Entiendo que no se puede deshacer." />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Volver</UButton>
        <UButton
          type="submit"
          form="guest-anonymization-form"
          color="error"
          :loading="anonymize.isPending.value"
          >Anonimizar</UButton
        >
      </div>
    </template>
  </UModal>
</template>
