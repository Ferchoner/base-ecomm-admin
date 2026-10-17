<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { z } from 'zod'
import type { ApiProblem } from '~/shared/api/problem'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useWorkOrderBlockedData } from '../api'
import type { BlockedWorkOrderData, WorkOrder } from '../types'

/**
 * Datos del cliente de una orden de trabajo bloqueada (API_SPEC §25.11, ADR-0167). La consulta se
 * audita con el motivo; los datos solo viven en este modal y se descartan al cerrarlo.
 */
const props = defineProps<{ workOrder: WorkOrder }>()
const open = defineModel<boolean>('open', { required: true })

const schema = z.object({
  reason: z.string().trim().min(1, 'Escribe el motivo.').max(500, 'Máximo 500 caracteres.'),
})
const state = reactive({ reason: '' })
const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const data = shallowRef<BlockedWorkOrderData | null>(null)
const read = useWorkOrderBlockedData(() => props.workOrder.id)

watch(open, () => {
  state.reason = ''
  problem.value = null
  data.value = null
  read.reset()
})

const LABELS: Array<[keyof BlockedWorkOrderData, string]> = [
  ['customerName', 'Nombre'],
  ['customerPhone', 'Teléfono'],
  ['customerEmail', 'Email'],
  ['serialNumber', 'Número de serie'],
  ['accessories', 'Accesorios'],
  ['equipmentCondition', 'Estado en que llegó'],
  ['reportedFault', 'Falla que reportó'],
  ['diagnosis', 'Diagnóstico'],
  ['workPerformed', 'Trabajo realizado'],
]

async function onSubmit(event: FormSubmitEvent<{ reason: string }>) {
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
    title="Datos del cliente bloqueados"
    :description="`Orden de trabajo ${workOrder.folio}`"
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
        <dl class="space-y-2 text-sm">
          <div v-for="[key, label] in LABELS" :key="key">
            <dt class="font-medium text-muted">{{ label }}</dt>
            <dd class="whitespace-pre-line">{{ data[key] ?? '—' }}</dd>
          </div>
        </dl>
      </div>
      <UForm
        v-else
        id="work-order-blocked-form"
        ref="form"
        :schema="schema"
        :state="state"
        :validate-on="['input', 'change']"
        class="space-y-4"
        @submit="onSubmit"
      >
        <ProblemAlert v-if="problem" :problem="problem" />
        <p class="text-sm text-muted">
          Los datos del cliente de esta orden están bloqueados. Indica la reclamación o el
          requerimiento que atiendes; queda en la auditoría.
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
        <UButton
          v-if="!data"
          type="submit"
          form="work-order-blocked-form"
          :loading="read.isPending.value"
          >Ver datos</UButton
        >
      </div>
    </template>
  </UModal>
</template>
