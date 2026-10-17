<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ApiProblem } from '~/shared/api/problem'
import { notifyProblem, notifySuccess } from '~/shared/api/feedback'
import { problemFieldErrors } from '~/shared/utils/form-errors'
import { useCreatePromotion, useUpdatePromotion } from '../api'
import { initialPromotionForm, promotionSchema, toCreateInput, toUpdateInput } from '../schemas'
import type { PromotionForm } from '../schemas'
import { CHANNEL_OPTIONS, editableFields } from '../status'
import type { Promotion } from '../types'
import TargetPicker from './TargetPicker.vue'

/**
 * Alta (sin `promotion`) o edición de una promoción (API_SPEC §26.2, §26.5). Los campos que el
 * estado no deja cambiar se muestran deshabilitados; la API valida de todos modos.
 */
const props = defineProps<{ promotion?: Promotion; readonly?: boolean }>()
const emit = defineEmits<{ saved: [promotion: Promotion] }>()

const FIELDS = [
  'name',
  'percentage',
  'amountOff',
  'targets',
  'channels',
  'minimumSubtotal',
  'startsAt',
  'endsAt',
  'code',
  'usageLimit',
  'oncePerCustomer',
] as const
const FIELD_MAP = Object.fromEntries(
  Array.from({ length: 100 }, (_, i) => [`targets[${i}].id`, 'targets']),
)

const base = shallowRef(props.promotion)
const state = reactive<PromotionForm>(initialPromotionForm(base.value))
const editable = computed(() => (props.readonly ? new Set() : editableFields(base.value?.status)))
const can = (f: Parameters<ReturnType<typeof editableFields>['has']>[0]) => editable.value.has(f)

function load(p?: Promotion) {
  base.value = p
  Object.assign(state, initialPromotionForm(p))
}
watch(
  () => props.promotion,
  (p) => {
    if (JSON.stringify(state) === JSON.stringify(initialPromotionForm(base.value))) load(p)
  },
)

const DISCOUNT_OPTIONS = [
  { value: 'percentage', label: 'Porcentaje' },
  { value: 'amount', label: 'Monto fijo por compra' },
]

const form = useTemplateRef('form')
const problem = ref<ApiProblem | null>(null)
const otherMessages = ref<string[]>([])
const create = useCreatePromotion()
const update = useUpdatePromotion(() => props.promotion?.id ?? '')
const saving = computed(() => create.isPending.value || update.isPending.value)
const toast = useToast()

async function onSubmit(event: FormSubmitEvent<PromotionForm>) {
  problem.value = null
  otherMessages.value = []
  try {
    let saved: Promotion
    if (base.value) {
      const input = toUpdateInput(event.data, base.value, editableFields(base.value.status))
      if (Object.keys(input).length === 1) {
        toast.add({ title: 'No hay cambios que guardar', color: 'neutral', icon: 'i-lucide-info' })
        return
      }
      saved = await update.mutateAsync(input)
      load(saved)
      notifySuccess(toast, 'Promoción actualizada')
    } else {
      saved = await create.mutateAsync(toCreateInput(event.data))
      notifySuccess(toast, saved.code ? 'Cupón creado' : 'Promoción creada')
    }
    emit('saved', saved)
  } catch (error) {
    const p = error as ApiProblem
    if (p.type === 'version-conflict') return notifyProblem(toast, p, () => load(props.promotion))
    const { fieldErrors, otherMessages: rest } = problemFieldErrors(p, FIELDS, FIELD_MAP)
    form.value?.setErrors(fieldErrors)
    otherMessages.value = rest
    if (p.type === 'invalid-state-transition')
      otherMessages.value.push(
        'La promoción cambió de estado: recarga para ver qué se puede editar.',
      )
    if (fieldErrors.length === 0 || otherMessages.value.length > 0) problem.value = p
  }
}
</script>

<template>
  <UForm
    ref="form"
    :schema="promotionSchema"
    :state="state"
    class="max-w-3xl space-y-5"
    @submit="onSubmit"
  >
    <ProblemAlert v-if="problem" :problem="problem" :messages="otherMessages" />
    <UAlert
      v-if="promotion?.status === 'ACTIVE' && !readonly"
      color="info"
      variant="subtle"
      icon="i-lucide-lock"
      title="Ya está vigente"
      description="Solo se pueden cambiar el nombre, el fin y el límite de usos."
    />

    <UFormField
      label="Nombre"
      name="name"
      required
      help="Lo ve el cliente en su pedido y en el ticket."
    >
      <UInput
        v-model="state.name"
        class="w-full"
        :disabled="!can('name')"
        :autofocus="!promotion"
      />
    </UFormField>

    <fieldset class="space-y-3">
      <legend class="text-sm font-medium">Descuento</legend>
      <URadioGroup
        v-model="state.discountType"
        :items="DISCOUNT_OPTIONS"
        orientation="horizontal"
        :disabled="!can('discount')"
        legend="Tipo de descuento"
        :ui="{ legend: 'sr-only' }"
      />
      <UFormField
        v-if="state.discountType === 'percentage'"
        label="Porcentaje"
        name="percentage"
        help="Entero de 1 a 100, de cada producto al que aplica."
      >
        <UInput
          v-model="state.percentage"
          inputmode="numeric"
          class="w-32"
          :disabled="!can('discount')"
        >
          <template #trailing><span class="text-muted">%</span></template>
        </UInput>
      </UFormField>
      <UFormField
        v-else
        label="Monto"
        name="amountOff"
        help="Una vez por compra, repartido entre los productos a los que aplica."
      >
        <UInput
          v-model="state.amountOff"
          inputmode="decimal"
          class="w-40"
          :disabled="!can('discount')"
        >
          <template #leading><span class="text-muted">$</span></template>
        </UInput>
      </UFormField>
    </fieldset>

    <UFormField label="Aplica a" name="targets">
      <TargetPicker v-model="state.targets" :disabled="!can('targets')" />
    </UFormField>

    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Canales" name="channels">
        <UCheckboxGroup
          v-model="state.channels"
          :items="CHANNEL_OPTIONS"
          :disabled="!can('channels')"
          legend="Canales"
          :ui="{ legend: 'sr-only' }"
        />
      </UFormField>
      <UFormField label="Compra mínima" name="minimumSubtotal" help="Opcional, con IVA.">
        <UInput
          v-model="state.minimumSubtotal"
          inputmode="decimal"
          class="w-40"
          :disabled="!can('minimumSubtotal')"
        >
          <template #leading><span class="text-muted">$</span></template>
        </UInput>
      </UFormField>
      <UFormField label="Inicio" name="startsAt" help="Vacío: empieza al guardar.">
        <UInput
          v-model="state.startsAt"
          type="datetime-local"
          class="w-full"
          :disabled="!can('startsAt')"
        />
      </UFormField>
      <UFormField label="Fin" name="endsAt" help="Vacío: sin fin.">
        <UInput
          v-model="state.endsAt"
          type="datetime-local"
          class="w-full"
          :disabled="!can('endsAt')"
        />
      </UFormField>
    </div>

    <fieldset class="space-y-3 rounded-md border border-default p-4">
      <legend class="px-1 text-sm font-medium">Cupón (opcional)</legend>
      <p class="text-sm text-muted">
        Con un código, la promoción solo aplica a quien lo da y reemplaza a la automática. Sin
        código, se aplica sola.
      </p>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Código" name="code" help="De 4 a 30 letras, números o guiones.">
          <UInput
            v-model="state.code"
            class="w-full uppercase"
            autocomplete="off"
            :disabled="!can('code')"
          />
        </UFormField>
        <UFormField label="Límite de usos" name="usageLimit" help="Vacío: sin límite.">
          <UInput
            v-model="state.usageLimit"
            inputmode="numeric"
            class="w-40"
            :disabled="!can('usageLimit') || !state.code"
          />
        </UFormField>
      </div>
      <UFormField name="oncePerCustomer">
        <UCheckbox
          v-model="state.oncePerCustomer"
          label="Una vez por cliente"
          :disabled="!can('oncePerCustomer') || !state.code"
        />
      </UFormField>
    </fieldset>

    <div class="flex gap-2">
      <UButton v-if="editable.size > 0" type="submit" :loading="saving">
        {{ promotion ? 'Guardar cambios' : 'Crear promoción' }}
      </UButton>
      <slot name="actions" />
    </div>
  </UForm>
</template>
