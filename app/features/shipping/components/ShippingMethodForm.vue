<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiProblem } from '~/shared/api/problem'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { formatDateTime } from '~/shared/utils/dates'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { centsToPesosText, pesosTextToCents } from '~/shared/utils/money'
import { useUpdateShippingMethod } from '../api'
import { shippingMethodSchema } from '../schemas'
import type { ShippingMethodForm } from '../schemas'
import type { ShippingMethod } from '../types'

/** Costo, envío gratis y plazo del método de envío (UC-SHI-02). Editar pide `shipping.configure`. */
const props = defineProps<{ method: ShippingMethod; disabled?: boolean }>()

const FIELDS = [
  'name',
  'flatFee',
  'freeShippingThreshold',
  'deliveryMinBusinessDays',
  'deliveryMaxBusinessDays',
] as const

function initial(m: ShippingMethod): ShippingMethodForm {
  return {
    name: m.name,
    flatFee: centsToPesosText(m.flatFee.amount),
    hasFreeShipping: m.freeShippingThreshold !== null,
    freeShippingThreshold: m.freeShippingThreshold
      ? centsToPesosText(m.freeShippingThreshold.amount)
      : '',
    deliveryMinBusinessDays: m.deliveryMinBusinessDays,
    deliveryMaxBusinessDays: m.deliveryMaxBusinessDays,
  }
}

const state = reactive<ShippingMethodForm>(initial(props.method))
watch(
  () => props.method,
  (m) => Object.assign(state, initial(m)),
)

const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const otherMessages = ref<string[]>([])
const update = useUpdateShippingMethod()
const toast = useToast()

async function onSubmit(event: FormSubmitEvent<ShippingMethodForm>) {
  problem.value = null
  otherMessages.value = []
  const d = event.data
  try {
    await update.mutateAsync({
      name: d.name,
      flatFee: pesosTextToCents(d.flatFee),
      freeShippingThreshold: d.hasFreeShipping ? pesosTextToCents(d.freeShippingThreshold) : null,
      deliveryMinBusinessDays: d.deliveryMinBusinessDays,
      deliveryMaxBusinessDays: d.deliveryMaxBusinessDays,
      version: props.method.version,
    })
    notifySuccess(toast, 'Método de envío guardado', 'Aplica a los pedidos nuevos.')
  } catch (e) {
    const p = e as ApiProblem
    if (p.type === 'version-conflict') return notifyProblem(toast, p)
    const { fieldErrors, otherMessages: rest } = problemFieldErrors(p, FIELDS)
    form.value?.setErrors(fieldErrors)
    otherMessages.value = rest
    if (fieldErrors.length === 0 || rest.length > 0) problem.value = p
  }
}
</script>

<template>
  <UForm
    ref="form"
    :schema="shippingMethodSchema"
    :state="state"
    :disabled="disabled"
    class="max-w-2xl space-y-4"
    @submit="onSubmit"
  >
    <ProblemAlert v-if="problem" :problem="problem" :messages="otherMessages" />
    <UFormField label="Nombre" name="name" required help="Solo lo ve el staff.">
      <UInput v-model="state.name" :maxlength="100" class="w-full" />
    </UFormField>

    <UFormField
      label="Costo de envío"
      name="flatFee"
      required
      help="En pesos, con IVA incluido. 0 si el envío siempre es gratis."
    >
      <UInput v-model="state.flatFee" inputmode="decimal" class="w-full sm:w-48">
        <template #leading>$</template>
      </UInput>
    </UFormField>

    <USwitch v-model="state.hasFreeShipping" label="Envío gratis a partir de un monto" />
    <UFormField
      v-if="state.hasFreeShipping"
      label="Monto para envío gratis"
      name="freeShippingThreshold"
      required
      help="Subtotal con IVA, menos el descuento, que debe alcanzar el pedido."
    >
      <UInput v-model="state.freeShippingThreshold" inputmode="decimal" class="w-full sm:w-48">
        <template #leading>$</template>
      </UInput>
    </UFormField>

    <fieldset class="space-y-2">
      <legend class="text-sm font-medium">Plazo de entrega</legend>
      <p class="text-sm text-muted">Días hábiles desde que se confirma el pago.</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Mínimo" name="deliveryMinBusinessDays" required>
          <UInputNumber v-model="state.deliveryMinBusinessDays" :min="1" :max="30" class="w-full" />
        </UFormField>
        <UFormField label="Máximo" name="deliveryMaxBusinessDays" required>
          <UInputNumber v-model="state.deliveryMaxBusinessDays" :min="1" :max="30" class="w-full" />
        </UFormField>
      </div>
    </fieldset>

    <p class="text-xs text-muted">
      Los cambios no afectan los pedidos ya colocados. Última actualización:
      {{ formatDateTime(method.updatedAt) }}
    </p>

    <UButton v-if="!disabled" type="submit" :loading="update.isPending.value">Guardar</UButton>
  </UForm>
</template>
