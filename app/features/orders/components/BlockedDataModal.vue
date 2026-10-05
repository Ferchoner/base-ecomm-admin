<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiProblem } from '~/shared/api/problem'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useBlockedData } from '../api'
import { blockedDataSchema } from '../schemas'
import type { BlockedDataForm } from '../schemas'
import type { AdminOrder, BlockedOrderData } from '../types'

/**
 * Datos personales de una orden bloqueada (API_SPEC §15.7, ADR-0151). La consulta se audita con el
 * motivo; los datos solo viven en este modal y se descartan al cerrarlo.
 */
const props = defineProps<{ order: AdminOrder }>()
const open = defineModel<boolean>('open', { required: true })

const state = reactive<BlockedDataForm>({ reason: '' })
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const data = shallowRef<BlockedOrderData | null>(null)
const read = useBlockedData(() => props.order.id)

watch(open, () => {
  state.reason = ''
  problem.value = null
  data.value = null
  read.reset()
})

async function onSubmit(event: FormSubmitEvent<BlockedDataForm>) {
  problem.value = null
  try {
    data.value = await read.mutateAsync(event.data.reason)
  } catch (e) {
    const p = e as ApiProblem
    const { fieldErrors, otherMessages } = problemFieldErrors(p, ['reason'])
    form.value?.setErrors(fieldErrors)
    if (fieldErrors.length === 0 || otherMessages.length > 0) problem.value = p
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Datos personales bloqueados"
    :description="`Pedido ${order.publicCode}`"
  >
    <template #body>
      <div v-if="data" class="space-y-4">
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-lucide-shield-alert"
          title="Consulta registrada en la auditoría"
          description="Usa estos datos solo para atender el motivo que indicaste."
        />
        <div>
          <h3 class="text-sm font-medium text-muted">Email de contacto</h3>
          <p class="text-sm">{{ data.contactEmail }}</p>
        </div>
        <div>
          <h3 class="text-sm font-medium text-muted">Dirección de envío</h3>
          <PostalAddress :address="data.shippingAddress" />
        </div>
      </div>
      <UForm
        v-else
        id="blocked-data-form"
        ref="form"
        :schema="blockedDataSchema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" />
        <p class="text-sm text-muted">
          Los datos de este pedido están bloqueados. Indica la reclamación o el requerimiento que
          atiendes; queda en la auditoría.
        </p>
        <UFormField
          label="Motivo"
          name="reason"
          required
          help="Hasta 500 caracteres, sin datos personales."
        >
          <UTextarea v-model="state.reason" :maxlength="500" autoresize class="w-full" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="ghost" @click="open = false">Cerrar</UButton>
        <UButton v-if="!data" type="submit" form="blocked-data-form" :loading="read.isPending.value"
          >Ver datos</UButton
        >
      </div>
    </template>
  </UModal>
</template>
